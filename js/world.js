'use strict';
/* =================================================================
   OPEN WORLD: free driving, start portals and courses, roaming between islands, the ferry, golden nuts and the real winch.
   Loaded after game.js; uses its globals (state, car, LV, scene, levelGroup, toast …) at run time.
   ================================================================= */
/* ---------- open world: free driving, start portals, courses ---------- */
// a world (def.world) has no gates of its own: LV.gates/LV.crates are swapped in when a course starts, so all the race code works unchanged
let portals=[],courseArrows=null,countT=0,gateWake=null,nightOn=false,cpT=0;
const coursesDone=()=>LV.courses.filter(k=>best[courseKey(LEVELS[state.levelIdx],k)]).length;
const DIFFCOL=['#8bbb4a','#8bbb4a','#f2c230','#d9432f'];
function startFree(){state.mode='play';state.free=true;state.course=null;resetRunState();LV.gates=[];LV.crates=[];buildGates(LV);buildCrates(LV);
  resetToStart();car.low=true;clearTracks();showHud();updateGearUI();state.checkpoint={x:car.pos.x,z:car.pos.z,h:Math.atan2(car.fw.x,car.fw.z)};toast('Fri kjøring: kjør bort til en startstrek')}
// the start of every course: two flag poles, tyre barriers, a string of festival lights and a sign
function portalSign(k){const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d');x.fillStyle='#f2e8d0';x.fillRect(0,0,256,128);x.fillStyle=DIFFCOL[k.diff];x.fillRect(0,0,256,22);
  x.strokeStyle='#14120E';x.lineWidth=6;x.strokeRect(3,3,250,122);x.fillStyle='#14120E';x.textAlign='center';x.font='700 40px "Barlow Condensed",sans-serif';x.fillText(k.name,128,72);
  x.font='600 22px "Barlow Condensed",sans-serif';x.fillText(['','Lett','Middels','Vanskelig'][k.diff]+' · '+k.gates.length+' porter',128,106);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t}
function buildPortals(lv){portals=[];if(!lv.courses||!lv.courses.length)return;
  for(const k of lv.courses){const g=new THREE.Group(),p=k.start.p,tn=k.start.tan,s=new V3(tn.z,0,-tn.x),col=DIFFCOL[k.diff];
    const tops=[];
    for(const sd of[-1,1]){const x=p.x+s.x*sd*1.7,z=p.z+s.z*sd*1.7,y=H(x,z);const pole=new THREE.Mesh(boxGeo,postMat);pole.scale.set(.08,2.1,.08);pole.position.set(x,y+1.05,z);pole.castShadow=true;g.add(pole);
      const fm=new THREE.MeshStandardMaterial({color:LIN(col),side:THREE.DoubleSide,roughness:.6}),fl=new THREE.Mesh(flagGeo,fm);fl.scale.setScalar(1.6);fl.position.set(x,y+2.05,z);fl.rotation.y=Math.atan2(tn.x,tn.z)+Math.PI/2*sd;g.add(fl);tops.push({x,y:y+2.0,z});
      for(let i=0;i<3;i++){const tx=x+s.x*sd*(.45+i*.42),tz=z+s.z*sd*(.45+i*.42);const ty=new THREE.Mesh(cylGeo,M.tire);ty.scale.set(.24,.17,.24);ty.position.set(tx,H(tx,tz)+.085,tz);ty.castShadow=true;g.add(ty)}}
    // lights between the pole tops
    for(let i=1;i<10;i++){const u=i/10,sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:LIN(['#ffd36a','#ff6a2a','#8bbb4a','#5ab4ff'][i%4]),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
      sp.position.set(tops[0].x+(tops[1].x-tops[0].x)*u,tops[0].y+(tops[1].y-tops[0].y)*u-.35*4*u*(1-u),tops[0].z+(tops[1].z-tops[0].z)*u);sp.scale.set(.32,.32,1);g.add(sp)}
    const wire=new THREE.Mesh(cylGeo,postMat);wire.scale.set(.012,3.4,.012);wire.position.set(p.x,tops[0].y-.1,p.z);wire.quaternion.setFromUnitVectors(YAX,new V3(s.x,0,s.z));g.add(wire);
    // a chalk start line and the sign beside it, facing the approaching car
    const line=new THREE.Mesh(new THREE.PlaneGeometry(3.2,.18),new THREE.MeshBasicMaterial({color:0xf2e8d0,transparent:true,opacity:.8,polygonOffset:true,polygonOffsetFactor:-2}));line.rotation.x=-Math.PI/2;line.rotation.z=Math.atan2(tn.x,tn.z);line.position.set(p.x,H(p.x,p.z)+.02,p.z);g.add(line);
    const sx=p.x+s.x*2.6-tn.x*1.2,sz=p.z+s.z*2.6-tn.z*1.2,sy=H(sx,sz);const post=new THREE.Mesh(boxGeo,postMat);post.scale.set(.06,1.2,.06);post.position.set(sx,sy+.6,sz);g.add(post);
    const b=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.6),new THREE.MeshBasicMaterial({map:portalSign(k),side:THREE.DoubleSide}));b.position.set(sx,sy+1.25,sz);b.rotation.y=Math.atan2(-tn.x,-tn.z);g.add(b);
    levelGroup.add(g);portals.push({k,g,x:p.x,z:p.z,lights:g.children.filter(o=>o.isSprite)})}}
