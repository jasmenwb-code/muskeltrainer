/* ---------- Firebase: wird erst geladen, wenn jemand online spielen will ---------- */
const FB_VER='10.12.2';
const FB={app:null,auth:null,db:null,user:null,loading:null};

function loadScript(src){
  return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.async=true; s.onload=res; s.onerror=()=>rej(new Error('load')); document.head.appendChild(s); });
}
function fbConfigured(){ const c=window.FIREBASE_CONFIG; return !!(c&&c.apiKey&&c.databaseURL); }
async function loadFirebase(){
  if(FB.loading) return FB.loading;
  FB.loading=(async()=>{
    const base='https://www.gstatic.com/firebasejs/'+FB_VER+'/';
    await loadScript(base+'firebase-app-compat.js');
    await Promise.all([loadScript(base+'firebase-auth-compat.js'),loadScript(base+'firebase-database-compat.js')]);
    FB.app=firebase.initializeApp(window.FIREBASE_CONFIG);
    FB.auth=firebase.auth(); FB.db=firebase.database();
    await new Promise(res=>FB.auth.onAuthStateChanged(u=>{ FB.user=u; res(); }));
  })();
  FB.loading.catch(()=>{ FB.loading=null; });
  return FB.loading;
}

/* Raum = Pfad in der Datenbank. Jeder Spieler schreibt nur seinen eigenen Eintrag ("presence")
   und sieht die Einträge aller anderen ("peers"). Beim Verbindungsabbruch wird der Eintrag gelöscht.
   Genutzt für die Lobby ("lobby"), Duelle ("rooms/duel-1234") und Gruppen ("rooms/grp-12345"). */
function fbRoom(path){
  const uid=FB.user.uid, ref=FB.db.ref(path), mine=ref.child(uid);
  let peers=Object.freeze([]), cur={}, disc=false, alive=true;
  const handlers=new Set(), errHandlers=new Set();
  const onValue=s=>{
    const v=s.val()||{};
    peers=Object.freeze(Object.keys(v).map(k=>Object.freeze({peer:k,by:k,isMe:k===uid,presence:v[k]||{}})));
    handlers.forEach(h=>{ try{ h(); }catch(e){ console.error(e); } });
  };
  ref.on('value',onValue,()=>errHandlers.forEach(e=>e()));
  return {
    peers:()=>peers,
    onPeers(h,e){ handlers.add(h); if(e) errHandlers.add(e); setTimeout(()=>{ if(alive&&handlers.has(h)) h(); },0); return ()=>{ handlers.delete(h); if(e) errHandlers.delete(e); }; },
    presence(patch){
      if(!alive) return Promise.resolve();
      const n={...cur}; for(const k in patch){ if(patch[k]==null) delete n[k]; else n[k]=JSON.parse(JSON.stringify(patch[k])); }
      cur=n; if(!disc){ disc=true; mine.onDisconnect().remove(); }
      return mine.set(cur);
    },
    leave(){ alive=false; ref.off('value',onValue); handlers.clear(); errHandlers.clear(); mine.onDisconnect().cancel(); return mine.remove(); },
    join:name=>Promise.resolve(fbRoom('rooms/'+name))
  };
}
