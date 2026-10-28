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
  setBack('Zurück',()=>from==='duel'?openDuel():from==='learn'?renderLearn():renderStart());
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

/* Startseite: zwei große Kacheln */
function renderStart(){
  S.phase='start'; setBack(null);
  leaveOnline();
  showPage(`<div class="home">
    <button class="hometile" id="duel"><span class="hticon">${IC.bolt}</span><b>Duell</b><small>Gegen Freunde oder zufällige Gegner</small></button>
    <button class="hometile learn" id="learn"><span class="hticon">${IC.book}</span><b>Lernen</b><small>${M.length} Muskeln nach Regionen</small></button>
  </div>`);
  view.querySelector('#duel').onclick=()=>{ stopSpeaking(); openDuel(); };
  view.querySelector('#learn').onclick=renderLearn;
}
