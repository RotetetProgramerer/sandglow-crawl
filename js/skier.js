'use strict';
/* =================================================================
   SKIER: the alpine skier's physics (no DOM). The skier is a point on the snow with a heading (the skis): gravity pulls
   down the fall line, the edges hold sideways and turn the speed with the skis, snow and air brake. Steer smoothly and the
   skis carve on their edges and keep the speed; steer harder than the skis can bend and the tails skid, scrape and brake.
   In the air the skier flies and can spin; a landing with the skis a bit across, or a bit hard, makes the skier wobble,
   a landing well across the way or very hard is a crash.
   Used by js/ski.js in the game and by tools/test-levels.js, where an autopilot skis every piste.
   ================================================================= */
const SKI_G=7,SKI_R=.2,SKI_OLLIE=2.0,SKI_POP=1.5;   // a bit less gravity than the car gets: the skier floats longer in the air and the runs last longer
// how the skis glide: [friction (part of g), edge grip sideways (per second)]. Groomed snow (TG) glides best, deep snow off the piste brakes.
function skiGlide(surf,groomed){
  if(surf===S.ICE)return[.015,2.4];
  if(surf===S.SNOW)return groomed?[.03,9]:[.07,6];
  if(surf===S.WOOD)return[.25,9];
  return[.5,10]}   // gravel, rock, asphalt …: the skis stop
const groomedAt=(x,z)=>{let i=Math.round((x+HALF)/CELL),j=Math.round((z+HALF)/CELL);if(i<0||j<0||i>=N||j>=N)return false;return TG[j*N+i]===1};
// the kicker under the skier, if any: a = how far past the lip (negative on the ramp)
function skiKickerAt(x,z,vx,vz){for(const k of(G.pistes||[]))for(const q of k.kickers){const rx=x-q.x,rz=z-q.z,a=rx*q.tx+rz*q.tz,b=Math.abs(rx*q.tz-rz*q.tx);
  if(a>-q.len-.2&&a<.25&&b<q.w+.2&&vx*q.tx+vz*q.tz>0)return{q,a}}return null}
// edge: how far the skis are tipped (0–1); carve: 1 when the edges hold, 0 when the skis skid; inc: how far the skier leans into the turn
// (radians, + to the left); hock: a hockey stop (−1…1, the side the skis swing to); wob: wobbling after a landing; pole: the pole push (0–1);
// flat: 1 on flat ground (where the skier skates)
function makeSkier(){return{pos:new V3(),vel:new V3(),vy:0,head:0,air:false,airT:0,spin:0,spinV:0,crashT:0,why:'',land:0,tuck:0,plow:0,skid:0,surf:S.SNOW,groomed:true,speed:0,
  edge:0,carve:0,inc:0,hock:0,wob:0,wobT:0,pole:0,poleK:0,flat:0,dir:0,ev:[]}}
function placeSkier(s,x,z,head){s.pos.set(x,H(x,z),z);s.vel.set(0,0,0);s.vy=0;s.head=head;s.air=false;s.airT=0;s.spin=0;s.spinV=0;s.crashT=0;s.why='';s.land=0;s.tuck=0;s.plow=0;s.skid=0;s.speed=0;
  s.edge=0;s.carve=0;s.inc=0;s.hock=0;s.wob=0;s.wobT=0;s.pole=0;s.poleK=0;s.flat=0;s.dir=head}
