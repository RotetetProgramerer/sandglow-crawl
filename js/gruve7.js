'use strict';
/* =================================================================
   GRUVE 7: the old coal mine in Gruvefjellet on Svalbard, and a wagon race through it. Drive into the mine entrance and
   you are a miner in a mine wagon, racing three other miners into the mountain on three tracks, seen from behind.
   Change track (← →, A D or swipe), jump (↑, W or swipe up), duck (↓, S or swipe down) and use what you found in a crate
   (space, Enter, X, the button or a tap). Rocks, parked wagons, barriers and walls close a track; low beams and icicles
   you duck under; broken rails you jump. A hit spins the wagon round and costs speed and coal, but nobody is put back.
   Coal makes the wagon faster (and is worth 3 nuts a lump), and so do the speed pads, a late jump over the broken rails,
   the slipstream behind a rival and a jump just as the countdown ends. At the far end the tunnel comes out in the
   daylight on top of the mountain.
   The mine itself is built from data/gruve7.js by makeMine (js/gruvesim.js), which also has the race and its physics.
   This file draws it in its own scene: the tunnel is one long tube along the centre line, lit by light baked into the
   vertex colours (the lamps on the walls, the daylight at the end) and a lamp on the wagon.
   Loaded after grotte.js (it borrows cGrid, cMul, cStd and cBox from there); uses the globals of game.js and
   world.js (state, renderer, car, prof, best, AC …) at run time.
   ================================================================= */
const MN={on:false,fade:null,built:false,mine:null,race:null,scene:null,cam:null,cart:null,acc:0,paused:false,result:false,phase:'',zone:-1,hudT:0,snd:null,mus:null,shake:0,
  q:{left:false,right:false,jump:false,duck:false,use:false},pad:null,padHold:false,bonus:0,banked:false,doneT:0,camLat:0,snap:true,clack:0,pulse:0,how:'',obsVis:[]};
const mineKey=()=>'svalbard/gruve7';
const M_TW=3.9,M_NUT=3,M_PRIZE=[150,80,40,10];   // half the width of the tunnel, nuts for a lump of coal, and for each place in the race
// the parts of the mine: the rock, the ballast between the sleepers, the light in the air, the height of the roof and the colour of the lamps
const MTHEME={
  stoll:{rock:'#7a6956',floor:'#5a5048',amb:[.44,.39,.34],top:4.3,lamp:'#ffb860'},
  kull:{rock:'#4a4643',floor:'#3a3735',amb:[.46,.44,.42],top:3.8,lamp:'#ffb860'},
  is:{rock:'#9cc2da',floor:'#a8c2d2',amb:[.5,.62,.78],top:4.6,lamp:'#bfe6ff'},
  sjakt:{rock:'#6c5646',floor:'#52463e',amb:[.42,.35,.31],top:4.7,lamp:'#ff9a50'},
  dag:{rock:'#8a827a',floor:'#77726c',amb:[.58,.58,.62],top:4.3,lamp:'#ffd9a0'}};
for(const k in MTHEME){const t=MTHEME[k];t.rockC=col(t.rock);t.floorC=col(t.floor);t.topC=[t.top]}
const M_HIT={ras:'Rett i steinraset!',vogn:'Rett i en kullvogn!',bukk:'Sporet var stengt!',vegg:'Sporet endte i veggen!',bjelke:'Au! Dukk under bjelken',istapper:'Istapper! Dukk',brudd:'Ned i sjakta!',hakke:'Truffet av en hakke!',felle:'Rett i en steinfelle!'};

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
  for(const p of m.cps)lamps.push({s:p.s,lat:M_TW-.9,h:2.2,r:8,i:.8,c:col('#ffd76a').map(v=>v*1.3)});
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
  // the wagons and the things of the race, and the particles
  mRaceVis(m,sc,grp);
  MN.parts=[];for(let i=0;i<48;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,transparent:true,depthWrite:false,opacity:0,blending:THREE.AdditiveBlending}));s.visible=false;sc.add(s);MN.parts.push({s,life:0,v:new THREE.Vector3()})}
  MN.hints=['lane','duck','jump'].map(need=>({need,s:(m.obs.find(o=>o.need===need)||{s0:-1}).s0}));
  MN.built=true}
// everything a wagon can run into
function mObstacles(m,grp,rockTex){const R=mulberry32(41),LW=MCFG.lane,dod=new THREE.DodecahedronGeometry(1,0),cone=new THREE.ConeGeometry(1,1,6),wheelG=new THREE.CylinderGeometry(.24,.24,.14,12),ball=new THREE.SphereGeometry(.14,10,8);
  const rock=cStd('#8c857c',{flatShading:true,roughness:.95}),rock2=cStd('#6f6962',{flatShading:true,roughness:.95}),steel=cStd('#5d646c',{roughness:.6,metalness:.4}),rust=cStd('#8a5236',{roughness:.85}),coalM=cStd('#17171a',{roughness:.4,metalness:.4}),
    wood=cStd('#8a6844',{roughness:.9}),blk=cStd('#1d1c1a'),ice=cStd('#d6f2ff',{emissive:LIN('#58b4e6'),emissiveIntensity:.5,roughness:.12,transparent:true,opacity:.93}),
    red=new THREE.MeshBasicMaterial({color:LIN('#ff5a3a')}),amber=new THREE.MeshBasicMaterial({color:LIN('#ffb040')}),
    stripe=(a,b)=>{const t=mStripeTex(a,b);return new THREE.MeshStandardMaterial({map:t,emissive:0xffffff,emissiveMap:t,emissiveIntensity:.4,roughness:.7})},rw=stripe('#f2f2ee','#d9342a'),yb=stripe('#f0c020','#1b1b1b'),
    wall=new THREE.MeshLambertMaterial({map:rockTex}),sign=[true,false].map(o=>new THREE.MeshBasicMaterial({map:mSignTex(o)}));
  const add=(g,geo,mat,x,y,z,sx,sy,sz)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.scale.set(sx,sy,sz);g.add(o);return o};
  for(const o of m.obs){const g=new THREE.Group(),top=mTop(m,o.s);mPut(g,o.s,0,0);grp.add(g);MN.obsVis[o.i]=g;const on=[-1,0,1].filter(L=>o.lanes[L+1]);
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
  MN.cpVis=m.cps.map(p=>{const g=new THREE.Group();mPut(g,p.s,M_TW-.9,0);grp.add(g);cBox(g,.14,2.3,.14,cStd('#5a3a22'),0,1.15,0);cBox(g,.5,.08,.08,cStd('#5a3a22'),-.2,2.26,0);
    const glass=new THREE.MeshBasicMaterial({color:LIN('#8a7040')}),l=new THREE.Mesh(boxGeo,glass);l.scale.set(.24,.34,.24);l.position.set(-.4,2.0,0);g.add(l);return{glass,gl:mGlow(g,'#ffc860',-.4,2.0,.1,2.4,.35)}})}
