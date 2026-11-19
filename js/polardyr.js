'use strict';
/* =================================================================
   ARCTIC ANIMALS (Svalbard): the ones that move.
   Polar bears amble about on the fjord ice and by the glacier. Come too close and they charge like the lions on Løveøya (they use
   the predators in js/savannedyr.js: a warning, a charge, a hit that throws the car about and costs 5 penalty points in a race or
   3 nuts while roaming). A car in low gear cannot outrun one; high gear or a snowmobile can.
   Svalbard reindeer (short legs, round bodies) graze in herds and trot away from the car (updateGrazers in js/animals.js).
   Seals lie by their breathing holes in the ice: drive near and they wriggle to the hole and dive, then peek up again when it is quiet.
   Walruses lie on the beach and lift their heads and grunt, and the sled dogs at the trapper's hut watch the car and wag their tails.
   A level turns this on with  animals:{polarbears:[{at,r,n}], reindeer:[{at,r,n}], seals:[{at:[x,z],n}], walruses:[{at,r,n}],
   dogs:[[x,z,heading],…]}.  at for the seals is the breathing hole. Loaded after js/savannedyr.js; buildAnimals and updateAnimals call in here.
   ================================================================= */
const POL={bears:[],seals:[],walruses:[],dogs:[],gruntT:0};
SAV_KIND.bear={name:'Isbjørnen',emoji:'🐻‍❄️',big:true,alert:11,charge:7.5,speed:5,turn:2.6,maxT:6,leash:22,hit:.7,push:1.1,rest:12,warn:'⚠ Isbjørn! Kjør unna!'};

/* ---------- the meshes (they face +z) ---------- */
function makePolarBear(){const g=new THREE.Group(),rig=new THREE.Group();g.add(rig);const G=ANIMAL_GEO,fur=amat('#f1ecdc'),sh=amat('#dcd4bc'),dk=amat('#1a1614');
  apart(rig,G.sph,fur,0,.6,-.08,.27,.27,.5);apart(rig,G.sph,fur,0,.64,-.42,.27,.27,.27);apart(rig,G.sph,sh,0,.48,-.06,.2,.14,.42);   // the body, the big rump and the belly
  apart(rig,G.sph,fur,0,.63,.3,.23,.23,.25);apart(rig,G.sph,fur,0,.66,.52,.15,.15,.25,-.3);                                         // the shoulders and the long neck
  const head=new THREE.Group();head.position.set(0,.7,.72);rig.add(head);
  apart(head,G.sph,fur,0,0,.02,.125,.115,.14);apart(head,G.sph,fur,0,-.035,.15,.075,.065,.11);apart(head,G.sph,dk,0,-.015,.25,.03,.025,.022);
  for(const sd of[-1,1]){apart(head,G.sph,dk,sd*.055,.04,.11,.015);apart(head,G.sph,fur,sd*.09,.095,-.02,.032,.032,.02)}
  const jaw=new THREE.Group();jaw.position.set(0,-.075,.09);apart(jaw,G.sph,sh,0,0,.05,.055,.02,.075);head.add(jaw);
  const legs=savLegs(rig,fur,[[-.15,.5,.3],[.15,.5,.3],[-.15,.5,-.4],[.15,.5,-.4]],.47,.085);for(const l of legs)apart(l,G.sph,fur,0,-.46,.03,.1,.045,.125);   // thick legs and broad paws
  const tail=new THREE.Group();tail.position.set(0,.62,-.67);apart(tail,G.sph,fur,0,0,0,.045,.05,.04);rig.add(tail);
  Object.assign(g.userData,{rig,head,jaw,legs,tail});return g}
