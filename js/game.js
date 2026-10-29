'use strict';
/* =================================================================
   UI: rendering, models, input, game flow
   ================================================================= */
const $=id=>document.getElementById(id);
const FIXED=1/240;
const store={get(k,d){try{const v=localStorage.getItem('sgc:'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('sgc:'+k,JSON.stringify(v))}catch(e){}}};

// car and level are saved by id; older saves used the list index
const idxOf=(list,v)=>{const i=typeof v==='number'?v:list.findIndex(x=>x.id===v);return i>=0&&i<list.length?i:0};
const state={mode:'menu',carIdx:idxOf(CARS,store.get('car',0)),levelIdx:idxOf(LEVELS,store.get('level',0)),assist:store.get('assist',true),camMode:0,lights:false,sound:store.get('sound',true),
  speed:store.get('speed',100),gfx:store.get('gfx','hi'),volCar:store.get('volCar',70),volAmb:store.get('volAmb',70),
  time:0,started:false,penalty:0,next:0,flipT:0,checkpoint:null,missed:0,touched:0,winches:0,log:[],input:{gas:0,rev:0,left:0,right:0}};
let best=store.get('best',{});
// player profile: currency, parts, paint
const prof=Object.assign({nuts:0,parts:{},paint:0,paints:[0],first:{},runs:0,lastDay:'',secrets:{},cars:[]},store.get('prof',{}));if(!prof.secrets)prof.secrets={};if(!prof.cars)prof.cars=[];
const ownsCar=c=>!c.price||prof.cars.includes(c.id);
if(!PAINTS[prof.paint])prof.paint=0;
const saveProf=()=>store.set('prof',prof);
const fmtN=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const isIsland=l=>!!(l.world||l.village);
const courseKey=(l,k)=>k.main?l.id:l.id+'/'+k.id;
const starKeys=l=>l.world?l.challenges.map(c=>l.id+'/'+c.id):[l.id];
const totalStars=()=>LEVELS.reduce((s,l)=>s+starKeys(l).reduce((a,k)=>a+((best[k]&&best[k].s)||0),0),0);
const maxStars=()=>LEVELS.reduce((s,l)=>s+starKeys(l).length*3,0);

/* ---------- renderer & scene ---------- */
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
$('stage').appendChild(renderer.domElement);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(55,1,.05,400);
const hemi=new THREE.HemisphereLight(0xffffff,0x888888,.6);
const sun=new THREE.DirectionalLight(0xffffff,1);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.5,far:90});
sun.shadow.bias=-.0004;sun.shadow.normalBias=.03;
scene.add(hemi,sun,sun.target);
const pmrem=new THREE.PMREMGenerator(renderer);pmrem.compileEquirectangularShader();
const LIN=h=>new THREE.Color(h).convertSRGBToLinear();

// sky dome, sun glow
const skyDome=new THREE.Mesh(new THREE.SphereGeometry(190,32,18),new THREE.MeshBasicMaterial({side:THREE.BackSide,fog:false,depthWrite:false}));
skyDome.renderOrder=-10;skyDome.frustumCulled=false;scene.add(skyDome);
const glowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.18,'rgba(255,255,255,.55)');g.addColorStop(.5,'rgba(255,255,255,.12)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c)})();
const sunGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xfff2d0,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
sunGlow.scale.set(60,60,1);scene.add(sunGlow);

// terrain mesh
// the terrain is cut into TILES×TILES meshes so the GPU only draws (and shadows) what the camera sees.
// tPos/tCol/tNrm are the master arrays for the whole grid; syncTerrain() copies them into the tiles after a level is generated.
let tPos,tCol,tNrm,terrainTiles=[],terrainN=0;const TILES=8,terrainMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.93,metalness:0});
function buildTerrainGeo(){for(const t of terrainTiles){scene.remove(t.mesh);t.mesh.geometry.dispose()}terrainTiles=[];terrainN=N;
  tPos=new Float32Array(N*N*3);tCol=new Float32Array(N*N*3);tNrm=new Float32Array(N*N*3);
  const per=Math.ceil((N-1)/TILES);
  for(let tj=0;tj<TILES;tj++)for(let ti=0;ti<TILES;ti++){const i0=ti*per,j0=tj*per,i1=Math.min(N-1,i0+per),j1=Math.min(N-1,j0+per);if(i1<=i0||j1<=j0)continue;
    const w=i1-i0+1,h=j1-j0+1,idx=new Uint32Array((w-1)*(h-1)*6);let p=0;
    for(let j=0;j<h-1;j++)for(let i=0;i<w-1;i++){const a=j*w+i,b=a+1,c=a+w,d=c+1;idx[p++]=a;idx[p++]=c;idx[p++]=b;idx[p++]=b;idx[p++]=c;idx[p++]=d}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(w*h*3),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(w*h*3),3));g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(w*h*3),3));g.setIndex(new THREE.BufferAttribute(idx,1));
    const mesh=new THREE.Mesh(g,terrainMat);mesh.receiveShadow=true;mesh.castShadow=true;scene.add(mesh);terrainTiles.push({mesh,i0,j0,w,h})}}
// smooth normals straight from the height grid (so tile seams are invisible), then copy everything into the tiles
function syncTerrain(){for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i,s=(di,dj)=>TH[Math.min(N-1,Math.max(0,j+dj))*N+Math.min(N-1,Math.max(0,i+di))];
    const nx=s(-1,0)-s(1,0),nz=s(0,-1)-s(0,1),ny=2*CELL,inv=1/Math.hypot(nx,ny,nz);tNrm[k*3]=nx*inv;tNrm[k*3+1]=ny*inv;tNrm[k*3+2]=nz*inv}
  for(const t of terrainTiles){const P=t.mesh.geometry.attributes.position.array,C=t.mesh.geometry.attributes.color.array,Nn=t.mesh.geometry.attributes.normal.array;
    for(let j=0;j<t.h;j++)for(let i=0;i<t.w;i++){const k=(t.j0+j)*N+(t.i0+i),q=(j*t.w+i)*3;P[q]=tPos[k*3];P[q+1]=tPos[k*3+1];P[q+2]=tPos[k*3+2];C[q]=tCol[k*3];C[q+1]=tCol[k*3+1];C[q+2]=tCol[k*3+2];Nn[q]=tNrm[k*3];Nn[q+1]=tNrm[k*3+1];Nn[q+2]=tNrm[k*3+2]}
    const g=t.mesh.geometry;g.attributes.position.needsUpdate=true;g.attributes.color.needsUpdate=true;g.attributes.normal.needsUpdate=true;g.computeBoundingSphere();g.computeBoundingBox()}}
buildTerrainGeo();
// water: one shared material with a scrolling, tiling normal map; a big plane for rivers plus discs for ponds
function waterNormalTex(){const s=256,P=8,c=document.createElement('canvas');c.width=c.height=s;const x=c.getContext('2d'),img=x.createImageData(s,s),r=mulberry32(77),grid=[];
  for(let o=0;o<3;o++){const g=new Float32Array(P*P*4);for(let i=0;i<g.length;i++)g[i]=r();grid.push(g)}
  const val=(o,gx,gz)=>{const n=P*(o+1);return grid[o][((gz%n+n)%n)*n+((gx%n+n)%n)]};
  const hgt=(u,v)=>{let h=0,a=1;for(let o=0;o<3;o++){const n=P*(o+1),fx=u*n,fz=v*n,xi=Math.floor(fx),zi=Math.floor(fz),tx=fx-xi,tz=fz-zi,sx=tx*tx*(3-2*tx),sz=tz*tz*(3-2*tz);
    const A=val(o,xi,zi),B=val(o,xi+1,zi),C=val(o,xi,zi+1),D=val(o,xi+1,zi+1);h+=((A+(B-A)*sx)*(1-sz)+(C+(D-C)*sx)*sz)*a;a*=.5}return h};
  for(let j=0;j<s;j++)for(let i=0;i<s;i++){const e=1/s,dx=hgt((i+1)/s,j/s)-hgt((i-1)/s,j/s),dz=hgt(i/s,(j+1)/s)-hgt(i/s,(j-1)/s);let nx=-dx*22,nz=-dz*22,ny=1;const l=Math.hypot(nx,ny,nz);nx/=l;ny/=l;nz/=l;
    const k=(j*s+i)*4;img.data[k]=(nx*.5+.5)*255;img.data[k+1]=(nz*.5+.5)*255;img.data[k+2]=(ny*.5+.5)*255;img.data[k+3]=255}
  x.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t}
const waterMat=new THREE.MeshStandardMaterial({color:LIN('#3f5c4d'),roughness:.08,metalness:.3,transparent:true,opacity:.7,normalMap:waterNormalTex(),normalScale:new THREE.Vector2(.45,.45),envMapIntensity:1.2});
// the sea reaches the horizon (the fog fades it into the sky); the UVs keep the waves the same size as on the old 70-wide plane
const WATER_SPAN=420,water=new THREE.Mesh((()=>{const g=new THREE.PlaneGeometry(WATER_SPAN,WATER_SPAN),uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*WATER_SPAN/70,uv.getY(i)*WATER_SPAN/70);return g})(),waterMat);water.rotation.x=-Math.PI/2;water.renderOrder=2;scene.add(water);
const mudMat=new THREE.MeshStandardMaterial({color:LIN('#5b4631'),roughness:.22,metalness:.1,transparent:true,opacity:.88,normalMap:waterMat.normalMap,normalScale:new THREE.Vector2(.3,.3),envMapIntensity:.9});
const poolGroup=new THREE.Group();scene.add(poolGroup);
// wind: grass, reeds, ferns, palm fronds and leaves sway a little. The sway is added after the instance matrix (in world units) and grows
// with the distance from the instance's foot, so thin reeds bend as much as wide bushes and the foot stays put. amp = sway per unit of height.
const WIND={uTime:{value:0}};
function windMaterial(m,amp){m.onBeforeCompile=sh=>{sh.uniforms.uWindT=WIND.uTime;
  sh.vertexShader='uniform float uWindT;\n'+sh.vertexShader.replace('#include <project_vertex>',`vec4 mvPosition=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
      mvPosition=instanceMatrix*mvPosition;
      vec3 wFoot=instanceMatrix[3].xyz;float wd=min(length(mvPosition.xyz-wFoot),2.5);
      mvPosition.x+=sin(uWindT*1.6+wFoot.x*.7+wFoot.z*.4)*${amp.toFixed(3)}*wd;
      mvPosition.z+=cos(uWindT*1.25+wFoot.x*.45-wFoot.z*.6)*${(amp*.8).toFixed(3)}*wd;
    #endif
    mvPosition=modelViewMatrix*mvPosition;gl_Position=projectionMatrix*mvPosition;`)};m.needsUpdate=true}
windMaterial(DM.tuft,.05);windMaterial(DM.leaf,.012);
function buildPools(lv){poolGroup.children.slice().forEach(m=>{m.geometry.dispose();poolGroup.remove(m)});
  for(const p of lv.pools){const m=new THREE.Mesh(new THREE.CircleGeometry(p.r,36),p.mud?mudMat:waterMat);m.rotation.x=-Math.PI/2;m.position.set(p.x,p.level,p.z);m.renderOrder=2;poolGroup.add(m)}}
let levelGroup=new THREE.Group();scene.add(levelGroup);

// rain
const RAIN_N=900,rainGeo=new THREE.BufferGeometry(),rainPos=new Float32Array(RAIN_N*3);
for(let i=0;i<RAIN_N;i++){rainPos[i*3]=(Math.random()-.5)*26;rainPos[i*3+1]=Math.random()*14;rainPos[i*3+2]=(Math.random()-.5)*26}
rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3));
const rain=new THREE.Points(rainGeo,new THREE.PointsMaterial({color:0xdfe8ee,size:.045,transparent:true,opacity:.55,depthWrite:false}));rain.visible=false;rain.frustumCulled=false;scene.add(rain);
let ashMode=false,snowMode=false,precipK=1;
// rain, drifting ash or snow. def.precip(x,z) (0–1) can limit it to part of the level, for example the summit.
function updateRain(dt){if(!rain.visible)return;const cx=camera.position.x,cz=camera.position.z,cy=camera.position.y,def=LEVELS[state.levelIdx];
  if(def.precip&&car){const fp=focusPos();precipK+=(def.precip(fp.x,fp.z)-precipK)*.04;rain.material.opacity=.55*precipK}
  for(let i=0;i<RAIN_N;i++){let y=rainPos[i*3+1]-dt*(ashMode?1.1:snowMode?1.9:13);if(ashMode)rainPos[i*3]+=dt*.5;if(snowMode){rainPos[i*3]+=dt*(.8+.6*Math.sin(y*1.3+i));rainPos[i*3+2]+=dt*.3*Math.cos(y+i)}if(y<cy-6){y+=14;rainPos[i*3]=cx+(Math.random()-.5)*26;rainPos[i*3+2]=cz+(Math.random()-.5)*26}rainPos[i*3+1]=y}
  rainGeo.attributes.position.needsUpdate=true}

// supply crates
const crateGeo=new THREE.BoxGeometry(.24,.24,.24),crateBand=new THREE.BoxGeometry(.25,.07,.25);
let crateVis=[];
function buildCrates(lv){crateVis.forEach(c=>levelGroup.remove(c.g));crateVis=[];
  lv.crates.forEach(cr=>{const g=new THREE.Group();const b=new THREE.Mesh(crateGeo,M.crate);b.castShadow=true;g.add(b);const s=new THREE.Mesh(crateBand,M.blk);g.add(s);
    const rg=new THREE.Mesh(new THREE.RingGeometry(.3,.38,24),new THREE.MeshBasicMaterial({color:LIN('#E5A92B'),transparent:true,opacity:.5,side:THREE.DoubleSide,depthWrite:false}));rg.rotation.x=-Math.PI/2;rg.position.y=-.14;g.add(rg);
    g.position.set(cr.x,cr.y,cr.z);levelGroup.add(g);crateVis.push({g,cr,taken:false})})}
function resetCrates(){crateVis.forEach(c=>{c.taken=false;c.g.visible=true})}

function skyTex(def){const c=document.createElement('canvas');c.width=1024;c.height=512;const x=c.getContext('2d');
  const hz='#'+def.fog.toString(16).padStart(6,'0'),g=x.createLinearGradient(0,0,0,512);
  g.addColorStop(0,def.sky[0]);g.addColorStop(.42,def.sky[1]);g.addColorStop(.5,hz);g.addColorStop(.56,hz);g.addColorStop(1,def.ground||hz);x.fillStyle=g;x.fillRect(0,0,1024,512);
  if(def.clouds!==false){const r=mulberry32(def.seed+9);for(let i=0;i<26;i++){const cx=r()*1024,cy=70+r()*150,w=50+r()*150,a=.18+r()*.3;
    const rg=x.createRadialGradient(cx,cy,0,cx,cy,w);rg.addColorStop(0,`rgba(255,250,240,${a})`);rg.addColorStop(.45,`rgba(255,250,240,${a*.4})`);rg.addColorStop(1,'rgba(255,250,240,0)');
    x.fillStyle=rg;x.beginPath();x.ellipse(cx,cy,w,w*.36,0,0,7);x.fill()}}
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t}

