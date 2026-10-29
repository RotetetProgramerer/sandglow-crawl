'use strict';
/* =================================================================
   GROTTE: Diamantgrotten, the secret cave on Kameløya. Drive into the dark opening in the rock face and the picture
   changes: the cave is seen from the side, as in Hill Climb Racing. Gas (→, ↑, D or W) drives on and tips the nose up
   in the air, brake (←, ↓, A or S) slows down, reverses and tips the nose down. Every diamond is worth 10 nuts.
   Fuel cans fill the tank, the lanterns are checkpoints, and at the far end the treasure chamber waits. Drive back out
   through the entrance, run out of fuel or reach the treasure and you are back on the island.
   The cave itself (floor, ceiling, diamonds, decor) is built from data/grotte.js by makeCave (js/grottesim.js), which
   also has the physics. This file draws it in its own scene: the rock is ribbons along the floor and ceiling lines,
   lit by light baked into the vertex colours (lanterns, crystals, daylight at the entrance) and a lamp on the car.
   Loaded after plane.js; uses the globals of game.js and world.js (state, renderer, car, prof, best, AC, M …) at run time.
   ================================================================= */
const CV={on:false,fade:null,built:false,cave:null,scene:null,cam:null,car:null,run:null,vis:null,acc:0,paused:false,result:false,phase:'',
  zone:-1,hudT:0,lowT:0,snd:null,look:new THREE.Vector3(),camX:0,camY:0,camD:12,shake:0,combo:0,comboT:0,nuts:0,flips:0,bonus:0,carKey:'',lightsWas:false,doneT:0};
const caveKey=()=>'orken/grotte';
const CAVE_W=1.25,CAVE_BACK=3.4;   // the front edge of the rock (towards the camera) and the back wall, in z
const CTHEME={
  outside:{rock:'#b48c58',amb:[1.25,1.15,1]},
  sand:{rock:'#8a6a46',amb:[.62,.54,.45]},
  mine:{rock:'#6e5a45',amb:[.46,.39,.32]},
  crystal:{rock:'#564d6c',amb:[.38,.37,.54]},
  narrow:{rock:'#5e5650',amb:[.34,.32,.3]},
  lake:{rock:'#4a5a62',amb:[.34,.42,.5]},
  deep:{rock:'#4a423c',amb:[.28,.26,.26]},
  treasure:{rock:'#7a5c3a',amb:[.5,.42,.28]}};
const CSURF={[S.SAND]:'#caa466',[S.GRAVEL]:'#8f8676',[S.ROCK]:'#857a70',[S.WOOD]:'#8a5e36'};

/* ---------- light, baked into the vertex colours ---------- */
let cLamps=[];
function cZoneAt(cv,x){if(x<0)return'outside';let t='sand';for(const z of cv.zones){if(z.x<=x)t=z.theme;else break}return t}
// the ambient light of the part of the cave you are in, blended over a few units at every border, and daylight round the entrance
function cAmb(cv,x){const A=k=>CTHEME[k].amb;let a=A(cZoneAt(cv,x));for(const z of cv.zones){const d=x-z.x;if(d>-3&&d<3){const u=smt01((d+3)/6),b=A(cZoneAt(cv,z.x-3.01)),c=A(z.theme);a=[b[0]+(c[0]-b[0])*u,b[1]+(c[1]-b[1])*u,b[2]+(c[2]-b[2])*u]}}
  const day=x<0?1:smt01((10-x)/12)*.8,o=A('outside');return[a[0]+(o[0]-a[0])*day,a[1]+(o[1]-a[1])*day,a[2]+(o[2]-a[2])*day]}
function cLight(cv,x,y){const a=cAmb(cv,x),L=[a[0],a[1],a[2]];for(const l of cLamps){const dx=x-l.x;if(dx>l.r||dx<-l.r)continue;const d=Math.hypot(dx,y-l.y);if(d>=l.r)continue;const k=(1-d/l.r)**2*l.i;L[0]+=l.c[0]*k;L[1]+=l.c[1]*k;L[2]+=l.c[2]*k}return L}
const cMul=(c,L,f=1)=>[c[0]*L[0]*f,c[1]*L[1]*f,c[2]*L[2]*f];

/* ---------- textures ---------- */
function cRockTex(){const s=256,c=document.createElement('canvas');c.width=c.height=s;const x=c.getContext('2d'),R=mulberry32(91),img=x.createImageData(s,s),d=img.data,n=makeNoise(17);
  for(let j=0;j<s;j++)for(let i=0;i<s;i++){const u=i/s,v=j/s,w=(a,b,f)=>{let h=0;for(const[px,py]of[[0,0],[1,0],[0,1],[1,1]])h+=n((u-px)*f+a,(v-py)*f+b)*(px?u:1-u)*(py?v:1-v);return h};
    const g=.62+.5*(w(0,0,6)-.5)+.25*(w(9,4,18)-.5)+.12*Math.sin(v*40+w(3,3,5)*9)+(R()-.5)*.08,k=(j*s+i)*4,val=Math.max(0,Math.min(255,g*255));d[k]=d[k+1]=d[k+2]=val;d[k+3]=255}
  x.putImageData(img,0,0);for(let i=0;i<260;i++){const px=R()*s,py=R()*s,r=1+R()*3;x.fillStyle=`rgba(${R()<.5?20:255},${R()<.5?20:255},${R()<.5?20:255},${.08+R()*.12})`;x.beginPath();x.arc(px,py,r,0,6.283);x.fill()}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t}
function cLabelTex(text,sub,w=512,h=192,bg='#e5a92b'){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
  x.fillStyle='#5a3a22';x.fillRect(0,0,w,h);x.fillStyle=bg;x.fillRect(10,10,w-20,h-20);x.strokeStyle='#14120E';x.lineWidth=6;x.strokeRect(18,18,w-36,h-36);
  x.fillStyle='#14120E';x.textAlign='center';x.textBaseline='middle';let fs=Math.round(h*.34);x.font=fs+'px "Saira Stencil One", Impact, sans-serif';while(fs>12&&x.measureText(text).width>w-60){fs-=2;x.font=fs+'px "Saira Stencil One", Impact, sans-serif'}x.fillText(text,w/2,sub?h*.42:h/2);
  if(sub){x.font='600 32px "Barlow Condensed", sans-serif';x.fillText(sub,w/2,h*.76)}const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t}

/* ---------- geometry helpers ---------- */
// a grid of rows×cols vertices from pos(i,j) and col(i,j); quads between neighbours, skip(i) leaves out the quads from column i to i+1
function cGrid(cols,rows,pos,col,skip,flip){const P=new Float32Array(cols*rows*3),C=new Float32Array(cols*rows*3),U=new Float32Array(cols*rows*2),idx=[];
  for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){const k=i*rows+j,p=pos(i,j),c=col(i,j,p);P.set([p.x,p.y,p.z],k*3);C.set(c,k*3);U.set([(p.x+p.z*.7)*.22,(p.y+p.z*.5)*.22],k*2)}
  for(let i=0;i<cols-1;i++){if(skip&&skip(i))continue;for(let j=0;j<rows-1;j++){const a=i*rows+j,b=a+1,c=a+rows,d=c+1;if(flip)idx.push(a,c,b,c,d,b);else idx.push(a,b,c,c,b,d)}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('color',new THREE.BufferAttribute(C,3));g.setAttribute('uv',new THREE.BufferAttribute(U,2));g.setIndex(idx);g.computeVertexNormals();return g}
function cMesh(g,mat,grp,shadow){const m=new THREE.Mesh(g,mat);m.receiveShadow=!!shadow;grp.add(m);return m}
function cStd(hex,o={}){return new THREE.MeshStandardMaterial(Object.assign({color:LIN(hex),roughness:.75,metalness:.05},o))}
function cBox(grp,w,h,d,mat,x,y,z,rz=0){const m=new THREE.Mesh(boxGeo,mat);m.scale.set(w,h,d);m.position.set(x,y,z);m.rotation.z=rz;m.castShadow=true;grp.add(m);return m}

