// Führt alle *.test.js nacheinander in eigenen Prozessen aus (jeder Test hat seine eigene Datenbank-Attrappe).
const {execFileSync}=require('child_process'); const fs=require('fs'); const path=require('path');
let failed=0;
for(const f of fs.readdirSync(__dirname).filter(f=>f.endsWith('.test.js')).sort()){
  const t0=Date.now();
  try{ execFileSync(process.execPath,[path.join(__dirname,f)],{stdio:['ignore','pipe','pipe'],timeout:120000}); console.log(`✓ ${f} (${((Date.now()-t0)/1000).toFixed(1)} s)`); }
  catch(e){ failed++; console.log(`✗ ${f}\n${String(e.stdout||'')}${String(e.stderr||'')}`); }
}
console.log(failed?`${failed} Test(s) fehlgeschlagen`:'Alle Tests bestanden');
process.exit(failed?1:0);
