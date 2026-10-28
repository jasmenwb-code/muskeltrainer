/* ---------- Spielprotokoll für die Server-Auswertung ----------
   Während eines Duells wird in games/{gid} festgehalten, was der Server zum Nachrechnen braucht:
   Fragen, Startzeit jeder Runde und jede Antwort, jeweils mit Server-Zeitstempel.
   Die Datenbank-Regeln erlauben jedem nur seine eigenen Einträge und jeden nur einmal.
   Nach "end" rechnet die Cloud Function (functions/) das Duell nach und schreibt Statistik und Bilanz. */
const gameRef=gid=>FB.db.ref('games/'+gid);
const logged=p=>p.catch(e=>console.warn('Spielprotokoll:',e&&e.message));

function newGameId(){ return FB.db.ref('games').push().key; }
/* Ranked: host, op und ranked hat der Server schon gesetzt; der Gastgeber ergänzt nur die Fragen */
function logCreate(gid,op,qs,ranked){
  return logged(gameRef(gid).update(ranked?{qs,['players/'+FB.user.uid]:true}:{host:FB.user.uid,op,qs,['players/'+FB.user.uid]:true}));
}
function logJoin(gid){ return logged(gameRef(gid).child('players/'+FB.user.uid).set(true)); }
function logStart(gid,r){ return logged(gameRef(gid).child('start/'+r).set(serverTime())); }
function logAnswer(gid,r,c){ return logged(gameRef(gid).child('ans/'+FB.user.uid+'/'+r).set({c,at:serverTime()})); }
function logEnd(gid){ return logged(gameRef(gid).child('end').set(serverTime())); }

/* Offizielles Ergebnis abwarten und unter dem Duell anzeigen */
function showOfficialResult(gid,oppId,ranked){
  const ref=gameRef(gid).child('result');
  const line=t=>{ const el=document.getElementById('h2hLine'); if(el&&DUEL.reported===gid) el.textContent=t; };
  line('Wird auf dem Server gewertet …');
  const waiting=setTimeout(()=>line('Die Wertung dauert gerade länger. Rangliste und Bilanz werden gleich aktualisiert.'),20000);
  const onResult=async s=>{
    const res=s.val(); if(!res||res.status==='pending') return;
    ref.off('value',onResult); clearTimeout(waiting);
    if(res.status!=='ok'){ line('Dieses Duell konnte nicht gewertet werden.'); return; }
    const me=FB.user.uid, pts=res.points||{};
    try{ await ensureProfile(); SOC.h2h[oppId]=(await FB.db.ref('h2h/'+pairKey(me,oppId)).once('value')).val(); }catch(e){}
    const rc=record(oppId), rt=(res.ratings||{})[me];
    line(`Gewertet: Du ${pts[me]||0} : ${pts[oppId]||0} ${oppName()}`+(rc.games?` · Bilanz ${rc.w} : ${rc.l}${rc.d?` (${rc.d} unentschieden)`:''}`:''));
    // Ranked: offizielle Wertung vom Server anzeigen
    const box=document.querySelector('.rankchange');
    if(ranked&&box){
      if(rt){ const d=rt.after-rt.before, q=rt.provisional?'?':''; box.className='rankchange '+(d>=0?'up':'down'); box.innerHTML=`<span>Wertung</span><b>${rt.before} → ${rt.after}${q}</b><i>${d>=0?'+':''}${d}</i>`; }
      else box.innerHTML=`<span>${res.rankNote==='limit'?'Nicht gewertet: höchstens 3 Ranked-Spiele pro Tag gegen denselben Gegner.':'Nicht gewertet.'}</span>`;
    }
  };
  ref.on('value',onResult);
}
