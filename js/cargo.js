'use strict';
/* =================================================================
   CARGO: the cargo plane that carries your car between the islands.
   Every island has an airport (def.airport in data/levels/, built by c.airport in js/core.js; Trinnvik's own is in its level file).
   At one end of the runway stands a big four-engined cargo plane with its tail ramp down. Drive up the ramp and into the hold →
   «Hvor vil du fly?» → pick an island → you fly the plane yourself over the same sea as the boat race and the sightseeing flights (js/plane.js),
   land on that island's runway (or any other island's), brake to a stop → the island loads and you drive out of the hold. It costs nothing.
   The flight uses the machinery of js/plane.js (FL: the fade, the 60 Hz steps, the camera, the boat HUD's first pane, sound, the others at sea);
   the physics and the airports at sea are in js/planesim.js (PCARGO, seaAirports, cargoFinal, cargoWhere).
   Loaded after plane.js; uses the globals of game.js, world.js, boat.js and plane.js at run time.
   ================================================================= */
const CG_GEAR=2;   // the model's origin is this high over the ground (island units); PCARGO.gear is the same at sea
const _cv=new THREE.Vector3();

/* ---------- geometry helpers: a skin over rings of points, and many parts merged into one mesh per material ---------- */
// turn the faces of an indexed geometry away from `ref` (default: its own middle), then smooth normals
function cgOut(g,ref){const p=g.attributes.position,ix=g.index.array,c=ref||[0,0,0];if(!ref){for(let i=0;i<p.count;i++){c[0]+=p.getX(i)/p.count;c[1]+=p.getY(i)/p.count;c[2]+=p.getZ(i)/p.count}}
  let v=0;for(let i=0;i<ix.length;i+=3){const a=ix[i],b=ix[i+1],d=ix[i+2],ax=p.getX(a)-c[0],ay=p.getY(a)-c[1],az=p.getZ(a)-c[2],bx=p.getX(b)-c[0],by=p.getY(b)-c[1],bz=p.getZ(b)-c[2],dx=p.getX(d)-c[0],dy=p.getY(d)-c[1],dz=p.getZ(d)-c[2];
    v+=ax*(by*dz-bz*dy)+ay*(bz*dx-bx*dz)+az*(bx*dy-by*dx)}
  if(v<0)for(let i=0;i<ix.length;i+=3){const t=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=t}
  g.computeVertexNormals();return g}
// rings: [[[x,y,z],…],…], every ring the same count. o.open: the rings are strips, not loops; o.capA/o.capB: close the first/last ring; o.ref: a point inside
function cgLoft(rings,o={}){const n=rings[0].length,pos=[],idx=[],R=rings.slice(),mid=r=>{const c=[0,0,0];for(const q of r){c[0]+=q[0]/n;c[1]+=q[1]/n;c[2]+=q[2]/n}return r.map(()=>c)};
  if(o.capA)R.unshift(mid(R[0]));if(o.capB)R.push(mid(R[R.length-1]));
  for(const r of R)for(const q of r)pos.push(q[0],q[1],q[2]);
  const m=o.open?n-1:n;for(let i=0;i<R.length-1;i++)for(let j=0;j<m;j++){const a=i*n+j,b=i*n+(j+1)%n;idx.push(a,a+n,b,b,a+n,b+n)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);return cgOut(g,o.ref)}
// a body of revolution along z from [[radius, z],…]
function cgLathe(pts){const g=new THREE.LatheGeometry(pts.map(q=>new THREE.Vector2(Math.max(q[0],.0001),q[1])),16);g.rotateX(Math.PI/2);return cgOut(g)}
// parts are collected per material and become one mesh each: a plane is a dozen draw calls, however many details it has
function cgBucket(){const B=new Map(),m4=new THREE.Matrix4(),e=new THREE.Euler(),q=new THREE.Quaternion(),s=new THREE.Vector3(),p=new THREE.Vector3();
  return{put(mat,geo,x=0,y=0,z=0,rx=0,ry=0,rz=0,sc,col){const g=geo.index?geo.toNonIndexed():geo;m4.compose(p.set(x,y,z),q.setFromEuler(e.set(rx,ry,rz)),sc?s.set(sc[0],sc[1],sc[2]):s.set(1,1,1));g.applyMatrix4(m4);
      if(g!==geo)geo.dispose();if(col!=null)g.userData.col=new THREE.Color(col);let a=B.get(mat);if(!a)B.set(mat,a=[]);a.push(g)},
    build(parent){for(const[mat,list]of B){let n=0;for(const g of list)n+=g.attributes.position.count;const P=new Float32Array(n*3),N=new Float32Array(n*3);let o=0;
      const C=list.some(g=>g.userData.col)?new Float32Array(n*3):null;   // put(…, col): the colour goes in the vertices (for a material with vertexColors)
      for(const g of list){P.set(g.attributes.position.array,o);N.set(g.attributes.normal.array,o);const k=g.userData.col;if(C)for(let i=0;i<g.attributes.position.count;i++){C[o+i*3]=k?k.r:1;C[o+i*3+1]=k?k.g:1;C[o+i*3+2]=k?k.b:1}o+=g.attributes.position.count*3;g.dispose()}
      const G=new THREE.BufferGeometry();G.setAttribute('position',new THREE.BufferAttribute(P,3));G.setAttribute('normal',new THREE.BufferAttribute(N,3));if(C)G.setAttribute('color',new THREE.BufferAttribute(C,3));
      const m=new THREE.Mesh(G,mat);m.castShadow=true;m.receiveShadow=true;parent.add(m)}return parent}}}

/* ---------- the model: an Antonov An-124. Forward is −z, measures in island units (the hold is CARGO in js/core.js), ground at y = −CG_GEAR ----------
   What makes it an An-124: a high, swept wing that droops towards the tips (anhedral), four big turbofans on pylons ahead of the wing,
   the flight deck high above a round nose that is a visor, a chin radome, two twin nose wheels side by side, five pairs of main wheels in a row
   under a blister on each side, a rear fuselage swept up over the ramp, one tall swept fin and the tailplane low on the fuselage (no T-tail).
   The fuselage is shorter and fatter than the real one: the hold has to take the car. */
