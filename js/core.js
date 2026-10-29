'use strict';
/* =================================================================
   CORE: terrain, levels and crawler physics (no DOM)
   1 world unit ≈ 8.5 cm in real life (a 1:24 crawler is ~2 units long)
   ================================================================= */
const V3=THREE.Vector3, Q4=THREE.Quaternion, YAX=new V3(0,1,0);
const UNIT_CM=8.5;
// the world is a square grid. 70 units (241 cells) is the default; a level can ask for more with  size:120  (the island). Cells stay ~0.29 units.
let WORLD=70, N=241, CELL=WORLD/(N-1), HALF=WORLD/2;
let TH,TB,TS,TC,TCF,TG;   // TG: groomed ski piste (1) or not (0), see c.piste
function setWorld(size){size=size||70;const n=Math.round(size/(70/240))+1;if(TH&&n===N&&size===WORLD)return false;WORLD=size;N=n;CELL=WORLD/(N-1);HALF=WORLD/2;
  TH=new Float32Array(N*N);TB=new Float32Array(N*N);TS=new Uint8Array(N*N);TC=new Float32Array(N*N*3);TCF=new Uint8Array(N*N);TG=new Uint8Array(N*N);return true}
setWorld(70);
const S={SAND:0,ROCK:1,DIRT:2,GRASS:3,WOOD:4,MUD:5,BOOK:6,BARK:7,PENCIL:8,KEY:9,GRAVEL:10,PAPER:11,FLOOR:12,BOG:13,ASH:14,LAVA:15,SNOW:16,ICE:17,REDROCK:18,ASPHALT:19};
const GRIP=[0.85,1.25,1.0,0.95,0.92,0.62,1.05,1.1,0.95,1.0,1.0,0.88,0.9,0.7,0.88,0.6,0.7,0.42,1.2,1.15];
// mud drag per wheel: [constant, viscous] as fractions of m·g. Low gear pushes through; high gear bogs down.
const MUDDRAG={5:[.05,.012],13:[.12,.025]};
const G={noise:null,def:null,outside:null,colliders:[],waterAt:null,decks:[],lavas:[],pistes:[],lift:null};
function WL(x,z){return G.waterAt?G.waterAt(x,z):-1e9}

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function makeNoise(seed){
  const r=mulberry32(seed),p=new Uint16Array(256),perm=new Uint16Array(512),val=new Float32Array(256);
  for(let i=0;i<256;i++){p[i]=i;val[i]=r()}
  for(let i=255;i>0;i--){const j=Math.floor(r()*(i+1)),t=p[i];p[i]=p[j];p[j]=t}
  for(let i=0;i<512;i++)perm[i]=p[i&255];
  const h=(a,b)=>val[perm[(a&255)+perm[b&255]]];
  return (x,z)=>{const xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi,u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf);
    const A=h(xi,zi),B=h(xi+1,zi),C=h(xi,zi+1),D=h(xi+1,zi+1);return (A+(B-A)*u)*(1-v)+(C+(D-C)*u)*v;};
}
function fbm(n,x,z,o=4){let s=0,a=1,f=1,t=0;for(let i=0;i<o;i++){s+=(n(x*f+i*17.3,z*f-i*9.1)-.5)*a;t+=a*.5;a*=.5;f*=2.03}return s/t}

/* ---------- height queries ---------- */
function Hterr(x,z){
  let fx=(x+HALF)/CELL,fz=(z+HALF)/CELL;
  if(G.outside!==null&&(fx<0||fz<0||fx>N-1||fz>N-1))return G.outside;
  fx=fx<0?0:fx>N-1.0001?N-1.0001:fx; fz=fz<0?0:fz>N-1.0001?N-1.0001:fz;
  const i=fx|0,j=fz|0,u=fx-i,v=fz-j,k=j*N+i;
  const a=TH[k],b=TH[k+1],c=TH[k+N],d=TH[k+N+1];
  return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
}
// suspension bridges are analytic decks laid on top of the terrain: height = max(terrain, deck)
function deckAt(x,z){let best=-1e9;
  for(const k of G.decks){if(x<k.x0||x>k.x1||z<k.z0||z>k.z1)continue;
    const rx=x-k.ax,rz=z-k.az,a=rx*k.ux+rz*k.uz;if(a<0||a>k.len)continue;const b=Math.abs(rx*k.uz-rz*k.ux);if(b>k.hw)continue;
    const t=a/k.len;let y=k.y0+(k.y1-k.y0)*t-k.sag*4*t*(1-t);const e=k.hw-b;if(e<.16)y+=.15*Math.min(1,(.16-e)/.05); // low plank rail at the edge
    if(y>best)best=y}
  return best}
function H(x,z){const h=Hterr(x,z);if(G.decks.length){const d=deckAt(x,z);if(d>h)return d}return h}
function surfAt(x,z){let i=Math.round((x+HALF)/CELL),j=Math.round((z+HALF)/CELL);i=i<0?0:i>N-1?N-1:i;j=j<0?0:j>N-1?N-1:j;
  if(G.decks.length){const d=deckAt(x,z);if(d>-1e8&&d>=Hterr(x,z))return S.WOOD}return TS[j*N+i]}
// lava: returns the lava surface height at (x,z), or -1e9 if there is none. m widens the area.
function lavaAt(x,z,m=0){let best=-1e9,bd=1e9;for(const L of G.lavas)for(const p of L.s){const dx=p.x-x,dz=p.z-z,d=Math.sqrt(dx*dx+dz*dz)-p.hw-m;if(d<0&&d<bd){bd=d;best=p.y}}return best}
function normalAt(x,z,out){const e=.15;return out.set(H(x-e,z)-H(x+e,z),2*e,H(x,z-e)-H(x,z+e)).normalize()}

/* ---------- stamping ---------- */
const _cc={};
function col(h){if(_cc[h])return _cc[h];const c=new THREE.Color(h);if(c.convertSRGBToLinear)c.convertSRGBToLinear();return _cc[h]=[c.r,c.g,c.b]}
function mix(a,b,t){const A=col(a),B=col(b);t=Math.max(0,Math.min(1,t));return[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t]}
function setC(k,h){const c=typeof h==='string'?col(h):h;TC[k*3]=c[0];TC[k*3+1]=c[1];TC[k*3+2]=c[2];TCF[k]=1}
function cellsIn(x0,z0,x1,z1,fn){
  const i0=Math.max(0,Math.floor((x0+HALF)/CELL)),i1=Math.min(N-1,Math.ceil((x1+HALF)/CELL));
  const j0=Math.max(0,Math.floor((z0+HALF)/CELL)),j1=Math.min(N-1,Math.ceil((z1+HALF)/CELL));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)fn(j*N+i,-HALF+i*CELL,-HALF+j*CELL);
}
function rock(x,z,r,h,o={}){
  const sharp=o.sharp??.55,nz=o.nz??.35,surf=o.surf??S.ROCK,ax=o.ax??1,an=o.ang??0,ca=Math.cos(an),sa=Math.sin(an),R=r*Math.max(ax,1),n=G.noise,sd=x*3.7+z*1.3;
  cellsIn(x-R,z-R,x+R,z+R,(k,px,pz)=>{const dx=px-x,dz=pz-z,lx=(dx*ca-dz*sa)/(r*ax),lz=(dx*sa+dz*ca)/r,d2=lx*lx+lz*lz;if(d2>=1)return;
    const b=h*Math.pow(1-d2,sharp)*(1-nz*.5+nz*n(px*1.9+sd,pz*1.9-sd));if(b<=0)return;TH[k]+=b;if(b>.035){TS[k]=surf;TCF[k]=0}});
}
// level: an absolute height for h=0 (default: the untouched base terrain TB). Use it on terraces, streets and other stamped ground.
function shape(cx,cz,ang,len,wid,hf,surf,cf,level){
  const dx=Math.sin(ang),dz=Math.cos(ang),R=Math.hypot(len,wid)/2+CELL;
  cellsIn(cx-R,cz-R,cx+R,cz+R,(k,px,pz)=>{const rx=px-cx,rz=pz-cz,a=rx*dx+rz*dz,b=rx*dz-rz*dx;
    if(Math.abs(a)>len/2||Math.abs(b)>wid/2)return;const h=hf(a,b);if(h==null)return;const nh=(level??TB[k])+h;
    if(nh>=TH[k]-1e-4){TH[k]=nh;if(surf!=null)TS[k]=surf;if(cf)setC(k,cf(a,b))}});
}
function disc(x,z,r,top,surf,c,level){cellsIn(x-r,z-r,x+r,z+r,(k,px,pz)=>{if(Math.hypot(px-x,pz-z)>r)return;const nh=(level??TB[k])+top;if(nh>=TH[k]){TH[k]=nh;TS[k]=surf;if(c)setC(k,c)}})}
function log(ax,az,bx,bz,r,surf,cf){
  const ex=bx-ax,ez=bz-az,L2=ex*ex+ez*ez||1e-6,R=r*1.8;
  cellsIn(Math.min(ax,bx)-R,Math.min(az,bz)-R,Math.max(ax,bx)+R,Math.max(az,bz)+R,(k,px,pz)=>{
    let t=((px-ax)*ex+(pz-az)*ez)/L2;t=t<0?0:t>1?1:t;const dx=px-(ax+ex*t),dz=pz-(az+ez*t),d=Math.hypot(dx,dz);let p;
    if(d<r)p=r+Math.sqrt(r*r-d*d);else if(d<1.7*r)p=r*(1-(d-r)/(.7*r));else return;
    const nh=TB[k]+p;if(nh>TH[k]){TH[k]=nh;if(d<r*1.05){TS[k]=surf;if(cf)setC(k,cf(t,d/r));else TCF[k]=0}}});
}
function paint(x,z,r,surf,skip){cellsIn(x-r,z-r,x+r,z+r,(k,px,pz)=>{if(Math.hypot(px-x,pz-z)>r)return;if(skip!=null&&TS[k]===skip)return;if(TS[k]===S.ROCK||TS[k]===S.BARK)return;TS[k]=surf})}

/* ---------- shared decor geometry ---------- */
const DG={
  peb:new THREE.IcosahedronGeometry(1,0), tuft:new THREE.ConeGeometry(1,1,4,1,true), trunk:new THREE.CylinderGeometry(1,1.14,1,10),
  fern:new THREE.ConeGeometry(1,1,6), cone:new THREE.SphereGeometry(1,6,5),
  canopy:new THREE.SphereGeometry(1,7,5), branch:new THREE.CylinderGeometry(.55,1,1,6), root:new THREE.BoxGeometry(1,1,1), leaf:new THREE.ConeGeometry(1,1,3,1,true)
};
DG.prism=new THREE.CylinderGeometry(1,1,1,3,1);   // triangular prism: apex at local z=1, base edge at z=-.5 (width 1.732)
DG.branch.translate(0,.5,0); DG.leaf.translate(0,.5,0);
DG.tuft.translate(0,.5,0); DG.fern.translate(0,.5,0);
const DM={
  white:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9,flatShading:true}),
  tuft:new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,side:THREE.DoubleSide,flatShading:true}),
  bark:new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,flatShading:true}),   // white: the bark colour comes from each instance
  leaf:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.85,side:THREE.DoubleSide,flatShading:true})
};
function instanced(geo,mat,list,grp,shadow=true){
  if(!list.length)return null;const im=new THREE.InstancedMesh(geo,mat,list.length),m4=new THREE.Matrix4(),q=new Q4(),s=new V3(),p=new V3(),e=new THREE.Euler(),cc=new THREE.Color();
  list.forEach((o,i)=>{p.set(o.x,o.y,o.z);e.set(o.rx||0,o.ry||0,o.rz||0,o.ord||'XYZ');q.setFromEuler(e);s.set(o.sx,o.sy??o.sx,o.sz??o.sx);m4.compose(p,q,s);im.setMatrixAt(i,m4);if(o.c&&im.setColorAt){if(Array.isArray(o.c))cc.setRGB(o.c[0],o.c[1],o.c[2]);else{cc.set(o.c);if(cc.convertSRGBToLinear)cc.convertSRGBToLinear()}im.setColorAt(i,cc)}});
  im.castShadow=shadow;im.receiveShadow=true;grp.add(im);return im;
}

/* ---------- surface colour ---------- */
function surfColor(s,x,z,n,def){
  const v=n(x*.45+50,z*.45),w=n(x*2.7,z*2.7-40);
  switch(s){
    case S.SAND:return mix('#b58a46','#d2ab66',v*.7+w*.3);
    case S.ROCK:{const b=col(def.rockCol||'#9a948a'),f=.76+w*.32+v*.12;return[b[0]*f,b[1]*f,b[2]*f]}
    case S.GRAVEL:return mix('#776f62','#a1998b',v*.5+w*.5);
    case S.DIRT:return def.dirtCol?mix(def.dirtCol[0],def.dirtCol[1],v*.6+w*.4):mix('#5b412b','#80603f',v*.6+w*.4);   // def.dirtCol/grassCol: the level's own colours (red earth and golden grass on Løveøya)
    case S.GRASS:return def.grassCol?mix(def.grassCol[0],def.grassCol[1],v*.7+w*.3):mix('#4b6629','#7f9441',v*.7+w*.3);
    case S.MUD:return mix('#3c2f22','#574431',w);
    case S.BOG:return mix('#2a2016','#3f3024',w*.6+v*.4);
    case S.BARK:return mix('#47321f','#6c4b31',w);
    case S.WOOD:{const g=Math.sin(x*1.25+fbm(n,x*.07,z*.6,3)*9)*.5+.5;return mix('#77482a','#a86f3f',g*.75+w*.25)}
    case S.ASH:return mix('#26221f','#4a433d',v*.5+w*.5);
    case S.LAVA:return mix('#2a0d06','#5a1a08',w);
    case S.FLOOR:return mix('#241c16','#2f251d',w);
    case S.SNOW:return mix('#dbe3ea','#fbfdff',v*.5+w*.5);
    case S.ICE:return mix('#9fc6dc','#d6ecf8',v*.4+w*.6);
    case S.REDROCK:{const b=mix('#a24f2c','#d08a56',v*.6+w*.4),f=.8+w*.3;return[b[0]*f,b[1]*f,b[2]*f]}
    case S.ASPHALT:return mix('#4a4a48','#5e5c58',v*.5+w*.5);
    default:return mix('#8a8a8a','#9a9a9a',w);
  }
}

