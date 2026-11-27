'use strict';
/* =================================================================
   SAVANNAH ANIMALS (Løveøya): the ones that move.
   Lions rest in the shade on the kopje, cheetahs patrol the open plain, crocodiles lurk in the river and the waterhole.
   Come too close and they attack: lions charge, cheetahs sprint (faster than the car, but only for a few seconds, and they turn
   wide, so swerve), crocodiles lunge out of the water. A hit throws the car about and costs 5 penalty points in a race,
   or 3 nuts while roaming. After an attack the animal goes back home and rests a while, and for SAV_TRUCE seconds no other animal
   attacks either (a pride of three is one hit, not three). The crocodile waits a moment (windup) after its warning before it lunges.
   Zebras, wildebeest, gazelles and giraffes graze in herds and bolt from the car (they use updateGrazers in js/animals.js),
   and vultures circle over the plain.
   A level turns this on with  animals:{lions:[{at,r,n}], cheetahs:[…], crocs:[…], zebras:[…], gnus:[…], gazelles:[…],
   giraffes:[…], vultures:{at,n,r}}. Loaded after js/animals.js; buildAnimals and updateAnimals call in here.
   ================================================================= */
const SAV={preds:[],vultures:[],all:[],warnT:0,hitT:0},SAV_TRUCE=7;   // hitT: seconds left of the truce after a hit (the polar bears in js/polardyr.js share it)
const SAV_KIND={
  lion:{name:'Løven',emoji:'🦁',big:true,alert:9,charge:6.5,speed:4.6,turn:3.2,maxT:5,leash:17,hit:.6,push:1,rest:12,warn:'⚠ Løvene har sett deg!'},
  cheetah:{name:'Geparden',emoji:'🐆',alert:13,charge:10.5,speed:6.6,turn:2.2,maxT:3.2,leash:26,hit:.55,push:.75,rest:9,warn:'⚠ Gepard! Sving unna!'},
  croc:{name:'Krokodillen',emoji:'🐊',alert:5,charge:3.6,speed:6,turn:5,maxT:1,leash:4.5,hit:.7,push:1.2,rest:7,windup:.8,warn:'⚠ Krokodille i vannet!'}
};

/* ---------- the meshes (they face +z) ---------- */
function savLegs(g,mat,pts,len,r){const legs=[];for(const[x,y,z]of pts){const l=new THREE.Group();l.position.set(x,y,z);apart(l,ANIMAL_GEO.cylTop,mat,0,0,0,r,len,r);g.add(l);legs.push(l)}return legs}
function savTail(g,mat,y,z,len,r,tuft){const piv=new THREE.Group();piv.position.set(0,y,z);apart(piv,ANIMAL_GEO.cylTop,mat,0,0,0,r,len,r);if(tuft)apart(piv,ANIMAL_GEO.sph,tuft,0,-len,0,r*2.4,r*3.2,r*2.4);piv.rotation.x=1.1;g.add(piv);return piv}
function makeLion(male){const g=new THREE.Group(),rig=new THREE.Group();g.add(rig);const fur=amat(male?'#c8954a':'#d2a35a'),lt=amat('#ead2a0'),dk=amat('#3a2414');
  apart(rig,ANIMAL_GEO.sph,fur,0,.5,0,.2,.21,.5);apart(rig,ANIMAL_GEO.sph,lt,0,.42,.02,.15,.12,.4);apart(rig,ANIMAL_GEO.sph,fur,0,.54,.3,.2,.22,.2);
  const head=new THREE.Group();head.position.set(0,.66,.5);rig.add(head);
  if(male){apart(head,ANIMAL_GEO.sph,amat('#6a3c1c'),0,0,-.04,.24,.26,.2);apart(head,ANIMAL_GEO.sph,amat('#8a5426'),0,-.05,.02,.21,.22,.16)}
  apart(head,ANIMAL_GEO.sph,fur,0,0,.06,.13,.13,.14);apart(head,ANIMAL_GEO.sph,lt,0,-.05,.17,.08,.06,.08);apart(head,ANIMAL_GEO.sph,dk,0,-.01,.24,.03,.025,.02);
  for(const sd of[-1,1]){apart(head,ANIMAL_GEO.sph,fur,sd*.09,.11,.02,.04,.04,.025);apart(head,ANIMAL_GEO.sph,amat('#d9b040',{roughness:.3}),sd*.055,.04,.16,.018)}
  const jaw=new THREE.Group();jaw.position.set(0,-.08,.12);apart(jaw,ANIMAL_GEO.sph,lt,0,0,.04,.06,.025,.06);head.add(jaw);
  g.userData.legs=savLegs(rig,fur,[[-.11,.44,.32],[.11,.44,.32],[-.11,.44,-.32],[.11,.44,-.32]],.42,.055);
  g.userData.tail=savTail(rig,fur,.55,-.48,.5,.022,dk);Object.assign(g.userData,{rig,head,jaw});return g}
