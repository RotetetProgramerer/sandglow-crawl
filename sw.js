// Service worker: gjør at spillet kan spilles uten nett etter første besøk.
// Filene fra siden hentes alltid fra nettet først (lagret kopi bare uten nett), så spillerne får nye versjoner med en gang.
// Øk VERSION hver gang du publiserer en oppdatering: da lastes alle filene inn på nytt, og åpne faner lastes om.
const VERSION='v28';
const CACHE='sandglow-'+VERSION;
const FILES=["./", "./index.html", "./css/style.css", "./js/core.js", "./js/props.js", "./js/props/_felles.js", "./js/props/tre-jungel.js", "./js/props/tre-by.js", "./js/props/palme.js", "./js/props/gran.js", "./js/props/kjempestamme.js", "./js/props/busk.js", "./js/props/bregne.js", "./js/props/lykt.js", "./js/skier.js", "./js/ski.js", "./js/skiresort.js", "./js/boatsim.js", "./js/boat.js", "./js/planesim.js", "./js/grottesim.js", "./js/plane.js", "./js/grotte.js", "./js/animals.js", "./js/savannedyr.js", "./js/orkendyr.js", "./js/ambience.js", "./js/map.js", "./js/game.js", "./js/carmodel.js", "./js/world.js", "./js/net.js", "./data/parts.js", "./data/cars.js", "./data/archipelago.js", "./data/boats.js", "./data/flights.js", "./data/vegetasjon.js", "./data/dyr.js", "./data/savanne.js", "./data/orken.js", "./data/grotte.js", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-512-maskable.png", "./data/levels/01-sand.js", "./data/levels/02-stein.js", "./data/levels/03-skog.js", "./data/levels/05-elv.js", "./data/levels/06-vulkan.js", "./data/levels/07-trinnvik.js", "./data/levels/08-gautefall.js", "./data/levels/09-kaiman.js", "./data/levels/10-verden.js", "./data/levels/11-savanne.js", "./data/levels/12-orken.js"];
// three.js fra CDN. Lagres ved installering, men en feil her skal ikke stoppe installeringen (den lagres da ved første bruk).
const CDN=["https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"];
// cache:'reload' går forbi nettleserens egen mellomlagring, så den nye versjonen ikke blandes med gamle filer
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:'reload'}))).then(()=>c.addAll(CDN).catch(()=>{}))).then(()=>self.skipWaiting()))});
// ved en oppdatering (det fantes en eldre versjon) lastes åpne faner inn på nytt, så de ikke kjører den gamle versjonen.
// navigate ventes ikke på: den nye siden hentes gjennom denne workeren, som først må bli ferdig aktivert.
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>{const old=ks.filter(k=>k!==CACHE&&k.startsWith('sandglow-'));
  return Promise.all(old.map(k=>caches.delete(k))).then(()=>self.clients.claim()).then(()=>{if(old.length)self.clients.matchAll({type:'window'}).then(cs=>cs.forEach(c=>c.navigate(c.url).catch(()=>{})))})}))});
const save=(req,res)=>{const ok=res&&res.status===200&&(res.type==='basic'||res.type==='cors');if(ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}return res};
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const same=new URL(e.request.url).origin===self.location.origin;
  // filene fra siden: nettet først (no-cache spør serveren om filen er endret), den lagrede kopien uten nett
  if(same)e.respondWith((e.request.mode==='navigate'?fetch(e.request):fetch(e.request,{cache:'no-cache'})).then(res=>save(e.request,res))
    .catch(()=>caches.match(e.request).then(hit=>hit||(e.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
  // three.js og skrifter fra CDN endrer seg ikke: den lagrede kopien først, så spillet virker uten nett
  else e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(res=>save(e.request,res))));
});
