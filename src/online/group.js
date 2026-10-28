/* ---------- Gruppen-Lobby: bis zu 8 Spieler gleichzeitig ----------
   Raum "grp-<5 Ziffern>". Gastgeber-Eintrag: {role:'host', nick, g:Spielstand|null}, Mitspieler: {role:'m', nick, a:Antwort}.
   Spielstand g: {id, qs, r, ph (q/rev/end), pl:[Spieler], nm:{Spieler:Name}, sc:{Spieler:Punkte}, res:{Spieler:Ergebnis}}
   Wer während eines Spiels beitritt, wartet bis zur nächsten Runde. */
const GMAX=8;
const GRP={named:null,code:null,host:false,game:null,hg:null,lastKey:null,unsub:[],timers:[],hist:[],invited:new Set()};

const newGroupCode=()=>String(Math.floor(10000+Math.random()*90000));
const gPeers=()=>GRP.named?GRP.named.peers().filter(p=>p.presence.nick):[];
const gHostPeer=()=>gPeers().find(p=>p.presence.role==='host');
const gCur=()=>GRP.host?GRP.game:GRP.hg;
const gMe=()=>DUEL.myPeer;

async function openGroup(code){
  if(!(await ensureAuth('duel'))) return;
  if(!(await initLobby())){ renderLobby('Keine Verbindung. Versuch es gleich nochmal.'); return; }
  GRP.host=!code;
  await enterGroup(code||newGroupCode());
}
async function enterGroup(code){
  leaveOnline();
  GRP.code=code; GRP.invited=new Set(); S.phase='duel'; DUEL.view='group'; pushLobby(); inviteBar.hidden=true;
  setBack('Abbrechen',()=>leaveGroup());
  showPage(`<div class="stack"><section class="card center tall"><p class="sectionhead">Lobby ${esc(code)}</p><p>Verbinde …</p><div class="spinner" aria-hidden="true"></div></section></div>`);
  let r;
  try{ r=await DUEL.room.join('grp-'+code); }
  catch(e){ leaveGroup('Der Lobby konnte nicht beigetreten werden. Versuch es gleich nochmal.'); return; }
  if(GRP.code!==code){ r.leave().catch(()=>{}); return; }
  GRP.named=r;
  GRP.unsub.push(r.onPeers(onGroupPeers,()=>{ if(GRP.named===r) leaveGroup('Die Verbindung zur Lobby ist abgebrochen.'); }));
  await r.presence({role:GRP.host?'host':'m',nick:myName()}).catch(()=>{});
  if(GRP.host){ pushGroupHost(); renderGroupLobby(); }
  else GRP.timers.push(setTimeout(()=>{ if(GRP.named===r&&!gHostPeer()) leaveGroup('Keine offene Lobby mit diesem Code gefunden.'); },9000));
}

function onGroupPeers(){
  if(!GRP.named) return;
  if(GRP.host){
    const g=GRP.game;
    if(!g||g.ph==='end') renderGroupMembers();
    else { gHostCheck(); gRenderStatus(); }
    return;
  }
  if(!gHostPeer()){ if(gPeers().some(p=>p.isMe)) leaveGroup('Der Gastgeber hat die Lobby verlassen.'); return; }
  if(!GRP.lastKey&&gPeers().length>GMAX){ leaveGroup('Diese Lobby ist voll.'); return; }
  gFollow(gHostPeer().presence.g||null);
}
/* Mitspieler folgen dem Spielstand des Gastgebers */
function gFollow(g){
  const prev=GRP.hg; GRP.hg=g;
  if(!g){
    if(GRP.lastKey!=='lobby'){ GRP.lastKey='lobby'; renderGroupLobby(); } else renderGroupMembers();
    return;
  }
  const inGame=(g.pl||[]).includes(gMe());
  const key=g.id+':'+g.r+':'+g.ph+':'+inGame;
  if(key===GRP.lastKey){ gRenderStatus(); return; }
  GRP.lastKey=key;
  if(!prev||prev.id!==g.id) GRP.hist=[];
  if(!inGame) renderGroupSpectator(g);
  else if(g.ph==='q') gShowQuestion(g);
  else if(g.ph==='rev'&&g.res){ clearRoundTimers(); gShowReveal(g); }
  else if(g.ph==='end'){ clearRoundTimers(); gShowEnd(g); }
}