/* ---------- levels ---------- */
const LEVELS=[]; // fylles av data/levels/*.js

// levels the ground across a line. tilt (0–1) keeps that part of the slope across the line, so a ski piste on a mountainside may lean a little
function benchPts(P,hw,blend,tilt=0){
  const hs=P.map(p=>Hterr(p.x,p.z)),sm=hs.map((_,i)=>{let a=0,m=0;for(let k=-8;k<=8;k++){const j=i+k;if(j>=0&&j<hs.length){a+=hs[j];m++}}return a/m});
  const best=new Float32Array(N*N).fill(1e9),bi=new Int32Array(N*N).fill(-1),R=hw+blend;
  for(let i=0;i<P.length;i+=2){const p=P[i];cellsIn(p.x-R,p.z-R,p.x+R,p.z+R,(k,px,pz)=>{const d=Math.hypot(px-p.x,pz-p.z);if(d<best[k]){best[k]=d;bi[k]=i}})}
  for(let k=0;k<N*N;k++){if(bi[k]<0||best[k]>=R)continue;const d=best[k],f=d<=hw?1:1-(d-hw)/blend,w=f*f*(3-2*f),i=bi[k];TH[k]+=(sm[i]+tilt*Math.max(-hw,Math.min(hw,TH[k]-hs[i]))-TH[k])*w}}
function carveLava(s){
  const best=new Float32Array(N*N).fill(1e9),bi=new Int32Array(N*N).fill(-1);
  s.forEach((p,i)=>{const R=p.hw+.8;cellsIn(p.x-R,p.z-R,p.x+R,p.z+R,(k,px,pz)=>{const d=Math.hypot(px-p.x,pz-p.z)-p.hw;if(d<best[k]){best[k]=d;bi[k]=i}})});
  for(let k=0;k<N*N;k++){if(bi[k]<0||best[k]>=.6)continue;const p=s[bi[k]],d=best[k],floor=p.y-.3;let nh;
    if(d<=0)nh=floor;else{const f=d/.6,sf=f*f*(3-2*f);nh=floor+(TH[k]-floor)*sf}
    if(nh<TH[k]){TH[k]=nh;TCF[k]=0;TS[k]=d<=.12?S.LAVA:S.ASH}}}

// points along a polyline [[x,z],...] every `step` units
function polyPts(poly,step=.5){const d=[];for(let i=0;i<poly.length-1;i++){const a=poly[i],b=poly[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),m=Math.max(1,Math.ceil(L/step));for(let k=0;k<m;k++){const u=k/m;d.push({x:a[0]+(b[0]-a[0])*u,z:a[1]+(b[1]-a[1])*u})}}const e=poly[poly.length-1];d.push({x:e[0],z:e[1]});return d}
// a line with gates: the main line of a level, or one course inside an open world
function makeLine(path){const curve=new THREE.CatmullRomCurve3(path.map(p=>new V3(p[0],0,p[1])),false,'centripetal'),pts=curve.getSpacedPoints(500);
  const k={curve,pts,P:t=>curve.getPointAt(t),T:t=>{const v=curve.getTangentAt(t);v.y=0;return v.normalize()}};
  k.side=t=>{const v=k.T(t);return new V3(v.z,0,-v.x)};k.ang=t=>{const v=k.T(t);return Math.atan2(v.x,v.z)};
  k.tOf=(x,z)=>{let m=1e9,bi=0;for(let i=0;i<pts.length;i++){const dx=pts[i].x-x,dz=pts[i].z-z,d=dx*dx+dz*dz;if(d<m){m=d;bi=i}}return bi/(pts.length-1)};
  k.dist=(x,z)=>{let m=1e9;for(let i=0;i<pts.length;i+=2){const dx=pts[i].x-x,dz=pts[i].z-z,d=dx*dx+dz*dz;if(d<m)m=d}return Math.sqrt(m)};
  k.gates=[];k.makeGates=(gl,NG)=>{NG=gl?gl.length:NG;for(let g=1;g<=NG;g++){const t=gl?gl[g-1]:.03+.95*g/NG,p=k.P(t),tn=k.T(t),s=k.side(t);
    k.gates.push({t,c:p,tan:tn,side:s,a:{x:p.x+s.x*1.25,z:p.z+s.z*1.25},b:{x:p.x-s.x*1.25,z:p.z-s.z*1.25},finish:g===NG})}};
  return k}
function genCourse(c,ch,rng){const k=makeLine(ch.path);Object.assign(k,{id:ch.id,name:ch.name,desc:ch.desc,diff:ch.diff||1,def:ch,extra:[],crate:(x,z)=>k.extra.push({x,z})});
  k.makeGates(ch.gateT?ch.gateT(k):null,ch.gates||8);k.start={p:k.P(0),tan:k.T(.004)};k.nearGate=(x,z,m)=>k.gates.some(g=>Math.hypot(g.c.x-x,g.c.z-z)<m);return k}
// supply crates beside a line, never in water or lava
function placeCrates(k,c,rng){const out=[];for(let i=0;i<6;i++){const t=.09+.8*i/5+(rng()-.5)*.04,p=k.P(t),s=k.side(t);let placed=false;
    for(const sg of(i%2?[1,-1]:[-1,1])){const off=sg*(1.3+rng()*.7),x=p.x+s.x*off,z=p.z+s.z*off,y=H(x,z);if(WL(x,z)>y-.05||lavaAt(x,z,1.1)>-1e8||c.nearGate(x,z,1.1)||Math.abs(y-H(p.x,p.z))>.9)continue;out.push({x,z,y:y+.16,t});placed=true;break}
    for(const o of[0,.012,-.012,.024,-.024,.036,-.036]){if(placed)break;const q=k.P(Math.min(1,Math.max(0,t+o))),y=H(q.x,q.z);if(WL(q.x,q.z)>y-.05||lavaAt(q.x,q.z,1.1)>-1e8||c.nearGate(q.x,q.z,1.1))continue;out.push({x:q.x,z:q.z,y:y+.16,t:t+o});placed=true}
    if(!placed)out.push({x:p.x,z:p.z,y:H(p.x,p.z)+.16,t})}return out}

