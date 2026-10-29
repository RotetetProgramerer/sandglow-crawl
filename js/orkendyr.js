'use strict';
/* =================================================================
   DESERT ANIMALS (Kameløya): the camels that move, and the caravan.
   Camels graze in small herds by the oasis and the camp and amble away from the car (they use updateGrazers in js/animals.js).
   The caravan: a Bedouin on foot leads a string of loaded camels, roped together, round a loop of the island (with a rider on
   one of them). Stop in front of them and they wait, and the leading camel grumbles; bump into one and the car is nudged
   aside. Nothing here costs anything: the camels are only for company.
   A level turns this on with  animals:{camels:[{at,r,n}], caravan:{path:[[x,z],…], n, speed}}.
   Loaded after js/animals.js; buildAnimals and updateAnimals call in here.
   ================================================================= */
const ORK={all:[],cv:null,grumbleT:0,bumpT:0};

/* ---------- the meshes (they face +z) ---------- */
// a part between two points in the y–z plane of a group: an ellipsoid along the segment
function orkSeg(g,mat,a,b,r){const dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dy,dz);apart(g,ANIMAL_GEO.sph,mat,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,r,l/2+r*.4,r,Math.atan2(dz,dy))}
function makeCamel(o={}){const g=new THREE.Group(),fur=amat(o.col||'#c69a5c'),lt=amat(o.lt||'#e0c08a'),dk=amat(o.dk||'#8a6438');
  apart(g,ANIMAL_GEO.sph,fur,0,.98,0,.25,.26,.46);apart(g,ANIMAL_GEO.sph,lt,0,.86,.02,.18,.16,.36);   // the body and the light belly
  apart(g,ANIMAL_GEO.sph,fur,0,1.2,-.02,.19,.17,.2);apart(g,ANIMAL_GEO.sph,dk,0,1.3,-.02,.12,.08,.13);   // the hump
  const legs=[];for(const[x,z]of[[-.12,.3],[.12,.3],[-.12,-.3],[.12,-.3]]){const l=new THREE.Group();l.position.set(x,.92,z);apart(l,ANIMAL_GEO.cylTop,fur,0,0,0,.05,.48,.05);apart(l,ANIMAL_GEO.sph,dk,0,-.48,0,.05);
    apart(l,ANIMAL_GEO.cylTop,fur,0,-.48,0,.038,.42,.038);apart(l,ANIMAL_GEO.sph,dk,0,-.9,.02,.06,.025,.07);g.add(l);legs.push(l)}
  // the neck and head swing together from the shoulders (a grazing camel lowers them)
  const head=new THREE.Group();head.position.set(0,1.02,.38);g.add(head);
  const N=[[0,0,0],[0,-.12,.17],[0,-.04,.32],[0,.18,.4]];for(let i=0;i<3;i++)orkSeg(head,fur,N[i],N[i+1],.085-.012*i);
  apart(head,ANIMAL_GEO.sph,fur,0,.25,.47,.065,.07,.12,-.25);apart(head,ANIMAL_GEO.sph,lt,0,.21,.58,.05,.05,.06);   // the head and the soft lips
  for(const sd of[-1,1]){apart(head,ANIMAL_GEO.sph,amat('#1a1410',{roughness:.3}),sd*.055,.3,.49,.014);apart(head,ANIMAL_GEO.cone,dk,sd*.04,.34,.4,.018,.05,.018,-.4)}
  const tail=new THREE.Group();tail.position.set(0,1.02,-.45);apart(tail,ANIMAL_GEO.cylTop,dk,0,0,0,.02,.32,.02);apart(tail,ANIMAL_GEO.sph,dk,0,-.34,0,.03,.06,.03);tail.rotation.x=.2;g.add(tail);
  if(o.load){const rug=amat(o.rug||'#b8342a');apart(g,ANIMAL_GEO.sph,rug,0,1.22,-.02,.27,.13,.3);apart(g,ANIMAL_GEO.box,amat('#e8dcc0'),0,1.33,-.02,.3,.03,.04);
    for(const sd of[-1,1]){apart(g,ANIMAL_GEO.sph,amat(sd>0?'#8a6a3e':'#a07a48'),sd*.3,.98,-.04,.12,.17,.13);apart(g,ANIMAL_GEO.cylTop,amat('#d8c597'),sd*.22,1.22,-.04,.012,.2,.012,0,0,sd*.6)}}
  if(o.rider){const robe=amat(o.rider),skin=amat('#9a6a44');apart(g,ANIMAL_GEO.sph,robe,0,1.5,.08,.09,.17,.08);apart(g,ANIMAL_GEO.sph,skin,0,1.73,.1,.05,.06,.05);apart(g,ANIMAL_GEO.sph,amat('#f4f2ec'),0,1.76,.09,.058,.05,.058);
    for(const sd of[-1,1])apart(g,ANIMAL_GEO.sph,robe,sd*.15,1.32,.12,.04,.12,.05,0,0,sd*.5)}
  Object.assign(g.userData,{legs,head,tail});return g}
