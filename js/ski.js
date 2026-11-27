'use strict';
/* =================================================================
   SKI: the ski resort in the game (Gautefall). The chairlift that always runs, the skier, and the trip:
   park on the blue square → ride the chairlift → pick a piste at the top → countdown → the run → result.
   Also the skier's model and pose, the ski cameras, the ski HUD (split times), the ghost of your best run and the ski sounds.
   The physics is in js/skier.js; the corduroy, the finish areas, the other skiers and the rest of the resort in js/skiresort.js.
   Loaded after world.js; uses the globals of game.js and world.js (state, LV, car, camera, toast …) at run time.
   ================================================================= */
const LIFT_SPEED=2.0,CHAIR_GAP=3.0;
const SKI={on:false,phase:'',s:makeSkier(),run:null,k:null,t:0,acc:0,vis:null,ride:0,count:0,fade:null,cam:0,camSnap:true,look:new V3(),camPos:new V3(),jumpPrev:false,result:false,beat:0,pinged:0,
  tracks:[{P:new V3(),surf:S.SNOW,lastTrk:null},{P:new V3(),surf:S.SNOW,lastTrk:null}],snd:null,lastNode:0,help:0,
  gear:[],bib:0,ghost:null,rec:[],recT:0,splitT:0,vyPrev:0,bump:0,cheer:0,ext:0,pre:0,shake:new V3()};
const SKI_CAMS=['Kamera: nært','Kamera: langt bak','Kamera: hjelmkamera'];
const skiOn=()=>SKI.on;
const PISTE_COL=['#3fae3a','#3fae3a','#2f6fd6','#d9432f','#1d1c1a'],PISTE_NAME=['','Grønn','Blå','Rød','Svart'];
const skiKey=k=>LEVELS[state.levelIdx].id+'/ski/'+k.id;

/* ---------- the chairlift ---------- */
// The loop: up the line beside the +p cable, round the top bullwheel, down the other cable, round the bottom bullwheel.
let LIFT=null;
function liftCableY(L,d){const n=L.nodes;if(d<=0)return n[0].y;for(let i=1;i<n.length;i++)if(d<=n[i].d){const a=n[i-1],b=n[i];return a.y+(b.y-a.y)*(d-a.d)/(b.d-a.d)}return n[n.length-1].y}
function liftAt(L,u,out){const arc=Math.PI*L.off,tot=2*L.len+2*arc;u=((u%tot)+tot)%tot;let d,s,yaw,ang;
  if(u<L.len){d=u;s=L.off;yaw=L.ry}
  else if(u<L.len+arc){ang=(u-L.len)/L.off;s=L.off*Math.cos(ang);const fw=Math.sin(ang)*L.off;out.set(L.bx+L.px*s+L.ux*fw,liftCableY(L,L.len),L.bz+L.pz*s+L.uz*fw);out.yaw=L.ry+ang;return out}
  else if(u<2*L.len+arc){d=2*L.len+arc-u;s=-L.off;yaw=L.ry+Math.PI}
  else{ang=(u-2*L.len-arc)/L.off;s=-L.off*Math.cos(ang);const bw=Math.sin(ang)*L.off;out.set(L.ax+L.px*s-L.ux*bw,liftCableY(L,0),L.az+L.pz*s-L.uz*bw);out.yaw=L.ry+Math.PI+ang;return out}
  out.set(L.ax+L.ux*d+L.px*s,liftCableY(L,d),L.az+L.uz*d+L.pz*s);out.yaw=yaw;return out}
const chairMat={seat:new THREE.MeshStandardMaterial({color:LIN('#2f6fd6'),roughness:.6}),frame:new THREE.MeshStandardMaterial({color:LIN('#3a3f44'),roughness:.5,metalness:.4})};
function buildLift(lv){LIFT=null;const L=lv.liftDef;if(!L)return;const tot=2*L.len+2*Math.PI*L.off,n=Math.floor(tot/CHAIR_GAP),gap=tot/n,chairs=[];
  // the cable: straight between the sheaves, half circles round the bullwheels
  const segs=[],P=(x,y,z)=>new V3(x,y,z);
  for(const s of[L.off,-L.off])for(let i=0;i<L.nodes.length-1;i++){const a=L.nodes[i],b=L.nodes[i+1];segs.push({a:P(L.ax+L.ux*a.d+L.px*s,a.y,L.az+L.uz*a.d+L.pz*s),b:P(L.ax+L.ux*b.d+L.px*s,b.y,L.az+L.uz*b.d+L.pz*s),r:.016,c:'#26292c'})}
  const _p=new V3();for(const[u0,len]of[[L.len,Math.PI*L.off],[2*L.len+Math.PI*L.off,Math.PI*L.off]])for(let i=0;i<8;i++){const a=liftAt(L,u0+len*i/8,new V3()),b=liftAt(L,u0+len*(i+1)/8,new V3());segs.push({a,b,r:.016,c:'#26292c'})}
  segMesh(segs);
  const H_=L.hang,B=(w,h,d,mat,x,y,z,p)=>{const m=new THREE.Mesh(boxGeo,mat);m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=true;p.add(m);return m};
  for(let i=0;i<n;i++){const g=new THREE.Group(),sw=new THREE.Group();g.add(sw);
    B(.1,.08,.16,chairMat.frame,0,-.02,0,sw);B(.03,H_,.03,chairMat.frame,0,-H_/2,-.05,sw);B(.95,.03,.03,chairMat.frame,0,-H_+.42,-.05,sw);
    for(const x of[-.47,.47])B(.03,.42,.03,chairMat.frame,x,-H_+.21,-.05,sw);
    B(.95,.06,.36,chairMat.seat,0,-H_,.12,sw);B(.95,.36,.05,chairMat.seat,0,-H_+.2,-.07,sw);
    B(.9,.03,.03,chairMat.frame,0,-H_+.36,.38,sw);B(.03,.03,.43,chairMat.frame,-.45,-H_+.36,.17,sw);B(.03,.03,.43,chairMat.frame,.45,-H_+.36,.17,sw);   // the safety bar
    B(.7,.03,.12,chairMat.frame,0,-H_-.3,.4,sw);B(.03,.33,.03,chairMat.frame,0,-H_-.14,.38,sw);                                                         // footrest
    levelGroup.add(g);chairs.push({g,sw,u0:i*gap})}
  LIFT={L,chairs,u:0,tot,gap,_p:new V3()}}
function updateLift(dt){if(!LIFT)return;LIFT.u+=LIFT_SPEED*dt;const L=LIFT.L,p=LIFT._p,tm=performance.now()*.001,cx=camera.position.x,cz=camera.position.z;
  for(let i=0;i<LIFT.chairs.length;i++){const c=LIFT.chairs[i];liftAt(L,LIFT.u+c.u0,p);c.g.position.copy(p);c.g.rotation.y=p.yaw;
    c.sw.rotation.x=.04*Math.sin(tm*1.3+i*1.7);c.g.visible=Math.abs(p.x-cx)+Math.abs(p.z-cz)<90}
  if(typeof updateResort==='function')updateResort(dt)}
// the u of chair 0 now, and where it is
const riderChair=()=>LIFT.chairs[0];

/* ---------- gates, start and finish on the pistes ---------- */
function buildPisteGates(lv){if(!lv.pistes)return;const flagGeo2=new THREE.PlaneGeometry(.42,.3);flagGeo2.translate(.21,0,0);
  for(const k of lv.pistes){const grp=new THREE.Group();
    k.gates.forEach((g,i)=>{const col=g.finish?'#1d1c1a':g.col,poleM=new THREE.MeshStandardMaterial({color:LIN(col),roughness:.5}),tall=k.kind==='slalom'&&!g.finish?1.05:2.5;   // banners high enough for the camera to pass under
      for(const e of[g.a,g.b]){const y=H(e.x,e.z),m=new THREE.Mesh(cylGeo,poleM);m.scale.set(.03,tall,.03);m.position.set(e.x,y+tall/2,e.z);m.castShadow=true;grp.add(m);
        if(k.kind==='slalom'&&!g.finish){const f=new THREE.Mesh(flagGeo2,new THREE.MeshStandardMaterial({color:LIN(col),side:THREE.DoubleSide,roughness:.6}));f.position.set(e.x,y+tall-.2,e.z);f.rotation.y=Math.atan2(g.tan.x,g.tan.z)+(e===g.a?-Math.PI/2:Math.PI/2);grp.add(f)}}
      if(g.finish){const ya=H(g.a.x,g.a.z),yb=H(g.b.x,g.b.z),w=Math.hypot(g.a.x-g.b.x,g.a.z-g.b.z),ban=new THREE.Mesh(new THREE.PlaneGeometry(w,.42),finishBanner());ban.position.set(g.c.x,Math.max(ya,yb)+2.3,g.c.z);ban.rotation.y=Math.atan2(g.tan.x,g.tan.z)+Math.PI;grp.add(ban)}
      else if(k.kind!=='slalom'){const w=Math.hypot(g.a.x-g.b.x,g.a.z-g.b.z),ya=H(g.a.x,g.a.z),yb=H(g.b.x,g.b.z),ban=new THREE.Mesh(boxGeo,new THREE.MeshStandardMaterial({color:LIN(PISTE_COL[k.def.color??k.diff]),roughness:.6}));
        ban.scale.set(w,.22,.03);ban.position.set(g.c.x,Math.max(ya,yb)+2.4,g.c.z);ban.rotation.y=Math.atan2(g.tan.x,g.tan.z);grp.add(ban)}});
    // the start: a banner over the line and a wand to push through
    const p=k.start.p,tn=k.start.tan,s=k.side(0),y=H(p.x,p.z),sp=new THREE.Mesh(new THREE.PlaneGeometry(k.hw*2,.4),startBanner(k));sp.position.set(p.x,y+2.3,p.z);sp.rotation.y=Math.atan2(tn.x,tn.z)+Math.PI;grp.add(sp);   // readable from the start hut
    for(const sd of[-1,1]){const m=new THREE.Mesh(cylGeo,postMat);m.scale.set(.04,2.5,.04);m.position.set(p.x+s.x*sd*k.hw,H(p.x+s.x*sd*k.hw,p.z+s.z*sd*k.hw)+1.25,p.z+s.z*sd*k.hw);grp.add(m)}
    levelGroup.add(grp)}}
