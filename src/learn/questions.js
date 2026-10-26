/* ---------- Fragen: kurz, 4 Antworten, genau eine richtig ----------
   Vorwärts (t:'f'): Muskel gegeben, richtigen Ursprung/Ansatz/… wählen. Optionen: [Muskel-ID, Eintrag-Index]
   Rückwärts (t:'r'): Fakt gegeben, richtigen Muskel wählen. Optionen: Muskel-IDs */
const QF=['U','A','F','I'];
const NOPT=4;
const MOVEMENTS='flexion extension abduktion adduktion innenrotation aussenrotation pronation supination anteversion retroversion dorsalextension plantarflexion palmarflexion inversion eversion lateralflexion rotation elevation inspiration exspiration spreizen opposition radialabduktion ulnarabduktion semipronation'.split(' ');

function realItems(m,k){ return (m[k]||[]).map((s,i)=>Object.assign({i},parseItem(s))).filter(x=>!x.note); }
function qFields(m){ return QF.filter(k=>realItems(m,k).length); }
function jaccard(a,b){ let n=0; a.forEach(x=>{ if(b.has(x)) n++; }); const u=a.size+b.size-n; return u?n/u:0; }
function movements(text){ const t=lowerDe(text); return new Set(MOVEMENTS.filter(w=>t.includes(w))); }
const normLabel=l=>lowerDe(l||'').replace(/[^a-z]/g,'');
const isJoint=l=>/gelenk|wirbelsaeule|hws|bws|lws|kopf/.test(lowerDe(l||''));

/* Wäre ein Kandidat für Muskel m in Feld k womöglich auch richtig? Dann taugt er nicht als falsche Antwort. */
function conflicts(m,k,ctext,clabel){
  const ck=keyWords(ctext);
  const fields=(k==='U'||k==='A')?['U','A','UA']:[k];
  for(const f of fields) for(const x of realItems(m,f)) if(jaccard(ck,keyWords(x.text))>=0.5) return true;
  if(k==='F'){
    const cm=movements(ctext); if(!cm.size) return true;
    for(const x of realItems(m,'F')){
      const sameJoint=!(isJoint(clabel)&&isJoint(x.label)&&normLabel(clabel)!==normLabel(x.label));
      const xm=movements(x.text);
      if(sameJoint&&[...cm].some(v=>xm.has(v))) return true;
    }
  }
  return false;
}
function forwardQ(m,k){
  const items=realItems(m,k); if(!items.length) return null;
  const short=items.filter(x=>x.text.length<=110);
  const it=pickOne(short.length?short:items), len=it.text.length;
  /* Ähnlich lange Einträge aus derselben Region bevorzugen, damit die Länge nichts verrät */
  const pool=[];
  M.forEach(o=>{ if(o.id===m.id) return; realItems(o,k).forEach(x=>pool.push({m:o.id,i:x.i,text:x.text,label:x.label,
    score:Math.abs(x.text.length-len)/Math.max(len,20)+(o.r===m.r?0:0.35)+(it.label&&normLabel(x.label)===normLabel(it.label)?-0.3:0)+Math.random()*0.5})); });
  pool.sort((a,b)=>a.score-b.score);
  const picks=[], seen=[keyWords(it.text)];
  for(const c of pool){
    if(picks.length>=NOPT-1) break;
    if(conflicts(m,k,c.text,c.label)) continue;
    const ck=keyWords(c.text);
    if(!ck.size||seen.some(s=>jaccard(s,ck)>=0.4||[...ck].filter(x=>s.has(x)).length>=Math.min(3,ck.size))) continue;
    seen.push(ck); picks.push([c.m,c.i]);
  }
  if(picks.length<NOPT-1) return null;
  return {t:'f',m:m.id,k,i:it.i,o:shuffle([[m.id,it.i],...picks])};
}
function reverseQ(m,k){
  if(k==='F') return null;
  const items=realItems(m,k).filter(x=>!x.label&&x.text.length<=110); if(!items.length) return null;
  const it=pickOne(items), ik=keyWords(it.text);
  const alsoTrue=(o,f)=>realItems(o,f).some(x=>jaccard(ik,keyWords(x.text))>=0.5);
  const ok=o=>o.id!==m.id&&!alsoTrue(o,k)&&!(k!=='I'&&alsoTrue(o,k==='U'?'A':'U'));
  const same=shuffle(M.filter(o=>o.r===m.r&&ok(o))), other=shuffle(M.filter(o=>o.r!==m.r&&ok(o)));
  const picks=[...same.slice(0,2),...other,...same.slice(2)].slice(0,NOPT-1).map(o=>o.id);
  if(picks.length<NOPT-1) return null;
  return {t:'r',m:m.id,k,i:it.i,o:shuffle([m.id,...picks])};
}
function makeQuestion(mid,k){
  const m=M[mid];
  return (Math.random()<0.35&&reverseQ(m,k))||forwardQ(m,k)||reverseQ(m,k);
}

