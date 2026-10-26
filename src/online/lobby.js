/* ---------- Lobby: wer ist online, Einladungen, Einstieg in Duell und Gruppe ----------
   Jeder angemeldete Spieler hat in "lobby" einen Eintrag:
   {app:'mt', nick, busy, inv:{to,code} (Duell-Einladung), ginv:{to:[…],code} (Gruppen-Einladung), dec:{to,code} (Absage)}
   DUEL.view sagt, welche Online-Ansicht gerade offen ist (off, note, auth, lobby, wait, game, group, profile, friend, board). */
const DUEL={room:null,loading:null,myPeer:null,view:'off',outInv:null,decline:null,seen:new Set(),
  role:null,code:null,named:null,unsub:[],timers:[],game:null,hg:null,lastKey:null,hist:[],oppNick:'',oppId:null,target:null,reported:null};

const myName=()=>((SOC.profile&&SOC.profile.name)||'Spieler').slice(0,24);

async function initLobby(){
  if(DUEL.room) return true;
  if(!DUEL.loading) DUEL.loading=(async()=>{
    if(!FB.user) return false;
    DUEL.room=fbRoom('lobby'); DUEL.myPeer=FB.user.uid;
    DUEL.room.onPeers(onLobbyPeers);
    pushLobby();
    return true;
  })().finally(()=>{ DUEL.loading=null; });
  return DUEL.loading;
}
async function disconnectLobby(){
  leaveOnline();
  const r=DUEL.room; DUEL.room=null; DUEL.myPeer=null;
  if(r) try{ await r.leave(); }catch(e){}
}
function pushLobby(){
  if(!DUEL.room) return;
  DUEL.room.presence({app:'mt',nick:myName(),busy:inMatch(),inv:DUEL.outInv,ginv:groupInvitePresence(),dec:DUEL.decline}).catch(()=>{});
}
function lobbyPeers(){
  if(!DUEL.room) return [];
  const seen=new Set();
  return DUEL.room.peers().filter(p=>!p.isMe&&p.presence.app==='mt'&&!seen.has(p.by)&&seen.add(p.by));
}
/* Verlässt laufende Online-Ansichten (z. B. beim Wechsel zur Startseite) */
function leaveOnline(){
  if(GRP.named) leaveGroupRoom();
  if(DUEL.named) leaveDuelRoom();
  DUEL.view='off'; pushLobby();
}

function onLobbyPeers(){
  const ps=lobbyPeers();
  if(DUEL.view==='wait'&&DUEL.outInv&&ps.some(p=>p.presence.dec&&p.presence.dec.to===DUEL.myPeer&&p.presence.dec.code===DUEL.outInv.code)){
    leaveDuel('Deine Herausforderung wurde abgelehnt.'); return;
  }
  const duelInv=ps.find(p=>p.presence.inv&&p.presence.inv.to===DUEL.myPeer&&!DUEL.seen.has(p.presence.inv.code));
  const groupInv=ps.find(p=>{ const gi=p.presence.ginv; return gi&&Array.isArray(gi.to)&&gi.to.includes(DUEL.myPeer)&&!DUEL.seen.has('g'+gi.code); });
  showInvite(duelInv,groupInv);
  refreshPeople();
}
/* Listen mit Spielern auf der gerade offenen Seite neu zeichnen */
function refreshPeople(){
  if(DUEL.view==='lobby'){ renderOnlineList('onlineList'); renderFriendList(); }
  if(DUEL.view==='profile'){ renderOnlineList('othersOnline'); renderFriendList(); }
  if(DUEL.view==='group') renderGroupMembers();
}

/* Einladung unten als Sheet einblenden */
function showInvite(duelInv,groupInv){
  if(inMatch()||(!duelInv&&!groupInv)){ inviteBar.hidden=true; return; }
  const p=duelInv||groupInv;
  const code=duelInv?p.presence.inv.code:p.presence.ginv.code, seenKey=duelInv?code:'g'+code;
  inviteBar.innerHTML=`<div class="sheet-in"><p><b>${esc(p.presence.nick||'Jemand')}</b> ${duelInv?'fordert dich zum Duell heraus.':'lädt dich in eine Lobby ein.'}</p><div class="btnrow"><button class="btn plain" id="invNo">Ablehnen</button><button class="btn primary" id="invYes">${duelInv?'Annehmen':'Beitreten'}</button></div></div>`;
  inviteBar.hidden=false;
  inviteBar.querySelector('#invYes').onclick=()=>{ DUEL.seen.add(seenKey); inviteBar.hidden=true; stopSpeaking(); duelInv?joinDuel(code):openGroup(code); };
  inviteBar.querySelector('#invNo').onclick=()=>{
    DUEL.seen.add(seenKey); inviteBar.hidden=true;
    if(!duelInv) return;
    DUEL.decline={to:p.peer,code}; pushLobby();
    setTimeout(()=>{ if(DUEL.decline&&DUEL.decline.code===code){ DUEL.decline=null; pushLobby(); } },15000);
  };
}

