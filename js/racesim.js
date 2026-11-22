'use strict';
/* =================================================================
   RACESIM: the physics of the races on Racerøya, seen from above. No DOM, no THREE: tools/test-race.js runs it in node.
   - makeTrack(def): the closed track from data/racer.js, sampled every TSTEP metres: the centre line, its direction and normal,
     the racing line the rivals follow and the speed they can take at every point of it.
   - trackAt(T,x,y,hint): where a point is on the track: the sample, the distance along the lap (s) and to the side (d), and the surface.
   - makeRaceCar / stepRaceCar: a car as a bicycle model with tyres that slide. The rear lets go when you brake hard with the
     handbrake or give full throttle in a tight turn, and then the car drifts. A long drift charges the mini-turbo.
   - raceCollide: the cars bump into each other (two circles each) and into the tyre walls.
   - aiInput: the rivals: follow the racing line, brake for the corners, go round slower cars.
   Units: metres and seconds. x to the right, y down the screen. The heading a is the angle from +x towards +y, so a grows when the car turns right.
   ================================================================= */
const TSTEP=2, RSTEP=1/120, RG=9.81;
const RCFG={
  len:4.4, wid:2.0, lf:1.3, lr:1.3, k2:1.9,           // size, axle distances from the centre, yaw inertia / mass
  mu:1.85,                                            // tyre grip on asphalt (in g)
  peak:.1,                                            // slip angle (rad) where the tyre grips the most
  acc:9.2, vtop:42, brake:16, rev:6, vrev:11,         // engine, top speed (m/s), brakes, reverse
  roll:.6, aero:.0004,                                // rolling resistance and air
  hbGrip:.32, hbBrake:5,                              // the handbrake: rear grip and braking
  steer:.62, steerRate:3.6, steerK:1.35,               // full lock (rad) at low speed, how fast the wheel turns, how far past the grip the wheel turns at speed
  boostAcc:1.65, boostTop:1.16,                       // the mini-turbo: more power and a higher top speed
  driftMin:.2,                                        // body slip angle (rad) that counts as a drift
  rearMu:1.1, pow:.3, drop:.15,                       // the rear's extra grip (so the car is steady at full lock), how much the throttle steals from it, and how much it loses once it slides
  stab:9, stabFrom:.42, wmax:2.8,                      // arcade help: the car straightens itself up when the slide passes stabFrom (rad), and never turns faster than wmax (rad/s)
};
// the surfaces next to the asphalt: grip and how hard they slow the car
const RSURF={
  road:{mu:1,drag:0},
  curb:{mu:.94,drag:.3},
  grass:{mu:.72,drag:2.0},
  sand:{mu:.62,drag:3.6},
};
const rsmt=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
const rwrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