/* ---------- building the cave scene (once) ---------- */
function cBuild(){const cv=CV.cave=makeCave(GROTTE),sc=CV.scene=new THREE.Scene(),grp=new THREE.Group();sc.add(grp);
  sc.background=new THREE.Color(0x0b0907);sc.fog=new THREE.Fog(0x0b0907,16,46);
  CV.amb=new THREE.AmbientLight(0xffffff,.9);CV.sun=new THREE.DirectionalLight(0xfff0dc,.55);CV.sun.castShadow=true;CV.sun.shadow.mapSize.set(1024,1024);
  Object.assign(CV.sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.5,far:30});CV.sun.shadow.bias=-.0005;sc.add(CV.amb,CV.sun,CV.sun.target);
  CV.lamp=new THREE.PointLight(0xffe2b0,2.2,10,1.4);sc.add(CV.lamp);
  CV.cam=new THREE.PerspectiveCamera(36,1,.1,220);
  // the lights: a lantern at every checkpoint and lamp, the crystals, the gold in the treasure chamber
  cLamps=[];const warm=col('#ffb860').map(v=>v*1.6);
  for(const p of cv.cps)cLamps.push({x:p.x,y:caveTop(cv,p.x)+1.4,r:6.5,i:1,c:warm});
  for(const d of cv.deco){const y=caveTop(cv,d.x);if(d.kind==='lamp')cLamps.push({x:d.x,y:y+1.4,r:6,i:1,c:warm});if(d.kind==='pile'||d.kind==='chest')cLamps.push({x:d.x,y:y+.8,r:7,i:.9,c:col('#ffd76a')})}
  const crystals=[],R=mulberry32(5);
  for(const z of cv.zones)if(z.theme==='crystal'){const nx=cv.zones.find(q=>q.x>z.x),x1=nx?nx.x:cv.end;for(let x=z.x+2;x<x1-2;x+=1.2+R()*2.2){const hue=R()<.55?'#7fe0ff':R()<.6?'#c08aff':'#ff8ad8';crystals.push({x,hue,R:R(),back:R()<.7});if(R()<.45)cLamps.push({x,y:caveTop(cv,x)+(R()<.5?.5:3),r:4.2,i:.55,c:col(hue)})}}
  for(const z of cv.zones)if(z.theme==='lake')cLamps.push({x:z.x+20,y:caveTop(cv,z.x+20)+3,r:12,i:.25,c:col('#6fc8e8')});
  const rockTex=cRockTex(),rockMat=new THREE.MeshLambertMaterial({map:rockTex,vertexColors:true,side:THREE.DoubleSide});rockTex.encoding=THREE.sRGBEncoding;CV.rockMat=rockMat;
  // the floor as you see it: the floor line, with the deck of every bridge swapped for the bottom of its chasm
  const Fv=cv.F.map(p=>{if(!p.wood)return p;const b=cv.bridges.find(q=>p.x>=q.x0-.01&&p.x<=q.x1+.01);return{x:p.x,y:b.y-b.depth+.25*Math.sin(p.x*2.3)+.15*Math.sin(p.x*5.1),s:S.ROCK,deep:true}});
  let lo=1e9,hi=-1e9;for(const p of cv.F)lo=Math.min(lo,p.y);for(const p of cv.C)hi=Math.max(hi,p.y);const BOT=lo-14,TOP=hi+16;
  const rockC=x=>col(CTHEME[cZoneAt(cv,x)].rock),surfC=p=>col(p.deep?CTHEME[cZoneAt(cv,p.x)].rock:CSURF[p.s]||CSURF[S.ROCK]);
  // the front of the floor: the surface, a crust of the same colour, then the rock down to the bottom
  {const rows=[0,.1,.42,1.4,3.2,BOT];grp.add(new THREE.Mesh(cGrid(Fv.length,rows.length,(i,j)=>{const p=Fv[i];return{x:p.x,y:j<5?p.y-rows[j]:BOT,z:CAVE_W}},
    (i,j,q)=>{const p=Fv[i],L=cLight(cv,q.x,q.y+.4),c=j<2?surfC(p):j===2?mix2(surfC(p),rockC(p.x),.6):rockC(p.x);return cMul(c,L,[1.1,.8,.62,.55,.42,.22][j])}),rockMat))}
  // the top of the floor, from the front edge back to the wall: a little rougher and darker towards the back
  {const zs=[CAVE_W,CAVE_W-.5,.3,-1.2,-2.4,-CAVE_BACK],dy=[0,.01,0,.06,.16,.34];grp.add(cMesh(cGrid(Fv.length,zs.length,(i,j)=>{const p=Fv[i];return{x:p.x,y:p.y+dy[j]*(1+.6*Math.sin(p.x*1.3+j)),z:zs[j]}},
    (i,j,q)=>cMul(surfC(Fv[i]),cLight(cv,q.x,q.y+.6),1-.07*j),null,true),rockMat,grp,true))}
  // the ceiling: the front face up to the top, and its underside back to the wall
  {const C=cv.C,rows=[0,.25,1.4,4,TOP];grp.add(new THREE.Mesh(cGrid(C.length,rows.length,(i,j)=>{const p=C[i];return{x:p.x,y:j<4?p.y+rows[j]:TOP,z:CAVE_W}},
    (i,j,q)=>cMul(rockC(q.x),cLight(cv,q.x,q.y-.4),[.95,.8,.6,.42,.22][j])),rockMat));
   const zs=[CAVE_W,0,-1.6,-CAVE_BACK],dy=[0,-.05,-.12,-.3];grp.add(new THREE.Mesh(cGrid(C.length,zs.length,(i,j)=>{const p=C[i];return{x:p.x,y:p.y+dy[j]*(1+.5*Math.sin(p.x*1.7+j)),z:zs[j]}},
    (i,j,q)=>cMul(rockC(q.x),cLight(cv,q.x,q.y-.5),.8-.08*j)),rockMat))}
  // the back wall, from the floor (or the bottom of a chasm) up to the ceiling
  {const xs=[];for(let x=-.2;x<=cv.end+1;x+=.5)xs.push(x);const rows=8;grp.add(new THREE.Mesh(cGrid(xs.length,rows,(i,j)=>{const x=xs[i],lo2=Math.min(caveFloor(cv,x),cLineY(Fv,x,caveFloor(cv,x)))-.8,hi2=caveCeil(cv,x)+.6,u=j/(rows-1);
      return{x,y:lo2+(hi2-lo2)*u,z:-CAVE_BACK-.15*Math.sin(x*.9+u*7)-.25*u*(1-u)*4}},(i,j,q)=>cMul(rockC(q.x),cLight(cv,q.x,q.y),.62+.12*Math.sin(q.x*.7+q.y))),rockMat))}
  // the cliff over the entrance, the sand outside and the sky behind
  {const sky=new THREE.Mesh(new THREE.PlaneGeometry(80,60),new THREE.MeshBasicMaterial({map:(()=>{const c=document.createElement('canvas');c.width=64;c.height=256;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,256);
      g.addColorStop(0,'#6aa6d8');g.addColorStop(.55,'#f2dcae');g.addColorStop(.62,'#e2b878');g.addColorStop(1,'#c99a58');x.fillStyle=g;x.fillRect(0,0,64,256);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t})(),fog:false}));
    sky.position.set(-24,4,-30);sc.add(sky);
    const dunes=new THREE.Group();for(let i=0;i<7;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2),new THREE.MeshBasicMaterial({color:LIN(['#d9ad6a','#c9995a','#e2b878'][i%3]),fog:false}));m.scale.set(6+i*1.3,1.6+(i%3)*.7,3);m.position.set(-40+i*5.5,-3.2,-26+i%2*3);dunes.add(m)}sc.add(dunes)}
  // bridges: planks across the chasm, ropes along the sides, posts at the ends; water under the bridge in the lake
  for(const b of cv.bridges){const n=Math.round((b.x1-b.x0)/.28),pk=new THREE.InstancedMesh(boxGeo,cStd('#8a5e36',{roughness:.9}),n),m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),p=new THREE.Vector3(),s=new THREE.Vector3(),cc=new THREE.Color();
    for(let k=0;k<n;k++){const x=b.x0+(k+.5)*(b.x1-b.x0)/n,u=(x-b.x0)/(b.x1-b.x0),y=b.y-b.sag*4*u*(1-u)-.05,sl=-b.sag*4*(1-2*u)/(b.x1-b.x0);p.set(x,y,-.2);e.set(0,0,Math.atan(sl)+(k%3-1)*.03);q.setFromEuler(e);s.set(.24,.08,CAVE_W*2+1.2);m4.compose(p,q,s);pk.setMatrixAt(k,m4);cc.set(['#7b4e2c','#8c5c33','#6b4325','#9a6a3e'][k%4]).convertSRGBToLinear();pk.setColorAt(k,cc)}
    pk.castShadow=pk.receiveShadow=true;grp.add(pk);const rope=cStd('#d8c597');
    for(const z of[CAVE_W+.15,-CAVE_W-.6]){const pts=[];for(let k=0;k<=24;k++){const u=k/24,x=b.x0+(b.x1-b.x0)*u;pts.push(new THREE.Vector3(x,b.y+.75-b.sag*4*u*(1-u)*1.2,z))}const tube=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),40,.035,5),rope);grp.add(tube);
      for(const x of[b.x0,b.x1]){cBox(grp,.12,1.3,.12,cStd('#5a3a22'),x,b.y+.3,z)}for(let k=1;k<12;k++){const u=k/12,x=b.x0+(b.x1-b.x0)*u,y=b.y-b.sag*4*u*(1-u);cBox(grp,.02,.75,.02,rope,x,y+.36,z)}}
    if(cZoneAt(cv,b.x0)==='lake'){const w=new THREE.Mesh(new THREE.PlaneGeometry(b.x1-b.x0+.4,CAVE_W+CAVE_BACK),cStd('#2f6f86',{transparent:true,opacity:.7,roughness:.1,metalness:.3,emissive:LIN('#0a2a36')}));w.rotation.x=-Math.PI/2;w.position.set((b.x0+b.x1)/2,b.y-b.depth+1.3,(CAVE_W-CAVE_BACK)/2);grp.add(w)}}
  // pools of still water: the surface and its front, see-through
  CV.pools=[];for(const p of cv.pools){let bot=0;for(let x=p.x0;x<=p.x1;x+=.25)bot=Math.min(bot,caveFloor(cv,x)-p.y);const mat=cStd('#2f7a8e',{transparent:true,opacity:.62,roughness:.08,metalness:.2,emissive:LIN('#08303a'),depthWrite:false});
    const top=new THREE.Mesh(new THREE.PlaneGeometry(p.x1-p.x0,CAVE_W+CAVE_BACK),mat);top.rotation.x=-Math.PI/2;top.position.set((p.x0+p.x1)/2,p.y,(CAVE_W-CAVE_BACK)/2);top.renderOrder=3;grp.add(top);
    const fr=new THREE.Mesh(new THREE.PlaneGeometry(p.x1-p.x0,-bot+.05),mat);fr.position.set((p.x0+p.x1)/2,p.y+bot/2,CAVE_W+.01);fr.renderOrder=3;grp.add(fr);CV.pools.push({p,top})}
  cDecor(cv,grp,crystals);cItems(cv,grp);
  CV.grp=grp;CV.parts=[];const dustTex2=dustTex;for(let i=0;i<60;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:dustTex2,transparent:true,depthWrite:false,opacity:0}));s.visible=false;sc.add(s);CV.parts.push({s,life:0,v:new THREE.Vector3(),g:0})}
  // dust in the air, drifting slowly through the light
  {const n=420,pos=new Float32Array(n*3),R2=mulberry32(33);for(let i=0;i<n;i++){const x=R2()*(cv.end+16)-16,y0=caveTop(cv,x),y1=x<0?y0+6:caveCeil(cv,x);pos.set([x,y0+.4+R2()*(y1-y0-.6),-CAVE_BACK+R2()*(CAVE_W+CAVE_BACK)],i*3)}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));CV.motes=new THREE.Points(g,new THREE.PointsMaterial({map:glowTex,color:LIN('#ffe2b0'),size:.09,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending}));CV.motes.frustumCulled=false;sc.add(CV.motes)}
  CV.built=true}
