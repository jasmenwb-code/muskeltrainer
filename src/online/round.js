/* ---------- Gemeinsamer Rundenablauf für Duell und Gruppe ----------
   Der Gastgeber erzeugt die Fragen und steuert die Phasen (q = Frage, rev = Auflösung, end = Ende).
   Alle anderen folgen seinem Spielstand und melden nur ihre eigene Antwort. */
const ROUNDS=10, QTIME=30000, REVEAL=6000;
const RT={tInt:null,deadline:null,revInt:null,next:null,start:0,myAns:null};

/* Richtig = 1 Punkt; Bonus +2 unter 10 s, +1 unter 20 s */
function evalChoice(c,key,t){
  c=typeof c==='string'?c:''; const ok=!!c&&c===key; t=Math.min(Number(t)||QTIME,QTIME);
  const bonus=ok?(t<=10000?2:t<=20000?1:0):0;
  return {c,ok,pt:ok?1+bonus:0,bonus,t};
}
/* 10 Fragen zu 10 verschiedenen Muskeln */
function pickQs(){
  const qs=[];
  for(const m of shuffle(M.slice())){
    if(qs.length>=ROUNDS) break;
    for(const k of shuffle(qFields(m))){ const q=makeQuestion(m.id,k); if(q){ qs.push(q); break; } }
  }
  return qs;
}
function clearRoundTimers(){
  clearInterval(RT.tInt); clearTimeout(RT.deadline); clearInterval(RT.revInt); clearTimeout(RT.next);
  RT.tInt=RT.deadline=RT.revInt=RT.next=null;
}

/* Frage mit 30-Sekunden-Balken zeigen. onLock(antwort) kommt genau einmal: beim Antippen oder wenn die Zeit abläuft. */
function showRoundQuestion(topHTML,g,onLock){
  clearRoundTimers();
  const q=g.qs[g.r];
  RT.myAns=null; RT.start=performance.now();
  showPage(`<div class="stack">${topHTML}
    <div class="tbar" aria-hidden="true"><span id="tfill"></span></div>
    <p class="footnote tleft"><span id="tleft">30</span> Sekunden</p>
    ${qCardHTML(q,false)}
    <section class="stack-sm">
      <p class="question">${esc(qText(q))}</p>
      <div id="optBox">${optionsHTML(q)}</div>
    </section>
    <p class="opp" id="oppStat"></p>
  </div>`);
  const lock=choice=>{
    if(RT.myAns) return;
    const t=Math.min(Math.round(performance.now()-RT.start),QTIME);
    RT.myAns={g:g.id,r:g.r,c:choice,t,lk:true};
    document.getElementById('optBox').innerHTML=optionsHTML(q,{mine:choice,locked:true});
    document.getElementById('oppStat').insertAdjacentHTML('beforebegin',`<p class="footnote">${choice?'Eingeloggt nach '+fmtSec(t):'Zeit abgelaufen'}</p>`);
    onLock(RT.myAns);
  };
  view.querySelectorAll('[data-opt]').forEach(b=>b.onclick=()=>lock(b.dataset.opt));
  if(autoRead) speak(qSpeak(q));
  const fill=document.getElementById('tfill'), left=document.getElementById('tleft');
  RT.tInt=setInterval(()=>{
    const rest=Math.max(0,QTIME-(performance.now()-RT.start));
    fill.style.width=(rest/QTIME*100)+'%'; fill.classList.toggle('low',rest<8000);
    left.textContent=Math.ceil(rest/1000);
    if(rest<=0){ clearInterval(RT.tInt); RT.tInt=null; lock(''); }
  },200);
}
/* Antwort, die zu dieser Runde gehört (oder null) */
function answerFor(a,g){ return a&&a.g===g.id&&a.r===g.r?a:null; }

/* Countdown unter der Auflösung */
function startRevealCountdown(last){
  const t0=performance.now(), el=document.getElementById('nextIn');
  RT.revInt=setInterval(()=>{ const s=Math.max(0,Math.ceil((REVEAL-(performance.now()-t0))/1000)); if(el) el.textContent=(last?'Auswertung in ':'Nächste Runde in ')+s+' s'; },250);
}
function verdictHTML(label,r){
  return `<div class="pv ${r.ok?'ok':'no'}"><div class="pvh"><small>${esc(label)}</small><b>${r.ok?'Richtig':!r.c?'Keine Antwort':'Falsch'}</b><span>${r.ok?`+${r.pt}${r.bonus?` (inkl. ${r.bonus} Bonus)`:''}`:'+0'}</span></div><small class="tm">${r.c?fmtSec(r.t):'—'}</small></div>`;
}