function makeCheetah(){const g=new THREE.Group(),rig=new THREE.Group();g.add(rig);const fur=amat('#d9a650'),lt=amat('#f2e4c4'),dk=amat('#1e1812');
  apart(rig,ANIMAL_GEO.sph,fur,0,.55,0,.15,.16,.46);apart(rig,ANIMAL_GEO.sph,lt,0,.47,.02,.1,.08,.36);apart(rig,ANIMAL_GEO.sph,fur,0,.6,.28,.15,.17,.17);
  for(let i=0;i<34;i++){const a=(i*2.4)%6.28,u=((i*.37)%1)*2-1;apart(rig,ANIMAL_GEO.sph,dk,Math.sin(a)*.15*Math.sqrt(1-u*u*.6),.55+Math.cos(a)*.15,u*.42,.022,.022,.022)}   // the spots
  const head=new THREE.Group();head.position.set(0,.7,.48);rig.add(head);apart(head,ANIMAL_GEO.sph,fur,0,0,.03,.1,.09,.1);apart(head,ANIMAL_GEO.sph,lt,0,-.04,.11,.06,.045,.06);apart(head,ANIMAL_GEO.sph,dk,0,-.01,.16,.022,.02,.015);
  for(const sd of[-1,1]){apart(head,ANIMAL_GEO.sph,fur,sd*.06,.08,0,.03,.03,.02);apart(head,ANIMAL_GEO.sph,amat('#c9a030',{roughness:.3}),sd*.04,.03,.1,.014);apart(head,ANIMAL_GEO.box,dk,sd*.045,-.02,.12,.008,.06,.008,.3)}   // the black tear marks
  const jaw=new THREE.Group();jaw.position.set(0,-.06,.08);apart(jaw,ANIMAL_GEO.sph,lt,0,0,.03,.045,.018,.045);head.add(jaw);
  g.userData.legs=savLegs(rig,fur,[[-.08,.5,.3],[.08,.5,.3],[-.08,.5,-.3],[.08,.5,-.3]],.5,.035);
  g.userData.tail=savTail(rig,fur,.58,-.44,.6,.018,lt);Object.assign(g.userData,{rig,head,jaw});return g}
