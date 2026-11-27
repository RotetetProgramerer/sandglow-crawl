'use strict';
/* =================================================================
   PIRATES (Piratøya): everything that lives on the pirate island.
   - The pirates: the three old ones at the table outside Skumkroa, the innkeeper, the sword master, the gun crew, and one who walks the beach.
   - Hodeskalleklippen: the hollow skull you drive into, with glowing eyes and a ghost that says boo.
   - The ships: one moored by the quay, the wreck on the beach, and the ghost ship that sails round the island.
   - The cannons on the fort: they fire at the ghost ship (flash, smoke, a ball in an arc and a splash). Only for show.
   - The three trials: dig up the treasure under the X, win the war of words against the sword master, and dare to drive into the skull.
     With all three done, the old pirates at Skumkroa make you a captain: 150 nuts and a pirate flag on the car (on every island).
   The level sets c.piratDef in build(c) (see data/levels/14-pirat.js). What is done is kept in prof.pirat={x,duel,boo,kap}.
   Loaded after js/world.js; buildAnimals, updateAnimals, updateWorld, openAsk and answerAsk call in here.
   ================================================================= */
const PIR={def:null,folk:[],walker:null,ghost:null,cannons:[],balls:[],puffs:[],skull:null,marks:[],sky:null,chest:null,cross:null,lights:[],
  fireT:5,tuneT:6,booT:0,digT:0,dustT:0,missT:0,bumpT:0,stopT:0,duel:null,flag:null};
const pirProf=()=>prof.pirat||(prof.pirat={});
const pirDone=()=>{const p=pirProf();return(p.x?1:0)+(p.duel?1:0)+(p.boo?1:0)};
// what comes after «prøve n av 3»: with all three done, and no flag yet, send the player back to the inn
const pirNext=()=>pirDone()===3&&!pirProf().kap?' Kjør tilbake til Skumkroa!':'';
// a toast for a trial that is done: it stays longer than the usual 1.6 s when it also says where to go (toastT is the timer in js/game.js)
function pirToast(msg){toast(msg+pirNext());if(pirNext()&&typeof toastT!=='undefined')toastT=4.5}
const PIR_GEO={tri:new THREE.CylinderGeometry(1,1,1,3),ball:new THREE.SphereGeometry(1,8,6),sail:new THREE.PlaneGeometry(1,1,4,1)};

/* ---------- textures ---------- */
function pirCanvas(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'));const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t}
// the pirate flag: black, with a skull and two crossed bones
let _pirFlagTex=null;
function pirFlagTex(){return _pirFlagTex||(_pirFlagTex=pirCanvas(128,84,x=>{x.fillStyle='#14120e';x.fillRect(0,0,128,84);x.strokeStyle='#f2ecd8';x.lineWidth=7;x.lineCap='round';
  x.beginPath();x.moveTo(34,62);x.lineTo(94,22);x.moveTo(34,22);x.lineTo(94,62);x.stroke();x.fillStyle='#f2ecd8';x.beginPath();x.arc(64,36,19,0,7);x.fill();x.fillRect(53,46,22,14);
  x.fillStyle='#14120e';x.beginPath();x.arc(56,36,5.5,0,7);x.arc(72,36,5.5,0,7);x.fill();x.fillRect(62,43,4,6);for(let i=0;i<3;i++)x.fillRect(57+i*6,53,2,7)}))}
function pirMoonTex(){return pirCanvas(128,128,x=>{const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,246,214,1)');g.addColorStop(.42,'rgba(255,244,208,1)');g.addColorStop(.46,'rgba(255,240,200,.35)');g.addColorStop(1,'rgba(255,240,200,0)');
  x.fillStyle=g;x.fillRect(0,0,128,128);x.fillStyle='rgba(214,196,150,.55)';for(const[a,b,r]of[[52,50,7],[74,62,5],[60,76,4],[78,46,3],[46,66,3]]){x.beginPath();x.arc(a,b,r,0,7);x.fill()}})}
function pirMarkTex(){return pirCanvas(64,64,x=>{x.fillStyle='#e5a92b';x.beginPath();x.arc(32,32,26,0,7);x.fill();x.strokeStyle='#14120e';x.lineWidth=5;x.stroke();x.fillStyle='#14120e';x.font='700 44px "Barlow Condensed",sans-serif';x.textAlign='center';x.fillText('!',32,48)})}
const pirGlow=(col,s,op=.8)=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:LIN(col),transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));sp.scale.set(s,s,1);return sp};

/* ---------- the meshes (they face +z) ---------- */
// the pirates' small things (js/folk.js), in the frame of a leg or an arm that hangs from its joint: the boot with a folded top and a buckle, the iron bands and the
// ragged trouser leg of a wooden leg, the white cuff with a gold button and the thumb
const PIR_HAIR=['#3a2a20','#1e1a18','#6a4a2a','#8a3a1e','#4a3a30'];
const PIR_PARTS={boot:[['cyl','#2a2420',0,-.26,0,.046,.1,.046],['cyl','#4a3e34',0,-.2,0,.052,.028,.052],['box','#e5b43a',0,-.31,.078,.03,.02,.012],['box','#1a1612',0,-.36,.03,.08,.012,.13]],
  peg:[['cyl','#3a3a4a',0,-.045,0,.04,.09,.04],['cyl','#3a3a4a',0,-.1,.012,.03,.04,.026],['cyl','#3a3a3e',0,-.13,0,.021,.016,.021],['cyl','#3a3a3e',0,-.345,0,.021,.02,.021]],
  arm:(sd,skin)=>[['cyl','#f0ead8',0,-.238,0,.034,.035,.034],['sph','#e5b43a',sd*.03,-.238,.012,.007],['sph',skin,-sd*.01,-.285,.024,.011,.014,.011],['box',folkShade(skin,-.15),0,-.3,.012,.03,.004,.02]]};