// terrain shading: ambient occlusion in crevices, darker on steep slopes
function shadeTerrain(){
  const r1=2,r2=6;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i,h=TH[k];
    const s=(di,dj)=>TH[Math.min(N-1,Math.max(0,j+dj))*N+Math.min(N-1,Math.max(0,i+di))];
    const a1=(s(r1,0)+s(-r1,0)+s(0,r1)+s(0,-r1))*.25-h,a2=(s(r2,0)+s(-r2,0)+s(0,r2)+s(0,-r2)+s(r2,r2)+s(-r2,-r2)+s(r2,-r2)+s(-r2,r2))*.125-h;
    const ao=Math.max(-.22,Math.min(.5,a1*2.4+a2*.9));
    const nx=s(-1,0)-s(1,0),nz=s(0,-1)-s(0,1),ny=2*CELL,inv=1/Math.hypot(nx,ny,nz),slope=1-ny*inv;
    const f=Math.max(.42,Math.min(1.12,(1-ao*.75)*(1-slope*.3)));
    tCol[k*3]=TC[k*3]*f;tCol[k*3+1]=TC[k*3+1]*f;tCol[k*3+2]=TC[k*3+2]*f}
  contactShade();waterShade();
}
// contact shadows baked into the terrain colour: the sun's shadow only reaches ~10 units round the car, so trees, houses, lamps and
// bushes further away would look pasted on. The ground darkens softly round everything with a collider, and under tree crowns.
function contactShade(){if(!LV)return;const occ=new Float32Array(N*N).fill(1),sm=t=>t<=0?1:t>=1?0:1-t*t*(3-2*t);
  const ring=(x,z,r,spread,k)=>{const R=r+spread;cellsIn(x-R,z-R,x+R,z+R,(i,px,pz)=>{const d=Math.hypot(px-x,pz-z);if(d<R)occ[i]*=1-k*sm((d-r*.7)/(spread+r*.3))})};
  for(const c of LV.colliders){if(c.r!=null)ring(c.x,c.z,c.r,.35+c.r*.9,.3);
    else{const R=Math.max(c.w,c.d)/2+.7,cs=Math.cos(c.ry||0),sn=Math.sin(c.ry||0);cellsIn(c.x-R,c.z-R,c.x+R,c.z+R,(i,px,pz)=>{const dx=px-c.x,dz=pz-c.z,lx=Math.abs(dx*cs-dz*sn)-c.w/2,lz=Math.abs(dx*sn+dz*cs)-c.d/2,d=Math.hypot(Math.max(lx,0),Math.max(lz,0));occ[i]*=1-.3*sm(d/.7)})}}
  for(const p of LV.perches)if(p.kind==='top')ring(p.x,p.z,p.tree?1.1:.6,p.tree?1.1:.7,p.tree?.16:.12);   // the crowns of trees and palms
  for(let k=0;k<N*N;k++){const o=Math.max(.55,occ[k]);tCol[k*3]*=o;tCol[k*3+1]*=o;tCol[k*3+2]*=o}}
// under water the bottom takes on the water's colour and darkens with depth; the sand just above the waterline is wet
function waterShade(){const def=LEVELS[state.levelIdx];if(def.water==null&&!(LV&&LV.pools&&LV.pools.length))return;const deep=col(def.waterCol||'#3f5c4d').map(v=>v*.5);
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i,px=-HALF+i*CELL,pz=-HALF+j*CELL,w=WL(px,pz);if(w<-1e8)continue;const d=w-TH[k];
    if(d>0){const t=Math.min(.8,d*1.3);for(let c=0;c<3;c++)tCol[k*3+c]+=(deep[c]-tCol[k*3+c])*t}
    else if(d>-.1){const f=1-.2*(1+d/.1);for(let c=0;c<3;c++)tCol[k*3+c]*=f}}}

// tyre tracks on soft ground
const TRK_N=600,trkGeo=new THREE.PlaneGeometry(.12,.22);trkGeo.rotateX(-Math.PI/2);
const tracks=new THREE.InstancedMesh(trkGeo,new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.2,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}),TRK_N);
tracks.count=0;tracks.frustumCulled=false;tracks.renderOrder=1;scene.add(tracks);
let trkI=0;const _m4=new THREE.Matrix4(),_qN=new Q4(),_qY=new Q4(),_pT=new V3(),_sT=new V3(1,1,1),_nT=new V3();
const TRACK_SURF=new Set([S.SAND,S.DIRT,S.MUD,S.GRAVEL,S.GRASS,S.ASH,S.SNOW]);
function layTrack(w,dirx,dirz){
  if(!TRACK_SURF.has(w.surf)||!tracks.visible)return;
  if(!w.lastTrk)w.lastTrk=new V3(1e9,0,1e9);if(w.lastTrk.distanceTo(w.P)<.13)return;w.lastTrk.copy(w.P);
  normalAt(w.P.x,w.P.z,_nT);_pT.copy(w.P).addScaledVector(_nT,.012);
  _qN.setFromUnitVectors(YAX,_nT);_qY.setFromAxisAngle(YAX,Math.atan2(dirx,dirz));_qN.multiply(_qY);
  _sT.set(1,1,w.surf===S.MUD?1.4:1);_m4.compose(_pT,_qN,_sT);tracks.setMatrixAt(trkI,_m4);trkI=(trkI+1)%TRK_N;tracks.count=Math.max(tracks.count,trkI||TRK_N);tracks.instanceMatrix.needsUpdate=true;
}
function clearTracks(){tracks.count=0;trkI=0;if(car)car.wheels.forEach(w=>{if(w.lastTrk)w.lastTrk.set(1e9,0,1e9)})}

/* ---------- materials & car model ---------- */
const M={
  yel:new THREE.MeshStandardMaterial({color:0xe3a62a,roughness:.3,metalness:.08,envMapIntensity:.9}),
  blk:new THREE.MeshStandardMaterial({color:0x1d1c1a,roughness:.7}),
  blkC:new THREE.MeshStandardMaterial({color:0x1d1c1a,roughness:.7}),   // the car's black parts (gets mud and snow like the paint)
  glass:new THREE.MeshStandardMaterial({color:0x1a262d,roughness:.06,metalness:.85,envMapIntensity:1.3}),
  tire:new THREE.MeshStandardMaterial({color:0x1a1918,roughness:.95,flatShading:true}),
  rim:new THREE.MeshStandardMaterial({color:0xe3a62a,roughness:.45,metalness:.2}),
  steel:new THREE.MeshStandardMaterial({color:0x9a9a96,roughness:.35,metalness:.8}),
  lamp:new THREE.MeshStandardMaterial({color:0xf3efe2,roughness:.15,emissive:0x000000,metalness:.2}),
  tail:new THREE.MeshStandardMaterial({color:0x7c1410,roughness:.25,emissive:0x000000}),
  amber:new THREE.MeshStandardMaterial({color:0xd98a1a,roughness:.3}),
  can:new THREE.MeshStandardMaterial({color:0x44502f,roughness:.6}),
  skin:new THREE.MeshStandardMaterial({color:0xd9a07a,roughness:.7}),
  shirt:new THREE.MeshStandardMaterial({color:0x2c4a6b,roughness:.8}),
  plate:new THREE.MeshStandardMaterial({color:0xf2e8d0,roughness:.5}),
  crate:new THREE.MeshStandardMaterial({color:0xe3a62a,roughness:.5}),
  beam:new THREE.MeshBasicMaterial({color:0xffe6b0,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,side:THREE.DoubleSide}),
  red:new THREE.MeshStandardMaterial({color:0xc43b2f,roughness:.5}),
  orange:new THREE.MeshStandardMaterial({color:0xe07a2a,roughness:.6}),
  green:new THREE.MeshStandardMaterial({color:0x3f6b3a,roughness:.7}),
  blue:new THREE.MeshStandardMaterial({color:0x3a6fb0,roughness:.6}),
  canvas:new THREE.MeshStandardMaterial({color:0x8a8470,roughness:1}),
  wood:new THREE.MeshStandardMaterial({color:0x8a6a3a,roughness:.9}),
  trim:new THREE.MeshStandardMaterial({color:0xd8d2c0,roughness:.6}),
  cal:new THREE.MeshStandardMaterial({color:0xf2c21b,roughness:.35})   // brake calipers on the sports car
};
Object.values(M).forEach(m=>m.color.convertSRGBToLinear());Object.values(DM).forEach(m=>m.color.convertSRGBToLinear());
// mud, snow, dust and water on the car: a small shader addition on the paint and the black parts.
// coat.x=mud, .y=snow, .z=dust, .w=wet. Mud and dust sit low on the body, snow settles on top, water darkens and makes it glossy.
const coat={mud:0,snow:0,dust:0,wet:0},coatU={uCoat:{value:new THREE.Vector4()},uCarY:{value:0}};
function coatMaterial(m){m.onBeforeCompile=sh=>{sh.uniforms.uCoat=coatU.uCoat;sh.uniforms.uCarY=coatU.uCarY;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uCarY;varying float vCoatY;varying float vCoatN;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\n{vec4 wp=modelMatrix*vec4(position,1.0);vCoatY=wp.y-uCarY;vCoatN=normalize(mat3(modelMatrix)*normal).y;}');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec4 uCoat;varying float vCoatY;varying float vCoatN;')
    .replace('#include <color_fragment>','#include <color_fragment>\n{float low=1.0-smoothstep(0.2,0.78,vCoatY);float top=smoothstep(0.25,0.75,vCoatN)*smoothstep(0.3,0.7,vCoatY);\n  float mud=uCoat.x*low;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.18,0.12,0.07),mud*0.9);\n  float dust=uCoat.z*low*(1.0-mud);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.62,0.50,0.30),dust*0.55);\n  float snow=uCoat.y*max(top,low*0.5);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.90,0.93,0.97),snow*0.95);\n  diffuseColor.rgb*=1.0-0.22*uCoat.w*(1.0-snow);}')
    .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,0.12,uCoat.w*0.8);roughnessFactor=mix(roughnessFactor,0.95,max(uCoat.x,uCoat.y)*0.6);')}}
coatMaterial(M.yel);coatMaterial(M.blkC);coatMaterial(M.tire);
// how much the wheels pick up and lose each frame
function updateCoat(dt){if(!car)return;let inMud=0,inSnow=0,inDust=0,inWater=0,moving=car.vel.lengthSq()>.3;
  for(const w of car.wheels){if(!w.contact)continue;const s=w.surf;if(w.wd>0)inWater++;else if(s===S.MUD||s===S.BOG)inMud+=1+w.slip;else if(s===S.SNOW||s===S.ICE)inSnow++;else if(s===S.SAND||s===S.GRAVEL||s===S.DIRT||s===S.ASH)inDust++}
  const def=LEVELS[state.levelIdx],rain=!!def.rain;
  if(moving){coat.mud=Math.min(1,coat.mud+dt*.14*inMud);coat.snow=Math.min(1,coat.snow+dt*.12*inSnow);coat.dust=Math.min(1,coat.dust+dt*.05*inDust)}
  if(inWater){coat.wet=1;coat.mud=Math.max(0,coat.mud-dt*.5);coat.dust=Math.max(0,coat.dust-dt*.9);coat.snow=Math.max(0,coat.snow-dt*.6)}
  if(rain){coat.wet=Math.min(1,coat.wet+dt*.4);coat.dust=Math.max(0,coat.dust-dt*.2);coat.mud=Math.max(0,coat.mud-dt*.03)}
  if(!inSnow)coat.snow=Math.max(0,coat.snow-dt*.03);if(!inMud)coat.mud=Math.max(0,coat.mud-dt*.004);if(!inDust)coat.dust=Math.max(0,coat.dust-dt*.01);if(!inWater&&!rain)coat.wet=Math.max(0,coat.wet-dt*.12);
  coatU.uCoat.value.set(coat.mud,coat.snow,coat.dust,coat.wet);coatU.uCarY.value=car.pos.y}
function clearCoat(){coat.mud=coat.snow=coat.dust=coat.wet=0;coatU.uCoat.value.set(0,0,0,0)}
function decalTexture(){
  const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d');
  x.fillStyle='#1d1c1a';x.beginPath();x.ellipse(128,64,124,60,0,0,Math.PI*2);x.fill();
  x.strokeStyle='#e3a62a';x.lineWidth=6;x.beginPath();x.ellipse(128,64,110,48,0,0,Math.PI*2);x.stroke();
  x.fillStyle='#e3a62a';x.textAlign='center';x.font='42px "Saira Stencil One", Impact, sans-serif';x.fillText('SKARE',128,72);
  x.font='600 17px "Barlow Condensed", Arial, sans-serif';x.fillText('EKSPEDISJON · 1:24',128,98);
  const t=new THREE.CanvasTexture(c);t.anisotropy=4;t.encoding=THREE.sRGBEncoding;return t;
}
let decalMat=null;
function bx(w,h,d,mat,x,y,z,p){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;p.add(m);return m}
function cyl(r,h,mat,x,y,z,p,axis,seg=14){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg),mat);if(axis==='z')m.rotation.x=Math.PI/2;if(axis==='x')m.rotation.z=Math.PI/2;m.position.set(x,y,z);m.castShadow=true;p.add(m);return m}

let carVis=null;
function buildCarVis(cfg){
  if(carVis){scene.remove(carVis.body);carVis.wheels.forEach(w=>scene.remove(w.root));carVis.axles.forEach(a=>scene.remove(a));
    carVis.body.traverse(o=>{if(o.geometry)o.geometry.dispose()})}
  const body=buildBody(cfg);scene.add(body);
  const wheels=[];for(let i=0;i<4;i++){const w=carWheel(cfg,i%2===0?1:-1,i>1);scene.add(w.root);wheels.push(w)}
  const axles=[];for(let i=0;i<2;i++){const a=new THREE.Group();const tube=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,1,8),M.blk);tube.castShadow=true;a.add(tube);
    const diff=new THREE.Mesh(new THREE.SphereGeometry(.075,12,10),M.blk);diff.castShadow=true;a.add(diff);a.userData.tube=tube;scene.add(a);axles.push(a)}
  const spots=[];for(const sx of[1,-1]){const s=new THREE.SpotLight(0xfff1cc,0,16,.55,.6,1.2);s.position.set(sx*.3,.3,cfg.L/2);const t=new THREE.Object3D();t.position.set(sx*.3,-.4,cfg.L/2+4);body.add(s,t);s.target=t;spots.push(s)}
  carVis={body,wheels,axles,spots};setLights(state.lights);
}

/* ---------- gate visuals ---------- */
const gateMat={pole:new THREE.MeshStandardMaterial({color:0xf2efe6,roughness:.5}),cap:new THREE.MeshStandardMaterial({color:0x1d1c1a,roughness:.6})};
const FLAG={pending:'#f2efe6',next:'#ff6a2a',passed:'#8bbb4a',missed:'#d9432f'};
const flagGeo=(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0,-.26,0,.34,-.13,0],3));g.computeVertexNormals();return g})();
function numSprite(txt,bg){const c=document.createElement('canvas');c.width=128;c.height=128;const x=c.getContext('2d');x.fillStyle=bg;x.beginPath();x.arc(64,64,56,0,Math.PI*2);x.fill();
  x.fillStyle='#14120E';x.textAlign='center';x.textBaseline='middle';x.font=(txt.length>2?'40px':'64px')+' "Saira Stencil One", Impact, sans-serif';x.fillText(txt,64,70);
  const tx=new THREE.CanvasTexture(c);tx.encoding=THREE.sRGBEncoding;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,depthTest:true}));s.scale.set(.45,.45,.45);return s}
function finishBanner(){const c=document.createElement('canvas');c.width=512;c.height=96;const x=c.getContext('2d');for(let i=0;i<32;i++)for(let j=0;j<6;j++){x.fillStyle=(i+j)%2?'#14120E':'#F2E8D0';x.fillRect(i*16,j*16,16,16)}
  x.fillStyle='#E5A92B';x.fillRect(176,10,160,76);x.fillStyle='#14120E';x.textAlign='center';x.textBaseline='middle';x.font='60px "Saira Stencil One", Impact, sans-serif';x.fillText('MÅL',256,52);
  const tx=new THREE.CanvasTexture(c);tx.encoding=THREE.sRGBEncoding;return new THREE.MeshStandardMaterial({map:tx,side:THREE.DoubleSide,roughness:.7})}
let gateVis=[];
const beacon=new THREE.Group();
{const b=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,7,8,1,true),new THREE.MeshBasicMaterial({color:0xff6a2a,transparent:true,opacity:.35,depthWrite:false}));b.position.y=3.5;beacon.add(b);
 const r=new THREE.Mesh(new THREE.RingGeometry(1.1,1.3,40),new THREE.MeshBasicMaterial({color:0xff6a2a,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false}));r.rotation.x=-Math.PI/2;r.position.y=.06;beacon.add(r);beacon.userData.ring=r;scene.add(beacon)}