/* ---------- the track ---------- */
// a closed Catmull-Rom curve through the points, sampled every TSTEP metres
function makeTrack(def){const sc=def.scale||1,P=def.pts.map(p=>[p[0]*sc,p[1]*sc]),n=P.length,raw=[];
  const cr=(p0,p1,p2,p3,t)=>{const t2=t*t,t3=t2*t;return .5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3)};
  for(let i=0;i<n;i++){const a=P[(i-1+n)%n],b=P[i],c=P[(i+1)%n],d=P[(i+2)%n],L=Math.hypot(c[0]-b[0],c[1]-b[1]),m=Math.max(8,Math.ceil(L/.5));
    for(let k=0;k<m;k++){const t=k/m;raw.push([cr(a[0],b[0],c[0],d[0],t),cr(a[1],b[1],c[1],d[1],t)])}}
  // even spacing along the curve
  const cum=[0];for(let i=1;i<=raw.length;i++){const p=raw[i-1],q=raw[i%raw.length];cum.push(cum[i-1]+Math.hypot(q[0]-p[0],q[1]-p[1]))}
  const total=cum[raw.length],N=Math.round(total/TSTEP),L=N*TSTEP,pts=[];let j=0;
  for(let i=0;i<N;i++){const s=i*total/N;while(cum[j+1]<s)j++;const u=(s-cum[j])/(cum[j+1]-cum[j]||1),p=raw[j],q=raw[(j+1)%raw.length];pts.push({x:p[0]+(q[0]-p[0])*u,y:p[1]+(q[1]-p[1])*u,s:i*TSTEP})}
  // the start line lies startAt metres after the first point (default 70), so the grid behind it is on the straight too
  {const k=Math.round((def.startAt??70)/TSTEP)%N;pts.push(...pts.splice(0,k));pts.forEach((p,i)=>p.s=i*TSTEP)}
  for(let i=0;i<N;i++){const a=pts[(i-1+N)%N],b=pts[(i+1)%N],tx=b.x-a.x,ty=b.y-a.y,l=Math.hypot(tx,ty)||1,p=pts[i];p.tx=tx/l;p.ty=ty/l;p.nx=-p.ty;p.ny=p.tx}   // n: to the right of the direction of travel
  // curvature (1/radius) of the centre line, signed: positive in a right turn
  for(let i=0;i<N;i++){const a=pts[(i-3+N)%N],b=pts[(i+3)%N];pts[i].k=rwrap(Math.atan2(b.ty,b.tx)-Math.atan2(a.ty,a.tx))/(6*TSTEP)}
  const T={def,pts,N,L,hw:def.hw,runoff:def.runoff,wallD:def.hw+def.runoff,off:def.off||'grass'};
  // curbs: red and white kerbs on the inside and outside of the corners
  for(const p of pts)p.curb=Math.abs(p.k)>1/120;
  {const c=pts.map(p=>p.curb);for(let i=0;i<N;i++){let on=false;for(let k=-4;k<=4;k++)if(c[(i+k+N)%N])on=true;pts[i].curb=on}}
  // a grid of the samples for fast look-ups anywhere (the drawing and the AI use trackAt with a hint; this is the fallback)
  const G=T.grid=new Map(),cs=T.cell=24;for(let i=0;i<N;i++){const p=pts[i],k=Math.floor(p.x/cs)+','+Math.floor(p.y/cs);if(!G.has(k))G.set(k,[]);G.get(k).push(i)}
  T.bounds=pts.reduce((b,p)=>({x0:Math.min(b.x0,p.x),y0:Math.min(b.y0,p.y),x1:Math.max(b.x1,p.x),y1:Math.max(b.y1,p.y)}),{x0:1e9,y0:1e9,x1:-1e9,y1:-1e9});
  raceLine(T);raceSpeeds(T);return T}
// the racing line: start on the centre line and pull every point towards the middle of its neighbours (that straightens the line out
// and cuts the corners), but never closer to the edge than a car and a bit
function raceLine(T){const P=T.pts,N=T.N,lim=T.hw-1.9,o=new Float32Array(N);
  for(let it=0;it<600;it++){for(let i=0;i<N;i++){const a=P[(i-1+N)%N],b=P[(i+1)%N],ax=a.x+a.nx*o[(i-1+N)%N],ay=a.y+a.ny*o[(i-1+N)%N],bx=b.x+b.nx*o[(i+1)%N],by=b.y+b.ny*o[(i+1)%N],p=P[i];
    const mx=(ax+bx)/2-p.x,my=(ay+by)/2-p.y,t=mx*p.nx+my*p.ny;o[i]=Math.max(-lim,Math.min(lim,o[i]+(t-o[i])*.6))}}
  T.off_=o;T.line=P.map((p,i)=>({x:p.x+p.nx*o[i],y:p.y+p.ny*o[i]}))}
// how fast the line can be taken at every point: from the curvature, then braking back from every slow corner
function raceSpeeds(T){const P=T.line,N=T.N,v=new Float32Array(N),aLat=RCFG.mu*RG*.97,aBrk=12;
  for(let i=0;i<N;i++){const a=P[(i-3+N)%N],b=P[i],c=P[(i+3)%N],ab=Math.hypot(b.x-a.x,b.y-a.y),bc=Math.hypot(c.x-b.x,c.y-b.y),ca=Math.hypot(a.x-c.x,a.y-c.y),
      cr=Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)),k=ab*bc*ca>1e-6?2*cr/(ab*bc*ca):0;
    v[i]=Math.min(RCFG.vtop,k>1e-5?Math.sqrt(aLat/k):RCFG.vtop)}
  for(let pass=0;pass<3;pass++)for(let i=N-1;i>=0;i--){const nx=v[(i+1)%N];v[i]=Math.min(v[i],Math.sqrt(nx*nx+2*aBrk*TSTEP))}
  T.vmax=v}
