'use strict';
/* =================================================================
   GPS: tap a place on the island map (the ferry quay, the base, a course, a name on the map, or anywhere on land) and the way there is shown:
   a blue arrow over the car, blue chevrons on the ground, a blue line on both maps and the distance in the HUD. The way is found by js/gpsroute.js,
   and found again when you drive off it. On the archipelago map, tap another island and the GPS takes you to the ferry.
   Loaded after world.js; uses its globals (state, car, LV, scene, MAP, prof, toast …) at run time.
   ================================================================= */
const GPS={on:false,grid:null,dest:null,route:null,pi:0,checkT:0,offT:0,againT:0,arrow:null,chev:null,chevT:0,yaw:null};
const GPSCOL='#2f86ff';

/* ---------- the places and the route ---------- */
function gpsPlacesHere(){return gpsPlaces(LEVELS[state.levelIdx],LV,{cave:!!(prof.cave&&prof.cave.found)})}
function gpsGridHere(){if(!GPS.grid||GPS.grid.lv!==LV)GPS.grid=gpsGrid(LV);return GPS.grid}
const gpsM=u=>(u*UNIT_CM/100).toFixed(1).replace('.',',')+' m';
// the route is for the island the car is on (until gpsUpdate sees that the ferry has taken it somewhere else)
const gpsLive=()=>GPS.on&&GPS.grid&&GPS.grid.lv===LV;
// how far is left: along the route from the point the car is at
const gpsLeft=()=>GPS.route?Math.max(0,GPS.route.len-GPS.route.pts[GPS.pi].s):0;
// set a destination ({name,x,z,r,kind,area}) and find the way from the car; returns false when there is no way there
function gpsSet(place){if(!car||!LV)return false;
  if(state.course){toast('GPS-en er av mens du kjører en løype',true);return false}
  const route=gpsRoute(gpsGridHere(),car.pos.x,car.pos.z,place.x,place.z,place.area||0);
  if(!route){toast('Fant ingen vei dit',true);return false}
  Object.assign(GPS,{on:true,dest:place,route,pi:0,checkT:0,offT:0,againT:0,yaw:null});
  toast('GPS: '+place.name+' · '+gpsM(route.len));return true}
function gpsStop(msg){if(!GPS.on)return;GPS.on=false;GPS.dest=null;GPS.route=null;if(msg)toast(msg);gpsSync(0);if(MAP.open)gpsChips()}
// once a frame while driving freely on an island (called from the main loop after updateWorld)
function gpsUpdate(dt){if(!GPS.on)return;
  if(GPS.grid&&GPS.grid.lv!==LV){gpsStop();return}   // took the ferry: the route was for the other island
  if(state.course){gpsStop();return}
  const d=GPS.dest,P=GPS.route.pts,there=Math.hypot(d.x-car.pos.x,d.z-car.pos.z)<d.r||(d.kind==='ferry'&&onFerryDeck());
  // where on the route the car is: the nearest point a little behind or ahead of the last one
  let bd=1e9,bi=GPS.pi;for(let k=Math.max(0,GPS.pi-8);k<Math.min(P.length,GPS.pi+50);k++){const e=Math.hypot(P[k].x-car.pos.x,P[k].z-car.pos.z);if(e<bd){bd=e;bi=k}}GPS.pi=bi;
  if(there||(bi>=P.length-2&&bd<1.6)){gpsStop('Du er framme: '+d.name+(d.kind==='ferry'&&d.to?'. Velg '+d.to+' når fergen spør.':''));return}
  // off the route for a while (a shortcut, a tow, a wrong turn): find the way again from here
  GPS.againT-=dt;GPS.checkT-=dt;if(GPS.checkT>0)return;GPS.checkT=.25;
  if(bd>3.2){let gd=1e9,gi=bi;for(let k=0;k<P.length;k++){const e=Math.hypot(P[k].x-car.pos.x,P[k].z-car.pos.z);if(e<gd){gd=e;gi=k}}if(gd<2){GPS.pi=gi;GPS.offT=0;return}GPS.offT+=.25}else GPS.offT=0;
  if(GPS.offT>=.75&&GPS.againT<=0){GPS.againT=1.5;GPS.offT=0;const r=gpsRoute(gpsGridHere(),car.pos.x,car.pos.z,d.x,d.z,d.area||0);if(r){GPS.route=r;GPS.pi=0;GPS.yaw=null}}}

