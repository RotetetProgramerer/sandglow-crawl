// Kjør:  node tools/test-gps.js [øy] [v]
// Lager GPS-ruter (js/gpsroute.js) fra kaia og fra startstedet til alle stedene på hver øy, og lar en autopilot kjøre hver rute i begge gir.
// Alle rader bør vise FRAMME, helst med velt 0, fast 0 og drown 0. HØY starter i høyt gir og girer ned i bratte bakker, som en spiller.
// CAR=<id> kjører med en annen bil (standard: Fjellrev).
require('./sim-shim.js');
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..');
const load=f=>vm.runInThisContext(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
load('js/core.js');load('js/props.js');
for(const m of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="(js\/props\/[^"]+\.js)"/g))load(m[1]);
load('js/skier.js');load('js/gpsroute.js');load('data/parts.js');load('data/cars.js');load('data/vegetasjon.js');load('data/dyr.js');load('data/savanne.js');load('data/orken.js');
const levelFiles=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="(data\/levels\/[^"]+\.js)"/g)].map(m=>m[1]);
levelFiles.forEach(load);
const dt=1/240,only=process.argv[2],verbose=process.argv[3]==='v'||process.argv[2]==='v';
const TCAR=CARS.find(c=>c.id===process.env.CAR)||CARS[1];
// follows the route like a player following the arrow: aims at a point a little way ahead on the line, full throttle, but slows down before sharp bends
function follow(route,place,from,low){
  const car=makeCar(TCAR);car.assist=false;car.low=low;const P=route.pts,a=P[Math.min(P.length-1,3)];placeCar(car,from.x,from.z,Math.atan2(a.x-from.x,a.z-from.z));for(let i=0;i<240;i++)stepCar(car,dt);
  let pi=0,flips=0,stuck=0,drown=0,flood=0,maxDepth=-9,lastS=0,ev=[],slowT=0,shifts=0;
  for(let i=0;i<240*120;i++){
    if(Math.hypot(place.x-car.pos.x,place.z-car.pos.z)<place.r||pi>=P.length-2)return{ok:true,t:i*dt,flips,stuck,drown,maxDepth,ev,shifts};
    let bd=1e9,bi=pi;for(let k=Math.max(0,pi-6);k<Math.min(P.length,pi+40);k++){const d=Math.hypot(P[k].x-car.pos.x,P[k].z-car.pos.z);if(d<bd){bd=d;bi=k}}pi=bi;
    const tg=P[Math.min(P.length-1,pi+3)],dx=tg.x-car.pos.x,dz=tg.z-car.pos.z,fw=car.fw,lf=car.lf,ang=Math.atan2(dx*lf.x+dz*lf.z,dx*fw.x+dz*fw.z);
    const ahead=(m)=>{const a=P[Math.min(P.length-1,pi+m)],b=P[Math.min(P.length-1,pi+m+2)];return Math.atan2(b.x-a.x,b.z-a.z)};let bend=0;
    for(let m=2;m<=10;m+=2){let b=ahead(m)-ahead(0);b=Math.abs(Math.atan2(Math.sin(b),Math.cos(b)));if(b>bend)bend=b}
    const want=Math.max(1.6,5.6-bend*4.5),v=car.vel.dot(car.fw);
    car.steer=Math.max(-.6,Math.min(.6,ang*1.5));car.throttle=v>want+.4?-.4:v>want?0:1;
    // a player in high gear shifts down when a hill stops the car, and up again once it rolls
    if(!low){if(!car.low&&v<.35)slowT+=dt;else slowT=0;if(slowT>1){car.low=true;slowT=0;shifts++}if(car.low&&(car.fw.y<.05||v>1.5))car.low=false}
    stepCar(car,dt);
    if(!isFinite(car.pos.x))return{ok:false,why:'fysikken eksploderte',flips,stuck,drown,maxDepth,ev};
    maxDepth=Math.max(maxDepth,car.depth);if(car.depth>car.tune.wade)flood+=dt;else flood=Math.max(0,flood-dt*2);
    const back=()=>{const q=P[Math.min(P.length-1,pi+2)],n=P[Math.min(P.length-1,pi+4)];placeCar(car,q.x,q.z,Math.atan2(n.x-q.x,n.z-q.z))};
    if(flood>1.4){drown++;flood=0;ev.push('druknet@'+car.pos.x.toFixed(1)+','+car.pos.z.toFixed(1));back()}
    if(car.up.y<.2){flips++;ev.push('velt@'+car.pos.x.toFixed(1)+','+car.pos.z.toFixed(1));placeCar(car,car.pos.x,car.pos.z,Math.atan2(fw.x,fw.z))}
    if(i>0&&i%2400===0){if(P[pi].s-lastS<.4){stuck++;ev.push('fast@'+car.pos.x.toFixed(1)+','+car.pos.z.toFixed(1));back()}lastS=P[pi].s}
  }
  return{ok:false,why:'tiden gikk ut',flips,stuck,drown,maxDepth,ev}}
let fails=0,n=0;
for(const def of LEVELS){
  if(only&&only!=='v'&&def.id!==only)continue;if(!(def.world||def.village))continue;
  const lv=genLevel(def),t0=Date.now(),gr=gpsGrid(lv),tg=Date.now()-t0,places=gpsPlaces(def,lv,{cave:true});
  const starts=[{name:'kaia',x:lv.ferry.pad.x,z:lv.ferry.pad.z},{name:'start',x:lv.start.p.x,z:lv.start.p.z}];
  console.log(def.id.padEnd(10),'rutenett',tg+'ms,',places.length,'steder');
  for(const st of starts)for(const pl of places){if(Math.hypot(pl.x-st.x,pl.z-st.z)<pl.r+1)continue;
    const t1=Date.now(),route=gpsRoute(gr,st.x,st.z,pl.x,pl.z,pl.area),tr=Date.now()-t1;
    if(!route){console.log('  ',(st.name+' → '+pl.name).padEnd(30),'INGEN RUTE');fails++;continue}
    for(const low of[true,false]){const r=follow(route,pl,st,low);n++;if(!r.ok||r.flips||r.stuck||r.drown)fails++;
      if(!verbose&&r.ok&&!r.flips&&!r.stuck&&!r.drown)continue;
      console.log('  ',(st.name+' → '+pl.name).padEnd(30),low?'LAV':'HØY',r.ok?'FRAMME':'FEIL  ','lengde',route.len.toFixed(0).padStart(3),route.short?'(så nær det går)':'',r.ok?'tid '+r.t.toFixed(0)+'s':r.why,
        'velt',r.flips,'fast',r.stuck,low?'':'girte ned '+(r.shifts||0),'drown',r.drown,'maksDybde',r.maxDepth.toFixed(2),'beregnet på',tr+'ms');
      if(r.ev.length)console.log('      hendelser:',r.ev.join(' '))}}}
console.log(n,'turer,',fails,'med feil');