// a pirate: striped shirt under an open coat, a tricorn or a bandana, and maybe an eyepatch, a beard, a wooden leg, a sword, a mug, a spyglass or a parrot
function makePirate(o={}){const g=new THREE.Group(),G=ANIMAL_GEO,coat=amat(o.coat||'#7a2a2a'),skin=amat(o.skin||'#d9a074'),dk=amat('#2a2420'),wh=amat('#f0ead8'),red=amat('#b8342a'),gold=amat('#e5b43a',{roughness:.4}),sit=!!o.sit;
  const body=new THREE.Group();body.position.y=sit?-.14:0;g.add(body);
  const legs=[];for(const sd of[-1,1]){const l=new THREE.Group();l.position.set(sd*.055,.36,0);
    if(o.peg&&sd>0){apart(l,G.cylTop,amat('#8a6a3a'),0,0,0,.018,.36,.018);folkOn(l,PIR_PARTS.peg,'pir:peg',true)}else{apart(l,G.cylTop,amat('#3a3a4a'),0,0,0,.04,.3,.04);apart(l,G.sph,dk,0,-.33,.03,.045,.035,.07);folkOn(l,PIR_PARTS.boot,'pir:boot',true)}
    if(sit)l.rotation.x=-1.35;body.add(l);legs.push(l)}
  apart(body,G.sph,wh,0,.53,.012,.1,.17,.08);for(let i=0;i<3;i++)apart(body,G.sph,red,0,.46+i*.07,.02,.097-.012*i,.016,.075);          // the striped shirt
  apart(body,G.sph,coat,0,.53,-.025,.115,.19,.085);for(const sd of[-1,1])apart(body,G.sph,coat,sd*.075,.5,.02,.05,.17,.07);             // the coat, open in front
  apart(body,G.cyl,dk,0,.39,0,.108,.035,.085);apart(body,G.box,gold,0,.39,.085,.04,.035,.012);
  if(o.apron)apart(body,G.box,wh,0,.42,.088,.15,.26,.012);
  // the coat's gold buttons, collar and pocket flaps, the sash at the hip (or the apron's strings and pocket)
  {const c=o.coat||'#7a2a2a',cd=folkShade(c,-.3),B=[];for(const sd of[-1,1]){for(let i=0;i<3;i++)B.push(['sph','#e5b43a',sd*.062,.45+i*.06,.087-.002*i*i,.008,.008,.006]);
      B.push(['box',cd,sd*.05,.7,-.005,.07,.035,.11,0,0,sd*.5])}
    B.push(['box',cd,0,.7,-.07,.12,.04,.03]);
    if(o.apron)B.push(['box','#d8d0bc',0,.4,.096,.08,.06,.006],['box','#d8d0bc',0,.555,.092,.16,.014,.01],['box','#b8342a',.05,.46,.097,.03,.05,.004]);
    else B.push(['box','#b8342a',-.075,.34,.062,.034,.085,.014,0,0,.12],['box','#b8342a',-.06,.385,.07,.05,.03,.02]);
    folkOn(body,B,'pir:body:'+c+(o.apron?'a':''),true)}
  const head=new THREE.Group();head.position.set(0,.79,0);body.add(head);
  apart(head,G.sph,skin,0,0,.005,.06,.066,.06);
  // the face (js/folk.js): eyes, brows, nose, mouth and ears, hair under the hat, a gold ring in the ear, stubble or a moustache; with it the trim of the hat or the dots of the bandana
  {const sk=o.skin||'#d9a074',hair=o.beard||PIR_HAIR[(o.coat||'').charCodeAt(1)%PIR_HAIR.length],tri=o.hat==='tricorn',hu=(...a)=>[a[0],a[1],a[2]/.06,a[3]/.066,(a[4]-.005)/.06,a[5]/.06,(a[6]??a[5])/.066,(a[7]??a[5])/.06,a[8],a[9],a[10]];
    const ex=tri?[0,2.09,4.19].map(a=>hu('box','#e5b43a',Math.sin(a)*.0705,.087,Math.cos(a)*.0705,.112,.006,.015,0,a,0)).concat([hu('sph','#f0ead8',-.052,.105,-.02,.012,.045,.03,-.3,0,.5),hu('sph','#b8342a',-.05,.075,-.012,.014,.014,.014)])
      :[-2.4,-1.5,-.75,0,.75,1.5,2.4].map((a,i)=>hu('sph','#f0ead8',Math.sin(a)*.0595,.046+(i%2)*.012,-.004+Math.cos(a)*.0595,.007,.007,.007));
    const f=folkHead({skin:sk,hair,style:'back',dy:-.05,patch:o.patch?1:0,mous:o.beard||(o.sword||o.scope?hair:0),stubble:o.beard||o.apron?0:1,ring:'#e5b43a',neck:1,smile:o.wave||o.mug?1:0},ex,tri?'tri':'ban',true);
    f.scale.set(.06,.066,.06);f.position.z=.005;head.add(f)}
  if(o.patch){apart(head,G.box,dk,.024,.014,.056,.028,.024,.008);apart(head,G.box,dk,0,.03,0,.125,.008,.125)}
  if(o.beard){const b=amat(o.beard);apart(head,G.sph,b,0,-.05,.035,.05,.05,.034);apart(head,G.sph,b,0,-.022,.058,.032,.012,.012)}
  if(o.hat==='tricorn'){apart(head,G.cyl,dk,0,.05,0,.1,.014,.1);apart(head,G.sph,dk,0,.07,0,.062,.04,.062);for(const a of[0,2.09,4.19])apart(head,G.box,dk,Math.sin(a)*.07,.068,Math.cos(a)*.07,.11,.035,.012,0,a,0);apart(head,G.sph,gold,0,.075,.07,.012)}
  else{apart(head,G.sph,red,0,.03,-.004,.064,.046,.064);apart(head,G.sph,red,.06,.015,-.035,.022,.022,.022);apart(head,G.box,red,.075,-.02,-.05,.014,.07,.02,0,0,.3)}
  const arms=[];for(const sd of[-1,1]){const a=new THREE.Group();a.position.set(sd*.118,.67,0);apart(a,G.cylTop,coat,0,0,0,.028,.26,.028);apart(a,G.sph,skin,0,-.28,0,.026);folkOn(a,PIR_PARTS.arm(sd,o.skin||'#d9a074'),'pir:arm'+sd+(o.skin||''),true);body.add(a);arms.push(a)}
  if(o.sword){const s=new THREE.Group();s.position.set(0,-.28,0);apart(s,G.box,amat('#d8dce0',{roughness:.3,metalness:.5}),0,0,.2,.012,.03,.38);apart(s,G.box,gold,0,0,.02,.07,.02,.02);arms[1].add(s);arms[1].rotation.x=-1.1}
  if(o.mug){apart(arms[0],G.cyl,amat('#d8c597'),0,-.3,.04,.03,.06,.03);arms[0].rotation.x=-.9}
  if(o.scope){apart(arms[1],G.cyl,gold,0,-.3,.1,.016,.2,.016,Math.PI/2);arms[1].rotation.x=-2.2}
  if(o.parrot){const p=makeParrot(PARROT_COLS[0]);p.scale.setScalar(.75);p.position.set(-.125,.74,0);body.add(p);g.userData.parrot=p}
  Object.assign(g.userData,{head,arms,legs,body});return g}
