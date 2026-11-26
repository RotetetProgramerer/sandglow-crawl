'use strict';
/* =================================================================
   CARGO: the cargo plane that carries your car between the islands.
   Every island has an airport (def.airport in data/levels/, built by c.airport in js/core.js; Trinnvik's own is in its level file).
   At one end of the runway stands a big four-engined cargo plane with its tail ramp down. Drive up the ramp and into the hold →
   «Hvor vil du fly?» → pick an island → you fly the plane yourself over the same sea as the boat race and the sightseeing flights (js/plane.js),
   land on that island's runway (or any other island's; lined up with the runway of your island, the landing help sights the plane in), brake to a stop → the island loads and you drive out of the hold. It costs nothing.
   The flight uses the machinery of js/plane.js (FL: the fade, the 60 Hz steps, the camera, the boat HUD's first pane, sound, the others at sea);
   the physics and the airports at sea are in js/planesim.js (PCARGO, seaAirports, cargoFinal, cargoWhere).
   Loaded after plane.js; uses the globals of game.js, world.js, boat.js and plane.js at run time.
   ================================================================= */
const CG_GEAR=2;   // the model's origin is this high over the ground (island units); PCARGO.gear is the same at sea
const _cv=new THREE.Vector3();

/* ---------- the model: forward is −z, measures in island units (the hold is CARGO in js/core.js), ground at y = −CG_GEAR ---------- */
function cgMesh(hex){const g=new THREE.Group();g.rotation.order='YXZ';const b=new THREE.Group();b.position.y=-CG_GEAR;g.add(b);const K=CARGO,top=new THREE.Group();b.add(top);
  const std=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.5},o||{}));
  const mW=std(0xf1f0ea,{side:THREE.DoubleSide}),mW2=std(0xf1f0ea),mP=std(LIN(hex),{roughness:.4,metalness:.1}),mP2=std(LIN(hex),{roughness:.4,metalness:.1}),mD=std(0x1d1f22,{roughness:.6}),
    mG=std(0x26323a,{roughness:.1,metalness:.6}),mF=std(0x6c7278,{roughness:.8}),mI=std(0xc9cdd0,{roughness:.9,side:THREE.DoubleSide}),mE=std(0xb9bec4,{roughness:.4,metalness:.3});
  const L=K.half*2+.4,zc=-.2;   // the hold: from the ramp's top (z = +half) to the bulkhead (z = −half −.4)
  // floor and belly, the walls, the bulkhead, the wheel fairings and the wheels
  bAdd(b,new THREE.BoxGeometry(K.hw*2+.6,.4,L),mF,0,K.floor-.2,zc);for(let z=-3;z<=3;z+=1.5)bAdd(b,new THREE.BoxGeometry(K.hw*2,.012,.05),mD,0,K.floor+.006,z+zc,false);
  for(const s of[-1,1]){bAdd(b,new THREE.BoxGeometry(.2,1.9,L),mI,s*(K.hw+.25),K.floor+.95,zc);bAdd(b,new THREE.BoxGeometry(.04,1.9,L),mW2,s*(K.hw+.37),K.floor+.95,zc,false);
    bAdd(b,new THREE.BoxGeometry(.05,.36,L),mP,s*(K.hw+.4),K.floor+1.25,zc,false);
    bAdd(b,new THREE.BoxGeometry(.6,1,5.2),mW2,s*(K.hw+.6),.72,zc);for(const z of[-1.8,-.6,.6,1.8]){const w=bAdd(b,new THREE.CylinderGeometry(.4,.4,.34,12),mD,s*(K.hw+.72),.4,z+zc);w.rotation.z=Math.PI/2}}
  bAdd(b,new THREE.BoxGeometry(K.hw*2+.5,1.9,.14),mI,0,K.floor+.95,-K.half-.47);{const d=bAdd(b,new THREE.CircleGeometry(K.hw+.33,14,0,Math.PI),mI,0,K.floor+1.9,-K.half-.42,false);d.material.side=THREE.DoubleSide}
  for(const s of[-1,1])for(const z of[-2.4,0,2.4])bAdd(b,new THREE.BoxGeometry(.03,.1,.9),new THREE.MeshBasicMaterial({color:0xfff0c0}),s*(K.hw+.13),K.floor+1.75,z+zc,false);   // the lamps in the hold
  // the roof over the hold: half a tube. It fades away while the car is inside, so you can see where you are driving
  const R=K.hw+.37,ry=K.floor+1.9,roofG=new THREE.CylinderGeometry(R,R,L,18,1,true,Math.PI/2,Math.PI);roofG.rotateX(Math.PI/2);bAdd(top,roofG,mW,0,ry,zc);
  // the nose: half an egg, the windows of the flight deck, the nose wheels
  {const n=new THREE.SphereGeometry(R,18,10,0,Math.PI*2,0,Math.PI/2);n.rotateX(-Math.PI/2);n.scale(1,1.02,2.1);bAdd(b,n,mW2,0,ry-.35,-K.half-.5);const n2=new THREE.SphereGeometry(R,18,6,0,Math.PI*2,0,Math.PI/2);n2.rotateX(-Math.PI/2);n2.scale(1,1.02,.25);
    const w=bAdd(b,new THREE.BoxGeometry(2.3,.42,.7),mG,0,ry+.95,-K.half-1.55,false);w.rotation.x=.75;bAdd(b,new THREE.BoxGeometry(R*2-.1,.3,2.4),mP,0,ry-.75,-K.half-1.6,false);
    for(const s of[-1,1]){const nw=bAdd(b,new THREE.CylinderGeometry(.36,.36,.3,12),mD,s*.42,.36,-K.half-1.3);nw.rotation.z=Math.PI/2}bAdd(b,new THREE.BoxGeometry(.2,.9,.2),mD,0,.8,-K.half-1.3,false)}
  // the tail: swept up over the ramp, the fin and the tailplane
  {const t=new THREE.BoxGeometry(R*2,1.95,6,1,1,6),p=t.attributes.position;for(let i=0;i<p.count;i++){const u=(p.getZ(i)+3)/6;p.setX(i,p.getX(i)*(1-.74*u));p.setY(i,p.getY(i)<0?p.getY(i)+u*1.55:p.getY(i)-u*.12)}t.computeVertexNormals();
    bAdd(top,t,mW,0,ry+.95,K.half+3);const fin=bAdd(top,new THREE.BoxGeometry(.3,3.6,2.5),mP2,0,ry+3.4,K.half+4.6);fin.rotation.x=-.42;bAdd(top,new THREE.BoxGeometry(7.4,.22,1.8),mW,0,ry+1.55,K.half+5.3)}
  // the wing: high, swept back, drooping a little; four engines under it
  bAdd(top,new THREE.BoxGeometry(R*2+.2,.5,3.2),mW,0,ry+1.9,-1.2);
  for(const s of[-1,1]){const wg=new THREE.Group();wg.position.set(s*1.6,ry+1.95,-1.4);wg.rotation.set(0,-s*.34,-s*.06);top.add(wg);
    const wb=new THREE.BoxGeometry(8.2,.3,2.7,6,1,1),p=wb.attributes.position;for(let i=0;i<p.count;i++){const u=(p.getX(i)*s+4.1)/8.2;p.setZ(i,p.getZ(i)*(1-.5*u))}wb.computeVertexNormals();bAdd(wg,wb,mW,s*4.1,0,0);
    bAdd(wg,new THREE.BoxGeometry(.5,.34,.9),mP2,s*8.1,0,0,false);
    for(const x of[2.2,5]){const e=bAdd(wg,new THREE.CylinderGeometry(.56,.5,1.9,14),mE,s*x,-.95,-.75);e.rotation.x=Math.PI/2;const f=bAdd(wg,new THREE.CylinderGeometry(.44,.44,.06,14),mD,s*x,-.95,-1.72,false);f.rotation.x=Math.PI/2;bAdd(wg,new THREE.BoxGeometry(.14,.6,1.2),mE,s*x,-.35,-.5,false)}}
  // the ramp (down on the island) and the door that closes the hold in the air
  const ramp=new THREE.Group();ramp.position.set(0,K.floor,K.half);ramp.rotation.x=Math.atan2(K.floor-.02,K.ramp);b.add(ramp);bAdd(ramp,new THREE.BoxGeometry(K.hw*2,.1,K.ramp+.1),mF,0,-.05,K.ramp/2);
  for(const s of[-1,1])bAdd(ramp,new THREE.BoxGeometry(.12,.16,K.ramp),mP,s*(K.hw-.06),.03,K.ramp/2,false);for(let z=.5;z<K.ramp;z+=.6)bAdd(ramp,new THREE.BoxGeometry(K.hw*2-.4,.03,.06),mD,0,.01,z,false);
  const door=bAdd(b,new THREE.BoxGeometry(K.hw*2+.5,1.95,.16),mW2,0,K.floor+.95,K.half+.1);door.visible=false;
  // the same handles as the small plane, so the flight code can treat them alike: nothing spins on a jet
  g.userData={prop:new THREE.Group(),disc:{material:{opacity:0}},paint:[mP,mP2],top:[mW,mP2],ramp,door,fade:1};return g}
