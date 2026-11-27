'use strict';
/* =================================================================
   SKIRESORT: what makes the ski resort look and feel alive (js/ski.js has the trip, the skier, the cameras and the sounds):
   the groomed corduroy on every piste (glossy where it is icy, untouched snow along the edges, glitter in the snow), old ski
   tracks, the start gates with their wands, red safety nets, the finish areas with a fence, cheering spectators and a timing
   board, the piste map at the top, snow cannons blowing mist, other skiers on the easy piste, people in the chairlift and the
   ghost of your best run. Built from the level (LV.pistes, LV.fx, the lift) by buildSki → buildResort when the level loads.
   Loaded after js/ski.js; uses the globals of game.js (scene, levelGroup, camera, state, LV …) and ski.js (SKI, LIFT, figureGeo).
   ================================================================= */
const RS={wands:[],crowd:null,boards:[],guns:[],npcs:[],ghost:null,mistMat:null};

/* ---------- glitter in the snow (any level with snow:true, high graphics) ---------- */
// tiny bright specks on white ground that twinkle as the camera moves
const sparkleU={value:0};
terrainMat.onBeforeCompile=sh=>{sh.uniforms.uSparkle=sparkleU;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSpW;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSpW=(modelMatrix*vec4(position,1.0)).xyz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uSparkle;varying vec3 vSpW;\nfloat spHash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}')
    .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nif(uSparkle>0.0){float w=min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b));float h=spHash(floor(vSpW*38.0)+floor(cameraPosition*2.5));totalEmissiveRadiance+=vec3(step(0.9965,h)*smoothstep(0.62,0.8,w)*1.6*uSparkle);}')};

/* ---------- the corduroy ---------- */
// one groomer pass across (u 0…1): ridges and grooves, and a fluffy seam where two passes meet; the tiller's faint chatter along (v)
function corduroyTex(){const W=256,c=document.createElement('canvas');c.width=c.height=W;const x=c.getContext('2d'),img=x.createImageData(W,W),d=img.data,r=mulberry32(11),al=new Float32Array(W);
  for(let j=0;j<W;j++)al[j]=r();
  for(let j=0;j<W;j++)for(let i=0;i<W;i++){const u=i/W,ridge=.5+.5*Math.cos((u*28%1)*2*Math.PI),seam=Math.max(0,1-Math.min(u,1-u)*W/6),k=(j*W+i)*4,b=208+ridge*40+(al[j]-.5)*10+seam*14+(r()-.5)*6;
    d[k]=Math.min(255,b-6);d[k+1]=Math.min(255,b-2);d[k+2]=Math.min(255,b+6);d[k+3]=255}
  x.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;t.encoding=THREE.sRGBEncoding;return t}
function corduroyNormal(){const W=256,c=document.createElement('canvas');c.width=c.height=W;const x=c.getContext('2d'),img=x.createImageData(W,W),d=img.data;
  for(let j=0;j<W;j++)for(let i=0;i<W;i++){const u=i/W,s=-Math.sin((u*28%1)*2*Math.PI)*.55,k=(j*W+i)*4,l=Math.hypot(s,1);d[k]=(s/l*.5+.5)*255;d[k+1]=128;d[k+2]=(1/l*.5+.5)*255;d[k+3]=255}
  x.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;return t}
const pisteMat=new THREE.MeshStandardMaterial({map:corduroyTex(),normalMap:corduroyNormal(),normalScale:new THREE.Vector2(.7,.7),roughness:.82,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
// per vertex: fade (0 at the untouched edges, under jumps and moguls) and ice (glossy and blue)
pisteMat.onBeforeCompile=sh=>{sh.uniforms.uSparkle=sparkleU;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float fade;attribute float ice;varying float vFade;varying float vIce;varying vec3 vSpW;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nvFade=fade;vIce=ice;vSpW=(modelMatrix*vec4(position,1.0)).xyz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uSparkle;varying float vFade;varying float vIce;varying vec3 vSpW;\nfloat spHash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}')
    .replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.62,0.76,0.86)*(0.8+0.25*diffuseColor.r),vIce*0.8);diffuseColor.a*=vFade*(0.86+0.1*vIce);')
    .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,0.14,vIce);')
    .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nif(uSparkle>0.0){float h=spHash(floor(vSpW*38.0)+floor(cameraPosition*2.5));totalEmissiveRadiance+=vec3(step(0.996,h)*1.4*uSparkle*(1.0-0.6*vIce));}')};