// a ship, bow towards +z, about 5.3 long. o.torn: a wreck without sails; o.ghost: every part in one glowing, see-through green
function makeShip(o={}){const g=new THREE.Group(),G=ANIMAL_GEO,hull=amat(o.hull||'#5c3b24'),dk=amat('#3a2618'),gold=amat('#c8a03a',{roughness:.5}),sail=amat(o.sail||'#e8dcc0',{side:THREE.DoubleSide,roughness:.9,flatShading:false});
  apart(g,G.box,hull,0,.35,-.2,1.3,.7,3.0);apart(g,PIR_GEO.tri,hull,0,.35,1.8,.75,.7,1.0);                       // the hull and the bow
  apart(g,G.box,dk,0,.7,-.2,1.16,.03,2.9);apart(g,G.box,hull,0,.95,-1.3,1.34,.5,.9);apart(g,G.box,dk,0,1.2,-1.3,1.2,.03,.8);   // the deck and the stern castle
  for(const sd of[-1,1]){apart(g,G.box,dk,sd*.65,.78,-.1,.04,.16,2.2);for(let i=0;i<3;i++)apart(g,G.box,amat('#14100c'),sd*.655,.42,-.7+i*.7,.02,.14,.16)}
  for(const dx of[-.35,0,.35])apart(g,G.box,gold,dx,1.0,-1.76,.2,.2,.02);                                           // the windows in the stern
  apart(g,G.cyl,dk,0,.82,2.7,.03,1.1,.03,1.15);                                                                    // the bowsprit
  const mast=(z,h)=>{apart(g,G.cyl,dk,0,.7+h/2,z,.045,h,.045);apart(g,G.cyl,dk,0,.7+h*.82,z,.028,1.5,.028,0,0,Math.PI/2);apart(g,G.cyl,dk,0,.7+h*.3,z,.028,1.5,.028,0,0,Math.PI/2)};
  if(o.torn){apart(g,G.cyl,dk,0,1.3,.1,.045,1.2,.045,0,0,.12);apart(g,G.cyl,dk,.5,1.0,.3,.04,1.6,.04,0,.3,1.25);apart(g,PIR_GEO.sail,sail,.2,1.25,.12,.5,.6,1,0,0,.25);   // a stump, the fallen mast and a rag
    for(const[x,y,z]of[[.66,.3,.6],[.66,.35,-.4],[-.66,.4,.2]])apart(g,G.box,amat('#14100c'),x,y,z,.03,.34,.44)}                                                         // holes in the planking
  else{mast(.1,2.3);mast(1.25,1.7);
    const s1=apart(g,PIR_GEO.sail,sail,0,.7+2.3*.56,.16,1.42,1.15,1),s2=apart(g,PIR_GEO.sail,sail,0,.7+1.7*.56,1.3,1.42,.85,1);g.userData.sails=[s1,s2];
    const fl=new THREE.Mesh(PIR_GEO.sail,new THREE.MeshBasicMaterial({map:pirFlagTex(),side:THREE.DoubleSide}));fl.scale.set(.5,.33,1);fl.position.set(.27,3.1,.1);g.add(fl);g.userData.flag=fl}
  if(o.ghost){const gm=new THREE.MeshBasicMaterial({color:LIN('#a8ffd8'),transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide,fog:false});g.traverse(m=>{if(m.isMesh){m.material=gm;m.castShadow=false}});
    const gl=pirGlow('#2dff8a',10,.8);gl.position.set(0,1.4,0);g.add(gl)}
  else{const l=pirGlow('#ffb45a',1.3,.9);l.position.set(0,1.45,-1.8);g.add(l)}
  return g}
// a cannon on a wooden carriage; the barrel slides back when it fires
function makeCannon(){const g=new THREE.Group(),G=ANIMAL_GEO,wood=amat('#6a4a2a'),iron=amat('#26282c',{roughness:.5,metalness:.4});
  apart(g,G.box,wood,0,.15,-.05,.36,.14,.62);for(const sd of[-1,1])for(const z of[-.25,.17])apart(g,G.cyl,amat('#3a2a1c'),sd*.2,.09,z,.09,.05,.09,0,0,Math.PI/2);
  const b=new THREE.Group();b.position.set(0,.31,0);apart(b,G.cyl,iron,0,0,.14,.085,.86,.085,Math.PI/2);apart(b,G.cyl,iron,0,0,.56,.1,.06,.1,Math.PI/2);apart(b,G.sph,iron,0,0,-.3,.1);g.add(b);
  g.userData.barrel=b;g.scale.setScalar(1.25);return g}
// the skull: a hollow dome with eye sockets and a row of teeth over the open mouth, and a wall behind. The mouth faces +z
function makeSkull(){const g=new THREE.Group(),bone=amat('#e4dcc4'),bone2=amat('#cfc6aa'),dark=new THREE.MeshBasicMaterial({color:0x0a0806,side:THREE.BackSide}),black=new THREE.MeshBasicMaterial({color:0x0a0806});
  const TH=1.95,RX=3.1,RY=3.3,CY=2.55,rim=CY+RY*Math.cos(TH),rr=RX*Math.sin(TH),dome=new THREE.SphereGeometry(1,18,12,0,Math.PI*2,0,TH);
  const d=new THREE.Mesh(dome,bone);d.scale.set(RX,RY,RX);d.position.y=CY;d.castShadow=true;g.add(d);const di=new THREE.Mesh(dome,dark);di.scale.set(RX*.97,RY*.97,RX*.97);di.position.y=CY;g.add(di);
  const wg=new THREE.CylinderGeometry(rr,rr*.94,rim+.3,18,1,true,.56,Math.PI*2-1.12),w=new THREE.Mesh(wg,bone2);w.position.y=(rim-.3)/2;w.castShadow=true;g.add(w);
  const wi=new THREE.Mesh(wg,dark);wi.scale.set(.97,1,.97);wi.position.y=(rim-.3)/2;g.add(wi);
  for(let t=-.48;t<=.49;t+=.16){const m=new THREE.Mesh(ANIMAL_GEO.box,bone);m.scale.set(.36,.5,.22);m.position.set(Math.sin(t)*(rr-.04),rim-.2,Math.cos(t)*(rr-.04));m.rotation.y=t;m.castShadow=true;g.add(m)}   // the upper teeth
  for(const sd of[-1,1]){const t=sd*.6,m=new THREE.Mesh(ANIMAL_GEO.box,bone2);m.scale.set(.5,rim+.1,.45);m.position.set(Math.sin(t)*(rr-.05),rim/2-.05,Math.cos(t)*(rr-.05));m.rotation.y=t;m.castShadow=true;g.add(m)}   // the corners of the jaw
  const eyes=[];for(const sd of[-1,1]){const t=sd*.42,p=1.02,x=RX*Math.sin(p)*Math.sin(t),y=CY+RY*Math.cos(p),z=RX*Math.sin(p)*Math.cos(t);
    const e=new THREE.Mesh(PIR_GEO.ball,black);e.scale.set(.66,.74,.4);e.position.set(x*.97,y,z*.97);e.lookAt(x*2,y+.6,z*2);g.add(e);const gl=pirGlow('#ff7a20',1.5,.9);gl.position.set(x*1.04,y,z*1.04);g.add(gl);eyes.push(gl)}
  const cur=new THREE.Mesh(PIR_GEO.sail,new THREE.MeshBasicMaterial({color:0x0a0806,transparent:true,opacity:.9}));cur.scale.set(5.7,rim+.1,1);cur.position.set(0,rim/2,.15);g.add(cur);   // the dark behind the teeth
  const n=new THREE.Mesh(ANIMAL_GEO.cone,black);n.scale.set(.3,.6,.2);n.position.set(0,CY+RY*Math.cos(1.42),RX*Math.sin(1.42)*.985);g.add(n);
  // the ghost that lives inside: hidden until somebody drives in
  const gh=new THREE.Group(),gm=new THREE.MeshBasicMaterial({color:LIN('#d8ffe8'),transparent:true,opacity:.85,depthWrite:false,fog:false});
  apart(gh,PIR_GEO.ball,gm,0,.5,0,.34,.36,.3).castShadow=false;apart(gh,ANIMAL_GEO.cone,gm,0,.05,0,.34,.7,.3,Math.PI).castShadow=false;
  for(const sd of[-1,1]){apart(gh,PIR_GEO.ball,black,sd*.12,.56,.26,.06,.08,.04).castShadow=false;apart(gh,PIR_GEO.ball,gm,sd*.42,.3,.05,.1,.2,.1,0,0,sd*.9).castShadow=false}
  apart(gh,PIR_GEO.ball,black,0,.38,.27,.07,.1,.04).castShadow=false;gh.position.set(0,.6,-.4);gh.visible=false;g.add(gh);
  Object.assign(g.userData,{eyes,ghost:gh});return g}
