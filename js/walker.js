'use strict';
/* =================================================================
   ON FOOT: the driver gets out of the car and walks around.
   E (or the button with the walking man) when the car stands still: the driver climbs out of his door, and you steer him with the
   same keys and touch buttons as the car (left and right turn him, gas walks and runs, reverse backs up, space or the jump button hops).
   E again beside the car and he gets back in. The car stays where it was parked. Lost far away? «Tilbake til bil» (T) puts him back at his door.
   He follows the ground (H), cannot climb walls or wade into deep water or lava, and walks round trees, houses and his own car.
   Anything that takes the car away or ends the driving (a course starting, the ferry, the winch home, the garage, the menu) puts him
   straight back behind the wheel, so the rest of the game never has to know that he was out.
   Loaded after ski.js (bone) and before net.js; uses the globals of game.js, carmodel.js and world.js at run time.
   ================================================================= */
const WALK={on:false,ph:'',k:0,t:0,side:1,pos:new V3(),h:0,v:0,vy:0,cyc:0,mv:0,run:0,sit:0,air:0,camH:0,from:new V3(),fromH:0,goT:0,goD:1,jumpHeld:false,
  men:{},door:null,shut:false,far:false,lv:null,body:null,carAt:new V3(),sayT:0,steps:0};
const wSm=x=>{x=x<0?0:x>1?1:x;return x*x*(3-2*x)};
const wAng=a=>Math.atan2(Math.sin(a),Math.cos(a));

/* ---------- the man ---------- */
// boxes between joints like the skier (bone() in js/ski.js). His own frame: feet on the ground at the origin, +z forward, +x to his left.
// He is about .92 high: the same size as the driver behind the wheel (js/carmodel.js).
const MAN={hip:.48,thigh:.225,shin:.215,torso:.27,ua:.15,fa:.15};
let MAN_GEO=null,MAN_MAT=null;
// what he wears, bone by bone (see js/folk.js for the frame): the driver in shirt and work trousers, and the snowmobile rider in his suit and helmet
const MAN_PARTS=(()=>{const sh='#22394f',sl='#40658c',pd='#48432f',pl='#6e6852',bt='#3a2e24',so='#14100c',su='#16263d',tr='#f2c230',rf='#d8dce0',vz='#14181c';
  return{man:{
    torso:[['box',sh,0,.08,.5,.08,.74,.05],...[-.34,-.14,.06,.26].map(y=>['sph','#e8e2d0',0,y,.54,.024,.014,.035]),['box',sh,.25,.15,.5,.27,.17,.05],['box',sl,.25,.235,.51,.29,.045,.06],['sph','#e8e2d0',.25,.215,.56,.02,.012,.03],
      ['box',sl,.16,.475,.28,.24,.07,.56],['box',sl,-.16,.475,.28,.24,.07,.56],['box',sl,0,.475,-.34,.56,.07,.4],['box',sh,0,.3,-.5,.98,.02,.04],['box',sh,.5,0,0,.02,.86,.3],['box',sh,-.5,0,0,.02,.86,.3]],
    hips:[['box',pd,0,-.12,.5,.03,.7,.05],['box',pd,.27,.0,-.5,.3,.66,.05],['box',pd,-.27,.0,-.5,.3,.66,.05],['box',pd,.36,.2,.5,.2,.08,.05],['box',pd,-.36,.2,.5,.2,.08,.05]],
    belt:[['box','#c8a03a',0,0,.5,.15,1.3,.09],['box','#2a211a',0,0,.54,.07,.6,.04],...[-.32,.32].map(x=>['box',pd,x,0,.5,.045,1.5,.06]),...[-.3,.3].map(x=>['box',pd,x,0,-.5,.045,1.5,.06])],
    thigh:sx=>[['box',pd,sx*.5,-.08,0,.1,.3,.62],['box',pl,sx*.53,.06,0,.1,.06,.66],['sph','#2a211a',sx*.6,.0,0,.03,.025,.08]],
    shin:()=>[['box',pd,0,-.455,0,1.12,.09,1.12],['box',pl,0,.3,.5,.7,.3,.06]],
    foot:()=>[['box',so,0,-.44,0,1.08,.2,1.05],['box',bt,0,-.12,.4,1.03,.6,.22],['box','#cfc6b0',0,.52,.1,.46,.08,.4],['box',bt,0,.42,-.32,1.05,.4,.38]],
    ua:()=>[['box',sh,0,.45,0,1.14,.1,1.14]],
    fa:sx=>sx>0?[['box','#1d1c1a',0,.34,0,1.14,.1,1.14],['box','#d8dce0',.56,.34,0,.12,.17,.62],['box','#f2e8d0',.63,.34,0,.03,.11,.4]]:[['box','#6a4a2a',0,.36,0,1.12,.05,1.12]]},
  skuter:{
    torso:[['box',vz,0,-.02,.5,.05,.95,.05],['box',rf,0,.17,0,1.03,.06,1.06],['box',tr,0,.235,0,1.03,.04,1.06],['box',tr,.27,.36,.5,.22,.09,.06],['box',su,0,.49,0,.74,.1,1.05],['box',su,-.26,-.2,.5,.26,.22,.05],['box',su,.26,-.2,.5,.26,.22,.05]],
    shin:()=>[['box',rf,0,-.18,0,1.07,.07,1.07],['box',su,0,.4,.42,.92,.26,.26]],
    thigh:sx=>[['box',su,sx*.5,0,0,.08,.34,.6],['box',tr,sx*.54,.14,0,.04,.04,.6]],
    foot:()=>[['box',so,0,-.44,0,1.08,.2,1.05],['box','#8a8e94',0,.2,.02,1.06,.14,.1],['box','#8a8e94',0,.2,.32,1.06,.14,.1],['box','#2c2926',0,-.1,.42,1.03,.6,.2]],
    ua:()=>[['box',tr,0,0,0,1.1,.09,1.1],['box',rf,0,-.1,0,1.1,.05,1.1]],
    fa:()=>[['box',su,0,.4,0,1.2,.2,1.2],['box',tr,0,.27,0,1.21,.03,1.21]]},
  // the helmet's details, in the head's own measures: vents at the chin and the sides, the rim and the pivots of the visor, a glint in it, the stripe behind and the collar
  helmet:[['box',vz,.03,-.07,.111,.028,.012,.006],['box',vz,-.03,-.07,.111,.028,.012,.006],['box',vz,0,-.052,.111,.05,.008,.006],['box',vz,.088,-.02,.02,.02,.02,.06],['box',vz,-.088,-.02,.02,.02,.02,.06],
    ['box',vz,0,.044,.094,.162,.012,.03,.12],['cyl','#8a8e94',.08,.006,.062,.014,.012,.014,0,0,1.5708],['cyl','#8a8e94',-.08,.006,.062,.014,.012,.014,0,0,1.5708],['box','#6a8aa6',-.035,.02,.1045,.04,.012,.004,.12],
    ['box',tr,0,-.035,-.1,.12,.02,.012],['box','#c8463a',0,.02,-.104,.05,.03,.008],['cyl',su,0,-.098,-.005,.066,.04,.066]]}})();
