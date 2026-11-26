// Kjør:  node tools/test-flights.js            (alle flyturene)
//        node tools/test-flights.js vulkan v   (én tur, med hendelser)
//        node tools/test-flights.js last       (bare lasteflyet mellom øyene)
// Laster flyfysikken uten nettleser og lar en autopilot ta av fra Trinnvik og fly hver tur gjennom ringene.
// Til slutt flyr autopiloten lasteflyet fra hver øys flyplass til alle de andre og lander der.
// Bakken er en skisse av øyene (en kjegle eller et platå per øy, flyplassen på fyllingen), så ringene og etappene sjekkes mot den med god margin.
// Bruk dette når du har flyttet ringer i data/flights.js.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..');
const load=f=>vm.runInThisContext(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
require('./sim-shim.js');load('js/core.js');load('js/props.js');load('data/vegetasjon.js');load('data/dyr.js');load('data/savanne.js');load('data/orken.js');
// the islands themselves (only their airport: where it lies and which way the cargo plane stands), in the order of index.html
for(const m of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="(data\/levels\/[^"]+\.js)"/g))load(m[1]);
load('data/archipelago.js');load('data/boats.js');load('data/flights.js');load('js/boatsim.js');load('js/planesim.js');
const only=process.argv[2],verbose=process.argv[3]==='v';
const isl=seaIslands(),A=airSea();
// how high the islands reach (roughly the tallest thing on each, as js/boat.js draws them) and how far out
const TOP={tromoya:190,vulkan:190,vinter:165,by:125,sand:40,stein:90,skog:70,elv:40,skilso:100,savanne:60,orken:70,svalbard:60,pirat:75};
function ground(x,z){let h=2,water=true;
  for(const I of isl){const d=Math.hypot(x-I.x,z-I.z);if(d<I.r){water=false;h=Math.max(h,8+(TOP[I.look]-8)*Math.max(0,1-d/I.r)*1.2)}}
  const L=A.land;if(x>=L.x0&&x<=L.x1&&z>=L.z0&&z<=L.z1){water=false;h=Math.max(h,A.top)}
  return{h:Math.min(h,water?2:1e9),water,runway:onRunway(x,z)}}