function cgMesh(hex){const g=new THREE.Group();g.rotation.order='YXZ';const b=new THREE.Group();b.position.y=-CG_GEAR;g.add(b);const K=CARGO,top=new THREE.Group();b.add(top);
  const std=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.5},o||{})),lit=c=>new THREE.MeshBasicMaterial({color:c});
  const mW=std(0xf1f0ea,{side:THREE.DoubleSide}),mW2=std(0xf1f0ea),mP=std(LIN(hex),{roughness:.4,metalness:.1}),mP2=std(LIN(hex),{roughness:.4,metalness:.1}),mD=std(0x1d1f22,{roughness:.6}),mD2=std(0x1d1f22,{roughness:.6}),
    mG=std(0x1b2a33,{roughness:.08,metalness:.7}),mF=std(0x6c7278,{roughness:.8}),mI=std(0xc9cdd0,{roughness:.9,side:THREE.DoubleSide}),mE=std(0xd3d6d9,{roughness:.35,metalness:.35}),mS=std(0x7b8087,{roughness:.35,metalness:.7}),
    mH=std(0x9aa0a6,{roughness:.5,metalness:.4}),mL=lit(0xfff0c0),mRed=lit(0xff3030),mGrn=lit(0x30ff60),mWht=lit(0xffffff);
  const Bb=cgBucket(),Bt=cgBucket(),Br=cgBucket(),Bd=cgBucket(),box=(w,h,d)=>new THREE.BoxGeometry(w,h,d),cyl=(r0,r1,h,n=14)=>new THREE.CylinderGeometry(r0,r1,h,n),H=Math.PI/2;
  const L=K.half*2+.4,zc=-.2,R=K.hw+.37,ry=K.floor+1.9,z0=zc-L/2,z1=K.half;   // the hold: from the ramp's top (z1) to the bulkhead (z0); R: the fuselage's radius, ry: where its round roof begins
  const lerp=(a,c,t)=>a+(c-a)*t,row=(T,s)=>{const i=Math.min(T.length-2,Math.max(0,Math.floor(s))),f=s-i;return T[i].map((v,k)=>lerp(v,T[i+1][k],f))};

  // --- the hold: floor and belly, the walls, the bulkhead, the lamps ---
  Bb.put(mF,box(K.hw*2+.6,.4,L),0,K.floor-.2,zc);for(let z=-3;z<=3;z+=1.5)Bb.put(mD,box(K.hw*2,.012,.05),0,K.floor+.006,z+zc);
  for(const s of[-1,1]){Bb.put(mI,box(.2,1.9,L),s*(K.hw+.25),K.floor+.95,zc);Bb.put(mW2,box(.04,1.9,L),s*(K.hw+.37),K.floor+.95,zc);
    Bb.put(mP,box(.05,.36,L),s*(K.hw+.4),K.floor+1.25,zc);Bb.put(mD,box(.05,.05,L),s*(K.hw+.4),K.floor+.98,zc);   // the cheatline in your paint, a pinstripe under it
    for(const z of[-2.4,0,2.4])Bb.put(mL,box(.03,.1,.9),s*(K.hw+.13),K.floor+1.75,z+zc)}
  Bb.put(mI,box(K.hw*2+.5,1.9,.14),0,K.floor+.95,z0-.07);Bb.put(mI,new THREE.CircleGeometry(K.hw+.33,14,0,Math.PI),0,K.floor+1.9,z0-.02);
  // the roof over the hold: half a tube. It fades away while the car is inside, so you can see where you are driving
  {const roof=new THREE.CylinderGeometry(R,R,L,18,1,true,H,Math.PI);roof.rotateX(H);Bt.put(mW,roof,0,ry,zc)}

  // --- the fuselage's section, belly to crown (the right half), and the skin drawn through it ---
  const PR=[[0,.15],[1.15,.15],[1.7,.3],[R,.75],[R,K.floor+1.07],[R,K.floor+1.43],[R,ry],[R*.924,ry+R*.383],[R*.707,ry+R*.707],[R*.383,ry+R*.924],[0,ry+R]],yB=.15,yT=ry+R;
  const prof=u=>{u=((u%20)+20)%20;const sg=u>10?-1:1,v=u>10?20-u:u,i=Math.min(9,Math.floor(v)),f=v-i;return[sg*lerp(PR[i][0],PR[i+1][0],f),lerp(PR[i][1],PR[i+1][1],f)]};
  // the nose: [how far forward 0–1, crown, belly, half width, how round]. The crown stays high to the flight deck, falls down the windscreen and rounds off in the radome
  const NS=[[0,yT,.15,R,0],[.12,yT,.2,R,.1],[.27,yT-.03,.34,R-.02,.3],[.35,yT-.2,.43,R-.06,.45],[.5,3.45,.62,1.7,.7],[.63,3.12,.8,1.54,.85],[.75,2.82,1,1.32,1],[.85,2.5,1.2,1.04,1],[.92,2.22,1.4,.76,1],[.972,1.98,1.58,.46,1],[1,1.78,1.78,0,1]],LN=4.15;
  const nose=(s,u,k=1)=>{const[t,tp,bt,w,rd]=row(NS,s),[x,y]=prof(u),yc=(tp+bt)/2,a=Math.atan2((y-(yB+yT)/2)/((yT-yB)/2),x/R),sx=x/R*w,sy=bt+(y-yB)/(yT-yB)*(tp-bt);
    return[lerp(sx,Math.cos(a)*w,rd)*k,yc+(lerp(sy,yc+Math.sin(a)*(tp-bt)/2,rd)-yc)*k,z0-t*LN]};
  const span=(a,c,n)=>Array.from({length:n+1},(_,i)=>lerp(a,c,i/n)),patch=(s0,s1,u0,u1,k,ns=2,nu=2)=>cgLoft(span(s0,s1,ns).map(s=>span(u0,u1,nu).map(u=>nose(s,u,k))),{open:true,ref:[0,2.2,z0-LN*.4]});
  Bb.put(mW2,cgLoft(NS.map((_,i)=>span(0,19.5,39).map(u=>nose(i,u)))));
  Bb.put(mD,cgLoft([2.02,2.1].map(s=>span(0,19.5,39).map(u=>nose(s,u,1.004)))));   // the seam of the visor: the whole nose swings up
  for(const[u0,u1,s0,s1]of[[9.06,9.96,3.14,3.9],[10.04,10.94,3.14,3.9],[8.06,8.96,3.1,3.86],[11.04,11.94,3.1,3.86],[7.15,7.96,2.5,3.5],[12.04,12.85,2.5,3.5]])Bb.put(mG,patch(s0,s1,u0,u1,1.012));   // the windows of the flight deck
  for(const[u0,u1]of[[4,5],[15,16]])Bb.put(mP,patch(0,7.4,u0,u1,1.008,10));   // the cheatline runs on round the nose
  Bb.put(mH,new THREE.SphereGeometry(1,12,8),0,.98,z0-LN*.7,0,0,0,[.46,.2,.8]);   // the chin radome

  // --- the rear fuselage: swept up over the ramp. [how far back 0–1, half width, crown, underside, where the doors meet it] ---
  const TS=[[0,R,yT,ry,yB],[.15,1.8,yT,2.6,.55],[.35,1.55,yT-.02,2.95,1.35],[.55,1.2,yT-.08,3.3,2.3],[.75,.8,yT-.17,3.6,3.2],[.9,.48,yT-.24,3.78,3.7],[1,.14,yT-.32,3.9,3.9]],LT=6.3;
  Bt.put(mW,cgLoft(TS.map(([t,w,tp,ub])=>[6,7,8,9,10,11,12,13,14].map(u=>{const[x,y]=prof(u);return[x/R*w,ub+(y-ry)/R*(tp-ub),z1+t*LT]})),{capB:true}));
  Bt.put(mS,cyl(.09,.07,.3,8),0,3.96,z1+LT+.08,H);   // the APU's exhaust in the tail cone
  // in the air the doors under the tail are shut: the underside sweeps up from the belly to the tail cone
  Bd.put(mW2,cgLoft(TS.map(([t,w,tp,ub,db])=>[6,5,4,3,2,1,0,19,18,17,16,15,14].map(u=>{const[x,y]=prof(u);return[x/R*w,db+(y-yB)/(ry-yB)*(ub-db),z1+t*LT]})),{capA:true}));
  Bd.put(mD,box(.03,.03,4.2),0,1.42,z1+2.1,-.62);   // where the two doors meet

  // --- wing, fin and tailplane: skins over an aerofoil ---
  const AF=[[1,0],[.66,.5],[.32,1],[.08,.68],[0,0],[.08,-.5],[.36,-.7],[.7,-.36]];
  const foil=(ST,f)=>cgLoft(ST.map(S=>AF.map(([c,h])=>f(S,c,h))),{capA:true,capB:true});
  // the wing: [out from the middle, height, leading edge, chord, half thickness]. Swept back and drooping: the tips hang lower than the root
  const WS=[[0,4.3,-3.25,3.6,.27],[1.7,4.3,-3.25,3.6,.27],[4,4.1,-1.98,2.75,.2],[9.5,3.62,1.05,1.05,.09]],wAt=x=>{let i=1;while(i<WS.length-2&&WS[i+1][0]<x)i++;return WS[i].map((v,k)=>lerp(v,WS[i+1][k],(x-WS[i][0])/(WS[i+1][0]-WS[i][0])))};
  Bt.put(mW,new THREE.SphereGeometry(1,14,8),0,4.36,-1.5,0,0,0,[1.5,.42,2.7]);   // the fairing over the wing's middle
  for(const s of[-1,1]){Bt.put(mW,foil(WS,(S,c,h)=>[s*S[0],S[1]+h*S[4],S[2]+c*S[3]]));
    Bt.put(mP2,foil([wAt(8.9),wAt(9.52)],(S,c,h)=>[s*S[0],S[1]+h*(S[4]+.012),S[2]-.02+c*(S[3]+.04)]));Bt.put(s<0?mRed:mGrn,new THREE.SphereGeometry(.09,8,6),s*9.55,3.62,1.3);   // the tip in your paint, red light to port and green to starboard
    for(const x of[2.7,4.9,7.3,8.5]){const W=wAt(x);Bt.put(mW,new THREE.SphereGeometry(1,8,6),s*x,W[1]-W[4]*.5-.07,W[2]+W[3]-.32,0,0,0,[.1,.12,.7])}   // the flap track fairings
    for(const[x0,x1,c]of[[1.9,5.4,.7],[5.6,9,.72]]){const A=wAt(x0),C=wAt(x1),za=A[2]+A[3]*c,zb=C[2]+C[3]*c,ya=A[1]+A[4]*.52,yb=C[1]+C[4]*.52,len=Math.hypot(x1-x0,zb-za);
      Bt.put(mD2,box(len,.012,.035),s*(x0+x1)/2,(ya+yb)/2+.012,(za+zb)/2,0,-s*Math.atan2(zb-za,x1-x0),s*Math.atan2(yb-ya,x1-x0))}   // where the flaps and the ailerons begin
    // the engines: D-18T turbofans. A short, fat fan cowl with the core and its cone sticking out behind, hung on a pylon ahead of and below the wing
    for(const x of[3.5,6.1]){const W=wAt(x),ey=W[1]-W[4]*.7-.8,ez=W[2]-1.45,ph=W[1]-W[4]*.6-(ey+.5);
      Bb.put(mE,cgLathe([[.4,.12],[.47,0],[.535,.08],[.57,.4],[.56,.9],[.49,1.36],[.44,1.36]]),s*x,ey,ez);Bb.put(mP,cgLathe([[.537,.085],[.576,.34],[.578,.46],[.574,.34]]),s*x,ey,ez);
      Bb.put(mD,new THREE.CircleGeometry(.43,16),s*x,ey,ez+.12,0,Math.PI);Bb.put(mH,new THREE.ConeGeometry(.15,.26,10),s*x,ey,ez+.05,-H);
      for(let k=0;k<9;k++)Bb.put(mH,box(.035,.3,.01),s*x+Math.sin(k*.698)*.27,ey+Math.cos(k*.698)*.27,ez+.11,0,0,-k*.698);   // the fan
      Bb.put(mS,cgLathe([[.37,1.3],[.34,1.78],[.26,1.98],[.2,1.98]]),s*x,ey,ez);Bb.put(mD,cgLathe([[.2,1.9],[.1,2.2],[0,2.42]]),s*x,ey,ez);
      const py=box(.13,ph+.16,1.5),pp=py.attributes.position;for(let i=0;i<pp.count;i++)pp.setZ(i,pp.getZ(i)+(pp.getY(i)/(ph+.16)+.5)*.75);py.computeVertexNormals();Bt.put(mW,py,s*x,ey+.48+ph/2,ez+.95)}
    // the tailplane: low on the rear fuselage, swept
    Bt.put(mW,foil([[.3,3.98,6.75,2.7,.11],[3.9,4.02,8.75,1.2,.06]],(S,c,h)=>[s*S[0],S[1]+h*S[4],z1-3.6+S[2]+c*S[3]]));Bt.put(mD2,box(3.4,.01,.03),s*2.15,4.075,z1-3.6+9.3,0,-s*.33,0)}
  // the fin: tall and swept, with a fillet running forward along the back
  Bt.put(mP2,foil([[yT-.5,4.3,4.9,.1],[yT+.25,5.75,3.5,.16],[8.1,8.2,1.75,.08]],(S,c,h)=>[h*S[3],S[0],z1-3.6+S[1]+c*S[2]]));
  Bt.put(mD2,box(.02,3.5,.035),.13,6.35,z1-3.6+9.05,-.3);Bt.put(mD2,box(.02,3.5,.035),-.13,6.35,z1-3.6+9.05,-.3);   // the rudder's hinge
  Bt.put(mWht,new THREE.SphereGeometry(.07,8,6),0,3.98,z1+LT+.25);Bt.put(mRed,new THREE.SphereGeometry(.08,8,6),0,4.8,-1.5);   // the white tail light and the red beacon
  for(const z of[-3.5,1.6])Bt.put(mD2,box(.03,.2,.3),0,z<0?yT+.08:yT+.3,z,-.3);   // aerials

  // --- the undercarriage: five pairs of main wheels in a row under a blister on each side, two twin nose wheels side by side ---
  const wheel=(x,y,z,r,w)=>{Bb.put(mD,cyl(r,r,w,14),x,y,z,0,0,H);Bb.put(mH,cyl(r*.48,r*.48,w+.03,10),x,y,z,0,0,H)};
  for(const s of[-1,1]){Bb.put(mW2,new THREE.SphereGeometry(1,14,10,s>0?H:-H,Math.PI),s*(R-.02),.98,zc,0,0,0,[.62,.6,3.1]);
    for(const z of[-1.7,-.85,0,.85,1.7])wheel(s*(K.hw+.72),.36,z+zc,.36,.3);
    for(const dx of[-.15,.15])wheel(s*.56+dx,.3,z0-LN*.47,.3,.15);Bb.put(mH,box(.09,.5,.09),s*.56,.5,z0-LN*.47)}

  // --- the ramp (down on the island) and the doors that close the hold in the air ---
  const ramp=new THREE.Group();ramp.position.set(0,K.floor,K.half);ramp.rotation.x=Math.atan2(K.floor-.02,K.ramp);b.add(ramp);Br.put(mF,box(K.hw*2,.1,K.ramp+.1),0,-.05,K.ramp/2);
  for(const s of[-1,1])Br.put(mP,box(.12,.16,K.ramp),s*(K.hw-.06),.03,K.ramp/2);for(let z=.5;z<K.ramp;z+=.6)Br.put(mD,box(K.hw*2-.4,.03,.06),0,.01,z);
  const door=new THREE.Group();door.visible=false;b.add(door);
  Bb.build(b);Bt.build(top);Br.build(ramp);Bd.build(door);
  // the same handles as the small plane, so the flight code can treat them alike: nothing spins on a jet
  g.userData={prop:new THREE.Group(),disc:{material:{opacity:0}},paint:[mP,mP2],top:[mW,mP2,mD2],ramp,door,fade:1};return g}