/* ---------- in 3D: the arrow over the car and the chevrons on the ground ---------- */
function gpsBuildVis(){
  const mat=new THREE.MeshStandardMaterial({color:LIN(GPSCOL),emissive:LIN('#0b3f99'),roughness:.35,metalness:.1}),rim=new THREE.MeshBasicMaterial({color:0xffffff});
  const sh=new THREE.Shape();sh.moveTo(0,.5);sh.lineTo(.34,.06);sh.lineTo(.13,.06);sh.lineTo(.13,-.45);sh.lineTo(-.13,-.45);sh.lineTo(-.13,.06);sh.lineTo(-.34,.06);sh.closePath();
  const geo=new THREE.ExtrudeGeometry(sh,{depth:.07,bevelEnabled:true,bevelThickness:.015,bevelSize:.015,bevelSegments:1});geo.rotateX(Math.PI/2);geo.translate(0,.035,0);
  const a=new THREE.Group(),m=new THREE.Mesh(geo,mat),o=new THREE.Mesh(geo,rim);m.castShadow=true;o.scale.set(1.16,.6,1.12);o.position.y=-.02;a.add(o,m);a.visible=false;scene.add(a);GPS.arrow=a;
  // chevrons along the route ahead of the car; a wave of light runs along them towards the destination
  const cs=new THREE.Shape();cs.moveTo(0,.26);cs.lineTo(.32,-.04);cs.lineTo(.32,-.24);cs.lineTo(0,.04);cs.lineTo(-.32,-.24);cs.lineTo(-.32,-.04);cs.closePath();
  const cg=new THREE.ShapeGeometry(cs);cg.rotateX(Math.PI/2);
  const im=new THREE.InstancedMesh(cg,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.92,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}),40);
  const c=LIN(GPSCOL);for(let i=0;i<40;i++)im.setColorAt(i,c);im.count=0;im.frustumCulled=false;im.renderOrder=1;scene.add(im);GPS.chev={im,list:[]}}
const _gpsm=new THREE.Matrix4(),_gpsq=new Q4(),_gpsp=new V3(),_gpss=new V3(1,1,1),_gpsc=new THREE.Color(),_gpsc2=new THREE.Color(),_gpsc3=new THREE.Color();
function gpsSync(dt){if(!GPS.arrow)gpsBuildVis();const show=gpsLive()&&state.world&&!SKI.on&&state.mode!=='menu'&&state.mode!=='garage'&&state.mode!=='ferry';
  GPS.arrow.visible=show;GPS.chev.im.visible=show;if(!show)return;
  const P=GPS.route.pts,p0=P[GPS.pi],tm=performance.now()*.001;
  // the arrow points at a spot a little way ahead on the route, and turns smoothly
  const ah=P[Math.min(P.length-1,GPS.pi+5)],want=Math.atan2(ah.x-car.pos.x,ah.z-car.pos.z);
  if(GPS.yaw===null)GPS.yaw=want;else{let e=want-GPS.yaw;e=Math.atan2(Math.sin(e),Math.cos(e));GPS.yaw+=e*Math.min(1,dt*8)}
  const roof=.42+(car.cfg.gh||.3)+.55;GPS.arrow.position.set(car.pos.x,car.pos.y+roof+.06*Math.sin(tm*3),car.pos.z);GPS.arrow.rotation.set(.35,GPS.yaw,0,'YXZ');   // the tip leans down a little, so the camera behind the car sees the arrow's face
  // the chevrons: laid again a few times a second from the car's point on the route and 22 units on
  const ch=GPS.chev;GPS.chevT-=dt;if(GPS.chevT<=0){GPS.chevT=.15;ch.list.length=0;
    for(let s=p0.s+1;s<p0.s+22&&ch.list.length<40;s+=1.25){if(s>GPS.route.len-.3)break;let k=GPS.pi;while(k<P.length-1&&P[k+1].s<s)k++;const a=P[k],b=P[Math.min(P.length-1,k+1)],u=b.s>a.s?(s-a.s)/(b.s-a.s):0;
      const x=a.x+(b.x-a.x)*u,z=a.z+(b.z-a.z)*u,c2=P[Math.min(P.length-1,k+2)],y=Math.max(H(x,z),WL(x,z))+.05;
      _gpsp.set(x,y,z);_gpsq.setFromAxisAngle(YAX,Math.atan2(c2.x-a.x,c2.z-a.z));_gpsm.compose(_gpsp,_gpsq,_gpss);ch.im.setMatrixAt(ch.list.length,_gpsm);ch.list.push(s)}
    ch.im.count=ch.list.length;ch.im.instanceMatrix.needsUpdate=true}
  _gpsc.set(GPSCOL).convertSRGBToLinear();_gpsc2.set('#bfe0ff').convertSRGBToLinear();ch.list.forEach((s,i)=>{const w=Math.max(0,Math.sin((s-p0.s)*.9-tm*7));_gpsc3.copy(_gpsc).lerp(_gpsc2,w*w*.7);ch.im.setColorAt(i,_gpsc3)});if(ch.im.instanceColor)ch.im.instanceColor.needsUpdate=true}

