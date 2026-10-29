'use strict';
/* =================================================================
   BOAT: the motorboat race from Captain Theis' marina on Tromøya (made from the game «Captain Theis Motorbåtløp»).
   Park on the blue square at the marina → «Vil du kjøre båt?» → the boat menu (race, one or two players) → the race at sea → the result → back to the car.
   The sea is a scene of its own, drawn by the same renderer while the car waits at the marina. The physics is in js/boatsim.js, the sea and the races in data/boats.js.
   Two players on one screen share the keyboard (WASD and the arrows) on a split screen. In a «Kjør sammen» room the others can join a race:
   everyone steers their own boat and sees the others' boats (the messages go through js/net.js). No racing boat is steered by the computer.
   Loaded after ski.js; uses the globals of game.js, world.js and net.js (state, renderer, AC, prof, best, NET …) at run time.
   ================================================================= */
const BT={on:false,phase:'',fade:null,built:false,scene:null,cam:null,dir:null,sky:null,sun:null,water:null,wu:null,foam:[],torches:[],lamps:[],clouds:[],gulls:[],parts:[],
  smokers:[],docks:{},treasure:null,gates:[],gateGrp:null,barrels:[],barVis:[],pir:[],pirVis:[],balls:[],ballVis:[],vol:null,W:null,
  race:null,route:null,two:false,P:[],acc:0,step:0,time:0,wave:0,goAt:0,beat:0,introT:0,winner:null,winT:0,fireT:0,coins:false,result:false,paused:false,
  snd:null,gullT:3,isl:[],remote:new Map(),net:null,invite:null,sendT:0,hudT:0,marina:null,focus:new THREE.Vector3()};
const B_SUN=new THREE.Vector3(.45,.55,.7).normalize(),B_FOG=new THREE.Color(0xbfe0f0),B_FAR=2600;   // the fog has hidden everything by 2100, so the cameras stop at 2600 and the sky sits inside that
const brand=(a,b)=>a+Math.random()*(b-a);
const bHead=(a,o=new THREE.Vector3())=>o.set(-Math.sin(a),0,-Math.cos(a)),bRight=(a,o=new THREE.Vector3())=>o.set(Math.cos(a),0,-Math.sin(a));
const bWave=(x,z,t)=>Math.sin(x*.02+t)*.8+Math.sin(z*.015+t*.8)*.8+Math.sin((x+z)*.05+t*2)*.3;
const bStd=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,flatShading:true},o||{}));
function bAdd(g,geo,mat,x,y,z,cast=true){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=cast;m.receiveShadow=true;g.add(m);return m}
const boatKey=r=>'verden/baat/'+r.id;
const boatDone=()=>BOAT_RACES.filter(r=>best[boatKey(r)]).length;

/* ---------- textures ---------- */
let BTEX=null;
function bTex(w,h,draw,srgb=true){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);if(srgb)t.encoding=THREE.sRGBEncoding;return t}
function bText(text,w,h,font,fg,bg,stroke){return bTex(w,h,x=>{if(bg){x.fillStyle=bg;x.fillRect(0,0,w,h)}if(stroke){x.strokeStyle=stroke;x.lineWidth=6;x.strokeRect(3,3,w-6,h-6)}x.fillStyle=fg;x.font=font;x.textAlign='center';x.textBaseline='middle';x.fillText(text,w/2,h/2+2)})}
function bMakeTex(){const soft=bTex(64,64,x=>{const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.5,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64)},false);
  const jolly=bTex(256,160,x=>{x.fillStyle='#0d0d0d';x.fillRect(0,0,256,160);x.fillStyle='#f4f4f4';x.beginPath();x.ellipse(128,62,36,32,0,0,Math.PI*2);x.fill();x.fillRect(104,82,48,22);x.fillStyle='#0d0d0d';
    x.beginPath();x.ellipse(114,60,9,11,0,0,Math.PI*2);x.fill();x.beginPath();x.ellipse(142,60,9,11,0,0,Math.PI*2);x.fill();x.beginPath();x.moveTo(128,72);x.lineTo(122,84);x.lineTo(134,84);x.fill();
    for(let i=0;i<4;i++)x.fillRect(110+i*10,94,3,10);x.strokeStyle='#f4f4f4';x.lineWidth=10;x.lineCap='round';x.beginPath();x.moveTo(60,120);x.lineTo(196,145);x.moveTo(196,120);x.lineTo(60,145);x.stroke()});
  const sail=bTex(128,128,x=>{x.fillStyle='#1a1214';x.fillRect(0,0,128,128);x.fillStyle='#8e1b1b';for(let i=0;i<128;i+=32)x.fillRect(0,i,128,12);x.fillStyle='rgba(0,0,0,.25)';for(let i=0;i<40;i++)x.fillRect(Math.random()*128,Math.random()*128,6,2)});
  sail.wrapS=sail.wrapT=THREE.RepeatWrapping;sail.repeat.set(2,2);
  return{soft,square:bTex(8,8,x=>{x.fillStyle='#fff';x.fillRect(0,0,8,8)},false),jolly,sail,flag:bFlagTex()}}
const bFlagTex=()=>bTex(256,160,x=>{x.fillStyle='#ba0c2f';x.fillRect(0,0,256,160);x.fillStyle='#fff';x.fillRect(60,0,40,160);x.fillRect(0,60,256,40);x.fillStyle='#00205b';x.fillRect(72,0,16,160);x.fillRect(0,72,256,16)});

/* ---------- the sea: sky, water, light ---------- */
function buildSea(){if(BT.built)return;BT.built=true;if(!BTEX)BTEX=bMakeTex();
  const S=BT.scene=new THREE.Scene();S.fog=new THREE.Fog(B_FOG,350,2100);BT.cam=new THREE.PerspectiveCamera(58,1,1,B_FAR);
  S.add(new THREE.HemisphereLight(0xcfe8ff,0x2a5f8a,.55));
  const L=BT.dir=new THREE.DirectionalLight(0xffe2b0,1.35);L.castShadow=true;L.shadow.mapSize.set(2048,2048);Object.assign(L.shadow.camera,{near:50,far:1800,left:-380,right:380,top:380,bottom:-380});L.shadow.bias=-.0015;S.add(L,L.target);
  const sky=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{horizon:{value:new THREE.Color(0xd9ecf5)},zenith:{value:new THREE.Color(0x2f7fc4)},sunDir:{value:B_SUN},sunCol:{value:new THREE.Color(0xfff1c8)}},
    vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform vec3 horizon,zenith,sunDir,sunCol;varying vec3 vP;\nvoid main(){vec3 d=normalize(vP);float h=max(d.y,0.0);vec3 col=mix(horizon,zenith,pow(h,0.55));float s=max(dot(d,normalize(sunDir)),0.0);col+=sunCol*(pow(s,6.0)*0.35+pow(s,40.0)*0.6);gl_FragColor=vec4(col,1.0);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}'});
  BT.sky=new THREE.Mesh(new THREE.SphereGeometry(B_FAR-200,32,16),sky);BT.sky.frustumCulled=false;S.add(BT.sky);
  BT.sun=new THREE.Mesh(new THREE.SphereGeometry(70,16,16),new THREE.MeshBasicMaterial({color:0xfff7d6,fog:false}));S.add(BT.sun);
  // the water: waves in the vertex shader, fresnel, sun glints and the fog by hand. The plane follows the camera (bPlace).
  const geo=new THREE.PlaneGeometry(4400,4400,160,160);geo.rotateX(-Math.PI/2);
  const U=BT.wu={uTime:{value:0},uDeep:{value:new THREE.Color(0x0e4f80)},uShallow:{value:new THREE.Color(0x2fb7c9)},uSunDir:{value:B_SUN},uSunCol:{value:new THREE.Color(0xfff0c0)},uFog:{value:B_FOG},uFogNear:{value:350},uFogFar:{value:2100}};
  const wm=new THREE.ShaderMaterial({uniforms:U,
    vertexShader:'uniform float uTime;varying vec3 vW;varying vec3 vN;varying float vH;\nfloat wave(vec2 p){return sin(p.x*0.02+uTime)*0.8+sin(p.y*0.015+uTime*0.8)*0.8+sin((p.x+p.y)*0.05+uTime*2.0)*0.3;}\nvoid main(){vec3 wp=(modelMatrix*vec4(position,1.0)).xyz;float h=wave(wp.xz);float e=3.0;float hx=wave(wp.xz+vec2(e,0.0));float hz=wave(wp.xz+vec2(0.0,e));vN=normalize(vec3(h-hx,e,h-hz));vH=h;wp.y+=h;vW=wp;gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.0);}',
    fragmentShader:'uniform vec3 uDeep,uShallow,uSunDir,uSunCol,uFog;uniform float uFogNear,uFogFar;uniform float uTime;varying vec3 vW;varying vec3 vN;varying float vH;\nvoid main(){vec3 V=normalize(cameraPosition-vW);vec3 N=normalize(vN);float fres=pow(1.0-max(dot(N,V),0.0),2.5);vec3 col=mix(uDeep,uShallow,clamp(0.25+vH*0.18,0.0,1.0));col=mix(col,vec3(0.78,0.90,0.96),fres*0.55);vec3 H=normalize(normalize(uSunDir)+V);float spec=pow(max(dot(N,H),0.0),160.0);float sparkle=pow(max(dot(N,H),0.0),900.0)*(0.5+0.5*sin(vW.x*0.7+vW.z*0.9+uTime*6.0));col+=uSunCol*(spec*1.1+sparkle*3.0);float diff=max(dot(N,normalize(uSunDir)),0.0);col*=0.8+0.3*diff;float d=length(cameraPosition-vW);col=mix(col,uFog,smoothstep(uFogNear,uFogFar,d));gl_FragColor=vec4(col,1.0);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}'});
  BT.water=new THREE.Mesh(geo,wm);BT.water.renderOrder=-1;BT.water.frustumCulled=false;S.add(BT.water);
  const catcher=new THREE.Mesh(new THREE.PlaneGeometry(4400,4400),new THREE.ShadowMaterial({opacity:.28}));catcher.rotation.x=-Math.PI/2;catcher.position.y=2.3;catcher.material.depthWrite=false;catcher.receiveShadow=true;BT.water.add(catcher);
  const R=mulberry32(4711);
  for(const I of seaIslands())bIsland(I,R);
  for(const id in SEA.docks)BT.docks[id]=bDock(seaDock(id));
  bTreasure();
  for(let i=0;i<24;i++)bCloud(R);for(let i=0;i<16;i++)bGull(R);
  if(typeof fAirportSea==='function')fAirportSea();   // Trinnvik's airport (js/plane.js)
  BT.W={islands:seaIslands(),hulls:BT.pir,bound:SEA.bound}}
// a smaller shadow map with low graphics (the setting in the menu)
function bShadowSize(){const sz=state.gfx==='hi'?2048:1024,sh=BT.dir.shadow;if(sh.mapSize.x===sz)return;sh.mapSize.set(sz,sz);if(sh.map){sh.map.dispose();sh.map=null}}
// the water, sky and shadow follow whichever camera is drawing
function bPlace(cam,focus){BT.water.position.set(Math.round(cam.position.x/100)*100,0,Math.round(cam.position.z/100)*100);BT.sky.position.copy(cam.position);BT.sun.position.copy(cam.position).addScaledVector(B_SUN,B_FAR-300);
  BT.dir.position.copy(focus).addScaledVector(B_SUN,600);BT.dir.target.position.copy(focus);BT.dir.target.updateMatrixWorld()}

/* ---------- islands: the archipelago as seen from the sea ---------- */
function bPalm(s){const g=new THREE.Group();g.scale.setScalar(s);const tg=new THREE.CylinderGeometry(.4,.6,10,5);tg.translate(0,5,0);const tr=new THREE.Mesh(tg,bStd(0x5d4037));tr.rotation.z=.2;tr.castShadow=true;g.add(tr);
  const lg=new THREE.ConeGeometry(2,8,3);lg.translate(0,4,0);lg.rotateX(Math.PI/1.8);const lm=bStd(0x2e7d32);for(let i=0;i<6;i++){const l=new THREE.Mesh(lg,lm);l.position.set(-2,9.5,0);l.rotation.y=i/6*Math.PI*2;l.castShadow=true;g.add(l)}return g}
function bRock(s,R,col=0x6f6a66){const r=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0),bStd(col));r.castShadow=r.receiveShadow=true;r.rotation.set(R(),R(),R());return r}
function bSpruce(s,snow){const g=new THREE.Group();g.scale.setScalar(s);bAdd(g,new THREE.CylinderGeometry(.6,.8,6,5),bStd(0x4a3626),0,3,0);
  for(let i=0;i<3;i++){bAdd(g,new THREE.ConeGeometry(5-i*1.3,7,7),bStd(0x234d2e),0,6+i*4,0);if(snow)bAdd(g,new THREE.ConeGeometry((5-i*1.3)*.58,3.4,7),bStd(0xf1f5f8),0,8.2+i*4,0,false)}return g}
function bHouse(g,x,y,z,w,h,d,col,ry,roof=0x5a3a2a){const hg=new THREE.Group();hg.position.set(x,y,z);hg.rotation.y=ry;bAdd(hg,new THREE.BoxGeometry(w,h,d),bStd(col),0,h/2,0);
  const r=bAdd(hg,new THREE.ConeGeometry(Math.hypot(w,d)/2*1.05,h*.6,4),bStd(roof),0,h+h*.3,0);r.rotation.y=Math.PI/4;g.add(hg);return hg}
function bFoam(x,z,r){const ring=new THREE.Mesh(new THREE.RingGeometry(r+2,r+14,48),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.35,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(x,2.45,z);BT.scene.add(ring);BT.foam.push({m:ring,ph:Math.random()*6});
  const sh=new THREE.Mesh(new THREE.CircleGeometry(r+40,40),new THREE.MeshBasicMaterial({color:0x4fd1d9,transparent:true,opacity:.35,depthWrite:false}));sh.rotation.x=-Math.PI/2;sh.position.set(x,2.05,z);BT.scene.add(sh)}
// the island's name, floating over it (it fades in the fog like everything far away)
function bLabel(text){const t=bTex(512,128,x=>{x.font='64px "Saira Stencil One", Impact, sans-serif';const w=Math.min(500,x.measureText(text).width+60);x.fillStyle='rgba(20,18,14,.72)';x.fillRect((512-w)/2,20,w,88);x.fillStyle='#E5A92B';x.fillRect((512-w)/2,20,8,88);
    x.fillStyle='#F2E8D0';x.textAlign='center';x.textBaseline='middle';x.fillText(text,256+4,66)});const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false}));s.scale.set(200,50,1);return s}
