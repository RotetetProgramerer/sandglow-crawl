'use strict';
/* =================================================================
   GPS ROUTE: finds a way the car can drive from one place on the island to another (no DOM, tools/test-gps.js drives the routes with an autopilot).
   The island becomes a grid of cells two terrain cells wide (0,58 units on the islands), and every cell gets a price per unit driven:
   roads are cheap; slopes, rocks, sand, mud, snow and shallow water cost more; very steep or rough ground costs a lot (the GPS goes round if it can);
   deep water, lava, houses, trees, fences and high steps can't be driven at all. A* finds the cheapest way, and the corners are cut
   wherever the straight line is free and costs no more. Uses core.js (H, WL, surfAt, lavaAt, polyPts, G, N, CELL, HALF) at run time.
   ================================================================= */
const GPS_STEP=2;          // terrain cells per route cell
const GPS_WADE=.2;         // deeper water than this is not driven through
const GPS_STEPUP=.42;      // a step this high between two neighbouring cells (a wall, a quay edge) can't be driven
const GPS_KEEP=.5;         // how far the middle of the car keeps from houses, trees and posts (the car is pushed off at .62)
// price per unit on each surface (S in core.js); a missing surface costs 1
const GPS_SURF={[S.SAND]:1.15,[S.ROCK]:1.3,[S.MUD]:2.2,[S.BOG]:4.5,[S.ICE]:3,[S.SNOW]:1.25,[S.REDROCK]:1.2,[S.GRAVEL]:.9,[S.ASPHALT]:.85,[S.WOOD]:.9,[S.ASH]:1.1};

// the places on an island the GPS knows by name: the ferry, the base, the marina, the airport, the ski lift, the cave (o.cave: once it is found),
// the start of every course and the names on the island map. r: how close counts as there (just outside where the game asks its question);
// area: the place is an area (a name on the map), and the route may end anywhere within that many units of it.
function gpsPlaces(def,lv,o={}){const P=[],has=new Set();
  const add=(id,name,x,z,r,kind,extra)=>{P.push(Object.assign({id,name,x,z,r,kind},extra));has.add(kind)};
  if(lv.ferry)add('ferry','Fergekaia',lv.ferry.x,lv.ferry.z,2.4,'ferry');
  const ga=def.garageAt||def.basePos;if(ga)add('base','Basen',ga[0],ga[1],2.8,'base');
  if(lv.marinaDef)add('marina','Marinaen',lv.marinaDef.ask.x,lv.marinaDef.ask.z,2,'marina');
  if(lv.airportDef)add('air','Flyplassen',lv.airportDef.ask.x,lv.airportDef.ask.z,2,'air');
  if(def.skiAt&&lv.liftDef)add('ski','Skiheisen',def.skiAt[0],def.skiAt[1],2,'ski');
  if(lv.caveDef&&o.cave)add('cave','Diamantgrotten',lv.caveDef.mouth.x,lv.caveDef.mouth.z,lv.caveDef.r+1,'cave');
  for(const k of lv.courses||[])add('k:'+k.id,k.name,k.start.p.x,k.start.p.z,3.6,'course',{k});
  const alias={Kaia:'ferry',Basen:'base',Marinaen:'marina',Flyplassen:'air'};   // names on the map that are places already
  for(const[x,z,name]of def.mapLabels||[])if(!has.has(alias[name]))add('l:'+name,name,x,z,6.5,'label',{area:6});
  return P}

