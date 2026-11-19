'use strict';
/* =================================================================
   GRUVE 7: the old coal mine in Gruvefjellet on Svalbard. Drive into the mine entrance and the car is put on a flat mine
   wagon that rolls into the mountain by itself, on three tracks, seen from behind. Change track (← →, A D or swipe),
   jump (↑, W, space, swipe up or tap) and duck (↓, S or swipe down). Rocks, parked wagons, barriers and walls close a
   track; low beams and icicles you duck under; broken rails you jump. Every lump of coal is worth 3 nuts. A hit costs one
   of the three lanterns and puts the wagon back at the last checkpoint. At the far end the tunnel comes out in the
   daylight on top of the mountain.
   The mine itself is built from data/gruve7.js by makeMine (js/gruvesim.js), which also has the physics. This file draws
   it in its own scene: the tunnel is one long tube along the centre line, lit by light baked into the vertex colours
   (the lamps on the walls, the daylight at the end) and a lamp on the wagon.
   Loaded after grotte.js (it borrows cGrid, cMul, cStd and cBox from there); uses the globals of game.js and
   world.js (state, renderer, car, prof, best, AC, M …) at run time.
   ================================================================= */
const MN={on:false,fade:null,built:false,mine:null,scene:null,cam:null,cart:null,acc:0,paused:false,result:false,phase:'',zone:-1,hudT:0,snd:null,shake:0,
  q:{left:false,right:false,jump:false,duck:false},pad:null,padHold:false,bonus:0,banked:false,carKey:'',lightsWas:false,doneT:0,camLat:0,snap:true,clack:0,pulse:0,how:''};
const mineKey=()=>'svalbard/gruve7';
const M_TW=3.9,M_DECK=.68,M_NUT=3;   // half the width of the tunnel, the height of the wagon's deck over the floor, nuts for a lump of coal
// the parts of the mine: the rock, the ballast between the sleepers, the light in the air, the height of the roof and the colour of the lamps
const MTHEME={
  stoll:{rock:'#7a6956',floor:'#5a5048',amb:[.44,.39,.34],top:4.3,lamp:'#ffb860'},
  kull:{rock:'#4a4643',floor:'#3a3735',amb:[.46,.44,.42],top:3.8,lamp:'#ffb860'},
  is:{rock:'#9cc2da',floor:'#a8c2d2',amb:[.5,.62,.78],top:4.6,lamp:'#bfe6ff'},
  sjakt:{rock:'#6c5646',floor:'#52463e',amb:[.42,.35,.31],top:4.7,lamp:'#ff9a50'},
  dag:{rock:'#8a827a',floor:'#77726c',amb:[.58,.58,.62],top:4.3,lamp:'#ffd9a0'}};
for(const k in MTHEME){const t=MTHEME[k];t.rockC=col(t.rock);t.floorC=col(t.floor);t.topC=[t.top]}
const M_HIT={ras:'Rett i steinraset!',vogn:'Rett i en kullvogn!',bukk:'Sporet var stengt!',vegg:'Sporet endte i veggen!',bjelke:'Au! Dukk under bjelken',istapper:'Istapper! Dukk',brudd:'Ned i sjakta!'};

/* ---------- where things are: the centre line, the parts and the light ---------- */
const _mo={},_mv=new THREE.Vector3(),_mv2=new THREE.Vector3();
function mXYZ(s,lat,h,v){mineAt(MN.mine,s,_mo);return v.set(_mo.x+lat,_mo.y+h,-s)}
// put an object at s: it looks along the tunnel, so its own x is sideways, y up and -z further in
function mPut(o,s,lat,h){mineAt(MN.mine,s,_mo);o.position.set(_mo.x+lat,_mo.y+h,-s);o.rotation.order='YXZ';o.rotation.y=-Math.atan(_mo.dx);o.rotation.x=Math.atan(_mo.dy);return o}
// a value of the part of the mine at s (rockC, floorC, amb, topC), blended over ten units at every border
function mMix(m,s,key){const Z=m.zones,i=mineZone(m,s),a=MTHEME[Z[i].theme][key];let b=null,u=0;
  if(i>0&&s-Z[i].s<5){b=MTHEME[Z[i-1].theme][key];u=1-smt01((s-Z[i].s+5)/10)}else if(i<Z.length-1&&Z[i+1].s-s<5){b=MTHEME[Z[i+1].theme][key];u=smt01((s-Z[i+1].s+5)/10)}
  return b?a.map((v,k)=>v+(b[k]-v)*u):a}
const mTop=(m,s)=>mMix(m,s,'topC')[0];
// how much daylight there is: a little just inside the entrance, and more and more over the last stretch
const mDay=(m,s)=>Math.max(smt01((4-s)/14)*.6,smt01((s-(m.len-70))/85));
const M_DAY=[1.55,1.6,1.7];
function mLit(m,s,lat,h){const a=mMix(m,s,'amb'),d=mDay(m,s),L=[a[0]+(M_DAY[0]-a[0])*d,a[1]+(M_DAY[1]-a[1])*d,a[2]+(M_DAY[2]-a[2])*d],P=MN.lamps;
  let i=0,j=P.length;while(i<j){const k=(i+j)>>1;if(P[k].s<s-11)i=k+1;else j=k}
  for(;i<P.length&&P[i].s<s+11;i++){const l=P[i],r=Math.hypot(s-l.s,lat-l.lat,h-l.h);if(r>=l.r)continue;const k=(1-r/l.r)**2*l.i;L[0]+=l.c[0]*k;L[1]+=l.c[1]*k;L[2]+=l.c[2]*k}return L}
const mHash=(i,j)=>{const t=Math.sin(i*127.1+j*311.7)*43758.5453;return t-Math.floor(t)};

/* ---------- textures ---------- */
// the rock: grey and rough, with darker seams (the colour comes from the vertex colours)
function mRockTex(){const s=256,c=document.createElement('canvas');c.width=c.height=s;const x=c.getContext('2d'),R=mulberry32(57),img=x.createImageData(s,s),d=img.data,n=makeNoise(23);
  for(let j=0;j<s;j++)for(let i=0;i<s;i++){const u=i/s,v=j/s,w=(a,b,f)=>{let h=0;for(const[px,py]of[[0,0],[1,0],[0,1],[1,1]])h+=n((u-px)*f+a,(v-py)*f+b)*(px?u:1-u)*(py?v:1-v);return h};
    const g=.7+.5*(w(0,0,5)-.5)+.3*(w(9,4,14)-.5)+.1*Math.sin(v*26+w(3,3,4)*8)+(R()-.5)*.07,k=(j*s+i)*4,val=Math.max(0,Math.min(255,g*255));d[k]=d[k+1]=d[k+2]=val;d[k+3]=255}
  x.putImageData(img,0,0);for(let i=0;i<220;i++){const px=R()*s,py=R()*s,r=.8+R()*2.4,v=R()<.6?0:255;x.fillStyle=`rgba(${v},${v},${v},${.05+R()*.1})`;x.beginPath();x.arc(px,py,r,0,6.283);x.fill()}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t}