function nearestPortal(){let b=null;for(const p of portals){const d=Math.hypot(p.x-car.pos.x,p.z-car.pos.z);if(!b||d<b.d)b={k:p.k,d}}return b}
function openAsk(k){state.mode='ask';state.askK=k;$('aList').hidden=true;$('aYes').hidden=false;
  if(typeof k==='string'&&k.startsWith('ski')){skiAsk(k);return}   // Gautefall: the ski trip (js/ski.js)
  if(typeof k==='string'&&k.startsWith('boat')){boatAsk(k);return}
  if(k==='fly'){flyAsk(k);return}   // Trinnvik: a flight from the airport (js/plane.js)   // Tromøya: the boat race from the marina (js/boat.js)
  if(k==='ferry'){const here=LEVELS[state.levelIdx];$('aName').textContent='Fergen';$('aKind').textContent='Kaia på '+here.name;$('aDesc').textContent='Hvor vil du reise? Overfarten koster 5 muttere. Du har '+fmtN(prof.nuts)+'.';$('aBest').textContent='';$('aQ').textContent='';
    const dests=ROUTES.filter(r=>r.includes(here.id)).map(r=>r[0]===here.id?r[1]:r[0]).map(id=>LEVELS.find(l=>l.id===id)).filter(Boolean);
    $('aList').innerHTML=dests.map(l=>`<button data-dest="${l.id}"><span><span class="nm">${l.name}</span><span class="sub">${l.desc}</span></span><span class="pr">5 ⚙</span></button>`).join('');$('aList').hidden=false;$('aYes').hidden=true;$('aNo').textContent='Bli her';$('ask').hidden=false;return}
  $('aQ').textContent='Vil du starte denne utfordringen?';$('aNo').textContent='NEI, kjør videre';
  if(k==='garage'){$('aName').textContent='Verkstedet';$('aKind').textContent='Basen';$('aDesc').textContent='Mekanikerne står klare. Her bruker du mutterne på dekk, fjæring, motor, vekt, utstyr og lakk.';$('aBest').textContent='Du har '+fmtN(prof.nuts)+' muttere.';$('ask').hidden=false;$('aYes').focus();return}
  const key=courseKey(LEVELS[state.levelIdx],k),b=best[key];
  $('aName').textContent=k.name;$('aDesc').textContent=k.desc;$('aKind').textContent=['','Lett løype','Middels løype','Vanskelig løype'][k.diff]+' · '+k.gates.length+' porter';
  $('aBest').textContent=b?'Din beste: '+fmtTime(b.t)+' med '+b.p+' straffepoeng, '+b.s+' av 3 stjerner.':'Ikke kjørt ennå. Første gang i mål gir banebonus.';
  $('ask').hidden=false;$('aYes').focus()}
// the start banner: shown while the car is near a start portal. The game goes on; Enter or START begins the course.
function setOffer(k){if(state.offerK===k)return;state.offerK=k;const el=$('offer');if(!k){el.hidden=true;return}
  const b=best[courseKey(LEVELS[state.levelIdx],k)];
  $('oKind').textContent=['','Lett løype','Middels løype','Vanskelig løype'][k.diff]+' · '+k.gates.length+' porter';$('oName').textContent=k.name;
  $('oBest').textContent=b?'Din beste: '+fmtTime(b.t):'Ikke kjørt ennå';$('oGo').firstChild.textContent='START ';el.hidden=false}
function acceptOffer(){const k=state.offerK;if(!k||state.mode!=='play'||state.course)return;setOffer(null);startCourse(k)}
function answerAsk(yes){if(state.mode!=='ask')return;$('ask').hidden=true;const k=state.askK;state.askK=null;
  if(typeof k==='string'&&k.startsWith('ski')){skiAnswer(k,yes);return}
  if(typeof k==='string'&&k.startsWith('boat')){boatAnswer(k,yes);return}
  if(k==='fly'){flyAnswer(k,yes);return}
  if(k==='garage'){state.askCool='garage';if(yes){state.mode='play';toGarage()}else{state.mode='play';toast('Kjør videre når du vil')}return}
  if(k==='ferry'){state.askCool='ferry';state.mode='play';if(yes&&yes.dest)startFerry(yes.dest);return}
  if(yes)startCourse(k);else{state.mode='play';state.askCool=k.id;toast('Kjør videre når du vil')}}
