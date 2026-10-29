'use strict';
/* =================================================================
   GROTTESIM: the diamond cave on Kameløya, seen from the side as in Hill Climb Racing. No DOM, no three.js,
   so tools/test-grotte.js can drive it in node. Uses S, GRIP, TUNE0, TRAVEL, MOUNT_Y and WR from js/core.js.
   x goes into the cave (to the right on the screen) and y is up. The car's angle a is counter-clockwise from +x,
   so a > 0 is nose up. Gas drives forwards and, in the air, tips the nose up (a backflip); brake slows down,
   reverses and tips the nose down. The wheels are massless springs like the 3D car's (js/core.js stepCar), so
   holding the gas on a steep hill lifts the front wheel, and the car can go over backwards.
   makeCave(def) builds the cave once from data/grotte.js: the floor and ceiling lines, pits, bridges, pools,
   diamonds, fuel cans, checkpoints and the decor that js/grotte.js draws.
   ================================================================= */
const GSTEP=1/240;
// g: gravity, a little lighter than on the islands so the jumps last longer; vmax/vrev: top speed forwards and in reverse; fmot: the motor's
// pull as a fraction of the car's weight; air: how fast gas and brake turn the car in the air (rad/s²); fuelDist: how far a full tank goes
// (fuelIdle: and how long it lasts standing still), a third more in easy mode; gemR/canR: how close the car must come to take one
const GCFG={g:7.2,vmax:5.4,vrev:2.4,fmot:.38,air:11,wmax:8,fuelDist:190,fuelIdle:200,gemR:.6,canR:.7,crashT:1.2,exitX:-9.5};

/* ---------- the cave ---------- */
// lines are arrays of points {x,y} sorted by x. A point also says what the stretch leading up to it is: s (surface), pit, wood
function cLow(L,v){let a=0,b=L.length;while(a<b){const m=(a+b)>>1;if(L[m].x<v)a=m+1;else b=m}return a}
// the height of a line at x (a vertical wall counts as the last of its points)
function cLineY(L,x,none){if(!L.length||x<L[0].x||x>L[L.length-1].x)return none;let i=cLow(L,x);if(i>=L.length)i=L.length-1;while(i<L.length-1&&L[i+1].x<=x)i++;
  const A=L[Math.max(0,i-1)],B=L[i];if(B.x<=x||B.x===A.x)return B.y;return A.y+(B.y-A.y)*(x-A.x)/(B.x-A.x)}
// the closest point of a line to (px,py), only looking at the stretches within reach: {q:[x,y],d,pt (the point that ends the stretch)}
const _cn={qx:0,qy:0,d:0,pt:null};
function cNear(L,px,py,reach){let i=Math.max(0,cLow(L,px-reach)-1),bd=1e18,o=null;
  for(;i<L.length-1;i++){const A=L[i],B=L[i+1];if(A.x>px+reach)break;const ex=B.x-A.x,ey=B.y-A.y,l2=ex*ex+ey*ey||1e-12;let t=((px-A.x)*ex+(py-A.y)*ey)/l2;t=t<0?0:t>1?1:t;
    const qx=A.x+ex*t,qy=A.y+ey*t,d=(px-qx)*(px-qx)+(py-qy)*(py-qy);if(d<bd){bd=d;_cn.qx=qx;_cn.qy=qy;_cn.pt=B;_cn.ex=ex;_cn.ey=ey;o=_cn}}
  if(o)o.d=Math.sqrt(bd);return o}
const caveFloor=(cv,x)=>cLineY(cv.F,x,x<cv.F[0].x?cv.F[0].y:cv.F[cv.F.length-1].y);
const caveCeil=(cv,x)=>cLineY(cv.C,x,1e9);
// the floor without the bottoms of the pits: where diamonds, cans and decor stand
const caveTop=(cv,x)=>cLineY(cv.T,x,caveFloor(cv,x));