/* ----- Warteraum ----- */
function renderGroupLobby(msg){
  clearRoundTimers(); S.phase='duel'; DUEL.view='group'; pushLobby(); inviteBar.hidden=true;
  setBack('Verlassen',()=>leaveGroup());
  const hp=gHostPeer();
  showPage(`<div class="stack">
    <div class="pagehead"><h2 class="pagetitle">Lobby</h2><p class="sub">Bis zu ${GMAX} Spieler · alle bekommen dieselbe Frage · ${ROUNDS} Runden à 30 Sekunden · je schneller richtig, desto mehr Punkte</p></div>
    <section class="card center">
      <p class="sectionhead">Lobby-Code</p><div class="codebig">${esc(GRP.code)}</div>
      <p class="sub">${GRP.host?'Schick den Code an deine Freunde. Sie geben ihn unter „Online spielen“ → „Mit Code beitreten“ ein. Oder lade sie unten direkt ein.':`Warte, bis ${esc((hp&&hp.presence.nick)||'der Gastgeber')} das Spiel startet …`}</p>
    </section>
    <p class="group-label" id="gCount">Spieler</p>
    <section class="group list" id="gMembers"></section>
    ${GRP.host?`<button class="btn primary" id="gStart">Spiel starten</button>
    <p class="group-label">Einladen</p>
    <section class="group list" id="gInvite"></section>`:''}
    <button class="btn plain" id="gLeave">Lobby verlassen</button>
    <p class="hint" id="gHint" role="status"></p>
  </div>`);
  if(msg) setHint('gHint',msg);
  const st=document.getElementById('gStart'); if(st) st.onclick=gStartGame;
  document.getElementById('gLeave').onclick=()=>leaveGroup();
  renderGroupMembers();
}
function renderGroupMembers(){
  const box=document.getElementById('gMembers'); if(!box) return;
  const ps=gPeers().slice().sort((a,b)=>(b.presence.role==='host')-(a.presence.role==='host'));
  box.innerHTML=ps.map(p=>`<div class="row">${avatarFor(p.by,p.presence.nick,false)}<span class="label"><span>${esc(p.presence.nick)}${p.isMe?' (du)':''}</span><small>${p.presence.role==='host'?'Gastgeber':'bereit'}</small></span></div>`).join('')||infoRow('Verbinde …');
  document.getElementById('gCount').textContent=`Spieler (${ps.length} von ${GMAX})`;
  const st=document.getElementById('gStart');
  if(st){ st.disabled=ps.length<2; st.textContent=ps.length<2?'Warte auf Mitspieler …':`Spiel starten (${ps.length} Spieler)`; }
  renderGroupInvite();
}
function renderGroupInvite(){
  const box=document.getElementById('gInvite'); if(!box) return;
  const inRoom=new Set(gPeers().map(p=>p.by));
  const list=lobbyPeers().filter(p=>!inRoom.has(p.by)).sort((a,b)=>isFriend(b.by)-isFriend(a.by));
  if(!list.length){ box.innerHTML=infoRow('Gerade ist niemand sonst online.','Schick den Code einfach per Nachricht.'); return; }
  box.innerHTML=list.map(p=>{ const inv=GRP.invited.has(p.peer);
    return `<div class="row">${avatarFor(p.by,p.presence.nick,p.presence.busy)}<span class="label"><span>${esc(p.presence.nick||'Spieler')}</span><small>${p.presence.busy?'spielt gerade':isFriend(p.by)?'Freund · online':'online'}</small></span><button class="btn tinted small" data-ginv="${esc(p.peer)}" ${inv||p.presence.busy?'disabled':''}>${inv?'Eingeladen':'Einladen'}</button></div>`; }).join('');
  box.querySelectorAll('[data-ginv]').forEach(b=>b.onclick=()=>{ GRP.invited.add(b.dataset.ginv); pushLobby(); renderGroupInvite(); });
}
function groupInvitePresence(){ return GRP.host&&GRP.code&&GRP.invited.size?{to:[...GRP.invited],code:GRP.code}:null; }

