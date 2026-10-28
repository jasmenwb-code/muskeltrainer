// Duell: Herausforderung, 10 Runden, Statistik, Bilanz, Revanche, Absage, Code.
const assert=require('assert'); const {client,sleep,$,$$,text,register,answerRound,store,errors}=require('./helpers');
async function play(A,B,aAlwaysRight){
  for(let r=0;r<10;r++){
    const key=A.w.eval('correctKey(DUEL.game.qs[DUEL.game.r])');
    answerRound([A,B],key,[true,!aAlwaysRight&&r%3!==0]);
    await sleep(560);
  }
  await sleep(400);
}
(async()=>{
  const A=client('anna@x.de'), B=client('ben@x.de'), C=client('cara@x.de'); await sleep(50);
  await register(A,'Anna'); await register(B,'Ben'); await register(C,'Cara'); await sleep(200);
  assert.strictEqual(text(A,'.pagetitle'),'Duell');
  assert.deepStrictEqual(['#mode1v1','#modeGroup','#modeRanked'].map(s=>!!$(A,s)),[true,true,true],'drei Spielmodi');
  for(const c of [A,B,C]) $(c,'#mode1v1').click();
  await sleep(100);
  assert.strictEqual(text(A,'.pagetitle'),'1 gegen 1');
  assert.strictEqual($$(A,'#onlineList [data-ch]').length,2,'Ben und Cara online');

  // Herausfordern und annehmen
  $$(A,'#onlineList [data-ch]').find(b=>b.dataset.ch==='u_ben').click(); await sleep(200);
  assert.match(text(B,'#inviteBar'),/Anna fordert dich zum Duell heraus/);
  $(B,'#invYes').click(); await sleep(300);
  assert.ok($(A,'[data-opt]')&&$(B,'[data-opt]'),'beide sehen die Frage');
  assert.strictEqual(text(A,'.question'),text(B,'.question'),'gleiche Frage');
  await play(A,B,true);
  assert.strictEqual(text(A,'.pagetitle'),'Gewonnen!'); assert.strictEqual(text(B,'.pagetitle'),'Verloren');
  await sleep(200);
  assert.deepStrictEqual([store.users.u_anna.stats.wins,store.users.u_ben.stats.losses],[1,1]);
  const h=store.h2h.u_anna_u_ben; assert.strictEqual(h.games,1); assert.strictEqual(h.w.u_anna,1);
  assert.match(text(A,'#h2hLine'),/Bilanz gegen Ben: 1 : 0/);

  // Revanche zählt einzeln
  $(A,'#again').click(); await sleep(250); await play(A,B,false); await sleep(200);
  assert.strictEqual(store.h2h.u_anna_u_ben.games,2);
  $(A,'#leave').click(); $(B,'#leave').click(); await sleep(150);

  // Absage
  $$(A,'#onlineList [data-ch]').find(b=>b.dataset.ch==='u_cara').click(); await sleep(200);
  $(C,'#invNo').click(); await sleep(300);
  assert.match(text(A,'#lobbyHint'),/abgelehnt/);

  // Mit Code
  $(A,'#mkCode').click(); await sleep(150);
  const code=text(A,'.codebig');
  $(C,'#codeIn').value=code; $(C,'#joinCode').click(); await sleep(300);
  assert.ok($(C,'[data-opt]'),'Beitritt per Code startet das Duell');
  $(C,'#navBack').click(); await sleep(250);
  assert.match(text(A,'#lobbyHint'),/verlassen/);
  $(C,'#codeIn').value='12'; $(C,'#joinCode').click();
  assert.match(text(C,'#lobbyHint'),/4 Ziffern/);
  assert.deepStrictEqual(errors,[]);
  process.exit(0);
})().catch(e=>{ console.error(e); process.exit(1); });
