'use strict';
/* =================================================================
   BOATSIM: the motorboat race without graphics (no DOM, so node tools/test-boats.js can run it).
   The sea, the islands and the races are in data/boats.js; js/boat.js draws them and runs the race in the game.
   Everything steps at 60 Hz (BSTEP) and speeds are units per step, like the original Captain Theis game the numbers come from.
   Heading a: the bow points along (−sin a, −cos a), so a = 0 is north (−z) and a grows to the left.
   ================================================================= */
const BCFG={maxSpeed:2.5,boostMult:1.5,accel:.03,brake:.055,friction:.986,reverseMax:-.6,rotSpeed:.036,grip:.075,boostFrames:200,spinFrames:75,invuln:110,bumpCD:30,
  mooring:1.15,kts:16,ballSpeed:3.4,gravity:.045,reload:230,barrelRespawn:540,gateR:40,dockW:90,dockD:100,boatR:9,hullR:20,pairR:11,engage:480};
const BSTEP=1/60;
const bAng=(dx,dz)=>Math.atan2(-dx,-dz);
const bWrap=d=>{while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d};
const bLerpA=(a,b,t)=>a+bWrap(b-a)*t;

/* ---------- the sea: islands and docks ---------- */
let SEA_ISL=null;
function seaIslands(){if(SEA_ISL)return SEA_ISL;const L=[],sp=SEA.span;
  for(const isl of ISLANDS){const o=SEA.islands[isl.id];if(!o)continue;const lv=typeof LEVELS!=='undefined'&&LEVELS.find(l=>l.id===isl.id);
    L.push({id:isl.id,name:lv?lv.name:isl.id,x:(isl.pos[0]-.5)*sp,z:(isl.pos[1]-.5)*sp,r:o.r,look:o.look})}
  for(const e of SEA.extra)L.push({id:e.id,name:e.name,x:e.at[0],z:e.at[1],r:e.r,look:e.look});
  return SEA_ISL=L}
// a dock: a floating plank platform w wide and d deep, a little way off the shore, its long side facing the island
function seaDock(id){const o=SEA.docks[id],isl=seaIslands().find(i=>i.id===o.island),a=o.dir*Math.PI/180,ux=Math.cos(a),uz=Math.sin(a),off=isl.r+BCFG.boatR+31+BCFG.dockD/2;
  return{id,name:o.name,to:o.to||o.name,x:isl.x+ux*off,z:isl.z+uz*off,ux,uz,w:BCFG.dockW,d:BCFG.dockD,island:isl}}
function inDock(dk,x,z){const rx=x-dk.x,rz=z-dk.z,along=rx*dk.ux+rz*dk.uz,across=rx*dk.uz-rz*dk.ux;return Math.abs(along)<dk.d/2&&Math.abs(across)<dk.w/2}
// a race's route: the start line off the marina, the buoys (each knows the way you come from), and the dock at the end
function raceRoute(race){const md=seaDock(SEA.start.dock),sx=md.x+md.ux*SEA.start.out,sz=md.z+md.uz*SEA.start.out,b0=race.buoys[0];
  const start={x:sx,z:sz,a:bAng(b0[0]-sx,b0[1]-sz)},pts=[start];
  const buoys=race.buoys.map(p=>{const prev=pts[pts.length-1],q={x:p[0],z:p[1],a:bAng(p[0]-prev.x,p[1]-prev.z)};pts.push(q);return q});
  const dock=seaDock(race.finish);pts.push({x:dock.x,z:dock.z});return{race,start,buoys,dock,pts}}
// boat i of n side by side on the start line, 36 apart
function startSlot(route,i,n){const s=route.start,off=(i-(n-1)/2)*36;return{x:s.x+Math.cos(s.a)*off,z:s.z-Math.sin(s.a)*off,a:s.a}}

