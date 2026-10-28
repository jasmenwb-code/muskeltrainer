/* Wertung nach Glicko (wie chess.com): Neben der Wertung r wird die Unsicherheit rd gespeichert.
   - Neue Spieler: r = 1000, rd = 350 → große Sprünge in den ersten Spielen.
   - Jedes Spiel verringert rd → die Wertung wird ruhiger (Untergrenze 50).
   - Pause: rd wächst wieder (etwa ein halbes Jahr bis ganz unsicher).
   - Gegner mit unsicherer Wertung bewegen die eigene Wertung weniger.
   - Vorläufig („?“) bis zum 10. Ranked-Spiel. */
'use strict';
const START = 1000, RD_START = 350, RD_MIN = 50, PROVISIONAL_GAMES = 10;
const C = 25;                                   // Anstieg der Unsicherheit pro Tag ohne Ranked-Spiel
const DAY = 86400000;
const Q = Math.log(10) / 400;

const g = rd => 1 / Math.sqrt(1 + 3 * Q * Q * rd * rd / (Math.PI * Math.PI));
const expected = (r, rj, rdj) => 1 / (1 + Math.pow(10, -g(rdj) * (r - rj) / 400));

/* Wertung und Unsicherheit eines Spielers zum Zeitpunkt now (Unsicherheit wächst seit dem letzten Spiel) */
function current(u, now) {
  const r = u && typeof u.rating === 'number' ? u.rating : START;
  let rd = u && typeof u.rd === 'number' ? u.rd : RD_START;
  if (u && typeof u.rlast === 'number' && now > u.rlast) rd = Math.min(RD_START, Math.sqrt(rd * rd + C * C * (now - u.rlast) / DAY));
  return { r, rd };
}
/* Neue Wertung nach einem Spiel. score: 1 Sieg, 0.5 Unentschieden, 0 Niederlage */
function update(me, opp, score) {
  const gj = g(opp.rd), e = expected(me.r, opp.r, opp.rd);
  const d2 = 1 / (Q * Q * gj * gj * e * (1 - e));
  const denom = 1 / (me.rd * me.rd) + 1 / d2;
  return {
    r: Math.round(me.r + (Q / denom) * gj * (score - e)),
    rd: Math.max(RD_MIN, Math.round(Math.sqrt(1 / denom) * 10) / 10),
  };
}
const isProvisional = games => (games || 0) < PROVISIONAL_GAMES;

module.exports = { current, update, isProvisional, START, RD_START, RD_MIN, PROVISIONAL_GAMES };