function makeCave(def){
  const F=[],cv={def,F,C:[],T:[],gems:[],cans:[],cps:[],deco:[],bridges:[],pools:[],pits:[],zones:[],rooms:[],end:0,start:def.start??1.5,len:0};
  let X=def.x0??-16,Y=0,surf=S.SAND;const rel=[];
  const pt=(x,y,o={})=>{F.push({x,y,s:o.s??surf,pit:!!o.pit,deep:!!o.deep,wood:!!o.wood})};
  pt(X,Y);
  // a stretch of floor len long: f(u) is the height over where it starts, u from 0 to 1
  const seg=(len,f,o={})=>{const n=Math.max(1,Math.ceil(len/(o.step??.25)));for(let i=1;i<=n;i++){const u=i/n;pt(X+len*u,Y+f(u),o)}X+=len;Y+=f(1)};
  const b={
    get x(){return X},get y(){return Y},
    surf(s){surf=s},
    flat(len,o){seg(len,()=>0,o)},
    // a smooth rise (dy>0) or fall (dy<0)
    slope(len,dy,o){seg(len,u=>dy*(1-Math.cos(Math.PI*u))/2,o)},
    // n round hills amp high, back to the same height
    hills(len,amp,n=1,o){seg(len,u=>amp*(1-Math.cos(2*Math.PI*n*u))/2,o)},
    // small uneven bumps: rocks and holes in the floor
    bumps(len,amp,o){const k=1.25+(X*.37)%.6;seg(len,u=>{const x=u*len;return amp*Math.sin(Math.PI*u)**.3*(.55*Math.sin(x*k)+.3*Math.sin(x*k*2.3+1.3)+.15*Math.sin(x*k*4.1+.4))},o)},
    // a kicker: a ramp up to h, then a sheer drop back to where it started (a jump)
    ramp(len,h,o){seg(len,u=>h*Math.pow(u,1.5),o);pt(X+.02,Y-h,o);X+=.02;Y-=h},
    // a short, steep step (dy>0 a ledge to climb, dy<0 a drop), rounded so the wheels can roll over it
    step(dy,o={}){seg(o.len??.5,u=>dy*u*u*(3-2*u),Object.assign({step:.05},o))},
    // a pit len wide: straight down, a bottom you fall to, and straight up again (dy: the far side is that much higher)
    gap(len,dy=0,depth=10){const x0=X;pt(X+.02,Y-depth,{deep:true});pt(X+len-.02,Y-depth,{pit:true,deep:true});pt(X+len,Y+dy);X+=len;Y+=dy;cv.pits.push({x0,x1:X,y:Y-dy-depth})},
    // a plank bridge over a chasm; the deck sags a little in the middle
    bridge(len,o={}){const x0=X,y0=Y,sag=o.sag??.25;seg(len,u=>-sag*4*u*(1-u),{s:S.WOOD,wood:true,step:.2});cv.bridges.push({x0,x1:X,y:y0,sag,depth:o.depth??9})},
    // a pool: the floor dips under still water
    pool(len,depth){const x0=X,y0=Y;seg(len,u=>-depth*Math.sin(Math.PI*u)**.7);cv.pools.push({x0,x1:X,y:y0-.08})},
    // the room from here on: h is the height up to the ceiling (it changes smoothly)
    room(h){cv.rooms.push({x:X,h})},
    // a new part of the cave: its name is shown when you drive in, theme chooses the rock, the light and the decor in js/grotte.js
    zone(name,theme){cv.zones.push({x:X,name,theme})},
    // diamonds: a row of n along the floor, h over it, sp apart (dx from here)
    row(dx,n,sp=.9,h=.6){for(let i=0;i<n;i++)rel.push({L:cv.gems,x:X+dx+i*sp,h})},
    // diamonds in an arc from dx ahead, len long: peak over the straight line between the floor at both ends (follows the flight off a ramp)
    arc(dx,n,len,peak){const x0=X+dx;for(let i=0;i<n;i++){const u=n>1?i/(n-1):.5;rel.push({L:cv.gems,x:x0+len*u,f:()=>{const a=caveTop(cv,x0),b=caveTop(cv,x0+len);return a+(b-a)*u+.65+peak*4*u*(1-u)}})}},
    gem(dx,h=.6){rel.push({L:cv.gems,x:X+dx,h})},
    can(dx=0){rel.push({L:cv.cans,x:X+dx,h:.32})},
    // a checkpoint: a lantern on a post. Crash after it and you start here
    cp(dx=0,name){cv.cps.push({x:X+dx,name})},
    deco(kind,dx=0,o={}){cv.deco.push(Object.assign({kind,x:X+dx},o))},
    // the end of the cave: the treasure chamber's back wall
    end(){cv.end=X;pt(X+.3,Y+3);pt(X+.6,Y+14);X+=.6}
  };
  def.build(b);
  cv.len=cv.end;
  cv.T=F.filter(p=>!p.deep);
  for(const r of rel)r.L.push({x:r.x,y:r.f?r.f():caveTop(cv,r.x)+r.h});
  for(const L of[cv.gems,cv.cans])L.sort((a,b)=>a.x-b.x);
  cv.cps.sort((a,b)=>a.x-b.x);cv.zones.sort((a,b)=>a.x-b.x);cv.rooms.sort((a,b)=>a.x-b.x);
  // the ceiling: over the highest floor round each place (smoothed), the room's height above that, and a rough, uneven rock face
  const T=cv.T,roomH=x=>{const R=cv.rooms;if(!R.length)return 6;let i=0;while(i<R.length-1&&R[i+1].x<=x)i++;const A=R[i];if(i>=R.length-1||x<A.x)return A.h;
    const B=R[i+1],u=Math.max(0,Math.min(1,(x-B.x+5)/5));return A.h+(B.h-A.h)*u*u*(3-2*u)};
  const xs=[],hi=[];for(let x=0;x<=cv.end+1;x+=.5){xs.push(x);let m=-1e9;for(let i=Math.max(0,cLow(T,x-3.5));i<T.length&&T[i].x<=x+3.5;i++)m=Math.max(m,T[i].y);hi.push(m>-1e8?m:caveTop(cv,x))}
  for(let i=0;i<xs.length;i++){let s=0,n=0;for(let k=-6;k<=6;k++){const j=i+k;if(j>=0&&j<hi.length){s+=Math.max(hi[j],hi[i]-.4);n++}}const x=xs[i],h=roomH(x);
    const jag=(.3*Math.sin(x*1.7)+.22*Math.sin(x*.63+1)+.16*Math.sin(x*3.3+2)+.1*Math.sin(x*7.1))*Math.min(1.2,Math.sqrt(h)*.38);
    cv.C.push({x,y:Math.max(s/n,hi[i])+h+jag})}
  return cv}

