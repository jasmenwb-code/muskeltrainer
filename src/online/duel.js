/* ---------- Duell 1 gegen 1 ----------
   Raum "duel-<4 Ziffern>". Gastgeber-Eintrag: {role:'host', nick, g:Spielstand}, Gast: {role:'guest', nick, a:Antwort}.
   Spielstand g: {id, qs, r (Runde), ph (q/rev/end), op (Gast), sc:[Gastgeber, Gast], res:{h,o}}
   Ranked-Duelle (siehe ranked.js) tragen zusätzlich ranked:true und rk:{Spieler:Wertung vor dem Spiel}. */
const newDuelCode=()=>String(Math.floor(1000+Math.random()*9000));
const isHost=()=>DUEL.role==='host';
const curGame=()=>isHost()?DUEL.game:DUEL.hg;
const oppName=()=>DUEL.oppNick||'Gegner';

async function hostDuel(code,target){
  DUEL.role='host'; DUEL.target=target?(target.presence.nick||'Spieler'):null;
  DUEL.outInv=target?{to:target.peer,code}:null;
  await enterDuel(code);
}
async function joinDuel(code){
  DUEL.role='guest'; DUEL.target=null; DUEL.outInv=null;
  await enterDuel(code);
}
async function enterDuel(code){
  DUEL.code=code; DUEL.view='wait'; pushLobby(); renderWait();
  let r;
  try{ r=await DUEL.room.join('duel-'+code); }
  catch(e){ leaveDuel('Dem Duell konnte nicht beigetreten werden. Versuch es gleich nochmal.'); return; }
  if(DUEL.view!=='wait'||DUEL.code!==code){ r.leave().catch(()=>{}); return; }
  DUEL.named=r;
  DUEL.unsub.push(r.onPeers(onDuelPeers,()=>{ if(DUEL.named===r) leaveDuel('Die Verbindung zum Duell ist abgebrochen.'); }));
  r.presence({role:DUEL.role,nick:myName()}).catch(()=>{});
  if(!isHost()) DUEL.timers.push(setTimeout(()=>{ if(DUEL.named===r&&!hostPeer()) leaveDuel('Kein offenes Duell mit diesem Code gefunden.'); },9000));
}
const roomPeers=()=>DUEL.named?DUEL.named.peers():[];
const hostPeer=()=>roomPeers().find(p=>!p.isMe&&p.presence.role==='host');
function oppPeer(){ return isHost()?(DUEL.game&&roomPeers().find(p=>p.peer===DUEL.game.op)):hostPeer(); }

function onDuelPeers(){
  if(!DUEL.named) return;
  if(isHost()){
    const g=DUEL.game;
    if(!g){ const guest=roomPeers().find(p=>!p.isMe&&p.presence.role==='guest'); if(guest) startDuel(guest.peer); return; }
    const opp=oppPeer();
    if(!opp){ if(g.ph!=='end') leaveDuel('Dein Gegner hat das Duell verlassen.'); return; }
    DUEL.oppNick=opp.presence.nick||'Gegner';
    hostCheck(); renderOppStatus();
    return;
  }
  const h=hostPeer();
  if(!h){ if(DUEL.hg&&DUEL.hg.ph!=='end') leaveDuel('Dein Gegner hat das Duell verlassen.'); return; }
  DUEL.oppNick=h.presence.nick||'Gegner'; DUEL.oppId=h.by;
  const g=h.presence.g;
  if(!g){ const s=document.getElementById('waitSub'); if(s) s.textContent='Verbunden. Gleich geht es los …'; return; }
  if(g.op!==DUEL.myPeer){ leaveDuel('Dieses Duell läuft schon mit jemand anderem.'); return; }
  if(g.ranked) DUEL.ranked=true;
  guestFollow(g);
}