function makeMan(skuter){
  if(!MAN_GEO){MAN_GEO={sph:new THREE.SphereGeometry(1,14,10),cap:new THREE.SphereGeometry(1,14,8,0,Math.PI*2,0,Math.PI*.5)};
    const mat=(c,r=.75)=>new THREE.MeshStandardMaterial({color:LIN(c),roughness:r});MAN_MAT={pants:mat('#5d5744'),boot:mat('#2a211a'),eye:mat('#1a1410',.3),belt:mat('#2a211a'),cab:mat('#12110f',.95)}}
  const K=skuter?skuterMats():null,shirt=skuter?K.suit:M.shirt,pants=skuter?K.suit:MAN_MAT.pants,boot=skuter?K.boot:MAN_MAT.boot,fore=skuter?K.suit:M.skin,hand=skuter?K.mitt:M.skin;
  const root=new THREE.Group(),body=new THREE.Group(),head=new THREE.Group();root.add(body);
  const P=(m,geo,par)=>{const x=new THREE.Mesh(geo||boxGeo,m);x.castShadow=true;(par||body).add(x);return x};
  const v={root,body,head,skuter:!!skuter,shinL:P(pants),shinR:P(pants),thighL:P(pants),thighR:P(pants),footL:P(boot),footR:P(boot),hips:P(pants),belt:P(skuter?K.trim:MAN_MAT.belt),torso:P(shirt),
    uaL:P(shirt),uaR:P(shirt),faL:P(fore),faR:P(fore),handL:P(hand,MAN_GEO.sph),handR:P(hand,MAN_GEO.sph)};
  body.add(head);
  if(skuter){const h=P(K.helm,MAN_GEO.sph,head);h.scale.set(.096,.096,.105);const vz=P(K.visor,null,head);vz.scale.set(.15,.065,.03);vz.position.set(0,.005,.088);vz.rotation.x=.12;
    const st=P(K.trim,null,head);st.scale.set(.03,.012,.2);st.position.set(0,.097,0);const ch=P(K.helm,null,head);ch.scale.set(.12,.06,.1);ch.position.set(0,-.06,.06);
    folkOn(head,MAN_PARTS.helmet,'man:helmet')}
  else{const h=P(M.skin,MAN_GEO.sph,head);h.scale.setScalar(.064);const cap=P(M.blk,MAN_GEO.cap,head);cap.scale.setScalar(.068);cap.position.y=.008;
    const br=P(M.blk,null,head);br.scale.set(.1,.012,.07);br.position.set(0,.014,.085);br.rotation.x=.12;
    const f=folkHead(FOLK_DRIVER,FOLK_CAP,'cap');f.scale.setScalar(.064);head.add(f)}
  // the details of his clothes: one mesh on each bone, in the bone's own frame (js/folk.js)
  const D=MAN_PARTS[skuter?'skuter':'man'],kk='man:'+(skuter?'s:':'m:');
  for(const k of['torso','hips','belt'])if(D[k])folkOn(v[k],D[k],kk+k);
  for(const[sd,sx]of[['L',1],['R',-1]])for(const k of['shin','thigh','foot','ua','fa'])if(D[k])folkOn(v[k+sd],D[k](sx),kk+k+sd);
  root.visible=false;return v}