function mix2(a,b,t){return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]}

/* ---------- decor: stalactites, crystals, the mine, signs, the treasure ---------- */
function cDecor(cv,grp,crystals){const R=mulberry32(12),m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),p=new THREE.Vector3(),s=new THREE.Vector3(),cc=new THREE.Color();
  const inst=(geo,mat,L,shadow)=>{if(!L.length)return;const im=new THREE.InstancedMesh(geo,mat,L.length);L.forEach((o,i)=>{p.set(o.x,o.y,o.z);e.set(o.rx||0,o.ry||0,o.rz||0);q.setFromEuler(e);s.set(o.sx,o.sy,o.sz);m4.compose(p,q,s);im.setMatrixAt(i,m4);cc.setRGB(o.c[0],o.c[1],o.c[2]);im.setColorAt(i,cc)});im.castShadow=!!shadow;im.receiveShadow=true;grp.add(im);return im};
  const cone=new THREE.ConeGeometry(1,1,6);cone.translate(0,-.5,0);cone.rotateX(Math.PI);   // tip down, base at y=0
  const coneUp=new THREE.ConeGeometry(1,1,6);coneUp.translate(0,.5,0);
  const stal=[],stag=[],rocks=[];
  // stalactites from the ceiling and stalagmites on the floor, more of them where the room is high
  for(let x=1;x<cv.end;x+=.35+R()*.9){const cy=caveCeil(cv,x),fy=caveTop(cv,x),room=cy-fy,th=cZoneAt(cv,x),rc=col(CTHEME[th].rock);if(room<2.6)continue;
    const z=-CAVE_BACK+.3+R()*(CAVE_W+CAVE_BACK-.2),len=Math.min(room*.32,.25+R()*R()*2.2)*(z>0?.6:1),w=.07+len*.18;stal.push({x,y:cy+.15,z,sx:w,sy:len+.15,sz:w,c:cMul(rc,cLight(cv,x,cy-len),.9)});
    if(R()<.4&&z<-.9){const h=.2+R()*R()*1.4;stag.push({x:x+R()*.5,y:fy-.05,z:-CAVE_BACK+.4+R()*1.6,sx:.1+h*.22,sy:h,sz:.1+h*.22,c:cMul(rc,cLight(cv,x,fy+h),.95)})}
    if(R()<.3)rocks.push({x:x+R(),y:fy+.02,z:-CAVE_BACK+.5+R()*2,sx:.15+R()*.3,sy:.1+R()*.2,sz:.15+R()*.3,rx:R()*3,ry:R()*3,c:cMul(rc,cLight(cv,x,fy+.3),1.1)})}
  const lam=new THREE.MeshLambertMaterial({color:0xffffff,map:CV.rockMat.map});inst(cone,lam,stal);inst(coneUp,lam,stag);inst(DG.peb,lam,rocks);
  // crystals: clusters of glowing prisms on the floor at the back, on the walls and hanging from the ceiling
  {const prism=new THREE.CylinderGeometry(1,1,1,6);prism.translate(0,.5,0);const tip=new THREE.ConeGeometry(1,.6,6);tip.translate(0,1.3,0);const L=[],T=[],glows=[];
    for(const k of crystals){const fy=caveTop(cv,k.x),cy=caveCeil(cv,k.x),hang=!k.back&&k.R<.35,base=hang?cy:fy,n=3+Math.floor(k.R*4),c=col(k.hue),z0=k.back?-CAVE_BACK+.5+k.R*1.4:-1.2+k.R*.8;
      for(let i=0;i<n;i++){const a=(i/n-.5)*1.4+(k.R-.5),h=(.35+((i*7+k.R*10)%5)/5*.9)*(k.back?1.3:.8),w=h*.16;const o={x:k.x+Math.sin(a)*.15,y:base,z:z0+(i%3-1)*.18,sx:w,sy:h,sz:w,rz:hang?Math.PI-a*.6:a*.6,c};L.push(o);T.push(Object.assign({},o,{c:c.map(v=>Math.min(1,v*1.4+.2))}))}
      glows.push({x:k.x,y:base+(hang?-.5:.5),z:z0,c:k.hue})}
    const mat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.88});inst(prism,mat,L);inst(tip,mat,T);
    CV.glows=glows.map(g=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:LIN(g.c),transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false}));sp.scale.set(2.2,2.2,1);sp.position.set(g.x,g.y,g.z+.2);grp.add(sp);return{sp,ph:R()*6.28}})}
  // the old mine: posts and beams holding up the ceiling, a rail line along the floor at the back
  const wood=cStd('#6e4a2c',{roughness:.95}),dark=cStd('#2a2826',{roughness:.6,metalness:.5});
  for(const z of cv.zones){if(z.theme!=='mine')continue;const nx=cv.zones.find(q=>q.x>z.x),x1=nx?nx.x:cv.end;
    for(let x=z.x+2.5;x<x1-1;x+=5.2){if(cv.pits.some(p=>x>p.x0-1.5&&x<p.x1+1.5)||cv.bridges.some(b=>x>b.x0-.5&&x<b.x1+.5))continue;const fy=caveTop(cv,x),cy=caveCeil(cv,x);
      for(const zz of[-CAVE_BACK+.45,-.95]){const ly=Math.max(fy,caveFloor(cv,x));cBox(grp,.16,cy-ly+.3,.16,wood,x,(ly+cy)/2,zz)}cBox(grp,.2,.18,CAVE_BACK-.2,wood,x,cy-.12,(-CAVE_BACK+.45-.95)/2)}
    const rail=[];for(let x=z.x;x<x1;x+=.25){if(cv.pits.some(p=>x>p.x0-.1&&x<p.x1+.1)||cv.bridges.some(b=>x>b.x0&&x<b.x1))continue;const y=caveTop(cv,x)+.05;rail.push({x,y,z:-2.05,sx:.26,sy:.035,sz:.04,c:[.25,.24,.23]},{x,y,z:-1.6,sx:.26,sy:.035,sz:.04,c:[.25,.24,.23]});
      if(Math.round(x*4)%3===0)rail.push({x,y:y-.03,z:-1.82,sx:.08,sy:.03,sz:.7,c:cMul(col('#5a3e26'),cLight(cv,x,y+.4))})}
    inst(boxGeo,new THREE.MeshLambertMaterial({color:0xffffff}),rail)}
  // things placed one by one in data/grotte.js
  for(const d of cv.deco){const y=caveTop(cv,d.x),s=d.s||1;
    if(d.kind==='sign'){for(const zz of[-.9]){cBox(grp,.1,1.6,.1,wood,d.x-.7,y+.8,zz);cBox(grp,.1,1.6,.1,wood,d.x+.7,y+.8,zz)}const b=new THREE.Mesh(new THREE.PlaneGeometry(2,.75),new THREE.MeshBasicMaterial({map:cLabelTex(d.text,d.sub),side:THREE.DoubleSide}));b.position.set(d.x,y+1.45,-.85);grp.add(b)}
    else if(d.kind==='cart'){const g=new THREE.Group();g.position.set(d.x,y,-1.82);g.rotation.z=Math.atan2(caveTop(cv,d.x+.6)-caveTop(cv,d.x-.6),1.2);
      cBox(g,1.1,.55,.7,cStd('#6a5a4a',{metalness:.5,roughness:.5}),0,.5,0);cBox(g,1.16,.06,.76,dark,0,.78,0);for(const a of[-.35,.35])for(const zz of[-.3,.3]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.06,12),dark);w.rotation.x=Math.PI/2;w.position.set(a,.16,zz);g.add(w)}
      for(let i=0;i<5;i++){const m=new THREE.Mesh(new THREE.OctahedronGeometry(.09),new THREE.MeshBasicMaterial({color:LIN('#9fe8ff')}));m.position.set(-.3+i*.15,.84,(i%2-.5)*.25);g.add(m)}grp.add(g)}
    else if(d.kind==='pick'){const g=new THREE.Group();g.position.set(d.x,y+.05,-.9);g.rotation.z=.9;cBox(g,.05,.9,.05,wood,0,.45,0);const hd=cBox(g,.5,.07,.06,dark,0,.9,0);hd.rotation.z=.25;grp.add(g)}
    else if(d.kind==='barrel'){const b=new THREE.Mesh(new THREE.CylinderGeometry(.28,.25,.62,12),cStd('#7a5232'));b.position.set(d.x,y+.31,-1.4);b.castShadow=true;grp.add(b);for(const yy of[.12,.5]){const r=new THREE.Mesh(new THREE.TorusGeometry(.275,.02,4,14),dark);r.rotation.x=Math.PI/2;r.position.set(d.x,y+yy,-1.4);grp.add(r)}}
    else if(d.kind==='bones'){const bone=cStd('#e8dcc4');const sk=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),bone);sk.position.set(d.x,y+.13,-1.1);sk.scale.set(1,.85,1.1);grp.add(sk);
      for(const sd of[-1,1]){const ey=new THREE.Mesh(new THREE.SphereGeometry(.045,6,5),cStd('#1a1410'));ey.position.set(d.x+.13,y+.16,-1.1+sd*.06);grp.add(ey)}for(let i=0;i<3;i++)cBox(grp,.5,.05,.05,bone,d.x-.5+i*.25,y+.03,-1.5+i*.15,(i-1)*.6)}
    else if(d.kind==='lamp')cLantern(grp,d.x,y,true);
    else if(d.kind==='chest'){const g=new THREE.Group();g.position.set(d.x,y,-1.3);cBox(g,1.2,.6,.75,cStd('#7a4a26'),0,.3,0);const lid=new THREE.Group();lid.position.set(0,.6,-.37);cBox(lid,1.24,.12,.79,cStd('#8a5a2e'),0,.06,.37);
      for(const a of[-.45,.45]){cBox(g,.08,.62,.79,cStd('#c9a03a',{metalness:.7,roughness:.3}),a,.31,0)}g.add(lid);const gold=new THREE.Mesh(new THREE.SphereGeometry(.5,12,6,0,Math.PI*2,0,Math.PI/2),new THREE.MeshBasicMaterial({color:LIN('#ffd65a')}));gold.scale.set(1,.45,.6);gold.position.y=.58;g.add(gold);
      grp.add(g);CV.chest={lid,g}}
    else if(d.kind==='pile'){const g=new THREE.Group();g.position.set(d.x,y,-2.1);const oct=new THREE.OctahedronGeometry(.12);
      const hill=new THREE.Mesh(new THREE.SphereGeometry(.9*s,14,7,0,Math.PI*2,0,Math.PI/2),cStd('#c9a03a',{metalness:.7,roughness:.35,emissive:LIN('#4a3008')}));hill.scale.y=.5;g.add(hill);
      {const im=new THREE.InstancedMesh(oct,new THREE.MeshBasicMaterial({color:0xffffff}),40),m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),p=new THREE.Vector3(),one=new THREE.Vector3(1,1,1),cc=new THREE.Color();
        for(let i=0;i<40;i++){const a=i*2.4,r=Math.sqrt(i/40)*.8*s;p.set(Math.cos(a)*r,.45*s*Math.sqrt(Math.max(0,1-(r/(.9*s))**2))+.05,Math.sin(a)*r*.6);e.set(i,i*.7,0);q.setFromEuler(e);m4.compose(p,q,one);im.setMatrixAt(i,m4);im.setColorAt(i,cc.set(LIN(['#9fe8ff','#ffd65a','#ff7aa8'][i%3])))}g.add(im)}
      const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:LIN('#ffd65a'),transparent:true,opacity:.6,blending:THREE.AdditiveBlending,depthWrite:false}));gl.scale.set(4*s,3*s,1);gl.position.y=.5;g.add(gl);grp.add(g)}}}