// Svalbard reindeer: stout, short-legged and pale, with a white neck and rump. The same rig as the deer, so updateGrazers walks and grazes it
function makeReindeer(bull){const g=new THREE.Group(),G=ANIMAL_GEO,fur=amat('#b9ad98'),lt=amat('#f0ece2'),dk=amat('#5e5548'),horn=amat('#d8c9a8');
  apart(g,G.sph,fur,0,.42,0,.17,.17,.3);apart(g,G.sph,lt,0,.36,-.01,.14,.11,.25);apart(g,G.sph,lt,0,.46,-.27,.1,.1,.06);apart(g,G.sph,lt,0,.52,.24,.09,.13,.1,-.5);
  const head=new THREE.Group();head.position.set(0,.6,.32);apart(head,G.sph,fur,0,0,.04,.065,.065,.11);apart(head,G.sph,dk,0,-.01,.14,.035,.03,.03);
  for(const sd of[-1,1]){apart(head,G.sph,amat('#14110e'),sd*.045,.025,.07,.012);apart(head,G.cone,fur,sd*.07,.05,-.02,.02,.06,.02,0,0,-sd*1.1);
    apart(head,G.cylTop,horn,sd*.03,.06,-.02,.011,bull?.3:.16,.011,Math.PI-.5,0,-sd*.5);
    if(bull){apart(head,G.cylTop,horn,sd*.13,.3,-.13,.009,.13,.009,Math.PI+.5,0,-sd*.2);apart(head,G.cylTop,horn,sd*.09,.2,-.08,.009,.11,.009,Math.PI+1.1,0,-sd*.4)}}
  g.add(head);const legs=savLegs(g,fur,[[-.09,.32,.2],[.09,.32,.2],[-.09,.32,-.2],[.09,.32,-.2]],.32,.034);for(const l of legs)apart(l,G.sph,dk,0,-.3,.01,.036,.025,.045);
  g.userData.legs=legs;g.userData.head=head;return g}
// a ringed seal: a grey spotted sausage with big dark eyes, whiskers, two front flippers and the hind flippers together like a tail
function makeSeal(col){const g=new THREE.Group(),rig=new THREE.Group();g.add(rig);const G=ANIMAL_GEO,fur=amat(col||'#8a9098'),lt=amat('#c9ccd0'),dk=amat('#3e444c'),bk=amat('#0e0e10',{roughness:.2});
  apart(rig,G.sph,fur,0,.11,0,.13,.11,.33);apart(rig,G.sph,lt,0,.075,.02,.11,.07,.28);for(let i=0;i<9;i++){const a=i*2.4;apart(rig,G.sph,dk,Math.sin(a)*.09,.17+.02*Math.cos(a*3),-.2+i*.045,.025,.012,.03)}
  const head=new THREE.Group();head.position.set(0,.15,.29);rig.add(head);apart(head,G.sph,fur,0,0,.03,.085,.08,.09);apart(head,G.sph,lt,0,-.025,.1,.05,.035,.04);apart(head,G.sph,bk,0,-.005,.14,.015,.012,.01);
  for(const sd of[-1,1]){apart(head,G.sph,bk,sd*.04,.025,.085,.02);apart(head,G.cyl,lt,sd*.065,-.03,.11,.002,.07,.002,0,0,sd*1.3)}
  const flip=[];for(const sd of[-1,1]){const f=new THREE.Group();f.position.set(sd*.12,.07,.14);apart(f,G.sph,dk,sd*.05,-.02,0,.07,.015,.04);rig.add(f);flip.push(f)}
  const tail=new THREE.Group();tail.position.set(0,.09,-.31);for(const sd of[-1,1])apart(tail,G.sph,dk,sd*.035,0,-.06,.03,.012,.08,0,sd*.3);rig.add(tail);
  Object.assign(g.userData,{rig,head,flip,tail});return g}
// a walrus: a big brown wrinkled lump with a whiskered pad, two long tusks and small eyes
function makeWalrus(){const g=new THREE.Group(),G=ANIMAL_GEO,sk=amat('#8a5e44'),lt=amat('#a8785a'),tusk=amat('#f4eed8',{roughness:.4}),bk=amat('#14100e');
  apart(g,G.sph,sk,0,.27,-.1,.36,.28,.62);apart(g,G.sph,lt,0,.34,.3,.3,.3,.3);for(let i=0;i<4;i++)apart(g,G.sph,sk,0,.3,.02+i*.12,.33-.01*i,.3,.03);   // the body and the folds in the neck
  const head=new THREE.Group();head.position.set(0,.46,.5);g.add(head);apart(head,G.sph,lt,0,0,.02,.17,.16,.16);apart(head,G.sph,amat('#c9a486'),0,-.06,.14,.13,.08,.07);
  for(const sd of[-1,1]){apart(head,G.sph,bk,sd*.08,.06,.12,.016);apart(head,G.cone,tusk,sd*.06,-.24,.15,.022,.3,.022,Math.PI+.12);for(let i=0;i<4;i++)apart(head,G.cyl,tusk,sd*(.05+i*.025),-.08-.01*i,.2,.003,.07,.003,1.2,0,sd*.3)}
  for(const sd of[-1,1]){apart(g,G.sph,sk,sd*.34,.05,.28,.16,.04,.1,0,sd*.5);apart(g,G.sph,sk,sd*.16,.05,-.72,.1,.04,.16,0,sd*.4)}
  g.userData.head=head;return g}