function makeCroc(){const g=new THREE.Group(),rig=new THREE.Group();g.add(rig);const sk=amat('#4a5a32'),bl=amat('#9aa070'),dk=amat('#2e3a20');
  apart(rig,ANIMAL_GEO.sph,sk,0,.1,0,.2,.09,.5);apart(rig,ANIMAL_GEO.sph,bl,0,.06,0,.17,.05,.44);
  for(let i=0;i<9;i++)for(const sd of[-1,1])apart(rig,ANIMAL_GEO.box,dk,sd*.07,.18,-.36+i*.09,.035,.03,.05);   // the ridges on the back
  const tail=new THREE.Group();tail.position.set(0,.1,-.45);rig.add(tail);const segs=[];let par=tail;
  for(let i=0;i<5;i++){const s=new THREE.Group();s.position.set(0,0,i?-.16:0);apart(s,ANIMAL_GEO.box,sk,0,0,-.08,.18-i*.03,.07-i*.008,.17);apart(s,ANIMAL_GEO.box,dk,0,.05,-.08,.02,.04,.12);par.add(s);segs.push(s);par=s}
  const head=new THREE.Group();head.position.set(0,.12,.48);rig.add(head);apart(head,ANIMAL_GEO.box,sk,0,.02,.25,.16,.07,.5);apart(head,ANIMAL_GEO.sph,sk,0,.04,.02,.12,.07,.1);
  for(const sd of[-1,1]){apart(head,ANIMAL_GEO.sph,amat('#c9b040',{roughness:.25}),sd*.06,.09,.05,.03);apart(head,ANIMAL_GEO.sph,dk,sd*.03,.06,.48,.015)}   // eyes on top, nostrils at the tip
  const jaw=new THREE.Group();jaw.position.set(0,-.02,.02);apart(jaw,ANIMAL_GEO.box,bl,0,-.02,.24,.15,.04,.48);for(let i=0;i<7;i++)for(const sd of[-1,1])apart(jaw,ANIMAL_GEO.cone,amat('#f2ecd8'),sd*.065,.02,.06+i*.065,.01,.03,.01);head.add(jaw);
  g.userData.legs=savLegs(rig,sk,[[-.2,.1,.28],[.2,.1,.28],[-.2,.1,-.3],[.2,.1,-.3]],.12,.035);g.userData.legs.forEach((l,i)=>l.rotation.z=(i%2?1:-1)*.9);
  Object.assign(g.userData,{rig,head,jaw,segs});return g}
// herd animals: the same rig as the deer in js/animals.js (userData.legs and userData.head), so updateGrazers walks and grazes them
function makeZebra(){const g=new THREE.Group(),wh=amat('#f2efe6'),bk=amat('#1c1a18');
  apart(g,ANIMAL_GEO.sph,wh,0,.62,0,.17,.19,.4);for(let i=0;i<9;i++){const z=-.32+i*.08,f=Math.sqrt(1-(z/.41)**2);apart(g,ANIMAL_GEO.sph,bk,0,.62,z,.174*f,.194*f,.018,(i%2-.5)*.3)}   // stripes round the body
  apart(g,ANIMAL_GEO.cylTop,wh,0,.95,.32,.07,.36,.09,-.6);for(let i=0;i<4;i++)apart(g,ANIMAL_GEO.sph,bk,0,.84+i*.05,.33+i*.03,.075,.012,.075,-.6);apart(g,ANIMAL_GEO.box,bk,0,1.0,.33,.025,.08,.3,-.6);   // neck, stripes, mane
  const head=new THREE.Group();head.position.set(0,1.0,.46);apart(head,ANIMAL_GEO.sph,wh,0,0,.06,.07,.08,.16);apart(head,ANIMAL_GEO.sph,bk,0,-.02,.2,.05,.05,.05);for(const sd of[-1,1])apart(head,ANIMAL_GEO.cone,wh,sd*.05,.09,-.02,.02,.08,.02);g.add(head);
  const legs=savLegs(g,wh,[[-.09,.5,.28],[.09,.5,.28],[-.09,.5,-.28],[.09,.5,-.28]],.5,.03);for(const l of legs)for(let i=0;i<3;i++)apart(l,ANIMAL_GEO.cyl,bk,0,-.12-i*.12,0,.033,.03,.033);
  apart(g,ANIMAL_GEO.cylTop,bk,0,.66,-.4,.015,.34,.015,-.4);g.userData.legs=legs;g.userData.head=head;return g}