function startBanner(k){const c=document.createElement('canvas');c.width=512;c.height=96;const x=c.getContext('2d');x.fillStyle=PISTE_COL[k.def.color??k.diff];x.fillRect(0,0,512,96);x.fillStyle='#f2e8d0';x.fillRect(6,6,500,84);
  x.fillStyle='#14120E';x.textAlign='center';x.textBaseline='middle';x.font='54px "Saira Stencil One", Impact, sans-serif';x.fillText('START · '+k.name.toUpperCase(),256,52);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return new THREE.MeshStandardMaterial({map:t,side:THREE.DoubleSide,roughness:.7})}

/* ---------- the skier ---------- */
// boxes set between two joints (bones), so the pose can be written as joint positions in the skier's own frame:
// feet on the snow at the origin, +z forward, +x to the left
const _ba=new V3(),_bb=new V3(),_bd=new V3();
function bone(m,a,b,t){_bd.copy(b).sub(a);const L=_bd.length()||1e-4;m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(YAX,_bd.divideScalar(L));m.scale.set(t,L,t)}
// a ski in its own group (origin under the binding): the plank, the turned-up tip, the tail, the binding and the boot.
// The group turns (plough, hockey stop, skating) and tips onto its edge (rotation order YZX: pitch, then edge, then turn).
function skiGroup(skiM,dark,bind){const g=new THREE.Group();g.rotation.order='YZX';
  const add=(mat,sx,sy,sz,x,y,z,rx=0)=>{const o=new THREE.Mesh(boxGeo,mat);o.scale.set(sx,sy,sz);o.position.set(x,y,z);o.rotation.x=rx;o.castShadow=true;g.add(o);return o};
  add(skiM,.075,.018,.84,0,.009,.03);add(skiM,.072,.016,.15,0,.035,.5,-.42);add(skiM,.072,.016,.07,0,.017,-.42,.22);add(bind,.06,.035,.22,0,.03,0);add(dark,.085,.1,.16,0,.075,.012);return g}
// a racing bib with a number on the back
function bibTexture(no){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#f4f4f0';x.fillRect(0,0,128,128);x.fillStyle='#d9432f';x.fillRect(0,0,128,16);
  x.fillStyle='#14120E';x.textAlign='center';x.textBaseline='middle';x.font='76px "Saira Stencil One", Impact, sans-serif';x.fillText(String(no),64,74);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t}
function makeSkierModel(col,o={}){
  const mat=c=>new THREE.MeshStandardMaterial({color:LIN(c),roughness:.6}),jacket=mat(col),pants=mat(o.pants||'#1f2a3a'),white=mat('#f2f2ee'),skiM=mat(o.ski||'#f2c230'),dark=mat('#1d1c1a'),bind=mat('#6d747a'),skin=mat('#d9a07a'),helm=mat(o.helmet||'#f2f2ee'),
    gog=new THREE.MeshStandardMaterial({color:LIN('#ff9a2a'),roughness:.1,metalness:.6}),bibM=o.bib?new THREE.MeshStandardMaterial({color:0xffffff,roughness:.7,map:bibTexture(o.bib)}):white;
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const M_=(m,geo)=>{const x=new THREE.Mesh(geo||boxGeo,m);x.castShadow=true;body.add(x);return x};
  const v={root,body,jacket,bibM,shinL:M_(pants),shinR:M_(pants),thighL:M_(pants),thighR:M_(pants),torso:M_(jacket),bib:M_(white),bibBack:M_(bibM),uaL:M_(jacket),uaR:M_(jacket),faL:M_(jacket),faR:M_(jacket),
    poleL:M_(dark),poleR:M_(dark),basketL:M_(dark,cylGeo),basketR:M_(dark,cylGeo),
    head:M_(skin,new THREE.SphereGeometry(1,12,10)),helmet:M_(helm,new THREE.SphereGeometry(1,12,8,0,Math.PI*2,0,Math.PI*.55)),goggles:M_(gog),gloveL:M_(dark),gloveR:M_(dark),
    skiGL:skiGroup(skiM,dark,bind),skiGR:skiGroup(skiM,dark,bind)};
  body.add(v.skiGL,v.skiGR);v.head.scale.setScalar(.062);v.helmet.scale.setScalar(.071);return v}
function buildSkierVis(){if(SKI.vis){SKI.vis.root.parent||scene.add(SKI.vis.root);return SKI.vis}
  const v=makeSkierModel('#d9432f',{bib:1});v.root.visible=false;scene.add(v.root);SKI.vis=v;
  // the skis and poles that fly off in a fall ("yard sale"): copies that lie where they land until the skier is up again
  const dark=new THREE.MeshStandardMaterial({color:LIN('#1d1c1a'),roughness:.6}),skiM=v.skiGL.children[0].material,bind=v.skiGL.children[3].material;
  SKI.gear=[skiGroup(skiM,dark,bind),skiGroup(skiM,dark,bind)].concat([0,1].map(()=>{const g=new THREE.Group(),m=new THREE.Mesh(boxGeo,dark);m.scale.set(.018,.6,.018);m.castShadow=true;g.add(m);return g}))
    .map(g=>{g.visible=false;scene.add(g);return{g,p:new V3(),v:new V3(),w:new V3(),on:false}});
  return v}
