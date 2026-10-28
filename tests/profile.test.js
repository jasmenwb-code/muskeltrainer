// Profil: Anmeldung über das Profil-Symbol, Suche nach Name und Code, Freunde, Foto, Name, Rangliste, Abmelden.
const assert=require('assert'); const {client,sleep,$,$$,text,texts,input,register,store,errors}=require('./helpers');
(async()=>{
  const A=client('anna@x.de'), B=client('ben@x.de'), C=client('carla@x.de'); await sleep(50);
  await register(A,'Anna Berg','#profileBtn');
  assert.ok($(A,'#pName')&&$(A,'#fSearch'),'nach der Anmeldung direkt im Profil');
  assert.match(text(A,'.fcode'),/^[A-Z0-9]{6}$/);
  await register(B,'Ben Müller','#profileBtn'); await register(C,'Benedikt'); await sleep(200);

  input(A,'#fSearch','ben'); await sleep(500);
  assert.deepStrictEqual(texts(A,'#fResults .row .label > span').sort(),['Ben Müller','Benedikt']);
  $$(A,'[data-freq]').find(b=>b.dataset.freq==='u_ben').click(); await sleep(250);
  assert.ok(store.requests?.u_ben.u_anna&&!store.friends,'erst Anfrage, noch keine Freundschaft');
  B.w.eval('renderProfile()'); await sleep(50);
  $(B,'[data-faccept="u_anna"]').click(); await sleep(300);
  assert.ok(store.friends?.u_anna.u_ben&&store.friends?.u_ben.u_anna,'nach Annahme beidseitig befreundet');

  input(A,'#fSearch',store.users.u_carla.code); await sleep(500);
  assert.deepStrictEqual(texts(A,'#fResults .row .label > span'),['Benedikt'],'Suche per Code');

  await A.w.eval("savePhoto('data:image/jpeg;base64,/9j/4AAQSkZJRg==')"); A.w.eval('renderProfile()'); await sleep(100);
  assert.ok($(A,'#profileBtn img')&&$(A,'.avatar.xl img'),'Foto in Kopfzeile und Profil');
  await sleep(200);
  assert.ok($(B,'#friendList .avatar img'),'Ben sieht Annas Foto');
  // Unsichere Bilddaten werden nicht angezeigt
  store.users.u_anna.photo='javascript:alert(1)'; B.w.eval("SOC.info.u_anna.photo='javascript:alert(1)'; renderFriendList()");
  assert.ok(!$(B,'#friendList .avatar img'),'nur echte Bilddaten');

  input(A,'#pName','Anna B.'); await sleep(800);
  assert.deepStrictEqual([store.users.u_anna.name,store.users.u_anna.nameLower],['Anna B.','anna b']);
  assert.ok(texts(A,'#othersOnline .row').some(t=>/Benedikt/.test(t)),'Benedikt unter „Gerade online“');

  $(A,'#lbRow').click(); await sleep(150);
  assert.strictEqual(text(A,'.pagetitle'),'Rangliste');
  assert.strictEqual($$(A,'#lbList .avatar').length,1,'nur Anna (ohne Spiele nur man selbst)');

  // Abmelden
  A.w.eval('renderProfile()'); await sleep(50); $(A,'#logout').click(); await sleep(150);
  assert.ok($(A,'#go'),'zurück auf der Startseite');
  assert.ok(!$(A,'#profileBtn img'),'Foto aus der Kopfzeile entfernt');
  assert.ok(!store.lobby?.u_anna,'aus der Lobby abgemeldet');
  assert.deepStrictEqual(errors,[]);
  process.exit(0);
})().catch(e=>{ console.error(e); process.exit(1); });