function bIsland(I,R){const g=new THREE.Group(),r=I.r,look=I.look;g.position.set(I.x,0,I.z);let top=30;
  bAdd(g,new THREE.CylinderGeometry(r-10,r+2,4,13),bStd({vinter:0xdfe4e8,stein:0xb9b2a6,by:0xc9c2b2,vulkan:0x5a5450}[look]||0xe8d9ae),0,0,0,false);
  const around=(n,d0,d1,fn)=>{for(let i=0;i<n;i++){const a=R()*Math.PI*2,d=d0+R()*(d1-d0);fn(Math.cos(a)*d,Math.sin(a)*d,i)}};
  if(look==='tromoya')top=bTromoya(g,I,R);
  else if(look==='vulkan'){bAdd(g,new THREE.CylinderGeometry(r*.85,r-8,6,11),bStd(0x3e3a38),0,3,0);const h=r*1.1;bAdd(g,new THREE.ConeGeometry(r*.75,h,9),bStd(0x221e1c),0,h/2,0);
    bAdd(g,new THREE.ConeGeometry(r*.2,r*.15,9),new THREE.MeshStandardMaterial({color:0xb71c1c,emissive:0xff5722,emissiveIntensity:.8}),0,h*.95,0,false);
    const lava=new THREE.MeshStandardMaterial({color:0xff6a1a,emissive:0xff4a0a,emissiveIntensity:1});
    for(let i=0;i<4;i++){const s=new THREE.Group();s.rotation.y=i*1.57+.5;const Rb=r*.75,len=Math.hypot(Rb,h)*.55,m=bAdd(s,new THREE.BoxGeometry(7,len,3),lava,Rb*.42,h*.56,0,false);m.rotation.z=Math.atan2(Rb,h);g.add(s)}
    BT.smokers.push({x:I.x,z:I.z,y:h*1.02,big:true});top=h}
  else if(look==='vinter'){bAdd(g,new THREE.CylinderGeometry(r-30,r-12,8,13),bStd(0xe9eef2),0,4,0);const h=r*.95;bAdd(g,new THREE.ConeGeometry(r*.62,h,9),bStd(0xf1f5f8),0,8+h/2,0);
    bAdd(g,new THREE.ConeGeometry(r*.42,h*.5,9),bStd(0xc5ced6),r*.18,8+h*.25,r*.1);
    around(36,r*.42,r*.82,(x,z)=>{const t=bSpruce(1.2+R()*.8,true);t.position.set(x,8,z);g.add(t)});
    // the chairlift up the side
    const a=[r*.62,10,r*.05],b=[r*.08,8+h*.86,r*.02],len=Math.hypot(b[0]-a[0],b[1]-a[1]);const cb=bAdd(g,new THREE.CylinderGeometry(.5,.5,len,4),bStd(0x26292c),(a[0]+b[0])/2,(a[1]+b[1])/2+6,a[2],false);cb.rotation.z=Math.atan2(b[0]-a[0],b[1]-a[1]);
    for(let k=0;k<4;k++){const u=(k+.5)/4,x=a[0]+(b[0]-a[0])*u,y=a[1]+(b[1]-a[1])*u;bAdd(g,new THREE.CylinderGeometry(1,1.2,12,5),bStd(0x8a9096),x,y,a[2])}top=8+h}
  else if(look==='by'){bAdd(g,new THREE.CylinderGeometry(r-24,r-10,8,13),bStd(0x7e8a6a),0,4,0);const C=[0xc8463a,0xe5a92b,0x4f7bb5,0xe9dcb9,0x8a877f,0xb06a3a,0xa4a099];
    around(24,8,r-46,(x,z,i)=>{const w=14+R()*14,h=14+R()*46,d=14+R()*14;bAdd(g,new THREE.BoxGeometry(w,h,d),bStd(C[i%C.length]),x,8+h/2,z);bAdd(g,new THREE.BoxGeometry(w+2,2,d+2),bStd(0x3f3d3a),x,8+h+1,z,false)});
    bAdd(g,new THREE.CylinderGeometry(7,9,96,8),bStd(0xe9dcb9),0,56,0);bAdd(g,new THREE.ConeGeometry(10,18,8),bStd(0x5a6066),0,113,0);top=122}
  else if(look==='sand'){bAdd(g,new THREE.ConeGeometry(r*.7,18,10),bStd(0xdcc994),0,11,0);around(10,r*.2,r*.6,(x,z)=>{const b=bAdd(g,new THREE.IcosahedronGeometry(3+R()*3,0),bStd(0x33691e),x,9,z)});
    around(10,0,r*.62,(x,z)=>{const p=bPalm(1+R()*.5);p.position.set(x,8,z);p.rotation.y=R()*6;g.add(p)});top=40}
  else if(look==='stein'){for(let i=0;i<6;i++){const a=R()*6.3,d=R()*r*.45,s=r*(.16+R()*.2),k=bRock(s,R,[0x6f6a66,0x85807a,0x5f5b57][i%3]);k.position.set(Math.cos(a)*d,s*.5,Math.sin(a)*d);k.scale.y=.8+R()*.6;g.add(k)}
    around(8,r*.4,r*.75,(x,z)=>bAdd(g,new THREE.IcosahedronGeometry(3+R()*2.5,0),bStd(0x55702e),x,6,z));top=r*.6}
  else if(look==='skog'){bAdd(g,new THREE.ConeGeometry(r*.85,30,11),bStd(0x4c8a3a),0,16,0);around(46,0,r*.78,(x,z)=>{const d=Math.hypot(x,z),t=bSpruce(1.3+R()*.9,false);t.position.set(x,30*(1-d/(r*.85))+2,z);g.add(t)});top=70}
  else if(look==='elv'){bAdd(g,new THREE.CylinderGeometry(r-22,r-8,10,13),bStd(0x5a9a3c),0,5,0);const rv=bAdd(g,new THREE.BoxGeometry(r*1.75,1,20),bStd(0x2f86b0,{flatShading:false,roughness:.2}),0,10.4,0,false);rv.rotation.y=.5;
    const br=bAdd(g,new THREE.BoxGeometry(14,3,30),bStd(0x7b4e2c),0,11.5,0);br.rotation.y=.5;
    around(20,r*.25,r*.78,(x,z,i)=>{const s=6+R()*5;bAdd(g,new THREE.IcosahedronGeometry(s,0),bStd([0x2d6b2a,0x3b7f33,0x4a8f3a][i%3]),x,10+s,z);bAdd(g,new THREE.CylinderGeometry(1,1.4,s,5),bStd(0x4a3826),x,10+s*.4,z)});
    bHouse(g,r*.35,10,-r*.3,16,10,12,0xc8463a,.4);top=40}
  else if(look==='savanne'){bAdd(g,new THREE.CylinderGeometry(r-18,r-6,8,13),bStd(0xc9a85a),0,4,0);   // Løveøya: golden grass, the kopje, flat-topped acacias, a baobab and the waterhole
    for(let i=0;i<7;i++){const a=R()*6.3,d=R()*r*.16,k=bRock(10+R()*12,R,[0xa8927c,0x9a8470,0xb8a28a][i%3]);k.position.set(-r*.35+Math.cos(a)*d,12+R()*10,-r*.05+Math.sin(a)*d);g.add(k)}
    around(16,r*.15,r*.78,(x,z)=>{const s=.8+R()*.6;bAdd(g,new THREE.CylinderGeometry(.9*s,1.3*s,12*s,5),bStd(0x5a4636),x,8+6*s,z);bAdd(g,new THREE.CylinderGeometry(9*s,7*s,2.4*s,9),bStd(0x6f8a3a),x,8+12.5*s,z)});
    bAdd(g,new THREE.CylinderGeometry(6,8,18,8),bStd(0x9a8678),r*.15,17,-r*.45);bAdd(g,new THREE.IcosahedronGeometry(7,0),bStd(0x6a8a3a),r*.15,29,-r*.45);
    bAdd(g,new THREE.CylinderGeometry(r*.2,r*.2,.6,16),bStd(0x5a7a5c,{flatShading:false,roughness:.2}),r*.3,8.2,r*.05,false);top=60}
  else if(look==='orken'){bAdd(g,new THREE.CylinderGeometry(r-16,r-4,8,13),bStd(0xe2bf82),0,4,0);   // Kameløya: the dunes, the oasis with palms, the red sandstone mountain and the little pyramid
    around(14,r*.25,r*.8,(x,z,i)=>{const d=bAdd(g,new THREE.SphereGeometry(1,10,6,0,Math.PI*2,0,Math.PI/2),bStd([0xe8c48a,0xdcb478,0xf0d098][i%3]),x,8,z);d.scale.set(16+R()*14,6+R()*9,9+R()*6);d.rotation.y=R()*.6});
    const mx=-r*.32,mz=r*.15;bAdd(g,new THREE.CylinderGeometry(r*.2,r*.25,26,9),bStd(0xb0704a),mx,20,mz);bAdd(g,new THREE.CylinderGeometry(r*.21,r*.21,2,9),bStd(0x9a5e3c),mx,33,mz,false);
    bAdd(g,new THREE.CylinderGeometry(r*.11,r*.11,.6,14),bStd(0x3f9aa0,{flatShading:false,roughness:.2}),r*.05,8.3,-r*.06,false);
    around(9,r*.12,r*.2,(x,z)=>{const p=bPalm(.9+R()*.4);p.position.set(x+r*.05,8,z-r*.06);p.rotation.y=R()*6;g.add(p)});
    const py=bAdd(g,new THREE.ConeGeometry(22,24,4),bStd(0xd2b07a),-r*.12,20,r*.48);py.rotation.y=.4;top=70}
  else if(look==='skilso')top=bSkilso(g,I,R);
  // rocks along the shore
  if(look!=='by'){const n=4+Math.floor(R()*5);for(let i=0;i<n;i++){const a=R()*Math.PI*2,k=bRock(5+R()*10,R,look==='vulkan'?0x3e3a38:0x6f6a66);k.position.set(Math.cos(a)*r*(.92+R()*.1),0,Math.sin(a)*r*(.92+R()*.1));g.add(k)}}
  BT.scene.add(g);BT.isl.push({I,g});bFoam(I.x,I.z,r);const lab=bLabel(I.name.toUpperCase());lab.position.set(I.x,top+60,I.z);BT.scene.add(lab)}
// Tromøya: the island you came from, in small. The grass, the desert and the mesas in the west, the jungle in the east, the snow mountain,
// the base, the village by the ferry, palms along the beaches, and Captain Theis' boathouse by the dock in the north-east (bDock).
// P turns the island's own coordinates into the sea's: east is −x on the island and +x at sea, north +z on the island and −z at sea.
function bTromoya(g,I,R){const r=I.r,k=r/52,P=(x,z)=>[-x*k,-z*k];
  bAdd(g,new THREE.CylinderGeometry(r-34,r-14,10,15),bStd(0x5a9a3c),0,5,0);
  bAdd(g,new THREE.CylinderGeometry(r*.42,r*.5,10.4,9),bStd(0xd9b878),r*.42,5.2,r*.05,false);
  for(const[x,z,rr,h]of[[28,-24,4,3.2],[36,-18,5,4],[44,-8,4.5,3.6],[42,4,5,4.4],[32,-6,3.2,2.6],[46,14,4,3.4]]){const[px,pz]=P(x,z),hh=h*5+6;bAdd(g,new THREE.CylinderGeometry(rr*k*.8,rr*k,hh,7),bStd(0xb5572f),px,10+hh/2,pz)}
  {const[mx,mz]=P(-4,24);bAdd(g,new THREE.ConeGeometry(130,170,9),bStd(0x7a7268),mx,10+85,mz);bAdd(g,new THREE.ConeGeometry(64,84,9),bStd(0xf4f7fa),mx,10+170-42+.5,mz,false)}
  for(let i=0;i<34;i++){const x=-12-R()*36,z=-16+R()*30;if(Math.hypot(x+4,z-24)<27)continue;const[px,pz]=P(x,z),s=7+R()*7;
    bAdd(g,new THREE.IcosahedronGeometry(s,0),bStd([0x2d6b2a,0x3b7f33,0x246126][i%3]),px,10+s*1.2,pz);bAdd(g,new THREE.CylinderGeometry(1.2,1.6,s*1.4,5),bStd(0x4a3826),px,10+s*.6,pz)}
  {const[bx,bz]=P(0,-2);bAdd(g,new THREE.BoxGeometry(40,14,28),bStd(0x6f7f8a),bx,17,bz);bAdd(g,new THREE.BoxGeometry(42,2,30),bStd(0x8a2f22),bx,25,bz,false)}
  for(const[x,z,c]of[[27,22,0xc8463a],[31,26,0xe5a92b],[25,27,0x4f7bb5],[32,21,0xe9dcb9]]){const[px,pz]=P(x,z);bHouse(g,px,10,pz,14,10,11,c,R()*6)}
  for(let i=0;i<24;i++){const a=R()*Math.PI*2,d=r-30+R()*14,p=bPalm(1+R()*.5);p.position.set(Math.cos(a)*d,4,Math.sin(a)*d);p.rotation.y=R()*6;g.add(p)}
  return 180}
// Skilsø: the pirates' island with the skull rock, from the original game. Turned so the houses face its dock.
function bSkilso(g,I,R){const dk=seaDock('skilso'),s=new THREE.Group();s.rotation.y=Math.atan2(dk.ux,dk.uz);g.add(s);
  bAdd(s,new THREE.ConeGeometry(130,70,9),bStd(0x2e7d32),0,25,0);
  const bone=bStd(0xdcdcdc),dark=new THREE.MeshBasicMaterial({color:0x111111}),skull=new THREE.Group();skull.position.set(0,55,0);
  bAdd(skull,new THREE.DodecahedronGeometry(40),bone,0,0,0);for(const sd of[-1,1]){bAdd(skull,new THREE.DodecahedronGeometry(15),bone,sd*25,-20,15);const e=bAdd(skull,new THREE.SphereGeometry(12,8,8),dark,sd*15,-5,32,false);e.scale.z=.5}
  const nose=bAdd(skull,new THREE.ConeGeometry(5,15,3),dark,0,-20,35,false);nose.rotation.x=.5;s.add(skull);
  for(const[hx,hz,rot,sc]of[[-40,60,.5,1],[50,50,-.5,1],[-60,20,.2,1],[60,10,-.8,1],[0,75,0,1.2],[-25,85,.3,.8],[25,80,-.3,.8]])bHouse(s,hx,5,hz,15*sc,10*sc,10*sc,0xffe0b2,rot,0xa52a2a);
  for(let i=0;i<12;i++){const a=R()*Math.PI*2,d=90+R()*40;if(Math.sin(a)>.6&&Math.abs(Math.cos(a))<.4)continue;const p=bPalm(1.5+R()*.5);p.position.set(Math.cos(a)*d,2,Math.sin(a)*d);p.rotation.y=R()*6;s.add(p)}
  for(const sd of[-1,1])bAdd(s,new THREE.CylinderGeometry(8,12,35,6),bStd(0x8d6e63,{flatShading:false}),sd*70,15,30);
  return 100}

/* ---------- the docks: the finish of every race. A floating plank platform with barrels, torches, the MÅL sign and the chest ---------- */
function bDock(dk){const g=new THREE.Group(),marina=dk.id==='marina';g.position.set(dk.x,0,dk.z);g.rotation.y=Math.atan2(dk.ux,dk.uz);   // local +z points out to sea
  const wood=new THREE.MeshStandardMaterial({color:0x5d4037,roughness:.9});
  for(let i=0;i<10;i++)bAdd(g,new THREE.BoxGeometry(dk.w,4,8),wood,0,0,-45+i*10);
  for(const s of[-1,1])bAdd(g,new THREE.BoxGeometry(4,10,dk.d),wood,s*dk.w/2,-2,0,false);
  const barrel=(x,z)=>{const b=new THREE.Group();b.add(new THREE.Mesh(new THREE.CylinderGeometry(2,2.2,5,8),new THREE.MeshStandardMaterial({color:0x4e342e})));for(const y of[-1.5,1.5]){const r=new THREE.Mesh(new THREE.TorusGeometry(2.1,.1,8,12),new THREE.MeshStandardMaterial({color:0x222222}));r.rotation.x=Math.PI/2;r.position.y=y;b.add(r)}b.position.set(x,4.5,z);g.add(b)};
  barrel(-30,-30);barrel(-34,-30);barrel(-32,-35);
  if(marina){// Captain Theis' flag at the corner of the dock, and the boathouse with its sign on the shore behind
    bAdd(g,new THREE.CylinderGeometry(.5,.6,34,8),bStd(0xf5f5f5,{flatShading:false}),40,19,42);
    const cloth=new THREE.Mesh(new THREE.PlaneGeometry(14,9.5,10,6),new THREE.MeshBasicMaterial({map:BTEX.flag,side:THREE.DoubleSide}));cloth.geometry.translate(7,0,0);cloth.position.set(40,31,42);g.add(cloth);BT.lamps.push({flag:cloth});
    const bh=new THREE.Group();bh.position.set(22,2,-dk.d/2-62);g.add(bh);bAdd(bh,new THREE.BoxGeometry(30,20,26),bStd(0xb5432f),0,10,0);
    for(const sd of[-1,1]){const rf=bAdd(bh,new THREE.BoxGeometry(19,1.6,30),bStd(0x2f2a28),sd*8,24.5,0);rf.rotation.z=-sd*.55}
    bAdd(bh,new THREE.BoxGeometry(18,15,1),bStd(0x5a3a22),0,7.5,13.2,false);bAdd(bh,new THREE.BoxGeometry(20,1.4,1.4),bStd(0xf2e8d0),0,15.6,13.4,false);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(60,15),new THREE.MeshBasicMaterial({map:bText('CAPTAIN THEIS',512,128,'72px "Saira Stencil One", Impact, sans-serif','#14120E','#E5A92B','#14120E'),side:THREE.DoubleSide}));
    sign.position.set(-24,26,-dk.d/2-52);g.add(sign);for(const sx of[-50,2])bAdd(g,new THREE.CylinderGeometry(.6,.6,26,6),wood,sx,13,-dk.d/2-52.5)}
  else{const lh=new THREE.Group();lh.position.set(40,2,42);bAdd(lh,new THREE.CylinderGeometry(3.5,5,34,12),bStd(0xf5f5f5,{flatShading:false}),0,17,0);
    for(let i=0;i<3;i++)bAdd(lh,new THREE.CylinderGeometry(4.6-i*.4,4.9-i*.4,3,12),bStd(0xc62828,{flatShading:false}),0,6+i*10,0,false);
    const lamp=bAdd(lh,new THREE.CylinderGeometry(3,3,5,10),new THREE.MeshStandardMaterial({color:0xfff3b0,emissive:0xffd54f,emissiveIntensity:1.5}),0,36.5,0,false);BT.lamps.push({lamp});
    bAdd(lh,new THREE.ConeGeometry(4.2,5,10),bStd(0x37474f),0,41.5,0,false);g.add(lh)}
  for(const[tx,tz]of[[-42,40],[-42,-40],[42,-40]]){bAdd(g,new THREE.CylinderGeometry(.5,.5,12),wood,tx,8,tz,false);BT.torches.push(bAdd(g,new THREE.ConeGeometry(1.6,4,6),new THREE.MeshStandardMaterial({color:0xffab40,emissive:0xff6d00,emissiveIntensity:1.2}),tx,16,tz,false))}
  const sg=new THREE.Mesh(new THREE.PlaneGeometry(18,10),new THREE.MeshBasicMaterial({map:bText('MÅL',256,128,'80px "Saira Stencil One", Impact, sans-serif','#14120E','#E5A92B'),side:THREE.DoubleSide}));sg.position.set(-30,22,44);g.add(sg);
  bAdd(g,new THREE.CylinderGeometry(.4,.4,28),wood,-39,12,44,false);
  // the chest: it opens when someone wins here
  const c=new THREE.Group();c.position.set(0,5,-40);const m=new THREE.MeshStandardMaterial({color:0x8b4513,roughness:.8}),band=new THREE.MeshStandardMaterial({color:0xd4af37,metalness:.7,roughness:.3});
  bAdd(c,new THREE.BoxGeometry(16,10,10),m,0,5,0);for(const x of[-5,5])bAdd(c,new THREE.BoxGeometry(1.2,10.2,10.2),band,x,5,0,false);
  bAdd(c,new THREE.BoxGeometry(14,2,8),new THREE.MeshStandardMaterial({color:0xffd700,emissive:0xffb300,emissiveIntensity:.5,metalness:.8,roughness:.25}),0,10.2,0,false);
  const lid=new THREE.Group();lid.position.set(0,10,-5);const lm=new THREE.Mesh(new THREE.CylinderGeometry(8,8,16,16,1,false,0,Math.PI),m);lm.rotateZ(Math.PI/2);lm.position.set(0,0,5);lid.add(lm);c.add(lid);g.add(c);
  BT.scene.add(g);return{dk,g,lid}}