// a lantern on a post: the checkpoints (dim until you reach them) and the lamps
function cLantern(grp,x,y,lit){const g=new THREE.Group();g.position.set(x,y,-.85);const wood=cStd('#5a3a22');cBox(g,.1,1.5,.1,wood,0,.75,0);cBox(g,.45,.06,.06,wood,.2,1.47,0);
  const glass=new THREE.MeshBasicMaterial({color:LIN(lit?'#ffd27a':'#6a5a40')}),lt=new THREE.Mesh(new THREE.BoxGeometry(.16,.22,.16),glass);lt.position.set(.38,1.25,0);g.add(lt);cBox(g,.2,.04,.2,cStd('#2a2826'),.38,1.38,0);
  const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:LIN('#ffc060'),transparent:true,opacity:lit?.8:.15,blending:THREE.AdditiveBlending,depthWrite:false}));gl.scale.set(2,2,1);gl.position.set(.38,1.25,0);g.add(gl);grp.add(g);return{g,glass,gl}}
// diamonds, fuel cans and the checkpoint lanterns: kept, so they can be taken and put back for every trip
function cItems(cv,grp){const oct=new THREE.OctahedronGeometry(.2,0),gm=new THREE.MeshStandardMaterial({color:LIN('#d8f8ff'),emissive:LIN('#3ac8f0'),emissiveIntensity:.7,metalness:.4,roughness:.05,flatShading:true});
  const n=cv.gems.length,im=new THREE.InstancedMesh(oct,gm,n);im.castShadow=true;im.frustumCulled=false;grp.add(im);
  const pos=new Float32Array(n*3),colr=new Float32Array(n*3);cv.gems.forEach((g,i)=>pos.set([g.x,g.y,.06],i*3));const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pos,3));pg.setAttribute('color',new THREE.BufferAttribute(colr,3));
  const glow=new THREE.Points(pg,new THREE.PointsMaterial({map:glowTex,size:1,vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true}));glow.frustumCulled=false;grp.add(glow);
  CV.gemIM={im,glow,on:cv.gems.map(()=>true),ph:cv.gems.map((g,i)=>i*1.7)};
  const red=cStd('#c8302a',{roughness:.4,metalness:.2}),blk=cStd('#2a2826');
  CV.canVis=cv.cans.map(c=>{const g=new THREE.Group();g.position.set(c.x,c.y,0);cBox(g,.34,.44,.14,red,0,0,0);cBox(g,.22,.06,.06,blk,0,.26,0);cBox(g,.06,.1,.06,cStd('#d8c070'),.12,.27,0);
    const lab=new THREE.Mesh(new THREE.PlaneGeometry(.26,.12),new THREE.MeshBasicMaterial({map:cLabelTex('BENSIN','',256,96,'#f2e8d0')}));lab.position.set(0,0,.075);g.add(lab);
    const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:LIN('#ff9a5a'),transparent:true,opacity:.4,blending:THREE.AdditiveBlending,depthWrite:false}));gl.scale.set(1.3,1.3,1);g.add(gl);grp.add(g);return{g}});
  CV.cpVis=cv.cps.map(p=>cLantern(grp,p.x,caveTop(cv,p.x),false))}

