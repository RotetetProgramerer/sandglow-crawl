'use strict';
/* =================================================================
   PLANESIM: the small plane from Trinnvik airport, in fixed 60 Hz steps (BSTEP, js/boatsim.js). No DOM, no three.js,
   so tools/test-flights.js can fly it in node. The same sea and scale as the boat race: north is −z, heading a=0 is north
   and a grows to the left, pitch p > 0 is nose up, roll r > 0 is the left wing down.
   On the ground: gas = full throttle, rev = brake, steer = the nose wheel. Fast enough and still on the gas, it lifts off.
   In the air: gas = climb, rev = dive, steer = bank and turn, jump = full power. The engine holds the cruise speed by itself;
   climbing costs speed and diving gains it. Touch down gently (wings level, slow sink) and it rolls; anything harder is a crash.
   W.ground(x,z) → {h, water, runway}: the top of whatever is under the plane (the browser asks the island meshes, the test a sketch).
   ================================================================= */
const PCFG={cruise:2.3,turbo:3.4,lift:1.7,stall:1.2,accel:.03,brake:.05,roll:.004,pitchRate:.016,pitchMax:.5,pitchMin:-.65,bankMax:.95,bankRate:.07,turn:.03,taxiTurn:.025,
  gear:3.2,ceil:900,sinkOk:.9,crashFrames:110,ringR:30,kts:16};
function makePlane(x,y,z,a){return{x,y,z,a,p:0,r:0,s:0,vy:0,ground:true,crash:0,crashes:0,ring:0,done:false,air:0,ev:[]}}
const pClamp=(v,a,b)=>v<a?a:v>b?b:v;
function stepPlane(pl,inp,W){const C=pl.cfg||PCFG;
  if(pl.crash>0){pl.crash--;if(!pl.crash)pl.ev.push({type:'respawn'});return}
  const gas=pClamp(inp.gas||0,0,1),rev=pClamp(inp.rev||0,0,1),steer=pClamp(inp.steer||0,-1,1);
  if(pl.ground){
    // rolling: throttle and brake, the nose wheel, and the nose comes up once it is fast enough
    const g0=W.ground(pl.x,pl.z);
    if(gas>0)pl.s+=C.accel*gas*(1-pl.s/C.turbo);pl.s-=rev?C.brake*rev:C.roll;if(pl.s<0)pl.s=0;
    pl.a+=steer*C.taxiTurn*Math.min(1,.35+pl.s/1.2);pl.r*=.8;
    pl.p+=((gas>0&&pl.s>C.lift*.85?.14:0)-pl.p)*.08;
    pl.x+=-Math.sin(pl.a)*pl.s;pl.z+=-Math.cos(pl.a)*pl.s;
    const g=W.ground(pl.x,pl.z);
    if(g.water||g.h>g0.h+1.5){pl.ev.push({type:'crash',water:g.water});pl.crash=C.crashFrames;pl.crashes++;pl.s=0;return}   // off the edge, or into something
    pl.y=g.h+C.gear;pl.vy=0;
    if(gas>0&&pl.s>C.lift&&pl.p>.1){pl.ground=false;pl.vy=.3;pl.ev.push({type:'takeoff'})}
    return}
  // flying
  pl.air++;
  const want=gas-rev;pl.p+=want*C.pitchRate;if(!want)pl.p*=.985;
  if(pl.s<C.stall)pl.p-=.012;                                   // too slow: the nose drops
  pl.p=pClamp(pl.p,C.pitchMin,pl.s<C.lift?.22:C.pitchMax);   // and it will not climb steeply until it has speed
  pl.r+=(steer*C.bankMax-pl.r)*C.bankRate;
  pl.a+=Math.sin(pl.r)*C.turn*Math.min(1,pl.s/C.cruise);
  const target=inp.jump?C.turbo:C.cruise;pl.s+=(target-pl.s)*.012-Math.sin(pl.p)*.018;pl.s=pClamp(pl.s,.6,C.turbo+1);
  const cp=Math.cos(pl.p),sink=Math.max(0,C.lift-pl.s)*.5;pl.vy=Math.sin(pl.p)*pl.s-sink;
  pl.x+=-Math.sin(pl.a)*cp*pl.s;pl.z+=-Math.cos(pl.a)*cp*pl.s;pl.y+=pl.vy;
  if(pl.y>C.ceil){pl.y=C.ceil;if(pl.p>0)pl.p*=.9}
  // the edge of the sea: the plane is turned back towards the islands
  const B=W.bound-60;if(Math.abs(pl.x)>B||Math.abs(pl.z)>B){pl.x=pClamp(pl.x,-B,B);pl.z=pClamp(pl.z,-B,B);const home=Math.atan2(pl.x,pl.z);pl.a+=Math.max(-.05,Math.min(.05,bWrap(home-pl.a)));if(!pl.edgeT)pl.ev.push({type:'edge'});pl.edgeT=60}
  if(pl.edgeT)pl.edgeT--;
  const g=W.ground(pl.x,pl.z);
  if(pl.y-C.gear<=g.h){
    if(!g.water&&pl.vy>-C.sinkOk&&Math.abs(pl.r)<.4&&pl.p>-.2&&pl.p<.4){pl.ground=true;pl.y=g.h+C.gear;pl.p=0;pl.vy=0;pl.ev.push({type:'land',runway:!!g.runway})}
    else{pl.ev.push({type:'crash',water:g.water});pl.crash=C.crashFrames;pl.crashes++;pl.y=g.h+1}}}