// the surface of one piste: the terrain's own grid cells under it (so it fits the snow exactly), with u across the groomer passes and
// v along the line
function pisteSurface(k){const hw=k.hw,R=hw+.4,n=k.pts.length,near=new Map(),passes=Math.max(1,Math.round(2*hw/2.3)),pw=2*hw/passes;
  for(let i=0;i<n;i++){const q=k.pts[i];cellsIn(q.x-R,q.z-R,q.x+R,q.z+R,(kk,px,pz)=>{const d=Math.hypot(px-q.x,pz-q.z);if(d>R)return;const b=near.get(kk);if(!b||d<b[0])near.set(kk,[d,i,px,pz])})}
  const inR=(a,t)=>a.some(r=>t>=r[0]&&t<=r[1]),idx=new Map(),pos=[],nrm=[],uv=[],fade=[],ice=[];
  const ramp=(t,a)=>{let m=0;for(const r of a){const e=.025;m=Math.max(m,Math.min(sm1((t-r[0]+e)/(2*e)),sm1((r[1]+e-t)/(2*e))))}return m};
  for(const[kk,[d,i,px,pz]]of near){const q=k.pts[i],q2=k.pts[Math.min(n-1,i+1)],q1=k.pts[Math.max(0,i-1)];let tx=q2.x-q1.x,tz=q2.z-q1.z;const tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;
    const lat=(px-q.x)*tz-(pz-q.z)*tx,t=i/(n-1);let f=sm1((hw+.15-d)/.45)*(1-.85*ramp(t,k.moguls.map(m=>[m.t0,m.t1])));
    for(const kc of k.kickers){const rx=px-kc.x,rz=pz-kc.z,a=rx*kc.tx+rz*kc.tz;if(a>-kc.len-.3&&a<kc.land&&Math.abs(rx*kc.tz-rz*kc.tx)<kc.w+.6)f*=a<-kc.len?.6:.2}
    idx.set(kk,pos.length/3);pos.push(px,TH[kk]+.004,pz);nrm.push(tNrm[kk*3],tNrm[kk*3+1],tNrm[kk*3+2]);uv.push((lat+hw)/pw,t*k.len/2.4);fade.push(f);ice.push(TS[kk]===S.ICE?1:0)}
  const ind=[];for(const kk of near.keys()){const i=kk%N;if(i>=N-1)continue;const a=idx.get(kk),b=idx.get(kk+1),c=idx.get(kk+N),d=idx.get(kk+N+1);if(a==null||b==null||c==null||d==null)continue;ind.push(a,c,b,b,c,d)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nrm,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setAttribute('fade',new THREE.Float32BufferAttribute(fade,1));g.setAttribute('ice',new THREE.Float32BufferAttribute(ice,1));g.setIndex(ind);g.computeBoundingSphere();
  const m=new THREE.Mesh(g,pisteMat);m.receiveShadow=true;levelGroup.add(m)}

/* ---------- old ski tracks: other skiers' S-turns down every piste, converging through the slalom gates ---------- */
function oldTracks(lv){const L=[],r=mulberry32(77),dir=new V3(),nv=new V3(),q=new Q4(),qy=new Q4(),m4=new THREE.Matrix4(),p=new V3(),sc=new V3(1,1,1);
  for(const k of lv.pistes){const nT=k.kind==='slalom'?7:Math.round(4+k.len/20),slalom=k.kind==='slalom';
    for(let j=0;j<nT;j++){const A=slalom?.15+r()*.25:.5+r()*(k.hw-1.1),lam=slalom?3+r():2.6+r()*2.2,ph=r()*6.3,c0=(r()-.5)*(k.hw-A-.4)*2*(slalom?.3:1),on0=r()*.3,on1=.75+r()*.25,wid=r()<.3?1.8:1;
      for(let s=on0*k.len;s<on1*k.len;s+=.22){const t=s/k.len,P=k.P(t),sd=k.side(t),off=c0+A*Math.sin(s/lam*2*Math.PI+ph),slope=A*2*Math.PI/lam*Math.cos(s/lam*2*Math.PI+ph),T=k.T(t);
        if(k.kickers.some(kc=>Math.abs(t-kc.t)*k.len<kc.land))continue;
        dir.set(T.x+sd.x*slope,0,T.z+sd.z*slope).normalize();for(const e of[-.075,.075]){const x=P.x+sd.x*off+dir.z*e,z=P.z+sd.z*off-dir.x*e;
          normalAt(x,z,nv);p.set(x,H(x,z)+.007,z).addScaledVector(nv,.004);q.setFromUnitVectors(YAX,nv);qy.setFromAxisAngle(YAX,Math.atan2(dir.x,dir.z));q.multiply(qy);sc.set(wid,1,.85);m4.compose(p,q,sc);L.push(m4.clone())}}}}
  if(!L.length)return;const im=new THREE.InstancedMesh(grvGeo,new THREE.MeshBasicMaterial({color:LIN('#9fb3c3'),transparent:true,opacity:.17,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}),L.length);
  L.forEach((m,i)=>im.setMatrixAt(i,m));im.renderOrder=1;im.frustumCulled=false;levelGroup.add(im)}

/* ---------- the start: two posts and a wand you push through (the clock starts) ---------- */
function startGate(k){const s0=k.start.p,tn=k.start.tan,sd=k.side(0),y=H(s0.x,s0.z),dark=new THREE.MeshStandardMaterial({color:LIN('#3a3f44'),roughness:.5}),wandM=new THREE.MeshStandardMaterial({color:LIN('#f2c230'),roughness:.4});
  const post=(l)=>{const m=new THREE.Mesh(cylGeo,dark);m.scale.set(.028,.6,.028);m.position.set(s0.x+sd.x*l,H(s0.x+sd.x*l,s0.z+sd.z*l)+.3,s0.z+sd.z*l);m.castShadow=true;levelGroup.add(m);return m};
  post(.45);post(-.45);const box=new THREE.Mesh(boxGeo,new THREE.MeshStandardMaterial({color:LIN('#d9432f'),roughness:.5}));box.scale.set(.1,.14,.08);box.position.set(s0.x+sd.x*.45,y+.6,s0.z+sd.z*.45);levelGroup.add(box);
  // the wand: hinged at the left post, it swings forward when the skier pushes through and springs back
  const hinge=new THREE.Group();hinge.position.set(s0.x+sd.x*.45,y+.27,s0.z+sd.z*.45);hinge.rotation.y=Math.atan2(tn.x,tn.z);const w=new THREE.Mesh(boxGeo,wandM);w.scale.set(.88,.025,.025);w.position.set(-.44,0,0);hinge.add(w);levelGroup.add(hinge);
  RS.wands.push({k,hinge,a:0,t:-1})}
function resortWand(){const w=RS.wands.find(o=>o.k===SKI.k);if(w)w.t=0}

/* ---------- red safety nets on the outside of the fast bends ---------- */
function netTex(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.strokeStyle='#ffffff';x.lineWidth=3;
  for(let i=0;i<=64;i+=16){x.beginPath();x.moveTo(i,0);x.lineTo(i,64);x.stroke();x.beginPath();x.moveTo(0,i);x.lineTo(64,i);x.stroke()}x.fillRect(0,0,64,7);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t}
function buildNets(lv){const pos=[],uv=[],ind=[],posts=[];
  for(const k of lv.pistes)for(const L of k.nets){let u=0;L.forEach((p,i)=>{if(i)u+=Math.hypot(p.x-L[i-1].x,p.z-L[i-1].z);const b=pos.length/3;pos.push(p.x,p.y+.04,p.z,p.x,p.y+.95,p.z);uv.push(u/.6,0,u/.6,1.6);if(i)ind.push(b-2,b,b-1,b-1,b,b+1);if(i%2===0)posts.push(p)})}
  if(!pos.length)return;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:LIN('#e2361c'),map:netTex(),alphaTest:.5,side:THREE.DoubleSide,roughness:.8}));m.castShadow=true;levelGroup.add(m);
  const im=new THREE.InstancedMesh(cylGeo,new THREE.MeshStandardMaterial({color:LIN('#2a2c2e'),roughness:.6}),posts.length),m4=new THREE.Matrix4(),q=new Q4(),sc=new V3(.025,1.05,.025),pp=new V3();
  posts.forEach((p,i)=>{pp.set(p.x,p.y+.5,p.z);m4.compose(pp,q,sc);im.setMatrixAt(i,m4)});im.castShadow=true;levelGroup.add(im)}

