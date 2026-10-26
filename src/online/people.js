/* ---------- Seiten: Freundesliste, Freund, Rangliste, eigenes Profil ---------- */
function renderFriendList(){
  const box=document.getElementById('friendList'); if(!box) return;
  const ids=Object.keys(SOC.friends);
  if(!ids.length){ box.innerHTML=infoRow('Noch keine Freunde','Füge Freunde per Name oder Freundescode hinzu.'); return; }
  const online=new Map(lobbyPeers().map(p=>[p.by,p]));
  const nameOf=id=>(SOC.info[id]||{}).name||'';
  ids.sort((a,b)=>(online.has(b)-online.has(a))||nameOf(a).localeCompare(nameOf(b)));
  box.innerHTML=ids.map(fid=>{
    const p=online.get(fid), rc=record(fid), nm=(p&&p.presence.nick)||nameOf(fid)||'Spieler';
    const status=p?(p.presence.busy?'busy':'on'):'off';
    return `<div class="row">${avatarHTML(fid,nm,status)}<button class="label rowlink" data-fr="${esc(fid)}"><span>${esc(nm)}</span><small>${p?(p.presence.busy?'spielt gerade':'online'):'offline'}${rc.games?` · Bilanz ${rc.w} : ${rc.l}`:''}</small></button>${p&&!p.presence.busy?`<button class="btn tinted small" data-ch="${esc(p.peer)}">Herausfordern</button>`:''}</div>`;
  }).join('');
  box.querySelectorAll('[data-fr]').forEach(b=>b.onclick=()=>renderFriend(b.dataset.fr));
  box.querySelectorAll('[data-ch]').forEach(b=>b.onclick=()=>challenge(b.dataset.ch));
}

function fmtDate(ts){ if(!ts) return '—'; try{ return new Date(ts).toLocaleDateString('de-DE',{day:'numeric',month:'short',year:'numeric'}); }catch(e){ return '—'; } }
const avg=(sum,n)=>n?(sum/n).toFixed(1).replace('.',','):'—';
const valueRow=(label,value)=>`<div class="row"><span class="label">${label}</span><span class="value">${value}</span></div>`;
function renderFriend(fid){
  DUEL.view='friend'; S.phase='duel'; setBack('Zurück',()=>renderLobby());
  const info=SOC.info[fid]||{}, rc=record(fid), p=lobbyPeers().find(x=>x.by===fid);
  const nm=(p&&p.presence.nick)||info.name||'Spieler';
  const st=Object.assign(emptyStats(),info.stats||{});
  showPage(`<div class="stack">
    <div class="pagehead">${avatarHTML(fid,nm,null,'xl')}<h2 class="pagetitle">${esc(nm)}</h2><p class="sub">${p?(p.presence.busy?'spielt gerade':'online'):'offline'}</p></div>
    <div class="score"><div class="sc me"><small>Du</small><b>${rc.w}</b></div><div class="sc mid">Siege<br>${rc.games} ${rc.games===1?'Duell':'Duelle'}</div><div class="sc op"><small>${esc(nm)}</small><b>${rc.l}</b></div></div>
    <p class="group-label">Eure Bilanz</p>
    <section class="group list">
      ${valueRow('Duelle gegeneinander',rc.games)}${valueRow('Deine Siege',rc.w)}${valueRow('Siege von '+esc(nm),rc.l)}${valueRow('Unentschieden',rc.d)}
      ${valueRow('Ø Punkte pro Duell',avg(rc.pm,rc.games)+' : '+avg(rc.pf,rc.games))}${valueRow('Letztes Duell',fmtDate(rc.last))}
    </section>
    <p class="group-label">Gesamt von ${esc(nm)}</p>
    <section class="group list">${valueRow('Ranglistenpunkte',scoreOf(st))}${valueRow('Duelle · Siege',st.games+' · '+st.wins)}</section>
    ${p&&!p.presence.busy?'<button class="btn primary" id="frCh">Herausfordern</button>':''}
    <button class="btn plain muted" id="frRm">Freund entfernen</button>
  </div>`);
  const ch=document.getElementById('frCh'); if(ch) ch.onclick=()=>challenge(p.peer);
  const rm=document.getElementById('frRm');
  rm.onclick=async()=>{
    if(rm.dataset.sure!=='1'){ rm.dataset.sure='1'; rm.textContent='Wirklich entfernen? Nochmal tippen'; rm.classList.remove('muted'); return; }
    rm.disabled=true; await removeFriend(fid); renderLobby('Freund entfernt.');
  };
}

