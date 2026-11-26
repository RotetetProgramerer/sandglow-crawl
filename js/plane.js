'use strict';
/* =================================================================
   PLANE: sightseeing flights from Trinnvik airport over the same sea as the boat race (js/boat.js).
   Park on the blue square at the airport → «Vil du fly?» → the flight menu (a ring course, or fly where you like) → take off from the runway,
   fly through the rings, land again or crash and start over → the result → back to the car.
   The sea, the islands, the sky and the water are the boat race's scene (buildSea); the airport is built into it here (fAirportSea).
   Everyone at sea in a «Kjør sammen» room sends where they are (Bv, 10 times a second): planes see the boats and boats see the planes.
   The flight physics is in js/planesim.js, the courses and the airport in data/flights.js.
   Loaded after boat.js; uses the globals of game.js, world.js, net.js and boat.js (state, renderer, AC, prof, best, NET, BT …) at run time.
   ================================================================= */
const FL={on:false,fade:null,phase:'',cam:null,pl:null,mesh:null,route:null,flight:null,ringGrp:null,ringVis:[],time:0,acc:0,camYaw:0,camPitch:0,result:false,paused:false,
  hudT:0,res:null,airport:null,cargo:null,small:null,big:null,sock:null,snd:null,notes:[],took:false,landed:false,wake:0,orbit:0,from:new THREE.Vector3()};
const flyKey=f=>'trinnvik/fly/'+f.id;
const flyDone=()=>FLIGHTS.filter(f=>best[flyKey(f)]).length;
const _fv=new THREE.Vector3(),_fv2=new THREE.Vector3(),_fv3=new THREE.Vector3();

/* ---------- the plane: a high-wing two-seater, forward is −z, the wheels 3.2 under its middle ---------- */
function fPlaneMesh(hex){const g=new THREE.Group();g.rotation.order='YXZ';
  const mP=new THREE.MeshStandardMaterial({color:LIN(hex),roughness:.35,metalness:.1}),mW=new THREE.MeshStandardMaterial({color:0xf4f2ec,roughness:.4}),mD=new THREE.MeshStandardMaterial({color:0x1d1f22,roughness:.5,metalness:.3});
  const mG=new THREE.MeshStandardMaterial({color:0x8fc8e8,roughness:.05,metalness:.4,transparent:true,opacity:.75});
  const fus=new THREE.BoxGeometry(3,3,17,2,2,10),p=fus.attributes.position;
  for(let i=0;i<p.count;i++){const z=p.getZ(i),t=Math.max(0,z/8.5),n=Math.max(0,(-z-6)/2.5);const k=1-t*.62-n*.22;p.setX(i,p.getX(i)*k);p.setY(i,p.getY(i)*k+t*.9)}fus.computeVertexNormals();
  bAdd(g,fus,mW,0,0,0);bAdd(g,new THREE.BoxGeometry(3.06,.55,15.5),mP,0,-.35,.2,false);
  const cowl=bAdd(g,new THREE.CylinderGeometry(1.25,1.45,2.6,12),mP,0,-.1,-9.3);cowl.rotation.x=Math.PI/2;
  const spin=bAdd(g,new THREE.ConeGeometry(.55,1.3,10),mD,0,-.1,-11.2,false);spin.rotation.x=-Math.PI/2;
  const prop=new THREE.Group();prop.position.set(0,-.1,-10.8);for(const r of[0,Math.PI/2])bAdd(prop,new THREE.BoxGeometry(.55,7.2,.18),mD,0,0,0,false).rotation.z=r;g.add(prop);
  const disc=new THREE.Mesh(new THREE.CircleGeometry(3.7,24),new THREE.MeshBasicMaterial({color:0x222222,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));disc.position.set(0,-.1,-10.9);g.add(disc);
  bAdd(g,new THREE.BoxGeometry(28,.45,4.4),mP,0,1.75,-2.4);for(const s of[-1,1]){bAdd(g,new THREE.BoxGeometry(.5,.5,1),new THREE.MeshBasicMaterial({color:s<0?0xff3030:0x30ff60}),s*14,1.75,-2.4,false);
    const st=bAdd(g,new THREE.CylinderGeometry(.12,.12,6.4,5),mD,s*3.9,.3,-2.4,false);st.rotation.z=-s*1.08}
  bAdd(g,new THREE.BoxGeometry(3.08,1.05,3.6),mG,0,.95,-3.6,false);
  const fin=bAdd(g,new THREE.BoxGeometry(.3,4.2,3.2),mP,0,2.6,7.4);fin.rotation.x=-.35;bAdd(g,new THREE.BoxGeometry(9.5,.3,2.6),mW,0,.95,7.8);
  for(const s of[-1,1]){bAdd(g,new THREE.BoxGeometry(.25,2,.35),mD,s*1.9,-2.1,-1.6,false);const w=bAdd(g,new THREE.CylinderGeometry(.9,.9,.55,12),mD,s*2.2,-2.3,-1.6,false);w.rotation.z=Math.PI/2}
  bAdd(g,new THREE.BoxGeometry(.25,1.8,.3),mD,0,-1.9,-7.6,false);const nw=bAdd(g,new THREE.CylinderGeometry(.7,.7,.45,12),mD,0,-2.5,-7.6,false);nw.rotation.z=Math.PI/2;
  g.userData={prop,disc,paint:[mP]};return g}
function fPaint(mesh,hex){const c=LIN(hex);for(const m of mesh.userData.paint)m.color.copy(c)}

// a windsock: a cone open at both ends, in orange and white bands, hanging out along +z from its mouth
function fSockMesh(r0,r1,len){const g0=new THREE.CylinderGeometry(r0,r1,len,10,5,true),g=g0.toNonIndexed();g0.dispose();g.rotateX(Math.PI/2);g.translate(0,0,len/2);
  const p=g.attributes.position,C=new Float32Array(p.count*3),a=new THREE.Color(0xff6a2a),b=new THREE.Color(0xf4f4f0);
  for(let i=0;i<p.count;i+=3){const k=Math.floor((p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3/len*5)%2?b:a;for(let j=0;j<3;j++){C[(i+j)*3]=k.r;C[(i+j)*3+1]=k.g;C[(i+j)*3+2]=k.b}}
  g.setAttribute('color',new THREE.BufferAttribute(C,3));return new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide}))}