const sm1=x=>{x=x<0?0:x>1?1:x;return x*x*(3-2*x)};
// the pose. P: c = crouch 0…1, tk = tuck 0…1, seated (in the chair), inc = lean into the turn (radians, + left), ang = angulation (the upper body
// stays more upright than the legs), plow 0…1 (skis in a V), hock −1…1 (hockey stop: skis across), pole 0…1 (the double-pole stroke) with poleK
// 0…1 (how much of it), skate 0/1 (legs push out in turn), air 0/1 (arms out), spin 0/1 (arms in), wob 0…1 (arms windmill), ext 0…1 (stretch at take-off), t = time
function poseSkier(v,P){const J=(x,y,z)=>new V3(x,y,z),c=P.c||0,tk=P.tk||0,inc=P.inc||0,pl=P.plow||0,hk=P.hock||0,pk=P.poleK||0,t=P.t||0;
  let ankL,ankR,kneeL,kneeR,hipL,hipR,neck,tilt,hL,hR,tipL,tipR,yawL=0,yawR=0,pitch=0;
  if(P.seated){ankL=J(.075,-.3,.34);ankR=J(-.075,-.3,.34);kneeL=J(.075,.03,.3);kneeR=J(-.075,.03,.3);hipL=J(.06,.04,0);hipR=J(-.06,.04,0);tilt=-.08;
    neck=J(0,.04+.27,-.02);hL=J(.16,.3,.3);hR=J(-.16,.3,.3);tipL=J(.2,-.25,.3);tipR=J(-.2,-.25,.3);pitch=.22}
  else{const ext=P.ext||0,cr=Math.max(0,Math.max(c,tk*.9)-ext*.5),sk=P.skate?1:0,ph=P.pole||0,side=ph<.5?1:-1,push=sk*Math.sin(Math.PI*((ph*2)%1));
    // feet: wider and knees in for the plough, the pushing leg out to the side when skating, the inside ski a little ahead in a turn
    const fw=.075+.08*pl;ankL=J(fw+(side>0?.13*push:0),.055+(side>0?.03*push*push:0),.04*Math.max(0,inc)*2);ankR=J(-fw-(side<0?.13*push:0),.055+(side<0?.03*push*push:0),.04*Math.max(0,-inc)*2);
    const kw=.075+.02*pl,ky=.2-.05*cr;kneeL=J(kw+(side>0?.08*push:0),ky-.03*Math.max(0,inc),.07+.07*cr);kneeR=J(-kw-(side<0?.08*push:0),ky-.03*Math.max(0,-inc),.07+.07*cr);
    const shift=-side*.04*push,hy=.34-.12*cr+.03*ext,hz=-.02-.07*cr;hipL=J(.06+shift,hy,hz);hipR=J(-.06+shift,hy,hz);
    // the torso bends forward with the crouch and the tuck, and crunches over the poles in the push of a stroke
    const crunch=pk*(ph>.3&&ph<.65?Math.sin(Math.PI*(ph-.3)/.35):0);tilt=.22+.3*c+.85*tk+.4*crunch;neck=J(shift,hy+.26*Math.cos(tilt),hz+.26*Math.sin(tilt));
    yawL=-.28*pl+(side>0?.38*push:0);yawR=.28*pl-(side<0?.38*push:0);
    if(tk>.5){hL=J(.05,neck.y-.14,neck.z+.1);hR=J(-.05,neck.y-.14,neck.z+.1);tipL=J(.12,hL.y+.06,hL.z-.55);tipR=J(-.12,hR.y+.06,hR.z-.55)}
    else{hL=J(.15,hy+.1,hz+.2);hR=J(-.15,hy+.1,hz+.2);tipL=J(.18,.02,hL.z-.22);tipR=J(-.18,.02,hR.z-.22)}
    // the double-pole stroke: reach forward, plant, pull down past the hips, swing back
    if(pk>.01){const z=ph<.3?-.05+.35*sm1(ph/.3):ph<.65?.3-.5*sm1((ph-.3)/.35):-.2+.15*sm1((ph-.65)/.35),y=ph<.3?.1*sm1(ph/.3):ph<.65?.1-.15*sm1((ph-.3)/.35):-.05+.05*sm1((ph-.65)/.35);
      const planted=ph>.3&&ph<.65,tz=planted?.18-.5*sm1((ph-.3)/.35):z-.3,ty=planted?.02:hy-.1+y;
      for(const[h,tp,sx]of[[hL,tipL,1],[hR,tipR,-1]]){h.lerp(J(sx*.16,hy+.14+y,hz+.15+z),pk);tp.lerp(J(sx*.2,ty,tz),pk)}}
    // in the air: arms out for balance (in close while spinning); wobbling: arms windmill; take-off: arms forward
    if(P.air){const a=P.spin?.1:.3;hL.set(a,hy+.2,hz+.12);hR.set(-a,hy+.2,hz+.12);tipL.set(a+.06,hy-.05,hz-.2);tipR.set(-a-.06,hy-.05,hz-.2)}
    if(P.wob>.05){const w=P.wob,a=t*13;hL.lerp(J(.25+.08*Math.cos(a),hy+.22+.16*Math.sin(a),hz+.05+.1*Math.cos(a)),w);hR.lerp(J(-.25-.08*Math.cos(a+2),hy+.22+.16*Math.sin(a+2),hz+.05),w);tipL.copy(hL).add(J(.05,-.25,-.2));tipR.copy(hR).add(J(-.05,-.25,-.2))}
    if(ext>.05){hL.lerp(J(.14,hy+.25,hz+.3),ext);hR.lerp(J(-.14,hy+.25,hz+.3),ext);tipL.copy(hL).add(J(.04,-.3,-.25));tipR.copy(hR).add(J(-.04,-.3,-.25))}
    // hockey stop: legs and skis swing across, the upper body keeps facing down the hill
    if(Math.abs(hk)>.01){const a=hk*1.25,rot=(p,k)=>{const cs=Math.cos(a*k),sn=Math.sin(a*k),x=p.x,z=p.z;p.x=x*cs+z*sn;p.z=-x*sn+z*cs};
      for(const p of[ankL,ankR,kneeL,kneeR])rot(p,1);rot(hipL,.6);rot(hipR,.6);yawL+=a;yawR+=a}
    // lean into the turn round the feet; the upper body counter-leans round the hips (angulation)
    const lean=-(inc-.35*hk*Math.min(1,Math.abs(hk))),rz=(p,a,cx,cy)=>{const cs=Math.cos(a),sn=Math.sin(a),x=p.x-cx,y=p.y-cy;p.x=cx+x*cs-y*sn;p.y=cy+x*sn+y*cs};
    if(Math.abs(lean)>1e-3){for(const p of[ankL,ankR,kneeL,kneeR,hipL,hipR,neck,hL,hR,tipL,tipR])rz(p,lean,0,0);const cx=(hipL.x+hipR.x)/2,cy=(hipL.y+hipR.y)/2,back=-lean*(P.ang??.45);for(const p of[neck,hL,hR,tipL,tipR])rz(p,back,cx,cy)}
    v.skiGL.rotation.z=v.skiGR.rotation.z=lean*.9}
  if(P.seated)v.skiGL.rotation.z=v.skiGR.rotation.z=0;
  bone(v.shinL,ankL,kneeL,.07);bone(v.shinR,ankR,kneeR,.07);bone(v.thighL,kneeL,hipL,.08);bone(v.thighR,kneeR,hipR,.08);
  const pel=_ba.copy(hipL).add(hipR).multiplyScalar(.5);bone(v.torso,pel,neck,.15);v.torso.scale.z=.1;
  const up=_bb.copy(neck).sub(pel).normalize(),fw=J(0,-up.z,up.y).multiplyScalar(.052),bibA=pel.clone().lerp(neck,.3),bibB=pel.clone().lerp(neck,.75);
  bone(v.bib,bibA.clone().add(fw),bibB.clone().add(fw),.1);v.bib.scale.z=.01;bone(v.bibBack,bibA.sub(fw),bibB.sub(fw),.11);v.bibBack.scale.z=.01;
  const hd=neck.clone().addScaledVector(up,.075);v.head.position.copy(hd);v.helmet.position.copy(hd).add(J(0,.01,-.004));v.goggles.position.copy(hd).add(J(0,.012,.055));v.goggles.scale.set(.1,.035,.03);v.goggles.rotation.set(tilt*.5,0,0);
  const sw=J(-up.y,up.x,0).multiplyScalar(.1),shL=neck.clone().add(sw).add(J(0,-.03,0)),shR=neck.clone().sub(sw).add(J(0,-.03,0)),elL=shL.clone().lerp(hL,.5).add(J(.04,-.04,0)),elR=shR.clone().lerp(hR,.5).add(J(-.04,-.04,0));
  bone(v.uaL,shL,elL,.06);bone(v.uaR,shR,elR,.06);bone(v.faL,elL,hL,.055);bone(v.faR,elR,hR,.055);v.gloveL.position.copy(hL);v.gloveR.position.copy(hR);v.gloveL.scale.setScalar(.05);v.gloveR.scale.setScalar(.05);
  bone(v.poleL,hL,tipL,.018);bone(v.poleR,hR,tipR,.018);
  for(const[b,h,tp]of[[v.basketL,hL,tipL],[v.basketR,hR,tipR]]){b.position.copy(tp).lerp(h,.08);b.scale.set(.045,.008,.045);b.quaternion.copy(v.poleL.quaternion)}
  for(const[g,a,yaw]of[[v.skiGL,ankL,yawL],[v.skiGR,ankR,yawR]]){g.position.set(a.x,a.y-.055,a.z);g.rotation.y=yaw;g.rotation.x=pitch}}
function applySkierColor(){if(!SKI.vis)return;const p=PAINTS[prof.paint]||PAINTS[0];SKI.vis.jacket.color.set(p.c).convertSRGBToLinear()}
// a figure frozen in one pose as a single mesh with vertex colours (other skiers, people in the chairlift, the ghost): one draw call each
function figureGeo(col,P,o={}){const v=makeSkierModel(col,o);poseSkier(v,P);v.root.updateMatrixWorld(true);const pos=[],nrm=[],cols=[],cc=new THREE.Color(),nm=new THREE.Matrix3();
  v.root.traverse(m=>{if(!m.isMesh||m===v.bibBack&&!o.bib)return;const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrixWorld);const P2=g.attributes.position.array,N2=g.attributes.normal.array;cc.copy(m.material.color);
    for(let i=0;i<P2.length;i+=3){pos.push(P2[i],P2[i+1],P2[i+2]);nrm.push(N2[i],N2[i+1],N2[i+2]);cols.push(cc.r,cc.g,cc.b)}g.dispose()});
  v.root.traverse(m=>{if(m.isMesh&&m.geometry!==boxGeo&&m.geometry!==cylGeo)m.geometry.dispose();if(m.material)m.material.dispose()});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nrm,3));g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));g.computeBoundingSphere();return g}

