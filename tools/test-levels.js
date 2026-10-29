// Kjør:  node tools/test-levels.js
// Laster spillets fysikk uten nettleser og lar en autopilot kjøre hver bane i begge gir.
// Bruk dette når du har laget en ny bane: alle rader bør vise "prog 0.99", "drown 0" og få velt.
require('./sim-shim.js');
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..');
const load=f=>vm.runInThisContext(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
load('js/core.js');load('js/props.js');
// elementene i js/props/, i samme rekkefølge som i index.html
for(const m of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="(js\/props\/[^"]+\.js)"/g))load(m[1]);
load('js/skier.js');load('data/parts.js');load('data/cars.js');load('data/vegetasjon.js');load('data/dyr.js');load('data/savanne.js');load('data/orken.js');
// same levels and order as the game: the <script> tags in index.html
const levelFiles=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="(data\/levels\/[^"]+\.js)"/g)].map(m=>m[1]);
for(const f of fs.readdirSync(path.join(root,'data/levels')).filter(f=>f.endsWith('.js')))if(!levelFiles.includes('data/levels/'+f))console.log('ADVARSEL: data/levels/'+f+' mangler i index.html og er ikke med i spillet');
levelFiles.forEach(load);
const dt=1/240,only=process.argv[2];
// CAR=<id> kjører testene med en annen bil enn Fjellrev, f.eks. CAR=knott node tools/test-levels.js
const TCAR=CARS.find(c=>c.id===process.env.CAR)||CARS[1];
// from the ferry deck, across the pier, through the village and up the road inland: the car must get out without falling or getting stuck
function villageTest(def,lv){const f=lv.ferry,car=makeCar(TCAR);car.assist=false;car.low=true;const head=Math.atan2(-f.dx,-f.dz);placeCar(car,f.x,f.z,head);car.pos.y=f.y+.5;
  const oa=(def.village.out??(f.dir/Math.PI*180+180))*Math.PI/180,ox=Math.cos(oa),oz=Math.sin(oa),goal={x:f.pad.x+ox*15,z:f.pad.z+oz*15};
  let best=1e9,fell=0,wp=0;const pts=[{x:f.pad.x+(f.quay.x-f.pad.x)*.5,z:f.pad.z+(f.quay.z-f.pad.z)*.5},{x:f.pad.x,z:f.pad.z},goal];
  for(let i=0;i<240*40;i++){const w=pts[wp],dx=w.x-car.pos.x,dz=w.z-car.pos.z,d=Math.hypot(dx,dz);if(d<1.2){wp++;if(wp>=pts.length)break;continue}
    const fw=car.fw,lf=car.lf,ang=Math.atan2(dx*lf.x+dz*lf.z,dx*fw.x+dz*fw.z);car.steer=Math.max(-.6,Math.min(.6,ang*1.5));car.throttle=1;stepCar(car,dt);
    if(car.depth>0)fell++;if(car.up.y<.2){console.log(def.id.padEnd(14),'LANDSBY  FEIL: velt ved',car.pos.x.toFixed(1),car.pos.z.toFixed(1));return}}
  const dg=Math.hypot(goal.x-car.pos.x,goal.z-car.pos.z);console.log(def.id.padEnd(14),'LANDSBY ',wp>=pts.length?'OK  ':'FEIL','ut av landsbyen'+(wp>=pts.length?'':' (stoppet '+dg.toFixed(1)+' fra målet ved '+car.pos.x.toFixed(1)+','+car.pos.z.toFixed(1)+')'),'vann',fell)}