/* ---------- the car ---------- */
// the same numbers as the 3D car (js/core.js makeCar), with two wheels that each carry half the weight
function makeCaveCar(cfg,tune){tune=tune||TUNE0;const k=cfg.susp||1,trv=tune.travel*k,m=cfg.mass,L=cfg.L,roof=.08+.34+cfg.gh+.12;
  const my=MOUNT_Y+(cfg.ride||0)+(trv-TRAVEL*k)-tune.lift,K=m*GCFG.g/2/(.4*TRAVEL*k);
  const car={cfg,tune,m,L,wb:cfg.wb,wr:cfg.wr||WR,trv,K,C:2*Math.sqrt(K*m/2)*[.5,.65,.8,.9][tune.lv?tune.lv.susp:0],I:m/12*(.55*.55+L*L)*1.1,roof,
    x:0,y:0,a:0,vx:0,vy:0,w:0,thr:0,fuel:1,assist:true,speedScale:1,air:0,spin:0,crashT:0,upside:0,lastCp:-1,ev:[],
    wheels:[-1,1].map(s=>({mx:s*cfg.wb/2,my,front:s>0,comp:0,prev:0,had:false,contact:false,spin:0,vl:0,slip:0,surf:S.SAND,px:0,py:0,cx:0,cy:0,pit:false})),
    // the body's corners: under the floor pan, the bumpers, the roof (the last three are the roof, used to tell a crash)
    pts:[[-L*.47,-.06],[L*.47,-.06],[-(L/2+.09),.03],[L/2+.09,.03],[-L*.3,.3],[L*.3,.3],[0,-.14],[-cfg.wb*.3,-.13],[cfg.wb*.3,-.13],[-L*.42,roof],[L*.42,roof],[0,roof+.02]]};
  return car}
// stands the car on its wheels at x, following the slope of the floor
function placeCaveCar(car,cv,x){const y0=caveTop(cv,x-car.wb/2),y1=caveTop(cv,x+car.wb/2),a=Math.atan2(y1-y0,car.wb);
  car.x=x;car.a=a;car.y=Math.max(y0,y1)+car.wr+car.trv*.4-car.wheels[0].my+.08;car.vx=car.vy=car.w=0;car.thr=0;car.air=0;car.spin=0;car.crashT=0;car.upside=0;
  for(const w of car.wheels){w.comp=0;w.prev=0;w.had=false;w.contact=false;w.pit=false}
  for(let i=0;i<120;i++)stepCaveCar(car,{gas:0,brake:0},cv,GSTEP,true);car.ev.length=0}