// two bones from a to b (lengths l1 and l2) that bend towards the pole (px,py,pz): returns the joint between them. b is pulled in if it is out of reach
function manIK(a,b,l1,l2,px,py,pz,out){let dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,D=Math.hypot(dx,dy,dz)||1e-4;const mx=l1+l2-.002;
  if(D>mx){const s=mx/D;dx*=s;dy*=s;dz*=s;D=mx;b.set(a.x+dx,a.y+dy,a.z+dz)}
  const ux=dx/D,uy=dy/D,uz=dz/D,x=(l1*l1-l2*l2+D*D)/(2*D),h=Math.sqrt(Math.max(0,l1*l1-x*x)),pd=px*ux+py*uy+pz*uz,qx=px-ux*pd,qy=py-uy*pd,qz=pz-uz*pd,ql=Math.hypot(qx,qy,qz)||1;
  return out.set(a.x+ux*x+qx/ql*h,a.y+uy*x+qy/ql*h,a.z+uz*x+qz/ql*h)}
// the pose. P: ph = where he is in the stride (radians, one turn is two steps), mv = how much he moves 0…1, run 0…1 (walk … run),
// sit 0…1 (seated behind the wheel, or on the snowmobile with bar), air 0…1 (in a hop), back (walking backwards), t = time
const _mj=Array.from({length:14},()=>new V3()),_mp=new V3(),_mn=new V3(),_mu=new V3();
function poseMan(v,P){const L=MAN,mv=P.mv||0,run=P.run||0,sit=P.sit||0,air=P.air||0,ph=P.ph||0,t=P.t||0,st=1-sit;
  const A=(.13+.13*run)*mv*(P.back?.6:1),lift=(.045+.075*run)*mv,idle=(1-mv)*st;
  const tilt=((.05+.2*run)*mv*(P.back?-.3:1)+.015*Math.sin(t*1.3)*idle)*st-.06*sit+.12*air*st;
  const hipY=(L.hip-.012-(.012+.02*run)*mv+.014*mv*(1+run)*Math.cos(2*ph)-.04*air)*st+.2*sit;
  const pel=_mp.set(0,hipY,-.03*run*mv*st),neck=_mn.set(0,pel.y+L.torso*Math.cos(tilt),pel.z+L.torso*Math.sin(tilt)),up=_mu.copy(neck).sub(pel).normalize();
  for(let i=0;i<2;i++){const sx=i?-1:1,f=ph+(i?Math.PI:0),sn=Math.sin(f),cs=Math.cos(f),o=i*7,hip=_mj[o],ank=_mj[o+1],knee=_mj[o+2],sh=_mj[o+3],hand=_mj[o+4],elb=_mj[o+5],tmp=_mj[o+6];
    hip.set(sx*.055,hipY,pel.z);
    // the foot: back along the ground while it carries him, lifted forward in the swing; tucked up in a hop; out in front of the seat when he sits
    ank.set(sx*.062,.05+lift*Math.max(0,cs)+.09*air*(1+.4*sx),A*sn+.05*air*sx).lerp(tmp.set(sx*.075,.03,.36),sit);
    manIK(hip,ank,L.thigh,L.shin,0,sit*1.4,1,knee);
    // the arm swings against the leg on its side, and bends more the faster he runs
    const th=-(.5+.45*run)*sn*mv+.04*Math.sin(t*1.7+i*2)*idle,be=.22+1.3*run*mv;
    sh.set(neck.x+sx*.115,neck.y-.03,neck.z-sx*.03*sn*mv);
    hand.set(sh.x+sx*.035,sh.y-L.ua*Math.cos(th)-L.fa*Math.cos(th+be),sh.z+L.ua*Math.sin(th)+L.fa*Math.sin(th+be));
    if(air>0)hand.lerp(tmp.set(sx*.27,neck.y-.02,neck.z+.06),air*st);
    if(sit>0)hand.lerp(P.bar?tmp.set(sx*.235,.47,.36):tmp.set(sx*.1,.45,.3),sit);
    manIK(sh,hand,L.ua,L.fa,sx*.5,-.5,-1,elb);
    const shin=i?v.shinR:v.shinL,thigh=i?v.thighR:v.thighL,foot=i?v.footR:v.footL,ua=i?v.uaR:v.uaL,fa=i?v.faR:v.faL,hd=i?v.handR:v.handL;
    bone(shin,ank,knee,.078);bone(thigh,knee,hip,.098);bone(ua,sh,elb,.066);bone(fa,elb,hand,.054);hd.position.copy(hand);hd.scale.setScalar(v.skuter?.04:.032);
    const toe=mv*Math.max(0,cs)*(.5+.4*run)*st+.5*air*st;foot.position.set(ank.x,ank.y-.022+.03*Math.sin(toe)*-1,ank.z+.04*Math.cos(toe));foot.rotation.x=toe;foot.scale.set(.082,.056,.19)}
  v.hips.position.copy(pel);v.hips.rotation.x=tilt*.5;v.hips.scale.set(.2,.1,.128);
  v.belt.position.copy(pel).addScaledVector(up,.05);v.belt.rotation.x=tilt;v.belt.scale.set(.218,.028,.132);
  bone(v.torso,pel,neck,.215);v.torso.scale.z=.125;v.torso.scale.y+=.03;
  v.head.position.copy(neck).addScaledVector(up,.088);v.head.rotation.set(tilt*.45-.1*air,(P.look||0)+.25*Math.sin(t*.6)*idle*(P.calm||0),0)}