// the cargo plane at sea: the same model at the sea's scale, ramp up and door shut
function cgSeaMesh(hex){const m=cgMesh(hex);m.scale.setScalar(CARGO_SEA);m.userData.ramp.visible=false;m.userData.door.visible=true;return m}

/* ---------- on the island: the plane at the end of the runway, its ramp down ---------- */
function cargoIsland(A,g){const C=A.cargo,m=cgMesh((PAINTS[prof.paint]||PAINTS[0]).c);m.position.set(C.x,C.y+CG_GEAR,C.z);m.rotation.y=C.yaw+Math.PI;g.add(m);FL.airport.cargo=m}
// where the car is in the plane's own frame: u along the hold (nose is +), v across
function cargoUV(){const A=LV&&LV.airportDef,C=A&&A.cargo;if(!C||!car)return null;const rx=car.pos.x-C.x,rz=car.pos.z-C.z;return{C,u:rx*C.ux+rz*C.uz,v:rx*C.uz-rz*C.ux}}
// in the hold, well past the top of the ramp: this is where the question comes
function cargoInHold(){const q=cargoUV();return!!q&&q.u>-q.C.half+1.3&&q.u<q.C.half+.4&&Math.abs(q.v)<q.C.hw&&car.pos.y>q.C.fy-.25&&car.pos.y<q.C.fy+2}
// anywhere in the plane or on its ramp
function cargoNear(){const q=cargoUV();return!!q&&q.u>-q.C.half-q.C.ramp-.4&&q.u<q.C.half+.6&&Math.abs(q.v)<q.C.hw+.5}
// the roof, the tail and the wing fade away while the car is on the ramp or in the hold
function cargoAnim(){const M=FL.airport,m=M&&M.cargo;if(!m)return;const U=m.userData,want=cargoNear()&&state.mode!=='menu'&&state.mode!=='garage'?.14:1;if(Math.abs(U.fade-want)<.004)return;
  U.fade+=(want-U.fade)*.14;if(Math.abs(U.fade-want)<.004)U.fade=want;for(const mat of U.top){const tr=U.fade<.995;if(mat.transparent!==tr){mat.transparent=tr;mat.needsUpdate=true}mat.opacity=U.fade;mat.depthWrite=!tr}}