const arrow=new THREE.Mesh(new THREE.ConeGeometry(.11,.34,10),new THREE.MeshStandardMaterial({color:0xff6a2a,emissive:0x5a1a00,roughness:.4}));scene.add(arrow);

function buildGates(lv){
  gateVis.forEach(g=>{g.grp.traverse(o=>{if(o.geometry&&o.geometry!==flagGeo)o.geometry.dispose()});levelGroup.remove(g.grp)});gateVis=[];
  lv.gates.forEach((gt,i)=>{const grp=new THREE.Group(),mats=[];
    for(const end of[gt.a,gt.b]){const y=H(end.x,end.z);const pole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,1.1,8),gateMat.pole);pole.position.set(end.x,y+.5,end.z);pole.castShadow=true;grp.add(pole);
      const cap=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),gateMat.cap);cap.position.set(end.x,y+1.06,end.z);grp.add(cap);
      const fm=new THREE.MeshStandardMaterial({color:LIN(FLAG.pending),side:THREE.DoubleSide,roughness:.6});mats.push(fm);
      const fl=new THREE.Mesh(flagGeo,fm);fl.position.set(end.x,y+1.02,end.z);fl.rotation.y=Math.atan2(gt.tan.x,gt.tan.z)+Math.PI/2*(end===gt.a?1:-1);fl.castShadow=true;grp.add(fl)}
    if(gt.finish){const ya=H(gt.a.x,gt.a.z),yb=H(gt.b.x,gt.b.z),ban=new THREE.Mesh(new THREE.PlaneGeometry(2.5,.42),finishBanner());ban.position.set(gt.c.x,Math.max(ya,yb)+.86,gt.c.z);ban.rotation.y=Math.atan2(gt.tan.x,gt.tan.z);grp.add(ban)}
    else{const sp=numSprite(String(i+1),'#E5A92B');sp.position.set(gt.a.x,H(gt.a.x,gt.a.z)+1.32,gt.a.z);grp.add(sp)}
    levelGroup.add(grp);gateVis.push({grp,mats,state:'pending',touched:false})});
}
function setGateState(i,s){const g=gateVis[i];if(!g)return;g.state=s;g.mats.forEach(m=>m.color.set(FLAG[s]).convertSRGBToLinear())}

/* ---------- particles (dust) ---------- */
const dustTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');const g=x.createRadialGradient(32,32,2,32,32,30);g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)})();
const dust=[];for(let i=0;i<70;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:dustTex,transparent:true,depthWrite:false,opacity:0}));s.visible=false;scene.add(s);dust.push({s,life:0,v:new V3()})}
let dustI=0;
const DUST_COL={0:'#d8ccb2',2:'#7a5c3e',5:'#4b3b2a',13:'#2e2218',10:'#9c9384',3:'#6b7a45',4:'#a07a55',14:'#4a4440',15:'#ff7a20',19:'#8a8a86',98:'#7a5a3a',99:'#e6f3f7'};
function spawnDust(p,surf,big){const c=DUST_COL[surf];if(!c)return;const d=dust[dustI++%dust.length];d.s.material.color.set(c).convertSRGBToLinear();d.s.position.copy(p);d.s.position.y+=.05;d.life=1;d.big=big||0;
  const up=big?.7+Math.random()*.9:.25+Math.random()*.3,sp=big?.9:.4;d.v.set((Math.random()-.5)*sp,up,(Math.random()-.5)*sp);d.s.visible=true}
function updateDust(dt){for(const d of dust){if(d.life<=0)continue;d.life-=dt*(d.big?1.6:1.3);if(d.big)d.v.y-=3.2*dt;d.s.position.addScaledVector(d.v,dt);const k=1-d.life;d.s.scale.setScalar(d.big?.1+k*.35:.15+k*.6);d.s.material.opacity=Math.max(0,d.life)*(d.big?.7:.45);if(d.life<=0)d.s.visible=false}}

/* ---------- effects: lava, hanging bridges, waterfall, volcano (the data comes from the level's c.fx list) ---------- */
function lavaTexture(){const s=128,c=document.createElement('canvas');c.width=c.height=s;const x=c.getContext('2d'),img=x.createImageData(s,s),r=mulberry32(5),Gd=[];
  for(let o=0;o<3;o++){const n=4<<o,g=new Float32Array(n*n);for(let i=0;i<g.length;i++)g[i]=r();Gd.push({n,g})}
  const val=(o,gx,gz)=>{const{n,g}=Gd[o];return g[((gz%n+n)%n)*n+((gx%n+n)%n)]};
  const f=(u,v)=>{let h=0,a=1,t=0;for(let o=0;o<3;o++){const n=Gd[o].n,fx=u*n,fz=v*n,xi=Math.floor(fx),zi=Math.floor(fz),tx=fx-xi,tz=fz-zi,sx=tx*tx*(3-2*tx),sz=tz*tz*(3-2*tz);
    const A=val(o,xi,zi),B=val(o,xi+1,zi),C=val(o,xi,zi+1),D=val(o,xi+1,zi+1);h+=((A+(B-A)*sx)*(1-sz)+(C+(D-C)*sx)*sz)*a;t+=a;a*=.55}return h/t};
  for(let j=0;j<s;j++)for(let i=0;i<s;i++){const cr=Math.abs(f(i/s,j/s)-.5)*2,heat=Math.pow(1-Math.min(1,cr*4.2),1.6),k=(j*s+i)*4;
    // dark crust with glowing cracks: crust -> red -> orange -> yellow
    const r1=34+heat*221,g1=10+heat*heat*210+heat*40,b1=6+heat*heat*heat*110;img.data[k]=Math.min(255,r1);img.data[k+1]=Math.min(255,g1);img.data[k+2]=Math.min(255,b1);img.data[k+3]=255}
  x.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;return t}
function fallTexture(){const w=64,h=256,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),r=mulberry32(21);
  for(let i=0;i<70;i++){const px=r()*w,len=40+r()*160,py=r()*h,a=.25+r()*.6;x.fillStyle=`rgba(255,255,255,${a})`;x.fillRect(px,py,1+r()*2.5,len);if(py+len>h)x.fillRect(px,py-h,1.5,len)}
  x.fillStyle='rgba(255,255,255,.18)';x.fillRect(0,0,w,h);
  // soft edges, so the sheet of water does not end in a straight line
  const img=x.getImageData(0,0,w,h);for(let j=0;j<h;j++)for(let i=0;i<w;i++){const e=Math.min(i,w-1-i)/w*2,f=Math.min(1,e/.28);img.data[(j*w+i)*4+3]*=f*f}x.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(c);t.wrapS=THREE.ClampToEdgeWrapping;t.wrapT=THREE.RepeatWrapping;t.repeat.set(1,2);return t}
const _lq=new Q4(),_ls=new V3(),_lm=new THREE.Matrix4();
const lavaTex=lavaTexture(),lavaMat=new THREE.MeshBasicMaterial({map:lavaTex,side:THREE.DoubleSide});
const fallTex=fallTexture(),fallTex2=fallTexture(),fallTex3=fallTexture();fallTex2.repeat.set(1,1.5);fallTex3.repeat.set(1,1);
const fallMat=new THREE.MeshBasicMaterial({map:fallTex,color:0xd8eef8,transparent:true,opacity:.6,depthWrite:false,side:THREE.DoubleSide});
const fallMat2=new THREE.MeshBasicMaterial({map:fallTex2,color:0xffffff,transparent:true,opacity:.42,depthWrite:false,side:THREE.DoubleSide});
const fallMat3=new THREE.MeshBasicMaterial({map:fallTex3,color:0xffffff,transparent:true,opacity:.75,depthWrite:false,side:THREE.DoubleSide});
const rippleMat=new THREE.MeshBasicMaterial({color:0xeaf6ff,transparent:true,opacity:.4,depthWrite:false,side:THREE.DoubleSide});
const mistMat=new THREE.SpriteMaterial({map:dustTex,color:0xffffff,transparent:true,depthWrite:false,opacity:.16});
// flowing rivers (fx 'river'): faint streaks of foam and light that drift downstream on top of the water, in two layers at different speeds
function riverTexture(seed,n){const w=128,h=256,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),r=mulberry32(seed);
  for(let i=0;i<n;i++){const px=8+r()*(w-16),py=r()*h,len=10+r()*50,a=.12+r()*.35,wd=.8+r()*1.6;x.fillStyle=`rgba(255,255,255,${a})`;x.fillRect(px,py,wd,len);if(py+len>h)x.fillRect(px,py-h,wd,len)}
  for(let i=0;i<n/3;i++){const px=8+r()*(w-16),py=r()*h,rr=1+r()*2.5;x.fillStyle=`rgba(255,255,255,${.15+r()*.3})`;x.beginPath();x.ellipse(px,py,rr,rr*2.2,0,0,6.283);x.fill()}
  const img=x.getImageData(0,0,w,h);for(let j=0;j<h;j++)for(let i=0;i<w;i++){const e=Math.min(i,w-1-i)/w*2,f=Math.min(1,e/.35);img.data[(j*w+i)*4+3]*=f*f}x.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(c);t.wrapS=THREE.ClampToEdgeWrapping;t.wrapT=THREE.RepeatWrapping;return t}
const riverTex=riverTexture(31,90),riverTex2=riverTexture(57,50);
const riverMat=new THREE.MeshBasicMaterial({map:riverTex,color:0xd8e2cc,transparent:true,opacity:.2,depthWrite:false});
const riverMat2=new THREE.MeshBasicMaterial({map:riverTex2,color:0xffffff,transparent:true,opacity:.13,depthWrite:false});
const leafGeo=new THREE.PlaneGeometry(1,1);leafGeo.rotateX(-Math.PI/2);
const leafMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.7,side:THREE.DoubleSide});
// sunbeams through the canopy (fx 'beam'): three crossed planes with a soft vertical glow, tilted along the sun, fading when you come close
const beamTex=(()=>{const c=document.createElement('canvas');c.width=64;c.height=256;const x=c.getContext('2d'),img=x.createImageData(64,256);
  for(let j=0;j<256;j++)for(let i=0;i<64;i++){const u=(i/63-.5)*2,v=j/255,a=Math.pow(Math.max(0,1-u*u),1.6)*Math.pow(1-v,.7)*smt01(v/.08)*(.75+.25*Math.sin(i*.9+j*.03));const k=(j*64+i)*4;img.data[k]=img.data[k+1]=img.data[k+2]=255;img.data[k+3]=a*255}
  x.putImageData(img,0,0);return new THREE.CanvasTexture(c)})();
const beamMat=new THREE.MeshBasicMaterial({map:beamTex,color:LIN('#fff0c0'),transparent:true,opacity:.07,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false});
const plankMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9,flatShading:true}),postMat=new THREE.MeshStandardMaterial({color:0x5a3a22,roughness:1});
const boxGeo=new THREE.BoxGeometry(1,1,1),cylGeo=new THREE.CylinderGeometry(1,1,1,5),SHARED_GEO=new Set([boxGeo,cylGeo,...(typeof ANIMAL_GEO!=='undefined'?Object.values(ANIMAL_GEO):[])]);
const lavaLight=new THREE.PointLight(0xff6a1a,0,11,2);scene.add(lavaLight);
// embers rising from the lava near the car
const embers=[];for(let i=0;i<48;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:LIN('#ffb060'),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));sp.visible=false;scene.add(sp);embers.push({s:sp,v:new V3(),life:0})}
function updateEmbers(dt){if(!LV||!LV.hasLava)return;const pts=fxAnim.lavaPts;if(pts.length&&state.gfx==='hi'&&Math.random()<dt*22){const p=pts[Math.floor(Math.random()*pts.length)];const d2=(p.x-car.pos.x)**2+(p.z-car.pos.z)**2;
    if(d2<16*16){const e=embers.find(e=>e.life<=0);if(e){e.life=1.2+Math.random()*.8;e.s.visible=true;e.s.position.set(p.x+(Math.random()-.5)*p.hw*2,p.y+.05,p.z+(Math.random()-.5)*p.hw*2);e.v.set((Math.random()-.5)*.4,.7+Math.random()*.9,(Math.random()-.5)*.4);e.s.scale.setScalar(.06+Math.random()*.05)}}}
  for(const e of embers){if(e.life<=0)continue;e.life-=dt;e.v.x+=(Math.random()-.5)*dt*2;e.v.z+=(Math.random()-.5)*dt*2;e.s.position.addScaledVector(e.v,dt);e.s.material.opacity=Math.min(1,e.life);if(e.life<=0)e.s.visible=false}}
let fxAnim={falls:[],smoke:[],lavaPts:[],ripples:[],mist:[],drips:[],fallMist:[],rivers:[],beams:[]};
function lavaRibbon(s){const n=s.length,pos=new Float32Array(n*6),uv=new Float32Array(n*4),idx=[];let L=0;
  for(let i=0;i<n;i++){const p=s[i],a=s[Math.max(0,i-1)],b=s[Math.min(n-1,i+1)];let dx=b.x-a.x,dz=b.z-a.z;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;const px=-dz,pz=dx,w=p.hw+.3;
    if(i)L+=Math.hypot(p.x-s[i-1].x,p.z-s[i-1].z);
    pos.set([p.x+px*w,p.y+.02,p.z+pz*w,p.x-px*w,p.y+.02,p.z-pz*w],i*6);uv.set([0,L/3,1,L/3],i*4);
    if(i<n-1){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2)}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(idx);return g}
function segMesh(segs){const im=new THREE.InstancedMesh(cylGeo,plankMat,segs.length),m4=new THREE.Matrix4(),q=new Q4(),p=new V3(),sc=new V3(),d=new V3(),cc=new THREE.Color();
  segs.forEach((g,i)=>{d.copy(g.b).sub(g.a);const L=d.length();p.copy(g.a).add(g.b).multiplyScalar(.5);q.setFromUnitVectors(YAX,d.normalize());sc.set(g.r,L,g.r);m4.compose(p,q,sc);im.setMatrixAt(i,m4);cc.set(g.c).convertSRGBToLinear();im.setColorAt(i,cc)});
  im.castShadow=true;levelGroup.add(im);return im}
function buildBridge(dk){
  const n=Math.max(4,Math.ceil(dk.len/.2)),yAt=t=>dk.y0+(dk.y1-dk.y0)*t-dk.sag*4*t*(1-t),yaw=Math.atan2(dk.ux,dk.uz),lx=-dk.uz,lz=dk.ux;
  const planks=new THREE.InstancedMesh(boxGeo,plankMat,n),m4=new THREE.Matrix4(),q=new Q4(),e=new THREE.Euler(),p=new V3(),sc=new V3(),cc=new THREE.Color();
  for(let k=0;k<n;k++){const t=(k+.5)/n,dyds=((dk.y1-dk.y0)-dk.sag*4*(1-2*t))/dk.len;
    p.set(dk.ax+dk.ux*dk.len*t,yAt(t)-.035,dk.az+dk.uz*dk.len*t);e.set(-Math.atan(dyds)+((k*7919)%13/13-.5)*.07,yaw,((k*104729)%11/11-.5)*.06,'YXZ');q.setFromEuler(e);sc.set(dk.hw*2*1.04,.07,dk.len/n*.86);m4.compose(p,q,sc);planks.setMatrixAt(k,m4);
    cc.set(['#7b4e2c','#8c5c33','#6b4325','#9a6a3e'][k%4]);cc.convertSRGBToLinear();planks.setColorAt(k,cc)}
  planks.castShadow=true;planks.receiveShadow=true;levelGroup.add(planks);
  if(dk.ferry){ferryDeckMesh=planks;return}   // the ferry's own deck: no railings, and it sails with the hull (see buildFerry)
  const pt=(t,lat,h)=>new V3(dk.ax+dk.ux*dk.len*t+lx*lat,yAt(t)+h,dk.az+dk.uz*dk.len*t+lz*lat),segs=[],ns=Math.max(6,Math.round(dk.len/.45));
  for(const sd of[-1,1]){const lat=sd*(dk.hw-.02);
    for(let i=0;i<ns;i++){const t0=i/ns,t1=(i+1)/ns;
      segs.push({a:pt(t0,lat,.07),b:pt(t1,lat,.07),r:.075,c:'#6e4a2a'});               // kantstokk (samme høyde som kanten du kjører mot)
      segs.push({a:pt(t0,lat*1.04,.46),b:pt(t1,lat*1.04,.46),r:.022,c:'#d8c597'});     // håndtau
      segs.push({a:pt(t0,lat*1.04,.22),b:pt(t1,lat*1.04,.22),r:.016,c:'#d8c597'})}     // nedre tau
    for(let i=0;i<=ns;i++){const t=i/ns;segs.push({a:pt(t,lat*1.04,.07),b:pt(t,lat*1.04,.46),r:.014,c:'#d8c597'})}}
  for(const t of[0,1])for(const sd of[-1,1]){segs.push({a:pt(t,sd*(dk.hw+.06),-.15),b:pt(t,sd*(dk.hw+.06),.98),r:.06,c:'#5a3a22'});segs.push({a:pt(t,sd*(dk.hw+.06),-.1),b:pt(t,sd*(dk.hw+.06),.42),r:.07,c:'#4a6a2a'})}
  segMesh(segs)}