// a Bedouin on foot: a long robe, the headscarf, arms and feet that swing as he walks
function makeWalker(col){const g=new THREE.Group(),robe=amat(col||'#f2efe6'),skin=amat('#9a6a44'),scarf=amat('#f4f2ec');
  apart(g,ANIMAL_GEO.sph,robe,0,.38,0,.11,.36,.1);apart(g,ANIMAL_GEO.sph,robe,0,.66,0,.1,.14,.08);
  const head=new THREE.Group();head.position.set(0,.84,0);apart(head,ANIMAL_GEO.sph,skin,0,0,.01,.055,.065,.055);apart(head,ANIMAL_GEO.sph,scarf,0,.03,-.01,.064,.06,.064);
  apart(head,ANIMAL_GEO.sph,scarf,0,-.06,-.05,.06,.08,.03);apart(head,ANIMAL_GEO.cyl,amat('#141210'),0,.06,0,.06,.012,.06);apart(head,ANIMAL_GEO.sph,amat('#2a2420'),0,-.05,.04,.03,.03,.02);g.add(head);
  const arms=[],legs=[];for(const sd of[-1,1]){const a=new THREE.Group();a.position.set(sd*.1,.74,0);apart(a,ANIMAL_GEO.cylTop,robe,0,0,0,.03,.3,.03);apart(a,ANIMAL_GEO.sph,skin,0,-.31,0,.025);g.add(a);arms.push(a);
    const l=new THREE.Group();l.position.set(sd*.05,.12,0);apart(l,ANIMAL_GEO.sph,amat('#5a4030'),0,-.1,.03,.035,.02,.06);g.add(l);legs.push(l)}
  Object.assign(g.userData,{head,arms,legs});return g}