/* ---------- a boat ---------- */
function makeBoat(x,z,a){return{x,z,vx:0,vz:0,a,speed:0,boost:0,spin:0,invuln:0,bumpCD:0,turnVis:0,gate:0,hits:0,barrels:0,done:false,ev:[]}}
// one step. inp={gas,rev,steer} from 0 to 1 (steer +1 = left). W={islands,hulls:[{x,z}],bound}
function stepBoat(b,inp,W){
  if(b.boost>0)b.boost--;if(b.invuln>0)b.invuln--;if(b.bumpCD>0)b.bumpCD--;
  const max=BCFG.maxSpeed*(b.boost>0?BCFG.boostMult:1);
  if(b.spin>0){b.spin--;b.a+=.2*(b.spin/BCFG.spinFrames)+.015;b.speed*=.965}   // hit: spinning round, no steering
  else{if(inp.gas>0){if(b.speed<max)b.speed=Math.min(max,b.speed+BCFG.accel*inp.gas*(b.boost>0?1.8:1))}   // never past the top speed (the excess after a turbo ebbs away below)
    else if(inp.rev>0)b.speed-=(b.speed>0?BCFG.brake:BCFG.accel*.6)*inp.rev;
    else b.speed*=BCFG.friction;
    b.a+=BCFG.rotSpeed*(.25+.75*Math.min(1,Math.abs(b.speed)))*(b.speed<0?-1:1)*inp.steer}
  if(b.speed>max)b.speed=Math.max(max,b.speed-.02);
  b.speed=Math.max(BCFG.reverseMax,b.speed);
  b.turnVis+=((b.spin>0?0:inp.steer)-b.turnVis)*.1;
  // a little drift: the velocity eases toward the heading
  const k=b.spin>0?.02:BCFG.grip;b.vx+=(-Math.sin(b.a)*b.speed-b.vx)*k;b.vz+=(-Math.cos(b.a)*b.speed-b.vz)*k;
  const B=W.bound;b.x=Math.max(-B,Math.min(B,b.x+b.vx));b.z=Math.max(-B,Math.min(B,b.z+b.vz));
  // islands: pushed back out, bounce off, lose speed
  for(const o of W.islands){const minD=o.r+BCFG.boatR,dx=b.x-o.x,dz=b.z-o.z,d=Math.hypot(dx,dz);if(d>=minD||d<1e-6)continue;
    const nx=dx/d,nz=dz/d;b.x=o.x+nx*(minD+.5);b.z=o.z+nz*(minD+.5);const vn=b.vx*nx+b.vz*nz;if(vn<0){b.vx-=1.6*vn*nx;b.vz-=1.6*vn*nz}
    if(Math.abs(b.speed)>.6)bumpBoat(b,3,'land');b.speed*=.35}
  // pirate hulls
  for(const h of W.hulls||[]){const dx=b.x-h.x,dz=b.z-h.z,d=Math.hypot(dx,dz);if(d>=BCFG.hullR||d<1e-6)continue;const nx=dx/d,nz=dz/d;
    b.x+=nx*(BCFG.hullR-d);b.z+=nz*(BCFG.hullR-d);b.vx+=nx*.8;b.vz+=nz*.8;b.speed*=.4;bumpBoat(b,3,'hull')}}
function bumpBoat(b,mag,what){if(b.bumpCD>0)return;b.bumpCD=BCFG.bumpCD;b.ev.push({type:'bump',mag,what})}
function hitBoat(b,what){if(b.invuln>0||b.done)return false;b.spin=BCFG.spinFrames;b.speed*=.3;b.boost=0;b.invuln=BCFG.invuln;b.hits++;b.ev.push({type:'hit',what});return true}
// two boats bump into each other. onlyA: b is a friend's boat on another screen, so only a moves
function boatsCollide(a,b,onlyA){const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),R=BCFG.pairR;if(d>=R||d<1e-3)return;
  const nx=dx/d,nz=dz/d,push=(R-d)/(onlyA?1:2);a.x-=nx*push;a.z-=nz*push;if(!onlyA){b.x+=nx*push;b.z+=nz*push}
  const va=a.vx*nx+a.vz*nz,vb=(b.vx||0)*nx+(b.vz||0)*nz;if(va-vb<=0)return;
  a.vx+=(vb-va)*nx;a.vz+=(vb-va)*nz;a.speed*=.8;if(!onlyA){b.vx+=(va-vb)*nx;b.vz+=(va-vb)*nz;b.speed*=.8}
  if(va-vb>.4){bumpBoat(a,2.5,'boat');if(!onlyA)bumpBoat(b,2.5,'boat')}}

/* ---------- progress: the buoys in order, then moor at the dock ---------- */
const boatTarget=(b,route)=>b.gate<route.buoys.length?route.buoys[b.gate]:route.dock;
function boatCheck(b,route){if(b.done)return null;
  if(b.gate<route.buoys.length){const g=route.buoys[b.gate];if(Math.hypot(b.x-g.x,b.z-g.z)<BCFG.gateR){b.gate++;return{type:'buoy',i:b.gate-1}}return null}
  if(!inDock(route.dock,b.x,b.z))return null;if(Math.abs(b.speed)<BCFG.mooring){b.done=true;return{type:'finish'}}return{type:'slow'}}