// the airports' fills are flat: the sketch of the island must not stand on them
function groundAt(x,z){const F=airportAt(x,z,true);if(F)return{h:F.top,water:false,runway:onRunway(x,z)};return ground(x,z)}
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
// ---------- the cargo plane: from every island's airport to every other one ----------
// node tools/test-flights.js last          (bare lasteflyet)      node tools/test-flights.js last sand v   (bare fra Bykkevika, med hendelser)
{const AP=seaAirports(),from=process.argv[2]==='last'&&process.argv[3]!=='v'?process.argv[3]:null,vb=process.argv.includes('v');
  // the final approach of an airport from one end (sg=1: the way the plane takes off, −1: the other way): as far out as the sea and the other islands allow
  const side=(B,sg)=>sg>0?B:Object.assign({},B,{hx:-B.hx,hz:-B.hz,a:B.a+Math.PI});
  const clear=(B,o)=>{const q=cargoApproach(B,o,80),lim=SEA.bound-330;if(Math.abs(q.x)>lim||Math.abs(q.z)>lim)return false;
    for(let k=0;k<=30;k++){const u=k/30,x=q.x+(B.cx-B.hx*B.hl-q.x)*u,z=q.z+(B.cz-B.hz*B.hl-q.z)*u,y=q.y+(B.top+12-q.y)*u,g=groundAt(x,z);if(!g.water&&y-g.h<25&&!airportAt(x,z,true))return false}return true};
  const out=B=>{for(let o=900;o>=300;o-=50)if(clear(B,o))return o;return 0};
  const CR=330;   // above every island
  // the autopilot: full gas down the runway, climb, across the sea high up, then a landing round like a real one: along the runway on the sea side the wrong way (downwind),
  // round onto the centre line where the final approach begins (the further off the line, the sharper towards it), down a steady slope once it is lined up,
  // level out just over the runway, brake. It lands from the end with the longest free approach. Not lined up by the threshold: round again.
    // the landing round of an airport from one end: W1 → W2 on the sea side, then the turn onto the final at `far`. Free of islands?
  const round=(B,o)=>{const far=cargoApproach(B,o,80),nx=B.hz,nz=-B.hx,sg=((B.cx-B.island.x)*nx+(B.cz-B.island.z)*nz)>0?1:-1,W2={x:far.x+nx*sg*340+B.hx*120,z:far.z+nz*sg*340+B.hz*120},W1={x:W2.x+B.hx*650,z:W2.z+B.hz*650};
    const O=q=>({x:q.x+nx*sg*300,z:q.z+nz*sg*300});   // the turn onto the downwind leg swings wide
    let free=o>=500;[[W1,W2],[W2,{x:far.x-B.hx*200,z:far.z-B.hz*200}],[W2,far],[O(W1),O(W2)]].forEach(([P,Q],i)=>{for(let k=0;k<=20;k++){const x=P.x+(Q.x-P.x)*k/20,z=P.z+(Q.z-P.z)*k/20,g=groundAt(x,z);if(!g.water&&g.h>far.y-35)free=false;if(i<3&&(Math.abs(x)>SEA.bound-70||Math.abs(z)>SEA.bound-70))free=false}});
    return{far,W1,W2,free,o}};
  const best=B=>{const m=out(B);for(let o=m;o>=500;o-=50){const r=round(B,o);if(r.free)return r}return round(B,m)};
  const pick=B0=>{const a=best(B0),B1=side(B0,-1),b=best(B1);return b.free&&(!a.free||b.o>a.o+100)?[B1,b]:[B0,a]};
  for(const B of AP){const o=out(B),o2=out(side(B,-1)),bad=[];if(Math.max(o,o2)<600)bad.push('innflygingen er bare '+Math.max(o,o2)+' lang');
    for(let d=0;d<=700;d+=25){const x=B.cx+B.hx*(B.hl+d),z=B.cz+B.hz*(B.hl+d),y=B.top+d*.16,g=groundAt(x,z);if(y-g.h<8&&!airportAt(x,z,true)){bad.push('utflygingen går '+(y-g.h).toFixed(0)+' over bakken ved '+x.toFixed(0)+','+z.toFixed(0));break}}
    for(const C of AP)if(C!==B&&Math.hypot(C.lx-B.lx,C.lz-B.lz)<C.ll+B.ll)bad.push('ligger for nær '+C.id);
    if(!cargoWhere(B.start.x,B.start.z)||cargoWhere(B.start.x,B.start.z).id!==B.id)bad.push('flyet står ikke på sin egen flyplass');
    if(!pick(B)[1].free)bad.push('ingen fri landingsrunde');
    {const F=cargoFinal(B);if(F.out<500||!clear(side(B,F.hx===B.hx&&F.hz===B.hz?1:-1),F.out))bad.push('innflygingen spillet viser (cargoFinal, '+F.out+') er ikke fri')}
    if(!from||from===B.id)console.log(B.id.padEnd(9),'FLYPLASS',bad.length?'FEIL '+bad.join(', '):'OK  ','rullebane mot',((Math.round(-B.a*180/Math.PI)%360+360)%360)+'°','innflyging',o,'motsatt vei',o2,'· lander mot',((Math.round(-pick(B)[0].a*180/Math.PI)%360+360)%360)+'° fra',pick(B)[1].o);if(bad.length)fail++}
  function fly(A,B0){const pl=makeCargo(A),[B,RD]=pick(B0),o=Math.max(500,RD.o),far=cargoApproach(B,o,80),G=B.top+PCARGO.gear,W1=RD.W1,W2=RD.W2;
    let t=0,mode=0,wp=0,take=null,landed=null,roll=0,rounds=0;const ev=[];
    for(;t<60*400;t++){let inp;
      if(pl.ground){if(!pl.air){inp={gas:1,rev:0,steer:0};roll+=pl.s}else{inp={gas:0,rev:1,steer:0};if(pl.s<.02)break}}
      else{let head,ty,slope=0;const rx=pl.x-B.cx,rz=pl.z-B.cz,al=rx*B.hx+rz*B.hz,lat=rx*B.hz-rz*B.hx;
        if(mode===0){const q=wp?W2:W1,dx=q.x-pl.x,dz=q.z-pl.z,hd=Math.hypot(dx,dz);head=bAng(dx,dz);ty=wp?far.y:hd<700?far.y+40:CR;if(!rounds&&!wp&&pl.y<250&&pl.air<420)head=pl.a;   // straight ahead until it is over the hills
          if(hd<(wp?110:170)){if(wp)mode=1;else wp=1}}
        if(mode===1){head=B.a-pClamp(lat*.005,-1.1,1.1);const lined=Math.abs(lat)<34&&Math.abs(bWrap(B.a-pl.a))<.3,d=-B.hl+50-al;
          ty=lined&&d<o?(d>0?G-2+d*(far.y-G)/o:G-6):far.y;slope=lined&&d<o&&d>0?-(far.y-G)/o:0;if(al>40){mode=0;wp=0;rounds++}}
        if(process.env.TR&&B.id===process.env.TR&&t%30===0&&t<60*70)console.log(t,'mode',mode,wp,'al',al.toFixed(0),'lat',lat.toFixed(0),'da',bWrap(B.a-pl.a).toFixed(2),'y',pl.y.toFixed(0),'ty',ty.toFixed(0),'p',pl.p.toFixed(2),'s',pl.s.toFixed(2));
        const err=bWrap(head-pl.a),hgt=pl.y-G;let want=ty>pl.y+25?.3:Math.max(-.19,Math.min(.3,slope+(ty-pl.y)/(slope?60:150)));if(mode===1&&hgt<12&&ty<pl.y)want=Math.max(want,-.05);const pe=want-pl.p;
        inp={gas:pe>0?Math.min(1,pe*6):0,rev:pe<0?Math.min(1,-pe*6):0,steer:pClamp(err*2,-1,1)}}
      const pre=vb&&from?[pl.x.toFixed(0),pl.y.toFixed(1),pl.z.toFixed(0),'p',pl.p.toFixed(2),'r',pl.r.toFixed(2),'vy',pl.vy.toFixed(2),'s',pl.s.toFixed(2),'mode',mode].join(' '):'';stepPlane(pl,inp,W);
      for(const e of pl.ev){if(pre&&e.type==='crash')ev.push('['+pre+']');if(e.type==='takeoff'&&take==null)take=t/60;if(e.type==='land')landed=e;if(e.type==='crash')ev.push('krasj@'+pl.x.toFixed(0)+','+pl.y.toFixed(0)+','+pl.z.toFixed(0)+(mode?' på finalen':''));if(e.type==='edge')ev.push('kanten@'+pl.x.toFixed(0)+','+pl.z.toFixed(0))}
      pl.ev.length=0;if(pl.crashes)break}
    if(rounds)ev.push('runder '+rounds);
    const at=landed&&!pl.crashes?cargoWhere(pl.x,pl.z):null;return{ok:!!(at&&at.id===B.id&&landed.runway&&pl.s<.02),time:t/60,take,roll,crashes:pl.crashes,ev,at:at?at.id:'-',rwy:!!(landed&&landed.runway)}}
  let n=0,bad=0,tmax=0,rmax=0;
  for(const A of AP){if(from&&A.id!==from)continue;let row=[];for(const B of AP){if(A===B)continue;const r=fly(A,B);n++;tmax=Math.max(tmax,r.time);rmax=Math.max(rmax,r.roll);row.push(B.id+(r.ok?' '+r.time.toFixed(0)+'s':' FEIL'));
      if(!r.ok){bad++;console.log(A.id.padEnd(9),'→',B.id.padEnd(9),'FEIL',r.crashes?'krasj':r.rwy?'landet på '+r.at:'landet ikke på rullebanen','tid',r.time.toFixed(0)+'s',r.ev.join(' '))}else if(vb&&r.ev.length)console.log('   ',A.id,'→',B.id,r.ev.join(' '))}
    console.log(A.id.padEnd(9),'LASTEFLY',row.join(' · '))}
  console.log('lastefly ',n,'turer,',bad,'med feil · lengste tur',tmax.toFixed(0)+'s · lengste rullestrekning',rmax.toFixed(0));if(bad)fail++
  // the landing help (cargoAssist): into the way in to every airport from the side, askew, too high or too low, and then hands off (slipp). From where a landing is
  // within reach it must put the plane down on its airport; from anywhere it must never crash or land somewhere else (it may fly on over the runway: round again).
  // The same with a pilot who steers the wrong way now and then and dives the last bit (vill): no crash on the way in (steered far off it and into a hillside is the pilot's own doing). And one who climbs away (bort): the help must let go.
  {let m=0,hb=0,on=0,away=0;const drop=(B,F,o,lat,da,dy,who)=>{const pl=makeCargo(B);pl.ground=false;pl.air=1;pl.s=PCARGO.cruise;pl.x=F.tx-F.hx*o+F.hz*lat;pl.z=F.tz-F.hz*o-F.hx*lat;pl.y=B.top+PCARGO.gear+o*.1+dy;pl.a=F.a+da;
      let landed=null,helped=0,t=0,past=false;for(;t<60*60;t++){let inp=pl.ground?{gas:0,rev:1,steer:0}:who==='bort'?{gas:1,rev:0,steer:0}:who==='vill'?{gas:0,rev:pl.y-B.top-PCARGO.gear<40?1:0,steer:t%240<60?(lat>0?1:-1):0}:{gas:0,rev:0,steer:0};
        const h=cargoAssist(pl,inp,B,W);if(h){inp=h;helped++}else if(helped&&!pl.ground&&who!=='bort'){past=true;break}   // let go in the air: the pilot takes over
        stepPlane(pl,inp,W);for(const e of pl.ev)if(e.type==='land')landed=e;pl.ev.length=0;if(pl.crashes||pl.ground&&pl.s<.02||pl.y>B.top+400)break}
      const at=landed&&!pl.crashes?cargoWhere(pl.x,pl.z):null;return{ok:!!(at&&at.id===B.id),crash:pl.crashes,past,helped,up:pl.y>B.top+400,pl,side:Math.abs((pl.x-F.tx)*F.hz-(pl.z-F.tz)*F.hx)}};
    for(const B of AP){if(from&&B.id!==from)continue;const F=cargoFinal(B);
      for(const who of['slipp','vill'])for(const o of[F.out,F.out*.6,300])for(const lat of[-150,-60,0,60,150])for(const da of[-.4,0,.4])for(const dy of[-25,0,25]){if(Math.abs(lat)>80+o*.4)continue;{const g=groundAt(F.tx-F.hx*o+F.hz*lat,F.tz-F.hz*o-F.hx*lat);if(!g.water&&g.h>B.top+o*.1+dy-30)continue}m++;   // (not from inside a hill)
       const r=drop(B,F,o,lat,da,dy,who);
        const must=who==='slipp'&&Math.abs(lat)<=30+o*.12,good=r.ok||!must&&!r.crash&&(r.past||!r.helped)||who==='vill'&&r.side>100;if(r.ok)on++;
        if(!good){hb++;if(hb<12)console.log(B.id.padEnd(9),'HJELP FEIL',who,'ut',o,'side',lat,'skjev',da,'høyde',dy,r.crash?'krasj':r.past?'fløy forbi':'landet ikke på flyplassen','ved',r.pl.x.toFixed(0),r.pl.y.toFixed(0),r.pl.z.toFixed(0),'hjulpet',r.helped)}}
      const r=drop(B,F,F.out*.6,0,0,0,'bort');if(!r.up){away++;console.log(B.id.padEnd(9),'HJELP FEIL: slipper ikke taket når du stiger')}}
    console.log('landingshjelp',m,'innflyginger,',on,'landet,',hb,'med feil',away?'· '+away+' slapp ikke':'');if(hb||away)fail++}}
if(fail)process.exitCode=1;
