/* ===========================================================================
   GHOST: your best run, driven again beside you. In the courses (a pale car) and in the races on Racerøya (a pale racing car).
   The skier's ghost is in js/ski.js. «Spøkelse» in the settings turns all three off; the best run is still recorded while it is off.
   A run is saved as whole numbers, five samples a second, and only the newest GH_MAX runs are kept, so the storage does not fill up.
   =========================================================================== */
const GH_DT=.2,GH_MAX=24;
function ghSave(key,o){store.set('gh:'+key,o);let ix=store.get('ghIdx',[]).filter(k=>k!==key);ix.push(key);while(ix.length>GH_MAX){try{localStorage.removeItem('sgc:gh:'+ix.shift())}catch(e){ix.shift()}}store.set('ghIdx',ix)}
const ghLoad=key=>store.get('gh:'+key,null);
function setGhost(on){state.ghost=!!on;store.set('ghost',state.ghost);$('ghOn').setAttribute('aria-pressed',state.ghost);$('ghOff').setAttribute('aria-pressed',!state.ghost);if(!state.ghost){if(GH.mesh)GH.mesh.visible=false;if(typeof SKI!=='undefined')SKI.ghost=null}}

/* ---------- the courses: [x,y,z in cm, quaternion in thousandths] ---------- */
const GH={key:null,rec:[],acc:0,play:null,mesh:null,car:null,mat:null,qa:new THREE.Quaternion(),qb:new THREE.Quaternion()};
function ghostMesh(carId){if(GH.mesh&&GH.car===carId)return GH.mesh;
  if(GH.mesh){scene.remove(GH.mesh);GH.mesh.traverse(o=>{if(o.geometry)o.geometry.dispose()});GH.mesh=null}
  const ci=Math.max(0,CARS.findIndex(c=>c.id===carId)),tune=tuneFrom(prof.parts),cfg=Object.assign({},CARS[ci],{tune,flag:0}),g=new THREE.Group(),phys=makeCar(CARS[ci],tune);
  g.add(buildBody(cfg));phys.wheels.forEach((w,i)=>{const v=carWheel(cfg,i%2===0?1:-1,i>1);v.root.position.set(w.mount.x,restWheelY(cfg),w.mount.z);g.add(v.root)});
  if(!GH.mat)GH.mat=new THREE.MeshBasicMaterial({color:0xfff4d8,transparent:true,opacity:.3,depthWrite:false});
  g.traverse(o=>{if(o.isMesh)o.material=GH.mat});const m=netMerge(g);m.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;o.renderOrder=3}});
  m.visible=false;scene.add(m);GH.mesh=m;GH.car=carId;return m}
// every run starts here (resetRunState in js/game.js): a new recording, and the ghost of the best run if there is one
function ghostBegin(){GH.rec=[];GH.acc=0;GH.play=null;if(GH.mesh)GH.mesh.visible=false;
  if(state.free||state.mode==='menu'||!car||!LV){GH.key=null;return}
  const lvl=LEVELS[state.levelIdx];GH.key=state.course?courseKey(lvl,state.course):lvl.id;
  const g=state.ghost?ghLoad(GH.key):null;if(g&&g.d&&g.d.length>=35){try{ghostMesh(g.car);GH.play={d:g.d,n:g.d.length/7}}catch(e){GH.play=null}}}
function ghostTick(dt){if(!GH.key||state.free)return;
  if(state.started&&GH.rec.length<7*4000){GH.acc-=dt;if(GH.acc<=0){GH.acc+=GH_DT;const p=car.pos,q=car.q;GH.rec.push(Math.round(p.x*100),Math.round(p.y*100),Math.round(p.z*100),Math.round(q.x*1000),Math.round(q.y*1000),Math.round(q.z*1000),Math.round(q.w*1000))}}
  const P=GH.play,m=GH.mesh;if(!P||!m)return;
  const f=state.time/GH_DT,i=Math.min(P.n-2,Math.floor(f)),k=Math.min(1,f-i),d=P.d,a=i*7,b=a+7;
  if(f>P.n-1+3){m.visible=false;return}   // the ghost is in: it waits a moment at the finish, then goes
  m.position.set((d[a]+(d[b]-d[a])*k)/100,(d[a+1]+(d[b+1]-d[a+1])*k)/100,(d[a+2]+(d[b+2]-d[a+2])*k)/100);
  GH.qa.set(d[a+3],d[a+4],d[a+5],d[a+6]).normalize();GH.qb.set(d[b+3],d[b+4],d[b+5],d[b+6]).normalize();m.quaternion.copy(GH.qa).slerp(GH.qb,k);
  // it fades out when it is on top of your own car, so the start is not a white blur
  const dist=m.position.distanceTo(car.pos),o=.3*Math.max(0,Math.min(1,(dist-.9)/1.6));GH.mat.opacity=o;m.visible=state.ghost&&o>.01}
function ghostFinish(key,isBest){if(GH.mesh)GH.mesh.visible=false;GH.play=null;if(isBest&&key===GH.key&&GH.rec.length>=35)ghSave(key,{car:CARS[state.carIdx].id,d:GH.rec});GH.key=null}

/* ---------- Racerøya: [x,y in tenths, heading in hundredths], your fastest race on each track (one player, not online) ---------- */
const RGH={R:null,rec:[],t:0,acc:0,play:null,c:null};
function raceGhostTick(dt){if(RC.phase!=='race'||!RC.R)return;const me=RC.humans[0];if(!me)return;
  if(RGH.R!==RC.R){RGH.R=RC.R;RGH.rec=[];RGH.t=0;RGH.acc=0;const g=state.ghost&&!RC.two&&!RC.net?ghLoad('race/'+rcKey(RC.track)):null;RGH.play=g&&g.d&&g.d.length>=15?{d:g.d,n:g.d.length/3}:null;
    RGH.c={x:0,y:0,a:0,steer:0,col:'#f2e8d0',num:'',stripe:'#f2e8d0',human:true,name:''}}
  if(me.done)return;RGH.t+=dt;RGH.acc-=dt;if(RGH.acc<=0&&RGH.rec.length<3*3000){RGH.acc+=GH_DT;RGH.rec.push(Math.round(me.x*10),Math.round(me.y*10),Math.round(me.a*100))}}
function raceGhostDraw(x,t,view){const P=RGH.play;if(!P||!state.ghost||RGH.R!==RC.R||RC.phase==='result')return;
  const f=RGH.t/GH_DT,i=Math.min(P.n-2,Math.floor(f)),k=Math.min(1,f-i),d=P.d,a=i*3,b=a+3,c=RGH.c;if(f>P.n-1+2)return;
  c.x=(d[a]+(d[b]-d[a])*k)/10;c.y=(d[a+1]+(d[b+1]-d[a+1])*k)/10;let da=(d[b+2]-d[a+2])/100;da=Math.atan2(Math.sin(da),Math.cos(da));c.a=d[a+2]/100+da*k;
  const me=RC.humans[0],dist=me?Math.hypot(me.x-c.x,me.y-c.y):9;x.save();x.globalAlpha=.4*Math.max(0,Math.min(1,(dist-1.5)/3));if(x.globalAlpha>.01)rcCar(x,c,t,view);x.restore()}
function raceGhostSave(t,prevT){if(RC.two||RC.net||RGH.R!==RC.R||RGH.rec.length<15)return;if(!prevT||t<prevT||!ghLoad('race/'+rcKey(RC.track)))ghSave('race/'+rcKey(RC.track),{d:RGH.rec})}