function startCourse(k){setOffer(null);placeCar(car,k.start.p.x,k.start.p.z,Math.atan2(k.start.tan.x,k.start.tan.z));camSnap=true;state.course=k;state.free=false;resetRunState();LV.gates=k.gates;LV.crates=k.crates;buildGates(LV);buildCrates(LV);resetCrates();
  gateVis.forEach((g,i)=>{g.touched=false;setGateState(i,'pending')});gateWake={i:0,t:0};buildCourseArrows(k);
  if(k.def.night)setNight(true);
  state.checkpoint={x:k.start.p.x,z:k.start.p.z,h:Math.atan2(k.start.tan.x,k.start.tan.z)};
  $('hud').classList.remove('free');$('hLevel').textContent=k.name;$('hGate').textContent='0/'+k.gates.length;$('hTime').textContent='0:00.0';$('hPen').textContent='0';$('hCrate').textContent='0/'+k.crates.length;toastT=0;$('toast').classList.remove('on');state.mode='count';countT=1.4;car.throttle=0;car.vel.set(0,0,0)}
function endCourse(silent){const k=state.course;state.course=null;state.free=true;LV.gates=[];LV.crates=[];buildGates(LV);buildCrates(LV);
  if(courseArrows){levelGroup.remove(courseArrows);courseArrows.geometry.dispose();courseArrows=null}gateWake=null;setNight(false);
  $('hud').classList.add('free');$('hLevel').textContent=LEVELS[state.levelIdx].name;$('count').hidden=true;if(k)state.askCool=k.id;resetRunState();
  state.checkpoint={x:car.pos.x,z:car.pos.z,h:Math.atan2(car.fw.x,car.fw.z)}}
// the gates light up one after another, then the countdown runs
function updateCountdown(dt){countT-=dt;const el=$('count');
  if(gateWake){gateWake.t-=dt;if(gateWake.t<=0&&gateWake.i<gateVis.length){const i=gateWake.i++;gateVis[i].mats.forEach(m=>m.color.set(FLAG.next).convertSRGBToLinear());setTimeout(()=>{if(gateVis[i]&&gateVis[i].state==='pending')gateVis[i].mats.forEach(m=>m.color.set(FLAG.pending).convertSRGBToLinear())},260);gateWake.t=Math.min(.16,1.2/gateVis.length)}}
  if(countT<=0){state.mode='play';gateWake=null;setGateState(0,'next');el.hidden=false;el.textContent='Kjør!';clearTimeout(el._t);el._t=setTimeout(()=>{el.hidden=true},1100)}}
// chevrons on the ground along the course
function buildCourseArrows(k){const L=[];for(let d=1.2;d<k.curve.getLength();d+=1.6){const t=d/k.curve.getLength(),p=k.P(t),tn=k.T(t);if(k.nearGate(p.x,p.z,1.0))continue;L.push({x:p.x,y:H(p.x,p.z)+.05,z:p.z,ry:Math.atan2(tn.x,tn.z)})}
  const geo=new THREE.ConeGeometry(.16,.4,3);geo.rotateX(Math.PI/2);const im=new THREE.InstancedMesh(geo,new THREE.MeshBasicMaterial({color:LIN('#ff6a2a'),transparent:true,opacity:.75,depthWrite:false}),L.length),m4=new THREE.Matrix4(),q=new Q4(),p=new V3(),sc=new V3(1,.25,1);
  L.forEach((o,i)=>{p.set(o.x,o.y,o.z);q.setFromAxisAngle(YAX,o.ry);m4.compose(p,q,sc);im.setMatrixAt(i,m4)});im.frustumCulled=false;im.renderOrder=1;levelGroup.add(im);courseArrows=im}
// night: the lights go down and the car's lamps come on
function setNight(on){if(on===nightOn)return;nightOn=on;const def=LEVELS[state.levelIdx];
  skyDome.material.color.set(on?0x2a3350:0xffffff);sunGlow.visible=!on&&def.clouds!==false;if(on)setLights(true);if(lampGlow)lampGlow.visible=on;
  if(!on){scene.fog.color.set(LIN(def.fog));scene.fog.near=def.fogNear;scene.fog.far=def.fogFar;sun.intensity=def.sunI*1.55;hemi.intensity=def.hemi[2]*1.15;hemi.color.set(def.hemi[0]).convertSRGBToLinear();sun.color.set(def.sun).convertSRGBToLinear()}}
