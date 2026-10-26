// Offline-Speicher: Seite, Icons und Abbildungen werden beim ersten Öffnen gesichert.
// CACHE und FILES setzt build.py; ein neuer Build ergibt einen neuen Cache-Namen, der alte wird gelöscht.
const CACHE='{{CACHE}}';
const FILES={{FILES}};
self.addEventListener('install',e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin) return;
  const put=(req,res)=>{ const c=res.clone(); caches.open(CACHE).then(x=>x.put(req,c)); return res; };
  // Seite und Konfiguration: zuerst aus dem Netz (damit Updates ankommen), offline aus dem Speicher
  if(e.request.mode==='navigate'||u.pathname.endsWith('.html')||u.pathname.endsWith('firebase-config.js')){
    e.respondWith(fetch(e.request).then(r=>put(e.request,r)).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));
    return;
  }
  // Alles andere (Bilder, Icons): zuerst aus dem Speicher
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>put(e.request,n))));
});
