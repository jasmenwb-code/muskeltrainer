// Offline-Speicher: App und Abbildungen werden beim ersten Öffnen gesichert
const CACHE='anatomyduel-7887d2c2';
const FILES=['./', 'index.html', 'firebase-config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'img/p01a.webp', 'img/p01b.webp', 'img/p02.webp', 'img/p03.webp', 'img/p04a.webp', 'img/p04b.webp', 'img/p04c.webp', 'img/p05a.webp', 'img/p05b.webp', 'img/p06.webp', 'img/p07.webp', 'img/p08.webp', 'img/p09.webp', 'img/p10.webp', 'img/p11.webp', 'img/p12.webp', 'img/p13.webp', 'img/p14.webp', 'img/p15.webp', 'img/p16.webp', 'img/p18.webp', 'img/p19.webp', 'img/p20.webp', 'img/p21.webp', 'img/p22.webp', 'img/p23.webp', 'img/p24.webp', 'img/p25.webp', 'img/p26.webp', 'img/p27.webp', 'img/p28.webp', 'img/p29.webp', 'img/p30.webp', 'img/p31.webp', 'img/p32.webp', 'img/p33.webp', 'img/p34.webp'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin) return;
  if(e.request.mode==='navigate'||u.pathname.endsWith('.html')||u.pathname.endsWith('firebase-config.js')){
    e.respondWith(fetch(e.request).then(r=>{ const c=r.clone(); caches.open(CACHE).then(x=>x.put(e.request,c)); return r; }).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{ const c=n.clone(); caches.open(CACHE).then(x=>x.put(e.request,c)); return n; })));
});