function makeChest(){const g=new THREE.Group(),G=ANIMAL_GEO,wood=amat('#6a4226'),gold=amat('#e6b43a',{roughness:.3,metalness:.6,emissive:new THREE.Color(0x4a3000)});
  apart(g,G.box,wood,0,.17,0,.6,.34,.4);for(const x of[-.22,.22])apart(g,G.box,gold,x,.17,0,.05,.35,.41);apart(g,G.box,gold,0,.22,.205,.08,.1,.02);
  const lid=new THREE.Group();lid.position.set(0,.34,-.2);apart(lid,G.box,wood,0,.06,.2,.6,.12,.4);for(const x of[-.22,.22])apart(lid,G.box,gold,x,.06,.2,.05,.13,.41);lid.rotation.x=-1.2;g.add(lid);
  for(let i=0;i<9;i++)apart(g,PIR_GEO.ball,gold,-.2+(i%3)*.2,.36+.02*(i%2),-.1+Math.floor(i/3)*.1,.07,.03,.07);
  const gl=pirGlow('#ffd36a',1.6,.6);gl.position.y=.5;g.add(gl);return g}

/* ---------- build ---------- */
function buildPirates(lv,def){Object.assign(PIR,{def:lv.piratDef||null,folk:[],walker:null,ghost:null,cannons:[],balls:[],puffs:[],skull:null,marks:[],sky:null,chest:null,cross:null,lights:[],fireT:5,tuneT:6,booT:0,digT:0,stopT:0,duel:null});
  const D=PIR.def;if(!D)return;const R=mulberry32(def.seed+31),P=pirProf();
  // the moon and the stars of the everlasting sunset (they follow the camera, see updatePirates)
  {const sky=new THREE.Group(),moon=new THREE.Sprite(new THREE.SpriteMaterial({map:pirMoonTex(),transparent:true,depthWrite:false,fog:false}));moon.scale.set(30,30,1);moon.position.set(-108,92,78);sky.add(moon);
    const n=170,pos=new Float32Array(n*3);for(let i=0;i<n;i++){const a=R()*6.28,e=.45+R()*1.05,r=178;pos[i*3]=Math.cos(a)*Math.cos(e)*r;pos[i*3+1]=Math.sin(e)*r;pos[i*3+2]=Math.sin(a)*Math.cos(e)*r}
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(pos,3));const st=new THREE.Points(sg,new THREE.PointsMaterial({map:glowTex,color:0xfff4dc,size:2.6,transparent:true,opacity:.75,depthWrite:false,fog:false,sizeAttenuation:true,blending:THREE.AdditiveBlending}));
    st.frustumCulled=false;sky.add(st);sky.renderOrder=-9;levelGroup.add(sky);PIR.sky=sky}
  // the pirates
  for(const f of D.folk){const g=savPrep(makePirate(f)),y=f.y??H(f.x,f.z),ry=f.face?Math.atan2(f.face[0]-f.x,f.face[1]-f.z):(f.ry||0);g.position.set(f.x,y,f.z);g.rotation.y=ry;levelGroup.add(g);PIR.folk.push({g,f,ry,ph:R()*6.28})}
  if(D.patrol){const Pp=D.patrol.path.map(p=>({x:p[0],z:p[1]}));Pp.push(Pp[0]);const cum=[0];for(let i=1;i<Pp.length;i++)cum.push(cum[i-1]+Math.hypot(Pp[i].x-Pp[i-1].x,Pp[i].z-Pp[i-1].z));
    const g=savPrep(makePirate({hat:'tricorn',coat:'#2a4a6a',beard:'#8a4a20',peg:1,parrot:1}));levelGroup.add(g);PIR.walker={g,P:Pp,cum,L:cum[cum.length-1],s:0,speed:D.patrol.speed||.5}}
  // the skull
  {const S=D.skull,g=makeSkull();g.position.set(S.x,S.y-.02,S.z);g.rotation.y=S.dir;levelGroup.add(g);PIR.skull=g}
  // the ships: one at the quay, the wreck, and the ghost ship
  {const s=makeShip({});s.scale.setScalar(1.55);s.position.set(D.ship.x,(def.water??0)-.42,D.ship.z);s.rotation.y=D.ship.ry;levelGroup.add(s);PIR.ship=s}
  {const w=makeShip({torn:true,hull:'#4a3424'});w.scale.setScalar(1.45);w.position.set(D.wreck.x,H(D.wreck.x,D.wreck.z)-.3,D.wreck.z);w.rotation.set(0,D.wreck.ry,.42);levelGroup.add(w)}
  {const s=makeShip({ghost:true});s.scale.setScalar(2.3);levelGroup.add(s);PIR.ghost={g:s,a:R()*6.28,seen:false}}
  // the cannons
  for(const c of D.cannons){const g=makeCannon();g.position.set(c.x,c.y,c.z);g.rotation.y=c.dir;levelGroup.add(g);PIR.cannons.push({g,c,rec:0})}
  // warm lantern light at the inn, the fort gates and the sword master's hut
  for(const[x,z,h]of D.lights){const y=H(x,z)+h,l=pirGlow('#ffb45a',2.2,.75);l.position.set(x,y,z);levelGroup.add(l);apart(levelGroup,ANIMAL_GEO.box,amat('#2a2420'),x,y,z,.1,.14,.1);PIR.lights.push({l,ph:R()*6.28})}
  // the X on the beach (two red planks), and the chest if it has been dug up
  {const x=D.dig.x,z=D.dig.z,y=H(x,z)+.03,g=new THREE.Group();for(const a of[.785,-.785]){const m=new THREE.Mesh(ANIMAL_GEO.box,new THREE.MeshBasicMaterial({color:LIN('#c4281c')}));m.scale.set(1.5,.02,.22);m.rotation.y=a;g.add(m)}g.position.set(x,y,z);levelGroup.add(g);PIR.cross=g;
    if(P.x)pirChest(1)}
  // a «!» over the ones who have something to say, and over the two trials you drive to: the X on the beach and the mouth of the skull (see updatePirates for when each one shows)
  const mt=pirMarkTex(),mark=(x,z,h,key,y0=H(x,z))=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:mt,transparent:true,depthWrite:false}));s.scale.set(.5,.5,1);s.position.set(x,y0+h,z);levelGroup.add(s);PIR.marks.push({s,key,y:y0+h})};
  mark(D.inn.x,D.inn.z,1.5,'inn');mark(D.duel.x,D.duel.z,1.45,'duel');mark(D.dig.x,D.dig.z,1.5,'x');
  {const S=D.skull;mark(S.x+Math.sin(S.dir)*3.4,S.z+Math.cos(S.dir)*3.4,1.9,'boo',S.y)}}   // just in front of the dome, over the teeth