/* ---------- where the driver sits, and the way out of the car ---------- */
// the seat in the car's own frame (x to the left), and hw: how far out the side of the car is
function walkSeat(cfg){const st=cfg.style,hw=Math.max(.46,((cfg.track||TRACK)+(cfg.tireW||.19))/2);
  if(st==='skuter')return{x:0,y:-.14,z:-.33,hw:.4};
  if(st==='monster')return{x:.2,y:.28,z:.06,hw};
  if(st==='sport')return{x:.19,y:-.14,z:-.13,hw};
  if(st==='trophy')return{x:.2,y:.06,z:-.14,hw};
  return{x:.2,y:0,z:cfg.L/2-cfg.hood-.3,hw}}
// k 0 = in the seat, 1 = standing beside the door on that side (side 1 is the driver's door, on the left).
// He slides out through the door turned away from the car, gets his feet on the ground, straightens up and turns to face the way the car points
const _wv=new V3(),_wo={x:0,y:0,z:0,h:0,sit:0},_wo2={x:0,y:0,z:0,h:0,sit:0};
function walkPath(k,side,o){const S=walkSeat(car.cfg),hC=Math.atan2(car.fw.x,car.fw.z),kx=wSm(k/.8),lx=S.x+(side*(S.hw+.38)-S.x)*kx;
  _wv.set(lx,S.y,S.z-.2*kx).applyQuaternion(car.q).add(car.pos);o.x=_wv.x;o.z=_wv.z;
  const gy=H(o.x,o.z),ky=wSm((k-.3)/.55);o.y=_wv.y+(gy-_wv.y)*ky+.07*Math.sin(Math.PI*Math.min(1,k/.8))*(1-ky);
  o.h=hC+side*1.3*(k<.4?wSm(k/.4):1-wSm((k-.68)/.32));o.sit=1-wSm((k-.25)/.5);return o}
// is there room to stand outside the door on that side: ground at about the height of the car, no deep water, lava, wall or tree
function walkRoom(side){const p=walkPath(1,side,_wo2),gy=H(p.x,p.z);
  if(Math.abs(gy-H(car.pos.x,car.pos.z))>.75||WL(p.x,p.z)-gy>.3||lavaAt(p.x,p.z,.2)>-1e8||Math.abs(p.x)>HALF-.7||Math.abs(p.z)>HALF-.7)return false;
  const x0=p.x,z0=p.z;walkCollide(p,false);return Math.hypot(p.x-x0,p.z-z0)<.05}

/* ---------- the door ---------- */
// The cars are drawn without doors that open, so one is made for the moment he gets out or in: a slab that lies over the side of the car
// (the lower panel, the window and its frame) hinged at the front, and a dark panel behind it that looks like the way into the cab.
// Both are only there while he climbs out or in. buildBody (js/carmodel.js) says where the door is (body.userData.door); the monster truck,
// the sports car and the trophy truck have none, and he climbs straight out of them.
function walkDoorMake(side){const D=carVis.body.userData.door,root=new THREE.Group(),hinge=new THREE.Group(),dark=new THREE.Group();root.add(hinge,dark);
  const P=(par,mat,sx,sy,sz,x,y,z)=>{const m=new THREE.Mesh(boxGeo,mat);m.scale.set(sx,sy,sz);m.position.set(x,y,z);m.castShadow=par===hinge;par.add(m);return m};
  const hl=D.yb-D.ya,hu=D.yc-D.yb,L=D.len,zc=-L/2,xu=side*(D.xg-D.x);hinge.position.set(side*D.x,0,D.z);dark.position.copy(hinge.position);
  P(dark,MAN_MAT.cab,.0145,hl,L,side*.00825,D.ya+hl/2,zc);P(dark,MAN_MAT.cab,.014,hu,L,xu+side*.012,D.yb+hu/2,zc);
  P(hinge,M.yel,.012,hl,L,side*.022,D.ya+hl/2,zc);P(hinge,M.yel,.03,.012,L,side*.013,D.yb+.006,zc);P(hinge,M.blk,.012,.022,.09,side*.03,D.yb-.05,-L+.1);   // the lower panel, the sill under the window and the handle
  for(const z of[-.0175,-L+.0175])P(hinge,M.yel,.01,hu,.035,xu+side*.0245,D.yb+hu/2,z);P(hinge,M.yel,.01,.03,L,xu+side*.0245,D.yc-.015,zc);   // the window frame
  P(hinge,M.glass,.006,hu-.03,L-.07,xu+side*.0245,D.yb+hu/2-.015,zc);
  root.visible=false;scene.add(root);return{root,hinge,side,body:carVis.body}}
function walkDoorDrop(){const d=WALK.door;if(!d)return;WALK.door=null;scene.remove(d.root)}   // the parts share boxGeo and the car's materials: nothing to free
// k as in walkPath: the door swings open before his legs come out, and shuts behind him when he stands outside
function walkDoorSet(k){const W=WALK;if(!carVis.body.userData.door){walkDoorDrop();return}
  const a=1.3*wSm(k/.15)*(1-wSm((k-.72)/.2));if(a<.004){if(W.door)W.door.root.visible=false;return}
  if(!W.door||W.door.body!==carVis.body||W.door.side!==W.side){walkDoorDrop();W.door=walkDoorMake(W.side)}
  const d=W.door;d.root.visible=true;d.root.position.copy(car.pos);d.root.quaternion.copy(car.q);d.hinge.rotation.y=-W.side*a}