const smt01=x=>{x=x<0?0:x>1?1:x;return x*x*(3-2*x)};
function genLevel(def){
  setWorld(def.size||70);
  const rng=mulberry32(def.seed),n=makeNoise(def.seed*7+3);
  G.noise=n;G.def=def;G.outside=def.outside??null;G.decks=[];G.lavas=[];G.pistes=[];G.lift=null;TCF.fill(0);TG.fill(0);
  // coast: the level becomes an island. Beyond def.coast the ground sinks under the sea; the last ring before it is beach.
  const coast=def.coast||0;if(coast&&!def._coastBand){const ob=def.waterBand,had=def.water!=null;def._coastBand=true;if(!had)def.water=.3;def.waterBand=(x,z)=>Math.hypot(x,z)>coast-5||(ob?ob(x,z):had)}   // a level without water of its own only gets the sea ring
  const wsea=def.water;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i,x=-HALF+i*CELL,z=-HALF+j*CELL;let h=def.base(x,z,n),sf=def.surf(x,z,n);
    if(coast){const R=Math.hypot(x,z),ex=def.landExtra?def.landExtra(x,z):0,kk=smt01((R-coast+3)/6)*(1-ex);if(kk>0)h+=((wsea-1.8)-h)*kk;if(R>coast-7&&h>wsea-.05&&ex<.5)sf=def.beachSurf??S.SAND}   // landExtra(x,z): 0–1, land built out past the coast (Trinnvik's airport)
    TH[k]=h;TS[k]=sf}
  TB.set(TH);
  const curve=new THREE.CatmullRomCurve3(def.path.map(p=>new V3(p[0],0,p[1])),false,'centripetal');
  const pts=curve.getSpacedPoints(500);
  const blocks=[];
  const c={rng,noise:n,curve,pts,colliders:[],decor:new THREE.Group(),gates:[],
    P:t=>curve.getPointAt(t), T:t=>{const v=curve.getTangentAt(t);v.y=0;return v.normalize()},
    side:t=>{const v=c.T(t);return new V3(v.z,0,-v.x)}, ang:t=>{const v=c.T(t);return Math.atan2(v.x,v.z)},
    // distance to the main line, and to every road and course registered so far (so rocks and trees keep clear of them too)
    xpts:[],dist:(x,z)=>{let m=1e9;for(let i=0;i<pts.length;i+=2){const dx=pts[i].x-x,dz=pts[i].z-z,d=dx*dx+dz*dz;if(d<m)m=d}const X=c.xpts;for(let i=0;i<X.length;i++){const dx=X[i].x-x,dz=X[i].z-z,d=dx*dx+dz*dz;if(d<m)m=d}return Math.sqrt(m)},
    nearGate:(x,z,m)=>c.gates.some(g=>Math.hypot(g.c.x-x,g.c.z-z)<m)||c.courses.some(k=>k.gates.some(g=>Math.hypot(g.c.x-x,g.c.z-z)<m)),
    courses:[],roads:[],boxes:[],cyls:[],prisms:[],
    // a road: levelled, painted, and kept clear of decor. poly=[[x,z],...]
    road(poly,o={}){const d=polyPts(poly,.5);c.xpts.push(...d);c.roads.push(poly);if(o.bench!==false)benchPts(polyPts(poly,.33),o.hw??1.3,o.blend??1.6);if(o.surf!=null)for(const p of d)paint(p.x,p.z,o.hw??1.3,o.surf,o.skip);return poly},
    // a course (an event inside an open world): its own line, gates and crates. Levelled like a road unless bench:false.
    course(ch){const k=genCourse(c,ch,rng);c.courses.push(k);for(let i=0;i<k.pts.length;i+=2)c.xpts.push(k.pts[i]);if(ch.bench!==false){benchPts(k.pts,ch.hw??1.2,ch.blend??1.7);const sp=k.P(0);c.flat(sp.x,sp.z,2.2,Hterr(sp.x,sp.z),2.4)}if(ch.surf!=null)for(let i=0;i<k.pts.length;i+=2)paint(k.pts[i].x,k.pts[i].z,1.3,ch.surf,ch.skip);return k},
    // a flat pad (the base, a camp): the terrain is pulled to height h inside r, blended outside
    flat(x,z,r,h,blend=3){cellsIn(x-r-blend,z-r-blend,x+r+blend,z+r+blend,(k,px,pz)=>{const d=Math.hypot(px-x,pz-z);if(d>r+blend)return;const f=d<=r?1:1-(d-r)/blend,w=f*f*(3-2*f);TH[k]+=(h-TH[k])*w})},
    // props: boxes and cylinders drawn as instances at c.props() (buildings, barriers, posts). y is the bottom.
    box(x,y,z,w,h,d,col,ry=0,o={}){c.boxes.push({x,y:y+h/2,z,sx:w,sy:h,sz:d,ry,rx:o.rx||0,rz:o.rz||0,c:col})},
    onLand:(x,z)=>H(x,z)>(def.water??-1e9)+.25&&(!def.coast||Math.hypot(x,z)<def.coast-6),
    cyl(x,y,z,r,h,col,o={}){c.cyls.push({x,y:y+h/2,z,sx:r,sy:h,sz:r,rx:o.rx||0,ry:o.ry||0,rz:o.rz||0,c:col});return c.cyls.length-1},
    props(){for(const b of c.boxes)if(b.sx>=1&&b.sz>=1&&b.sy>=.8)c.footprints.push({x:b.x,z:b.z,w:b.sx,d:b.sz,ry:b.ry||0});c.propBoxes=instanced(DG.root,DM.white,c.boxes,c.decor);c.propCyls=instanced(DG.trunk,DM.white,c.cyls,c.decor);c.cylList=c.cyls;instanced(DG.prism,DM.white,c.prisms,c.decor);c.boxes=[];c.cyls=[];c.prisms=[]},
    footprints:[],   // big boxes (buildings), drawn on the island map
    // ---- town pieces (see README: «En by») ----
    // a staircase stamped at an absolute height: n steps of `rise` up, each `tread` deep, `w` wide, climbing from (x,z) in direction ang (radians, 0 = +z).
    // The ground inside the footprint is SET to the step height (not just raised), so a stair never hides under a terrace or leaves a spike where it meets one.
    // o.level = height at the foot (default H there), o.land = a flat landing after the top step, o.wall = side walls (boxes with colliders), o.max = only raise.
    stairs(x,z,ang,n,rise,tread,w,o={}){const dx=Math.sin(ang),dz=Math.cos(ang),land=o.land||0,len=n*tread+land,cx=x+dx*len/2,cz=z+dz*len/2,lvl=o.level??H(x,z),R=Math.hypot(len,w)/2+CELL,c0=o.c0||'#8a877f',c1=o.c1||'#a09d95',surf=o.surf??S.ROCK;
      cellsIn(cx-R,cz-R,cx+R,cz+R,(k,px,pz)=>{const rx=px-cx,rz=pz-cz,a=rx*dx+rz*dz,b=rx*dz-rz*dx;if(Math.abs(a)>len/2||Math.abs(b)>w/2)return;
        const st=Math.min(n,Math.floor((a+len/2)/tread)+1),nh=lvl+st*rise;if(o.max&&nh<TH[k])return;TH[k]=nh;TS[k]=surf;if(c._st)c._st[k]=0;setC(k,mix(c0,c1,(st%2)*.7+G.noise(px*3,pz*3)*.3))});
      c.block(cx,cz,Math.max(len,w)/2+1);
      if(o.wall){const hgt=n*rise+(o.wallH||.25),ry=ang;for(const sd of[-1,1]){const wx=cx-dz*sd*(w/2+.08),wz=cz+dx*sd*(w/2+.08);c.box(wx,lvl-.05,wz,.16,hgt+.05,len,o.wallCol||'#8d8a84',ry);c.colliders.push({x:wx,z:wz,w:.16,d:len,ry,anchor:true,y:lvl+hgt*.5})}}
      return{x:x+dx*len,z:z+dz*len,y:lvl+n*rise,len}},
    // a town street: the roadway is lowered by o.drop (default .12) inside hw, so the pavement makes a kerb on both sides; the kerb band is painted concrete.
    // o.cross=[[x,z],...] are pedestrian crossings where the roadway comes back up to pavement level (a raised crossing). Nothing is benched: the ground must already be flat.
    street(poly,o={}){const hw=o.hw??1.6,drop=o.drop??.12,kb=o.kerb??.35,P=polyPts(poly,.25),R=hw+kb+.3;c.xpts.push(...polyPts(poly,.5));c.roads.push(poly);
      let x0=1e9,z0=1e9,x1=-1e9,z1=-1e9;for(const p of P){x0=Math.min(x0,p.x);z0=Math.min(z0,p.z);x1=Math.max(x1,p.x);z1=Math.max(z1,p.z)}
      const best=new Map();cellsIn(x0-R,z0-R,x1+R,z1+R,(k,px,pz)=>{let m=1e9;for(let i=0;i<poly.length-1;i++){const a=poly[i],b=poly[i+1],ex=b[0]-a[0],ez=b[1]-a[1],L2=ex*ex+ez*ez||1e-9;let t=((px-a[0])*ex+(pz-a[1])*ez)/L2;t=t<0?0:t>1?1:t;const d=Math.hypot(px-a[0]-ex*t,pz-a[1]-ez*t);if(d<m)m=d}if(m<R)best.set(k,[m,px,pz])});
      // streets may cross: a cell is lowered at most once, to the deepest roadway that covers it (c._st remembers how far down it already is)
      const st=c._st||(c._st=new Float32Array(N*N));
      for(const[k,[d,px,pz]]of best){let cr=0;for(const q of(o.cross||[])){const dd=Math.hypot(px-q[0],pz-q[1]);if(dd<1.4)cr=Math.max(cr,1-smt01((dd-.6)/.8))}
        const f=d<=hw?1:1-smt01((d-hw)/.12),want=drop*f*(1-cr),cur=st[k];if(want>cur){TH[k]-=want-cur;st[k]=want}
        if(d<=hw){TS[k]=o.surf??S.ASPHALT;TCF[k]=0;if(cr>.5)setC(k,mix('#6a6966','#e8e4da',(Math.floor((px+pz)*2.2)%2)?.9:.1))}
        else if(cur<=want+1e-6){TS[k]=S.ROCK;setC(k,mix(o.kerbCol||'#a4a099','#b5b1a9',G.noise(px*4,pz*4)))}}
      return poly},
    // a building: a box w×h×d with its bottom at y, its front towards +z in its own frame (rotated ry): plinth, flat roof with a lip and a roof box, window bands per floor, a door, and a box collider.
    building(x,y,z,w,h,d,col,ry=0,o={}){const fh=o.fh??1.2,floors=Math.max(1,Math.round(h/fh)),cs=Math.cos(ry),sn=Math.sin(ry),at=(lx,lz)=>[x+lx*cs+lz*sn,z-lx*sn+lz*cs];
      // a stone foundation down to the ground where the ground under the footprint is lower than the floor (a terrace edge, a benched course)
      {let m=1e9;for(const lx of[-w/2,0,w/2])for(const lz of[-d/2,0,d/2]){const[px,pz]=at(lx,lz);m=Math.min(m,H(px,pz))}if(m<y-.04)c.box(x,m-.05,z,w+.06,y-m+.05,d+.06,o.found||'#7d7974',ry)}
      c.box(x,y,z,w,h,d,col,ry);c.box(x,y,z,w+.08,.1,d+.08,o.plinth||'#55534f',ry);c.box(x,y+h,z,w+.16,.12,d+.16,o.roof||'#3f3d3a',ry);
      if(o.roofBox!==false){const[rx,rz]=at(w*.2,-d*.15);c.box(rx,y+h+.12,rz,Math.min(1.2,w*.35),.5,Math.min(1.0,d*.35),o.roofBoxCol||'#6a6866',ry)}
      const win=o.win||'#1a262d',wh=Math.min(.42,fh*.38),wy0=y+fh*.45;
      for(let f=0;f<floors;f++){const wy=wy0+f*fh;if(wy+wh>y+h-.1)break;
        for(const[len,lat,ax]of[[w,d/2,'x'],[w,-d/2,'x'],[d,w/2,'z'],[d,-w/2,'z']]){const nW=Math.max(1,Math.floor((len-.5)/.75)),sp=len/nW;
          for(let i=0;i<nW;i++){const u=-len/2+sp*(i+.5);if(f===0&&ax==='x'&&lat>0&&Math.abs(u)<.5)continue;   // the door stands here
            const[wx,wz]=ax==='x'?at(u,lat*1.01):at(lat*1.01,u);c.box(wx,wy,wz,ax==='x'?.34:.03,wh,ax==='x'?.03:.34,win,ry)}}}
      {const[dx2,dz2]=at(0,d/2*1.01);c.box(dx2,y,dz2,.5,.8,.04,o.door||'#3a2a22',ry);if(o.sign){const[sx,sz]=at(0,d/2*1.02);c.box(sx,y+fh-.1,sz,Math.min(w*.7,2.2),.3,.04,o.sign,ry)}}
      const col2={x,z,w:w+.04,d:d+.04,ry,anchor:true,y:y+.5};c.colliders.push(col2);c.block(x,z,Math.hypot(w,d)/2+.5);return col2},
    // a street lamp: pole, arm and head. The head glows at night (c.fx 'lamp', see game.js). Birds may sit on top.
    // js/props/lykt.js; it is built by c.plants() (after c.finish), so it stands on the finished ground
    lamp(x,z,o={}){return c.plant('lykt',x,z,o)},
    // a traffic cone that tips over when the car hits it (cylinders only, so c.breakable works)
    cone(x,z,o={}){const y=o.y??H(x,z),ids=[c.cyl(x,y,z,.14,.03,'#2a2a2a'),c.cyl(x,y+.03,z,.075,.34,o.col||'#f26b1d'),c.cyl(x,y+.19,z,.08,.06,'#f4f4f0')];c.breakable(x,z,.13,ids);return ids},
    // a red-and-white barrier trestle across the way (also tips over). ang = direction of the bar.
    barrier(x,z,ang=0,o={}){const y=o.y??H(x,z),dx=Math.cos(ang),dz=-Math.sin(ang),ids=[];for(const sd of[-.55,.55])ids.push(c.cyl(x+dx*sd,y,z+dz*sd,.03,.55,'#8a8a88'));
      ids.push(c.cyl(x,y+.42-.65,z,.045,1.3,'#d9432f',{rz:1.57,ry:ang}),c.cyl(x,y+.22-.65,z,.045,1.3,'#f4f4f0',{rz:1.57,ry:ang}));c.breakable(x,z,.7,ids);return ids},
    // something the car can knock over (a cactus): a collider that disappears on impact, and the cylinder instances that tip over
    anchors:[],anchor:(x,z,y)=>c.anchors.push({x,z,y:y??H(x,z)+.4}),
    breakables:[],breakable(x,z,r,ids){const col={x,z,r};c.colliders.push(col);c.breakables.push({x,z,r,ids,col,broken:false})},
    nearStart:(x,z,m)=>Math.hypot(pts[0].x-x,pts[0].z-z)<m,
    block:(x,z,r)=>blocks.push({x,z,r}), free:(x,z,r)=>!blocks.some(b=>Math.hypot(b.x-x,b.z-z)<b.r+r),
    pools:[],fx:[],vents:[],extra:[],bonuses:[],
    // a golden nut hidden somewhere on the island (see README): worth 25 once
    secrets:[],secret:(x,z,label)=>c.secrets.push({x,z,label}),
    bonus:(x,z,r,nuts,msg)=>c.bonuses.push({x,z,r,nuts,msg}),
    tOf:(x,z)=>{let m=1e9,bi=0;for(let i=0;i<pts.length;i++){const dx=pts[i].x-x,dz=pts[i].z-z,d=dx*dx+dz*dz;if(d<m){m=d;bi=i}}return bi/(pts.length-1)},
    lavaNear:(x,z,m)=>lavaAt(x,z,m)>-1e8,
    crate:(x,z)=>c.extra.push({x,z}),vent:(x,z)=>c.vents.push({x,z,y:H(x,z)}),
    smoke:(x,z,y)=>c.fx.push({type:'smoke',x,z,y}),
    fall:(x,z,ang,w,top,bot,o={})=>c.fx.push({type:'fall',x,z,ang,w,top,bot,spray:!!o.spray}),
    // dig a pond into the base terrain and fill it; mud rim around it
    pond(x,z,r,dep,o={}){const i=Math.max(0,Math.min(N-1,Math.round((x+HALF)/CELL))),j=Math.max(0,Math.min(N-1,Math.round((z+HALF)/CELL)));let hc=TB[j*N+i];
      const R=r*1.25;cellsIn(x-R,z-R,x+R,z+R,(k,px,pz)=>{const d=Math.hypot(px-x,pz-z);if(d>R)return;const f=1-(d/R)**2,nh=hc-dep*f*(1-.15*G.noise(px*2,pz*2))+(TB[k]-hc)*(1-f);
        if(nh<TH[k]){TH[k]=nh;TCF[k]=0;TS[k]=d<r*1.18?(o.bed??S.MUD):S.MUD}});
      c.pools.push({x,z,r:r*1.06,level:hc-dep*(o.fill??.32),mud:!!o.mud});if(o.bog)paint(x,z,r*.9,S.BOG)},
    // two wheel ruts pressed into the trail between t0 and t1 (looks like a used jungle track)
    ruts(t0,t1,depth=.05){const i0=Math.round(t0*(pts.length-1)),i1=Math.round(t1*(pts.length-1));
      for(let i=i0;i<i1;i+=2){const p=pts[i],q=pts[Math.min(pts.length-1,i+2)];let tx=q.x-p.x,tz=q.z-p.z;const L=Math.hypot(tx,tz)||1;tx/=L;tz/=L;
        cellsIn(p.x-.7,p.z-.7,p.x+.7,p.z+.7,(k,px,pz)=>{const b=Math.abs((px-p.x)*tz-(pz-p.z)*tx),a=Math.abs((px-p.x)*tx+(pz-p.z)*tz);if(a>L*.6)return;const d=Math.abs(b-.4);if(d>.14)return;
          const w=1-(d/.14)**2;TH[k]-=depth*w*(.8+.4*G.noise(px*3,pz*3))})}},
    steam:(x,z,y,s=.45)=>c.fx.push({type:'smoke',x,z,y:y??H(x,z),small:s}),
    // a plant, tree, lamp or animal from PROPS (js/props/, data/vegetasjon.js, data/dyr.js): c.plant('jungel_kapok',x,z,{s:1.2}).
    // Colliders now, drawn by c.plants() once the ground is final (after c.finish; genLevel calls it after build). See js/props.js.
    plantList:[],plant:(name,x,z,o)=>plantProp(c,name,x,z,o),plants:()=>buildProps(c),
    // c.sow('subtrop_agave',12,[x,z],radius,{r,gap,ok,p}): scatter props on free spots (see js/props.js). plantOK(x,z,r): is the spot free?
    sow:(name,n,at,rad,o)=>sowProps(c,name,n,at,rad,o),plantOK:(x,z,r=.5)=>propSpotOK(c,x,z,r),
    // a jungle tree (js/props/tre-jungel.js). Returns the tree (perches for animals are collected in c.perches)
    trees:[],perches:[],
    tree(x,z,o={}){const t=plantProp(c,'jungeltre',x,z,o,rng);c.trees.push(t);return t},
    // build meshes for all trees (and other plants) placed so far
    forest(){c.plants()},
    // dirt ramp with a drop at the end: a jump in high gear
    ramp(t,h=.55,len=3.2,wid=2.6){const p=c.P(t),an=c.ang(t);c.block(p.x,p.z,3);
      shape(p.x,p.z,an,len,wid,(a,b)=>{const u=(a+len/2)/len;if(u<.08)return u/.08*.02;if(u<.88)return .02+(u-.08)/.8*h;return null},S.DIRT,(a,b)=>mix('#6d4b2d','#8d6a44',G.noise(a*3,b*3)*.7+(Math.abs(b)>wid/2-.18?.5:0)))},
    // level the ground along the path between t0 and t1 so the car does not drive on a steep side slope
    bench(t0,t1,hw=1.5,blend=1.8){const i0=Math.round(t0*(pts.length-1)),i1=Math.round(t1*(pts.length-1));benchPts(pts.slice(i0,i1+1),hw,blend)},
    // the same along any polyline [[x,z],...] (for example a shortcut)
    benchLine(poly,hw=1.3,blend=1.6){const d=[];for(let i=0;i<poly.length-1;i++){const a=poly[i],b=poly[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),m=Math.max(1,Math.ceil(L/.33));for(let k=0;k<m;k++){const u=k/m;d.push({x:a[0]+(b[0]-a[0])*u,z:a[1]+(b[1]-a[1])*u})}}d.push({x:poly[poly.length-1][0],z:poly[poly.length-1][1]});benchPts(d,hw,blend)},
    // a lava river along a polyline (from the source outwards). hwFn(x,z) = half width. The surface follows the terrain downhill.
    lava(poly,hwFn,o={}){const d=[];for(let i=0;i<poly.length-1;i++){const a=poly[i],b=poly[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),m=Math.max(1,Math.ceil(L/.5));for(let k=0;k<m;k++){const u=k/m;d.push([a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u])}}
      d.push(poly[poly.length-1]);let lv=1e9;const s=d.map(p=>{const y=Math.min(lv,Hterr(p[0],p[1])-(o.drop??.55));lv=y;return{x:p[0],z:p[1],y,hw:hwFn(p[0],p[1])}});
      for(let pass=0;pass<2;pass++)for(let i=0;i<s.length;i++){let a=0,m=0;for(let k=-3;k<=3;k++){const j=i+k;if(j>=0&&j<s.length){a+=s[j].y;m++}}s[i].ny=a/m}
      s.forEach(p=>p.y=p.ny);carveLava(s);G.lavas.push({s});c.fx.push({type:'lava',s});return s},
    lavaPool(x,z,r,level){const s=[{x,z,y:level,hw:r}];carveLava(s);G.lavas.push({s});c.fx.push({type:'lavadisc',x,z,r,y:level})},
    // a suspension bridge from A to B (hw = half width). Both ends must lie on solid ground.
    bridge(ax,az,bx,bz,hw,o={}){const len=Math.hypot(bx-ax,bz-az),ux=(bx-ax)/len,uz=(bz-az)/len,y0=o.y0??H(ax,az),y1=o.y1??H(bx,bz),px=-uz*hw,pz=ux*hw,xs=[ax+px,ax-px,bx+px,bx-px],zs=[az+pz,az-pz,bz+pz,bz-pz];
      const dk={ax,az,bx,bz,ux,uz,len,hw,y0,y1,sag:o.sag??.22,x0:Math.min(...xs)-.02,x1:Math.max(...xs)+.02,z0:Math.min(...zs)-.02,z1:Math.max(...zs)+.02};
      if(o.pier)dk.pier=true;if(o.ferry)dk.ferry=true;G.decks.push(dk);c.fx.push(Object.assign({type:'deck'},dk));c.block((ax+bx)/2,(az+bz)/2,len/2+1);return dk},
    // a village with a ferry quay: houses on a flat pad by the shore, a plank pier out over the water and the ferry's deck at its end.
    // o.at=[x,z] on the beach; o.dir (degrees) points out to sea, default straight away from the island's centre.
    village(o){const vx=o.at[0],vz=o.at[1],a=(o.dir??Math.atan2(vz,vx)/Math.PI*180)*Math.PI/180,dx=Math.cos(a),dz=Math.sin(a),px=-dz,pz=dx,w=def.water??0;
      const padH=w+.9;c.flat(vx,vz,6.2,padH,7);c.block(vx,vz,7.5);for(let k=-6;k<=6;k+=2)for(let m=-6;m<=6;m+=2)if(Math.hypot(k,m)<6.5)c.xpts.push({x:vx+k,z:vz+m});
      paint(vx,vz,5.4,S.GRAVEL);
      const at=(f,s)=>[vx+dx*f+px*s,vz+dz*f+pz*s];
      // houses around the square, facing it
      const cols=o.desert?['#efe6d2','#e2d2b0','#f4efe4','#d9c49a','#e8dcc4','#cdb48a']:['#c8463a','#e5a92b','#4f7bb5','#e9dcb9','#5e8a4a','#b06a3a'],roofs=o.snow?['#eef2f6','#e4eaef','#f4f6f8']:['#4a3a32','#2f2a28','#5a3a2a'];   // o.snow: snow on the roofs
      const house=(f,s,ry,i,big)=>{const [hx,hz]=at(f,s);house2(hx,hz,ry,i,big)};
      const yaw=Math.atan2(dx,dz);           // facing the sea
      // a house: walls, two roof slabs (ridge along the house), chimney, door, windows
      const house2=(hx,hz,ry,i,big)=>{const W=big?2.4:1.7,D=big?1.9:1.4,Hh=big?1.2:1.0,col=cols[i%cols.length],rc=roofs[i%roofs.length];
        if(o.desert)return deserthouse(hx,hz,ry,i,big,W,D,Hh,col);
        c.box(hx,padH,hz,W,Hh,D,col,ry);c.box(hx,padH,hz,W+.1,.08,D+.1,'#3a3a3a',ry);
        // the roof slabs sit on the wall tops (before, the wall corners poked through), and the attic is a prism that closes the gables
        for(const sd of[-1,1]){const o2=sd*W*.25;c.box(hx+Math.cos(ry)*o2,padH+Hh+.05+W*.179-.035,hz-Math.sin(ry)*o2,W*.64,.07,D+.3,rc,ry,{rz:-sd*.62})}
        {const hr=W*.358;c.prisms.push({x:hx,y:padH+Hh+hr/3,z:hz,sx:W/1.732,sy:D,sz:hr/1.5,rx:-Math.PI/2,ry,ord:'YXZ',c:col})}
        c.box(hx+Math.cos(ry)*W*.3,padH+Hh+.2,hz-Math.sin(ry)*W*.3,.22,.55,.22,'#6b5a52',ry);c.box(hx+Math.sin(ry)*D/2,padH,hz+Math.cos(ry)*D/2,.42,.72,.04,'#3a2a22',ry);
        for(const sx2 of[-.45,.45])c.box(hx+Math.sin(ry)*D/2+Math.cos(ry)*sx2*W,padH+.45,hz+Math.cos(ry)*D/2-Math.sin(ry)*sx2*W,.32,.3,.03,'#1a262d',ry);c.colliders.push({x:hx,z:hz,r:Math.max(W,D)*.62,anchor:true,y:padH+.4})};
      // o.desert: whitewashed houses with flat roofs and a low wall round the roof, blue doors and shutters; the big one has a dome
      const deserthouse=(hx,hz,ry,i,big,W,D,Hh,col)=>{const cs=Math.cos(ry),sn=Math.sin(ry),at2=(lx,lz)=>[hx+lx*cs+lz*sn,hz-lx*sn+lz*cs],blue=['#2f6fb0','#3a8ac0','#2a5a8a'][i%3];
        c.box(hx,padH,hz,W,Hh,D,col,ry);c.box(hx,padH,hz,W+.08,.1,D+.08,'#b8a07a',ry);c.box(hx,padH+Hh,hz,W+.06,.06,D+.06,col,ry);
        for(const[lx,lz,w2,d2]of[[0,D/2,W+.06,.08],[0,-D/2,W+.06,.08],[W/2,0,.08,D],[-W/2,0,.08,D]]){const[qx2,qz2]=at2(lx,lz);c.box(qx2,padH+Hh+.06,qz2,w2,.14,d2,col,ry)}   // the low wall round the roof
        {const[dx2,dz2]=at2(0,D/2+.01);c.box(dx2,padH,dz2,.42,.74,.04,blue,ry)}
        for(const sx2 of[-.45,.45]){const[wx,wz]=at2(sx2*W,D/2+.01);c.box(wx,padH+.45,wz,.3,.3,.03,'#1a262d',ry);const[sx3,sz3]=at2(sx2*W-Math.sign(sx2)*.2,D/2+.006);c.box(sx3,padH+.43,sz3,.08,.34,.02,blue,ry)}
        if(big){for(let k=0;k<4;k++)c.cyl(hx,padH+Hh+.1+k*.13,hz,.62-k*k*.045,.14,k<3?'#f4efe4':'#e5a92b');c.cyl(hx,padH+Hh+.62,hz,.04,.3,'#e5a92b')}   // the dome with a golden tip
        else{const[px2,pz2]=at2(W*.28,-D*.2);c.box(px2,padH+Hh+.06,pz2,.36,.3,.36,col,ry)}   // a little room on the roof
        c.colliders.push({x:hx,z:hz,r:Math.max(W,D)*.62,anchor:true,y:padH+.4})};
      // the four small houses flank the street out of the village (o.out), the big ferry office stands by the pier
      const oa=(o.out??(a/Math.PI*180+180))*Math.PI/180,ox=Math.cos(oa),oz=Math.sin(oa),qx=-oz,qz=ox,yawO=Math.atan2(-ox,-oz);
      const houseO=(f,s,ry,i)=>house2(vx+ox*f+qx*s,vz+oz*f+qz*s,ry,i);
      houseO(2.6,-4.9,yawO+.35,0);houseO(3.4,-2.8,yawO,1);houseO(3.4,2.8,yawO,2);houseO(2.6,4.9,yawO-.35,3);house(1.3,4.2,yaw-1.5,4,true);
      // lamps, barrels, nets and a sign
      for(const[f,s]of[[1,-3.4],[4.6,2.6],[-.6,-2.3]]){const[lx,lz]=at(f,s);c.plant('lykt',lx,lz,{y:padH,h:1.45,arm:0,hode:.85})}
      for(const[f,s,col]of[[.6,-4.6,'#5a7a8a'],[.9,-4.3,'#c8463a'],[-4.8,-3.6,'#8a6a3a']]){const[bx2,bz2]=at(f,s);c.cyl(bx2,padH,bz2,.17,.42,col);c.colliders.push({x:bx2,z:bz2,r:.2})}
      {const[sx,sz]=at(3.6,2.3);c.fx.push({type:'sign',x:sx,z:sz,ang:Math.atan2(-dx,-dz),text:'FERGE',sub:'kjør om bord'})}
      // the way out of the village: a gravel road from the square inland, levelled so the car never gets boxed in
      c.road([[vx+ox*1.5,vz+oz*1.5],[vx+ox*8,vz+oz*8],[vx+ox*16,vz+oz*16]],{hw:1.5,blend:2.4,surf:S.GRAVEL});c.flat(vx,vz,6.2,padH,7);
      // the pier: a flat plank deck from the pad out over the water, on piles
      const A=at(5.6,0),B=at(11.4,0);c.bridge(A[0],A[1],B[0],B[1],1.4,{sag:0,y0:padH+.02,y1:padH+.02,pier:true});
      for(let f=6.4;f<11.4;f+=1.6)for(const sd of[-1.25,1.25]){const[qx,qz]=at(f,sd);const bottom=Math.min(Hterr(qx,qz),w-.2);c.cyl(qx,bottom,qz,.09,padH-bottom+.1,'#4a3a2a')}
      // two rowing boats moored beside the pier
      for(const[f,s,col]of[[8.2,2.6,'#c8463a'],[9.9,-2.7,'#4f7bb5']]){const[qx,qz]=at(f,s);c.box(qx,w-.08,qz,1.5,.34,.6,col,yaw+.2);c.box(qx,w+.23,qz,1.1,.04,.4,'#8a6a3a',yaw+.2)}
      // the ferry's car deck: drivable, flush with the pier. The hull itself is drawn by the game so it can sail.
      const F0=at(11.2,0),F1=at(18.0,0);const fd=c.bridge(F0[0],F0[1],F1[0],F1[1],1.55,{sag:0,y0:padH+.03,y1:padH+.03,pier:true,ferry:true});
      const fc=at(14.6,0);c.ferry={x:fc[0],z:fc[1],dir:a,dx,dz,y:padH+.04,len:6.8,hw:1.55,quay:{x:A[0],z:A[1]},pad:{x:vx,z:vz,h:padH},deck:fd};
      c.village_=o;return c.ferry},
    // a marina where you can borrow a motorboat (see README: «Marinaen og båtløpet»): a pad by the shore with a boathouse, a fuel pump,
    // a plank pier on piles and boats moored beside it. Park on the blue square to be asked. o.at=[x,z] on the beach; o.dir (degrees) points
    // out to sea (default: away from the island's centre), o.out is the way inland. The rental boat, life rings and flag are drawn by js/boat.js.
    marina(o){const vx=o.at[0],vz=o.at[1],a=(o.dir??Math.atan2(vz,vx)/Math.PI*180)*Math.PI/180,dx=Math.cos(a),dz=Math.sin(a),px=-dz,pz=dx,w=def.water??0,yaw=Math.atan2(dx,dz);
      const padH=w+.9,at=(f,s)=>[vx+dx*f+px*s,vz+dz*f+pz*s];c.flat(vx,vz,4.8,padH,3);c.block(vx,vz,6.5);for(let k=-5;k<=5;k+=2)for(let m=-5;m<=5;m+=2)if(Math.hypot(k,m)<5.5)c.xpts.push({x:vx+k,z:vz+m});
      paint(vx,vz,4.6,S.GRAVEL);
      // the way inland, levelled like the village road. The pad is steep towards the sea (blend 3), so the water is deep a few steps out.
      const oa=(o.out??(a/Math.PI*180+180))*Math.PI/180,ox=Math.cos(oa),oz=Math.sin(oa);
      c.road([[vx+ox*1.5,vz+oz*1.5],[vx+ox*7,vz+oz*7],[vx+ox*13,vz+oz*13]],{hw:1.4,blend:2.2,surf:S.GRAVEL});c.flat(vx,vz,4.8,padH,3);
      // the pier: a straight plank deck on piles, with a stop at the end so the car does not drive into the sea
      const S0=-1.2,A=at(4.4,S0),B=at(12.4,S0);c.bridge(A[0],A[1],B[0],B[1],1.0,{sag:0,y0:padH+.02,y1:padH+.02,pier:true});
      for(let f=5.2;f<12.4;f+=1.6)for(const sd of[-.85,.85]){const[qx,qz]=at(f,S0+sd);const bottom=Math.min(Hterr(qx,qz),w-.2);c.cyl(qx,bottom,qz,.08,padH-bottom+.1,'#4a3a2a')}
      {const[ex,ez]=at(12.25,S0);c.box(ex,padH,ez,2.0,.3,.16,'#d9432f',yaw);c.colliders.push({x:ex,z:ez,w:2.1,d:.3,ry:yaw})}
      for(const f of[6.0,9.2])for(const sd of[-.92,.92]){const[qx,qz]=at(f,S0+sd);c.cyl(qx,padH,qz,.06,.16,'#1d1c1a')}   // bollards
      // the boathouse: red walls, a dark roof, big doors towards the water and the sign over them on the land side
      {const[hx,hz]=at(1.0,3.2),W=2.5,D=2.8,Hh=1.25;c.box(hx,padH,hz,W,Hh,D,'#b5432f',yaw);c.box(hx,padH,hz,W+.1,.08,D+.1,'#3a3a3a',yaw);
        for(const sd of[-1,1]){const o2=sd*W*.25;c.box(hx+Math.cos(yaw)*o2,padH+Hh+.24,hz-Math.sin(yaw)*o2,W*.66,.08,D+.3,'#2f2a28',yaw,{rz:-sd*.62})}
        c.box(hx+Math.sin(yaw)*D/2,padH,hz+Math.cos(yaw)*D/2,W*.7,Hh*.86,.05,'#5a3a22',yaw);c.box(hx+Math.sin(yaw)*D/2,padH+Hh*.86,hz+Math.cos(yaw)*D/2,W*.8,.08,.07,'#f2e8d0',yaw);
        for(const sd of[-1,1])c.box(hx+Math.cos(yaw)*sd*W/2,padH+.5,hz-Math.sin(yaw)*sd*W/2,.03,.32,.5,'#1a262d',yaw);
        c.colliders.push({x:hx,z:hz,w:W+.04,d:D+.04,ry:yaw,anchor:true,y:padH+.5})}
      {const[sx,sz]=at(-1.0,3.2);c.fx.push({type:'sign',x:sx,z:sz,ang:Math.atan2(-dx,-dz),text:'CAPTAIN THEIS',sub:'båtutleie · motorbåtløp',w:1.9})}
      // the fuel pump at the root of the pier, lamps, barrels
      {const[fx,fz]=at(3.5,.7);c.box(fx,padH,fz,.34,.62,.26,'#d9432f',yaw);c.box(fx,padH+.62,fz,.3,.12,.22,'#1d1c1a',yaw);c.box(fx+Math.sin(yaw)*.14,padH+.34,fz+Math.cos(yaw)*.14,.18,.14,.03,'#f2e8d0',yaw);c.colliders.push({x:fx,z:fz,r:.24})}
      for(const[f,s]of[[3.8,-2.5],[-2.6,-.4]]){const[lx,lz]=at(f,s);c.cyl(lx,padH,lz,.05,1.5,'#3a3a3a');c.box(lx,padH+1.45,lz,.22,.16,.22,'#fff0c0');c.colliders.push({x:lx,z:lz,r:.1,anchor:true,y:padH+.6})}
      for(const[f,s,col]of[[-1.7,4.1,'#5a7a8a'],[-2.1,3.7,'#e5a92b']]){const[bx2,bz2]=at(f,s);c.cyl(bx2,padH,bz2,.17,.42,col);c.colliders.push({x:bx2,z:bz2,r:.2})}
      // boats moored on the far side of the pier
      for(const[f,col]of[[8.4,'#e9dcb9'],[10.7,'#4f7bb5']]){const[qx,qz]=at(f,S0+1.85);c.box(qx,w-.1,qz,.66,.36,1.8,col,yaw);c.box(qx,w+.26,qz,.6,.04,1.5,'#f2e8d0',yaw);c.box(qx+Math.sin(yaw)*.1,w+.3,qz+Math.cos(yaw)*.1,.34,.22,.24,'#1a262d',yaw)}
      // the blue square: park here and you are asked whether you want to take the boat out
      const Q=at(1.8,-3.0);c.box(Q[0],padH+.004,Q[1],1.9,.012,1.6,'#2f6fd6',yaw);
      {const[sx,sz]=at(.4,-4.6);c.fx.push({type:'sign',x:sx,z:sz,ang:Math.atan2(-dx,-dz),text:'MARINA',sub:'kjør inn på den blå ruta'})}
      // posts for the life rings and the flag (their colliders here, the rings and the flag in js/boat.js)
      const post=(f,s,ry)=>{const[rx,rz]=at(f,s);c.colliders.push({x:rx,z:rz,r:.08});return{x:rx,z:rz,y:padH+.02,ry}};
      c.marinaDef={x:vx,z:vz,dir:a,dx,dz,yaw,padH,water:w,ask:{x:Q[0],z:Q[1]},boat:(([bx,bz])=>({x:bx,z:bz}))(at(8.0,-3.4)),flag:post(-2.4,-2.8,yaw),
        rings:[post(7.6,S0-.95,yaw+Math.PI/2),post(11.0,S0+.95,yaw-Math.PI/2),post(2.9,1.9,yaw)]};
      return c.marinaDef},
    // ---- winter pieces (see README: «Gautefall: vinterøya og skianlegget») ----
    // a spruce with snow on its branches (js/props/gran.js). c.spruces() builds them all (after c.finish).
    spruceList:[],
    spruce(x,z,o={}){const t=plantProp(c,'gran',x,z,o,rng);c.spruceList.push(t);return t},
    spruces(){c.plants();c.spruceList=[]},
    // a ski piste: its own line from the start up the mountain (t=0) to the finish (t=1), levelled across like a groomed slope, marked in TG
    // (the skier glides better there) and kept clear of trees. The corduroy itself is drawn on top by the game (js/skiresort.js).
    // p={id,name,desc,diff,kind:'fri'|'slalom'|'utfor'|'hopp',path,gates:[[x,z],...] (the last one is the finish),hw,blend,tilt,berm,gw (half width
    // of a gate),ice:[[t0,t1],...],nets}. tilt: how much of the mountainside the piste keeps across (0 = dead level, default .22).
    // berm: the low bank of snow the groomer leaves along both edges (default .07). Jumps: c.kicker after this, bumps: c.moguls.
    pistes:[],
    piste(p){const k=makeLine(p.path),hw=p.hw??2.2;Object.assign(k,{id:p.id,name:p.name,desc:p.desc,diff:p.diff||1,kind:p.kind||'fri',def:p,hw,kickers:[],moguls:[],nets:[],ice:p.ice||[]});k.len=k.pts.reduce((s,q,i,P)=>i?s+Math.hypot(q.x-P[i-1].x,q.z-P[i-1].z):0,0);
      const R=hw+1.4,near=new Map(),n=k.pts.length,berm=p.berm??.07;   // the nearest point of the line and the side of it, for every cell under the piste
      for(let i=0;i<n;i++){const q=k.pts[i];cellsIn(q.x-R,q.z-R,q.x+R,q.z+R,(kk,px,pz)=>{const d=Math.hypot(px-q.x,pz-q.z);if(d>R)return;const b=near.get(kk);if(!b||d<b[0])near.set(kk,[d,i,px,pz])})}
      benchPts(k.pts,hw,p.blend??2.4,p.tilt??.22);
      // the levelling gives every cell the height of the nearest point of the line, which leaves steps where the line bends back on itself
      // (hairpins, slalom swings). A few passes of blur over the piste turn them into gentle slopes, like a groomed surface.
      {const cells=[];for(const[kk,v]of near)if(v[0]<=hw+.8)cells.push(kk);const tmp=new Float32Array(cells.length);
        for(let pass=0;pass<6;pass++){cells.forEach((kk,m)=>{const i=kk%N,j=(kk/N)|0;let a=0,c2=0;for(let dj=-2;dj<=2;dj++)for(let di=-2;di<=2;di++){const ii=i+di,jj=j+dj;if(ii<0||jj<0||ii>=N||jj>=N)continue;a+=TH[jj*N+ii];c2++}tmp[m]=a/c2});cells.forEach((kk,m)=>{TH[kk]=tmp[m]})}}
      const gw=p.gw??(k.kind==='slalom'?.75:Math.min(1.9,hw-.3));
      k.gates=(p.gates||[]).map((q,i,L)=>{const t=k.tOf(q[0],q[1]),tn=k.T(t),s=k.side(t),fin=i===L.length-1,w=fin?hw-.15:gw;
        return{t,c:{x:q[0],z:q[1]},tan:tn,side:s,a:{x:q[0]+s.x*w,z:q[1]+s.z*w},b:{x:q[0]-s.x*w,z:q[1]-s.z*w},w,finish:fin,col:k.kind==='slalom'?(i%2?'#2f6fd6':'#d9432f'):'#e5a92b'}});
      k.start={p:k.P(0),tan:k.T(.004)};
      for(let i=0;i<k.pts.length;i+=2)c.xpts.push(k.pts[i]);
      // grooming: snow (or ice) on the piste, a soft bank of snow along the edges
      const icy=t=>k.ice.some(r=>t>=r[0]&&t<=r[1]);
      for(const[kk,[d,i,px,pz]]of near){const nz=G.noise(px*2.3,pz*2.3);
        if(d<=hw){TG[kk]=1;if(icy(i/(n-1))){TS[kk]=S.ICE;setC(kk,mix('#b4cddb','#d4e4ee',nz*.8))}else{TS[kk]=S.SNOW;setC(kk,mix('#e8eef3','#f7fafc',nz*.6))}}
        else{if(TS[kk]===S.ROCK||TS[kk]===S.GRAVEL)TS[kk]=S.SNOW;if(TS[kk]===S.SNOW||TS[kk]===S.ICE)setC(kk,mix('#dde5ec','#f1f5f8',nz));   // the snow bank along the edge, never bare rock
          const u=(d-hw)/.9;if(u<1)TH[kk]+=berm*Math.sin(Math.PI*u)*(.8+.4*nz)}}
      // keep the trees away from the finish area: spectators on one side, the timing board on the other (see dressPistes)
      const fg=k.gates[k.gates.length-1];if(fg)for(const sd of[-1,1])c.block(fg.c.x+fg.side.x*sd*(hw+2.2),fg.c.z+fg.side.z*sd*(hw+2.2),2.6);
      c.pistes.push(k);return k},
    // a jump on a piste: a snow ramp up to the lip at t (painted blue), then a dug-out steep landing so the skier comes down softly,
    // and a flatter run-out. o={h:lip height,len:ramp length,land:landing length,drop:how deep the landing is dug,w:half width}
    kicker(k,t,o={}){const h=o.h??.6,len=o.len??2.4,land=o.land??6,drop=o.drop??.8,w=o.w??Math.min(1.6,k.hw-.4),p=k.P(t),tn=k.T(t),R=Math.hypot(len+land,w+1.2)+.5;
      cellsIn(p.x-R,p.z-R,p.x+R,p.z+R,(kk,px,pz)=>{const rx=px-p.x,rz=pz-p.z,a=rx*tn.x+rz*tn.z,b=Math.abs(rx*tn.z-rz*tn.x);if(a<-len||a>land||b>w+1.2)return;
        const lat=b<=w?1:1-smt01((b-w)/1.2);let d;
        if(a<=0){const u=(a+len)/len;d=h*Math.pow(u,1.7);if(b<=w+.2)setC(kk,a>-.24?mix('#5a9fd8','#7fb8e6',G.noise(px*4,pz*4)):mix('#e2eaf1','#f1f5f8',G.noise(px*3,pz*3)))}
        else{const u=a/land;d=-drop*(u<.35?smt01(u/.35):1-smt01((u-.35)/.65))}
        TH[kk]+=d*lat});
      const kc={t,x:p.x,z:p.z,tx:tn.x,tz:tn.z,h,len,land,w};k.kickers.push(kc);c.block(p.x,p.z,len+land);return kc},
    // moguls on piste k between t0 and t1: bumps in staggered rows, like the ones skiers carve out of a steep slope in the afternoon.
    // o={h:height,sp:distance between the rows,sl:distance across}. They fade in and out at both ends and towards the edges.
    moguls(k,t0,t1,o={}){const h=o.h??.1,sp=o.sp??1.25,sl=o.sl??1.05,n=k.pts.length,i0=Math.round(t0*(n-1)),i1=Math.round(t1*(n-1)),hw=k.hw-.1,near=new Map(),fade=Math.max(1,(i1-i0)*.18);
      for(let i=i0;i<=i1;i++){const q=k.pts[i];cellsIn(q.x-hw,q.z-hw,q.x+hw,q.z+hw,(kk,px,pz)=>{const d=Math.hypot(px-q.x,pz-q.z);if(d>hw)return;const b=near.get(kk);if(!b||d<b[0])near.set(kk,[d,i,px,pz])})}
      for(const[kk,[d,i,px,pz]]of near){const q=k.pts[i],q2=k.pts[Math.min(n-1,i+1)],q1=k.pts[Math.max(0,i-1)];let tx=q2.x-q1.x,tz=q2.z-q1.z;const tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;
        const lat=(px-q.x)*tz-(pz-q.z)*tx,u=i/(n-1)*k.len/sp,row=Math.floor(u),v=(lat+(row%2)*sl/2)/sl;
        const b=(.5-.5*Math.cos(2*Math.PI*u))*(.5-.5*Math.cos(2*Math.PI*v)),f=smt01((hw-d)/.6)*smt01((i-i0)/fade)*smt01((i1-i)/fade);
        TH[kk]+=h*b*f*(.8+.4*G.noise(px*1.7,pz*1.7));if(f>.3)setC(kk,mix('#d3dde6','#f4f7fa',b*.8+.2*G.noise(px*5,pz*5)))}
      k.moguls.push({t0,t1});return k},
    // piste poles along both edges, a start hut and a sign in the colour of the piste at every start, safety nets on the outside of the bends
    // (p.nets) and a finish area beside every finish: a fence, spots for the spectators and a timing board (drawn by js/skiresort.js).
    // Steep banks the levelling cut into the mountain show rock through the snow. Called by genLevel after build if the level did not.
    dressPistes(){c._pisteDressed=true;const PC=['#3fae3a','#3fae3a','#2f6fd6','#d9432f','#1d1c1a'];
      const L0=c.liftDef,exit=L0?{x:L0.bx+L0.ux*1.6,z:L0.bz+L0.uz*1.6}:null;   // where the skier steps off the chairlift
      const free=(x,z,r)=>!c.colliders.some(q=>Math.hypot(q.x-x,q.z-z)<(q.r??Math.hypot(q.w,q.d)/2)+r)&&!c.pistes.some(k2=>k2.dist(x,z)<k2.hw+.5)&&!(exit&&Math.hypot(exit.x-x,exit.z-z)<r+1.4)
        &&!c.pistes.some(k2=>{const p=k2.start.p,t=k2.start.tan,rx=x-p.x,rz=z-p.z,a=rx*t.x+rz*t.z,l=Math.abs(rx*t.z-rz*t.x);return a>-4.2&&a<7&&l<(a<0?2:k2.hw+2.4)+r});   // nor round the camera or in the view down any piste from its start
      for(const k of c.pistes){const col=PC[k.def.color??k.diff],L=k.len;
        for(let d=2.5;d<L-2.5;d+=3.2){const t=d/L,p=k.P(t),s=k.side(t);for(const sd of[-1,1]){const x=p.x+s.x*sd*(k.hw+.4),z=p.z+s.z*sd*(k.hw+.4),y=H(x,z);if(k.kickers.some(q=>Math.hypot(q.x-x,q.z-z)<1.5))continue;c.cyl(x,y-.05,z,.026,.8,col);c.cyl(x,y+.62,z,.03,.1,'#f2c230')}}
        // the start hut stands behind the start line, off to the side where there is room, so the skier looks down the piste past it
        const s0=k.start.p,tn=k.start.tan,s1=k.side(0),ry=Math.atan2(tn.x,tn.z);let sd=0,lat=0,back=0;   // no hut at all if the top is too crowded for one out of the way
        found:for(const[l,b]of[[1.5,2.6],[1.3,1.8],[.9,3.6],[2.2,2.2],[1.1,1.1],[2.6,.8]])for(const t of[1,-1]){const x=s0.x+s1.x*t*(k.hw+l)-tn.x*b,z=s0.z+s1.z*t*(k.hw+l)-tn.z*b;if(free(x,z,.8)){sd=t;lat=k.hw+l;back=b;break found}}
        if(sd){const hx=s0.x+s1.x*sd*lat-tn.x*back,hz=s0.z+s1.z*sd*lat-tn.z*back,hc=Math.cos(ry),hs=Math.sin(ry);
          let lo=1e9,hi=-1e9;for(const lx of[-.5,0,.5])for(const lz of[-.43,0,.43]){const g=H(hx+lx*hc+lz*hs,hz-lx*hs+lz*hc);lo=Math.min(lo,g);hi=Math.max(hi,g)}const hy=(lo+hi)/2+.15;   // dug into the slope on the uphill side, a foundation on the downhill side
          if(hy-.15-lo>.03)c.box(hx,lo-.08,hz,1.04,hy-.15-lo+.1,.89,'#6a6662',ry);
          c.box(hx,hy-.15,hz,1.0,1.05,.85,'#b0533a',ry);c.box(hx,hy+.9,hz,1.2,.12,1.05,'#eef2f6',ry);c.box(hx-s1.x*sd*.51,hy+.3,hz-s1.z*sd*.51,.03,.32,.4,'#1a262d',ry);c.colliders.push({x:hx,z:hz,w:1.04,d:.9,ry,anchor:true,y:hy+.5})}else sd=1;
        // the piste's colour on a sign beside the start gate
        {const gx=s0.x-s1.x*sd*(k.hw+.3)+tn.x*.15,gz=s0.z-s1.z*sd*(k.hw+.3)+tn.z*.15,gy=H(gx,gz);c.cyl(gx,gy-.05,gz,.022,1.2,'#5a6066');c.box(gx,gy+.82,gz,.4,.4,.05,col,ry);c.box(gx,gy+.79,gz,.46,.46,.03,'#f4f4f0',ry);c.colliders.push({x:gx,z:gz,r:.05})}
        // safety nets on the outside of the bends: where the line turns more than a little, out at hw+.8
        if(k.def.nets){const step=.5/L,mark=[];for(let t=.05;t<.95;t+=step){const a=k.T(t),b=k.T(Math.min(1,t+step*3)),cr=a.x*b.z-a.z*b.x;mark.push({t,out:Math.abs(cr)>.045?Math.sign(cr):0})}
          for(let i=0;i<mark.length;i++){if(!mark[i].out)continue;let j=i;while(j+1<mark.length&&mark[j+1].out===mark[i].out)j++;const out=mark[i].out,ta=Math.max(.04,mark[i].t-3*step),tb=Math.min(.94,mark[j].t+3*step),pts=[];
            for(let t=ta;t<=tb+1e-6;t+=step){const p=k.P(t),s=k.side(t),x=p.x+s.x*out*(k.hw+.8),z=p.z+s.z*out*(k.hw+.8);pts.push({x,y:H(x,z),z})}
            for(let m=0;m<pts.length;m++)if(m%2===0)c.colliders.push({x:pts[m].x,z:pts[m].z,r:.08,net:true});k.nets.push(pts);i=j}}
        // the finish area: a fence along the run-out with spectators behind it on the roomier side, the timing board on the other
        const fg=k.gates[k.gates.length-1];if(!fg)continue;const fs=fg.side,ft=fg.tan,at=(a,l)=>({x:fg.c.x+ft.x*a+fs.x*l,z:fg.c.z+ft.z*a+fs.z*l});
        let cs=1,room=-1;for(const t of[1,-1]){let r=0;for(let a=-1.5;a<=2.5;a+=1){const q=at(a,t*(k.hw+1.8));if(free(q.x,q.z,.4))r++}if(r>room){room=r;cs=t}}
        const fence=[];for(let a=-2.5;a<=3.01;a+=.5){const q=at(a,cs*(k.hw+.75));fence.push({x:q.x,y:H(q.x,q.z),z:q.z})}
        for(let m=0;m<fence.length;m++){const q=fence[m];c.cyl(q.x,q.y-.05,q.z,.018,.45,'#9aa0a6');if(m%2===0)c.colliders.push({x:q.x,z:q.z,r:.06});const q2=fence[m+1];
          if(q2){const dx=q2.x-q.x,dz=q2.z-q.z;c.box((q.x+q2.x)/2,Math.min(q.y,q2.y)+.06,(q.z+q2.z)/2,.015,.3,Math.hypot(dx,dz),'#e8641e',Math.atan2(dx,dz))}}
        const crowd=[];for(let i=0;i<40&&crowd.length<11;i++){const a=-2+c.rng()*5,l=cs*(k.hw+1.05+c.rng()*1.4),q=at(a,l),y=H(q.x,q.z);
          if(crowd.some(o=>Math.hypot(o.x-q.x,o.z-q.z)<.32)||!free(q.x,q.z,.15)||Math.abs(H(q.x+.2,q.z)-H(q.x-.2,q.z))>.25)continue;crowd.push({x:q.x,y,z:q.z,face:Math.atan2(-fs.x*cs,-fs.z*cs)})}
        for(const o of crowd)c.colliders.push({x:o.x,z:o.z,r:.12});
        let bq=at(1.4,-cs*(k.hw+1.4));if(!free(bq.x,bq.z,.6))bq=at(-2.4,cs*(k.hw+2.6));
        const by=H(bq.x,bq.z);for(const s of[-.7,.7]){const px=bq.x+fs.x*s,pz=bq.z+fs.z*s;c.cyl(px,H(px,pz)-.05,pz,.04,1.75,'#3a3f44');c.colliders.push({x:px,z:pz,r:.07})}
        k.finishArea={crowd,fence,board:{x:bq.x,y:by,z:bq.z,ry:Math.atan2(-ft.x,-ft.z)}}}
      // steep banks beside the pistes: wind-blown rock shows through the snow
      const seen=new Set();for(const k of c.pistes){const R=k.hw+(k.def.blend??2.4)+.4;for(let i=0;i<k.pts.length;i+=4){const q=k.pts[i];cellsIn(q.x-R,q.z-R,q.x+R,q.z+R,(kk,px,pz)=>{if(seen.has(kk)||TG[kk]===1)return;seen.add(kk);
        const i2=kk%N,j2=(kk/N)|0;if(i2<1||j2<1||i2>N-2||j2>N-2)return;const gx=(TH[kk+1]-TH[kk-1])/(2*CELL),gz=(TH[kk+N]-TH[kk-N])/(2*CELL),sl=Math.hypot(gx,gz);if(sl<.8||TS[kk]!==S.SNOW)return;
        const f=smt01((sl-.8)/.8)*(.15+.5*smt01(G.noise(px*1.2,pz*1.2)*1.7-.35));setC(kk,mix('#e4ebf0','#858c93',f))})}}},
    // a chairlift from A (bottom station) to B (top station): masts tall enough that the chairs clear the ground, and two stations with a
    // horizontal bullwheel under a roof. The cable and the chairs are drawn and moved by the game (js/ski.js) from G.lift.
    // o.off = half the distance between the up and down cables, o.span = roughly the distance between masts. Call it when the terrain is final.
    lift(A,B,o={}){const off=o.off??.55,hang=o.hang??.95,clear=o.clear??.7,ax=A[0],az=A[1],bx=B[0],bz=B[1],len=Math.hypot(bx-ax,bz-az),ux=(bx-ax)/len,uz=(bz-az)/len,px=uz,pz=-ux,ry=Math.atan2(ux,uz);
      const y0=H(ax,az)+1.55,y1=H(bx,bz)+1.55,need=d=>{let m=-1e9;for(const s of[-off,0,off])m=Math.max(m,H(ax+ux*d+px*s,az+uz*d+pz*s));return m+hang+clear+.3};
      const nm=Math.max(1,Math.round(len/(o.span??5))-1),nodes=[{d:0,y:y0,fixed:true}];for(let j=1;j<=nm;j++){const d=len*j/(nm+1);nodes.push({d,y:need(d)})}nodes.push({d:len,y:y1,fixed:true});
      for(let it=0;it<40;it++){let moved=false;for(let j=0;j<nodes.length-1;j++){const N0=nodes[j],N1=nodes[j+1];for(let d=N0.d+.25;d<N1.d;d+=.25){if(d<2.2||d>len-2.2)continue;const u=(d-N0.d)/(N1.d-N0.d),ly=N0.y+(N1.y-N0.y)*u,nd=need(d);if(nd<=ly+1e-4)continue;moved=true;
        if(N0.fixed)N1.y=(nd-N0.y*(1-u))/u+1e-3;else if(N1.fixed)N0.y=(nd-N1.y*u)/(1-u)+1e-3;else{N0.y+=nd-ly+1e-3;N1.y+=nd-ly+1e-3}}}if(!moved)break}
      for(let d=0;d<=len;d+=1)c.xpts.push({x:ax+ux*d,z:az+uz*d});
      // masts: a pole, a cross arm and a sheave train under each cable
      for(const nd of nodes){if(nd.fixed)continue;const x=ax+ux*nd.d,z=az+uz*nd.d,gy=H(x,z);c.cyl(x,gy-.1,z,.055,nd.y-gy+.3,'#8a9096');c.box(x,nd.y+.12,z,2*off+.4,.09,.12,'#6d747a',ry);   // the pole is thin enough that the chairs' inner edge (0,075 from the middle) clears it
        for(const s of[-off,off])c.box(x+px*s,nd.y,z+pz*s,.08,.12,.42,'#2f3336',ry);
        const pad=c.pistes.some(k=>k.dist(x,z)<k.hw+1.6);if(pad){c.cyl(x,gy-.05,z,.2,.95,'#2f6fd6');c.cyl(x,gy+.7,z,.205,.08,'#f2c230')}   // a padded mat round masts close to a piste
        c.colliders.push({x,z,r:pad?.22:.16,anchor:true,y:gy+.6})}
      // stations: the bullwheel turns under a roof on four posts; a machine house beside the bottom one, a hut beside the top one
      // the posts stand outside the chairs: a chair is 0,95 wide round the cable, so it reaches off+0,48 from the middle
      const station=(x,z,y,dir,house)=>{const gy=y-1.55;c.cyl(x,y-.05,z,off+.02,.07,'#c8463a');c.cyl(x,y-.6,z,.12,.6,'#5a6066');
        for(const sa of[-1,1])for(const sb of[-1,1]){const qx=x+px*sa*(off+.65)+ux*sb*.75,qz=z+pz*sa*(off+.65)+uz*sb*.75;c.cyl(qx,gy-.05,qz,.05,1.95+.05,'#5a6066');c.colliders.push({x:qx,z:qz,r:.07})}
        c.box(x,y+.4,z,2*off+1.6,.12,2.0,'#c8463a',ry);c.box(x,y+.52,z,2*off+1.4,.06,1.8,'#eef2f6',ry);
        const hx=x+px*dir*(off+1.65),hz=z+pz*dir*(off+1.65);c.box(hx,gy-.1,hz,1.5,1.25,2.2,house,ry);c.box(hx,gy+1.15,hz,1.7,.14,2.4,'#eef2f6',ry);for(const s of[-.55,.55])c.box(hx-px*dir*.76+ux*s,gy+.45,hz-pz*dir*.76+uz*s,.03,.3,.4,'#1a262d',ry);
        c.colliders.push({x:hx,z:hz,w:1.54,d:2.24,ry,anchor:true,y:gy+.6})};
      station(ax,az,y0,-1,'#d9d2c0');station(bx,bz,y1,1,'#b0533a');
      G.lift=c.liftDef={ax,az,bx,bz,ux,uz,px,pz,len,off,hang,ry,nodes:nodes.map(n=>({d:n.d,y:n.y}))};return c.liftDef},
    // a snow groomer parked on the snow: tracks, cab, the blade in front and the tiller behind. ry: the way it faces.
    groomer(x,z,ry=0,col='#c8463a'){c.block(x,z,1.6);const y=H(x,z),f=(a,s)=>[x+Math.sin(ry)*a+Math.cos(ry)*s,z+Math.cos(ry)*a-Math.sin(ry)*s];
      for(const s of[-.42,.42]){const[tx,tz]=f(0,s);c.box(tx,y-.02,tz,.3,.28,1.5,'#2a2c2e',ry)}
      {const[bx,bz]=f(-.05,0);c.box(bx,y+.24,bz,.62,.3,1.3,col,ry)}{const[cx2,cz2]=f(.25,0);c.box(cx2,y+.52,cz2,.58,.36,.62,col,ry);c.box(cx2,y+.58,cz2,.6,.18,.64,'#1a262d',ry);c.box(cx2,y+.9,cz2,.4,.05,.3,'#f2c230',ry)}
      {const[bx,bz]=f(1.0,0);c.box(bx,y,bz,1.35,.32,.08,'#d8dde2',ry)}{const[rx,rz]=f(-.95,0);c.box(rx,y,rz,1.0,.16,.3,'#4a4e52',ry)}
      c.colliders.push({x,z,w:1.4,d:2.3,ry,anchor:true,y:y+.4});return{x,z}},
    // a snow cannon on a short tower beside a piste, blowing towards dir (radians): its mist is drawn by js/skiresort.js
    snowgun(x,z,dir=0){const y=H(x,z),hx=x+Math.sin(dir)*.18,hz=z+Math.cos(dir)*.18;c.cyl(x,y-.05,z,.04,1.15,'#9aa0a6');c.box(x,y,z,.36,.08,.36,'#5a6066');
      c.cyls.push({x:hx,y:y+1.2,z:hz,sx:.14,sy:.46,sz:.14,rx:1.3,ry:dir,ord:'YXZ',c:'#e5a92b'});c.colliders.push({x,z,r:.12});c.fx.push({type:'snowgun',x:hx+Math.sin(dir)*.25,y:y+1.2,z:hz+Math.cos(dir)*.25,dir});return{x,z}},
    // a board with the map of the pistes (drawn by js/skiresort.js), facing ry
    trailMap(x,z,ry=0){const y=H(x,z),cs=Math.cos(ry),sn=Math.sin(ry);for(const s of[-.85,.85]){const px=x+cs*s,pz=z-sn*s;c.cyl(px,H(px,pz)-.05,pz,.04,1.7,'#5a3a22');c.colliders.push({x:px,z:pz,r:.07})}
      c.box(x,y+.7,z,1.9,1.05,.05,'#3a2a1c',ry);c.fx.push({type:'trailmap',x:x+sn*.035,y:y+1.22,z:z+cs*.035,ry})},
    finish(){for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i;if(TCF[k])continue;const cc=surfColor(TS[k],-HALF+i*CELL,-HALF+j*CELL,n,def);TC[k*3]=cc[0];TC[k*3+1]=cc[1];TC[k*3+2]=cc[2]}c._done=true},
    pebbles(cnt,cols,smin,smax){const L=[];for(let i=0;i<cnt;i++){const x=(rng()-.5)*(WORLD-4),z=(rng()-.5)*(WORLD-4);if(def.water!=null&&H(x,z)<def.water+.02)continue;const s=smin+rng()*(smax-smin);
      L.push({x,y:H(x,z)+s*.2,z,sx:s,sy:s*.6,sz:s*(.8+rng()*.5),rx:rng()*3,ry:rng()*3,c:cols[i%cols.length]})}instanced(DG.peb,DM.white,L,c.decor,false)},
    // bushes (js/props/busk.js): about 1.2·cnt bushes in the colours cols, placed where ok(x,z) says yes. o.soft: no collider, the car drives through them
    bushes(cnt,cols,ok,o={}){let n=0;for(let i=0;i<cnt*30&&n<cnt*1.2;i++){const x=(rng()-.5)*(WORLD-6),z=(rng()-.5)*(WORLD-6);if(c.dist(x,z)<2.2||(def.water!=null&&H(x,z)<def.water+.1)||(ok&&!ok(x,z)))continue;
        c.plant('busk',x,z,{s:.35+rng()*.35,klumper:2+(rng()<.5?1:0),cols,soft:o.soft});n++}
      c.plants()},
    // mushrooms: a stalk and a cap, in the shade of trees
    mushrooms(cnt,ok){const st=[],cp=[];for(let i=0;i<cnt*40&&st.length<cnt;i++){const x=(rng()-.5)*(WORLD-6),z=(rng()-.5)*(WORLD-6);if(c.dist(x,z)<1.5||(def.water!=null&&H(x,z)<def.water+.1)||(ok&&!ok(x,z)))continue;const h=.08+rng()*.1,y=H(x,z);
        st.push({x,y:y+h/2,z,sx:.025,sy:h,sz:.025,c:'#e9dcb9'});cp.push({x,y:y+h,z,sx:.07+rng()*.05,sy:.04,sz:.07+rng()*.05,c:['#c43b2f','#d9a93a','#8a6a3a','#e9dcb9'][i%4]})}
      instanced(DG.trunk,DM.white,st,c.decor,false);instanced(DG.canopy,DM.white,cp,c.decor,false)},
    // shells and seaweed along the beach
    shells(cnt){const L=[],W2=[];for(let i=0;i<cnt*30&&L.length<cnt;i++){const x=(rng()-.5)*(WORLD-4),z=(rng()-.5)*(WORLD-4);if(surfAt(x,z)!==S.SAND||(def.water!=null&&(H(x,z)<def.water+.02||H(x,z)>def.water+.9)))continue;const y=H(x,z);
        if(rng()<.6)L.push({x,y:y+.015,z,sx:.05+rng()*.04,sy:.025,sz:.045+rng()*.03,ry:rng()*6.28,c:['#f2e8d0','#e9c9a8','#d9a0a0','#f7f3e8'][i%4]});else W2.push({x,y:y+.01,z,sx:.3+rng()*.4,sy:.02,sz:.06,ry:rng()*6.28,c:'#3f5a2a'})}
      instanced(DG.peb,DM.white,L,c.decor,false);instanced(DG.root,DM.white,W2,c.decor,false)},
    tufts(cnt,cols){const L=[];for(let i=0;i<cnt;i++){const x=(rng()-.5)*(WORLD-4),z=(rng()-.5)*(WORLD-4);if(c.dist(x,z)<1.8||(def.water!=null&&H(x,z)<def.water+.05))continue;for(let k=0;k<5;k++){const s=.05+rng()*.05;
      L.push({x:x+(rng()-.5)*.5,y:H(x,z)-.02,z:z+(rng()-.5)*.5,sx:s,sy:.35+rng()*.45,sz:s,rx:(rng()-.5)*.6,rz:(rng()-.5)*.6,c:cols[k%cols.length]})}}instanced(DG.tuft,DM.tuft,L,c.decor,false)}
  };
  const gl=def.gateT?def.gateT(c):null,NG=gl?gl.length:def.gates;
  for(let k=1;k<=NG;k++){const t=gl?gl[k-1]:.03+.95*k/NG,p=c.P(t),tn=c.T(t),s=c.side(t);
    c.gates.push({t,c:p,tan:tn,side:s,a:{x:p.x+s.x*1.25,z:p.z+s.z*1.25},b:{x:p.x-s.x*1.25,z:p.z-s.z*1.25},finish:k===NG})}
  G.waterAt=(x,z)=>{let w=-1e9;if(def.water!=null&&(!def.waterBand||def.waterBand(x,z)))w=def.water;for(const p of c.pools){if((x-p.x)*(x-p.x)+(z-p.z)*(z-p.z)<p.r*p.r&&p.level>w)w=p.level}return w};
  if(def.village)c.village(def.village);
  if(def.marina)c.marina(def.marina);
  def.build(c);
  if(c.pistes.length&&!c._pisteDressed)c.dressPistes();G.pistes=c.pistes;
  if(!c._done)c.finish();
  if(c.plantList.length)c.plants();
  if(c.boxes.length||c.cyls.length||c.prisms.length)c.props();
  // an island that is a race: the race line is also a course you can start from its portal while roaming
  if(def.village&&!def.world){const k=c.course({id:def.id,name:def.name,desc:def.desc,diff:def.diff,path:def.path,gates:def.gates,gateT:def.gateT,bench:false});k.main=true}
  c.start=def.start?{p:new V3(def.start[0],0,def.start[1]),tan:new V3(Math.sin(def.start[2]||0),0,Math.cos(def.start[2]||0))}:{p:c.P(0),tan:c.T(.004)};
  c.crates=def.world?[]:placeCrates(c,c,rng);
  for(const e of c.extra)c.crates.push({x:e.x,z:e.z,y:H(e.x,e.z)+.16,t:c.tOf(e.x,e.z)});
  for(const k of c.courses){k.crates=placeCrates(k,c,rng);for(const e of k.extra)k.crates.push({x:e.x,z:e.z,y:H(e.x,e.z)+.16,t:k.tOf(e.x,e.z)})}
  G.colliders=c.colliders;G.anchors=c.anchors;
  return c;
}

