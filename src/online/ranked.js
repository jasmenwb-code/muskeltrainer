/* ---------- Ranked: zufälliger Gegner, Elo-Wertung ----------
   Warteschlange = Raum "ranked" (rooms/ranked). Eintrag je Suchendem: {nick, rating, since, offer:{to,code}}
   Paarung: Alle Suchenden ohne Angebot werden nach Wartezeit sortiert und in Paare (1+2, 3+4, …) geteilt.
   In jedem Paar eröffnet der mit der kleineren ID ein Duell und schickt dem anderen den Code (offer).
   Wertung: Start 1000, Elo mit K = 32 – ein Sieg gegen Stärkere bringt mehr als gegen Schwächere. */
const RANK_START=1000, ELO_K=32, OFFER_TIMEOUT=12000;
const RK={q:null,unsub:null,since:0,offer:null,opp:null};

const myRating=()=>{ const r=(SOC.profile||{}).rating; return typeof r==='number'?r:RANK_START; };
function eloDelta(mine,theirs,score){ const expected=1/(1+Math.pow(10,(theirs-mine)/400)); return Math.round(ELO_K*(score-expected)); }

function renderRanked(msg){
  leaveOnline(); S.phase='duel'; DUEL.view='ranked'; pushLobby(); inviteBar.hidden=true;
  setBack('Duell',renderDuelHub);
  const p=SOC.profile||{}, games=p.rgames||0, wins=p.rwins||0;
  showPage(`<div class="stack">
    <div class="pagehead"><h2 class="pagetitle">Ranked</h2><p class="sub">Zufälliger Gegner, der gerade auch sucht. ${RULES_TEXT} Das Ergebnis zählt für deine Wertung und die Rangliste.</p></div>
    <section class="card center tall">
      <p class="sectionhead">Deine Wertung</p>
      <div class="codebig" id="rkRating">${myRating()}</div>
      <p class="sub">${games?`${games} ${games===1?'Spiel':'Spiele'} · ${wins} ${wins===1?'Sieg':'Siege'}`:'Noch keine Ranked-Spiele · Start bei 1000'}</p>
    </section>
    <button class="btn primary" id="rkFind">Gegner suchen</button>
    <section class="group"><button class="row" id="lbRow"><span class="tile tile-warn">${IC.trophy}</span><span class="label">Rangliste</span>${IC.chev}</button></section>
    <p class="hint" id="lobbyHint" role="status"></p>
  </div>`);
  if(msg) setHint('lobbyHint',msg,true);
  view.querySelector('#rkFind').onclick=startSearch;
  view.querySelector('#lbRow').onclick=()=>renderLeaderboard('all');
}

/* ----- Suche ----- */
async function startSearch(){
  leaveOnline();
  DUEL.view='rkwait'; pushLobby(); renderSearching();
  let q;
  try{ q=await DUEL.room.join('ranked'); }catch(e){ renderRanked('Die Suche konnte nicht starten. Versuch es gleich nochmal.'); return; }
  if(DUEL.view!=='rkwait'){ q.leave().catch(()=>{}); return; }
  Object.assign(RK,{q,since:Date.now(),offer:null,opp:null});
  RK.unsub=q.onPeers(onQueue,()=>{ if(RK.q===q){ leaveQueue(); renderRanked('Die Verbindung ist abgebrochen.'); } });
  pushQueue();
}
function renderSearching(){
  S.phase='duel'; inviteBar.hidden=true;
  setBack('Abbrechen',()=>renderRanked());
  showPage(`<div class="stack">
    <section class="card center tall">
      <p class="sectionhead">Ranked</p>
      <p><b>Suche Gegner …</b></p>
      <div class="spinner" aria-hidden="true"></div>
      <p class="sub" id="rkCount">Deine Wertung: ${myRating()}</p>
    </section>
    <button class="btn plain" id="rkCancel">Abbrechen</button>
  </div>`);
  view.querySelector('#rkCancel').onclick=()=>renderRanked();
}
function pushQueue(){ if(RK.q) RK.q.presence({nick:myName(),rating:myRating(),since:RK.since,offer:RK.offer}).catch(()=>{}); }
const queuePeers=()=>RK.q?RK.q.peers().filter(p=>p.presence.nick):[];
function leaveQueue(){
  if(RK.unsub) try{ RK.unsub(); }catch(e){}
  const q=RK.q; Object.assign(RK,{q:null,unsub:null,offer:null});
  if(q) q.leave().catch(()=>{});
}

function onQueue(){
  if(!RK.q||DUEL.view!=='rkwait') return;
  const me=DUEL.myPeer, ps=queuePeers(), others=ps.filter(p=>!p.isMe).length;
  const cnt=document.getElementById('rkCount');
  if(cnt) cnt.textContent=others?`${others} ${others===1?'weiterer Spieler sucht':'weitere Spieler suchen'} gerade`:'Gerade sucht sonst niemand. Bleib dran oder sag Freunden Bescheid.';
  // Angebot an mich: annehmen und beitreten
  const offer=ps.find(p=>!p.isMe&&p.presence.offer&&p.presence.offer.to===me);
  if(offer&&!RK.offer){
    const code=offer.presence.offer.code;
    RK.opp={id:offer.peer,nick:offer.presence.nick,rating:offer.presence.rating};
    leaveQueue(); DUEL.ranked=true; joinDuel(code);
    return;
  }
  // Paarung bestimmen
  const waiting=ps.filter(p=>!p.presence.offer||p.isMe).sort((a,b)=>(a.presence.since-b.presence.since)||(a.peer<b.peer?-1:1));
  const i=waiting.findIndex(p=>p.isMe), partner=i<0?null:waiting[i^1];
  if(!partner||me>partner.peer) return;   // der mit der kleineren ID eröffnet
  const code=newDuelCode();
  RK.offer={to:partner.peer,code}; RK.opp={id:partner.peer,nick:partner.presence.nick,rating:partner.presence.rating};
  pushQueue();
  DUEL.ranked=true; hostDuel(code,null);
  // Kommt der Gegner nicht, weitersuchen
  DUEL.timers.push(setTimeout(()=>{
    if(DUEL.ranked&&DUEL.view==='wait'&&DUEL.code===code&&!DUEL.game){ leaveDuelRoom(); RK.offer=null; DUEL.view='rkwait'; renderSearching(); pushQueue(); onQueue(); }
  },OFFER_TIMEOUT));
}