async function renderLeaderboard(mode){
  DUEL.view='board'; S.phase='duel'; setBack('Zurück',()=>renderLobby());
  showPage(`<div class="stack">
    <h2 class="pagetitle">Rangliste</h2>
    <div class="seg" role="group" aria-label="Rangliste"><button data-lb="all" aria-pressed="${mode==='all'}">Alle</button><button data-lb="friends" aria-pressed="${mode==='friends'}">Freunde</button></div>
    <section class="group list" id="lbList">${infoRow('Lade …')}</section>
    <p class="footnote">Duelle 1 gegen 1 · Sieg 3 Punkte · Unentschieden 1 Punkt</p>
  </div>`);
  view.querySelectorAll('[data-lb]').forEach(b=>b.onclick=()=>renderLeaderboard(b.dataset.lb));
  const me=FB.user.uid; let rows=[];
  try{
    if(mode==='all'){
      const v=(await FB.db.ref('users').orderByChild('score').limitToLast(100).once('value')).val()||{};
      rows=Object.keys(v).map(id=>Object.assign({id},v[id]));
    } else {
      rows=await Promise.all([me,...Object.keys(SOC.friends)].map(async id=>Object.assign({id},(await userRef(id).once('value').catch(()=>null))?.val()||{})));
    }
  }catch(e){ const l=document.getElementById('lbList'); if(l) l.innerHTML=infoRow('Die Rangliste konnte nicht geladen werden.'); return; }
  const l=document.getElementById('lbList'); if(!l||DUEL.view!=='board') return;
  rows=rows.filter(r=>r.id===me||(r.stats&&r.stats.games>0))
    .sort((a,b)=>(b.score||0)-(a.score||0)||((b.stats||{}).wins||0)-((a.stats||{}).wins||0));
  if(!rows.length){ l.innerHTML=infoRow('Noch keine Duelle gespielt.'); return; }
  l.innerHTML=rows.map((r,i)=>{ const st=Object.assign(emptyStats(),r.stats||{});
    return `<div class="row${r.id===me?' me-row':''}"><span class="rank">${i+1}</span>${avatarHTML(r.id,r.name||'Spieler',null,'',r.photo||null)}<span class="label"><span>${esc(r.name||'Spieler')}${r.id===me?' (du)':''}</span><small>${st.games} Duelle · ${st.wins} Siege</small></span><span class="value"><b>${r.score||0}</b></span></div>`; }).join('');
}