/* ----- Gastgeber steuert das Spiel ----- */
function pushGroupHost(){ if(GRP.named) GRP.named.presence({role:'host',nick:myName(),g:GRP.game}).catch(()=>{}); }
function gStartGame(){
  const ps=gPeers().slice(0,GMAX); if(ps.length<2) return;
  const nm={}, sc={};
  ps.forEach(p=>{ nm[p.peer]=String(p.presence.nick).slice(0,24); sc[p.peer]=0; });
  GRP.game={id:Math.random().toString(36).slice(2,8),qs:pickQs(),r:0,ph:'q',pl:ps.map(p=>p.peer),nm,sc};
  GRP.invited=new Set(); GRP.hist=[]; pushLobby();
  pushGroupHost(); gBeginRound();
}
function gBeginRound(){ gShowQuestion(GRP.game); RT.deadline=setTimeout(gHostReveal,QTIME+3000); }
function gActive(g){ const here=new Set(gPeers().map(p=>p.peer)); return (g.pl||[]).filter(p=>here.has(p)); }
function gAnswerOf(peer,g){
  if(peer===gMe()) return RT.myAns;
  const p=gPeers().find(x=>x.peer===peer);
  return answerFor(p&&p.presence.a,g);
}
function gHostCheck(){
  const g=GRP.game; if(!g||g.ph!=='q') return;
  if(gActive(g).every(p=>{ const a=gAnswerOf(p,g); return a&&a.lk; })) gHostReveal();
}
function gHostReveal(){
  const g=GRP.game; if(!g||g.ph!=='q') return;
  clearRoundTimers();
  const key=correctKey(g.qs[g.r]), here=new Set(gPeers().map(p=>p.peer));
  g.sc=g.sc||{}; g.res={};
  g.pl.forEach(p=>{
    const a=gAnswerOf(p,g)||{c:'',t:QTIME};
    const e=evalChoice(a.c,key,a.t); e.gone=!here.has(p);
    g.res[p]=e; g.sc[p]=(g.sc[p]||0)+e.pt;
  });
  g.ph='rev'; pushGroupHost(); gShowReveal(g);
  RT.next=setTimeout(()=>{
    if(GRP.game!==g) return;
    delete g.res;
    if(g.r+1>=ROUNDS){ g.ph='end'; pushGroupHost(); gShowEnd(g); }
    else { g.r++; g.ph='q'; pushGroupHost(); gBeginRound(); }
  },REVEAL);
}
function gBackToLobby(){ GRP.game=null; GRP.hist=[]; pushGroupHost(); renderGroupLobby(); }

