'use strict';
/* =================================================================
   CAR MODEL: wheels and the body with all its details (racks, cans, hoop lights, ladder, pickup bed …), the monster truck, the sports car, the trophy truck and the snowmobile
   Everything is boxes and cylinders from game.js's bx()/cyl() and the shared materials M. extras in data/cars.js choose the load.
   Loaded after game.js; only functions, called at run time.
   ================================================================= */
// the antenna flags from the garage (FLAGS in data/parts.js): drawn once on a small canvas, the pole is at the left edge
const FLAGTEX={},FLAGMAT={};let FLAG_NOW=0;   // the flag of the car being built (set in buildBody)
function flagCanvas(f){const c=document.createElement('canvas');c.width=132;c.height=96;const x=c.getContext('2d'),W=132,H=96;
  if(f.k==='norge'){const u=6;x.fillStyle='#ba0c2f';x.fillRect(0,0,W,H);x.fillStyle='#fff';x.fillRect(6*u,0,4*u,H);x.fillRect(0,6*u,W,4*u);x.fillStyle='#00205b';x.fillRect(7*u,0,2*u,H);x.fillRect(0,7*u,W,2*u)}
  else if(f.k==='ruter'){for(let j=0;j<4;j++)for(let i=0;i<6;i++){x.fillStyle=(i+j)%2?'#f4f2ec':'#14120e';x.fillRect(i*22,j*24,22,24)}}
  else if(f.k==='regnbue'){['#e03a3a','#f08a24','#f2cf3a','#3a9a4a','#2f6fb0','#7a4aa8'].forEach((col,i)=>{x.fillStyle=col;x.fillRect(0,i*16,W,16)})}
  else if(f.k==='pirat'){x.fillStyle='#14120e';x.fillRect(0,0,W,H);x.strokeStyle='#f4f2ec';x.lineWidth=8;x.lineCap='round';x.beginPath();x.moveTo(34,70);x.lineTo(98,90);x.moveTo(98,70);x.lineTo(34,90);x.stroke();
    x.fillStyle='#f4f2ec';x.beginPath();x.arc(66,38,26,0,7);x.fill();x.fillRect(52,52,28,18);x.fillStyle='#14120e';x.beginPath();x.arc(56,38,7,0,7);x.arc(76,38,7,0,7);x.fill();x.fillRect(64,46,4,8);for(const i of[58,66,74])x.fillRect(i,62,2,8)}
  else{x.fillStyle=f.c||'#ff7a1a';x.fillRect(0,0,W,H)}
  return c}
function flagMat(i){const f=FLAGS[i];if(!f||!f.k)return null;if(!FLAGMAT[i]){const t=FLAGTEX[i]=new THREE.CanvasTexture(flagCanvas(f));t.encoding=THREE.sRGBEncoding;FLAGMAT[i]=new THREE.MeshStandardMaterial({map:t,roughness:.8,side:THREE.DoubleSide})}return FLAGMAT[i]}
// the rims from the garage (RIMS in data/parts.js): the colour of the spokes and the hub. The standard rim is yellow, or brass with the heavy weights.
function rimLook(mat,rim,weight){const r=RIMS[rim];
  if(r&&r.c){mat.color.set(r.c).convertSRGBToLinear();mat.metalness=r.m??.2;mat.roughness=r.r??.38}
  else{mat.color.set(weight>=2?'#b08a3a':'#e3a62a').convertSRGBToLinear();mat.metalness=weight>=2?.6:.2;mat.roughness=.38}}
/* ---------- shared pieces: merging, rounded panels, the kit of small parts every car uses ---------- */
// all the meshes under root merged into one mesh per material (a car is hundreds of small boxes: merged, it is a handful of draw calls)
function netMerge(root){root.updateMatrixWorld(true);const by=new Map(),olds=[];
  root.traverse(o=>{if(!o.isMesh)return;olds.push(o.geometry);const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);if(!by.has(o.material))by.set(o.material,[]);by.get(o.material).push({g,cs:o.castShadow})});
  const out=new THREE.Group();
  for(const[mat,list]of by){let n=0;for(const e of list)n+=e.g.attributes.position.count;const P=new Float32Array(n*3),N=new Float32Array(n*3),U=new Float32Array(n*2);let o=0;
    for(const e of list){const a=e.g.attributes;P.set(a.position.array,o*3);if(a.normal)N.set(a.normal.array,o*3);if(a.uv)U.set(a.uv.array,o*2);o+=a.position.count;e.g.dispose()}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('normal',new THREE.BufferAttribute(N,3));g.setAttribute('uv',new THREE.BufferAttribute(U,2));g.computeBoundingSphere();
    const m=new THREE.Mesh(g,mat);m.castShadow=list.some(e=>e.cs)&&!mat.transparent;m.receiveShadow=true;out.add(m)}
  for(const g of new Set(olds))g.dispose();return out}
// a car body merged, with the driver as a group of his own (marked, so js/walker.js can hide him while he is out of the car)
function packBody(raw){const drv=new THREE.Group();for(const o of[...raw.children])if(o.userData.driver)drv.add(o);
  const body=netMerge(raw),driver=netMerge(drv);driver.userData.driver=true;body.add(driver);Object.assign(body.userData,raw.userData);body.userData.driverGroup=driver;return body}
// a box with rounded edges and smooth normals, so the light rolls over the edges of the big painted panels
function rbx(w,h,d,r,mat,x,y,z,p){
  const b=Math.max(.002,Math.min(r,w/2-.002,h/2-.002,d/2-.002)),iw=w-2*b,ih=h-2*b,c=Math.min(b*1.3,iw/2-.001,ih/2-.001),s=new THREE.Shape(),X=iw/2,Y=ih/2;
  s.moveTo(-X+c,-Y);s.lineTo(X-c,-Y);s.quadraticCurveTo(X,-Y,X,-Y+c);s.lineTo(X,Y-c);s.quadraticCurveTo(X,Y,X-c,Y);s.lineTo(-X+c,Y);s.quadraticCurveTo(-X,Y,-X,Y-c);s.lineTo(-X,-Y+c);s.quadraticCurveTo(-X,-Y,-X+c,-Y);
  const geo=new THREE.ExtrudeGeometry(s,{depth:d-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:2,curveSegments:3});geo.translate(0,0,-(d-2*b)/2);
  const P=geo.attributes.position,N=geo.attributes.normal,ex=w/2-b-c,ey=h/2-b-c,ez=d/2-b,cl=(v,e)=>Math.max(-e,Math.min(e,v));
  for(let i=0;i<P.count;i++){const px=P.getX(i),py=P.getY(i),pz=P.getZ(i),nx=px-cl(px,ex),ny=py-cl(py,ey),nz=pz-cl(pz,ez),l=Math.hypot(nx,ny,nz);if(l>1e-6)N.setXYZ(i,nx/l,ny/l,nz/l)}
  const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;p.add(m);return m}
// materials and textures only the car models use (made once)
let KIT=null;
function carKit(){if(KIT)return KIT;const m=(c,r=.7,o)=>new THREE.MeshStandardMaterial(Object.assign({color:LIN(c),roughness:r},o));
  const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');x.fillStyle='#f4f1e6';x.fillRect(0,0,256,64);x.strokeStyle='#14120E';x.lineWidth=5;x.strokeRect(4,4,248,56);
  x.fillStyle='#24489a';x.fillRect(7,7,30,50);x.fillStyle='#14120E';x.textAlign='center';x.textBaseline='middle';x.font='700 44px "Barlow Condensed", Arial, sans-serif';x.fillText('SK 24107',146,35);
  const pt=new THREE.CanvasTexture(c);pt.encoding=THREE.sRGBEncoding;pt.anisotropy=4;
  KIT={glassT:new THREE.MeshStandardMaterial({color:LIN('#16242c'),roughness:.05,metalness:.7,envMapIntensity:1.5,transparent:true,opacity:.5,depthWrite:false,side:THREE.DoubleSide}),
    cabin:m('#23211e',.9),seat:m('#4a3a2c',.85),rubber:m('#151413',.95),chrome:m('#d9dad6',.12,{metalness:1,envMapIntensity:1.4}),
    rev:m('#e9e6dc',.2,{emissive:0x000000}),plate:new THREE.MeshStandardMaterial({map:pt,roughness:.5}),white:m('#efece2',.45),
    helm:m('#f2efe6',.35),visor:m('#14181c',.15),canvas:m('#c9b88e',1),alu:m('#b9bcbc',.4,{metalness:.7})};
  return KIT}
// a number plate with letters on it; dir 1 faces forward, -1 backward
function carPlate(g,x,y,z,dir,w=.2){const p=new THREE.Mesh(new THREE.PlaneGeometry(w,w/4),carKit().plate);p.position.set(x,y,z);if(dir<0)p.rotation.y=Math.PI;g.add(p);return p}
// the cone of light in front of a headlight (lit by setLights in js/game.js)
function carBeam(g,x,y,z){const beam=new THREE.Mesh(new THREE.ConeGeometry(.55,4,14,1,true),M.beam);beam.rotation.x=-Math.PI/2+.13;beam.position.set(x,y-.26,z+1.96);beam.castShadow=false;g.add(beam);return beam}
// a round headlight facing forward: black housing, chrome ring, lens, and its beam
function carLamp(g,x,y,z,r=.055,beam=true){const K=carKit();cyl(r*1.22,.03,M.blkC,x,y,z+.012,g,'z',16);cyl(r*1.1,.02,K.chrome,x,y,z+.02,g,'z',16);cyl(r*.94,.02,M.lamp,x,y,z+.026,g,'z',16);if(beam)carBeam(g,x,y,z+.02)}
// a seat: cushion, back and headrest
function carSeat(g,x,y,z,w=.2,hb=.2,mat){const S=mat||carKit().seat;bx(w,.045,.19,S,x,y+.022,z,g);const b=bx(w,hb,.04,S,x,y+hb/2+.02,z-.105,g);b.rotation.x=-.1;bx(w*.55,.05,.035,S,x,y+hb+.04,z-.125,g)}
// the steering wheel on its column, leaning towards the driver
function carWheelStick(g,x,y,z,r=.05){const t=new THREE.Mesh(new THREE.TorusGeometry(r,.008,6,14),M.blk);t.position.set(x,y,z);t.rotation.x=-.5;g.add(t);const c=cyl(.008,.09,M.blk,x,y-.02,z+.035,g,null,6);c.rotation.x=1.07;bx(r*1.7,.008,.012,M.blk,x,y,z,g).rotation.x=-.5}
// driver and passenger: head, cap (or helmet) and shoulders. The first one is the driver and is marked (js/walker.js hides him while he is out)
function carCrew(g,seats,helmet){const K=carKit();seats.forEach(([x,y,z],i)=>{const n0=g.children.length;
    const h=new THREE.Mesh(new THREE.SphereGeometry(.06,12,10),M.skin);h.position.set(x,y+.11,z+.02);g.add(h);
    if(helmet){const hm=new THREE.Mesh(new THREE.SphereGeometry(.072,12,10),K.helm);hm.position.set(x,y+.12,z+.012);hm.castShadow=true;g.add(hm);bx(.1,.035,.02,K.visor,x,y+.115,z+.078,g)}
    else{const cap=new THREE.Mesh(new THREE.SphereGeometry(.062,12,8,0,Math.PI*2,0,Math.PI/2),M.blkC);cap.position.set(x,y+.12,z+.02);g.add(cap);bx(.07,.008,.05,M.blkC,x,y+.125,z+.085,g)}
    bx(.17,.14,.12,i?K.white:M.shirt,x,y,z,g);for(const sx of[1,-1])bx(.045,.045,.15,i?K.white:M.shirt,x+sx*.095,y+.01,z+.07,g).rotation.x=.35;
    if(!i)for(let k=n0;k<g.children.length;k++)g.children[k].userData.driver=true})}
// the underside every axle car shares: frame rails, gearbox, drive shafts, skid plate, exhaust, coil springs and dampers
function carUnder(g,cfg,y,o){o=o||{};const K=carKit(),L=cfg.L,wb=cfg.wb,fx=o.x||.2;
  for(const sx of[1,-1])bx(.05,.06,L*.88,M.blkC,sx*fx,y,0,g);for(const z of[-wb/2-.14,-wb*.2,wb*.2,wb/2+.14])bx(fx*2,.04,.05,M.blkC,0,y,z,g);
  bx(.2,.11,.3,K.alu,0,y-.01,wb*.14,g);bx(.14,.09,.16,M.steel,0,y-.02,-wb*.05,g);cyl(.017,wb*.4,M.steel,0,y-.05,wb*.3,g,'z',6);cyl(.017,wb*.42,M.steel,0,y-.05,-wb*.28,g,'z',6);
  {const s=bx(fx*2+.06,.014,.3,M.steel,0,y-.05,L/2-.2,g);s.rotation.x=-.3}
  bx(.24,.08,.3,M.blkC,fx*.55,y+.01,-wb*.22,g);                                                                                         // fuel tank
  if(o.pipe!==false){cyl(.02,L*.5,M.steel,-fx-.07,y+.0,-L*.2,g,'z',8);cyl(.045,.24,M.steel,-fx-.07,y+.0,-wb*.18,g,'z',10);cyl(.026,.1,K.chrome,-fx-.07,y+.0,-L/2-.05,g,'z',10);cyl(.019,.102,M.blk,-fx-.07,y+.0,-L/2-.051,g,'z',8)}
  for(const sx of[1,-1])for(const wz of[wb/2,-wb/2]){cyl(.036,.15,o.spring||M.red,sx*(fx+.09),y-.07,wz,g,null,10);const d=cyl(.014,.26,M.steel,sx*(fx+.09),y-.06,wz+.07,g,null,6);d.rotation.x=.25}}
// tail lamps: a red lamp (brighter when you brake), amber above and the white reversing lamp below, in a black housing
function carTail(g,x,y,z,w=.05){const K=carKit();bx(w+.02,.16,.012,M.blkC,x,y,z+.004,g);bx(w,.065,.014,M.tail,x,y,z-.004,g);bx(w,.03,.014,M.amber,x,y+.054,z-.004,g);bx(w,.03,.014,K.rev,x,y-.054,z-.004,g)}

/* ---------- wheels ---------- */
// the standard wheel (radius r, .19 wide): an off-road tyre with rounded shoulders, two rows of staggered blocks and shoulder lugs,
// on a dished rim with six spokes, a steel lip, hub with nuts and the brake drum behind. o.rim: another material for the rim face
function buildWheel(r,side,o){o=o||{};
  const root=new THREE.Group(),spin=new THREE.Group(),w=.19,rr=r*.6,rimM=o.rim||M.rim;root.add(spin);
  const prof=[[rr,w/2-.014],[r*.78,w/2],[r*.9,w/2-.008],[r*.94,w/2-.035],[r*.94,-w/2+.035],[r*.9,-w/2+.008],[r*.78,-w/2],[rr,-w/2+.014]].map(p=>new THREE.Vector2(p[0],p[1]));
  const tire=new THREE.Mesh(new THREE.LatheGeometry(prof,20),M.tire);tire.rotation.z=Math.PI/2;tire.castShadow=true;spin.add(tire);
  const n=o.lugs||18,lugG=new THREE.BoxGeometry(.082,.06,r*.26),shG=new THREE.BoxGeometry(.03,.07,r*.2);
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2;for(const sx of[-1,1]){const m=new THREE.Mesh(lugG,M.tire),off=(i%2?.022:-.022)*sx,a2=a+(sx>0?0:Math.PI/n);
    m.position.set(sx*.046+off,Math.cos(a2)*(r-.03),Math.sin(a2)*(r-.03));m.rotation.x=a2;m.rotation.y=sx*.25;m.castShadow=true;spin.add(m);
    if(i%2===0){const s=new THREE.Mesh(shG,M.tire);s.position.set(sx*(w/2-.012),Math.cos(a2)*(r*.9),Math.sin(a2)*(r*.9));s.rotation.x=a2;spin.add(s)}}}
  cyl(rr,w-.03,M.blk,0,0,0,spin,'x',16);                                                                    // the barrel
  const fx=side*(w/2-.014),lip=new THREE.Mesh(new THREE.TorusGeometry(rr*.97,.011,6,20),M.steel);lip.rotation.y=Math.PI/2;lip.position.x=fx;spin.add(lip);
  cyl(rr*.93,.02,M.blk,side*(w/2-.03),0,0,spin,'x',18);                                                     // the dished face
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2,s=bx(.03,rr*.74,rr*.24,rimM,side*(w/2-.014),Math.cos(a)*rr*.52,Math.sin(a)*rr*.52,spin);s.rotation.x=a}
  cyl(rr*.36,.03,rimM,side*(w/2-.004),0,0,spin,'x',12);cyl(rr*.17,.03,M.steel,side*(w/2+.006),0,0,spin,'x',8);
  for(let i=0;i<6;i++){const a=(i+.5)/6*Math.PI*2;cyl(rr*.05,.02,M.steel,side*(w/2+.006),Math.cos(a)*rr*.26,Math.sin(a)*rr*.25,spin,'x',6)}
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;cyl(rr*.035,.012,M.blk,fx+side*.008,Math.cos(a)*rr*.97,Math.sin(a)*rr*.97,spin,'x',5)}   // beadlock bolts
  cyl(rr*.8,.03,M.blk,-side*(w/2-.03),0,0,spin,'x',14);cyl(rr*.3,.05,M.steel,-side*(w/2-.02),0,0,spin,'x',8);   // brake drum and the axle end on the inside
  return{root,spin};
}
// the wheel for a car: the standard wheel, scaled up for a car with its own wheel size (cfg.wr radius, cfg.tireW tire width; tireWr wider at the back)
function carWheel(cfg,side,rear){if(cfg.style==='skuter')return buildSkuterSki(cfg,side,rear);if(cfg.style==='sport')return buildSportWheel(cfg,side,rear);if(cfg.style==='trophy')return buildTrophyWheel(cfg,side);
  const K=carKit(),w=buildWheel(WR,side,cfg.style==='rally'?{rim:K.white,lugs:26}:cfg.style==='buggy'?{rim:K.chrome}:cfg.style==='truck'?{lugs:14}:null),k=(cfg.wr||WR)/WR,tw=rear&&cfg.tireWr||cfg.tireW||.19;
  if(cfg.wr||cfg.tireW||cfg.tireWr)w.spin.scale.set(tw/.19,k,k);return w}