/* ---------- the finish areas: spectators behind the fence and a timing board ---------- */
// a spectator is three instanced meshes: the jacket and hat (coloured per person), the rest (legs, boots, face, scarf) and the arms,
// which are raised when they cheer. All the finish areas of the level share them: three draw calls for the whole crowd.
function partsGeo(parts){const pos=[],nrm=[],col=[],m4=new THREE.Matrix4(),q=new Q4(),e=new THREE.Euler(),cc=new THREE.Color();
  for(const p of parts){const g=(p.sph?new THREE.SphereGeometry(1,8,6):new THREE.BoxGeometry(1,1,1)).toNonIndexed();e.set(p.rx||0,0,0);q.setFromEuler(e);m4.compose(new V3(...p.p),q,new V3(...p.s));g.applyMatrix4(m4);cc.set(p.c||'#ffffff').convertSRGBToLinear();
    const P=g.attributes.position.array,Nn=g.attributes.normal.array;for(let i=0;i<P.length;i+=3){pos.push(P[i],P[i+1],P[i+2]);nrm.push(Nn[i],Nn[i+1],Nn[i+2]);col.push(cc.r,cc.g,cc.b)}g.dispose()}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nrm,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeBoundingSphere();return g}
const crowdGeo={
  jacket:partsGeo([{p:[0,.44,0],s:[.2,.26,.13]},{p:[0,.665,0],s:[.072,.05,.072],sph:true}]),
  rest:partsGeo([{p:[.05,.16,0],s:[.075,.3,.09],c:'#26303c'},{p:[-.05,.16,0],s:[.075,.3,.09],c:'#26303c'},{p:[.05,.03,.02],s:[.085,.06,.13],c:'#1d1c1a'},{p:[-.05,.03,.02],s:[.085,.06,.13],c:'#1d1c1a'},
    {p:[0,.615,0],s:[.06,.062,.06],sph:true,c:'#d9a07a'},{p:[0,.565,0],s:[.13,.04,.13],c:'#f2f2ee'}]),
  arm:partsGeo([{p:[0,-.11,0],s:[.055,.24,.06]},{p:[0,-.24,0],s:[.05,.05,.05],sph:true,c:'#1d1c1a'}])};   // the arm hangs from the shoulder (origin)
const crowdMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8});
const JACKETS=['#d9432f','#2f6fd6','#f2c230','#3fae3a','#e86a1e','#7a3fae','#1d1c1a','#e83e8c','#20a4a4','#f4f4f0'];
function buildCrowd(lv){const L=[];const r=mulberry32(5),lo=state.gfx!=='hi';
  for(const k of lv.pistes){const fa=k.finishArea;if(!fa)continue;fa.crowd.forEach((o,i)=>{if(lo&&i%2)return;L.push({k,x:o.x,y:o.y,z:o.z,face:o.face+(r()-.5)*.6,ph:r()*6.3,s:r()<.15?.62:.86+r()*.22,col:JACKETS[Math.floor(r()*JACKETS.length)],hype:0})})}
  RS.crowd=null;if(!L.length)return;
  const mk=(geo,n)=>{const im=new THREE.InstancedMesh(geo,crowdMat,n);im.castShadow=true;im.frustumCulled=false;im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);levelGroup.add(im);return im};
  const C={L,jacket:mk(crowdGeo.jacket,L.length),rest:mk(crowdGeo.rest,L.length),arms:mk(crowdGeo.arm,L.length*2)},cc=new THREE.Color();
  L.forEach((o,i)=>{cc.set(o.col).convertSRGBToLinear();C.jacket.setColorAt(i,cc);cc.set('#ffffff');C.rest.setColorAt(i,cc);cc.set(o.col).convertSRGBToLinear();C.arms.setColorAt(i*2,cc);C.arms.setColorAt(i*2+1,cc)});
  RS.crowd=C;posCrowd(0,true)}