/* ----- Lobby-Seite ----- */
async function openDuel(){
  if(!(await ensureAuth('duel'))) return;
  await initLobby();
  renderLobby();
}
function renderLobby(msg){
  leaveOnline(); S.phase='duel'; DUEL.view='lobby'; pushLobby(); inviteBar.hidden=true;
  setBack('Start',renderStart);
  showPage(`<div class="stack">
    <div class="pagehead"><h2 class="pagetitle">Online spielen</h2><p class="sub">10 Runden · alle bekommen dieselbe Frage · 30 Sekunden · 4 Antworten, eine ist richtig. Richtig gibt 1 Punkt, unter 10 s +2 Bonus, unter 20 s +1.</p></div>
    <section class="group"><button class="row" id="mkGroup"><span class="tile">${IC.bolt}</span><span class="label">Lobby erstellen<small>Mit bis zu ${GMAX} Spielern gleichzeitig spielen</small></span>${IC.chev}</button></section>

    <p class="group-label">Freunde</p>
    <section class="group list" id="friendList"></section>
    <section class="group"><button class="row" id="toProfile"><span class="tile tile-ok">${IC.plus}</span><span class="label">Freunde hinzufügen<small>per Name oder Freundescode</small></span>${IC.chev}</button></section>
    <section class="group"><button class="row" id="lbRow"><span class="tile tile-warn">${IC.trophy}</span><span class="label">Rangliste</span>${IC.chev}</button></section>

    <p class="group-label">Weitere Spieler online</p>
    <section class="group list" id="onlineList"></section>

    <p class="group-label">Mit Code beitreten</p>
    <section class="card">
      <div class="coderow"><input id="codeIn" class="field" inputmode="numeric" maxlength="5" placeholder="Code" aria-label="Duell- oder Lobby-Code"><button class="btn tinted" id="joinCode">Beitreten</button></div>
      <button class="btn plain" id="mkCode">Duell-Code für 1 gegen 1 erstellen</button>
    </section>
    ${accountRowHTML()}
    <p class="hint" id="lobbyHint" role="status"></p>
  </div>`);
  if(msg) setHint('lobbyHint',msg,true);
  bindAccount();
  view.querySelector('#mkGroup').onclick=()=>openGroup();
  view.querySelector('#toProfile').onclick=()=>renderProfile();
  view.querySelector('#lbRow').onclick=()=>renderLeaderboard('all');
  view.querySelector('#mkCode').onclick=()=>hostDuel(newDuelCode(),null);
  const ci=view.querySelector('#codeIn');
  const join=()=>{
    const c=ci.value.replace(/\D/g,'');
    if(c.length===5) openGroup(c);
    else if(c.length===4) joinDuel(c);
    else setHint('lobbyHint','Duell-Codes haben 4 Ziffern, Lobby-Codes 5.',true);
  };
  view.querySelector('#joinCode').onclick=join; ci.onkeydown=e=>{ if(e.key==='Enter') join(); };
  renderFriendList(); renderOnlineList('onlineList');
  onLobbyPeers();
}

/* Spieler online, die (noch) keine Freunde sind: mit „+“ hinzufügen oder herausfordern */
function renderOnlineList(boxId){
  const box=document.getElementById(boxId); if(!box) return;
  const list=lobbyPeers().filter(p=>!isFriend(p.by));
  if(!list.length){ box.innerHTML=infoRow('Gerade ist sonst niemand online.','Schick deinen Freunden den Link zu dieser Seite. Sobald sie angemeldet sind, erscheinen sie hier.'); return; }
  box.innerHTML=list.map(p=>`<div class="row">${avatarFor(p.by,p.presence.nick,p.presence.busy)}<span class="label"><span>${esc(p.presence.nick||'Spieler')}</span><small>${p.presence.busy?'spielt gerade':'online'}</small></span><button class="iconbtn addf" data-addf="${esc(p.by)}" aria-label="Als Freund hinzufügen" title="Als Freund hinzufügen">+</button>${p.presence.busy?'':`<button class="btn tinted small" data-ch="${esc(p.peer)}">Herausfordern</button>`}</div>`).join('');
  box.querySelectorAll('[data-addf]').forEach(b=>b.onclick=async()=>{ b.disabled=true; try{ await addFriend(b.dataset.addf); }catch(e){ b.disabled=false; } });
  box.querySelectorAll('[data-ch]').forEach(b=>b.onclick=()=>challenge(b.dataset.ch));
}
function challenge(peer){ const p=lobbyPeers().find(x=>x.peer===peer); if(p&&!p.presence.busy) hostDuel(newDuelCode(),p); }
