/* ---------- Ranked: zufälliger Gegner, Wertung wie bei chess.com (Glicko) ----------
   Gegnersuche und Wertung laufen auf dem Server (functions/matchmaking.js, functions/glicko.js):
   - Suchen: eigener Eintrag in queue/{uid}. Der Server paart die zwei, die am längsten warten,
     legt das Spiel an und schreibt matches/{uid} = {gid, role, opp}.
   - Gespielt wird wie im normalen Duell (Raum "duel-<gid>"); gewertet wird nur auf dem Server.
   - Die Website zeigt die Wertung nur an; „?“ = vorläufig (unter 10 Ranked-Spielen). */
const RANK_START=1000, PROVISIONAL_GAMES=10, MATCH_TIMEOUT=15000;
const RK={searching:false,matchRef:null,onMatch:null,queueRef:null,countRef:null,onCount:null,match:null};

const myRating=()=>{ const r=(SOC.profile||{}).rating; return typeof r==='number'?r:RANK_START; };
const isProvisional=u=>((u&&u.rgames)||0)<PROVISIONAL_GAMES;
const ratingText=u=>(u&&typeof u.rating==='number'?u.rating:RANK_START)+(isProvisional(u)?'?':'');

function renderRanked(msg){
  leaveOnline(); S.phase='duel'; DUEL.view='ranked'; pushLobby(); inviteBar.hidden=true;
  setBack('Duell',renderDuelHub);
  const p=SOC.profile||{}, games=p.rgames||0, wins=p.rwins||0;
  showPage(`<div class="stack">
    <div class="pagehead"><h2 class="pagetitle">Ranked</h2><p class="sub">Zufälliger Gegner, der gerade auch sucht. ${RULES_TEXT} Das Ergebnis zählt für deine Wertung und die Rangliste.</p></div>
    <section class="card center tall">
      <p class="sectionhead">Deine Wertung</p>
      <div class="codebig" id="rkRating">${ratingText(p)}</div>
      <p class="sub">${games?`${games} ${games===1?'Spiel':'Spiele'} · ${wins} ${wins===1?'Sieg':'Siege'}`:'Noch keine Ranked-Spiele · Start bei 1000'}${isProvisional(p)?`<br>„?“ = vorläufig, bis du ${PROVISIONAL_GAMES} Ranked-Spiele hast. Bis dahin ändert sich deine Wertung stärker.`:''}</p>
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
  const me=FB.user.uid;
  RK.searching=true; RK.match=null;
  // Zuteilung des Servers abwarten
  RK.matchRef=FB.db.ref('matches/'+me);
  try{ await RK.matchRef.remove(); }catch(e){}
  RK.onMatch=s=>{ const m=s.val(); if(m&&m.gid&&RK.searching) onMatched(m); };
  RK.matchRef.on('value',RK.onMatch);
  // Anzahl der Suchenden anzeigen
  RK.countRef=FB.db.ref('queue');
  RK.onCount=s=>{ const n=Math.max(0,Object.keys(s.val()||{}).filter(id=>id!==me).length), el=document.getElementById('rkCount');
    if(el) el.textContent=n?`${n} ${n===1?'weiterer Spieler sucht':'weitere Spieler suchen'} gerade`:'Gerade sucht sonst niemand. Bleib dran oder sag Freunden Bescheid.'; };
  RK.countRef.on('value',RK.onCount);
  // In die Warteschlange (beim Verbindungsabbruch automatisch wieder raus)
  RK.queueRef=FB.db.ref('queue/'+me);
  try{ RK.queueRef.onDisconnect().remove(); await RK.queueRef.set({at:serverTime()}); }
  catch(e){ leaveQueue(); renderRanked('Die Suche konnte nicht starten. Versuch es gleich nochmal.'); }
}
function renderSearching(){
  S.phase='duel'; inviteBar.hidden=true;
  setBack('Abbrechen',()=>renderRanked());
  showPage(`<div class="stack">
    <section class="card center tall">
      <p class="sectionhead">Ranked</p>
      <p><b>Suche Gegner …</b></p>
      <div class="spinner" aria-hidden="true"></div>
      <p class="sub" id="rkCount">Deine Wertung: ${ratingText(SOC.profile)}</p>
    </section>
    <button class="btn plain" id="rkCancel">Abbrechen</button>
  </div>`);
  view.querySelector('#rkCancel').onclick=()=>renderRanked();
}
/* Suche beenden und alle Beobachter abmelden */
function leaveQueue(){
  RK.searching=false;
  if(RK.matchRef&&RK.onMatch) RK.matchRef.off('value',RK.onMatch);
  if(RK.countRef&&RK.onCount) RK.countRef.off('value',RK.onCount);
  if(RK.queueRef){ RK.queueRef.remove().catch(()=>{}); try{ RK.queueRef.onDisconnect().cancel(); }catch(e){} }
  Object.assign(RK,{matchRef:null,onMatch:null,countRef:null,onCount:null,queueRef:null});
}
/* Der Server hat einen Gegner zugeteilt */
function onMatched(m){
  const me=FB.user.uid;
  leaveQueue(); FB.db.ref('matches/'+me).remove().catch(()=>{});
  RK.match=m; DUEL.ranked=true;
  ensureInfo(m.opp);
  if(m.role==='host'){
    hostDuel(m.gid,null);
    // Kommt der Gegner nicht, weitersuchen
    DUEL.timers.push(setTimeout(()=>{ if(DUEL.ranked&&DUEL.view==='wait'&&DUEL.code===m.gid&&!DUEL.game){ leaveDuelRoom(); startSearch(); } },MATCH_TIMEOUT));
  } else joinDuel(m.gid);
}
