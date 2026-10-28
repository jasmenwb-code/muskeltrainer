/* Wertet ein beendetes Duell aus und schreibt Statistik, Rangliste und Bilanz.
   db ist eine Firebase-Admin-Datenbank (oder in den Tests eine Attrappe mit derselben Schnittstelle). */
'use strict';
const { scoreDuel } = require('./scoring');
const { M } = require('./muscles');

const pairKey = (a, b) => [a, b].sort().join('_');
const glicko = require('./glicko');
const RANKED_PER_DAY = 3;   // höchstens 3 gewertete Ranked-Spiele pro Paar und Tag (gegen Punkte-Schieben)
const DAY = 86400000;
const emptyStats = () => ({ games: 0, wins: 0, losses: 0, draws: 0, points: 0 });

async function processGame(db, gid) {
  const gameRef = db.ref('games/' + gid);
  // Nur einmal auswerten, auch wenn die Funktion doppelt ausgelöst wird
  const claim = await gameRef.child('result').transaction(cur => (cur ? undefined : { status: 'pending' }));
  if (!claim.committed) return null;

  const game = (await gameRef.once('value')).val();
  const res = scoreDuel(game, M);
  if (!res.valid) {
    await gameRef.child('result').set({ status: 'invalid', reason: res.reason, at: Date.now() });
    return res;
  }
  const [a, b] = res.players;
  // Ranked: nur Spiele, die der Server selbst über die Gegnersuche angelegt hat (ranked + created schreibt nur er)
  const now = Date.now();
  const h2hRef = db.ref('h2h/' + pairKey(a, b));
  let ranked = game.ranked === true && typeof game.created === 'number', rankNote = null;
  if (ranked) {
    const recent = Object.values(((await h2hRef.once('value')).val() || {}).rk || {}).filter(t => now - t < DAY);
    if (recent.length >= RANKED_PER_DAY) { ranked = false; rankNote = 'limit'; }
  }
  // Wertungen vor dem Spiel – aus der Datenbank, Unsicherheit wächst seit dem letzten Spiel
  const before = {};
  if (ranked) for (const p of res.players) before[p] = glicko.current((await db.ref('users/' + p).once('value')).val(), now);
  const ratings = {};
  for (const p of res.players) {
    const other = p === a ? b : a;
    const mine = res.points[p], theirs = res.points[other];
    const outcome = mine > theirs ? 'wins' : mine < theirs ? 'losses' : 'draws';
    const after = ranked ? glicko.update(before[p], before[other], outcome === 'wins' ? 1 : outcome === 'losses' ? 0 : 0.5) : null;
    let games = 0;
    await db.ref('users/' + p).transaction(u => {
      u = u || {};
      const st = Object.assign(emptyStats(), u.stats || {});
      st.games++; st[outcome]++; st.points += mine;
      u.stats = st; u.score = st.wins * 3 + st.draws; u.lastGid = gid;
      if (after) {
        u.rating = after.r; u.rd = after.rd; u.rlast = now;
        u.rgames = (u.rgames || 0) + 1; games = u.rgames;
        if (outcome === 'wins') u.rwins = (u.rwins || 0) + 1;
      }
      return u;
    });
    if (after) ratings[p] = { before: before[p].r, after: after.r, provisional: glicko.isProvisional(games) };
  }
  await h2hRef.transaction(h => {
    h = h || {};
    h.games = (h.games || 0) + 1; h.d = h.d || 0; h.w = h.w || {}; h.pts = h.pts || {};
    if (res.winner) h.w[res.winner] = (h.w[res.winner] || 0) + 1; else h.d++;
    for (const p of res.players) h.pts[p] = (h.pts[p] || 0) + res.points[p];
    h.last = now; h.lastGid = gid;
    if (ranked) { h.rk = Object.assign({}, h.rk || {}); h.rk[gid] = now; for (const k of Object.keys(h.rk)) if (now - h.rk[k] >= DAY) delete h.rk[k]; }
    return h;
  });
  // Ergebnis festhalten; Fragen und Antworten werden nicht mehr gebraucht
  await gameRef.update({ result: { status: 'ok', points: res.points, winner: res.winner || null, ratings: ranked ? ratings : null, rankNote, at: now }, qs: null, ans: null, start: null });
  return res;
}

module.exports = { processGame };