function buildBody(cfg){FLAG_NOW=cfg.flag!==undefined?cfg.flag:prof.flag;if(cfg.style==='skuter')return buildSkuter(cfg);if(cfg.style==='monster')return buildMonster(cfg);if(cfg.style==='sport')return buildSport(cfg);if(cfg.style==='trophy')return buildTrophy(cfg);
  if(cfg.style==='open')return buildOpen(cfg);if(cfg.style==='van')return buildVan(cfg);if(cfg.style==='truck')return buildTruck(cfg);if(cfg.style==='rally')return buildRally(cfg);if(cfg.style==='buggy')return buildBuggy(cfg);
  const g=new THREE.Group(),K=carKit(),L=cfg.L,W=.92,y0=.08,lh=.34,gh=cfg.gh,hood=cfg.hood,yT=y0+lh,fz=L/2,rz=-L/2,glassy=cfg.style==='glass';
  carUnder(g,cfg,-.02);
  rbx(W,lh,L,.035,M.yel,0,y0+lh/2,0,g);
  bx(W+.012,.05,L*.95,M.blkC,0,y0+.025,0,g);
  const bedL=cfg.style==='pickup'?(L-cfg.hood)*.5:0;
  const gz0=rz+.03+bedL,gz1=fz-hood,gl=gz1-gz0,gc=(gz0+gz1)/2,gy=yT+gh/2,ghW=glassy?W-.06:W-.04;
  const wlo=yT+(glassy?.04:.055),whi=yT+gh-(glassy?.02:.035),nw=cfg.win,seg=gl/nw,pw=glassy?.035:.07,xp=ghW/2-.016;   // the side windows reach from wlo to whi; pw: the pillar between two windows
  // the cabin: a floor, a band under the windows, a header over them, pillars between them and the glass. You see the seats and the crew through it
  bx(ghW-.03,.012,gl-.03,K.cabin,0,yT+.006,gc,g);
  for(const sx of[1,-1]){bx(.032,wlo-yT,gl,M.yel,sx*xp,(yT+wlo)/2,gc,g);bx(.032,yT+gh-whi,gl,M.yel,sx*xp,(whi+yT+gh)/2,gc,g);
    for(let i=0;i<=nw;i++){const e=i===0?1:i===nw?-1:0,d=e?pw/2+.012:pw;bx(.032,gh,d,M.yel,sx*xp,gy,gz1-seg*i-e*d/2,g)}
    bx(.06,gh,.04,M.yel,sx*(ghW/2-.03),gy,gz1-.02,g);bx(.1,gh,.04,M.yel,sx*(ghW/2-.05),gy,gz0+.02,g)}
  bx(ghW,.045,.04,M.yel,0,yT+.0225,gz1-.02,g);bx(ghW,.04,.04,M.yel,0,yT+gh-.02,gz1-.02,g);bx(ghW,.06,.04,M.yel,0,yT+.03,gz0+.02,g);bx(ghW,.045,.04,M.yel,0,yT+gh-.0225,gz0+.02,g);
  bx(ghW-.02,.014,gl-.02,K.cabin,0,yT+gh-.012,gc,g);                                                                                // the headliner
  if(bedL){const bz=rz+.03+bedL/2;bx(W-.04,.04,bedL-.06,M.blkC,0,yT+.02,bz,g);for(const sx of[1,-1]){bx(.03,.14,bedL-.06,M.yel,sx*(W/2-.035),yT+.07,bz,g);bx(.04,.02,bedL-.04,M.blkC,sx*(W/2-.035),yT+.15,bz,g)}bx(W-.04,.14,.03,M.yel,0,yT+.07,rz+.045,g);bx(W-.02,.02,.04,M.blkC,0,yT+.15,rz+.045,g);   // the bed, side walls and tailgate
    for(let i=0;i<5;i++)bx(W-.12,.008,.03,M.steel,0,yT+.044,bz-bedL/2+.12+i*(bedL-.2)/4,g);                                            // ribs in the bed floor
    bx(.14,.12,.2,M.can,.2,yT+.1,bz+.1,g);bx(.14,.12,.2,M.red,.02,yT+.1,bz+.1,g);bx(.26,.1,.16,M.red,-.15,yT+.09,bz-.15,g);bx(.27,.015,.17,M.blkC,-.15,yT+.145,bz-.15,g);   // cans and a toolbox in the bed
    for(const sx of[1,-1])bx(.025,.42,.025,M.blkC,sx*(W/2-.1),yT+.25,gz0-.06,g);bx(W-.2,.025,.025,M.blkC,0,yT+.46,gz0-.06,g);for(let i=0;i<3;i++)cyl(.028,.025,M.lamp,-.16+i*.16,yT+.5,gz0-.04,g,'z')}   // hoop behind the cab with lights
  bx(ghW-.12,gh-.08,.01,K.glassT,0,gy+.005,gz1-.004,g);
  bx(ghW-.2,gh-.1,.01,K.glassT,0,gy+.01,gz0+.004,g);
  g.userData.door={x:W/2,xg:ghW/2,ya:y0+.06,yb:yT,yc:yT+gh-.02,z:gz1-.085,len:Math.min(.5,seg-.11)};   // where the front doors are: js/walker.js swings one open when the driver gets out
  for(let i=0;i<nw;i++){const zc=gz1-seg*(i+.5),ww=glassy?seg-.035:seg-.07;for(const sx of[1,-1])bx(.01,whi-wlo,ww,K.glassT,sx*(ghW/2-.004),(wlo+whi)/2,zc,g)}
  let roofY=yT+gh;if(cfg.style!=='pickup'){rbx(ghW+.03,.035,gl+.03,.014,M.yel,0,roofY+.0155,gc,g);for(const sx of[1,-1])bx(.012,.012,gl-.04,M.blkC,sx*(ghW/2+.012),roofY+.004,gc,g);roofY+=.03}   // the roof and its gutters
  let rackZ0=gz0+.02,rackZ1=gz1+.06;
  if(cfg.style==='step'){const sl=gl*.55,sc=gz0+sl/2;rbx(ghW-.02,.075,sl,.014,M.yel,0,roofY+.035,sc,g);
    for(const sx of[1,-1])bx(.012,.035,sl-.1,M.glass,sx*((ghW-.02)/2+.004),roofY+.035,sc,g);bx(ghW-.1,.035,.012,M.glass,0,roofY+.035,sc+sl/2+.004,g);roofY+=.07}
  // inside: dashboard, steering wheel, seats (and a bench behind in the long cabins)
  bx(ghW-.07,.07,.09,K.cabin,0,yT+.04,gz1-.08,g);bx(.12,.03,.03,M.blk,.2,yT+.085,gz1-.06,g);carWheelStick(g,.2,yT+.1,gz1-.16);
  for(const sx of[1,-1])carSeat(g,sx*.2,yT+.004,gz1-.3,.2,Math.min(.2,gh-.1));
  if(gl>1.05){const zb=gz1-.3-Math.min(.5,seg);bx(ghW-.14,.045,.19,K.seat,0,yT+.026,zb,g);bx(ghW-.14,Math.min(.18,gh-.1),.04,K.seat,0,yT+.11,zb-.105,g)}
  // the hood with its seam and vents, wipers, the grille with a badge, headlights, indicators and tail lamps
  rbx(W-.22,.03,hood-.08,.012,M.yel,0,yT+.01,fz-hood/2,g);
  for(const sx of[1,-1]){bx(.1,.006,hood*.3,M.blkC,sx*.26,yT+.026,fz-hood*.55,g);const wp=bx(.17,.008,.01,M.blk,sx*.14-.03,yT+.085,gz1+.008,g);wp.rotation.z=.42;bx(.02,.02,.02,M.blk,sx*.14+.04,yT+.05,gz1+.01,g)}
  bx(W-.16,.17,.02,M.blkC,0,y0+.2,fz+.01,g);
  for(let i=0;i<4;i++)bx(W-.3,.012,.022,M.steel,0,y0+.14+i*.04,fz+.015,g);bx(.1,.035,.012,K.chrome,0,y0+.305,fz+.016,g);
  for(const sx of[1,-1]){carLamp(g,sx*.33,y0+.21,fz);bx(.05,.03,.015,M.amber,sx*.33,y0+.12,fz+.015,g);carTail(g,sx*.4,y0+.22,rz-.004);
    bx(.008,.022,.05,M.amber,sx*(W/2+.003),y0+.28,fz-.1,g);
    const mir=bx(.03,.07,.05,M.blkC,sx*(W/2+.06),yT+.08,gz1-.05,g);mir.castShadow=false;bx(.012,.05,.035,K.chrome,sx*(W/2+.075),yT+.08,gz1-.062,g);bx(.05,.012,.012,M.blkC,sx*(W/2+.03),yT+.06,gz1-.05,g);
    bx(.012,.014,.12,M.blkC,sx*(W/2+.006),y0+.1,gz1-.42,g);
    for(const z of[gz1-.085,gz1-.085-Math.min(.5,seg-.11)])bx(.005,lh-.1,.008,M.blkC,sx*(W/2+.001),y0+lh/2+.03,z,g);                     // door shut lines
    for(const wz of[cfg.wb/2,-cfg.wb/2])bx(.15,.13,.012,K.rubber,sx*(W/2-.05),y0-.045,wz-.33,g)}                                         // mud flaps
  cyl(.028,.012,M.blkC,-(W/2+.002),y0+.25,rz+.26,g,'x',10);                                                                           // fuel cap
  bx(W+.1,.08,.1,M.blkC,0,y0+.01,fz+.06,g);bx(.2,.07,.08,M.steel,0,y0+.01,fz+.13,g);
  for(const sx of[1,-1])bx(.03,.24,.03,M.blkC,sx*.22,y0+.16,fz+.11,g);bx(.47,.03,.03,M.blkC,0,y0+.27,fz+.11,g);
  bx(W+.06,.08,.09,M.blkC,0,y0+.01,rz-.05,g);
  bx(.2,.1,.008,M.plate,0,y0+.08,rz-.098,g);carPlate(g,0,y0+.08,rz-.1025,-1,.19);
  for(const sx of[1,-1])for(const wz of[cfg.wb/2,-cfg.wb/2])bx(.05,.05,.56,M.blkC,sx*(W/2+.02),y0+.08,wz,g);
  if(cfg.snorkel||(cfg.tune&&cfg.tune.snorkel)){cyl(.025,gh+.2,M.blkC,-(W/2+.03),yT+gh/2+.03,gz1+.03,g);cyl(.03,.2,M.blkC,-(W/2+.03),yT-.03,gz1+.12,g,'z',8);cyl(.055,.07,M.blkC,-(W/2+.03),yT+gh+.14,gz1+.03,g,'z',10);bx(.06,.03,.06,M.steel,-(W/2+.03),yT+gh+.185,gz1+.03,g)}
  if(cfg.winch||(cfg.tune&&cfg.tune.lv.gear>=2)){bx(.22,.09,.1,M.steel,0,y0+.12,fz+.12,g);cyl(.02,.2,M.blkC,0,y0+.12,fz+.12,g,'x',8);if(cfg.winch||cfg.tune.lv.gear>=3){cyl(.045,.16,M.blkC,0,y0+.13,fz+.12,g,'x',10);cyl(.05,.12,M.trim,0,y0+.13,fz+.12,g,'x',10);bx(.04,.04,.06,M.steel,0,y0+.13,fz+.2,g);bx(.05,.02,.05,M.red,0,y0+.13,fz+.24,g)}}
  // ---- details on every car: window frames, door handles, rock sliders, fender flares, tow hooks, front plate, light bar on a hoop, rear bumper, ladder, antenna ----
  const X=cfg.extras||[];
  for(let i=0;i<nw;i++){const zc=gz1-seg*(i+.5),ww=cfg.style==='glass'?seg-.035:seg-.07,wh=gh-(cfg.style==='glass'?.06:.09);for(const sx of[1,-1]){const fx=sx*(ghW/2+.004);
    bx(.008,.012,ww+.02,M.trim,fx,gy+.01+wh/2,zc,g);bx(.008,.012,ww+.02,M.trim,fx,gy+.01-wh/2,zc,g);bx(.008,wh,.012,M.trim,fx,gy+.01,zc-ww/2,g);bx(.008,wh,.012,M.trim,fx,gy+.01,zc+ww/2,g);
    if(i<2)bx(.014,.022,.09,M.blkC,sx*(W/2+.007),yT-.05,zc-ww/2+.1,g)}}                                                       // frames and handles
  for(const sx of[1,-1]){bx(.06,.04,L*.5,M.blkC,sx*(W/2+.05),y0-.02,0,g);for(let k=-1;k<=1;k++)bx(.05,.03,.03,M.blkC,sx*(W/2+.03),y0,k*L*.18,g)}   // rock sliders
  for(const sx of[1,-1])for(const wz of[cfg.wb/2,-cfg.wb/2]){bx(.04,.07,.7,M.blkC,sx*(W/2+.012),y0+.18,wz,g);bx(.03,.22,.05,M.blkC,sx*(W/2+.012),y0+.06,wz+.34,g);bx(.03,.22,.05,M.blkC,sx*(W/2+.012),y0+.06,wz-.34,g)}   // fender flares
  for(const sx of[1,-1]){bx(.05,.05,.08,M.red,sx*.3,y0+.03,fz+.1,g);bx(.05,.05,.08,M.red,sx*.3,y0+.03,rz-.09,g)}           // tow hooks
  bx(.26,.08,.01,M.plate,0,y0+.1,fz+.115,g);carPlate(g,0,y0+.1,fz+.1205,1,.24);
  {const hy=yT+gh*.35,hz=fz-hood+.06;for(const sx of[1,-1])bx(.025,.22,.025,M.blkC,sx*(W/2-.12),yT+.11,hz,g);bx(W-.2,.025,.025,M.blkC,0,hy+.08,hz,g);   // hoop over the hood
    if(X.includes('lightbar')){bx(W-.3,.05,.04,M.blkC,0,hy+.12,hz+.01,g);bx(W-.36,.03,.012,M.lamp,0,hy+.12,hz+.035,g)}else for(let i=0;i<4;i++){cyl(.03,.025,M.lamp,-.24+i*.16,hy+.13,hz+.02,g,'z');cyl(.034,.02,M.blkC,-.24+i*.16,hy+.13,hz-.002,g,'z')}}
  bx(W+.06,.04,.04,M.blkC,0,y0+.26,rz-.1,g);for(const sx of[1,-1])bx(.06,.05,.02,M.tail,sx*.3,y0+.26,rz-.125,g);          // rear bumper bar and lamps
  if(X.includes('ladder')){const lx=W/2+.04,n=Math.max(3,Math.round((roofY-y0)/.12));for(const dz of[-.07,.07])bx(.02,roofY-y0+.1,.02,M.blkC,lx,(roofY+y0)/2+.05,rz+.18+dz,g);for(let k=0;k<n;k++)bx(.02,.02,.17,M.blkC,lx,y0+.1+k*.12,rz+.18,g)}
  {const az=gz0+.1;cyl(.008,.55,M.blkC,-(W/2-.06),roofY+.25,az,g);const ball=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),M.red);ball.position.set(-(W/2-.06),roofY+.53,az);g.add(ball);
    const fm=flagMat(FLAG_NOW);if(fm){const fl=new THREE.Mesh(new THREE.PlaneGeometry(.21,.14),fm);fl.position.set(-(W/2-.06),roofY+.435,az-.113);fl.rotation.y=Math.PI/2;fl.castShadow=true;g.add(fl)}}   // antenna, with the flag from the garage
  if(X.includes('sandLadders'))for(const sx of[1,-1]){const m=bx(.03,.2,.9,M.orange,sx*(W/2+.07),yT-.02,gz0+.5,g);for(let k=0;k<6;k++)bx(.035,.03,.06,M.blkC,sx*(W/2+.07),yT-.02,gz0+.1+k*.16,g)}   // sand ladders on the flanks
  if(X.includes('jack'))bx(.05,.3,.08,M.red,W/2+.06,yT+.04,gz0+1.1,g);
  // roof rack
  const ry=roofY+.07,rl=rackZ1-rackZ0,rc=(rackZ0+rackZ1)/2,rw=W-.08;
  for(const sx of[1,-1]){bx(.025,.025,rl,M.blkC,sx*rw/2,ry,rc,g);bx(.025,.08,.025,M.blkC,sx*rw/2,ry-.04,rackZ0+.03,g);bx(.025,.08,.025,M.blkC,sx*rw/2,ry-.04,rackZ1-.03,g)}
  for(let z=rackZ0;z<=rackZ1+.001;z+=Math.max(.14,rl/8))bx(rw,.014,.02,M.blkC,0,ry-.004,z,g);
  bx(rw-.08,.05,.05,M.blkC,0,ry+.04,rackZ1-.01,g);
  if(cfg.tune&&cfg.tune.led){bx(rw-.1,.045,.04,M.blkC,0,ry+.045,rackZ1+.01,g);bx(rw-.16,.025,.012,M.lamp,0,ry+.045,rackZ1+.032,g)}   // the LED bar from the garage sits on the rack; the hoop lights are standard
  const can=(x,z,mat)=>{bx(.14,.12,.2,mat,x,ry+.07,rc+z,g);bx(.03,.02,.12,M.blkC,x,ry+.14,rc+z,g)};
  const spade=(sx)=>{cyl(.012,.6,M.wood,sx*(rw/2+.03),ry+.02,rc,g,'z',6);bx(.02,.09,.12,M.steel,sx*(rw/2+.03),ry+.02,rc+.33,g)};
  const axe=(sx)=>{cyl(.011,.42,M.wood,sx*(rw/2+.03),ry+.05,rc-.1,g,'z',6);bx(.025,.08,.07,M.steel,sx*(rw/2+.035),ry+.07,rc+.13,g)};
  if(X.includes('cans2')){can(.17,-.15,M.can);can(-.02,-.15,M.red)}
  if(X.includes('cans3')){can(.2,-.2,M.can);can(.02,-.2,M.red);can(-.16,-.2,M.can)}
  if(X.includes('box')){bx(.4,.14,.3,M.blkC,-.1,ry+.08,rc+.22,g);bx(.42,.02,.32,M.steel,-.1,ry+.155,rc+.22,g)}
  if(X.includes('toolbox')){bx(.26,.1,.16,M.red,.12,ry+.06,rc+.2,g);bx(.27,.015,.17,M.blkC,.12,ry+.115,rc+.2,g)}
  if(X.includes('tent')){cyl(.07,.52,M.orange,0,ry+.08,rc+.25,g,'x',10);for(const dx of[-.18,.18])bx(.02,.16,.16,M.blkC,dx,ry+.08,rc+.25,g)}
  if(X.includes('crates')){const r=cfg.spare==='rack';bx(.22,.14,.2,M.blue,r?.13:-.2,ry+.08,r?rc-.22:rc-.18,g);bx(.2,.12,.22,M.green,r?.13:.1,ry+.07,r?rc+.01:rc-.18,g);bx(.18,.1,.14,M.orange,r?.31:.26,ry+.06,r?rc-.12:rc+.1,g)}   // beside the spare when it lies on the rack
  if(X.includes('tarp')){const tz=rc+.48;bx(.5,.1,.36,M.canvas,0,ry+.06,tz,g);for(const dz of[-.12,.12])bx(.54,.012,.02,M.blkC,0,ry+.115,tz+dz,g)}   // in front of the cans and the toolbox
  if(X.includes('spade'))spade(1);if(X.includes('axe'))axe(-1);
  // spare
  const sp=buildWheel(.2,1);sp.root.scale.set(.85,.85,.85);
  if(cfg.spare==='rear'){sp.root.position.set(0,y0+.24,rz-.21);sp.root.rotation.y=Math.PI/2;bx(.05,.05,.1,M.blkC,0,y0+.24,rz-.13,g)}   // behind the bumper bar, on a short bracket
  else if(cfg.spare==='hood'){sp.root.position.set(0,yT+.09,fz-hood/2);sp.root.rotation.z=Math.PI/2}
  else{sp.root.position.set(-.18,ry+.08,rc-.1);sp.root.rotation.z=Math.PI/2}
  g.add(sp.root);
  for(const sx of[1,-1]){const p=new THREE.Mesh(new THREE.PlaneGeometry(.32,.16),decalMat);p.position.set(sx*(W/2+.004),y0+.2,gz1-.28);p.rotation.y=sx>0?Math.PI/2:-Math.PI/2;g.add(p)}
  const hd=new THREE.Mesh(new THREE.PlaneGeometry(.3,.15),decalMat);hd.rotation.x=-Math.PI/2;hd.position.set(0,yT+.024,fz-hood/2);if(cfg.spare!=='hood')g.add(hd);
  // driver + navigator. The driver (on the left) is marked, so he can be hidden while he is out of the car (js/walker.js)
  carCrew(g,(cfg.win>1?[1,-1]:[1]).map(sx=>[sx*.2,yT+.03,gz1-.32]));
  return g;
}
/* ---------- the monster truck: a wide shell high over big wheels, fenders over the tyres, a short cab and bed, and the black chassis with shocks and bumpers underneath ---------- */
function buildMonster(cfg){
  const cz1X=.43,g=new THREE.Group(),L=cfg.L,wb=cfg.wb,tr=cfg.track||TRACK,yB=.42,fz=.95,rz=-.95,fw=tr/2+(cfg.tireW||.19)/2-.48;   // yB: the beltline over the fenders; fw: how far a fender reaches out past the shell
  // chassis: the tub, skid plates, bumpers with struts, the shocks down to the axles
  bx(.5,.1,1.9,M.blkC,0,-.1,0,g);for(const sz of[1,-1]){bx(.42,.03,.3,M.steel,0,-.15,sz*.95,g);bx(1.02,.08,.08,M.blkC,0,-.03,sz*(L/2-.05),g);for(const sx of[1,-1])bx(.04,.14,.18,M.blkC,sx*.22,-.02,sz*(L/2-.17),g)}
  for(const sx of[1,-1])for(const wz of[wb/2,-wb/2])for(const dz of[-.07,.07]){const s=cyl(.03,.5,M.steel,sx*.44,.08,wz+dz,g,null,8);s.rotation.z=sx*.35;const b=cyl(.042,.22,M.red,sx*.4,.2,wz+dz,g,null,8);b.rotation.z=sx*.35}
  // the shell: sides between the wheels, fenders over the tyres and steps between them, all in the paint
  rbx(.96,.3,1.9,.035,M.yel,0,yB-.17,0,g);
  for(const sx of[1,-1]){const fx=sx*(.48+fw/2);
    for(const wz of[wb/2,-wb/2]){bx(fw,.04,.86,M.yel,fx,yB,wz,g);bx(.04,.07,.88,M.blkC,sx*(.48+fw),yB-.01,wz,g);for(const dz of[-.43,.43])bx(fw,.14,.04,M.yel,fx,yB-.07,wz+dz,g)}
    bx(fw,.04,wb-.86,M.yel,fx,yB,0,g);bx(.04,.05,wb-.86,M.blkC,sx*(.48+fw),yB-.01,0,g);
    // graphics on the flanks: a black stripe and three slashes, the sticker
    bx(.012,.04,1.8,M.blkC,sx*.486,.18,0,g);for(let i=0;i<3;i++){const m=bx(.012,.2,.05,M.blkC,sx*.486,.3,-.55+i*.12,g);m.rotation.x=.6}
    const p=new THREE.Mesh(new THREE.PlaneGeometry(.32,.16),decalMat);p.position.set(sx*.487,.3,.35);p.rotation.y=sx>0?Math.PI/2:-Math.PI/2;g.add(p)}
  // hood, grille and lights
  rbx(.96,.1,.52,.025,M.yel,0,yB+.05,fz-.26,g);bx(.5,.03,.36,M.blkC,0,yB+.11,fz-.28,g);   // the hood with a black scoop
  bx(.8,.22,.02,M.blkC,0,.27,fz+.01,g);for(let i=0;i<4;i++)bx(.6,.012,.022,M.steel,0,.2+i*.045,fz+.016,g);
  for(const sx of[1,-1]){carLamp(g,sx*.32,.32,fz);bx(.06,.03,.015,M.amber,sx*.32,.2,fz+.016,g);carTail(g,sx*.38,.3,rz-.004,.06);
    for(const z of[cz1X-.02,cz1X-.5])bx(.005,.2,.008,M.blkC,sx*.481,yB-.16,z,g);bx(.014,.022,.08,M.blkC,sx*.486,yB-.06,cz1X-.42,g);                            // door seams and handles
    cyl(.03,.5,carKit().chrome,sx*.36,yB+.26,-.36,g,null,10);cyl(.034,.04,M.blk,sx*.36,yB+.5,-.36,g,null,10);bx(.05,.05,.08,M.red,sx*.3,-.03,L/2+.0,g)}   // exhaust stacks behind the cab, tow hooks
  bx(.1,.035,.012,carKit().chrome,0,.4,fz+.016,g);{const s=bx(.5,.016,.34,carKit().alu,0,-.13,L/2-.2,g);s.rotation.x=-.4}
  for(const sx of[1,-1])bx(.03,.3,.03,M.blkC,sx*.26,.12,L/2+.0,g);bx(.55,.03,.03,M.blkC,0,.26,L/2+.0,g);                                   // bull bar
  // the cab: windows all round, a roof with four lamps on a bar
  const cz0=-.3,cz1=.43,cl=cz1-cz0,cc=(cz0+cz1)/2,gh=.22,gy=yB+gh/2;
  rbx(.9,gh,cl,.02,M.yel,0,gy,cc,g);rbx(.94,.035,cl+.04,.014,M.yel,0,yB+gh+.015,cc,g);
  bx(.78,gh-.07,.012,M.glass,0,gy+.01,cz1+.006,g);bx(.7,gh-.09,.012,M.glass,0,gy+.01,cz0-.006,g);
  for(const sx of[1,-1]){bx(.012,gh-.08,cl-.14,M.glass,sx*.456,gy+.01,cc,g);bx(.03,.06,.05,M.blkC,sx*.5,yB+.06,cz1-.04,g)}   // side windows and mirrors
  bx(.6,.04,.04,M.blkC,0,yB+gh+.05,cz1-.06,g);for(let i=0;i<4;i++)cyl(.028,.025,M.lamp,-.21+i*.14,yB+gh+.06,cz1-.035,g,'z');
  // the bed: floor, walls and tailgate
  const bl=cz0-rz,bc=(cz0+rz)/2;bx(.9,.02,bl,M.blkC,0,yB+.01,bc,g);for(const sx of[1,-1])bx(.04,.1,bl,M.yel,sx*.46,yB+.05,bc,g);bx(.96,.1,.04,M.yel,0,yB+.05,rz+.02,g);
  bx(.2,.1,.008,M.plate,0,.2,rz-.004,g);carPlate(g,0,.2,rz-.009,-1,.19);bx(.24,.07,.008,M.plate,0,.02,L/2+.052,g);carPlate(g,0,.02,L/2+.057,1,.22);
  // in the bed: a roll hoop with braces, a spare wheel lying flat and a fuel cell; the wheelie bar behind
  for(const sx of[1,-1]){tbTube([sx*.4,yB+.04,cz0-.1],[sx*.36,yB+gh+.06,cz0-.12],.022,M.blkC,g);tbTube([sx*.36,yB+gh+.06,cz0-.12],[sx*.4,yB+.06,rz+.08],.018,M.blkC,g)}
  tbTube([-.36,yB+gh+.06,cz0-.12],[.36,yB+gh+.06,cz0-.12],.022,M.blkC,g);
  {const sp=buildWheel(.2,1);sp.root.scale.set(.9,.9,.9);sp.root.position.set(0,yB+.1,bc-.08);sp.root.rotation.z=Math.PI/2;g.add(sp.root)}bx(.3,.1,.14,M.red,0,yB+.07,cz0-.1,g);cyl(.025,.02,M.blk,.08,yB+.13,cz0-.1,g,null,8);
  for(const sx of[1,-1]){tbTube([sx*.2,-.06,rz],[sx*.2,-.16,rz-.3],.016,M.steel,g);cyl(.04,.03,M.blk,sx*.2,-.16,rz-.3,g,'x',10)}tbTube([-.2,-.16,rz-.3],[.2,-.16,rz-.3],.012,M.steel,g);
  const hd=new THREE.Mesh(new THREE.PlaneGeometry(.3,.15),decalMat);hd.rotation.x=-Math.PI/2;hd.position.set(0,yB+.101,fz-.12);g.add(hd);
  return g;
}
/* ---------- the sports car (911 Turbo): a smooth shell lofted through real cross sections, with glass, intakes and trim laid on the same surface ----------
   SP911 is the real car in millimetres. One row per station along the car:
   [s back from the nose, floor, half width, height of the widest point, shoulder, crest x, crest y, edge x, edge y, top centre]
   crest: the fender top at the front, the window line along the cabin, the rear haunch at the back.
   edge:  the hood edge, the A-pillar, the roof edge, the rear window and the engine lid. The model is scaled so the wheelbase matches cfg.wb. */
