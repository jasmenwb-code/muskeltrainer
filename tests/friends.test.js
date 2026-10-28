// Freundschaftsanfragen: senden, Punkt am Profil, annehmen, ablehnen, zurückziehen, gegenseitig, offline anzeigen, entfernen.
const assert=require('assert'); const {client,sleep,$,$$,text,texts,input,register,store,errors}=require('./helpers');
const rows=(c,sel)=>texts(c,sel+' .row');
(async()=>{
  const [A,B,C,D]=['anna','ben','cara','dan'].map(n=>client(n+'@x.de')); await sleep(50);
  await register(A,'Anna'); await register(B,'Ben'); await register(C,'🌟 Cara'); await register(D,'Dan'); await sleep(200);

  // Anna schickt Ben aus der Online-Liste eine Anfrage
  $(A,'#onlineList [data-freq="u_ben"]').click(); await sleep(250);
  assert.ok(store.requests?.u_ben.u_anna&&store.sent?.u_anna.u_ben,'Anfrage und Gesendet-Eintrag');
  assert.ok(!store.friends,'noch keine Freundschaft');
  assert.ok($(A,'#onlineList [data-fcancel="u_ben"]'),'bei Anna steht „Angefragt“');
  // Ben sieht den Punkt am Profil und die Anfrage in der Lobby
  assert.strictEqual($(B,'#reqDot').hidden,false); assert.strictEqual(text(B,'#reqDot'),'1');
  assert.match(text(B,'#reqBox'),/Freundschaftsanfragen.*Anna.*möchte mit dir befreundet sein/);
  $(B,'#reqBox [data-faccept="u_anna"]').click(); await sleep(300);
  assert.ok(store.friends?.u_anna.u_ben&&store.friends?.u_ben.u_anna,'befreundet');
  assert.ok(!store.requests?.u_ben&&!store.sent?.u_anna,'Anfrage aufgeräumt');
  assert.strictEqual($(B,'#reqDot').hidden,true,'Punkt weg');
  assert.ok(rows(A,'#friendList').some(t=>/Ben.*online/.test(t)),'Ben in Annas Freundesliste');

  // Ablehnen: Dan fragt Cara, Cara lehnt ab
  $(D,'#onlineList [data-freq="u_cara"]').click(); await sleep(250);
  $(C,'#reqBox [data-fdecline="u_dan"]').click(); await sleep(250);
  assert.ok(!store.requests?.u_cara&&!store.sent?.u_dan&&!store.friends?.u_cara,'abgelehnt, nichts übrig');
  assert.ok($(D,'#onlineList [data-freq="u_cara"]'),'Dan kann erneut anfragen');

  // Zurückziehen im Profil
  $(D,'#onlineList [data-freq="u_anna"]').click(); await sleep(200);
  D.w.eval('renderProfile()'); await sleep(50);
  assert.match(text(D,'#sentBox'),/Gesendete Anfragen.*Anna.*wartet auf Bestätigung/);
  $(D,'#sentBox [data-fcancel="u_anna"]').click(); await sleep(250);
  assert.ok(!store.requests?.u_anna,'zurückgezogen'); assert.strictEqual($(A,'#reqDot').hidden,true);

  // Gegenseitig: Cara fragt Anna, Anna fragt Cara über die Suche -> sofort befreundet
  $(C,'#onlineList [data-freq="u_anna"]').click(); await sleep(200);
  A.w.eval('renderProfile()'); await sleep(50);
  input(A,'#fSearch','cara'); await sleep(500);
  assert.match(text(A,'#fResults'),/Annehmen/,'Suche zeigt „Annehmen“');
  $(A,'#fResults [data-faccept="u_cara"]').click(); await sleep(300);
  assert.ok(store.friends?.u_anna.u_cara&&store.friends?.u_cara.u_anna,'Anna und Cara befreundet');
  // Emoji-Name: Kürzel bleibt ein ganzes Zeichen
  assert.ok(texts(A,'#friendList .avatar span').includes('🌟C'),'Initialen mit Emoji');

  // Offline: Cara schließt die Seite -> bleibt in Annas Liste, mit „zuletzt online“
  await C.w.eval('disconnectLobby()'); store.users.u_cara.lastSeen=Date.now()-5*60000;
  A.w.eval('loadFriendData()'); await sleep(200);
  assert.ok(rows(A,'#friendList').some(t=>/Cara.*zuletzt online vor 5 Min\./.test(t)),'offline mit „zuletzt online“');
  // … und taucht beim Einladen in eine Lobby als „offline“ auf
  $(A,'#navBack').click(); await sleep(100); $(A,'#duel').click(); await sleep(200); $(A,'#mkGroup').click(); await sleep(300);
  assert.ok(rows(A,'#gInvite').some(t=>/Cara.*Freund · zuletzt online/.test(t)),'Offline-Freund in der Einladeliste');
  $(A,'#gLeave').click(); await sleep(200);

  // Freund entfernen: auf beiden Seiten weg
  $(A,'[data-fr="u_ben"]').click(); await sleep(50); $(A,'#frRm').click(); $(A,'#frRm').click(); await sleep(300);
  assert.ok(!store.friends?.u_anna.u_ben&&!(store.friends?.u_ben||{}).u_anna,'beidseitig entfernt');
  assert.deepStrictEqual(errors,[]);
  process.exit(0);
})().catch(e=>{ console.error(e); process.exit(1); });