// the grid for the level that is loaded now (lv = the object genLevel returned). Takes 10–200 ms on an island, so the game keeps it per level.
// cost: the price per unit through each cell before the slope (Infinity: can't be driven); gx, gz: the slope, priced by gpsPrice for the way the car drives.
function gpsGrid(lv){
  const st=GPS_STEP,M=Math.floor((N-1)/st)+1,d=st*CELL,K=M*M,x0=-HALF,lim=HALF-1.2,cost=new Float32Array(K),hgt=new Float32Array(K),gx=new Float32Array(K),gz=new Float32Array(K),
    rough=new Float32Array(K),road=new Uint8Array(K),wet=new Float32Array(K);
  for(let j=0;j<M;j++)for(let i=0;i<M;i++)hgt[j*M+i]=H(x0+i*d,x0+j*d);   // H includes bridges and piers
  const each=(x,z,r,fn)=>{const i0=Math.max(0,Math.floor((x-r-x0)/d)),i1=Math.min(M-1,Math.ceil((x+r-x0)/d)),j0=Math.max(0,Math.floor((z-r-x0)/d)),j1=Math.min(M-1,Math.ceil((z+r-x0)/d));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)fn(j*M+i,x0+i*d,x0+j*d)};
  // roads: the cells along them are cheap, so the GPS follows the roads like a real one
  for(const poly of(lv.roads||[]))for(const p of polyPts(poly,.4))each(p.x,p.z,1.05,(k,x,z)=>{if((x-p.x)**2+(z-p.z)**2<1.1)road[k]=1});
  const hasLava=G.lavas.length>0,c=CELL;
  for(let j=0;j<M;j++)for(let i=0;i<M;i++){const k=j*M+i,x=x0+i*d,z=x0+j*d,h=hgt[k];
    if(i<1||j<1||i>M-2||j>M-2||Math.abs(x)>lim||Math.abs(z)>lim){cost[k]=Infinity;continue}
    const wd=WL(x,z)-h;if(wd>GPS_WADE){cost[k]=Infinity;continue}wet[k]=Math.max(0,wd);
    if(hasLava){const ll=lavaAt(x,z,.45);if(ll>-1e8&&h<ll+.35){cost[k]=Infinity;continue}}
    // the slope under the whole car (two cells each way: about as wide as the car is long), and the roughness: how far the ground inside the cell
    // strays from the slope of its neighbours (rocks, logs, kerbs)
    const i2=Math.min(2,i,M-1-i),j2=Math.min(2,j,M-1-j);gx[k]=(hgt[k+i2]-hgt[k-i2])/(2*i2*d);gz[k]=(hgt[k+j2*M]-hgt[k-j2*M])/(2*j2*d);
    const sx=(hgt[k+1]-hgt[k-1])/(2*d),sz=(hgt[k+M]-hgt[k-M])/(2*d);let r=0;
    for(const a of[-c,0,c])for(const b of[-c,0,c]){if(!a&&!b)continue;const e=Math.abs(H(x+a,z+b)-(h+sx*a+sz*b));if(e>r)r=e}
    rough[k]=r;cost[k]=GPS_SURF[surfAt(x,z)]??1}
  // houses, trees, posts and fences: the car can't drive where its middle would be inside them. Cacti and the like snap, so they only cost a bit.
  const soft=new Set((lv.breakables||[]).map(b=>b.col)),snap=new Float32Array(K);
  for(const cl of G.colliders){
    if(cl.w!=null){const cs=Math.cos(cl.ry||0),sn=Math.sin(cl.ry||0),hw=cl.w/2+GPS_KEEP,hd=cl.d/2+GPS_KEEP;
      each(cl.x,cl.z,Math.hypot(hw,hd),(k,x,z)=>{const dx=x-cl.x,dz=z-cl.z,a=dx*cs-dz*sn,b=dx*sn+dz*cs;if(Math.abs(a)<hw&&Math.abs(b)<hd)cost[k]=Infinity});continue}
    const R=cl.r+GPS_KEEP;each(cl.x,cl.z,R,(k,x,z)=>{if((x-cl.x)**2+(z-cl.z)**2<R*R){if(soft.has(cl))snap[k]=3;else cost[k]=Infinity}})}
  // the car is wider than a cell: the roughest ground under it counts (a gap between two rocks is no wider than the gap), and so does
  // what can't be driven close by (deep water, a house, a cliff edge), so the route keeps to the middle of piers and passes
  const out=new Float32Array(K).fill(Infinity);
  for(let j=2;j<M-2;j++)for(let i=2;i<M-2;i++){const k=j*M+i;if(!isFinite(cost[k]))continue;let r=0,n1=0,n2=0;
    for(let b=-2;b<=2;b++)for(let a=-2;a<=2;a++){const q=k+b*M+a,ring=Math.max(Math.abs(a),Math.abs(b));if(!isFinite(cost[q])){if(ring===1)n1++;else if(ring===2)n2++;continue}if(ring<=1&&rough[q]>r)r=rough[q]}
    let f=cost[k]+snap[k];
    if(wet[k]>0)f+=1.5+wet[k]*10;                     // shallow water: slow, and the engine can drown
    f+=8*Math.max(0,r-.06)+(r>.32?30:0);              // rough: rocks and steps
    f+=.6*n1+.25*n2;                                  // close to the edge
    out[k]=road[k]?f*.6:f}
  return{M,d,x0,cost:out,hgt,gx,gz,lv}}