/* ---------- the car in the cave: the same model and paint as on the island ---------- */
function cCarVis(){const cfg=Object.assign({},CARS[state.carIdx],{tune:car.tune}),key=cfg.id+'/'+JSON.stringify(prof.parts);if(CV.vis&&CV.carKey===key)return CV.vis;
  if(CV.vis){CV.scene.remove(CV.vis.root);CV.vis.root.traverse(o=>{if(o.geometry&&o.geometry!==boxGeo)o.geometry.dispose()})}
  const root=new THREE.Group(),body=buildBody(cfg);root.add(body);const wheels=[];for(let i=0;i<4;i++){const w=carWheel(cfg,i%2===0?1:-1,i>1);root.add(w.root);wheels.push(w)}
  CV.scene.add(root);CV.carKey=key;return CV.vis={root,body,wheels}}
const _gq=new THREE.Quaternion(),_gqy=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2),_gz=new THREE.Vector3(0,0,1);
function cPose(){const c=CV.car,v=CV.vis;_gq.setFromAxisAngle(_gz,c.a).multiply(_gqy);v.body.position.set(c.x,c.y,0);v.body.quaternion.copy(_gq);
  const tr=(c.cfg.track||TRACK)/2;v.wheels.forEach((w,i)=>{const wh=c.wheels[i<2?1:0];w.root.position.set(wh.cx,wh.cy,i%2===0?-tr:tr);w.root.quaternion.copy(_gq);w.spin.rotation.x=wh.spin})}

/* ---------- the opening on the island: a dark hole in the rock at the end of the slot, framed by old mine timbers ---------- */
let caveMouth=null;
function cDarkTex(){const c=document.createElement('canvas');c.width=128;c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(64,64,4,64,64,64);
  g.addColorStop(0,'rgba(4,3,2,1)');g.addColorStop(.72,'rgba(8,6,4,.97)');g.addColorStop(1,'rgba(20,14,10,0)');x.fillStyle=g;x.fillRect(0,0,128,64);return new THREE.CanvasTexture(c)}
function buildCaveMouth(lv){caveMouth=null;const D=lv.caveDef;if(!D)return;const g=new THREE.Group(),tex=cDarkTex(),fx=Math.sin(D.dir),fz=Math.cos(D.dir),lx=fz,lz=-fx;
  const hole=(x,z,w,h,yaw)=>{const y=H(x,z)-.06;for(let k=0;k<3;k++){const m=new THREE.Mesh(new THREE.PlaneGeometry(w*(1-k*.12),h*(1-k*.1)),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:k===2,fog:true}));
      m.position.set(x+Math.sin(yaw+Math.PI)*-k*.12,y+h*(1-k*.1)/2,z+Math.cos(yaw+Math.PI)*-k*.12);m.rotation.y=yaw;g.add(m)}return y};
  const o=D.open,yaw=D.dir+Math.PI,y=hole(o.x,o.z,2.5,2.4,yaw),wood=new THREE.MeshStandardMaterial({color:LIN('#5a3e26'),roughness:.95});
  const B=(w,h,d,x,yy,z,ry,mat)=>{const m=new THREE.Mesh(boxGeo,mat||wood);m.scale.set(w,h,d);m.position.set(x,yy,z);m.rotation.y=ry;m.castShadow=true;g.add(m);return m};
  for(const sd of[-1,1])B(.16,1.55,.16,o.x+lx*sd*1.05-fx*.05,y+.78,o.z+lz*sd*1.05-fz*.05,D.dir);B(2.5,.18,.2,o.x-fx*.1,y+1.6,o.z-fz*.1,D.dir);   // the timber frame
  {const b=new THREE.Mesh(new THREE.PlaneGeometry(1.1,.36),new THREE.MeshBasicMaterial({map:cLabelTex('FARE','gammel gruve',512,168,'#d9a03a'),side:THREE.DoubleSide}));b.position.set(o.x-fx*.25,y+1.95,o.z-fz*.25);b.rotation.y=yaw;b.rotation.z=.06;g.add(b)}
  // a glint of diamonds somewhere in the dark
  const glints=[];for(let i=0;i<4;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:LIN(i%2?'#9fe8ff':'#ffffff'),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
    sp.position.set(o.x+fx*.2+lx*(i-1.5)*.4,y+.25+(i%3)*.25,o.z+fz*.2+lz*(i-1.5)*.4);sp.scale.set(.35,.35,1);g.add(sp);glints.push({sp,ph:i*1.9})}
  // the back door: a low opening on the east side of the mountain, where you come out after the treasure chamber
  if(D.door){const dr=D.door,dyaw=Math.atan2(D.back.x-dr.x,D.back.z-dr.z);hole(dr.x,dr.z,1.9,1.7,dyaw)}
  levelGroup.add(g);caveMouth={g,glints}}
function caveMouthAnim(){if(!caveMouth)return;const t=performance.now()*.001;for(const q of caveMouth.glints){const k=Math.max(0,Math.sin(t*1.3+q.ph));q.sp.material.opacity=k*k*k*.9;q.sp.scale.setScalar(.15+k*.3)}}

/* ---------- in and out ---------- */
function caveEnter(){if(CV.on||CV.fade)return;initAudio();if(AC&&AC.state==='suspended')AC.resume();state.mode='cave';car.vel.set(0,0,0);car.w.set(0,0,0);car.throttle=0;setOffer(null);
  if(!prof.cave)prof.cave={};const first=!prof.cave.found;prof.cave.found=true;saveProf();if(first&&typeof buildMapBase==='function')buildMapBase(LEVELS[state.levelIdx]);
  $('fade').classList.add('on');CV.fade={t:0,hold:.25,cb:()=>{if(!CV.built)cBuild();cCarVis();CV.on=true;CV.lightsWas=state.lights;setLights(true);M.beam.opacity=.045;$('hud').hidden=true;$('hint').hidden=true;$('caveHud').hidden=false;cLayout();cStart();
    cNotice(first?'Du fant en hemmelig grotte!':'Diamantgrotten',2600)}}}
function cStart(){const cv=CV.cave,c=CV.car=makeCaveCar(CARS[state.carIdx],car.tune);c.assist=state.assist;c.speedScale=state.speed/100;placeCaveCar(c,cv,cv.start);
  CV.run=makeCaveRun(cv);CV.treasure=null;CV.phase='drive';CV.paused=false;CV.result=false;CV.acc=0;CV.zone=-1;CV.nuts=0;CV.flips=0;CV.bonus=0;CV.combo=0;CV.doneT=0;CV.lowT=0;CV.snap=true;
  CV.gemIM.on.fill(true);cGemPose(true);CV.canVis.forEach(c=>c.g.visible=true);CV.cpVis.forEach(l=>{l.glass.color.set(LIN('#6a5a40'));l.gl.material.opacity=.15});
  if(CV.chest)CV.chest.lid.rotation.x=0;$('cvPauseMenu').hidden=true;$('result').hidden=true;cHud(true)}