function mStripeTex(a,b){const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');x.fillStyle=a;x.fillRect(0,0,256,64);x.fillStyle=b;
  for(let i=-2;i<10;i++){x.beginPath();x.moveTo(i*40,64);x.lineTo(i*40+32,0);x.lineTo(i*40+52,0);x.lineTo(i*40+20,64);x.fill()}const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t}
// the signs over the tracks: a green arrow (this track goes on) and a red cross (this one ends)
function mSignTex(open){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#14120E';x.fillRect(0,0,128,128);x.strokeStyle=open?'#5cff7a':'#ff4a3a';x.lineWidth=18;x.lineCap='round';x.lineJoin='round';
  x.beginPath();if(open){x.moveTo(64,24);x.lineTo(64,100);x.moveTo(30,68);x.lineTo(64,102);x.lineTo(98,68)}else{x.moveTo(30,30);x.lineTo(98,98);x.moveTo(98,30);x.lineTo(30,98)}x.stroke();
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t}

/* ---------- instances ---------- */
const _mm4=new THREE.Matrix4(),_mq=new THREE.Quaternion(),_me=new THREE.Euler(0,0,0,'YXZ'),_mp=new THREE.Vector3(),_ms=new THREE.Vector3(),_mc=new THREE.Color();
function mInst(im,k,s,lat,h,sx,sy,sz,c){mineAt(MN.mine,s,_mo);_mp.set(_mo.x+lat,_mo.y+h,-s);_me.set(Math.atan(_mo.dy),-Math.atan(_mo.dx),0);_mq.setFromEuler(_me);_ms.set(sx,sy,sz);_mm4.compose(_mp,_mq,_ms);im.setMatrixAt(k,_mm4);
  if(c){_mc.setRGB(c[0],c[1],c[2]);im.setColorAt(k,_mc)}}
function mGlow(g,hex,x,y,z,size,op=.8){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:LIN(hex),transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false}));sp.position.set(x,y,z);sp.scale.set(size,size,1);g.add(sp);return sp}

/* ---------- building the mine scene (once) ---------- */
function mBuild(){const m=MN.mine=makeMine(GRUVE7),sc=MN.scene=new THREE.Scene(),grp=MN.grp=new THREE.Group();sc.add(grp);
  sc.background=new THREE.Color(0x070605);sc.fog=new THREE.Fog(0x070605,16,100);
  MN.amb=new THREE.AmbientLight(0xffffff,.9);sc.add(MN.amb);MN.lamp=new THREE.PointLight(0xffe2b0,1.7,34,1.2);sc.add(MN.lamp);
  MN.cam=new THREE.PerspectiveCamera(58,1,.1,150);
  // the lamps: one on the wall every 14 units, on alternating sides, and the lantern at every checkpoint
  const lamps=MN.lamps=[];for(let s=6,i=0;s<m.len+40;s+=14,i++){const th=MTHEME[m.zones[mineZone(m,s)].theme];lamps.push({s,lat:(i%2?1:-1)*(M_TW-.5),h:th.top*.66,r:10.5,i:1,c:col(th.lamp).map(v=>v*1.2),hex:th.lamp,wall:true})}
  for(const p of m.cps)if(p.s>0)lamps.push({s:p.s,lat:M_TW-.9,h:2.2,r:8,i:.8,c:col('#ffd76a').map(v=>v*1.3)});
  lamps.sort((a,b)=>a.s-b.s);
  // the rings of the tube: every two units, and close together at the edges of every break in the rails, where the floor drops away
  const gaps=m.obs.filter(o=>o.kind==='brudd'),inGap=s=>gaps.some(g=>s>g.s+.01&&s<g.s+g.len-.01);
  const S=[];for(let s=-12;s<=m.len+46;s+=2)S.push(s);for(const g of gaps)S.push(g.s,g.s+.02,g.s+g.len-.02,g.s+g.len);S.sort((a,b)=>a-b);
  const rockTex=mRockTex();rockTex.encoding=THREE.sRGBEncoding;
  const rockMat=new THREE.MeshLambertMaterial({map:rockTex,vertexColors:true,side:THREE.DoubleSide}),flat=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  const P=(s,lat,h)=>{mXYZ(s,lat,h,_mv);return{x:_mv.x,y:_mv.y,z:_mv.z}},hk=s=>Math.round(s*.5);
  // the floor: ballast, frost in the permafrost and snow where the daylight comes in; black at the bottom of the shafts
  {const F=[-M_TW-.3,-3,-2,-1,0,1,2,3,M_TW+.3],snow=col('#e8eef4');
    grp.add(new THREE.Mesh(cGrid(S.length,F.length,(i,j)=>P(S[i],F[j],inGap(S[i])?-8:(mHash(hk(S[i]),j)-.5)*.08),
      (i,j)=>{const s=S[i],d=smt01((s-(m.len-30))/40),f=mMix(m,s,'floorC'),c=[f[0]+(snow[0]-f[0])*d,f[1]+(snow[1]-f[1])*d,f[2]+(snow[2]-f[2])*d];return cMul(c,mLit(m,s,F[j],.3),inGap(s)?.05:.95+.25*mHash(hk(s)+7,j))}),rockMat))}
  // the walls and the roof: one rough arch from floor to floor
  {const A=[[-1,0],[-1.04,.32],[-1,.58],[-.86,.81],[-.52,.95],[0,1],[.52,.95],[.86,.81],[1,.58],[1.04,.32],[1,0]],sh=[.8,.95,1,.92,.8,.72,.8,.92,1,.95,.8];
    grp.add(new THREE.Mesh(cGrid(S.length,A.length,(i,j)=>{const s=S[i],top=mTop(m,s),e=j>0&&j<10?mHash(hk(s)*3+1,j)-.5:0;return P(s,A[j][0]*(M_TW+e*.3),Math.max(-.2,A[j][1]*top+e*.34))},
      (i,j,q)=>{const s=S[i];return cMul(mMix(m,s,'rockC'),mLit(m,s,A[j][0]*M_TW,A[j][1]*mTop(m,s)),sh[j]*(.9+.22*mHash(hk(s),j+20)))}),rockMat))}
  // the rails: two on each of the three tracks, broken where the rails are broken
  for(let L=-1;L<=1;L++)for(const sd of[-1,1]){const lat=L*MCFG.lane+sd*.55;
    grp.add(new THREE.Mesh(cGrid(S.length,2,(i,j)=>P(S[i],lat+(j?.055:-.055),.18),i=>cMul([.5,.53,.58],mLit(m,S[i],lat,.2),1.05),i=>inGap((S[i]+S[i+1])/2)),flat));
    grp.add(new THREE.Mesh(cGrid(S.length,2,(i,j)=>P(S[i],lat-sd*.055,j?.18:.04),i=>cMul([.3,.26,.24],mLit(m,S[i],lat,.2),1)),flat))}
  // the sleepers
  {const sl=[];for(let s=-10;s<m.len+44;s+=1.15)if(!inGap(s-.3)&&!inGap(s+.3)&&!inGap(s))sl.push(s);const wood=col('#6a4a30'),im=new THREE.InstancedMesh(boxGeo,new THREE.MeshLambertMaterial(),sl.length*3);
    sl.forEach((s,i)=>{for(let L=-1;L<=1;L++)mInst(im,i*3+L+1,s,L*MCFG.lane,.05,1.55,.12,.26,cMul(wood,mLit(m,s,L*MCFG.lane,.2),.8+.4*mHash(i,L)))});im.frustumCulled=false;grp.add(im)}
  // the timbering: two posts and a cap every seven units
  {const st=[];for(let s=3;s<m.len+30;s+=7)st.push(s);const wood=col('#7a5a3a'),im=new THREE.InstancedMesh(boxGeo,new THREE.MeshLambertMaterial(),st.length*3);
    st.forEach((s,i)=>{const top=mTop(m,s),h=top*.86,k=.85+.3*mHash(i,3);for(const sd of[-1,1])mInst(im,i*3+(sd+1)/2,s,sd*M_TW*.87,h/2,.3,h,.3,cMul(wood,mLit(m,s,sd*M_TW*.8,h*.5),k));
      mInst(im,i*3+2,s,0,h,M_TW*1.84,.3,.34,cMul(wood,mLit(m,s,0,h),k*.9))});im.frustumCulled=false;grp.add(im)}
  // the lamps on the walls: a small cage and a glow
  {const W=lamps.filter(l=>l.wall),im=new THREE.InstancedMesh(boxGeo,new THREE.MeshBasicMaterial(),W.length),pos=new Float32Array(W.length*3),cl=new Float32Array(W.length*3);
    W.forEach((l,i)=>{const c=col(l.hex);mInst(im,i,l.s,l.lat,l.h,.22,.3,.22,c.map(v=>v*1.6));mXYZ(l.s,l.lat*.97,l.h,_mv);pos.set([_mv.x,_mv.y,_mv.z],i*3);cl.set(c.map(v=>v*.8),i*3)});im.frustumCulled=false;grp.add(im);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(cl,3));
    const pt=new THREE.Points(g,new THREE.PointsMaterial({map:glowTex,size:3.4,vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));pt.frustumCulled=false;grp.add(pt)}
  mObstacles(m,grp,rockTex);mItems(m,grp);
  // the way out: the white sky at the end of the tunnel
  {const sky=new THREE.Mesh(new THREE.PlaneGeometry(70,46),new THREE.MeshBasicMaterial({color:LIN('#f2f8ff'),fog:false}));mPut(sky,m.len+46,0,5);sky.rotation.x=0;grp.add(sky)}
  // the wagon, its shadow and the particles
  MN.wagon=mWagon();sc.add(MN.wagon.g);
  {const sh=new THREE.Mesh(new THREE.PlaneGeometry(2.6,3.9),new THREE.MeshBasicMaterial({map:dustTex,color:0x000000,transparent:true,opacity:.55,depthWrite:false}));sh.rotation.order='YXZ';sc.add(sh);MN.shadow=sh}
  MN.parts=[];for(let i=0;i<48;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,transparent:true,depthWrite:false,opacity:0,blending:THREE.AdditiveBlending}));s.visible=false;sc.add(s);MN.parts.push({s,life:0,v:new THREE.Vector3()})}
  MN.hints=['lane','duck','jump'].map(need=>({need,s:(m.obs.find(o=>o.need===need)||{s0:-1}).s0}));
  MN.built=true}