// where a point is: the nearest sample (searched around hint when given), s along the lap and d to the side (+ = right of the direction of travel)
function trackAt(T,x,y,hint){const P=T.pts,N=T.N;let bi=-1,bd=1e18;
  if(hint!=null&&hint>=0){for(let k=-30;k<=30;k++){const i=(hint+k+N)%N,p=P[i],dx=x-p.x,dy=y-p.y,d=dx*dx+dy*dy;if(d<bd){bd=d;bi=i}}}
  if(bi<0||bd>(T.wallD+8)**2){const cs=T.cell,cx=Math.floor(x/cs),cy=Math.floor(y/cs);let r=1;
    for(;r<=8;r++){for(let gx=cx-r;gx<=cx+r;gx++)for(let gy=cy-r;gy<=cy+r;gy++){const L=T.grid.get(gx+','+gy);if(!L)continue;for(const i of L){const p=P[i],dx=x-p.x,dy=y-p.y,d=dx*dx+dy*dy;if(d<bd){bd=d;bi=i}}}if(bi>=0&&Math.sqrt(bd)<(r-1)*cs)break}
    if(bi<0)for(let i=0;i<N;i++){const p=P[i],dx=x-p.x,dy=y-p.y,d=dx*dx+dy*dy;if(d<bd){bd=d;bi=i}}}
  const p=P[bi],dx=x-p.x,dy=y-p.y,along=dx*p.tx+dy*p.ty,d=dx*p.nx+dy*p.ny;let s=p.s+along;if(s<0)s+=T.L;else if(s>=T.L)s-=T.L;
  const ad=Math.abs(d),surf=ad<=T.hw?'road':ad<=T.hw+1.3&&p.curb?'curb':T.off;return{i:bi,s,d,surf,p}}
// a point on the centre line (or offset to the side) at distance s along the lap
function trackPos(T,s,off=0){s=((s%T.L)+T.L)%T.L;const i=Math.floor(s/TSTEP),u=s/TSTEP-i,a=T.pts[i],b=T.pts[(i+1)%T.N];
  const nx=a.nx+(b.nx-a.nx)*u,ny=a.ny+(b.ny-a.ny)*u;return{x:a.x+(b.x-a.x)*u+nx*off,y:a.y+(b.y-a.y)*u+ny*off,a:Math.atan2(a.ty+(b.ty-a.ty)*u,a.tx+(b.tx-a.tx)*u)}}

/* ---------- a car ---------- */
function makeRaceCar(o={}){return Object.assign({x:0,y:0,a:0,vx:0,vy:0,w:0,steer:0,thr:0,brk:0,hb:0,
  slipF:0,slipR:0,beta:0,u:0,v:0,drift:0,charge:0,boost:0,hint:-1,s:0,prog:0,lap:0,lapT:0,best:null,laps:[],done:false,finT:null,
  surfF:'road',surfR:'road',wallT:0,stuckT:0,wrongT:0,ev:[],ai:null,skill:1,bumpT:0,name:'',col:'#d9432f',num:1},o)}