// the treasure chest somewhere at sea: 50 nuts for the first boat to find it (once)
function bTreasure(){const g=new THREE.Group(),m=new THREE.MeshStandardMaterial({color:0x8b4513,roughness:.8}),gold=new THREE.MeshStandardMaterial({color:0xd4af37,metalness:.7,roughness:.3});
  bAdd(g,new THREE.BoxGeometry(12,8,8),m,0,4,0);bAdd(g,new THREE.BoxGeometry(12.4,2,8.4),gold,0,8,0,false);for(const x of[-4,4])bAdd(g,new THREE.BoxGeometry(1,8.2,8.2),gold,x,4,0,false);
  const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:BTEX.soft,color:0xffd54f,transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending}));gl.scale.set(40,40,1);gl.position.y=8;g.add(gl);
  g.position.set(SEA.chest[0],2,SEA.chest[1]);BT.scene.add(g);BT.treasure=g}
function bCloud(R){const g=new THREE.Group(),mat=new THREE.MeshStandardMaterial({color:0xffffff,flatShading:true,opacity:.92,transparent:true});
  for(let i=0;i<5;i++){const s=30+R()*20,c=new THREE.Mesh(new THREE.BoxGeometry(s,s*.55,s),mat);c.position.set(R()*50-25,R()*14-7,R()*50-25);g.add(c)}
  g.position.set(R()*4000-2000,220+R()*180,R()*4000-2000);g.userData.drift=.05+R()*.1;BT.scene.add(g);BT.clouds.push(g)}
function bGull(R){const g=new THREE.Group(),wg=new THREE.BoxGeometry(3,.4,1),m=new THREE.MeshBasicMaterial({color:0xffffff}),l=new THREE.Mesh(wg,m),r=new THREE.Mesh(wg,m);l.position.x=-1.5;r.position.x=1.5;g.add(l,r);
  const a=R()*Math.PI*2,rad=400+R()*1400;g.position.set(Math.cos(a)*rad,40+R()*60,Math.sin(a)*rad);BT.scene.add(g);BT.gulls.push({g,l,r,speed:.5+R()*.5,a,rad,ph:R()*10})}

/* ---------- the race: buoys, turbo barrels, pirate ships ---------- */
function bDispose(o){o.traverse(q=>{if(q.geometry)q.geometry.dispose();if(q.material){if(q.material.map&&!Object.values(BTEX).includes(q.material.map))q.material.map.dispose();q.material.dispose()}})}
function bGates(route){if(BT.gateGrp){BT.scene.remove(BT.gateGrp);bDispose(BT.gateGrp)}const grp=BT.gateGrp=new THREE.Group();BT.gates=[];
  const buoyMat=new THREE.MeshStandardMaterial({color:0xd32f2f,roughness:.5}),white=new THREE.MeshStandardMaterial({color:0xfafafa,roughness:.5});
  [...route.buoys,route.dock].forEach((gt,idx)=>{const e={x:gt.x,z:gt.z,beams:[],lamps:[]};
    if(idx<route.buoys.length){const g=new THREE.Group();g.position.set(gt.x,0,gt.z);g.rotation.y=gt.a;
      for(const s of[-1,1]){const b=new THREE.Group();b.position.set(s*36,0,0);bAdd(b,new THREE.CylinderGeometry(2.4,3,8,12),buoyMat,0,3,0);bAdd(b,new THREE.CylinderGeometry(2.55,2.75,2,12),white,0,3.5,0,false);
        bAdd(b,new THREE.CylinderGeometry(.5,.5,26,8),white,0,18,0,false);const lamp=bAdd(b,new THREE.SphereGeometry(1.3,10,8),new THREE.MeshStandardMaterial({color:0xfff59d,emissive:0xffc107,emissiveIntensity:1.4}),0,31.5,0,false);e.lamps.push(lamp);g.add(b)}
      const ban=new THREE.Mesh(new THREE.PlaneGeometry(72,9),new THREE.MeshBasicMaterial({map:bText('BØYE '+(idx+1),512,64,'46px "Saira Stencil One", Impact, sans-serif','#E5A92B','#14120E','#E5A92B'),side:THREE.DoubleSide}));ban.position.y=26;g.add(ban);grp.add(g)}
    // a guide beam over the next target, one per player: each player's camera sees only their own (layers)
    for(const i of[0,1]){const beam=new THREE.Mesh(new THREE.CylinderGeometry(5,5,160,16,1,true),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.32,depthWrite:false,side:THREE.DoubleSide,fog:false}));
      beam.position.set(gt.x,80,gt.z);beam.layers.set(i+1);beam.visible=false;grp.add(beam);e.beams.push(beam)}
    BT.gates.push(e)});BT.scene.add(grp)}
function bBarrelMesh(){const g=new THREE.Group();bAdd(g,new THREE.CylinderGeometry(3,3.4,8,10),new THREE.MeshStandardMaterial({color:0x8d6e63,roughness:.9}),0,0,0);
  for(const y of[-2.5,2.5]){const r=new THREE.Mesh(new THREE.TorusGeometry(3.3,.25,8,16),new THREE.MeshStandardMaterial({color:0xd4af37,metalness:.7,roughness:.3}));r.rotation.x=Math.PI/2;r.position.y=y;g.add(r)}
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:BTEX.soft,color:0xffd54f,transparent:true,opacity:.55,depthWrite:false}));glow.scale.set(22,22,1);glow.position.y=2;g.add(glow);g.rotation.z=1.2;return g}
function bShipMesh(){const group=new THREE.Group();group.scale.setScalar(1.5);
  const mDark=new THREE.MeshStandardMaterial({color:0x161214,roughness:.9}),mMed=new THREE.MeshStandardMaterial({color:0x2b1e1a,roughness:.8}),mLight=new THREE.MeshStandardMaterial({color:0x3e2f2a,roughness:.7}),mTrim=new THREE.MeshStandardMaterial({color:0x7a1f1f,roughness:.35,metalness:.2});
  const mSail=new THREE.MeshStandardMaterial({map:BTEX.sail,side:THREE.DoubleSide,roughness:.9}),mCannon=new THREE.MeshStandardMaterial({color:0x111111,roughness:.5,metalness:.6}),mRope=new THREE.LineBasicMaterial({color:0x1a1a1a});
  const hullG=new THREE.Group();hullG.rotation.y=Math.PI;group.add(hullG);
  const deform=(geo,isBow)=>{const pos=geo.attributes.position;geo.computeBoundingBox();const minZ=geo.boundingBox.min.z,maxZ=geo.boundingBox.max.z,len=maxZ-minZ;
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),n=isBow?(z-minZ)/len:(maxZ-z)/len,taper=Math.max(.05,1-Math.pow(n,2.5)*.95),v=y<0?(1-Math.abs(x)*.15)*.8:1;pos.setX(i,x*taper*v);pos.setY(i,y+Math.pow(n,2)*1.8)}geo.computeVertexNormals()};
  const midLen=6,midGeo=new THREE.BoxGeometry(3.5,2.5,midLen,8,6,12),mp=midGeo.attributes.position;
  for(let i=0;i<mp.count;i++)if(mp.getY(i)<0){const x=mp.getX(i);mp.setX(i,x*.8);mp.setY(i,mp.getY(i)+Math.abs(x)*.2)}midGeo.computeVertexNormals();
  const mid=bAdd(hullG,midGeo,mMed,0,.5,0);const cannonGeo=new THREE.CylinderGeometry(.2,.24,1.1,8),portMat=new THREE.MeshStandardMaterial({color:0x0a0a0a});
  for(let i=0;i<3;i++){const z=-1.5+i*1.5;for(const s of[-1,1]){const c=new THREE.Mesh(cannonGeo,mCannon);c.rotation.z=s*Math.PI/2;c.position.set(s*1.6,.8,z);mid.add(c);const port=new THREE.Mesh(new THREE.BoxGeometry(.1,.6,.6),portMat);port.position.set(s*1.75,.8,z);mid.add(port)}}
  const bowLen=5.5,bowGeo=new THREE.BoxGeometry(3.5,2.5,bowLen,8,6,16);deform(bowGeo,true);bAdd(hullG,bowGeo,mMed,0,.5,midLen/2+bowLen/2-.1);
  const stLen=3.5,stGeo=new THREE.BoxGeometry(3.5,2.5,stLen,8,6,12);deform(stGeo,false);bAdd(hullG,stGeo,mMed,0,.5,-midLen/2-stLen/2+.1);
  bAdd(hullG,new THREE.BoxGeometry(3.2,2.2,.5),mDark,0,1.5,-midLen/2-stLen+.5,false);bAdd(hullG,new THREE.BoxGeometry(3.7,.18,12.5),mTrim,0,.55,.6,false);
  bAdd(hullG,new THREE.BoxGeometry(3.4,.2,13),new THREE.MeshStandardMaterial({color:0x4a3a34,roughness:1}),0,1.6,0,false);
  const railGeo=new THREE.BoxGeometry(.2,.4,.2);for(let z=-5;z<=5;z+=1.5)for(const s of[-1,1])bAdd(hullG,railGeo,mLight,s*1.65,1.9,z,false);for(const s of[-1,1])bAdd(hullG,new THREE.BoxGeometry(.2,.1,12),mTrim,s*1.65,2.15,0,false);
  const bs=bAdd(hullG,new THREE.CylinderGeometry(.2,.4,9,8),mDark,0,2.8,7.5,false);bs.rotation.x=-Math.PI/2-.2;
  const cabin=new THREE.Group();cabin.position.set(0,2,-4);bAdd(cabin,new THREE.BoxGeometry(2.8,1.8,3),mDark,0,0,0);bAdd(cabin,new THREE.BoxGeometry(3,.2,3.2),mLight,0,1,0,false);
  const winMat=new THREE.MeshStandardMaterial({color:0xffd27a,emissive:0xffb74d,emissiveIntensity:.8});for(let i=-1;i<=1;i++)bAdd(cabin,new THREE.BoxGeometry(.5,.5,.1),winMat,i*.8,.1,-1.53,false);hullG.add(cabin);
  bAdd(hullG,new THREE.SphereGeometry(.28,8,8),new THREE.MeshStandardMaterial({color:0xffe082,emissive:0xffa000,emissiveIntensity:1.6}),0,4.1,-6.1,false);
  const sails=[];
  const mast=(x,z,height,scale,count)=>{const mg=new THREE.Group();mg.position.set(x,0,z);bAdd(mg,new THREE.CylinderGeometry(.15*scale,.3*scale,height,8),mLight,0,height/2+1,0);bAdd(mg,new THREE.CylinderGeometry(.8*scale,.4*scale,.6,6),mDark,0,height*.8+1,0,false);
    for(let i=0;i<count;i++){const y=height*(.35+i*.25)+1,width=4.5*scale*(1-i*.15),sailH=2.5*scale;const yard=bAdd(mg,new THREE.CylinderGeometry(.08,.08,width,8),mDark,0,y,0,false);yard.rotation.z=Math.PI/2;
      const sg=new THREE.PlaneGeometry(width,sailH,10,10),sp=sg.attributes.position,base=new Float32Array(sp.count);for(let v=0;v<sp.count;v++)base[v]=Math.sin((sp.getY(v)/sailH+.5)*Math.PI)*Math.cos(sp.getX(v)/(width*.6))*.9;
      const sail=bAdd(mg,sg,mSail,0,y-sailH/2,.1);sails.push({mesh:sail,base})}
    hullG.add(mg);const pts=[[x,height,z],[x-1.6,2,z+.5],[x,height,z],[x+1.6,2,z+.5],[x,height,z],[x,2,z-2.5]].map(p=>new THREE.Vector3(p[0],p[1],p[2]));hullG.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),mRope))};
  mast(0,0,11,1,3);mast(0,4,9,.9,2);mast(0,-3.5,8.5,.85,2);
  const fl=new THREE.Group();fl.position.set(0,11.5,0);fl.scale.setScalar(.5);fl.rotation.y=Math.PI/2;bAdd(fl,new THREE.CylinderGeometry(.08,.08,6),new THREE.MeshStandardMaterial({color:0x222222}),0,3,0,false);
  const cloth=new THREE.Mesh(new THREE.PlaneGeometry(6,4,15,10),new THREE.MeshBasicMaterial({map:BTEX.jolly,side:THREE.DoubleSide}));cloth.position.set(3,4,0);fl.add(cloth);hullG.add(fl);
  const fig=bAdd(hullG,new THREE.ConeGeometry(.5,1.6,5),new THREE.MeshStandardMaterial({color:0xd8d0c0}),0,3.2,7.2,false);fig.rotation.x=-.5;
  group.userData={sails,cloth};return group}
function bSails(g,k,t){const S=g.userData.sails,puff=.35+.65*Math.max(0,Math.min(1,k))+Math.sin(t*2.2)*.05;
  for(const s of S){const p=s.mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,s.base[i]*puff+.15);p.needsUpdate=true;s.mesh.geometry.computeVertexNormals()}
  const c=g.userData.cloth.geometry.attributes.position;for(let i=0;i<c.count;i++){const d=c.getX(i)+3;c.setZ(i,Math.sin(d*.8-t*6)*d*.15+Math.sin(d*2-t*15)*d*.05)}c.needsUpdate=true}