const _cm=new THREE.Matrix4(),_cm2=new THREE.Matrix4(),_cq=new Q4(),_ce=new THREE.Euler(),_cp=new V3(),_cs=new V3();
// they bob, sway and wave; they go wild when the skier comes towards their finish and when they cross the line
function posCrowd(dt,all){const C=RS.crowd;if(!C)return;const t=performance.now()*.001,s=SKI.s;
  for(let i=0;i<C.L.length;i++){const o=C.L[i];if(!all&&Math.abs(o.x-camera.position.x)+Math.abs(o.z-camera.position.z)>45)continue;
    let want=.15;if(SKI.on&&SKI.k===o.k&&(SKI.phase==='run'||SKI.phase==='done')){const f=o.k.gates[o.k.gates.length-1].c,d=Math.hypot(f.x-s.pos.x,f.z-s.pos.z);want=Math.max(want,1-sm1((d-2)/14),Math.min(1,SKI.cheer))}
    o.hype+=(want-o.hype)*Math.min(1,dt*3);const e=o.hype,bob=e*.07*Math.abs(Math.sin(t*7+o.ph))+.006*Math.sin(t*1.3+o.ph);
    _ce.set(0,o.face+.12*Math.sin(t*.7+o.ph),.05*Math.sin(t*1.1+o.ph)*(1-e));_cq.setFromEuler(_ce);_cp.set(o.x,o.y+bob,o.z);_cs.setScalar(o.s);_cm.compose(_cp,_cq,_cs);C.jacket.setMatrixAt(i,_cm);C.rest.setMatrixAt(i,_cm);
    for(const sd of[1,-1]){const raise=e*(2.4+.5*Math.sin(t*9+o.ph+sd))+(1-e)*.08;_ce.set(-raise*.85,0,sd*(.15+e*.35));_cq.setFromEuler(_ce);_cp.set(sd*.125,.55,0);_cs.set(1,1,1);_cm2.compose(_cp,_cq,_cs);C.arms.setMatrixAt(i*2+(sd>0?0:1),_cm2.premultiply(_cm))}}
  C.jacket.instanceMatrix.needsUpdate=C.rest.instanceMatrix.needsUpdate=C.arms.instanceMatrix.needsUpdate=true}
// the timing board at every finish: the name, the time as you come in (or your best), and how it compares
function boardDraw(b,o){const x=b.ctx,W=512,Hh=256,col=PISTE_COL[b.k.def.color??b.k.diff];x.fillStyle='#14120E';x.fillRect(0,0,W,Hh);x.fillStyle=col;x.fillRect(0,0,W,46);x.fillStyle=col==='#1d1c1a'?'#f2e8d0':'#14120E';
  x.font='700 34px "Barlow Condensed",sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(b.k.name.toUpperCase(),W/2,24);
  x.textAlign='center';x.fillStyle='#ffd27a';x.font='110px "Saira Stencil One", Impact, sans-serif';x.fillText(o.big,W/2,128);x.font='600 36px "Barlow Condensed",sans-serif';x.fillStyle=o.col||'#f2e8d0';x.fillText(o.small||'',W/2,212);b.tex.needsUpdate=true}
function boardIdle(b){const bt=best[skiKey(b.k)];boardDraw(b,{big:bt?(b.k.kind==='hopp'?bt.pts+'':fmtTime(bt.t).replace('.',',')):'–:––,–',small:bt?(b.k.kind==='hopp'?'BESTE POENG':'BESTE TID'):'INGEN TID ENNÅ'})}
function buildBoards(lv){RS.boards=[];for(const k of lv.pistes){const fa=k.finishArea;if(!fa)continue;const bd=fa.board,c=document.createElement('canvas');c.width=512;c.height=256;const tex=new THREE.CanvasTexture(c);tex.encoding=THREE.sRGBEncoding;
  const g=new THREE.Group();g.position.set(bd.x,bd.y,bd.z);g.rotation.y=bd.ry;const frame=new THREE.Mesh(boxGeo,new THREE.MeshStandardMaterial({color:LIN('#2a2c2e'),roughness:.6}));frame.scale.set(1.62,.86,.08);frame.position.set(0,1.32,0);frame.castShadow=true;g.add(frame);
  const scr=new THREE.Mesh(new THREE.PlaneGeometry(1.5,.75),new THREE.MeshBasicMaterial({map:tex,toneMapped:false}));scr.position.set(0,1.32,.045);g.add(scr);levelGroup.add(g);
  const b={k,ctx:c.getContext('2d'),tex,t:0,live:false};RS.boards.push(b);boardIdle(b)}}