/* ---------- the HUD: the arrow and the distance in the corner, and the gauge at the bottom ---------- */
function gpsHud(){const on=gpsLive();$('hBaseR').classList.toggle('gps',on);if(!on)return false;
  $('hBaseL').textContent=GPS.dest.name;$('hBase').textContent=gpsM(gpsLeft());
  const P=GPS.route.pts,ah=P[Math.min(P.length-1,GPS.pi+5)],rel=Math.atan2(ah.x-car.pos.x,ah.z-car.pos.z)-Math.atan2(car.fw.x,car.fw.z);   // left of the car is +; the arrow turns the other way on screen
  $('hGpsAr').setAttribute('transform','rotate('+(-rel*57.3).toFixed(0)+')');
  $('hNext').textContent=(gpsLeft()*UNIT_CM/100).toFixed(1).replace('.',',');$('hNextU').textContent='m til '+GPS.dest.name;return true}

/* ---------- the maps ---------- */
function gpsPin(x,u,v,s){x.save();x.translate(u,v);x.fillStyle=GPSCOL;x.strokeStyle='#fff';x.lineWidth=Math.max(1.5,s*.22);x.beginPath();x.moveTo(0,0);x.bezierCurveTo(-s*.2,-s*.55,-s*.75,-s*.9,-s*.75,-s*1.4);x.arc(0,-s*1.4,s*.75,Math.PI,0);x.bezierCurveTo(s*.75,-s*.9,s*.2,-s*.55,0,0);x.closePath();x.fill();x.stroke();
  x.fillStyle='#fff';x.beginPath();x.arc(0,-s*1.4,s*.3,0,6.283);x.fill();x.restore()}
// the route from the car on; lw in the units of the context it is drawn in, P(x,z) gives the point to draw at
function gpsLine(x,P,lw){if(!gpsLive())return;const R=GPS.route.pts;x.save();x.lineCap='round';x.lineJoin='round';
  const path=()=>{x.beginPath();const a=P(car.pos.x,car.pos.z);x.moveTo(a[0],a[1]);for(let k=GPS.pi+1;k<R.length;k+=2){const q=P(R[k].x,R[k].z);x.lineTo(q[0],q[1])}const e=R[R.length-1],q=P(e.x,e.z);x.lineTo(q[0],q[1])};
  path();x.strokeStyle='rgba(255,255,255,.9)';x.lineWidth=lw*1.9;x.stroke();path();x.strokeStyle=GPSCOL;x.lineWidth=lw;x.stroke();x.restore()}
function gpsDrawBig(x,sc){if(!gpsLive())return;gpsLine(x,(wx,wz)=>[mapX(wx)*sc,mapY(wz)*sc],3);const e=GPS.route.pts[GPS.route.pts.length-1];gpsPin(x,mapX(e.x)*sc,mapY(e.z)*sc,11)}
function gpsDrawMini(x,toMini,R){if(!gpsLive())return;
  x.save();x.beginPath();x.arc(R,R,R-2,0,6.283);x.clip();gpsLine(x,toMini,3);x.restore();
  const e=GPS.route.pts[GPS.route.pts.length-1],[u,v]=toMini(e.x,e.z),d=Math.hypot(u-R,v-R);
  if(d<R-10)gpsPin(x,u,v,7);else{const a=Math.atan2(v-R,u-R);x.save();x.translate(R+Math.cos(a)*(R-9),R+Math.sin(a)*(R-9));x.rotate(a);x.fillStyle=GPSCOL;x.strokeStyle='#fff';x.lineWidth=1.5;x.beginPath();x.moveTo(7,0);x.lineTo(-5,-6);x.lineTo(-5,6);x.closePath();x.fill();x.stroke();x.restore()}}