/* ---------- Trinnvik airport at sea: the fill with grass, the runway with its lights, the terminal, the tower, the hangar, the windsock ---------- */
function fAirportSea(){const A=airSea(),L=A.land,R=A.rwy,g=new THREE.Group(),cx=(L.x0+L.x1)/2,cz=(L.z0+L.z1)/2,top=A.top;
  bAdd(g,new THREE.BoxGeometry(L.x1-L.x0+6,12,L.z1-L.z0+6),bStd(0x8a8a86),cx,top-8,cz,false);bAdd(g,new THREE.BoxGeometry(L.x1-L.x0,3,L.z1-L.z0),bStd(0x6f9a48),cx,top-1.5,cz,false);
  bAdd(g,new THREE.BoxGeometry(R.x1-R.x0,.4,R.z1-R.z0),bStd(0x3a3d40),R.x,top+.2,(R.z0+R.z1)/2,false);
  const white=new THREE.MeshBasicMaterial({color:0xf4f4f0});
  for(let z=R.z0+30;z<R.z1-26;z+=22)bAdd(g,new THREE.BoxGeometry(1.2,.12,10),white,R.x,top+.45,z,false);
  for(const zz of[R.z0+8,R.z1-8])for(let k=-4;k<=4;k++)if(k)bAdd(g,new THREE.BoxGeometry(2,.12,12),white,R.x+k*3,top+.45,zz,false);
  const lamp=new THREE.MeshStandardMaterial({color:0xfff3c0,emissive:0xffd27a,emissiveIntensity:1.2}),red=new THREE.MeshStandardMaterial({color:0xff5040,emissive:0xff2010,emissiveIntensity:1.2});
  for(let z=R.z0;z<=R.z1;z+=25)for(const x of[R.x0-1.5,R.x1+1.5])bAdd(g,new THREE.BoxGeometry(1,1,1),z<R.z0+5||z>R.z1-5?red:lamp,x,top+.5,z,false);
  const T=A.terminal,H=A.hangar,W=A.tower,S=A.sock;
  bAdd(g,new THREE.BoxGeometry(22,.3,70),bStd(0x8a8a86),T.x+14,top+.15,T.z,false);                  // the apron
  bAdd(g,new THREE.BoxGeometry(14,14,40),bStd(0xe9dcb9),T.x,top+7,T.z);bAdd(g,new THREE.BoxGeometry(15,1.2,41),bStd(0x3f4a52),T.x,top+14.6,T.z,false);bAdd(g,new THREE.BoxGeometry(.4,4,34),bStd(0x1a262d),T.x+7.05,top+8,T.z,false);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(44,9),new THREE.MeshBasicMaterial({map:bText('TRINNVIK LUFTHAVN',512,104,'64px "Saira Stencil One", Impact, sans-serif','#14120E','#E5A92B','#14120E'),side:THREE.DoubleSide}));
  sign.position.set(T.x+2,top+20,T.z);sign.rotation.y=Math.PI/2;g.add(sign);
  bAdd(g,new THREE.BoxGeometry(30,20,34),bStd(0x8a9096),H.x,top+10,H.z);for(const s of[-1,1]){const rf=bAdd(g,new THREE.BoxGeometry(17,1.2,36),bStd(0x5a6066),H.x+s*7.5,top+22.4,H.z,false);rf.rotation.z=s*.33}
  bAdd(g,new THREE.BoxGeometry(.6,16,26),bStd(0x3a3f44),H.x+15.1,top+8,H.z,false);bAdd(g,new THREE.BoxGeometry(.8,1.2,28),bStd(0xe5a92b),H.x+15.2,top+16.6,H.z,false);
  bAdd(g,new THREE.CylinderGeometry(3.4,4,30,10),bStd(0xf2e8d0,{flatShading:false}),W.x,top+15,W.z);bAdd(g,new THREE.BoxGeometry(10,6,10),new THREE.MeshStandardMaterial({color:0x1a262d,roughness:.1,metalness:.5}),W.x,top+33,W.z);bAdd(g,new THREE.BoxGeometry(11.5,1.2,11.5),bStd(0xd9432f),W.x,top+36.6,W.z,false);
  bAdd(g,new THREE.CylinderGeometry(.35,.4,16,6),bStd(0xe9e6df),S.x,top+8,S.z,false);
  const sock=new THREE.Group();sock.position.set(S.x,top+15.5,S.z);sock.add(fSockMesh(.7,1.6,8));g.add(sock);FL.sock=sock;
  if(typeof cgSeaKit==='function'){const g2=new THREE.Group();   // the details (js/cargo.js)
    cgSeaKit(g2,{top,face:1,rx:R.x,hw:(R.x1-R.x0)/2,z0:R.z0,z1:R.z1,wx:0,wz:1,T:{x:T.x,z:T.z,len:40,h:14,wy:8,wh:4},W:{x:W.x,z:W.z,sh:30,roof:37.2},tanks:[H.x-2,H.z-32],cargo:[T.x+8,A.start.z-4],
      parked:[[T.x+15,T.z-20,.5,0xc8463a],[T.x+16,T.z+18,-.5,0x2c6fb0]],truck:[T.x+12,T.z-2],masts:[[T.x+8.5,T.z-28],[T.x+8.5,T.z+28]]});BT.scene.add(g2)}
  BT.scene.add(g);BT.isl.push({I:{x:cx,z:cz,r:Math.hypot(L.x1-L.x0,L.z1-L.z0)/2},g});
  if(typeof cgSeaAirports==='function')cgSeaAirports()}   // the airports of the other islands (js/cargo.js)