const _cf={x:0,y:0};
// forces from the floor (or the ceiling) on a point of the body that has gone into the rock
function cBodyHit(car,L,px,py,inside,dt,acc){const h=cNear(L,px,py,.6);if(!h||!inside)return false;let nx=h.qx-px,ny=h.qy-py,pen=h.d;
  if(pen<1e-5){const l=Math.hypot(h.ex,h.ey)||1;nx=-h.ey/l;ny=h.ex/l;if(L!==car._F){nx=-nx;ny=-ny}}else{nx/=pen;ny/=pen}
  const rx=px-car.x,ry=py-car.y,vpx=car.vx-car.w*ry,vpy=car.vy+car.w*rx,vn=vpx*nx+vpy*ny,m=car.m;
  const Nf=Math.max(0,300*m*Math.min(pen,.3)-(vn<0?17*m*vn:0));let tx=vpx-vn*nx,ty=vpy-vn*ny;const tl=Math.hypot(tx,ty),ft=Math.min(tl*m*.125/dt,.6*Nf);
  const fx=nx*Nf-(tl>1e-6?tx/tl*ft:0),fy=ny*Nf-(tl>1e-6?ty/tl*ft:0);acc.fx+=fx;acc.fy+=fy;acc.t+=rx*fy-ry*fx;if(h.pt.pit)acc.pit=true;return true}
