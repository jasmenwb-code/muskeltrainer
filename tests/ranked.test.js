// Ranked: Gegnersuche, Paarung, Elo-Wertung, Rangliste; drei Suchende -> ein Paar, der dritte wartet.
const assert=require('assert'); const {client,sleep,$,$$,text,texts,register,answerRound,store,errors}=require('./helpers');
(async()=>{
  const [A,B,C]=['anna','ben','cara'].map(n=>client(n+'@x.de')); await sleep(50);
  for(const [c,n] of [[A,'Anna'],[B,'Ben'],[C,'Cara']]) await register(c,n);
  await sleep(150);
  $(A,'#modeRanked').click(); await sleep(50);
  assert.strictEqual(text(A,'#rkRating'),'1000');
  $(A,'#rkFind').click(); await sleep(300);
  assert.match(text(A,'#rkCount'),/sucht sonst niemand/);
  // Ben sucht auch -> Paarung, Duell startet automatisch
  $(B,'#modeRanked').click(); await sleep(50); $(B,'#rkFind').click(); await sleep(900);
  const host=[A,B].find(c=>c.w.eval('DUEL.game!=null'));
  assert.ok(host,'ein Gastgeber hat das Duell gestartet');
  assert.ok($(A,'[data-opt]')&&$(B,'[data-opt]'),'beide spielen');
  assert.strictEqual(host.w.eval('DUEL.game.ranked'),true);
  assert.ok(!(store.rooms?.ranked&&Object.keys(store.rooms.ranked).length),'Warteschlange leer');
  // Anna antwortet immer richtig, Ben immer falsch
  for(let r=0;r<10;r++){ answerRound([A,B],host.w.eval('correctKey(DUEL.game.qs[DUEL.game.r])'),[true,false]); await sleep(560); }
  await sleep(500);
  assert.strictEqual(text(A,'.pagetitle'),'Gewonnen!');
  assert.match(text(A,'.rankchange'),/Wertung\s*1000 → 1016\s*\+16/);
  assert.match(text(B,'.rankchange'),/1000 → 984\s*-16/);
  await sleep(200);
  assert.deepStrictEqual([store.users.u_anna.rating,store.users.u_anna.rgames,store.users.u_anna.rwins],[1016,1,1]);
  assert.deepStrictEqual([store.users.u_ben.rating,store.users.u_ben.rgames],[984,1]);
  // Rangliste nach Wertung; Cara ohne Ranked-Spiel steht nicht drin
  $(A,'#leave').click(); await sleep(150);
  assert.strictEqual(text(A,'.pagetitle'),'Ranked'); assert.strictEqual(text(A,'#rkRating'),'1016');
  $(A,'#lbRow').click(); await sleep(200);
  assert.deepStrictEqual(texts(A,'#lbList .row').map(t=>t.replace(/\s+/g,' ')),['1AAnna (du)1 Ranked-Spiele · 1 Siege1016','2BBen1 Ranked-Spiele · 0 Siege984']);
  // Neue Suche mit drei Spielern: zwei werden gepaart, der dritte sucht weiter
  $(B,'#rkAgain').click(); await sleep(100);
  $(C,'#modeRanked').click(); await sleep(50); $(C,'#rkFind').click(); await sleep(100);
  A.w.eval('renderRanked()'); await sleep(50); $(A,'#rkFind').click(); await sleep(1000);
  const playing=[A,B,C].filter(c=>$(c,'[data-opt]')).length;
  const waiting=[A,B,C].filter(c=>c.w.eval("DUEL.view==='rkwait'")).length;
  assert.deepStrictEqual([playing,waiting],[2,1],'ein Paar spielt, einer sucht weiter');
  // Abbrechen der Suche räumt die Warteschlange
  const w=[A,B,C].find(c=>c.w.eval("DUEL.view==='rkwait'"));
  $(w,'#rkCancel').click(); await sleep(150);
  assert.ok(!(store.rooms?.ranked&&Object.keys(store.rooms.ranked).length),'Warteschlange leer nach Abbrechen');
  // Freundesduelle zählen nicht für die Wertung
  assert.strictEqual(store.users.u_cara.rating,undefined);
  assert.deepStrictEqual(errors,[]);
  process.exit(0);
})().catch(e=>{ console.error(e); process.exit(1); });