/* ---------- the ground under the plane: a ray straight down through the islands and the airport ---------- */
const _fRay=new THREE.Raycaster(),_fO=new THREE.Vector3(),_fDown=new THREE.Vector3(0,-1,0);
function fGround(x,z){let top=null;_fO.set(x,1400,z);_fRay.set(_fO,_fDown);_fRay.far=1500;
  for(const e of BT.isl){if(Math.hypot(e.I.x-x,e.I.z-z)>e.I.r+30)continue;const hit=_fRay.intersectObject(e.g,true);if(hit.length&&(top===null||hit[0].point.y>top))top=hit[0].point.y}
  const sea=bWave(x,z,BT.wave);if(top===null||top<sea)return{h:sea,water:true,runway:false};
  return{h:top,water:false,runway:onRunway(x,z)}}
const FW={ground:fGround,bound:SEA.bound};

/* ---------- the airport on the island: your plane in your paint and the windsock ---------- */
function buildAirport(lv){FL.airport=null;const A=lv.airportDef;if(!A)return;if(!BTEX)BTEX=bMakeTex();const g=new THREE.Group();let pm=null;
  if(A.plane){pm=fPlaneMesh((PAINTS[prof.paint]||PAINTS[0]).c);pm.scale.setScalar(.17);pm.position.set(A.plane.x,A.y+PCFG.gear*.17,A.plane.z);pm.rotation.y=A.plane.yaw+Math.PI;g.add(pm)}   // Trinnvik: the small plane
  const sock=new THREE.Group();sock.position.set(A.sock.x,A.y+1.62,A.sock.z);sock.add(fSockMesh(.05,.13,.75));g.add(sock);
  levelGroup.add(g);FL.airport={A,plane:pm,sock,paint:prof.paint};if(A.cargo&&typeof cargoIsland==='function')cargoIsland(A,g)}   // every island: the cargo plane (js/cargo.js)
// the windsock swings in the wind, and the planes follow the paint you choose in the garage
function fAirportAnim(){const M=FL.airport;if(!M)return;const t=performance.now()*.001;M.sock.rotation.y=2.2+.25*Math.sin(t*.7)+.08*Math.sin(t*3.1);M.sock.rotation.x=.25+.1*Math.sin(t*1.3);
  if(M.paint!==prof.paint){M.paint=prof.paint;if(M.plane)fPaint(M.plane,(PAINTS[prof.paint]||PAINTS[0]).c);if(M.cargo)fPaint(M.cargo,(PAINTS[prof.paint]||PAINTS[0]).c)}
  if(M.cargo&&typeof cargoAnim==='function')cargoAnim()}

/* ---------- the rings of a flight: gold for the next one, white for the rest; passed rings are gone ---------- */
function fRings(route){if(FL.ringGrp){BT.scene.remove(FL.ringGrp);bDispose(FL.ringGrp)}const grp=FL.ringGrp=new THREE.Group();FL.ringVis=[];
  const geo=new THREE.TorusGeometry(PCFG.ringR,2.2,10,40);
  route.rings.forEach((q,i)=>{const last=i===route.rings.length-1,m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:last?0xff6a2a:0xf4f2ec,emissive:last?0xff4a0a:0x777777,emissiveIntensity:.6,roughness:.4}));
    m.position.set(q.x,q.y,q.z);m.rotation.y=q.yaw;grp.add(m);
    const lab=new THREE.Mesh(new THREE.PlaneGeometry(30,8),new THREE.MeshBasicMaterial({map:bText(last?'MÅL':'RING '+(i+1),256,68,'48px "Saira Stencil One", Impact, sans-serif','#E5A92B','#14120E','#E5A92B'),side:THREE.DoubleSide,transparent:true}));
    lab.position.set(q.x,q.y+PCFG.ringR+8,q.z);lab.rotation.y=q.yaw;grp.add(lab);FL.ringVis.push({m,lab})});
  BT.scene.add(grp)}
function fRingLook(){const R=FL.route;if(!R)return;const n=FL.pl.ring,t=performance.now()*.001;FL.ringVis.forEach((v,i)=>{const on=i>=n;v.m.visible=v.lab.visible=on;if(!on)return;
  const next=i===n,last=i===R.rings.length-1;v.m.material.color.set(next?0xe5a92b:last?0xff6a2a:0xf4f2ec);v.m.material.emissive.set(next?0xffb300:last?0xff4a0a:0x666666);v.m.material.emissiveIntensity=next?.8+.4*Math.sin(t*5):.4})}

/* ---------- the trip: the question at the airport, the flight menu, back to the car ---------- */
function flyAsk(k){$('aYes').hidden=false;$('aList').hidden=true;const n=flyDone();$('aKind').textContent='Trinnvik lufthavn';$('aName').textContent='Rundflyging';
  $('aDesc').textContent='Lån et småfly og fly over skjærgården: gjennom ringene, eller fritt over øyene og båtene. Bilen venter her.';
  $('aBest').textContent=n?'Du har fullført '+n+' av '+FLIGHTS.length+' flyturer.':'Første tur gjennom ringene gir bonus.';$('aQ').textContent='Vil du fly?';$('aNo').textContent='NEI, kjør videre';$('ask').hidden=false;$('aYes').focus()}
function flyAnswer(k,yes){if(yes)flyStart();else{state.mode='play';state.askCool='fly';toast('Kjør videre når du vil')}}
// the boat race's things are put away while you fly (the boat menu sets them up again)
function fHideBoats(){for(const p of BT.P)p.mesh.visible=false;if(BT.gateGrp)BT.gateGrp.visible=false;for(const m of BT.barVis)m.visible=false;BT.pir.length=0;for(const m of BT.pirVis)m.visible=false;
  for(const b of BT.balls)b.dead=true;BT.balls.length=0;bBalls();BT.vol=null;bRemoteClear()}
function flyStart(){if(FL.on||FL.fade||BT.on||BT.fade)return;initAudio();if(AC&&AC.state==='suspended')AC.resume();state.mode='fly';car.vel.set(0,0,0);car.w.set(0,0,0);car.throttle=0;setOffer(null);
  $('fade').classList.add('on');FL.fade={t:0,hold:.2,cb:()=>{buildSea();bShadowSize();fHideBoats();if(!FL.cam)FL.cam=new THREE.PerspectiveCamera(60,1,1,B_FAR);FL.on=true;$('hud').hidden=true;$('hint').hidden=true;
    const H=$('boatHud');H.hidden=false;H.classList.add('fly');H.classList.remove('two','won');$('bpane1').hidden=true;$('bdiv').hidden=true;$('bpane0').querySelector('.bplace').hidden=true;fLayout();flyMenu()}}}
