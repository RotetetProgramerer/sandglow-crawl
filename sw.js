// Service worker: gjør at spillet kan spilles uten nett etter første besøk.
// Øk VERSION hver gang du publiserer en oppdatering, ellers får spillerne den gamle versjonen.
const VERSION='v27';
const CACHE='sandglow-'+VERSION;
const FILES=["./", "./index.html", "./css/style.css", "./js/core.js", "./js/props.js", "./js/props/_felles.js", "./js/props/tre-jungel.js", "./js/props/tre-by.js", "./js/props/palme.js", "./js/props/gran.js", "./js/props/kjempestamme.js", "./js/props/busk.js", "./js/props/bregne.js", "./js/props/lykt.js", "./js/skier.js", "./js/ski.js", "./js/skiresort.js", "./js/boatsim.js", "./js/boat.js", "./js/planesim.js", "./js/grottesim.js", "./js/plane.js", "./js/grotte.js", "./js/animals.js", "./js/savannedyr.js", "./js/orkendyr.js", "./js/ambience.js", "./js/map.js", "./js/game.js", "./js/carmodel.js", "./js/world.js", "./js/net.js", "./data/parts.js", "./data/cars.js", "./data/archipelago.js", "./data/boats.js", "./data/flights.js", "./data/vegetasjon.js", "./data/dyr.js", "./data/savanne.js", "./data/orken.js", "./data/grotte.js", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-512-maskable.png", "./data/levels/01-sand.js", "./data/levels/02-stein.js", "./data/levels/03-skog.js", "./data/levels/05-elv.js", "./data/levels/06-vulkan.js", "./data/levels/07-trinnvik.js", "./data/levels/08-gautefall.js", "./data/levels/09-kaiman.js", "./data/levels/10-verden.js", "./data/levels/11-savanne.js", "./data/levels/12-orken.js"];
// three.js fra CDN. Lagres ved installering, men en feil her skal ikke stoppe installeringen (den lagres da ved første bruk).
const CDN=["https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES).then(()=>c.addAll(CDN).catch(()=>{}))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(res=>{
    // three.js og skrifter fra CDN lagres også, så spillet virker uten nett
    const ok=res&&res.status===200&&(res.type==='basic'||res.type==='cors');
    if(ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}
    return res}).catch(()=>e.request.mode==='navigate'?caches.match('./index.html'):Response.error())));
});
