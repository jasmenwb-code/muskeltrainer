// Server-Auswertung (functions/): richtige Wertung und Schutz gegen Manipulation.
const assert=require('assert');
const {scoreDuel,correctKey}=require('../functions/scoring');
const {processGame}=require('../functions/process');
const {M}=require('../functions/muscles');
const {makeFirebase,store}=require('./fbmock');
const db=makeFirebase('admin').database();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* Gültiges Duell bauen: 10 Fragen; A antwortet nach 5 s richtig, B nach 15 s falsch */
function q(r){ const m=M[r]; const k='I'; const o=[[m.id,0]]; for(let id=0;o.length<4;id++) if(id!==m.id&&M[id].I) o.push([id,0]); return {t:'f',m:m.id,k,i:0,o}; }
function game(over={}){
  const g={host:'A',op:'B',players:{A:true,B:true},qs:[],start:{},ans:{A:{},B:{}},end:1};
  for(let r=0;r<10;r++){ g.qs.push(q(r)); g.start[r]=r*60000; g.ans.A[r]={c:r+':0',at:r*60000+5000}; g.ans.B[r]={c:'99:0',at:r*60000+15000}; }
  return Object.assign(g,over);
}
let res=scoreDuel(game(),M);
// A nach 5 s richtig: 100 - 90·5/30 = 85 Punkte pro Runde
assert.ok(res.valid); assert.deepStrictEqual(res.points,{A:850,B:0}); assert.strictEqual(res.winner,'A');

// Zeiten kommen vom Server: 15 s -> 55, 25 s -> 25, 31 s -> 10 (Puffer), 40 s -> zu spät, vor dem Start -> ungültig
let g=game(); g.ans.B[0]={c:'0:0',at:15000}; g.ans.B[1]={c:'1:0',at:60000+25000}; g.ans.B[2]={c:'2:0',at:120000+40000}; g.ans.B[3]={c:'3:0',at:180000-1}; g.ans.B[4]={c:'4:0',at:240000+31000};
assert.strictEqual(scoreDuel(g,M).points.B,55+25+0+0+10);

// Manipulierte Fragen: falscher Index, Hinweis statt Fakt, doppelte Optionen, richtige Antwort fehlt, unbekannter Typ
const bad=[
  qq=>{ qq.i=99; }, qq=>{ qq.o[1]=qq.o[0]; }, qq=>{ qq.o=qq.o.slice(1).concat([[5,0]]); qq.o[3]=[6,0]; }, qq=>{ qq.t='x'; }, qq=>{ qq.k='UA'; }, qq=>{ qq.o.push([7,0]); },
];
for(const f of bad){ g=game(); f(g.qs[4]); assert.strictEqual(scoreDuel(g,M).valid,false); }
const note=M.findIndex(m=>(m.F||[]).some(s=>s.startsWith('!')));
g=game(); g.qs[0]={t:'f',m:note,k:'F',i:M[note].F.findIndex(s=>s.startsWith('!')),o:[]}; assert.strictEqual(scoreDuel(g,M).valid,false,'Hinweise sind keine Antworten');
// Rückwärtsfrage gültig, Funktion als Rückwärtsfrage ungültig
assert.strictEqual(correctKey({t:'r',m:3,k:'U',i:0,o:[3,4,5,6]},M),'3');
assert.strictEqual(correctKey({t:'r',m:3,k:'F',i:0,o:[3,4,5,6]},M),null);

// Spieler: Gegner muss selbst beigetreten sein, nicht gegen sich selbst, unvollständige Spiele zählen nicht
assert.strictEqual(scoreDuel(game({players:{A:true}}),M).valid,false);
assert.strictEqual(scoreDuel(game({op:'A'}),M).valid,false);
g=game(); delete g.start[9]; assert.strictEqual(scoreDuel(g,M).valid,false);
g=game(); g.qs.push(q(10)); assert.strictEqual(scoreDuel(g,M).valid,false,'genau 10 Fragen');
// Antworten Dritter werden ignoriert
g=game(); g.players.C=true; g.ans.C={0:{c:'0:0',at:1}}; assert.deepStrictEqual(scoreDuel(g,M).points,{A:850,B:0});

(async()=>{
  // Schreiben: Statistik, Rangliste, Bilanz – und nur einmal, auch bei doppeltem Auslösen
  store.games={g1:game()}; store.users={A:{name:'A',stats:{games:1,wins:0,losses:1,draws:0,points:4},score:0},B:{name:'B'}};
  await Promise.all([processGame(db,'g1'),processGame(db,'g1')]); await sleep(10);
  assert.deepStrictEqual(store.users.A.stats,{games:2,wins:1,losses:1,draws:0,points:854});
  assert.strictEqual(store.users.A.score,3);
  assert.deepStrictEqual(store.users.B.stats,{games:1,wins:0,losses:1,draws:0,points:0});
  assert.strictEqual(store.h2h.A_B.games,1); assert.strictEqual(store.h2h.A_B.w.A,1);
  assert.strictEqual(store.games.g1.result.status,'ok');
  // Ranked (Glicko) nur für Spiele, die der Server angelegt hat (ranked + created)
  store.users.A.rating=1000; store.users.B.rating=1040;
  store.games.g3=game({ranked:true,created:1,rk:{A:5000,B:1}});
  await processGame(db,'g3'); await sleep(10);
  const ra=store.games.g3.result.ratings;
  assert.strictEqual(ra.A.before,1000,'Wertung aus der Datenbank, nicht vom Gastgeber'); assert.ok(ra.A.after>1100&&ra.B.after<940,'große Sprünge bei neuen Spielern');
  assert.strictEqual(store.users.A.rating,ra.A.after); assert.ok(ra.A.provisional);
  // Vom Handy als „ranked“ markiert, aber nicht vom Server angelegt (kein created): keine Wertung
  const rBefore=store.users.A.rating;
  store.games.g4=game({ranked:true}); await processGame(db,'g4'); await sleep(10);
  assert.strictEqual(store.users.A.rating,rBefore); assert.ok(!store.games.g4.result.ratings,'keine Wertung');
  // Punkte-Schieben: höchstens 3 gewertete Ranked-Spiele pro Paar und Tag
  for(const id of ['g5','g6','g7']){ store.games[id]=game({ranked:true,created:1}); await processGame(db,id); await sleep(5); }
  assert.ok(store.games.g6.result.ratings,'3. Spiel gewertet'); assert.strictEqual(store.games.g7.result.rankNote,'limit','4. Spiel nicht gewertet');
  assert.strictEqual(store.users.A.rgames,3);
  // Gegnersuche: die zwei, die am längsten warten, werden gepaart
  const {matchQueue}=require('../functions/matchmaking');
  store.queue={X:{at:3},Y:{at:1},Z:{at:2}};
  const m=await matchQueue(db); await sleep(10);
  assert.deepStrictEqual([m.host,m.op],['Y','Z']); assert.deepStrictEqual(Object.keys(store.queue),['X']);
  assert.ok(store.games[m.gid].ranked&&store.matches.Y.gid===m.gid&&store.matches.Z.role==='guest');
  assert.strictEqual(await matchQueue(db),null,'allein in der Schlange: kein Spiel');
  // Ungültiges Spiel: nichts wird gezählt
  g=game(); g.qs[0].i=99; store.games.g2=g;
  await processGame(db,'g2');
  assert.strictEqual(store.games.g2.result.status,'invalid'); assert.strictEqual(store.users.A.stats.games,7);
  process.exit(0);
})().catch(e=>{ console.error(e); process.exit(1); });