// back to the island: in front of the cave mouth, or (after the treasure chamber) out of the back door on the other side of the rock
function caveExit(back){if(CV.fade||!CV.on)return;$('fade').classList.add('on');
  CV.fade={t:0,hold:.2,cb:()=>{CV.on=false;CV.phase='';CV.result=false;CV.paused=false;if(CV.snd)CV.snd.master.gain.setTargetAtTime(0,AC.currentTime,.1);$('caveHud').hidden=true;$('cvPauseMenu').hidden=true;
    if(!$('result').hidden){$('result').hidden=true;bResultReset()}setLights(CV.lightsWas);
    const D=LV.caveDef,o=back&&D.back?D.back:D.out;placeCar(car,o.x,o.z,o.h);state.checkpoint={x:o.x,z:o.z,h:o.h};state.flipT=0;state.air=0;state.mode='play';state.askCool='cave';camSnap=true;showHud();
    toast(back?'Ut gjennom bakdøra!':'Ute i sola igjen')}}}

/* ---------- a step of the trip: physics, what the car reaches, the events ---------- */
function cInput(){const I=state.inp||{gas:0,rev:0,steer:0};if(CV.phase!=='drive')return{gas:0,brake:0};
  return{gas:Math.max(I.gas,I.steer<0?-I.steer:0),brake:Math.max(I.rev,I.steer>0?I.steer:0)}}
function cStep(dt){const c=CV.car,cv=CV.cave,inp=cInput();CV.inp=inp;stepCaveCar(c,inp,cv,dt);
  for(const e of c.ev){
    if(e.type==='crash'){cNotice('Velt!',1400,true);cBoom();CV.shake=.25;for(let i=0;i<14;i++)cPart(c.x,c.y+.3,'#8a7a6a',2)}
    else if(e.type==='pit'){cNotice('Ned i juvet!',1400,true);cBoom(.6)}
    else if(e.type==='respawn'){placeCaveCar(c,cv,caveRespawnX(cv,CV.run));c.fuel=Math.max(c.fuel,.3);CV.snap=true;cNotice(CV.run.cp>=0?'Tilbake ved '+cv.cps[CV.run.cp].name:'Tilbake ved inngangen',1500)}
    else if(e.type==='land'){if(e.air>.25){CV.shake=Math.min(.12,e.air*.08);cThump(Math.min(1,e.air));for(const w of c.wheels)if(w.contact)for(let i=0;i<5;i++)cPart(w.px,w.py,w.surf===S.SAND?'#d8b878':'#9a9084',1)}
      if(e.flips){const n=e.flips;CV.flips+=n;CV.bonus+=5*n;prof.nuts+=5*n;saveProf();cNotice((n>1?n+' × ':'')+(e.back?'Baklengs salto!':'Salto!')+' +'+5*n+' ⚙',1800);cChime(1)}
      else if(e.air>1.1)cNotice('Luftetur! '+e.air.toFixed(1).replace('.',',')+' s',1200)}
    else if(e.type==='splash'){if(e.v>.8){cSplash();for(let i=0;i<12;i++)cPart(e.x+(Math.random()-.5),e.y,'#bfe8f2',2)}}
    else if(e.type==='empty'){cNotice('Tom for bensin!',2200,true)}}
  c.ev.length=0;
  for(const e of caveRunStep(CV.run,c,cv,dt)){
    if(e.type==='gem'){CV.gemIM.on[e.i]=false;cGemPose(true);prof.nuts+=10;CV.nuts+=10;CV.combo=CV.comboT>0?CV.combo+1:0;CV.comboT=.9;cGemSound(CV.combo);for(let i=0;i<8;i++)cPart(e.x,e.y,'#bff4ff',3);CV.pulse=1;CV.saveT=1}
    else if(e.type==='can'){CV.canVis[e.i].g.visible=false;cNotice('Full tank!',1200);cGlug();for(let i=0;i<8;i++)cPart(e.x,e.y,'#ffb070',3)}
    else if(e.type==='cp'){const l=CV.cpVis[e.i];l.glass.color.set(LIN('#ffd27a'));l.gl.material.opacity=.8;cNotice('Sjekkpunkt: '+e.name,1500);cBell()}
    else if(e.type==='end')cTreasure();
    else if(e.type==='out')cFinish('out');
    else if(e.type==='stranded')cFinish('empty')}}
// the treasure chamber: the chest opens, five diamonds from it, and a bonus the first time
function cTreasure(){CV.phase='done';CV.doneT=0;const first=!prof.cave.treasure;prof.cave.treasure=(prof.cave.treasure||0)+1;const add=50+(first?100:0);prof.nuts+=add;CV.bonus+=add;CV.treasure={first,add};saveProf();
  cNotice(first?'Skattkammeret! +5 💎 og +100 ⚙':'Skattkammeret! +5 💎',2600);cFanfare();for(let i=0;i<30;i++)cPart(CV.cave.end-3+(Math.random()-.5)*2,caveTop(CV.cave,CV.cave.end-3)+.8,['#ffd65a','#9fe8ff','#ff7aa8'][i%3],3)}
// the trip is over: the result, then back to the island. how: 'out' (drove out), 'empty' (no fuel), 'end' (the treasure)
function cFinish(how){if(CV.result)return;const cv=CV.cave,R=CV.run,c=CV.car,m=Math.max(0,R.far)*UNIT_CM/100,got=R.got,key=caveKey(),prev=best[key];saveProf();
  if(how==='empty')cNotice('Tom for bensin – du blir tauet ut',2000,true);
  const rec=!prev||m>prev.d+.05||(how==='end'&&!prev.done);best[key]={d:Math.max(m,prev?prev.d:0),g:Math.max(got,prev?prev.g:0),done:how==='end'||!!(prev&&prev.done)};store.set('best',best);
  CV.phase='result';CV.result=true;CV.how=how;const stars=how==='end'?3:R.far>cv.end*.5?2:1;
  $('rLevel').textContent='Kameløya · Diamantgrotten';$('rTitle').textContent=how==='end'?'Helt inn til skatten!':how==='empty'?'Tom for bensin':'Ut av grotten';
  $('rTime').textContent=fmtTime(R.t);$('rPenL').textContent='Diamanter';$('rPen').textContent=got+'/'+cv.gems.length;$('rGatesL').textContent='Lengst inn';$('rGates').textContent=m.toFixed(1).replace('.',',')+' m';
  $('rStars').innerHTML=[0,1,2].map(i=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z" fill="${i<stars?'#E5A92B':'rgba(242,232,208,.15)'}"/></svg>`).join('');$('rStars').setAttribute('aria-label',stars+' av 3 stjerner');
  const L=[`<li><b>${got} diamanter</b> × 10 = ${got*10} ⚙</li>`];if(CV.flips)L.push(`<li><b>${CV.flips} salto${CV.flips>1?'er':''}:</b> +${CV.flips*5} ⚙</li>`);
  if(CV.treasure)L.push(`<li><b>Skattkammeret:</b> +${CV.treasure.add} ⚙${CV.treasure.first?' (100 av dem for første gang)':''}</li>`);
  if(rec&&prev)L.push('<li><b>Ny rekord:</b> lenger inn enn noen gang.</li>');else if(prev)L.push(`<li><b>Rekorden din:</b> ${prev.d.toFixed(1).replace('.',',')} m${prev.done?', helt inn til skatten':''}</li>`);
  if(how!=='end')L.push('<li><b>Innerst i grotten</b> venter skattkammeret. Plukk opp bensinkannene på veien.</li>');
  $('rLog').innerHTML=L.join('');$('rNuts').textContent='+'+fmtN(got*10+CV.bonus);$('rNutsNote').textContent='1 diamant = 10 muttere. Du har nå '+fmtN(prof.nuts)+' ⚙.';
  $('rNext').textContent=how==='end'?'Ut gjennom bakdøra':'Kjør ut i sola';$('rRetry').textContent='Kjør inn igjen';$('rRetry').hidden=false;$('rMenu').textContent='Til menyen';$('rMenu').hidden=true;$('rGarage').hidden=true;
  setTimeout(()=>{if(CV.result){$('result').hidden=false;$('rNext').focus()}},how==='end'?200:600)}
// the result buttons (game.js): next = out to the island, retry = in again from the entrance
function caveResultBtn(btn){if(!CV.on||!CV.result)return false;CV.result=false;$('result').hidden=true;bResultReset();$('rMenu').hidden=false;
  if(btn==='retry'){CV.snap=true;cStart();cNotice('Diamantgrotten',1600)}else caveExit(CV.how==='end');return true}
function cPause(on){if(!CV.on||CV.result||CV.phase!=='drive')return;CV.paused=!!on;$('cvPauseMenu').hidden=!on;if(on){$('cvpSound').textContent='Lyd: '+(state.sound?'på':'av');$('cvpResume').focus()}}
function caveKeyDown(k){if(CV.fade||!CV.on||CV.result)return;if(k==='escape'||k==='p'){cPause($('cvPauseMenu').hidden);return}if(!$('cvPauseMenu').hidden)return;if(k==='m')setSound(!state.sound)}

/* ---------- every frame (from game.js) ---------- */
function updateCave(dt){
  if(CV.fade){const f=CV.fade;f.t+=dt;if(f.t>.9&&!f.done){f.done=true;f.cb()}if(f.t>.9+f.hold){$('fade').classList.remove('on');CV.fade=null}}
  if(!CV.on){caveMouthAnim();return false}
  if(!CV.paused&&!CV.result){CV.acc+=dt;let n=0;while(CV.acc>=GSTEP&&n<24){cStep(GSTEP);CV.acc-=GSTEP;n++}if(n>=24)CV.acc=0}
  if(CV.phase==='done'){CV.doneT+=dt;if(CV.chest)CV.chest.lid.rotation.x=-Math.min(1.9,CV.doneT*2.5);if(CV.doneT>2.4)cFinish('end')}
  CV.comboT-=dt;CV.shake*=Math.exp(-dt*7);
  cPose();cAnim(dt);cCamera(dt);CV.hudT-=dt;if(CV.hudT<=0){CV.hudT=1/20;cHud()}cSndUpdate(dt);
  if(CV.saveT>0){CV.saveT-=dt;if(CV.saveT<=0)saveProf()}
  renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);renderer.render(CV.scene,CV.cam);return true}
