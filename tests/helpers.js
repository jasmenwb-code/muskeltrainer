// Testhilfen: lädt die gebaute Seite (docs/index.html) in jsdom, mit Firebase-Attrappe und verkürzten Zeiten.
const {JSDOM}=require('jsdom');
const fs=require('fs'), path=require('path');
const {makeFirebase,store}=require('./fbmock');

const HTML=fs.readFileSync(path.join(__dirname,'..','docs','index.html'),'utf8')
  .replace('QTIME=30000, REVEAL=6000','QTIME=1500, REVEAL=300')   // 30 s -> 1,5 s, Auflösung 6 s -> 0,3 s
  .split('QTIME+3000').join('QTIME+300');

const errors=[];
function client(mail){
  const dom=new JSDOM(HTML,{url:'https://anatomyduel.test/',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
    w.FIREBASE_CONFIG={apiKey:'test',databaseURL:'https://test'};
    w.firebase=makeFirebase(mail);
    w.scrollTo=()=>{};
    w.matchMedia=()=>({matches:false,addEventListener(){}});
    w.navigator.clipboard={writeText:async()=>{}};
    // Firebase-Skripte nicht laden, sondern sofort als geladen melden
    const append=w.HTMLHeadElement.prototype.appendChild;
    w.HTMLHeadElement.prototype.appendChild=function(n){ if(n.tagName==='SCRIPT'&&/firebasejs/.test(n.src)){ setTimeout(()=>n.onload&&n.onload(),0); return n; } return append.call(this,n); };
    w.addEventListener('error',e=>errors.push(mail+': '+e.message));
  }});
  return {w:dom.window,mail};
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const $=(c,s)=>c.w.document.querySelector(s);
const $$=(c,s)=>[...c.w.document.querySelectorAll(s)];
const text=(c,s)=>{ const e=$(c,s); return e?e.textContent.replace(/\s+/g,' ').trim():''; };
const texts=(c,s)=>$$(c,s).map(e=>e.textContent.replace(/\s+/g,' ').trim());
function input(c,sel,value){ const e=$(c,sel); e.value=value; e.dispatchEvent(new c.w.Event('input')); }

/* Über einen Knopf (z. B. #duel oder #profileBtn) zur Anmeldung und dort registrieren */
async function register(c,name,via='#duel'){
  $(c,via).click(); await sleep(80);
  $$(c,'[data-m]').find(b=>b.dataset.m==='register').click(); await sleep(20);
  $(c,'#aName').value=name; $(c,'#aMail').value=c.mail; $(c,'#aPass').value='geheim1';
  $(c,'#authForm').dispatchEvent(new c.w.Event('submit',{cancelable:true})); await sleep(250);
}
/* Eine Online-Runde beantworten: pattern[i] = true -> richtig, false -> falsch */
function answerRound(clients,key,pattern){
  clients.forEach((c,i)=>{
    const btns=$$(c,'[data-opt]:not([disabled])'); if(!btns.length) return;
    const b=pattern[i]?btns.find(x=>x.dataset.opt===key):btns.find(x=>x.dataset.opt!==key);
    if(b) b.click();
  });
}
module.exports={client,sleep,$,$$,text,texts,input,register,answerRound,store,errors};