// everything the wagon can run into
function mObstacles(m,grp,rockTex){const R=mulberry32(41),LW=MCFG.lane,dod=new THREE.DodecahedronGeometry(1,0),cone=new THREE.ConeGeometry(1,1,6),wheelG=new THREE.CylinderGeometry(.24,.24,.14,12),ball=new THREE.SphereGeometry(.14,10,8);
  const rock=cStd('#8c857c',{flatShading:true,roughness:.95}),rock2=cStd('#6f6962',{flatShading:true,roughness:.95}),steel=cStd('#5d646c',{roughness:.6,metalness:.4}),rust=cStd('#8a5236',{roughness:.85}),coalM=cStd('#17171a',{roughness:.4,metalness:.4}),
    wood=cStd('#8a6844',{roughness:.9}),blk=cStd('#1d1c1a'),ice=cStd('#d6f2ff',{emissive:LIN('#58b4e6'),emissiveIntensity:.5,roughness:.12,transparent:true,opacity:.93}),
    red=new THREE.MeshBasicMaterial({color:LIN('#ff5a3a')}),amber=new THREE.MeshBasicMaterial({color:LIN('#ffb040')}),
    stripe=(a,b)=>{const t=mStripeTex(a,b);return new THREE.MeshStandardMaterial({map:t,emissive:0xffffff,emissiveMap:t,emissiveIntensity:.4,roughness:.7})},rw=stripe('#f2f2ee','#d9342a'),yb=stripe('#f0c020','#1b1b1b'),
    wall=new THREE.MeshLambertMaterial({map:rockTex}),sign=[true,false].map(o=>new THREE.MeshBasicMaterial({map:mSignTex(o)}));
  const add=(g,geo,mat,x,y,z,sx,sy,sz)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.scale.set(sx,sy,sz);g.add(o);return o};
  for(const o of m.obs){const g=new THREE.Group(),top=mTop(m,o.s);mPut(g,o.s,0,0);grp.add(g);const on=[-1,0,1].filter(L=>o.lanes[L+1]);
    if(o.kind==='ras')for(const L of on){add(g,dod,rock,L*LW,.62,0,.95,.85,.8).rotation.set(R()*3,R()*3,R()*3);
      for(let i=0;i<6;i++){const r=.3+R()*.4;add(g,dod,i%2?rock:rock2,L*LW+(R()-.5)*1.5,r*.7+(i<2?.8:0)*R(),(R()-.5)*1.5,r*(1+R()*.4),r,r*(1+R()*.3)).rotation.set(R()*3,R()*3,R()*3)}}
    else if(o.kind==='vogn')for(const L of on){const x=L*LW;cBox(g,1.2,.16,2.3,steel,x,.5,0);cBox(g,1.56,.86,2.4,rust,x,1.01,0);cBox(g,1.62,.1,2.46,steel,x,1.46,0);cBox(g,1.34,.16,2.16,coalM,x,1.5,0);
      for(let i=0;i<5;i++)add(g,dod,coalM,x+(R()-.5)*.9,1.62,(R()-.5)*1.7,.3,.22,.3).rotation.set(R()*3,R()*3,0);
      for(const sx of[-1,1])for(const sz of[-1,1])add(g,wheelG,blk,x+sx*.55,.42,sz*.75,1,1,1).rotation.z=Math.PI/2;
      for(const sx of[-1,1])add(g,ball,red,x+sx*.55,.82,1.22,.7,.7,.4);mGlow(g,'#ff4a2a',x,.9,1.3,2.2,.55)}
    else if(o.kind==='bukk')for(const L of on){const x=L*LW;cBox(g,1.8,.3,.09,rw,x,1.08,0);cBox(g,1.8,.3,.09,rw,x,.56,0);for(const sx of[-1,1]){cBox(g,.1,1.34,.1,wood,x+sx*.74,.62,.2,0).rotation.x=.3;cBox(g,.1,1.34,.1,wood,x+sx*.74,.62,-.2,0).rotation.x=-.3}
      add(g,ball,red,x,1.42,0,1.2,1.2,1.2);mGlow(g,'#ff3a20',x,1.42,.05,2.6,.9)}
    else if(o.kind==='vegg'){for(const L of on){const x=L*LW;add(g,boxGeo,wall,x,top*.48,-.8,LW+.1,top*.98,1.6);cBox(g,1.9,.26,.1,wood,x,1.3,.06,.7);cBox(g,1.9,.26,.1,wood,x,1.3,.07,-.7);add(g,new THREE.PlaneGeometry(1.3,1.3),sign[1],x,2.75,.1,1,1,1);mGlow(g,'#ff3a20',x,2.75,.2,2.6,.5)}
      // the signs hang over the tracks at the wall, and well before it
      for(const at of[o.warn,o.s-4]){const sg=new THREE.Group(),tp=mTop(m,at);mPut(sg,at,0,0);grp.add(sg);cBox(sg,LW*3+.6,.12,.12,blk,0,tp*.94-.25,0);
        for(let L=-1;L<=1;L++){const op=L===o.open;add(sg,new THREE.PlaneGeometry(1.15,1.15),sign[op?0:1],L*LW,tp*.94-.95,.02,1,1,1);cBox(sg,.05,.5,.05,blk,L*LW,tp*.94-.25,0);mGlow(sg,op?'#4cff6a':'#ff3a20',L*LW,tp*.94-.95,.1,2.4,.45)}}}
    else if(o.kind==='bjelke'){cBox(g,M_TW*1.86,.42,.46,yb,0,1.62,0);for(const sx of[-1,1]){cBox(g,.07,top-1.8,.07,blk,sx*2.95,(top+1.8)/2-.2,0);cBox(g,.34,1.5,.34,wood,sx*(M_TW-.5),.75,0);add(g,ball,amber,sx*(M_TW-.5),1.9,.1,1,1,1);mGlow(g,'#ffa030',sx*(M_TW-.5),1.9,.15,2.2,.8)}}
    else if(o.kind==='istapper')for(const L of on){for(let i=0;i<7;i++){const x=L*LW+(i/6-.5)*1.6+(R()-.5)*.15,tip=1.3+R()*.9+Math.abs(i-3)*.12,cy=top*.97,len=cy-tip;const c=add(g,cone,ice,x,cy-len/2,(R()-.5)*.7,.12+R()*.12,len,.12+R()*.12);c.rotation.x=Math.PI}
      mGlow(g,'#8fd8ff',L*LW,1.9,.3,3,.5)}
    else if(o.kind==='brudd'){cBox(g,M_TW*2-1.4,.16,.34,yb,0,.26,.5);for(const sx of[-1,1]){cBox(g,.16,1.5,.16,wood,sx*(M_TW-.7),.75,.5);add(g,ball,amber,sx*(M_TW-.7),1.62,.5,1.1,1.1,1.1);mGlow(g,'#ffa030',sx*(M_TW-.7),1.62,.55,2.6,.9)}
      for(let L=-1;L<=1;L++)for(const sd of[-1,1])cBox(g,.11,.14,.9,steel,L*LW+sd*.55,-.1,-.3,0).rotation.x=-.5}   // the rails bend down into the shaft
    g.traverse(q=>{q.castShadow=false})}}