/* ---------- what stands on an airport at sea, as you see it from the air (the same things as on the island, js/core.js c.ap…): the runway's side lines, number,
   aiming point, threshold and approach lights and PAPI; posts, doors and roof units on the terminal; a gallery, a radar and a mast on the tower; a hangar, fuel tanks,
   freight, parked light aircraft, a fuel truck, floodlights and a windsock. Everything is two meshes (lit and unlit) with the colours in the vertices.
   They go in a group of their own (G), beside the airport's: the plane's ground is found with a ray through the airport's group, and nobody should land on a fuel tank.
   Coordinates are the airport group's: the runway runs along z; o.face (1 or −1) is the way from the terminal towards the runway, (o.wx,o.wz) is +z in the world. ---------- */
function cgSeaKit(G,o){const S=cgBucket(),U=cgBucket(),mS=bStd(0xffffff,{vertexColors:true}),mU=new THREE.MeshBasicMaterial({vertexColors:true}),top=o.top,f=o.face,H=Math.PI/2,x=o.rx,hw=o.hw,Wt=0xf4f4f0;
  const box=(B,px,y,pz,w,h,d,col,ry=0,rx=0,rz=0)=>B.put(B===S?mS:mU,new THREE.BoxGeometry(w,h,d),px,top+y,pz,rx,ry,rz,null,col),
    cyl=(px,y,pz,r0,r1,h,col,n=10,rx=0)=>S.put(mS,new THREE.CylinderGeometry(r1,r0,h,n),px,top+y,pz,rx,0,0,null,col);
  // the runway
  for(const sd of[-1,1])box(U,x+sd*(hw-1),.46,(o.z0+o.z1)/2,.7,.12,o.z1-o.z0-4,Wt);
  for(const[ze,d]of[[o.z0,1],[o.z1,-1]]){const deg=Math.atan2(d*o.wx,-d*o.wz)*180/Math.PI,num=((Math.round(deg/10)+35)%36+36)%36+1;   // at sea −z is north and +x east
    [Math.floor(num/10),num%10].forEach((n,i)=>{for(const ch of AP_DIG[n]){const[u,v,sw,sh]=AP_SEG[ch];box(U,x-d*((i-.5)*.9+u)*6,.46,ze+d*(19.5+v*6),sw*6,.12,sh*6,Wt)}});
    for(const sd of[-1,1])box(U,x+sd*hw*.5,.46,ze+d*52,2.6,.12,14,Wt);
    for(let k=-3;k<=3;k++)box(U,x+k*hw*.28,.6,ze-d*1.6,1,.8,1,0x4ade80);for(let k=-2;k<=2;k++)box(U,x+k*4.5,.9,ze-d*6.5,1.1,1.1,1.1,0xfff3c0);
    for(let i=0;i<4;i++){box(U,x+f*(hw+4.5+i*2.4),1.5,ze+d*46,1.6,1,2,i<2?0xfff3c0:0xff5040);box(S,x+f*(hw+4.5+i*2.4),.5,ze+d*46,.4,1,.4,0x5a6066)}}
  // the terminal: posts between the windows, the doors under a canopy, units on the roof
  {const T=o.T,tf=T.x+f*7.3;for(let q=-T.len/2+3;q<=T.len/2-2.9;q+=4)box(S,tf,T.wy,T.z+q,.5,T.wh,.7,0xe9dcb9);
    box(S,tf+f*.1,1.8,T.z,.5,3.6,5.4,0x5a6066);box(S,tf+f*2.2,3.9,T.z,5,.5,9.4,0x3f4a52);for(const q of[-4,4])cyl(tf+f*4.2,1.95,T.z+q,.25,.25,3.9,0x5a6066,6);
    box(S,T.x-f*2.5,T.h+2.2,T.z-T.len*.3,4,2,6,0x8a9096);box(S,T.x-f*2,T.h+2,T.z+T.len*.3,3,1.6,3,0x8a9096)}
  // the tower: a gallery under the cab, a red band round the shaft, a mast with a red light, a radar and a green beacon on the roof
  {const W=o.W;cyl(W.x,W.sh-.3,W.z,7.4,7.4,.6,0x8a9096,12);cyl(W.x,W.sh-6,W.z,3.9,3.75,2.2,0xd9432f,12);cyl(W.x,.5,W.z,4.6,4.4,1,0x8a8272,12);
    cyl(W.x-3,W.roof+4,W.z-3,.2,.2,8,0xe9e6df,5);box(U,W.x-3,W.roof+8.4,W.z-3,.9,.9,.9,0xff5040);cyl(W.x+2.5,W.roof+1,W.z+2.5,.28,.28,2,0x5a6066,5);box(S,W.x+2.5,W.roof+2.9,W.z+2.5,4.6,2.2,.4,0xe9e6df,.6,-.3);
    box(U,W.x,W.roof+.5,W.z,1.3,1,1.3,0x4ade80)}
  if(o.apron){const a=o.apron;box(S,a.x,.15,a.z,a.w,.3,a.len,0x8a8a86);box(U,a.x,.36,a.z,.5,.1,a.len-10,0xf2c230)}
  if(o.hangar){const[hx,hz]=o.hangar;box(S,hx,4.5,hz,16,9,20,0x8a9096);for(const sd of[-1,1])box(S,hx+sd*4.1,10.2,hz,9.2,.8,21,0x5a6066,0,0,-sd*.33);
    box(S,hx+f*8.05,3.9,hz,.4,7.6,14,0x3a3f44);box(S,hx+f*8.1,8.1,hz,.5,.7,15,0xe5a92b)}
  if(o.tanks){const[tx,tz]=o.tanks;for(const q of[-4,4]){cyl(tx,3,tz+q,3,3,6,0xe9e6df,12);cyl(tx,4,tz+q,3.06,3.06,.9,0xd9432f,12);cyl(tx,6.2,tz+q,2.2,2.2,.4,0xc9cdd0,12)}box(S,tx+f*2,1.5,tz,.4,.4,8,0x8a9096)}
  if(o.cargo){const[cx,cz]=o.cargo;box(S,cx,1.65,cz,3.3,3.3,7.4,0x2c6fb0);box(S,cx,1.65,cz+8.4,3.3,3.3,7.4,0xc8463a);box(S,cx,4.95,cz+7.8,3.3,3.3,7.4,0x3f8f5a);box(S,cx+f*4.6,1.65,cz+3,3.3,3.3,7.4,0xe5a92b,.3);
    box(S,cx+f*4.4,.9,cz+10.5,1.8,1.4,2.8,0xff8a2a);box(S,cx+f*4.4,1.9,cz+12,1.6,3.6,.3,0x3a3d40)}
  // light aircraft parked on the apron: high wing, a fin in colour
  for(const[px,pz,yaw,col]of o.parked||[]){const c=Math.cos(yaw),s=Math.sin(yaw),P=(dz,y,w,h,d,cl)=>box(S,px+dz*s,y,pz+dz*c,w,h,d,cl,yaw);
    P(0,1.9,1.5,1.5,8.5,0xf4f2ec);P(-1,2.85,12,.3,2,col);P(3.7,3.3,.3,2,1.5,col);P(3.8,2.4,4.4,.25,1.3,0xf4f2ec);P(-2,2.5,1.55,.7,1.8,0x1a262d);P(-4.4,1.9,.25,2.6,.2,0x1d1f22);P(-1.2,.6,3,.5,.6,0x1d1f22)}
  if(o.truck){const[tx,tz]=o.truck;box(S,tx,.9,tz,2.6,.8,8.4,0x3a3d40);box(S,tx,2.3,tz+3,2.7,2.4,2.2,0xf2c230);cyl(tx,2.5,tz-1.2,1.25,1.25,5.4,0xc9cdd0,10,H)}
  for(const[mx,mz]of o.masts||[]){cyl(mx,9,mz,.3,.24,18,0x8a9096,5);box(U,mx,18.2,mz,3,.6,1,0xfff3c0);box(S,mx,18.7,mz,3.2,.3,1.2,0x3a3d40)}
  if(o.sock){const[sx,sz]=o.sock;cyl(sx,8,sz,.4,.35,16,0xe9e6df,6);for(let i=0;i<4;i++)cyl(sx,15.5-i*.22,sz+1+i*2,1.6-i*.24,1.36-i*.24,2,i%2?0xf4f4f0:0xff6a2a,8,H)}
  S.build(G);U.build(G);for(const m of G.children)m.castShadow=m.material===mS;return G}

