// Gruppen-Lobby: Einladen, Beitritt per Code, Spiel mit 3–4 Spielern, Zuschauer, Verlassen.
const assert=require('assert'); const {client,sleep,$,$$,text,texts,register,answerRound,store,errors}=require('./helpers');
(async()=>{
  const [A,B,C,D]=['anna','ben','cara','dan'].map(n=>client(n+'@x.de')); await sleep(50);
  for(const [c,n] of [[A,'Anna'],[B,'Ben'],[C,'Cara'],[D,'Dan']]) await register(c,n);
  await sleep(150);
  for(const c of [A,B,C,D]) $(c,'#modeGroup').click();
  await sleep(50);
  $(A,'#mkGroup').click(); await sleep(250);
  const code=A.w.eval('GRP.code');
  assert.match(code,/^\d{5}$/);
  assert.ok($(A,'#gStart').disabled,'Start erst ab 2 Spielern');

  // Ben per Einladung, Cara per Code
  $(A,'[data-ginv="u_ben"]').click(); await sleep(150);
  assert.match(text(B,'#inviteBar'),/Anna lädt dich in eine Lobby ein/);
  $(B,'#invYes').click(); await sleep(300);
  $(C,'#codeIn').value=code; $(C,'#joinCode').click(); await sleep(300);
  assert.match(text(A,'#gCount'),/3 von 8/);
  assert.match(text(C,'.card .sub'),/Warte, bis Anna/);

  $(A,'#gStart').click(); await sleep(200);
  assert.ok([A,B,C].every(c=>$(c,'[data-opt]')),'alle sehen die Frage');
  // Dan kommt während des Spiels dazu
  $(D,'#codeIn').value=code; $(D,'#joinCode').click(); await sleep(250);
  assert.match(text(D,'.card'),/nächsten Runde bist du dabei/);

  const pats=[[1,1,0],[1,0,0],[0,1,1],[1,1,1],[1,0,1],[0,0,0],[1,1,0],[1,0,1],[1,1,1],[0,1,0]];
  for(let r=0;r<10;r++){
    answerRound([A,B,C],A.w.eval('correctKey(GRP.game.qs[GRP.game.r])'),pats[r]); await sleep(120);
    if(r===0) assert.strictEqual($$(B,'.group.list .row').length,3,'Zwischenstand mit 3 Spielern');
    await sleep(400);
  }
  await sleep(300);
  assert.strictEqual(text(A,'.pagetitle'),'Gewonnen!');
  assert.strictEqual(text(B,'.pagetitle'),'Platz 2 von 3');
  assert.strictEqual(text(C,'.pagetitle'),'Platz 3 von 3');

  // Zurück in die Lobby: Dan ist jetzt dabei
  $(A,'#gLobby').click(); await sleep(300);
  assert.match(text(D,'#gCount'),/4 von 8/);
  $(A,'#gStart').click(); await sleep(200);
  answerRound([A,B,C,D],A.w.eval('correctKey(GRP.game.qs[GRP.game.r])'),[1,1,1,0]); await sleep(500);
  // Cara geht mitten im Spiel
  $(C,'#navBack').click(); await sleep(200);
  assert.strictEqual(text(C,'.pagetitle'),'2–8 Spieler');
  answerRound([A,B,D],A.w.eval('correctKey(GRP.game.qs[GRP.game.r])'),[1,0,1]); await sleep(150);
  assert.ok(texts(A,'.group.list .row').some(t=>/Cara.*hat verlassen/.test(t)),'Cara als „hat verlassen“');
  await sleep(500);
  // Gastgeber geht: Lobby schließt für alle
  $(A,'#navBack').click(); await sleep(300);
  assert.match(text(B,'#lobbyHint'),/Gastgeber hat die Lobby verlassen/);
  assert.match(text(D,'#lobbyHint'),/Gastgeber hat die Lobby verlassen/);
  assert.strictEqual(Object.keys(store.rooms?.['grp-'+code]||{}).length,0,'Raum leer');
  assert.ok(!store.lobby?.u_anna.ginv,'Einladung zurückgezogen');
  // Gruppenspiele zählen nicht für die Rangliste
  assert.ok(!store.users.u_anna.stats,'keine Statistik für Gruppenspiele');
  assert.ok(!store.games,'kein Spielprotokoll für Gruppenspiele');
  assert.deepStrictEqual(errors,[]);
  process.exit(0);
})().catch(e=>{ console.error(e); process.exit(1); });