// the coal and the lanterns at the checkpoints
function mItems(m,grp){const n=m.coal.length,im=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.34,0),new THREE.MeshStandardMaterial({color:LIN('#26262c'),emissive:LIN('#ff9a3a'),emissiveIntensity:.05,metalness:.5,roughness:.25,flatShading:true}),n);
  im.frustumCulled=false;grp.add(im);const pos=new Float32Array(n*3),cl=new Float32Array(n*3);m.coal.forEach((k,i)=>{mXYZ(k.s,k.lane*MCFG.lane,.62+k.h,_mv);k.px=_mv.x;k.py=_mv.y;k.pz=_mv.z;pos.set([_mv.x,_mv.y,_mv.z],i*3)});
  const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pos,3));pg.setAttribute('color',new THREE.BufferAttribute(cl,3));
  const glow=new THREE.Points(pg,new THREE.PointsMaterial({map:glowTex,size:2.6,vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));glow.frustumCulled=false;grp.add(glow);
  MN.coalIM={im,glow};
  MN.cpVis=m.cps.map(p=>{if(p.s<=0)return null;const g=new THREE.Group();mPut(g,p.s,M_TW-.9,0);grp.add(g);cBox(g,.14,2.3,.14,cStd('#5a3a22'),0,1.15,0);cBox(g,.5,.08,.08,cStd('#5a3a22'),-.2,2.26,0);
    const glass=new THREE.MeshBasicMaterial({color:LIN('#8a7040')}),l=new THREE.Mesh(boxGeo,glass);l.scale.set(.24,.34,.24);l.position.set(-.4,2.0,0);g.add(l);return{glass,gl:mGlow(g,'#ffc860',-.4,2.0,.1,2.4,.35)}})}
