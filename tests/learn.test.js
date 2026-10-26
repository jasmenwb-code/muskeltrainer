// Lernmodus: Auswahl, 20 Fragen, Lösung, Ende.
const assert=require('assert'); const {client,sleep,$,$$,text,errors}=require('./helpers');
(async()=>{
  const A=client('anna@x.de'); await sleep(50);
  assert.ok($(A,'#duel'),'Startseite mit „Gegen Freunde spielen“');
  assert.match(text(A,'.footnote'),/84 Muskeln ausgewählt · 20 Fragen/);
  // Regionen einschränken
  $(A,'#regRow').click(); $(A,'#regNone').click(); await sleep(10);
  assert.ok($(A,'#go').disabled,'ohne Region kein Start');
  $(A,'[data-reg="oberarm"]').click(); await sleep(10);
  assert.match(text(A,'.footnote'),/^4 Muskeln/);
  $(A,'[data-reg="unterarm"]').click(); $(A,'#regAll').click(); await sleep(10);
  // Kategorie aus- und wieder einschalten; die letzte bleibt immer an
  ['U','A','F'].forEach(k=>$(A,`[data-cat="${k}"]`).click()); $(A,'[data-cat="I"]').click(); await sleep(10);
  assert.strictEqual($(A,'[data-cat="I"]').getAttribute('aria-checked'),'true','letzte Kategorie bleibt an');
  ['U','A','F'].forEach(k=>$(A,`[data-cat="${k}"]`).click()); await sleep(10);
  // Durchgang
  $(A,'#go').click(); await sleep(10);
  assert.strictEqual($$(A,'[data-opt]').length,4,'4 Antworten');
  assert.match(text(A,'.progress'),/Frage 1 von 20/);
  const key=A.w.eval('correctKey(S.queue[0])');
  $(A,`[data-opt="${key}"]`).click(); await sleep(10);
  assert.match(text(A,'.verdict'),/Richtig!/);
  assert.ok($(A,'.opt.right'),'richtige Antwort markiert');
  $(A,'#next').click(); await sleep(10);
  $(A,'#dunno').click(); await sleep(10);
  assert.match(text(A,'.verdict'),/Hier ist die Lösung/);
  assert.ok($(A,'details.more[open] .sol li'),'Lösung aufgeklappt');
  for(let i=2;i<20;i++){ $(A,'#next').click(); await sleep(5); $(A,'[data-opt]').click(); await sleep(5); }
  $(A,'#next').click(); await sleep(10);
  assert.strictEqual(text(A,'.pagetitle'),'Durchgang beendet');
  assert.match(text(A,'.sub'),/von 20 Fragen richtig/);
  // Einstellungen: Dunkelmodus
  $(A,'#settingsBtn').click(); await sleep(10); $(A,'[data-th="dark"]').click(); await sleep(10);
  assert.strictEqual(A.w.document.documentElement.dataset.theme,'dark');
  assert.deepStrictEqual(errors,[]);
  process.exit(0);
})().catch(e=>{ console.error(e); process.exit(1); });