/* ---------- the trip ---------- */
function fadeTo(cb,hold=.15){$('fade').classList.add('on');SKI.fade={t:0,cb,hold}}
function skiStart(){if(!LIFT)return;SKI.on=true;state.mode='ski';buildSkierVis();applySkierColor();skiBib(1+Math.floor(Math.random()*79));car.vel.set(0,0,0);car.w.set(0,0,0);car.throttle=0;
  $('hud').classList.add('ski');$('sName').textContent='Stolheisen';$('sTime').textContent='–';$('sGate').textContent='–';$('sPen').textContent='–';$('sPenL').textContent='Straff';
  SKI.phase='board';fadeTo(()=>{SKI.phase='lift';LIFT.u=-.3;SKI.ride=-.3;SKI.lastNode=0;SKI.vis.root.visible=true;SKI.camSnap=true;skiHint(document.body.classList.contains('is-touch')?'Stolheisen tar deg til toppen · trykk på hoppknappen for å hoppe over turen':'Stolheisen tar deg til toppen · <kbd>Enter</kbd> hopper over turen',4)})}
// at the top: the skier steps off beside the top station and picks a piste
function skiToTop(){SKI.phase='top';SKI.run=null;SKI.k=null;fadeTo(()=>{const L=LIFT.L,x=L.bx+L.ux*1.6,z=L.bz+L.uz*1.6;placeSkier(SKI.s,x,z,Math.atan2(L.ux,L.uz));SKI.vis.root.visible=true;SKI.camSnap=true;
  $('sName').textContent='Toppen';openAsk('skiPick')})}
// the run starts when the skier pushes through the start wand; the clock (and the ghost of your best run) starts with it
// quick: a restart of the same piste gets a short countdown (2, 1, go)
function skiPick(id,quick){const k=(LV.pistes||[]).find(p=>p.id===id);if(!k)return;SKI.k=k;SKI.phase='count';SKI.run=Object.assign(makeSkiRun(k),{started:false,splits:[],turnT:0,carveT:0,pops:0});SKI.rec=[];SKI.recT=0;SKI.ghost=state.ghost?skiLoadGhost(k):null;
  fadeTo(()=>{const s=SKI.s;placeSkier(s,k.start.p.x-k.start.tan.x*.3,k.start.p.z-k.start.tan.z*.3,Math.atan2(k.start.tan.x,k.start.tan.z));SKI.count=quick?1.7:3.2;SKI.beat=4;SKI.camSnap=true;SKI.vis.root.visible=true;gearReset();resortRun(k);
    $('sName').textContent=k.name;$('sGate').textContent='0/'+(k.gates.length-1);$('sTime').textContent='0:00.0';$('sPenL').textContent=k.kind==='hopp'?'Poeng':'Straff';$('sPen').textContent=k.kind==='hopp'?'0':'0 s';$('sSplit').hidden=true;
    skiHint((document.body.classList.contains('is-touch')?(k.kind==='hopp'?'Sving med pilene, og snurr i lufta · hoppknappen akkurat på hoppkanten gir ekstra høyde · land med skiene rett fram':'Sving jevnt med pilene for carving · pil ned er plog · pil opp er stavtak og hockestilling'):k.kind==='hopp'?'<kbd>←</kbd> <kbd>→</kbd> sving, og snurr i lufta · <kbd>mellomrom</kbd> akkurat på hoppkanten gir ekstra høyde · land med skiene rett fram':'<kbd>←</kbd> <kbd>→</kbd> sving: jevnt for carving · <kbd>↓</kbd> plog, med sving en hockeystopp · <kbd>↑</kbd> stavtak og hockestilling · <kbd>C</kbd> kamera')+(SKI.ghost?' · den lyse skiløperen er din beste tur':''),6)})}
function skiExit(){SKI.phase='exit';fadeTo(()=>{SKI.on=false;SKI.phase='';SKI.run=null;SKI.k=null;SKI.ghost=null;gearReset();resortRun(null);if(SKI.vis){SKI.vis.root.visible=false;scene.add(SKI.vis.root)}$('hud').classList.remove('ski');$('count').hidden=true;$('sHelp').hidden=true;$('sSplit').hidden=true;beacon.visible=false;
  state.mode='play';state.askCool='ski';camSnap=true;showHud();toast('Tilbake ved bilen');skiSoundOff()})}
function skiHint(html,sec){const el=$('sHelp');el.innerHTML=html;el.hidden=false;SKI.help=sec}
function skiBib(n){SKI.bib=n;const m=SKI.vis&&SKI.vis.bibM;if(!m||!m.map)return;m.map.dispose();m.map=bibTexture(n);m.needsUpdate=true}
// split times: at every gate, ahead of (green) or behind (red) your best run
function showSplit(d){const el=$('sSplit');el.textContent=(d<=0?'−':'+')+Math.abs(d).toFixed(2).replace('.',',');el.className='ski-split '+(d<=0?'ahead':'behind');el.hidden=false;SKI.splitT=2.4}
// the ghost: your best run in each piste, 15 samples a second [time, x, y, z, heading, lean, tuck], kept in localStorage
const skiGhostKey=k=>'ghost:'+skiKey(k);
function skiLoadGhost(k){const g=store.get(skiGhostKey(k),null);return g&&g.d&&g.d.length>=14?{d:g.d,n:g.d.length/7,i:0}:null}
function skiSaveGhost(k){if(SKI.rec.length>=14)store.set(skiGhostKey(k),{d:SKI.rec})}
// where the ghost is at run time t (interpolated); null before it starts or after it is done
function skiGhostAt(g,t,out){const d=g.d,n=g.n;if(t>d[(n-1)*7]+.6)return null;let i=Math.min(g.i,n-2);while(i>0&&d[i*7]>t)i--;while(i<n-2&&d[(i+1)*7]<=t)i++;g.i=i;
  const a=i*7,b=a+7,u=Math.max(0,Math.min(1,(t-d[a])/Math.max(1e-3,d[b]-d[a]))),L=(j)=>d[a+j]+(d[b+j]-d[a+j])*u;let dh=d[b+4]-d[a+4];dh=Math.atan2(Math.sin(dh),Math.cos(dh));
  out.x=L(1);out.y=L(2);out.z=L(3);out.head=d[a+4]+dh*u;out.inc=L(5);out.tuck=L(6);return out}

/* ---------- the ask dialog: start, pick a piste, pause ---------- */
function skiAsk(k){const L=LV.pistes||[];$('aYes').hidden=false;$('aList').hidden=true;$('aBest').textContent='';
  if(k==='ski'){const done=L.filter(p=>best[skiKey(p)]).length;$('aKind').textContent='Gautefall skisenter';$('aName').textContent='Stolheisen';
    $('aDesc').textContent='Parker bilen her og ta stolheisen til toppen. Der velger du en av '+L.length+' nedfarter: '+L.map(p=>p.name).join(', ')+'.';
    $('aBest').textContent=done?'Du har kjørt '+done+' av '+L.length+' nedfarter.':'Første tur gir bonus på hver nedfart.';$('aQ').textContent='Vil du stå på ski?';$('aNo').textContent='NEI, kjør videre';$('ask').hidden=false;$('aYes').focus();return}
  const item=(id,nm,sub,pr)=>`<button data-ski="${id}"><span><span class="nm">${nm}</span><span class="sub">${sub}</span></span><span class="pr">${pr}</span></button>`;
  if(k==='skiPick'){$('aKind').textContent='Toppen av Gautefall';$('aName').textContent='Velg nedfart';$('aDesc').textContent='Porter, tid og muttere. Faller du, reiser du deg der du falt, eller ved forrige port hvis du havnet utenfor løypa.';
    $('aList').innerHTML=L.map(p=>{const b=best[skiKey(p)],st=b?'★'.repeat(b.s)+'☆'.repeat(3-b.s):'☆☆☆';
      const sub=p.desc+(b?' Beste: '+(p.kind==='hopp'?b.pts+' poeng':fmtTime(b.t)):'');return item('pick:'+p.id,`<i class="pdot" style="background:${PISTE_COL[p.def.color??p.diff]}"></i>${p.name} <small>${PISTE_NAME[p.def.color??p.diff]}</small>`,sub,st)}).join('');
    $('aList').hidden=false;$('aYes').hidden=true;$('aQ').textContent='';$('aNo').textContent='Ta heisen ned til bilen';$('ask').hidden=false;const f=$('aList').querySelector('button');if(f)f.focus();return}
  if(k==='skiPause'){$('aKind').textContent=SKI.k?SKI.k.name:'Gautefall';$('aName').textContent='Pause';$('aDesc').textContent='';
    $('aList').innerHTML=(SKI.k?item('restart','Start løypa på nytt','Tilbake til starten av '+SKI.k.name+'.',''):'')+item('pick','Velg en annen nedfart','Opp til toppen igjen.','')+item('car','Tilbake til bilen','Heisen ned til parkeringsplassen.','');
    $('aList').hidden=false;$('aYes').hidden=true;$('aQ').textContent='';$('aNo').textContent='Fortsett';$('ask').hidden=false;$('aNo').focus()}}
