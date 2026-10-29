// Kjør:  node tools/test-flights.js            (alle flyturene)
//        node tools/test-flights.js vulkan v   (én tur, med hendelser)
// Laster flyfysikken uten nettleser og lar en autopilot ta av fra Trinnvik og fly hver tur gjennom ringene.
// Bakken er en skisse av øyene (en kjegle eller et platå per øy, flyplassen på fyllingen), så ringene og etappene sjekkes mot den med god margin.
// Bruk dette når du har flyttet ringer i data/flights.js.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..');
const load=f=>vm.runInThisContext(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
global.LEVELS=[];load('data/archipelago.js');load('data/boats.js');load('data/flights.js');load('js/boatsim.js');load('js/planesim.js');
const only=process.argv[2],verbose=process.argv[3]==='v';
const isl=seaIslands(),A=airSea();
// how high the islands reach (roughly the tallest thing on each, as js/boat.js draws them) and how far out
const TOP={tromoya:190,vulkan:190,vinter:165,by:125,sand:40,stein:90,skog:70,elv:40,skilso:100,savanne:60,orken:70};
function ground(x,z){let h=2,water=true;
  for(const I of isl){const d=Math.hypot(x-I.x,z-I.z);if(d<I.r){water=false;h=Math.max(h,8+(TOP[I.look]-8)*Math.max(0,1-d/I.r)*1.2)}}
  const L=A.land;if(x>=L.x0&&x<=L.x1&&z>=L.z0&&z<=L.z1){water=false;h=Math.max(h,A.top)}
  return{h:Math.min(h,water?2:1e9),water,runway:onRunway(x,z)}}
// the airport strip itself is flat: the sketch of Trinnvik must not stand on it
function groundAt(x,z){if(onRunway(x,z))return{h:A.top,water:false,runway:true};return ground(x,z)}
const W={ground:groundAt,bound:SEA.bound};
function checkRoute(f,route){const bad=[];let prev=route.start;
  route.rings.forEach((q,i)=>{const g=ground(q.x,q.z);if(q.y-g.h<45)bad.push('ring '+(i+1)+' er bare '+(q.y-g.h).toFixed(0)+' over bakken');
    for(let k=1;k<20;k++){const u=k/20,x=prev.x+(q.x-prev.x)*u,z=prev.z+(q.z-prev.z)*u,y=prev.y+(q.y-prev.y)*u,gg=ground(x,z);if(i&&y-gg.h<25){bad.push('etappe '+(i+1)+' går '+(y-gg.h).toFixed(0)+' over bakken');break}}
    if(Math.abs(q.x)>SEA.bound-150||Math.abs(q.z)>SEA.bound-150)bad.push('ring '+(i+1)+' er for nær kanten');prev=q});
  const len=route.rings.reduce((s,q,i,R)=>s+Math.hypot(q.x-(i?R[i-1].x:route.start.x),q.z-(i?R[i-1].z:route.start.z)),0);
  console.log(f.id.padEnd(9),'RUTE   ',bad.length?'FEIL '+bad.join(', '):'OK  ','lengde',len.toFixed(0),'ringer',route.rings.length);return!bad.length}
// the autopilot: full gas down the runway, then bank towards the next ring and pitch towards its height
function pilot(pl,route,turbo){if(pl.ground)return{gas:1,rev:0,steer:0,jump:false};const q=route.rings[Math.min(pl.ring,route.rings.length-1)],dx=q.x-pl.x,dz=q.z-pl.z,hd=Math.hypot(dx,dz);
  const err=bWrap(bAng(dx,dz)-pl.a),steer=pClamp(err*2.2,-1,1),want=Math.atan2(q.y-pl.y,Math.max(40,hd)),pe=want-pl.p;
  return{gas:pe>0?Math.min(1,pe*8):0,rev:pe<0?Math.min(1,-pe*8):0,steer,jump:turbo}}
function run(f,route,turbo){const s=route.start,pl=makePlane(s.x,s.y,s.z,s.a);let t=0,take=null;const ev=[],ringT=[];
  for(;t<60*300&&!pl.done;t++){const inp=pilot(pl,route,turbo);stepPlane(pl,inp,W);const e=planeRing(pl,route);if(e)ringT.push((t/60).toFixed(1));
    for(const x of pl.ev){if(x.type==='takeoff'&&take==null)take=t/60;if(x.type==='crash')ev.push('krasj@'+pl.x.toFixed(0)+','+pl.y.toFixed(0)+','+pl.z.toFixed(0));if(x.type==='respawn'){const r=route.rings[pl.ring-1]||null;if(r){pl.x=r.x;pl.y=r.y;pl.z=r.z;pl.ground=false;pl.s=PCFG.cruise}else{pl.x=s.x;pl.y=s.y;pl.z=s.z;pl.a=s.a;pl.ground=true;pl.s=0}pl.p=pl.r=0}}pl.ev.length=0}
  return{done:pl.done,time:t/60,take,crashes:pl.crashes,ev,ringT}}
let fail=0;
for(const f of FLIGHTS){if(only&&f.id!==only)continue;const route=flightRoute(f);if(!checkRoute(f,route))fail++;
  for(const turbo of[false,true]){const r=run(f,route,turbo);console.log(f.id.padEnd(9),turbo?'TURBO  ':'CRUISE ',r.done?'MÅL ':'FEIL','tid',r.time.toFixed(1)+'s','tok av',r.take!=null?r.take.toFixed(1)+'s':'-','krasj',r.crashes,'ringer',r.ringT.join(' '),'par',f.par.join('/'));
    if(!r.done||r.crashes)fail++;if(verbose&&r.ev.length)console.log('   hendelser:',r.ev.join(' '))}}
// takeoff and landing on the runway: out to the north, round to the south, and a long straight final approach northwards
{const s=A.start,R=A.rwy,pl=makePlane(s.x,s.y,s.z,s.a),G=A.top+PCFG.gear;let landed=null,t=0,wp=0;
  const WP=[[R.x,120,R.z0-350],[R.x-300,110,(R.z0+R.z1)/2],[R.x,80,R.z1+750],[R.x,G-4,R.z1-60]];
  for(;t<60*150&&!landed;t++){let inp;
    if(pl.ground)inp={gas:pl.air?0:1,rev:pl.air?1:0,steer:0};
    else{const q=WP[wp],dx=q[0]-pl.x,dz=q[2]-pl.z,hd=Math.hypot(dx,dz);if(wp<WP.length-1&&hd<60)wp++;
      const err=bWrap(bAng(dx,dz)-pl.a),want=Math.max(-.13,Math.atan2(q[1]-pl.y,Math.max(60,hd))),pe=want-pl.p;
      inp={gas:pe>0?Math.min(1,pe*6):0,rev:pe<0?Math.min(1,-pe*6):0,steer:pClamp(err*2,-1,1)}}
    stepPlane(pl,inp,W);for(const e of pl.ev)if(e.type==='land'){landed=e;if(verbose)console.log('   landet ved',pl.x.toFixed(0),pl.z.toFixed(0),'fart',pl.s.toFixed(2),'rullebanen',JSON.stringify(A.rwy))}pl.ev.length=0}
  console.log('rullebane','LANDING',landed&&landed.runway?'OK  ':'FEIL',landed?(landed.runway?'på rullebanen':'utenfor rullebanen')+' etter '+(t/60).toFixed(0)+'s':'kom ikke ned (punkt '+wp+')','krasj',pl.crashes);if(!(landed&&landed.runway&&!pl.crashes))fail++}
if(fail)process.exitCode=1;