// a miner in his wagon. look: jacket, helmet, skin, and what sets him apart (beard, scarf, plait)
function mCart(look){const g=new THREE.Group(),spin=new THREE.Group(),tilt=new THREE.Group();g.add(spin);spin.add(tilt);
  const steel=cStd('#4a4e54',{roughness:.6,metalness:.5}),tub=cStd(look.tub,{roughness:.8,metalness:.15}),blk=cStd('#1b1b1d',{metalness:.5,roughness:.5}),coalM=cStd('#17171a',{roughness:.4,metalness:.4});
  cBox(tilt,1.25,.16,2.3,steel,0,.52,0);cBox(tilt,1.56,.62,2.36,tub,0,.9,0);cBox(tilt,1.64,.1,2.44,steel,0,1.24,0);cBox(tilt,1.3,.1,2.1,coalM,0,1.2,0);for(const z of[-1.27,1.27])cBox(tilt,.5,.16,.14,steel,0,.6,z);
  const wg=new THREE.CylinderGeometry(.25,.25,.14,14),wheels=[];for(const sx of[-1,1])for(const sz of[-1,1]){const w=new THREE.Mesh(wg,blk);w.rotation.z=Math.PI/2;w.position.set(sx*.55,.43,sz*.8);tilt.add(w);wheels.push(w)}
  // the man: he sits in the wagon and holds on to the front edge
  const man=new THREE.Group();man.position.set(0,1.2,.25);tilt.add(man);const jac=cStd(look.jacket,{roughness:.85}),skin=cStd(look.skin||'#e2b089',{roughness:.7}),hel=cStd(look.helmet,{roughness:.45,metalness:.1});
  cBox(man,.74,.72,.46,jac,0,.36,0);cBox(man,.78,.1,.5,cStd('#f0c020',{emissive:LIN('#f0c020'),emissiveIntensity:.25}),0,.3,0);   // the reflective band
  const head=new THREE.Mesh(new THREE.SphereGeometry(.23,14,10),skin);head.position.set(0,.96,0);man.add(head);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(.27,14,8,0,6.283,0,Math.PI/2),hel);cap.position.set(0,.98,0);man.add(cap);cBox(man,.5,.05,.2,hel,0,.99,-.26);
  const lamp=new THREE.Mesh(boxGeo,new THREE.MeshBasicMaterial({color:LIN('#fff0c0')}));lamp.scale.set(.14,.12,.08);lamp.position.set(0,1.1,-.27);man.add(lamp);mGlow(man,'#ffd890',0,1.1,-.34,1.1,.7);
  if(look.beard)cBox(man,.3,.3,.14,cStd('#f0efe8'),0,.8,-.19);if(look.scarf)cBox(man,.5,.14,.5,cStd(look.scarf),0,.76,0);if(look.plait)cBox(man,.12,.5,.12,cStd(look.plait),0,.6,.26);
  const arms=[];for(const sx of[-1,1]){const a=new THREE.Group();a.position.set(sx*.45,.62,0);cBox(a,.17,.62,.17,jac,0,-.26,0);cBox(a,.19,.16,.19,cStd('#3a3632'),0,-.6,0);a.rotation.x=1.15;man.add(a);arms.push(a)}
  // what shows what he has: the fire of a burst of speed, the shield and the magnet
  const fire=mGlow(tilt,'#ffa030',0,.9,1.7,2.6,0),fire2=mGlow(tilt,'#fff0c0',0,.9,1.45,1.3,0);
  const shield=new THREE.Mesh(new THREE.SphereGeometry(1.75,18,12),new THREE.MeshBasicMaterial({color:LIN('#6fe0ff'),transparent:true,opacity:.22,blending:THREE.AdditiveBlending,depthWrite:false}));shield.position.y=1.3;shield.visible=false;g.add(shield);
  const mag=mGlow(g,'#c08aff',0,2.9,0,1.6,0);
  g.traverse(q=>{q.castShadow=false});return{g,spin,tilt,man,arms,wheels,fire,fire2,shield,mag,duck:1}}
const M_LOOK=[{name:'Du',jacket:'#d9432f',helmet:'#f0c020',tub:'#8a5236',hex:'#ffd060'},{jacket:'#2f6fd6',helmet:'#f2f2ee',tub:'#4a6a8a',plait:'#c8862a',scarf:'#f2f2ee',hex:'#6aa8ff'},
  {jacket:'#3f9a1e',helmet:'#d9342a',tub:'#5a6a3a',scarf:'#1b1b1b',hex:'#7be05a'},{jacket:'#6a6a70',helmet:'#7a5236',tub:'#5a5a5e',beard:true,hex:'#d8d8dc'}];
function mNameTag(text,hex){const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');x.font='600 34px "Barlow Condensed",sans-serif';x.textAlign='center';x.textBaseline='middle';
  x.lineWidth=7;x.strokeStyle='#14120E';x.strokeText(text,128,34);x.fillStyle=hex;x.fillText(text,128,34);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false}));s.scale.set(3,.75,1);return s}