function flyExit(){if(FL.fade||!FL.on)return;$('fade').classList.add('on');
  FL.fade={t:0,hold:.2,cb:()=>{FL.on=false;FL.phase='';FL.result=false;FL.paused=false;if(FL.snd)FL.snd.master.gain.setTargetAtTime(0,AC.currentTime,.1);if(BT.snd)BT.snd.master.gain.setTargetAtTime(0,AC.currentTime,.1);const H=$('boatHud');H.hidden=true;H.classList.remove('fly','menu','won');
    $('flyMenu').hidden=true;$('flyPause').hidden=true;if(!$('result').hidden){$('result').hidden=true;bResultReset()}
    renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);state.mode='play';state.askCool='fly';camSnap=true;showHud();toast('Tilbake ved bilen')}}}
const fSel=()=>{const id=store.get('flyPick','fri');if(id==='fri')return null;const f=FLIGHTS.find(q=>q.id===id);return f||null};
// on the runway, nose to the north: a course (its rings) or null to fly where you like
function fSetup(f){FL.cargo=null;if(FL.big)FL.big.visible=false;if(typeof cgGuide==='function')cgGuide(null);FL.flight=f;FL.route=flightRoute(f);fRings(FL.route);const s=FL.route.start;FL.pl=makePlane(s.x,s.y,s.z,s.a);
  if(!FL.small){FL.small=fPlaneMesh((PAINTS[prof.paint]||PAINTS[0]).c);BT.scene.add(FL.small)}else fPaint(FL.small,(PAINTS[prof.paint]||PAINTS[0]).c);FL.mesh=FL.small;FL.mesh.visible=true;
  FL.camYaw=s.a;FL.time=0;FL.acc=0;FL.took=false;FL.landed=false;FL.result=false;FL.paused=false;FL.res=null;fPose(0)}
function flyMenu(){FL.result=false;FL.paused=false;$('result').hidden=true;$('flyPause').hidden=true;$('boatHud').classList.add('menu');FL.phase='menu';fSetup(fSel());fMenuRender();$('flyMenu').hidden=false;$('fmGo').focus()}
function fMenuRender(){const sel=fSel(),row=(id,name,desc,diff,b,on)=>`<button data-fly="${id}" aria-pressed="${on}"><span><span class="nm"><i class="pdot" style="background:${DIFFCOL[diff]}"></i>${name}</span><span class="sub">${desc}${b?' Beste: '+fmtTime(b.t)+'.':''}</span></span><span class="pr">${id==='fri'?'':b?'★'.repeat(b.s)+'☆'.repeat(3-b.s):'☆☆☆'}</span></button>`;
  $('fmList').innerHTML=row('fri','Fly fritt','Ingen ringer og ingen klokke. Fly dit du vil, se båtene og de andre, og land på rullebanen når du er ferdig.',1,null,!sel)+
    FLIGHTS.map(f=>row(f.id,f.name,f.desc,f.diff,best[flyKey(f)],sel===f)).join('');
  const touch=document.body.classList.contains('is-touch');$('fmKeys').textContent=touch?'Knappene på skjermen: opp og ned stiger og synker, piler svinger, ⚡ gir full fart.':'W eller ↑ for gass og stige, S eller ↓ for å synke og bremse, A/D eller ←/→ for å svinge, mellomrom for full fart.'}
function flyBegin(){fSetup(fSel());$('flyMenu').hidden=true;$('flyPause').hidden=true;$('result').hidden=true;$('boatHud').classList.remove('menu','won');FL.phase='fly';
  fNotice(FL.flight?'Hold gass for å ta av · ring 1 venter':'Hold gass for å ta av',2600);fHUD()}
function fPause(on){if(!FL.on||FL.result||FL.phase!=='fly')return;FL.paused=!!on;$('flyPause').hidden=!on;if(on){const cg=!!FL.cargo;$('fpRestart').hidden=!FL.flight;$('fpMenu').hidden=cg;$('fpSkip').hidden=!cg;$('fpCar').textContent=cg?'Avbryt og bli på '+FL.cargo.from.name:'Tilbake til bilen';$('fpTitle').textContent=cg?'Lasteflyet':'Pause';$('fpSound').textContent='Lyd: '+(state.sound?'på':'av');$('fpResume').focus()}}
function flyKeyDown(k){if(FL.fade||!FL.on||FL.result)return;
  if(FL.cargo&&k==='enter'&&$('flyPause').hidden&&FL.phase==='fly'){cargoSkip();return}   // the cargo flight: Enter lands you at the island you chose
  if(FL.phase==='menu'){if(k==='escape')flyExit();else if(k==='enter'&&document.activeElement===document.body)$('fmGo').click();return}
  if(k==='escape'||k==='p'){fPause($('flyPause').hidden);return}if(!$('flyPause').hidden)return;if(k==='m')setSound(!state.sound)}
function fNotice(text,ms=1500){const n=$('bpane0').querySelector('.bnotice');n.textContent=text;n.style.opacity=1;clearTimeout(n._t);n._t=setTimeout(()=>n.style.opacity=0,ms)}

