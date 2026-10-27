/* Wertet ein beendetes Duell aus und schreibt Statistik, Rangliste und Bilanz.
   db ist eine Firebase-Admin-Datenbank (oder in den Tests eine Attrappe mit derselben Schnittstelle). */
'use strict';
const { scoreDuel } = require('./scoring');
const { M } = require('./muscles');

const pairKey = (a, b) => [a, b].sort().join('_');
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
  for (const p of res.players) {
    const mine = res.points[p], theirs = res.points[p === a ? b : a];
    const outcome = mine > theirs ? 'wins' : mine < theirs ? 'losses' : 'draws';
    await db.ref('users/' + p).transaction(u => {
      u = u || {};
      const st = Object.assign(emptyStats(), u.stats || {});
      st.games++; st[outcome]++; st.points += mine;
      u.stats = st; u.score = st.wins * 3 + st.draws; u.lastGid = gid;
      return u;
    });
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
  await gameRef.update({ result: { status: 'ok', points: res.points, winner: res.winner || null, at: Date.now() }, qs: null, ans: null, start: null });
  return res;
}

module.exports = { processGame };
