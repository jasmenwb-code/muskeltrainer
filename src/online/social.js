/* ---------- Profile, Freunde, Statistik (Firebase-Daten) ----------
   users/{uid}:   {name, nameLower, code, photo, stats:{games,wins,losses,draws,points}, score, lastGid}
   codes/{CODE}:  uid (6-stelliger Freundescode)
   friends/{uid}/{fid}: true (beidseitig)
   h2h/{uid1_uid2}: Bilanz zweier Spieler {games, d, w:{uid:n}, pts:{uid:n}, last, lastGid} */
const SOC={profile:null,friends:{},info:{},h2h:{},listening:false};
const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const pairKey=(a,b)=>[a,b].sort().join('_');
const emptyStats=()=>({games:0,wins:0,losses:0,draws:0,points:0});
const scoreOf=st=>st.wins*3+st.draws;   // Rangliste: Sieg 3, Unentschieden 1
const userRef=uid=>FB.db.ref('users/'+uid);

function resetSocial(){
  try{ FB.db.ref('friends/'+FB.user.uid).off(); }catch(e){}
  Object.assign(SOC,{profile:null,friends:{},info:{},h2h:{},listening:false});
}
/* Profil laden bzw. beim ersten Mal anlegen (mit Freundescode und Suchnamen) */
async function ensureProfile(){
  const u=FB.user; if(!u) return null;
  const p=(await userRef(u.uid).once('value')).val()||{};
  for(let t=0;t<6&&!p.code;t++){
    let c=''; for(let i=0;i<6;i++) c+=pickOne(CODE_CHARS);
    try{ await FB.db.ref('codes/'+c).set(u.uid); p.code=c; }catch(e){}   // Regel verhindert doppelte Codes
  }
  p.name=p.name||u.displayName||'Spieler';
  p.nameLower=lowerDe(p.name).trim();
  p.stats=Object.assign(emptyStats(),p.stats||{});
  p.score=scoreOf(p.stats);
  await userRef(u.uid).set(p);
  SOC.profile=p; SOC.info[u.uid]=p; setProfileIcon(safePhoto(p.photo));
  if(!SOC.listening){
    SOC.listening=true;
    FB.db.ref('friends/'+u.uid).on('value',s=>{ SOC.friends=s.val()||{}; loadFriendData(); });
  }
  return p;
}
async function loadFriendData(){
  const me=FB.user&&FB.user.uid; if(!me) return;
  await Promise.all(Object.keys(SOC.friends).map(async fid=>{
    try{ SOC.info[fid]=(await userRef(fid).once('value')).val()||{name:'Spieler'}; }catch(e){ SOC.info[fid]=SOC.info[fid]||{name:'Spieler'}; }
    try{ SOC.h2h[fid]=(await FB.db.ref('h2h/'+pairKey(me,fid)).once('value')).val(); }catch(e){}
  }));
  refreshPeople();
}
const isFriend=uid=>!!(uid&&SOC.friends[uid]);
/* Bilanz gegen einen Freund aus meiner Sicht */
function record(fid){
  const me=FB.user.uid, h=SOC.h2h[fid];
  if(!h) return {games:0,w:0,l:0,d:0,pm:0,pf:0,last:null};
  return {games:h.games||0,w:(h.w||{})[me]||0,l:(h.w||{})[fid]||0,d:h.d||0,pm:(h.pts||{})[me]||0,pf:(h.pts||{})[fid]||0,last:h.last||null};
}
async function addFriend(fid){
  const me=FB.user.uid; if(!fid||fid===me) return;
  await FB.db.ref('friends/'+me+'/'+fid).set(true);
  await FB.db.ref('friends/'+fid+'/'+me).set(true);
}
async function removeFriend(fid){
  const me=FB.user.uid;
  await FB.db.ref('friends/'+me+'/'+fid).remove();
  try{ await FB.db.ref('friends/'+fid+'/'+me).remove(); }catch(e){}
  delete SOC.info[fid];
}
async function saveName(n){
  n=(n||'').trim().slice(0,24); if(!FB.user||!SOC.profile||!n) return;
  try{ await userRef(FB.user.uid).update({name:n,nameLower:lowerDe(n)}); SOC.profile.name=n; pushLobby(); }catch(e){}
}

/* Ergebnis eines Duells speichern: jeder seine eigene Statistik, der Gastgeber die gemeinsame Bilanz.
   lastGid verhindert, dass ein Spiel doppelt zählt. */