// the rings of a flight: fly through them in order; the last one is the finish
function planeRing(pl,course){if(pl.done||pl.crash||pl.ring>=course.rings.length)return null;const q=course.rings[pl.ring];
  if(Math.hypot(pl.x-q.x,pl.y-q.y,pl.z-q.z)>PCFG.ringR)return null;pl.ring++;if(pl.ring>=course.rings.length){pl.done=true;return{type:'finish'}}return{type:'ring',i:pl.ring-1}}
// the airport at sea: AIRPORT (data/flights.js) moved out to where Trinnvik lies
let AIRSEA=null;
function airSea(){if(AIRSEA)return AIRSEA;const I=seaIslands().find(i=>i.id===AIRPORT.island),A=AIRPORT,o=(p)=>({x:I.x+p[0],z:I.z+p[1]});
  AIRSEA={island:I,land:{x0:I.x+A.land.x0,x1:I.x+A.land.x1,z0:I.z+A.land.z0,z1:I.z+A.land.z1},rwy:{x0:I.x+A.rwy.x-A.rwy.w/2,x1:I.x+A.rwy.x+A.rwy.w/2,z0:I.z+A.rwy.z0,z1:I.z+A.rwy.z1,x:I.x+A.rwy.x},
    top:8,start:{x:I.x+A.rwy.x,y:8+PCFG.gear,z:I.z+A.start.dz,a:0},hangar:o(A.hangar),tower:o(A.tower),terminal:o(A.terminal),sock:o(A.sock)};return AIRSEA}
/* ---------- the cargo plane and the airports of every island ---------- */
// The cargo plane: heavier than the small plane, a longer roll, wider turns. Its measures are the island model's (js/cargo.js) times CARGO_SEA.
const CARGO_SEA=5.9,PCARGO=Object.assign({},PCFG,{cruise:2.6,turbo:3.3,lift:1.9,stall:1.35,accel:.027,brake:.07,pitchRate:.012,pitchMax:.42,pitchMin:-.5,bankMax:.75,bankRate:.05,turn:.024,taxiTurn:.02,
  gear:2*CARGO_SEA,sinkOk:1.05,kts:24});
// Every island's airport at sea: the fill lies off the coast where the island's own airport is (def.airport in data/levels/, Trinnvik's is AIRPORT in data/flights.js),
// the runway along the coast. h is the way the cargo plane takes off (and the way to land), start is where it stands ready. On the islands +x is west and +z north; at sea +x is east and −z north.
let SEA_AIR=null;
function seaAirports(){if(SEA_AIR)return SEA_AIR;const L=[];
  for(const I of seaIslands()){const def=typeof LEVELS!=='undefined'&&LEVELS.find(l=>l.id===I.id);let A=null;
    if(I.id===AIRPORT.island){const T=airSea(),R=T.rwy,Ld=T.land;A={cx:R.x,cz:(R.z0+R.z1)/2,hx:0,hz:-1,hl:(R.z1-R.z0)/2,hw:(R.x1-R.x0)/2,lx:(Ld.x0+Ld.x1)/2,lz:(Ld.z0+Ld.z1)/2,ll:(Ld.z1-Ld.z0)/2,ld:(Ld.x1-Ld.x0)/2,own:true}}
    else if(def&&def.airport){const o=def.airport,a=(o.dir??Math.atan2(o.at[1],o.at[0])/Math.PI*180)*Math.PI/180,dx=-Math.cos(a),dz=-Math.sin(a),E=o.end??1,hx=-E*Math.sin(a),hz=E*Math.cos(a),r=I.r+28;
      A={cx:I.x+dx*(r+8),cz:I.z+dz*(r+8),hx,hz,hl:150,hw:15,lx:I.x+dx*r,lz:I.z+dz*r,ll:160,ld:38}}
    if(!A)continue;A.id=I.id;A.name=I.name;A.island=I;A.top=8;A.a=Math.atan2(-A.hx,-A.hz);
    A.start={x:A.cx-A.hx*(A.hl-50),y:A.top+PCARGO.gear,z:A.cz-A.hz*(A.hl-50),a:A.a};L.push(A)}
  return SEA_AIR=L}