const _cv1=new THREE.Vector3();
function cAnim(dt){const c=CV.car,tm=performance.now()*.001,x0=CV.cam.position.x-14,x1=CV.cam.position.x+14;
  cGemPose(false);
  CV.canVis.forEach((v,i)=>{if(v.g.visible)v.g.rotation.y=Math.sin(tm*1.5+i)*.4});
  if(CV.glows)for(const g of CV.glows)g.sp.material.opacity=.38+.18*Math.sin(tm*1.3+g.ph);
  for(const p of CV.pools)p.top.material.emissiveIntensity=1+.25*Math.sin(tm*2);
  // dust from the wheels on sand and gravel, and sparks of light from the particles
  for(const w of c.wheels)if(w.contact&&(w.slip>1.2||Math.abs(c.vx)>3.5)&&Math.random()<dt*(w.slip>1.2?30:8))cPart(w.px,w.py,w.surf===S.SAND?'#d8b878':w.surf===S.WOOD?'#a07a50':'#9a9084',w.slip>1.2?1:0);
  for(const p of CV.parts){if(p.life<=0)continue;p.life-=dt*(p.k===3?1.6:1.2);p.v.y-=(p.k===0?0:p.k===3?2:6)*dt;p.s.position.addScaledVector(p.v,dt);const k=1-p.life;p.s.scale.setScalar(p.k===3?.12+k*.1:p.k===0?.25+k*.8:.12+k*.35);p.s.material.opacity=Math.max(0,p.life)*(p.k===3?.9:.55);if(p.life<=0)p.s.visible=false}
  if(CV.motes&&state.gfx==='hi'){CV.motes.position.x=Math.sin(tm*.1)*.3;CV.motes.position.y=Math.sin(tm*.13)*.2}
  CV.lamp.position.set(c.x+Math.cos(c.a)*1.4,c.y+1.3,2.2);
  CV.sun.position.set(c.x-4,c.y+9,7);CV.sun.target.position.set(c.x,c.y,0)}
// the diamonds turn and bob, and their glow twinkles; taken ones are scaled to nothing. all: every diamond, not only those in view
const _gm=new THREE.Matrix4(),_gp=new THREE.Vector3(),_gs=new THREE.Vector3(),_gr=new THREE.Quaternion(),_gy=new THREE.Vector3(0,1,0);
function cGemPose(all){const G=CV.gemIM,gems=CV.cave.gems,tm=performance.now()*.001,cx=CV.cam?CV.cam.position.x:0,C=G.glow.geometry.attributes.color,P=G.glow.geometry.attributes.position;
  for(let i=0;i<gems.length;i++){const g=gems[i];if(!all&&Math.abs(g.x-cx)>16)continue;const on=G.on[i],ph=G.ph[i],y=g.y+Math.sin(tm*2.6+ph)*.05;
    _gp.set(g.x,y,0);_gr.setFromAxisAngle(_gy,tm*2+ph);_gs.set(on?1:0,on?1.3:0,on?1:0);_gm.compose(_gp,_gr,_gs);G.im.setMatrixAt(i,_gm);
    const k=on?(.35+.25*Math.sin(tm*4+ph)):0;C.setXYZ(i,.5*k,.9*k,k);P.setY(i,y)}
  G.im.instanceMatrix.needsUpdate=true;C.needsUpdate=true;P.needsUpdate=true}
// a particle: kind 0 = dust that drifts, 1 = dust thrown up, 2 = debris that falls, 3 = a sparkle
function cPart(x,y,colr,k){const p=CV.parts.find(q=>q.life<=0)||CV.parts[Math.floor(Math.random()*CV.parts.length)];p.k=k;p.life=1;p.s.visible=true;p.s.material.color.set(LIN(colr));p.s.material.blending=k===3?THREE.AdditiveBlending:THREE.NormalBlending;
  p.s.position.set(x,y+.05,(Math.random()-.5)*.8);const sp=k===3?2.2:k===2?2:k===1?1.2:.4;p.v.set((Math.random()-.5)*sp-(k<2?CV.car.vx*.15:0),(k===0?.2:1)*Math.random()*sp,(Math.random()-.5)*sp*.5)}
// the camera: from the side, a little ahead of the car (more the faster it goes), further out at speed
function cCamera(dt){const c=CV.car,cam=CV.cam,sp=Math.hypot(c.vx,c.vy),ahead=Math.max(-1.5,Math.min(3.2,c.vx*.55)),tx=c.x+ahead+1.2,ty=c.y+.9,td=(cam.aspect<1?17:13.5)+Math.min(3,sp*.4);
  if(CV.snap){CV.camX=tx;CV.camY=ty;CV.camD=td;CV.snap=false}else{const k=1-Math.exp(-dt*3.2);CV.camX+=(tx-CV.camX)*k;CV.camY+=(ty-CV.camY)*(1-Math.exp(-dt*2.6));CV.camD+=(td-CV.camD)*(1-Math.exp(-dt*1.5))}
  const sh=CV.shake;cam.position.set(CV.camX+(Math.random()-.5)*sh,CV.camY+1.1+(Math.random()-.5)*sh,CV.camD);cam.lookAt(CV.camX,CV.camY+.15,0)}
function cLayout(){if(!CV.cam)return;CV.cam.aspect=innerWidth/innerHeight;CV.cam.fov=CV.cam.aspect<1?48:36;CV.cam.updateProjectionMatrix()}

/* ---------- the HUD: fuel, how far in, diamonds, the name of where you are, the dials ---------- */
function cHud(force){const c=CV.car,R=CV.run,cv=CV.cave;if(!c)return;const m=Math.max(0,c.x)*UNIT_CM/100,b=best[caveKey()];
  const fu=$('cvFuel');fu.style.width=(c.fuel*100).toFixed(1)+'%';fu.parentNode.classList.toggle('low',c.fuel<.22);
  $('cvDist').textContent=m.toFixed(1).replace('.',',')+' m';$('cvBest').textContent=b?'Rekord '+b.d.toFixed(1).replace('.',',')+' m':'Ingen rekord ennå';
  $('cvGems').textContent=R.got;$('cvNuts').textContent='= '+fmtN(R.got*10)+' ⚙';if(CV.pulse>0){$('cvGemBox').classList.remove('pulse');void $('cvGemBox').offsetWidth;$('cvGemBox').classList.add('pulse');CV.pulse=0}
  let zi=-1;for(let i=0;i<cv.zones.length;i++)if(c.x>=cv.zones[i].x)zi=i;if(zi!==CV.zone||force){CV.zone=zi;const el=$('cvZone');el.textContent=zi>=0?cv.zones[zi].name:'Kameløya';el.classList.remove('on');void el.offsetWidth;el.classList.add('on')}
  // the two dials: engine speed and how fast the car goes (cm/s, like on the island)
  const cvs=$('cvDials'),x=cvs.getContext('2d'),W=cvs.width,H=cvs.height,rw=c.wheels[0],wv=rw.contact&&rw.slip<.4?Math.abs(rw.vl):Math.abs(c.thr)*GCFG.vmax,rpm=Math.min(1,.12+.78*wv/GCFG.vmax+.12*Math.abs(c.thr));
  CV.rpm=(CV.rpm||0)+(rpm-(CV.rpm||0))*.35;const spd=Math.abs(c.vx)*UNIT_CM;x.clearRect(0,0,W,H);cDial(x,H/2,H/2,H/2-4,CV.rpm,'TURTALL','');cDial(x,W-H/2,H/2,H/2-4,Math.min(1,spd/60),'FART',Math.round(spd)+' cm/s')}