// to the marina: along the level road that ends where the marina road starts, then the marina road, then onto the blue square
function marinaTest(def,lv){const m=lv.marinaDef,car=makeCar(TCAR);car.assist=false;car.low=true;
  const oa=(def.marina.out??(m.dir/Math.PI*180+180))*Math.PI/180,ox=Math.cos(oa),oz=Math.sin(oa),inland={x:m.x+ox*13,z:m.z+oz*13};
  const road=(def.roads||[]).find(r=>Math.hypot(r[r.length-1][0]-inland.x,r[r.length-1][1]-inland.z)<2),pts=[...(road||[]).slice(1).map(p=>({x:p[0],z:p[1]})),{x:m.x+ox*1.5,z:m.z+oz*1.5},m.ask];
  const from=road?{x:road[0][0],z:road[0][1]}:inland,nx=pts[0];placeCar(car,from.x,from.z,Math.atan2(nx.x-from.x,nx.z-from.z));for(let i=0;i<480;i++)stepCar(car,dt);
  let fell=0,wp=0,t=0;
  for(let i=0;i<240*60;i++){const w=pts[wp],dx=w.x-car.pos.x,dz=w.z-car.pos.z,d=Math.hypot(dx,dz);if(d<(wp===pts.length-1?.7:1.2)){wp++;if(wp>=pts.length){t=i*dt;break}continue}
    const fw=car.fw,lf=car.lf,ang=Math.atan2(dx*lf.x+dz*lf.z,dx*fw.x+dz*fw.z);car.steer=Math.max(-.6,Math.min(.6,ang*1.5));car.throttle=1;stepCar(car,dt);
    if(car.depth>0)fell++;if(car.up.y<.2){console.log(def.id.padEnd(14),'MARINA   FEIL: velt ved',car.pos.x.toFixed(1),car.pos.z.toFixed(1));return}}
  const ok=wp>=pts.length;console.log(def.id.padEnd(14),'MARINA  ',ok?'OK  ':'FEIL',(road?'veien og ':'')+'inn på den blå ruta'+(ok?' tid '+t.toFixed(0)+'s':' (stoppet ved '+car.pos.x.toFixed(1)+','+car.pos.z.toFixed(1)+')'),'vann',fell)}
// drives the road to the airport (Trinnvik) and onto its blue square: lv.airportDef.from, then .route
function airportTest(def,lv){const A=lv.airportDef,car=makeCar(TCAR);car.assist=false;car.low=true;const pts=A.route,nx=pts[0];placeCar(car,A.from.x,A.from.z,Math.atan2(nx.x-A.from.x,nx.z-A.from.z));for(let i=0;i<480;i++)stepCar(car,dt);
  let fell=0,wp=0,t=0;
  for(let i=0;i<240*60;i++){const w=pts[wp],dx=w.x-car.pos.x,dz=w.z-car.pos.z,d=Math.hypot(dx,dz);if(d<(wp===pts.length-1?.7:1.2)){wp++;if(wp>=pts.length){t=i*dt;break}continue}
    const fw=car.fw,lf=car.lf,ang=Math.atan2(dx*lf.x+dz*lf.z,dx*fw.x+dz*fw.z);car.steer=Math.max(-.6,Math.min(.6,ang*1.5));car.throttle=1;stepCar(car,dt);
    if(car.depth>0)fell++;if(car.up.y<.2){console.log(def.id.padEnd(14),'FLYPLASS FEIL: velt ved',car.pos.x.toFixed(1),car.pos.z.toFixed(1));return}}
  const ok=wp>=pts.length;console.log(def.id.padEnd(14),'FLYPLASS',ok?'OK  ':'FEIL','veien og inn på den blå ruta'+(ok?' tid '+t.toFixed(0)+'s':' (stoppet ved '+car.pos.x.toFixed(1)+','+car.pos.z.toFixed(1)+')'),'vann',fell)}