/* ---------- every 60 Hz step: the controls, the plane, the rings, crashes and landings ---------- */
function fInput(){const I=state.inp||{gas:0,rev:0,steer:0,jump:false};return{gas:I.gas,rev:I.rev,steer:I.steer,jump:!!I.jump||keys.has('shift')}}
function fStep(){BT.wave+=BSTEP;const pl=FL.pl,R=FL.route,flying=FL.phase==='fly';if(!pl)return;if(FL.cargo){cgStep();return}
  const inp=flying?fInput():FL.phase==='done'?{gas:pl.p<0?.3:0,rev:pl.p>.05?.3:0,steer:0}:{gas:0,rev:1,steer:0};
  if(flying&&FL.flight)FL.time+=BSTEP;
  stepPlane(pl,inp,FW);FL.inp=inp;
  if(flying&&FL.flight){const e=planeRing(pl,R);if(e){fxSparkle(bV(pl.x,pl.y,pl.z));sndGate();if(e.type==='finish')fFinish();else fNotice('Ring '+(e.i+1)+' av '+R.rings.length,1100)}}
  for(const e of pl.ev){
    if(e.type==='takeoff'){FL.took=true;FL.landed=false;if(flying)fNotice('Du er i lufta!',1300)}
    else if(e.type==='land'){FL.landed=true;if(flying){const ap=e.runway&&airportAt(pl.x,pl.z);fNotice(ap?'Landet på '+ap.name+' lufthavn':'Landet utenfor flyplassen',2200)}fxSplash(bV(pl.x,pl.y-PCFG.gear,pl.z))}
    else if(e.type==='crash'){FL.mesh.visible=false;if(e.water)fxSplash(bV(pl.x,2,pl.z));else fxHit(bV(pl.x,pl.y,pl.z),0x666666);fxHit(bV(pl.x,pl.y+2,pl.z),0xf4f2ec);fBoom();if(flying)fNotice(e.water?'Plask! Prøv igjen':'Krasj! Prøv igjen',1800)}
    else if(e.type==='respawn')fRespawn();
    else if(e.type==='edge'&&flying)fNotice('Snu – her slutter kartet',1500)}
  pl.ev.length=0;
  // smoke from the volcano, exhaust when the throttle is wide open
  for(const s of BT.smokers)if(Math.random()<.15&&Math.hypot(s.x-pl.x,s.z-pl.z)<1400)bSpawn(bV(s.x+brand(-5,5),s.y,s.z+brand(-5,5)),bV(brand(-.1,.1),.35,brand(-.1,.1)),{color:0x777777,size:12,life:120,grow:.25,opacity:.5});
  if(!pl.ground&&!pl.crash&&inp.jump&&Math.random()<.5){const h=_fv.set(Math.sin(pl.a),0,Math.cos(pl.a));bSpawn(bV(pl.x+h.x*11,pl.y,pl.z+h.z*11),bV(h.x*.3,.02,h.z*.3),{color:0xdddddd,size:3,life:30,grow:.18,opacity:.45})}
  bParticles()}
// after a crash: at the last ring you passed, flying on towards the next; otherwise back on the runway
function fRespawn(){const pl=FL.pl,R=FL.route,last=FL.flight&&pl.ring>0&&FL.phase==='fly'?R.rings[pl.ring-1]:null;
  if(last){const nx=R.rings[pl.ring]||last;pl.x=last.x;pl.y=last.y;pl.z=last.z;pl.a=bAng(nx.x-last.x,nx.z-last.z);pl.ground=false;pl.s=PCFG.cruise}
  else{const s=R.start;pl.x=s.x;pl.y=s.y;pl.z=s.z;pl.a=s.a;pl.ground=true;pl.s=0;FL.took=false}
  pl.p=pl.r=0;pl.vy=0;FL.camYaw=pl.a;FL.mesh.visible=true;fPose(0);FL.snap=true}