/* ---------- the airports of the other islands at sea (Trinnvik's own is fAirportSea in js/plane.js) ---------- */
function cgSeaAirports(){const lamp=new THREE.MeshStandardMaterial({color:0xfff3c0,emissive:0xffd27a,emissiveIntensity:1.2}),red=new THREE.MeshStandardMaterial({color:0xff5040,emissive:0xff2010,emissiveIntensity:1.2}),white=new THREE.MeshBasicMaterial({color:0xf4f4f0});
  for(const A of seaAirports()){if(A.own)continue;const g=new THREE.Group(),top=A.top;g.position.set(A.lx,0,A.lz);g.rotation.y=Math.atan2(A.hx,A.hz);   // local +z is the way you take off, local +x is across
    const off=(A.cx-A.lx)*A.hz-(A.cz-A.lz)*A.hx,in_=off>0?-1:1,look=A.island.look,ground=look==='vinter'||look==='svalbard'?0xe8eef4:look==='orken'||look==='sand'?0xd9c08a:0x6f9a48;
    bAdd(g,new THREE.BoxGeometry(A.ld*2+6,12,A.ll*2+6),bStd(0x8a8a86),0,top-8,0,false);bAdd(g,new THREE.BoxGeometry(A.ld*2,3,A.ll*2),bStd(ground),0,top-1.5,0,false);
    bAdd(g,new THREE.BoxGeometry(A.hw*2,.4,A.hl*2),bStd(0x3a3d40),off,top+.2,0,false);
    for(let z=-A.hl+30;z<A.hl-26;z+=22)bAdd(g,new THREE.BoxGeometry(1.2,.12,10),white,off,top+.45,z,false);
    for(const zz of[-A.hl+8,A.hl-8])for(let k=-4;k<=4;k++)if(k)bAdd(g,new THREE.BoxGeometry(2,.12,12),white,off+k*3,top+.45,zz,false);
    for(let z=-A.hl;z<=A.hl;z+=25)for(const x of[off-A.hw-1.5,off+A.hw+1.5])bAdd(g,new THREE.BoxGeometry(1,1,1),Math.abs(z)>A.hl-5?red:lamp,x,top+.5,z,false);
    // the terminal with the island's name on the roof, and the tower, on the island side of the runway and well ahead of where the plane stands
    const tx=in_*(A.ld-12),tz=40;bAdd(g,new THREE.BoxGeometry(14,10,44),bStd(0xe9dcb9),tx,top+5,tz);bAdd(g,new THREE.BoxGeometry(15,1.2,45),bStd(0x3f4a52),tx,top+10.6,tz,false);bAdd(g,new THREE.BoxGeometry(.4,3.4,38),bStd(0x1a262d),tx-in_*7.05,top+6,tz,false);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(46,9),new THREE.MeshBasicMaterial({map:bText(A.name.toUpperCase()+' LUFTHAVN',512,104,'54px "Saira Stencil One", Impact, sans-serif','#14120E','#E5A92B','#14120E'),side:THREE.DoubleSide}));
    sign.position.set(tx,top+16,tz);sign.rotation.y=Math.PI/2;g.add(sign);
    bAdd(g,new THREE.CylinderGeometry(3.2,3.8,26,10),bStd(0xf2e8d0,{flatShading:false}),tx,top+13,tz+52);bAdd(g,new THREE.BoxGeometry(9.5,5.5,9.5),new THREE.MeshStandardMaterial({color:0x1a262d,roughness:.1,metalness:.5}),tx,top+28.5,tz+52);bAdd(g,new THREE.BoxGeometry(11,1.2,11),bStd(0xd9432f),tx,top+31.8,tz+52,false);
    {const g2=new THREE.Group(),fc=-in_,xa=tx+fc*7.2,xb=off-fc*A.hw,ax=(xa+xb)/2;g2.position.copy(g.position);g2.rotation.y=g.rotation.y;   // the details (cgSeaKit above)
      cgSeaKit(g2,{top,face:fc,rx:off,hw:A.hw,z0:-A.hl,z1:A.hl,wx:A.hx,wz:A.hz,T:{x:tx,z:tz,len:44,h:10,wy:6,wh:3.4},W:{x:tx,z:tz+52,sh:26,roof:32.4},apron:{x:ax,w:Math.abs(xb-xa),z:tz,len:70},
        hangar:[tx-fc,-22],tanks:[tx-fc*2,-50],cargo:[tx+fc*3,-114],parked:[[ax,tz-22,.5,0xc8463a],[ax,tz+20,-.5,0x2c6fb0]],truck:[ax-fc*2.5,tz-2],masts:[[tx+fc*8.5,tz-32],[tx+fc*8.5,tz+32]],sock:[off+fc*(A.hw+9),70]});BT.scene.add(g2)}
    BT.scene.add(g);g.updateMatrixWorld(true);BT.isl.push({I:{x:A.lx,z:A.lz,r:Math.hypot(A.ll,A.ld)+8},g})}}   // (the matrices now, not at the first frame: the ground under the plane is found with a ray before that)