// the cargo plane at sea: the same model at the sea's scale, ramp up and door shut
function cgSeaMesh(hex){const m=cgMesh(hex);m.scale.setScalar(CARGO_SEA);m.userData.ramp.visible=false;m.userData.door.visible=true;return m}

/* ---------- on the island: the plane at the end of the runway, its ramp down ---------- */
function cargoIsland(A,g){const C=A.cargo,m=cgMesh((PAINTS[prof.paint]||PAINTS[0]).c);m.position.set(C.x,C.y+CG_GEAR,C.z);m.rotation.y=C.yaw+Math.PI;g.add(m);FL.airport.cargo=m}
// where the car is in the plane's own frame: u along the hold (nose is +), v across
function cargoUV(){const A=LV&&LV.airportDef,C=A&&A.cargo;if(!C||!car)return null;const rx=car.pos.x-C.x,rz=car.pos.z-C.z;return{C,u:rx*C.ux+rz*C.uz,v:rx*C.uz-rz*C.ux}}
// in the hold, well past the top of the ramp: this is where the question comes
function cargoInHold(){const q=cargoUV();return!!q&&q.u>-q.C.half+1.3&&q.u<q.C.half+.4&&Math.abs(q.v)<q.C.hw&&car.pos.y>q.C.fy-.25&&car.pos.y<q.C.fy+2}
// anywhere in the plane or on its ramp
function cargoNear(){const q=cargoUV();return!!q&&q.u>-q.C.half-q.C.ramp-.4&&q.u<q.C.half+.6&&Math.abs(q.v)<q.C.hw+.5}
// the roof, the tail and the wing fade away while the car is on the ramp or in the hold
function cargoAnim(){const M=FL.airport,m=M&&M.cargo;if(!m)return;const U=m.userData,want=cargoNear()&&state.mode!=='menu'&&state.mode!=='garage'?.14:1;if(Math.abs(U.fade-want)<.004)return;
  U.fade+=(want-U.fade)*.14;if(Math.abs(U.fade-want)<.004)U.fade=want;for(const mat of U.top){const tr=U.fade<.995;if(mat.transparent!==tr){mat.transparent=tr;mat.needsUpdate=true}mat.opacity=U.fade;mat.depthWrite=!tr}}