/* ----- Eigenes Profil: Bild, Name, Freundescode, Freunde finden, wer ist online ----- */
async function openProfile(){
  if(!(await ensureAuth('profile'))) return;
  await initLobby();
  renderProfile();
}
function renderProfile(msg){
  if(!SOC.profile){ openProfile(); return; }
  leaveOnline(); S.phase='duel'; DUEL.view='profile'; setBack('Start',renderStart);
  const p=SOC.profile, st=Object.assign(emptyStats(),p.stats||{});
  showPage(`<div class="stack">
    <section class="pagehead">
      ${avatarHTML(FB.user.uid,p.name,null,'xl',p.photo||null)}
      <div class="btnrow center-row">
        <label class="btn tinted small" for="photoIn">${p.photo?'Foto ändern':'Profilbild hinzufügen'}</label>
        ${p.photo?'<button class="btn plain small" id="photoRm">Entfernen</button>':''}
      </div>
      <input type="file" id="photoIn" accept="image/*" hidden>
      <p class="hint" id="photoHint" role="status"></p>
    </section>
    <section class="stack-sm"><label class="group-label" for="pName">Dein Name</label><input id="pName" class="field" maxlength="24" value="${esc(p.name)}" autocomplete="nickname"></section>
    <section class="group list">
      <div class="row"><span class="label"><span>Dein Freundescode</span><b class="fcode">${esc(p.code||'…')}</b><small>Freunde können dich damit finden</small></span><button class="btn tinted small" id="copyCode">Kopieren</button></div>
      ${valueRow('Ranglistenpunkte','<b>'+scoreOf(st)+'</b>')}${valueRow('Duelle · Siege',st.games+' · '+st.wins)}
    </section>

    <p class="group-label">Freunde finden</p>
    <section class="card">
      <input id="fSearch" class="field" type="search" placeholder="Name oder Freundescode" aria-label="Freunde suchen" autocomplete="off">
      <div class="list" id="fResults"></div>
    </section>

    <p class="group-label">Deine Freunde</p>
    <section class="group list" id="friendList"></section>

    <p class="group-label">Gerade online</p>
    <section class="group list" id="othersOnline"></section>

    <section class="group"><button class="row" id="lbRow"><span class="label">Rangliste</span>${IC.chev}</button></section>
    ${accountRowHTML()}
    <p class="hint" id="profileHint" role="status"></p>
  </div>`);
  if(msg) setHint('profileHint',msg);
  bindAccount();

  const pi=document.getElementById('photoIn');
  pi.onchange=async()=>{
    const f=pi.files&&pi.files[0]; if(!f) return;
    setHint('photoHint','Wird gespeichert …');
    try{ await savePhoto(await resizePhoto(f)); renderProfile('Profilbild gespeichert.'); }
    catch(e){ setHint('photoHint','Dieses Bild konnte nicht gelesen werden. Versuch ein JPG oder PNG.',true); }
  };
  const rm=document.getElementById('photoRm'); if(rm) rm.onclick=async()=>{ await savePhoto(null); renderProfile('Profilbild entfernt.'); };

  const pn=document.getElementById('pName'); let nameTimer=null;
  pn.oninput=()=>{ clearTimeout(nameTimer); nameTimer=setTimeout(()=>saveName(pn.value),600); };
  document.getElementById('copyCode').onclick=async()=>{
    try{ await navigator.clipboard.writeText(p.code); setHint('profileHint','Freundescode kopiert.'); }catch(e){ setHint('profileHint','Dein Code: '+p.code); }
  };

  const fs=document.getElementById('fSearch'), fr=document.getElementById('fResults'); let searchTimer=null, seq=0;
  fs.oninput=()=>{
    clearTimeout(searchTimer);
    if(fs.value.trim().length<2){ fr.innerHTML=''; return; }
    searchTimer=setTimeout(async()=>{
      const my=++seq; fr.innerHTML=infoRow('','Suche …');
      const res=await searchUsers(fs.value); if(my!==seq) return;
      if(!res.length){ fr.innerHTML=infoRow('','Niemand gefunden. Prüf die Schreibweise oder frag nach dem Freundescode.'); return; }
      fr.innerHTML=res.map(({id,u})=>`<div class="row">${avatarHTML(id,u.name,null,'',u.photo||null)}<span class="label"><span>${esc(u.name||'Spieler')}</span><small>${(u.stats&&u.stats.games)||0} Duelle</small></span>${isFriend(id)?'<span class="value">Freund</span>':`<button class="btn tinted small" data-addr="${esc(id)}">Hinzufügen</button>`}</div>`).join('');
      fr.querySelectorAll('[data-addr]').forEach(b=>b.onclick=async()=>{ b.disabled=true; try{ await addFriend(b.dataset.addr); b.outerHTML='<span class="value">Freund</span>'; }catch(e){ b.disabled=false; } });
    },350);
  };
  document.getElementById('lbRow').onclick=()=>renderLeaderboard('all');
  renderFriendList(); renderOnlineList('othersOnline');
}