const SP911={axF:1000,axR:3450,arch:408,len:4535,rows:[
  [0,   400,420,460,510,300,530,160,540,540],
  [15,  300,600,450,545,430,570,230,575,572],
  [45,  230,745,445,590,545,615,285,612,602],
  [130, 180,840,450,645,640,672,320,652,642],
  [320, 155,895,470,705,690,748,350,692,682],
  [650, 145,918,490,775,700,812,370,732,722],
  [1000,140,922,500,805,700,845,380,765,760],
  [1350,135,915,510,830,735,862,430,810,805],
  [1650,130,905,520,850,780,880,640,885,870],
  [1900,125,900,520,855,785,890,610,1030,1045],
  [2150,125,900,520,860,780,900,580,1170,1190],
  [2400,125,905,530,865,775,910,565,1245,1268],
  [2650,125,915,540,870,775,920,560,1268,1300],
  [2950,130,930,560,885,780,935,560,1252,1288],
  [3200,135,945,590,905,785,955,565,1215,1250],
  [3450,150,952,620,930,775,980,560,1150,1185],
  [3700,170,948,640,955,740,1000,545,1085,1112],
  [3950,200,932,650,965,700,1010,540,1040,1060],
  [4200,240,905,650,960,670,1000,540,1012,1030],
  [4400,270,865,640,940,620,975,520,985,1002],
  [4500,290,820,620,905,560,940,480,950,965],
  [4535,320,760,600,860,500,890,420,925,938]]};
// one station between the rows: cubic Hermite through the rows, so the body has no kinks where the rows meet
function spRow(T,s){const R=T.rows,n=R.length;let i=0;while(i<n-2&&R[i+1][0]<s)i++;const a=R[i],b=R[i+1],h=b[0]-a[0],t=Math.min(1,Math.max(0,(s-a[0])/h)),t2=t*t,t3=t2*t,out=[];
  const m=(j,k)=>{const p=R[Math.max(0,j-1)],q=R[Math.min(n-1,j+1)];return(q[k]-p[k])/(q[0]-p[0])};
  for(let k=1;k<a.length;k++)out.push((2*t3-3*t2+1)*a[k]+(t3-2*t2+t)*h*m(i,k)+(3*t2-2*t3)*b[k]+(t3-t2)*h*m(i+1,k));
  return out}
let spMats=null;
function sportMats(){if(spMats)return spMats;
  const c=document.createElement('canvas');c.width=512;c.height=64;const x=c.getContext('2d');x.fillStyle='#e9e6df';x.textAlign='center';x.textBaseline='middle';x.font='700 44px "Barlow Condensed", Arial, sans-serif';
  if('letterSpacing'in x)x.letterSpacing='18px';x.fillText('PORSCHE',256,34);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;
  spMats={well:new THREE.MeshStandardMaterial({color:M.blk.color.clone(),roughness:.9,side:THREE.DoubleSide}),badge:new THREE.MeshStandardMaterial({map:t,transparent:true,roughness:.3,metalness:.6})};
  return spMats}