// ski.js: the run starts (k) or the trip ends (null); a result comes in
function resortRun(k){for(const b of RS.boards){b.live=b.k===k;if(!b.live)boardIdle(b)}for(const w of RS.wands){w.t=-1;w.a=0;w.hinge.rotation.y=Math.atan2(w.k.start.tan.x,w.k.start.tan.z)}}
function resortBoard(k,o){const b=RS.boards.find(q=>q.k===k);if(!b)return;b.live=false;const hopp=k.kind==='hopp';
  const big=hopp?o.pts+'':fmtTime(o.t).replace('.',','),d=o.best==null?null:(hopp?o.pts-o.best:o.t-o.best);
  boardDraw(b,{big,small:o.isBest?(o.best==null?'FØRSTE TUR':'NY REKORD!'):d==null?'':(hopp?(d>=0?'+':'')+d+' POENG':(d<=0?'−':'+')+Math.abs(d).toFixed(2).replace('.',',')+' MOT BESTE'),col:o.isBest?'#8bbb4a':'#f2e8d0'})}
function updateBoards(dt){for(const b of RS.boards){if(!b.live||!SKI.run)continue;b.t-=dt;if(b.t>0)continue;b.t=.15;const run=SKI.run,hopp=b.k.kind==='hopp';
  boardDraw(b,{big:hopp?String(run.points):fmtTime(run.time+run.pen).replace('.',','),small:run.started?(hopp?'POENG':'PÅ VEI NED'):'KLAR'})}}

/* ---------- the piste map at the top ---------- */
function trailMapTex(lv){const W=512,Hh=284,c=document.createElement('canvas');c.width=W;c.height=Hh;const x=c.getContext('2d'),pts=[];
  for(const k of lv.pistes)for(let i=0;i<k.pts.length;i+=10)pts.push(k.pts[i]);const L=lv.liftDef;if(L)pts.push({x:L.ax,z:L.az},{x:L.bx,z:L.bz});
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const p of pts){x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);z0=Math.min(z0,p.z);z1=Math.max(z1,p.z)}
  const sc=Math.min((W-60)/(x1-x0),(Hh-80)/(z1-z0)),cx=(x0+x1)/2,cz=(z0+z1)/2,X=wx=>W/2-(wx-cx)*sc,Y=wz=>Hh/2+14-(wz-cz)*sc;   // north up, east (−x) to the right, as the island map
  const g=x.createLinearGradient(0,0,0,Hh);g.addColorStop(0,'#cfe2f2');g.addColorStop(1,'#f4f8fb');x.fillStyle=g;x.fillRect(0,0,W,Hh);
  x.fillStyle='#14120E';x.fillRect(0,0,W,34);x.fillStyle='#f2e8d0';x.font='700 24px "Barlow Condensed",sans-serif';x.textAlign='left';x.textBaseline='middle';x.fillText('GAUTEFALL · LØYPEKART',12,18);
  x.lineCap='round';x.lineJoin='round';
  for(const k of lv.pistes){const P=k.pts.filter((_,i)=>i%5===0);const line=()=>{x.beginPath();P.forEach((p,i)=>i?x.lineTo(X(p.x),Y(p.z)):x.moveTo(X(p.x),Y(p.z)));x.stroke()};
    x.strokeStyle='#ffffff';x.lineWidth=12;line();x.strokeStyle=PISTE_COL[k.def.color??k.diff];x.lineWidth=6;line();
    const e=P[Math.floor(P.length*.55)];x.font='700 17px "Barlow Condensed",sans-serif';x.textAlign='center';x.lineWidth=4;x.strokeStyle='rgba(255,255,255,.9)';x.strokeText(k.name,X(e.x),Y(e.z)-12);x.fillStyle='#14120E';x.fillText(k.name,X(e.x),Y(e.z)-12)}
  if(L){x.strokeStyle='#14120E';x.lineWidth=2.5;x.setLineDash([6,4]);x.beginPath();x.moveTo(X(L.ax),Y(L.az));x.lineTo(X(L.bx),Y(L.bz));x.stroke();x.setLineDash([]);
    const ex=X(L.bx+L.ux*1.6),ey=Y(L.bz+L.uz*1.6);x.fillStyle='#d9432f';x.beginPath();x.arc(ex,ey,7,0,7);x.fill();x.fillStyle='#14120E';x.font='700 15px "Barlow Condensed",sans-serif';x.fillText('DU ER HER',ex,ey+18)}
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t}