// the things of the race: the wagons, the crates, the speed pads, the traps and the pickaxes in the air
function mRaceVis(m,sc,grp){
  MN.carts=M_LOOK.map((L,i)=>{const v=mCart(L);sc.add(v.g);if(i){v.tag=mNameTag(MRIVALS[i-1].name,L.hex);v.tag.position.y=3.3;v.g.add(v.tag)}
    const sh=new THREE.Mesh(new THREE.PlaneGeometry(2.4,3.3),new THREE.MeshBasicMaterial({map:dustTex,color:0x000000,transparent:true,opacity:.55,depthWrite:false}));sh.rotation.order='YXZ';sc.add(sh);v.shadow=sh;return v});
  // crates: a turning box with a question mark
  {const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#3a2a14';x.fillRect(0,0,128,128);x.strokeStyle='#ffc94a';x.lineWidth=10;x.strokeRect(9,9,110,110);x.fillStyle='#ffe9a0';x.font='700 92px "Barlow Condensed",sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('?',64,70);
    const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;const mat=new THREE.MeshStandardMaterial({map:t,emissive:0xffffff,emissiveMap:t,emissiveIntensity:.75,roughness:.5});
    MN.boxVis=m.boxes.map(b=>{const g=new THREE.Group();mPut(g,b.s,b.lane*MCFG.lane,1.25);grp.add(g);const q=new THREE.Mesh(boxGeo,mat);q.scale.setScalar(.95);g.add(q);mGlow(g,'#ffc94a',0,0,0,2.6,.4);return{g,q}})}
  // speed pads: arrows of light that run along the track
  {const c=document.createElement('canvas');c.width=64;c.height=128;const x=c.getContext('2d');x.strokeStyle='#7dfff0';x.lineWidth=12;x.lineJoin='miter';for(let i=0;i<2;i++){x.beginPath();x.moveTo(8,58+i*64);x.lineTo(32,22+i*64);x.lineTo(56,58+i*64);x.stroke()}
    const t=MN.padTex=new THREE.CanvasTexture(c);t.wrapT=THREE.RepeatWrapping;t.repeat.set(1,2);t.encoding=THREE.sRGBEncoding;const mat=new THREE.MeshBasicMaterial({map:t,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
    for(const p of m.pads){const q=new THREE.Mesh(new THREE.PlaneGeometry(1.5,p.len),mat);mPut(q,p.s+p.len/2,p.lane*MCFG.lane,.24);q.rotation.x-=Math.PI/2;grp.add(q);const g=new THREE.Group();mPut(g,p.s+p.len/2,p.lane*MCFG.lane,0);grp.add(g);mGlow(g,'#4cf0e0',0,.5,0,3.6,.35)}}
  const dod=new THREE.DodecahedronGeometry(1,0),rock=cStd('#8c857c',{flatShading:true,roughness:.95});
  MN.trapVis=Array.from({length:8},()=>{const g=new THREE.Group();for(const[x,y,z,r]of[[0,.3,0,.42],[-.45,.22,.2,.3],[.42,.2,-.15,.28],[.1,.6,.05,.24]]){const q=new THREE.Mesh(dod,rock);q.position.set(x,y+.15,z);q.scale.setScalar(r);q.rotation.set(x*3,y*5,z*7);g.add(q)}
    mGlow(g,'#ff5a2a',0,.6,.1,2.4,.75);g.visible=false;sc.add(g);return g});
  MN.shotVis=Array.from({length:6},()=>{const g=new THREE.Group(),t=new THREE.Group();g.add(t);cBox(t,.09,1,.09,cStd('#8a6844'),0,0,0);cBox(t,.8,.12,.14,cStd('#aab0b8',{metalness:.7,roughness:.3}),0,.46,0);mGlow(g,'#fff0c0',0,0,0,2.2,.7);g.visible=false;g.userData.t=t;sc.add(g);return g})}

/* ---------- in and out ---------- */
function mineEnter(){if(MN.on||MN.fade)return;initAudio();if(AC&&AC.state==='suspended')AC.resume();state.mode='mine';car.vel.set(0,0,0);car.w.set(0,0,0);car.throttle=0;setOffer(null);
  if(!prof.mine)prof.mine={};prof.mine.found=true;saveProf();
  $('fade').classList.add('on');MN.fade={t:0,hold:.25,cb:()=>{if(!MN.built)mBuild();MN.on=true;$('hud').hidden=true;$('hint').hidden=true;$('mineHud').hidden=false;mLayout();mStart()}}}
function mStart(){const m=MN.mine,R=MN.race=makeMineRace(m,{speedScale:Math.max(.7,Math.min(1.15,state.speed/100)),easy:state.assist,seed:1+Math.floor(Math.random()*1e6)});MN.cart=R.P;
  MN.phase='count';MN.paused=false;MN.result=false;MN.acc=0;MN.zone=-1;MN.bonus=0;MN.banked=false;MN.doneT=0;MN.snap=true;MN.shake=0;MN.clack=0;MN.how='';MN.q.left=MN.q.right=MN.q.jump=MN.q.duck=MN.q.use=false;
  MN.cnt=4;MN.placeWas=4;MN.cpI=0;MN.itemWas=null;MN.hudItem='';MN.mus=null;MN.warned=new Set();
  MN.hints.forEach(h=>h.done=false);mCoalPose(true);MN.obsVis.forEach(g=>{if(g)g.visible=true});MN.cpVis.forEach(l=>{l.glass.color.set(LIN('#8a7040'));l.gl.material.color.set(LIN('#ffc860'));l.gl.material.opacity=.35});
  MN.carts.forEach(v=>{v.duck=1;v.man.scale.y=1;v.spin.rotation.y=0});$('mnPauseMenu').hidden=true;$('result').hidden=true;$('mnCount').textContent='';mHud(true);
  mNotice(document.body.classList.contains('is-touch')?'Sveip opp på GÅ for flyvende start':'Trykk ↑ på GÅ for flyvende start',2600)}
// back to the island: in front of the entrance, or (after the whole race) out of the day opening on top of the mountain
function mineExit(top){if(MN.fade||!MN.on)return;$('fade').classList.add('on');
  MN.fade={t:0,hold:.2,cb:()=>{MN.on=false;MN.phase='';MN.result=false;MN.paused=false;if(MN.snd)MN.snd.master.gain.setTargetAtTime(0,AC.currentTime,.1);$('mineHud').hidden=true;$('mnPauseMenu').hidden=true;
    if(!$('result').hidden){$('result').hidden=true;bResultReset()}
    const D=LV.mineDef,o=top&&D.top?D.top:D.out;placeCar(car,o.x,o.z,o.h);state.checkpoint={x:o.x,z:o.z,h:o.h};state.flipT=0;state.air=0;state.mode='play';state.askCool='mine';camSnap=true;showHud();
    toast(top?'Oppe på Gruvefjellet!':'Ute i kulda igjen')}}}

/* ---------- a step of the race: physics and what happens ---------- */
const M_ORD=['','1.','2.','3.','4.'];
function mBurst(s,lat,h,n,a,b){mXYZ(s,lat,h,_mv);for(let i=0;i<n;i++)mPart(_mv.x,_mv.y,_mv.z,i%2?a:b,true)}
function mStep(dt){const R=MN.race,c=R.P,m=MN.mine,q=MN.q,inp={left:q.left,right:q.right,jump:q.jump,duck:q.duck,use:q.use,duckHold:MN.padHold||keys.has('arrowdown')||keys.has('s')};q.left=q.right=q.jump=q.duck=q.use=false;
  stepMineRace(R,inp,dt);const va=state.volAmb/70,touch=document.body.classList.contains('is-touch'),LW=MCFG.lane;
  for(const e of R.ev){const me=e.c===0,k=R.carts[e.c||0],near=Math.abs(k.s-c.s)<45;
    if(e.type==='go'){MN.phase='run';mTone(880,.5,'square',.14)}
    else if(e.type==='rocket'){mNotice('Flyvende start!',1300);mWhoosh(1)}
    else if(e.type==='early')mNotice('For tidlig!',1100,true);
    else if(e.type==='lane'){if(me)mNoise(.09,'bandpass',900,.12)}
    else if(e.type==='side'){if(me){mNoise(.08,'bandpass',600,.3);MN.shake=Math.max(MN.shake,.25)}}
    else if(e.type==='jump'){if(me)mTone(260,.2,'sine',.12,-260)}
    else if(e.type==='land'){if(me){mNoise(.16,'lowpass',260,.5);mTone(70,.14,'sine',.3,30);MN.shake=Math.max(MN.shake,.12)}}
    else if(e.type==='trick'){if(me){mNotice(e.perf?'Perfekt hopp!':'Fint hopp!',900);mTone(1175,.1,'triangle',.14);mTone(1568,.22,'triangle',.14,0,.08);mWhoosh(.6)}}
    else if(e.type==='pad'){if(me){mWhoosh(.8);mTone(660,.25,'sawtooth',.07,-500)}}
    else if(e.type==='draft'){if(me){mNotice('Dragsug!',900);mWhoosh(.7)}}
    else if(e.type==='coal'){const z=m.coal[e.i];MN.pulse=1;const p=Math.pow(2,Math.min(e.combo%10,9)/12),v=.1*va+.05;mTone(880*p,.06,'triangle',v);mTone(1320*p,.13,'triangle',v,0,.05);for(let i=0;i<3;i++)mPart(z.px,z.py,z.pz,'#ffc060');
      if(e.combo%10===0){MN.bonus+=5;mNotice(e.combo+' på rad! +5 ⚙',1000);mTone(1568,.3,'triangle',.16,0,.12)}}
    else if(e.type==='box'){mBurst(m.boxes[e.i].s,m.boxes[e.i].lane*LW,1.25,8,'#ffc94a','#fff0c0');if(me)[784,988,1175,1568].forEach((n,i)=>mTone(n,.09,'square',.07,0,i*.07))}
    else if(e.type==='use'){if(e.item==='turbo'){if(me){mNotice('Turbo!',1000);MN.shake=.5}if(near)mWhoosh(1.3)}else if(e.item==='hakke'){if(near){mNoise(.2,'bandpass',1400,.3);mTone(500,.2,'sawtooth',.06,-900)}}
      else if(e.item==='felle'){if(near)mNoise(.18,'lowpass',300,.5)}else if(me){mTone(e.item==='skjold'?784:392,.35,'sine',.15,-300)}}
    else if(e.type==='shield'){if(me){mNotice('Skjoldet tok støyten',1100);mTone(1046,.25,'sine',.16,400)}mBurst(k.s,k.x*LW,1.3,10,'#6fe0ff','#ffffff')}
    else if(e.type==='smash'){const o=m.obs[e.o],g=MN.obsVis[e.o];if(g)g.visible=false;for(let L=-1;L<=1;L++)if(o.lanes[L+1])mBurst(o.s,L*LW,1,9,'#c8c0b4','#8a8278');if(Math.abs(o.s-c.s)<60)mNoise(.35,'lowpass',900,.5)}
    else if(e.type==='hit'){mBurst(k.s+1,k.x*LW,1,12,'#ffb040','#fff0c0');
      if(me){MN.shake=1;mNoise(.6,'lowpass',520,.9);mTone(90,.4,'sine',.5,50);mNotice(M_HIT[e.kind]+(e.drop?' · mistet '+e.drop+' kull':''),1300,true)}else if(near)mNoise(.3,'lowpass',500,.35)}
    else if(e.type==='struck'){if(e.by===0)mNotice('Traff '+k.name+'!',1100)}
    else if(e.type==='trapped'){if(e.by===0&&!me)mNotice(k.name+' gikk i fella!',1100)}
    else if(e.type==='bump'){if(me||e.o===0){mNoise(.1,'bandpass',700,.4);mTone(180,.1,'square',.1);MN.shake=Math.max(MN.shake,.3)}}
    else if(e.type==='back'){if(me)MN.snap=true}
    else if(e.type==='fin'){if(me){MN.phase='done';MN.doneT=0;(e.place===1?[523,659,784,1047,784,1047]:[523,659,784]).forEach((n,i,a)=>mTone(n,i===a.length-1?.9:.16,'triangle',.22,0,i*.17))}else if(near)mTone(660,.3,'triangle',.1)}}
  R.ev.length=0;
  if(MN.phase!=='run')return;
  // what you found in the crate is ready
  if(c.item&&c.itemT<=0&&MN.itemWas!==c.item){MN.itemWas=c.item;mTone(1320,.12,'triangle',.14);mTone(1760,.22,'triangle',.14,0,.1);mNotice(MITEMS[c.item]+(touch?': trykk':': mellomrom'),1300)}if(!c.item)MN.itemWas=null;
  // overtaking and being overtaken
  if(c.place!==MN.placeWas){const up=c.place<MN.placeWas;MN.placeWas=c.place;MN.pulseP=1;mTone(up?660:520,.1,'square',.08);mTone(up?990:390,.16,'square',.08,0,.09)}
  // the lanterns on the wall: your place as you pass
  while(MN.cpI<m.cps.length&&m.cps[MN.cpI].s<=c.s){const l=MN.cpVis[MN.cpI];l.glass.color.set(LIN('#7dff8a'));l.gl.material.color.set(LIN('#5cff7a'));l.gl.material.opacity=.8;MN.cpI++;if(c.s>20){mTone(523,.5,'sine',.12);mNotice(M_ORD[c.place]+' plass',1000)}}
  // a pickaxe coming from behind on your track
  for(const s of R.shots)if(s.own!==0&&!MN.warned.has(s)&&s.lane===c.lane&&s.s<c.s&&c.s-s.s<30){MN.warned.add(s);mNotice('Hakke bak deg! Bytt spor',900,true);mTone(988,.08,'square',.12);mTone(988,.08,'square',.12,0,.12)}
  // the things to do, said once each, a little before the first time they are needed
  if(c.stun<=0)for(const h of MN.hints)if(!h.done&&h.s>0&&c.s>h.s-Math.max(14,c.v*2.1)&&c.s<h.s){h.done=true;
    mNotice(h.need==='lane'?(touch?'Sveip til siden: bytt spor':'← →  bytt spor'):h.need==='duck'?(touch?'Sveip ned: dukk':'↓  dukk'):(touch?'Sveip opp: hopp':'↑  hopp'),1900)}}
// the nuts of the trip go into the pocket once, however it ends
function mBank(){if(MN.banked||!MN.cart)return 0;MN.banked=true;const n=MN.cart.got*M_NUT+MN.bonus;prof.nuts+=n;saveProf();return n}
function mFinish(how){if(MN.result)return;const m=MN.mine,R=MN.race,c=R.P,key=mineKey(),prev=best[key],done=how==='end',p=c.place,L=[];
  if(done){const rk=mineRanking(R);L.push('<li>'+rk.map(r=>`${r.i?'':'<b>'}${r.place}. ${r.name} ${fmtTime(r.t)}${r.i?'':'</b>'}`).join(' &nbsp;·&nbsp; ')+'</li>');
    const a=M_PRIZE[p-1];MN.bonus+=a;L.push(`<li><b>${M_ORD[p]} plass:</b> +${a} ⚙</li>`);if(!c.hits){MN.bonus+=50;L.push('<li><b>Uten et eneste krasj:</b> +50 ⚙</li>')}prof.mine.done=(prof.mine.done||0)+1}
  L.push(`<li><b>${c.got} kullklumper</b> × ${M_NUT} = ${c.got*M_NUT} ⚙${c.maxCombo>=10?' (lengste rekke '+c.maxCombo+')':''}</li>`);
  const total=mBank(),rec=done&&(!prev||!prev.done||c.fin<prev.t-.05);
  if(done&&prev&&prev.done)L.push(rec?'<li><b>Ny bestetid!</b></li>':`<li><b>Bestetiden din:</b> ${fmtTime(prev.t)}</li>`);
  if(done&&p>1)L.push('<li><b>Tips:</b> plukk kull for fart, hopp sent over bruddene og legg deg rett bak en rival for dragsug.</li>');
  if(!done)L.push('<li><b>Kjør løpet ferdig,</b> så kommer du opp i dagen på toppen av Gruvefjellet.</li>');
  best[key]={t:done?(prev&&prev.done?Math.min(prev.t,c.fin):c.fin):(prev?prev.t:0),p:done?Math.min(p,prev&&prev.p||4):(prev&&prev.p||0),k:Math.max(c.got,prev?prev.k||0:0),done:done||!!(prev&&prev.done)};store.set('best',best);
  MN.phase='result';MN.result=true;MN.how=how;const stars=done?4-p:0;
  $('rLevel').textContent='Svalbard · Gruve 7';$('rTitle').textContent=!done?'Ut av gruva':p===1?'Seier i Gruve 7!':M_ORD[p]+' plass';
  $('rTime').textContent=fmtTime(done?c.fin:R.t);$('rPenL').textContent='Kull';$('rPen').textContent=c.got+'/'+m.coal.length;$('rGatesL').textContent=done?'Plass':'Kom til';$('rGates').textContent=done?p+' av 4':Math.round(100*Math.min(1,c.s/m.len))+' %';
  $('rStars').innerHTML=[0,1,2].map(i=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z" fill="${i<stars?'#E5A92B':'rgba(242,232,208,.15)'}"/></svg>`).join('');$('rStars').setAttribute('aria-label',stars+' av 3 stjerner');
  $('rLog').innerHTML=L.join('');$('rNuts').textContent='+'+fmtN(total);$('rNutsNote').textContent='Du har nå '+fmtN(prof.nuts)+' ⚙.';
  $('rNext').textContent=done?'Ut i dagen':'Kjør ut av gruva';$('rRetry').textContent=done&&p>1?'Omkamp':'Kjør en gang til';$('rRetry').hidden=false;$('rMenu').textContent='Til menyen';$('rMenu').hidden=true;$('rGarage').hidden=true;
  setTimeout(()=>{if(MN.result){$('result').hidden=false;(done&&p>1?$('rRetry'):$('rNext')).focus()}},done?200:500)}
// the result buttons (game.js): next = out to the island, retry = a new race from the start
function mineResultBtn(btn){if(!MN.on||!MN.result)return false;MN.result=false;$('result').hidden=true;bResultReset();$('rMenu').hidden=false;
  if(btn==='retry')mStart();else mineExit(MN.how==='end');return true}
function mPause(on){if(!MN.on||MN.result||(MN.phase!=='run'&&MN.phase!=='count'))return;MN.paused=!!on;$('mnPauseMenu').hidden=!on;if(on){$('mnpSound').textContent='Lyd: '+(state.sound?'på':'av');$('mnpResume').focus()}}
const mLive=()=>MN.on&&!MN.paused&&!MN.result&&(MN.phase==='run'||MN.phase==='count');
function mineKeyDown(k){if(MN.fade||!MN.on||MN.result)return;if(k==='escape'||k==='p'){mPause($('mnPauseMenu').hidden);return}if(!$('mnPauseMenu').hidden)return;if(k==='m'){setSound(!state.sound);return}
  if(!mLive())return;const q=MN.q;if(k==='arrowleft'||k==='a')q.left=true;else if(k==='arrowright'||k==='d')q.right=true;else if(k==='arrowup'||k==='w')q.jump=true;else if(k==='arrowdown'||k==='s')q.duck=true;else if(k===' '||k==='enter'||k==='x')q.use=true}
// the gamepad: the stick or the cross changes track, jumps and ducks; A jumps, B ducks and X uses what you have
function mPad(){const pads=navigator.getGamepads?navigator.getGamepads():[],gp=[...pads].find(p=>p&&p.connected);if(!gp){MN.pad=null;MN.padHold=false;return}
  const ax=gp.axes[0]||0,ay=gp.axes[1]||0,b=i=>!!(gp.buttons[i]&&gp.buttons[i].pressed),now={l:ax<-.5||b(14),r:ax>.5||b(15),u:ay<-.6||b(12)||b(0),d:ay>.6||b(13)||b(1),x:b(2)||b(5)||b(7)},was=MN.pad||now,q=MN.q;
  if(mLive()){if(now.l&&!was.l)q.left=true;if(now.r&&!was.r)q.right=true;if(now.u&&!was.u)q.jump=true;if(now.d&&!was.d)q.duck=true;if(now.x&&!was.x)q.use=true}MN.padHold=now.d;MN.pad=now}

/* ---------- every frame (from game.js) ---------- */
function updateMine(dt){
  if(MN.fade){const f=MN.fade;f.t+=dt;if(f.t>.9&&!f.done){f.done=true;f.cb()}if(f.t>.9+f.hold){$('fade').classList.remove('on');MN.fade=null}}
  if(!MN.on)return false;
  mPad();
  if(!MN.paused&&!MN.result&&!MN.fade){MN.acc+=dt;let n=0;while(MN.acc>=MSTEP&&n<12){mStep(MSTEP);MN.acc-=MSTEP;n++}if(n>=12)MN.acc=0}
  if(MN.phase==='done'){MN.doneT+=dt;if(MN.doneT>2.2)mFinish('end')}
  MN.shake*=Math.exp(-dt*6);
  mPose(dt);mCamera(dt);MN.hudT-=dt;if(MN.hudT<=0){MN.hudT=1/15;mHud()}mSndUpdate(dt);
  renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);renderer.render(MN.scene,MN.cam);return true}
const _fogA=new THREE.Color(0x070605),_fogB=new THREE.Color(0xe6eef6).convertSRGBToLinear();
function mPose(dt){const R=MN.race,c=R.P,m=MN.mine,tm=performance.now()*.001,LW=MCFG.lane,k=1-Math.exp(-dt*14),run=!MN.paused;
  R.carts.forEach((q,i)=>{const v=MN.carts[i],lat=q.x*LW,stun=q.stun>0&&!q.fall,bo=q.boost>0;
    mPut(v.g,q.s,lat,Math.max(-7,q.y));v.spin.rotation.y=stun?(1-q.stun/MCFG.spinT)*Math.PI*4:0;
    v.tilt.rotation.z=-q.lean*.16;v.tilt.rotation.x=Math.max(-.3,Math.min(.3,q.vy*.022))+(q.fall?-.6:0)+(bo?-.05:0);
    if(run)for(const w of v.wheels)w.rotation.x-=q.v*dt/.25;
    // the man: down in the wagon when he ducks, arms up in the air, leaning into the change of track, and waving when he is in
    v.duck+=((q.duck>0?.42:1)-v.duck)*k;v.man.scale.y=v.duck;v.man.rotation.z=-q.lean*.3+(stun?Math.sin(tm*30)*.2:0);v.man.rotation.x=bo?-.22:q.duck>0?-.3:0;
    const up=q.air||stun||q.fall?-2.6:q.fin?-2.4+Math.sin(tm*9+i)*.4:1.15;for(const a of v.arms)a.rotation.x+=(up-a.rotation.x)*k;
    v.fire.material.opacity=bo?.55+.3*Math.random():0;v.fire2.material.opacity=bo?.8:0;v.fire.scale.setScalar(bo?2.2+Math.random()*1.2:1);
    v.shield.visible=q.shield;if(q.shield)v.shield.material.opacity=.18+.08*Math.sin(tm*6);v.mag.material.opacity=q.magnet>0?.5+.3*Math.sin(tm*10):0;
    v.g.visible=!(q.inv>0&&q.stun<=0&&!bo&&Math.floor(tm*14)%2)&&(!i||q.s>c.s-3.4);   // it blinks while nothing can hit it; a rival right behind you would hide the track
    if(v.tag)v.tag.visible=q.s>c.s+2.5;
    v.shadow.visible=q.y>=0&&!q.fall&&v.g.visible;if(v.shadow.visible){mPut(v.shadow,q.s,lat,.21);v.shadow.rotation.x-=Math.PI/2;const z=1/(1+q.y*.5);v.shadow.scale.set(z,z,1);v.shadow.material.opacity=.55*z}
    if(run&&bo&&q.y<=0&&Math.random()<dt*30){mXYZ(q.s-1.2,lat+(Math.random()<.5?-.55:.55),.25,_mv);mPart(_mv.x,_mv.y,_mv.z,'#ffb040',true)}});
  // crates turn, pads run, traps lie and pickaxes fly
  MN.boxVis.forEach((b,i)=>{b.g.visible=R.boxT[i]<=0;if(b.g.visible){b.q.rotation.y=tm*1.6+i;b.q.rotation.x=.5;b.q.position.y=Math.sin(tm*2.2+i)*.1}});
  if(run)MN.padTex.offset.y-=dt*2.4;
  MN.trapVis.forEach((g,i)=>{const q=R.traps[i];g.visible=!!q;if(q)mPut(g,q.s,q.lane*LW,0)});
  MN.shotVis.forEach((g,i)=>{const q=R.shots[i];g.visible=!!q;if(q){mPut(g,q.s,q.lane*LW,1.4);g.userData.t.rotation.x=-tm*22}});
  mXYZ(c.s+3.5,c.x*LW*.7,2.3,MN.lamp.position);
  // the dark gives way to the daylight on the last stretch
  {const d=mDay(m,c.s+26);MN.scene.fog.color.copy(_fogA).lerp(_fogB,d);MN.scene.background.copy(MN.scene.fog.color);MN.scene.fog.near=16+d*30;MN.scene.fog.far=100+d*60}
  mCoalPose(false);
  // sparks from the wheels now and then, more on the steep way down
  if(run&&c.stun<=0&&c.y<=0&&c.v>8&&Math.random()<dt*(c.v>15?16:3)){mXYZ(c.s-1,c.x*LW+(Math.random()<.5?-.55:.55),.25,_mv);mPart(_mv.x,_mv.y,_mv.z,'#ffb040',true)}
  for(const p of MN.parts){if(p.life<=0)continue;p.life-=dt*1.8;p.v.y-=7*dt;p.s.position.addScaledVector(p.v,dt);p.s.material.opacity=Math.max(0,p.life);if(p.life<=0)p.s.visible=false}}
// the coal turns, and its glow twinkles; taken lumps are scaled to nothing, and with the magnet the lumps ahead lean in towards the wagon
function mCoalPose(all){const G=MN.coalIM,K=MN.mine.coal,c=MN.cart,tm=performance.now()*.001,C=G.glow.geometry.attributes.color,s0=c?c.s:0;
  for(let i=0;i<K.length;i++){const k=K[i];if(!all&&(k.s<s0-8||k.s>s0+125))continue;const on=!(c&&c.taken[i]);_mp.set(k.px,k.py+Math.sin(tm*2.4+i)*.06,k.pz);_me.set(tm*1.3+i,tm*1.9+i*1.7,0);_mq.setFromEuler(_me);_ms.setScalar(on?1:0);_mm4.compose(_mp,_mq,_ms);G.im.setMatrixAt(i,_mm4);
    const g=on?.75+.25*Math.sin(tm*4+i*1.3):0;C.setXYZ(i,g,g*.66,g*.24)}
  G.im.instanceMatrix.needsUpdate=true;C.needsUpdate=true}
function mPart(x,y,z,hex,fast){const p=MN.parts.find(q=>q.life<=0)||MN.parts[Math.floor(Math.random()*MN.parts.length)];p.life=1;p.s.visible=true;p.s.material.color.set(LIN(hex));const sc=fast?.22:.32;p.s.scale.set(sc,sc,1);
  p.s.position.set(x,y,z);const sp=fast?5:2.4;p.v.set((Math.random()-.5)*sp,Math.random()*sp*.8+.6,(Math.random()-.5)*sp-(fast?0:MN.cart.v*.5))}
// the camera: behind and above the wagon, following it sideways a little slower than it moves; it pulls back and widens in a burst of speed
function mCamera(dt){const c=MN.cart,cam=MN.cam,port=cam.aspect<1,bo=c.boost>0?1:0,tl=c.x*MCFG.lane*.82;MN.camB=(MN.camB||0)+(bo-(MN.camB||0))*(1-Math.exp(-dt*5));const back=(port?8.6:6.8)+MN.camB*1.1;
  if(MN.snap){MN.camLat=tl;MN.snap=false}else MN.camLat+=(tl-MN.camLat)*(1-Math.exp(-dt*8));
  const sh=MN.shake*.35,top=mTop(MN.mine,c.s-back),h=Math.min(top-.75,3+Math.max(0,c.y)*.3);
  mXYZ(c.s-back,MN.camLat+(Math.random()-.5)*sh,h+(Math.random()-.5)*sh,cam.position);mXYZ(c.s+11,MN.camLat*1.05,1.2,_mv2);cam.lookAt(_mv2);
  const fov=(port?70:57)+Math.min(8,c.v*.45)+MN.camB*9;if(Math.abs(fov-cam.fov)>.05){cam.fov+=(fov-cam.fov)*(1-Math.exp(-dt*6));cam.updateProjectionMatrix()}}
function mLayout(){if(!MN.cam)return;MN.cam.aspect=innerWidth/innerHeight;MN.cam.updateProjectionMatrix()}

/* ---------- HUD ---------- */
const M_ICON={turbo:'<path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="#ffb040" stroke="#14120E" stroke-width="1.5" stroke-linejoin="round"/>',
  hakke:'<path d="M4 9c5-5 11-5 16 0-5-2-11-2-16 0z" fill="#c8ced6" stroke="#14120E" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 7v14" stroke="#8a6844" stroke-width="3" stroke-linecap="round"/>',
  felle:'<path d="M3 19l4-8 4 3 3-6 7 11z" fill="#8c857c" stroke="#14120E" stroke-width="1.5" stroke-linejoin="round"/>',
  skjold:'<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="#6fe0ff" stroke="#14120E" stroke-width="1.5" stroke-linejoin="round"/>',
  magnet:'<path d="M5 3h5v9a2 2 0 0 0 4 0V3h5v9a7 7 0 0 1-14 0z" fill="#c08aff" stroke="#14120E" stroke-width="1.5" stroke-linejoin="round"/><path d="M5 7h5M14 7h5" stroke="#14120E" stroke-width="1.5"/>'};
function mHud(force){const R=MN.race,c=MN.cart,m=MN.mine;if(!c)return;const b=best[mineKey()],tm=performance.now();
  // the countdown
  {const n=R.count>0?Math.ceil(R.count):R.t<.9?0:-1;if(n!==MN.cnt){MN.cnt=n;const el=$('mnCount');el.textContent=n>0?n:n===0?'GÅ!':'';el.classList.remove('on');void el.offsetWidth;if(n>=0)el.classList.add('on');if(n>0)mTone(440,.18,'square',.12)}}
  const pl=$('mnPlace');pl.textContent=M_ORD[c.place];pl.dataset.p=c.place;if(MN.pulseP){MN.pulseP=0;pl.classList.remove('pulse');void pl.offsetWidth;pl.classList.add('pulse')}
  $('mnTime').textContent=fmtTime(c.fin||R.t);$('mnBest').textContent=b&&b.done?'Bestetid '+fmtTime(b.t):'Ingen bestetid ennå';
  $('mnCoal').textContent=c.got;$('mnNuts').textContent='fart +'+Math.round(c.coal*MCFG.coalV*100)+' %';if(MN.pulse>0){$('mnCoalBox').classList.remove('pulse');void $('mnCoalBox').offsetWidth;$('mnCoalBox').classList.add('pulse');MN.pulse=0}
  // what you hold: the crate spins through everything before it settles
  {const roll=c.item&&c.itemT>0,key=!c.item?'':roll?Object.keys(M_ICON)[Math.floor(tm/90)%5]:c.item,st=key+(roll?'~':'');if(st!==MN.hudItem||force){MN.hudItem=st;const el=$('mnItem');el.classList.toggle('has',!!c.item&&!roll);el.classList.toggle('roll',!!roll);
    $('mnItemIcon').innerHTML=key?`<svg viewBox="0 0 24 24" aria-hidden="true">${M_ICON[key]}</svg>`:'';$('mnItemName').textContent=c.item&&!roll?MITEMS[c.item]:roll?'…':'Tom';el.setAttribute('aria-label',c.item&&!roll?'Bruk '+MITEMS[c.item]+' (mellomrom)':'Ingenting i kassen')}}
  $('mnSpeed').classList.toggle('on',c.boost>0&&!c.fin);
  $('mnProg').style.width=(100*Math.min(1,c.s/m.len)).toFixed(1)+'%';R.carts.forEach((q,i)=>{if(i)$('mnDot'+i).style.left=(100*Math.max(0,Math.min(1,q.s/m.len))).toFixed(1)+'%'});
  const zi=mineZone(m,c.s);if(zi!==MN.zone||force){MN.zone=zi;const el=$('mnZone');el.textContent=zi===m.zones.length-1&&!force?'Siste strekk: '+m.zones[zi].name:m.zones[zi].name;el.classList.remove('on');void el.offsetWidth;el.classList.add('on')}}
function mNotice(text,ms=1500,bad){const n=$('mnNotice');n.textContent=text;n.classList.toggle('bad',!!bad);n.classList.add('on');clearTimeout(n._t);n._t=setTimeout(()=>n.classList.remove('on'),ms)}

/* ---------- sound: the rumble of the wagon, the clack of the rail joints, an echo for everything and a tune that speeds up (WebAudio, no files) ---------- */
function mSnd(){if(MN.snd||!AC)return MN.snd;try{const C=AC,master=C.createGain();master.gain.value=0;master.connect(C.destination);
  const echo=C.createDelay(1);echo.delayTime.value=.19;const fb=C.createGain();fb.gain.value=.34;const ef=C.createBiquadFilter();ef.type='lowpass';ef.frequency.value=1700;echo.connect(ef);ef.connect(fb);fb.connect(echo);ef.connect(master);
  const fx=C.createGain();fx.gain.value=.8;fx.connect(master);const send=C.createGain();send.gain.value=.45;fx.connect(send);send.connect(echo);
  const nz=C.createBufferSource();nz.buffer=noiseBuf(C,3);nz.loop=true;const rf=C.createBiquadFilter();rf.type='lowpass';rf.frequency.value=160;const rg=C.createGain();rg.gain.value=0;nz.connect(rf);rf.connect(rg);rg.connect(master);
  const hf=C.createBiquadFilter();hf.type='bandpass';hf.frequency.value=2600;hf.Q.value=1.5;const hg=C.createGain();hg.gain.value=0;nz.connect(hf);hf.connect(hg);hg.connect(master);nz.start();
  const mus=C.createGain();mus.gain.value=0;const mf=C.createBiquadFilter();mf.type='lowpass';mf.frequency.value=2600;mus.connect(mf);mf.connect(master);
  MN.snd={master,fx,rf,rg,hg,mus,nb:noiseBuf(C,1)}}catch(e){MN.snd=null}return MN.snd}
// the tune: four bars in A minor, a bass on every beat, a line of eighths over it and a tick on the off-beats. Faster in every part of the mine
const M_BASS=[[45,45,52,45],[41,41,48,41],[43,43,50,43],[40,40,47,52]],M_LEAD=[[69,72,76,72,81,76,72,76],[69,72,77,72,81,77,72,77],[67,71,74,71,79,74,71,74],[68,71,76,71,80,76,74,71]],mHz=n=>440*Math.pow(2,(n-69)/12);
function mNote(t,fr,d,type,v){const S_=MN.snd,C=AC,o=C.createOscillator(),g=C.createGain();o.type=type;o.frequency.setValueAtTime(fr,t);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+.01);g.gain.exponentialRampToValueAtTime(.0008,t+d);o.connect(g);g.connect(S_.mus);o.start(t);o.stop(t+d+.03)}
function mMusic(){const S_=MN.snd,R=MN.race,C=AC,play=MN.on&&state.sound&&!MN.paused&&!MN.result&&R&&R.go&&MN.phase!=='result';
  S_.mus.gain.setTargetAtTime(play?.5*state.volAmb/70:0,C.currentTime,.15);if(!play){MN.mus=null;return}
  const M=MN.mus||(MN.mus={next:C.currentTime+.05,i:0}),zi=mineZone(MN.mine,MN.cart.s),step=60/(124+zi*7+(MN.cart.boost>0?6:0))/2;if(M.next<C.currentTime-.3)M.next=C.currentTime+.05;
  while(M.next<C.currentTime+.18){const i=M.i%32,bar=i>>3,k=i&7,t=M.next;
    if(!(k&1)){mNote(t,mHz(M_BASS[bar][k>>1]),step*1.7,'sawtooth',.11);const o=C.createOscillator(),g=C.createGain();o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(45,t+.09);g.gain.setValueAtTime(.3,t);g.gain.exponentialRampToValueAtTime(.001,t+.12);o.connect(g);g.connect(S_.mus);o.start(t);o.stop(t+.14)}
    else{const n=C.createBufferSource();n.buffer=S_.nb;const f=C.createBiquadFilter();f.type='highpass';f.frequency.value=6000;const g=C.createGain();g.gain.setValueAtTime(.06,t);g.gain.exponentialRampToValueAtTime(.001,t+.04);n.connect(f);f.connect(g);g.connect(S_.mus);n.start(t);n.stop(t+.06)}
    if(zi>0||(M.i>>5)%2||k%2===0)mNote(t,mHz(M_LEAD[bar][k]+(zi>=3?12:0)),step*.9,zi>=3?'square':'triangle',zi>=3?.045:.07);
    M.i++;M.next+=step}}
function mSndUpdate(dt){const S_=mSnd();if(!S_)return;const t=AC.currentTime,on=MN.on&&state.sound&&!MN.paused,c=MN.cart,vc=state.volCar/70;
  S_.master.gain.setTargetAtTime(on?1:0,t,.12);mMusic();if(!on||!c)return;const roll=c.stun<=0&&c.y<=0&&MN.phase!=='result'?c.v:0,k=Math.min(1,roll/17);
  S_.rg.gain.setTargetAtTime(k*.4*vc,t,.08);S_.rf.frequency.setTargetAtTime(110+k*190,t,.1);S_.hg.gain.setTargetAtTime(k*k*.04*vc,t,.1);
  // the rail joints: two clacks, one for each axle
  if(roll>0){MN.clack+=roll*dt;if(MN.clack>5.2){MN.clack=0;mNoise(.035,'bandpass',1500,.18*vc);mNoise(.035,'bandpass',1300,.16*vc,2.1/Math.max(4,roll))}}}
function mTone(fr,d,type='triangle',v=.2,glide=0,delay=0){const S_=mSnd();if(!S_||!state.sound)return;const C=AC,t=C.currentTime+delay,o=C.createOscillator(),g=C.createGain();o.type=type;o.frequency.setValueAtTime(fr,t);if(glide)o.frequency.exponentialRampToValueAtTime(Math.max(40,fr-glide),t+d);
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+.008);g.gain.exponentialRampToValueAtTime(.0008,t+d);o.connect(g);g.connect(S_.fx);o.start(t);o.stop(t+d+.05)}
function mNoise(d,type,fr,v,delay=0){const S_=mSnd();if(!S_||!state.sound)return;const C=AC,t=C.currentTime+delay,n=C.createBufferSource();n.buffer=S_.nb;const f=C.createBiquadFilter();f.type=type;f.frequency.value=fr;const g=C.createGain();
  g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0008,t+d);n.connect(f);f.connect(g);g.connect(S_.fx);n.start(t);n.stop(t+d+.05)}