function buildSport(cfg){
  const T=SP911,mm=(T.axR-T.axF)/cfg.wb,yG=restWheelY(cfg)-(cfg.wr||WR),zF=cfg.wb/2+T.axF/mm,g=new THREE.Group(),SM=sportMats();   // mm per unit; yG the ground under the car at rest; zF the nose
  // the half section at s as a closed curve through both halves (so the top and the floor meet the centre line flat); u = 0 floor centre … 3 shoulder … 6 top centre
  const cache=new Map(),curve=s=>{const key=Math.round(s*4);let c=cache.get(key);if(c)return c;const[yb,w,ym,ysh,x4,y4,x5,y5,y6]=spRow(T,s),
    P=[[0,yb],[w*.92,yb+12],[w,ym],[w-22,ysh],[x4,y4],[x5,y5],[0,y6]];
    c=new THREE.CatmullRomCurve3(P.concat(P.slice(1,6).reverse().map(p=>[-p[0],p[1]])).map(p=>new THREE.Vector3(p[0],p[1],0)),true,'centripetal');cache.set(key,c);return c};
  const _c=new THREE.Vector3(),_a=new THREE.Vector3(),_b=new THREE.Vector3(),_d=new THREE.Vector3();
  const pt=(u,s,o)=>{curve(s).getPoint(u/12,_c);return o.set(_c.x/mm,_c.y/mm+yG,zF-s/mm)};
  const nrm=(u,s,o)=>{pt(u+.01,s,_a);pt(u-.01,s,_d);_a.sub(_d);pt(u,s+2,_b);pt(u,s-2,_d);_b.sub(_d);return o.crossVectors(_b,_a).normalize()};
  // a sheet of the surface on both sides: cols are stations {s}, us(col) the u values down that station; off lifts it off the paint (glass, trim). Two cols on the same s are a cut (the wheel arches).
  const sheet=(cols,us,mat,off=0)=>{const P=[],N=[],I=[],p=new THREE.Vector3(),n=new THREE.Vector3(),A=new THREE.Vector3(),B=new THREE.Vector3(),C=new THREE.Vector3();
    for(const sx of[1,-1]){const base=P.length/3;let nu=0;
      for(const c of cols){const U=us(c);nu=U.length;for(const u of U){nrm(u,c.s,n);pt(u,c.s,p).addScaledVector(n,off);P.push(p.x*sx,p.y,p.z);N.push(n.x*sx,n.y,n.z)}}
      for(let j=0;j<cols.length-1;j++){if(cols[j+1].s===cols[j].s)continue;for(let i=0;i<nu-1;i++){const v=base+j*nu+i,q=[[v,v+nu,v+nu+1],[v,v+nu+1,v+1]];
        for(const[a,b,c]of q){A.fromArray(P,a*3);B.fromArray(P,b*3).sub(A);C.fromArray(P,c*3).sub(A);const f=B.cross(C);if(f.lengthSq()<1e-14)continue;
          n.set(N[a*3]+N[b*3]+N[c*3],N[a*3+1]+N[b*3+1]+N[c*3+1],N[a*3+2]+N[b*3+2]+N[c*3+2]);if(f.dot(n)<0)I.push(a,c,b);else I.push(a,b,c)}}}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));geo.setIndex(I);
    const m=new THREE.Mesh(geo,mat);m.castShadow=!off;m.receiveShadow=true;g.add(m);return m};
  const span=(a,b,n)=>Array.from({length:n},(_,i)=>a+(b-a)*i/(n-1));
  const patch=(u0,u1,s0,s1,mat,off,nu=6,ns=8)=>sheet(span(s0,s1,ns).map(s=>({s})),()=>span(u0,u1,nu),mat,off);
  // the wheel arches: circles round the wheel centres, cut out of the lower body
  const R=T.arch,yc=(cfg.wr||WR)*mm,axS=[T.axF,T.axR];
  const uAt=(s,y)=>{let a=1,b=3;for(let k=0;k<30;k++){const m=(a+b)/2;pt(m,s,_a);((_a.y-yG)*mm<y)?a=m:b=m}return Math.min(2.9,(a+b)/2)};   // u on the flank at height y (mm above ground), 1 at the floor corner
  const S=new Set(span(0,T.len,96).map(Math.round));for(const r of T.rows)S.add(r[0]);
  const cols=[];for(const s of[...S].sort((a,b)=>a-b)){if(axS.some(a=>Math.abs(Math.abs(s-a)-R)<1))continue;cols.push({s,ax:axS.find(a=>Math.abs(s-a)<R)})}
  for(const a of axS)for(const e of[-1,1]){const s=a+e*R,i=cols.findIndex(c=>c.s>s);cols.splice(i,0,...(e<0?[{s},{s,ax:a}]:[{s,ax:a},{s}]))}   // the arch edge: the same station twice, outside and inside the arch
  sheet(cols,c=>c.ax===undefined?span(0,3,12):span(uAt(c.s,yc+Math.sqrt(Math.max(0,R*R-(c.s-c.ax)**2))),3,12),M.yel);   // floor and flanks (the same number of points in every station)
  sheet(cols.filter(c=>c.ax===undefined||Math.abs(c.s-c.ax)<R),()=>span(3,6,24),M.yel);   // shoulders, hood, roof and deck
  for(const a of axS)sheet(cols.filter(c=>c.ax===a),c=>{const yl=yc-Math.sqrt(Math.max(0,R*R-(c.s-c.ax)**2));return span(1,Math.max(1,uAt(c.s,yl)),8)},M.yel);   // the bumper and sill corners round the bottom of the arches
  // the nose and the tail: flat caps on the first and last station
  for(const[s,dz]of[[0,1],[T.len,-1]]){const ring=[];for(const u of span(0,6,36)){pt(u,s,_a);ring.push(_a.clone())}const full=ring.concat(ring.slice(1,-1).reverse().map(v=>new THREE.Vector3(-v.x,v.y,v.z)));
    const c=full.reduce((a,v)=>a.add(v),new THREE.Vector3()).multiplyScalar(1/full.length),P=[];
    for(let i=0;i<full.length;i++){const a=full[i],b=full[(i+1)%full.length];if(dz<0)P.push(c.x,c.y,c.z,b.x,b.y,b.z,a.x,a.y,a.z);else P.push(c.x,c.y,c.z,a.x,a.y,a.z,b.x,b.y,b.z)}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geo.computeVertexNormals();const m=new THREE.Mesh(geo,M.yel);m.castShadow=true;m.receiveShadow=true;g.add(m)}
  // glass with black frames: windshield, side windows (they end in the 911's point where the roof meets the window line) and the rear window
  patch(5,6,1650,2415,M.blkC,.0012,8,16);patch(5.07,6,1672,2392,M.glass,.0024,8,16);
  patch(4,5,1660,3640,M.blkC,.0012,6,40);patch(4.1,4.9,1695,3600,M.glass,.0024,6,40);patch(3.98,5.02,2915,2945,M.blkC,.0032,6,2);
  patch(5.06,6,3140,3760,M.blkC,.0012,8,14);patch(5.16,6,3170,3730,M.glass,.0024,8,14);
  // black trim: side skirts, door shut lines, door handles, the Turbo's intakes in the rear wings, the front intakes, the engine grille and the diffuser
  patch(.98,1.4,1430,3020,M.blkC,.0015,4,24);
  for(const s of[1600,2880])patch(1.15,3.99,s,s+8,M.blkC,.002,10,2);
  patch(3.5,3.68,2560,2690,M.blkC,.002,3,3);
  patch(2.2,2.95,2925,3085,M.blkC,.0018,6,6);
  patch(0,.72,12,118,M.blkC,.0018,6,6);patch(1.12,1.95,18,150,M.blkC,.0018,6,6);
  patch(5.28,6,3800,4120,M.blkC,.0015,6,6);patch(5.45,6,3777,3791,M.tail,.002,4,2);
  patch(0,1.05,4385,4535,M.blkC,.0015,6,4);
  // under the car: floor pan, and the wheel wells (liner and inner wall)
  const yfl=yG+140/mm,tr=(cfg.track||TRACK)/2,xi=tr-Math.max(cfg.tireW||.19,cfg.tireWr||0)/2-.025,Ru=R/mm,ycu=yG+yc/mm;
  bx(xi*2,.02,(T.axR-T.axF+2*R)/mm,M.blkC,0,yfl+.012,zF-(T.axF+T.axR)/2/mm,g);
  for(const a of axS){const z=zF-a/mm,xo=pt(2,a,_a).x-.004,yb=yG+Math.max(spRow(T,a-R)[0],spRow(T,a+R)[0])/mm+.004,t0=Math.asin(Math.max(-1,(yb-ycu)/Ru));for(const sx of[1,-1]){   // t0: where the liner meets the floor
    const ln=new THREE.Mesh(new THREE.CylinderGeometry(Ru,Ru,xo-xi,28,1,true,t0,Math.PI-2*t0),SM.well);ln.rotation.z=Math.PI/2;ln.position.set(sx*(xi+xo)/2,ycu,z);g.add(ln);
    bx(.008,ycu+Ru-yb,2*Ru,SM.well,sx*xi,(yb+ycu+Ru)/2,z,g)}}
  // headlights on the front fenders (oval, with a black bezel) and their beams
  const n=new THREE.Vector3(),q=new THREE.Quaternion(),Y=new THREE.Vector3(0,1,0),h=new THREE.Vector3();
  for(const sx of[1,-1]){pt(3.72,300,h);nrm(3.72,300,n);const hl=new THREE.Group();hl.position.set(sx*h.x,h.y,h.z);hl.quaternion.copy(q.setFromUnitVectors(Y,n.set(n.x*sx,n.y,n.z)));g.add(hl);
    const bz=new THREE.Mesh(new THREE.SphereGeometry(1,16,8),M.blkC);bz.scale.set(128/mm,30/mm,178/mm);hl.add(bz);
    const lm=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),M.lamp);lm.scale.set(112/mm,36/mm,158/mm);lm.position.y=.002;hl.add(lm);
    const beam=new THREE.Mesh(new THREE.ConeGeometry(.55,4,14,1,true),M.beam);beam.rotation.x=-Math.PI/2+.13;beam.position.set(sx*h.x,h.y-.26,h.z+1.98);beam.castShadow=false;g.add(beam)}
  // the tail: the light band across the whole car, the lettering, plate, tailpipes
  const zT=zF-T.len/mm,yL=830,xL=pt(uAt(T.len,yL),T.len,_a).x-.018;
  bx(xL*2+.01,62/mm,.008,M.blkC,0,yG+(yL-10)/mm,zT-.002,g);bx(xL*2,26/mm,.012,M.tail,0,yG+yL/mm,zT-.004,g);for(const sx of[1,-1])bx(.03,52/mm,.012,M.tail,sx*(xL-.015),yG+(yL-14)/mm,zT-.005,g);
  const bd=new THREE.Mesh(new THREE.PlaneGeometry(.34,.0425),SM.badge);bd.rotation.y=Math.PI;bd.position.set(0,yG+772/mm,zT-.003);g.add(bd);
  bx(520/mm,110/mm,.006,M.plate,0,yG+520/mm,zT-.004,g);bx(1300/mm,105/mm,.006,M.blkC,0,yG+385/mm,zT-.002,g);   // plate, black diffuser
  for(const sx of[1,-1]){cyl(.024,.03,M.steel,sx*.25,yG+385/mm,zT-.01,g,'z',12);cyl(.016,.032,M.blk,sx*.25,yG+385/mm,zT-.012,g,'z',10)}
  bx(520/mm,110/mm,.006,M.plate,0,yG+468/mm,zF+.003,g);carPlate(g,0,yG+468/mm,zF+.007,1,500/mm);carPlate(g,0,yG+520/mm,zT-.008,-1,500/mm);
  for(const sx of[1,-1]){bx(.05,14/mm,.012,carKit().rev,sx*.12,yG+(yL-52)/mm,zT-.004,g);cyl(.03,.012,carKit().chrome,sx*.25,yG+385/mm,zT-.004,g,'z',12);
    pt(1.5,60,_a);bx(.012,.012,.1,M.amber,sx*(_a.x+.004),_a.y+.01,_a.z-.02,g);pt(3.72,300,_a);for(const d of[-.012,.012])bx(.05,.004,.006,carKit().chrome,sx*_a.x,_a.y+.014,_a.z+d*2.2,g)}
  // the Turbo's rear wing, raised on two struts over the engine lid
  {const s=4310,deck=pt(6,s,_a).y,wy=yG+1115/mm,wz=zF-s/mm;const wg=bx(1440/mm,22/mm,300/mm,M.yel,0,wy,wz,g);wg.rotation.x=.08;bx(1440/mm,16/mm,12/mm,M.yel,0,wy+.012,wz-.07,g);
    for(const sx of[1,-1])bx(.014,wy-deck,.05,M.blkC,sx*.2,(wy+deck)/2,wz+.01,g)}
  // door mirrors at the foot of the A-pillars
  for(const sx of[1,-1]){pt(4,1730,_a);bx(.03,.012,.014,M.blkC,sx*(_a.x+.012),_a.y+.02,_a.z,g);bx(.055,.03,.04,M.yel,sx*(_a.x+.045),_a.y+.026,_a.z,g);bx(.045,.022,.004,M.glass,sx*(_a.x+.045),_a.y+.026,_a.z-.021,g)}
  return g;
}
/* ---------- the sports car's wheels: low-profile road tyres, five double spokes, brake disc and a yellow caliper that steers but does not spin ---------- */
function buildSportWheel(cfg,side,rear){
  const r=cfg.wr||WR,w=rear&&cfg.tireWr||cfg.tireW||.19,rr=r*.74,root=new THREE.Group(),spin=new THREE.Group();root.add(spin);
  const prof=[[rr,w/2-.004],[r*.93,w/2],[r-.008,w/2-.006],[r,w/2-.02],[r,-w/2+.02],[r-.008,-w/2+.006],[r*.93,-w/2],[rr,-w/2+.004]].map(p=>new THREE.Vector2(p[0],p[1]));
  const tire=new THREE.Mesh(new THREE.LatheGeometry(prof,36),M.tire);tire.rotation.z=Math.PI/2;tire.castShadow=true;spin.add(tire);
  const brl=new THREE.Mesh(new THREE.CylinderGeometry(rr,rr,w-.01,24,1,true),sportMats().well);brl.rotation.z=Math.PI/2;spin.add(brl);   // the dark rim barrel, open so the brake shows
  const fx=side*(w/2-.006),lip=new THREE.Mesh(new THREE.TorusGeometry(rr*.96,.008,6,36),M.steel);lip.rotation.y=Math.PI/2;lip.position.x=fx;spin.add(lip);cyl(rr*.97,.006,M.blk,side*(w/2-.055),0,0,spin,'x',24);   // the rim lip, the dark back of the wheel
  cyl(.7*rr,.008,M.steel,side*(w/2-.03),0,0,spin,'x',24);                                                    // brake disc
  for(let i=0;i<5;i++)for(const d of[-.13,.13]){const a=i/5*Math.PI*2+d,sp=bx(.01,rr*.72,.016,M.steel,fx+side*.004,Math.cos(a)*rr*.5,Math.sin(a)*rr*.5,spin);sp.rotation.x=a}
  cyl(rr*.26,.014,M.steel,fx+side*.006,0,0,spin,'x',16);cyl(rr*.1,.02,M.blk,fx+side*.01,0,0,spin,'x',6);          // hub and centre lock
  const cal=bx(.02,rr*.42,rr*.24,M.cal,side*(w/2-.03),0,0,root);cal.position.set(side*(w/2-.03),Math.cos(.6)*rr*.62,-Math.sin(.6)*rr*.62);cal.rotation.x=.6;
  return{root,spin};
}
/* ---------- the trophy truck: a narrow desert-racer body low between wide fenders, the tall tyres outside it, a roof scoop, a light bar,
   spare tyres and a fuel cell in the bed under a tube cage with chase lights, and long-travel suspension that moves (trophyLinks) ---------- */
let tbMats=null;
function trophyMats(){if(tbMats)return tbMats;
  // the race number on the doors, and the window nets
  const c=document.createElement('canvas');c.width=256;c.height=160;const x=c.getContext('2d');x.fillStyle='#f4f1ea';x.beginPath();x.moveTo(20,6);x.arcTo(250,6,250,154,18);x.arcTo(250,154,6,154,18);x.arcTo(6,154,6,6,18);x.arcTo(6,6,250,6,18);x.fill();
  x.strokeStyle='#14120E';x.lineWidth=7;x.stroke();x.fillStyle='#14120E';x.textAlign='center';x.textBaseline='middle';x.font='112px "Saira Stencil One", Impact, sans-serif';x.fillText('24',128,84);
  const num=new THREE.CanvasTexture(c);num.encoding=THREE.sRGBEncoding;num.anisotropy=4;
  const n=document.createElement('canvas');n.width=n.height=32;const y=n.getContext('2d');y.strokeStyle='#0d0c0a';y.lineWidth=5;y.strokeRect(0,0,32,32);
  const net=new THREE.CanvasTexture(n);net.wrapS=net.wrapT=THREE.RepeatWrapping;net.repeat.set(16,16);
  tbMats={num:new THREE.MeshStandardMaterial({map:num,roughness:.5}),net:new THREE.MeshBasicMaterial({map:net,transparent:true,alphaTest:.4,side:THREE.DoubleSide}),
    dark:new THREE.MeshStandardMaterial({color:0x0b0b0c,roughness:.9,side:THREE.DoubleSide}),flag:new THREE.MeshStandardMaterial({color:LIN('#ff7a1a'),roughness:.7,side:THREE.DoubleSide})};
  return tbMats}
// a straight tube from a to b ([x,y,z] in the body)
function tbTube(a,b,r,mat,g){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),d=B.clone().sub(A),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),8),mat);
  m.position.copy(A).add(B).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());m.castShadow=true;g.add(m);return m}
// a side profile [[z,y],…] made solid across the car, w wide
function tbProfile(pts,w,mat,g){const s=new THREE.Shape();pts.forEach((p,i)=>i?s.lineTo(p[0],p[1]):s.moveTo(p[0],p[1]));s.closePath();
  const geo=new THREE.ExtrudeGeometry(s,{depth:w,bevelEnabled:false});geo.rotateY(-Math.PI/2);geo.translate(w/2,0,0);const m=new THREE.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;g.add(m);return m}