function makeGnu(){const g=new THREE.Group(),fur=amat('#5a5650'),dk=amat('#2a2826');
  apart(g,ANIMAL_GEO.sph,fur,0,.62,0,.17,.2,.38);apart(g,ANIMAL_GEO.sph,fur,0,.72,.22,.18,.2,.18);
  apart(g,ANIMAL_GEO.cylTop,fur,0,.88,.34,.07,.24,.08,-1);apart(g,ANIMAL_GEO.box,dk,0,.92,.3,.03,.08,.22,-1);
  const head=new THREE.Group();head.position.set(0,.84,.5);apart(head,ANIMAL_GEO.box,dk,0,-.04,.1,.09,.1,.24);apart(head,ANIMAL_GEO.box,amat('#d8d0c0'),0,-.14,.04,.03,.12,.06);   // the long face and the white beard
  for(const sd of[-1,1])apart(head,ANIMAL_GEO.cylTop,amat('#2e2a24'),sd*.06,.06,0,.014,.12,.014,0,0,sd*1.4);g.add(head);
  g.userData.legs=savLegs(g,dk,[[-.09,.5,.26],[.09,.5,.26],[-.09,.5,-.26],[.09,.5,-.26]],.5,.028);apart(g,ANIMAL_GEO.cylTop,dk,0,.68,-.36,.015,.3,.015,-.4);g.userData.head=head;return g}
function makeGazelle(){const g=new THREE.Group(),fur=amat('#c48a4a'),wh=amat('#f4ece0'),bk=amat('#2a2016');
  apart(g,ANIMAL_GEO.sph,fur,0,.42,0,.09,.1,.22);apart(g,ANIMAL_GEO.sph,wh,0,.37,.0,.075,.06,.18);for(const sd of[-1,1])apart(g,ANIMAL_GEO.box,bk,sd*.082,.4,0,.01,.04,.3);   // the dark stripe on each side
  apart(g,ANIMAL_GEO.cylTop,fur,0,.62,.18,.035,.22,.035,-.4);
  const head=new THREE.Group();head.position.set(0,.64,.25);apart(head,ANIMAL_GEO.sph,fur,0,0,.04,.04,.045,.08);apart(head,ANIMAL_GEO.sph,bk,0,-.01,.12,.015);
  for(const sd of[-1,1]){apart(head,ANIMAL_GEO.cylTop,bk,sd*.02,.05,-.01,.008,.14,.008,-.3);apart(head,ANIMAL_GEO.cone,fur,sd*.04,.05,-.02,.015,.05,.015,0,0,sd*.7)}g.add(head);
  g.userData.legs=savLegs(g,fur,[[-.05,.34,.15],[.05,.34,.15],[-.05,.34,-.15],[.05,.34,-.15]],.34,.014);apart(g,ANIMAL_GEO.sph,bk,0,.44,-.23,.015,.04,.015);g.userData.head=head;return g}
function makeGiraffe(){const g=new THREE.Group(),fur=amat('#e0b060'),sp=amat('#8a4a20'),lt=amat('#f2e2bc');
  apart(g,ANIMAL_GEO.sph,fur,0,1.25,0,.2,.22,.4);for(let i=0;i<22;i++){const a=(i*2.4)%6.28,u=((i*.41)%1)*1.6-.8;apart(g,ANIMAL_GEO.sph,sp,Math.sin(a)*.2,1.25+Math.cos(a)*.2,u*.4,.06,.06,.06)}
  const head=new THREE.Group();head.position.set(0,1.38,.3);g.add(head);   // the whole neck tips down when it grazes
  apart(head,ANIMAL_GEO.cylTop,fur,0,1.1,.36,.07,1.15,.08,-.32);for(let i=0;i<7;i++)apart(head,ANIMAL_GEO.sph,sp,0,.12+i*.15,.05+i*.05,.075,.04,.06);apart(head,ANIMAL_GEO.box,amat('#6a3a1a'),0,.6,.12,.02,1.0,.04,-.32);
  apart(head,ANIMAL_GEO.sph,fur,0,1.15,.42,.07,.07,.16);apart(head,ANIMAL_GEO.sph,lt,0,1.12,.56,.045,.04,.05);for(const sd of[-1,1]){apart(head,ANIMAL_GEO.cylTop,sp,sd*.03,1.3,.38,.012,.1,.012);apart(head,ANIMAL_GEO.cone,fur,sd*.07,1.22,.36,.02,.07,.02,0,0,sd*1.2)}
  g.userData.legs=savLegs(g,fur,[[-.12,1.1,.28],[.12,1.1,.28],[-.12,1.1,-.28],[.12,1.1,-.28]],1.1,.035);apart(g,ANIMAL_GEO.cylTop,fur,0,1.3,-.4,.015,.5,.015,-.3);g.userData.head=head;return g}