function pirChest(k){const D=PIR.def,x=D.dig.x-1.15,z=D.dig.z-.9,g=makeChest();g.position.set(x,H(x,z)-.6*(1-k),z);g.rotation.y=.5;levelGroup.add(g);PIR.chest={g,k,y:H(x,z)};G.colliders.push({x,z,r:.42})}

/* ---------- sounds ---------- */
let _pirNoise=null;
function pirBoom(x,z){if(typeof initAmbience!=='function')return;initAmbience();const v=typeof ambVoice==='function'&&ambVoice(x,z,75);if(!v)return;try{const ac=AMB.ac,t=v.t,vol=.9*v.vol*(state.volAmb/70);
  if(!_pirNoise){_pirNoise=ac.createBuffer(1,ac.sampleRate*.8,ac.sampleRate);const d=_pirNoise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2)}
  const s=ac.createBufferSource(),f=ac.createBiquadFilter();s.buffer=_pirNoise;f.type='lowpass';f.frequency.setValueAtTime(900,t);f.frequency.exponentialRampToValueAtTime(90,t+.6);s.connect(f);f.connect(v.g);s.start(t);
  const o=ac.createOscillator();o.type='sine';o.frequency.setValueAtTime(110,t);o.frequency.exponentialRampToValueAtTime(34,t+.5);o.connect(v.g);o.start(t);o.stop(t+.6);
  v.g.gain.setValueAtTime(vol,t);v.g.gain.exponentialRampToValueAtTime(.0001,t+.8)}catch(e){}}
// the ghost's «boo»: two wailing voices that slide up and down again
function pirWail(x,z){if(typeof initAmbience!=='function')return;initAmbience();const v=typeof ambVoice==='function'&&ambVoice(x,z,30);if(!v)return;try{const ac=AMB.ac,t=v.t,d=1.5,vol=.35*v.vol*(state.volAmb/70);
  for(const k of[1,1.5]){const o=ac.createOscillator();o.type='triangle';o.frequency.setValueAtTime(190*k,t);o.frequency.linearRampToValueAtTime(520*k,t+.35);o.frequency.linearRampToValueAtTime(150*k,t+d);o.connect(v.g);o.start(t);o.stop(t+d+.05)}
  v.g.gain.setValueAtTime(0,t);v.g.gain.linearRampToValueAtTime(vol,t+.12);v.g.gain.exponentialRampToValueAtTime(.0001,t+d)}catch(e){}}
// a few bars of a sea shanty on a squeeze-box, from inside Skumkroa
const PIR_TUNE=[294,349,440,440,392,349,330,294,349,440,587,587,523,440,392,440,294,349,440,440,392,349,330,262,294,330,349,330,294,0,294,0];
function pirTune(x,z){if(typeof initAmbience!=='function')return;initAmbience();const v=typeof ambVoice==='function'&&ambVoice(x,z,20);if(!v)return;try{const ac=AMB.ac,t=v.t,n=.19,vol=.11*v.vol*(state.volAmb/70);
  PIR_TUNE.forEach((f,i)=>{if(!f)return;for(const[k,ty]of[[1,'triangle'],[2,'square']]){const o=ac.createOscillator(),g=ac.createGain();o.type=ty;o.frequency.value=f*k;g.gain.setValueAtTime(0,t+i*n);g.gain.linearRampToValueAtTime(k===1?1:.12,t+i*n+.02);g.gain.exponentialRampToValueAtTime(.001,t+i*n+n*1.6);o.connect(g);g.connect(v.g);o.start(t+i*n);o.stop(t+i*n+n*1.7)}});
  v.g.gain.setValueAtTime(vol,t)}catch(e){}}

/* ---------- smoke, splashes and cannon balls ---------- */
function pirPuff(x,y,z,col,s,life,vy=.6){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:LIN(col),transparent:true,opacity:.8,depthWrite:false}));sp.position.set(x,y,z);sp.scale.set(s,s,1);levelGroup.add(sp);PIR.puffs.push({sp,life,t:0,s,vy})}
function pirFire(){const D=PIR.def,k=PIR.cannons[Math.floor(Math.random()*PIR.cannons.length)];if(!k)return;const c=k.c,fx=Math.sin(c.dir),fz=Math.cos(c.dir),mx=c.x+fx*.95,mz=c.z+fz*.95,my=c.y+.42;k.rec=1;
  pirBoom(c.x,c.z);const fl=pirGlow('#ffd080',2.6,1);fl.position.set(mx,my,mz);levelGroup.add(fl);PIR.puffs.push({sp:fl,life:.14,t:0,s:2.6,vy:0});
  for(let i=0;i<5;i++)pirPuff(mx+fx*i*.25+(Math.random()-.5)*.2,my+(Math.random()-.3)*.2,mz+fz*i*.25+(Math.random()-.5)*.2,'#b8b4ac',.7+i*.22,1.6+Math.random());
  // aim at the ghost ship when it is out in front of the guns, else straight out to sea
  let tx=c.x+fx*30,tz=c.z+fz*30;const gs=PIR.ghost&&PIR.ghost.g.position;if(gs){const dx=gs.x-c.x,dz=gs.z-c.z,d=Math.hypot(dx,dz);if(d<60&&(dx*fx+dz*fz)/d>.45){tx=gs.x+(Math.random()-.5)*5;tz=gs.z+(Math.random()-.5)*5}}
  const T=1.5+Math.hypot(tx-mx,tz-mz)/32,wl=LEVELS[state.levelIdx].water??0,b=new THREE.Mesh(PIR_GEO.ball,amat('#1a1a1c'));b.scale.setScalar(.1);b.position.set(mx,my,mz);levelGroup.add(b);
  PIR.balls.push({m:b,vx:(tx-mx)/T,vz:(tz-mz)/T,vy:(wl-my+.5*9*T*T)/T,wl})}