// put a car at s along the lap, off metres to the side, facing along the track
function placeRaceCar(c,T,s,off){const p=trackPos(T,s,off);c.x=p.x;c.y=p.y;c.a=p.a;c.vx=c.vy=c.w=0;c.steer=0;c.hint=trackAt(T,p.x,p.y).i;c.s=trackAt(T,p.x,p.y,c.hint).s;c.drift=c.charge=c.boost=0}
// the lateral force from one axle: linear for small slip, saturating at the grip limit, and (on the rear) dropping a little when it slides,
// so a drift holds once it has started
function rTyre(alpha,Fmax,drop){const C=Fmax/RCFG.peak;let F=Fmax*Math.tanh(alpha*C/Math.max(.01,Fmax));if(drop)F*=1-drop*rsmt(.12,.55,Math.abs(alpha));return-F}
// one physics step. inp: {gas,brake,steer (-1 left … 1 right),hb}. Fills c.ev with what happened.
function stepRaceCar(c,inp,T,dt){const K=RCFG,ca=Math.cos(c.a),sa=Math.sin(c.a);
  // velocity in the car's own frame: u forwards, v to the right
  let u=c.vx*ca+c.vy*sa,v=-c.vx*sa+c.vy*ca;const sp=Math.hypot(u,v);
  c.beta=sp>3?Math.atan2(v,Math.abs(u)):0;
  // the surfaces under the front and rear axle
  const fx=c.x+ca*K.lf,fy=c.y+sa*K.lf,rx=c.x-ca*K.lr,ry=c.y-sa*K.lr,qc=trackAt(T,c.x,c.y,c.hint);c.hint=qc.i;
  const qf=trackAt(T,fx,fy,c.hint),qr=trackAt(T,rx,ry,c.hint),SF=RSURF[qf.surf],SR=RSURF[qr.surf];c.surfF=qf.surf;c.surfR=qr.surf;
  // steering: less lock at speed, but always enough to catch a slide; the wheel turns at a limited rate
  // speed-sensitive steering: at speed full lock is about what the tyres can hold (a little more, so you can push the front),
  // but always enough to catch a slide
  const lock=Math.min(K.steer,Math.max(K.steerK*(K.lf+K.lr)*K.mu*RG/(u*u+1),.07,Math.abs(c.beta)+.12));
  let want=inp.steer*lock;
  // help with the counter-steer: the front wheels turn a little towards where the car is going (more when you let go of the wheel)
  if(u>4)want+=c.beta*(Math.abs(inp.steer)<.1?.8:.45);
  want=Math.max(-.68,Math.min(.68,want));c.steer+=Math.max(-K.steerRate*dt,Math.min(K.steerRate*dt,want-c.steer));
  const d=c.steer,cd=Math.cos(d),sd=Math.sin(d);
  // the engine and brakes: brake while rolling forwards, reverse when nearly stopped
  const boostK=c.boost>0?1:0,top=K.vtop*(1+(K.boostTop-1)*boostK)*(SR.mu<1?(.55+.45*SR.mu):1),acc=K.acc*(1+(K.boostAcc-1)*boostK);
  let Fx=0,Fb=0;
  if(inp.gas>0&&u>-1)Fx=inp.gas*acc*Math.max(0,1-(Math.max(0,u)/top)**2);
  if(inp.brake>0){if(u>1)Fb=inp.brake*K.brake;else Fx=-inp.brake*K.rev*Math.max(0,1-(Math.max(0,-u)/K.vrev)**2)}
  if(inp.gas>0&&u<-1)Fb=Math.max(Fb,K.brake*inp.gas);   // gas while rolling backwards: brake first
  const hb=inp.hb>0&&Math.abs(u)>.5;
  // grip on each axle (half the weight each), shared with the driving force on the rear (the friction circle)
  const N=.5*K.mu*RG,FmaxF=N*SF.mu,FmaxR0=N*SR.mu*K.rearMu*(hb?K.hbGrip:1),FxR=Math.min(Math.abs(Fx)*K.pow,FmaxR0*.92),FmaxR=Math.sqrt(Math.max(FmaxR0*FmaxR0*.12,FmaxR0*FmaxR0-FxR*FxR));
  // slip angles: the angle between where each wheel points and where it goes
  const vfy=v+c.w*K.lf,vry=v-c.w*K.lr,
    vfl=u*cd+vfy*sd,vfn=-u*sd+vfy*cd,                 // the front wheel's own frame (turned by the steering)
    aF=Math.atan2(vfn,Math.max(1.5,Math.abs(vfl))),aR=Math.atan2(vry,Math.max(1.5,Math.abs(u)));
  c.slipF=aF;c.slipR=aR;
  const Fyf=rTyre(aF,FmaxF,0),Fyr=rTyre(aR,FmaxR,K.drop);
  // rolling, air, the grass or sand, the brakes and the handbrake: all against the direction of travel
  const sg=u>0?1:u<0?-1:0,rest=(K.roll+K.aero*u*u+(SF.drag+SR.drag)*.5*Math.min(1,Math.abs(u)/3)+(Math.abs(u)>.05?Fb:0)+(hb?K.hbBrake:0))*sg;
  let ax=Fx-Fyf*sd-rest,ay=Fyf*cd+Fyr;
  // don't let resistance push a stopped car backwards
  if(Math.abs(u)<.3&&Fx===0){ax=-u/dt*.5}
  const torque=K.lf*Fyf*cd-K.lr*Fyr;
  // integrate in the world frame
  c.vx+=(ax*ca-ay*sa)*dt;c.vy+=(ax*sa+ay*ca)*dt;c.w+=torque/K.k2*dt;
  // arcade help: past stabFrom the car turns back towards where it is going (less with the handbrake on), and the spin is capped
  {const ex=Math.abs(c.beta)-K.stabFrom;if(ex>0&&u>3)c.w+=Math.sign(c.beta)*ex*K.stab*(hb?.4:1)*dt;c.w=Math.max(-K.wmax,Math.min(K.wmax,c.w))}
  // at a standstill the car does not spin on the spot
  if(sp<1.2){const k=Math.exp(-dt*6*(1.2-sp));c.w*=k;if(Fx===0){c.vx*=k;c.vy*=k}}
  c.x+=c.vx*dt;c.y+=c.vy*dt;c.a=rwrap(c.a+c.w*dt);
  c.u=u;c.v=v;c.thr=inp.gas;c.brk=inp.brake;c.hb=hb?1:0;
  // drifting: the body slides sideways at speed. A long drift charges the mini-turbo, which fires when the car straightens up
  const drifting=sp>11&&Math.abs(c.beta)>K.driftMin&&u>0;
  if(drifting){c.drift+=dt;c.charge=Math.min(2.5,c.charge+dt*(qr.surf==='road'||qr.surf==='curb'?1:.3))}
  else{if(c.drift>0&&Math.abs(c.beta)<.12){if(c.charge>.7){c.boost=Math.min(1.6,.35+c.charge*.5);c.ev.push({type:'boost',t:c.boost,charge:c.charge})}c.charge=0;c.drift=0}else if(!drifting&&sp<8){c.charge=0;c.drift=0}}
  if(c.boost>0)c.boost=Math.max(0,c.boost-dt);
  // where the car is on the lap: s, and the progress (laps × L + s) that only counts forwards through the start line
  const q=trackAt(T,c.x,c.y,c.hint);c.hint=q.i;let ds=q.s-c.s;if(ds>T.L/2)ds-=T.L;else if(ds<-T.L/2)ds+=T.L;c.s=q.s;c.prog+=ds;c.d=q.d;
  // going the wrong way
  const p=q.p,fwd=ca*p.tx+sa*p.ty;if(fwd<-.3&&(c.vx*p.tx+c.vy*p.ty)<-2)c.wrongT+=dt;else c.wrongT=Math.max(0,c.wrongT-dt*2);
  c.wallT=Math.max(0,c.wallT-dt);c.bumpT=Math.max(0,c.bumpT-dt);
  rWalls(c,T)}