function fFinish(){FL.phase='done';FL.doneT=0;FL.res=null;$('flyPause').hidden=true;$('boatHud').classList.add('won');sndFanfare()}
function fShowResult(){FL.result=true;const f=FL.flight,pl=FL.pl,t=FL.time,par=f.par,key=flyKey(f),stars=t<=par[0]?3:t<=par[1]?2:1,prev=best[key];let isBest=false;
  if(!prev||t<prev.t){best[key]={t,s:Math.max(stars,prev?prev.s:0),h:pl.crashes};store.set('best',best);isBest=true}else if(stars>prev.s){prev.s=stars;store.set('best',best)}
  const n=f.rings.length;let e=n*5+20;const el=[n+' ringer +'+n*5,'i mål +20'];if(!pl.crashes){e+=15;el.push('ingen krasj +15')}
  if(!prev){e+=60;el.push('første gang +60')}else if(isBest){e+=20;el.push('ny rekord +20')}
  prof.nuts+=e;saveProf();FL.res={isBest,prev};
  $('rLevel').textContent='Trinnvik lufthavn · '+f.name;$('rTitle').textContent=pl.crashes?'I mål!':'Feilfri tur!';
  $('rTime').textContent=fmtTime(t);$('rPenL').textContent='Krasj';$('rPen').textContent=pl.crashes;$('rGatesL').textContent='Ringer';$('rGates').textContent=pl.ring+'/'+n;
  $('rStars').innerHTML=[0,1,2].map(i=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z" fill="${i<stars?'#E5A92B':'rgba(242,232,208,.15)'}"/></svg>`).join('');$('rStars').setAttribute('aria-label',stars+' av 3 stjerner');
  $('rLog').innerHTML=[`<li><b>Krasj:</b> ${pl.crashes}${pl.crashes?'':', helt feilfritt'}</li>`,`<li><b>Mål for stjerner:</b> ${fmtTime(par[0])} gir tre, ${fmtTime(par[1])} gir to</li>`,isBest&&prev?'<li><b>Ny personlig rekord på denne turen.</b></li>':''].join('');
  $('rNuts').textContent='+'+fmtN(e);$('rNutsNote').textContent=el.join(' · ');
  $('rNext').textContent='Fly igjen';$('rRetry').textContent='Velg tur';$('rRetry').hidden=false;$('rMenu').textContent='Tilbake til bilen';$('rGarage').hidden=true;$('result').hidden=false;$('rNext').focus()}
// the result buttons (game.js): next = the same flight again, retry = pick a flight, car = back to the car
function flyResultBtn(btn){if(!FL.on||!FL.result)return false;FL.result=false;$('result').hidden=true;bResultReset();$('boatHud').classList.remove('won');
  if(btn==='car')flyExit();else if(btn==='next')flyBegin();else flyMenu();return true}

/* ---------- sound: the engine and the wind (WebAudio, no files) ---------- */
function fSnd(){if(FL.snd||!AC)return FL.snd;try{const C=AC,master=C.createGain();master.gain.value=0;master.connect(C.destination);
  const o=C.createOscillator();o.type='sawtooth';o.frequency.value=60;const o2=C.createOscillator();o2.type='square';o2.frequency.value=30;const f=C.createBiquadFilter();f.type='lowpass';f.frequency.value=600;
  const eg=C.createGain();eg.gain.value=0;o.connect(f);o2.connect(f);f.connect(eg);eg.connect(master);o.start();o2.start();
  const wind=C.createBufferSource();wind.buffer=noiseBuf(C,3);wind.loop=true;const wf=C.createBiquadFilter();wf.type='bandpass';wf.frequency.value=700;wf.Q.value=.6;const wg=C.createGain();wg.gain.value=0;wind.connect(wf);wf.connect(wg);wg.connect(master);wind.start();
  const fx=C.createGain();fx.gain.value=.7;fx.connect(master);FL.snd={master,o,o2,f,eg,wf,wg,fx,nb:noiseBuf(C,1)}}catch(e){FL.snd=null}return FL.snd}
function fSndUpdate(){const S=fSnd();if(!S)return;const t=AC.currentTime,on=FL.on&&state.sound&&!FL.paused,pl=FL.pl,va=state.volAmb/70,vc=state.volCar/70;
  S.master.gain.setTargetAtTime(on?1:0,t,.15);const B=bSnd();if(B){B.master.gain.setTargetAtTime(on?1:0,t,.15);B.sea.gain.setTargetAtTime(.05*va,t,.3);B.fx.gain.setTargetAtTime(.7*va,t,.1);for(const e of B.eng)e.g.gain.setTargetAtTime(0,t,.1)}
  if(!pl||!on)return;const run=!pl.crash,thr=FL.inp?Math.max(FL.inp.gas,FL.inp.jump?1:0):0,sp=pl.s;
  S.o.frequency.setTargetAtTime(55+sp*30+thr*25,t,.08);S.o2.frequency.setTargetAtTime((55+sp*30+thr*25)/2,t,.08);S.f.frequency.setTargetAtTime(500+sp*260+thr*500,t,.1);
  S.eg.gain.setTargetAtTime(run?(.03+thr*.03+sp*.01)*vc:0,t,.12);S.wg.gain.setTargetAtTime(run&&!pl.ground?(.02+sp*.02)*va:0,t,.2);S.wf.frequency.setTargetAtTime(500+sp*260,t,.2)}
function fBoom(){const S=fSnd();if(!S||!state.sound)return;const C=AC,t=C.currentTime,n=C.createBufferSource();n.buffer=S.nb;const f=C.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(900,t);f.frequency.exponentialRampToValueAtTime(80,t+.6);
  const g=C.createGain();bEnv(g,t,.01,.9,.6);n.connect(f);f.connect(g);g.connect(S.fx);n.start(t);n.stop(t+.7)}

/* ---------- every frame (from game.js): the fade, the 60 Hz steps, the plane, the camera, the HUD, sound, drawing ---------- */
function updateFly(dt){
  if(FL.fade){const f=FL.fade;f.t+=dt;if(f.t>.9&&!f.done){f.done=true;f.cb()}if(f.t>.9+f.hold){$('fade').classList.remove('on');FL.fade=null}}
  if(!FL.on){fAirportAnim();return false}
  const now=performance.now();
  if(!FL.paused){FL.acc+=dt;let n=0;while(FL.acc>=BSTEP&&n<8){fStep();FL.acc-=BSTEP;n++}if(n>=8)FL.acc=0}
  if(FL.phase==='done'){FL.doneT+=dt;if(FL.doneT>2.6&&!FL.result)fShowResult()}
  bWorldAnim(dt,now);seaDraw(now,now*.001);fPose(now*.001);fRingLook();if(FL.sock){FL.sock.rotation.y=2.2+.25*Math.sin(now*.0007);FL.sock.rotation.x=.2+.1*Math.sin(now*.0013)}
  fCamera(dt,now);if(FL.phase==='fly'||FL.phase==='done'){FL.hudT-=dt;if(FL.hudT<=0){FL.hudT=1/30;fHUD()}}
  if(FL.pl&&FL.phase)seaSend(FL.cargo?'c':'p',FL.pl,dt);fSndUpdate();
  renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);bPlace(FL.cam,FL.mesh.position);renderer.render(BT.scene,FL.cam);return true}
function fPose(t){const pl=FL.pl,m=FL.mesh;if(!pl||!m)return;m.position.set(pl.x,pl.y,pl.z);m.rotation.set(pl.p,pl.a,pl.r);
  const sp=pl.ground&&!FL.took&&FL.phase!=='fly'?0:.25+pl.s*.25+(FL.inp&&FL.inp.gas?.2:0);m.userData.prop.rotation.z+=sp*(1+Math.sin(t*50)*.05);m.userData.disc.material.opacity=Math.min(.35,sp*.5)}
// the camera: round the plane on the runway in the menu, behind it in the air (it follows the heading and half the pitch), round it at the finish
function fCamera(dt,now){const pl=FL.pl,c=FL.cam,P=FL.mesh.position;if(!pl)return;
  if(FL.phase==='menu'||FL.phase==='done'&&FL.doneT>.6){FL.orbit+=dt*.25;c.position.lerp(_fv.set(P.x+Math.sin(FL.orbit)*60,P.y+18,P.z+Math.cos(FL.orbit)*60),1-Math.pow(.96,dt*60));c.lookAt(P.x,P.y+2,P.z);return}
  FL.camYaw=bLerpA(FL.camYaw,pl.a,1-Math.pow(.92,dt*60));FL.camPitch+=(pl.p*.5-FL.camPitch)*(1-Math.pow(.92,dt*60));
  const K=FL.cargo?2.7:1,back=(pl.ground?36:46)*K,up=(pl.ground?9:12)*K,cp=Math.cos(FL.camPitch),h=_fv2.set(-Math.sin(FL.camYaw)*cp,Math.sin(FL.camPitch),-Math.cos(FL.camYaw)*cp);
  const want=_fv.copy(P).addScaledVector(h,-back);want.y+=up;const g=fGround(want.x,want.z).h+4;if(want.y<g)want.y=g;
  if(FL.snap){c.position.copy(want);FL.snap=false}else c.position.lerp(want,1-Math.pow(.85,dt*60));c.lookAt(_fv3.copy(P).addScaledVector(h,30*K));
  const fov=60+Math.max(0,pl.s-(pl.cfg||PCFG).cruise)*8;if(Math.abs(c.fov-fov)>.05){c.fov+=(fov-c.fov)*(1-Math.pow(.92,dt*60));c.updateProjectionMatrix()}}