/* ---------- update ---------- */
const _pp={x:0,z:0,a:0};
function pirAt(C,s,out){const L=C.L;s=((s%L)+L)%L;let i=1;while(i<C.cum.length-1&&C.cum[i]<s)i++;const a=C.P[i-1],b=C.P[i],u=(s-C.cum[i-1])/((C.cum[i]-C.cum[i-1])||1);out.x=a.x+(b.x-a.x)*u;out.z=a.z+(b.z-a.z)*u;out.a=Math.atan2(b.x-a.x,b.z-a.z);return out}
function updatePirates(dt,tm){pirFlag(tm);const D=PIR.def;if(!D||!car)return;const play=state.mode==='play',cx=car.pos.x,cz=car.pos.z,P=pirProf();
  if(PIR.sky)PIR.sky.position.copy(camera.position);PIR.bumpT-=dt;PIR.missT-=dt;
  // the pirates: they follow the car with their heads when it is near, wave, lift their mugs and swing their swords
  for(const o of PIR.folk){const g=o.g,U=g.userData,f=o.f,ex=cx-g.position.x,ez=cz-g.position.z,d=Math.hypot(ex,ez),near=d<7;let a=near?Math.atan2(ex,ez)-o.ry:Math.sin(tm*.5+o.ph)*.4;a=Math.atan2(Math.sin(a),Math.cos(a));
    U.head.rotation.y+=(Math.max(-1.1,Math.min(1.1,a))-U.head.rotation.y)*Math.min(1,dt*4);
    if(f.wave){U.arms[1].rotation.z=near?2.5+Math.sin(tm*8)*.35:0}
    if(f.mug)U.arms[0].rotation.x=-.9-Math.max(0,Math.sin(tm*.6+o.ph))*1.1;
    if(f.sword){U.arms[1].rotation.x=-1.1+Math.sin(tm*(near?5:1.4)+o.ph)*(near?.7:.2);U.arms[1].rotation.z=Math.sin(tm*(near?3.1:.9))*.4;U.body.rotation.y=near?Math.sin(tm*2.5)*.15:0}
    if(U.parrot)U.parrot.rotation.y=Math.sin(tm*1.3+o.ph)*.6;
    if(play&&!f.sit&&d<.6&&d>1e-3){car.vel.x+=ex/d*2.2*dt*20;car.vel.z+=ez/d*2.2*dt*20}}
  // the one who walks the beach: he stops when the car is in his way
  const W=PIR.walker;if(W){const p=pirAt(W,W.s,_pp),g=W.g,U=g.userData,ex=cx-p.x,ez=cz-p.z,d=Math.hypot(ex,ez),fx=Math.sin(p.a),fz=Math.cos(p.a),blocked=play&&ex*fx+ez*fz>-.3&&d<2.2;
    if(!blocked)W.s+=W.speed*dt;g.position.set(p.x,H(p.x,p.z),p.z);let dy=(blocked?Math.atan2(ex,ez):p.a)-g.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));g.rotation.y+=dy*Math.min(1,dt*4);
    const ph=W.s*8;U.legs.forEach((l,k)=>l.rotation.x=blocked?0:Math.sin(ph+k*Math.PI)*.5);U.arms[0].rotation.x=blocked?0:Math.sin(ph)*.4;U.arms[1].rotation.x=blocked?-2.4:-Math.sin(ph)*.4;g.position.y+=blocked?0:Math.abs(Math.sin(ph))*.015;
    if(U.parrot)U.parrot.rotation.y=Math.sin(tm*1.3)*.6;
    if(play&&d<.7&&d>1e-3){car.vel.x+=ex/d*2.2*dt*20;car.vel.z+=ez/d*2.2*dt*20;if(PIR.bumpT<=0){PIR.bumpT=5;toast('🏴‍☠️ «Arr! Se deg for, landkrabbe!»')}}}
  // the ghost ship sails round the island, and the moored ship rocks at the quay
  const wl=LEVELS[state.levelIdx].water??0;
  if(PIR.ghost){const G2=PIR.ghost,g=G2.g;G2.a+=D.ghost.speed*dt;const r=D.ghost.r+3*Math.sin(G2.a*3);g.position.set(Math.cos(G2.a)*r,wl-.5+.25*Math.sin(tm*.9),Math.sin(G2.a)*r);g.rotation.set(Math.sin(tm*.7)*.05,Math.atan2(-Math.sin(G2.a),Math.cos(G2.a)),Math.sin(tm*.9)*.07);
    if(play&&!G2.seen&&Math.hypot(cx-g.position.x,cz-g.position.z)<26){G2.seen=true;toast('👻 Der ute seiler Spøkelsesskuta …')}}
  if(PIR.ship){const s=PIR.ship;s.position.y=wl-.42+.05*Math.sin(tm*1.1);s.rotation.z=Math.sin(tm*.8)*.03;if(s.userData.flag)s.userData.flag.rotation.y=Math.sin(tm*3)*.35}
  // lanterns flicker, the eyes of the skull glow, and the marks bob
  for(const o of PIR.lights)o.l.material.opacity=.6+.2*Math.sin(tm*9+o.ph)*Math.sin(tm*2.3+o.ph);
  if(PIR.skull)PIR.skull.userData.eyes.forEach((e,i)=>e.material.opacity=.55+.4*Math.sin(tm*2.2+i*.4)**2);
  for(const m of PIR.marks){m.s.visible=m.key==='inn'?!P.kap:m.key==='duel'?!P.duel:m.key==='x'?!P.x:!P.boo;m.s.position.y=m.y+.06*Math.sin(tm*3)}
  // the cannons: one fires now and then, more often when the ghost ship is in front of them
  if(PIR.cannons.length){PIR.fireT-=dt;if(PIR.fireT<=0){PIR.fireT=5+Math.random()*7;if(Math.hypot(cx-D.cannons[0].x,cz-D.cannons[0].z)<70)pirFire()}
    for(const k of PIR.cannons){k.rec=Math.max(0,k.rec-dt*1.6);k.g.userData.barrel.position.z=-.22*k.rec}}
  for(let i=PIR.balls.length-1;i>=0;i--){const b=PIR.balls[i],m=b.m;b.vy-=9*dt;m.position.x+=b.vx*dt;m.position.y+=b.vy*dt;m.position.z+=b.vz*dt;
    if(m.position.y<=b.wl||m.position.y<H(m.position.x,m.position.z)){const x=m.position.x,z=m.position.z;levelGroup.remove(m);PIR.balls.splice(i,1);for(let k=0;k<6;k++)pirPuff(x+(Math.random()-.5)*.8,b.wl+.2,z+(Math.random()-.5)*.8,'#f4fbff',.8+Math.random()*.8,.7+Math.random()*.5,2.2);
      const gs=PIR.ghost&&PIR.ghost.g.position;if(play&&gs&&PIR.missT<=0&&Math.hypot(gs.x-x,gs.z-z)<6&&Math.hypot(cx-D.cannons[0].x,cz-D.cannons[0].z)<16){PIR.missT=25;toast('💥 Kula gikk rett gjennom Spøkelsesskuta!')}}}
  for(let i=PIR.puffs.length-1;i>=0;i--){const p=PIR.puffs[i];p.t+=dt;const u=p.t/p.life;if(u>=1){levelGroup.remove(p.sp);p.sp.material.dispose();PIR.puffs.splice(i,1);continue}p.sp.position.y+=p.vy*dt*(1-u);p.sp.material.opacity=.8*(1-u);const s=p.s*(1+u*1.4);p.sp.scale.set(s,s,1)}
  // the shanty from Skumkroa
  PIR.tuneT-=dt;if(PIR.tuneT<=0){PIR.tuneT=15;if(play&&Math.hypot(cx-D.inn.x,cz-D.inn.z)<16)pirTune(D.inn.x,D.inn.z)}
  // the ghost in the skull pops out and sinks back
  const gh=PIR.skull&&PIR.skull.userData.ghost;if(gh){PIR.booT=Math.max(0,PIR.booT-dt);const u=PIR.booT>10?Math.min(1,(12-PIR.booT)*3):Math.max(0,(PIR.booT-9)/1);gh.visible=u>0;gh.position.set(Math.sin(tm*5)*.2,.25+u*.55,-.4+u*4.6);gh.scale.setScalar(.7+u*.8)}
  if(play&&!state.course)pirTrials(dt,tm,P);
  // the chest rises out of the sand
  const C=PIR.chest;if(C&&C.k<1){C.k=Math.min(1,C.k+dt*.9);C.g.position.y=C.y-.6*(1-C.k)}}