// a sled dog (a Greenland dog) sitting on its haunches: grey back, white chest and mask, pricked ears, the tail curled over the back
function makeSledDog(col){const g=new THREE.Group(),G=ANIMAL_GEO,fur=amat(col||'#7a7e86'),wh=amat('#f2f0ea'),bk=amat('#14110e');
  apart(g,G.sph,fur,0,.2,-.04,.1,.13,.16,-.55);apart(g,G.sph,wh,0,.2,.05,.075,.12,.08,-.3);apart(g,G.sph,fur,0,.09,-.12,.12,.09,.13);
  for(const sd of[-1,1]){apart(g,G.cylTop,wh,sd*.055,.2,.1,.025,.2,.025);apart(g,G.sph,wh,sd*.055,.015,.13,.03,.018,.045);apart(g,G.sph,fur,sd*.1,.05,0,.04,.04,.09)}
  const head=new THREE.Group();head.position.set(0,.37,.07);g.add(head);apart(head,G.sph,fur,0,0,0,.075,.07,.075);apart(head,G.sph,wh,0,-.02,.07,.045,.04,.06);apart(head,G.sph,bk,0,-.01,.13,.014);
  for(const sd of[-1,1]){apart(head,G.cone,fur,sd*.045,.085,-.01,.025,.06,.02);apart(head,G.sph,amat('#6ab0e0',{roughness:.3}),sd*.03,.02,.06,.011)}
  const tongue=apart(head,G.sph,amat('#e0707a'),0,-.05,.1,.014,.006,.03);
  const tail=new THREE.Group();tail.position.set(0,.14,-.2);apart(tail,G.tail,fur,0,.07,0,.07,.07,.07,0,Math.PI/2,0);apart(tail,G.sph,wh,0,.15,.03,.03);g.add(tail);
  Object.assign(g.userData,{head,tail,tongue});return g}

/* ---------- build ---------- */
function buildPolar(lv,def,R){POL.bears=[];POL.seals=[];POL.walruses=[];POL.dogs=[];const A=def.animals;if(!A)return;
  const land=(x,z)=>WL(x,z)<H(x,z)-.03&&lv.dist(x,z)>2,put=(g,x,z,ry)=>{g.position.set(x,H(x,z),z);g.rotation.y=ry;levelGroup.add(g);SAV.all.push(g);return g};
  for(const o of(A.polarbears||[]))for(let i=0;i<(o.n||1);i++){const p=savSpot(o,R,land);if(!p)continue;const g=put(savPrep(makePolarBear()),p[0],p[1],R()*6.28);g.scale.setScalar(.95+R()*.25);
    const b={g,kind:'bear',K:SAV_KIND.bear,hx:p[0],hz:p[1],hr:Math.min(o.r||5,6),st:'rest',t:R()*3,cool:0,sp:0,ph:R()*6.28,walk:false,wt:R()*5,wx:p[0],wz:p[1]};SAV.preds.push(b);POL.bears.push(b)}
  for(const o of(A.reindeer||[]))for(let i=0;i<(o.n||4);i++){const p=savSpot(o,R,land);if(!p)continue;const g=put(savPrep(makeReindeer(i%3===0)),p[0],p[1],R()*6.28);g.scale.setScalar(.9+R()*.25);
    ANIMALS.deer.push({g,kind:'deer',hx:o.at[0],hz:o.at[1],hr:o.r,st:'graze',t:R()*4,ph:R()*6.28,sp:0,tx:p[0],tz:p[1],flee:5,speed:3.2})}
  const sealCols=['#8a9098','#74787e','#9a948a','#6a7078'];
  for(const o of(A.seals||[]))for(let i=0;i<(o.n||2);i++){const a=R()*6.28,d=1.2+R()*.9,x=o.at[0]+Math.cos(a)*d,z=o.at[1]+Math.sin(a)*d,ry=R()*6.28,g=put(savPrep(makeSeal(sealCols[Math.floor(R()*4)])),x,z,ry);g.scale.setScalar(.9+R()*.3);
    POL.seals.push({g,hx:o.at[0],hz:o.at[1],x0:x,z0:z,r0:ry,st:'lie',t:0,ph:R()*6.28})}
  for(const o of(A.walruses||[]))for(let i=0;i<(o.n||2);i++){const p=savSpot(o,R,(x,z)=>WL(x,z)<H(x,z)-.03&&lv.dist(x,z)>1.5);if(!p)continue;const g=put(savBake(makeWalrus()),p[0],p[1],R()*6.28);g.scale.setScalar(.85+R()*.3);POL.walruses.push({g,ph:R()*6.28,up:0})}
  const dogCols=['#7a7e86','#3a3a40','#b0a898','#8a6a4a','#5a5e66'];
  (A.dogs||[]).forEach((d,i)=>{const g=put(savBake(makeSledDog(dogCols[i%dogCols.length])),d[0],d[1],d[2]||0);POL.dogs.push({g,r0:d[2]||0,ph:R()*6.28})})}