/* ---------- cars ---------- */
const CARS=[]; // fylles av data/cars.js
const TRAVEL=.22, WR=.24, TRACK=.9, MOUNT_Y=-.02;
// where the wheel centres sit under the body when the car stands still (the model of a car with its own ride height is drawn from this)
const restWheelY=cfg=>MOUNT_Y+(cfg.ride||0)-.6*TRAVEL*(cfg.susp||1);
const SAMPLES=[[-.8,0],[-.5,0],[-.2,0],[0,0],[.2,0],[.5,0],[.8,0],[0,.07],[0,-.07]];
// PARTS og PAINTS ligger i data/parts.js
function tuneFrom(parts){const g=k=>parts[k]||0,t=g('tyres'),s=g('susp'),mo=g('motor'),w=g('weight'),ge=g('gear');
  return{grip:[1,1.1,1.2,1.3][t],vlow:[1,1.05,1.1,1.15][mo],vhigh:[1,.96,.92,.88][t]*[1,1.12,1.25,1.4][mo]*[1,.97,.94,.9][w],fmot:[1,1.2,1.4,1.65][mo],
    travel:[.22,.26,.3,.34][s],lift:[0,0,.008,.015][s],right:[0,.35,.7,1][w],wade:ge>=1?.22:.06,winch:ge>=2?2:5,led:ge>=3,snorkel:ge>=1,realWinch:ge>=3,lv:{tyres:t,susp:s,motor:mo,weight:w,gear:ge}}}