/* ---------- snow cannons: a plume of mist blown over the piste ---------- */
function buildGuns(lv){RS.guns=[];const n=state.gfx==='hi'?14:4;if(!RS.mistMat)RS.mistMat=new THREE.SpriteMaterial({map:dustTex,color:LIN('#d3e0ea'),transparent:true,depthWrite:false,opacity:.3});
  for(const f of lv.fx){if(f.type!=='snowgun')continue;const L=[];for(let i=0;i<n;i++){const sp=new THREE.Sprite(RS.mistMat.clone());sp.visible=false;levelGroup.add(sp);L.push({s:sp,t:i/n})}RS.guns.push({f,L})}}
function updateGuns(dt){for(const g of RS.guns){const f=g.f,far=Math.abs(f.x-camera.position.x)+Math.abs(f.z-camera.position.z)>50;for(const o of g.L){o.s.visible=!far;if(far)continue;o.t=(o.t+dt/2.6)%1;const u=o.t;
  o.s.position.set(f.x+Math.sin(f.dir)*u*3.6+.3*Math.sin(u*5),f.y+u*1.1-u*u*.7,f.z+Math.cos(f.dir)*u*3.6);o.s.scale.setScalar(.3+u*2.2);o.s.material.opacity=.6*(1-u)*Math.min(1,u*8)}}}

/* ---------- other skiers on the easy pistes, and people riding the chairlift ---------- */
const NPC_COLS=['#2f6fd6','#f2c230','#3fae3a','#e86a1e','#7a3fae','#20a4a4','#e83e8c'];
function buildNpcs(lv){RS.npcs=[];const r=mulberry32(21),mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.6});
  for(const k of lv.pistes){if(k.kind!=='fri')continue;const n=state.gfx==='hi'?3:2;
    for(let i=0;i<n;i++){const col=NPC_COLS[Math.floor(r()*NPC_COLS.length)],m=new THREE.Mesh(figureGeo(col,{c:.25,inc:0},{helmet:['#f2f2ee','#1d1c1a','#d9432f'][i%3],ski:['#d9432f','#2f6fd6','#f2f2ee'][i%3]}),mat);
      m.castShadow=true;m.rotation.order='YXZ';levelGroup.add(m);RS.npcs.push({k,m,t:(i+.15)/n,sp:2.1+r()*.9,A:.6+r()*(k.hw-1.2),lam:3+r()*1.5,ph:r()*6.3,x:0,z:0,y:0,head:0,inc:0,vx:0,vz:0,down:0})}}}
function updateNpcs(dt){for(const o of RS.npcs){const k=o.k;if(o.down>0){o.down-=dt;o.m.rotation.z=(o.down>.3?1.3:1.3*o.down/.3)*(o.inc>0?-1:1);continue}
  o.t+=o.sp*dt/k.len;if(o.t>=.985){o.t=0;o.ph=Math.random()*6.3}   // at the bottom they ride up again (they reappear at the top)
  const s=o.t*k.len,P=k.P(o.t),sd=k.side(o.t),off=o.A*Math.sin(s/o.lam*2*Math.PI+o.ph),x=P.x+sd.x*off,z=P.z+sd.z*off,dx=x-o.x,dz=z-o.z,l=Math.hypot(dx,dz);
  if(l>1e-4&&l<1){const h=Math.atan2(dx,dz);let dh=h-o.head;dh=Math.atan2(Math.sin(dh),Math.cos(dh));o.inc+=(Math.max(-.7,Math.min(.7,dh/dt*o.sp/SKI_G))-o.inc)*Math.min(1,dt*5);o.head=h;o.vx=dx/dt;o.vz=dz/dt}else{o.head=Math.atan2(k.T(o.t).x,k.T(o.t).z);o.vx=o.vz=0}
  o.x=x;o.z=z;o.y=H(x,z);const fx=Math.sin(o.head),fz=Math.cos(o.head),slope=Math.atan2(H(x+fx*.3,z+fz*.3)-H(x-fx*.3,z-fz*.3),.6);
  o.m.position.set(x,o.y,z);o.m.rotation.set(-slope,o.head,-o.inc);o.m.visible=Math.abs(x-camera.position.x)+Math.abs(z-camera.position.z)<75}}