// the flat wagon the car stands on
function mWagon(){const g=new THREE.Group(),tilt=new THREE.Group();g.add(tilt);const steel=cStd('#4a4e54',{roughness:.6,metalness:.5}),wood=cStd('#7a5636',{roughness:.9}),blk=cStd('#1b1b1d',{metalness:.5,roughness:.5});
  cBox(tilt,1.94,.14,3.2,wood,0,M_DECK-.07,0);cBox(tilt,1.3,.2,2.8,steel,0,.48,0);for(const z of[-1.6,1.6])cBox(tilt,1.94,.3,.1,steel,0,M_DECK+.08,z);for(const sx of[-1,1])cBox(tilt,.08,.1,3.2,steel,sx*.94,M_DECK+.04,0);
  const wg=new THREE.CylinderGeometry(.25,.25,.14,14),wheels=[];for(const sx of[-1,1])for(const sz of[-1,1]){const w=new THREE.Mesh(wg,blk);w.rotation.z=Math.PI/2;w.position.set(sx*.55,.43,sz*1.05);tilt.add(w);wheels.push(w)}
  cBox(tilt,.07,1.25,.07,steel,-.86,M_DECK+.62,-1.5);const lamp=new THREE.Mesh(boxGeo,new THREE.MeshBasicMaterial({color:LIN('#ffd890')}));lamp.scale.set(.2,.26,.2);lamp.position.set(-.86,M_DECK+1.3,-1.5);tilt.add(lamp);mGlow(tilt,'#ffc060',-.86,M_DECK+1.3,-1.45,1.8,.7);
  const carG=new THREE.Group();tilt.add(carG);tilt.traverse(q=>{q.castShadow=false});return{g,tilt,carG,wheels}}
// the car on the wagon: the same model and paint as on the island, standing still on its wheels
function mCarVis(){const cfg=Object.assign({},CARS[state.carIdx],{tune:car.tune}),key=cfg.id+'/'+JSON.stringify(prof.parts),W=MN.wagon;if(MN.carKey===key)return;
  while(W.carG.children.length){const o=W.carG.children[0];W.carG.remove(o);o.traverse(q=>{if(q.geometry&&q.geometry!==boxGeo&&!SHARED_GEO.has(q.geometry))q.geometry.dispose()})}
  const phys=makeCar(CARS[state.carIdx],car.tune),ry=restWheelY(cfg),in_=new THREE.Group();in_.add(buildBody(cfg));phys.wheels.forEach((w,i)=>{const v=carWheel(cfg,i%2===0?1:-1,i>1);v.root.position.set(w.mount.x,ry,w.mount.z);in_.add(v.root)});
  in_.position.y=(cfg.wr||WR)-ry;in_.rotation.y=Math.PI;W.carG.add(in_);W.carG.position.y=M_DECK;MN.carKey=key}

/* ---------- in and out ---------- */
function mineEnter(){if(MN.on||MN.fade)return;initAudio();if(AC&&AC.state==='suspended')AC.resume();state.mode='mine';car.vel.set(0,0,0);car.w.set(0,0,0);car.throttle=0;setOffer(null);
  if(!prof.mine)prof.mine={};const first=!prof.mine.found;prof.mine.found=true;saveProf();
  $('fade').classList.add('on');MN.fade={t:0,hold:.25,cb:()=>{if(!MN.built)mBuild();mCarVis();MN.on=true;MN.lightsWas=state.lights;setLights(true);M.beam.opacity=.045;$('hud').hidden=true;$('hint').hidden=true;$('mineHud').hidden=false;mLayout();mStart();
    mNotice(first?'Gruve 7: hold deg fast!':'Gruve 7',2400)}}}
function mStart(){const m=MN.mine,sc=Math.max(.7,Math.min(1.15,state.speed/100))*(state.assist?.88:1);MN.cart=makeMineCart(m,sc);
  MN.phase='run';MN.paused=false;MN.result=false;MN.acc=0;MN.zone=-1;MN.bonus=0;MN.banked=false;MN.doneT=0;MN.snap=true;MN.shake=0;MN.clack=0;MN.how='';MN.q.left=MN.q.right=MN.q.jump=MN.q.duck=false;
  MN.hints.forEach(h=>h.done=false);mCoalPose(true);MN.cpVis.forEach(l=>{if(l){l.glass.color.set(LIN('#8a7040'));l.gl.material.color.set(LIN('#ffc860'));l.gl.material.opacity=.35}});
  MN.wagon.carG.scale.y=1;$('mnPauseMenu').hidden=true;$('result').hidden=true;mHud(true)}
// back to the island: in front of the entrance, or (after the whole trip) out of the day opening on top of the mountain
function mineExit(top){if(MN.fade||!MN.on)return;$('fade').classList.add('on');
  MN.fade={t:0,hold:.2,cb:()=>{MN.on=false;MN.phase='';MN.result=false;MN.paused=false;if(MN.snd)MN.snd.master.gain.setTargetAtTime(0,AC.currentTime,.1);$('mineHud').hidden=true;$('mnPauseMenu').hidden=true;
    if(!$('result').hidden){$('result').hidden=true;bResultReset()}setLights(MN.lightsWas);
    const D=LV.mineDef,o=top&&D.top?D.top:D.out;placeCar(car,o.x,o.z,o.h);state.checkpoint={x:o.x,z:o.z,h:o.h};state.flipT=0;state.air=0;state.mode='play';state.askCool='mine';camSnap=true;showHud();
    toast(top?'Oppe på Gruvefjellet!':'Ute i kulda igjen')}}}

/* ---------- a step of the trip: physics and what happens ---------- */
function mStep(dt){const c=MN.cart,m=MN.mine,q=MN.q,inp={left:q.left,right:q.right,jump:q.jump,duck:q.duck,duckHold:MN.padHold||keys.has('arrowdown')||keys.has('s')};q.left=q.right=q.jump=q.duck=false;
  stepMineCart(c,inp,m,dt);const va=state.volAmb/70;
  for(const e of c.ev){
    if(e.type==='lane')mNoise(.09,'bandpass',900,.12);
    else if(e.type==='jump')mTone(260,.2,'sine',.12,-260);
    else if(e.type==='land'){mNoise(.16,'lowpass',260,.5);mTone(70,.14,'sine',.3,30);MN.shake=Math.max(MN.shake,.12)}
    else if(e.type==='coal'){const k=m.coal[e.i];MN.pulse=1;const p=Math.pow(2,Math.min(e.combo%10,9)/12),v=.1*va+.05;mTone(880*p,.06,'triangle',v);mTone(1320*p,.13,'triangle',v,0,.05);for(let i=0;i<3;i++)mPart(k.px,k.py,k.pz,'#ffc060');
      if(e.combo%10===0){MN.bonus+=5;mNotice(e.combo+' på rad! +5 ⚙',1100);mTone(1568,.3,'triangle',.16,0,.12)}}
    else if(e.type==='hit'){MN.shake=1;mNoise(.6,'lowpass',520,.9);mTone(90,.4,'sine',.5,50);mNotice(M_HIT[e.kind]+(e.left>0?' · '+e.left+(e.left===1?' lykt igjen':' lykter igjen'):''),1500,true);mXYZ(c.s+1,c.x*MCFG.lane,1,_mv);for(let i=0;i<14;i++)mPart(_mv.x,_mv.y,_mv.z,i%2?'#ffb040':'#fff0c0',true);mHud(true)}
    else if(e.type==='respawn'){MN.snap=true;mNotice('Fra '+m.cps[c.cp].name,1500)}
    else if(e.type==='out')mFinish('out');
    else if(e.type==='cp'){const l=MN.cpVis[e.i];if(l){l.glass.color.set(LIN('#7dff8a'));l.gl.material.color.set(LIN('#5cff7a'));l.gl.material.opacity=.8}mTone(523,.6,'sine',.16);mTone(1046,.5,'sine',.06);mNotice('Sjekkpunkt',900)}
    else if(e.type==='end'){MN.phase='done';MN.doneT=0;[523,659,784,1047,784,1047].forEach((n,i)=>mTone(n,i===5?.9:.16,'triangle',.22,0,i*.17))}}
  c.ev.length=0;
  // the three things to do, said once each, a little before the first time they are needed
  if(c.state==='run'&&c.crashT<=0)for(const h of MN.hints)if(!h.done&&h.s>0&&c.s>h.s-Math.max(14,c.v*2.1)&&c.s<h.s){h.done=true;const t=document.body.classList.contains('is-touch');
    mNotice(h.need==='lane'?(t?'Sveip til siden: bytt spor':'← →  bytt spor'):h.need==='duck'?(t?'Sveip ned: dukk':'↓  dukk'):(t?'Sveip opp: hopp':'↑  hopp'),1900)}}