function buildTrophy(cfg){
  const g=new THREE.Group(),TM=trophyMats(),zf=cfg.wb/2,W=.98,hw=W/2,fx=(cfg.track||TRACK)/2+(cfg.tireW||.19)/2-.06,nose=cfg.L/2-.02,tail=-cfg.L/2+.02;   // fx: how far the fender flares reach out
  // chassis, skid plates and the front differential (the front wheels hang on A-arms, the rear on a solid axle: see trophyLinks)
  bx(.6,.07,2.1,M.blkC,0,-.15,0,g);{const sk=bx(.66,.02,.5,M.steel,0,-.12,nose-.18,g);sk.rotation.x=-.35}bx(.5,.02,.6,M.steel,0,-.19,-.2,g);
  const df=new THREE.Mesh(new THREE.SphereGeometry(.07,12,10),M.blk);df.position.set(0,-.13,zf);g.add(df);bx(.16,.12,.24,M.blk,0,-.1,zf,g);
  // the body from the nose to the back of the cab: low nose, long hood, then the cab with a raked windshield
  tbProfile([[-.46,-.12],[nose-.1,-.12],[nose,-.02],[nose,.11],[nose-.12,.165],[.24,.225],[-.46,.22]],W,M.yel,g);
  tbProfile([[.23,.225],[-.46,.22],[-.46,.56],[-.04,.575]],W-.08,M.yel,g);
  // glass: the windshield along the rake, the back window; nets in the side windows, dark behind them
  {const a=new THREE.Vector3(0,.235,.215),b=new THREE.Vector3(0,.565,-.03),d=b.clone().sub(a),ws=bx(W-.2,d.length()-.04,.012,M.glass,0,0,0,g);ws.position.copy(a).add(b).multiplyScalar(.5);ws.position.z+=.008;ws.rotation.x=-Math.atan2(-d.z,d.y)}
  bx(W-.26,.22,.012,M.glass,0,.42,-.466,g);
  {const s=new THREE.Shape();s.moveTo(.15,.27);s.lineTo(-.39,.27);s.lineTo(-.39,.52);s.lineTo(-.05,.535);s.closePath();const geo=new THREE.ShapeGeometry(s);geo.rotateY(-Math.PI/2);
    for(const sx of[1,-1]){const dk=new THREE.Mesh(geo,TM.dark);dk.position.x=sx*((W-.08)/2+.003);g.add(dk);const nt=new THREE.Mesh(geo,TM.net);nt.position.x=sx*((W-.08)/2+.008);g.add(nt)}}
  // the bed: floor, sides, tailgate; in it two spare tyres lying flat and the fuel cell
  bx(W-.06,.03,.86,M.blkC,0,-.03,-.9,g);for(const sx of[1,-1])bx(.04,.33,.88,M.yel,sx*(hw-.02),.045,-.9,g);bx(W,.33,.04,M.yel,0,.045,tail+.01,g);
  bx(.5,.15,.2,M.blkC,0,.07,-.56,g);cyl(.03,.03,M.steel,.16,.16,-.56,g);
  for(let k=0;k<2;k++){const sp=new THREE.Mesh(new THREE.CylinderGeometry(.21,.21,.11,20),M.tire);sp.position.set(0,.04+k*.115,-.98);sp.castShadow=true;g.add(sp);cyl(.12,.115,M.blk,0,.04+k*.115,-.98,g,null,14);cyl(.125,.01,M.steel,0,.1+k*.115,-.98,g,null,14)}
  // the fenders: wide flares over the tyres, a black lip on the edge, and the ends sloping down to the body
  for(const sx of[1,-1])for(const wz of[zf,-zf]){const w2=fx-hw,cx=sx*(hw+w2/2);
    bx(w2,.035,.7,M.yel,cx,.3,wz,g);bx(.03,.06,.72,M.blkC,sx*fx,.28,wz,g);
    for(const e of[-1,1]){const p=bx(w2,.035,.34,M.yel,cx,.2,wz+e*.485,g);p.rotation.x=e*.64;const q=bx(.03,.05,.34,M.blkC,sx*fx,.185,wz+e*.48,g);q.rotation.x=e*.64}}
  // a white band and a red stripe along the flanks, the race number on the doors, the hood decal
  for(const sx of[1,-1]){bx(.006,.06,2.4,M.trim,sx*(hw+.003),-.07,-.05,g);bx(.006,.02,2.4,M.red,sx*(hw+.003),-.025,-.05,g);
    const p=new THREE.Mesh(new THREE.PlaneGeometry(.25,.156),TM.num);p.position.set(sx*(hw+.006),.06,0);p.rotation.y=sx>0?Math.PI/2:-Math.PI/2;g.add(p)}
  {const hd=new THREE.Mesh(new THREE.PlaneGeometry(.34,.17),decalMat);hd.rotation.x=-Math.PI/2+.06;hd.position.set(0,.205,.72);g.add(hd)}
  for(const sx of[1,-1]){const v=bx(.16,.012,.12,M.blkC,sx*.2,.187,.95,g);v.rotation.x=.062}   // vents in the hood
  // the nose: grille, headlights, a bumper of tube with four round lamps on it, tow hooks
  bx(.6,.15,.02,M.blkC,0,.06,nose+.005,g);for(let i=0;i<3;i++)bx(.56,.012,.024,M.steel,0,.02+i*.04,nose+.01,g);
  for(const sx of[1,-1]){bx(.16,.06,.02,M.lamp,sx*.37,.09,nose+.006,g);bx(.05,.03,.015,M.amber,sx*.37,.03,nose+.006,g);
    const beam=new THREE.Mesh(new THREE.ConeGeometry(.55,4,14,1,true),M.beam);beam.rotation.x=-Math.PI/2+.13;beam.position.set(sx*.33,.09-.26,nose+2);beam.castShadow=false;g.add(beam)}
  bx(1.02,.045,.045,M.blkC,0,-.08,nose+.08,g);for(const sx of[1,-1]){bx(.04,.12,.1,M.blkC,sx*.3,-.05,nose+.03,g);bx(.05,.05,.07,M.red,sx*.42,-.14,nose+.04,g)}
  for(let i=0;i<4;i++){const lx=-.3+i*.2;cyl(.045,.04,M.blkC,lx,-.01,nose+.1,g,'z',12);cyl(.036,.012,M.lamp,lx,-.01,nose+.124,g,'z',12)}
  // the roof: the scoop that feeds the engine air, and a light bar on the front edge
  bx(.24,.07,.28,M.yel,0,.61,-.2,g);bx(.2,.05,.012,M.blk,0,.615,-.055,g);
  bx(.72,.045,.05,M.blkC,0,.6,.01,g);for(let i=0;i<5;i++){cyl(.03,.01,M.lamp,-.28+i*.14,.6,.04,g,'z',10)}
  // mirrors, the tube cage from the roof back over the bed with the chase lights, the rear bumper, tail lights, exhausts and the whip antenna with its flag
  for(const sx of[1,-1]){bx(.03,.02,.06,M.blkC,sx*(hw+.02),.3,.16,g);bx(.07,.045,.05,M.yel,sx*(hw+.07),.3,.16,g)}
  for(const sx of[1,-1]){tbTube([sx*.4,.55,-.45],[sx*.42,.42,-1.2],.018,M.blkC,g);tbTube([sx*.42,.42,-1.2],[sx*.44,.2,tail+.04],.018,M.blkC,g);tbTube([sx*.4,.55,-.45],[sx*.44,.2,-.75],.016,M.blkC,g)}
  tbTube([-.42,.42,-1.2],[.42,.42,-1.2],.018,M.blkC,g);tbTube([-.4,.55,-.45],[.4,.55,-.45],.016,M.blkC,g);
  bx(.3,.06,.04,M.blkC,0,.42,-1.225,g);bx(.08,.045,.012,M.amber,0,.42,-1.248,g);for(const sx of[1,-1])bx(.07,.045,.012,M.tail,sx*.1,.42,-1.248,g);
  bx(W+.04,.045,.045,M.blkC,0,-.09,tail-.04,g);for(const sx of[1,-1]){bx(.08,.12,.012,M.tail,sx*.38,.1,tail-.012,g);cyl(.025,.12,M.steel,sx*.3,-.11,tail-.06,g,'z',10);bx(.05,.05,.07,M.red,sx*.42,-.14,tail-.03,g)}
  bx(.2,.1,.008,M.plate,0,.08,tail-.012,g);carPlate(g,0,.08,tail-.017,-1,.19);
  {const K=carKit();bx(.4,.2,.05,K.alu,0,.3,-.66,g).rotation.x=-.5;for(const sx of[1,-1]){cyl(.07,.02,M.blk,sx*.1,.31,-.69,g,'z',12).rotation.x=Math.PI/2-.5;bx(.05,.03,.014,K.rev,sx*.22,.42,-1.248,g);cyl(.03,.03,K.chrome,sx*.3,-.11,tail-.115,g,'z',10)}
    bx(.05,.3,.07,M.red,hw-.07,.2,-.72,g);bx(.09,.02,.1,M.steel,hw-.07,.05,-.72,g);                                                                      // the jack standing in the bed
    for(const sx of[1,-1])for(let i=0;i<3;i++)bx(.006,.035,.11,i%2?M.red:K.white,sx*(hw+.004),.16,.45+i*.14,g)}                                          // sponsor stickers on the front wings
  cyl(.006,.9,M.blkC,-.44,.62,tail+.06,g,null,5);{const fl=new THREE.Mesh(new THREE.PlaneGeometry(.12,.08),TM.flag);fl.position.set(-.44+.06,1.03,tail+.06);fl.rotation.y=Math.PI/2;g.add(fl)}
  return g;
}
// the trophy truck's wheels: a tall off-road tyre with rounded shoulders and big staggered blocks on a black beadlock wheel
function buildTrophyWheel(cfg,side){
  const r=cfg.wr||WR,w=cfg.tireW||.19,root=new THREE.Group(),spin=new THREE.Group();root.add(spin);
  const prof=[[r*.6,w/2-.01],[r*.82,w/2+.004],[r*.95,w/2-.01],[r*.975,w/2-.04],[r*.975,-w/2+.04],[r*.95,-w/2+.01],[r*.82,-w/2-.004],[r*.6,-w/2+.01]].map(p=>new THREE.Vector2(p[0],p[1]));
  const tire=new THREE.Mesh(new THREE.LatheGeometry(prof,28),M.tire);tire.rotation.z=Math.PI/2;tire.castShadow=true;spin.add(tire);
  const lugG=new THREE.BoxGeometry(w*.42,.03,.075);
  for(let i=0;i<22;i++){const a=i/22*Math.PI*2;for(const sx of[-1,1]){const m=new THREE.Mesh(lugG,M.tire);m.position.set(sx*w*.24+(i%2?.012:-.012)*sx,Math.cos(a)*(r-.022),Math.sin(a)*(r-.022));m.rotation.x=a;m.castShadow=true;spin.add(m)}}
  cyl(r*.6,w-.02,M.blk,0,0,0,spin,'x',20);
  const fx=side*(w/2-.004);cyl(r*.62,.016,M.steel,fx-side*.006,0,0,spin,'x',22);cyl(r*.5,.016,M.blk,fx,0,0,spin,'x',18);   // the beadlock ring, and the black wheel face inside it
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;cyl(.008,.02,M.blk,fx+side*.006,Math.cos(a)*r*.56,Math.sin(a)*r*.56,spin,'x',5)}
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2+.3,s=bx(.016,r*.42,.03,M.steel,fx,Math.cos(a)*r*.27,Math.sin(a)*r*.27,spin);s.rotation.x=a}   // spokes
  cyl(.055,.03,M.red,fx+side*.008,0,0,spin,'x',12);cyl(.025,.04,M.steel,fx+side*.012,0,0,spin,'x',6);
  return{root,spin};
}
// the trophy truck's suspension, drawn between the body and the wheels every frame (syncVisuals in js/game.js), so you see it work:
// A-arms, a coilover and a bypass shock and the drive shaft at each front wheel; a trailing arm, a link and two shocks at each end of the rear axle.
// {m: the mesh, a: the point on the body, w: the wheel, o: the point by the wheel, both in the body's frame}
function trophyLinks(cfg){const L=[],zf=cfg.wb/2,V=(x,y,z)=>new THREE.Vector3(x,y,z);
  const add=(w,a,o,r,mat)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,1,8),mat);m.castShadow=true;L.push({m,a,w,o})};
  for(let i=0;i<4;i++){const sx=i%2===0?1:-1,front=i<2,z=front?zf:-zf;
    if(front){for(const dz of[-.15,.15]){add(i,V(sx*.2,-.15,z+dz),V(-sx*.09,-.07,dz*.15),.016,M.steel);add(i,V(sx*.27,.06,z+dz*.85),V(-sx*.09,.08,dz*.12),.014,M.steel)}
      add(i,V(sx*.32,.15,z-.05),V(-sx*.17,-.05,-.05),.032,M.red);add(i,V(sx*.34,.14,z+.08),V(-sx*.2,-.04,.08),.022,M.steel);add(i,V(sx*.08,-.1,z),V(-sx*.04,0,0),.018,M.blk)}
    else{add(i,V(sx*.36,-.13,z+.78),V(-sx*.14,-.03,0),.022,M.steel);add(i,V(sx*.16,.0,z+.55),V(-sx*.42,.06,0),.016,M.steel);
      add(i,V(sx*.4,.27,z+.12),V(-sx*.13,.03,.1),.032,M.red);add(i,V(sx*.43,.26,z-.12),V(-sx*.15,.03,-.1),.022,M.steel)}}
  return L}

/* ---------- the snowmobile (Svalbard): cowl in the paint, belt under the tunnel, and a rider in a scooter suit and helmet ---------- */
// The physics has four wheels: the two in front are the skis (buildSkuterSki draws them, and they steer), the two at the back sit close
// together under the belt and are not drawn. The ground is about .33 under the origin when the scooter stands still.
let SKM=null;
function skuterMats(){if(SKM)return SKM;const m=(c,r=.7)=>new THREE.MeshStandardMaterial({color:new THREE.Color(c).convertSRGBToLinear(),roughness:r});
  return SKM={suit:m('#24456e'),trim:m('#f2c230'),helm:m('#f4f2ec',.35),visor:m('#14181c',.15),mitt:m('#c8463a'),boot:m('#1c1a18'),flag:m('#ff6a2a')}}
function buildSkuter(cfg){const g=new THREE.Group(),K=skuterMats(),wb=cfg.wb,tr=cfg.track||TRACK,T=(a,b,r,mat)=>tbTube(a,b,r,mat,g);
  // the belt with its lugs, the tunnel over it, running boards and the snow flap
  bx(.3,.15,1.0,M.tire,0,-.245,-.42,g);for(const z of[.08,-.92])cyl(.075,.3,M.tire,0,-.245,z,g,'x',10);for(let i=0;i<11;i++)bx(.31,.02,.03,M.blk,0,-.322,-.9+i*.098,g);
  for(const z of[-.1,-.42,-.74])for(const sx of[1,-1])cyl(.05,.02,M.steel,sx*.16,-.25,z,g,'x',8);
  bx(.36,.1,1.02,M.blkC,0,-.12,-.42,g);bx(.64,.025,.62,M.blkC,0,-.155,-.14,g);{const f=bx(.3,.17,.015,M.blk,0,-.2,-.98,g);f.rotation.x=.35}
  // the seat, the rack with a fuel can, the bumper, the tail light and the pennant
  bx(.26,.12,.6,M.blk,0,-.01,-.44,g);bx(.26,.1,.1,M.blk,0,.09,-.72,g);bx(.3,.02,.2,M.steel,0,-.03,-.85,g);bx(.14,.17,.1,M.red,0,.065,-.86,g);cyl(.02,.03,M.blk,.03,.165,-.86,g,null,6);
  bx(.42,.03,.03,M.steel,0,-.06,-.97,g);bx(.14,.05,.02,M.tail,0,.02,-.96,g);
  cyl(.007,.62,M.steel,.15,.28,-.93,g,null,5);{const f=bx(.012,.08,.15,K.flag,.15,.55,-1.01,g);f.castShadow=false}
  // the cowl: belly pan, the body and the sloping hood in the paint, a black stripe on each flank, the headlight with its beams
  bx(.6,.05,.78,M.blkC,0,-.145,.4,g);bx(.58,.2,.6,M.yel,0,-.02,.36,g);bx(.48,.13,.2,M.yel,0,-.055,.73,g);{const h=bx(.46,.12,.52,M.yel,0,.12,.31,g);h.rotation.x=.3}
  for(const sx of[1,-1]){bx(.012,.045,.5,M.blkC,sx*.292,.03,.36,g);bx(.012,.03,.3,K.trim,sx*.292,-.03,.42,g)}
  bx(.3,.07,.02,M.lamp,0,.045,.665,g);bx(.34,.1,.012,M.blkC,0,.045,.655,g);bx(.3,.03,.04,M.blkC,0,-.1,.84,g);
  for(const sx of[1,-1]){const beam=new THREE.Mesh(new THREE.ConeGeometry(.5,4,14,1,true),M.beam);beam.rotation.x=-Math.PI/2+.1;beam.position.set(sx*.09,-.15,.665+1.98);beam.castShadow=false;g.add(beam)}
  // windscreen, steering post, handlebar and grips
  {const w=bx(.4,.2,.012,M.glass,0,.29,.3,g);w.rotation.x=-.55;w.castShadow=false}
  T([0,.12,.14],[0,.33,.05],.02,M.blk);cyl(.017,.52,M.blk,0,.33,.05,g,'x',6);for(const sx of[1,-1])cyl(.026,.09,M.blkC,sx*.235,.33,.05,g,'x',8);
  {const K=carKit();bx(.33,.085,.008,K.chrome,0,.045,.668,g);for(const sx of[1,-1]){bx(.05,.07,.02,M.blkC,sx*.25,.34,.085,g);tbTube([sx*.14,.33,.05],[sx*.2,.45,.1],.008,M.blk,g);bx(.07,.045,.012,M.blkC,sx*.2,.46,.1,g);bx(.06,.035,.004,K.chrome,sx*.2,.46,.092,g);
      bx(.008,.03,.08,M.amber,sx*.292,.07,.2,g);bx(.012,.03,.12,M.red,sx*.182,-.1,-.8,g)}
    bx(.24,.1,.16,K.canvas,0,.03,-.7,g);for(const dz of[-.04,.04])bx(.25,.012,.02,M.blkC,0,.082,-.7+dz,g)}
  // the arms out to the skis
  for(const sx of[1,-1]){T([sx*.26,-.08,wb/2-.08],[sx*tr/2,-.17,wb/2],.022,M.steel);T([sx*.26,-.08,wb/2+.1],[sx*tr/2,-.17,wb/2],.022,M.steel);T([sx*.24,.06,wb/2],[sx*(tr/2-.03),-.13,wb/2],.03,M.red)}
  // the rider: boots on the running boards, knees forward, leaning over the handlebar; a white helmet with a dark visor and a yellow stripe.
  // Every part of him is marked, so he can be hidden while he is off the scooter (js/walker.js)
  const rider0=g.children.length;
  for(const sx of[1,-1]){T([sx*.09,.09,-.32],[sx*.17,.11,-.04],.055,K.suit);T([sx*.17,.11,-.04],[sx*.24,-.1,.02],.048,K.suit);bx(.09,.07,.17,K.boot,sx*.24,-.108,.05,g);
    T([sx*.13,.41,-.13],[sx*.2,.3,-.03],.042,K.suit);T([sx*.2,.3,-.03],[sx*.235,.34,.04],.038,K.suit);const mt=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),K.mitt);mt.position.set(sx*.235,.34,.05);mt.castShadow=true;g.add(mt)}
  T([0,.06,-.33],[0,.42,-.14],.105,K.suit);bx(.24,.03,.17,K.trim,0,.3,-.2,g).rotation.x=.45;
  {const h=new THREE.Mesh(new THREE.SphereGeometry(.1,12,10),K.helm);h.position.set(0,.56,-.07);h.scale.set(1,1,1.1);h.castShadow=true;g.add(h);
    const v=bx(.15,.065,.03,K.visor,0,.565,.02,g);v.rotation.x=.12;bx(.03,.012,.2,K.trim,0,.662,-.07,g);bx(.12,.06,.1,K.helm,0,.5,-.01,g)}
  for(let i=rider0;i<g.children.length;i++)g.children[i].userData.driver=true;
  return g}