function skiCrash(s,why){if(s.crashT>0)return;s.crashT=1e-4;s.why=why;s.air=false;s.ev.push({type:'crash',why})}
const _sn=new V3(),wrapA=a=>Math.atan2(Math.sin(a),Math.cos(a));
// inp = {steer:-1…1 (left +), gas:0…1 (pole and skate on the flat, tuck when fast), brake:0…1 (snowplough; with hard steering a hockey stop), jump:true once}
// o.assist: the easy mode: a speed limit, softer landings. o.tricks: spinning in the air is wanted (Big Jumps); without it the easy mode does not
// spin on short hops (a child holding a turn over a bump) and straightens the skis enough at the landing that it is a wobble at most, not a fall
function stepSkier(s,inp,dt,o={}){
  const p=s.pos,v=s.vel;
  if(s.crashT>0){   // tumbling: the skier slides to a stop, then the game puts them back
    s.crashT+=dt;const sp=Math.hypot(v.x,v.z),k=sp>1e-3?Math.max(0,sp-7*dt)/sp:0;v.x*=k;v.z*=k;p.x+=v.x*dt;p.z+=v.z*dt;p.y=H(p.x,p.z);s.speed=sp*k;s.inc*=1-Math.min(1,dt*6);return}
  if(!s.air){
    normalAt(p.x,p.z,_sn);const surf=surfAt(p.x,p.z),gr=groomedAt(p.x,p.z),[mu,grip]=skiGlide(surf,gr),deep=surf===S.SNOW&&!gr;s.surf=surf;s.groomed=gr;
    let sp=Math.hypot(v.x,v.z);
    const dx=Math.sin(s.head),dz=Math.cos(s.head),px=dz,pz=-dx;
    s.flat=1-smt01((Math.abs(_sn.x*dx+_sn.z*dz)-.04)/.1);
    // tuck when fast, snowplough on the brake; brake and steer hard at speed and the skis swing across: a hockey stop
    const hk=inp.brake>.3&&Math.abs(inp.steer)>.5&&sp>2.2;
    s.tuck+=((inp.gas>.3&&sp>3.2?1:0)-s.tuck)*Math.min(1,dt*6);s.plow+=((inp.brake>.3&&!hk?1:0)-s.plow)*Math.min(1,dt*8);
    s.hock+=((hk?Math.sign(inp.steer):0)-s.hock)*Math.min(1,dt*(hk?7:4));const ah=Math.abs(s.hock);
    // turning: quick when slow, wider when fast, in a tuck, in deep snow and while wobbling
    const turn=2.9/(1+sp*.045)*(1-.35*s.tuck)*(deep?.8:1)*(1-.4*s.wob),w=inp.steer*turn;s.head+=w*dt;
    if(s.wob>0){s.wobT+=dt;s.head+=Math.sin(s.wobT*15)*2.2*s.wob*dt;s.wob=Math.max(0,s.wob-dt*1.4)}
    // the edges: steady steering tips the skis further. The sidecut bends a tipped ski round a radius (shorter the more it is tipped):
    // turn no faster than that and the edges carve, turn faster and the tails skid
    s.edge+=(Math.min(1,Math.abs(inp.steer))*(1-ah)-s.edge)*Math.min(1,dt*5);
    const wc=sp/(1.6+3.4*(1-s.edge)),cv=sp<1.5||surf!==S.SNOW||deep||ah>.3?0:Math.max(0,Math.min(1,(wc*1.25-Math.abs(w))/(wc*.5+.2)));s.carve+=(cv-s.carve)*Math.min(1,dt*10);
    // gravity down the fall line
    v.x+=SKI_G*_sn.y*_sn.x*dt;v.z+=SKI_G*_sn.y*_sn.z*dt;
    // speed sideways to the skis is held by the edges: carving turns nearly all of it into speed along the skis, skidding loses most of it.
    // The edges hold only so much sideways pull (a little on ice): turn too hard for the speed and the skis slide out of the turn
    let va=v.x*dx+v.z*dz,vl=v.x*px+v.z*pz;
    const g2=grip*(sp<1?.4:1)*(1+.5*s.carve)*(1-.4*s.wob),hold=SKI_G*(surf===S.ICE?.38:surf===S.SNOW?(deep?.8:1.2+.3*s.carve):.9)*(1-.3*s.wob)*dt;
    let dvl=vl*(1-Math.exp(-g2*dt)),slide=0;if(Math.abs(dvl)>hold){slide=1-hold/Math.abs(dvl);dvl=Math.sign(dvl)*hold}
    const vl2=vl-dvl,lost=Math.abs(vl)-Math.abs(vl2);va+=(va<0?-1:1)*lost*(.35+.55*s.carve);vl=vl2;s.skid=Math.abs(vl);if(slide>.2)s.carve*=1-Math.min(1,dt*12);
    // pole (and skate) on the flat: the push comes in strokes, with the same speed on average as a steady push
    const poling=inp.gas>0&&va<3.2&&va>-.5;if(poling&&s.poleK<.1)s.pole=.22;s.poleK+=((poling?1:0)-s.poleK)*Math.min(1,dt*8);
    if(poling){const ph0=s.pole;s.pole=(s.pole+dt*1.7)%1;if(ph0<.3&&s.pole>=.3)s.ev.push({type:'pole'});const ph=s.pole;if(ph>.3&&ph<.65)va+=2.6*inp.gas*Math.PI/.7*Math.sin(Math.PI*(ph-.3)/.35)*dt}
    v.x=dx*va+px*vl;v.z=dz*va+pz*vl;sp=Math.hypot(v.x,v.z);
    // friction, air (much less in a tuck), deep snow, the snowplough and the hockey stop brake along the way you move
    let dec=mu*SKI_G*_sn.y+(.088-.052*s.tuck)*sp*sp+(deep?.06*sp:0)+s.plow*(sp<4?4.5:6.5)+ah*(sp<3?5:8.5);
    if(o.assist&&sp>6.2)dec+=(sp-6.2)*4;
    if(sp>1e-4){const k=Math.max(0,sp-dec*dt)/sp;v.x*=k;v.z*=k;sp*=k}
    if((surf===S.ROCK||surf===S.GRAVEL||surf===S.ASPHALT)&&sp>4.5){skiCrash(s,surf===S.ROCK?'Over steinene':'Skiene stoppet');return}
    // wobbling: let the skis get too far across the way you move and you lose your balance
    if(s.wob>0&&sp>2.5&&Math.abs(wrapA(s.head-Math.atan2(v.x,v.z)))>1.1){skiCrash(s,'Mistet balansen');return}
    // move along the ground; leave it where it drops away faster than the skier falls (a lip, a knuckle)
    const nx=p.x+v.x*dt,nz=p.z+v.z*dt,h0=p.y,h1=H(nx,nz),run=Math.hypot(nx-p.x,nz-p.z);
    if(run>1e-5&&(h1-h0)/run>1.1){   // a wall of snow or a rock face: stop, and fall if fast
      if(sp>3.5){skiCrash(s,'Rett i en kant');return}v.x*=-.2;v.z*=-.2;s.vy=0;return}
    const yb=h0+s.vy*dt-.5*SKI_G*dt*dt;
    // jump: a little hop anywhere; just before the lip of a kicker it is a pop that sends you much higher
    if(inp.jump&&sp>.5){const kk=skiKickerAt(p.x,p.z,v.x,v.z),pop=!!kk&&kk.a>-.55&&kk.a<.1;s.air=true;s.airT=0;s.spin=0;s.spinV=0;s.vy=Math.max(s.vy,0)+SKI_OLLIE+(pop?SKI_POP:0);p.x=nx;p.z=nz;p.y=h0+s.vy*dt;s.ev.push({type:'takeoff',pop,kick:!!kk})}
    else if(yb>h1+.012&&s.vy>-sp*1.5){s.air=true;s.airT=0;s.spin=0;s.spinV=0;s.vy-=SKI_G*dt;p.x=nx;p.z=nz;p.y=yb;s.ev.push({type:'takeoff',kick:!!skiKickerAt(p.x,p.z,v.x,v.z)})}
    else{s.vy=Math.min((h1-h0)/dt,sp*.9);p.x=nx;p.z=nz;p.y=h1}
    s.land=Math.max(0,s.land-dt*3);
    // the lean into the turn follows the sideways pull (v × how fast the way you move turns)
    const nd=Math.atan2(v.x,v.z);if(sp>.5){const lat=sp*wrapA(nd-s.dir)/dt,ti=Math.max(-1,Math.min(1,Math.atan(lat/SKI_G)));s.inc+=(ti-s.inc)*Math.min(1,dt*6)}else s.inc*=1-Math.min(1,dt*6);s.dir=nd;
  }else{
    s.airT+=dt;s.vy-=SKI_G*dt;const k=1-.01*dt;v.x*=k;v.z*=k;s.inc*=1-Math.min(1,dt*5);s.wob=Math.max(0,s.wob-dt*2);s.hock=0;s.plow=0;s.carve=0;
    // spin with left and right
    const calm=o.assist&&!o.tricks;s.spinV+=((calm&&s.airT<.3?0:inp.steer*7.2)-s.spinV)*Math.min(1,dt*7);s.head+=s.spinV*dt;s.spin+=s.spinV*dt;
    p.x+=v.x*dt;p.z+=v.z*dt;p.y+=s.vy*dt;const h=H(p.x,p.z);
    if(p.y<=h){
      normalAt(p.x,p.z,_sn);const vn=v.x*_sn.x+s.vy*_sn.y+v.z*_sn.z,sp=Math.hypot(v.x,v.z),hard=-vn;
      const turns=Math.abs(s.spin)/(2*Math.PI),spins=Math.round(turns),clean=Math.abs(turns-spins)*360<45;
      let d=wrapA(s.head-Math.atan2(v.x,v.z));if(calm&&Math.abs(d)>.9){d=Math.sign(d)*.9;s.head=Math.atan2(v.x,v.z)+d}const lim=o.assist?10.5:9.2,wl=o.assist?7.4:6.2;
      p.y=h;s.air=false;s.dir=Math.atan2(v.x,v.z);
      if(sp>2.5&&Math.abs(d)>1.05){skiCrash(s,'Landet på tvers');return}
      if(hard>lim){skiCrash(s,'For hard landing');return}
      // the snow takes the speed into the slope; the rest goes on along it. A bit across, or a bit hard, and the skier wobbles
      v.x-=_sn.x*vn;v.z-=_sn.z*vn;s.vy=0;s.land=Math.min(1,hard/7);s.head-=d*.6;
      const wb=Math.max(sp>2?(Math.abs(d)-.45)/.6:0,(hard-wl)/(lim-wl));if(wb>0){s.wob=Math.min(1,Math.max(s.wob,.45+wb*.55));s.wobT=0}
      s.ev.push({type:'land',air:s.airT,spins:clean&&s.airT>.3?spins:0,hard,wob:wb>0});s.spin=0;s.spinV=0}
  }
  // trees, huts, masts and nets: a bump when slow, a crash when fast
  const sp=Math.hypot(v.x,v.z);s.speed=sp;
  for(const c of G.colliders){const dx=p.x-c.x,dz=p.z-c.z;if(Math.abs(dx)>4||Math.abs(dz)>4)continue;let nx,nz,pen;
    if(c.w!=null){const cs=Math.cos(c.ry||0),sn=Math.sin(c.ry||0),a=dx*cs-dz*sn,b=dx*sn+dz*cs,hw=c.w/2,hd=c.d/2,ca=Math.max(-hw,Math.min(hw,a)),cb=Math.max(-hd,Math.min(hd,b)),ea=a-ca,eb=b-cb,d=Math.hypot(ea,eb);
      if(d>=SKI_R||d<1e-5)continue;pen=SKI_R-d;nx=(ea*cs+eb*sn)/d;nz=(-ea*sn+eb*cs)/d}
    else{const d=Math.hypot(dx,dz);if(d>=c.r+SKI_R||d<1e-5)continue;pen=c.r+SKI_R-d;nx=dx/d;nz=dz/d}
    if(s.air&&p.y>H(p.x,p.z)+1.4)continue;
    const vn=v.x*nx+v.z*nz;if(vn<-3.2){skiCrash(s,c.net?'Inn i nettet':'Rett i '+(c.w!=null?'en vegg':'et tre'));if(c.net){v.x*=.25;v.z*=.25}return}
    p.x+=nx*pen;p.z+=nz*pen;if(vn<0){const b=c.net?1:1.3;v.x-=nx*vn*b;v.z-=nz*vn*b}}
  if(!s.air&&WL(p.x,p.z)>p.y+.02){skiCrash(s,'Rett i vannet');return}
  if(Math.abs(p.x)>HALF-1||Math.abs(p.z)>HALF-1){skiCrash(s,'Utenfor kartet');return}
}
/* ---------- a run down a piste: gates, misses, the finish ---------- */
function skiSegX(p1,p2,a,b){const d=(p2.x-p1.x)*(b.z-a.z)-(p2.z-p1.z)*(b.x-a.x);if(Math.abs(d)<1e-9)return false;
  const u=((a.x-p1.x)*(b.z-a.z)-(a.z-p1.z)*(b.x-a.x))/d,v=((a.x-p1.x)*(p2.z-p1.z)-(a.z-p1.z)*(p2.x-p1.x))/d;return u>=0&&u<=1&&v>=0&&v<=1}