/* ---------- the way in to the island you are flying to: three hoops down the final approach and a beam of light over the runway ---------- */
function cgGuide(B){if(FL.guide){BT.scene.remove(FL.guide);bDispose(FL.guide);FL.guide=null}if(!B||!BT.scene)return;const F=cargoFinal(B),g=new THREE.Group(),G=B.top+PCARGO.gear;
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(22,22,700,16,1,true),new THREE.MeshBasicMaterial({color:0xffc84a,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide,fog:false}));beam.position.set(B.cx,B.top+350,B.cz);g.add(beam);
  const lab=new THREE.Mesh(new THREE.PlaneGeometry(150,30),new THREE.MeshBasicMaterial({map:bText(B.name.toUpperCase(),512,104,'64px "Saira Stencil One", Impact, sans-serif','#14120E','#E5A92B','#14120E'),side:THREE.DoubleSide,fog:false}));lab.position.set(B.cx,B.top+150,B.cz);g.add(lab);g.userData.lab=lab;
  if(F.out){const geo=new THREE.TorusGeometry(62,3,8,36);for(const u of[1,.58,.22]){const d=F.out*u,m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0xe5a92b,emissive:0xffb300,emissiveIntensity:.7,roughness:.4}));
    m.position.set(F.tx-F.hx*d,G+12+(F.y-G-12)*u,F.tz-F.hz*d);m.rotation.y=Math.atan2(F.hx,F.hz);g.add(m)}}
  BT.scene.add(g);FL.guide=g}