// the tyre walls: three circles along the car must stay inside wallD of the centre line. A hit pushes the car back and bounces it
function rWalls(c,T){const K=RCFG,ca=Math.cos(c.a),sa=Math.sin(c.a),r=1.0;
  for(const off of[1.45,0,-1.45]){const px=c.x+ca*off,py=c.y+sa*off,q=trackAt(T,px,py,c.hint),pen=Math.abs(q.d)+r-T.wallD;if(pen<=0)continue;
    const sgn=q.d>0?-1:1,nx=q.p.nx*sgn,ny=q.p.ny*sgn;c.x+=nx*pen;c.y+=ny*pen;
    // the impulse at the contact point
    const rx=px-c.x-nx*r,ry=py-c.y-ny*r,vpx=c.vx-c.w*ry,vpy=c.vy+c.w*rx,vn=vpx*nx+vpy*ny;if(vn>=0)continue;
    const rn=rx*ny-ry*nx,e=.12,j=-(1+e)*vn/(1+rn*rn/K.k2);c.vx+=j*nx;c.vy+=j*ny;c.w+=rn*j/K.k2;
    // scraping along the wall: friction against the sliding
    const tx=-ny,ty=nx,vt=(c.vx-c.w*ry)*tx+(c.vy+c.w*rx)*ty,jt=Math.max(-Math.abs(j)*.12,Math.min(Math.abs(j)*.12,-vt*.5)),rt=rx*ty-ry*tx;c.vx+=jt*tx;c.vy+=jt*ty;c.w+=rt*jt/K.k2;
    // wall help: a car scraping the wall nose-first is turned back along the track, so it slides off instead of sticking
    {const da=rwrap(Math.atan2(q.p.ty,q.p.tx)-c.a);if(Math.abs(da)<1.3)c.w+=da*.6}
    if(-vn>2.5&&c.wallT<=0){c.wallT=.25;c.ev.push({type:'wall',v:-vn,x:px+nx*-r,y:py+ny*-r})}c.charge=0}}