const TUNE0=tuneFrom({});

function makeCar(cfg,tune){
  tune=tune||TUNE0;const k=cfg.susp||1;if(k!==1)tune=Object.assign({},tune,{travel:tune.travel*k});   // susp: shorter and stiffer springs (a sports car)
  const m=cfg.mass,L=cfg.L,tr=cfg.track||TRACK,W=Math.max(.92,tr),car={cfg,m,tune,wr:cfg.wr||WR,pos:new V3(),vel:new V3(),q:new Q4(),w:new V3(),steer:0,throttle:0,low:true,assist:true,speedScale:1,
    depth:-1,I:new V3(m/12*(.55*.55+L*L)*1.1,m/12*(W*W+L*L)*1.1,m/12*(W*W+.55*.55)*1.6),wheels:[],pts:[],up:new V3(0,1,0),fw:new V3(0,0,1),lf:new V3(1,0,0)};
  car.K=m*9.8/4/(.4*TRAVEL*k);car.C=2*Math.sqrt(car.K*m/4)*[.5,.65,.8,.9][tune.lv?tune.lv.susp:0];
  for(const fz of[1,-1])for(const sx of[1,-1])car.wheels.push({mount:new V3(sx*tr/2,MOUNT_Y+(cfg.ride||0)+(tune.travel-TRAVEL*k)-tune.lift,fz*cfg.wb/2),front:fz>0,left:sx>0,comp:0,prev:0,had:false,contact:false,center:new V3(),spin:0,vl:0,slip:0,surf:0,P:new V3()});
  const roof=.08+.34+cfg.gh+.12;
  for(const sx of[1,-1]){for(const sz of[1,-1]){car.pts.push(new V3(sx*.44,-.06,sz*L*.47),new V3(sx*.42,roof,sz*L*.42),new V3(sx*.42,.03,sz*(L/2+.09)),new V3(sx*.47,.3,sz*L*.3))}}
  car.pts.push(new V3(0,-.14,0),new V3(0,-.13,cfg.wb*.3),new V3(0,-.13,-cfg.wb*.3));
  return car;
}
function placeCar(car,x,z,heading){
  car.q.setFromAxisAngle(YAX,heading);let mh=-1e9;
  for(const dx of[-.6,0,.6])for(const dz of[-1,0,1]){const c=Math.cos(heading),s=Math.sin(heading);mh=Math.max(mh,H(x+dx*c+dz*s,z-dx*s+dz*c))}
  car.pos.set(x,mh+.5,z);car.vel.set(0,0,0);car.w.set(0,0,0);car.steer=0;car.throttle=0;
  for(const w of car.wheels){w.prev=0;w.had=false;w.comp=0}
}