function fLayout(){if(!FL.on||!FL.cam)return;const W=innerWidth,H=innerHeight,s=$('bpane0').style;s.left=s.top='0px';s.width=W+'px';s.height=H+'px';$('bpane0').hidden=false;
  const ms=$('bminiBox').style,cs=$('bclock').style,ps=$('bPauseB').style;for(const k of['left','top','width','height'])ms[k]='';cs.left=cs.top=ps.left=ps.top='';$('bminiBox').hidden=$('bclock').hidden=false;
  FL.cam.aspect=W/H;FL.cam.fov=W<H?70:60;FL.cam.updateProjectionMatrix()}

/* ---------- the HUD: compass to the next ring (or home), what is next, speed and height, the clock and the minimap ---------- */
function fHUD(){const pl=FL.pl,R=FL.route,ui=$('bpane0'),A=airSea();if(!pl)return;if(FL.cargo){cgHUD();return}
  $('bclock').textContent=fmtTime(FL.time);$('bclock').hidden=!FL.flight;ui.querySelector('.bpl').textContent='Pilot';ui.querySelector('.bname').textContent=bNames()[0];
  ui.querySelector('.bkn').textContent=Math.round(pl.s*PCFG.kts)+' kn';ui.querySelector('.balt').textContent=(pl.ground?0:Math.max(0,Math.round(pl.y-PCFG.gear)))+' m høyde';
  ui.querySelector('.bboost i').style.width=Math.min(100,pl.s/PCFG.turbo*100)+'%';
  const ring=FL.flight&&pl.ring<R.rings.length?R.rings[pl.ring]:null,tg=ring||{x:A.rwy.x,z:(A.rwy.z0+A.rwy.z1)/2},dx=tg.x-pl.x,dz=tg.z-pl.z,d=Math.round(Math.hypot(dx,dz));
  ui.querySelector('.btarget').textContent=FL.phase==='done'?'I mål':ring?'Ring '+(pl.ring+1)+'/'+R.rings.length+' · '+d+' m'+(ring.y>pl.y+25?' · stig':ring.y<pl.y-25?' · sink':''):pl.ground?(FL.took?'Landet':'Rullebanen · hold gass'):'Flyplassen · '+d+' m';
  bCompass({ui:{compass:ui.querySelector('.bcompass').getContext('2d')},b:{a:pl.a},col:(PAINTS[prof.paint]||PAINTS[0]).c},Math.atan2(dx,-dz));fMinimap()}
function fMinimap(){const cv=$('bmini'),c=cv.getContext('2d'),w=cv.width,h=cv.height,sc=w/2/SEA.bound,M=(x,z)=>[w/2+x*sc,h/2+z*sc],pl=FL.pl,A=airSea();
  c.fillStyle='#6fa3c4';c.fillRect(0,0,w,h);c.fillStyle='#e9dcb9';c.strokeStyle='#5a3a1a';c.lineWidth=1;for(const I of seaIslands()){const[u,v]=M(I.x,I.z);c.beginPath();c.arc(u,v,Math.max(2.5,I.r*sc),0,6.283);c.fill();c.stroke()}
  c.strokeStyle='#3a3d40';c.lineWidth=3;for(const Q of seaAirports()){const[u0,v0]=M(Q.cx-Q.hx*Q.hl,Q.cz-Q.hz*Q.hl),[u1,v1]=M(Q.cx+Q.hx*Q.hl,Q.cz+Q.hz*Q.hl);c.beginPath();c.moveTo(u0,v0);c.lineTo(u1,v1);c.stroke()}c.lineWidth=1;
  if(FL.cargo)cgMiniDest(c,M);
  const R=FL.route;if(R&&FL.flight){c.setLineDash([4,4]);c.strokeStyle='rgba(20,18,14,.6)';c.lineWidth=1.5;c.beginPath();const[su,sv]=M(R.start.x,R.start.z);c.moveTo(su,sv);R.rings.forEach(q=>{const[u,v]=M(q.x,q.z);c.lineTo(u,v)});c.stroke();c.setLineDash([]);
    c.font='700 10px "Barlow Condensed", sans-serif';c.textAlign='center';c.textBaseline='middle';
    R.rings.forEach((q,i)=>{if(i<pl.ring)return;const[u,v]=M(q.x,q.z);c.fillStyle=i===pl.ring?'#e5a92b':'#f4f2ec';c.strokeStyle='#14120E';c.beginPath();c.arc(u,v,5.5,0,6.283);c.fill();c.stroke();c.fillStyle='#14120E';c.fillText(i+1,u,v+.5)})}
  const arrow=(x,z,a,col)=>{const[u,v]=M(x,z);c.save();c.translate(u,v);c.rotate(-a);c.fillStyle=col;c.strokeStyle='#fff';c.lineWidth=1.5;c.beginPath();c.moveTo(0,-8);c.lineTo(5.5,5.5);c.lineTo(0,3);c.lineTo(-5.5,5.5);c.closePath();c.fill();c.stroke();c.restore()};
  for(const o of SEA_O.values())if(o.live){if(o.k!=='b')arrow(o.x,o.z,o.a,o.col);else{const[u,v]=M(o.x,o.z);c.fillStyle=o.col;c.strokeStyle='#fff';c.beginPath();c.arc(u,v,4,0,6.283);c.fill();c.stroke()}}
  arrow(pl.x,pl.z,pl.a,(PAINTS[prof.paint]||PAINTS[0]).c);c.fillStyle='#14120E';c.font='700 12px "Barlow Condensed", sans-serif';c.textAlign='center';c.fillText('N',w/2,12)}