// the price per unit of driving through cell k in the direction (ux,uz): the cell's own price, and the slope. Climbing straight up is fine up to a point,
// but across a slope the car tips over, so that costs much more.
function gpsPrice(gr,k,ux,uz){const sx=gr.gx[k],sz=gr.gz[k],al=Math.abs(sx*ux+sz*uz),cr=Math.abs(sx*uz-sz*ux);
  return gr.cost[k]+2*Math.max(0,al-.15)+10*Math.max(0,al-.45)**2+(al>.8?30:0)+4*Math.max(0,cr-.1)+30*Math.max(0,cr-.3)**2+(cr>.55?30:0)}

const gpsIdx=(gr,x,z)=>{const i=Math.round((x-gr.x0)/gr.d),j=Math.round((z-gr.x0)/gr.d);return i<0||j<0||i>=gr.M||j>=gr.M?-1:j*gr.M+i};
const gpsPt=(gr,k)=>({x:gr.x0+(k%gr.M)*gr.d,z:gr.x0+Math.floor(k/gr.M)*gr.d});
// the drivable cell nearest to (x,z), searched in growing rings out to r units; -1 if there is none
function gpsNear(gr,x,z,r){const k0=gpsIdx(gr,x,z);if(k0>=0&&isFinite(gr.cost[k0]))return k0;const M=gr.M,ci=Math.round((x-gr.x0)/gr.d),cj=Math.round((z-gr.x0)/gr.d),R=Math.ceil(r/gr.d);
  let best=-1,bd=1e9;for(let ring=1;ring<=R;ring++){for(let j=cj-ring;j<=cj+ring;j++)for(let i=ci-ring;i<=ci+ring;i++){if(Math.max(Math.abs(i-ci),Math.abs(j-cj))!==ring||i<0||j<0||i>=M||j>=M)continue;const k=j*M+i;if(!isFinite(gr.cost[k]))continue;
    const p=gpsPt(gr,k),dd=(p.x-x)**2+(p.z-z)**2;if(dd<bd){bd=dd;best=k}}if(best>=0&&ring*gr.d>Math.sqrt(bd)+gr.d)break}
  return best}

// the price of driving straight from a to b ({x,z}), or Infinity if something is in the way
function gpsLineCost(gr,a,b){const L=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.ceil(L/(gr.d*.45))),ux=(b.x-a.x)/(L||1),uz=(b.z-a.z)/(L||1);let s=0,ph=null;
  for(let i=0;i<=n;i++){const u=i/n,k=gpsIdx(gr,a.x+(b.x-a.x)*u,a.z+(b.z-a.z)*u);if(k<0||!isFinite(gr.cost[k]))return Infinity;
    const h=gr.hgt[k];if(ph!==null&&Math.abs(h-ph)>GPS_STEPUP)return Infinity;ph=h;s+=gpsPrice(gr,k,ux,uz)*(i===0||i===n?.5:1)}
  return s*L/n}

// a min-heap of cell numbers ordered by their f value
function gpsHeap(){const ks=[],fs=[];return{size:()=>ks.length,
  push(k,f){let i=ks.length;ks.push(k);fs.push(f);while(i>0){const p=(i-1)>>1;if(fs[p]<=f)break;ks[i]=ks[p];fs[i]=fs[p];i=p}ks[i]=k;fs[i]=f},
  pop(){const top=ks[0],lk=ks.pop(),lf=fs.pop();const n=ks.length;if(n){let i=0;for(;;){let c=2*i+1;if(c>=n)break;if(c+1<n&&fs[c+1]<fs[c])c++;if(fs[c]>=lf)break;ks[i]=ks[c];fs[i]=fs[c];i=c}ks[i]=lk;fs[i]=lf}return top}}}