// a tap on the island map: the named place under the finger, or else the spot itself
function gpsMapTap(e){const r=MAP.big.getBoundingClientRect(),u=(e.clientX-r.left)/MAP.scale,v=(e.clientY-r.top)/MAP.scale,places=gpsPlacesHere();
  let best=null,bd=(18/MAP.scale)**2;for(const p of places){if(p.kind==='label')continue;const dd=(mapX(p.x)-u)**2+(mapY(p.z)-v)**2;if(dd<bd){bd=dd;best=p}}
  if(!best){bd=(26/MAP.scale)**2;for(const p of places){if(p.kind!=='label')continue;const dd=(mapX(p.x)-u)**2+((mapY(p.z)-5/MAP.scale)-v)**2;if(dd<bd){bd=dd;best=p}}}   // the name is written a little above its spot
  if(!best)best={id:'pin',name:'Valgt sted',x:HALF-u/MAP.W*WORLD,z:HALF-v/MAP.W*WORLD,r:2,kind:'pin'};
  const ok=gpsSet(best);drawBigMap();gpsChips();
  const info=best.kind==='course'?mapInfoText(best.k)+' ':'';
  $('mapInfo').textContent=ok?info+'GPS: '+best.name+' · '+gpsM(GPS.route.len)+(GPS.route.short?' (så nær som bilen kommer)':'')+'. Lukk kartet og følg den blå pilen.'
    :state.course?'GPS-en er av mens du kjører en løype.':info+'Fant ingen vei dit. Trykk på et sted på land.'}
// a tap on the archipelago: another island, and the GPS takes you to the ferry
function gpsArchTap(e){const r=MAP.big.getBoundingClientRect(),sz=r.width,u=e.clientX-r.left,v=e.clientY-r.top,here=LEVELS[state.levelIdx].id;
  let hit=null;for(const isl of ISLANDS){const l=LEVELS.find(q=>q.id===isl.id);if(!l)continue;const rr=(l.world?.085:.055)*sz*1.25;if(Math.hypot(isl.pos[0]*sz-u,isl.pos[1]*sz-v)<rr)hit=l}
  if(!hit)return;if(hit.id===here){setMapTab('island');return}
  // the ferry routes as a graph: the first leg of the shortest trip there
  const prev={[here]:null},q=[here];while(q.length){const a=q.shift();for(const[x,y]of ROUTES){const b=x===a?y:y===a?x:null;if(b&&!(b in prev)){prev[b]=a;q.push(b)}}}
  let leg=hit.id in prev?hit.id:null;while(leg&&prev[leg]!==here)leg=prev[leg];
  const via=leg&&leg!==hit.id?LEVELS.find(l=>l.id===leg):null,f=gpsPlacesHere().find(p=>p.kind==='ferry');if(!f)return;
  const ok=gpsSet(Object.assign({},f,{name:'Fergen til '+hit.name,to:(via||hit).name}));setMapTab('island');
  if(ok)$('mapInfo').textContent=(via?'Det går ingen ferge rett til '+hit.name+'. Ta fergen til '+via.name+' først. ':'Kjør om bord på fergen og velg '+hit.name+'. ')+'Den blå pilen viser vei til kaia ('+gpsM(GPS.route.len)+').'}
// the quick buttons under the map: the big places on this island, and stop
function gpsChips(){const el=$('mGps');if(!el)return;if(MAP.tab==='arch'||!LV){el.innerHTML='';return}
  const list=gpsPlacesHere().filter(p=>p.kind!=='course'&&p.kind!=='label');
  el.innerHTML='<span>Vis vei til:</span>'+list.map(p=>`<button data-gps="${p.id}" aria-pressed="${!!(gpsLive()&&GPS.dest.id===p.id)}">${p.name}</button>`).join('')+(gpsLive()?'<button data-gps="stop" class="stop">Stopp GPS</button>':'')}
document.addEventListener('click',e=>{const b=e.target.closest('[data-gps]');if(!b)return;
  if(b.dataset.gps==='stop'){gpsStop();$('mapInfo').textContent='GPS-en er slått av. Trykk på kartet for å velge et nytt sted.';drawBigMap();return}
  const p=gpsPlacesHere().find(q=>q.id===b.dataset.gps);if(!p)return;const ok=gpsSet(p);drawBigMap();gpsChips();if(ok)$('mapInfo').textContent='GPS: '+p.name+' · '+gpsM(GPS.route.len)+'. Lukk kartet og følg den blå pilen.'});