function buildFall(f){const h=f.top-f.bot,ca=Math.cos(f.ang),sa=Math.sin(f.ang);
  // three sheets of water: a wide back curtain, a narrower faster middle sheet and white foam at the bottom
  const L=[[fallMat,0,f.w,h,(f.top+f.bot)/2],[fallMat2,.14,f.w*.8,h*.9,(f.top+f.bot)/2-h*.04],[fallMat3,.26,f.w*.95,h*.36,f.bot+h*.18]];
  for(const[mat,off,w,hh,y]of L){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,hh),mat);m.position.set(f.x+sa*off,y,f.z+ca*off);m.rotation.y=f.ang;m.renderOrder=3;levelGroup.add(m)}
  // a lip of foam at the top edge
  {const m=new THREE.Mesh(new THREE.PlaneGeometry(f.w*1.05,.22),fallMat3);m.position.set(f.x-sa*.1,f.top+.02,f.z-ca*.1);m.rotation.set(-Math.PI/2,0,f.ang);m.renderOrder=3;levelGroup.add(m)}
  // rings spreading on the pool where the water lands
  for(let i=0;i<5;i++){const r=new THREE.Mesh(new THREE.RingGeometry(.86,1,40),rippleMat.clone());r.rotation.x=-Math.PI/2;r.position.set(f.x+sa*.4,f.bot+.015,f.z+ca*.4);r.renderOrder=3;levelGroup.add(r);fxAnim.ripples.push({m:r,t:i/5})}
  // a cloud of mist at the foot
  for(let i=0;i<12;i++){const sp=new THREE.Sprite(mistMat.clone());sp.material.opacity=.22;const u=(i/12-.5)*f.w*1.1;sp.position.set(f.x+ca*u,f.bot+.3,f.z-sa*u);levelGroup.add(sp);fxAnim.fallMist.push({s:sp,t:Math.random(),x:f.x+ca*u,z:f.z-sa*u,y:f.bot})}
  fxAnim.falls.push({x:f.x,z:f.z,y:f.bot,w:f.w,ang:f.ang,top:f.top,spray:!!f.spray,ca:Math.cos(f.ang),sa:Math.sin(f.ang)})}
function buildRiver(f){const P=[];for(let i=0;i<f.pts.length-1;i++){const a=f.pts[i],c=f.pts[i+1],L=Math.hypot(c[0]-a[0],c[1]-a[1]),m=Math.max(1,Math.ceil(L/.6));for(let k=0;k<m;k++)P.push({x:a[0]+(c[0]-a[0])*k/m,z:a[1]+(c[1]-a[1])*k/m})}
  const e=f.pts[f.pts.length-1];P.push({x:e[0],z:e[1]});
  const n=P.length,pos=new Float32Array(n*6),uv=new Float32Array(n*4),idx=[],cum=[0];let L=0;
  for(let i=0;i<n;i++){const p=P[i],a=P[Math.max(0,i-1)],b=P[Math.min(n-1,i+1)];let dx=b.x-a.x,dz=b.z-a.z;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;const px=-dz,pz=dx,w=f.hw+.5;
    if(i){L+=Math.hypot(p.x-P[i-1].x,p.z-P[i-1].z);cum.push(L)}p.tx=dx;p.tz=dz;
    pos.set([p.x+px*w,f.y+.012,p.z+pz*w,p.x-px*w,f.y+.012,p.z-pz*w],i*6);uv.set([0,-L/5,1,-L/5],i*4);
    if(i<n-1){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2)}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(idx);
  for(const[mat,o]of[[riverMat,0],[riverMat2,.004]]){const m=new THREE.Mesh(o?g.clone():g,mat);m.position.y=o;m.renderOrder=3;levelGroup.add(m)}
  // leaves, twigs and flowers drifting downstream
  const nl=Math.min(80,Math.round(L/1.6)),im=new THREE.InstancedMesh(leafGeo,leafMat,nl),cc=new THREE.Color(),R=mulberry32(nl*7+n),fl=[];
  for(let i=0;i<nl;i++){const kind=R();cc.set(kind<.55?['#5a7a2a','#7a8a34','#4a6a22'][i%3]:kind<.85?['#8a6a2a','#a07a3a','#6a4a22'][i%3]:'#e0a03a').convertSRGBToLinear();im.setColorAt(i,cc);
    fl.push({s:R()*L,lat:(R()-.5)*1.4*f.hw,sp:f.speed*(.7+R()*.5),rot:R()*6.28,spin:(R()-.5)*.8,sx:kind<.85?.07+R()*.05:.035,sz:kind<.85?.12+R()*.08:.3,i:0})}
  im.frustumCulled=false;im.receiveShadow=true;levelGroup.add(im);fxAnim.rivers.push({P,cum,L,y:f.y,hw:f.hw,im,fl})}
function buildBeam(f){const def=LEVELS[state.levelIdx],d=new V3(...(def.sunDir||[0,1,0])).normalize(),g=new THREE.Group();
  for(let k=0;k<3;k++){const m=new THREE.Mesh(new THREE.PlaneGeometry(f.w,f.h),beamMat.clone());m.rotation.y=k*Math.PI/3;m.renderOrder=4;g.add(m)}
  g.quaternion.setFromUnitVectors(YAX,d);g.position.set(f.x+d.x*f.h/2,f.y+d.y*f.h/2,f.z+d.z*f.h/2);levelGroup.add(g);fxAnim.beams.push({g,x:g.position.x,y:g.position.y,z:g.position.z,ph:Math.random()*6.28})}
function buildMist(f){const sp=new THREE.Sprite(mistMat.clone());sp.material.opacity=.12+Math.random()*.08;sp.position.set(f.x,f.y,f.z);sp.scale.set(f.s*1.6,f.s*.55,1);levelGroup.add(sp);fxAnim.mist.push({s:sp,x:f.x,z:f.z,ph:Math.random()*6.28})}
function buildSmoke(f){const L=[],small=f.small||0,n=small?10:26;
  for(let i=0;i<n;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:dustTex,color:LIN(small?'#8d8880':'#4a4039'),transparent:true,depthWrite:false,opacity:0}));sp.position.set(f.x,f.y,f.z);levelGroup.add(sp);L.push({s:sp,t:i/n,x:f.x,y:f.y,z:f.z})}
  let gl=null;if(!small){gl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:LIN('#ff7a20'),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.55,fog:false}));gl.scale.set(9,9,1);gl.position.set(f.x,f.y+.6,f.z);levelGroup.add(gl)}
  fxAnim.smoke.push({L,gl,small})}
// f.w: a wider board (default 1.1), the text keeps its size
function buildSign(f){const bw=f.w||1.1,cw=Math.round(256*bw/1.1),c=document.createElement('canvas');c.width=cw;c.height=128;const x=c.getContext('2d');x.fillStyle='#f2c230';x.fillRect(0,0,cw,128);x.strokeStyle='#14120E';x.lineWidth=8;x.strokeRect(4,4,cw-8,120);
  x.fillStyle='#14120E';x.textAlign='center';x.font='700 48px "Barlow Condensed",sans-serif';x.fillText(f.text,cw/2,64);x.font='600 24px "Barlow Condensed",sans-serif';x.fillText(f.sub||'',cw/2,102);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;const y=H(f.x,f.z);
  const post=new THREE.Mesh(boxGeo,postMat);post.scale.set(.06,1.1,.06);post.position.set(f.x,y+.55,f.z);post.castShadow=true;levelGroup.add(post);
  const b=new THREE.Mesh(new THREE.PlaneGeometry(bw,.55),new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide}));b.position.set(f.x,y+1.1,f.z);b.rotation.y=f.ang;levelGroup.add(b)}
// street lamps: one Points cloud of warm glows over all the lamp heads of the level, shown at night (world.js setNight)
let lampGlow=null;
function buildLamps(L){lampGlow=null;if(!L.length)return;const pos=new Float32Array(L.length*3);L.forEach((f,i)=>{pos[i*3]=f.x;pos[i*3+1]=f.y+.08;pos[i*3+2]=f.z});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  lampGlow=new THREE.Points(g,new THREE.PointsMaterial({map:glowTex,color:LIN('#ffd27a'),size:1.5,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,sizeAttenuation:true}));
  lampGlow.frustumCulled=false;lampGlow.visible=false;lampGlow.renderOrder=4;levelGroup.add(lampGlow)}
function buildFx(lv){
  fxAnim={falls:[],smoke:[],lavaPts:[],ripples:[],mist:[],drips:[],fallMist:[],rivers:[],beams:[]};
  buildLamps(lv.fx.filter(f=>f.type==='lamp'));
  for(const f of lv.fx){
    if(f.type==='lava'){const m=new THREE.Mesh(lavaRibbon(f.s),lavaMat);m.renderOrder=1;levelGroup.add(m);fxAnim.lavaPts.push(...f.s)}
    else if(f.type==='lavadisc'){const m=new THREE.Mesh(new THREE.CircleGeometry(f.r+.3,40),lavaMat);m.rotation.x=-Math.PI/2;m.position.set(f.x,f.y+.02,f.z);m.renderOrder=1;levelGroup.add(m);fxAnim.lavaPts.push({x:f.x,z:f.z,y:f.y,hw:f.r})}
    else if(f.type==='deck')buildBridge(f);else if(f.type==='fall')buildFall(f);else if(f.type==='smoke')buildSmoke(f);else if(f.type==='sign')buildSign(f);else if(f.type==='mist')buildMist(f);else if(f.type==='drip')fxAnim.drips.push(f);else if(f.type==='river')buildRiver(f);else if(f.type==='beam')buildBeam(f)}
  lavaLight.intensity=0}
// volcano: now and then the ground rumbles and lava bombs shoot up from the vents. Only for show: nothing hurts the car.
const ERU={phase:0,tp:0,next:1e9,amp:0,acc:0},bombs=[];
for(let i=0;i<36;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:LIN('#ff8a2a'),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));sp.visible=false;scene.add(sp);bombs.push({s:sp,v:new V3(),on:false})}
function resetEruption(def){ERU.phase=0;ERU.amp=0;ERU.acc=0;ERU.next=def.erupt?def.erupt[0]*.7+Math.random()*5:1e9;for(const b of bombs){b.on=false;b.s.visible=false}}
function rumble(dur){if(!AC||!state.sound)return;try{const n=AC.sampleRate*2,buf=AC.createBuffer(1,n,AC.sampleRate),d=buf.getChannelData(0);let l=0;for(let i=0;i<n;i++){l=l*.96+(Math.random()*2-1)*.04;d[i]=l*6}
  const src=AC.createBufferSource();src.buffer=buf;src.loop=true;const fl=AC.createBiquadFilter();fl.type='lowpass';fl.frequency.value=110;const g=AC.createGain(),t=AC.currentTime;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.35,t+1.2);g.gain.setValueAtTime(.35,t+dur-1.2);g.gain.linearRampToValueAtTime(0,t+dur);src.connect(fl);fl.connect(g);g.connect(AC.destination);src.start(t);src.stop(t+dur+.1)}catch(e){}}
function spawnBomb(){const v=LV.vents[Math.floor(Math.random()*LV.vents.length)],b=bombs.find(b=>!b.on);if(!b)return;const a=Math.random()*6.28,hs=1.2+Math.random()*2.2;
  b.on=true;b.s.visible=true;b.s.position.set(v.x+(Math.random()-.5)*.6,v.y+.3,v.z+(Math.random()-.5)*.6);b.v.set(Math.cos(a)*hs,5.5+Math.random()*3.5,Math.sin(a)*hs);b.s.scale.setScalar(.45)}
function updateEruption(dt){
  const E=LEVELS[state.levelIdx].erupt;
  if(E&&state.mode==='play'&&LV.vents.length){
    if(ERU.phase===0){ERU.next-=dt;if(ERU.next<=0){ERU.phase=1;ERU.tp=2.4;toast('⚠ Vulkanen rumler!',true);rumble(6)}}
    else if(ERU.phase===1){ERU.tp-=dt;if(ERU.tp<=0){ERU.phase=2;ERU.tp=2.8;ERU.acc=0}}
    else{ERU.tp-=dt;ERU.acc+=dt*14;while(ERU.acc>=1){ERU.acc-=1;spawnBomb()}if(ERU.tp<=0){ERU.phase=0;ERU.next=E[0]+Math.random()*(E[1]-E[0])}}
  }else if(ERU.phase&&state.mode!=='play')ERU.phase=0;
  const target=ERU.phase===1?.004+.014*(1-ERU.tp/2.4):ERU.phase===2?.012:0;ERU.amp+=(target-ERU.amp)*Math.min(1,dt*6);
  for(const b of bombs){if(!b.on)continue;b.v.y-=9.8*dt;b.s.position.addScaledVector(b.v,dt);b.s.scale.setScalar(Math.max(.15,.45+b.v.y*.015));
    if(b.s.position.y<H(b.s.position.x,b.s.position.z)+.05){b.on=false;b.s.visible=false;for(let i=0;i<2;i++)spawnDust(b.s.position,15,true)}}}
// spray from a waterfall that lands beside the road: water bursts up and across, and when you drive through it, drops run down the screen
const sprayCv=$('spray'),sprayCtx=sprayCv?sprayCv.getContext('2d'):null;let drops=[],sprayClear=true;
function sprayAt(x,z){let k=0;for(const f of fxAnim.falls){if(!f.spray)continue;const dx=x-f.x,dz=z-f.z,along=dx*f.ca-dz*f.sa,across=dx*f.sa+dz*f.ca;
    k=Math.max(k,Math.max(0,1-Math.abs(along)/(f.w/2+1.2))*Math.max(0,1-Math.abs(across)/3.4))}return k}
function spawnSpray(f,dt){const n=Math.floor(dt*(state.gfx==='hi'?55:22)+Math.random());for(let i=0;i<n;i++){const u=(Math.random()-.5)*f.w,sd=Math.random()<.75?-1:1;   // mostly out over the road
    const sp=dust[dustI++%dust.length];sp.s.material.color.set('#eef7fb');sp.s.position.set(f.x+f.ca*u+f.sa*sd*.2,f.y+.1,f.z-f.sa*u+f.ca*sd*.2);sp.life=1;sp.big=1;
    sp.v.set(f.sa*sd*(1.2+Math.random()*2.6)+(Math.random()-.5)*.6,1.6+Math.random()*2.4,f.ca*sd*(1.2+Math.random()*2.6)+(Math.random()-.5)*.6);sp.s.scale.setScalar(.12);sp.s.visible=true}}