/* ----- Gastgeber ----- */
function startDuel(op){
  DUEL.outInv=null; DUEL.hist=[]; DUEL.view='game'; pushLobby();
  DUEL.game={id:Math.random().toString(36).slice(2,8),qs:pickQs(),r:0,ph:'q',op,sc:[0,0]};
  if(DUEL.ranked){
    DUEL.game.ranked=true;
    DUEL.game.rk={[DUEL.myPeer]:myRating(),[op]:(RK.opp&&RK.opp.id===op&&typeof RK.opp.rating==='number')?RK.opp.rating:RANK_START};
    leaveQueue();
  }
  const opp=oppPeer(); DUEL.oppNick=(opp&&opp.presence.nick)||'Gegner';
  pushHost(); beginRound();
}
function pushHost(){ if(DUEL.named) DUEL.named.presence({role:'host',nick:myName(),g:DUEL.game}).catch(()=>{}); }
function beginRound(){ showDuelQuestion(DUEL.game); RT.deadline=setTimeout(hostReveal,QTIME+3000); }
function hostCheck(){
  const g=DUEL.game; if(!g||g.ph!=='q') return;
  const opp=oppPeer(), oa=answerFor(opp&&opp.presence.a,g);
  if(RT.myAns&&oa&&oa.lk) hostReveal();
}
function hostReveal(){
  const g=DUEL.game; if(!g||g.ph!=='q') return;
  clearRoundTimers();
  const opp=oppPeer();
  const mine=RT.myAns||{c:'',t:QTIME}, theirs=answerFor(opp&&opp.presence.a,g)||{c:'',t:QTIME};
  const key=correctKey(g.qs[g.r]);
  const h=evalChoice(mine.c,key,mine.t), o=evalChoice(theirs.c,key,theirs.t);
  g.sc=[g.sc[0]+h.pt,g.sc[1]+o.pt]; g.ph='rev'; g.res={h,o};
  pushHost(); showDuelReveal(g);
  RT.next=setTimeout(()=>{
    if(DUEL.game!==g) return;
    delete g.res;
    if(g.r+1>=ROUNDS){ g.ph='end'; pushHost(); showDuelEnd(g); }
    else { g.r++; g.ph='q'; pushHost(); beginRound(); }
  },REVEAL);
}

/* ----- Gast: folgt dem Spielstand des Gastgebers ----- */
function guestFollow(g){
  const prev=DUEL.hg; DUEL.hg=g;
  const key=g.id+':'+g.r+':'+g.ph;
  if(key===DUEL.lastKey){ renderOppStatus(); return; }
  DUEL.lastKey=key;
  if(!prev||prev.id!==g.id) DUEL.hist=[];
  if(g.ph==='q'){ DUEL.view='game'; pushLobby(); showDuelQuestion(g); }
  else if(g.ph==='rev'&&g.res){ clearRoundTimers(); showDuelReveal(g); }
  else if(g.ph==='end'){ clearRoundTimers(); showDuelEnd(g); }
}