const seaAirport=id=>seaAirports().find(A=>A.id===id);
const airIn=(x,z,cx,cz,A,hl,hw)=>{const rx=x-cx,rz=z-cz;return Math.abs(rx*A.hx+rz*A.hz)<=hl&&Math.abs(rx*A.hz-rz*A.hx)<=hw};
// the airport whose runway (or, with fill=true, whose whole fill) lies under this point
function airportAt(x,z,fill){for(const A of seaAirports())if(fill?airIn(x,z,A.lx,A.lz,A,A.ll,A.ld):airIn(x,z,A.cx,A.cz,A,A.hl,A.hw))return A;return null}
const onRunway=(x,z)=>!!airportAt(x,z);
// the cargo plane ready on an airport's runway, and where a landing begins: `out` behind the threshold, in line with the runway
function makeCargo(A){const s=A.start,pl=makePlane(s.x,s.y,s.z,s.a);pl.cfg=PCARGO;return pl}
const cargoApproach=(A,out=700,up=110)=>({x:A.cx-A.hx*(A.hl+out),y:A.top+up,z:A.cz-A.hz*(A.hl+out),a:A.a});
// the best way in to an airport: from the end with the longest straight approach that stays inside the sea and clear of every island.
// (x,y,z) is where the final approach begins, `out` from the threshold (tx,tz); (hx,hz) and a are the way you land.
function cargoFinal(B){if(B._fin)return B._fin;let best=null;
  for(const sg of[1,-1]){const hx=B.hx*sg,hz=B.hz*sg,tx=B.cx-hx*B.hl,tz=B.cz-hz*B.hl,lim=SEA.bound-330;let o=900;
    for(;o>=300;o-=50){const fx=tx-hx*o,fz=tz-hz*o;if(Math.abs(fx)>lim||Math.abs(fz)>lim)continue;let ok=true;
      for(const I of seaIslands()){const ax=I.x-fx,az=I.z-fz,u=Math.max(0,Math.min(o,ax*hx+az*hz));if(Math.hypot(ax-hx*u,az-hz*u)<I.r+(I.id===B.id?0:10)){ok=false;break}}
      if(ok)break}
    if(o<300)o=0;if(!best||o>best.out+100)best={out:o,hx,hz,a:Math.atan2(-hx,-hz),tx,tz,x:tx-hx*o,z:tz-hz*o,y:B.top+20+o*.09}}
  return B._fin=best}
// where a landed plane has come to: the airport it stands on, or the airport of the island it has put down on
function cargoWhere(x,z){const A=airportAt(x,z,true);if(A)return A;for(const I of seaIslands())if(Math.hypot(x-I.x,z-I.z)<I.r+20){const B=seaAirport(I.id);if(B)return B}return null}
// a flight from data/flights.js with its rings turned to face the way through (yaw), and where you start: lined up on the runway
function flightRoute(f){const st=airSea().start,pts=[{x:st.x,y:st.y,z:st.z}];const rings=(f?f.rings:[]).map(([x,y,z])=>({x,y,z}));
  rings.forEach((q,i)=>{const a=i?rings[i-1]:pts[0],b=rings[i+1]||q;const dx=(b===q?q.x-a.x:b.x-a.x),dz=(b===q?q.z-a.z:b.z-a.z);q.yaw=Math.atan2(dx,dz)});
  return{flight:f,rings,start:st}}