// for the places: buoys passed first, then how close to the next one
function boatProgress(b,route){const t=boatTarget(b,route);return(b.done?1e7:0)+b.gate*1e5-Math.hypot(b.x-t.x,b.z-t.z)}

/* ---------- turbo barrels: two on every leg of the route, a little to the side ---------- */
function makeBarrels(route,rng){const out=[],isl=seaIslands(),P=route.pts;
  for(let s=0;s<P.length-1;s++){const a=P[s],c=P[s+1],nl=Math.hypot(c.x-a.x,c.z-a.z)||1,nx=-(c.z-a.z)/nl,nz=(c.x-a.x)/nl;
    for(const f of(s===P.length-2?[.33]:[.33,.68])){let x,z,tries=0;do{const off=(rng()*2-1)*70;x=a.x+(c.x-a.x)*f+nx*off;z=a.z+(c.z-a.z)*f+nz*off;tries++}while(tries<20&&isl.some(o=>Math.hypot(o.x-x,o.z-z)<o.r+30));
      out.push({x,z,on:true,back:0,phase:rng()*10})}}return out}
// t: the race's step counter. A barrel taken comes back BCFG.barrelRespawn steps later
function stepBarrels(L,boats,t){const ev=[];
  for(const br of L){if(!br.on){if(t>=br.back){br.on=true;ev.push({type:'back',br})}continue}
    for(const b of boats){if(b.done||Math.hypot(br.x-b.x,br.z-b.z)>=14)continue;b.boost=BCFG.boostFrames;b.speed=Math.max(b.speed,BCFG.maxSpeed*1.1);b.barrels++;
      br.on=false;br.back=t+BCFG.barrelRespawn;b.ev.push({type:'turbo'});ev.push({type:'taken',br,b});break}}return ev}

/* ---------- pirate ships: they patrol, and circle and fire a broadside at a boat that comes close ---------- */
function makePirates(route,n,rng){const L=[],isl=seaIslands(),xs=route.pts.map(p=>p.x),zs=route.pts.map(p=>p.z),B=SEA.bound-80;
  const box=[Math.max(-B,Math.min(...xs)-300),Math.min(B,Math.max(...xs)+300),Math.max(-B,Math.min(...zs)-300),Math.min(B,Math.max(...zs)+300)];
  for(let i=0;i<n;i++){let x,z,tries=0;
    do{x=box[0]+rng()*(box[1]-box[0]);z=box[2]+rng()*(box[3]-box[2]);tries++}
    while(tries<60&&(isl.some(o=>Math.hypot(o.x-x,o.z-z)<o.r+80)||Math.hypot(x-route.start.x,z-route.start.z)<450||Math.hypot(x-route.dock.x,z-route.dock.z)<300||L.some(q=>Math.hypot(q.x-x,q.z-z)<250)));
    L.push({x,z,a:rng()*Math.PI*2,speed:.6+rng()*.25,reload:90+rng()*(BCFG.reload-90),wp:null,state:'patrol',bob:rng()*10,circle:0,box})}return L}
// targets: the boats the pirates may shoot at (on this screen). o.easy: slower reloads, one ball instead of three, worse aim. Fires go into balls.
function stepPirates(P,targets,W,balls,rng,o={}){const ev=[];
  for(const p of P){let best=null,bd=BCFG.engage,desired;
    for(const b of targets){if(b.done)continue;const d=Math.hypot(b.x-p.x,b.z-p.z);if(d<bd){bd=d;best=b}}
    if(best){p.state='engage';const tx=best.x-p.x,tz=best.z-p.z,bearing=bAng(tx,tz);
      if(bd>160)desired=bearing;else{p.circle=p.circle||(rng()<.5?1:-1);desired=bearing+Math.PI/2*p.circle+(bd<80?p.circle*.5:0)}
      p.reload--;const side=(tx*Math.cos(p.a)-tz*Math.sin(p.a))/(bd||1);
      if(p.reload<=0&&bd<270&&Math.abs(side)>.45){const fr=bd/BCFG.ballSpeed,lead=o.easy?.4:.8;fireBroadside(p,best.x+best.vx*fr*lead,best.z+best.vz*fr*lead,balls,rng,o);
        p.reload=BCFG.reload*(o.easy?1.6:1)+(rng()*100-40);ev.push({type:'fire',p})}}
    else{p.state='patrol';if(!p.wp||Math.hypot(p.wp.x-p.x,p.wp.z-p.z)<40){const b=p.box;p.wp={x:Math.max(b[0],Math.min(b[1],p.x+(rng()*2-1)*350)),z:Math.max(b[2],Math.min(b[3],p.z+(rng()*2-1)*350))}}
      desired=bAng(p.wp.x-p.x,p.wp.z-p.z)}
    for(const isl of W.islands){const dx=p.x-isl.x,dz=p.z-isl.z,d=Math.hypot(dx,dz);if(d<isl.r+60){desired=bAng(-dx,-dz);if(d<isl.r+15){p.x+=dx/d*2;p.z+=dz/d*2}}}
    p.a=bLerpA(p.a,desired,.03);const v=p.speed*(p.state==='patrol'?.6:1),B=W.bound;p.x=Math.max(-B,Math.min(B,p.x-Math.sin(p.a)*v));p.z=Math.max(-B,Math.min(B,p.z-Math.cos(p.a)*v));
    for(const q of P)if(q!==p){const dx=p.x-q.x,dz=p.z-q.z,d=Math.hypot(dx,dz);if(d<45&&d>1e-6){p.x+=dx/d*.6;p.z+=dz/d*.6}}}
  return ev}
