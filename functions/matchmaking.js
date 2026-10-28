/* Gegnersuche für Ranked auf dem Server.
   Suchende tragen sich in queue/{uid} ein ({at: Serverzeit}). Bei jedem neuen Eintrag nimmt der Server
   die zwei, die am längsten warten, aus der Warteschlange und legt für sie ein Ranked-Spiel an:
   games/{gid}: {host, op, ranked:true, created} und matches/{uid}: {gid, role, opp}.
   Nur der Server darf "ranked" setzen – so kann niemand ein Freundesduell als Ranked werten lassen. */
'use strict';

async function matchQueue(db, now = Date.now()) {
  let pair = null;
  const tx = await db.ref('queue').transaction(q => {
    pair = null;
    if (!q) return q;   // nie abbrechen: bei veraltetem Zwischenspeicher wiederholt Firebase mit echten Daten
    const ids = Object.keys(q).filter(id => q[id] && typeof q[id].at === 'number')
      .sort((a, b) => q[a].at - q[b].at || (a < b ? -1 : 1));
    if (ids.length < 2) return q;
    pair = [ids[0], ids[1]];
    const rest = Object.assign({}, q); delete rest[pair[0]]; delete rest[pair[1]];
    return Object.keys(rest).length ? rest : null;
  });
  if (!tx.committed || !pair) return null;
  const [host, op] = pair;
  const gid = db.ref('games').push().key;
  await db.ref().update({
    [`games/${gid}/host`]: host, [`games/${gid}/op`]: op, [`games/${gid}/ranked`]: true, [`games/${gid}/created`]: now,
    [`matches/${host}`]: { gid, role: 'host', opp: op, at: now },
    [`matches/${op}`]: { gid, role: 'guest', opp: host, at: now },
  });
  return { gid, host, op };
}

module.exports = { matchQueue };