/* ---------- the airports of the other islands at sea (Trinnvik's own is fAirportSea in js/plane.js) ---------- */
function cgSeaAirports(){const lamp=new THREE.MeshStandardMaterial({color:0xfff3c0,emissive:0xffd27a,emissiveIntensity:1.2}),red=new THREE.MeshStandardMaterial({color:0xff5040,emissive:0xff2010,emissiveIntensity:1.2}),white=new THREE.MeshBasicMaterial({color:0xf4f4f0});
  for(const A of seaAirports()){if(A.own)continue;const g=new THREE.Group(),top=A.top;g.position.set(A.lx,0,A.lz);g.rotation.y=Math.atan2(A.hx,A.hz);   // local +z is the way you take off, local +x is across
    const off=(A.cx-A.lx)*A.hz-(A.cz-A.lz)*A.hx,in_=off>0?-1:1,look=A.island.look,ground=look==='vinter'||look==='svalbard'?0xe8eef4:look==='orken'||look==='sand'?0xd9c08a:0x6f9a48;
    bAdd(g,new THREE.BoxGeometry(A.ld*2+6,12,A.ll*2+6),bStd(0x8a8a86),0,top-8,0,false);bAdd(g,new THREE.BoxGeometry(A.ld*2,3,A.ll*2),bStd(ground),0,top-1.5,0,false);
    bAdd(g,new THREE.BoxGeometry(A.hw*2,.4,A.hl*2),bStd(0x3a3d40),off,top+.2,0,false);
    for(let z=-A.hl+30;z<A.hl-26;z+=22)bAdd(g,new THREE.BoxGeometry(1.2,.12,10),white,off,top+.45,z,false);
    for(const zz of[-A.hl+8,A.hl-8])for(let k=-4;k<=4;k++)if(k)bAdd(g,new THREE.BoxGeometry(2,.12,12),white,off+k*3,top+.45,zz,false);
    for(let z=-A.hl;z<=A.hl;z+=25)for(const x of[off-A.hw-1.5,off+A.hw+1.5])bAdd(g,new THREE.BoxGeometry(1,1,1),Math.abs(z)>A.hl-5?red:lamp,x,top+.5,z,false);
    // the terminal with the island's name on the roof, and the tower, on the island side of the runway and well ahead of where the plane stands
    const tx=in_*(A.ld-12),tz=40;bAdd(g,new THREE.BoxGeometry(14,10,44),bStd(0xe9dcb9),tx,top+5,tz);bAdd(g,new THREE.BoxGeometry(15,1.2,45),bStd(0x3f4a52),tx,top+10.6,tz,false);bAdd(g,new THREE.BoxGeometry(.4,3.4,38),bStd(0x1a262d),tx-in_*7.05,top+6,tz,false);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(46,9),new THREE.MeshBasicMaterial({map:bText(A.name.toUpperCase()+' LUFTHAVN',512,104,'54px "Saira Stencil One", Impact, sans-serif','#14120E','#E5A92B','#14120E'),side:THREE.DoubleSide}));
    sign.position.set(tx,top+16,tz);sign.rotation.y=Math.PI/2;g.add(sign);
    bAdd(g,new THREE.CylinderGeometry(3.2,3.8,26,10),bStd(0xf2e8d0,{flatShading:false}),tx,top+13,tz+52);bAdd(g,new THREE.BoxGeometry(9.5,5.5,9.5),new THREE.MeshStandardMaterial({color:0x1a262d,roughness:.1,metalness:.5}),tx,top+28.5,tz+52);bAdd(g,new THREE.BoxGeometry(11,1.2,11),bStd(0xd9432f),tx,top+31.8,tz+52,false);
    BT.scene.add(g);g.updateMatrixWorld(true);BT.isl.push({I:{x:A.lx,z:A.lz,r:Math.hypot(A.ll,A.ld)+8},g})}}   // (the matrices now, not at the first frame: the ground under the plane is found with a ray before that)