function nightTint(){if(!nightOn)return;scene.fog.color.multiplyScalar(.22);scene.fog.near=Math.min(scene.fog.near,8);scene.fog.far=Math.min(scene.fog.far,38);sun.intensity*=.12;sun.color.set(0x8fa6ff).convertSRGBToLinear();hemi.intensity*=.3;hemi.color.set(0x7a8ab0).convertSRGBToLinear()}
function updateWorld(dt){
  // free driving: a rolling checkpoint for the winch, and the start portals
  if(!state.course){cpT-=dt;if(cpT<=0&&car.up.y>.9&&car.wheels.every(w=>w.contact)&&car.depth<0){cpT=1.5;state.checkpoint={x:car.pos.x,z:car.pos.z,h:Math.atan2(car.fw.x,car.fw.z)}}
    {const n=nearestPortal();setOffer(n&&n.d<4?n.k:null)}   // a start portal: offer the course, but keep driving
    if(LV.ferry&&onFerryDeck()&&state.askCool!=='ferry'){openAsk('ferry');return}if(LV.ferry&&!onFerryDeck()&&state.askCool==='ferry')state.askCool=null;
    const sa=LEVELS[state.levelIdx].skiAt;if(sa&&LV.liftDef){const d=Math.hypot(sa[0]-car.pos.x,sa[1]-car.pos.z);if(d<1.6&&state.askCool!=='ski'){openAsk('ski');return}if(d>3.5&&state.askCool==='ski')state.askCool=null}   // Gautefall: park on the blue square to go skiing
    const mb=LV.marinaDef;if(mb){const d=Math.hypot(mb.ask.x-car.pos.x,mb.ask.z-car.pos.z);if(d<1.6&&state.askCool!=='boat'){openAsk('boat');return}if(d>3.5&&state.askCool==='boat')state.askCool=null}
    const ap=LV.airportDef;if(ap){const d=Math.hypot(ap.ask.x-car.pos.x,ap.ask.z-car.pos.z);if(d<1.6&&state.askCool!=='fly'){openAsk('fly');return}if(d>3.5&&state.askCool==='fly')state.askCool=null}   // the airport: park on the blue square to fly   // the marina: park on the blue square to take a boat out
    const cd=LV.caveDef;if(cd){const d=Math.hypot(cd.mouth.x-car.pos.x,cd.mouth.z-car.pos.z);if(d<cd.r&&state.askCool!=='cave'){caveEnter();return}if(d>cd.r+3&&state.askCool==='cave')state.askCool=null}   // Kameløya: drive into the cave mouth and the view turns to the side (js/grotte.js)
    const ga=LEVELS[state.levelIdx].garageAt;if(ga){const d=Math.hypot(ga[0]-car.pos.x,ga[1]-car.pos.z);if(d<2.4&&state.askCool!=='garage'){openAsk('garage');return}if(d>4.5&&state.askCool==='garage')state.askCool=null}}
  else{setOffer(null);const ng=LV.gates[state.next];if(ng&&Math.hypot(ng.c.x-car.pos.x,ng.c.z-car.pos.z)>30){endCourse();toast('For langt fra løypa: løpet er avbrutt',true)}}
  const tm=performance.now()*.001;for(const p of portals){if(Math.abs(p.x-car.pos.x)+Math.abs(p.z-car.pos.z)>40)continue;p.lights.forEach((l,i)=>l.material.opacity=.6+.4*Math.sin(tm*5+i*1.3))}
  updateBreakables(dt)}
// cacti and the like: hit one and it tips over away from the car, then you drive on
const falling=[],_bm=new THREE.Matrix4(),_bq=new Q4(),_bp=new V3(),_bs=new V3(),_bt=new THREE.Matrix4();
function updateBreakables(dt){if(!LV.breakables||!LV.propCyls)return;
  for(const b of LV.breakables){if(b.broken)continue;const dx=car.pos.x-b.x,dz=car.pos.z-b.z,d=Math.hypot(dx,dz);if(d>b.r+.7||car.vel.lengthSq()<.2)continue;
    b.broken=true;const i=G.colliders.indexOf(b.col);if(i>=0)G.colliders.splice(i,1);const vx=car.vel.x,vz=car.vel.z,vl=Math.hypot(vx,vz)||1;falling.push({b,t:0,ax:vz/vl,az:-vx/vl,y0:H(b.x,b.z)});toast('Knekk!');for(let k=0;k<8;k++)spawnDust(_bp.set(b.x,b.y0,b.z),3,true)}
  for(let i=falling.length-1;i>=0;i--){const f=falling[i];f.t+=dt;const a=Math.min(1.5,f.t*f.t*5);
    for(const id of f.b.ids){const o=LV.cylList[id];_bp.set(o.x,o.y,o.z);_bq.setFromEuler(new THREE.Euler(o.rx||0,o.ry||0,o.rz||0));_bs.set(o.sx,o.sy??o.sx,o.sz??o.sx);_bm.compose(_bp,_bq,_bs);
      _bq.setFromAxisAngle(_bs.set(f.ax,0,f.az).normalize(),a);_bt.makeRotationFromQuaternion(_bq);_bt.setPosition(f.b.x,f.y0,f.b.z);_bt.multiply(new THREE.Matrix4().makeTranslation(-f.b.x,-f.y0,-f.b.z));_bm.premultiply(_bt);LV.propCyls.setMatrixAt(id,_bm)}
    LV.propCyls.instanceMatrix.needsUpdate=true;if(a>=1.5)falling.splice(i,1)}}