function updateSpray(dt,k){if(!sprayCtx)return;const W=innerWidth,Hh=innerHeight;if(sprayCv.width!==W||sprayCv.height!==Hh){sprayCv.width=W;sprayCv.height=Hh}
  if(k>0&&state.mode==='play'&&state.camMode!==1){const n=Math.floor(k*k*dt*45+Math.random()*k);for(let i=0;i<n&&drops.length<90;i++)drops.push({x:Math.random()*W,y:Math.random()*Hh*.9,r:3+Math.random()*12,life:1,vy:8+Math.random()*40,wob:Math.random()*6})}
  if(!drops.length){if(!sprayClear){sprayCtx.clearRect(0,0,W,Hh);sprayClear=true}return}
  sprayCtx.clearRect(0,0,W,Hh);sprayClear=false;const x=sprayCtx;
  for(let i=drops.length-1;i>=0;i--){const d=drops[i];d.life-=dt*(k>0?.1:.7);d.y+=d.vy*dt*(1.4-d.life);d.x+=Math.sin(d.y*.04+d.wob)*.35;if(d.life<=0||d.y>Hh+20){drops.splice(i,1);continue}
    const a=Math.min(1,d.life*2.5);x.beginPath();x.ellipse(d.x,d.y,d.r,d.r*1.35,0,0,6.283);x.fillStyle=`rgba(215,235,250,${.22*a})`;x.fill();x.lineWidth=1.2;x.strokeStyle=`rgba(255,255,255,${.5*a})`;x.stroke();
    x.beginPath();x.ellipse(d.x-d.r*.35,d.y-d.r*.5,d.r*.28,d.r*.38,-.6,0,6.283);x.fillStyle=`rgba(255,255,255,${.75*a})`;x.fill()}}
function updateFx(dt){
  const tm=performance.now()*.001;
  for(const f of fxAnim.falls)if(f.spray&&Math.hypot(f.x-car.pos.x,f.z-car.pos.z)<26)spawnSpray(f,dt);
  updateSpray(dt,sprayAt(car.pos.x,car.pos.z));
  lavaTex.offset.y-=dt*.05;lavaMat.color.setScalar(.88+.12*Math.sin(tm*2.1));fallTex.offset.y-=dt*1.1;
  for(const f of fxAnim.falls){if(Math.random()<dt*16){const l=(Math.random()-.5)*f.w;_c2.set(f.x+Math.cos(f.ang)*l,f.y,f.z-Math.sin(f.ang)*l);spawnDust(_c2,99,true)}}
  for(const sm of fxAnim.smoke){const sc=sm.small||1,rise=sm.small?3.2:9;for(const p of sm.L){p.t+=dt*(sm.small?.12:.07);if(p.t>1)p.t-=1;const k=p.t;p.s.position.set(p.x+k*3.5*sc+Math.sin(k*9+p.x)*.3,p.y+k*rise,p.z+k*1.2*sc);p.s.scale.setScalar((.9+k*5.5)*sc);p.s.material.opacity=Math.sin(Math.PI*k)*(sm.small?.22:.34)}
    if(sm.gl)sm.gl.material.opacity=.5+.12*Math.sin(tm*3)+(ERU.phase===2?.2:0)}
  for(const r of fxAnim.ripples){r.t+=dt/2.6;if(r.t>1)r.t-=1;const k=r.t;r.m.scale.setScalar(.3+k*3.2);r.m.material.opacity=.45*(1-k)*(1-k)}
  for(const m of fxAnim.fallMist){m.t+=dt*.35;if(m.t>1)m.t-=1;const k=m.t;m.s.position.set(m.x+Math.sin(k*6+m.x)*.3,m.y+.2+k*1.6,m.z+Math.cos(k*5+m.z)*.3);m.s.scale.set(1.2+k*2.2,.9+k*1.6,1);m.s.material.opacity=.26*Math.sin(Math.PI*k)}
  for(const m of fxAnim.mist){m.s.position.x=m.x+Math.sin(tm*.08+m.ph)*1.6;m.s.position.z=m.z+Math.cos(tm*.06+m.ph)*1.1}
  for(const d of fxAnim.drips){if(Math.random()<dt*7){_c2.set(d.x0+Math.random()*(d.x1-d.x0),d.y,d.z);const sp=dust[dustI++%dust.length];sp.s.material.color.set('#dff0f6');sp.s.position.copy(_c2);sp.life=.7;sp.big=1;sp.v.set(0,-.5,0);sp.s.scale.setScalar(.05);sp.s.visible=true}}
  // rivers: the streaks drift downstream; leaves follow the current, faster in the middle, and turn slowly
  if(fxAnim.rivers.length){riverTex.offset.y+=dt*.11;riverTex2.offset.y+=dt*.07;
    for(const rv of fxAnim.rivers){const P=rv.P,cum=rv.cum;rv.fl.forEach((l,i)=>{l.s+=dt*l.sp*(1-.5*(l.lat/rv.hw)**2);if(l.s>=rv.L){l.s=0;l.i=0}while(l.i<cum.length-2&&cum[l.i+1]<l.s)l.i++;
      const a=P[l.i],b=P[l.i+1]||a,u=(l.s-cum[l.i])/((cum[l.i+1]-cum[l.i])||1),x=a.x+(b.x-a.x)*u-a.tz*l.lat,z=a.z+(b.z-a.z)*u+a.tx*l.lat;l.rot+=l.spin*dt;
      const vis=WL(x,z)>H(x,z)+.02;_c2.set(x,vis?rv.y+.016+.006*Math.sin(tm*1.7+i):-50,z);_lq.setFromAxisAngle(YAX,l.rot);_ls.set(l.sx,1,l.sz);_lm.compose(_c2,_lq,_ls);rv.im.setMatrixAt(i,_lm)});rv.im.instanceMatrix.needsUpdate=true}}
  for(const b of fxAnim.beams){const d=camera.position.distanceTo(_c2.set(b.x,b.y,b.z)),k=smt01((d-3)/7)*smt01((30-d)/12)*(.8+.2*Math.sin(tm*.6+b.ph));for(const m of b.g.children)m.material.opacity=.07*k;b.g.visible=k>.01}
  updateEmbers(dt);
  // the glow of the nearest lava lights up the car and the ground
  if(LV.hasLava&&state.gfx==='hi'){let bd=1e9,bp=null;for(const p of fxAnim.lavaPts){const d=(p.x-car.pos.x)**2+(p.z-car.pos.z)**2;if(d<bd){bd=d;bp=p}}
    if(bp){lavaLight.position.set(bp.x,bp.y+.9,bp.z);lavaLight.intensity=Math.max(0,1-Math.sqrt(bd)/11)*(3.2+.6*Math.sin(tm*7))}}else lavaLight.intensity=0;
  updateEruption(dt)}

/* ---------- sound ---------- */
let AC=null,osc=null,osc2=null,gain=null,filt=null;
function initAudio(){if(AC)return;try{AC=new(window.AudioContext||window.webkitAudioContext)();osc=AC.createOscillator();osc.type='sawtooth';osc2=AC.createOscillator();osc2.type='square';
  filt=AC.createBiquadFilter();filt.type='lowpass';filt.frequency.value=900;gain=AC.createGain();gain.gain.value=0;const g2=AC.createGain();g2.gain.value=.25;
  osc.connect(filt);osc2.connect(g2);g2.connect(filt);filt.connect(gain);gain.connect(AC.destination);osc.start();osc2.start()}catch(e){AC=null}}
function updateAudio(){if(!AC||!car)return;const on=state.sound&&state.mode==='play';let wv=0,n=0;for(const w of car.wheels){wv+=Math.abs(w.contact&&w.slip<.3?w.vl:car.throttle*(car.low?1.7:5.6));n++}wv/=n;
  wv/=(car.speedScale||1);const f=55+wv*(car.low?240:62);const t=AC.currentTime;osc.frequency.setTargetAtTime(f,t,.05);osc2.frequency.setTargetAtTime(f*.5,t,.05);
  gain.gain.setTargetAtTime(on?(.012+Math.abs(car.throttle)*.05+Math.min(wv,2)*.01)*(state.volCar/70):0,t,.06)}

/* ---------- level & car management ---------- */
let LV=null,car=null;
const focusPos=()=>SKI.on?SKI.s.pos:car.pos;   // what the camera follows: the car, or the skier in Gautefall
// two light sets blended by def.zone(x,z): 0 = def.alt (for example jungle), 1 = def (for example the volcano)
const ZL={on:false,fogA:new THREE.Color(),fogB:new THREE.Color(),sunA:new THREE.Color(),sunB:new THREE.Color(),hA:[new THREE.Color(),new THREE.Color()],hB:[new THREE.Color(),new THREE.Color()],k:-1};
function setupZone(def){ZL.on=!!(def.zone&&def.alt);if(!ZL.on)return;const a=def.alt;ZL.fogA.set(a.fog).convertSRGBToLinear();ZL.fogB.set(def.fog).convertSRGBToLinear();ZL.sunA.set(a.sun).convertSRGBToLinear();ZL.sunB.set(def.sun).convertSRGBToLinear();
  ZL.hA[0].set(a.hemi[0]).convertSRGBToLinear();ZL.hA[1].set(a.hemi[1]).convertSRGBToLinear();ZL.hB[0].set(def.hemi[0]).convertSRGBToLinear();ZL.hB[1].set(def.hemi[1]).convertSRGBToLinear();ZL.a=a;ZL.d=def;ZL.k=-1}
function applyZone(x,z){if(!ZL.on)return;let k=ZL.d.zone(x,z);if(ZL.k<0)ZL.k=k;else ZL.k+=(k-ZL.k)*.05;k=ZL.k;const a=ZL.a,d=ZL.d;
  scene.fog.color.copy(ZL.fogA).lerp(ZL.fogB,k);scene.fog.near=a.fogNear+(d.fogNear-a.fogNear)*k;scene.fog.far=a.fogFar+(d.fogFar-a.fogFar)*k;
  sun.color.copy(ZL.sunA).lerp(ZL.sunB,k);sun.intensity=(a.sunI+(d.sunI-a.sunI)*k)*1.55;
  hemi.color.copy(ZL.hA[0]).lerp(ZL.hB[0],k);hemi.groundColor.copy(ZL.hA[1]).lerp(ZL.hB[1],k);const dk=d.dark?d.dark(x,z):0;hemi.intensity=(a.hemi[2]+(d.hemi[2]-a.hemi[2])*k)*1.15*(1-.7*dk);sun.intensity*=(1-.5*dk);if(dk>0){scene.fog.color.multiplyScalar(1-.55*dk)}
  mistMat.color.copy(scene.fog.color);mistMat.color.r=Math.min(1,mistMat.color.r*1.25);mistMat.color.g=Math.min(1,mistMat.color.g*1.25);mistMat.color.b=Math.min(1,mistMat.color.b*1.25);for(const m of fxAnim.mist)m.s.material.color.copy(mistMat.color)}
function loadLevel(i){
  state.levelIdx=i;const def=LEVELS[i];store.set('level',def.id);
  // free what the old level created; shared geometry and materials stay
  const keepGeo=new Set([...Object.values(DG),...SHARED_GEO,flagGeo,crateGeo,crateBand,leafGeo]),keepMat=new Set([...Object.values(M),...Object.values(DM),gateMat.pole,gateMat.cap,waterMat,riverMat,riverMat2,leafMat]);
  levelGroup.traverse(o=>{if((o.isInstancedMesh||o.isMesh||o.isPoints)&&o.geometry&&!keepGeo.has(o.geometry))o.geometry.dispose();
    if(o.material&&!keepMat.has(o.material)){if(o.material.map)o.material.map.dispose();o.material.dispose()}});
  scene.remove(levelGroup);levelGroup=new THREE.Group();scene.add(levelGroup);gateVis=[];
  LV=genLevel(def);if(terrainN!==N)buildTerrainGeo();
  state.world=isIsland(def)&&!!state.roam;state.course=null;state.free=false;LV.mainGates=LV.gates;LV.mainCrates=LV.crates;
  for(let k=0;k<N*N;k++){const i2=k%N,j=(k/N)|0;tPos[k*3]=-HALF+i2*CELL;tPos[k*3+1]=TH[k];tPos[k*3+2]=-HALF+j*CELL;tCol[k*3]=TC[k*3];tCol[k*3+1]=TC[k*3+1];tCol[k*3+2]=TC[k*3+2]}
  shadeTerrain();syncTerrain();
  levelGroup.add(LV.decor);
  water.visible=def.water!=null;if(water.visible)water.position.y=def.water;waterMat.color.set(def.waterCol||'#3f5c4d').convertSRGBToLinear();waterMat.opacity=def.waterOpacity??.7;waterMat.envMapIntensity=mudMat.envMapIntensity=def.waterEnv??1.2;
  buildPools(LV);buildCrates(LV);rain.visible=!!(def.rain||def.ash||def.snow);ashMode=!!def.ash;snowMode=!!def.snow;rain.material.color.set(ashMode?'#ffb070':snowMode?'#ffffff':'#dfe8ee');rain.material.size=ashMode?.06:snowMode?.075:.045;rain.material.opacity=.55;precipK=1;
  if(skyDome.material.map)skyDome.material.map.dispose();if(scene.environment)scene.environment.dispose();
  const sky=skyTex(def);skyDome.material.map=sky;skyDome.material.needsUpdate=true;
  scene.environment=pmrem.fromEquirectangular(sky).texture;
  scene.fog=new THREE.Fog(LIN(def.fog),def.fogNear,def.fogFar);
  hemi.color.set(def.hemi[0]).convertSRGBToLinear();hemi.groundColor.set(def.hemi[1]).convertSRGBToLinear();hemi.intensity=def.hemi[2]*1.15;
  sun.color.set(def.sun).convertSRGBToLinear();sun.intensity=def.sunI*1.55;
  sunGlow.material.color.set(def.sun).convertSRGBToLinear();sunGlow.visible=def.clouds!==false;
  clearTracks();buildGates(LV);LV.hasLava=G.lavas.length>0;buildFx(LV);resetEruption(def);lavaLight.visible=LV.hasLava&&state.gfx==='hi';setupZone(def);buildAnimals(LV,def);buildBoulder(def);buildPortals(LV);buildFerry(LV);buildSki(LV);buildMarina(LV);buildAirport(LV);buildCaveMouth(LV);buildSecrets(LV);if(isIsland(def))buildMapBase(def);else MAP.base=null;$('bMap').hidden=!state.world;if(car)applyZone(car.pos.x,car.pos.z);
  if(car)resetToStart();
  $('hLevel').textContent=def.name;
}
function setCar(i){state.carIdx=i;store.set('car',CARS[i].id);const old=car,tune=tuneFrom(prof.parts);car=makeCar(CARS[i],tune);car.rope=null;car.assist=state.assist;car.speedScale=state.speed/100;if(old){car.low=old.low}
  applyPaint();buildCarVis(Object.assign({},CARS[i],{tune}));if(LV)resetToStart()}
function applyPaint(){const p=PAINTS[prof.paint]||PAINTS[0],own=!prof.paint&&CARS[state.carIdx].col;M.yel.color.set(own||p.c).convertSRGBToLinear();M.rim.color.set(prof.parts.weight>=2?'#b08a3a':'#e3a62a').convertSRGBToLinear();M.rim.metalness=prof.parts.weight>=2?.6:.2}
function resetToStart(){const s=LV.start;placeCar(car,s.p.x,s.p.z,Math.atan2(s.tan.x,s.tan.z));state.checkpoint={x:s.p.x,z:s.p.z,h:Math.atan2(s.tan.x,s.tan.z)};camSnap=true}