/* ---------- the way in to the island you are flying to: three hoops down the final approach and a beam of light over the runway ---------- */
function cgGuide(B){if(FL.guide){BT.scene.remove(FL.guide);bDispose(FL.guide);FL.guide=null}if(!B||!BT.scene)return;const F=cargoFinal(B),g=new THREE.Group(),G=B.top+PCARGO.gear;
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(22,22,700,16,1,true),new THREE.MeshBasicMaterial({color:0xffc84a,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide,fog:false}));beam.position.set(B.cx,B.top+350,B.cz);g.add(beam);
  const lab=new THREE.Mesh(new THREE.PlaneGeometry(150,30),new THREE.MeshBasicMaterial({map:bText(B.name.toUpperCase(),512,104,'64px "Saira Stencil One", Impact, sans-serif','#14120E','#E5A92B','#14120E'),side:THREE.DoubleSide,fog:false}));lab.position.set(B.cx,B.top+150,B.cz);g.add(lab);g.userData.lab=lab;
  if(F.out){const geo=new THREE.TorusGeometry(62,3,8,36);for(const u of[1,.58,.22]){const d=F.out*u,m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0xe5a92b,emissive:0xffb300,emissiveIntensity:.7,roughness:.4}));
    m.position.set(F.tx-F.hx*d,G+12+(F.y-G-12)*u,F.tz-F.hz*d);m.rotation.y=Math.atan2(F.hx,F.hz);g.add(m)}}
  BT.scene.add(g);FL.guide=g}