// the nuts of the trip go into the pocket once, however it ends
function mBank(){if(MN.banked||!MN.cart)return 0;MN.banked=true;const n=MN.cart.got*M_NUT+MN.bonus;prof.nuts+=n;saveProf();return n}
function mFinish(how){if(MN.result)return;const m=MN.mine,c=MN.cart,key=mineKey(),prev=best[key],done=how==='end',L=[`<li><b>${c.got} kullklumper</b> × ${M_NUT} = ${c.got*M_NUT} ⚙</li>`];
  if(MN.bonus)L.push(`<li><b>Lange rekker</b> (lengst ${c.maxCombo} på rad): +${MN.bonus} ⚙</li>`);
  if(done){const first=!prof.mine.done;prof.mine.done=(prof.mine.done||0)+1;const a=50+(first?100:0);MN.bonus+=a;L.push(`<li><b>Helt gjennom gruva:</b> +${a} ⚙${first?' (100 av dem for første gang)':''}</li>`);
    if(!c.hits){MN.bonus+=100;L.push('<li><b>Feilfri tur,</b> alle lyktene lyser: +100 ⚙</li>')}}
  const total=mBank(),rec=done&&(!prev||!prev.done||c.t<prev.t-.05);
  if(done&&prev&&prev.done)L.push(rec?'<li><b>Ny bestetid!</b></li>':`<li><b>Bestetiden din:</b> ${fmtTime(prev.t)}</li>`);
  if(!done)L.push('<li><b>Innerst i gruva</b> kommer du opp i dagen på toppen av Gruvefjellet.</li>');
  best[key]={t:done?(prev&&prev.done?Math.min(prev.t,c.t):c.t):(prev?prev.t:0),k:Math.max(c.got,prev?prev.k||0:0),done:done||!!(prev&&prev.done)};store.set('best',best);
  MN.phase='result';MN.result=true;MN.how=how;const stars=done?(c.hits?2:3):c.s>m.len*.5?1:0;
  $('rLevel').textContent='Svalbard · Gruve 7';$('rTitle').textContent=done?'Opp i dagen!':how==='out'?'Alle lyktene sloknet':'Ut av gruva';
  $('rTime').textContent=fmtTime(c.t);$('rPenL').textContent='Kull';$('rPen').textContent=c.got+'/'+m.coal.length;$('rGatesL').textContent=done?'Lykter igjen':'Kom til';$('rGates').textContent=done?c.lights+'/'+MCFG.lights:Math.round(100*Math.min(1,c.s/m.len))+' %';
  $('rStars').innerHTML=[0,1,2].map(i=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z" fill="${i<stars?'#E5A92B':'rgba(242,232,208,.15)'}"/></svg>`).join('');$('rStars').setAttribute('aria-label',stars+' av 3 stjerner');
  $('rLog').innerHTML=L.join('');$('rNuts').textContent='+'+fmtN(total);$('rNutsNote').textContent='1 kullklump = '+M_NUT+' muttere. Du har nå '+fmtN(prof.nuts)+' ⚙.';
  $('rNext').textContent=done?'Ut i dagen':'Kjør ut av gruva';$('rRetry').textContent='Kjør inn igjen';$('rRetry').hidden=false;$('rMenu').textContent='Til menyen';$('rMenu').hidden=true;$('rGarage').hidden=true;
  setTimeout(()=>{if(MN.result){$('result').hidden=false;$('rNext').focus()}},done?200:700)}
// the result buttons (game.js): next = out to the island, retry = in again from the entrance
function mineResultBtn(btn){if(!MN.on||!MN.result)return false;MN.result=false;$('result').hidden=true;bResultReset();$('rMenu').hidden=false;
  if(btn==='retry'){mStart();mNotice('Gruve 7',1600)}else mineExit(MN.how==='end');return true}
function mPause(on){if(!MN.on||MN.result||MN.phase!=='run')return;MN.paused=!!on;$('mnPauseMenu').hidden=!on;if(on){$('mnpSound').textContent='Lyd: '+(state.sound?'på':'av');$('mnpResume').focus()}}
function mineKeyDown(k){if(MN.fade||!MN.on||MN.result)return;if(k==='escape'||k==='p'){mPause($('mnPauseMenu').hidden);return}if(!$('mnPauseMenu').hidden)return;if(k==='m'){setSound(!state.sound);return}
  if(MN.phase!=='run')return;const q=MN.q;if(k==='arrowleft'||k==='a')q.left=true;else if(k==='arrowright'||k==='d')q.right=true;else if(k==='arrowup'||k==='w'||k===' ')q.jump=true;else if(k==='arrowdown'||k==='s')q.duck=true}
// the gamepad: the stick or the cross changes track, jumps and ducks; A jumps and B ducks
function mPad(){const pads=navigator.getGamepads?navigator.getGamepads():[],gp=[...pads].find(p=>p&&p.connected);if(!gp){MN.pad=null;MN.padHold=false;return}
  const ax=gp.axes[0]||0,ay=gp.axes[1]||0,b=i=>!!(gp.buttons[i]&&gp.buttons[i].pressed),now={l:ax<-.5||b(14),r:ax>.5||b(15),u:ay<-.6||b(12)||b(0),d:ay>.6||b(13)||b(1)},was=MN.pad||now,q=MN.q;
  if(MN.phase==='run'&&!MN.paused){if(now.l&&!was.l)q.left=true;if(now.r&&!was.r)q.right=true;if(now.u&&!was.u)q.jump=true;if(now.d&&!was.d)q.duck=true}MN.padHold=now.d;MN.pad=now}

/* ---------- every frame (from game.js) ---------- */
function updateMine(dt){
  if(MN.fade){const f=MN.fade;f.t+=dt;if(f.t>.9&&!f.done){f.done=true;f.cb()}if(f.t>.9+f.hold){$('fade').classList.remove('on');MN.fade=null}}
  if(!MN.on)return false;
  mPad();
  if(!MN.paused&&!MN.result){MN.acc+=dt;let n=0;while(MN.acc>=MSTEP&&n<12){mStep(MSTEP);MN.acc-=MSTEP;n++}if(n>=12)MN.acc=0}
  if(MN.phase==='done'){MN.doneT+=dt;if(MN.doneT>1.9)mFinish('end')}
  MN.shake*=Math.exp(-dt*6);
  mPose(dt);mCamera(dt);MN.hudT-=dt;if(MN.hudT<=0){MN.hudT=1/15;mHud()}mSndUpdate(dt);
  renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);renderer.render(MN.scene,MN.cam);return true}