// Kameløya: from outside the slot, along it and into the cave mouth (lv.caveDef), then back out again from where the cave puts you
function caveTest(def,lv){const D=lv.caveDef,P=def.cavePath;if(!P)return;for(const back of[false,true]){const car=makeCar(TCAR);car.assist=false;car.low=true;
  let io=0;P.forEach((p,i)=>{if(Math.hypot(p[0]-D.out.x,p[1]-D.out.z)<Math.hypot(P[io][0]-D.out.x,P[io][1]-D.out.z))io=i});   // back out: the slot from where the cave puts you
  const pts=(back?P.slice(0,io).reverse():P.slice(1)).map(p=>({x:p[0],z:p[1]}));if(!back)pts.push(D.mouth);const from=back?D.out:{x:P[0][0],z:P[0][1]};
  placeCar(car,from.x,from.z,back?D.out.h:Math.atan2(pts[0].x-from.x,pts[0].z-from.z));for(let i=0;i<480;i++)stepCar(car,dt);let wp=0,t=0;
  for(let i=0;i<240*40;i++){const w=pts[wp],dx=w.x-car.pos.x,dz=w.z-car.pos.z,d=Math.hypot(dx,dz);if(d<(wp===pts.length-1?(back?1.2:D.r):1)){wp++;if(wp>=pts.length){t=i*dt;break}continue}
    const fw=car.fw,lf=car.lf,ang=Math.atan2(dx*lf.x+dz*lf.z,dx*fw.x+dz*fw.z);car.steer=Math.max(-.6,Math.min(.6,ang*1.5));car.throttle=1;stepCar(car,dt);
    if(car.up.y<.2){console.log(def.id.padEnd(14),'GROTTE   FEIL: velt ved',car.pos.x.toFixed(1),car.pos.z.toFixed(1));break}}
  const ok=wp>=pts.length;console.log(def.id.padEnd(14),'GROTTE  ',ok?'OK  ':'FEIL',back?'ut av kløfta':'gjennom kløfta og inn i grotteåpningen',ok?'tid '+t.toFixed(0)+'s':'(stoppet ved '+car.pos.x.toFixed(1)+','+car.pos.z.toFixed(1)+')')}}
// skis one piste with an autopilot: aims a little way down the line, brakes above a target speed, never spins in the air
const SKI_TARGET={fri:4,slalom:4.2,utfor:8.5,hopp:7.5};
function skiTest(def,lv,k){const s=makeSkier(),run=makeSkiRun(k),tgt=SKI_TARGET[k.kind]||5;placeSkier(s,k.start.p.x,k.start.p.z,Math.atan2(k.start.tan.x,k.start.tan.z));
  let pt=0,t=0,crashes=0,ev=[],jumps=[],maxHard=0,stuck=0,lastPt=0,maxV=0,landN=0;const prev={x:0,z:0},cur={x:0,z:0};
  for(let i=0;i<240*120&&!run.done;i++){
    let best=1e9,bt=pt;for(let j=0;j<=60;j++){const tt=Math.min(1,pt+j*.002),q=k.P(tt),d=Math.hypot(q.x-s.pos.x,q.z-s.pos.z);if(d<best){best=d;bt=tt}}pt=bt;
    // aim at the next gate centre when it is close (slalom), otherwise a point down the line
    const look=Math.min(.06,1.4/k.len*(1+s.speed*.35));let tg=k.P(Math.min(1,pt+look));const g=k.gates[run.next];if(g&&!g.finish&&(k.kind==='slalom'||Math.hypot(g.c.x-s.pos.x,g.c.z-s.pos.z)<2.2+s.speed*.25))tg=g.c;
    let err=Math.atan2(tg.x-s.pos.x,tg.z-s.pos.z)-s.head;err=Math.atan2(Math.sin(err),Math.cos(err));
    // slow down before tight turns: how much the line turns over the next few units
    const a0=k.T(pt),a1=k.T(Math.min(1,pt+3/k.len)),bend=Math.acos(Math.max(-1,Math.min(1,a0.x*a1.x+a0.z*a1.z))),want=Math.min(tgt,1.8+4.5*(1-bend/2.2));
    const inp={steer:s.air?0:Math.max(-1,Math.min(1,err*2.2)),gas:s.speed<1.2?1:0,brake:s.speed>want+.3?1:0,jump:false};
    prev.x=s.pos.x;prev.z=s.pos.z;stepSkier(s,inp,dt);cur.x=s.pos.x;cur.z=s.pos.z;t+=dt;maxV=Math.max(maxV,s.speed);
    for(const e of s.ev){if(e.type==='crash'){crashes++;ev.push(e.why+'@'+s.pos.x.toFixed(1)+','+s.pos.z.toFixed(1))}if(e.type==='land'){maxHard=Math.max(maxHard,e.hard);if(e.air>.35)jumps.push(e.air.toFixed(2))}}s.ev.length=0;
    if(s.crashT>1.2){placeSkier(s,run.cp.x,run.cp.z,run.cp.h)}
    skiGates(run,prev,cur).forEach(e=>{if(e.type==='miss')ev.push('bom'+(e.i+1))});
    if(i%1200===0&&i>0){if(pt-lastPt<.005){stuck++;ev.push('fast@'+s.pos.x.toFixed(1)+','+s.pos.z.toFixed(1));const q=k.P(Math.min(1,pt+.03)),tn=k.T(Math.min(1,pt+.03));placeSkier(s,q.x,q.z,Math.atan2(tn.x,tn.z))}lastPt=pt}}
  console.log((def.id+'/ski-'+k.id).padEnd(22),run.done?'MÅL ':'FEIL','tid',t.toFixed(1)+'s','porter',run.passed+'/'+(k.gates.length-1),'bom',run.missed,'kræsj',crashes,'fast',stuck,'maksfart',maxV.toFixed(1),'hopp',jumps.join(',')||'-','hardeste landing',maxHard.toFixed(1),'lengde',k.len.toFixed(0));
  if(process.argv[3]==='v'&&ev.length)console.log('   hendelser:',ev.join(' '))}
