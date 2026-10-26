/* ---------- Lernmodus: 20 Fragen aus der gewählten Auswahl ---------- */
const ROUND_LEN=20;
const S={regions:new Set(Object.keys(REG)), cats:new Set(QF), regOpen:false, phase:'start', queue:[], qi:0, right:0, results:{}};
function fieldsFor(m){ return qFields(m).filter(k=>S.cats.has(k)); }
function selected(){ return M.filter(m=>S.regions.has(m.r)&&fieldsFor(m).length); }

function startQuiz(){
  const qs=[];
  selected().forEach(m=>fieldsFor(m).forEach(k=>{ const q=makeQuestion(m.id,k); if(q) qs.push(q); }));
  S.queue=shuffle(qs).slice(0,ROUND_LEN); S.qi=0; S.results={}; S.right=0;
  if(S.queue.length) renderAsk(); else renderStart();
}
function progressHTML(){
  return `<div class="progress"><span>Frage ${S.qi+1} von ${S.queue.length}</span><div class="track"><span style="width:${S.qi/S.queue.length*100}%"></span></div><span>${S.right} ✓</span></div>`;
}
function renderAsk(){
  S.phase='ask';
  const q=S.queue[S.qi];
  setBack('Beenden',()=>{ stopSpeaking(); renderEnd(); });
  showPage(`<div class="stack">${progressHTML()}
    ${qCardHTML(q,false)}
    <section class="stack-sm">
      <p class="question">${esc(qText(q))}</p>
      ${optionsHTML(q)}
    </section>
    <button class="btn plain" id="dunno">Weiß ich nicht</button>
  </div>`);
  view.querySelectorAll('[data-opt]').forEach(b=>b.onclick=()=>showResult(b.dataset.opt));
  view.querySelector('#dunno').onclick=()=>showResult(null);
  if(autoRead) speak(qSpeak(q));
}
function solutionHTML(items){
  return items.map(s=>{ const it=parseItem(s); return it.note?`<li class="note">${esc(it.text)}</li>`:`<li>${it.label?`<b>${esc(it.label)}:</b> `:''}${esc(it.text)}</li>`; }).join('');
}
function figHTML(m){
  const f=IMG[m.n]; if(!f) return '';
  return `<figure class="fig"><button class="figbtn" aria-label="Abbildung vergrößern"><img src="img/${f[0]}.webp" alt="Abbildung ${esc(m.n)} aus dem Skript"></button><figcaption>${f[1]?'In der Abbildung: '+esc(f[1]):'Abbildung aus deinem Skript'} · zum Vergrößern antippen</figcaption></figure>`;
}
function bindFigure(){ const fb=view.querySelector('.figbtn'); if(fb) fb.onclick=()=>fb.closest('.fig').classList.toggle('big'); }
function showResult(choice){
  stopSpeaking(); S.phase='result';
  const q=S.queue[S.qi], m=M[q.m];
  const ok=choice===correctKey(q); if(ok) S.right++;
  (S.results[m.id]=S.results[m.id]||{})[q.k]=ok;
  const verdict=choice==null?'Hier ist die Lösung':ok?'Richtig!':'Leider falsch';
  const last=S.qi===S.queue.length-1;
  showPage(`<div class="stack">${progressHTML()}
    ${qCardHTML(q,true)}
    <section class="stack-sm">
      <div class="verdict v-${ok?'good':'bad'}"><span class="vicon">${ok?IC.ok:IC.bad}</span><div><b>${verdict}</b><span>${esc(qText(q))}</span></div></div>
      ${optionsHTML(q,{reveal:true,mine:choice,locked:true})}
    </section>
    <details class="card more"${ok?'':' open'}><summary>Alles zu ${esc(FIELD[q.k])} · ${esc(m.n)}</summary>
      <ul class="sol">${solutionHTML(m[q.k])}</ul>
      ${figHTML(m)}
      ${autoRead?`<div class="btnrow"><button class="btn tinted small" id="readSol">${IC.speaker}Vorlesen</button></div>`:''}
    </details>
    <button class="btn primary" id="next">${last?'Ergebnis ansehen':'Weiter'}</button>
  </div>`);
  bindFigure();
  const rs=view.querySelector('#readSol');
  if(rs) rs.onclick=()=>speak(FIELD[q.k]+'. '+m[q.k].map(s=>{ const it=parseItem(s); return (it.label?it.label+': ':'')+it.text; }).join('. '));
  view.querySelector('#next').onclick=()=>{ stopSpeaking(); if(last) renderEnd(); else { S.qi++; renderAsk(); } };
  if(autoRead) speak(verdict);
}
function renderEnd(){
  S.phase='end'; setBack('Start',renderStart);
  const ids=Object.keys(S.results).map(Number);
  const answered=ids.reduce((a,id)=>a+Object.keys(S.results[id]).length,0);
  const rows=ids.map(id=>{ const r=S.results[id];
    return `<div class="row"><span class="label">${esc(M[id].n)}</span><span class="badges">${QF.filter(k=>k in r).map(k=>`<span class="badge ${r[k]?'good':'bad'}">${FIELD[k]} ${r[k]?'✓':'✗'}</span>`).join('')}</span></div>`; }).join('');
  showPage(`<div class="stack">
    <div class="pagehead"><h2 class="pagetitle">Durchgang beendet</h2><p class="sub">${answered?`${S.right} von ${answered} Fragen richtig`:'Keine Fragen beantwortet'}</p></div>
    ${rows?`<section class="group list">${rows}</section>`:''}
    <div class="stack-sm"><button class="btn primary" id="again">Neue Runde mit gleicher Auswahl</button><button class="btn plain" id="back">Zur Auswahl</button></div>
  </div>`);
  view.querySelector('#again').onclick=startQuiz;
  view.querySelector('#back').onclick=renderStart;
}