// one step. inp = {gas, brake} 0–1. quiet: settling after placeCaveCar (no fuel used, no events)
function stepCaveCar(car,inp,cv,dt,quiet){
  const m=car.m,g=GCFG.g,TU=car.tune,ca=Math.cos(car.a),sa=Math.sin(car.a),upx=-sa,upy=ca,TRV=car.trv,meff=m*.125,inv=1/dt;car._F=cv.F;
  const crashed=car.crashT>0,fuelOK=car.fuel>0;
  let gas=crashed?0:Math.max(0,Math.min(1,inp.gas||0)),brake=crashed?0:Math.max(0,Math.min(1,inp.brake||0));if(!fuelOK)gas=0;
  const want=gas-brake;car.thr+=Math.max(-dt*4,Math.min(dt*4,want-car.thr));
  const sc=Math.max(.8,Math.min(1.3,car.speedScale||1)),vmax=GCFG.vmax*TU.vhigh*Math.sqrt(car.cfg.top||1)*sc,vrev=GCFG.vrev*sc,fmot=GCFG.fmot*TU.fmot*Math.sqrt(car.cfg.pow||1)*m*g,gripMul=(car.assist?1.12:1)*TU.grip;
  const acc={fx:0,fy:-g*m,t:0,pit:false};let nContact=0;
  // easy mode: the motor eases off when the front wheel lifts and the nose keeps coming up, so a steep hill does not tip the car over backwards
  const [rw,fw]=car.wheels,wheelie=car.assist&&rw.contact&&!fw.contact&&car.w>.25&&car.a>.3,mot=wheelie?.3:1;
  const pool=cv.pools.find(p=>car.x>p.x0&&car.x<p.x1),wl=pool?pool.y:-1e9;
  for(const wh of car.wheels){
    const Mx=car.x+wh.mx*ca-wh.my*sa,My=car.y+wh.mx*sa+wh.my*ca,C0x=Mx-upx*TRV,C0y=My-upy*TRV,r=car.wr;
    const h=cNear(cv.F,C0x,C0y,r+.3);let contact=false;
    if(h){const inside=C0y<caveFloor(cv,C0x);let d=h.d,nx,ny;
      if(d<1e-5){const l=Math.hypot(h.ex,h.ey)||1;nx=-h.ey/l;ny=h.ex/l}else if(inside){nx=(h.qx-C0x)/d;ny=(h.qy-C0y)/d}else{nx=(C0x-h.qx)/d;ny=(C0y-h.qy)/d}
      const pen=inside?r+d:r-d;
      if(pen>0){contact=true;nContact++;const ndu=nx*upx+ny*upy,comp=pen/Math.max(.35,ndu);
        let cvel=wh.had?(comp-wh.prev)*inv:0;cvel=Math.max(-2.5,Math.min(2.5,cvel));wh.prev=comp;wh.had=true;
        let spring=car.K*Math.min(comp,TRV)+car.C*cvel;if(comp>TRV)spring+=car.K*30*(comp-TRV)+car.C*2*cvel;spring=Math.max(0,spring);wh.comp=Math.min(comp,TRV+.04);
        const N=Math.min(spring/Math.max(.35,ndu),m*g*3),px=h.qx,py=h.qy,rx=px-car.x,ry=py-car.y,vpx=car.vx-car.w*ry,vpy=car.vy+car.w*rx;
        // drive along the ground, in the direction the car points
        let tx=ca-(ca*nx+sa*ny)*nx,ty=sa-(ca*nx+sa*ny)*ny;const tl=Math.hypot(tx,ty);if(tl<1e-4){tx=ny;ty=-nx}else{tx/=tl;ty/=tl}
        const vl=vpx*tx+vpy*ty,surf=h.pt.s,wet=wl>py+.02,lim=GRIP[surf]*gripMul*(wet?.8:1)*N;let fl,vt=0;
        if(Math.abs(car.thr)>.04){vt=car.thr>0?car.thr*vmax:car.thr*vrev;const fm=Math.min(fmot*(car.thr>0?mot:1),lim);fl=Math.max(-fm,Math.min(fm,(vt-vl)*meff*inv))}
        else fl=Math.max(-.04*m*g,Math.min(.04*m*g,-vl*meff*inv));   // no pedal: it rolls
        const fx=nx*N+tx*fl,fy=ny*N+ty*fl;acc.fx+=fx;acc.fy+=fy;acc.t+=rx*fy-ry*fx;
        wh.vl=vl;wh.slip=Math.abs(car.thr)>.04?Math.abs(vt-vl):0;wh.surf=surf;wh.px=px;wh.py=py;wh.pit=!!h.pt.pit;wh.wet=wet;if(h.pt.pit)acc.pit=true}}
    if(!contact){wh.had=false;wh.comp=0;wh.prev=0;wh.slip=0;wh.pit=false;wh.wet=false}
    wh.contact=contact;const ext=TRV-Math.min(wh.comp,TRV);wh.cx=Mx-upx*ext;wh.cy=My-upy*ext;
    // the wheel against the ceiling (no drive, it just stops you)
    if(wh.cy+r>caveCeil(cv,wh.cx)-.3)cBodyHit(car,cv.C,wh.cx,wh.cy+r*.9,wh.cy+r*.9>caveCeil(cv,wh.cx),dt,acc);
    const target=contact&&wh.slip<.3?wh.vl:car.thr*(car.thr>0?vmax:vrev);wh.spin+=target/car.wr*dt}
  // the body against the floor and the ceiling
  let roofHit=false;
  car.pts.forEach((p,i)=>{const px=car.x+p[0]*ca-p[1]*sa,py=car.y+p[0]*sa+p[1]*ca;
    if(cBodyHit(car,cv.F,px,py,py<caveFloor(cv,px),dt,acc)&&i>=9)roofHit=true;
    cBodyHit(car,cv.C,px,py,py>caveCeil(cv,px),dt,acc)});
  // in the air: gas tips the nose up, brake tips it down
  const flying=nContact===0;
  // easy mode: the car turns to land on its wheels, matching the floor ahead; the pedals only tip it a little (no saltos, but no crashes either)
  if(flying&&!crashed){if(car.assist){const lx=car.x+car.vx*.4,want=Math.atan2(caveTop(cv,lx+.6)-caveTop(cv,lx-.6),1.2)+(gas-brake)*.55;acc.t+=Math.max(-6,Math.min(6,(want-car.a)*4-car.w*1.3))*car.I}
    else acc.t+=(gas-brake)*GCFG.air*car.I}
  // still water: it drags and lifts a little
  if(pool){const sub=Math.max(0,Math.min(1,(wl-(car.y-.2))/.6));if(sub>0){acc.fy+=sub*m*g*.35;const k=1-1.6*sub*dt;car.vx*=k;car.vy*=k;car.w*=1-2*sub*dt;if(!car.inWater&&!quiet)car.ev.push({type:'splash',x:car.x,y:wl,v:Math.hypot(car.vx,car.vy)});car.inWater=true}else car.inWater=false}
  car.vx+=acc.fx/m*dt;car.vy+=acc.fy/m*dt;car.w+=acc.t/car.I*dt;
  car.w=Math.max(-GCFG.wmax,Math.min(GCFG.wmax,car.w))*(1-(flying?.25:.9)*dt);car.vx*=1-.03*dt;car.vy*=1-.03*dt;
  car.x+=car.vx*dt;car.y+=car.vy*dt;car.a+=car.w*dt;if(car.a>Math.PI)car.a-=2*Math.PI;else if(car.a<-Math.PI)car.a+=2*Math.PI;
  if(quiet)return;
  // airtime and saltos: the rotation in the air is added up and counted when the car lands on its wheels
  if(flying){car.air+=dt;car.spin+=car.w*dt}
  else{if(car.air>.3&&!crashed){const flips=Math.floor((Math.abs(car.spin)+.6)/(2*Math.PI));car.ev.push({type:'land',air:car.air,flips,back:car.spin>0})}car.air=0;car.spin=0}
  // a crash: the roof hits the ground with the car upside down, or it lies on its side and does not move
  const up=Math.cos(car.a),sp=Math.hypot(car.vx,car.vy);
  if(!crashed){if(roofHit&&up<-.2)car.upside=9;else if(up<.1&&sp<1.2&&!flying)car.upside+=dt;else car.upside=Math.max(0,car.upside-dt*2);
    if(car.upside>1.2){car.crashT=GCFG.crashT;car.ev.push({type:'crash',x:car.x,y:car.y})}
    else if(acc.pit||car.y<caveTop(cv,car.x)-4){car.crashT=GCFG.crashT;car.ev.push({type:'pit',x:car.x,y:car.y})}}
  else{car.crashT-=dt;if(car.crashT<=0){car.crashT=0;car.ev.push({type:'respawn'})}}
  // fuel: mostly by the distance driven (a full tank goes fuelDist), a little for every second the engine runs
  if(!crashed&&car.fuel>0){car.fuel=Math.max(0,car.fuel-(Math.abs(car.vx)*dt/GCFG.fuelDist+dt/GCFG.fuelIdle)/(car.assist?1.35:1));if(car.fuel===0)car.ev.push({type:'empty'})}}