// the cars bump into each other: two circles each (front and back half), a bouncy impulse that also turns them.
// A car with .remote (another player online, or a rival driven by the leader) is moved by the network: only the local car is pushed
function raceCollide(cars){const K=RCFG,r=1.08,o=1.12;
  for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++){const A=cars[i],B=cars[j];if(A.remote&&B.remote||A.gone||B.gone||Math.abs(A.x-B.x)>6||Math.abs(A.y-B.y)>6)continue;
    for(const oa of[o,-o])for(const ob of[o,-o]){const ax=A.x+Math.cos(A.a)*oa,ay=A.y+Math.sin(A.a)*oa,bx=B.x+Math.cos(B.a)*ob,by=B.y+Math.sin(B.a)*ob,dx=ax-bx,dy=ay-by,dd=Math.hypot(dx,dy);
      if(dd>=2*r||dd<1e-6)continue;const nx=dx/dd,ny=dy/dd,pen=2*r-dd,ka=A.remote?0:B.remote?1:.5,kb=B.remote?0:A.remote?1:.5;A.x+=nx*pen*ka;A.y+=ny*pen*ka;B.x-=nx*pen*kb;B.y-=ny*pen*kb;
      const cx=(ax+bx)/2,cy=(ay+by)/2,rax=cx-A.x,ray=cy-A.y,rbx=cx-B.x,rby=cy-B.y,
        vax=A.vx-A.w*ray,vay=A.vy+A.w*rax,vbx=B.vx-B.w*rby,vby=B.vy+B.w*rbx,vn=(vax-vbx)*nx+(vay-vby)*ny;if(vn>=0)continue;
      const ran=rax*ny-ray*nx,rbn=rbx*ny-rby*nx,e=.45,jn=-(1+e)*vn/(2+ran*ran/K.k2+rbn*rbn/K.k2);
      if(!A.remote){A.vx+=jn*nx;A.vy+=jn*ny;A.w+=ran*jn/K.k2}if(!B.remote){B.vx-=jn*nx;B.vy-=jn*ny;B.w-=rbn*jn/K.k2}
      if(-vn>1.5&&(A.bumpT<=0||B.bumpT<=0)){A.bumpT=B.bumpT=.2;const ev={type:'bump',v:-vn,x:cx,y:cy};A.ev.push(Object.assign({other:B},ev));B.ev.push(Object.assign({other:A},ev))}}}}

/* ---------- the rivals ---------- */
// follow the racing line a little way ahead, brake for what is coming, and steer round a car in the way
function aiInput(c,T,cars,dt){const A=c.ai||(c.ai={side:0,stuck:0,back:0,wob:Math.random()*6.28,bias:(Math.random()-.5)*1.6});const N=T.N,sp=Math.hypot(c.vx,c.vy);
  // stuck against a wall or another car: reverse a little, then go again
  if(A.back>0){A.back-=dt;return{gas:0,brake:1,steer:-Math.sign(c.d||1)*.8,hb:0}}
  if(sp<1.5&&c.prog>-20){A.stuck+=dt;if(A.stuck>1.4){A.stuck=0;A.back=.9}}else A.stuck=Math.max(0,A.stuck-dt);
  // a car in front and close: pass on the side with more room
  let side=0;for(const o of cars){if(o===c)continue;const dx=o.x-c.x,dy=o.y-c.y,fwd=dx*Math.cos(c.a)+dy*Math.sin(c.a),lat=-dx*Math.sin(c.a)+dy*Math.cos(c.a);
    if(fwd>0&&fwd<16&&Math.abs(lat)<3.2){const os=Math.hypot(o.vx,o.vy);if(os<sp+3){const want=o.d>c.d?-1:1;side=want*(1-fwd/16)}}}
  A.side+=(side-A.side)*Math.min(1,dt*3);A.wob+=dt*.4;
  const look=7+sp*.42,i0=c.hint,ik=(i0+Math.round(look/TSTEP))%N,L=T.line[ik],P=T.pts[ik],off=(A.bias+Math.sin(A.wob)*.6)*.6+A.side*3.2;
  const tx=L.x+P.nx*off,ty=L.y+P.ny*off,lim=T.hw-1.4,dTarget=(tx-P.x)*P.nx+(ty-P.y)*P.ny,cl=Math.max(-lim,Math.min(lim,dTarget)),gx=P.x+P.nx*cl,gy=P.y+P.ny*cl;
  let ang=rwrap(Math.atan2(gy-c.y,gx-c.x)-c.a);
  const steer=Math.max(-1,Math.min(1,ang*2.6));
  // the speed for the next stretch: the slowest point a little ahead (the speed profile already brakes for what comes after)
  let vt=1e9;for(let k=0;k<=Math.round((4+sp*.35)/TSTEP);k++)vt=Math.min(vt,T.vmax[(i0+k)%N]);vt*=c.skill;
  // a little slower in a slide, and on grass or sand
  if(c.surfR!=='road'&&c.surfR!=='curb')vt*=.8;
  const u=c.u;let gas=0,brake=0;if(u<vt-.5)gas=1;else if(u>vt+1.8)brake=Math.min(1,(u-vt)/4);else gas=.35;
  if(Math.abs(c.beta)>.35){gas=Math.min(gas,.4)}
  return{gas,brake,steer,hb:0}}