/* ---------- the others at sea: boats and planes from the «Kjør sammen» room ---------- */
// Everyone at sea sends Bv ten times a second: kind (b = boat, p = plane), where, which way, how fast and the colour. Racing boats in your own race are
// drawn by the race (js/boat.js); everything else is drawn here, a little behind real time so it moves smoothly.
const SEA_O=new Map();let seaT=0;
function seaSend(k,o,dt){if(typeof NET==='undefined'||!NET.on||!NET.players.size)return;seaT-=dt;if(seaT>0)return;seaT=.1;const f=v=>+(+v).toFixed(2);
  const air=k!=='b',col=air?(PAINTS[prof.paint]||PAINTS[0]).c:(BT.P[0]&&BT.P[0].col)||'#e3a62a';   // k: b = boat, p = the small plane, c = the cargo plane
  netSend({t:'Bv',k,tm:netNow(),x:f(o.x),y:f(air?o.y:0),z:f(o.z),a:+(+o.a).toFixed(3),p:air?+o.p.toFixed(3):0,r:air?+o.r.toFixed(3):0,s:f(air?o.s:o.speed),c:col,h:air&&o.crash?1:0})}
function seaNet(p,m){const num=v=>typeof v==='number'&&isFinite(v);if((m.k!=='b'&&m.k!=='p'&&m.k!=='c')||![m.tm,m.x,m.y,m.z,m.a,m.p,m.r,m.s].every(num)||typeof m.c!=='string'||!/^#[0-9a-f]{6}$/i.test(m.c))return;
  if(!BT.built)return;let o=SEA_O.get(p.id);if(o&&(o.k!==m.k||o.c!==m.c)){seaDrop(o);o=null}
  if(!o){const mesh=m.k==='c'?cgSeaMesh(m.c):m.k==='p'?fPlaneMesh(m.c):bBoatMesh(m.c,(p.slot|0)+1,netCol(p.slot));if(m.k==='b')bName(mesh,p.name||'?');const tag=netTag(p.name||'?',netCol(p.slot));tag.scale.set(60,15,1);BT.scene.add(mesh,tag);
    o={id:p.id,k:m.k,c:m.c,col:netCol(p.slot),mesh,tag,buf:[],x:m.x,y:m.y,z:m.z,a:m.a,live:false,seen:0};SEA_O.set(p.id,o)}
  o.buf.push({tm:m.tm,x:m.x,y:m.y,z:m.z,a:m.a,p:m.p,r:m.r,s:m.s,h:!!m.h});if(o.buf.length>30)o.buf.shift();o.seen=performance.now()}
function seaDrop(o){BT.scene.remove(o.mesh);bDispose(o.mesh);BT.scene.remove(o.tag);o.tag.material.map.dispose();o.tag.material.dispose();SEA_O.delete(o.id)}
// a player left the room (id), or the room is gone (null)
function seaGone(id){for(const o of[...SEA_O.values()])if(id===null||o.id===id)seaDrop(o)}
function seaDraw(now,t){if(!BT.built)return;for(const o of SEA_O.values()){const p=NET.players.get(o.id),b=o.buf,race=BT.on&&BT.remote.has(o.id)&&BT.remote.get(o.id).live;
  o.live=!!(p&&b.length&&now-o.seen<3000&&!race&&!b[b.length-1].h);o.mesh.visible=o.tag.visible=o.live;if(!o.live)continue;
  const rt=now-(p.off||0)-NET_DELAY;let A=b[0],C=b[0],k=0;if(rt>=b[b.length-1].tm)A=C=b[b.length-1];else if(rt>b[0].tm){for(let i=1;i<b.length;i++)if(b[i].tm>=rt){A=b[i-1];C=b[i];k=(rt-A.tm)/Math.max(1,C.tm-A.tm);break}}
  o.x=A.x+(C.x-A.x)*k;o.z=A.z+(C.z-A.z)*k;o.a=bLerpA(A.a,C.a,k);const s=A.s+(C.s-A.s)*k;
  if(o.k!=='b'){o.y=A.y+(C.y-A.y)*k;o.mesh.position.set(o.x,o.y,o.z);o.mesh.rotation.set(A.p+(C.p-A.p)*k,o.a,A.r+(C.r-A.r)*k);o.mesh.userData.prop.rotation.z+=.5+s*.25;o.mesh.userData.disc.material.opacity=.3}
  else{o.y=bWave(o.x,o.z,BT.wave)+1.4+Math.min(1,Math.abs(s)/1.6)*.7;o.mesh.position.set(o.x,o.y,o.z);o.mesh.rotation.set(.075*Math.max(-.4,Math.min(1,s/1.2)),o.a,0)}
  o.tag.position.set(o.x,o.y+18,o.z)}}

function initFly(){
  $('fmList').addEventListener('click',e=>{const b=e.target.closest('[data-fly]');if(!b)return;
    store.set('flyPick',b.dataset.fly);fSetup(fSel());fMenuRender()});
  $('fmGo').onclick=()=>{if(FL.phase==='menu')flyBegin()};$('fmBack').onclick=()=>flyExit();
  $('fpResume').onclick=()=>fPause(false);$('fpRestart').onclick=()=>{fPause(false);flyBegin()};$('fpMenu').onclick=()=>{fPause(false);flyMenu()};$('fpCar').onclick=()=>{fPause(false);if(FL.cargo)cargoAbort();else flyExit()};
  $('fpSound').onclick=()=>{setSound(!state.sound);$('fpSound').textContent='Lyd: '+(state.sound?'på':'av')};
  $('fpSkip').onclick=()=>{fPause(false);cargoSkip()};
  $('bPauseB').addEventListener('click',()=>{if(FL.on)fPause(true)});
  addEventListener('resize',()=>{if(FL.on)fLayout()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&FL.on)fPause(true)})}
initFly();