/* ----- Darstellung ----- */
const QTXT={
  f:{U:'Wo entspringt der Muskel?',A:'Wo setzt der Muskel an?',F:'Welche Funktion hat der Muskel?',I:'Welcher Nerv innerviert den Muskel?'},
  fp:{U:'Wo entspringt dieser Anteil?',A:'Wo setzt dieser Anteil an?',I:'Welcher Nerv innerviert diesen Anteil?'},
  r:{U:'Welcher Muskel entspringt hier?',A:'Welcher Muskel setzt hier an?',I:'Welcher Muskel wird von diesem Nerv innerviert?'}
};
function qItem(q){ return parseItem(M[q.m][q.k][q.i]); }
function qPinned(q){ return q.t==='f'&&q.k!=='F'&&!!qItem(q).label; }   // Frage nach einem bestimmten Anteil
function qText(q){ return q.t==='r'?QTXT.r[q.k]:(qPinned(q)?QTXT.fp[q.k]:QTXT.f[q.k]); }
function qSpeak(q){ return q.t==='r'?qText(q)+' '+qItem(q).text:M[q.m].n+'. '+qText(q); }
function correctKey(q){ return q.t==='f'?q.m+':'+q.i:String(q.m); }
function optList(q){
  if(q.t==='r') return q.o.map(id=>({key:String(id),text:M[id].n}));
  return q.o.map(([mid,i])=>{ const it=parseItem(M[mid][q.k][i]); return {key:mid+':'+i,text:(q.k==='F'&&it.label?it.label+': ':'')+it.text}; });
}
function qCardHTML(q,showName){
  const it=qItem(q);
  if(q.t==='r'&&!showName) return `<article class="card qcard"><span class="pill">${FIELD[q.k]}</span><p class="fact">${esc(it.text)}</p></article>`;
  return `<article class="card qcard">
    <div class="pills"><span class="pill">${FIELD[q.k]}</span>${qPinned(q)?`<span class="pill neutral">${esc(it.label)}</span>`:''}</div>
    <h2 class="title-xl">${nameHTML(M[q.m].n)}</h2>
    ${q.t==='r'?`<p class="sub">${esc(it.text)}</p>`:''}
  </article>`;
}
/* state: reveal (Lösung zeigen), mine (eigene Wahl), theirs/theirName (Wahl des Gegners), locked */
function optionsHTML(q,state){
  const st=state||{}, corr=correctKey(q);
  return `<div class="opts" role="list">${optList(q).map((o,idx)=>{
    let c='opt'; const tags=[];
    if(st.reveal){ c+=o.key===corr?' right':o.key===st.mine?' wrong':' dim'; }
    else if(st.mine!=null){ c+=o.key===st.mine?' picked':' dim'; }
    if(st.reveal&&o.key===st.mine) tags.push('Du');
    if(st.reveal&&st.theirs!=null&&o.key===st.theirs) tags.push(esc(st.theirName||'Gegner'));
    return `<button class="${c}" role="listitem" data-opt="${o.key}" ${st.locked?'disabled':''}><span class="optl">${'ABCD'[idx]}</span><span class="optt">${esc(o.text)}</span>${tags.length?`<span class="opttag">${tags.join(' · ')}</span>`:''}</button>`;
  }).join('')}</div>`;
}