// a ski at each front wheel: the runner with its upturned tip, the loop on the tip and the spindle up to the arms. The rear wheels are under the belt
function buildSkuterSki(cfg,side,rear){const root=new THREE.Group(),spin=new THREE.Group();root.add(spin);if(rear)return{root,spin};const y=-(cfg.wr||WR);
  bx(.1,.022,.78,M.blkC,0,y+.011,.02,root);{const t=bx(.1,.022,.2,M.blkC,0,y+.055,.49,root);t.rotation.x=-.5}bx(.02,.03,.6,M.steel,0,y-.004,0,root);
  tbTube([0,y+.1,.56],[0,y+.07,.26],.012,M.yel,root);bx(.07,.06,.18,M.yel,0,y+.05,0,root);bx(.04,-y-.02,.05,M.steel,0,y/2+.03,0,root);return{root,spin}}

/* =================================================================
   FIVE MORE CARS: the open veteran jeep (Rusken), the 4x4 camper van (Snegla), the expedition truck (Bamse), the rally car (Gaupe)
   and the beach buggy (Sandloppe). They use the kit at the top of this file, and data/cars.js picks them with style.
   ================================================================= */
// a flat pane standing along the car at x: pts [[z,y],…]
function carPane(g,pts,x,mat){const s=new THREE.Shape();pts.forEach((p,i)=>i?s.lineTo(p[0],p[1]):s.moveTo(p[0],p[1]));s.closePath();const geo=new THREE.ShapeGeometry(s);geo.rotateY(-Math.PI/2);geo.computeVertexNormals();if(geo.attributes.normal.getX(0)*x<0){geo.scale(-1,1,1);geo.computeVertexNormals()}const m=new THREE.Mesh(geo,mat);m.position.x=x;g.add(m);return m}
// the parts from the garage on a car that is not built by buildBody: snorkel o.sn=[x,y,z,height], winch o.w=[y,z], LED bar o.led=[width,y,z]
function carGear(g,cfg,o){const t=cfg.tune,K=carKit();
  if(o.sn&&(cfg.snorkel||(t&&t.snorkel))){const[x,y,z,h]=o.sn;cyl(.025,h,M.blkC,x,y+h/2,z,g);cyl(.03,.16,M.blkC,x,y+.02,z+.08,g,'z',8);cyl(.055,.07,M.blkC,x,y+h+.02,z,g,'z',10);bx(.06,.03,.06,M.steel,x,y+h+.065,z,g)}
  if(o.w&&(cfg.winch||(t&&t.lv.gear>=2))){const[y,z]=o.w;bx(.22,.09,.1,M.steel,0,y,z,g);cyl(.02,.2,M.blkC,0,y,z,g,'x',8);if(cfg.winch||t.lv.gear>=3){cyl(.045,.16,M.blkC,0,y+.01,z,g,'x',10);cyl(.05,.12,M.trim,0,y+.01,z,g,'x',10);bx(.04,.04,.06,M.steel,0,y+.01,z+.08,g);bx(.05,.02,.05,M.red,0,y+.01,z+.12,g)}}
  if(o.led&&t&&t.led){const[w,y,z]=o.led;bx(w,.045,.04,M.blkC,0,y,z,g);bx(w-.06,.025,.012,M.lamp,0,y,z+.022,g)}}
// a whip antenna with a red ball
function carWhip(g,x,y,z,h=.55){cyl(.008,h,M.blkC,x,y+h/2,z,g,null,5);const b=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),M.red);b.position.set(x,y+h,z);g.add(b);
  const fm=flagMat(FLAG_NOW);if(fm){const fl=new THREE.Mesh(new THREE.PlaneGeometry(.21,.14),fm);fl.position.set(x,y+h-.095,z-.113);fl.rotation.y=Math.PI/2;fl.castShadow=true;g.add(fl)}}   // with the flag from the garage

/* ---------- Rusken: an open veteran jeep. A low tub with cut-down sides, flat fenders, a seven-slot grille, a folding windshield and a roll bar ---------- */
function buildOpen(cfg){
  const g=new THREE.Group(),K=carKit(),L=cfg.L,W=.86,y0=.08,lh=.27,yT=y0+lh,hood=cfg.hood,fz=L/2,rz=-L/2,gz1=fz-hood,tl=gz1-rz,tc=(gz1+rz)/2;
  carUnder(g,cfg,-.02);
  // the tub: floor, sides cut down at the doors, the rear panel and the firewall with the dashboard
  rbx(W,.09,tl,.02,M.yel,0,y0+.045,tc,g);bx(W-.08,.012,tl-.06,K.cabin,0,y0+.094,tc,g);
  const dz1=gz1-.1,dz0=gz1-.52;   // the door opening
  for(const sx of[1,-1]){const x=sx*(W/2-.02);rbx(.04,lh,dz0-rz,.012,M.yel,x,y0+lh/2,(dz0+rz)/2,g);bx(.04,lh*.52,dz1-dz0,M.yel,x,y0+lh*.26,(dz0+dz1)/2,g);rbx(.04,lh,gz1-dz1,.012,M.yel,x,y0+lh/2,(gz1+dz1)/2,g);
    bx(.05,.014,dz0-rz,M.blkC,x,yT+.004,(dz0+rz)/2,g);bx(.012,.03,dz1-dz0-.06,K.canvas,sx*(W/2+.002),y0+lh*.5,(dz0+dz1)/2,g);                    // the rail on the tub edge, the safety strap across the opening
    bx(.03,.03,dz0-rz-.1,M.blkC,sx*(W/2+.05),y0+.08,(dz0+rz)/2,g);for(const wz of[-cfg.wb/2]){bx(.05,.03,.5,M.blkC,sx*(W/2+.03),y0+.2,wz,g);bx(.15,.13,.012,K.rubber,sx*(W/2-.02),y0-.045,wz-.3,g)}}   // rear flare, mud flap
  rbx(W,lh,.04,.012,M.yel,0,y0+lh/2,rz+.02,g);rbx(W,lh+.05,.05,.012,M.yel,0,y0+lh/2+.025,gz1-.025,g);
  bx(W-.1,.08,.05,K.cabin,0,yT-.02,gz1-.07,g);for(let i=0;i<3;i++)cyl(.02,.012,K.chrome,-.12+i*.07,yT-.02,gz1-.098,g,'z',10);carWheelStick(g,.2,yT+.03,gz1-.17,.055);
  // the hood, narrower than the tub, with flat fenders beside it and the slotted grille
  rbx(.5,lh+.02,hood,.03,M.yel,0,y0+lh/2+.01,fz-hood/2,g);bx(.012,.012,hood-.06,M.blkC,0,yT+.022,fz-hood/2,g);for(const sx of[1,-1])bx(.03,.02,.04,M.blkC,sx*.2,yT+.01,fz-hood*.5,g);   // centre hinge and hood latches
  for(const sx of[1,-1]){const x=sx*(.25+.11);bx(.22,.028,hood-.1,M.yel,x,yT-.07,fz-hood/2+.02,g);{const f=bx(.22,.028,.14,M.yel,x,yT-.105,fz+.02,g);f.rotation.x=.6}bx(.22,.12,.028,M.yel,x,yT-.13,gz1+.02,g);
    bx(.024,.03,hood-.08,M.blkC,sx*(.25+.22),yT-.07,fz-hood/2+.02,g);cyl(.022,.03,M.amber,x,yT-.035,fz-.02,g,'z',8);bx(.15,.13,.012,K.rubber,sx*(W/2-.06),y0-.045,cfg.wb/2-.3,g)}
  bx(.5,lh,.02,M.yel,0,y0+lh/2+.01,fz+.006,g);for(let i=0;i<7;i++)bx(.022,.15,.012,M.blk,-.09+i*.03,y0+.16,fz+.014,g);
  for(const sx of[1,-1])carLamp(g,sx*.185,y0+.17,fz+.002,.045);
  {const hd=new THREE.Mesh(new THREE.PlaneGeometry(.26,.13),decalMat);hd.rotation.x=-Math.PI/2;hd.position.set(0,yT+.022,fz-hood/2-.02);g.add(hd)}
  // the windshield in its frame, leaning back a little, with the wipers hanging from the top
  {const w=new THREE.Group();w.position.set(0,yT+.05,gz1-.02);w.rotation.x=-.16;g.add(w);const h=.3;
    for(const sx of[1,-1])bx(.03,h,.03,M.yel,sx*(W/2-.04),h/2,0,w);bx(W-.05,.03,.03,M.yel,0,h,0,w);bx(W-.05,.03,.03,M.yel,0,.015,0,w);bx(.02,h,.02,M.yel,0,h/2,0,w);
    bx(W-.11,h-.04,.008,K.glassT,0,h/2,0,w);for(const sx of[1,-1]){const p=bx(.01,.12,.008,M.blk,sx*.2,h-.07,.012,w);p.rotation.z=sx*.3}
    for(const sx of[1,-1]){cyl(.03,.012,K.chrome,sx*(W/2+.03),h*.55,-.01,w,'z',10);cyl(.032,.01,M.blkC,sx*(W/2+.03),h*.55,-.002,w,'z',10);bx(.06,.012,.012,M.blkC,sx*(W/2-.005),h*.55,0,w)}}
  // seats, a small bench behind them, and the crew
  const ys=y0+.1;for(const sx of[1,-1])carSeat(g,sx*.2,ys,gz1-.36,.2,.2);bx(W-.2,.05,.2,K.seat,0,ys+.03,rz+.28,g);bx(W-.2,.16,.04,K.seat,0,ys+.12,rz+.16,g);
  carCrew(g,[[.2,ys+.115,gz1-.37],[-.2,ys+.115,gz1-.37]]);
  // the roll bar with its braces, the rolled-up canvas top behind it
  const zb=gz1-.56,yb=yT+.36;for(const sx of[1,-1]){tbTube([sx*(W/2-.04),yT-.02,zb],[sx*(W/2-.07),yb,zb],.022,M.blkC,g);tbTube([sx*(W/2-.07),yb-.02,zb],[sx*(W/2-.05),yT,rz+.08],.018,M.blkC,g)}
  tbTube([-(W/2-.07),yb,zb],[W/2-.07,yb,zb],.022,M.blkC,g);cyl(.03,.4,K.rubber,0,yb,zb,g,'x',8);cyl(.055,W-.16,K.canvas,0,yT+.06,rz+.1,g,'x',10);for(const dx of[-.22,.22])bx(.02,.125,.125,M.blkC,dx,yT+.06,rz+.1,g);
  // the tail: spare wheel, a can, lamps, the plate; a spade and an axe on the flank
  {const sp=buildWheel(.2,1);sp.root.scale.set(.85,.85,.85);sp.root.position.set(.12,y0+.22,rz-.1);sp.root.rotation.y=Math.PI/2;g.add(sp.root);bx(.05,.05,.08,M.blkC,.12,y0+.22,rz-.03,g)}
  bx(.13,.2,.08,M.can,-.24,y0+.17,rz-.045,g);bx(.03,.02,.06,M.blkC,-.24,y0+.28,rz-.045,g);bx(.15,.02,.09,M.blkC,-.24,y0+.12,rz-.045,g);
  for(const sx of[1,-1]){cyl(.03,.02,M.tail,sx*.38,y0+.2,rz-.008,g,'z',10);cyl(.018,.02,K.rev,sx*.38,y0+.12,rz-.008,g,'z',8);bx(.14,.07,.07,M.blkC,sx*.3,y0+.0,rz-.05,g);bx(.05,.05,.08,M.red,sx*.3,y0+.03,fz+.1,g)}
  bx(.2,.1,.008,M.plate,-.02,y0+.03,rz-.012,g);carPlate(g,-.02,y0+.03,rz-.017,-1,.18);
  cyl(.012,.5,M.wood,W/2+.03,y0+.2,rz+.42,g,'z',6);bx(.02,.09,.11,M.steel,W/2+.03,y0+.2,rz+.7,g);cyl(.011,.34,M.wood,W/2+.03,y0+.12,rz+.42,g,'z',6);bx(.025,.07,.06,M.steel,W/2+.035,y0+.13,rz+.6,g);
  // the front bumper, a channel of steel, and the plate
  bx(W+.08,.07,.06,M.blkC,0,y0+.0,fz+.06,g);for(const sx of[1,-1])bx(.05,.05,.12,M.blkC,sx*.2,y0+.0,fz+.01,g);bx(.24,.07,.01,M.plate,0,y0+.0,fz+.092,g);carPlate(g,0,y0+.0,fz+.098,1,.22);
  carWhip(g,-(W/2-.03),yT,rz+.06,.6);
  carGear(g,cfg,{sn:[-(.25+.03),yT-.04,gz1+.08,.42],w:[y0+.09,fz+.1],led:[W-.2,yT+.4,gz1-.06]});
  return g}