/* ---------- the question in the hold, and the trip ---------- */
function cargoAsk(){const here=LEVELS[state.levelIdx];$('aName').textContent='Lasteflyet';$('aKind').textContent=here.name+' lufthavn';
  $('aDesc').textContent='Hvor vil du fly? Du flyr selv, bilen står trygt i lasterommet, og turen er gratis.';$('aBest').textContent='';$('aQ').textContent='';
  const P=typeof NET!=='undefined'&&NET.on?[...NET.players.values()]:[],dests=seaAirports().filter(A=>A.id!==here.id).map(A=>LEVELS.find(l=>l.id===A.id)).filter(l=>l&&isIsland(l));
  $('aList').innerHTML=dests.map(l=>{const fr=P.filter(p=>p.lv===l.id).map(p=>p.name).join(', ');return`<button data-dest="${l.id}"><span><span class="nm">${l.name}</span>${fr?'<span class="sub">Her er '+fr+'</span>':''}</span><span class="pr">✈</span></button>`}).join('');
  $('aList').classList.add('two');$('aList').hidden=false;$('aYes').hidden=true;$('aNo').textContent='Bli her';$('ask').hidden=false}
function cargoAnswer(yes){state.askCool='cargo';state.mode='play';if(yes&&yes.dest)cargoStart(yes.dest);else toast('Rygg ut når du vil')}
function cargoStart(destId){const A=seaAirport(LEVELS[state.levelIdx].id),B=seaAirport(destId);if(!A||!B||FL.on||FL.fade||BT.on||BT.fade)return;
  initAudio();if(AC&&AC.state==='suspended')AC.resume();state.mode='fly';car.vel.set(0,0,0);car.w.set(0,0,0);car.throttle=0;setOffer(null);if(typeof gpsStop==='function'&&typeof GPS!=='undefined'&&GPS.dest)gpsStop();
  $('fade').classList.add('on');FL.fade={t:0,hold:.2,cb:()=>{buildSea();bShadowSize();fHideBoats();if(!FL.cam)FL.cam=new THREE.PerspectiveCamera(60,1,1,B_FAR);FL.on=true;$('hud').hidden=true;$('hint').hidden=true;
    const H=$('boatHud');H.hidden=false;H.classList.add('fly');H.classList.remove('two','won','menu');$('bpane1').hidden=true;$('bdiv').hidden=true;$('bpane0').querySelector('.bplace').hidden=true;$('flyMenu').hidden=true;$('flyPause').hidden=true;
    fLayout();cgSetup(A,B);FL.phase='fly';fNotice('Hold gass for å ta av · kurs mot '+B.name,3200);cgHUD()}}}
// on the runway of the island you leave, nose down the runway; the way in to the island you fly to is lit up
function cgSetup(A,B){const paint=(PAINTS[prof.paint]||PAINTS[0]).c;FL.cargo={from:A,dest:B,fin:false,done:false,warn:false};FL.flight=null;FL.route={flight:null,rings:[],start:A.start};fRings(FL.route);FL.pl=makeCargo(A);
  if(!FL.big){FL.big=cgSeaMesh(paint);BT.scene.add(FL.big)}else fPaint(FL.big,paint);if(FL.small)FL.small.visible=false;FL.mesh=FL.big;FL.mesh.visible=true;cgGuide(B);
  FL.camYaw=A.start.a;FL.camPitch=0;FL.time=0;FL.acc=0;FL.took=false;FL.landed=false;FL.result=false;FL.paused=false;FL.res=null;FL.inp=null;fPose(0);FL.snap=true}
// back from the sea: the flight's things are put away (what flyExit does for the small plane)
function cgLeave(){FL.on=false;FL.phase='';FL.result=false;FL.paused=false;FL.cargo=null;cgGuide(null);if(FL.snd)FL.snd.master.gain.setTargetAtTime(0,AC.currentTime,.1);if(BT.snd)BT.snd.master.gain.setTargetAtTime(0,AC.currentTime,.1);
  const H=$('boatHud');H.hidden=true;H.classList.remove('fly','menu','won');$('flyMenu').hidden=true;$('flyPause').hidden=true;renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight)}
