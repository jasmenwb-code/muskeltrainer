/* ---------- Start ---------- */
applyTheme();
if(window.matchMedia) try{ matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme); }catch(e){}
bindHeader();
renderStart();

/* Offline-Lernen und „Zum Startbildschirm hinzufügen“ */
if('serviceWorker' in navigator&&location.protocol==='https:') window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));

/* Wer schon angemeldet war, ist beim Öffnen direkt online (für Einladungen und die Freundesliste) */
if(lsGet('ad-auth')==='1'&&fbConfigured()&&navigator.onLine){
  setTimeout(async()=>{ try{ await loadFirebase(); if(FB.user){ await ensureProfile(); await initLobby(); } }catch(e){} },300);
}