/* ---------- build ---------- */
const ORK_COLS=[['#c69a5c','#e0c08a','#8a6438'],['#b0824a','#d4b07a','#7a5430'],['#d8b27a','#ecd4a6','#9a7448'],['#9a6a3a','#c09868','#6a4628']];
function buildDesert(lv,def,R){ORK.all=[];ORK.cv=null;const A=def.animals;if(!A)return;
  const land=(x,z)=>WL(x,z)<H(x,z)-.05&&lv.dist(x,z)>1.5;
  for(const o of(A.camels||[]))for(let i=0;i<(o.n||3);i++){let x,z,k=0;do{x=o.at[0]+(R()-.5)*o.r*2;z=o.at[1]+(R()-.5)*o.r*2;k++}while(!land(x,z)&&k<40);if(k>=40)continue;
    const c=ORK_COLS[Math.floor(R()*ORK_COLS.length)],g=savPrep(makeCamel({col:c[0],lt:c[1],dk:c[2]}));g.scale.setScalar(.85+R()*.25);g.position.set(x,H(x,z),z);g.rotation.y=R()*6.28;levelGroup.add(g);ORK.all.push(g);
    ANIMALS.deer.push({g,kind:'deer',hx:o.at[0],hz:o.at[1],hr:o.r,st:'graze',t:R()*4,ph:R()*6.28,sp:0,tx:x,tz:z,flee:3.2,speed:1.5})}
  const C=A.caravan;if(C&&C.path&&C.path.length>2){const P=C.path.map(p=>({x:p[0],z:p[1]}));P.push(P[0]);const cum=[0];for(let i=1;i<P.length;i++)cum.push(cum[i-1]+Math.hypot(P[i].x-P[i-1].x,P[i].z-P[i-1].z));
    const n=C.n||4,mem=[],rugs=['#b8342a','#2f5a9a','#d9a030','#3f7a3a','#7a3a8a'];
    const w=savPrep(makeWalker('#f2efe6'));levelGroup.add(w);ORK.all.push(w);mem.push({g:w,off:0,walker:true});
    for(let i=0;i<n;i++){const c=ORK_COLS[i%ORK_COLS.length],g=savPrep(makeCamel({col:c[0],lt:c[1],dk:c[2],load:true,rug:rugs[i%rugs.length],rider:i===1?'#3a4a6a':null}));levelGroup.add(g);ORK.all.push(g);mem.push({g,off:1.25+i*1.35})}
    // the ropes: from the Bedouin's hand to the first camel, and from each camel to the next
    const rm=amat('#d8c597'),ropes=[];for(let i=1;i<mem.length;i++){const r=new THREE.Mesh(ANIMAL_GEO.cyl,rm);levelGroup.add(r);ropes.push(r)}
    ORK.cv={P,cum,L:cum[cum.length-1],s:(R()*cum[cum.length-1]),speed:C.speed||.6,mem,ropes,wait:0}}}

/* ---------- sounds: the camel's grumble, a deep rolling bellow through the nose ---------- */
function orkGrumble(x,z){if(typeof initAmbience!=='function')return;initAmbience();const v=typeof ambVoice==='function'&&ambVoice(x,z,30);if(!v)return;try{const ac=AMB.ac,t=v.t,d=1.3,vol=.4*v.vol*(state.volAmb/70);
  const f=ac.createBiquadFilter();f.type='bandpass';f.frequency.value=420;f.Q.value=1.2;f.connect(v.g);const lfo=ac.createOscillator(),lg=ac.createGain();lfo.frequency.value=17;lg.gain.value=26;lfo.connect(lg);
  for(const k of[1,1.5]){const o=ac.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(95*k,t);o.frequency.linearRampToValueAtTime(130*k,t+d*.4);o.frequency.linearRampToValueAtTime(80*k,t+d);lg.connect(o.frequency);o.connect(f);o.start(t);o.stop(t+d+.05)}
  lfo.start(t);lfo.stop(t+d+.05);v.g.gain.setValueAtTime(0,t);v.g.gain.linearRampToValueAtTime(vol,t+.15);v.g.gain.setValueAtTime(vol,t+d*.6);v.g.gain.exponentialRampToValueAtTime(.0001,t+d)}catch(e){}}

/* ---------- update ---------- */
function orkAt(C,s,out){const L=C.L;s=((s%L)+L)%L;let i=1;while(i<C.cum.length-1&&C.cum[i]<s)i++;const a=C.P[i-1],b=C.P[i],u=(s-C.cum[i-1])/((C.cum[i]-C.cum[i-1])||1);
  out.x=a.x+(b.x-a.x)*u;out.z=a.z+(b.z-a.z)*u;out.a=Math.atan2(b.x-a.x,b.z-a.z);return out}