function makeVulture(){const g=new THREE.Group(),br=amat('#4a3a2c');apart(g,ANIMAL_GEO.sph,br,0,0,0,.12,.1,.26);apart(g,ANIMAL_GEO.sph,amat('#e8dccc'),0,.04,.2,.09,.07,.06);apart(g,ANIMAL_GEO.sph,amat('#c89080'),0,.06,.3,.045);
  const wings=[];for(const sd of[-1,1]){const piv=new THREE.Group();piv.position.set(sd*.08,.03,.02);const w=new THREE.Mesh(ANIMAL_GEO.wing,amat('#3a2c20',{side:THREE.DoubleSide}));w.scale.set(sd*1.05,.34,1);w.rotation.x=-Math.PI/2;w.castShadow=true;piv.add(w);g.add(piv);wings.push(piv)}
  g.userData.wings=wings;return g}

/* ---------- build ---------- */
// one mesh per material in each moving part: the parts of an animal that move together (the body, a leg, the head, the jaw, a tail segment)
// are groups, and the meshes directly inside a group are merged, so a lion is a dozen draw calls instead of thirty
function savBake(o){const by=new Map();
  for(const m of[...o.children]){if(!m.isMesh){savBake(m);continue}if(!by.has(m.material))by.set(m.material,[]);by.get(m.material).push(m)}
  for(const[mat,L]of by){if(L.length<2)continue;let n=0;const gs=L.map(m=>{m.updateMatrix();const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);n+=g.attributes.position.count;return g});
    const P=new Float32Array(n*3),N=new Float32Array(n*3);let k=0;for(const g of gs){P.set(g.attributes.position.array,k*3);N.set(g.attributes.normal.array,k*3);k+=g.attributes.position.count;g.dispose()}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(P,3));geo.setAttribute('normal',new THREE.BufferAttribute(N,3));geo.computeBoundingSphere();
    for(const m of L)o.remove(m);const mm=new THREE.Mesh(geo,mat);mm.castShadow=true;o.add(mm)}
  return o}