const _f=new V3(),_tq=new V3(),_M=new V3(),_C0=new V3(),_wf=new V3(),_ff=new V3(),_fs=new V3(),_P=new V3(),_n=new V3(),_ng=new V3(),_r=new V3(),_rc=new V3(),
      _vp=new V3(),_tF=new V3(),_tS=new V3(),_t=new V3(),_iq=new Q4(),_wq=new Q4();
function stepCar(car,dt){
  const m=car.m,g=9.8,q=car.q,inv=1/dt,meff=m*.125;
  const up=car.up.set(0,1,0).applyQuaternion(q),fw=car.fw.set(0,0,1).applyQuaternion(q),lf=car.lf.set(1,0,0).applyQuaternion(q);
  _f.set(0,-g*m,0);_tq.set(0,0,0);
  const TU=car.tune||TUNE0,TRV=TU.travel;
  const low=car.low,vmax=(low?1.7*TU.vlow:5.6*TU.vhigh*(car.cfg.top||1))*(car.speedScale||1),WRc=car.wr,fmot=(low?.62:.15)*TU.fmot*(car.cfg.pow||1)*m*g,vt=car.throttle*vmax,gripMul=(car.assist?1.12:1)*TU.grip;
  const dy=Math.max(.35,up.y);
  for(const wh of car.wheels){
    _M.copy(wh.mount).applyQuaternion(q).add(car.pos);
    _C0.copy(up).multiplyScalar(-TRV).add(_M);
    const st=wh.front?car.steer:0,cs=Math.cos(st),sn=Math.sin(st);
    _wf.copy(fw).multiplyScalar(cs).addScaledVector(lf,sn);
    _ff.set(_wf.x,0,_wf.z);if(_ff.lengthSq()<1e-4)_ff.set(up.x,0,up.z);_ff.normalize();_fs.set(_ff.z,0,-_ff.x);
    let best=-1e9,bx=0,bz=0,bh=0;
    for(const s of SAMPLES){const a=s[0]*WRc,b=s[1],px=_C0.x+_ff.x*a+_fs.x*b,pz=_C0.z+_ff.z*a+_fs.z*b,gh=H(px,pz),pen=gh-(_C0.y-Math.sqrt(Math.max(0,WRc*WRc-a*a)));
      if(pen>best){best=pen;bx=px;bz=pz;bh=gh}}
    if(best>0){
      const comp=best/dy;wh.contact=true;
      let cv=wh.had?(comp-wh.prev)*inv:0;cv=Math.max(-2.5,Math.min(2.5,cv));wh.prev=comp;wh.had=true;
      let spring=car.K*Math.min(comp,TRV)+car.C*cv;if(comp>TRV)spring+=car.K*30*(comp-TRV)+car.C*2*cv;spring=Math.max(0,spring);
      wh.comp=Math.min(comp,TRV+.04);
      _P.set(bx,bh,bz);
      _n.set(_C0.x,_C0.y+best,_C0.z).sub(_P).normalize();normalAt(bx,bz,_ng);
      _n.multiplyScalar(.6).addScaledVector(_ng,.4).normalize();if(_n.y<.15)_n.copy(_ng);
      const Nf=Math.min(spring/Math.max(.35,_n.dot(up)),m*g*3);
      _r.copy(_P).sub(car.pos);_vp.copy(car.w).cross(_r).add(car.vel);
      _tF.copy(_wf).addScaledVector(_n,-_wf.dot(_n)).normalize();_tS.crossVectors(_n,_tF);
      const vl=_vp.dot(_tF),vs=_vp.dot(_tS),surf=surfAt(bx,bz),wd=WL(bx,bz)-bh,lim=GRIP[surf]*gripMul*(wd>0?.82:1)*Nf;
      const fm=Math.min(fmot,lim);let fl=(vt-vl)*meff*inv;fl=Math.max(-fm,Math.min(fm,fl));
      let fs=-vs*meff*inv;fs=Math.max(-lim,Math.min(lim,fs));
      const mag=Math.hypot(fl,fs);if(mag>lim&&mag>0){const k=lim/mag;fl*=k;fs*=k}
      // mud and water resistance (opposes wheel velocity, never reverses it)
      const md=MUDDRAG[surf],spd=Math.hypot(vl,vs);
      if((md||wd>0)&&spd>1e-3){let dr=0;if(md)dr+=(md[0]+md[1]*spd)*m*g;if(wd>0)dr+=Math.min(wd,.5)*.09*spd*m*g;dr=Math.min(dr,spd*meff*inv*.9);fl-=vl/spd*dr;fs-=vs/spd*dr}
      _t.copy(_n).multiplyScalar(Nf).addScaledVector(_tF,fl).addScaledVector(_tS,fs);
      _f.add(_t);_rc.crossVectors(_r,_t);_tq.add(_rc);
      wh.vl=vl;wh.slip=Math.abs(car.throttle)>.05?Math.abs(vt-vl):0;wh.surf=surf;wh.P.copy(_P);wh.wd=wd;
    }else{wh.contact=false;wh.had=false;wh.comp=0;wh.prev=0;wh.slip=0;wh.wd=-1}
    wh.center.copy(_M).addScaledVector(up,-(TRV-Math.min(wh.comp,TRV)));
  }
  // body vs ground
  for(const bp of car.pts){
    _P.copy(bp).applyQuaternion(q).add(car.pos);const pen=H(_P.x,_P.z)-_P.y;if(pen<=0)continue;
    normalAt(_P.x,_P.z,_ng);_r.copy(_P).sub(car.pos);_vp.copy(car.w).cross(_r).add(car.vel);
    const vn=_vp.dot(_ng);const Nf=Math.max(0,300*m*Math.min(pen,.3)-(vn<0?17*m*vn:0));
    _t.copy(_vp).addScaledVector(_ng,-vn);const tl=_t.length();
    let ft=tl*meff*inv;ft=Math.min(ft,.6*Nf);
    _t.multiplyScalar(tl>1e-6?-ft/tl:0).addScaledVector(_ng,Nf);
    _f.add(_t);_rc.crossVectors(_r,_t);_tq.add(_rc);
  }
  // the winch rope: a steady pull on the front hook towards the anchor (set by the game while winching)
  if(car.rope){_P.set(0,.1,car.cfg.L/2).applyQuaternion(q).add(car.pos);_t.set(car.rope.x-_P.x,car.rope.y-_P.y,car.rope.z-_P.z);const L=_t.length();if(L>.05){_t.multiplyScalar(car.rope.F/L);if(_t.y>car.rope.F*.3)_t.y=car.rope.F*.3;_f.add(_t);_r.copy(_P).sub(car.pos);_rc.crossVectors(_r,_t);_tq.add(_rc)}}
  // body in water: buoyancy and drag
  const wl=WL(car.pos.x,car.pos.z);car.depth=wl-car.pos.y;
  const sub=Math.max(0,Math.min(1,(wl-(car.pos.y-.16))/.5));
  if(sub>0){_f.y+=sub*m*g*.88;car.vel.multiplyScalar(1-2.4*sub*dt);car.w.multiplyScalar(1-3*sub*dt)}
  car.vel.addScaledVector(_f,dt/m);
  _iq.copy(q).invert();_t.copy(_tq).applyQuaternion(_iq);_t.set(_t.x/car.I.x,_t.y/car.I.y,_t.z/car.I.z).applyQuaternion(q);
  car.w.addScaledVector(_t,dt);
  if(car.assist&&up.y<.8&&up.y>-.2){_t.crossVectors(up,YAX);car.w.addScaledVector(_t,dt*7*(.8-up.y))}
  if(car.rope&&up.y<.9){_t.crossVectors(up,YAX);if(_t.lengthSq()<1e-4)_t.set(1,0,0);car.w.addScaledVector(_t,dt*12*(1-up.y));car.vel.y+=dt*11*(1-up.y)}   // the winch rolls a tipped car back onto its wheels: a lift and a roll until it is upright
  if(TU.right>0&&up.y<.985&&up.y>-.2){_t.crossVectors(up,YAX);car.w.addScaledVector(_t,dt*9*TU.right*(.985-up.y))}
  car.w.multiplyScalar(1-(.6+.5*TU.right+(car.rope?2.5:0))*dt);car.vel.multiplyScalar(1-(.04+(car.rope?1.5:0))*dt);
  car.pos.addScaledVector(car.vel,dt);
  _wq.set(car.w.x,car.w.y,car.w.z,0).multiply(q);q.x+=.5*dt*_wq.x;q.y+=.5*dt*_wq.y;q.z+=.5*dt*_wq.z;q.w+=.5*dt*_wq.w;q.normalize();
  for(const c of G.colliders){const dx=car.pos.x-c.x,dz=car.pos.z-c.z;
    if(c.w!=null){   // a box (building, container, wall): the car is pushed out from the nearest point of the rectangle, in the box's own frame
      const cs=Math.cos(c.ry||0),sn=Math.sin(c.ry||0),a=dx*cs-dz*sn,b=dx*sn+dz*cs,hw=c.w/2,hd=c.d/2,ca=a<-hw?-hw:a>hw?hw:a,cb=b<-hd?-hd:b>hd?hd:b;let ea=a-ca,eb=b-cb,d=Math.hypot(ea,eb);
      if(d>=.62)continue;let na,nb;if(d<1e-4){const pa=hw-Math.abs(a),pb=hd-Math.abs(b);if(pa<pb){ea=a<0?-1:1;eb=0;na=ea*(hw+.62);nb=b}else{ea=0;eb=b<0?-1:1;na=a;nb=eb*(hd+.62)}}else{ea/=d;eb/=d;na=ca+ea*.62;nb=cb+eb*.62}
      car.pos.x=c.x+na*cs+nb*sn;car.pos.z=c.z-na*sn+nb*cs;const nx=ea*cs+eb*sn,nz=-ea*sn+eb*cs,vn=car.vel.x*nx+car.vel.z*nz;if(vn<0){car.vel.x-=nx*vn*1.2;car.vel.z-=nz*vn*1.2}continue}
    const d=Math.hypot(dx,dz),R=c.r+.62;
    if(d<R&&d>1e-4){const nx=dx/d,nz=dz/d;car.pos.x=c.x+nx*R;car.pos.z=c.z+nz*R;const vn=car.vel.x*nx+car.vel.z*nz;if(vn<0){car.vel.x-=nx*vn*1.2;car.vel.z-=nz*vn*1.2}}}
  for(const wh of car.wheels){const target=wh.contact&&wh.slip<.3?wh.vl:vt;wh.spin+=target/car.wr*dt}
}