function skiAnswer(k,yes){
  if(k==='ski'){if(yes)skiStart();else{state.mode='play';state.askCool='ski';toast('Kjør videre når du vil')}return}
  state.mode='ski';const a=yes&&yes.ski;
  if(k==='skiPick'){if(a&&a.startsWith('pick:'))skiPick(a.slice(5));else skiExit();return}
  if(k==='skiPause'){if(a==='restart')skiPick(SKI.k.id,true);else if(a==='pick')skiToTop();else if(a==='car')skiExit()}}

/* ---------- the result ---------- */
function skiFinish(){const k=SKI.k,run=SKI.run,hopp=k.kind==='hopp',t=run.time,tt=t+run.pen,par=k.def.par||[1e9,1e9];SKI.phase='done';SKI.t=0;
  const stars=hopp?(run.points>=par[0]?3:run.points>=par[1]?2:1):(tt<=par[0]&&!run.missed?3:tt<=par[1]?2:1);
  const key=skiKey(k),prev=best[key];let isBest=false;
  if(!prev||(hopp?run.points>prev.pts:tt<prev.t)){best[key]={t:tt,p:run.pen,s:Math.max(stars,prev?prev.s:0),pts:run.points,sp:run.splits};store.set('best',best);isBest=true;skiSaveGhost(k)}else if(stars>prev.s){prev.s=stars;store.set('best',best)}
  if(!hopp&&prev)showSplit(tt-prev.t);SKI.cheer=3;resortBoard(k,{t:tt,best:prev?(hopp?prev.pts:prev.t):null,isBest,pts:hopp?run.points:null});
  let e=run.passed*5;const el=[run.passed+' porter +'+run.passed*5];
  if(!run.missed&&!hopp){e+=25;el.push('ingen bom +25')}
  if(hopp&&run.points){const n=Math.round(run.points/10);e+=n;el.push(run.points+' poeng +'+n)}
  if(!prev){e+=60;el.push('første tur +60')}else if(isBest){e+=20;el.push('ny rekord +20')}
  prof.nuts+=e;saveProf();
  $('rLevel').textContent=LEVELS[state.levelIdx].name+' · '+k.name;$('rTitle').textContent=hopp?(run.points>=par[0]?'Storslått!':'I mål!'):(!run.missed&&!run.crashes?'Feilfri tur!':'I mål!');
  $('rTime').textContent=fmtTime(tt);$('rPenL').textContent=hopp?'Poeng':'Straff';$('rPen').textContent=hopp?run.points:'+'+run.pen+' s';$('rGatesL').textContent='Porter';$('rGates').textContent=run.passed+'/'+(k.gates.length-1);
  $('rStars').innerHTML=[0,1,2].map(i=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z" fill="${i<stars?'#E5A92B':'rgba(242,232,208,.15)'}"/></svg>`).join('');$('rStars').setAttribute('aria-label',stars+' av 3 stjerner');
  const items=[];if(run.missed)items.push(hopp?`<li><b>${run.missed} bom</b> (teller ikke i hoppløypa)</li>`:`<li><b>${run.missed} bom:</b> +${run.pen} sekunder</li>`);if(run.crashes)items.push(`<li><b>${run.crashes} fall</b></li>`);
  if(run.turnT>1)items.push(`<li><b>Carving:</b> ${Math.round(100*run.carveT/run.turnT)} % av svingene på kanten${run.carveT/run.turnT<.4?'. Sving jevnere, så holder kantene og du mister mindre fart':''}</li>`);
  if(run.pops)items.push(`<li><b>${run.pops} perfekt${run.pops>1?'e':''} sats</b> på hoppkanten</li>`);
  if(run.jumps.length)items.push(`<li><b>${run.jumps.length} hopp,</b> lengste ${Math.max(...run.jumps.map(j=>j.air)).toFixed(1).replace('.',',')} s i lufta${run.jumps.some(j=>j.spins)?', '+run.jumps.filter(j=>j.spins).map(j=>j.spins*360+'°').join(' og '):''}</li>`);
  items.push(`<li><b>Toppfart:</b> ${Math.round(run.top*9)} km/t</li>`);
  if(!hopp)items.push(`<li><b>Mål for stjerner:</b> ${fmtTime(par[0])} uten bom gir tre, ${fmtTime(par[1])} gir to</li>`);else items.push(`<li><b>Mål for stjerner:</b> ${par[0]} poeng gir tre, ${par[1]} gir to. Snurr 360° i lufta for +150, perfekt sats gir +50</li>`);
  if(isBest&&prev)items.push('<li><b>Ny personlig rekord i denne løypa.</b></li>');
  $('rLog').innerHTML=items.join('');$('rNuts').textContent='+'+fmtN(e);$('rNutsNote').textContent=el.join(' · ');
  $('rNext').textContent='Velg ny nedfart';$('rRetry').textContent='Prøv igjen';$('rMenu').textContent='Tilbake til bilen';$('rGarage').hidden=true;
  SKI.result=true;setTimeout(()=>{if(SKI.result&&SKI.phase==='done'){$('result').hidden=false;$('rRetry').focus()}},1100);toast('Mål! '+fmtTime(tt))}
function skiCloseResult(){SKI.result=false;$('result').hidden=true;$('rGarage').hidden=false;$('rMenu').textContent='Til menyen';$('rPenL').textContent='Straff';$('rGatesL').textContent='Porter'}
function skiResultBtn(b){if(!SKI.result)return false;skiCloseResult();if(b==='next')skiToTop();else if(b==='retry')skiPick(SKI.k.id,true);else skiExit();return true}

/* ---------- grooves the skis cut in the snow ---------- */
// thin lines when the skis carve, wide smears when they skid, deep and wide in powder; a V behind a snowplough
const GRV_N=1200,grvGeo=new THREE.PlaneGeometry(.045,.3);grvGeo.rotateX(-Math.PI/2);
const grooves=new THREE.InstancedMesh(grvGeo,new THREE.MeshBasicMaterial({color:LIN('#8fa6b8'),transparent:true,opacity:.32,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}),GRV_N);
grooves.count=0;grooves.frustumCulled=false;grooves.renderOrder=1;scene.add(grooves);let grvI=0;
function layGroove(w,dx,dz,wid=1){if(!w.lastTrk)w.lastTrk=new V3(1e9,0,1e9);if(w.lastTrk.distanceTo(w.P)<.2)return;w.lastTrk.copy(w.P);normalAt(w.P.x,w.P.z,_nT);_pT.copy(w.P).addScaledVector(_nT,.012);
  _qN.setFromUnitVectors(YAX,_nT);_qY.setFromAxisAngle(YAX,Math.atan2(dx,dz));_qN.multiply(_qY);_sT.set(wid,1,1);_m4.compose(_pT,_qN,_sT);grooves.setMatrixAt(grvI,_m4);grvI=(grvI+1)%GRV_N;grooves.count=Math.max(grooves.count,grvI||GRV_N);grooves.instanceMatrix.needsUpdate=true}

/* ---------- the skis and poles that fly off in a fall ---------- */
function gearFly(){const s=SKI.s,v=SKI.vis;if(!v||!SKI.gear.length)return;const dx=Math.sin(s.head),dz=Math.cos(s.head);
  SKI.gear.forEach((o,i)=>{o.on=true;o.rest=false;o.g.visible=true;const sd=i%2?-1:1;o.p.set(s.pos.x+dz*sd*.1,s.pos.y+(i<2?.05:.35),s.pos.z-dx*sd*.1);
    o.v.set(s.vel.x*(.5+Math.random()*.4)+(Math.random()-.5)*2,1.2+Math.random()*2.2,s.vel.z*(.5+Math.random()*.4)+(Math.random()-.5)*2);o.w.set((Math.random()-.5)*14,(Math.random()-.5)*10,(Math.random()-.5)*14);o.g.rotation.set(0,s.head,0)});
  for(const m of[v.skiGL,v.skiGR,v.poleL,v.poleR,v.basketL,v.basketR])m.visible=false}
function gearReset(){for(const o of SKI.gear){o.on=false;o.g.visible=false}const v=SKI.vis;if(v)for(const m of[v.skiGL,v.skiGR,v.poleL,v.poleR,v.basketL,v.basketR])m.visible=true}
function updateGear(dt){for(const o of SKI.gear){if(!o.on||o.rest)continue;o.v.y-=SKI_G*dt;o.g.position.copy(o.p.addScaledVector(o.v,dt));o.g.rotation.x+=o.w.x*dt;o.g.rotation.y+=o.w.y*dt;o.g.rotation.z+=o.w.z*dt;
  const h=H(o.p.x,o.p.z)+.02;if(o.p.y<h){o.p.y=h;o.v.y=-o.v.y*.3;o.v.x*=.55;o.v.z*=.55;o.w.multiplyScalar(.5);if(Math.hypot(o.v.x,o.v.y,o.v.z)<.6){o.rest=true;o.g.rotation.set(o.g.children.length>1?0:Math.PI/2,o.g.rotation.y,0);o.g.position.copy(o.p)}}}}
// up again after a fall: where you fell if that is on the piste and clear of trees, otherwise back at the last gate
function skiResume(){const s=SKI.s,run=SKI.run,k=SKI.k,x=s.pos.x,z=s.pos.z;
  const ok=groomedAt(x,z)&&WL(x,z)<H(x,z)&&!G.colliders.some(c=>Math.hypot(c.x-x,c.z-z)<(c.r??Math.hypot(c.w,c.d)/2)+.5);
  if(ok){const tn=k.T(Math.min(1,k.tOf(x,z)+.004));placeSkier(s,x,z,Math.atan2(tn.x,tn.z))}else placeSkier(s,run.cp.x,run.cp.z,run.cp.h);
  SKI.camSnap=true;gearReset()}

/* ---------- every frame ---------- */
function skiKeyDown(k){if(SKI.fade)return;
  if(SKI.result)return;
  if(k==='escape'||k==='p'){if(SKI.phase==='run'||SKI.phase==='count'||SKI.phase==='lift')openAsk('skiPause');return}
  if(SKI.phase==='lift'&&(k==='enter'||k===' ')){SKI.phase='skip';fadeTo(()=>skiArrive());return}
  if(k==='c'){SKI.cam=(SKI.cam+1)%SKI_CAMS.length;toast(SKI_CAMS[SKI.cam]);SKI.camSnap=true}
  if(k==='m')setSound(!state.sound)}
function skiArrive(){SKI.phase='top';const L=LIFT.L,x=L.bx+L.ux*1.6,z=L.bz+L.uz*1.6;placeSkier(SKI.s,x,z,Math.atan2(L.ux,L.uz));SKI.camSnap=true;$('sName').textContent='Toppen';openAsk('skiPick')}
const _sp=new V3(),_sq=new Q4(),_se=new THREE.Euler(),_gh={};
function updateSki(dt){if(!SKI.on)return;
  // fades: dark, then the change, then light again
  if(SKI.fade){const f=SKI.fade;f.t+=dt;if(f.t>.9&&!f.done){f.done=true;f.cb()}if(f.t>.9+f.hold){$('fade').classList.remove('on');SKI.fade=null}}
  if(SKI.phase==='lift'&&state.inp&&state.inp.jump&&!SKI.fade){SKI.phase='skip';fadeTo(()=>skiArrive())}   // the jump button on a phone and the gamepad skip the lift, as Enter does
  if(SKI.help>0){SKI.help-=dt;if(SKI.help<=0)$('sHelp').hidden=true}
  if(SKI.splitT>0){SKI.splitT-=dt;if(SKI.splitT<=0)$('sSplit').hidden=true}
  const s=SKI.s,v=SKI.vis,inp=state.inp||{gas:0,rev:0,steer:0,jump:false},act=state.mode==='ski',now=performance.now()*.001;
  if(SKI.phase==='lift'&&act){SKI.ride=LIFT.u;const L=LIFT.L;
    for(const n of L.nodes)if(n.d>SKI.lastNode+.01&&SKI.ride>=n.d&&n.d>0&&n.d<L.len){SKI.lastNode=n.d;skiTick()}
    if(SKI.ride>=L.len-.25){SKI.phase='skip';fadeTo(()=>skiArrive(),.1)}}
  if(SKI.phase==='count'&&act&&!SKI.fade){SKI.count-=dt;const n=Math.ceil(SKI.count-.2);const el=$('count');
    if(n<SKI.beat&&n>=1){SKI.beat=n;el.hidden=false;el.textContent=String(n);el.style.animation='none';void el.offsetWidth;el.style.animation='';skiBeep(640,.12)}
    if(SKI.count<=0){SKI.phase='run';const st=SKI.k.start.tan;SKI.s.vel.set(st.x*1.6,0,st.z*1.6);el.textContent='KJØR!';skiBeep(980,.35);clearTimeout(el._t);el._t=setTimeout(()=>{el.hidden=true},900)}}
  if((SKI.phase==='run'||SKI.phase==='done')&&act){const run=SKI.run,k=SKI.k,jump=inp.jump&&!SKI.jumpPrev;SKI.jumpPrev=inp.jump;
    const auto=SKI.phase==='done',I={steer:auto?0:inp.steer,gas:auto?0:inp.gas,brake:auto?1:inp.rev,jump:!auto&&jump},st=k.start;
    SKI.acc+=dt;let n=0;const p1={x:s.pos.x,z:s.pos.z};
    while(SKI.acc>=FIXED&&n<20){stepSkier(s,I,FIXED,{assist:state.assist,tricks:k.kind==='hopp'});I.jump=false;SKI.acc-=FIXED;n++;
      for(const e of s.ev)skiEvent(e);s.ev.length=0;
      if(!auto&&!run.started&&(s.pos.x-st.p.x)*st.tan.x+(s.pos.z-st.p.z)*st.tan.z>0){run.started=true;skiStartWand()}
      if(!auto)for(const e of skiGates(run,p1,s.pos,state.assist?2:5))skiGateEvent(e);p1.x=s.pos.x;p1.z=s.pos.z;if(SKI.phase!=='run'&&!auto)break}
    if(n>=20)SKI.acc=0;
    if(!auto&&run.started){run.time+=dt;run.top=Math.max(run.top||0,s.speed);if(Math.abs(s.inc)>.15&&!s.air&&s.crashT===0){run.turnT+=dt;if(s.carve>.6)run.carveT+=dt}
      // record the run for the ghost
      SKI.recT-=dt;if(SKI.recT<=0&&SKI.rec.length<7*15*240){SKI.recT=1/15;SKI.rec.push(+run.time.toFixed(2),+s.pos.x.toFixed(2),+s.pos.y.toFixed(2),+s.pos.z.toFixed(2),+s.head.toFixed(2),+s.inc.toFixed(2),s.tuck>.5?1:0)}}
    // other skiers on the piste: run into one and you both go down (in the easy mode you are only pushed aside)
    if(!auto&&s.crashT===0&&typeof resortHit==='function'&&resortHit(s,state.assist))skiCrash(s,'Krasjet med en skiløper');
    // a fall: tumble and slide, lie still a moment, get up
    if(s.crashT>(auto?1.3:2.1)){if(!auto)skiResume();else{s.crashT=0;s.vel.set(0,0,0)}}
    // snow spray when the edges bite, skid or plough, a cloud in powder; tracks in the snow
    const deep=!s.groomed&&s.surf===S.SNOW,ah=Math.abs(s.hock),dx=Math.sin(s.head),dz=Math.cos(s.head);
    if(!s.air&&s.crashT===0){const amt=(s.skid>.9?1:0)+(s.plow>.5&&s.speed>1.2?.8:0)+ah*2.5*Math.min(1,s.speed/2)+(deep&&s.speed>1.2?1.5:0)+(s.carve>.6&&Math.abs(s.inc)>.3&&s.speed>3?.5:0);
      if(amt>0&&Math.random()<dt*30*amt){_sp.copy(s.pos);if(ah>.3){_sp.x-=dz*Math.sign(s.hock)*.25;_sp.z+=dx*Math.sign(s.hock)*.25}spawnDust(_sp,99,s.skid>2||ah>.5||deep)}}
    if(!s.air&&s.crashT===0&&s.speed>.4&&tracks.visible){const wid=deep?3.2:ah>.3?4:s.skid>1.2?2.2:1,pl=s.plow;
      for(let i=0;i<2;i++){const w=SKI.tracks[i],sd=i?-1:1,off=.075+.07*pl,yaw=s.head+sd*-.28*pl,ex=Math.sin(yaw),ez=Math.cos(yaw);w.P.set(s.pos.x+dz*sd*off,s.pos.y,s.pos.z-dx*sd*off);layGroove(w,ex,ez,wid)}}
    // the HUD
    $('sTime').textContent=fmtTime(run.time);$('sGate').textContent=Math.min(run.passed,k.gates.length-1)+'/'+(k.gates.length-1);$('sPen').textContent=k.kind==='hopp'?String(run.points):run.pen+' s';$('sSpeed').textContent=Math.round(s.speed*9)+' km/t';
    if(auto){SKI.t+=dt}}
  // the skier's place and pose
  updateGear(dt);SKI.ext=Math.max(0,SKI.ext-dt*4);SKI.cheer=Math.max(0,SKI.cheer-dt);
  if(v&&v.root.visible){
    if(SKI.phase==='lift'||(SKI.phase==='skip'&&SKI.fade)){const c=riderChair();c.g.updateMatrixWorld(true);v.root.position.set(.24,-LIFT.L.hang+.03,.06);c.sw.add(v.root);v.root.rotation.set(0,0,0);v.body.rotation.set(0,0,0);poseSkier(v,{seated:true})}
    else{if(v.root.parent!==scene)scene.add(v.root);const dx=Math.sin(s.head),dz=Math.cos(s.head),going=SKI.phase==='run'||SKI.phase==='done';
      const slope=s.air?Math.atan2(s.vy,Math.max(1,s.speed))*.6:Math.atan2(H(s.pos.x+dx*.3,s.pos.z+dz*.3)-H(s.pos.x-dx*.3,s.pos.z-dz*.3),.6);
      // crouch before the lip of a kicker, sink into powder
      const kk=!s.air&&going?skiKickerAt(s.pos.x,s.pos.z,s.vel.x,s.vel.z):null;SKI.pre+=((kk&&kk.a>-1&&kk.a<0?1:0)-SKI.pre)*Math.min(1,dt*8);
      const sink=!s.air&&!s.groomed&&s.surf===S.SNOW&&s.crashT===0?.035:0;
      v.root.position.copy(s.pos);v.root.position.y-=s.land*.03+sink;v.root.rotation.set(-slope,s.head,0,'YXZ');
      if(s.crashT>0){// tumble (a full roll when it was fast), lie still, get up
        const ct=s.crashT,k2=Math.min(1,ct*3),roll=(SKI.crashFast?sm1(ct/.8)*Math.PI*2:0),up=sm1((ct-1.4)/.7);v.body.rotation.set((-k2*1.2-roll)*(1-up),0,k2*1.3*(1-up));poseSkier(v,{c:1-.6*up,t:now})}
      else{v.body.rotation.set(0,0,0);
        poseSkier(v,{c:Math.min(1,s.plow*.5+s.land+SKI.pre*.6+(s.air?.4:.15)),tk:s.tuck,inc:going?s.inc:0,plow:s.plow,hock:s.hock,pole:s.pole,poleK:going?s.poleK:0,skate:s.flat>.5&&s.poleK>.5&&s.speed>.9,air:s.air,spin:Math.abs(s.spinV)>2,wob:s.wob,ext:SKI.ext,t:now})}}}
  // the next gate glows
  if(SKI.phase==='run'&&SKI.run){const g=SKI.k.gates[SKI.run.next];if(g){beacon.visible=true;beacon.position.set(g.c.x,H(g.c.x,g.c.z),g.c.z);beacon.userData.ring.scale.setScalar(g.w/1.2*(1+.08*Math.sin(performance.now()*.005)))}else beacon.visible=false}else beacon.visible=false;
  arrow.visible=false;
  // the ghost of your best run: waits at the start until you push off, then skis with your clock
  if(typeof resortGhost==='function')resortGhost(SKI.ghost&&SKI.run&&(SKI.phase==='count'||SKI.phase==='run')?skiGhostAt(SKI.ghost,SKI.run.started?SKI.run.time:0,_gh):null);
  updateSkiSound(dt)}
function skiStartWand(){skiClick(.6);if(typeof resortWand==='function')resortWand()}
function skiEvent(e){const run=SKI.run,s=SKI.s;if(!run)return;
  if(e.type==='crash'){run.crashes=(run.crashes||0)+1;SKI.crashFast=s.speed>3.5;toast(e.why+'!',true);ambThump(1);for(let i=0;i<10;i++)spawnDust(s.pos,99,true);landShake=.04;if(s.speed>2.2)gearFly()}
  if(e.type==='takeoff'){SKI.ext=1;SKI.pop=!!e.pop;if(e.pop){run.pops++;toast('Perfekt sats!')}}
  if(e.type==='pole')skiClick(.25);
  if(e.type==='land'){if(e.hard>3)ambThump(Math.min(1,e.hard/8));if(e.hard>4.5)landShake=Math.min(.04,e.hard*.005);for(let i=0;i<Math.min(10,e.hard*1.5|0);i++)spawnDust(s.pos,99,true);
    if(e.air>.35){run.jumps.push(e);if(SKI.k.kind==='hopp'){const p=skiJumpPoints(e.air,e.spins,SKI.pop);run.points+=p;toast((e.spins?e.spins*360+'°! ':SKI.pop?'Perfekt sats! ':'Hopp! ')+e.air.toFixed(1).replace('.',',')+' s · +'+p+' poeng')}
      else if(e.air>.5)toast('Hopp! '+e.air.toFixed(1).replace('.',',')+' s')}
    if(e.wob)toast('Hold balansen!',true)}}
function skiGateEvent(e){const run=SKI.run,k=SKI.k;
  if((e.type==='gate'||e.type==='miss')&&run.splits){run.splits[e.i]=+(run.time+run.pen).toFixed(2);const b=best[skiKey(k)];if(k.kind!=='hopp'&&b&&b.sp&&b.sp[e.i]!=null)showSplit(run.splits[e.i]-b.sp[e.i])}
  if(e.type==='gate'){ambGate();if(k.kind!=='slalom')toast('Port '+(e.i+1)+' ✓')}
  if(e.type==='miss'){toast('Bom på port '+(e.i+1)+(k.kind==='hopp'?'':' · +'+(state.assist?2:5)+' s'),true);skiBeep(180,.25)}
  if(e.type==='finish'){skiBeep(1180,.25);setTimeout(()=>skiBeep(1480,.4),180);skiFinish()}}

/* ---------- the ski camera ---------- */
// three cameras on C: close behind, far behind, and a helmet camera from the skier's goggles that leans with them
const _cA=new V3(),_cB=new V3(),_cH=new V3();
// speed streaks: specks of snow in the air that streak past the camera when you go fast (high graphics only)
const SPD_N=70,spdPos=new Float32Array(SPD_N*6),spdGeo=new THREE.BufferGeometry(),spdP=[];spdGeo.setAttribute('position',new THREE.BufferAttribute(spdPos,3));
const spdLines=new THREE.LineSegments(spdGeo,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false,fog:false}));spdLines.frustumCulled=false;spdLines.visible=false;scene.add(spdLines);
for(let i=0;i<SPD_N;i++)spdP.push(new V3(1e9,0,0));
function updateStreaks(dx,dz){const s=SKI.s,sp=s.speed,on=state.gfx==='hi'&&SKI.phase==='run'&&sp>3.5&&s.crashT===0;spdLines.visible=on;if(!on)return;
  const cam=camera.position,k=.035,vy=s.air?s.vy:0;
  for(let i=0;i<SPD_N;i++){const p=spdP[i],rx=p.x-cam.x,rz=p.z-cam.z,ahead=rx*dx+rz*dz;
    if(ahead<-.5||ahead>9.5||Math.hypot(rx,p.y-cam.y,rz)>10){const a=Math.random()*6.283,r=.5+Math.random()*2.2,f=2+Math.random()*7.5;p.set(cam.x+dx*f+Math.cos(a)*r*dz,cam.y+Math.sin(a)*r*.7,cam.z+dz*f-Math.cos(a)*r*dx)}
    spdPos[i*6]=p.x;spdPos[i*6+1]=p.y;spdPos[i*6+2]=p.z;spdPos[i*6+3]=p.x+s.vel.x*k;spdPos[i*6+4]=p.y+vy*k;spdPos[i*6+5]=p.z+s.vel.z*k}
  spdGeo.attributes.position.needsUpdate=true;spdLines.material.opacity=Math.min(.45,(sp-3.5)*.08)}