/* ---------- out and in ---------- */
function walkMan(){const sk=car.cfg.style==='skuter',key=sk?'skuter':'car';let v=WALK.men[key];if(!v){v=WALK.men[key]=makeMan(sk);scene.add(v.root)}return v}
// the driver behind the wheel is hidden while he is out (the parts are marked in js/carmodel.js)
function walkDriver(show){if(carVis)carVis.body.traverse(o=>{if(o.userData.driver)o.visible=show})}
function walkSay(msg,bad){if(WALK.sayT>0)return;WALK.sayT=1.5;toast(msg,bad)}
function walkToggle(){if(state.mode!=='play'||SKI.on)return;if(WALK.on)walkIn();else walkOut()}
function walkOut(){const W=WALK;if(W.on||state.mode!=='play'||!car||!carVis)return;
  if(car.vel.length()>.9){toast('Stopp bilen før du går ut',true);return}
  if(car.up.y<.6){toast('Få bilen på hjulene først',true);return}
  if(car.rope){toast('Vent til vinsjen er ferdig',true);return}
  if(typeof tipDone==='function')tipDone('walk');
  const side=walkRoom(1)?1:walkRoom(-1)?-1:0;if(!side){toast('Det er ikke plass til å gå ut her',true);return}
  Object.assign(W,{on:true,ph:'out',k:0,t:0,side,v:0,vy:0,cyc:0,mv:0,run:0,sit:1,air:0,jumpHeld:true,lv:LV,body:carVis.body,camH:Math.atan2(car.fw.x,car.fw.z),steps:0});W.carAt.copy(car.pos);
  walkPath(0,side,_wo);W.pos.set(_wo.x,_wo.y,_wo.z);W.h=_wo.h;car.throttle=0;for(const k in W.men)W.men[k].root.visible=false;
  W.shut=false;walkDriver(false);$('hud').classList.add('walk');$('bWalk').setAttribute('aria-pressed',true);
  toast(document.body.classList.contains('is-touch')?'Ute av bilen · knappen setter deg inn':'Ute av bilen · E setter deg inn igjen')}
function walkIn(){const W=WALK;if(!W.on||W.ph!=='walk'||W.air>.3)return;
  const side=(W.pos.x-car.pos.x)*car.lf.x+(W.pos.z-car.pos.z)*car.lf.z<0?-1:1;   // the door on the side he stands
  const p=walkPath(1,side,_wo),d=Math.hypot(p.x-W.pos.x,p.z-W.pos.z),dx=W.pos.x-car.pos.x,dz=W.pos.z-car.pos.z,l=Math.hypot(car.lf.x,car.lf.z)||1;
  const off=Math.hypot(Math.max(0,Math.abs(dx*car.lf.x+dz*car.lf.z)/l-walkSeat(car.cfg).hw),Math.max(0,Math.abs(-dx*car.lf.z+dz*car.lf.x)/l-car.cfg.L/2));   // how far he is from the side of the car, wherever along it he stands
  if((d>1.7&&off>1.2)||Math.abs(p.y-W.pos.y)>.8){toast(document.body.classList.contains('is-touch')?'For langt unna · trykk Tilbake til bil':'For langt unna · T tar deg tilbake til bilen',true);return}
  if(car.up.y<.6){toast('Bilen ligger på siden',true);return}
  W.side=side;W.ph='go';W.from.copy(W.pos);W.fromH=W.h;W.goT=0;W.goD=Math.max(.12,d/1.7);W.v=0}
// «Tilbake til bil» (T): from anywhere on the island he is put back at his door, and climbs in. If the car lies on its side, or there is
// no room at either door, he is simply back behind the wheel
function walkBack(){const W=WALK;if(!W.on||W.ph!=='walk'||state.mode!=='play')return;
  const far=Math.hypot(W.pos.x-car.pos.x,W.pos.z-car.pos.z)>6,side=car.up.y<.6?0:walkRoom(1)?1:walkRoom(-1)?-1:0;
  if(far){camSnap=true;tripod=null}   // the camera cuts to the car instead of sweeping across the island
  if(!side){walkEnd();toast('Tilbake i bilen');return}
  const p=walkPath(1,side,_wo);Object.assign(W,{side,ph:'in',k:1,v:0,vy:0,mv:0,run:0,air:0,sit:0,h:p.h,camH:Math.atan2(car.fw.x,car.fw.z)});W.pos.set(p.x,H(p.x,p.z),p.z);
  toast('Tilbake til bilen')}
// back behind the wheel at once
function walkEnd(){const W=WALK;if(!W.on)return;W.on=false;W.ph='';W.v=0;for(const k in W.men)W.men[k].root.visible=false;walkDriver(true);walkDoorDrop();arrow.scale.setScalar(1);
  $('hud').classList.remove('walk');$('bWalk').setAttribute('aria-pressed',false);W.far=false;$('bBack').classList.remove('far')}
// keys while he is out: the gear, the winch and the speed limit belong to the car
function walkKeyDown(k){return k==='g'||k===' '||k==='r'||k==='+'||k==='='||k==='-'||k==='_'}