/* ---------- sounds: the walrus's grunt, a short low burp ---------- */
function polGrunt(x,z){if(typeof initAmbience!=='function')return;initAmbience();const v=typeof ambVoice==='function'&&ambVoice(x,z,25);if(!v)return;try{const ac=AMB.ac,t=v.t,vol=.35*v.vol*(state.volAmb/70);
  for(let i=0;i<3;i++){const o=ac.createOscillator(),f=ac.createBiquadFilter(),t0=t+i*.22;o.type='sawtooth';o.frequency.setValueAtTime(70,t0);o.frequency.linearRampToValueAtTime(48,t0+.16);f.type='lowpass';f.frequency.value=380;o.connect(f);f.connect(v.g);o.start(t0);o.stop(t0+.18)}
  v.g.gain.setValueAtTime(vol,t);v.g.gain.setValueAtTime(vol,t+.6);v.g.gain.exponentialRampToValueAtTime(.0001,t+.75)}catch(e){}}

/* ---------- update ---------- */
function updatePolar(dt,tm){if(!POL.bears.length&&!POL.seals.length&&!POL.walruses.length&&!POL.dogs.length)return;const play=state.mode==='play',cx=car.pos.x,cz=car.pos.z;POL.gruntT-=dt;
  // bears at rest amble about near home, stop and sniff the ice, and amble on (the charge itself is in updateSavanna)
  for(const b of POL.bears){if(b.st!=='rest')continue;const g=b.g,U=g.userData;b.wt-=dt;
    if(b.wt<=0){b.walk=!b.walk;b.wt=b.walk?4+Math.random()*5:3+Math.random()*6;if(b.walk){const a=Math.random()*6.28,r=Math.random()*b.hr;b.wx=b.hx+Math.cos(a)*r;b.wz=b.hz+Math.sin(a)*r}}
    if(!b.walk)continue;const ex=b.wx-g.position.x,ez=b.wz-g.position.z;if(Math.hypot(ex,ez)<.4){b.walk=false;b.wt=3+Math.random()*6;continue}
    savTurn(g,Math.atan2(ex,ez),1.5,dt);const nx=g.position.x+Math.sin(g.rotation.y)*.55*dt,nz=g.position.z+Math.cos(g.rotation.y)*.55*dt;
    if(WL(nx,nz)<H(nx,nz)-.03){g.position.set(nx,H(nx,nz),nz)}else b.walk=false;
    U.legs.forEach((l,i)=>l.rotation.x=Math.sin(tm*4.2+b.ph+(i%2?Math.PI:0)+(i<2?0:Math.PI/2))*.38);U.head.rotation.x=.12+.06*Math.sin(tm*2.1+b.ph);U.head.rotation.y=Math.sin(tm*.5+b.ph)*.35;U.rig.rotation.z=Math.sin(tm*4.2+b.ph)*.025}
  // seals: lie by the hole, wriggle to it and dive when the car comes, peek up when it is quiet, and haul out again
  for(const s of POL.seals){const g=s.g,U=g.userData,x=g.position.x,z=g.position.z,d=Math.hypot(cx-x,cz-z),dh=Math.hypot(cx-s.hx,cz-s.hz),gy=H(s.hx,s.hz);
    if(s.st==='lie'){g.position.y=H(x,z);g.rotation.x=0;U.head.rotation.x=-.25+.12*Math.sin(tm*.7+s.ph);U.head.rotation.y=Math.sin(tm*.4+s.ph)*.5;U.tail.rotation.x=Math.max(0,Math.sin(tm*.9+s.ph))*.5;U.flip.forEach((f,i)=>f.rotation.z=0);U.rig.rotation.z=0;
      if(play&&d<4.4){s.st='flee'}}
    else if(s.st==='flee'||s.st==='out'){const out=s.st==='out',tx=out?s.x0:s.hx,tz=out?s.z0:s.hz,ex=tx-x,ez=tz-z,L=Math.hypot(ex,ez),sp=out?.7:2.3;
      if(out&&play&&d<4.4){s.st='flee';continue}
      if(L<.2){if(out){s.st='lie';g.rotation.y=s.r0}else{s.st='dive';s.t=0}continue}
      savTurn(g,Math.atan2(ex,ez),8,dt);g.position.x+=ex/L*sp*dt;g.position.z+=ez/L*sp*dt;const hop=Math.abs(Math.sin(tm*(out?6:13)+s.ph));g.position.y=H(g.position.x,g.position.z)+hop*.05;   // the caterpillar hump of a seal in a hurry
      g.rotation.x=-hop*.18;U.head.rotation.x=-.3;U.head.rotation.y=0;U.flip.forEach((f,i)=>f.rotation.z=(i?-1:1)*hop*.7);U.tail.rotation.x=hop*.6}
    else if(s.st==='dive'){s.t+=dt;g.rotation.x=Math.min(1.3,s.t*4);g.position.set(s.hx,gy-s.t*1.3,s.hz);if(s.t>.7){s.st='under';s.t=3+Math.random()*4;g.position.y=gy-3}}
    else if(s.st==='under'){s.t-=dt;if(s.t<=0&&dh>7){s.st='peek';s.t=2.5+Math.random()*3;g.rotation.x=-1.25}}
    else if(s.st==='peek'){s.t-=dt;g.position.set(s.hx,gy-.33+.03*Math.sin(tm*2+s.ph),s.hz);g.rotation.x=-1.25;savTurn(g,Math.atan2(cx-s.hx,cz-s.hz),2,dt);U.head.rotation.x=.9;U.head.rotation.y=Math.sin(tm*1.3+s.ph)*.4;   // only the head above the water, looking for the car
      if(play&&dh<4.4){s.st='under';s.t=3+Math.random()*3;g.position.y=gy-3}else if(s.t<=0){s.st='out';g.rotation.x=0}}}
  // walruses: asleep in a heap; near the car one lifts its head and grunts, and it does not move for anybody
  for(const w of POL.walruses){const g=w.g,ex=cx-g.position.x,ez=cz-g.position.z,d=Math.hypot(ex,ez),near=play&&d<4;w.up+=((near?1:0)-w.up)*Math.min(1,dt*3);
    g.userData.head.rotation.x=.25-w.up*.6+.04*Math.sin(tm*.8+w.ph);g.userData.head.rotation.y=Math.sin(tm*(near?2.2:.3)+w.ph)*(near?.35:.12);
    if(near&&POL.gruntT<=0){POL.gruntT=6;polGrunt(g.position.x,g.position.z)}
    if(play&&d<1.05&&d>1e-3){car.vel.x+=ex/d*2.2*dt*20;car.vel.z+=ez/d*2.2*dt*20;if(POL.gruntT<5){POL.gruntT=6;polGrunt(g.position.x,g.position.z);toast('🦭 Hvalrossen flytter seg ikke')}}}
  // sled dogs: they follow the car with their heads, and the tails go faster the nearer it comes
  for(const o of POL.dogs){const g=o.g,U=g.userData,ex=cx-g.position.x,ez=cz-g.position.z,d=Math.hypot(ex,ez),near=d<9;let a=near?Math.atan2(ex,ez)-o.r0:Math.sin(tm*.4+o.ph)*.5;a=Math.atan2(Math.sin(a),Math.cos(a));
    U.head.rotation.y+=(Math.max(-1.2,Math.min(1.2,a))-U.head.rotation.y)*Math.min(1,dt*5);U.head.rotation.z=near?Math.sin(tm*1.1+o.ph)*.12:0;U.tail.rotation.y=Math.sin(tm*(near?14:3)+o.ph)*(near?.5:.15);
    U.tongue.visible=near;g.position.y=H(g.position.x,g.position.z)+(d<3.5?Math.abs(Math.sin(tm*7+o.ph))*.05:0)}}