// you have landed (or skipped the flight): the island loads, and the car stands in the hold with its nose towards the ramp
function cgArrive(A,note){if(!FL.cargo||FL.cargo.done&&FL.fade)return;FL.cargo.done=true;const di=LEVELS.findIndex(l=>l.id===A.id);if(di<0)return;$('fade').classList.add('on');
  FL.fade={t:0,hold:.35,cb:()=>{cgLeave();const same=di===state.levelIdx;if(!same){loadLevel(di);$('hLevel').textContent=LEVELS[di].name}
    const C=LV.airportDef&&LV.airportDef.cargo;state.mode='play';state.free=true;state.askCool='cargo';
    if(C){const h=Math.atan2(-C.ux,-C.uz);placeCar(car,C.x,C.z,h);car.pos.y=C.fy+.5;car.vel.set(0,0,0);car.w.set(0,0,0);for(let i=0;i<90;i++)stepCar(car,FIXED);state.checkpoint={x:C.pad.x,z:C.pad.z,h}}
    camSnap=true;roamSaveT=0;showHud();toast(note||(same?'Tilbake på '+LEVELS[di].name:'Velkommen til '+LEVELS[di].name+' · kjør ut bak'))}}}
function cargoSkip(){if(FL.cargo&&!FL.fade)cgArrive(FL.cargo.dest)}
function cargoAbort(){if(FL.cargo&&!FL.fade)cgArrive(FL.cargo.from,'Du ble på '+FL.cargo.from.name)}

/* ---------- every 60 Hz step of a cargo flight: the controls, the plane, crashes, the landing ---------- */
function cgStep(){const pl=FL.pl,S=FL.cargo,flying=FL.phase==='fly';if(!pl||!S)return;
  let inp=flying&&!S.done?fInput():{gas:0,rev:1,steer:0,jump:false};if(pl.ground&&FL.landed&&!inp.gas)inp.rev=1;   // landed: it brakes by itself unless you give gas again
  // the landing help (cargoAssist in js/planesim.js): lined up with the runway of your island, the plane sights itself in
  const hp=flying&&!S.done?cargoAssist(pl,inp,S.dest,FW):null;if(hp){inp=hp;if(!S.help&&!S.told&&!pl.ground){S.told=true;fNotice('Landingshjelp · flyet sikter seg inn på '+S.dest.name,2600)}}S.help=!!hp&&!pl.ground;
  stepPlane(pl,inp,FW);FL.inp=inp;
  for(const e of pl.ev){
    if(e.type==='takeoff'){FL.took=true;FL.landed=false;S.warn=false;fNotice('Du er i lufta! Kurs mot '+S.dest.name,1800)}
    else if(e.type==='land'){FL.landed=true;const ap=cargoWhere(pl.x,pl.z);fNotice(ap?'Landet på '+ap.name+' · brems':'Landet',2200);fxSplash(bV(pl.x,pl.y-PCARGO.gear,pl.z))}
    else if(e.type==='crash'){FL.mesh.visible=false;if(e.water)fxSplash(bV(pl.x,2,pl.z));else fxHit(bV(pl.x,pl.y,pl.z),0x666666);fxHit(bV(pl.x,pl.y+2,pl.z),0xf4f2ec);fBoom();fNotice(e.water?'Plask! Du får et nytt forsøk':'Krasj! Du får et nytt forsøk',2200)}
    else if(e.type==='respawn')cgRespawn();
    else if(e.type==='edge')fNotice('Snu – her slutter kartet',1500)}
  pl.ev.length=0;
  // standing still after a landing: on an island with an airport you have arrived
  if(pl.ground&&FL.landed&&!pl.crash&&pl.s<.03&&!S.done){const ap=cargoWhere(pl.x,pl.z);if(ap)cgArrive(ap);else if(!S.warn){S.warn=true;fNotice('Her er det ingen flyplass. Ta av igjen',3000)}}
  for(const s of BT.smokers)if(Math.random()<.15&&Math.hypot(s.x-pl.x,s.z-pl.z)<1400)bSpawn(bV(s.x+brand(-5,5),s.y,s.z+brand(-5,5)),bV(brand(-.1,.1),.35,brand(-.1,.1)),{color:0x777777,size:12,life:120,grow:.25,opacity:.5});
  if(!pl.ground&&!pl.crash&&inp.jump&&Math.random()<.5){const h=_cv.set(Math.sin(pl.a),0,Math.cos(pl.a));for(const sd of[-1,1])bSpawn(bV(pl.x+h.x*20+h.z*sd*20,pl.y+8,pl.z+h.z*20-h.x*sd*20),bV(h.x*.3,.02,h.z*.3),{color:0xdddddd,size:4,life:30,grow:.2,opacity:.4})}
  bParticles()}