// the trials you do by driving: the dig at the X and the ghost in the skull
function pirTrials(dt,tm,P){const D=PIR.def,cx=car.pos.x,cz=car.pos.z,S=D.skull;
  if(PIR.booT<=0&&Math.hypot(cx-S.boo.x,cz-S.boo.z)<S.boo.r){PIR.booT=12;pirWail(S.x,S.z);if(typeof ambThump==='function')ambThump(.8);const ox=Math.sin(S.dir),oz=Math.cos(S.dir);car.vel.x+=ox*4.5;car.vel.z+=oz*4.5;car.vel.y+=1.2;
    if(!P.boo){P.boo=1;prof.nuts+=60;saveProf();pirToast('👻 «BØØØ!» Du turte! +60 ⚙ · prøve '+pirDone()+' av 3.');ambChime(cx,cz)}else toast('👻 «BØØØ! Ut av hodet mitt!»')}
  if(!P.x){const d=Math.hypot(cx-D.dig.x,cz-D.dig.z);PIR.stopT-=dt;
    if(d<1.6&&car.vel.lengthSq()<1.6){if(PIR.digT===0)toast('⛏ Du graver under krysset …');PIR.digT+=dt;PIR.dustT-=dt;if(PIR.dustT<=0){PIR.dustT=.12;_pv.set(D.dig.x+(Math.random()-.5)*1.4,H(D.dig.x,D.dig.z),D.dig.z+(Math.random()-.5)*1.4);spawnDust(_pv,S_SAND,true)}
      if(PIR.digT>1.5){P.x=1;prof.nuts+=80;saveProf();pirChest(0);ambChime(cx,cz);pirToast('💰 Sjørøverskatten! +80 ⚙ · prøve '+pirDone()+' av 3.')}}
    else{PIR.digT=0;if(d<1.6&&PIR.stopT<=0){PIR.stopT=3;toast('⛏ Stopp helt på krysset')}}}}   // on the X, but too fast to dig: say so, at most every 3 s
const _pv=new THREE.Vector3(),S_SAND=0;
// the captain's flag on the car: a pole at the back with the black flag, on every island once you are a captain
function pirFlag(tm){if(typeof carVis==='undefined'||!carVis||!carVis.body||!prof.pirat||!prof.pirat.kap)return;const b=carVis.body;let f=b.userData.pirFlag;
  if(!f){const L=(car&&car.cfg.L)||2;f=new THREE.Group();apart(f,ANIMAL_GEO.cyl,amat('#d8d4c8'),0,.5,0,.012,.9,.012).castShadow=false;const fl=new THREE.Mesh(PIR_GEO.sail,new THREE.MeshBasicMaterial({map:pirFlagTex(),side:THREE.DoubleSide}));fl.scale.set(.44,.3,1);fl.position.set(0,.8,-.23);fl.rotation.y=Math.PI/2;
    const piv=new THREE.Group();piv.add(fl);f.add(piv);f.userData.piv=piv;f.position.set(-.3,.12,-L/2+.22);b.add(f);b.userData.pirFlag=f}
  const sp=car?Math.min(1,car.vel.length()/4):0;f.userData.piv.rotation.y=.55+Math.sin(tm*(4+sp*8))*(.3-.15*sp)}

/* ---------- the dialogs: the old pirates at Skumkroa and the war of words ---------- */
// called from updateWorld while roaming: open a dialog when the car stops by the table or by the sword master. Returns true when one opened
function pirWorld(){const D=PIR.def;if(!D||state.mode!=='play')return false;
  for(const[key,p]of[['pirat:kro',D.inn],['pirat:duell',D.duel]]){const d=Math.hypot(p.x-car.pos.x,p.z-car.pos.z);
    if(d<p.r&&state.askCool!==key&&car.vel.lengthSq()<9){openAsk(key);return true}if(d>p.r+2.5&&state.askCool===key)state.askCool=null}
  return false}
const PIR_DUEL=[
 {q:'«Du kjører som en sjøsyk skilpadde!»',a:'«Skilpadda kommer i alle fall fram. Det gjør ikke skuta di!»'},
 {q:'«Bilen din er så liten at måkene tror den er en brødskive!»',a:'«Liten bil og stort mot. Du har visst fått det omvendt!»'},
 {q:'«Jeg har møtt blekkspruter med bedre grep enn dekkene dine!»',a:'«Var det de som lærte deg å fekte? Du veiver jo med åtte armer!»'},
 {q:'«Du lukter som en våt sokk i en skattekiste!»',a:'«Så det er DER du gjemmer sokkene dine!»'},
 {q:'«Papegøyen min er smartere enn deg!»',a:'«Så fint! Da kan den lære deg å fekte.»'},
 {q:'«Ingen sjørøver har noen gang vært redd for deg!»',a:'«Nei, de rekker det ikke. De ler seg i hjel av hatten din først!»'},
 {q:'«Sverdet mitt er skarpere enn hodet ditt!»',a:'«Da er det rart at det er tunga di som er sløvest!»'}];