const _ok={x:0,z:0,a:0},_ok2={x:0,z:0,a:0},_ov=new THREE.Vector3();
function updateDesert(dt,tm){if(!ORK.all.length)return;
  for(const g of ORK.all){const dx=g.position.x-camera.position.x,dz=g.position.z-camera.position.z;g.visible=dx*dx+dz*dz<60*60}
  ORK.grumbleT-=dt;ORK.bumpT-=dt;const play=state.mode==='play';
  const C=ORK.cv;if(C){
    // does the car stand in the way of the leader? Then they all stop and wait
    const lead=orkAt(C,C.s,_ok),fx=Math.sin(lead.a),fz=Math.cos(lead.a),cx=car.pos.x-lead.x,cz=car.pos.z-lead.z,ahead=cx*fx+cz*fz,side=Math.abs(cx*fz-cz*fx);
    const blocked=play&&ahead>-.3&&ahead<2.6&&side<1.3;
    if(blocked){C.wait+=dt;if(C.wait>1.4&&ORK.grumbleT<=0){ORK.grumbleT=5;const c1=C.mem[1].g.position;orkGrumble(c1.x,c1.z);toast('🐪 Kamelene venter på at du flytter deg')}}else{C.wait=0;C.s+=C.speed*dt}
    const walk=!blocked;
    C.mem.forEach((m,i)=>{const p=orkAt(C,C.s-m.off,_ok),g=m.g;g.position.set(p.x,H(p.x,p.z),p.z);let dy=p.a-g.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));g.rotation.y+=dy*Math.min(1,dt*4);
      const U=g.userData,ph=(C.s-m.off)*(m.walker?7:4.2);
      if(m.walker){U.legs.forEach((l,k)=>l.position.z=walk?Math.sin(ph+k*Math.PI)*.07:0);U.arms[0].rotation.x=walk?Math.sin(ph)*.4:0;U.arms[1].rotation.x=walk?-.9:-.6;U.head.rotation.y=blocked?Math.sin(tm*1.5)*.5:0}
      else{U.legs.forEach((l,k)=>l.rotation.x=walk?Math.sin(ph+(k%2?Math.PI:0)+(k>1?Math.PI/2:0))*.4:0);U.head.rotation.x=walk?Math.sin(ph*2)*.05:(i===1&&blocked?-.25+Math.sin(tm*3)*.05:.1);U.tail.rotation.z=Math.sin(tm*1.7+i)*.3}
      // bump into one and the car is nudged aside (no cost)
      if(play){const ex=car.pos.x-g.position.x,ez=car.pos.z-g.position.z,d=Math.hypot(ex,ez);if(d<.75&&d>1e-3){car.vel.x+=ex/d*2.2*dt*20;car.vel.z+=ez/d*2.2*dt*20;if(ORK.bumpT<=0){ORK.bumpT=4;if(!m.walker)orkGrumble(g.position.x,g.position.z);toast(m.walker?'Beduinen hopper til side!':'🐪 Bøff! Pass på kamelene')}}}});
    // the ropes: from the hand (or the tail of the camel in front) to the next camel's nose
    C.ropes.forEach((r,i)=>{const a=C.mem[i].g,b=C.mem[i+1].g,ha=a.rotation.y,hb=b.rotation.y;
      const ax=a.position.x+Math.sin(ha)*(i?-.5:.1)+Math.cos(ha)*(i?0:.12),ay=a.position.y+(i?.95:.45),az=a.position.z+Math.cos(ha)*(i?-.5:.1)-Math.sin(ha)*(i?0:.12),bx=b.position.x+Math.sin(hb)*.95,by=b.position.y+1.15,bz=b.position.z+Math.cos(hb)*.95;
      _ov.set(bx-ax,by-ay,bz-az);const l=_ov.length();r.position.set((ax+bx)/2,(ay+by)/2-.08,(az+bz)/2);r.scale.set(.008,l,.008);r.quaternion.setFromUnitVectors(YAX,_ov.normalize());r.visible=a.visible})}}