/* ---------- roaming the archipelago ---------- */
// «Kjør!» in the menu: free driving, starting on Tromøya or wherever you last were
let roamSaveT=0;
function startRoam(){state.roam=true;const sv=store.get('roam',null);let i=LEVELS.findIndex(l=>l.id===(sv&&sv.id));if(i<0||!isIsland(LEVELS[i]))i=LEVELS.findIndex(l=>l.world&&l.basePos);if(i<0)i=LEVELS.findIndex(l=>l.world);if(i<0)i=0;   // new players start on Tromøya, the island with the base
  if(i!==state.levelIdx||!state.world)loadLevel(i);startFree();
  if(!store.get('helpSeen',false)){state.mode='ask';$('help').hidden=false;$('helpOk').onclick=()=>{$('help').hidden=true;state.mode='play';store.set('helpSeen',true)};$('helpOk').focus()}
  if(sv&&sv.id===LEVELS[i].id&&isFinite(sv.x)){placeCar(car,sv.x,sv.z,sv.h||0);camSnap=true;state.checkpoint={x:sv.x,z:sv.z,h:sv.h||0}}}
function saveRoam(dt){if(!state.roam||!state.free||state.course)return;roamSaveT-=dt;if(roamSaveT>0)return;roamSaveT=3;if(car.up.y>.9&&car.depth<0)store.set('roam',{id:LEVELS[state.levelIdx].id,x:+car.pos.x.toFixed(2),z:+car.pos.z.toFixed(2),h:+Math.atan2(car.fw.x,car.fw.z).toFixed(3)})}
// the ferry: hull, bulwarks, wheelhouse and funnel around the drivable deck the level made
let ferryVis=null,ferryDeckMesh=null;
function buildFerry(lv){ferryVis=null;const f=lv.ferry;if(!f){ferryDeckMesh=null;return}const g=new THREE.Group(),yaw=Math.atan2(f.dx,f.dz);g.position.set(f.x,f.y,f.z);g.rotation.y=yaw;
  if(ferryDeckMesh){g.attach(ferryDeckMesh);ferryDeckMesh=null}   // the plank deck built with the level comes along
  const hull=new THREE.MeshStandardMaterial({color:LIN('#3f5f78'),roughness:.6}),white=new THREE.MeshStandardMaterial({color:LIN('#eef0ea'),roughness:.5}),red=new THREE.MeshStandardMaterial({color:LIN('#c8463a'),roughness:.6});
  const B=(w,h,d,mat,x,y,z)=>{const m=new THREE.Mesh(boxGeo,mat);m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m};
  B(4.6,1.4,f.len+.9,hull,0,-.75,0);B(4.8,.06,f.len+1.1,white,0,-.08,0);   // hull (reaches 0,5 under the water, so it never lifts clear when it bobs) and gunwale line
  for(const sd of[-1,1])B(.5,.42,f.len-.2,white,sd*2.05,.17,0);                                           // bulwarks beside the deck
  B(.5,.42,3.4,white,0,.17,f.len/2+.2);                                                                  // stern wall (sea end)
  B(1.3,1.25,1.5,white,1.65,.8,f.len/2-1.5);B(1.1,.45,1.1,new THREE.MeshStandardMaterial({color:LIN('#1a262d'),roughness:.1,metalness:.6}),1.65,1.1,f.len/2-1.5);   // wheelhouse
  const fun=new THREE.Mesh(cylGeo,red);fun.scale.set(.22,.9,.22);fun.position.set(1.65,1.85,f.len/2-.6);g.add(fun);const fb=new THREE.Mesh(cylGeo,white);fb.scale.set(.24,.12,.24);fb.position.set(1.65,2.3,f.len/2-.6);g.add(fb);
  const mast=new THREE.Mesh(cylGeo,white);mast.scale.set(.05,2.2,.05);mast.position.set(-1.9,1.1,f.len/2-1.2);g.add(mast);
  for(const z of[-1.5,1.5]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.2,.06,6,14),red);ring.position.set(2.32,.5,z);ring.rotation.y=Math.PI/2;g.add(ring)}
  B(3.2,.05,1.4,new THREE.MeshStandardMaterial({color:LIN('#5a5a58'),roughness:.9}),0,.01,-f.len/2-.3);      // ramp onto the pier (land end)
  levelGroup.add(g);ferryVis={g,f,yaw}}