/* ---------- the motorboat: forward is −z ---------- */
function bBoatMesh(hex,num,numCss,ownFlag){const g=new THREE.Group();g.rotation.order='YXZ';const b=new THREE.Group();b.scale.setScalar(1.4);g.add(b);
  const mHull=new THREE.MeshStandardMaterial({color:LIN(hex),roughness:.3,metalness:.15}),mWhite=new THREE.MeshStandardMaterial({color:0xf6f4ee,roughness:.45}),mTeak=new THREE.MeshStandardMaterial({color:0xa0703f,roughness:.8});
  const mBlack=new THREE.MeshStandardMaterial({color:0x15171a,roughness:.4,metalness:.4}),mChrome=new THREE.MeshStandardMaterial({color:0xd8dde3,roughness:.15,metalness:.9});
  const shape=(geo,isHull)=>{const p=geo.attributes.position;for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i);const z=p.getZ(i),t=Math.max(0,Math.min(1,(-z-.5)/5.5));x*=1-Math.pow(t,1.7)*.93;
      if(isHull&&y<0){x*=.62;y+=Math.abs(x)*.5+t*t*1.3}else y+=t*t*.35;p.setX(i,x);p.setY(i,y)}geo.computeVertexNormals();return geo};
  bAdd(b,shape(new THREE.BoxGeometry(4,1.6,12,8,4,18),true),mHull,0,.4,0);bAdd(b,shape(new THREE.BoxGeometry(3.9,.16,12,8,1,18),false),mWhite,0,1.22,0);
  const nm=bAdd(b,new THREE.CircleGeometry(.85,24),new THREE.MeshBasicMaterial({map:bText(String(num),128,128,'96px "Saira Stencil One", Impact, sans-serif','#fff',numCss),transparent:true}),0,1.42,-3.2,false);nm.rotation.x=-Math.PI/2-.06;
  bAdd(b,new THREE.BoxGeometry(3,.12,5.4),mTeak,0,1.34,2.7,false);for(const s of[-1,1])bAdd(b,new THREE.BoxGeometry(.3,.55,6.2),mWhite,s*1.75,1.6,2.4,false);
  bAdd(b,new THREE.BoxGeometry(3,.6,1.1),mWhite,0,1.7,4.8);const cush=new THREE.MeshStandardMaterial({color:LIN(hex),roughness:.9});bAdd(b,new THREE.BoxGeometry(2.9,.18,1),cush,0,2.08,4.8,false);
  bAdd(b,new THREE.BoxGeometry(1.4,1.1,.9),mWhite,.5,1.9,.4);const wh=bAdd(b,new THREE.TorusGeometry(.32,.06,6,16),mBlack,.5,2.5,.85,false);wh.rotation.x=-.5;
  const sh=bAdd(b,new THREE.PlaneGeometry(3.4,1),new THREE.MeshStandardMaterial({color:0x9fd3f0,transparent:true,opacity:.45,roughness:.05,metalness:.3,side:THREE.DoubleSide}),0,2.05,-.35,false);sh.rotation.x=-.65;
  bAdd(b,new THREE.BoxGeometry(3.45,.07,.07),mChrome,0,2.45,-.04,false);
  // the driver in a life vest, with a cap in the boat's colour
  const dr=new THREE.Group();dr.position.set(.5,1.4,1.5);bAdd(dr,new THREE.CylinderGeometry(.45,.5,1.3,10),new THREE.MeshStandardMaterial({color:0xff8f00,roughness:.7}),0,.95,0);bAdd(dr,new THREE.SphereGeometry(.36,12,10),new THREE.MeshStandardMaterial({color:0xf1c27d,roughness:.8}),0,1.9,0,false);
  const capM=new THREE.MeshStandardMaterial({color:LIN(hex),roughness:.6});bAdd(dr,new THREE.SphereGeometry(.38,12,8,0,Math.PI*2,0,Math.PI/2),capM,0,1.95,0,false);bAdd(dr,new THREE.BoxGeometry(.5,.05,.35),capM,0,1.97,-.4,false);b.add(dr);
  const mo=new THREE.Group();mo.position.set(0,1.4,6.35);bAdd(mo,new THREE.BoxGeometry(1,1.3,1.1),mBlack,0,.75,0);bAdd(mo,new THREE.BoxGeometry(1.04,.3,1.14),mHull,0,1.5,0,false);bAdd(mo,new THREE.BoxGeometry(.35,2.2,.5),mBlack,0,-.9,.1,false);
  const prop=bAdd(mo,new THREE.CylinderGeometry(.22,.22,.6,8),mChrome,0,-1.9,.4,false);prop.rotation.x=Math.PI/2;b.add(mo);
  const plate=bAdd(b,new THREE.PlaneGeometry(2.8,.55),new THREE.MeshBasicMaterial({transparent:true}),0,.85,6.02,false);
  bAdd(b,new THREE.CylinderGeometry(.04,.04,2.2),mChrome,-1.4,2.4,5.6,false);const cloth=new THREE.Mesh(new THREE.PlaneGeometry(1.4,.95,10,6),new THREE.MeshBasicMaterial({map:ownFlag?bFlagTex():BTEX.flag,side:THREE.DoubleSide}));cloth.geometry.translate(.7,0,0);cloth.position.set(-1.4,3.1,5.6);cloth.rotation.y=-Math.PI/2;b.add(cloth);
  g.userData={plate,cloth,paint:[mHull,cush,capM]};return g}
function bName(mesh,name){const m=mesh.userData.plate.material;if(m.map)m.map.dispose();m.map=bText(name.toUpperCase(),512,100,'700 62px "Barlow Condensed", "Arial Narrow", sans-serif','#ffffff',null);m.needsUpdate=true}
function bFlag(cloth,t,speed){const p=cloth.geometry.attributes.position,amp=.06+Math.min(1,Math.abs(speed))*.08;for(let i=0;i<p.count;i++){const d=p.getX(i);p.setZ(i,Math.sin(d*4-t*14)*d*amp)}p.needsUpdate=true}

/* ---------- particles: wake, spray, splashes, smoke, sparks, coins, fireworks (lives in 60 Hz steps) ---------- */
function bSpawn(pos,vel,o){const mat=new THREE.SpriteMaterial({map:o.tex||BTEX.soft,color:o.color||0xffffff,transparent:true,opacity:o.opacity??1,depthWrite:false,blending:o.additive?THREE.AdditiveBlending:THREE.NormalBlending});mat.userData.o=o.opacity??1;
  const s=new THREE.Sprite(mat);s.position.copy(pos);s.scale.setScalar(o.size||4);BT.scene.add(s);BT.parts.push({s,v:vel.clone(),life:o.life||40,max:o.life||40,g:o.gravity||0,grow:o.grow||0,drag:o.drag??1,fade:o.fade??true,floor:o.floor})}
function bParticles(){const P=BT.parts;for(let i=P.length-1;i>=0;i--){const p=P[i];p.life--;p.v.y-=p.g;p.v.multiplyScalar(p.drag);p.s.position.add(p.v);if(p.floor!==undefined&&p.s.position.y<p.floor){p.s.position.y=p.floor;p.v.set(0,0,0)}
  if(p.fade)p.s.material.opacity=p.life/p.max*p.s.material.userData.o;if(p.grow)p.s.scale.addScalar(p.grow);if(p.life<=0){BT.scene.remove(p.s);p.s.material.dispose();P.splice(i,1)}}}
const _bv=new THREE.Vector3(),_bv2=new THREE.Vector3(),_bv3=new THREE.Vector3();
const bV=(x,y,z)=>new THREE.Vector3(x,y,z);
function fxSplash(p){for(let i=0;i<10;i++)bSpawn(p,bV(brand(-.6,.6),brand(.8,1.8),brand(-.6,.6)),{color:0xffffff,size:brand(2,5),life:brand(20,35),gravity:.07});bSpawn(bV(p.x,1.5,p.z),bV(0,0,0),{color:0xffffff,size:6,life:30,grow:.7,opacity:.7});sndSplash()}
function fxMuzzle(p,dx,dz){const d=bV(dx,0,dz).normalize();bSpawn(p,d.clone().multiplyScalar(.5),{color:0xffb300,size:7,life:8,additive:true,grow:.5});
  for(let i=0;i<6;i++)bSpawn(p,d.clone().multiplyScalar(brand(.3,.9)).add(bV(brand(-.2,.2),brand(.1,.3),brand(-.2,.2))),{color:0xcccccc,size:brand(3,5),life:brand(40,70),grow:.25,opacity:.6,drag:.96})}
function fxHit(p,color=0x8d6e63){for(let i=0;i<14;i++)bSpawn(p,bV(brand(-1,1),brand(.5,1.8),brand(-1,1)),{tex:BTEX.square,color,size:brand(1,2.2),life:brand(30,50),gravity:.06});
  for(let i=0;i<5;i++)bSpawn(p,bV(brand(-.3,.3),brand(.3,.6),brand(-.3,.3)),{color:0x555555,size:5,life:50,grow:.3,opacity:.6});bSpawn(p,bV(0,0,0),{color:0xff9800,size:10,life:8,additive:true,grow:1})}
function fxSparkle(p){for(let i=0;i<18;i++)bSpawn(p,bV(brand(-.8,.8),brand(.5,1.6),brand(-.8,.8)),{color:0xffe082,size:brand(2,4),life:brand(25,45),gravity:.03,additive:true})}
function fxCoins(dk){const o=bV(dk.x,16,dk.z).addScaledVector(bV(dk.ux,0,dk.uz),-40);for(let i=0;i<60;i++)bSpawn(o,bV(brand(-1.2,1.2),brand(1.2,3),brand(-1.2,1.2)),{color:0xffd700,size:brand(1.5,2.5),life:brand(60,120),gravity:.06,floor:7,fade:false})}
function fxFirework(dk){const c=[0xff5252,0xffd740,0x69f0ae,0x40c4ff,0xea80fc][Math.floor(Math.random()*5)],side=brand(-160,160),back=brand(120,300),o=bV(dk.x+dk.uz*side-dk.ux*back,brand(120,200),dk.z-dk.ux*side-dk.uz*back);
  for(let i=0;i<40;i++)bSpawn(o,bV(brand(-1,1),brand(-1,1),brand(-1,1)).normalize().multiplyScalar(brand(.8,1.6)),{color:c,size:brand(3,5),life:brand(50,80),gravity:.02,additive:true,drag:.97});
  for(let i=0;i<25;i++)bSpawn(o,bV(brand(-1,1),brand(-.3,1.2),brand(-1,1)),{tex:BTEX.square,color:[0xff1744,0xffea00,0x00e5ff,0x76ff03][i%4],size:1.8,life:brand(120,200),gravity:.012,drag:.985});sndPop()}

/* ---------- sound: the sea, an engine for each boat on this screen, bangs and splashes (WebAudio, no files) ---------- */
function bSnd(){if(BT.snd||!AC)return BT.snd;try{const C=AC,master=C.createGain();master.gain.value=0;master.connect(C.destination);
  const sea=C.createBufferSource();sea.buffer=noiseBuf(C,4);sea.loop=true;const lp=C.createBiquadFilter();lp.type='lowpass';lp.frequency.value=420;const sg=C.createGain();sg.gain.value=0;
  const lfo=C.createOscillator();lfo.frequency.value=.13;const lg=C.createGain();lg.gain.value=.04;lfo.connect(lg);lg.connect(sg.gain);lfo.start();sea.connect(lp);lp.connect(sg);sg.connect(master);sea.start();
  const fx=C.createGain();fx.gain.value=.7;fx.connect(master);
  const eng=()=>{const o=C.createOscillator();o.type='sawtooth';o.frequency.value=40;const o2=C.createOscillator();o2.type='square';o2.frequency.value=20;const f=C.createBiquadFilter();f.type='lowpass';f.frequency.value=500;f.Q.value=2;
    const g=C.createGain();g.gain.value=0;o.connect(f);o2.connect(f);f.connect(g);let p=null;try{p=C.createStereoPanner();g.connect(p);p.connect(master)}catch(e){g.connect(master)}o.start();o2.start();return{o,o2,f,g,p}};
  BT.snd={master,fx,sea:sg,eng:[eng(),eng()],nb:noiseBuf(C,1)}}catch(e){BT.snd=null}return BT.snd}
function bSndUpdate(){const S_=bSnd();if(!S_)return;const t=AC.currentTime,on=BT.on&&state.sound,run=on&&!BT.paused&&['intro','count','race','won'].includes(BT.phase),va=state.volAmb/70,vc=state.volCar/70;
  S_.master.gain.setTargetAtTime(on?1:0,t,.15);S_.sea.gain.setTargetAtTime(.07*va,t,.3);S_.fx.gain.setTargetAtTime(.7*va,t,.1);
  S_.eng.forEach((e,i)=>{const p=BT.P[i];if(e.p)e.p.pan.value=BT.P.length>1?(i?.6:-.6):0;if(!p||!run){e.g.gain.setTargetAtTime(0,t,.15);return}
    const b=p.b,sp=Math.abs(b.speed),thr=p.inp?p.inp.gas:0,base=38+sp*42+thr*10+(b.boost>0?18:0);
    e.o.frequency.setTargetAtTime(base,t,.06);e.o2.frequency.setTargetAtTime(base*.5,t,.06);e.f.frequency.setTargetAtTime(380+sp*450+thr*250,t,.08);e.g.gain.setTargetAtTime((.035+sp*.025+thr*.02)*vc,t,.15)})}
const bSndOk=()=>!!((BT.on||(typeof FL!=='undefined'&&FL.on))&&state.sound&&bSnd());   // the flight (js/plane.js) uses the bangs and chimes too
function bEnv(n,t0,a,peak,d){n.gain.setValueAtTime(.0001,t0);n.gain.linearRampToValueAtTime(peak,t0+a);n.gain.exponentialRampToValueAtTime(.0001,t0+a+d)}
function bNoise(t,dur,type,freq,peak,a,d,f2){const C=AC,n=C.createBufferSource();n.buffer=BT.snd.nb;const f=C.createBiquadFilter();f.type=type;f.frequency.setValueAtTime(freq,t);if(f2)f.frequency.exponentialRampToValueAtTime(f2,t+dur);
  const g=C.createGain();bEnv(g,t,a,peak,d);n.connect(f);f.connect(g);g.connect(BT.snd.fx);n.start(t);n.stop(t+dur+.05);return f}
function bOsc(type,f0,f1,t,a,peak,d){const C=AC,o=C.createOscillator();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+a+d);const g=C.createGain();bEnv(g,t,a,peak,d);o.connect(g);g.connect(BT.snd.fx);o.start(t);o.stop(t+a+d+.1)}
function sndBoom(v=1){if(v<=.02||!bSndOk())return;const t=AC.currentTime;bNoise(t,.6,'lowpass',900,.9*v,.01,.55,80);bOsc('sine',70,30,t,.005,.7*v,.4)}
function sndThud(){if(!bSndOk())return;const t=AC.currentTime;bNoise(t,.3,'bandpass',250,.8,.005,.2).Q.value=1.5;bOsc('triangle',110,45,t,.005,.6,.3)}
function sndSplash(){if(!bSndOk())return;bNoise(AC.currentTime,.35,'highpass',1800,.25,.01,.3)}
function sndCreak(){if(!bSndOk())return;const C=AC,t=C.currentTime,o=C.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(95,t);o.frequency.linearRampToValueAtTime(60,t+.5);const f=C.createBiquadFilter();f.type='lowpass';f.frequency.value=500;
  const g=C.createGain();bEnv(g,t,.05,.2,.4);o.connect(f);f.connect(g);g.connect(BT.snd.fx);o.start(t);o.stop(t+.6)}
const bTone=(f,t,d,type='square',v=.18)=>bOsc(type,f,0,t,.01,v,d);
function sndCoin(){if(!bSndOk())return;const t=AC.currentTime;bTone(988,t,.08);bTone(1319,t+.09,.22)}
function sndGate(){if(!bSndOk())return;const t=AC.currentTime;bTone(659,t,.1,'triangle',.25);bTone(880,t+.1,.1,'triangle',.25);bTone(1175,t+.2,.25,'triangle',.25)}
function sndTick(final){if(!bSndOk())return;const t=AC.currentTime;if(final){bTone(659,t,.1,'triangle',.3);bTone(988,t+.1,.35,'triangle',.3)}else bTone(440,t,.12,'triangle',.25)}
function sndPop(){if(bSndOk())bNoise(AC.currentTime,.2,'bandpass',brand(600,1400),.2,.005,.15)}
function sndGull(){if(!bSndOk())return;const C=AC,t=C.currentTime,o=C.createOscillator();o.type='sine';o.frequency.setValueAtTime(1500,t);o.frequency.linearRampToValueAtTime(2100,t+.12);o.frequency.linearRampToValueAtTime(1300,t+.35);
  const g=C.createGain();bEnv(g,t,.05,.05,.35);o.connect(g);g.connect(BT.snd.fx);o.start(t);o.stop(t+.45)}