/* ---------- game flow ---------- */
function resetRunState(){Object.assign(state,{time:0,started:false,penalty:0,next:0,flipT:0,missed:0,touched:0,winches:0,winchPen:0,rescues:0,log:[],crates:0,jumps:0,longJumps:0,bestAir:0,air:0,flood:0,drowned:0,deepWarn:false,lavaFalls:0,bonusNuts:0,bonusDone:{}})}
function showHud(){$('menu').hidden=true;$('garage').hidden=true;$('result').hidden=true;$('pause').hidden=true;$('hud').hidden=false;$('hint').hidden=true;$('ask').hidden=true;setOffer(null);$('hud').classList.toggle('free',!!state.free)}
function startRun(){
  initAudio();if(AC&&AC.state==='suspended')AC.resume();
  if(state.world){if(state.course){const k=state.course;endCourse(true);placeCar(car,k.start.p.x,k.start.p.z,Math.atan2(k.start.tan.x,k.start.tan.z));camSnap=true;startCourse(k);return}return startFree()}
  $('garage').hidden=true;
  state.mode='play';state.free=false;resetRunState();LV.gates=LV.mainGates;LV.crates=LV.mainCrates;buildGates(LV);buildCrates(LV);
  gateVis.forEach((g,i)=>{g.touched=false;setGateState(i,i===0?'next':'pending')});
  resetCrates();resetToStart();car.low=true;clearTracks();resetBoulder();
  showHud();updateGearUI();toast('Kjør til port 1');
}
function toMenu(){if(state.course)endCourse();state.free=false;state.mode='menu';$('hud').hidden=true;$('pause').hidden=true;$('result').hidden=true;$('garage').hidden=true;$('menu').hidden=false;renderMenu();resetToStart()}
function toGarage(){if(state.course)endCourse();clearCoat();state.mode='garage';$('hud').hidden=true;$('pause').hidden=true;$('result').hidden=true;$('menu').hidden=true;$('garage').hidden=false;resetToStart();renderGarage();$('gDrive').focus()}
function renderGarage(){
  $('gCar').textContent=CARS[state.carIdx].name;$('gNuts').textContent=fmtN(prof.nuts);
  const forSale=CARS.filter(c=>c.price&&!ownsCar(c));$('carSale').innerHTML=forSale.length?'<h2>Biler til salgs</h2>'+forSale.map(c=>{const can=prof.nuts>=c.price;return`<div class="part"><span class="nm">${c.name}</span><span class="lvn">${c.kind}</span><p class="ds">${c.desc}</p><button class="buy ${can?'can':''}" data-buycar="${c.id}" ${can?'':'disabled'}>Kjøp<b>⚙ ${c.price}</b>${can?'':'<span>mangler '+(c.price-prof.nuts)+'</span>'}</button></div>`}).join(''):'';
  $('partList').innerHTML=PARTS.map(p=>{const lv=prof.parts[p.id]||0,max=lv>=3,price=max?0:p.price[lv+1],can=!max&&prof.nuts>=price;
    return`<div class="part"><span class="nm">${p.name} ${pips(lv,3)}</span><span class="lvn">${p.lv[lv]}</span><p class="ds">${p.desc}</p>
      <button class="buy ${can?'can':''} ${max?'max':''}" data-buy="${p.id}" ${can?'':'disabled'}>${max?'Fullt oppgradert':`Neste: ${p.lv[lv+1]}<b>⚙ ${price}</b>${can?'':'<span>mangler '+(price-prof.nuts)+'</span>'}`}</button></div>`}).join('');
  $('paintList').innerHTML=PAINTS.map((p,i)=>{const own=prof.paints.includes(i);if(p.locked&&!own)return`<button class="sw lk" data-paint="${i}" style="background:${p.c}" aria-label="${p.n}, låst" disabled>🔒</button>`;return`<button class="sw" data-paint="${i}" style="background:${p.c}" aria-pressed="${i===prof.paint}" aria-label="${p.n}${own?'':', koster '+p.p}">${own?'':'⚙'+p.p}</button>`}).join('');
  const cp=PAINTS[prof.paint]||PAINTS[0];$('paintName').textContent=cp.n+(PAINTS.some(p=>p.locked&&!prof.paints.includes(PAINTS.indexOf(p)))?' · Gull-lakken låses opp når alle '+totalSecrets()+' gullmutterne er funnet ('+foundSecrets()+' funnet).':'');
}
function buyPart(id){const p=PARTS.find(x=>x.id===id),lv=prof.parts[id]||0;if(lv>=3)return;const price=p.price[lv+1];if(prof.nuts<price)return;
  prof.nuts-=price;prof.parts[id]=lv+1;saveProf();setCar(state.carIdx);renderGarage();const b=document.querySelector(`[data-buy="${id}"]`);if(b)b.classList.add('flash')}
function pickPaint(i){const p=PAINTS[i];if(p.locked&&!prof.paints.includes(i))return;if(!prof.paints.includes(i)){if(prof.nuts<p.p)return;prof.nuts-=p.p;prof.paints.push(i)}prof.paint=i;saveProf();applyPaint();renderGarage()}
$('partList').addEventListener('click',e=>{const b=e.target.closest('[data-buy]');if(b)buyPart(b.dataset.buy)});
$('carSale').addEventListener('click',e=>{const b=e.target.closest('[data-buycar]');if(!b)return;const c=CARS.find(x=>x.id===b.dataset.buycar);if(!c||prof.nuts<c.price)return;prof.nuts-=c.price;prof.cars.push(c.id);saveProf();setCar(CARS.indexOf(c));renderGarage();toast('Gratulerer med '+c.name+'!')});
$('paintList').addEventListener('click',e=>{const b=e.target.closest('[data-paint]');if(b)pickPaint(+b.dataset.paint)});
$('mGarage').onclick=toGarage;$('rGarage').onclick=toGarage;$('gBack').onclick=toMenu;$('gDrive').onclick=startRun;
function pause(on){if(state.mode==='cave'){if(on)caveKeyDown('escape');return}if(state.mode==='ski'){if(on)skiKeyDown('escape');return}if(state.mode==='boat'){if(on)boatKeyDown('escape');return}if(state.mode==='fly'){if(on)flyKeyDown('escape');return}if(state.mode!=='play'&&state.mode!=='pause')return;state.mode=on?'pause':'play';$('pause').hidden=!on;$('pAbort').hidden=!state.course;$('pMap').hidden=!state.world;$('pRestart').textContent=state.course?'Start løpet på nytt':state.world?'Tilbake til basen':'Start på nytt';if(on)$('pResume').focus();if(on&&typeof netPauseUI==='function')netPauseUI()}
function addPenalty(n,why){state.penalty+=n;state.log.push(why);toast('+'+n+' '+why.split(':')[0],true)}
// auto: the flip assist in easy mode puts the car back for free; everything else costs a winch penalty
function winch(auto){
  if(state.mode!=='play')return;const cp=state.checkpoint;placeCar(car,cp.x,cp.z,cp.h);
  if(auto&&car.assist){state.rescues++;toast('Veltehjelp: bilen er tilbake på hjulene')}
  else{const cost=car.tune.winch;addPenalty(cost,'Vinsj');state.winches++;state.winchPen+=cost}
  state.flipT=0;state.flood=0;state.deepWarn=false;state.air=0;$('hint').hidden=true;camSnap=true;
}
function finishRun(){
  state.mode='done';const lvl=LEVELS[state.levelIdx],def=state.course?Object.assign({},state.course,{gates:state.course.gates.length}):lvl,key=state.course?courseKey(lvl,state.course):lvl.id,t=Math.max(0,state.time-state.crates*2),p=state.penalty;const stars=p===0?3:p<=6?2:1;
  const prev=best[key];let isBest=false;if(!prev||p<prev.p||(p===prev.p&&t<prev.t)){best[key]={p,t,s:stars};store.set('best',best);isBest=true}
  $('rLevel').textContent=state.course&&!state.course.main?lvl.name+' · '+def.name:def.name;$('rTitle').textContent=p===0?'Feilfri tur!':'I mål!';$('rTime').textContent=fmtTime(t);$('rPen').textContent=p;
  $('rGates').textContent=(LV.gates.length-state.missed)+'/'+LV.gates.length;
  $('rStars').innerHTML=[0,1,2].map(i=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z" fill="${i<stars?'#E5A92B':'rgba(242,232,208,.15)'}"/></svg>`).join('');
  $('rStars').setAttribute('aria-label',stars+' av 3 stjerner');
  const items=[];if(state.missed)items.push(`<li><b>${state.missed} port${state.missed>1?'er':''} bommet:</b> ${state.missed*10} poeng</li>`);
  if(state.winches)items.push(`<li><b>${state.winches} vinsj:</b> ${state.winchPen} poeng</li>`);
  if(state.touched)items.push(`<li><b>${state.touched} portstang${state.touched>1?'er':''} berørt:</b> ${state.touched*2} poeng</li>`);
  if(state.lavaFalls)items.push(`<li><b>${state.lavaFalls} gang i lava:</b> ${state.lavaFalls*10} poeng</li>`);
  if(state.bonusNuts)items.push(`<li><b>Snarvei over lavaen:</b> +${state.bonusNuts} ⚙</li>`);
  if(state.rescues)items.push(`<li><b>${state.rescues} veltehjelp:</b> ingen straff</li>`);
  if(state.drowned)items.push(`<li><b>${state.drowned} druknet motor:</b> ${state.drowned*5} poeng</li>`);
  if(!items.length)items.push('<li><b>Ingen straffepoeng.</b> Akkurat sånn det skal gjøres.</li>');
  items.push(`<li><b>Kasser ${state.crates}/${LV.crates.length}:</b> ${state.crates?'−'+state.crates*2+' s på tiden':'ingen bonus'}</li>`);
  if(state.jumps)items.push(`<li><b>${state.jumps} hopp,</b> lengste ${state.bestAir.toFixed(1).replace('.',',')} s i lufta</li>`);
  if(isBest)items.push('<li><b>Ny personlig rekord på denne banen.</b></li>');
  // earnings
  const gatesOK=LV.gates.length-state.missed;let e=0;const el=[];
  e+=gatesOK*10;el.push(`${gatesOK} port${gatesOK===1?'':'er'} +${gatesOK*10}`);
  if(state.crates){e+=state.crates*15;el.push(`${state.crates} kasser +${state.crates*15}`)}
  if(state.longJumps){e+=state.longJumps*20;el.push(`${state.longJumps} store hopp +${state.longJumps*20}`)}
  if(state.bonusNuts){e+=state.bonusNuts;el.push(`snarvei +${state.bonusNuts}`)}
  if(p===0){e+=100;el.push('feilfri +100')}
  // first-completion bonus is earned per gate: 200 for all gates, the rest can be picked up on a later run
  const frac=gatesOK/def.gates,prevF=+prof.first[key]||0;
  if(frac>prevF){const add=Math.round(200*frac)-Math.round(200*prevF);prof.first[key]=frac;e+=add;
    el.push(frac<1?`${gatesOK}/${def.gates} porter tatt, banebonus +${add}`:prevF?`alle porter tatt, resten av banebonusen +${add}`:'første gang i mål +200')}
  // the daily double needs a full run (no missed gates) and is saved for later otherwise
  const today=new Date().toDateString();let dbl=false,dblNote='';
  if(prof.lastDay!==today){if(state.missed===0){prof.lastDay=today;dbl=true;e*=2}else dblNote='Ta alle portene for å få dagens dobbel. '}
  prof.nuts+=e;prof.runs++;saveProf();
  $('rNuts').textContent='+'+fmtN(e);$('rNutsNote').textContent=(dbl?'Dagens første tur: dobbelt! ':dblNote)+el.join(' · ');
  $('rLog').innerHTML=items.join('');
  $('rNext').textContent=state.world?'Kjør videre':state.levelIdx<LEVELS.length-1?'Neste bane':'Første bane';
  setTimeout(()=>{$('result').hidden=false;$('rNext').focus()},900);toast('Mål!');
}
function fmtTime(t){t=Math.round(t*10)/10;const m=Math.floor(t/60),s=t-m*60;return m+':'+(s<10?'0':'')+s.toFixed(1)}
let toastT=0;function toast(msg,bad){const el=$(typeof CV!=='undefined'&&CV.on?'cvToast':BT.on||(typeof FL!=='undefined'&&FL.on)?'boatToast':'toast');el.textContent=msg;el.classList.toggle('bad',!!bad);el.classList.add('on');toastT=1.6}

function segX(p1,p2,a,b){const d=(p2.x-p1.x)*(b.z-a.z)-(p2.z-p1.z)*(b.x-a.x);if(Math.abs(d)<1e-9)return false;
  const u=((a.x-p1.x)*(b.z-a.z)-(a.z-p1.z)*(b.x-a.x))/d,v=((a.x-p1.x)*(p2.z-p1.z)-(a.z-p1.z)*(p2.x-p1.x))/d;return u>=0&&u<=1&&v>=0&&v<=1}
const prevPos=new V3();
function checkGates(){
  const p1={x:prevPos.x,z:prevPos.z},p2={x:car.pos.x,z:car.pos.z};
  LV.gates.forEach((gt,i)=>{
    // pole touch
    const gv=gateVis[i];if(!gv.touched&&gv.state!=='missed'&&i>=state.next-1){for(const e of[gt.a,gt.b]){_t.set(e.x-car.pos.x,0,e.z-car.pos.z);const lx=_t.dot(car.lf)/Math.hypot(car.lf.x,car.lf.z),lz=_t.dot(car.fw)/Math.hypot(car.fw.x,car.fw.z);
      if(Math.abs(lx)<.5&&Math.abs(lz)<car.cfg.L/2+.12&&Math.abs(H(e.x,e.z)-car.pos.y)<1.2){gv.touched=true;state.touched++;addPenalty(2,'Berørt stang');break}}}
    if(i<state.next||!segX(p1,p2,gt.a,gt.b))return;
    for(let k=state.next;k<i;k++){setGateState(k,'missed');state.missed++;addPenalty(10,'Bom på port '+(k+1))}
    setGateState(i,'passed');state.next=i+1;state.checkpoint={x:gt.c.x,z:gt.c.z,h:Math.atan2(gt.tan.x,gt.tan.z)};
    if(gt.finish)finishRun();else{setGateState(i+1,'next');if(state.penalty===0||toastT<=0)toast('Port '+(i+1)+' ✓');ambGate()}
  });
}

/* ---------- input ---------- */
const keys=new Set();
addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(state.mode==='menu'||state.mode==='garage'){if(k==='enter'&&document.activeElement===document.body)startRun();if(k==='escape'&&state.mode==='garage')toMenu();return}
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();
  if(e.repeat)return;keys.add(k);
  if(state.mode==='ferry'){if(k==='enter'||k===' '||k==='escape')skipFerry();return}
  if(state.mode==='ski'){skiKeyDown(k);return}
  if(state.mode==='boat'){boatKeyDown(k);return}
  if(state.mode==='fly'){flyKeyDown(k);return}
  if(state.mode==='cave'){caveKeyDown(k);return}   // Diamantgrotten (js/grotte.js)
  if(MAP.open&&(k==='escape'||k==='k')){openMap(false);return}
  if(k==='escape'||k==='p'){if(state.mode==='play')pause(true);else if(state.mode==='pause')pause(false);else if(state.mode==='ask')answerAsk(false)}
  if(state.mode==='ask'&&(k==='enter'||k==='j'))answerAsk(true);
  if(state.mode!=='play')return;
  if(k==='enter'&&state.offerK){acceptOffer();return}
  if(k==='k')openMap();
  if(k==='g'||k===' ')toggleGear();if(k==='l')setLights(!state.lights);if(k==='c')cycleCam();if(k==='r'){if(hasWinch())winchKey(true);else winch()}if(k==='m')setSound(!state.sound);
  if(k==='+'||k==='=')setSpeed(state.speed+10);if(k==='-'||k==='_')setSpeed(state.speed-10);
  if(k==='z'||k==='pageup')zoom(-1);if(k==='x'||k==='pagedown')zoom(1);
});
// zoom: distance in the follow camera, field of view in the ground and driver cameras
let fovZoom=1;
function zoom(dir){
  if(state.camMode===0){camDist=Math.max(1.6,Math.min(12,camDist*(dir>0?1.18:1/1.18)));store.set('camDist',camDist);toast('Zoom '+Math.round(3.8/camDist*100)+' %')}
  else{fovZoom=Math.max(.45,Math.min(1.6,fovZoom*(dir>0?1.15:1/1.15)));toast('Zoom '+Math.round(100/fovZoom)+' %')}
}
function setSpeed(v,quiet){v=Math.max(30,Math.min(150,Math.round(v/10)*10));const changed=v!==state.speed;state.speed=v;store.set('speed',v);if(car)car.speedScale=v/100;
  $('hSpd').textContent=v+'%';$('spdRange').value=v;$('spdOut').textContent=v+' %';if(!quiet&&changed&&state.mode==='play')toast('Fartsgrense '+v+' %')}