/* ---------- walking ---------- */
// trees, rocks, houses and his own car push him out (r is his own radius). own: also the car he came out of
const WALK_R=.17;
function walkBox(p,cx,cz,ux,uz,hw,hd){const dx=p.x-cx,dz=p.z-cz,a=dx*ux+dz*uz,b=-dx*uz+dz*ux,ca=a<-hw?-hw:a>hw?hw:a,cb=b<-hd?-hd:b>hd?hd:b;let ea=a-ca,eb=b-cb,d=Math.hypot(ea,eb);
  if(d>=WALK_R)return;let na,nb;if(d<1e-4){const pa=hw-Math.abs(a),pb=hd-Math.abs(b);if(pa<pb){na=(a<0?-1:1)*(hw+WALK_R);nb=b}else{na=a;nb=(b<0?-1:1)*(hd+WALK_R)}}else{na=ca+ea/d*WALK_R;nb=cb+eb/d*WALK_R}
  p.x=cx+na*ux-nb*uz;p.z=cz+na*uz+nb*ux}
function walkCollide(p,own){
  for(const c of G.colliders){
    if(c.w!=null){const ry=c.ry||0;walkBox(p,c.x,c.z,Math.cos(ry),-Math.sin(ry),c.w/2,c.d/2);continue}
    const dx=p.x-c.x,dz=p.z-c.z,d=Math.hypot(dx,dz),R=c.r+WALK_R;if(d<R&&d>1e-4){p.x=c.x+dx/d*R;p.z=c.z+dz/d*R}}
  if(own){const l=Math.hypot(car.lf.x,car.lf.z)||1,S=walkSeat(car.cfg);walkBox(p,car.pos.x,car.pos.z,car.lf.x/l,car.lf.z/l,S.hw-.04,car.cfg.L/2+.04)}
  return p}
// can he step from where he stands to (nx,nz): not up a wall, not into deep water or lava, not off the map
function walkOk(nx,nz){const W=WALK,dx=nx-W.pos.x,dz=nz-W.pos.z,d=Math.hypot(dx,dz);if(d<1e-6)return true;
  if(Math.abs(nx)>HALF-.6||Math.abs(nz)>HALF-.6)return false;
  const g1=H(nx+dx/d*.12,nz+dz/d*.12),gy=H(nx,nz);if((g1-Math.max(H(W.pos.x,W.pos.z),W.pos.y))/(d+.12)>1.35)return false;
  const wd=WL(nx,nz)-gy;if(wd>.42&&wd>=WL(W.pos.x,W.pos.z)-H(W.pos.x,W.pos.z)){walkSay('For dypt til å vasse',true);return false}   // in too deep he may only step towards the shallows
  const ll=lavaAt(nx,nz,.15);if(ll>-1e8&&gy<ll+.2){walkSay('Lava! Hold deg unna',true);return false}
  return true}
const _wn=new V3();
function walkMove(dt){const W=WALK,I=state.inp||{gas:0,rev:0,steer:0,jump:false},thr=I.gas-I.rev;
  const g0=H(W.pos.x,W.pos.z),wade=WL(W.pos.x,W.pos.z)-g0>.12,ground=W.pos.y<=g0+.03&&W.vy<=0;
  W.h=wAng(W.h+I.steer*(3-.7*Math.min(1,Math.abs(W.v)/2.5))*dt);
  const tv=thr>0?(wade?1.1:2.5)*Math.min(1,thr):thr<0?-.95*Math.min(1,-thr):0;W.v+=Math.max(-dt*10,Math.min(dt*(Math.abs(tv)>Math.abs(W.v)?5.5:10),tv-W.v));
  if(I.jump&&!W.jumpHeld&&ground&&!wade){W.vy=2.9;if(typeof ambThump==='function')ambThump(.08)}W.jumpHeld=!!I.jump;
  // the step: all of it, or along one axis if something is in the way (he slides along walls)
  if(Math.abs(W.v)>1e-3){const sx=Math.sin(W.h)*W.v*dt,sz=Math.cos(W.h)*W.v*dt;_wn.set(W.pos.x+sx,0,W.pos.z+sz);walkCollide(_wn,true);
    if(walkOk(_wn.x,_wn.z)){W.pos.x=_wn.x;W.pos.z=_wn.z}
    else if(walkOk(_wn.x,W.pos.z)){W.pos.x=_wn.x;W.v*=1-3*dt}
    else if(walkOk(W.pos.x,_wn.z)){W.pos.z=_wn.z;W.v*=1-3*dt}
    else W.v*=1-12*dt}
  // the ground: he follows it down small steps, and falls where it drops away
  const gy=H(W.pos.x,W.pos.z);
  if(W.vy!==0||W.pos.y>gy+.14){W.vy-=11*dt;W.pos.y+=W.vy*dt;if(W.pos.y<=gy){W.pos.y=gy;if(W.vy<-3.2){if(typeof ambThump==='function')ambThump(Math.min(.5,-W.vy/12));for(let i=0;i<4;i++)spawnDust(W.pos,surfAt(W.pos.x,W.pos.z),false)}W.vy=0}}
  else{W.pos.y=gy;W.vy=0}
  const sp=Math.abs(W.v),inAir=W.pos.y>gy+.05,turn=sp<.2&&Math.abs(I.steer)>.1&&!inAir;
  W.cyc+=sp*dt*(5.7-1.7*W.run)+(turn?5*dt:0);
  W.mv+=((turn?.3:Math.min(1,sp/.9))-W.mv)*Math.min(1,dt*9);W.run+=(Math.max(0,Math.min(1,(sp-1.2)/1.1))-W.run)*Math.min(1,dt*6);W.air+=((inAir?1:0)-W.air)*Math.min(1,dt*12);
  // every footfall: a puff of dust (a splash in water) and a soft step
  const n=Math.floor((W.cyc-Math.PI/2)/Math.PI);if(n!==W.steps){W.steps=n;if(!inAir&&sp>.4){if(wade)spawnDust(_wn.set(W.pos.x,WL(W.pos.x,W.pos.z),W.pos.z),99,true);else if(W.run>.4)spawnDust(W.pos,surfAt(W.pos.x,W.pos.z),false)}}}