function sndFanfare(){if(!bSndOk())return;const t=AC.currentTime,N=[523,659,784,1047,784,1047];N.forEach((n,i)=>{const d=i===N.length-1?.9:.16;bTone(n,t+i*.18,d,'triangle',.3);bTone(n/2,t+i*.18,d,'sawtooth',.08)})}
// how close something is to the boats on this screen: 1 right here, 0 from 1000 away (for sound and for skipping far-off effects)
function bNear(o){let d=1e9;for(const p of BT.P)d=Math.min(d,Math.hypot(p.b.x-o.x,p.b.z-o.z));if(!BT.P.length&&BT.cam)d=Math.hypot(BT.cam.position.x-o.x,BT.cam.position.z-o.z);return Math.max(0,1-d/1000)}

/* ---------- the boats on this screen: one, or two on a split screen ---------- */
if(!prof.boat)prof.boat={};
const bClean=(s,d)=>String(s||'').replace(/[<>&"]/g,'').replace(/\s+/g,' ').trim().slice(0,14)||d;
// player 1 sails in the car's paint, player 2 in blue (or red when the paint is blue)
function bColors(){const c=(PAINTS[prof.paint]||PAINTS[0]).c,rgb=hexRGB(c);return[c,rgb[2]>rgb[0]+30?'#e0443a':'#3b8cf0']}
function bNames(){const n=store.get('boatNames',null)||[];if(BT.net)return[NET.name,'Spiller 2'];return[bClean(n[0]||store.get('mpName',''),'Spiller 1'),bClean(n[1],'Spiller 2')]}
function bSaveNames(){if(BT.net)return;store.set('boatNames',[bClean($('bmName0').value,'Spiller 1'),bClean($('bmName1').value,'Spiller 2')])}
function bMakePlayers(n,names,num){const cols=bColors();
  if(BT.P.length!==n||BT.P.some((p,i)=>p.col!==cols[i]||p.num!==num+i)){for(const p of BT.P){BT.scene.remove(p.mesh);bDispose(p.mesh)}BT.P=[];
    for(let i=0;i<n;i++){const col=cols[i],mesh=bBoatMesh(col,num+i,col),cam=new THREE.PerspectiveCamera(58,1,1,B_FAR),pane=$('bpane'+i),q=s=>pane.querySelector(s);cam.layers.enable(i+1);BT.scene.add(mesh);
      BT.P.push({i,col,num:num+i,mesh,cam,name:'',b:makeBoat(0,0,0),camYaw:0,shake:{t:0,mag:0},vp:{x:0,y:0,w:1,h:1},baseFov:55,inp:null,warned:0,wk:0,time:null,from:new THREE.Vector3(),
        ui:{pane,place:q('.bplace'),pname:q('.bname'),pl:q('.bpl'),speed:q('.bkn'),pts:q('.bpts'),boost:q('.bboost i'),target:q('.btarget'),notice:q('.bnotice'),flash:q('.bflash'),compass:q('.bcompass').getContext('2d')}})}}
  BT.P.forEach((p,i)=>{if(p.name!==names[i]){p.name=names[i];bName(p.mesh,names[i])}p.ui.pname.textContent=names[i];p.ui.pl.textContent=BT.net?'Rom '+NET.code:n>1?'Spiller '+(i+1):'Kaptein'});
  BT.gates.forEach(g=>g.beams.forEach((bm,i)=>{if(BT.P[i])bm.material.color.set(BT.P[i].col)}))}
// points in the race: 600 for every turbo barrel, 6000 for every nut the boat earns (the chest at sea and, once moored, the race's nuts)
const BOAT_PTS={barrel:600,nut:6000};
function bPoints(p,nuts=0){return p.b.barrels*BOAT_PTS.barrel+((p.chest||0)+nuts)*BOAT_PTS.nut}
function bNotice(p,text,ms=1500){const n=p.ui.notice;n.textContent=text;n.style.opacity=1;clearTimeout(n._t);n._t=setTimeout(()=>n.style.opacity=0,ms)}
// the race on the start line: the route, its buoys and barrels, the pirates and the boats. o.seed: the same pirates and barrels for everyone in an online race
function bSetup(race,o={}){BT.race=race;BT.route=raceRoute(race);bGates(BT.route);
  const rng=mulberry32(o.seed||(Math.random()*1e9|0));BT.barrels=makeBarrels(BT.route,rng);
  if(!BT.barTpl)BT.barTpl=bBarrelMesh();for(const m of BT.barVis)BT.scene.remove(m);BT.barVis=BT.barrels.map(br=>{const m=BT.barTpl.clone();m.position.set(br.x,3,br.z);BT.scene.add(m);return m});
  BT.pir.length=0;for(const p of makePirates(BT.route,Math.max(1,Math.round(race.pirates*(state.assist?.6:1))),rng))BT.pir.push(p);
  while(BT.pirVis.length<BT.pir.length){const m=bShipMesh();BT.scene.add(m);BT.pirVis.push(m)}
  for(const b of BT.balls)b.dead=true;BT.balls.length=0;bBalls();BT.vol=race.lava?makeVolcano():null;
  const N=BT.net;bMakePlayers(BT.two&&!N?2:1,bNames(),N&&N.racing?N.num:1);
  BT.P.forEach((p,i)=>{const s=startSlot(BT.route,N&&N.racing?N.slot:i,N&&N.racing?N.slots:BT.P.length);p.b=makeBoat(s.x,s.z,s.a);p.camYaw=s.a;p.time=null;p.chest=0;p.shake={t:0,mag:0};p.warned=0;p.mesh.visible=true});
  for(const id in BT.docks)BT.docks[id].lid.rotation.x=0;
  BT.treasure.visible=!prof.boat.chest;BT.chestNow=false;
  BT.step=0;BT.time=0;BT.acc=0;BT.winner=null;BT.winT=0;BT.coins=false;BT.fireT=0;BT.result=false;BT.paused=false;BT.finDock=null;bLayout()}
// go: when the countdown says «Full gass!» (performance.now()). Before it the camera swoops down from the sky, then 3 – 2 – 1.
function boatBegin(o={}){bSetup(o.race||BT.race,o);$('boatMenu').hidden=true;$('boatPause').hidden=true;$('result').hidden=true;
  const now=performance.now();BT.goAt=o.go||now+5400;BT.introAt=now;BT.beat=4;BT.phase='intro';
  BT.P.forEach(p=>{const b=p.b,side=BT.P.length>1&&!p.i?-380:380,h=bHead(b.a),r=bRight(b.a);p.from.set(b.x+h.x*480+r.x*side,260,b.z+h.z*480+r.z*side);p.cam.position.copy(p.from)});
  $('boatHud').classList.remove('menu','won');bHUD()}
function bCountdown(now){const left=(BT.goAt-now)/1000;if(BT.phase==='intro'&&left<=2.4)BT.phase='count';if(BT.phase!=='count')return;
  if(left<=0){BT.phase='race';bCount('Full gass!',true);return}const n=Math.ceil(left/.8);if(n<BT.beat&&n>=1&&n<=3){BT.beat=n;bCount(String(n),false)}}
function bCount(txt,final){const el=$('bcount');el.textContent=txt;el.hidden=false;el.style.animation='none';void el.offsetWidth;el.style.animation='';sndTick(final);clearTimeout(el._t);el._t=setTimeout(()=>{el.hidden=true},final?900:780)}

/* ---------- every 60 Hz step of the race ---------- */
function bInput(p){if(BT.P.length<2){const I=state.inp||{gas:0,rev:0,steer:0};return{gas:I.gas,rev:I.rev,steer:I.steer}}
  const k=keys,ti=state.input,pads=navigator.getGamepads?[...navigator.getGamepads()].filter(g=>g&&g.connected):[],gp=pads[p.i];let gas=0,rev=0,steer=0;
  if(p.i===0){if(k.has('w'))gas=1;if(k.has('s'))rev=1;if(k.has('a'))steer+=1;if(k.has('d'))steer-=1;gas=Math.max(gas,ti.gas);rev=Math.max(rev,ti.rev);steer+=ti.left-ti.right}
  else{if(k.has('arrowup'))gas=1;if(k.has('arrowdown'))rev=1;if(k.has('arrowleft'))steer+=1;if(k.has('arrowright'))steer-=1;gas=Math.max(gas,ti.gas2||0);rev=Math.max(rev,ti.rev2||0);steer+=(ti.left2||0)-(ti.right2||0)}
  if(gp){const ax=gp.axes[0]||0;if(Math.abs(ax)>.12)steer-=ax;gas=Math.max(gas,gp.buttons[7]?gp.buttons[7].value:0);rev=Math.max(rev,gp.buttons[6]?gp.buttons[6].value:0);const ly=gp.axes[1]||0;if(ly<-.2)gas=Math.max(gas,-ly);if(ly>.2)rev=Math.max(rev,ly)}
  return{gas,rev,steer:Math.max(-1,Math.min(1,steer))}}
function bStep(){BT.wave+=BSTEP;const racing=BT.phase==='race',B=BT.P.map(p=>p.b),live=racing?B.filter(b=>!b.done):[];
  if(racing){BT.step++;BT.time+=BSTEP}
  for(const p of BT.P){const b=p.b;if(racing&&!b.done){p.inp=bInput(p);stepBoat(b,p.inp,BT.W);continue}
    p.inp=null;if(BT.phase==='race'||BT.phase==='won'){b.speed*=.95;b.vx*=.95;b.vz*=.95;b.x+=b.vx;b.z+=b.vz;b.turnVis*=.9}}   // drifting to a stop
  if(racing){if(B.length>1)boatsCollide(B[0],B[1]);for(const r of BT.remote.values())if(r.live&&!B[0].done)boatsCollide(B[0],r,true)}
  for(const e of stepPirates(BT.pir,live,BT.W,BT.balls,Math.random,{easy:state.assist}))sndBoom(.7*bNear(e.p));
  if(BT.vol&&racing){const e=stepVolcano(BT.vol,live,BT.balls,Math.random);if(e&&e.type==='erupt'){sndBoom(.6*bNear(BT.vol));for(const p of BT.P)if(Math.hypot(p.b.x-BT.vol.x,p.b.z-BT.vol.z)<1100)bNotice(p,'Vulkanen har utbrudd!',1600)}}
  for(const e of stepBalls(BT.balls,live)){if(e.type==='hit'){const p=BT.P.find(q=>q.b===e.t);if(p)bHit(p,e.b);continue}
    if(bNear(e.b)<=0)continue;fxSplash(bV(e.b.x,1,e.b.z));if(e.b.kind==='lava')for(let i=0;i<8;i++)bSpawn(bV(e.b.x,3,e.b.z),bV(brand(-.6,.6),brand(.6,1.4),brand(-.6,.6)),{color:0xff7a20,size:brand(2,4),life:30,gravity:.05,additive:true})}
  if(racing){for(const e of stepBarrels(BT.barrels,live,BT.step)){if(e.type==='taken'){const p=BT.P.find(q=>q.b===e.b);fxSparkle(bV(e.br.x,4,e.br.z));sndCoin();if(p)bNotice(p,'Turbo! +'+BOAT_PTS.barrel+' poeng',1000)}else if(bNear(e.br)>0)fxSparkle(bV(e.br.x,4,e.br.z))}
    for(const p of BT.P){const e=boatCheck(p.b,BT.route);if(e)bProgress(p,e);bChestGrab(p)}}
  for(const p of BT.P){for(const e of p.b.ev)if(e.type==='bump'){p.shake={t:14,mag:e.mag};sndThud();sndCreak();if(e.what==='land')fxHit(bV(p.b.x,3,p.b.z),0xe8d9ae)}p.b.ev.length=0;bWake(p,p.b)}
  for(const r of BT.remote.values())if(r.live)bWake(r,r);
  const erupt=BT.vol&&BT.vol.left>0;for(const s of BT.smokers)if(Math.random()<(erupt?.6:.15)&&bNear(s)>0)bSpawn(bV(s.x+brand(-5,5),s.y,s.z+brand(-5,5)),bV(brand(-.1,.1),.35,brand(-.1,.1)),{color:erupt?0x5a3a2a:0x777777,size:12,life:120,grow:.25,opacity:.5});
  bBalls();bParticles()}
// the wake behind a boat, spray from the bow, a rooster tail from the motor, sparks while the turbo lasts, steam while it spins
function bWake(p,b){const sp=Math.abs(b.speed),m=p.mesh.position,fwd=bHead(b.a,_bv),r=bRight(b.a,_bv2);
  if(b.spin>0&&b.spin%3===0)bSpawn(bV(m.x,2.6,m.z),bV(brand(-.6,.6),.5,brand(-.6,.6)),{color:0xffffff,size:4,life:25,gravity:.03,opacity:.8});
  if(sp<=.2||++p.wk%(state.gfx==='lo'?4:2))return;
  for(const s of[-1,1])bSpawn(bV(m.x-fwd.x*9+r.x*s*2.4,2.6,m.z-fwd.z*9+r.z*s*2.4),bV(r.x*s*.16*sp,0,r.z*s*.16*sp),{color:0xffffff,size:4.5,life:80,grow:.25,opacity:.5,drag:.98});
  if(b.speed>1)bSpawn(bV(m.x-fwd.x*10,3,m.z-fwd.z*10),bV(-fwd.x*.5*b.speed+brand(-.15,.15),.6+b.speed*.25,-fwd.z*.5*b.speed),{color:0xffffff,size:brand(2.5,4),life:30,gravity:.05,opacity:.85,grow:.08});
  if(b.speed>1.3&&p.wk%4===0)for(const s of[-1,1])bSpawn(bV(m.x+fwd.x*4+r.x*s*2.6,2.6,m.z+fwd.z*4+r.z*s*2.6),bV(r.x*s*.7,.7,r.z*s*.7),{color:0xffffff,size:3,life:22,gravity:.05,opacity:.8});
  if(b.boost>0)bSpawn(bV(m.x-fwd.x*10,4,m.z-fwd.z*10),bV(brand(-.1,.1),.3,brand(-.1,.1)),{color:0xffb300,size:3,life:20,additive:true})}
// cannonballs and lava bombs: a mesh for each new one (with a flash from the cannon), moved along, gone when it lands
function bBalls(){for(const b of BT.balls)if(!b.m){if(b.kind==='lava'){b.m=new THREE.Sprite(BT.lavaMat||(BT.lavaMat=new THREE.SpriteMaterial({map:BTEX.soft,color:0xff7a20,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false})));b.m.scale.setScalar(12)}
    else{b.m=new THREE.Mesh(BT.ballGeo||(BT.ballGeo=new THREE.SphereGeometry(1.1,8,8)),BT.ballMat||(BT.ballMat=new THREE.MeshStandardMaterial({color:0x111111,roughness:.4,metalness:.5})));if(bNear(b)>0)fxMuzzle(bV(b.x,b.y,b.z),b.vx,b.vz)}
    b.m.position.set(b.x,b.y,b.z);BT.scene.add(b.m);BT.ballVis.push(b)}
  BT.ballVis=BT.ballVis.filter(b=>{if(b.dead){BT.scene.remove(b.m);return false}b.m.position.set(b.x,b.y,b.z);if(b.kind==='lava'&&Math.random()<.3&&bNear(b)>0)bSpawn(b.m.position,bV(0,.1,0),{color:0x555555,size:6,life:40,grow:.3,opacity:.5});return true})}
function bHit(p,ball){p.shake={t:22,mag:4};fxHit(bV(ball.x,Math.max(3,ball.y),ball.z));sndThud();const f=p.ui.flash;f.style.opacity=1;setTimeout(()=>f.style.opacity=0,200);bNotice(p,ball.kind==='lava'?'Lavabombe!':'Truffet!',1200)}
function bProgress(p,e){const R=BT.route;if(e.type==='buoy'){sndGate();bNotice(p,p.b.gate<R.buoys.length?'Bøye '+p.b.gate+' ✓':'Kurs mot '+R.dock.to+'!',1400)}
  else if(e.type==='slow'){const now=performance.now();if(now-p.warned>1800){bNotice(p,'Sakk farten for å fortøye!',1200);p.warned=now}}
  else if(e.type==='finish')bFinish(p)}
function bChestGrab(p){const T=BT.treasure;if(!T.visible||Math.hypot(p.b.x-SEA.chest[0],p.b.z-SEA.chest[1])>26)return;T.visible=false;prof.boat.chest=1;prof.nuts+=50;saveProf();BT.chestNow=true;p.chest=50;
  fxSparkle(T.position);fxSparkle(T.position);sndCoin();bNotice(p,'Skattekista! +50 ⚙ · +'+fmtN(50*BOAT_PTS.nut)+' poeng',2400)}

/* ---------- moored: the winner opens the chest on the dock, the result follows ---------- */
function bFinish(p){p.time=BT.time;if(BT.phase!=='race')return;const N=BT.net;
  if(N&&N.racing)bNetSend({t:'Bf',id:N.id,time:+p.time.toFixed(2),hits:p.b.hits,barrels:p.b.barrels,gate:p.b.gate});
  BT.phase='won';BT.winner=p;BT.winT=0;BT.coins=false;BT.fireT=0;BT.finDock=BT.docks[BT.route.dock.id];
  BT.cam.position.copy(p.cam.position);BT.cam.quaternion.copy(p.cam.quaternion);BT.cam.fov=58;BT.cam.aspect=innerWidth/innerHeight;BT.cam.updateProjectionMatrix();
  for(const b of BT.balls)b.dead=true;BT.balls.length=0;$('boatHud').classList.add('won');$('boatPause').hidden=true;sndFanfare()}
function bWon(dt){BT.winT+=dt;const D=BT.finDock;if(D.lid.rotation.x>-Math.PI/2)D.lid.rotation.x-=dt*2.4;else if(!BT.coins){BT.coins=true;fxCoins(D.dk);sndCoin()}
  BT.fireT-=dt;if(BT.fireT<=0&&BT.winT>1.5){fxFirework(D.dk);BT.fireT=brand(.5,1.3)}
  if(BT.winT>3.2&&!BT.result)bShowResult()}
// everyone in the race: on this screen and (online) the others, in order: moored first by time, then by how far they have come
function bPlaces(){const R=BT.route,L=BT.P.map(p=>({me:p===BT.P[0],name:p.name,time:p.time,gate:p.b.gate,barrels:p.b.barrels,hits:p.b.hits,prog:boatProgress(p.b,R),p}));
  for(const r of BT.remote.values()){if(r.quit&&!r.done)continue;const t=r.gate<R.buoys.length?R.buoys[r.gate]:R.dock;L.push({name:r.name,time:r.done?r.time:null,gate:r.gate,barrels:r.barrels||0,hits:r.hits||0,prog:(r.done?1e7:0)+r.gate*1e5-Math.hypot(r.x-t.x,r.z-t.z)})}
  return L.sort((a,b)=>a.time!=null&&b.time!=null?a.time-b.time:b.prog-a.prog)}
function bShowResult(){BT.result=true;const race=BT.race,R=BT.route,onl=!!(BT.net&&BT.net.racing),two=BT.P.length>1,w=BT.winner||BT.P[0],p=two?w:BT.P[0],b=p.b,done=p.time!=null,t=done?p.time:BT.time,par=race.par,key=boatKey(race);
  const stars=!done?0:t<=par[0]?3:t<=par[1]?2:1,prev=best[key];let isBest=false;
  if(done&&(!prev||t<prev.t)){best[key]={t,s:Math.max(stars,prev?prev.s:0),h:b.hits};store.set('best',best);isBest=true}else if(done&&stars>prev.s){prev.s=stars;store.set('best',best)}
  const L=onl||two?bPlaces():null,place=onl?L.findIndex(q=>q.me)+1:0;
  let e=b.gate*5;const el=[b.gate+(b.gate===1?' bøye':' bøyer')+' +'+b.gate*5];
  if(b.barrels){e+=b.barrels*3;el.push(b.barrels+' turbo +'+b.barrels*3)}
  if(done){e+=20;el.push('i mål +20');if(!b.hits){e+=15;el.push('aldri truffet +15')}}
  if(done&&!prev){e+=60;el.push('første gang +60')}else if(isBest){e+=20;el.push('ny rekord +20')}
  if(place===1&&L.length>1){e+=25;el.push('vant +25')}
  prof.nuts+=e;saveProf();const pts=bPoints(p,e);BT.res={L,place,isBest,prev,stars,pts};
  $('rLevel').textContent='Captain Theis\' marina · '+race.name;
  $('rTitle').textContent=onl?(place===1?'Du vant!':done?place+'. plass':'Løpet er over'):two?w.name+' vant!':!b.hits?'Feilfri tur!':'I mål!';
  $('rTime').textContent=fmtTime(t);$('rPenL').textContent='Truffet';$('rPen').textContent=b.hits;$('rGatesL').textContent='Bøyer';$('rGates').textContent=b.gate+'/'+R.buoys.length;
  $('rStars').innerHTML=[0,1,2].map(i=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z" fill="${i<stars?'#E5A92B':'rgba(242,232,208,.15)'}"/></svg>`).join('');$('rStars').setAttribute('aria-label',stars+' av 3 stjerner');
  el.push(fmtN(pts)+' poeng');bResultLog();$('rNuts').textContent='+'+fmtN(e);$('rNutsNote').textContent=el.join(' · ');
  $('rNext').textContent=onl?'Tilbake til lobbyen':'Ny runde';$('rRetry').textContent='Velg løp';$('rRetry').hidden=onl;$('rMenu').textContent='Tilbake til bilen';$('rGarage').hidden=true;
  $('result').hidden=false;$('rNext').focus()}
// the list under the result: the order (two players or online, it fills in as the others moor), turbo, hits, the chest, what the stars need
function bResultLog(){const R=BT.route,race=BT.race,S=BT.res,items=[];if(!S)return;
  if(S.L){const L=BT.net&&BT.net.racing?bPlaces():S.L;L.forEach((q,i)=>items.push(`<li><b>${i+1}. ${q.name}:</b> ${q.time!=null?fmtTime(q.time):'ikke i mål'} · ${q.gate}/${R.buoys.length} bøyer · ${q.barrels} turbo · truffet ${q.hits}</li>`))}
  else{const b=BT.P[0].b;items.push(`<li><b>Turbotønner:</b> ${b.barrels}</li>`,`<li><b>Truffet av piratene:</b> ${b.hits}${b.hits?'':', helt feilfritt'}</li>`)}
  if(BT.chestNow)items.push('<li><b>Skattekista funnet:</b> +50 ⚙</li>');
  items.push(`<li><b>Poeng:</b> ${fmtN(S.pts)} (${BOAT_PTS.barrel} per turbotønne, ${fmtN(BOAT_PTS.nut)} per mutter)</li>`);
  items.push(`<li><b>Mål for stjerner:</b> ${fmtTime(race.par[0])} gir tre, ${fmtTime(race.par[1])} gir to</li>`);
  if(S.isBest&&S.prev)items.push('<li><b>Ny personlig rekord i dette løpet.</b></li>');$('rLog').innerHTML=items.join('')}
function bResultReset(){$('rGarage').hidden=false;$('rRetry').hidden=false;$('rMenu').textContent='Til menyen';$('rPenL').textContent='Straff';$('rGatesL').textContent='Porter';$('rRetry').textContent='Prøv igjen'}
// the result buttons (game.js): next = the same race again, retry = pick a race, car = back to the car
function boatResultBtn(btn){if(!BT.on||!BT.result)return false;BT.result=false;$('result').hidden=true;bResultReset();$('boatHud').classList.remove('won');
  if(btn==='car')boatExit();else if(btn==='next'&&!BT.net)boatBegin();else bMenu();return true}

/* ---------- the trip: the question at the marina, the boat menu, back to the car ---------- */
function boatAsk(k){$('aYes').hidden=false;$('aList').hidden=true;
  if(k==='boat'){const n=boatDone();$('aKind').textContent='Captain Theis\' marina';$('aName').textContent='Motorbåtløpet';
    $('aDesc').textContent='Lån en motorbåt og kjør om kapp ute i skjærgården: rund bøyene og fortøy ved brygga før noen andre. Bilen venter her.';
    $('aBest').textContent=n?'Du har fullført '+n+' av '+BOAT_RACES.length+' båtløp.':'Første tur i hvert løp gir bonus.';$('aQ').textContent='Vil du kjøre båt?';$('aNo').textContent='NEI, kjør videre';$('ask').hidden=false;$('aYes').focus();return}
  if(k==='boatInvite'){const v=BT.invite,race=v&&BOAT_RACES.find(r=>r.id===v.race);$('aKind').textContent='Kjør sammen · båtløp';$('aName').textContent=race?race.name:'Båtløp';
    $('aDesc').textContent=(v?v.name:'En venn')+' vil kjøre båtløp mot deg fra Captain Theis\' marina. Bilen blir stående der den er.';$('aBest').textContent='';$('aQ').textContent='Vil du bli med?';$('aNo').textContent='Nei takk';$('ask').hidden=false;$('aYes').focus()}}
function boatAnswer(k,yes){
  if(k==='boat'){if(yes)boatStart();else{state.mode='play';state.askCool='boat';toast('Kjør videre når du vil')}return}
  if(k==='boatInvite'){const v=BT.invite;state.mode='play';if(yes&&v)boatStart(v);else{if(v)bNetSend({t:'Bl',id:v.id});BT.invite=null}}}
// out to the boat: the screen goes dark, the sea comes up with the boat menu. join: an invitation to accept on the way
function boatStart(join){if(BT.on||BT.fade||(typeof FL!=='undefined'&&(FL.on||FL.fade)))return;initAudio();if(AC&&AC.state==='suspended')AC.resume();state.mode='boat';car.vel.set(0,0,0);car.w.set(0,0,0);car.throttle=0;setOffer(null);
  $('fade').classList.add('on');BT.fade={t:0,hold:.2,cb:()=>{buildSea();bShadowSize();BT.on=true;BT.two=!!store.get('boatTwo',false);$('hud').hidden=true;$('hint').hidden=true;$('boatHud').hidden=false;if(join&&join.id)bNetJoin(join);bMenu()}}}
function boatExit(){if(BT.fade||!BT.on)return;bNetLeave(true);$('fade').classList.add('on');
  BT.fade={t:0,hold:.2,cb:()=>{BT.on=false;BT.phase='';BT.result=false;BT.paused=false;bRemoteClear();if(BT.snd)BT.snd.master.gain.setTargetAtTime(0,AC.currentTime,.1);$('boatHud').hidden=true;$('boatMenu').hidden=true;$('boatPause').hidden=true;$('bcount').hidden=true;if(!$('result').hidden){$('result').hidden=true;bResultReset()}
    renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);state.mode='play';state.askCool='boat';camSnap=true;showHud();toast('Tilbake ved bilen')}}}
const bSelRace=()=>{const id=BT.net?BT.net.race:store.get('boatRace','rundt');let r=BOAT_RACES.find(q=>q.id===id);if(!r)r=BOAT_RACES[0];return r};
// the boat menu: the boats wait on the start line while the camera circles them
function bMenu(){BT.result=false;BT.paused=false;$('result').hidden=true;$('boatPause').hidden=true;$('bcount').hidden=true;$('boatHud').classList.add('menu');$('boatHud').classList.remove('won');bRemoteClear();
  const N=BT.net;if(N){N.racing=false;BT.phase='lobby';bNetSend({t:'Br',id:N.id,ready:1})}else BT.phase='menu';
  bSetup(bSelRace());bMenuRender();$('boatMenu').hidden=false;const f=$('bmGo');if(!f.hidden)f.focus()}
function bMenuRender(){const N=BT.net,lead=!N||N.lead===NET.me,sel=bSelRace();
  $('bmRaces').innerHTML=BOAT_RACES.map(r=>{const b=best[boatKey(r)],st=b?'★'.repeat(b.s)+'☆'.repeat(3-b.s):'☆☆☆';
    return`<button data-race="${r.id}" aria-pressed="${r===sel}"${lead?'':' disabled'}><span><span class="nm"><i class="pdot" style="background:${DIFFCOL[r.diff]}"></i>${r.name}</span><span class="sub">${r.desc}${b?' Beste: '+fmtTime(b.t)+'.':''}</span></span><span class="pr">${st}</span></button>`}).join('');
  const touch=document.body.classList.contains('is-touch'),names=bNames(),cols=bColors();
  $('bmSeg').hidden=!!N;$('bm1').setAttribute('aria-pressed',!BT.two);$('bm2').setAttribute('aria-pressed',BT.two);$('bmP2').hidden=!BT.two||!!N;$('bmName0').disabled=!!N;
  $('bmName0').value=names[0];$('bmName1').value=names[1];$('bmChip0').style.background=cols[0];$('bmChip1').style.background=cols[1];
  $('bmKeys0').textContent=BT.two&&!N?'Spiller 1 · W A S D'+(touch?' eller knappene til venstre':''):touch?'Kaptein · knappene på skjermen':'Kaptein · WASD eller piltastene';$('bmKeys1').textContent='Spiller 2 · piltastene'+(touch?' eller knappene til høyre':'');
  // drive together: invite the room, answer an invitation, or wait in the lobby
  const room=typeof NET!=='undefined'&&NET.on&&NET.players.size>0,inv=!N&&BT.invite;$('bmNet').hidden=!room&&!N&&!inv;
  if(!$('bmNet').hidden){$('bmNetCode').textContent=NET.code;const list=$('bmNetList');list.innerHTML='';$('bmInvite').hidden=!!N||!!inv||BT.two;$('bmJoin').hidden=$('bmDecline').hidden=!inv;$('bmLeave').hidden=!N;
    if(inv){const r=BOAT_RACES.find(q=>q.id===inv.race);$('bmNetNote').textContent=inv.name+' har startet '+(r?r.name:'et båtløp')+' og venter på deg.'}
    else if(!N)$('bmNetNote').textContent=BT.two?'Velg 1 spiller for å kjøre mot de andre i rommet.':'Vil du kjøre mot de andre i rommet? Inviter dem, så kan de bli med fra der de er.';
    else{const L=bNetRoster();$('bmNetNote').textContent=lead?'Velg løp og start når de andre er klare. De som ikke er klare, står over denne runden.':'Venter på at '+((NET.players.get(N.lead)||{}).name||'lederen')+' starter løpet.';
      for(const e of L){const li=document.createElement('li'),dot=document.createElement('i'),nm=document.createElement('span'),st=document.createElement('small');dot.style.background=e.id===NET.me?'#ff6a2a':netCol(e.slot);
        nm.textContent=e.name+(e.id===NET.me?' (deg)':'')+(e.id===N.lead?' · leder':'');st.textContent=e.ready?'klar':'kjører';li.append(dot,nm,st);list.appendChild(li)}}}
  $('bmGo').hidden=!lead;$('bmGo').textContent=N?'Start løpet for alle':'Start løpet'}
// pause: only on this screen; online the race goes on
function bPause(on){if(!BT.on||BT.result||!['intro','count','race'].includes(BT.phase))return;const onl=!!(BT.net&&BT.net.racing);
  if(on&&!BT.paused&&!onl){BT.paused=true;BT.pauseAt=performance.now()}else if(!on&&BT.paused){BT.paused=false;const d=performance.now()-BT.pauseAt;BT.goAt+=d;BT.introAt+=d}
  $('boatPause').hidden=!on;if(!on)return;$('bpNote').textContent=onl?'Løpet går videre for de andre mens du er her.':'';$('bpRestart').hidden=onl;$('bpMenu').textContent=onl?'Forlat løpet':'Velg løp';$('bpSound').textContent='Lyd: '+(state.sound?'på':'av');$('bpResume').focus()}
function boatKeyDown(k){if(BT.fade||!BT.on||BT.result)return;
  if(BT.phase==='menu'||BT.phase==='lobby'){if(k==='escape')boatExit();else if(k==='enter'&&document.activeElement===document.body&&!$('bmGo').hidden)$('bmGo').click();return}
  if(k==='escape'||k==='p'){bPause($('boatPause').hidden);return}if(!$('boatPause').hidden)return;
  if((k==='enter'||k===' ')&&BT.phase==='intro'&&!(BT.net&&BT.net.racing)){BT.goAt=Math.min(BT.goAt,performance.now()+2400);BT.introAt=Math.min(BT.introAt,BT.goAt-2401)}   // skip the swoop
  if(k==='m')setSound(!state.sound)}

/* ---------- every frame (from game.js): the fades, the 60 Hz steps, effects, cameras, HUD, sound, drawing ---------- */
function updateBoat(dt){
  if(BT.fade){const f=BT.fade;f.t+=dt;if(f.t>.9&&!f.done){f.done=true;f.cb()}if(f.t>.9+f.hold){$('fade').classList.remove('on');BT.fade=null}}
  if(!BT.on){bMarinaAnim();return false}
  const now=performance.now();
  if(!BT.paused){if(BT.phase==='intro'||BT.phase==='count')bCountdown(now);BT.acc+=dt;let n=0;while(BT.acc>=BSTEP&&n<8){bStep();BT.acc-=BSTEP;n++}if(n>=8)BT.acc=0;if(BT.phase==='won')bWon(dt)}
  bAnimate(dt,now);bCameras(dt,now);if(['intro','count','race','won'].includes(BT.phase)){BT.hudT-=dt;if(BT.hudT<=0){BT.hudT=1/30;bHUD()}}
  bNetTick(dt);if(typeof seaSend==='function'&&BT.P[0]&&BT.phase)seaSend('b',BT.P[0].b,dt);bSndUpdate();bRender();return true}
// the sea itself: waves, foam, torches and lamps, clouds and gulls (the flight in js/plane.js uses this too)
function bWorldAnim(dt,now){const t=now*.001,f60=dt*60;BT.wu.uTime.value=BT.wave;
  for(const f of BT.foam){const s=Math.sin(t*1.6+f.ph);f.m.material.opacity=.22+.18*s;f.m.scale.set(1+.03*s,1+.03*s,1)}
  for(const tf of BT.torches)tf.material.emissiveIntensity=.9+Math.random()*.7;
  for(const l of BT.lamps){if(l.lamp)l.lamp.material.emissiveIntensity=1.2+Math.sin(t*3)*.6;if(l.flag)bFlag(l.flag,t,1.2)}
  for(const c of BT.clouds){c.position.x+=c.userData.drift*f60;if(c.position.x>2100)c.position.x=-2100}
  for(const s of BT.gulls){s.a+=s.speed*.004*f60;const x=Math.cos(s.a)*s.rad,z=Math.sin(s.a)*s.rad;s.g.position.set(x,s.g.position.y,z);s.g.lookAt(Math.cos(s.a+.1)*s.rad,s.g.position.y,Math.sin(s.a+.1)*s.rad);const fl=Math.sin(t*9+s.ph);s.l.rotation.z=fl*.5;s.r.rotation.z=-fl*.5}}
function bAnimate(dt,now){const t=now*.001,f60=dt*60;bWorldAnim(dt,now);
  BT.barVis.forEach((m,i)=>{const br=BT.barrels[i];m.visible=br.on;m.position.y=2.5+bWave(br.x,br.z,BT.wave);m.rotation.y+=.01*f60;m.rotation.x=Math.sin(t+br.phase)*.15});
  const game=['intro','count','race'].includes(BT.phase);
  BT.gates.forEach((g,gi)=>{for(const l of g.lamps)l.material.emissiveIntensity=1+Math.sin(t*4+gi)*.6;g.beams.forEach((bm,pi)=>{const p=BT.P[pi];bm.visible=game&&!!p&&p.b.gate===gi&&!p.b.done;bm.material.opacity=.22+.12*Math.sin(t*3)})});
  BT.P.forEach(p=>bPose(p.mesh,p.b,t,p.i));
  BT.pirVis.forEach((m,i)=>{const p=BT.pir[i];m.visible=!!p;if(!p)return;m.position.set(p.x,bWave(p.x,p.z,BT.wave)+2,p.z);m.rotation.y=p.a;m.rotation.z=Math.sin(t*1.3+p.bob)*.05;if(bNear(p)>.2)bSails(m,p.state==='patrol'?.5:.9,t+p.bob)});
  if(BT.treasure.visible){BT.treasure.position.y=1+bWave(SEA.chest[0],SEA.chest[1],BT.wave)*.8;BT.treasure.rotation.y=Math.sin(t*.7)*.3;BT.treasure.children[BT.treasure.children.length-1].material.opacity=.45+.25*Math.sin(t*3)}
  bRemoteDraw(now,t);if(typeof seaDraw==='function')seaDraw(now,t);
  BT.gullT-=dt;if(BT.gullT<=0){BT.gullT=brand(3,9);if(Math.random()<.7)sndGull()}}
function bPose(m,b,t,i){const sp=Math.abs(b.speed),plane=Math.min(1,sp/1.6);m.position.set(b.x,bWave(b.x,b.z,BT.wave)+1.4+plane*.7+Math.sin(t*7+i)*.08*plane,b.z);m.rotation.y=b.a;
  m.rotation.x=.075*Math.max(-.4,Math.min(1,b.speed/1.2))+Math.sin(t*1.4+b.z*.01)*.035;m.rotation.z=b.turnVis*.17*Math.min(1,sp)+Math.sin(t*1.1+b.x*.01)*.035;bFlag(m.userData.cloth,t+i,b.speed);
  m.visible=b.spin>0||!(b.invuln>0)||b.invuln%10<7}   // it flickers for a moment after a hit
// cameras: circling the start line in the menu, a swoop down from the sky before the start, behind each boat in the race, the dock at the finish
const bFollow=(p,o)=>o.set(0,22,46).applyAxisAngle(YAX,p.camYaw).add(p.mesh.position);
function bCameras(dt,now){const t=now*.001;
  if(BT.phase==='menu'||BT.phase==='lobby'){const mid=_bv.set(0,0,0);for(const p of BT.P)mid.add(p.mesh.position);mid.multiplyScalar(1/Math.max(1,BT.P.length));
    BT.cam.position.lerp(_bv2.set(Math.sin(t*.15)*95,34,Math.cos(t*.15)*95).add(mid),1-Math.pow(.97,dt*60));BT.cam.lookAt(mid.x,mid.y+5,mid.z);BT.focus.copy(mid);return}
  if(BT.phase==='won'){const D=BT.finDock.dk;BT.cam.position.lerp(_bv.set(D.x+D.uz*60+D.ux*90,42,D.z-D.ux*60+D.uz*90),1-Math.pow(.96,dt*60));BT.cam.lookAt(D.x-D.ux*50,20,D.z-D.uz*50);BT.focus.set(D.x,0,D.z);return}
  if(BT.phase==='intro'){const k=Math.max(0,Math.min(1,(now-BT.introAt)/Math.max(1,BT.goAt-2400-BT.introAt))),e=1-Math.pow(1-k,3);
    for(const p of BT.P){p.cam.position.copy(p.from).lerp(bFollow(p,_bv),e);p.cam.lookAt(p.mesh.position.x,p.mesh.position.y+4,p.mesh.position.z)}return}
  for(const p of BT.P){const k=1-Math.pow(.91,dt*60);p.camYaw=bLerpA(p.camYaw,p.b.a,k);p.cam.position.lerp(bFollow(p,_bv),1-Math.pow(.86,dt*60));
    const look=_bv2.copy(p.mesh.position).addScaledVector(bHead(p.camYaw,_bv3),26);look.y+=3;
    if(p.shake.t>0){p.shake.t-=dt*60;const m=p.shake.mag*Math.max(0,p.shake.t)/22;p.cam.position.x+=brand(-m,m);p.cam.position.y+=brand(-m,m);p.cam.position.z+=brand(-m,m)}
    p.cam.lookAt(look);const fov=p.baseFov+Math.max(0,p.b.speed)*3.2+(p.b.boost>0?4:0);if(Math.abs(p.cam.fov-fov)>.05){p.cam.fov+=(fov-p.cam.fov)*(1-Math.pow(.9,dt*60));p.cam.updateProjectionMatrix()}}}
// one view, or one per player side by side (up and down on a tall screen)
function bLayout(){if(!BT.on)return;const W=innerWidth,H=innerHeight,two=BT.P.length>1,por=W<H,mm=$('bminiBox'),div=$('bdiv'),clk=$('bclock'),mS=W<=900?120:170;
  BT.P.forEach(p=>{p.vp=!two?{x:0,y:0,w:W,h:H}:por?{x:0,y:p.i?Math.floor(H/2):0,w:W,h:Math.ceil(H/2)}:{x:p.i?Math.floor(W/2):0,y:0,w:Math.ceil(W/2),h:H};
    const s=p.ui.pane.style;s.left=p.vp.x+'px';s.top=p.vp.y+'px';s.width=p.vp.w+'px';s.height=p.vp.h+'px';p.ui.pane.hidden=false;p.cam.aspect=p.vp.w/p.vp.h;p.baseFov=p.cam.aspect<1?68:55;p.cam.fov=p.baseFov;p.cam.updateProjectionMatrix()});
  for(let i=BT.P.length;i<2;i++)$('bpane'+i).hidden=true;
  BT.cam.aspect=W/H;BT.cam.updateProjectionMatrix();div.hidden=!two;$('boatHud').classList.toggle('two',two);
  const cs=clk.style,ms=mm.style,ps=$('bPauseB').style,touch=document.body.classList.contains('is-touch');mm.hidden=clk.hidden=false;
  if(!two){for(const k of['left','top','width','height'])ms[k]='';cs.left=cs.top=ps.left=ps.top='';return}   // one player: the CSS places them
  ms.width=ms.height=mS+'px';
  // two players: the minimap and the clock sit on the line between the views. With touch buttons in the bottom corners they move up to the middle
  // (and on a tall screen, where the buttons meet at the line, only the pause button stays, at the left end of it)
  if(por){Object.assign(div.style,{left:'0',top:(H/2-2)+'px',width:W+'px',height:'4px'});Object.assign(ms,{left:(W-mS-12)+'px',top:(H/2-mS/2)+'px'});Object.assign(cs,{top:(H/2-16)+'px',left:'60px'});mm.hidden=clk.hidden=touch;
    Object.assign(ps,touch?{left:'12px',top:(H/2-20)+'px'}:{left:'',top:''})}
  else{const y=touch?H/2-mS/2:H-mS-66;Object.assign(div.style,{left:(W/2-2)+'px',top:'0',width:'4px',height:H+'px'});Object.assign(ms,{left:(W/2-mS/2)+'px',top:y+'px'});Object.assign(cs,{top:(y-44)+'px',left:'50%'});
    Object.assign(ps,touch?{left:(W/2-22)+'px',top:(y+mS+10)+'px'}:{left:'',top:''})}}
function bRender(){const W=innerWidth,H=innerHeight;renderer.setScissorTest(false);renderer.setViewport(0,0,W,H);
  if(!['intro','count','race'].includes(BT.phase)||!BT.P.length){bPlace(BT.cam,BT.focus);renderer.render(BT.scene,BT.cam);return}
  if(BT.P.length===1){const p=BT.P[0];bPlace(p.cam,p.mesh.position);renderer.render(BT.scene,p.cam);return}
  renderer.setScissorTest(true);for(const p of BT.P){const v=p.vp,gy=H-(v.y+v.h);renderer.setViewport(v.x,gy,v.w,v.h);renderer.setScissor(v.x,gy,v.w,v.h);bPlace(p.cam,p.mesh.position);renderer.render(BT.scene,p.cam)}
  renderer.setScissorTest(false);renderer.setViewport(0,0,W,H)}

/* ---------- the HUD: place, compass, the next target, speed and turbo, the clock and the minimap ---------- */
function bHUD(){const R=BT.route;if(!R)return;$('bclock').textContent=fmtTime(BT.time);const L=BT.net&&BT.net.racing||BT.P.length>1?bPlaces():null;
  for(const p of BT.P){const b=p.b,u=p.ui;u.place.hidden=!L;if(L)u.place.textContent=(L.findIndex(q=>q.p===p)+1)+'.';
    u.speed.textContent=Math.round(Math.abs(b.speed)*BCFG.kts)+' kn';u.pts.textContent=fmtN(bPoints(p))+' poeng';u.boost.style.width=Math.max(0,b.boost/BCFG.boostFrames*100)+'%';
    const tg=boatTarget(b,R),dx=tg.x-b.x,dz=tg.z-b.z,buoy=b.gate<R.buoys.length;u.target.textContent=b.done?'I mål':(buoy?'Bøye '+(b.gate+1)+'/'+R.buoys.length:R.dock.name)+' · '+Math.round(Math.hypot(dx,dz))+' m';
    bCompass(p,Math.atan2(dx,-dz))}
  bMinimap()}
function bCompass(p,bearing){const c=p.ui.compass,W=540,H=64,head=-p.b.a,ppr=W/Math.PI;c.clearRect(0,0,W,H);c.fillStyle='#14120E';c.fillRect(0,0,W,H);
  const toX=b=>{let d=b-head;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return W/2+d*ppr};c.lineWidth=2;c.textAlign='center';c.textBaseline='middle';
  for(let deg=0;deg<360;deg+=15){const x=toX(deg*Math.PI/180);if(x<-20||x>W+20)continue;const major=deg%90===0,mid=deg%45===0;
    c.beginPath();c.moveTo(x,H);c.lineTo(x,H-(major?22:mid?15:8));c.strokeStyle=major?'#E5A92B':'#7a6440';c.stroke();
    if(major){c.fillStyle=deg===0?'#FF6A2A':'#F2E8D0';c.font='700 26px "Barlow Condensed", sans-serif';c.fillText(['N','Ø','S','V'][deg/90],x,20)}
    else if(mid){c.fillStyle='#B5A988';c.font='600 18px "Barlow Condensed", sans-serif';c.fillText(['NØ','SØ','SV','NV'][Math.floor(deg/90)],x,22)}}
  const tx=toX(bearing),cl=Math.max(16,Math.min(W-16,tx));c.fillStyle=p.col;c.strokeStyle='#F2E8D0';c.lineWidth=2;c.beginPath();
  if(tx!==cl){const d=tx<cl?-1:1;c.moveTo(cl+d*12,H/2);c.lineTo(cl-d*6,H/2-12);c.lineTo(cl-d*6,H/2+12)}else{c.moveTo(tx,H-24);c.lineTo(tx-11,H-44);c.lineTo(tx+11,H-44)}c.closePath();c.fill();c.stroke();
  c.strokeStyle='#E5A92B';c.lineWidth=3;c.beginPath();c.moveTo(W/2,0);c.lineTo(W/2,H);c.stroke()}
function bMinimap(){const cv=$('bmini'),c=cv.getContext('2d'),w=cv.width,h=cv.height,R=BT.route,sc=w/2/SEA.bound,M=(x,z)=>[w/2+x*sc,h/2+z*sc];
  c.fillStyle='#6fa3c4';c.fillRect(0,0,w,h);c.fillStyle='#e9dcb9';c.strokeStyle='#5a3a1a';c.lineWidth=1;for(const I of seaIslands()){const[u,v]=M(I.x,I.z);c.beginPath();c.arc(u,v,Math.max(2.5,I.r*sc),0,6.283);c.fill();c.stroke()}
  c.setLineDash([4,4]);c.strokeStyle='rgba(20,18,14,.6)';c.lineWidth=1.5;c.beginPath();R.pts.forEach((q,i)=>{const[u,v]=M(q.x,q.z);i?c.lineTo(u,v):c.moveTo(u,v)});c.stroke();c.setLineDash([]);
  c.font='700 10px "Barlow Condensed", sans-serif';c.textAlign='center';c.textBaseline='middle';
  R.buoys.forEach((g,i)=>{const[u,v]=M(g.x,g.z);c.fillStyle='#c62828';c.beginPath();c.arc(u,v,6,0,6.283);c.fill();c.fillStyle='#fff';c.fillText(i+1,u,v+.5)});
  {const[u,v]=M(R.dock.x,R.dock.z);c.strokeStyle='#14120E';c.lineWidth=3;c.beginPath();c.moveTo(u-5,v-5);c.lineTo(u+5,v+5);c.moveTo(u+5,v-5);c.lineTo(u-5,v+5);c.stroke()}
  c.fillStyle='#E5A92B';for(const br of BT.barrels)if(br.on){const[u,v]=M(br.x,br.z);c.beginPath();c.arc(u,v,2.2,0,6.283);c.fill()}
  c.fillStyle='#14120E';for(const p of BT.pir){const[u,v]=M(p.x,p.z);c.beginPath();c.arc(u,v,3.5,0,6.283);c.fill()}
  const arrow=(x,z,a,col)=>{const[u,v]=M(x,z);c.save();c.translate(u,v);c.rotate(-a);c.fillStyle=col;c.strokeStyle='#fff';c.lineWidth=1.5;c.beginPath();c.moveTo(0,-8);c.lineTo(5.5,5.5);c.lineTo(0,3);c.lineTo(-5.5,5.5);c.closePath();c.fill();c.stroke();c.restore()};
  for(const r of BT.remote.values())if(r.live)arrow(r.x,r.z,r.a,netCol(r.slot));if(typeof SEA_O!=='undefined')for(const o of SEA_O.values())if(o.live)arrow(o.x,o.z,o.a,o.col);for(const p of BT.P)arrow(p.b.x,p.b.z,p.b.a,p.col);   // SEA_O: the others at sea (js/plane.js)
  c.fillStyle='#14120E';c.font='700 12px "Barlow Condensed", sans-serif';c.fillText('N',w/2,12)}

/* ---------- racing the others in a «Kjør sammen» room ---------- */
// BT.net is the lobby you are in: lead starts the races, mem (the leader's own list) and list (everyone's copy) say who is in and who is ready.
// The leader sends the race, a seed (the same pirates and barrels for all) and the start time; everyone steers their own boat and sends where it is
// 15 times a second, and says when it is moored. The pirates only shoot at the boat on their own screen.
function bNetSend(m){if(typeof NET!=='undefined'&&NET.on)netSend(m)}
const bSlotOf=id=>id===NET.me?NET.slot:((NET.players.get(id)||{}).slot|0);
function bNetRoster(){const N=BT.net;if(!N)return[];const L=N.lead===NET.me?[{id:NET.me,ready:true},...N.mem.values()]:N.list||[];
  return L.map(e=>({id:e.id,ready:!!e.ready,slot:bSlotOf(e.id),name:e.id===NET.me?NET.name:((NET.players.get(e.id)||{}).name||'?')})).filter(e=>e.id===NET.me||NET.players.has(e.id))}
function bNetList(){const N=BT.net;if(!N||N.lead!==NET.me)return;bNetSend({t:'Bm',id:N.id,race:N.race,list:[{id:NET.me,ready:1},...[...N.mem.values()].map(e=>({id:e.id,ready:e.ready?1:0}))]});if(BT.on&&BT.phase==='lobby')bMenuRender()}
function bNetHost(){if(BT.net||!NET.on)return;BT.net={id:Math.random().toString(36).slice(2,10),lead:NET.me,race:bSelRace().id,mem:new Map(),racing:false};BT.invite=null;
  bNetSend({t:'Bi',id:BT.net.id,race:BT.net.race});BT.phase='lobby';bMenuRender();toast('Invitasjonen er sendt til rommet')}
function bNetJoin(inv){BT.invite=null;BT.net={id:inv.id,lead:inv.from,race:inv.race,mem:new Map(),list:[],racing:false};bNetSend({t:'Bj',id:inv.id})}
function bNetLeave(){const N=BT.net;if(!N)return;bNetSend({t:N.lead===NET.me?'Bx':'Bl',id:N.id});BT.net=null;bRemoteClear()}
function bNetStart(){const N=BT.net,race=bSelRace(),order=[NET.me,...[...N.mem.values()].filter(e=>e.ready).map(e=>e.id)].sort((a,b)=>bSlotOf(a)-bSlotOf(b)),seed=1+Math.floor(Math.random()*1e9);
  for(const e of N.mem.values())if(e.ready)e.ready=false;bNetSend({t:'Bs',id:N.id,race:race.id,order,seed,go:netNow()+5400});bNetBegin(race,order,seed,performance.now()+5400)}
function bNetBegin(race,order,seed,go){const N=BT.net;N.racing=true;N.race=race.id;N.slot=Math.max(0,order.indexOf(NET.me));N.slots=order.length;N.num=(NET.slot|0)+1;bRemoteClear();
  for(const id of order)if(id!==NET.me&&NET.players.has(id))BT.remote.set(id,bRemoteMake(NET.players.get(id)));
  boatBegin({race,seed,go})}
// a message from another player in the room (js/net.js passes on everything whose type starts with B)
function boatNet(p,m){const N=BT.net,num=v=>typeof v==='number'&&isFinite(v);if(typeof m.id!=='string'||m.id.length>16)return;
  if(m.t==='Bi'){if(N||!BOAT_RACES.some(r=>r.id===m.race))return;BT.invite={id:m.id,race:m.race,from:p.id,name:p.name};
    if(BT.on){if(BT.phase==='menu')bMenuRender()}else if(state.mode==='play'&&state.world&&!state.course)openAsk('boatInvite');else toast(p.name+' inviterer til båtløp ved Captain Theis\' marina');return}
  if(m.t==='Bx'){if(BT.invite&&BT.invite.id===m.id){BT.invite=null;if(BT.on&&BT.phase==='menu')bMenuRender()}
    if(N&&N.id===m.id&&N.lead===p.id){BT.net=null;toast(p.name+' avsluttet båtløpet',true);if(BT.on&&BT.phase==='lobby')bMenu();else bRemoteClear()}return}
  if(!N||N.id!==m.id)return;
  if(m.t==='Bj'&&N.lead===NET.me){N.mem.set(p.id,{id:p.id,ready:true});bNetList();toast(p.name+' er med i båtløpet');return}
  if(m.t==='Bl'||m.t==='Bq'){if(N.lead===NET.me){N.mem.delete(p.id);bNetList()}const r=BT.remote.get(p.id);if(r)r.quit=true;if(BT.result)bResultLog();return}
  if(m.t==='Br'){const e=N.mem.get(p.id);if(e){e.ready=!!m.ready;bNetList()}return}
  if(m.t==='Bm'&&N.lead===p.id&&Array.isArray(m.list)){N.list=m.list.filter(e=>e&&typeof e.id==='string').slice(0,NET_MAX).map(e=>({id:e.id,ready:!!e.ready}));if(BOAT_RACES.some(r=>r.id===m.race))N.race=m.race;
    if(!N.list.some(e=>e.id===NET.me))bNetSend({t:'Bj',id:N.id});if(BT.on&&BT.phase==='lobby'){bSetup(bSelRace());bMenuRender()}return}
  if(m.t==='Bs'&&N.lead===p.id){const race=BOAT_RACES.find(r=>r.id===m.race);if(!race||!num(m.go)||!num(m.seed)||!Array.isArray(m.order)||!m.order.includes(NET.me))return;
    if(BT.on&&BT.phase==='lobby')bNetBegin(race,m.order.filter(id=>typeof id==='string').slice(0,NET_MAX),m.seed,p.off!=null?m.go+p.off:performance.now()+4000);return}   // still busy: this round goes without you
  const r=BT.remote.get(p.id);if(!r)return;
  if(m.t==='Bp'){if(![m.tm,m.x,m.z,m.a,m.s,m.vx,m.vz,m.g,m.tv].every(num))return;r.buf.push({tm:m.tm,x:m.x,z:m.z,a:m.a,s:m.s,vx:m.vx,vz:m.vz,tv:m.tv,sp:!!m.sp});if(r.buf.length>40)r.buf.shift();r.gate=Math.max(0,m.g|0);r.seen=performance.now();return}
  if(m.t==='Bf'&&num(m.time)){r.done=true;r.time=m.time;r.hits=m.hits|0;r.barrels=m.barrels|0;r.gate=m.gate|0;const me=BT.P[0];if(me&&!me.b.done)bNotice(me,r.name+' er i mål!',1600);if(BT.result)bResultLog()}}
// a player left the room (id), or the room is gone (null)
function boatNetGone(id){const N=BT.net;if(id===null){BT.invite=null;if(N){BT.net=null;bRemoteClear();if(BT.on&&BT.phase==='lobby')bMenu()}return}
  if(BT.invite&&BT.invite.from===id)BT.invite=null;if(!N)return;
  if(N.lead===id){BT.net=null;toast('Lederen for båtløpet forlot rommet',true);if(BT.on&&BT.phase==='lobby')bMenu();else bRemoteClear();return}
  N.mem.delete(id);if(N.list)N.list=N.list.filter(e=>e.id!==id);const r=BT.remote.get(id);if(r)r.quit=true;if(N.lead===NET.me)bNetList();else if(BT.on&&BT.phase==='lobby')bMenuRender()}
function bNetTick(dt){const N=BT.net;if(!N||!N.racing||!BT.P.length||typeof NET==='undefined'||!NET.on)return;BT.sendT-=dt;if(BT.sendT>0)return;BT.sendT=1/15;const b=BT.P[0].b,f=v=>+v.toFixed(2);
  bNetSend({t:'Bp',id:N.id,tm:netNow(),x:f(b.x),z:f(b.z),a:+b.a.toFixed(3),s:f(b.speed),vx:f(b.vx),vz:f(b.vz),g:b.gate,tv:f(b.turnVis),sp:b.spin>0?1:0})}
// the others' boats: in their paint, with the room's colour on the number and a name tag over them, drawn a little behind real time
function bRemoteMake(p){const col=(PAINTS[p.info&&p.info.paint]||PAINTS[0]).c,mesh=bBoatMesh(col,(p.slot|0)+1,netCol(p.slot));bName(mesh,p.name);BT.scene.add(mesh);const tag=netTag(p.name,netCol(p.slot));tag.scale.set(60,15,1);BT.scene.add(tag);
  return{id:p.id,name:p.name,slot:p.slot|0,mesh,tag,buf:[],x:0,z:0,a:0,speed:0,vx:0,vz:0,turnVis:0,spin:0,invuln:0,boost:0,gate:0,done:false,time:null,quit:false,live:false,seen:0,wk:0}}
function bRemoteClear(){for(const r of BT.remote.values()){BT.scene.remove(r.mesh);bDispose(r.mesh);BT.scene.remove(r.tag);r.tag.material.map.dispose();r.tag.material.dispose()}BT.remote.clear()}
function bRemoteDraw(now,t){for(const r of BT.remote.values()){const p=NET.players.get(r.id),b=r.buf;r.live=!!(p&&b.length&&now-r.seen<4000&&!r.quit);r.mesh.visible=r.tag.visible=r.live;if(!r.live)continue;
  const rt=now-(p.off||0)-NET_DELAY;let A=b[0],C=b[0],k=0;if(rt>=b[b.length-1].tm)A=C=b[b.length-1];else if(rt>b[0].tm){for(let i=1;i<b.length;i++)if(b[i].tm>=rt){A=b[i-1];C=b[i];k=(rt-A.tm)/Math.max(1,C.tm-A.tm);break}}
  while(b.length>2&&b[1].tm<rt-500)b.shift();
  r.x=A.x+(C.x-A.x)*k;r.z=A.z+(C.z-A.z)*k;r.a=bLerpA(A.a,C.a,k);r.speed=A.s+(C.s-A.s)*k;r.vx=C.vx;r.vz=C.vz;r.turnVis=A.tv+(C.tv-A.tv)*k;r.spin=C.sp?1:0;
  bPose(r.mesh,r,t,r.slot+2);r.tag.position.set(r.x,r.mesh.position.y+18,r.z)}}

/* ---------- the marina on the island: your boat at the pier (in your paint), life rings and Captain Theis' flag ---------- */
function buildMarina(lv){BT.marina=null;const m=lv.marinaDef;if(!m)return;if(!BTEX)BTEX=bMakeTex();const g=new THREE.Group();
  const boat=bBoatMesh((PAINTS[prof.paint]||PAINTS[0]).c,1,'#14120E',true);bName(boat,'Captain Theis');boat.scale.setScalar(.17);boat.position.set(m.boat.x,m.water+.04,m.boat.z);boat.rotation.y=m.yaw+Math.PI;g.add(boat);
  const ringM=new THREE.MeshStandardMaterial({color:LIN('#ff6a2a'),roughness:.6}),bandM=new THREE.MeshStandardMaterial({color:LIN('#f2e8d0'),roughness:.6}),postM=new THREE.MeshStandardMaterial({color:LIN('#5a3a22'),roughness:1}),ringGeo=new THREE.TorusGeometry(.15,.045,8,18);
  for(const r of m.rings){const p=new THREE.Group();p.position.set(r.x,r.y,r.z);p.rotation.y=r.ry;bAdd(p,new THREE.CylinderGeometry(.035,.04,.8,6),postM,0,.4,0);bAdd(p,ringGeo,ringM,0,.5,.06);
    for(let k=0;k<4;k++){const bd=bAdd(p,new THREE.BoxGeometry(.05,.11,.11),bandM,Math.cos(k*1.571+.785)*.15,.5+Math.sin(k*1.571+.785)*.15,.06,false);bd.rotation.z=k*1.571+.785}g.add(p)}
  bAdd(g,new THREE.CylinderGeometry(.025,.03,2.4,6),new THREE.MeshStandardMaterial({color:0xf2f2ee,roughness:.5}),m.flag.x,m.flag.y+1.2,m.flag.z);
  const cloth=new THREE.Mesh(new THREE.PlaneGeometry(.6,.42,8,4),new THREE.MeshBasicMaterial({map:bFlagTex(),side:THREE.DoubleSide}));cloth.geometry.translate(.3,0,0);cloth.position.set(m.flag.x,m.flag.y+2.15,m.flag.z);cloth.rotation.y=m.yaw;g.add(cloth);
  levelGroup.add(g);BT.marina={m,boat,cloth,paint:prof.paint}}
// the boat rocks gently at the pier and follows the paint you choose in the garage
function bMarinaAnim(){const M=BT.marina;if(!M)return;const t=performance.now()*.001;M.boat.position.y=M.m.water+.04+.015*Math.sin(t*1.3);M.boat.rotation.z=.03*Math.sin(t*.9);M.boat.rotation.x=.015*Math.sin(t*1.1);bFlag(M.cloth,t,.6);
  if(M.paint!==prof.paint){M.paint=prof.paint;const c=LIN((PAINTS[prof.paint]||PAINTS[0]).c);for(const mat of M.boat.userData.paint)mat.color.copy(c)}}

function initBoat(){
  $('bmRaces').addEventListener('click',e=>{const b=e.target.closest('[data-race]');if(!b||b.disabled)return;const r=BOAT_RACES.find(q=>q.id===b.dataset.race);if(!r)return;
    if(BT.net){BT.net.race=r.id;bNetList()}else store.set('boatRace',r.id);bSetup(r);bMenuRender()});
  $('bm1').onclick=()=>{BT.two=false;store.set('boatTwo',false);bSetup(bSelRace());bMenuRender()};$('bm2').onclick=()=>{BT.two=true;store.set('boatTwo',true);bSetup(bSelRace());bMenuRender()};
  for(const i of[0,1]){const el=$('bmName'+i);el.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();el.blur();$('bmGo').click()}});el.addEventListener('change',()=>{bSaveNames();bMakePlayers(BT.P.length,bNames(),1)})}
  $('bmGo').onclick=()=>{if(BT.phase!=='menu'&&BT.phase!=='lobby')return;bSaveNames();if(BT.net){if(BT.net.lead===NET.me)bNetStart();return}boatBegin({race:bSelRace()})};
  $('bmBack').onclick=()=>boatExit();
  $('bmInvite').onclick=()=>bNetHost();$('bmJoin').onclick=()=>{const v=BT.invite;if(v){bNetJoin(v);bMenu()}};$('bmDecline').onclick=()=>{const v=BT.invite;if(v){bNetSend({t:'Bl',id:v.id});BT.invite=null;bMenuRender()}};
  $('bmLeave').onclick=()=>{bNetLeave();bMenu()};
  $('bpResume').onclick=()=>bPause(false);$('bpRestart').onclick=()=>{bPause(false);boatBegin()};$('bpMenu').onclick=()=>{const N=BT.net;bPause(false);if(N&&N.racing)bNetSend({t:'Bq',id:N.id});bMenu()};
  $('bpCar').onclick=()=>{bPause(false);boatExit()};$('bpSound').onclick=()=>{setSound(!state.sound);$('bpSound').textContent='Lyd: '+(state.sound?'på':'av')};$('bPauseB').onclick=()=>bPause(true);
  addEventListener('resize',()=>{if(BT.on)bLayout()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&BT.on)bPause(true)})}
initBoat();
