/* ---------- Konto: Anmelden, Registrieren, Abmelden ---------- */
const AUTH_ERR={
  'auth/invalid-email':'Diese E-Mail-Adresse ist ungültig.',
  'auth/user-not-found':'E-Mail oder Passwort stimmt nicht.',
  'auth/wrong-password':'E-Mail oder Passwort stimmt nicht.',
  'auth/invalid-credential':'E-Mail oder Passwort stimmt nicht.',
  'auth/invalid-login-credentials':'E-Mail oder Passwort stimmt nicht.',
  'auth/email-already-in-use':'Mit dieser E-Mail gibt es schon ein Konto. Melde dich an.',
  'auth/weak-password':'Das Passwort braucht mindestens 6 Zeichen.',
  'auth/too-many-requests':'Zu viele Versuche. Warte kurz und versuch es dann nochmal.',
  'auth/network-request-failed':'Keine Internetverbindung.',
  'auth/missing-password':'Bitte gib ein Passwort ein.'
};
const OFFLINE_TEXT='Zum Spielen gegen andere brauchst du eine Internetverbindung. Lernen geht auch offline.';
let authMode='login', authNext='duel';

/* Sorgt für eine Anmeldung. Gibt false zurück, wenn stattdessen eine Anmelde- oder Hinweisseite gezeigt wird. */
async function ensureAuth(next){
  authNext=next||'duel';
  if(!fbConfigured()){ renderOnlineNote('Das Online-Spiel ist noch nicht eingerichtet. Es fehlt die Firebase-Konfiguration.'); return false; }
  if(!navigator.onLine){ renderOnlineNote(OFFLINE_TEXT); return false; }
  if(!FB.user){
    renderOnlineNote(null);
    try{ await loadFirebase(); }catch(e){ renderOnlineNote('Die Verbindung zum Server hat nicht geklappt. Prüfe dein Internet und versuch es nochmal.'); return false; }
    if(!FB.user){ renderAuth(); return false; }
  }
  if(!SOC.profile){ try{ await ensureProfile(); }catch(e){} }
  return true;
}
function renderOnlineNote(text){
  S.phase='duel'; DUEL.view='note'; setBack('Start',renderStart);
  showPage(`<div class="stack"><h2 class="pagetitle">Online spielen</h2>${text===null
    ?'<section class="card center"><div class="spinner" aria-hidden="true"></div><p class="sub">Verbinde …</p></section>'
    :`<section class="card"><p>${esc(text)}</p><button class="btn tinted" id="retry">Erneut versuchen</button></section>`}</div>`);
  const r=view.querySelector('#retry'); if(r) r.onclick=()=>authNext==='profile'?openProfile():openDuel();
}

function renderAuth(msg){
  S.phase='auth'; DUEL.view='auth';
  setBack('Start',renderStart);
  const reg=authMode==='register';
  showPage(`<div class="stack">
    <div class="pagehead"><h2 class="pagetitle">${reg?'Konto erstellen':'Anmelden'}</h2><p class="sub">Zum Spielen gegen andere brauchst du ein Konto. Zum Lernen nicht.</p></div>
    <div class="seg" role="group" aria-label="Anmelden oder registrieren"><button data-m="login" aria-pressed="${!reg}">Anmelden</button><button data-m="register" aria-pressed="${reg}">Registrieren</button></div>
    <form class="stack-sm" id="authForm" novalidate>
      ${reg?'<label class="srlabel" for="aName">Name</label><input class="field" id="aName" autocomplete="nickname" maxlength="24" placeholder="Name (sehen deine Mitspieler)" required>':''}
      <label class="srlabel" for="aMail">E-Mail</label><input class="field" id="aMail" type="email" autocomplete="email" inputmode="email" placeholder="E-Mail" required>
      <label class="srlabel" for="aPass">Passwort</label><input class="field" id="aPass" type="password" autocomplete="${reg?'new-password':'current-password'}" placeholder="Passwort${reg?' (mind. 6 Zeichen)':''}" required>
      <p class="hint" id="authHint" role="status"></p>
      <button class="btn primary" id="aGo" type="submit">${reg?'Konto erstellen':'Anmelden'}</button>
    </form>
    ${reg?'':'<button class="link center-self" id="aReset">Passwort vergessen?</button>'}
  </div>`);
  const hint=(t,w)=>setHint('authHint',t,w);
  if(msg) hint(msg,true);
  view.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{ authMode=b.dataset.m; renderAuth(); });
  view.querySelector('#authForm').onsubmit=async e=>{
    e.preventDefault();
    const mail=view.querySelector('#aMail').value.trim(), pass=view.querySelector('#aPass').value;
    const name=reg?view.querySelector('#aName').value.trim():'';
    if(reg&&!name){ hint('Bitte gib einen Namen ein.',true); return; }
    const btn=view.querySelector('#aGo'); btn.disabled=true; hint('');
    try{
      if(reg){ const c=await FB.auth.createUserWithEmailAndPassword(mail,pass); await c.user.updateProfile({displayName:name}); }
      else await FB.auth.signInWithEmailAndPassword(mail,pass);
      FB.user=FB.auth.currentUser; lsSet('ad-auth','1');
      if(authNext==='profile') openProfile(); else openDuel();
    }catch(err){ btn.disabled=false; hint(AUTH_ERR[err&&err.code]||'Das hat nicht geklappt. Versuch es nochmal.',true); }
  };
  const rs=view.querySelector('#aReset');
  if(rs) rs.onclick=async()=>{
    const mail=view.querySelector('#aMail').value.trim(); if(!mail){ hint('Gib zuerst deine E-Mail-Adresse ein.',true); return; }
    try{ await FB.auth.sendPasswordResetEmail(mail); hint('Wir haben dir eine E-Mail zum Zurücksetzen geschickt.'); }catch(err){ hint(AUTH_ERR[err&&err.code]||'Das hat nicht geklappt.',true); }
  };
}

function accountRowHTML(){
  return FB.user?`<section class="group"><div class="row"><span class="label"><span>Angemeldet</span><small>${esc(FB.user.email||'')}</small></span><button class="btn tinted small" id="logout">Abmelden</button></div></section>`:'';
}
function bindAccount(){
  const b=document.getElementById('logout'); if(!b) return;
  b.onclick=async()=>{
    await disconnectLobby();
    resetSocial();
    await FB.auth.signOut(); lsSet('ad-auth','');
    setProfileIcon(null); renderStart();
  };
}