function skiCamera(dt){const s=SKI.s,v=SKI.vis;let snap=SKI.camSnap,helmet=false,dx=Math.sin(s.head),dz=Math.cos(s.head);SKI.camSnap=false;
  if(SKI.phase==='lift'||SKI.phase==='board'||(SKI.phase==='skip'&&SKI.fade&&!SKI.fade.done)){const L=LIFT.L,c=riderChair().g.position;
    _cA.set(c.x-L.ux*2.4-L.px*1.1,c.y-.15,c.z-L.uz*2.4-L.pz*1.1);_cB.set(c.x+L.ux*2.2,c.y-.6,c.z+L.uz*2.2);camera.fov=52}
  else if(SKI.phase==='top'&&state.mode==='ask'){const a=performance.now()*.00015;_cA.set(s.pos.x+Math.sin(a)*3.4,s.pos.y+1.6,s.pos.z+Math.cos(a)*3.4);_cB.copy(s.pos).add(_c2.set(0,.5,0));camera.fov=46}
  else{const sp=s.speed;if(sp>1.2&&!s.air){const vx=s.vel.x/sp,vz=s.vel.z/sp;dx=dx*.35+vx*.65;dz=dz*.35+vz*.65;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l}
    if(s.air||s.crashT>0){dx=SKI.camDir?SKI.camDir.x:dx;dz=SKI.camDir?SKI.camDir.z:dz}SKI.camDir={x:dx,z:dz};
    if(SKI.cam===2&&v&&s.crashT===0){// the helmet camera sits on the head and looks down past the ski tips
      helmet=true;v.root.updateMatrixWorld(true);v.head.getWorldPosition(_cH);_cA.set(_cH.x+dx*.07,_cH.y+.03,_cH.z+dz*.07);_cB.set(_cA.x+dx*3,_cA.y-.75,_cA.z+dz*3);camera.fov=72+Math.min(10,sp*.9)}
    else{const D=SKI.cam?4.6:2.5;_cH.set(s.pos.x,s.pos.y+.55,s.pos.z);_cA.set(s.pos.x-dx*D,s.pos.y+.75+D*.32,s.pos.z-dz*D);
      // pull the camera in when a tree, a hut or a mast stands between it and the skier
      const bx=_cA.x-_cH.x,bz=_cA.z-_cH.z,L2=bx*bx+bz*bz;let hit=1;
      for(const c of G.colliders){if(c.net||(!c.anchor&&c.r!=null&&c.r<.1))continue;const ex=c.x-_cH.x,ez=c.z-_cH.z;if(Math.abs(ex)>D+2||Math.abs(ez)>D+2)continue;const u=(ex*bx+ez*bz)/L2;if(u<=0||u>=1)continue;
        const r=(c.r??Math.hypot(c.w,c.d)*.42)+.22,qx=_cH.x+bx*u-c.x,qz=_cH.z+bz*u-c.z;if(qx*qx+qz*qz<r*r)hit=Math.min(hit,u-.1)}
      if(hit<1){const u=Math.max(.3,hit);_cA.set(_cH.x+bx*u,_cH.y+(_cA.y-_cH.y)*u,_cH.z+bz*u)}
      _cA.y=Math.max(_cA.y,H(_cA.x,_cA.z)+.45);_cB.set(s.pos.x+dx*1.4,s.pos.y+.3,s.pos.z+dz*1.4);camera.fov=56+Math.min(14,sp*1.6)}}
  if(snap||helmet){SKI.camPos.copy(_cA);SKI.look.copy(_cB)}else{const k=1-Math.exp(-dt*(SKI.phase==='lift'?6:5.5));SKI.camPos.lerp(_cA,k);SKI.look.lerp(_cB,1-Math.exp(-dt*10))}
  // the camera shakes more the faster you go, on ice, over bumps (jolts in the skier's vertical speed) and in a hockey stop
  const gnd=(SKI.phase==='run'||SKI.phase==='done')&&!s.air&&s.crashT===0;SKI.bump+=(Math.min(4,Math.abs(s.vy-SKI.vyPrev)/Math.max(dt,1e-3)*.02)-SKI.bump)*Math.min(1,dt*10);SKI.vyPrev=s.vy;
  const amp=gnd?Math.min(.035,Math.min(1,s.speed/10)*.006+(s.surf===S.ICE?.007*Math.min(1,s.speed/4):0)+SKI.bump*.006+Math.abs(s.hock)*.005)*(helmet?.6:1):0;
  SKI.shake.set((Math.random()-.5)*amp,(Math.random()-.5)*amp,(Math.random()-.5)*amp);camera.position.copy(SKI.camPos).add(SKI.shake);
  if(helmet){const a=s.inc*.55;camera.up.set(Math.cos(s.head)*Math.sin(a),Math.cos(a),-Math.sin(s.head)*Math.sin(a))}else camera.up.set(0,1,0);
  camera.lookAt(SKI.look);camera.updateProjectionMatrix();
  if(v)v.head.visible=v.helmet.visible=v.goggles.visible=!helmet;
  updateStreaks(dx,dz)}