// the route from (sx,sz) to (tx,tz): {pts:[{x,z,s}] every half unit with s = distance from the start, len, cost, short}, or null if the place can't be reached
// (water all round). A target in a house or out in the water gets the nearest cell the car can drive on; a target the car can't get to at all
// (a cliff top, a reef in the river) gets as close as the car can come (short:true), if that is within 12 units. area > 0: any cell within that
// many units of the target will do (a name on the map).
function gpsRoute(gr,sx,sz,tx,tz,area=0){
  const M=gr.M,K=M*M,C=gr.cost,Hh=gr.hgt,d=gr.d,s=gpsNear(gr,sx,sz,4),t=gpsNear(gr,tx,tz,Math.max(8,area));if(s<0||t<0)return null;
  const g=new Float32Array(K).fill(Infinity),from=new Int32Array(K).fill(-1),done=new Uint8Array(K),heap=gpsHeap(),ti=t%M,tj=(t/M)|0,ci=(tx-gr.x0)/d,cj=(tz-gr.x0)/d,ar=area/d;
  // area: a place that is a whole area (a river, a lake, a part of town): the route ends at the first cell inside it, the nearest bank on this side
  const inArea=k=>area>0&&(k%M-ci)**2+(((k/M)|0)-cj)**2<ar*ar&&C[k]<2.6;
  const hr=area>0?k=>Math.max(0,Math.hypot(k%M-ci,((k/M)|0)-cj)-ar)*d*.6
    :k=>{const di=Math.abs(k%M-ti),dj=Math.abs(((k/M)|0)-tj);return(Math.max(di,dj)+.414*Math.min(di,dj))*d*.6};   // octile distance at the cheapest price (a road)
  const NB=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
  g[s]=0;heap.push(s,hr(s));let found=false,close=s,cd=1e9,t2=t;   // close: the reached cell nearest the target, for when the target can't be reached
  while(heap.size()){const k=heap.pop();if(done[k])continue;done[k]=1;if(k===t||inArea(k)){found=true;t2=k;break}const i=k%M,j=(k/M)|0;
    if(C[k]<2.6){const dd=(i-ti)**2+(j-tj)**2;if(dd<cd){cd=dd;close=k}}   // not at the very edge of the water or the cliff
    for(const[di,dj,w]of NB){const ii=i+di,jj=j+dj;if(ii<0||jj<0||ii>=M||jj>=M)continue;const n=jj*M+ii;if(done[n]||!isFinite(C[n]))continue;
      if(di&&dj&&(!isFinite(C[j*M+ii])||!isFinite(C[jj*M+i])))continue;   // no squeezing diagonally past a corner
      if(Math.abs(Hh[n]-Hh[k])>GPS_STEPUP)continue;
      const ux=di/w,uz=dj/w,ng=g[k]+w*d*(gpsPrice(gr,k,ux,uz)+gpsPrice(gr,n,ux,uz))*.5;if(ng<g[n]){g[n]=ng;from[n]=k;heap.push(n,ng+hr(n))}}}
  // the target is cut off (a cliff top, a reef in the river): drive as close as the car can get, if that is close at all
  let end=t2;if(!found){if(Math.sqrt(cd)*d>12)return null;end=close}
  const path=[];for(let k=end;k>=0;k=from[k])path.push(k);path.reverse();
  // cut the corners: from each corner, go straight to the furthest cell on the path that the straight line reaches without costing more
  const P=path.map(k=>gpsPt(gr,k));P[0]={x:sx,z:sz};const out=[P[0]];let i=0;
  while(i<P.length-1){let j=Math.min(P.length-1,i+90);for(;j>i+1;j--){const lc=gpsLineCost(gr,P[i],P[j]);if(lc<=(g[path[j]]-g[path[i]])*1.04+.05)break}out.push(P[j]);i=j}
  // the target itself, when the car can get right to it
  const tp=gpsPt(gr,end);if(Math.hypot(tx-tp.x,tz-tp.z)<1.5&&isFinite(gpsLineCost(gr,tp,{x:tx,z:tz})))out.push({x:tx,z:tz});
  // every half unit along the corners, with the distance from the start
  const pts=[];let acc=0;for(let m=0;m<out.length-1;m++){const a=out[m],b=out[m+1],L=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.ceil(L/.5));for(let q=0;q<n;q++){const u=q/n;pts.push({x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u,s:acc+L*u})}acc+=L}
  const e=out[out.length-1];pts.push({x:e.x,z:e.z,s:acc});
  return{pts,len:acc,cost:g[end],corners:out,short:!found}}