// every frame, before the car is stepped
function walkStep(dt){const W=WALK;if(!W.on)return;W.sayT-=dt;
  const m=state.mode;
  if((m!=='play'&&m!=='pause'&&m!=='ask'&&m!=='vault')||SKI.on||W.lv!==LV||!carVis||W.body!==carVis.body||car.pos.distanceToSquared(W.carAt)>1){walkEnd();return}
  W.carAt.copy(car.pos);if(m!=='play')return;
  W.t+=dt;
  if(W.ph==='out'){W.k=Math.min(1,W.k+dt/1.05);const p=walkPath(W.k,W.side,_wo);W.pos.set(p.x,p.y,p.z);W.h=p.h;W.sit=p.sit;W.mv=0;W.run=0;
    if(W.k>.9&&!W.shut){W.shut=true;if(typeof ambThump==='function')ambThump(.3)}   // the door shuts
    if(W.k>=1){W.ph='walk';W.sit=0;W.pos.y=H(W.pos.x,W.pos.z);W.h=wAng(W.h);for(let i=0;i<3;i++)spawnDust(W.pos,surfAt(W.pos.x,W.pos.z),false)}}
  else if(W.ph==='go'){W.goT+=dt;const u=wSm(W.goT/W.goD),p=walkPath(1,W.side,_wo);   // walks the last steps to the door
    W.pos.set(W.from.x+(p.x-W.from.x)*u,0,W.from.z+(p.z-W.from.z)*u);W.pos.y=H(W.pos.x,W.pos.z);W.h=W.fromH+wAng(p.h-W.fromH)*u;W.cyc+=dt*7;W.mv+=(.8-W.mv)*Math.min(1,dt*9);W.run*=1-Math.min(1,dt*6);W.air=0;
    if(W.goT>=W.goD){W.ph='in';W.k=1;W.mv=0}}
  else if(W.ph==='in'){W.k=Math.max(0,W.k-dt/.9);const p=walkPath(W.k,W.side,_wo);W.pos.set(p.x,p.y,p.z);W.h=p.h;W.sit=p.sit;W.mv=0;
    if(W.k<=0){walkEnd();if(typeof ambThump==='function')ambThump(.3);return}}
  else walkMove(dt);
  // the camera turns after him a little late, and stays behind the car while he climbs out and in
  const ch=W.ph==='walk'?W.h:Math.atan2(car.fw.x,car.fw.z);W.camH=wAng(W.camH+wAng(ch-W.camH)*Math.min(1,dt*(W.ph==='walk'?3.2:6)))}
// every frame, after the car is drawn: the pose, the arrow back to the car and the speed in the HUD
const _wa=new V3(),_wb=new V3();
function walkSync(dt){const W=WALK;if(!W.on)return;const v=walkMan();
  const inside=(W.ph==='out'||W.ph==='in')&&W.k<.1&&!v.skuter;   // behind the door he is not drawn (only the snowmobile's rider sits in the open)
  for(const k in W.men)W.men[k].root.visible=W.men[k]===v&&!inside&&!(state.camMode===2&&W.ph==='walk');
  v.root.position.copy(W.pos);v.root.rotation.y=W.h;
  // in the seat he tilts with the car; on his feet he stands upright
  v.body.quaternion.identity();if(W.sit>.01){_wb.set(0,1,0);v.body.quaternion.setFromUnitVectors(_wb,_wa.copy(car.up).applyAxisAngle(_wb,-W.h).lerp(_wb,1-W.sit).normalize())}
  poseMan(v,{ph:W.cyc,mv:W.mv,run:W.run,sit:W.sit,air:W.air,t:W.t,back:W.v<-.05,bar:v.skuter,calm:1});
  walkDoorSet(W.ph==='out'||W.ph==='in'?W.k:1);
  const dx=car.pos.x-W.pos.x,dz=car.pos.z-W.pos.z,d=Math.hypot(dx,dz);
  if(W.ph==='walk'&&d>5&&state.camMode!==2){arrow.visible=true;arrow.scale.setScalar(.7);arrow.position.copy(W.pos).add(_wa.set(0,1.25,0));arrow.quaternion.setFromUnitVectors(YAX,_wa.set(dx/d,0,dz/d))}else arrow.visible=false;
  beacon.visible=false;
  const far=W.ph==='walk'&&d>5;if(far!==W.far){W.far=far;$('bBack').classList.toggle('far',far)}   // «Tilbake til bil» lights up when the car is out of reach
  if(state.mode==='play')$('hSpeed').textContent=Math.round(Math.abs(W.v)*UNIT_CM)}