/* ---------- a race ---------- */
// the starting grid: two columns behind the line, staggered. Index 0 is pole position
function raceGrid(T,n){const G=[];for(let i=0;i<n;i++){const row=Math.floor(i/2),col=i%2;G.push({s:-9-row*9.5-col*4.5,off:(col?1:-1)*T.hw*.42})}return G}
// cars: [{name,col,num,human,skill}]. Returns the race; raceStep moves it on by dt (in RSTEP steps)
function makeRace(T,entrants,laps){const grid=raceGrid(T,entrants.length);
  const cars=entrants.map((e,i)=>{const c=makeRaceCar({name:e.name,col:e.col,num:e.num,human:!!e.human,skill:e.skill||1,idx:i});const g=grid[i];placeRaceCar(c,T,g.s,g.off);c.prog=g.s;c.lap=0;return c});
  return{T,cars,laps,t:0,phase:'grid',acc:0,order:cars.slice(),finished:[]}}
// inputs: a function (car) → input for the human cars. Returns the events of this step
function raceStep(R,humanInput,dt){const ev=[];R.acc+=dt;let n=0;
  while(R.acc>=RSTEP&&n<30){R.acc-=RSTEP;n++;const go=R.phase==='race';if(go)R.t+=RSTEP;
    for(const c of R.cars){let inp;
      if(c.gone)continue;
      if(c.remote){if(R.remoteStep)R.remoteStep(c,RSTEP);continue}   // moved by the network (js/race.js)
      if(!go){c.vx=c.vy=c.w=0;c.thr=humanInput&&c.human?(humanInput(c).gas||0):0;continue}   // on the grid: the cars stand still until the lights go out
      else if(c.done&&c.human)inp={gas:0,brake:.4,steer:0,hb:0};
      else if(c.human)inp=humanInput(c);
      else{inp=aiInput(c,R.T,R.cars,RSTEP);if(c.done)inp.gas*=.6}
      stepRaceCar(c,inp,R.T,RSTEP)}
    raceCollide(R.cars);
    for(const c of R.cars){for(const e of c.ev){e.car=c;ev.push(e)}c.ev.length=0;
      if(!go||c.remote||c.gone)continue;c.lapT+=RSTEP;
      // a new lap: the progress passes the next whole lap
      const lp=Math.floor(c.prog/R.T.L);if(lp>c.lap&&!c.done){if(c.lap>=1||c.lapT>5){c.laps.push(c.lapT);const nb=c.best==null||c.lapT<c.best;if(nb)c.best=c.lapT;ev.push({type:'lap',car:c,lap:lp,t:c.lapT,best:nb})}
        c.lap=lp;c.lapT=0;if(lp>=R.laps){c.done=true;c.finT=R.t;R.finished.push(c);ev.push({type:'finish',car:c,place:R.finished.length,t:R.t})}}}
    // the order: finished cars first (in the order they finished), then by progress
    R.order=R.cars.filter(c=>!c.gone).sort((a,b)=>a.done&&b.done?a.finT-b.finT:a.done?-1:b.done?1:b.prog-a.prog)}
  if(n>=30)R.acc=0;return ev}
// the time a car still racing would have finished in: its average speed so far over what is left
function raceEstimate(R,c){if(c.done)return c.finT;const left=R.laps*R.T.L-c.prog,avg=Math.max(5,c.prog/Math.max(1,R.t));return R.t+left/avg}

if(typeof module!=='undefined')module.exports={RCFG,RSURF,makeTrack,trackAt,trackPos,makeRaceCar,placeRaceCar,stepRaceCar,raceCollide,aiInput,raceGrid,makeRace,raceStep,raceEstimate,TSTEP,RSTEP};