/* ---------- the ferry trip ---------- */
// drive onto the deck, pick an island, and the ferry sails: out from this quay, a dark moment while the next island loads, in to its quay
let FT=null;
function onFerryDeck(){const f=LV.ferry;if(!f)return false;const rx=car.pos.x-f.x,rz=car.pos.z-f.z,along=rx*f.dx+rz*f.dz,lat=Math.abs(rx*f.dz-rz*f.dx);return Math.abs(along)<f.len/2-.3&&lat<f.hw-.15&&car.pos.y>f.y-.3}
function startFerry(destId){const di=LEVELS.findIndex(l=>l.id===destId);if(di<0||!ferryVis)return;if(prof.nuts<5){toast('Du trenger 5 muttere til fergen',true);return}
  prof.nuts-=5;saveProf();const g=ferryVis.g,f=LV.ferry;
  FT={t:0,dest:di,phase:'out',from:g.position.clone(),dx:f.dx,dz:f.dz,off:car.pos.clone().sub(g.position),q:car.q.clone(),faded:false,loaded:false,base:g.position.clone()};
  state.mode='ferry';car.vel.set(0,0,0);car.w.set(0,0,0);car.throttle=0;ambHorn(f.x,f.z);if(typeof netFerry==='function')netFerry('out');toast('Fergen går til '+LEVELS[di].name+' · −5 ⚙')}
function ferryPlace(g){const tm=performance.now()*.001;g.position.y=FT.base.y+.04*Math.sin(tm*1.3);g.rotation.z=.012*Math.sin(tm*.9);car.pos.copy(g.position).add(FT.off);car.q.copy(FT.q);
  // the physics is paused, so the wheels and axles must be carried along with the body by hand
  const up=_c1.set(0,1,0).applyQuaternion(car.q),trv=car.tune.travel;for(const w of car.wheels)w.center.copy(w.mount).applyQuaternion(car.q).add(car.pos).addScaledVector(up,-(trv-Math.min(w.comp,trv)))}
function updateFerry(dt){if(!FT)return;FT.t+=dt;const g=ferryVis&&ferryVis.g;
  if(FT.phase==='out'){const s=Math.min(1,FT.t/4.2),d=14*s*s;g.position.set(FT.from.x+FT.dx*d,FT.from.y,FT.from.z+FT.dz*d);FT.base.copy(g.position);ferryPlace(g);
    if(FT.t>3.0&&!FT.faded){FT.faded=true;$('fade').classList.add('on')}
    if(FT.t>4.2)ferryArrive()}
  else{const s=Math.min(1,FT.t/4.2),d=16*(1-s)*(1-s);g.position.set(FT.dock.x+FT.dx*d,FT.dock.y,FT.dock.z+FT.dz*d);FT.base.copy(g.position);ferryPlace(g);
    if(FT.t>.6&&FT.faded){FT.faded=false;$('fade').classList.remove('on')}
    if(FT.t>4.2){g.position.copy(FT.dock);g.rotation.z=0;car.pos.copy(FT.dock).add(FT.off);car.pos.y=LV.ferry.y+.5;car.q.copy(FT.q);car.vel.set(0,0,0);
      const f=LV.ferry;state.mode='play';state.free=true;state.askCool='ferry';state.checkpoint={x:f.pad.x,z:f.pad.z,h:Math.atan2(-f.dx,-f.dz)};FT=null;camSnap=true;roamSaveT=0;toast('Velkommen til '+LEVELS[state.levelIdx].name)}}}
// the dark moment: load the destination island and put the ferry (with the car on it) out at sea off its quay, pointing in
function ferryArrive(){const di=FT.dest;loadLevel(di);const f=LV.ferry,g=ferryVis.g;
  // the car keeps its place on the deck: same along/lateral offset, now in the new ferry's frame, heading towards land
  const along=FT.off.x*FT.dx+FT.off.z*FT.dz,lat=FT.off.x*FT.dz-FT.off.z*FT.dx;
  FT.dx=f.dx;FT.dz=f.dz;FT.off.set(f.dx*along+f.dz*lat,.5,f.dz*along-f.dx*lat);FT.q.setFromAxisAngle(YAX,Math.atan2(-f.dx,-f.dz));
  FT.dock=g.position.clone();FT.phase='in';FT.t=0;FT.loaded=true;g.position.set(FT.dock.x+f.dx*16,FT.dock.y,FT.dock.z+f.dz*16);FT.base=g.position.clone();ferryPlace(g);camSnap=true;
  $('hud').classList.add('free');$('hLevel').textContent=LEVELS[di].name;ambHorn(f.x,f.z);if(typeof netFerry==='function')netFerry('in')}