/* ---------- a trip into the cave: diamonds, cans, checkpoints, the end and the way out ---------- */
function makeCaveRun(cv){return{gems:cv.gems.map(()=>false),cans:cv.cans.map(()=>false),cp:-1,got:0,flips:0,far:0,done:false,out:false,emptyT:0,t:0}}
// the closest a point comes to the car's middle line (rear bumper to front bumper, a little over the floor pan)
function cCarDist(car,x,y){const ca=Math.cos(car.a),sa=Math.sin(car.a),cx=car.x-sa*.2,cy=car.y+ca*.2,dx=x-cx,dy=y-cy;let u=dx*ca+dy*sa;const L=car.L/2;u=u<-L?-L:u>L?L:u;return Math.hypot(dx-ca*u,dy-sa*u)}
// what the car reached this step: returns events
function caveRunStep(run,car,cv,dt){const E=[];run.t+=dt;run.far=Math.max(run.far,car.x);
  if(car.crashT>0)return E;
  for(let i=Math.max(0,cLow(cv.gems,car.x-2.5));i<cv.gems.length&&cv.gems[i].x<car.x+2.5;i++){const g=cv.gems[i];if(run.gems[i])continue;if(cCarDist(car,g.x,g.y)<GCFG.gemR){run.gems[i]=true;run.got++;E.push({type:'gem',i,x:g.x,y:g.y})}}
  for(let i=0;i<cv.cans.length;i++){const c=cv.cans[i];if(run.cans[i]||Math.abs(c.x-car.x)>2.5)continue;if(cCarDist(car,c.x,c.y)<GCFG.canR){run.cans[i]=true;car.fuel=1;E.push({type:'can',i,x:c.x,y:c.y})}}
  while(run.cp<cv.cps.length-1&&car.x>=cv.cps[run.cp+1].x){run.cp++;car.lastCp=run.cp;E.push({type:'cp',i:run.cp,name:cv.cps[run.cp].name})}
  if(!run.done&&car.x>=cv.end-2.4){run.done=true;E.push({type:'end'})}
  if(car.x<GCFG.exitX&&!run.out){run.out=true;E.push({type:'out'})}
  // out of fuel: when the car has rolled to a stop, the trip is over
  if(car.fuel<=0){const sp=Math.hypot(car.vx,car.vy);run.emptyT=sp<.25?run.emptyT+dt:0;if(run.emptyT>2.2&&!run.out){run.out=true;E.push({type:'stranded'})}}
  return E}
// where you start again after a crash: the last checkpoint, or the entrance
const caveRespawnX=(cv,run)=>run.cp>=0?cv.cps[run.cp].x+.6:cv.start;
