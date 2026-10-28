// Ranked: Gegnersuche über den Server, Wertung (Glicko) nur vom Server, vorläufig „?“, drei Suchende, Abbrechen.
const assert=require('assert'); const {client,sleep,$,$$,text,texts,register,answerRound,store,errors}=require('./helpers');
const queueSize=()=>Object.keys(store.queue||{}).length;
(async()=>{
  const [A,B,C]=['anna','ben','cara'].map(n=>client(n+'@x.de')); await sleep(50);
  for(const [c,n] of [[A,'Anna'],[B,'Ben'],[C,'Cara']]) await register(c,n);
  await sleep(150);
  $(A,'#modeRanked').click(); await sleep(50);
  assert.strictEqual(text(A,'#rkRating'),'1000?','neu = vorläufig');
  $(A,'#rkFind').click(); await sleep(300);
  assert.strictEqual(queueSize(),1); assert.match(text(A,'#rkCount'),/sucht sonst niemand/);
  // Ben sucht auch -> der Server paart, legt das Spiel an, das Duell startet
  $(B,'#modeRanked').click(); await sleep(50); $(B,'#rkFind').click(); await sleep(1200);
  assert.strictEqual(queueSize(),0,'Warteschlange leer');
  const gid=Object.keys(store.games)[0], game=store.games[gid];
  assert.ok(game.ranked===true&&typeof game.created==='number','Server hat das Ranked-Spiel angelegt');
  const host=[A,B].find(c=>c.w.eval('DUEL.game!=null')); assert.ok(host,'Gastgeber startet');
  assert.strictEqual(host.w.eval('DUEL.game.id'),gid,'Spiel-ID vom Server');
  assert.ok($(A,'[data-opt]')&&$(B,'[data-opt]'),'beide spielen');
  for(let r=0;r<10;r++){ answerRound([A,B],host.w.eval('correctKey(DUEL.game.qs[DUEL.game.r])'),[true,false]); await sleep(560); }
  await sleep(700);
  assert.strictEqual(text(A,'.pagetitle'),'Gewonnen!');
  // Wertung kommt vom Server: zwei neue Spieler -> großer Sprung
  assert.match(text(A,'.rankchange'),/Wertung\s*1000 → 1162\?\s*\+162/);
  assert.match(text(B,'.rankchange'),/1000 → 838\?\s*-162/);
  assert.deepStrictEqual([store.users.u_anna.rating,store.users.u_anna.rgames,store.users.u_anna.rwins],[1162,1,1]);
  assert.ok(store.users.u_anna.rd<350&&typeof store.users.u_anna.rlast==='number','Unsicherheit gesunken');
  $(A,'#leave').click(); await sleep(150);
  assert.strictEqual(text(A,'#rkRating'),'1162?');
  $(A,'#lbRow').click(); await sleep(200);
  assert.deepStrictEqual(texts(A,'#lbList .row'),['1AAnna (du)1 Ranked-Spiele · 1 Siege1162?','2BBen1 Ranked-Spiele · 0 Siege838?']);
  // Drei suchen: zwei spielen, einer wartet; Abbrechen räumt die Warteschlange
  $(B,'#rkAgain').click(); await sleep(100);
  $(C,'#modeRanked').click(); await sleep(50); $(C,'#rkFind').click(); await sleep(100);
  A.w.eval('renderRanked()'); await sleep(50); $(A,'#rkFind').click(); await sleep(1200);
  const playing=[A,B,C].filter(c=>$(c,'[data-opt]')).length, waiting=[A,B,C].filter(c=>c.w.eval("DUEL.view==='rkwait'"));
  assert.deepStrictEqual([playing,waiting.length],[2,1],'ein Paar spielt, einer sucht weiter');
  $(waiting[0],'#rkCancel').click(); await sleep(150);
  assert.strictEqual(queueSize(),0,'Warteschlange leer nach Abbrechen');
  assert.deepStrictEqual(errors,[]);
  process.exit(0);
})().catch(e=>{ console.error(e); process.exit(1); });
