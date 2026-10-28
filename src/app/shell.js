/* ---------- Kopfzeile, Einstellungen und Startseite ---------- */
let theme=lsGet('ad-theme')||'auto';
autoRead=lsGet('ad-read')==='1'&&!!synth;

function applyTheme(){
  const r=document.documentElement;
  if(theme==='auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme',theme);
  const dark=theme==='dark'||(theme==='auto'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach(mt=>mt.setAttribute('content',dark?'#000000':'#F2F2F7'));
}

/* Während eines laufenden Spiels führen Titel, Profil und Einstellungen nicht aus dem Spiel */
const inMatch=()=>['game','wait','group'].includes(DUEL.view);
function bindHeader(){
  document.getElementById('barTitle').onclick=()=>{ if(S.phase!=='start'&&!inMatch()) renderStart(); };
  document.getElementById('profileBtn').onclick=()=>{ if(inMatch()) return; stopSpeaking(); openProfile(); };
  document.getElementById('settingsBtn').onclick=()=>{ if(inMatch()) return; stopSpeaking(); renderSettings(); };
}
function setRequestBadge(n){
  const dot=document.getElementById('reqDot'); if(!dot) return;
  dot.hidden=!n; dot.textContent=n>9?'9+':String(n||'');
  document.getElementById('profileBtn').setAttribute('aria-label',n?`Profil, ${n} ${n===1?'Freundschaftsanfrage':'Freundschaftsanfragen'}`:'Profil');
}
function setProfileIcon(photo){
  const b=document.getElementById('profileBtn');
  b.innerHTML=photo?`<img src="${photo}" alt="">`:IC.person;
}

function renderSettings(){
  const from=S.phase; S.phase='settings';
  setBack('Zurück',()=>from==='duel'?openDuel():renderStart());
  showPage(`<div class="stack">
    <h2 class="pagetitle">Einstellungen</h2>
    <p class="group-label">Darstellung</p>
    <div class="seg" role="group" aria-label="Darstellung">
      <button data-th="auto" aria-pressed="${theme==='auto'}">Automatisch</button><button data-th="light" aria-pressed="${theme==='light'}">Hell</button><button data-th="dark" aria-pressed="${theme==='dark'}">Dunkel</button>
    </div>
    ${synth?`<p class="group-label">Vorlesen</p>
    <section class="group"><button class="row" role="switch" id="readSw" aria-checked="${autoRead}"><span class="label">Fragen vorlesen<small>Liest Muskel und Frage automatisch vor</small></span><span class="switch" aria-hidden="true"></span></button></section>`:''}
  </div>`);
  view.querySelectorAll('[data-th]').forEach(b=>b.onclick=()=>{ theme=b.dataset.th; lsSet('ad-theme',theme); applyTheme(); S.phase=from; renderSettings(); });
  const rs=view.querySelector('#readSw');
  if(rs) rs.onclick=()=>{ autoRead=!autoRead; lsSet('ad-read',autoRead?'1':'0'); if(autoRead) speak('Vorlesen ist an.'); else stopSpeaking(); rs.setAttribute('aria-checked',autoRead); };
}

function regionValue(){ const n=S.regions.size, all=Object.keys(REG).length; return n===all?'Alle':n===0?'Keine':`${n} von ${all}`; }
function renderStart(){
  S.phase='start'; setBack(null);
  leaveOnline();
  const counts={}; M.forEach(m=>counts[m.r]=(counts[m.r]||0)+1);
  const n=selected().length;
  const regRows=Object.keys(REG).map(r=>`<button class="row" role="menuitemcheckbox" data-reg="${r}" aria-checked="${S.regions.has(r)}"><span class="label">${esc(REG[r])}</span><span class="count">${counts[r]}</span>${IC.check}</button>`).join('');
  const catRows=QF.map(k=>`<button class="row" role="switch" data-cat="${k}" aria-checked="${S.cats.has(k)}"><span class="label">${FIELD[k]}</span><span class="switch" aria-hidden="true"></span></button>`).join('');
  view.innerHTML=`<div class="stack">
    <section class="group">
      <button class="row" id="duel"><span class="tile">${IC.bolt}</span><span class="label">Gegen Freunde spielen<small>Duell 1 gegen 1 oder Lobby mit bis zu ${GMAX} Spielern</small></span>${IC.chev}</button>
    </section>

    <p class="group-label">Lernen</p>
    <section class="group">
      <button class="row" id="regRow" aria-expanded="${S.regOpen}" aria-controls="regList"><span class="label">Regionen</span><span class="value">${regionValue()}</span>${IC.chev}</button>
      <div class="sublist" id="regList" ${S.regOpen?'':'hidden'}>${regRows}
        <div class="tools"><button class="link" id="regAll">Alle auswählen</button><button class="link" id="regNone">Keine</button></div></div>
    </section>

    <p class="group-label">Abfragen</p>
    <section class="group">${catRows}</section>

    <div class="stack-sm">
      <button class="btn primary" id="go" ${n?'':'disabled'}>Abfrage starten</button>
      <p class="footnote">${n} ${n===1?'Muskel':'Muskeln'} ausgewählt · ${ROUND_LEN} Fragen pro Runde</p>
    </div>
  </div>`;
  const rerender=()=>{ const y=window.scrollY; renderStart(); window.scrollTo(0,y); };
  view.querySelector('#regRow').onclick=()=>{ S.regOpen=!S.regOpen; rerender(); };
  view.querySelectorAll('[data-reg]').forEach(b=>b.onclick=()=>{ const r=b.dataset.reg; S.regions.has(r)?S.regions.delete(r):S.regions.add(r); rerender(); });
  view.querySelector('#regAll').onclick=()=>{ Object.keys(REG).forEach(r=>S.regions.add(r)); rerender(); };
  view.querySelector('#regNone').onclick=()=>{ S.regions.clear(); rerender(); };
  view.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{ const k=b.dataset.cat; if(S.cats.has(k)&&S.cats.size===1) return; S.cats.has(k)?S.cats.delete(k):S.cats.add(k); rerender(); });
  view.querySelector('#go').onclick=startQuiz;
  view.querySelector('#duel').onclick=()=>{ stopSpeaking(); openDuel(); };
}
