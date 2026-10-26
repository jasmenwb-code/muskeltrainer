// Fragengenerator: jede Kombination Muskel × Kategorie ergibt eine gültige Frage mit 4 verschiedenen Antworten.
const assert=require('assert'); const fs=require('fs'); const path=require('path'); const vm=require('vm');
const src=f=>fs.readFileSync(path.join(__dirname,'..','src',f),'utf8');
const ctx={document:{getElementById:()=>null}}; vm.createContext(ctx);
vm.runInContext(['data/muscles.js','core/text.js','learn/questions.js'].map(src).join('\n')+'\nthis.M=M;this.api={qFields,makeQuestion,correctKey,optList,qText};',ctx);
const {M,api}=ctx;
assert.strictEqual(M.length,84,'84 Muskeln');
let n=0, reverse=0;
for(let pass=0;pass<5;pass++) for(const m of M) for(const k of api.qFields(m)){
  const q=api.makeQuestion(m.id,k);
  assert.ok(q,`keine Frage für ${m.n} / ${k}`);
  const opts=api.optList(q);
  assert.strictEqual(opts.length,4,`${m.n}: 4 Antworten`);
  assert.strictEqual(new Set(opts.map(o=>o.key)).size,4,`${m.n}: Antworten verschieden`);
  assert.strictEqual(new Set(opts.map(o=>o.text)).size,4,`${m.n}: Antworttexte verschieden`);
  assert.ok(opts.some(o=>o.key===api.correctKey(q)),`${m.n}: richtige Antwort enthalten`);
  assert.ok(!/nicht/i.test(api.qText(q)),'keine "nicht"-Fragen');
  n++; if(q.t==='r') reverse++;
}
assert.ok(reverse/n>0.1&&reverse/n<0.5,'Anteil Rückwärtsfragen plausibel');
