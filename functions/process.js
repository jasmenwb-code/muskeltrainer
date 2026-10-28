/* Wertet ein beendetes Duell aus und schreibt Statistik, Rangliste und Bilanz.
   db ist eine Firebase-Admin-Datenbank (oder in den Tests eine Attrappe mit derselben Schnittstelle). */
'use strict';
const { scoreDuel } = require('./scoring');
const { M } = require('./muscles');

const pairKey = (a, b) => [a, b].sort().join('_');
const RANK_START = 1000, ELO_K = 32;   // wie src/online/ranked.js
const eloDelta = (mine, theirs, score) => Math.round(ELO_K * (score - 1 / (1 + Math.pow(10, (theirs - mine) / 400))));
const ratingOf = u => (u && typeof u.rating === 'number' ? u.rating : RANK_START);
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
  // Ranked: Wertungen beider Spieler vor dem Spiel – aus der Datenbank, nicht vom Gastgeber
  const ranked = game.ranked === true;
  const before = {};
  if (ranked) for (const p of res.players) before[p] = ratingOf((await db.ref('users/' + p).once('value')).val());
  const ratings = {};
  for (const p of res.players) {
    const other = p === a ? b : a;
    const mine = res.points[p], theirs = res.points[other];
    const outcome = mine > theirs ? 'wins' : mine < theirs ? 'losses' : 'draws';
    const delta = ranked ? eloDelta(before[p], before[other], outcome === 'wins' ? 1 : outcome === 'losses' ? 0 : 0.5) : 0;
    await db.ref('users/' + p).transaction(u => {
      u = u || {};
      const st = Object.assign(emptyStats(), u.stats || {});
      st.games++; st[outcome]++; st.points += mine;
      u.stats = st; u.score = st.wins * 3 + st.draws; u.lastGid = gid;
      if (ranked) {
        u.rating = ratingOf(u) + delta;
        u.rgames = (u.rgames || 0) + 1;
        if (outcome === 'wins') u.rwins = (u.rwins || 0) + 1;
      }
      return u;
    });
    if (ranked) ratings[p] = { before: before[p], after: before[p] + delta };
  }
  await db.ref('h2h/' + pairKey(a, b)).transaction(h => {
    h = h || {};
    h.games = (h.games || 0) + 1; h.d = h.d || 0; h.w = h.w || {}; h.pts = h.pts || {};
    if (res.winner) h.w[res.winner] = (h.w[res.winner] || 0) + 1; else h.d++;
    for (const p of res.players) h.pts[p] = (h.pts[p] || 0) + res.points[p];
    h.last = Date.now(); h.lastGid = gid;
    return h;
  });
  // Ergebnis festhalten; Fragen und Antworten werden nicht mehr gebraucht
  await gameRef.update({ result: { status: 'ok', points: res.points, winner: res.winner || null, ratings: ranked ? ratings : null, at: Date.now() }, qs: null, ans: null, start: null });
  return res;
}

module.exports = { processGame };