function setGfx(q){state.gfx=q;store.set('gfx',q);const hi=q==='hi';
  renderer.setPixelRatio(hi?Math.min(window.devicePixelRatio||1,1.5):Math.min(window.devicePixelRatio||1,1));for(const t of terrainTiles)t.mesh.castShadow=hi;
  const sz=hi?2048:1024;if(sun.shadow.mapSize.x!==sz){sun.shadow.mapSize.set(sz,sz);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}}
  tracks.visible=hi;if(LV)lavaLight.visible=LV.hasLava&&hi;$('gfxHi').setAttribute('aria-pressed',hi);$('gfxLo').setAttribute('aria-pressed',!hi);resize()}
addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());if(e.key.toLowerCase()==='r'&&hasWinch())winchKey(false)});
addEventListener('blur',()=>{keys.clear();for(const k in state.input)state.input[k]=0});
function toggleGear(){car.low=!car.low;updateGearUI();toast(car.low?'Lavt gir: krabbing':'Høyt gir: fart')}
function updateGearUI(){$('hGearTxt').textContent=car.low?'LAV':'HØY';$('hGearSub').textContent=car.low?'krabb':'fart';$('bGear').classList.toggle('hi',!car.low)}
function setLights(on){state.lights=on;$('bLights').setAttribute('aria-pressed',on);const led=car&&car.tune.led;M.lamp.emissive.set(on?0xfff1c0:0x000000);M.tail.emissive.set(on?0x8a1010:0x000000);M.beam.opacity=on?(led?.14:.085):0;if(carVis)carVis.spots.forEach(s=>s.intensity=on?(led?3.8:2.2):0)}
const CAMS=['Følgekamera','Bakkekamera','Førerkamera'];
function cycleCam(){state.camMode=(state.camMode+1)%3;tripod=null;if(state.camMode===0){orbitYaw=0;orbitPitch=0}camSnap=true;fovZoom=1;toast(CAMS[state.camMode])}
function setSound(on){state.sound=on;store.set('sound',on);$('pSound').textContent='Lyd: '+(on?'på':'av');$('pSound').setAttribute('aria-pressed',on)}
function setVol(which,v){v=Math.max(0,Math.min(100,Math.round(v)));state[which]=v;store.set(which,v);const ids=which==='volCar'?['volCar','pVolCar']:['volAmb','pVolAmb'];
  for(const id of ids){const el=$(id);if(el&&el.value!==undefined)el.value=v;const o=$(id+'Out');if(o)o.textContent=v+' %'}}
for(const[id,w]of[['volCar','volCar'],['pVolCar','volCar'],['volAmb','volAmb'],['pVolAmb','volAmb']]){const el=$(id);if(el)el.addEventListener('input',e=>setVol(w,+e.target.value))}
$('bGear').onclick=()=>{if(state.mode==='play')toggleGear()};$('bLights').onclick=()=>setLights(!state.lights);
$('bSlow').onclick=()=>setSpeed(state.speed-10);$('bFast').onclick=()=>setSpeed(state.speed+10);
$('bZoomIn').onclick=()=>zoom(-1);$('bZoomOut').onclick=()=>zoom(1);
$('spdRange').addEventListener('input',e=>setSpeed(+e.target.value,true));
$('gfxHi').onclick=()=>setGfx('hi');$('gfxLo').onclick=()=>setGfx('lo');$('bCam').onclick=()=>{if(state.mode==='ski')skiKeyDown('c');else cycleCam()};$('bWinch').addEventListener('pointerdown',e=>{if(hasWinch()){e.preventDefault();winchKey(true)}});$('bWinch').addEventListener('pointerup',()=>{if(hasWinch())winchKey(false)});$('bWinch').onclick=()=>{if(!hasWinch())winch()};$('pFetch').onclick=()=>{pause(false);winch()};$('bPause').onclick=()=>pause(true);
$('pResume').onclick=()=>pause(false);$('pRestart').onclick=()=>{if(state.world&&!state.course){pause(false);resetToStart();return}startRun()};$('pMenu').onclick=toMenu;$('pSound').onclick=()=>setSound(!state.sound);
$('rRetry').onclick=()=>{if(!skiResultBtn('retry')&&!boatResultBtn('retry')&&!flyResultBtn('retry')&&!caveResultBtn('retry'))startRun()};$('rMenu').onclick=()=>{if(!skiResultBtn('car')&&!boatResultBtn('car')&&!flyResultBtn('car')&&!caveResultBtn('car'))toMenu()};$('rNext').onclick=()=>{if(skiResultBtn('next')||boatResultBtn('next')||flyResultBtn('next')||caveResultBtn('next'))return;if(state.world){endCourse();showHud();state.mode='play';return}loadLevel((state.levelIdx+1)%LEVELS.length);startRun()};
$('bMap').onclick=()=>openMap();$('mTabIsland').onclick=()=>setMapTab('island');$('mTabArch').onclick=()=>setMapTab('arch');$('mClose').onclick=()=>openMap(false);$('pMap').onclick=()=>{$('pause').hidden=true;openMap(true)};
$('mTow').onclick=()=>{if(prof.nuts<20){toast('Du trenger 20 muttere',true);return}prof.nuts-=20;saveProf();if(state.course)endCourse();openMap(false);const lvl=LEVELS[state.levelIdx];if(lvl.basePos)resetToStart();else if(LV.ferry){const f=LV.ferry;placeCar(car,f.pad.x,f.pad.z,Math.atan2(-f.dx,-f.dz));camSnap=true}else resetToStart();state.checkpoint={x:car.pos.x,z:car.pos.z,h:Math.atan2(car.fw.x,car.fw.z)};toast(lvl.basePos?'Tauet hjem til basen · −20 ⚙':'Tauet til kaia · −20 ⚙')};
$('oGo').onclick=()=>acceptOffer();$('aYes').onclick=()=>answerAsk(true);$('aNo').onclick=()=>answerAsk(false);$('aList').addEventListener('click',e=>{const b=e.target.closest('[data-dest]');if(b)answerAsk({dest:b.dataset.dest});const sb=e.target.closest('[data-ski]');if(sb)answerAsk({ski:sb.dataset.ski})});$('pAbort').onclick=()=>{pause(false);endCourse();toast('Løpet avbrutt')};
$("startBtn").onclick=()=>startRoam();$('raceBtn').onclick=()=>{state.roam=false;startRun()};
document.querySelectorAll('.tb').forEach(b=>{const t=b.dataset.t;const on=e=>{e.preventDefault();state.input[t]=1;b.classList.add('on');try{b.setPointerCapture(e.pointerId)}catch(_){}};
  const off=e=>{state.input[t]=0;b.classList.remove('on')};b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('lostpointercapture',off)});
const isTouch=()=>matchMedia('(pointer:coarse)').matches;
if(isTouch())document.body.classList.add('is-touch');
addEventListener('touchstart',()=>document.body.classList.add('is-touch'),{once:true,passive:true});

// camera drag / zoom
let orbitYaw=0,orbitPitch=0,camDist=store.get('camDist',3.8),drag=null,pinch=null;const ptrs=new Map();
renderer.domElement.addEventListener('pointerdown',e=>{ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});if(ptrs.size===1)drag={x:e.clientX,y:e.clientY};else if(ptrs.size===2){const[a,b]=[...ptrs.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),cd:camDist}}});
addEventListener('pointermove',e=>{if(!ptrs.has(e.pointerId))return;ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===2&&pinch){const[a,b]=[...ptrs.values()];camDist=Math.max(1.6,Math.min(12,pinch.cd*pinch.d/Math.max(20,Math.hypot(a.x-b.x,a.y-b.y))));store.set('camDist',camDist);return}
  if(drag){orbitYaw-=(e.clientX-drag.x)*.008;orbitPitch=Math.max(-.5,Math.min(.9,orbitPitch+(e.clientY-drag.y)*.005));drag={x:e.clientX,y:e.clientY}}});
const endPtr=e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;if(!ptrs.size)drag=null};
addEventListener('pointerup',endPtr);addEventListener('pointercancel',endPtr);
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();if(state.camMode===0){camDist=Math.max(1.6,Math.min(12,camDist*(1+Math.sign(e.deltaY)*.1)));store.set('camDist',camDist)}else fovZoom=Math.max(.45,Math.min(1.6,fovZoom*(1+Math.sign(e.deltaY)*.08)))},{passive:false});

let padPrev={};
function readInput(dt){
  let gas=0,rev=0,steer=0;
  if(keys.has('arrowup')||keys.has('w'))gas=1;if(keys.has('arrowdown')||keys.has('s'))rev=1;
  if(keys.has('arrowleft')||keys.has('a'))steer+=1;if(keys.has('arrowright')||keys.has('d'))steer-=1;
  gas=Math.max(gas,state.input.gas);rev=Math.max(rev,state.input.rev);steer+=state.input.left-state.input.right;
  const pads=navigator.getGamepads?navigator.getGamepads():[];const gp=[...pads].find(p=>p&&p.connected);
  if(gp){const ax=gp.axes[0]||0;if(Math.abs(ax)>.12)steer-=ax;const rt=gp.buttons[7]?gp.buttons[7].value:0,lt=gp.buttons[6]?gp.buttons[6].value:0;gas=Math.max(gas,rt);rev=Math.max(rev,lt);
    const ly=gp.axes[1]||0;if(ly<-.2)gas=Math.max(gas,-ly);if(ly>.2)rev=Math.max(rev,ly);
    const pr=i=>gp.buttons[i]&&gp.buttons[i].pressed&&!padPrev[i];
    if(state.mode==='play'){if(pr(0))toggleGear();if(pr(1)){if(hasWinch())winchKey(true);else winch()}if(hasWinch()&&padPrev[1]&&!(gp.buttons[1]&&gp.buttons[1].pressed))winchKey(false);if(pr(3))cycleCam();if(pr(2))setLights(!state.lights)}
    if(pr(9)){if(state.mode==='play')pause(true);else if(state.mode==='pause')pause(false);else if(state.mode==='ski')skiKeyDown('escape');else if(state.mode==='boat')boatKeyDown('escape');else if(state.mode==='fly')flyKeyDown('escape');else if(state.mode==='cave')caveKeyDown('escape');else if(state.mode==='menu')startRun()}
    padPrev={};gp.buttons.forEach((b,i)=>padPrev[i]=b.pressed)}
  steer=Math.max(-1,Math.min(1,steer));
  state.inp={gas,rev,steer,jump:keys.has(' ')||state.input.jump>0||!!(gp&&gp.buttons[0]&&gp.buttons[0].pressed)};   // the skier reads these (js/ski.js)
  if(state.mode!=='play'){gas=0;rev=0;steer=0}
  const thr=gas-rev;car.throttle+=Math.max(-dt*3,Math.min(dt*3,thr-car.throttle));
  car.steer+=Math.max(-dt*2.4,Math.min(dt*2.4,steer*.6-car.steer));
  if(state.mode==='play'&&!state.started&&Math.abs(thr)>0){state.started=true}
}

/* ---------- camera ---------- */
let camSnap=true,tripod=null;const camTarget=new V3(),camLook=new V3(),_c1=new V3(),_c2=new V3();
function updateCamera(dt){
  if(SKI.on){skiCamera(dt);return}
  const fwf=_c1.set(car.fw.x,0,car.fw.z);if(fwf.lengthSq()<1e-4)fwf.set(0,0,1);fwf.normalize();
  if(state.mode==='menu'||state.mode==='garage'){const g=state.mode==='garage',a=performance.now()*(g?.0002:.00012)+.6,r=g?3.2:4.6;camTarget.set(car.pos.x+Math.sin(a)*r,0,car.pos.z+Math.cos(a)*r);camTarget.y=Math.max(car.pos.y+(g?.7:1.1),H(camTarget.x,camTarget.z)+.5);
    camLook.copy(car.pos).add(_c2.set(0,.2,0));camera.fov=g?34:40;}
  else if(state.camMode===0){
    const c=Math.cos(orbitYaw),s=Math.sin(orbitYaw),bx=-(fwf.x*c+fwf.z*s),bz=-(-fwf.x*s+fwf.z*c);
    const dkc=LEVELS[state.levelIdx].dark?LEVELS[state.levelIdx].dark(car.pos.x,car.pos.z):0,cd=camDist*(1-.4*dkc);   // closer to the car inside a tunnel
    camTarget.set(car.pos.x+bx*cd,car.pos.y+.9+cd*.28+orbitPitch*cd*.6,car.pos.z+bz*cd);
    camTarget.y=Math.max(camTarget.y,H(camTarget.x,camTarget.z)+.45);camLook.copy(car.pos).add(_c2.set(0,.35,0));camera.fov=55+Math.min(9,car.vel.length()*1.5);
  }else if(state.camMode===1){
    if(!tripod||tripod.distanceTo(car.pos)>9.5){const sd=Math.random()<.5?1:-1;tripod=new V3(car.pos.x+fwf.x*5.5+fwf.z*2.4*sd,0,car.pos.z+fwf.z*5.5-fwf.x*2.4*sd);tripod.y=H(tripod.x,tripod.z)+.22;camSnap=true}
    camTarget.copy(tripod);camLook.copy(car.pos).add(_c2.set(0,.15,0));camera.fov=38*fovZoom;
  }else{
    camTarget.set(0,.98,.25).applyQuaternion(car.q).add(car.pos);camLook.set(0,.55,4).applyQuaternion(car.q).add(car.pos);camera.fov=68*fovZoom;
    camera.position.copy(camTarget);camera.up.copy(car.up);camera.lookAt(camLook);camera.updateProjectionMatrix();return;
  }
  camera.up.set(0,1,0);
  if(camSnap){camera.position.copy(camTarget);camera.userData.look=camLook.clone();camSnap=false}
  else{const k=1-Math.exp(-dt*(state.camMode===1?20:4.5));camera.position.lerp(camTarget,k);camera.userData.look.lerp(camLook,1-Math.exp(-dt*(state.camMode===1?5:10)))}
  camera.lookAt(camera.userData.look);camera.updateProjectionMatrix();
}