const _fogA=new THREE.Color(0x070605),_fogB=new THREE.Color(0xe6eef6).convertSRGBToLinear();
function mPose(dt){const c=MN.cart,m=MN.mine,W=MN.wagon,tm=performance.now()*.001,lat=c.x*MCFG.lane,crash=c.crashT>0,k=1-Math.exp(-dt*14);
  mPut(W.g,c.s,lat,Math.max(-7,c.y));W.tilt.rotation.z=-c.lean*.16+(crash&&!c.fall?Math.sin(tm*38)*.07*c.crashT:0);W.tilt.rotation.x=Math.max(-.3,Math.min(.3,c.vy*.022))+(c.fall?-.6*Math.min(1,(MCFG.crashT-c.crashT)*2):0);
  if(!MN.paused)for(const w of W.wheels)w.rotation.x-=c.v*dt/.25;
  W.carG.scale.y+=((c.duck>0?.55:1)-W.carG.scale.y)*k;
  MN.shadow.visible=c.y>=0&&!c.fall;if(MN.shadow.visible){mPut(MN.shadow,c.s,lat,.21);MN.shadow.rotation.x-=Math.PI/2;const q=1/(1+c.y*.5);MN.shadow.scale.set(q,q,1);MN.shadow.material.opacity=.55*q}
  mXYZ(c.s+3.5,lat*.7,2.3,MN.lamp.position);
  // the dark gives way to the daylight on the last stretch
  {const d=mDay(m,c.s+26);MN.scene.fog.color.copy(_fogA).lerp(_fogB,d);MN.scene.background.copy(MN.scene.fog.color);MN.scene.fog.near=16+d*30;MN.scene.fog.far=100+d*60}
  mCoalPose(false);
  // sparks from the wheels now and then, more on the steep way down
  if(!MN.paused&&!crash&&c.y<=0&&c.v>8&&Math.random()<dt*(c.v>15?16:3)){mXYZ(c.s-1,lat+(Math.random()<.5?-.55:.55),.25,_mv);mPart(_mv.x,_mv.y,_mv.z,'#ffb040',true)}
  for(const p of MN.parts){if(p.life<=0)continue;p.life-=dt*1.8;p.v.y-=7*dt;p.s.position.addScaledVector(p.v,dt);p.s.material.opacity=Math.max(0,p.life);if(p.life<=0)p.s.visible=false}}
// the coal turns, and its glow twinkles; taken lumps are scaled to nothing. all: every lump, not only those near the wagon
function mCoalPose(all){const G=MN.coalIM,K=MN.mine.coal,c=MN.cart,tm=performance.now()*.001,C=G.glow.geometry.attributes.color,s0=c?c.s:0;
  for(let i=0;i<K.length;i++){const k=K[i];if(!all&&(k.s<s0-8||k.s>s0+125))continue;const on=!(c&&c.taken[i]);_mp.set(k.px,k.py+Math.sin(tm*2.4+i)*.06,k.pz);_me.set(tm*1.3+i,tm*1.9+i*1.7,0);_mq.setFromEuler(_me);_ms.setScalar(on?1:0);_mm4.compose(_mp,_mq,_ms);G.im.setMatrixAt(i,_mm4);
    const g=on?.75+.25*Math.sin(tm*4+i*1.3):0;C.setXYZ(i,g,g*.66,g*.24)}
  G.im.instanceMatrix.needsUpdate=true;C.needsUpdate=true}
function mPart(x,y,z,hex,fast){const p=MN.parts.find(q=>q.life<=0)||MN.parts[Math.floor(Math.random()*MN.parts.length)];p.life=1;p.s.visible=true;p.s.material.color.set(LIN(hex));const sc=fast?.22:.32;p.s.scale.set(sc,sc,1);
  p.s.position.set(x,y,z);const sp=fast?5:2.4;p.v.set((Math.random()-.5)*sp,Math.random()*sp*.8+.6,(Math.random()-.5)*sp-(fast?0:MN.cart.v*.5))}
// the camera: behind and above the wagon, following it sideways a little slower than it moves
function mCamera(dt){const c=MN.cart,cam=MN.cam,port=cam.aspect<1,back=port?8.6:6.8,tl=c.x*MCFG.lane*.82;
  if(MN.snap){MN.camLat=tl;MN.snap=false}else MN.camLat+=(tl-MN.camLat)*(1-Math.exp(-dt*8));
  const sh=MN.shake*.35,top=mTop(MN.mine,c.s-back),h=Math.min(top-.75,2.85+Math.max(0,c.y)*.3);
  mXYZ(c.s-back,MN.camLat+(Math.random()-.5)*sh,h+(Math.random()-.5)*sh,cam.position);mXYZ(c.s+11,MN.camLat*1.05,1.1,_mv2);cam.lookAt(_mv2);
  const fov=(port?70:57)+Math.min(8,c.v*.45);if(Math.abs(fov-cam.fov)>.05){cam.fov+=(fov-cam.fov)*(1-Math.exp(-dt*3));cam.updateProjectionMatrix()}}
function mLayout(){if(!MN.cam)return;MN.cam.aspect=innerWidth/innerHeight;MN.cam.updateProjectionMatrix()}