// three balls from the side that faces the target, aimed so they come down at the target's distance (as far as 420)
function fireBroadside(p,tx,tz,balls,rng,o){const fx=-Math.sin(p.a),fz=-Math.cos(p.a),rx=Math.cos(p.a),rz=-Math.sin(p.a),dx=tx-p.x,dz=tz-p.z,dist=Math.hypot(dx,dz)||1,side=Math.sign(dx*rx+dz*rz)||1;
  const sp=BCFG.ballSpeed,spread=o.easy?.14:.08,aim=Math.max(40,Math.min(dist,420)),fr=aim/sp,y0=5;
  for(let i=o.easy?1:0;i<(o.easy?2:3);i++){const th=(rng()*2-1)*spread+(i-1)*.04,c=Math.cos(th),s=Math.sin(th),ux=dx/dist,uz=dz/dist,vx=(ux*c+uz*s)*sp,vz=(-ux*s+uz*c)*sp;
    balls.push({x:p.x+fx*(i-1)*3.6+rx*side*2.6,y:y0,z:p.z+fz*(i-1)*3.6+rz*side*2.6,vx,vy:BCFG.gravity*fr/2-(y0-2)/fr,vz,life:200,kind:'ball'})}}
// cannonballs and lava bombs in flight: a boat within 12 is hit and spins, the rest splash into the sea
function stepBalls(balls,boats){const ev=[];
  for(let i=balls.length-1;i>=0;i--){const b=balls[i];b.vy-=BCFG.gravity;b.x+=b.vx;b.y+=b.vy;b.z+=b.vz;b.life--;let gone=false;
    for(const t of boats){if(t.done)continue;if(Math.hypot(b.x-t.x,b.y-2,b.z-t.z)<(b.kind==='lava'?16:12)){if(hitBoat(t,b.kind))ev.push({type:'hit',b,t});gone=true;break}}
    if(!gone&&b.y<.5){ev.push({type:'splash',b});gone=true}
    if(gone||b.life<=0){b.dead=true;balls.splice(i,1)}}return ev}

/* ---------- the volcano on Hisøya: every 8–14 seconds it throws lava bombs towards the boats nearby ---------- */
function makeVolcano(){const v=seaIslands().find(i=>i.look==='vulkan');return v?{x:v.x,z:v.z,y:v.r*1.1,next:300,left:0,acc:0}:null}
function stepVolcano(V,boats,balls,rng){if(!V)return null;let near=null,nd=1100;for(const b of boats){const d=Math.hypot(b.x-V.x,b.z-V.z);if(d<nd&&!b.done){nd=d;near=b}}
  if(!near){V.next=Math.max(V.next,120);return null}
  if(V.left>0){V.left--;V.acc+=.06;let fired=false;while(V.acc>=1){V.acc-=1;fired=true;const a=bAng(near.x-V.x,near.z-V.z)+(rng()*2-1)*.9,d=230+rng()*Math.min(520,nd+120),tx=V.x-Math.sin(a)*d,tz=V.z-Math.cos(a)*d,fr=120+rng()*40;
      balls.push({x:V.x,y:V.y,z:V.z,vx:(tx-V.x)/fr,vy:BCFG.gravity*fr/2-(V.y-2)/fr,vz:(tz-V.z)/fr,life:fr+30,kind:'lava'})}return fired?{type:'lava'}:null}
  if(--V.next<=0){V.left=180;V.next=480+rng()*360;return{type:'erupt'}}return null}