/* ---------- sounds: the swish of the skis, the hiss of a carve, the scrape of the edges, powder, the wind, the crowd and the cowbells ---------- */
function skiSound(){if(SKI.snd||!AC||typeof noiseBuf!=='function')return SKI.snd;try{const ac=AC,buf=noiseBuf(ac),mk=(type,f,Q)=>{const fl=ac.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=Q;const g=ac.createGain();g.gain.value=0;noiseSrc(ac,buf).connect(fl);fl.connect(g);g.connect(ac.destination);return{f:fl,g}};
  SKI.snd={swish:mk('bandpass',900,.9),scrape:mk('highpass',2800,.8),wind:mk('lowpass',420,.6),carve:mk('bandpass',2200,2.2),powder:mk('lowpass',320,.7),crowd:mk('bandpass',850,.5)}}catch(e){SKI.snd=null}return SKI.snd}
function updateSkiSound(dt){const S_=skiSound();if(!S_)return;const t=AC.currentTime,s=SKI.s,on=state.sound&&SKI.on&&state.mode==='ski'&&(SKI.phase==='run'||SKI.phase==='done'),vol=state.volCar/70,set=(g,v)=>g.gain.setTargetAtTime(v,t,.08);
  // the crowd at the finish: louder the closer you come, a cheer when you cross the line
  let crowd=0;const k=SKI.k;if(state.sound&&SKI.on&&state.mode==='ski'&&k&&(SKI.phase==='run'||SKI.phase==='done')){const f=k.gates[k.gates.length-1].c;crowd=(1-sm1((Math.hypot(f.x-s.pos.x,f.z-s.pos.z)-3)/16))*.035+SKI.cheer*.025}
  set(S_.crowd.g,crowd*state.volAmb/70*(.75+.25*Math.sin(t*2.3)*Math.sin(t*.7)));if(crowd>.005&&Math.random()<dt*crowd*70)skiCowbell(crowd);
  if(!on){for(const n of['swish','scrape','carve','powder'])set(S_[n].g,0);set(S_.wind.g,SKI.on&&state.sound&&SKI.phase==='lift'?.03*vol:0);return}
  const sp=s.speed,gnd=!s.air&&s.crashT===0,deep=!s.groomed&&s.surf===S.SNOW,hard=s.surf===S.SNOW&&s.groomed,ah=Math.abs(s.hock);
  S_.swish.f.frequency.setTargetAtTime(500+sp*150,t,.1);set(S_.swish.g,gnd&&!deep?.07*Math.min(1,sp/6)*vol:0);
  S_.carve.f.frequency.setTargetAtTime(1800+sp*90,t,.1);set(S_.carve.g,gnd&&hard?s.carve*Math.min(1,Math.abs(s.inc)*2)*Math.min(1,sp/5)*.06*vol:0);
  set(S_.scrape.g,gnd?Math.min(.1,(Math.max(0,s.skid-.5)*.03+(s.surf===S.ICE?.03*Math.min(1,sp/4):0)+s.plow*.03*Math.min(1,sp/3)+ah*.06*Math.min(1,sp/2)))*vol:0);
  set(S_.powder.g,gnd&&deep?.09*Math.min(1,sp/4)*vol:0);
  set(S_.wind.g,(.012+.05*Math.min(1,sp/8))*vol*(s.air?1.6:1))}