/* ---------- HUD ---------- */
function mHud(force){const c=MN.cart,m=MN.mine;if(!c)return;const b=best[mineKey()];
  if(force||MN.hudL!==c.lights){MN.hudL=c.lights;$('mnLights').innerHTML=Array.from({length:MCFG.lights},(_,i)=>`<i class="${i<c.lights?'on':''}"></i>`).join('');$('mnLights').setAttribute('aria-label',c.lights+' av '+MCFG.lights+' lykter')}
  $('mnTime').textContent=fmtTime(c.t);$('mnBest').textContent=b&&b.done?'Bestetid '+fmtTime(b.t):'Ingen bestetid ennå';
  $('mnCoal').textContent=c.got;$('mnNuts').textContent='= '+fmtN(c.got*M_NUT+MN.bonus)+' ⚙';if(MN.pulse>0){$('mnCoalBox').classList.remove('pulse');void $('mnCoalBox').offsetWidth;$('mnCoalBox').classList.add('pulse');MN.pulse=0}
  $('mnProg').style.width=(100*Math.min(1,c.s/m.len)).toFixed(1)+'%';
  const zi=mineZone(m,c.s);if(zi!==MN.zone||force){MN.zone=zi;const el=$('mnZone');el.textContent=m.zones[zi].name;el.classList.remove('on');void el.offsetWidth;el.classList.add('on')}}
function mNotice(text,ms=1500,bad){const n=$('mnNotice');n.textContent=text;n.classList.toggle('bad',!!bad);n.classList.add('on');clearTimeout(n._t);n._t=setTimeout(()=>n.classList.remove('on'),ms)}

/* ---------- sound: the rumble of the wagon, the clack of the rail joints and an echo for everything (WebAudio, no files) ---------- */
function mSnd(){if(MN.snd||!AC)return MN.snd;try{const C=AC,master=C.createGain();master.gain.value=0;master.connect(C.destination);
  const echo=C.createDelay(1);echo.delayTime.value=.19;const fb=C.createGain();fb.gain.value=.34;const ef=C.createBiquadFilter();ef.type='lowpass';ef.frequency.value=1700;echo.connect(ef);ef.connect(fb);fb.connect(echo);ef.connect(master);
  const fx=C.createGain();fx.gain.value=.8;fx.connect(master);const send=C.createGain();send.gain.value=.45;fx.connect(send);send.connect(echo);
  const nz=C.createBufferSource();nz.buffer=noiseBuf(C,3);nz.loop=true;const rf=C.createBiquadFilter();rf.type='lowpass';rf.frequency.value=160;const rg=C.createGain();rg.gain.value=0;nz.connect(rf);rf.connect(rg);rg.connect(master);
  const hf=C.createBiquadFilter();hf.type='bandpass';hf.frequency.value=2600;hf.Q.value=1.5;const hg=C.createGain();hg.gain.value=0;nz.connect(hf);hf.connect(hg);hg.connect(master);nz.start();
  MN.snd={master,fx,rf,rg,hg,nb:noiseBuf(C,1)}}catch(e){MN.snd=null}return MN.snd}
function mSndUpdate(dt){const S_=mSnd();if(!S_)return;const t=AC.currentTime,on=MN.on&&state.sound&&!MN.paused,c=MN.cart,vc=state.volCar/70;
  S_.master.gain.setTargetAtTime(on?1:0,t,.12);if(!on||!c)return;const roll=c.crashT<=0&&c.y<=0&&MN.phase!=='result'?c.v:0,k=Math.min(1,roll/17);
  S_.rg.gain.setTargetAtTime(k*.5*vc,t,.08);S_.rf.frequency.setTargetAtTime(110+k*190,t,.1);S_.hg.gain.setTargetAtTime(k*k*.05*vc,t,.1);
  // the rail joints: two clacks, one for each axle
  if(roll>0){MN.clack+=roll*dt;if(MN.clack>5.2){MN.clack=0;mNoise(.035,'bandpass',1500,.22*vc);mNoise(.035,'bandpass',1300,.2*vc,2.1/Math.max(4,roll))}}}
function mTone(fr,d,type='triangle',v=.2,glide=0,delay=0){const S_=mSnd();if(!S_||!state.sound)return;const C=AC,t=C.currentTime+delay,o=C.createOscillator(),g=C.createGain();o.type=type;o.frequency.setValueAtTime(fr,t);if(glide)o.frequency.exponentialRampToValueAtTime(Math.max(40,fr-glide),t+d);
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+.008);g.gain.exponentialRampToValueAtTime(.0008,t+d);o.connect(g);g.connect(S_.fx);o.start(t);o.stop(t+d+.05)}
function mNoise(d,type,fr,v,delay=0){const S_=mSnd();if(!S_||!state.sound)return;const C=AC,t=C.currentTime+delay,n=C.createBufferSource();n.buffer=S_.nb;const f=C.createBiquadFilter();f.type=type;f.frequency.value=fr;const g=C.createGain();
  g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0008,t+d);n.connect(f);f.connect(g);g.connect(S_.fx);n.start(t);n.stop(t+d+.05)}

function initMine(){
  $('mnPause').addEventListener('click',()=>mPause(true));$('mnpResume').onclick=()=>mPause(false);
  $('mnpRestart').onclick=()=>{mPause(false);mBank();mStart()};$('mnpOut').onclick=()=>{mPause(false);mFinish('quit')};
  $('mnpSound').onclick=()=>{setSound(!state.sound);$('mnpSound').textContent='Lyd: '+(state.sound?'på':'av')};
  // touch and mouse: swipe to the side to change track, up to jump, down to duck; a tap jumps
  const el=$('mnSwipe'),P=new Map();
  el.addEventListener('pointerdown',e=>{e.preventDefault();P.set(e.pointerId,{x:e.clientX,y:e.clientY,t:performance.now(),used:false});try{el.setPointerCapture(e.pointerId)}catch(_){}});
  el.addEventListener('pointermove',e=>{const p=P.get(e.pointerId);if(!p||p.used||MN.phase!=='run'||MN.paused)return;const dx=e.clientX-p.x,dy=e.clientY-p.y,th=Math.max(22,Math.min(innerWidth,innerHeight)*.045);
    if(Math.abs(dx)<th&&Math.abs(dy)<th)return;const q=MN.q;if(Math.abs(dx)>Math.abs(dy)){if(dx<0)q.left=true;else q.right=true}else if(dy<0)q.jump=true;else q.duck=true;p.used=true});   // one swipe is one move, however long it is
  const up=e=>{const p=P.get(e.pointerId);P.delete(e.pointerId);if(p&&!p.used&&e.type==='pointerup'&&performance.now()-p.t<350&&MN.phase==='run'&&!MN.paused)MN.q.jump=true};
  el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
  addEventListener('resize',()=>{if(MN.on)mLayout()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&MN.on)mPause(true)})}
initMine();
