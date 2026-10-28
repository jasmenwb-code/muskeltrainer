// Startseite mit zwei Kacheln, Lernseite mit Regionen, Durchgang, Einstellungen.
const assert=require('assert'); const {client,sleep,$,$$,text,texts,errors}=require('./helpers');
(async()=>{
  const A=client('anna@x.de'); await sleep(50);
  assert.deepStrictEqual($$(A,'#view button').map(b=>b.id),['duel','learn'],'Startseite: nur Duell und Lernen');
  $(A,'#learn').click(); await sleep(10);
  assert.strictEqual(text(A,'.pagetitle'),'Lernen');
  assert.strictEqual($$(A,'[data-region]').length,9,'Alle Regionen + 8 Regionen');
  assert.match(text(A,'[data-region="all"]'),/Alle Regionen\s*84/);
  // Kategorie aus- und einschalten; die letzte bleibt an
  ['U','A','F'].forEach(k=>$(A,`[data-cat="${k}"]`).click()); $(A,'[data-cat="I"]').click(); await sleep(10);
  assert.strictEqual($(A,'[data-cat="I"]').getAttribute('aria-checked'),'true','letzte Kategorie bleibt an');
  // Nur Innervation, nur Oberarm: 4 Muskeln -> 4 Fragen, alle zur Innervation
  $(A,'[data-region="oberarm"]').click(); await sleep(10);
  assert.match(text(A,'.progress'),/Frage 1 von 4/);
  assert.strictEqual(A.w.eval("S.queue.every(q=>q.k==='I'&&M[q.m].r==='oberarm')"),true);
  const key=A.w.eval('correctKey(S.queue[0])');
  $(A,`[data-opt="${key}"]`).click(); await sleep(10);
  assert.match(text(A,'.verdict'),/Richtig!/);
  $(A,'#next').click(); await sleep(10); $(A,'#dunno').click(); await sleep(10);
  assert.match(text(A,'.verdict'),/Hier ist die Lösung/);
  for(let i=2;i<4;i++){ $(A,'#next').click(); await sleep(5); $(A,'[data-opt]').click(); await sleep(5); }
  $(A,'#next').click(); await sleep(10);
  assert.strictEqual(text(A,'.pagetitle'),'Durchgang beendet');
  assert.match(text(A,'#again'),/Neue Runde: Oberarm/);
  $(A,'#back').click(); await sleep(10);
  assert.strictEqual(text(A,'.pagetitle'),'Lernen');
  // Alle Regionen, alle Kategorien: 20 Fragen
  ['U','A','F'].forEach(k=>$(A,`[data-cat="${k}"]`).click());
  $(A,'[data-region="all"]').click(); await sleep(10);
  assert.match(text(A,'.progress'),/Frage 1 von 20/);
  // Einstellungen: Dunkelmodus, zurück zur Startseite über den Titel
  $(A,'#settingsBtn').click(); await sleep(10); $(A,'[data-th="dark"]').click(); await sleep(10);
  assert.strictEqual(A.w.document.documentElement.dataset.theme,'dark');
  $(A,'#barTitle').click(); await sleep(10);
  assert.ok($(A,'#duel')&&$(A,'#learn'));
  assert.deepStrictEqual(errors,[]);
  process.exit(0);
})().catch(e=>{ console.error(e); process.exit(1); });