/* ---------- the question in the hold, and the trip ---------- */
function cargoAsk(){const here=LEVELS[state.levelIdx];$('aName').textContent='Lasteflyet';$('aKind').textContent=here.name+' lufthavn';
  $('aDesc').textContent='Hvor vil du fly? Du flyr selv, bilen står trygt i lasterommet, og turen er gratis.';$('aBest').textContent='';$('aQ').textContent='';
  const P=typeof NET!=='undefined'&&NET.on?[...NET.players.values()]:[],dests=seaAirports().filter(A=>A.id!==here.id).map(A=>LEVELS.find(l=>l.id===A.id)).filter(l=>l&&isIsland(l));
  $('aList').innerHTML=dests.map(l=>{const fr=P.filter(p=>p.lv===l.id).map(p=>p.name).join(', ');return`<button data-dest="${l.id}"><span><span class="nm">${l.name}</span>${fr?'<span class="sub">Her er '+fr+'</span>':''}</span><span class="pr">✈</span></button>`}).join('');
  $('aList').classList.add('two');$('aList').hidden=false;$('aYes').hidden=true;$('aNo').textContent='Bli her';$('ask').hidden=false}
function cargoAnswer(yes){state.askCool='cargo';state.mode='play';if(yes&&yes.dest)cargoStart(yes.dest);else toast('Rygg ut når du vil')}
function cargoStart(destId){const A=seaAirport(LEVELS[state.levelIdx].id),B=seaAirport(destId);if(!A||!B||FL.on||FL.fade||BT.on||BT.fade)return;
  initAudio();if(AC&&AC.state==='suspended')AC.resume();state.mode='fly';car.vel.set(0,0,0);car.w.set(0,0,0);car.throttle=0;setOffer(null);if(typeof gpsStop==='function'&&typeof GPS!=='undefined'&&GPS.dest)gpsStop();
  $('fade').classList.add('on');FL.fade={t:0,hold:.2,cb:()=>{buildSea();bShadowSize();fHideBoats();if(!FL.cam)FL.cam=new THREE.PerspectiveCamera(60,1,1,B_FAR);FL.on=true;$('hud').hidden=true;$('hint').hidden=true;
    const H=$('boatHud');H.hidden=false;H.classList.add('fly');H.classList.remove('two','won','menu');$('bpane1').hidden=true;$('bdiv').hidden=true;$('bpane0').querySelector('.bplace').hidden=true;$('flyMenu').hidden=true;$('flyPause').hidden=true;
    fLayout();cgSetup(A,B);FL.phase='fly';fNotice('Hold gass for å ta av · kurs mot '+B.name,3200);cgHUD()}}}
// on the runway of the island you leave, nose down the runway; the way in to the island you fly to is lit up
function cgSetup(A,B){const paint=(PAINTS[prof.paint]||PAINTS[0]).c;FL.cargo={from:A,dest:B,fin:false,done:false,warn:false};FL.flight=null;FL.route={flight:null,rings:[],start:A.start};fRings(FL.route);FL.pl=makeCargo(A);
  if(!FL.big){FL.big=cgSeaMesh(paint);BT.scene.add(FL.big)}else fPaint(FL.big,paint);if(FL.small)FL.small.visible=false;FL.mesh=FL.big;FL.mesh.visible=true;cgGuide(B);
  FL.camYaw=A.start.a;FL.camPitch=0;FL.time=0;FL.acc=0;FL.took=false;FL.landed=false;FL.result=false;FL.paused=false;FL.res=null;FL.inp=null;fPose(0);FL.snap=true}
// back from the sea: the flight's things are put away (what flyExit does for the small plane)
function cgLeave(){FL.on=false;FL.phase='';FL.result=false;FL.paused=false;FL.cargo=null;cgGuide(null);if(FL.snd)FL.snd.master.gain.setTargetAtTime(0,AC.currentTime,.1);if(BT.snd)BT.snd.master.gain.setTargetAtTime(0,AC.currentTime,.1);
  const H=$('boatHud');H.hidden=true;H.classList.remove('fly','menu','won');$('flyMenu').hidden=true;$('flyPause').hidden=true;renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight)}
// you have landed (or skipped the flight): the island loads, and the car stands in the hold with its nose towards the ramp
function cgArrive(A,note){if(!FL.cargo||FL.cargo.done&&FL.fade)return;FL.cargo.done=true;const di=LEVELS.findIndex(l=>l.id===A.id);if(di<0)return;$('fade').classList.add('on');
  FL.fade={t:0,hold:.35,cb:()=>{cgLeave();const same=di===state.levelIdx;if(!same){loadLevel(di);$('hLevel').textContent=LEVELS[di].name}
    const C=LV.airportDef&&LV.airportDef.cargo;state.mode='play';state.free=true;state.askCool='cargo';
    if(C){const h=Math.atan2(-C.ux,-C.uz);placeCar(car,C.x,C.z,h);car.pos.y=C.fy+.5;car.vel.set(0,0,0);car.w.set(0,0,0);for(let i=0;i<90;i++)stepCar(car,FIXED);state.checkpoint={x:C.pad.x,z:C.pad.z,h}}
    camSnap=true;roamSaveT=0;showHud();toast(note||(same?'Tilbake på '+LEVELS[di].name:'Velkommen til '+LEVELS[di].name+' · kjør ut bak'))}}}
function cargoSkip(){if(FL.cargo&&!FL.fade)cgArrive(FL.cargo.dest)}
function cargoAbort(){if(FL.cargo&&!FL.fade)cgArrive(FL.cargo.from,'Du ble på '+FL.cargo.from.name)}