function skiSoundOff(){if(!SKI.snd||!AC)return;const t=AC.currentTime;for(const k in SKI.snd)SKI.snd[k].g.gain.setTargetAtTime(0,t,.1)}
function skiBeep(f,d){if(!AC||!state.sound)return;const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type='triangle';o.frequency.value=f;o.connect(g);g.connect(AC.destination);const v=.08*state.volAmb/70;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.01);g.gain.setValueAtTime(v,t+d*.7);g.gain.linearRampToValueAtTime(0,t+d);o.start(t);o.stop(t+d+.02)}
function skiTick(){if(!AC||!state.sound)return;const t=AC.currentTime;for(const dd of[0,.09]){const o=AC.createOscillator(),g=AC.createGain();o.type='square';o.frequency.value=140;o.connect(g);g.connect(AC.destination);g.gain.setValueAtTime(.03*state.volAmb/70,t+dd);g.gain.exponentialRampToValueAtTime(.0005,t+dd+.06);o.start(t+dd);o.stop(t+dd+.07)}}
// a pole planted in the snow, the start wand
function skiClick(v=.3){if(!AC||!state.sound)return;const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type='square';o.frequency.value=1900;o.connect(g);g.connect(AC.destination);g.gain.setValueAtTime(.04*v*state.volCar/70,t);g.gain.exponentialRampToValueAtTime(.0003,t+.035);o.start(t);o.stop(t+.045)}
// a cowbell: two clanging, out-of-tune square waves through a resonant filter
function skiCowbell(v){if(!AC||!state.sound)return;const t=AC.currentTime+Math.random()*.05,g=AC.createGain(),f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=700+Math.random()*250;f.Q.value=3;f.connect(g);g.connect(AC.destination);
  const p=.85+Math.random()*.3;for(const fr of[540*p,806*p]){const o=AC.createOscillator();o.type='square';o.frequency.value=fr;o.connect(f);o.start(t);o.stop(t+.35)}
  g.gain.setValueAtTime(Math.min(.06,v*1.4)*state.volAmb/70,t);g.gain.exponentialRampToValueAtTime(.0004,t+.3)}

// the level is (re)built: the chairlift, the gates of the pistes and the rest of the resort (js/skiresort.js)
function buildSki(lv){LIFT=null;grooves.count=0;grvI=0;if(SKI.vis&&SKI.vis.root.parent&&SKI.vis.root.parent!==scene)scene.add(SKI.vis.root);if(SKI.vis)SKI.vis.root.visible=false;SKI.on=false;gearReset();spdLines.visible=false;buildLift(lv);buildPisteGates(lv);if(typeof buildResort==='function')buildResort(lv)}
