// Kjør:  node tools/test-grotte.js [bil] [v]
// Kjører Diamantgrotten (data/grotte.js) med en autopilot for hver bil, i Lett og Ekte modus, uten nettleser.
// Hver rad bør vise MÅL. «velt» og «juv» er hvor ofte bilen måtte tilbake til et sjekkpunkt, «bensin» er det minste som var igjen i tanken.
require('./sim-shim.js');
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..');
const load=f=>vm.runInThisContext(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
load('js/core.js');load('js/grottesim.js');load('data/parts.js');load('data/cars.js');load('data/grotte.js');
const only=process.argv[2],verbose=process.argv[3]==='v'||process.argv[2]==='v';
const cv=makeCave(GROTTE);
console.log('Diamantgrotten: lengde',cv.end.toFixed(0),'diamanter',cv.gems.length,'bensinkanner',cv.cans.length,'sjekkpunkter',cv.cps.length,'juv',cv.pits.length,'broer',cv.bridges.length);
// sanity: no diamond, can or checkpoint inside the rock, and room for the car under the ceiling everywhere
{const bad=[];for(const g of cv.gems)if(g.y<caveFloor(cv,g.x)+.2||g.y>caveCeil(cv,g.x)-.3)bad.push('diamant@'+g.x.toFixed(1));
  for(const c of cv.cans)if(c.y>caveCeil(cv,c.x)-.3)bad.push('kanne@'+c.x.toFixed(1));
  let low=1e9,lowX=0;for(let x=0;x<cv.end-1;x+=.25){const r=caveCeil(cv,x)-caveTop(cv,x);if(r<low){low=r;lowX=x}}
  console.log('Lavest under taket:',low.toFixed(2),'ved x',lowX.toFixed(1),bad.length?'  FEIL: '+bad.join(' '):'');}
// the autopilot: full gas on the ground unless the nose is coming up too far; in the air it turns the car to match the floor where it will land
function pilot(car){const top=x=>caveTop(cv,x),ahead=car.x+Math.max(.6,car.vx*.35),slope=Math.atan2(top(ahead+.6)-top(ahead-.6),1.2);
  const ground=car.wheels.some(w=>w.contact);let gas=1,brake=0;
  if(ground){const[r,f]=car.wheels;if(r.contact&&!f.contact&&car.w>.7){gas=0;brake=car.a>.9?1:0}   // a wheelie: let go before it goes over
    // slow down a little before a low ceiling with bumps, and on the way down steep hills
    const v=Math.hypot(car.vx,car.vy);if(v>3.4&&caveCeil(cv,car.x+2)-top(car.x+2)<3.4)gas=0}
  else{const land=car.x+car.vx*.45,want=Math.atan2(top(land+.6)-top(land-.6),1.2),err=want-car.a;const dw=err*5-car.w;if(dw>.4){gas=1;brake=0}else if(dw<-.4){gas=0;brake=1}else{gas=0;brake=0}}
  return{gas,brake}}
function run(cfg,assist,speed=1){const car=makeCaveCar(cfg,tuneFrom({}));car.assist=assist;car.speedScale=speed;placeCaveCar(car,cv,cv.start);const R=makeCaveRun(cv);
  let crashes=0,pits=0,flips=0,minFuel=1,cans=0,t=0,ok=false,stranded=false,stuck=0,lastX=car.x,lastT=0,ev=[],maxV=0,air=0,rev=0;
  for(let i=0;i<240*400;i++){let inp=pilot(car);if(rev>0){inp={gas:0,brake:1};rev-=GSTEP}
    stepCaveCar(car,inp,cv,GSTEP);t+=GSTEP;maxV=Math.max(maxV,car.vx);
    for(const e of car.ev){if(e.type==='crash'){crashes++;ev.push('velt@'+e.x.toFixed(1))}else if(e.type==='pit'){pits++;ev.push('juv@'+e.x.toFixed(1))}
      else if(e.type==='respawn'){placeCaveCar(car,cv,caveRespawnX(cv,R));car.fuel=Math.max(car.fuel,.35)}else if(e.type==='land'){air=Math.max(air,e.air);if(e.flips){flips+=e.flips;ev.push('salto@'+car.x.toFixed(1))}}}
    car.ev.length=0;
    for(const e of caveRunStep(R,car,cv,GSTEP)){if(e.type==='can')cans++;if(e.type==='end'){ok=true}if(e.type==='stranded')stranded=true}
    minFuel=Math.min(minFuel,car.fuel);if(ok||stranded)break;
    if(t-lastT>4){if(car.x-lastX<.5&&car.crashT===0){stuck++;ev.push('fast@'+car.x.toFixed(1));rev=.8}lastX=car.x;lastT=t}}
  console.log((cfg.id+(assist?' lett':' ekte')+(speed!==1?' '+Math.round(speed*100)+'%':'')).padEnd(16),ok?'MÅL ':stranded?'TOM ':'FEIL','tid',t.toFixed(0).padStart(3)+'s','x',R.far.toFixed(0).padStart(3),'diamanter',(R.got+'/'+cv.gems.length).padEnd(6),'velt',crashes,'juv',pits,'fast',stuck,'salto',flips,'bensin',minFuel.toFixed(2),'kanner',cans,'maksfart',maxV.toFixed(1),'lengste hopp',air.toFixed(2)+'s');
  if(verbose&&ev.length)console.log('   ',ev.join(' '))}
for(const cfg of CARS){if(only&&only!=='v'&&cfg.id!==only)continue;run(cfg,true);run(cfg,false)}
// the slowest speed limit in the menu (the cave never goes below 80 %) and the fastest
if(!only||only==='v'){run(CARS[0],true,.3);run(CARS[1],false,1.5)}