/* ----- Ansichten ----- */
function scores(g){ return isHost()?[g.sc[0],g.sc[1]]:[g.sc[1],g.sc[0]]; }
function scoreHTML(g){
  const [a,b]=scores(g);
  return `<div class="score"><div class="sc me"><small>Du</small><b>${a}</b></div><div class="sc mid">Runde ${Math.min(g.r+1,ROUNDS)} von ${ROUNDS}</div><div class="sc op"><small>${esc(oppName())}</small><b>${b}</b></div></div>`;
}
function renderWait(){
  clearRoundTimers(); inviteBar.hidden=true;
  setBack('Abbrechen',()=>leaveDuel());
  const host=isHost();
  showPage(`<div class="stack">
    <section class="card center tall">
      ${DUEL.ranked?`<p class="sectionhead">Ranked</p><p><b>Gegner gefunden${RK.opp&&RK.opp.nick?': '+esc(RK.opp.nick):''}</b></p><p class="sub" id="waitSub">Verbinde …</p>`:''}
      ${!DUEL.ranked&&host&&!DUEL.target?`<p class="sectionhead">Dein Duell-Code</p><div class="codebig">${esc(DUEL.code)}</div><p class="sub">Schick den Code deinem Freund. Er gibt ihn unter Duell → „1 gegen 1“ ein.</p>`:''}
      ${!DUEL.ranked&&host&&DUEL.target?`<p class="sectionhead">Herausforderung gesendet</p><p>Warte, bis <b>${esc(DUEL.target)}</b> annimmt …</p>`:''}
      ${!DUEL.ranked&&!host?`<p class="sectionhead">Duell ${esc(DUEL.code)}</p><p id="waitSub">Verbinde …</p>`:''}
      <div class="spinner" aria-hidden="true"></div>
    </section>
    <button class="btn plain" id="cancel">Abbrechen</button>
  </div>`);
  view.querySelector('#cancel').onclick=()=>leaveDuel();
}
function showDuelQuestion(g){
  setBack('Aufgeben',()=>leaveDuel());
  showRoundQuestion(scoreHTML(g),g,a=>{
    if(DUEL.named) DUEL.named.presence({a}).catch(()=>{});
    if(isHost()) hostCheck();
  });
  renderOppStatus();
}
function renderOppStatus(){
  const el=document.getElementById('oppStat'), g=curGame(); if(!el||!g||g.ph!=='q') return;
  const o=oppPeer(), a=answerFor(o&&o.presence.a,g);
  el.innerHTML=a&&a.lk?`<i class="done"></i>${esc(oppName())} hat eingeloggt`:`<i></i>${esc(oppName())} denkt nach …`;
}
function showDuelReveal(g){
  const q=g.qs[g.r];
  const mine=isHost()?g.res.h:g.res.o, theirs=isHost()?g.res.o:g.res.h;
  if(!DUEL.hist.some(h=>h.r===g.r)) DUEL.hist.push({r:g.r,mid:q.m,k:q.k,me:mine,op:theirs});
  const last=g.r+1>=ROUNDS;
  showPage(`<div class="stack">${scoreHTML(g)}
    <div class="duo">${verdictHTML('Du',mine)}${verdictHTML(oppName(),theirs)}</div>
    ${qCardHTML(q,true)}
    ${optionsHTML(q,{reveal:true,mine:mine.c,theirs:theirs.c,theirName:oppName(),locked:true})}
    <p class="footnote" id="nextIn">${last?'Gleich kommt die Auswertung …':'Nächste Runde gleich …'}</p>
  </div>`);
  startRevealCountdown(last);
  if(autoRead) speak((mine.ok?'Richtig':'Falsch')+'. '+oppName()+(theirs.ok?' richtig':' falsch')+'.');
}
function showDuelEnd(g){
  clearRoundTimers(); DUEL.view='game';
  setBack('Zurück',()=>leaveDuel());
  const [a,b]=scores(g);
  const head=a>b?'Gewonnen!':a<b?'Verloren':'Unentschieden';
  const oppId=isHost()?g.op:DUEL.oppId;
  let rankLine='';
  if(g.ranked&&g.rk){
    const before=g.rk[DUEL.myPeer], delta=eloDelta(before,g.rk[oppId],a>b?1:a<b?0:0.5);
    rankLine=`<div class="rankchange ${delta>=0?'up':'down'}"><span>Wertung</span><b>${before} → ${before+delta}</b><i>${delta>=0?'+':''}${delta}</i></div>`;
  }
  const rows=DUEL.hist.slice().sort((x,y)=>x.r-y.r).map(h=>`<div class="row"><span class="label"><span>${esc(M[h.mid].n)}</span><small>${esc(FIELD[h.k])}</small></span><span class="badges"><span class="badge ${h.me.ok?'good':'bad'}">Du +${h.me.pt}</span><span class="badge ${h.op.ok?'good':'bad'}">${esc(oppName())} +${h.op.pt}</span></span></div>`).join('');
  showPage(`<div class="stack">
    <div class="pagehead"><h2 class="pagetitle big${a>b?' win':''}">${head}</h2><p class="sub score-line">Du ${a} : ${b} ${esc(oppName())}</p></div>
    ${rankLine}
    <p class="footnote" id="h2hLine"></p>
    <section class="group list">${rows}</section>
    <div class="stack-sm">${g.ranked?'<button class="btn primary" id="rkAgain">Neuen Gegner suchen</button>'
      :isHost()?'<button class="btn primary" id="again">Revanche</button>':'<p class="footnote">Revanche? Dein Gegner kann eine neue Runde starten. Bleib einfach hier.</p>'}<button class="btn plain" id="leave">${g.ranked?'Zurück':'Duell verlassen'}</button></div>
  </div>`);
  const rkA=view.querySelector('#rkAgain'); if(rkA) rkA.onclick=()=>{ leaveDuelRoom(); startSearch(); };
  const ag=view.querySelector('#again');
  if(ag) ag.onclick=()=>{ const opp=oppPeer(); if(opp) startDuel(opp.peer); else leaveDuel('Dein Gegner ist nicht mehr da.'); };
  view.querySelector('#leave').onclick=()=>leaveDuel();
  if(autoRead) speak(head+'. '+a+' zu '+b+'.');
  if(DUEL.reported!==g.id){
    DUEL.reported=g.id;
    saveGameResult({gid:g.id,opp:oppId,me:a,them:b,host:isHost(),
      rk:g.ranked&&g.rk?{mine:g.rk[DUEL.myPeer],theirs:g.rk[oppId]}:null});
  }
}

function leaveDuelRoom(){
  clearRoundTimers();
  DUEL.timers.forEach(clearTimeout); DUEL.timers=[];
  DUEL.unsub.forEach(u=>{ try{ u(); }catch(e){} }); DUEL.unsub=[];
  const r=DUEL.named; DUEL.named=null; if(r) r.leave().catch(()=>{});
  Object.assign(DUEL,{game:null,hg:null,lastKey:null,outInv:null,role:null,code:null,target:null});
}
function leaveDuel(msg){ const ranked=DUEL.ranked; leaveDuelRoom(); stopSpeaking(); ranked?renderRanked(msg):render1v1(msg); }