// drives one line (a level, or one course inside an open world) in both gears
function drive(def,lv,line,label){
  for(const low of[true,false]){
    const car=makeCar(TCAR);car.assist=false;car.low=low;const s=line.start;placeCar(car,s.p.x,s.p.z,Math.atan2(s.tan.x,s.tan.z));
    for(let i=0;i<480;i++)stepCar(car,dt);
    let pt=0,flips=0,maxDepth=-9,flood=0,drown=0,lava=0,gT={},evs=[],t=0,stuck=0,lastProg=0,jumps=0,air=0;
    for(let i=0;i<240*160;i++){
      let best=1e9,bt=pt;for(let k=0;k<=60;k++){const tt=Math.min(1,pt+k*.002),p=line.P(tt),d=Math.hypot(p.x-car.pos.x,p.z-car.pos.z);if(d<best){best=d;bt=tt}}pt=bt;
      const tg=line.P(Math.min(1,pt+.012)),dx=tg.x-car.pos.x,dz=tg.z-car.pos.z,fw=car.fw,lf=car.lf,ang=Math.atan2(dx*lf.x+dz*lf.z,dx*fw.x+dz*fw.z);
      car.steer=Math.max(-.6,Math.min(.6,ang*1.5));car.throttle=1;stepCar(car,dt);
      if(!isFinite(car.pos.x)){console.log(def.id,'FEIL: fysikken eksploderte');break}
      maxDepth=Math.max(maxDepth,car.depth);if(car.depth>car.tune.wade)flood+=dt;else flood=Math.max(0,flood-dt*2);
      {const ll=lavaAt(car.pos.x,car.pos.z);if(ll>-1e8&&car.pos.y<ll+.12){lava++;evs.push('lava@'+car.pos.x.toFixed(1)+','+car.pos.z.toFixed(1));const p=line.P(Math.min(1,pt+.02)),tn=line.T(Math.min(1,pt+.02));placeCar(car,p.x,p.z,Math.atan2(tn.x,tn.z))}}
      line.gates.forEach((g,gi)=>{if(gT[gi]===undefined&&pt>=g.t)gT[gi]=i*dt});
      if(flood>1.4){drown++;flood=0;const p=line.P(Math.min(1,pt+.02)),tn=line.T(Math.min(1,pt+.02));placeCar(car,p.x,p.z,Math.atan2(tn.x,tn.z))}
      if(car.wheels.every(w=>!w.contact)&&car.pos.y>H(car.pos.x,car.pos.z)+.3)air+=dt;else{if(air>.32)jumps++;air=0}
      if(car.up.y<.2){flips++;evs.push('velt@'+car.pos.x.toFixed(1)+','+car.pos.z.toFixed(1));placeCar(car,car.pos.x,car.pos.z,Math.atan2(fw.x,fw.z))}
      if(i>0&&i%2400===0){if(pt-lastProg<.004){stuck++;evs.push('fast@'+car.pos.x.toFixed(1)+','+car.pos.z.toFixed(1));const p=line.P(Math.min(1,pt+.02)),tn=line.T(Math.min(1,pt+.02));placeCar(car,p.x,p.z,Math.atan2(tn.x,tn.z))}lastProg=pt}
      if(pt>.985){t=i*dt;break}
    }
    console.log(label.padEnd(14),low?'LAV ':'HØY ','prog',pt.toFixed(2),'tid',(t||0).toFixed(0).padStart(3)+'s','velt',flips,'fast',stuck,'maksDybde',maxDepth.toFixed(2),'drown',drown,'lava',lava,'hopp',jumps,'kasser',line.crates.length);
    if(process.argv[3]==='v'&&evs.length)console.log('   hendelser:',evs.join(' '));
    if(def.shortcutGates){const[a,b]=def.shortcutGates;if(gT[a]!==undefined&&gT[b]!==undefined)console.log('   hovedrute mellom port',a+1,'og',b+1,':',(gT[b]-gT[a]).toFixed(1)+'s')}
  }
}
for(const def of LEVELS){
  if(only&&def.id!==only)continue;
  const lv=genLevel(def);
  if(lv.ferry)villageTest(def,lv);
  if(lv.marinaDef)marinaTest(def,lv);
  if(lv.airportDef)airportTest(def,lv);
  if(lv.caveDef)caveTest(def,lv);
  for(const k of(lv.pistes||[]))skiTest(def,lv,k);
  if(def.world){for(const k of lv.courses)drive(def,lv,k,def.id+'/'+k.id);continue}   // an open world: every course on its own
  drive(def,lv,lv,def.id);

  // snarvei: kjører hvert punkt i def.shortcut (første og siste punkt er på hovedveien)
  if(def.shortcut){
    for(const low of[true,false]){
      const car=makeCar(TCAR);car.assist=false;car.low=low;const sp=def.shortcut,a=sp[0],b=sp[1];placeCar(car,a[0],a[1],Math.atan2(b[0]-a[0],b[1]-a[1]));
      for(let i=0;i<480;i++)stepCar(car,dt);
      let wi=1,flips=0,lava=0,t=0,ok=false;
      for(let i=0;i<240*90;i++){
        const w=sp[wi],dx=w[0]-car.pos.x,dz=w[1]-car.pos.z;if(Math.hypot(dx,dz)<(wi===sp.length-1?1.8:.9)){wi++;if(wi>=sp.length){t=i*dt;ok=true;break}continue}
        const fw=car.fw,lf=car.lf,ang=Math.atan2(dx*lf.x+dz*lf.z,dx*fw.x+dz*fw.z);car.steer=Math.max(-.6,Math.min(.6,ang*1.5));car.throttle=1;stepCar(car,dt);
        const ll=lavaAt(car.pos.x,car.pos.z);if(ll>-1e8&&car.pos.y<ll+.12){lava++;break}
        if(car.up.y<.2){flips++;break}
      }
      console.log(def.id.padEnd(8),'SNARVEI',low?'LAV ':'HØY ',ok?'OK  tid '+t.toFixed(0)+'s':'FEIL',wi+'/'+sp.length,'lava',lava,'velt',flips);
    }
  }
}