/* ---------- Snegla: a 4x4 camper van. A short nose, a big raked windshield, a white upper half, a pop-up roof with canvas sides, an awning and a roof box ---------- */
function buildVan(cfg){
  const g=new THREE.Group(),K=carKit(),L=cfg.L,W=.92,y0=.08,lh=.34,yT=y0+lh,vh=.42,yR=yT+vh,fz=L/2,rz=-L/2,U=W-.04,zc=fz-.92,zw0=fz-.2,zw1=fz-.36;   // zc: where the cab ends; the windshield leans from zw0 up to zw1
  carUnder(g,cfg,-.02);
  rbx(W,lh,L,.045,M.yel,0,y0+lh/2,0,g);bx(W+.012,.05,L*.94,M.blkC,0,y0+.025,0,g);bx(W+.006,.02,L*.9,K.chrome,0,yT-.03,0,g);
  // the living part: a white box with a window on each side, a sliding door on the right
  rbx(U,vh,zc-rz-.02,.03,K.white,0,yT+vh/2,(zc+rz+.02)/2,g);
  for(const sx of[1,-1]){const zc2=(zc+rz)/2-.02;bx(.012,.2,.5,M.glass,sx*(U/2+.002),yT+.24,zc2,g);for(const dz of[-.26,.26])bx(.014,.22,.014,M.blkC,sx*(U/2+.003),yT+.24,zc2+dz,g);for(const dy of[-.105,.105])bx(.014,.014,.53,M.blkC,sx*(U/2+.003),yT+.24+dy,zc2,g);
    bx(.008,.16,.11,M.orange,sx*(U/2+.006),yT+.25,zc2+.19,g);bx(.008,.16,.11,M.orange,sx*(U/2+.006),yT+.25,zc2-.19,g)}                              // curtains
  bx(.006,lh+vh-.12,.01,M.blkC,-(W/2+.001),y0+(lh+vh)/2,zc-.56,g);bx(.012,.012,.6,M.blkC,-(W/2+.004),yT-.06,zc-.3,g);bx(.014,.022,.08,M.blkC,-(W/2+.006),yT-.01,zc-.08,g);   // the sliding door: seam, rail, handle
  // the cab: floor, the bands under and over the windows, pillars along the windshield, glass all round
  bx(U-.03,.012,fz-zc-.2,K.cabin,0,yT+.006,(fz+zc)/2-.08,g);
  for(const sx of[1,-1]){const x=sx*(U/2-.016);bx(.032,.05,zw0-zc,K.white,x,yT+.025,(zw0+zc)/2,g);bx(.032,.04,zw1-zc,K.white,x,yR-.02,(zw1+zc)/2,g);tbTube([sx*(U/2-.02),yT,zw0],[sx*(U/2-.02),yR,zw1],.022,K.white,g);
    carPane(g,[[zw0-.03,yT+.05],[zw1-.02,yR-.04],[zc,yR-.04],[zc,yT+.05]],sx*(U/2-.004),K.glassT)}
  bx(U,.05,.04,K.white,0,yT+.025,zw0,g);bx(U,.04,.05,K.white,0,yR-.02,zw1,g);
  {const a=new THREE.Vector3(0,yT+.04,zw0),b=new THREE.Vector3(0,yR-.03,zw1),d=b.clone().sub(a),ws=bx(U-.08,d.length(),.008,K.glassT,0,0,0,g);ws.position.copy(a).add(b).multiplyScalar(.5);ws.rotation.x=-Math.atan2(-d.z,d.y);
    for(const sx of[1,-1]){const p=bx(.2,.008,.01,M.blk,sx*.16-.04,yT+.1,zw0-.025,g);p.rotation.z=.35;p.rotation.x=ws.rotation.x}}
  rbx(U+.03,.04,zw1-rz+.04,.016,K.white,0,yR+.018,(zw1+rz)/2+.02,g);
  bx(U-.07,.07,.1,K.cabin,0,yT+.04,zw0-.09,g);carWheelStick(g,.2,yT+.1,zw0-.2,.055);for(const sx of[1,-1])carSeat(g,sx*.2,yT+.004,zw0-.42,.2,.22);
  carCrew(g,[[.2,yT+.03,zw0-.44],[-.2,yT+.03,zw0-.44]]);
  // the nose: a short sloping hood, round headlights in a white panel, grille, bumper with a bar and two spot lamps
  {const h=bx(W-.06,.03,.26,M.yel,0,yT-.005,fz-.1,g);h.rotation.x=.12}
  rbx(W-.1,.2,.02,.008,K.white,0,y0+.22,fz+.004,g);bx(.3,.08,.012,M.blkC,0,y0+.2,fz+.016,g);for(let i=0;i<3;i++)bx(.28,.01,.014,K.chrome,0,y0+.175+i*.025,fz+.018,g);bx(.07,.03,.012,K.chrome,0,y0+.28,fz+.016,g);
  for(const sx of[1,-1]){carLamp(g,sx*.31,y0+.22,fz+.004,.06);bx(.07,.03,.015,M.amber,sx*.31,y0+.1,fz+.012,g);bx(.008,.022,.05,M.amber,sx*(W/2+.003),y0+.28,fz-.12,g)}
  bx(W+.08,.09,.1,M.blkC,0,y0+.0,fz+.06,g);for(const sx of[1,-1]){bx(.03,.22,.03,M.blkC,sx*.2,y0+.13,fz+.11,g);cyl(.045,.04,M.blkC,sx*.2,y0+.27,fz+.11,g,'z',12);cyl(.037,.012,M.lamp,sx*.2,y0+.27,fz+.134,g,'z',12);bx(.05,.05,.08,M.red,sx*.34,y0+.02,fz+.1,g)}
  bx(.44,.03,.03,M.blkC,0,y0+.22,fz+.11,g);bx(.26,.08,.01,M.plate,0,y0+.02,fz+.112,g);carPlate(g,0,y0+.02,fz+.118,1,.24);
  // mirrors on long arms, door seams and handles, side steps, flares, mud flaps
  for(const sx of[1,-1]){bx(.1,.012,.012,M.blkC,sx*(W/2+.04),yT+.12,zw0-.1,g);bx(.03,.11,.06,M.blkC,sx*(W/2+.1),yT+.12,zw0-.1,g);bx(.012,.09,.045,K.chrome,sx*(W/2+.112),yT+.12,zw0-.112,g);
    for(const z of[zw0-.06,zc+.02])bx(.005,lh-.08,.008,M.blkC,sx*(W/2+.001),y0+lh/2+.03,z,g);bx(.014,.022,.08,M.blkC,sx*(W/2+.006),yT-.07,zc+.1,g);
    bx(.07,.03,L*.42,M.blkC,sx*(W/2+.04),y0-.02,0,g);for(const wz of[cfg.wb/2,-cfg.wb/2]){bx(.04,.07,.66,M.blkC,sx*(W/2+.012),y0+.18,wz,g);bx(.03,.2,.05,M.blkC,sx*(W/2+.012),y0+.07,wz+.32,g);bx(.03,.2,.05,M.blkC,sx*(W/2+.012),y0+.07,wz-.32,g);bx(.15,.13,.012,K.rubber,sx*(W/2-.05),y0-.045,wz-.34,g)}}
  // the roof: the pop-up top standing open at the back with canvas sides and a mesh window, a solar panel and a vent on the cab, the awning along the right side
  {const z0=rz+.06,z1=zc-.02,yb=yR+.04,pw=U-.08;tbProfile([[z1,yb],[z0,yb],[z0,yb+.24]],pw,K.canvas,g);
    for(const sx of[1,-1])carPane(g,[[z0+.1,yb+.05],[z0+.1,yb+.16],[z0+.42,yb+.1],[z0+.42,yb+.04]],sx*(pw/2+.003),carKit().glassT);
    const len=Math.hypot(z1-z0,.24),lid=rbx(pw+.06,.035,len+.04,.014,K.white,0,yb+.12+.02,(z0+z1)/2,g);lid.rotation.x=Math.atan2(.24,z1-z0);
    bx(.5,.016,.36,M.glass,0,yR+.05,zc+.26,g);bx(.54,.012,.4,K.alu,0,yR+.042,zc+.26,g);bx(.14,.04,.14,K.white,0,yR+.058,zw1-.14,g);
    cyl(.045,.95,K.alu,U/2+.03,yR-.0,(z0+z1)/2+.1,g,'z',10);for(const dz of[-.48,.48])bx(.1,.1,.02,M.blkC,U/2+.03,yR,(z0+z1)/2+.1+dz,g)}
  // the tail: the rear door with its window, a ladder, the spare wheel in a cover, lamps, bumper and plate
  bx(U-.3,.18,.012,M.glass,-.05,yT+.24,rz+.014,g);bx(.005,lh+vh-.1,.008,M.blkC,-.05,y0+(lh+vh)/2,rz-.002,g);
  {const lx=.34,n=6;for(const dx of[-.06,.06])bx(.02,lh+vh,.02,M.blkC,lx+dx,y0+(lh+vh)/2+.06,rz-.03,g);for(let k=0;k<n;k++)bx(.14,.02,.02,M.blkC,lx,y0+.14+k*.12,rz-.03,g)}
  {const sp=buildWheel(.2,1);sp.root.scale.set(.85,.85,.85);sp.root.position.set(-.1,y0+.3,rz-.1);sp.root.rotation.y=Math.PI/2;g.add(sp.root);bx(.05,.05,.08,M.blkC,-.1,y0+.3,rz-.03,g);cyl(.1,.012,K.white,-.1,y0+.3,rz-.195,g,'z',16)}
  for(const sx of[1,-1]){carTail(g,sx*.41,y0+.24,rz-.004);bx(.05,.05,.08,M.red,sx*.3,y0+.03,rz-.09,g)}
  bx(W+.06,.08,.09,M.blkC,0,y0+.01,rz-.05,g);bx(.2,.1,.008,M.plate,.18,y0+.08,rz-.098,g);carPlate(g,.18,y0+.08,rz-.1025,-1,.19);
  for(const sx of[1,-1]){const p=new THREE.Mesh(new THREE.PlaneGeometry(.3,.15),decalMat);p.position.set(sx*(W/2+.004),y0+.2,zw0-.3);p.rotation.y=sx>0?Math.PI/2:-Math.PI/2;g.add(p)}
  carWhip(g,-(U/2-.06),yR+.03,zw1-.05,.4);
  g.userData.door={x:W/2,xg:U/2,ya:y0+.06,yb:yT,yc:yR-.03,z:zw0-.08,len:.42};
  carGear(g,cfg,{sn:[-(W/2+.03),yT-.04,zw0+.02,vh+.14],w:[y0+.12,fz+.12],led:[U-.2,yR+.065,zw1+.04]});
  return g}

/* ---------- Bamse: an expedition truck. A tall cab over the front axle, and behind it a living box with windows, a ladder and the spare wheel; lockers and tanks between the axles ---------- */
function buildTruck(cfg){
  const g=new THREE.Group(),K=carKit(),L=cfg.L,wb=cfg.wb,W=.98,yF=.2,fz=L/2,rz=-L/2,cl=.66,cz0=fz-cl,cb=.3,yB=yF+cb,ch=.3,yR=yB+ch,bz1=cz0-.05,bz0=rz+.04,bl=bz1-bz0,bc=(bz0+bz1)/2,bh=.7,tr=(cfg.track||TRACK)/2;
  // the frame high over the big wheels, cross members, and what hangs on it: lockers, the fuel tank, the air tanks and the exhaust up behind the cab
  carUnder(g,cfg,.06,{x:.22,pipe:false,spring:K.alu});bx(.5,.06,L*.9,M.blkC,0,.14,0,g);
  for(const sx of[1,-1]){bx(.2,.2,wb*.3,M.blkC,sx*.37,.06,-.02,g);bx(.012,.16,wb*.3-.04,K.alu,sx*.472,.06,-.02,g);bx(.03,.02,.06,M.steel,sx*.48,.1,-.02,g)}
  cyl(.11,.36,K.alu,.36,.05,wb*.24,g,'z',14);for(const dz of[-.1,.1])bx(.03,.24,.03,M.blkC,.36,.05,wb*.24+dz,g);cyl(.03,.02,M.blkC,.36,.165,wb*.24+.1,g,null,8);
  for(const dy of[0,.1])cyl(.045,.3,M.steel,-.36,dy,wb*.24,g,'z',10);
  cyl(.032,.7,K.chrome,-.4,yB+.3,cz0-.025,g,null,10);cyl(.045,.3,M.blkC,-.4,yB+.1,cz0-.025,g,null,10);cyl(.034,.05,M.blk,-.4,yB+.66,cz0-.025,g,null,10);
  // mudguards over the wheels with flaps
  for(const sx of[1,-1])for(const wz of[wb/2,-wb/2]){bx(.28,.03,.6,M.blkC,sx*tr,.185,wz,g);for(const e of[-1,1]){const f=bx(.28,.03,.2,M.blkC,sx*tr,.13,wz+e*.37,g);f.rotation.x=e*.7}bx(.24,.16,.012,K.rubber,sx*tr,.02,wz-.44,g)}
  // the cab: painted below, windows all round, a sun visor, roof lamps and horns
  rbx(W,cb,cl,.04,M.yel,0,yF+cb/2,(fz+cz0)/2,g);bx(W-.04,.012,cl-.04,K.cabin,0,yB+.006,(fz+cz0)/2,g);
  const U=W-.04,x=U/2-.016,cc=(fz+cz0)/2;
  for(const sx of[1,-1]){bx(.032,.045,cl,M.yel,sx*x,yB+.0225,cc,g);bx(.032,.04,cl,M.yel,sx*x,yR-.02,cc,g);bx(.05,ch,.045,M.yel,sx*(U/2-.025),yB+ch/2,fz-.022,g);bx(.032,ch,.1,M.yel,sx*x,yB+ch/2,cz0+.05,g);
    bx(.01,ch-.085,cl-.15,K.glassT,sx*(U/2-.004),yB+ch/2+.002,cc+.025,g)}
  bx(U,.045,.045,M.yel,0,yB+.0225,fz-.022,g);bx(U,.04,.045,M.yel,0,yR-.02,fz-.022,g);rbx(U,ch,.04,.01,M.yel,0,yB+ch/2,cz0+.02,g);
  bx(U-.1,ch-.085,.008,K.glassT,0,yB+ch/2+.002,fz-.006,g);bx(.02,ch-.085,.014,M.yel,0,yB+ch/2,fz-.004,g);
  for(const sx of[1,-1]){const p=bx(.2,.008,.01,M.blk,sx*.22-.05,yB+.085,fz+.004,g);p.rotation.z=.4}
  rbx(U+.03,.04,cl+.03,.016,M.yel,0,yR+.018,cc,g);{const v=bx(U,.012,.12,M.blkC,0,yR-.0,fz+.05,g);v.rotation.x=.25}
  bx(U-.2,.035,.035,M.blkC,0,yR+.055,fz-.08,g);for(let i=0;i<4;i++){cyl(.04,.04,M.blkC,-.27+i*.18,yR+.09,fz-.08,g,'z',12);cyl(.033,.012,M.lamp,-.27+i*.18,yR+.09,fz-.056,g,'z',12)}
  for(const sx of[1,-1]){cyl(.018,.26,K.chrome,sx*.3,yR+.06,fz-.3,g,'z',8);cyl(.035,.03,K.chrome,sx*.3,yR+.06,fz-.16,g,'z',10)}
  bx(U-.07,.07,.1,K.cabin,0,yB+.04,fz-.1,g);carWheelStick(g,.22,yB+.1,fz-.2,.06);for(const sx of[1,-1])carSeat(g,sx*.22,yB+.004,fz-.42,.2,.2);
  carCrew(g,[[.22,yB+.03,fz-.44],[-.22,yB+.03,fz-.44]]);
  // the flat front: grille, headlights in the bumper, a bull bar, tow hooks, the plate
  bx(W-.3,.14,.02,M.blkC,0,yF+.14,fz+.006,g);for(let i=0;i<4;i++)bx(W-.36,.012,.022,K.chrome,0,yF+.09+i*.034,fz+.012,g);bx(.12,.04,.012,K.chrome,0,yF+.25,fz+.012,g);
  bx(W+.06,.13,.1,M.steel,0,yF-.07,fz+.05,g);for(const sx of[1,-1]){carLamp(g,sx*.36,yF-.06,fz+.09,.045);bx(.06,.03,.015,M.amber,sx*.36,yF+.06,fz+.012,g);bx(.05,.05,.08,M.red,sx*.2,yF-.14,fz+.09,g);
    bx(.03,.36,.03,M.blkC,sx*.24,yF+.08,fz+.11,g)}
  bx(.51,.03,.03,M.blkC,0,yF+.25,fz+.11,g);bx(.51,.03,.03,M.blkC,0,yF+.1,fz+.11,g);bx(.24,.07,.01,M.plate,0,yF-.07,fz+.102,g);carPlate(g,0,yF-.07,fz+.108,1,.22);
  // doors: seams, handles, steps up to the cab, the big mirrors
  for(const sx of[1,-1]){for(const z of[fz-.1,cz0+.1])bx(.005,cb-.06,.008,M.blkC,sx*(W/2+.001),yF+cb/2+.02,z,g);bx(.014,.022,.08,M.blkC,sx*(W/2+.006),yB-.05,cz0+.18,g);
    bx(.08,.02,.3,K.alu,sx*(W/2-.0),yF-.08,cc-.02,g);for(const dz of[-.13,.13])bx(.02,.14,.02,M.blkC,sx*(W/2-.0),yF-.02,cc-.02+dz,g);
    bx(.1,.012,.012,M.blkC,sx*(W/2+.03),yB+.22,fz-.06,g);bx(.03,.16,.07,M.blkC,sx*(W/2+.09),yB+.16,fz-.06,g);bx(.012,.14,.055,K.chrome,sx*(W/2+.1),yB+.16,fz-.072,g);
    const p=new THREE.Mesh(new THREE.PlaneGeometry(.3,.15),decalMat);p.position.set(sx*(W/2+.004),yF+.14,cc);p.rotation.y=sx>0?Math.PI/2:-Math.PI/2;g.add(p)}
  // the living box: white with a band in the paint, a window on each side, a door with a step on the right, hatches and solar panels on the roof
  rbx(W+.04,bh,bl,.035,K.white,0,yF+.02+bh/2,bc,g);bx(W+.05,.08,bl-.06,M.yel,0,yF+.2,bc,g);bx(W+.052,.014,bl-.06,M.blkC,0,yF+.15,bc,g);
  const bx2=(W+.04)/2;for(const sx of[1,-1]){const wzc=bc+(sx>0?.2:-.05);bx(.012,.17,.36,M.glass,sx*(bx2+.002),yF+.48,wzc,g);for(const dz of[-.19,.19])bx(.014,.19,.016,M.blkC,sx*(bx2+.003),yF+.48,wzc+dz,g);for(const dy of[-.09,.09])bx(.014,.016,.4,M.blkC,sx*(bx2+.003),yF+.48+dy,wzc,g)}
  {const dz=bc+.2;for(const e of[-.14,.14])bx(.005,.52,.008,M.blkC,-(bx2+.001),yF+.34,dz+e,g);bx(.005,.008,.28,M.blkC,-(bx2+.001),yF+.6,dz,g);bx(.014,.022,.06,M.blkC,-(bx2+.006),yF+.36,dz-.1,g);bx(.012,.1,.12,M.glass,-(bx2+.002),yF+.5,dz,g);
    bx(.1,.02,.26,K.alu,-(bx2+.04),yF-.02,dz,g);for(const e of[-.11,.11])bx(.02,.1,.02,M.blkC,-(bx2+.04),yF+.03,dz+e,g)}
  const yBt=yF+.02+bh;bx(.3,.03,.3,K.white,.1,yBt+.014,bc+.3,g);bx(.16,.05,.16,M.blkC,-.25,yBt+.02,bc+.35,g);for(const dz of[-.08,-.44])bx(.62,.016,.32,M.glass,0,yBt+.012,bc+dz,g);bx(.66,.01,.72,K.alu,0,yBt+.004,bc-.26,g);
  // the tail: the big spare wheel on its carrier, a ladder to the roof, lamps, an underrun bar and the plate
  {const k=(cfg.wr||WR)/WR*.92,sp=buildWheel(WR,1,{lugs:14});sp.root.scale.set(1,k,k);sp.root.position.set(-.14,yF+.38,bz0-.1);sp.root.rotation.y=Math.PI/2;g.add(sp.root);bx(.06,.06,.08,M.blkC,-.14,yF+.38,bz0-.03,g)}
  {const lx=.36;for(const dx of[-.06,.06])bx(.02,bh+.04,.02,M.blkC,lx+dx,yF+.04+bh/2,bz0-.03,g);for(let k=0;k<6;k++)bx(.14,.02,.02,M.blkC,lx,yF+.1+k*.12,bz0-.03,g)}
  for(const sx of[1,-1]){carTail(g,sx*.44,yF+.0,rz+.0);bx(.03,.2,.03,M.blkC,sx*.3,yF-.02,rz+.03,g)}
  bx(W+.04,.06,.06,M.steel,0,yF-.1,rz+.0,g);bx(.2,.1,.008,M.plate,0,yF+.0,rz-.004,g);carPlate(g,0,yF+.0,rz-.009,-1,.19);
  carWhip(g,-(U/2-.06),yR+.04,cz0+.08,.5);
  g.userData.door={x:W/2,xg:U/2,ya:yF+.03,yb:yB,yc:yR-.03,z:fz-.1,len:.44};
  carGear(g,cfg,{sn:[W/2+.03,yB-.02,cz0+.06,ch+.2],w:[yF-.06,fz+.14],led:[U-.3,yR+.15,fz-.1]});
  return g}