// after a crash you do not lose the car: you are put in the air where the final approach to your island begins, lined up with the runway
function cgRespawn(){const pl=FL.pl,S=FL.cargo,B=S.dest,F=cargoFinal(B),o=F.out||600;pl.x=F.tx-F.hx*o;pl.z=F.tz-F.hz*o;pl.y=F.out?F.y:B.top+90;pl.a=F.a;pl.p=pl.r=0;pl.vy=0;pl.ground=false;pl.s=PCARGO.cruise;
  FL.took=true;FL.landed=false;S.fin=true;FL.camYaw=pl.a;FL.mesh.visible=true;fPose(0);FL.snap=true;S.told=true;fNotice('Rett fram ligger '+B.name+' · landingshjelpen tar deg ned',3000)}

/* ---------- the HUD: where to, how far, and whether you are high or low on the way down ---------- */
// what to steer for: the first hoop until you are on the way in, then the runway. Missed it and flown past: round again.
function cgAim(){const pl=FL.pl,S=FL.cargo,B=S.dest,F=cargoFinal(B),rx=pl.x-F.tx,rz=pl.z-F.tz,al=rx*F.hx+rz*F.hz,lat=rx*F.hz-rz*F.hx,G=B.top+PCARGO.gear;
  if(!F.out)return{x:B.cx,z:B.cz,fin:true,glide:G+Math.max(0,-al)*.1,al};
  if(!S.fin&&((al<0&&al>-F.out-250&&Math.abs(lat)<Math.max(70,-al*.3))||Math.hypot(pl.x-F.x,pl.z-F.z)<240))S.fin=true;
  if(S.fin&&(al>B.hl*2+150||Math.abs(lat)>520||al<-F.out-700))S.fin=false;
  return S.fin?{x:F.tx+F.hx*50,z:F.tz+F.hz*50,fin:true,glide:G+Math.max(0,-al)*(F.y-G)/F.out,al}:{x:F.x,z:F.z,fin:false,glide:F.y,al}}
function cgHUD(){const pl=FL.pl,S=FL.cargo,ui=$('bpane0'),B=S.dest,C=PCARGO;if(!pl)return;const T=cgAim(),dx=T.x-pl.x,dz=T.z-pl.z,d=Math.round(Math.hypot(B.cx-pl.x,B.cz-pl.z));
  $('bclock').hidden=true;ui.querySelector('.bpl').textContent='Lastefly';ui.querySelector('.bname').textContent=bNames()[0];
  ui.querySelector('.bkn').textContent=Math.round(pl.s*C.kts)+' kn';ui.querySelector('.balt').textContent=(pl.ground?0:Math.max(0,Math.round(pl.y-C.gear-B.top)))+' m høyde';ui.querySelector('.bboost i').style.width=Math.min(100,pl.s/C.turbo*100)+'%';
  const hi=!pl.ground&&T.fin&&T.al<0?(pl.y>T.glide+22?' · sink':pl.y<T.glide-14?' · stig':''):'';
  ui.querySelector('.btarget').textContent=S.done?'Framme':pl.ground?(FL.landed?'Landet · brems':'Hold gass · kurs mot '+B.name):S.help?'Landingshjelp · '+B.name+' · '+d+' m':T.fin?'Land på '+B.name+' · '+d+' m'+hi:B.name+' · '+d+' m · fly til porten';
  bCompass({ui:{compass:ui.querySelector('.bcompass').getContext('2d')},b:{a:pl.a},col:(PAINTS[prof.paint]||PAINTS[0]).c},Math.atan2(dx,-dz));
  if(FL.guide&&FL.guide.userData.lab)FL.guide.userData.lab.rotation.y=Math.atan2(pl.x-B.cx,pl.z-B.cz);fMinimap()}
// on the minimap: a line to the island you fly to, and a ring round its airport
function cgMiniDest(c,M){const S=FL.cargo,pl=FL.pl;if(!S||!pl)return;const[u,v]=M(S.dest.cx,S.dest.cz),[pu,pv]=M(pl.x,pl.z);c.setLineDash([4,4]);c.strokeStyle='rgba(20,18,14,.6)';c.lineWidth=1.5;c.beginPath();c.moveTo(pu,pv);c.lineTo(u,v);c.stroke();c.setLineDash([]);
  c.strokeStyle='#e5a92b';c.lineWidth=2.5;c.beginPath();c.arc(u,v,8,0,6.283);c.stroke();c.lineWidth=1}