const PIR_WRONG=['«Det … det var ikke snilt sagt.»','«Eh … du er dum!»','«Jeg sier det til mamma!»','«Arrr?»','«Se bak deg! En apekatt med tre haler!»','«Jeg vet du er, men hva er jeg?»','«Kan vi ikke bare være venner?»','«Æsj, nå kom jeg ikke på noe.»'];
const PIR_LAUGH=['«Ha! Var det alt? Bestemoren min biter hardere, og hun har ikke tenner!»','«Det trikset er eldre enn skjegget til kaptein Gråskjegg!»','«Ho ho! Det svaret sank som en stein.»'];
const pirShuffle=L=>{const a=L.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
function pirShow(o){$('aKind').textContent=o.kind;$('aName').textContent=o.name;$('aDesc').textContent=o.desc;$('aBest').textContent=o.best||'';$('aQ').textContent=o.q||'';
  // the answers are direct button children of #aList, in order: js/game.js lets the keys 1–9 click them. o.num: show the key in front (hidden on touch screens, see .pir-n in css/style.css)
  if(o.list){$('aList').innerHTML=o.list.map((t,i)=>`<button data-pir="${i}"><span class="nm" style="font-size:1rem">${o.num?`<b class="pir-n">${i+1}</b>`:''}${t}</span></button>`).join('');$('aList').hidden=false}else $('aList').hidden=true;
  $('aYes').hidden=!o.yes;$('aNo').textContent=o.no||'NEI, kjør videre';$('ask').hidden=false;(o.yes?$('aYes'):$('aNo')).focus()}
function pirAsk(k){const P=pirProf();
  if(k==='pirat:kro'){const n=pirDone(),ok=b=>b?'✔':'✘';
    if(P.kap){pirShow({kind:'Skumkroa',name:'De tre gamle sjørøverne',desc:'«Arr, der er kaptein Landkrabbe! Flagget kler bilen din. Sett deg ned og ta en rotbrus, så skal du få høre om den gangen vi rodde fra en blekksprut …»',no:'Arr, ha det!'});return}
    if(n>=3){P.kap=1;prof.nuts+=150;saveProf();ambChime(car.pos.x,car.pos.z);
      pirShow({kind:'Skumkroa',name:'Du er sjørøverkaptein!',desc:'«Ved Neptuns skjegg! Skatten, ordduellen OG hodeskallen? Da er du en ekte sjørøver.» De tre gamle løfter krusene og heiser det svarte flagget på bilen din.',best:'+150 ⚙ · piratflagget vaier på bilen din på alle øyene.',no:'ARRR!'});return}
    pirShow({kind:'Skumkroa · '+n+' av 3 prøver klart',name:'De tre gamle sjørøverne',desc:'«Så du vil bli sjørøver, du? Da må du klare de tre prøvene, og komme tilbake hit til oss.»',
      list:[ok(P.x)+' Skattejakten: «Der to palmer bøyer seg mot hverandre på Skattestranda, står et kryss i sanda. Parker på krysset og grav.»',
        ok(P.duel)+' Ordduellen: «Sverdmesteren vest på øya slåss med ord. Finn svaret som biter best, tre ganger.»',
        ok(P.boo)+' Motprøven: «Kjør helt inn i gapet på Hodeskalleklippen. Tør du?»'],no:'Arr, jeg skal klare det!'});return}
  PIR.duel=null;pirShow({kind:'Ordduell',name:'Sverdmester Smilla',desc:'«Sverd er for pyser. En ekte sjørøver slåss med ORD! Jeg sier noe frekt, og du svarer noe som biter enda bedre. Første til tre vinner.»',
    best:P.duel?'Du har vunnet før. Nå gjelder det bare æren.':'Vinner du, har du klart en av de tre prøvene. +60 ⚙',q:'Tør du å duellere?',yes:true})}
function pirRound(msg){const D=PIR.duel,k='pirat:duell';state.mode='ask';state.askK=k;const r=PIR_DUEL[D.order[D.i%D.order.length]];D.opts=pirShuffle([r.a,...pirShuffle(PIR_WRONG).slice(0,2)]);D.right=D.opts.indexOf(r.a);
  pirShow({kind:'Ordduell · du '+D.score+' – Smilla '+D.miss,name:'Sverdmester Smilla',desc:r.q,best:msg||'',q:'Hva svarer du?',list:D.opts,num:true,no:'Jeg gir meg!'})}
function pirAnswer(k,yes){const P=pirProf(),close=()=>{state.mode='play';state.askCool=k;PIR.duel=null};
  if(k==='pirat:kro'){close();return}
  const D=PIR.duel;
  if(!D){if(yes===true){PIR.duel={i:0,score:0,miss:0,order:pirShuffle(PIR_DUEL.map((_,i)=>i))};pirRound()}else{close();toast('«Kom tilbake når du tør!»')}return}
  if(D.over||yes===false){close();if(!D.over)toast('«Ha! Kom tilbake når du har øvd!»');return}
  if(yes===true||yes.pir==null){pirRound(D.msg);return}                    // Enter with no answer chosen: show the round again
  if(yes.pir===D.right){D.score++;D.msg='Den satt! Smilla blir rød i toppen.';if(typeof ambChime==='function')ambChime(car.pos.x,car.pos.z)}else{D.miss++;D.msg=PIR_LAUGH[Math.floor(Math.random()*PIR_LAUGH.length)];if(typeof ambThump==='function')ambThump(.5)}
  D.i++;
  if(D.score>=3){D.over=true;const first=!P.duel;if(first){P.duel=1;prof.nuts+=60;saveProf()}state.mode='ask';state.askK=k;
    pirShow({kind:'Ordduell · du vant '+D.score+' – '+D.miss,name:'Du vant ordduellen!',desc:'Smilla slenger sverdet i sanda. «Arr! Den tunga di er skarpere enn sabelen min. Hils de gamle på Skumkroa og si at du slo meg!»',best:first?'+60 ⚙ · prøve '+pirDone()+' av 3 er klart.'+pirNext():'',no:'Arr!'});return}
  if(D.miss>=3){D.over=true;state.mode='ask';state.askK=k;pirShow({kind:'Ordduell · du tapte '+D.score+' – '+D.miss,name:'Smilla vant denne gangen',desc:'«Ha ha! Gå og øv deg på måkene, landkrabbe. Du kan prøve igjen når du vil.»',no:'Jeg kommer tilbake!'});return}
  pirRound(D.msg)}
if(typeof document!=='undefined'&&document.getElementById('aList'))document.getElementById('aList').addEventListener('click',e=>{const b=e.target.closest('[data-pir]');if(b)answerAsk({pir:+b.dataset.pir})});