// only the body casts a shadow: legs, heads and tails would cost a draw call each in the shadow pass too
function savPrep(g){savBake(g);const U=g.userData,body=U.rig||g;g.traverse(m=>{if(m.isMesh&&m.parent!==body&&m.parent!==g)m.castShadow=false});return g}
function savSpot(o,R,ok){for(let k=0;k<60;k++){const a=R()*6.28,d=Math.sqrt(R())*o.r,x=o.at[0]+Math.cos(a)*d,z=o.at[1]+Math.sin(a)*d;if(ok(x,z))return[x,z]}return null}
function buildSavanna(lv,def,R){SAV.preds=[];SAV.vultures=[];SAV.all=[];SAV.warnT=0;SAV.hitT=0;const A=def.animals;if(!A)return;
  const land=(x,z)=>WL(x,z)<H(x,z)-.05&&lv.dist(x,z)>2,wet=(x,z)=>WL(x,z)>H(x,z)+.14;
  const pred=(kind,list,mk,ok)=>{for(const o of(list||[]))for(let i=0;i<(o.n||1);i++){const p=savSpot(o,R,ok);if(!p)continue;const g=savPrep(mk(i));SAV.all.push(g);g.position.set(p[0],H(p[0],p[1]),p[1]);g.rotation.y=R()*6.28;levelGroup.add(g);
      SAV.preds.push({g,kind,K:SAV_KIND[kind],hx:p[0],hz:p[1],st:'rest',t:R()*3,cool:0,sp:0,ph:R()*6.28,male:kind==='lion'&&i===0})}};
  pred('lion',A.lions,i=>makeLion(i===0),land);pred('cheetah',A.cheetahs,()=>makeCheetah(),land);pred('croc',A.crocs,()=>makeCroc(),wet);
  const herd=(list,mk,flee,speed)=>{for(const o of(list||[]))for(let i=0;i<(o.n||4);i++){const p=savSpot(o,R,land);if(!p)continue;const g=savPrep(mk());SAV.all.push(g);g.position.set(p[0],H(p[0],p[1]),p[1]);g.rotation.y=R()*6.28;levelGroup.add(g);
      ANIMALS.deer.push({g,kind:'deer',hx:o.at[0],hz:o.at[1],hr:o.r,st:'graze',t:R()*4,ph:R()*6.28,sp:0,tx:p[0],tz:p[1],flee,speed})}};
  herd(A.zebras,makeZebra,6,4.2);herd(A.gnus,makeGnu,5.5,4);herd(A.gazelles,makeGazelle,7.5,5.4);herd(A.giraffes,makeGiraffe,6.5,2.6);
  if(A.vultures){const V=A.vultures;for(let i=0;i<(V.n||4);i++){const g=savBake(makeVulture());SAV.all.push(g);levelGroup.add(g);SAV.vultures.push({g,cx:V.at[0]+(R()-.5)*6,cz:V.at[1]+(R()-.5)*6,cy:H(V.at[0],V.at[1])+5+R()*3,r:(V.r||7)*(.6+R()*.6),a:R()*6.28,w:(R()<.5?1:-1)*(.2+R()*.12),ph:R()*6.28})}}}

/* ---------- sounds ---------- */
function savRoar(x,z,big){if(typeof initAmbience!=='function')return;initAmbience();const v=typeof ambVoice==='function'&&ambVoice(x,z,big?45:30);if(!v)return;try{const ac=AMB.ac,t=v.t,d=big?1.4:.6,vol=(big?.5:.3)*v.vol*(state.volAmb/70);
  const o=ac.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(big?120:260,t);o.frequency.linearRampToValueAtTime(big?150:340,t+d*.3);o.frequency.exponentialRampToValueAtTime(big?55:150,t+d);
  const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=big?520:900;const s=noiseSrc(ac,noiseBuf(ac,d+.2)),nf=ac.createBiquadFilter();nf.type='bandpass';nf.frequency.value=big?300:700;
  o.connect(f);f.connect(v.g);s.connect(nf);nf.connect(v.g);v.g.gain.setValueAtTime(0,t);v.g.gain.linearRampToValueAtTime(vol,t+.12);v.g.gain.setValueAtTime(vol,t+d*.5);v.g.gain.exponentialRampToValueAtTime(.0001,t+d);o.start(t);o.stop(t+d+.05);s.stop(t+d+.05)}catch(e){}}
function savSnap(x,z){if(typeof initAmbience!=='function')return;initAmbience();const v=typeof ambVoice==='function'&&ambVoice(x,z,25);if(!v)return;try{const ac=AMB.ac,t=v.t,vol=.6*v.vol*(state.volAmb/70),s=noiseSrc(ac,noiseBuf(ac,.3)),f=ac.createBiquadFilter();f.type='bandpass';f.frequency.value=1400;f.Q.value=2;
  s.connect(f);f.connect(v.g);v.g.gain.setValueAtTime(vol,t);v.g.gain.exponentialRampToValueAtTime(.0001,t+.12);s.stop(t+.2)}catch(e){}}