/* ---------- Gaupe: a rally car. A hatchback cut from its side profile, wide arches, a pod of four lamps on the hood, a roof scoop, a big wing and red mud flaps ---------- */
function buildRally(cfg){
  const g=new THREE.Group(),K=carKit(),TM=trophyMats(),L=cfg.L,wb=cfg.wb,W=.86,hw=W/2,fz=L/2,rz=-L/2,yf=-.14,yc=restWheelY(cfg),ra=(cfg.wr||WR)+.03,yb=.26,CW=.74;   // yf: the floor; yc: the wheel centres at rest; yb: the beltline; CW: the cabin's width
  // the lower body: nose, hood, flanks with the wheel arches cut out, tail
  {const P=[[rz,yf+.06],[rz+.06,yf]];const arc=(zc)=>{for(let i=0;i<=10;i++){const a=Math.PI*(i/10),z=zc-Math.cos(a)*ra,y=yc+Math.sin(a)*ra;if(y>yf)P.push([z,y]);else if(i<5)P.push([z,yf])}};
    arc(-wb/2);P.push([-wb/2+ra+.01,yf]);arc(wb/2);P.push([wb/2+ra+.01,yf],[fz-.03,yf],[fz,yf+.06],[fz,.1],[fz-.05,.17],[.44,yb],[rz+.04,yb+.02],[rz,yb-.03]);
    const cleaned=P.filter((p,i)=>!i||Math.hypot(p[0]-P[i-1][0],p[1]-P[i-1][1])>1e-4);tbProfile(cleaned.reverse(),W,M.yel,g)}
  bx(.56,.3,L-.3,K.cabin,0,yf+.17,0,g);bx(W-.2,.02,L-.2,M.blkC,0,yf+.0,0,g);{const s=bx(.6,.014,.36,K.alu,0,yf-.0,fz-.2,g);s.rotation.x=-.2}                 // dark inside the arches, the floor, the sump guard
  // the cabin: a narrower shape over the beltline with glass laid on it
  tbProfile([[.46,yb-.01],[rz+.06,yb+.01],[rz+.3,.5],[.1,.5]],CW,M.yel,g);
  {const a=new THREE.Vector3(0,yb+.02,.44),b=new THREE.Vector3(0,.49,.115),d=b.clone().sub(a),ws=bx(CW-.1,d.length()-.03,.012,M.glass,0,0,0,g);ws.position.copy(a).add(b).multiplyScalar(.5);ws.position.z+=.006;ws.position.y+=.004;ws.rotation.x=-Math.atan2(-d.z,d.y);
    for(const sx of[1,-1]){const p=bx(.2,.008,.01,M.blk,sx*.15-.04,yb+.07,.4,g);p.rotation.z=.3;p.rotation.x=ws.rotation.x}}
  {const a=new THREE.Vector3(0,yb+.04,rz+.1),b=new THREE.Vector3(0,.48,rz+.29),d=b.clone().sub(a),rw=bx(CW-.14,d.length()-.03,.012,M.glass,0,0,0,g);rw.position.copy(a).add(b).multiplyScalar(.5);rw.position.z-=.006;rw.rotation.x=-Math.atan2(-d.z,d.y)}
  for(const sx of[1,-1]){carPane(g,[[.38,yb+.03],[.1,.47],[-.2,.47],[-.2,yb+.03]],sx*(CW/2+.003),M.glass);carPane(g,[[-.25,yb+.03],[-.25,.47],[rz+.33,.47],[rz+.14,yb+.04]],sx*(CW/2+.003),M.glass);
    bx(.04,.03,.06,M.blkC,sx*(CW/2+.03),yb+.05,.36,g);bx(.07,.05,.04,M.yel,sx*(CW/2+.08),yb+.06,.36,g);bx(.06,.04,.004,K.chrome,sx*(CW/2+.08),yb+.06,.338,g)}
  // wide arches over the wheels with a black lip, sills, door seams and handles, the red mud flaps
  const fxo=(cfg.track||TRACK)/2+(cfg.tireW||.19)/2+.01;
  for(const sx of[1,-1]){for(const wz of[wb/2,-wb/2]){const w2=fxo-hw+.02,cx=sx*(hw+w2/2-.01),yt=yc+ra+.01;bx(w2,.035,ra*1.1,M.yel,cx,yt,wz,g);for(const e of[-1,1]){const p=bx(w2,.035,ra*.8,M.yel,cx,yt-ra*.3,wz+e*ra*.78,g);p.rotation.x=e*.85}
      bx(.14,.14,.012,M.red,sx*(hw-.02),yf-.0,wz-ra-.04,g)}
    bx(.05,.05,wb-2*ra-.04,M.blkC,sx*(hw+.0),yf+.03,0,g);for(const z of[.42,-.08])bx(.005,yb-yf-.1,.008,M.blkC,sx*(hw+.001),(yb+yf)/2+.03,z,g);bx(.014,.02,.08,M.blkC,sx*(hw+.006),yb-.06,-.0,g);
    bx(.006,.05,L*.86,K.white,sx*(hw+.003),yf+.2,-.02,g);bx(.006,.018,L*.86,M.red,sx*(hw+.003),yf+.245,-.02,g);
    const p=new THREE.Mesh(new THREE.PlaneGeometry(.25,.156),TM.num);p.position.set(sx*(hw+.006),.1,.16);p.rotation.y=sx>0?Math.PI/2:-Math.PI/2;g.add(p)}
  // the nose: headlights, grille, the splitter, tow strap; the lamp pod on the hood and vents behind it
  bx(.36,.08,.02,M.blkC,0,.04,fz+.004,g);bx(.5,.07,.02,M.blkC,0,yf+.08,fz+.004,g);bx(W-.04,.02,.08,M.blkC,0,yf+.01,fz+.02,g);
  for(const sx of[1,-1]){bx(.17,.07,.02,M.lamp,sx*.31,.05,fz+.004,g);bx(.19,.09,.012,M.blkC,sx*.31,.05,fz-.002,g);bx(.05,.03,.02,M.amber,sx*.385,.05,fz+.006,g);carBeam(g,sx*.31,.05,fz+.02);bx(.03,.05,.07,M.red,sx*.14,yf+.07,fz+.03,g)}
  {const pod=bx(.56,.1,.07,K.white,0,.24,fz-.2,g);pod.rotation.x=-.1;for(let i=0;i<4;i++){const lx=-.2+i*.133;cyl(.058,.05,M.blkC,lx,.262,fz-.17,g,'z',14);cyl(.05,.012,M.lamp,lx,.262,fz-.144,g,'z',14)}}
  for(const sx of[1,-1]){const v=bx(.16,.008,.12,M.blkC,sx*.2,.236,.62,g);v.rotation.x=.13}
  {const hd=new THREE.Mesh(new THREE.PlaneGeometry(.26,.13),decalMat);hd.rotation.x=-Math.PI/2+.13;hd.position.set(0,.238,.58);g.add(hd)}
  // the roof: scoop, antenna; the wing on its struts with end plates
  bx(.2,.05,.2,M.yel,0,.52,.0,g);bx(.17,.035,.012,M.blk,0,.522,.102,g);carWhip(g,-.2,.5,-.3,.35);
  {const wy=.6,wz=rz+.16;const wg=bx(W-.06,.02,.2,M.yel,0,wy,wz,g);wg.rotation.x=.14;for(const sx of[1,-1]){bx(.016,.16,.24,M.blkC,sx*(hw-.03),wy-.04,wz,g);bx(.02,.3,.06,M.blkC,sx*.2,wy-.15,wz+.02,g)}bx(W-.06,.03,.016,M.blkC,0,wy+.025,wz-.1,g)}
  // the tail: lamps, plate, the bumper, a big exhaust and a tow strap
  for(const sx of[1,-1]){bx(.2,.07,.012,M.blkC,sx*.3,.17,rz-.002,g);bx(.11,.05,.014,M.tail,sx*.335,.17,rz-.006,g);bx(.04,.05,.014,M.amber,sx*.25,.17,rz-.006,g);bx(.03,.05,.014,K.rev,sx*.215,.17,rz-.006,g)}
  bx(.2,.06,.008,M.plate,0,.06,rz-.004,g);carPlate(g,0,.06,rz-.009,-1,.2);bx(W-.04,.06,.03,M.blkC,0,yf+.05,rz-.0,g);cyl(.04,.1,K.chrome,.24,yf+.04,rz-.02,g,'z',12);cyl(.032,.102,M.blk,.24,yf+.04,rz-.022,g,'z',10);bx(.03,.05,.07,M.red,-.2,yf+.07,rz-.02,g);
  g.userData.door={x:hw,xg:CW/2,ya:yf+.06,yb:yb,yc:.47,z:.38,len:.46};
  carGear(g,cfg,{sn:[-(CW/2+.03),yb,.36,.3],w:[yf+.1,fz+.07],led:[CW-.2,.53,.12]});
  return g}

/* ---------- Sandloppe: a beach buggy. A floor pan with a sloping nose in the paint, a cage of tube around two bucket seats, the engine in the open at the back ---------- */
function buildBuggy(cfg){
  const g=new THREE.Group(),K=carKit(),TM=trophyMats(),L=cfg.L,wb=cfg.wb,fz=L/2,rz=-L/2,yf=-.08,T=(a,b,r=.02,mat=K.white)=>tbTube(a,b,r,mat,g);
  // the floor pan and skid plate, the side pods and the nose in the paint
  bx(.62,.04,L-.3,M.blkC,0,yf,-.02,g);{const s=bx(.5,.014,.3,K.alu,0,yf+.0,fz-.22,g);s.rotation.x=-.3}
  tbProfile([[.18,yf+.02],[fz-.08,yf+.02],[fz-.04,yf+.08],[fz-.1,yf+.14],[.2,yf+.3]],.56,M.yel,g);
  for(const sx of[1,-1]){rbx(.13,.17,.78,.03,M.yel,sx*.37,yf+.09,-.12,g);bx(.012,.03,.7,M.blkC,sx*.437,yf+.11,-.12,g);
    const p=new THREE.Mesh(new THREE.PlaneGeometry(.22,.137),TM.num);p.position.set(sx*.438,yf+.1,-.05);p.rotation.y=sx>0?Math.PI/2:-Math.PI/2;g.add(p)}
  {const hd=new THREE.Mesh(new THREE.PlaneGeometry(.26,.13),decalMat);hd.rotation.x=-Math.PI/2+.37;hd.position.set(0,yf+.214,.46);g.add(hd)}
  // headlights on stalks, a front bumper hoop, tow hook
  for(const sx of[1,-1]){T([sx*.2,yf+.16,fz-.2],[sx*.26,yf+.26,fz-.16],.012,M.blkC);cyl(.058,.07,M.blkC,sx*.26,yf+.28,fz-.15,g,'z',14);cyl(.05,.012,K.chrome,sx*.26,yf+.28,fz-.112,g,'z',14);cyl(.043,.012,M.lamp,sx*.26,yf+.28,fz-.108,g,'z',14);carBeam(g,sx*.26,yf+.28,fz-.1);
    T([sx*.24,yf+.03,fz-.1],[sx*.2,yf+.06,fz+.03],.02,M.blkC);cyl(.02,.025,M.amber,sx*.33,yf+.2,fz-.2,g,'z',8)}
  T([-.2,yf+.06,fz+.03],[.2,yf+.06,fz+.03],.02,M.blkC);bx(.05,.04,.06,M.red,0,yf+.0,fz-.04,g);
  // the cage: windshield hoop, roof bars, the main hoop behind the seats, braces down to the engine, side bars
  const y1=.56,zA=.3,zB=.02,zC=-.42,zD=-.86;
  for(const sx of[1,-1]){T([sx*.3,yf+.24,zA],[sx*.27,y1,zB]);T([sx*.27,y1,zB],[sx*.3,y1,zC]);T([sx*.3,y1,zC],[sx*.36,yf+.02,zC+.02]);T([sx*.3,y1,zC],[sx*.24,yf+.2,zD]);T([sx*.24,yf+.2,zD],[sx*.26,yf,zD+.06],.018);
    T([sx*.44,yf+.19,.26],[sx*.44,yf+.19,zC],.018);T([sx*.44,yf+.19,.26],[sx*.3,yf+.24,zA],.018);T([sx*.36,yf+.02,zC+.02],[sx*.24,yf+.2,zD],.016)}
  T([-.27,y1,zB],[.27,y1,zB]);T([-.3,y1,zC],[.3,y1,zC]);T([-.3,yf+.24,zA],[.3,yf+.24,zA],.018);T([-.24,yf+.2,zD],[.24,yf+.2,zD],.018);T([-.3,y1*.55,zC],[.3,y1*.55,zC],.016);
  bx(.5,.012,.4,K.alu,0,y1+.02,(zB+zC)/2,g);                                                                                           // a sheet of aluminium for a roof
  bx(.5,.04,.04,M.blkC,0,y1+.05,zB+.02,g);for(let i=0;i<4;i++){cyl(.04,.04,M.blkC,-.18+i*.12,y1+.085,zB+.02,g,'z',12);cyl(.033,.012,M.lamp,-.18+i*.12,y1+.085,zB+.044,g,'z',12)}
  // dashboard, steering wheel, bucket seats with harnesses and the crew in helmets
  bx(.5,.07,.04,K.cabin,0,yf+.25,.2,g);carWheelStick(g,.17,yf+.27,.1,.055);
  for(const sx of[1,-1]){carSeat(g,sx*.17,yf+.02,-.18,.2,.26,M.blk);for(const dx of[-.04,.04])bx(.02,.2,.008,M.red,sx*.17+dx,yf+.19,-.2,g).rotation.x=-.1}
  carCrew(g,[[.17,yf+.135,-.19],[-.17,yf+.135,-.19]],true);
  // the engine in the open: block, fan housing, two carburettors with air filters, the belt pulley, pipes into one upswept exhaust
  const ze=-.66;bx(.3,.16,.26,K.alu,0,yf+.12,ze,g);bx(.34,.03,.3,M.blkC,0,yf+.03,ze,g);{const f=cyl(.11,.1,M.blkC,0,yf+.24,ze+.06,g,'z',14);f.scale.y=1}cyl(.07,.02,K.chrome,0,yf+.14,ze-.14,g,'z',12);cyl(.03,.03,M.blk,0,yf+.14,ze-.15,g,'z',8);
  for(const sx of[1,-1]){bx(.08,.06,.1,M.steel,sx*.11,yf+.23,ze-.06,g);cyl(.045,.05,M.red,sx*.11,yf+.285,ze-.06,g,null,10);cyl(.047,.01,K.chrome,sx*.11,yf+.313,ze-.06,g,null,10);
    T([sx*.13,yf+.08,ze-.1],[sx*.1,yf+.05,zD-.02],.016,K.chrome)}
  T([-.1,yf+.05,zD-.02],[.1,yf+.05,zD-.02],.016,K.chrome);T([0,yf+.05,zD-.02],[0,yf+.24,zD-.16],.03,K.chrome);
  // the tail: lamps and the plate on the cage, a spare wheel lying over the engine, the whip with its flag
  for(const sx of[1,-1]){cyl(.028,.02,M.tail,sx*.2,yf+.2,zD-.022,g,'z',10);cyl(.016,.02,K.rev,sx*.14,yf+.2,zD-.022,g,'z',8)}
  bx(.16,.045,.006,M.plate,0,yf+.3,zD-.02,g).rotation.x=.3;
  {const sp=buildWheel(.2,1);sp.root.scale.set(.8,.8,.8);sp.root.position.set(0,yf+.4,ze-.02);sp.root.rotation.z=Math.PI/2;sp.root.rotation.x=.38;g.add(sp.root)}
  cyl(.006,.8,M.blkC,-.3,y1+.4,zC,g,null,5);{const fl=new THREE.Mesh(new THREE.PlaneGeometry(.12,.08),TM.flag);fl.position.set(-.3,y1+.76,zC-.06);fl.rotation.y=Math.PI/2;g.add(fl)}
  carGear(g,cfg,{w:[yf+.05,fz-.0],led:[.5,y1+.14,zB+.02]});
  return g}