/* ----- Ansichten ----- */
function gRanking(g){
  const sc=g.sc||{}, nm=g.nm||{};
  const rows=(g.pl||[]).map(p=>({p,n:nm[p]||'Spieler',s:sc[p]||0})).sort((a,b)=>b.s-a.s||a.n.localeCompare(b.n));
  rows.forEach((r,i)=>{ r.rank=i&&rows[i-1].s===r.s?rows[i-1].rank:i+1; });   // gleiche Punkte = gleicher Platz
  return rows;
}
function gTopHTML(g){
  const rk=gRanking(g), mine=rk.find(r=>r.p===gMe())||{s:0,rank:'–'};
  return `<div class="score"><div class="sc me"><small>Du</small><b>${mine.s}</b></div><div class="sc mid">Runde ${Math.min(g.r+1,ROUNDS)} von ${ROUNDS}</div><div class="sc op"><small>Platz</small><b>${mine.rank}<span class="of">/${rk.length}</span></b></div></div>`;
}
function gShowQuestion(g){
  S.phase='duel'; DUEL.view='group';
  setBack('Verlassen',()=>leaveGroup());
  showRoundQuestion(gTopHTML(g),g,a=>{
    if(GRP.named) GRP.named.presence({a}).catch(()=>{});
    gRenderStatus();
    if(GRP.host) gHostCheck();
  });
  gRenderStatus();
}
function gRenderStatus(){
  const el=document.getElementById('oppStat'), g=gCur(); if(!el||!g||g.ph!=='q') return;
  const others=gActive(g).filter(p=>p!==gMe());
  const done=others.filter(p=>{ const a=gAnswerOf(p,g); return a&&a.lk; }).length;
  el.innerHTML=`<i class="${done===others.length?'done':''}"></i>${done} von ${others.length} ${others.length===1?'Mitspieler hat':'Mitspielern haben'} eingeloggt`;
}
function gResultRow(r,res){
  const e=res[r.p]||{c:'',ok:false,pt:0,t:QTIME}, me=r.p===gMe();
  const detail=e.gone?'hat verlassen':!e.c?'keine Antwort':(e.ok?'richtig':'falsch')+' · '+fmtSec(e.t);
  return `<div class="row${me?' me-row':''}"><span class="rank">${r.rank}</span><span class="label"><span>${esc(r.n)}${me?' (du)':''}</span><small>${detail}</small></span><span class="badge ${e.ok?'good':'bad'}">+${e.pt}</span><span class="value"><b>${r.s}</b></span></div>`;
}
function gShowReveal(g){
  const q=g.qs[g.r], res=g.res||{};
  const mine=res[gMe()]||{c:'',ok:false,pt:0,t:QTIME};
  if(!GRP.hist.some(h=>h.r===g.r)) GRP.hist.push({r:g.r,mid:q.m,k:q.k,me:mine});
  const last=g.r+1>=ROUNDS, right=Object.values(res).filter(e=>e.ok).length;
  showPage(`<div class="stack">${gTopHTML(g)}
    ${verdictHTML('Du',mine)}
    <p class="footnote">${right} von ${Object.keys(res).length} richtig</p>
    ${qCardHTML(q,true)}
    ${optionsHTML(q,{reveal:true,mine:mine.c,locked:true})}
    <p class="group-label">Zwischenstand</p>
    <section class="group list">${gRanking(g).map(r=>gResultRow(r,res)).join('')}</section>
    <p class="footnote" id="nextIn">${last?'Gleich kommt die Auswertung …':'Nächste Runde gleich …'}</p>
  </div>`);
  startRevealCountdown(last);
  if(autoRead) speak(mine.ok?'Richtig.':'Falsch.');
}
function gShowEnd(g){
  clearRoundTimers();
  setBack('Lobby',()=>GRP.host?gBackToLobby():leaveGroup());
  const rk=gRanking(g), mine=rk.find(r=>r.p===gMe())||{rank:rk.length,s:0};
  const head=mine.rank===1?(rk.filter(r=>r.rank===1).length>1?'Geteilter 1. Platz!':'Gewonnen!'):`Platz ${mine.rank} von ${rk.length}`;
  const medal=['🥇','🥈','🥉'];
  const rows=rk.map(r=>`<div class="row${r.p===gMe()?' me-row':''}"><span class="rank">${medal[r.rank-1]||r.rank}</span><span class="label"><span>${esc(r.n)}${r.p===gMe()?' (du)':''}</span></span><span class="value"><b>${r.s}</b> Pkt.</span></div>`).join('');
  const hist=GRP.hist.slice().sort((x,y)=>x.r-y.r).map(h=>`<div class="row"><span class="label"><span>${esc(M[h.mid].n)}</span><small>${esc(FIELD[h.k])}</small></span><span class="badge ${h.me.ok?'good':'bad'}">+${h.me.pt}</span></div>`).join('');
  showPage(`<div class="stack">
    <div class="pagehead"><h2 class="pagetitle big${mine.rank===1?' win':''}">${head}</h2><p class="sub score-line">${mine.s} Punkte</p></div>
    <p class="group-label">Endstand</p>
    <section class="group list">${rows}</section>
    <p class="group-label">Deine Runden</p>
    <section class="group list">${hist}</section>
    <div class="stack-sm">${GRP.host?'<button class="btn primary" id="gAgain">Nochmal spielen</button><button class="btn tinted" id="gLobby">Zurück zur Lobby</button>':'<p class="footnote">Bleib hier – der Gastgeber kann gleich eine neue Runde starten.</p>'}<button class="btn plain" id="gLeave">Lobby verlassen</button></div>
  </div>`);
  const ag=view.querySelector('#gAgain'); if(ag) ag.onclick=()=>gPeers().length<2?gBackToLobby():gStartGame();
  const lb=view.querySelector('#gLobby'); if(lb) lb.onclick=gBackToLobby;
  view.querySelector('#gLeave').onclick=()=>leaveGroup();
  if(autoRead) speak(head+'. '+mine.s+' Punkte.');
}
function renderGroupSpectator(g){
  clearRoundTimers(); DUEL.view='group';
  setBack('Verlassen',()=>leaveGroup());
  showPage(`<div class="stack"><section class="card center tall">
    <p class="sectionhead">Lobby ${esc(GRP.code)}</p>
    <p>${g.ph==='end'?'Das Spiel ist gerade zu Ende.':`Hier läuft gerade ein Spiel (Runde ${Math.min(g.r+1,ROUNDS)} von ${ROUNDS}).`} Bei der nächsten Runde bist du dabei.</p>
    <div class="spinner" aria-hidden="true"></div></section>
    <button class="btn plain" id="gLeave">Lobby verlassen</button></div>`);
  view.querySelector('#gLeave').onclick=()=>leaveGroup();
}

function leaveGroupRoom(){
  clearRoundTimers();
  GRP.timers.forEach(clearTimeout); GRP.timers=[];
  GRP.unsub.forEach(u=>{ try{ u(); }catch(e){} }); GRP.unsub=[];
  const r=GRP.named; GRP.named=null; if(r) r.leave().catch(()=>{});
  Object.assign(GRP,{game:null,hg:null,lastKey:null,code:null,hist:[],invited:new Set()});
}
function leaveGroup(msg){ leaveGroupRoom(); GRP.host=false; stopSpeaking(); renderLobby(msg); }