/* ---------- update ---------- */
// the closest point on the car's centre line (front to back) to (x,z)
function savCarDist(x,z){const L=car.cfg.L/2,fx=car.fw.x,fz=car.fw.z,fl=Math.hypot(fx,fz)||1,ux=fx/fl,uz=fz/fl,dx=x-car.pos.x,dz=z-car.pos.z;let u=dx*ux+dz*uz;u=Math.max(-L,Math.min(L,u));return Math.hypot(dx-ux*u,dz-uz*u)}
function savAttack(p){const K=p.K,g=p.g;let nx=car.pos.x-g.position.x,nz=car.pos.z-g.position.z;const l=Math.hypot(nx,nz)||1;nx/=l;nz/=l;const k=K.push;
  car.vel.x+=nx*3*k;car.vel.z+=nz*3*k;car.vel.y+=.8*k;state.thrown=performance.now();   // state.thrown: no jump bonus for the flight (js/game.js)
  car.w.y+=(Math.random()<.5?-1:1)*2.6*k;car.w.x+=(Math.random()-.5)*1.6*k;car.w.z+=(Math.random()-.5)*1.6*k;
  if(typeof ambThump==='function')ambThump(1);if(p.kind==='croc')savSnap(g.position.x,g.position.z);else savRoar(g.position.x,g.position.z,p.K.big);
  if(!state.free&&typeof addPenalty==='function')addPenalty(5,K.name+' angrep');
  else{const n=Math.min(prof.nuts,3);prof.nuts-=n;saveProf();toast(K.emoji+' '+K.name+' angrep!'+(n?' −'+n+' ⚙':''),true)}}