/* ---------- every 60 Hz step of a cargo flight: the controls, the plane, crashes, the landing ---------- */
function cgStep(){const pl=FL.pl,S=FL.cargo,flying=FL.phase==='fly';if(!pl||!S)return;
  const inp=flying&&!S.done?fInput():{gas:0,rev:1,steer:0,jump:false};if(pl.ground&&FL.landed&&!inp.gas)inp.rev=1;   // landed: it brakes by itself unless you give gas again
  stepPlane(pl,inp,FW);FL.inp=inp;
  for(const e of pl.ev){
    if(e.type==='takeoff'){FL.took=true;FL.landed=false;S.warn=false;fNotice('Du er i lufta! Kurs mot '+S.dest.name,1800)}
    else if(e.type==='land'){FL.landed=true;const ap=cargoWhere(pl.x,pl.z);fNotice(ap?'Landet på '+ap.name+' · brems':'Landet',2200);fxSplash(bV(pl.x,pl.y-PCARGO.gear,pl.z))}
    else if(e.type==='crash'){FL.mesh.visible=false;if(e.water)fxSplash(bV(pl.x,2,pl.z));else fxHit(bV(pl.x,pl.y,pl.z),0x666666);fxHit(bV(pl.x,pl.y+2,pl.z),0xf4f2ec);fBoom();buzz(1,220);fNotice(e.water?'Plask! Du får et nytt forsøk':'Krasj! Du får et nytt forsøk',2200)}
    else if(e.type==='respawn')cgRespawn();
    else if(e.type==='edge')fNotice('Snu – her slutter kartet',1500)}
  pl.ev.length=0;
  // standing still after a landing: on an island with an airport you have arrived
  if(pl.ground&&FL.landed&&!pl.crash&&pl.s<.03&&!S.done){const ap=cargoWhere(pl.x,pl.z);if(ap)cgArrive(ap);else if(!S.warn){S.warn=true;fNotice('Her er det ingen flyplass. Ta av igjen',3000)}}
  for(const s of BT.smokers)if(Math.random()<.15&&Math.hypot(s.x-pl.x,s.z-pl.z)<1400)bSpawn(bV(s.x+brand(-5,5),s.y,s.z+brand(-5,5)),bV(brand(-.1,.1),.35,brand(-.1,.1)),{color:0x777777,size:12,life:120,grow:.25,opacity:.5});
  if(!pl.ground&&!pl.crash&&inp.jump&&Math.random()<.5){const h=_cv.set(Math.sin(pl.a),0,Math.cos(pl.a));for(const sd of[-1,1])bSpawn(bV(pl.x+h.x*20+h.z*sd*20,pl.y+8,pl.z+h.z*20-h.x*sd*20),bV(h.x*.3,.02,h.z*.3),{color:0xdddddd,size:4,life:30,grow:.2,opacity:.4})}
  bParticles()}
// after a crash you do not lose the car: you are put in the air where the final approach to your island begins, lined up with the runway
function cgRespawn(){const pl=FL.pl,S=FL.cargo,B=S.dest,F=cargoFinal(B),o=F.out||600;pl.x=F.tx-F.hx*o;pl.z=F.tz-F.hz*o;pl.y=F.out?F.y:B.top+90;pl.a=F.a;pl.p=pl.r=0;pl.vy=0;pl.ground=false;pl.s=PCARGO.cruise;
  FL.took=true;FL.landed=false;S.fin=true;FL.camYaw=pl.a;FL.mesh.visible=true;fPose(0);FL.snap=true;fNotice('Rett fram ligger '+B.name+' · sink rolig gjennom portene',3000)}

/* ---------- the HUD: where to, how far, and whether you are high or low on the way down ---------- */
// what to steer for: the first hoop until you are on the way in, then the runway. Missed it and flown past: round again.
function cgAim(){const pl=FL.pl,S=FL.cargo,B=S.dest,F=cargoFinal(B),rx=pl.x-F.tx,rz=pl.z-F.tz,al=rx*F.hx+rz*F.hz,lat=rx*F.hz-rz*F.hx,G=B.top+PCARGO.gear;
  if(!F.out)return{x:B.cx,z:B.cz,fin:true,glide:G+Math.max(0,-al)*.1,al};
  if(!S.fin&&((al<0&&al>-F.out-250&&Math.abs(lat)<Math.max(70,-al*.3))||Math.hypot(pl.x-F.x,pl.z-F.z)<240))S.fin=true;
  if(S.fin&&(al>B.hl*2+150||Math.abs(lat)>520||al<-F.out-700))S.fin=false;
  return S.fin?{x:F.tx+F.hx*50,z:F.tz+F.hz*50,fin:true,glide:G+Math.max(0,-al)*(F.y-G)/F.out,al}:{x:F.x,z:F.z,fin:false,glide:F.y,al}}
function cgHUD(){const pl=FL.pl,S=FL.cargo,ui=$('bpane0'),B=S.dest,C=PCARGO;if(!pl)return;const T=cgAim(),dx=T.x-pl.x,dz=T.z-pl.z,d=Math.round(Math.hypot(B.cx-pl.x,B.cz-pl.z));
  $('bclock').hidden=true;ui.querySelector('.bpl').textContent='Lastefly';ui.querySelector('.bname').textContent=bNames()[0];
  ui.querySelector('.bkn').textContent=Math.round(pl.s*C.kts)+' kn';ui.querySelector('.balt').textContent=(pl.ground?0:Math.max(0,Math.round(pl.y-C.gear-B.top)))+' m høyde';ui.querySelector('.bboost i').style.width=Math.min(100,pl.s/C.turbo*100)+'%';
  const hi=!pl.ground&&T.fin&&T.al<0?(pl.y>T.glide+22?' · sink':pl.y<T.glide-14?' · stig':''):'';
  ui.querySelector('.btarget').textContent=S.done?'Framme':pl.ground?(FL.landed?'Landet · brems':'Hold gass · kurs mot '+B.name):T.fin?'Land på '+B.name+' · '+d+' m'+hi:B.name+' · '+d+' m · fly til porten';
  bCompass({ui:{compass:ui.querySelector('.bcompass').getContext('2d')},b:{a:pl.a},col:(PAINTS[prof.paint]||PAINTS[0]).c},Math.atan2(dx,-dz));
  if(FL.guide&&FL.guide.userData.lab)FL.guide.userData.lab.rotation.y=Math.atan2(pl.x-B.cx,pl.z-B.cz);fMinimap()}
// on the minimap: a line to the island you fly to, and a ring round its airport
function cgMiniDest(c,M){const S=FL.cargo,pl=FL.pl;if(!S||!pl)return;const[u,v]=M(S.dest.cx,S.dest.cz),[pu,pv]=M(pl.x,pl.z);c.setLineDash([4,4]);c.strokeStyle='rgba(20,18,14,.6)';c.lineWidth=1.5;c.beginPath();c.moveTo(pu,pv);c.lineTo(u,v);c.stroke();c.setLineDash([]);
  c.strokeStyle='#e5a92b';c.lineWidth=2.5;c.beginPath();c.arc(u,v,8,0,6.283);c.stroke();c.lineWidth=1}