// the player's skier against the others: a light touch pushes you apart, a real collision takes you both down (returns true).
// easy: no fall, a real collision only pushes you aside and slows you a little (once a second per skier)
function resortHit(s,easy){if(s.air)return false;for(const o of RS.npcs){if(o.down>0)continue;const dx=s.pos.x-o.x,dz=s.pos.z-o.z,d=Math.hypot(dx,dz);if(d>.38||Math.abs(s.pos.y-o.y)>.6||d<1e-4)continue;
  const rv=Math.hypot(s.vel.x-o.vx,s.vel.z-o.vz);if(rv>2.4){if(!easy){o.down=1.6;return true}const t=performance.now();if(!(o.bumpT>t)){o.bumpT=t+1000;s.vel.x*=.75;s.vel.z*=.75;toast('Oi! Pass på de andre i bakken')}}s.pos.x+=dx/d*(.38-d);s.pos.z+=dz/d*(.38-d)}return false}
function buildRiders(){if(!LIFT)return;const r=mulberry32(33),mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.6}),geos=NPC_COLS.slice(0,state.gfx==='hi'?4:2).map(c=>figureGeo(c,{seated:true}));
  LIFT.chairs.forEach((c,i)=>{if(i===0||r()>.45)return;for(const x of r()<.4?[.24,-.24]:[r()<.5?.24:-.24]){const m=new THREE.Mesh(geos[Math.floor(r()*geos.length)],mat);m.position.set(x,-LIFT.L.hang+.03,.06);m.castShadow=true;c.sw.add(m)}})}

/* ---------- the ghost of your best run ---------- */
function buildGhost(){if(RS.ghost)return;const mat=new THREE.MeshStandardMaterial({vertexColors:true,color:LIN('#cfeeff'),emissive:LIN('#3a6a8a'),transparent:true,opacity:.38,depthWrite:false,roughness:.5});
  const mk=P=>{const m=new THREE.Mesh(figureGeo('#9fd2ff',P,{pants:'#9fd2ff',helmet:'#ffffff',ski:'#ffffff'}),mat);m.rotation.order='YXZ';m.visible=false;m.renderOrder=3;scene.add(m);return m};
  RS.ghost={up:mk({c:.2}),tuck:mk({c:.2,tk:1})}}
function resortGhost(g){if(!RS.ghost)buildGhost();const G2=RS.ghost;if(!g){G2.up.visible=G2.tuck.visible=false;return}
  const m=g.tuck>.5?G2.tuck:G2.up;(m===G2.up?G2.tuck:G2.up).visible=false;m.visible=true;const fx=Math.sin(g.head),fz=Math.cos(g.head),slope=Math.atan2(H(g.x+fx*.3,g.z+fz*.3)-H(g.x-fx*.3,g.z-fz*.3),.6);
  m.position.set(g.x,g.y,g.z);m.rotation.set(-slope,g.head,-g.inc*.8)}

/* ---------- build and update ---------- */
function buildResort(lv){RS.wands=[];RS.crowd=null;RS.boards=[];RS.guns=[];RS.npcs=[];if(RS.ghost)resortGhost(null);
  const def=LEVELS[state.levelIdx];sparkleU.value=def.snow&&state.gfx==='hi'?1:0;
  if(!lv.pistes||!lv.pistes.length)return;
  for(const k of lv.pistes){pisteSurface(k);startGate(k)}
  oldTracks(lv);buildNets(lv);buildCrowd(lv);buildBoards(lv);buildGuns(lv);buildNpcs(lv);buildRiders();
  for(const f of lv.fx)if(f.type==='trailmap'){const m=new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.0),new THREE.MeshStandardMaterial({map:trailMapTex(lv),roughness:.7}));m.position.set(f.x,f.y,f.z);m.rotation.y=f.ry;levelGroup.add(m)}}
function updateResort(dt){if(!RS.wands.length)return;sparkleU.value=LEVELS[state.levelIdx].snow&&state.gfx==='hi'?1:0;
  // the wand swings open as the skier pushes through and springs back
  for(const w of RS.wands){if(w.t<0)continue;w.t+=dt;const u=w.t;w.a=u<.12?1.35*u/.12:Math.max(0,1.35*Math.exp(-(u-.12)*3.5)*Math.cos((u-.12)*7));w.hinge.rotation.y=Math.atan2(w.k.start.tan.x,w.k.start.tan.z)+w.a;if(u>1.6){w.t=-1;w.hinge.rotation.y=Math.atan2(w.k.start.tan.x,w.k.start.tan.z)}}
  posCrowd(dt);updateBoards(dt);updateGuns(dt);updateNpcs(dt)}