function savTurn(g,want,rate,dt){let dy=want-g.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));g.rotation.y+=Math.max(-rate*dt,Math.min(rate*dt,dy))}
function updateSavanna(dt,tm){if(!SAV.all.length)return;
  for(const g of SAV.all){const dx=g.position.x-camera.position.x,dz=g.position.z-camera.position.z;g.visible=dx*dx+dz*dz<55*55}   // far away they are a few pixels: not drawn
  const play=state.mode==='play';SAV.warnT-=dt;SAV.hitT-=dt;
  for(const p of SAV.preds){const g=p.g,K=p.K,U=g.userData,x=g.position.x,z=g.position.z,d=savCarDist(x,z),home=Math.hypot(x-p.hx,z-p.hz),croc=p.kind==='croc';p.t-=dt;p.cool-=dt;
    const carWet=WL(car.pos.x,car.pos.z)>H(car.pos.x,car.pos.z)-.25,canSee=play&&p.cool<=0&&SAV.hitT<=0&&(!croc||carWet||d<2.2);
    if(p.st==='rest'||p.st==='alert'){p.sp=0;
      // K.windup (the crocodile): it must have been alert, with its warning shown, for that long before it may charge
      if(canSee&&d<K.charge&&!(K.windup&&!(p.st==='alert'&&p.al>=K.windup))){p.st='charge';p.t=K.maxT;if(!croc)savRoar(x,z,K.big);if(SAV.warnT<=0){toast(K.warn,true);SAV.warnT=6}}
      else if(canSee&&d<K.alert){if(p.st!=='alert'){p.al=0;if(SAV.warnT<=0){toast(K.warn,true);SAV.warnT=6}}p.al+=dt;p.st='alert';savTurn(g,Math.atan2(car.pos.x-x,car.pos.z-z),2,dt)}
      else p.st='rest'}
    else if(p.st==='charge'){p.sp=K.speed;const tx=car.pos.x+car.vel.x*.35,tz=car.pos.z+car.vel.z*.35;savTurn(g,Math.atan2(tx-x,tz-z),K.turn,dt);
      if(SAV.hitT<=0&&d<K.hit+.45){savAttack(p);SAV.hitT=SAV_TRUCE;p.st='back';p.cool=K.rest;p.t=0}
      else if(p.t<=0||home>K.leash||!play||SAV.hitT>0){p.st='back';p.cool=K.rest*.5;p.t=0}}
    else if(p.st==='back'){p.sp=croc?1.2:1.6;savTurn(g,Math.atan2(p.hx-x,p.hz-z),3,dt);if(home<.6||p.t<-12){p.st='rest';p.sp=0}}   // after 12 s it rests where it is (water in the way)
    if(p.sp>0){const nx=x+Math.sin(g.rotation.y)*p.sp*dt,nz=z+Math.cos(g.rotation.y)*p.sp*dt,wet=WL(nx,nz)>H(nx,nz)+.05;
      if((croc?Math.hypot(nx-p.hx,nz-p.hz)<K.leash:!wet)&&Math.abs(nx)<HALF-3&&Math.abs(nz)<HALF-3){g.position.x=nx;g.position.z=nz}else if(p.st==='charge'){p.st='back';p.cool=K.rest*.5;p.t=0}}
    // pose and animation
    const gx=g.position.x,gz=g.position.z,gh=H(gx,gz),run=p.sp>2.5,walk=p.sp>0;
    if(croc){const wl=WL(gx,gz),inW=wl>gh;g.position.y=inW?Math.max(gh,wl-(p.st==='charge'?.05:.16)):gh;U.jaw.rotation.x=p.st==='charge'?.5+.2*Math.sin(tm*20):p.st==='back'&&p.cool>K.rest-1?.6:0;
      U.segs.forEach((s,i)=>s.rotation.y=Math.sin(tm*(walk?8:1.2)+p.ph+i*.7)*(walk?.25:.08));U.legs.forEach((l,i)=>l.rotation.x=walk?Math.sin(tm*10+(i%2?Math.PI:0))*.6:0);continue}
    g.position.y=gh;const lying=p.st==='rest'&&p.kind==='lion';U.rig.position.y+=((lying?-.3:0)-U.rig.position.y)*Math.min(1,dt*3);
    U.legs.forEach((l,i)=>{const front=i<2;l.rotation.x=lying?(front?-1.35:1.35):walk?Math.sin(tm*(run?(p.kind==='cheetah'?18:13):6)+(i%2?Math.PI:0)+(front?0:Math.PI/2))*(run?.9:.45):0});
    U.head.rotation.x=p.st==='rest'&&!lying?.5+.1*Math.sin(tm*.8+p.ph):p.st==='alert'?-.15:0;U.head.rotation.y=p.st==='rest'?Math.sin(tm*.3+p.ph)*.5:0;
    U.jaw.rotation.x=p.st==='charge'||p.st==='alert'?.35+.15*Math.sin(tm*6):0;U.tail.rotation.z=Math.sin(tm*(p.st==='alert'?6:1.5)+p.ph)*.4;
    U.rig.rotation.x=run?Math.sin(tm*(p.kind==='cheetah'?18:13))*.06:0}
  for(const v of SAV.vultures){const g=v.g;v.a+=dt*v.w;g.position.set(v.cx+Math.cos(v.a)*v.r,v.cy+.8*Math.sin(tm*.2+v.ph),v.cz+Math.sin(v.a)*v.r);const sg=v.w>0?1:-1;g.rotation.y=Math.atan2(-Math.sin(v.a)*sg,Math.cos(v.a)*sg);g.rotation.z=v.w>0?-.3:.3;
    const fl=Math.sin(tm*.31+v.ph)>.6?Math.sin(tm*8+v.ph)*.45:Math.sin(tm*1.1+v.ph)*.05;g.userData.wings[0].rotation.z=-fl;g.userData.wings[1].rotation.z=fl}}