// a burst of speed: a rush of air that rises
function mWhoosh(v){const S_=mSnd();if(!S_||!state.sound)return;const C=AC,t=C.currentTime,n=C.createBufferSource();n.buffer=S_.nb;n.loop=true;const f=C.createBiquadFilter();f.type='bandpass';f.Q.value=1.2;f.frequency.setValueAtTime(400,t);f.frequency.exponentialRampToValueAtTime(3200,t+.45);
  const g=C.createGain();g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.4*v,t+.08);g.gain.exponentialRampToValueAtTime(.0008,t+.7);n.connect(f);f.connect(g);g.connect(S_.fx);n.start(t);n.stop(t+.75)}

function initMine(){
  $('mnPause').addEventListener('click',()=>mPause(true));$('mnpResume').onclick=()=>mPause(false);
  $('mnpRestart').onclick=()=>{mPause(false);mBank();mStart()};$('mnpOut').onclick=()=>{mPause(false);mFinish('quit')};
  $('mnpSound').onclick=()=>{setSound(!state.sound);$('mnpSound').textContent='Lyd: '+(state.sound?'på':'av')};
  $('mnItem').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(mLive())MN.q.use=true});
  // touch and mouse: swipe to the side to change track, up to jump, down to duck; a tap uses what you hold (or jumps, with empty hands)
  const el=$('mnSwipe'),P=new Map();
  el.addEventListener('pointerdown',e=>{e.preventDefault();P.set(e.pointerId,{x:e.clientX,y:e.clientY,t:performance.now(),used:false});try{el.setPointerCapture(e.pointerId)}catch(_){}});
  el.addEventListener('pointermove',e=>{const p=P.get(e.pointerId);if(!p||p.used||!mLive())return;const dx=e.clientX-p.x,dy=e.clientY-p.y,th=Math.max(22,Math.min(innerWidth,innerHeight)*.045);
    if(Math.abs(dx)<th&&Math.abs(dy)<th)return;const q=MN.q;if(Math.abs(dx)>Math.abs(dy)){if(dx<0)q.left=true;else q.right=true}else if(dy<0)q.jump=true;else q.duck=true;p.used=true});   // one swipe is one move, however long it is
  const up=e=>{const p=P.get(e.pointerId);P.delete(e.pointerId);if(p&&!p.used&&e.type==='pointerup'&&performance.now()-p.t<350&&mLive()){const c=MN.cart;if(c&&c.item&&c.itemT<=0)MN.q.use=true;else MN.q.jump=true}};
  el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
  addEventListener('resize',()=>{if(MN.on)mLayout()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&MN.on)mPause(true)})}
initMine();