/* ---------- the others in the room (js/net.js) ---------- */
// my driver on foot goes along with the car's pose, 15 times a second: [x, y, z, heading, sit, air, speed]
function walkNetPose(){const W=WALK;return[+W.pos.x.toFixed(3),+W.pos.y.toFixed(3),+W.pos.z.toFixed(3),+W.h.toFixed(2),+W.sit.toFixed(2),+W.air.toFixed(2),+W.v.toFixed(2)]}
// theirs is drawn between the two poses a and c around this moment (k 0…1), like their car; no pose means he sits in the car.
// His stride is worked out here from his speed. The door is not drawn for the others: he climbs straight out
const _wm=[0,0,0,0,0,0,0];
function walkRemote(p,a,c,k){const V=p.vis;
  if(!c){if(p.man)p.man.root.visible=false;if(V&&V.driver)V.driver.visible=true;return}
  if(!a||Math.hypot(a[0]-c[0],a[2]-c[2])>4)a=c;
  const m=_wm;for(let i=0;i<7;i++)m[i]=a[i]+(c[i]-a[i])*k;m[3]=a[3]+wAng(c[3]-a[3])*k;
  const sk=p.info.car==='skuter';if(!p.man||p.man.skuter!==sk){walkRemoteDrop(p);p.man=makeMan(sk);scene.add(p.man.root);p.manC=0;p.manT=performance.now()}
  const now=performance.now(),dt=Math.min(.1,(now-p.manT)/1000),v=p.man,sp=Math.abs(m[6]),run=Math.max(0,Math.min(1,(sp-1.2)/1.1));p.manT=now;p.manC+=sp*dt*(5.7-1.7*run);
  v.root.visible=true;v.root.position.set(m[0],m[1],m[2]);v.root.rotation.y=m[3];
  poseMan(v,{ph:p.manC,mv:Math.min(1,sp/.9),run,sit:m[4],air:m[5],t:now/1000,back:m[6]<-.05,bar:sk,calm:1});
  if(V&&V.driver)V.driver.visible=false}
function walkRemoteDrop(p){if(p.man){scene.remove(p.man.root);p.man=null}}   // his parts share their geometry and materials: nothing to free

/* ---------- the camera on foot ---------- */
// the follow camera sits closer behind him than behind the car; the ground camera keeps its tripod and watches him; the driver camera sees through his eyes.
// Sets camTarget and camLook like the car's cameras (js/game.js updateCamera does the gliding); returns true when it has placed the camera itself
function walkCamera(dt){const W=WALK,p=W.pos;
  if(state.camMode===0){const a=W.camH+orbitYaw,cd=Math.max(1.5,camDist*.62);
    camTarget.set(p.x-Math.sin(a)*cd,p.y+.8+cd*.26+orbitPitch*cd*.6,p.z-Math.cos(a)*cd);camTarget.y=Math.max(camTarget.y,H(camTarget.x,camTarget.z)+.4);
    {const dx=camTarget.x-car.pos.x,dz=camTarget.z-car.pos.z,l=Math.hypot(car.lf.x,car.lf.z)||1,ca=Math.abs(dx*car.lf.x+dz*car.lf.z)/l,cb=Math.abs(-dx*car.lf.z+dz*car.lf.x)/l;   // over the roof, not inside the car he left
      const inx=Math.min(1,Math.max(0,(1.15-ca)/.4)),inz=Math.min(1,Math.max(0,(car.cfg.L/2+.7-cb)/.4));camTarget.y=Math.max(camTarget.y,car.pos.y+1.5*Math.min(inx,inz))}
    camLook.set(p.x,p.y+.62,p.z);camera.fov=52+Math.min(6,Math.abs(W.v)*2);return false}
  if(state.camMode===1){if(!tripod||tripod.distanceTo(p)>8){const sd=Math.random()<.5?1:-1,fx=Math.sin(W.h),fz=Math.cos(W.h);tripod=new V3(p.x+fx*4.5+fz*2*sd,0,p.z+fz*4.5-fx*2*sd);tripod.y=H(tripod.x,tripod.z)+.22;camSnap=true}
    camTarget.copy(tripod);camLook.set(p.x,p.y+.5,p.z);camera.fov=38*fovZoom;return false}
  if(W.ph!=='walk'){   // climbing out or in: seen from the roof of the car, like the driver camera
    camTarget.set(0,.98,.25).applyQuaternion(car.q).add(car.pos);camLook.set(p.x,p.y+.6,p.z);camera.fov=68*fovZoom;camera.position.copy(camTarget);camera.up.set(0,1,0);camera.lookAt(camLook);camera.updateProjectionMatrix();return true}
  const bob=.012*W.mv*Math.cos(2*W.cyc);camTarget.set(p.x,p.y+.84+bob,p.z);camLook.set(p.x+Math.sin(W.h)*4,p.y+.7,p.z+Math.cos(W.h)*4);camera.fov=68*fovZoom;
  camera.position.copy(camTarget);camera.up.set(0,1,0);camera.lookAt(camLook);(camera.userData.look||(camera.userData.look=new V3())).copy(camLook);camera.updateProjectionMatrix();return true}