async function saveGameResult(r){
  const me=FB.user&&FB.user.uid; if(!me) return;
  const res=r.me>r.them?'wins':r.me<r.them?'losses':'draws';
  try{
    await userRef(me).transaction(p=>{
      p=p||{}; p.stats=Object.assign(emptyStats(),p.stats||{});
      if(p.lastGid===r.gid) return p;
      p.stats.games++; p.stats[res]++; p.stats.points+=r.me; p.lastGid=r.gid;
      p.score=scoreOf(p.stats); p.name=p.name||myName(); return p;
    });
  }catch(e){}
  if(r.host&&r.opp){
    try{
      await FB.db.ref('h2h/'+pairKey(me,r.opp)).transaction(h=>{
        h=h||{games:0,d:0,w:{},pts:{}};
        if(h.lastGid===r.gid) return h;
        h.w=h.w||{}; h.pts=h.pts||{}; h.games=(h.games||0)+1;
        if(r.me>r.them) h.w[me]=(h.w[me]||0)+1; else if(r.me<r.them) h.w[r.opp]=(h.w[r.opp]||0)+1; else h.d=(h.d||0)+1;
        h.pts[me]=(h.pts[me]||0)+r.me; h.pts[r.opp]=(h.pts[r.opp]||0)+r.them;
        h.last=Date.now(); h.lastGid=r.gid; return h;
      });
    }catch(e){}
  }
  try{ await ensureProfile(); }catch(e){}
  if(r.opp) try{ SOC.h2h[r.opp]=(await FB.db.ref('h2h/'+pairKey(me,r.opp)).once('value')).val(); }catch(e){}
  const rc=r.opp?record(r.opp):null, el=document.getElementById('h2hLine');
  if(el&&rc&&rc.games) el.textContent=`Bilanz gegen ${oppName()}: ${rc.w} : ${rc.l}${rc.d?` (${rc.d} unentschieden)`:''}`;
}

/* ----- Profilbilder ----- */
const AV_COLORS=['#E0453A','#F08A24','#2F9E5B','#1F8FBF','#5B5BD6','#B24FC9','#D94C86','#7A8B99'];
function avColor(uid){ let h=0; for(const c of String(uid||'x')) h=(h*31+c.charCodeAt(0))>>>0; return AV_COLORS[h%AV_COLORS.length]; }
function initials(n){ const p=String(n||'?').trim().split(/\s+/); return ((p[0]||'?')[0]+(p.length>1?p[p.length-1][0]:'')).toUpperCase(); }
/* Nur echte Bild-Daten-URLs zulassen (die Bilder kommen von anderen Spielern) */
function safePhoto(ph){ return typeof ph==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(ph)?ph:null; }
/* status: on | busy | off | null; size: '' | 'xl'; photo: undefined = aus dem Cache nehmen */
function avatarHTML(uid,name,status,size,photo){
  const ph=safePhoto(photo!==undefined?photo:(SOC.info[uid]||{}).photo);
  const inner=ph?`<img src="${ph}" alt="">`:`<span style="background:${avColor(uid)}">${esc(initials(name))}</span>`;
  return `<span class="avatar${size?' '+size:''}">${inner}${status?`<i class="st ${status}"></i>`:''}</span>`;
}
/* Avatar für jemanden, der online ist; lädt sein Profilbild bei Bedarf nach */
const infoLoading=new Set();
function avatarFor(uid,name,busy){
  if(uid&&!SOC.info[uid]&&!infoLoading.has(uid)&&FB.db){
    infoLoading.add(uid);
    userRef(uid).once('value').then(s=>{ SOC.info[uid]=s.val()||{name:'Spieler'}; refreshPeople(); }).catch(()=>{}).finally(()=>infoLoading.delete(uid));
  }
  return avatarHTML(uid,name,busy?'busy':'on');
}
/* Foto quadratisch zuschneiden und auf 160 px verkleinern (passt so in die Datenbank) */
function resizePhoto(file){
  return new Promise((res,rej)=>{
    const fr=new FileReader();
    fr.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const size=160, c=document.createElement('canvas'); c.width=c.height=size;
        const m=Math.min(img.width,img.height);
        c.getContext('2d').drawImage(img,(img.width-m)/2,(img.height-m)/2,m,m,0,0,size,size);
        res(c.toDataURL('image/jpeg',0.82));
      };
      img.onerror=()=>rej(new Error('bild')); img.src=fr.result;
    };
    fr.onerror=()=>rej(new Error('datei')); fr.readAsDataURL(file);
  });
}
async function savePhoto(dataUrl){
  await userRef(FB.user.uid).child('photo').set(dataUrl||null);
  SOC.profile.photo=dataUrl||null; setProfileIcon(safePhoto(dataUrl));
}

/* Spieler suchen: 6-stelliger Freundescode oder Namensanfang */
async function searchUsers(q){
  q=(q||'').trim(); if(q.length<2) return [];
  const found=new Map();
  const code=q.toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(code.length===6){
    try{ const id=(await FB.db.ref('codes/'+code).once('value')).val(); if(id){ const u=(await userRef(id).once('value')).val(); if(u) found.set(id,u); } }catch(e){}
  }
  const lq=lowerDe(q);
  try{
    const v=(await FB.db.ref('users').orderByChild('nameLower').startAt(lq).endAt(lq+'').limitToFirst(15).once('value')).val()||{};
    Object.keys(v).forEach(id=>found.set(id,v[id]));
  }catch(e){}
  found.delete(FB.user.uid);
  return [...found.entries()].map(([id,u])=>{ SOC.info[id]=u; return {id,u}; });
}