function skipFerry(){if(!FT)return;if(FT.phase==='out'){$('fade').classList.add('on');FT.faded=true;FT.t=4.21}else FT.t=4.21}

/* ---------- golden nuts: five hidden on every island ---------- */
// a level places them with c.secret(x,z,'label'). Found ones are remembered in prof.secrets[level/i]; all of them unlock the gold paint.
const SECRET_PER=5;
let secretVis=[],secretPingT=0;
const secretKey=(l,i)=>l.id+'/'+i;
const totalSecrets=()=>LEVELS.reduce((n,l)=>n+(l.village||l.world?SECRET_PER:0),0);
const foundSecrets=()=>Object.keys(prof.secrets).length;
const foundOn=l=>{let n=0;for(let i=0;i<SECRET_PER;i++)if(prof.secrets[secretKey(l,i)])n++;return n};
const nutGeo=new THREE.TorusGeometry(.26,.11,6,6),nutMat=new THREE.MeshStandardMaterial({color:LIN('#e6b43a'),emissive:LIN('#8a5a10'),roughness:.25,metalness:.8});
function buildSecrets(lv){secretVis=[];const l=LEVELS[state.levelIdx];if(!lv.secrets)return;
  lv.secrets.forEach((sc,i)=>{if(prof.secrets[secretKey(l,i)])return;const g=new THREE.Group();const m=new THREE.Mesh(nutGeo,nutMat);m.castShadow=true;g.add(m);
    const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:LIN('#ffd36a'),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.55}));gl.scale.set(1.8,1.8,1);g.add(gl);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.05,.09,5,8,1,true),new THREE.MeshBasicMaterial({color:LIN('#ffd36a'),transparent:true,opacity:.18,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));beam.position.y=2.4;g.add(beam);   // a faint shaft of light, visible from afar
    const y=Math.max(H(sc.x,sc.z),WL(sc.x,sc.z))+.45;g.position.set(sc.x,y,sc.z);levelGroup.add(g);secretVis.push({g,sc,i,y,taken:false})})}
function updateSecrets(dt){if(!secretVis.length||!car)return;const tm=performance.now()*.001,l=LEVELS[state.levelIdx];let nearest=1e9;
  for(const s of secretVis){if(s.taken)continue;const g=s.g;g.rotation.y=tm*1.6;g.position.y=s.y+.08*Math.sin(tm*2.4+s.i);const d=Math.hypot(s.sc.x-car.pos.x,s.sc.z-car.pos.z);nearest=Math.min(nearest,d);
    if(d<1.0&&Math.abs(g.position.y-car.pos.y)<1.3&&state.mode==='play'){s.taken=true;g.visible=false;prof.secrets[secretKey(l,s.i)]=1;prof.nuts+=25;
      const all=foundSecrets()>=totalSecrets();if(all){const gi=PAINTS.findIndex(p=>p.locked);if(gi>=0&&!prof.paints.includes(gi)){prof.paints.push(gi);prof.nuts+=100}}saveProf();
      for(let k=0;k<10;k++)spawnDust(g.position,99,true);ambChime(s.sc.x,s.sc.z);toast('Gullmutter '+foundOn(l)+'/'+SECRET_PER+' · '+s.sc.label+' · +25 ⚙'+(all?' · Alle funnet! Gull-lakk og +100 ⚙':''))}}
  // a faint chime when one is near: faster and louder the closer you are
  if(nearest<12&&state.mode==='play'){secretPingT-=dt;if(secretPingT<=0){secretPingT=.5+nearest*.12;ambPing(car.pos.x,car.pos.z,1-nearest/12)}}}