/* ---------- visuals sync ---------- */
const _q2=new Q4(),_q3=new Q4(),_e=new THREE.Euler();
function syncVisuals(dt){
  carVis.body.position.copy(car.pos);carVis.body.quaternion.copy(car.q);
  car.wheels.forEach((w,i)=>{const v=carVis.wheels[i];v.root.position.copy(w.center);_q2.setFromAxisAngle(YAX,w.front?car.steer:0);v.root.quaternion.copy(car.q).multiply(_q2);v.spin.rotation.x=w.spin;
    if(w.contact&&w.wd>0){if((Math.abs(w.vl)>.6||w.slip>.3)&&Math.random()<dt*30){_c2.copy(w.P);_c2.y=w.P.y+w.wd;spawnDust(_c2,w.surf===S.MUD||w.surf===S.BOG?98:99,true)}}
    else if(w.contact&&(w.slip>.35||(car.vel.lengthSq()>4&&Math.random()<.3))&&Math.random()<dt*25)spawnDust(w.P,w.surf,w.surf===S.BOG||w.surf===S.MUD?w.slip>.5:false);
    if(w.contact&&(w.surf===S.BOG||w.surf===S.MUD))v.root.position.y-=w.surf===S.BOG?.06:.03;
    if(w.contact&&state.mode!=='menu'){const st=w.front?car.steer:0,cs=Math.cos(st),sn=Math.sin(st);layTrack(w,car.fw.x*cs+car.lf.x*sn,car.fw.z*cs+car.lf.z*sn)}});
  for(let a=0;a<2;a++){const L=car.wheels[a*2].center,R=car.wheels[a*2+1].center,ax=carVis.axles[a];ax.position.copy(L).add(R).multiplyScalar(.5);_c2.copy(L).sub(R);const len=_c2.length();
    ax.quaternion.setFromUnitVectors(YAX,_c2.normalize());ax.userData.tube.scale.y=len}
  // shadow follows car
  const d=LEVELS[state.levelIdx].sunDir,fp=focusPos();sun.position.set(fp.x+d[0],fp.y+d[1],fp.z+d[2]);sun.target.position.copy(fp);
  skyDome.position.copy(camera.position);const dl=Math.hypot(d[0],d[1],d[2]);sunGlow.position.set(camera.position.x+d[0]/dl*170,camera.position.y+d[1]/dl*170,camera.position.z+d[2]/dl*170);
  // beacon & arrow
  const ng=LV.gates[state.next];
  if(ng&&state.mode==='play'){beacon.visible=true;beacon.position.set(ng.c.x,H(ng.c.x,ng.c.z),ng.c.z);beacon.userData.ring.scale.setScalar(1+.08*Math.sin(performance.now()*.005));
    arrow.visible=car.assist;if(arrow.visible){arrow.position.copy(car.pos).add(_c2.set(0,1.25,0));_c1.set(ng.c.x-car.pos.x,0,ng.c.z-car.pos.z).normalize();arrow.quaternion.setFromUnitVectors(YAX,_c1)}}
  else if(state.free&&car.assist&&state.world){const n=nearestPortal();let tx=null,tz=null;if(n&&n.d>6){tx=n.k.start.p.x;tz=n.k.start.p.z}
    if(tx!==null){arrow.visible=true;arrow.position.copy(car.pos).add(_c2.set(0,1.25,0));_c1.set(tx-car.pos.x,0,tz-car.pos.z).normalize();arrow.quaternion.setFromUnitVectors(YAX,_c1)}else arrow.visible=false;beacon.visible=false}
  else{beacon.visible=false;arrow.visible=false}
  updateDust(dt);updateRain(dt);updateFx(dt);applyZone(fp.x,fp.z);nightTint();updateCoat(dt);updateWinch(dt);updateAnimals(dt);updateBoulder(dt);
  waterMat.normalMap.offset.x+=dt*.025;waterMat.normalMap.offset.y+=dt*.018;WIND.uTime.value+=dt;
  const tm=performance.now()*.001;for(const c of crateVis){if(c.taken)continue;c.g.rotation.y=tm*1.2;c.g.position.y=c.cr.y+Math.sin(tm*2.2+c.cr.x)*.03}
}

/* ---------- HUD ---------- */
let hudT=0;
function updateHUD(dt){
  hudT-=dt;if(hudT>0)return;hudT=.1;
  if(state.free){$('hNuts').textContent=fmtN(prof.nuts);const lvl=LEVELS[state.levelIdx],b=lvl.basePos||(LV.ferry?[LV.ferry.quay.x,LV.ferry.quay.z]:[0,0]);const dm=Math.hypot(b[0]-car.pos.x,b[1]-car.pos.z)*UNIT_CM/100;$('hBase').textContent=dm.toFixed(1).replace('.',',')+' m';$('hBaseL').textContent=lvl.basePos?'Basen':'Kaia';$('hDone').textContent=coursesDone()+'/'+LV.courses.length}
  else{$('hGate').textContent=(Math.min(state.next,LV.gates.length)-state.missed)+'/'+LV.gates.length;$('hTime').textContent=fmtTime(state.time);$('hPen').textContent=state.penalty;$('hCrate').textContent=state.crates+'/'+LV.crates.length}
  const sp=car.vel.dot(car.fw)*UNIT_CM;$('hSpeed').textContent=Math.round(Math.abs(sp));
  const ng=LV.gates[state.next];if(ng){const dcm=Math.hypot(ng.c.x-car.pos.x,ng.c.z-car.pos.z)*UNIT_CM;if(dcm>=100){$('hNext').textContent=(dcm/100).toFixed(1).replace('.',',');$('hNextU').textContent='m'}else{$('hNext').textContent=Math.round(dcm);$('hNextU').textContent='cm'}}else if(state.free){const n=nearestPortal();if(n){$('hNext').textContent=(n.d*UNIT_CM/100).toFixed(1).replace('.',',');$('hNextU').textContent='m til '+n.k.name}else{$('hNext').textContent='–';$('hNextU').textContent=''}}
  const roll=Math.asin(Math.max(-1,Math.min(1,car.lf.y)))*57.3,pitch=Math.asin(Math.max(-1,Math.min(1,car.fw.y)))*57.3;
  $('hRoll').textContent=Math.round(Math.abs(roll))+'°';$('hPitch').textContent=Math.round(pitch)+'°';
  $('inclRoll').setAttribute('transform','rotate('+(-roll).toFixed(1)+')');$('gIncl').classList.toggle('warn',Math.abs(roll)>35||Math.abs(pitch)>40);
}

/* ---------- main loop ---------- */
let last=performance.now(),acc=0,landShake=0;
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(!car||!LV){return}
  readInput(dt);if(toastT>0){toastT-=dt;if(toastT<=0){$('toast').classList.remove('on');$('boatToast').classList.remove('on');$('cvToast').classList.remove('on')}}
  prevPos.copy(car.pos);
  if(state.mode!=='pause'&&state.mode!=='ask'&&state.mode!=='ferry'&&state.mode!=='ski'&&state.mode!=='boat'&&state.mode!=='fly'&&state.mode!=='cave'){acc+=dt;let n=0;while(acc>=FIXED&&n<20){stepCar(car,FIXED);acc-=FIXED;n++}if(n>=20)acc=0}
  if(state.mode==='count')updateCountdown(dt);if(state.mode==='ferry')updateFerry(dt);
  // physics blew up: put the car back at the last checkpoint (the start outside a run)
  if(!isFinite(car.pos.x)||!isFinite(car.q.w)){car.q.set(0,0,0,1);const cp=state.mode==='play'&&state.checkpoint;if(cp)placeCar(car,cp.x,cp.z,cp.h);else resetToStart();camSnap=true}
  if(state.mode==='play'){
    if(state.started)state.time+=dt;
    checkGates();
    if(car.up.y<.3&&car.vel.length()<1.5)state.flipT+=dt;else state.flipT=Math.max(0,state.flipT-dt*2);
    if(state.flipT>1.3&&$('hint').hidden){$('hint').hidden=false;$('hint').innerHTML=car.assist?'Bilen har veltet. Veltehjelpen henter den straks, uten straff.':hasWinch()?'Bilen har veltet. Hold <b>R</b> for å feste vinsjen i noe foran bilen og dra den opp, eller <button id="hWinch">hent bilen</button> (straff).':'Bilen har veltet. Trykk <b>R</b> eller <button id="hWinch">Vinsj</button> for å komme videre.';const hb=$('hWinch');if(hb)hb.onclick=()=>winch()}
    if(state.flipT<.5&&!$('hint').hidden)$('hint').hidden=true;
    if(car.assist&&state.flipT>2.6)winch(true);
    // water: warn, then the engine floods
    if(car.depth>car.tune.wade){state.flood+=dt;if(!state.deepWarn&&state.flood>.25){state.deepWarn=true;toast('Dypt vann!',true)}}else{state.flood=Math.max(0,state.flood-dt*2);if(state.flood===0)state.deepWarn=false}
    if(state.flood>1.4){state.flood=0;state.deepWarn=false;const cp=state.checkpoint;placeCar(car,cp.x,cp.z,cp.h);state.drowned++;addPenalty(5,'Druknet motor');camSnap=true}
    // lava: fall in and you are winched back to the previous gate
    if(LV.hasLava){const ll=lavaAt(car.pos.x,car.pos.z);
      if(ll>-1e8&&car.pos.y<ll+.12){const cp=state.checkpoint;for(let i=0;i<14;i++)spawnDust(car.pos,15,true);placeCar(car,cp.x,cp.z,cp.h);state.lavaFalls++;state.flood=0;addPenalty(10,'Lava: tilbake til forrige port');camSnap=true}
      else LV.bonuses.forEach((b,bi)=>{if(!state.bonusDone[bi]&&Math.hypot(b.x-car.pos.x,b.z-car.pos.z)<b.r&&(ll<-1e8||car.pos.y>ll+.35)){state.bonusDone[bi]=1;state.bonusNuts+=b.nuts;toast(b.msg)}})}
    // airtime
    if(car.wheels.every(w=>!w.contact)&&car.pos.y>H(car.pos.x,car.pos.z)+.3){state.air+=dt;state.fallV=Math.min(state.fallV||0,car.vel.y)}else if(state.air>0){const hit=-(state.fallV||0);if(state.air>.2&&hit>2.2){landShake=Math.min(.05,hit*.012);ambThump(Math.min(1,hit/8));for(let i=0;i<Math.min(14,hit*2|0);i++)for(const w of car.wheels)if(w.contact&&Math.random()<.5)spawnDust(w.P,w.surf,true)}state.fallV=0;if(state.air>.32&&!(state.thrown&&performance.now()-state.thrown<4000)){state.jumps++;if(state.air>.5)state.longJumps++;state.bestAir=Math.max(state.bestAir,state.air);toast('Hopp! '+state.air.toFixed(1).replace('.',',')+' s'+(state.air>.5?' · +20 ⚙':''))}state.air=0}
    // crates
    for(const c of crateVis){if(c.taken)continue;const dx=c.cr.x-car.pos.x,dz=c.cr.z-car.pos.z;if(dx*dx+dz*dz<.42&&Math.abs(c.cr.y-car.pos.y)<.9){c.taken=true;c.g.visible=false;state.crates++;toast('Kasse '+state.crates+'/'+LV.crates.length+' · +15 ⚙');for(let i=0;i<6;i++)spawnDust(c.g.position,0,true)}}
    if(car.pos.y<-3||Math.abs(car.pos.x)>HALF-.5||Math.abs(car.pos.z)>HALF-.5){winch();toast('Utenfor banen: vinsj',true)}
    if(state.world){updateWorld(dt);updateFog(dt);saveRoam(dt)}
    updateSecrets(dt);
    updateHUD(dt);
  }
  if(state.mode==='done'&&toastT>0)updateHUD(dt);
  if(updateBoat(dt)){if(typeof netTick==='function')netTick(dt);return}   // out at sea (js/boat.js): the boat race is drawn instead of the island
  if(updateFly(dt)){if(typeof netTick==='function')netTick(dt);return}    // in the air (js/plane.js): the same sea, seen from the plane
  if(updateCave(dt)){if(typeof netTick==='function')netTick(dt);return}   // in Diamantgrotten (js/grotte.js): the cave seen from the side
  updateMinimap();
  updateLift(dt);syncVisuals(dt);updateSki(dt);if(typeof netTick==='function')netTick(dt);updateCamera(dt);updateAudio();updateAmbience(dt);
  landShake*=Math.exp(-dt*9);const shk=(ERU.amp>.0005?ERU.amp:0)+boulderShake()+(landShake>.001?landShake:0),sx=(Math.random()-.5)*shk*2,sy=(Math.random()-.5)*shk*2,sz=(Math.random()-.5)*shk*2;if(shk)camera.position.add(_c1.set(sx,sy,sz));
  renderer.render(scene,camera);
  if(shk)camera.position.sub(_c1.set(sx,sy,sz));
}
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
addEventListener('resize',resize);resize();
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(state.mode==='play'||state.mode==='ski'))pause(true)});

/* ---------- menu ---------- */
function pips(n,max=5){return'<span class="pips">'+Array.from({length:max},(_,i)=>`<i class="${i<n?'on':''}"></i>`).join('')+'</span>'}
function renderMenu(){
  $('carList').innerHTML=CARS.map((c,i)=>`<button class="card ${ownsCar(c)?'':'locked'}" data-car="${i}" aria-pressed="${i===state.carIdx}"><span class="nm">${c.name}${ownsCar(c)?'':' 🔒'}</span><span class="kd">${ownsCar(c)?c.kind:'Kjøpes i verkstedet · '+c.price+' ⚙'}</span>
    <span class="stat">Klatring ${pips(c.stats[0])}</span><span class="stat">Sving ${pips(c.stats[1])}</span><span class="stat">Stabilitet ${pips(c.stats[2])}</span></button>`).join('');
  $('carDesc').textContent=CARS[state.carIdx].desc;
  const lvlBtn=(l,i,no)=>{if(l.world){const done=l.challenges.filter(c=>best[l.id+'/'+c.id]).length;return`<button class="lvl world" data-lvl="${i}" aria-pressed="${i===state.levelIdx}"><span class="no">★</span>
    <span><span class="t">${l.name}</span><br><span class="d">${l.desc}</span></span><span class="best">Løyper<b>${done}/${l.challenges.length}</b></span></button>`}const b=best[l.id];return`<button class="lvl" data-lvl="${i}" aria-pressed="${i===state.levelIdx}"><span class="no">${no}</span>
    <span><span class="t">${l.name}<span class="diff" aria-label="Vanskelighet ${l.diff} av 3">${[1,2,3].map(k=>`<i class="${k<=l.diff?'on':''}"></i>`).join('')}</span></span><br><span class="d">${l.desc}</span></span>
    <span class="best">${b?`Beste<b>${fmtTime(b.t)}</b>${b.p} straff`:'Ikke kjørt'}</span></button>`};
  const races=LEVELS.map((l,i)=>[l,i]).filter(([l])=>!l.world);
  $('levelList').innerHTML=races.map(([l,i],n)=>lvlBtn(l,i,n+1)).join('');const sel=LEVELS[state.levelIdx];$('raceBtn').textContent='Hurtigløp: '+(sel.world?races[0][0].name:sel.name);
  $('mNuts').textContent=fmtN(prof.nuts);$('mStars').textContent='★ '+totalStars()+' av '+maxStars();
  $('modeEasy').setAttribute('aria-pressed',state.assist);$('modeReal').setAttribute('aria-pressed',!state.assist);
  $('modeNote').textContent=state.assist?'Litt mer grep, veltehjelp, automatisk vinsj og en pil som peker mot neste port. Fint for barn og nybegynnere.':'Ingen hjelp. Bilen oppfører seg som en ekte crawler, og du må vinsje selv.';
}
$('carList').addEventListener('click',e=>{const b=e.target.closest('[data-car]');if(!b)return;const c=CARS[+b.dataset.car];if(!ownsCar(c)){$('carDesc').textContent=c.desc+' Kjøpes i verkstedet på basen for '+c.price+' muttere.';return}setCar(+b.dataset.car);renderMenu()});
$('levelList').addEventListener('click',e=>{const b=e.target.closest('[data-lvl]');if(!b)return;loadLevel(+b.dataset.lvl);renderMenu()});
$('modeEasy').onclick=()=>{state.assist=true;store.set('assist',true);if(car)car.assist=true;renderMenu()};
$('modeReal').onclick=()=>{state.assist=false;store.set('assist',false);if(car)car.assist=false;renderMenu()};

function boot(){
  state.roam=false;initMaps();decalMat=new THREE.MeshStandardMaterial({map:decalTexture(),transparent:true,roughness:.5});
  if(state.carIdx>=CARS.length||!ownsCar(CARS[state.carIdx]))state.carIdx=0;if(state.levelIdx>=LEVELS.length)state.levelIdx=0;
  loadLevel(state.levelIdx);setCar(state.carIdx);setSound(state.sound);setVol('volCar',state.volCar);setVol('volAmb',state.volAmb);setSpeed(state.speed,true);setGfx(state.gfx);renderMenu();
  for(let i=0;i<240;i++)stepCar(car,FIXED);
  requestAnimationFrame(frame);
}
// index.html calls startGame() after every script has loaded
function startGame(){const fontsReady=document.fonts?Promise.all([document.fonts.load('40px "Saira Stencil One"'),document.fonts.load('600 17px "Barlow Condensed"')]).catch(()=>{}):Promise.resolve();
  Promise.race([fontsReady,new Promise(r=>setTimeout(r,1500))]).then(boot)}
