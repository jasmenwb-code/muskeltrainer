/* Nachrechnen eines Duells auf dem Server.
   Grundlage ist nur, was in der Datenbank steht und von den Regeln abgesichert ist:
   games/{gid}: {host, op, qs, players:{uid:true}, start:{runde:Serverzeit}, ans:{uid:{runde:{c, at:Serverzeit}}}, end}
   Die richtige Antwort wird aus den Muskeldaten bestimmt, die Zeit aus Server-Zeitstempeln. */
'use strict';
const ROUNDS = 10;
const QTIME = 30000;   // 30 Sekunden pro Frage
const GRACE = 3000;    // Puffer für Übertragungszeiten
const FIELDS = ['U', 'A', 'F', 'I'];

/* Ist M[mid][k][i] ein echter Lerneintrag (kein Hinweis mit "!")? */
function isFact(M, mid, k, i) {
  const m = Number.isInteger(mid) ? M[mid] : null;
  return !!(m && Array.isArray(m[k]) && Number.isInteger(i) && typeof m[k][i] === 'string' && !m[k][i].startsWith('!'));
}
const at = (o, i) => (o == null ? undefined : o[i]);   // Firebase liefert Listen mal als Array, mal als Objekt

/* Gibt den Schlüssel der richtigen Antwort zurück oder null, wenn die Frage nicht gültig ist. */
function correctKey(q, M) {
  if (!q || !FIELDS.includes(q.k) || !Array.isArray(q.o) || q.o.length !== 4) return null;
  if (!isFact(M, q.m, q.k, q.i)) return null;
  let keys;
  if (q.t === 'f') {
    if (!q.o.every(o => Array.isArray(o) && o.length === 2 && isFact(M, o[0], q.k, o[1]))) return null;
    keys = q.o.map(o => o[0] + ':' + o[1]);
  } else if (q.t === 'r') {
    if (q.k === 'F' || !q.o.every(id => Number.isInteger(id) && M[id])) return null;
    keys = q.o.map(String);
  } else return null;
  const key = q.t === 'f' ? q.m + ':' + q.i : String(q.m);
  return new Set(keys).size === 4 && keys.includes(key) ? key : null;
}

/* Punkte nach Tempo (wie in der Website, src/online/round.js): richtig sofort 100, nach 30 s 10, falsch 0 */
const PTS_MAX = 100, PTS_MIN = 10;
const speedPoints = t => Math.round(PTS_MAX - (PTS_MAX - PTS_MIN) * Math.min(Math.max(t, 0), QTIME) / QTIME);
function evalAnswer(a, start, key) {
  if (!a || typeof a.at !== 'number' || typeof a.c !== 'string' || typeof start !== 'number') return { ok: false, pt: 0, t: null };
  const t = a.at - start;
  if (t < 0 || t > QTIME + GRACE) return { ok: false, pt: 0, t: null };
  const ok = a.c === key;
  return { ok, pt: ok ? speedPoints(t) : 0, t: Math.min(t, QTIME) };
}

/* Ergebnis: {valid:false, reason} oder {valid:true, players:[host, op], points:{uid:n}, winner:uid|null} */
function scoreDuel(game, M) {
  if (!game || typeof game.host !== 'string' || typeof game.op !== 'string' || game.host === game.op) return { valid: false, reason: 'players' };
  const players = [game.host, game.op];
  if (!players.every(p => at(game.players, p) === true)) return { valid: false, reason: 'players' };
  const keys = [];
  for (let r = 0; r < ROUNDS; r++) {
    const key = correctKey(at(game.qs, r), M);
    if (!key) return { valid: false, reason: 'question' };
    if (typeof at(game.start, r) !== 'number') return { valid: false, reason: 'incomplete' };
    keys.push(key);
  }
  if (at(game.qs, ROUNDS) != null) return { valid: false, reason: 'question' };
  const points = {};
  for (const p of players) {
    points[p] = 0;
    for (let r = 0; r < ROUNDS; r++) points[p] += evalAnswer(at(at(game.ans, p), r), at(game.start, r), keys[r]).pt;
  }
  const [a, b] = players;
  return { valid: true, players, points, winner: points[a] > points[b] ? a : points[b] > points[a] ? b : null };
}

module.exports = { scoreDuel, correctKey, evalAnswer, speedPoints, ROUNDS, QTIME, GRACE };