/* ---------- the real winch ---------- */
// Hold R: a line is shown from the front hook to the best anchor (tree, big rock, house, lamp, bridge post) within reach and roughly ahead.
// Release R: the rope tightens and pulls with a steady force until the car is next to the anchor, or you press R again.
const WINCH_REACH=7,WINCH_F=.55;   // reach in units, pull as a fraction of the car's weight
let WN={aim:false,target:null,active:false,line:null,hookRing:null,t:0,snd:null},winchBtnDown=false;
const hasWinch=()=>!!(car&&(car.cfg.winch||car.tune.realWinch));
// a box anchor (building, container, wall) is hooked at the point of its face nearest the car, so the rope can actually get there
function winchAnchors(){const L=[];for(const c of G.colliders)if(c.anchor){if(c.w!=null){const cs=Math.cos(c.ry||0),sn=Math.sin(c.ry||0),dx=car.pos.x-c.x,dz=car.pos.z-c.z,a=dx*cs-dz*sn,b=dx*sn+dz*cs,hw=c.w/2,hd=c.d/2,ca=a<-hw?-hw:a>hw?hw:a,cb=b<-hd?-hd:b>hd?hd:b;L.push({x:c.x+ca*cs+cb*sn,z:c.z-ca*sn+cb*cs,y:c.y})}else L.push(c)}for(const a of(G.anchors||[]))L.push(a);for(const d of G.decks){if(d.ferry)continue;const y=Math.max(d.y0,d.y1)+.6;L.push({x:d.ax,z:d.az,y},{x:d.bx,z:d.bz,y})}return L}
function winchHook(out){return out.set(0,.1,car.cfg.L/2).applyQuaternion(car.q).add(car.pos)}
function bestAnchor(){const hk=winchHook(_c1),fw=_c2.set(car.fw.x,0,car.fw.z).normalize();let best=null,bs=-1;
  for(const a of winchAnchors()){const dx=a.x-hk.x,dz=a.z-hk.z,d=Math.hypot(dx,dz);if(d<1.0||d>WINCH_REACH)continue;const cs=(dx*fw.x+dz*fw.z)/d;if(cs<.34)continue;   // within ~70° of straight ahead
    const sc=cs*2-d/WINCH_REACH;if(sc>bs){bs=sc;best=a}}return best}
function winchKey(down){if(state.mode!=='play'||!hasWinch())return;
  if(down){if(WN.active){stopWinch('Tauet er løsnet');return}WN.aim=true;winchBtnDown=true;return}
  if(!WN.aim)return;WN.aim=false;winchBtnDown=false;const a=WN.target;if(!a){toast('Ingen festepunkt innen rekkevidde',true);return}startWinch(a)}
function startWinch(a){WN.active=true;WN.target=a;WN.t=0;car.rope={x:a.x,y:a.y??H(a.x,a.z)+.4,z:a.z,F:WINCH_F*car.m*9.8};car.low=true;updateGearUI();toast('Vinsjen drar');ambWinch(true)}
function stopWinch(msg){WN.active=false;WN.target=null;car.rope=null;if(WN.line)WN.line.visible=false;if(WN.hookRing)WN.hookRing.visible=false;ambWinch(false);if(msg)toast(msg)}
function updateWinch(dt){if(!WN.line){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));WN.line=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xd8c597,linewidth:2}));WN.line.frustumCulled=false;WN.line.visible=false;scene.add(WN.line);
    WN.hookRing=new THREE.Mesh(new THREE.RingGeometry(.22,.3,24),new THREE.MeshBasicMaterial({color:LIN('#ff6a2a'),transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));WN.hookRing.rotation.x=-Math.PI/2;WN.hookRing.visible=false;scene.add(WN.hookRing)}
  if(!hasWinch()||state.mode!=='play'){if(WN.active)stopWinch();WN.aim=false;WN.line.visible=false;WN.hookRing.visible=false;return}
  if(WN.aim){WN.target=bestAnchor();const a=WN.target;WN.line.visible=!!a;WN.hookRing.visible=!!a;if(a){const hk=winchHook(_c1),ay=a.y??H(a.x,a.z)+.4;setLine(hk,_c2.set(a.x,ay,a.z));WN.line.material.color.set(0xffd36a);WN.hookRing.position.set(a.x,H(a.x,a.z)+.04,a.z);WN.hookRing.scale.setScalar(1+.1*Math.sin(performance.now()*.008))}return}
  if(WN.active){const a=WN.target,hk=winchHook(_c1),ay=car.rope.y;const d=Math.hypot(a.x-hk.x,a.z-hk.z);WN.t+=dt;
    setLine(hk,_c2.set(a.x,ay,a.z));WN.line.visible=true;WN.line.material.color.set(0xd8c597);WN.hookRing.visible=true;WN.hookRing.position.set(a.x,H(a.x,a.z)+.04,a.z);
    if(Math.random()<dt*10)spawnDust(hk,10,false);
    if(d<1.8||WN.t>25){stopWinch(d<1.8?'Framme ved festet':'Tauet slapp')}}}
function setLine(a,b){const p=WN.line.geometry.attributes.position;p.setXYZ(0,a.x,a.y,a.z);p.setXYZ(1,b.x,b.y,b.z);p.needsUpdate=true}