function cDial(x,cx,cy,r,v,lab,txt){x.save();x.translate(cx,cy);x.fillStyle='rgba(20,18,14,.78)';x.beginPath();x.arc(0,0,r,0,6.283);x.fill();x.strokeStyle='rgba(242,232,208,.85)';x.lineWidth=3;x.stroke();
  const a0=Math.PI*.75,a1=Math.PI*2.25;x.lineWidth=2;for(let i=0;i<=10;i++){const a=a0+(a1-a0)*i/10,r0=i%5?r*.8:r*.72;x.strokeStyle=i>=8?'#ff6a2a':'rgba(242,232,208,.8)';x.beginPath();x.moveTo(Math.cos(a)*r0,Math.sin(a)*r0);x.lineTo(Math.cos(a)*r*.9,Math.sin(a)*r*.9);x.stroke()}
  x.fillStyle='#f2e8d0';x.font='700 '+Math.round(r*.22)+'px "Barlow Condensed",sans-serif';x.textAlign='center';x.fillText(lab,0,r*.55);if(txt){x.font='600 '+Math.round(r*.2)+'px "Barlow Condensed",sans-serif';x.fillText(txt,0,r*.8)}
  const a=a0+(a1-a0)*Math.max(0,Math.min(1,v));x.strokeStyle='#ff6a2a';x.lineWidth=3.5;x.beginPath();x.moveTo(-Math.cos(a)*r*.12,-Math.sin(a)*r*.12);x.lineTo(Math.cos(a)*r*.78,Math.sin(a)*r*.78);x.stroke();x.fillStyle='#14120E';x.beginPath();x.arc(0,0,r*.1,0,6.283);x.fill();x.restore()}
function cNotice(text,ms=1500,bad){const n=$('cvNotice');n.textContent=text;n.classList.toggle('bad',!!bad);n.classList.add('on');clearTimeout(n._t);n._t=setTimeout(()=>n.classList.remove('on'),ms)}

/* ---------- sound: the engine, an echo for everything, drips, chimes (WebAudio, no files) ---------- */
function cSnd(){if(CV.snd||!AC)return CV.snd;try{const C=AC,master=C.createGain();master.gain.value=0;master.connect(C.destination);
  const echo=C.createDelay(1);echo.delayTime.value=.23;const fb=C.createGain();fb.gain.value=.38;const ef=C.createBiquadFilter();ef.type='lowpass';ef.frequency.value=1800;echo.connect(ef);ef.connect(fb);fb.connect(echo);ef.connect(master);
  const fx=C.createGain();fx.gain.value=.8;fx.connect(master);const send=C.createGain();send.gain.value=.5;fx.connect(send);send.connect(echo);
  const o=C.createOscillator();o.type='sawtooth';const o2=C.createOscillator();o2.type='square';const f=C.createBiquadFilter();f.type='lowpass';f.frequency.value=700;const eg=C.createGain();eg.gain.value=0;const g2=C.createGain();g2.gain.value=.3;
  o.connect(f);o2.connect(g2);g2.connect(f);f.connect(eg);eg.connect(master);const es=C.createGain();es.gain.value=.25;eg.connect(es);es.connect(echo);o.start();o2.start();
  const hum=C.createBufferSource();hum.buffer=noiseBuf(C,3);hum.loop=true;const hf=C.createBiquadFilter();hf.type='lowpass';hf.frequency.value=180;const hg=C.createGain();hg.gain.value=0;hum.connect(hf);hf.connect(hg);hg.connect(master);hum.start();
  CV.snd={master,fx,o,o2,f,eg,hg,nb:noiseBuf(C,1),drip:1}}catch(e){CV.snd=null}return CV.snd}
function cSndUpdate(dt){const S_=cSnd();if(!S_)return;const t=AC.currentTime,on=CV.on&&state.sound&&!CV.paused,c=CV.car,vc=state.volCar/70,va=state.volAmb/70;
  S_.master.gain.setTargetAtTime(on?1:0,t,.15);if(!on||!c)return;const run=c.crashT===0&&c.fuel>0,thr=Math.abs(c.thr),f=45+(CV.rpm||0)*150+thr*20;
  S_.o.frequency.setTargetAtTime(f,t,.05);S_.o2.frequency.setTargetAtTime(f*.5,t,.05);S_.f.frequency.setTargetAtTime(400+thr*900+(CV.rpm||0)*600,t,.08);S_.eg.gain.setTargetAtTime(run?(.014+thr*.05+(CV.rpm||0)*.02)*vc:0,t,.08);
  S_.hg.gain.setTargetAtTime(.05*va,t,.5);
  // water dripping somewhere in the dark, now and then
  S_.drip-=dt;if(S_.drip<=0){S_.drip=.6+Math.random()*2.6;cTone(1400+Math.random()*900,.06,'sine',.06*va,600)}
  // the fuel warning
  if(c.fuel<.22&&c.fuel>0){CV.lowT-=dt;if(CV.lowT<=0){CV.lowT=1.1;cTone(880,.09,'square',.05*vc);cTone(660,.12,'square',.05*vc,0,.12)}}}
function cTone(fr,d,type='triangle',v=.2,glide=0,delay=0){const S_=cSnd();if(!S_||!state.sound)return;const C=AC,t=C.currentTime+delay,o=C.createOscillator(),g=C.createGain();o.type=type;o.frequency.setValueAtTime(fr,t);if(glide)o.frequency.exponentialRampToValueAtTime(Math.max(40,fr-glide),t+d);
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+d+.05);o.connect(g);g.connect(S_.fx);o.start(t);o.stop(t+d+.1)}
function cNoise(d,type,fr,v,delay=0){const S_=cSnd();if(!S_||!state.sound)return;const C=AC,t=C.currentTime+delay,n=C.createBufferSource();n.buffer=S_.nb;const f=C.createBiquadFilter();f.type=type;f.frequency.value=fr;const g=C.createGain();
  g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);n.connect(f);f.connect(g);g.connect(S_.fx);n.start(t);n.stop(t+d+.05)}
// a diamond: a bright two-note «pling», higher for every diamond you take in a row
function cGemSound(n){const k=Math.pow(2,Math.min(n,8)/12),v=.14*state.volAmb/70+.06;cTone(1319*k,.07,'triangle',v);cTone(1976*k,.16,'triangle',v,0,.06)}
function cChime(v){cTone(784,.12,'triangle',.18*v);cTone(1047,.12,'triangle',.18*v,0,.1);cTone(1568,.3,'triangle',.18*v,0,.2)}
function cBell(){cTone(523,.6,'sine',.16);cTone(1046,.5,'sine',.06)}
function cGlug(){for(let i=0;i<4;i++)cTone(180+i*40,.08,'sine',.18,60,i*.09)}
function cBoom(v=1){cNoise(.6,'lowpass',500,.8*v);cTone(90,.4,'sine',.5*v,50)}
function cThump(v){cNoise(.25,'lowpass',300,.5*v);cTone(70,.2,'sine',.35*v,30)}
function cSplash(){cNoise(.45,'highpass',1500,.3)}
function cFanfare(){[523,659,784,1047,784,1047].forEach((n,i)=>cTone(n,i===5?.9:.16,'triangle',.22,0,i*.17))}

function initCave(){
  $('cvPause').addEventListener('click',()=>cPause(true));$('cvpResume').onclick=()=>cPause(false);
  $('cvpRestart').onclick=()=>{cPause(false);CV.snap=true;cStart()};$('cvpOut').onclick=()=>{cPause(false);cFinish('out')};
  $('cvpFetch').onclick=()=>{cPause(false);const c=CV.car;if(c&&c.crashT===0){c.crashT=.01}};   // put the car back at the last checkpoint
  $('cvpSound').onclick=()=>{setSound(!state.sound);$('cvpSound').textContent='Lyd: '+(state.sound?'på':'av')};
  addEventListener('resize',()=>{if(CV.on)cLayout()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&CV.on)cPause(true)})}
initCave();