function makeSkiRun(k){return{k,next:0,passed:0,missed:0,pen:0,time:0,done:false,cp:{x:k.start.p.x,z:k.start.p.z,h:Math.atan2(k.start.tan.x,k.start.tan.z)},jumps:[],points:0,crashes:0,top:0}}
// returns a list of {type:'gate'|'miss'|'finish', i}. A gate skipped, or a slalom gate passed on the wrong side of a pole, costs pen seconds (5; 2 in the easy mode).
function skiGates(run,p1,p2,pen=5){const out=[],G2=run.k.gates;
  for(let i=run.next;i<G2.length&&!run.done;i++){const g=G2[i];
    const E=g.finish?3:run.k.kind==='slalom'?2.2:0,hit=skiSegX(p1,p2,g.a,g.b),wide=!hit&&E>0&&i===run.next&&skiSegX(p1,p2,{x:g.a.x+g.side.x*E,z:g.a.z+g.side.z*E},{x:g.b.x-g.side.x*E,z:g.b.z-g.side.z*E});
    if(!hit&&!wide)continue;
    for(let j=run.next;j<i;j++){run.missed++;run.pen+=pen;out.push({type:'miss',i:j})}
    run.next=i+1;
    if(g.finish){run.done=true;out.push({type:'finish',i});break}
    if(hit){run.passed++;run.cp={x:g.c.x,z:g.c.z,h:Math.atan2(g.tan.x,g.tan.z)};out.push({type:'gate',i})}
    else{run.missed++;run.pen+=pen;out.push({type:'miss',i})}
    break}
  return out}
// points for a jump in Big Jumps: airtime, full spins with a clean landing, and a pop right at the lip
function skiJumpPoints(air,spins,pop){return Math.round(air*120)+spins*150+(pop?50:0)}
