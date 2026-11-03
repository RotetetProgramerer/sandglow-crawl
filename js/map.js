'use strict';
/* =================================================================
   MAP: the round minimap in the HUD and the hand-drawn island map (open worlds only). A tap on the map sets the GPS (js/gps.js).
   The base layer is painted once per level from the terrain colours (TC) and heights (TH); roads, courses, icons,
   the car and the fog of war are drawn on top every time. Fog is a coarse grid of visited cells, saved per world.
   Loaded before game.js; uses its globals (LV, car, state, best …) only inside functions, at run time.
   ================================================================= */
const MAP={base:null,W:0,fog:null,FN:48,fogT:0,open:false,hover:null,mini:null,miniCtx:null,big:null,bigCtx:null,scale:1,pad:0};
const MAPCOL={water:'#5f9fc4',waterDeep:'#3f7ea6',coast:'#2e3a44',paper:'#e9dcb9',road:'#6b4a2a',ink:'#2a241c',fog:'#cdbf9c'};
const DIFFC=['#8bbb4a','#8bbb4a','#e5a92b','#d9432f'];
// seen from above, as in the 3D view: north (+z) is up and east (−x) to the right. (+x to the right would show the island mirrored: a road
// you turn left into would turn right on the map.) mapAng is the heading of a forward vector on the map, clockwise from up
const mapX=x=>(HALF-x)/WORLD*MAP.W, mapY=z=>(HALF-z)/WORLD*MAP.W, mapAng=fw=>Math.atan2(-fw.x,fw.z);

/* ---------- base layer ---------- */
function buildMapBase(def){
  const W=MAP.W=512,c=document.createElement('canvas');c.width=c.height=W;const x=c.getContext('2d'),img=x.createImageData(W,W),d=img.data;
  const wl=def.water??-1e9,band=def.waterBand||(()=>true);
  for(let v=0;v<W;v++)for(let u=0;u<W;u++){const wx=HALF-(u+.5)/W*WORLD,wz=HALF-(v+.5)/W*WORLD;const fx=(wx+HALF)/CELL,fz=(wz+HALF)/CELL;
    const i=Math.max(0,Math.min(N-1,Math.round(fx))),j=Math.max(0,Math.min(N-1,Math.round(fz))),k=j*N+i,h=TH[k],o=(v*W+u)*4;
    let r,g,b;
    if(h<wl&&band(wx,wz)){const dp=Math.min(1,(wl-h)/1.6);const A=hexRGB(MAPCOL.water),B=hexRGB(MAPCOL.waterDeep);r=A[0]+(B[0]-A[0])*dp;g=A[1]+(B[1]-A[1])*dp;b=A[2]+(B[2]-A[2])*dp}
    else{
      // terrain colour (linear) → sRGB-ish, shaded by slope like the 3D view, then tinted towards paper
      const s=(di,dj)=>TH[Math.min(N-1,Math.max(0,j+dj))*N+Math.min(N-1,Math.max(0,i+di))];
      const nx=s(-1,0)-s(1,0),nz=s(0,-1)-s(0,1),ny=2*CELL,inv=1/Math.hypot(nx,ny,nz),light=Math.max(.55,Math.min(1.15,.86+(-nx*.6+nz*.4)*inv*.9));
      r=Math.pow(TC[k*3],1/2.2)*255*light;g=Math.pow(TC[k*3+1],1/2.2)*255*light;b=Math.pow(TC[k*3+2],1/2.2)*255*light;
      const P=hexRGB(MAPCOL.paper),t=.18;r=r*(1-t)+P[0]*t;g=g*(1-t)+P[1]*t;b=b*(1-t)+P[2]*t}
    d[o]=r;d[o+1]=g;d[o+2]=b;d[o+3]=255}
  x.putImageData(img,0,0);
  // coastline: a dark stroke where land meets water
  const edge=x.createImageData(W,W),e=edge.data;
  const isW=(u,v)=>{u=Math.max(0,Math.min(W-1,u));v=Math.max(0,Math.min(W-1,v));const o=(v*W+u)*4;return d[o+2]>d[o]+40};
  for(let v=1;v<W-1;v++)for(let u=1;u<W-1;u++){const w=isW(u,v);if(w===isW(u+1,v)&&w===isW(u,v+1)&&w===isW(u-1,v)&&w===isW(u,v-1))continue;const o=(v*W+u)*4;e[o]=46;e[o+1]=58;e[o+2]=68;e[o+3]=w?120:210}
  const ec=document.createElement('canvas');ec.width=ec.height=W;ec.getContext('2d').putImageData(edge,0,0);x.drawImage(ec,0,0);
  // buildings: grey footprints, so a town reads on the map
  for(const b of(LV.footprints||[])){x.save();x.translate(mapX(b.x),mapY(b.z));x.rotate(-b.ry);x.fillStyle='rgba(70,66,60,.78)';const w=b.w/WORLD*W,d=b.d/WORLD*W;x.fillRect(-w/2,-d/2,w,d);x.restore()}
  // roads and courses
  x.lineCap='round';x.lineJoin='round';
  for(const poly of(LV.roads||[])){x.strokeStyle='rgba(42,36,28,.55)';x.lineWidth=4.5;x.setLineDash([]);strokePoly(x,poly);x.strokeStyle='#c9a46a';x.lineWidth=2.4;x.setLineDash([7,5]);strokePoly(x,poly)}
  for(const k of(LV.courses||[])){const pts=k.pts.filter((_,i)=>i%10===0).map(p=>[p.x,p.z]);x.setLineDash([]);x.strokeStyle='rgba(42,36,28,.5)';x.lineWidth=4;strokePoly(x,pts);x.strokeStyle=DIFFC[k.diff];x.lineWidth=2.2;x.setLineDash([5,4]);strokePoly(x,pts)}
  x.setLineDash([]);
  // ski pistes (Gautefall) in their colours, and the chairlift as a black line with its masts
  const PC=['#3fae3a','#3fae3a','#2f6fd6','#d9432f','#1d1c1a'];
  for(const k of(LV.pistes||[])){const pts=k.pts.filter((_,i)=>i%6===0).map(p=>[p.x,p.z]);x.strokeStyle='rgba(255,255,255,.75)';x.lineWidth=7;strokePoly(x,pts);x.strokeStyle=PC[k.def.color??k.diff];x.lineWidth=3.2;strokePoly(x,pts)}
  if(LV.liftDef){const L=LV.liftDef;x.strokeStyle='#14120E';x.lineWidth=1.6;strokePoly(x,[[L.ax,L.az],[L.bx,L.bz]]);x.fillStyle='#14120E';for(const n of L.nodes){x.beginPath();x.arc(mapX(L.ax+L.ux*n.d),mapY(L.az+L.uz*n.d),2.6,0,7);x.fill()}}
  // labels
  x.textAlign='center';x.fillStyle='rgba(42,36,28,.75)';x.font='italic 600 15px "Barlow Condensed",sans-serif';
  for(const[lx,lz,txt]of(def.mapLabels||[])){x.save();x.translate(mapX(lx),mapY(lz));x.rotate(-.05);x.strokeStyle='rgba(233,220,185,.7)';x.lineWidth=4;x.strokeText(txt,0,0);x.fillText(txt,0,0);x.restore()}
  MAP.base=c;
  // fog: visited cells per world
  const FN=MAP.FN;MAP.fog=new Uint8Array(FN*FN);const saved=store.get('fog2:'+def.id,null),old=saved?null:store.get('fog:'+def.id,null);
  if(saved&&saved.length===FN*FN)for(let i=0;i<FN*FN;i++)MAP.fog[i]=saved[i]?1:0;
  else if(old&&old.length===FN*FN)for(let j=0;j<FN;j++)for(let i=0;i<FN;i++)MAP.fog[j*FN+i]=old[j*FN+FN-1-i]?1:0;   // fog saved while the map was mirrored
}
function hexRGB(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]}
function strokePoly(x,poly){x.beginPath();poly.forEach((p,i)=>{const u=mapX(p[0]),v=mapY(p[1]);i?x.lineTo(u,v):x.moveTo(u,v)});x.stroke()}

/* ---------- fog of war ---------- */
function fogSee(wx,wz){const FN=MAP.FN,cs=WORLD/FN;let changed=false;const ci=Math.floor((HALF-wx)/cs),cj=Math.floor((HALF-wz)/cs),R=Math.ceil(9/cs);
  for(let j=cj-R;j<=cj+R;j++)for(let i=ci-R;i<=ci+R;i++){if(i<0||j<0||i>=FN||j>=FN)continue;const cx=HALF-(i+.5)*cs,cz=HALF-(j+.5)*cs;if(Math.hypot(cx-wx,cz-wz)>9)continue;const k=j*FN+i;if(!MAP.fog[k]){MAP.fog[k]=1;changed=true}}
  return changed}
function updateFog(dt){if(!MAP.fog||!car)return;MAP.fogT-=dt;if(MAP.fogT>0)return;MAP.fogT=.5;if(fogSee(car.pos.x,car.pos.z))store.set('fog2:'+LEVELS[state.levelIdx].id,Array.from(MAP.fog))}
// the fog is painted on a tiny canvas (one pixel per cell) and scaled up with smoothing, so its edges are soft
function drawFog(x,W,alpha){const FN=MAP.FN;if(!MAP.fogCv){MAP.fogCv=document.createElement('canvas');MAP.fogCv.width=MAP.fogCv.height=FN+2}
  const fc=MAP.fogCv.getContext('2d'),img=fc.createImageData(FN+2,FN+2),d=img.data,C=hexRGB(MAPCOL.fog);
  for(let j=0;j<FN+2;j++)for(let i=0;i<FN+2;i++){const ii=Math.min(FN-1,Math.max(0,i-1)),jj=Math.min(FN-1,Math.max(0,j-1)),o=(j*(FN+2)+i)*4;d[o]=C[0];d[o+1]=C[1];d[o+2]=C[2];d[o+3]=MAP.fog[jj*FN+ii]?0:255}
  fc.putImageData(img,0,0);x.save();x.globalAlpha=alpha;x.imageSmoothingEnabled=true;const cs=W/FN;x.drawImage(MAP.fogCv,-cs,-cs,W+2*cs,W+2*cs);x.restore()}

/* ---------- markers ---------- */
function drawCar(x,u,v,ang,s){x.save();x.translate(u,v);x.rotate(ang);x.fillStyle='#ff6a2a';x.strokeStyle='#14120E';x.lineWidth=1.5;x.beginPath();x.moveTo(0,-s);x.lineTo(s*.75,s*.8);x.lineTo(0,s*.4);x.lineTo(-s*.75,s*.8);x.closePath();x.fill();x.stroke();x.restore()}
function drawBase(x,u,v,s){x.save();x.translate(u,v);x.fillStyle='#e5a92b';x.strokeStyle='#14120E';x.lineWidth=1.5;x.beginPath();x.moveTo(-s,s*.2);x.lineTo(-s,-s*.3);x.lineTo(0,-s);x.lineTo(s,-s*.3);x.lineTo(s,s*.2);x.lineTo(-s,s*.2);x.closePath();x.fill();x.stroke();x.fillStyle='#14120E';x.fillRect(-s*.3,-s*.35,s*.6,s*.55);x.restore()}
function drawCourseIcon(x,u,v,k,done,s,hot){x.save();x.translate(u,v);x.fillStyle=DIFFC[k.diff];x.strokeStyle=hot?'#fff':'#14120E';x.lineWidth=hot?2.5:1.5;x.beginPath();x.arc(0,0,s,0,6.283);x.fill();x.stroke();
  x.fillStyle='#14120E';x.textAlign='center';x.textBaseline='middle';
  if(done){for(let i=0;i<3;i++)for(let j=0;j<3;j++)if((i+j)%2===0)x.fillRect(-s*.55+i*s*.37,-s*.55+j*s*.37,s*.37,s*.37)}
  else{x.font='700 '+Math.round(s*1.6)+'px "Barlow Condensed",sans-serif';x.fillText('!',0,s*.08)}x.restore()}

/* ---------- minimap ---------- */
function initMaps(){MAP.mini=$('minimap');MAP.miniCtx=MAP.mini.getContext('2d');MAP.mini.addEventListener('pointerdown',e=>{e.stopPropagation();if(state.mode==='play')openMap(true)});MAP.big=$('mapCv');MAP.bigCtx=MAP.big.getContext('2d');
  MAP.big.addEventListener('pointermove',e=>mapHover(e));MAP.big.addEventListener('pointerdown',e=>{mapHover(e);if(MAP.tab==='arch')gpsArchTap(e);else gpsMapTap(e)})}   // a tap sets the GPS (js/gps.js)
function updateMinimap(){const cv=MAP.mini;if(!MAP.base||!car||$('hud').hidden||!state.world||SKI.on){cv.hidden=true;return}cv.hidden=false;
  const S=cv.width,x=MAP.miniCtx,R=S/2,range=15,px=S/(range*2)/(MAP.W/WORLD);   // px: base-pixels → minimap pixels so that `range` world units fit in the radius
  x.clearRect(0,0,S,S);x.save();x.beginPath();x.arc(R,R,R-2,0,6.283);x.clip();x.fillStyle=MAPCOL.fog;x.fillRect(0,0,S,S);
  const ang=mapAng(car.fw);   // heading up
  x.translate(R,R);x.rotate(-ang);x.scale(px,px);x.translate(-mapX(car.pos.x),-mapY(car.pos.z));
  x.drawImage(MAP.base,0,0);drawFog(x,MAP.W,.8);
  x.restore();
  // icons stay upright
  const toMini=(wx,wz)=>{const dx=mapX(wx)-mapX(car.pos.x),dy=mapY(wz)-mapY(car.pos.z),c=Math.cos(-ang),s=Math.sin(-ang);return[R+(dx*c-dy*s)*px,R+(dx*s+dy*c)*px]};
  const lvl=LEVELS[state.levelIdx];
  for(const k of LV.courses){const[u,v]=toMini(k.start.p.x,k.start.p.z);if(Math.hypot(u-R,v-R)>R-9)continue;drawCourseIcon(x,u,v,k,!!best[courseKey(lvl,k)],7,false)}
  if(LV.ferry){const[u,v]=toMini(LV.ferry.quay.x,LV.ferry.quay.z);if(Math.hypot(u-R,v-R)<R-9)drawFerryIcon(x,u,v,7)}
  if(LV.marinaDef){const[u,v]=toMini(LV.marinaDef.x,LV.marinaDef.z);if(Math.hypot(u-R,v-R)<R-9)drawBoatIcon(x,u,v,7)}
  if(LV.airportDef){const[u,v]=toMini(LV.airportDef.x,LV.airportDef.z);if(Math.hypot(u-R,v-R)<R-9)drawPlaneIcon(x,u,v,7)}
  if(lvl.basePos){const[u,v]=toMini(lvl.basePos[0],lvl.basePos[1]);const d=Math.hypot(u-R,v-R);if(d<R-9)drawBase(x,u,v,7);else{const a=Math.atan2(v-R,u-R);x.save();x.translate(R+Math.cos(a)*(R-8),R+Math.sin(a)*(R-8));x.rotate(a);x.fillStyle='#e5a92b';x.beginPath();x.moveTo(5,0);x.lineTo(-4,-4);x.lineTo(-4,4);x.closePath();x.fill();x.restore()}}
  if(typeof netDots==='function')for(const d of netDots()){const[u,v]=toMini(d.x,d.z),dd=Math.hypot(u-R,v-R);if(dd<R-8)drawFriend(x,u,v,d.col,5);else{const a=Math.atan2(v-R,u-R);drawFriend(x,R+Math.cos(a)*(R-8),R+Math.sin(a)*(R-8),d.col,4)}}
  gpsDrawMini(x,toMini,R);
  drawCar(x,R,R,0,7);
  // north
  {const a=-ang;const nu=R+Math.sin(a)*(R-12),nv=R-Math.cos(a)*(R-12);x.fillStyle='#f2e8d0';x.font='700 11px "Barlow Condensed",sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('N',nu,nv)}
  x.strokeStyle='rgba(242,232,208,.5)';x.lineWidth=2;x.beginPath();x.arc(R,R,R-2,0,6.283);x.stroke()}

/* ---------- the island map ---------- */
function openMap(on){if(!state.world||!MAP.base)return;if(on===undefined)on=!MAP.open;MAP.open=on;$('map').hidden=!on;
  if(on){if(state.mode==='play')state.mode='pause';const lvl=LEVELS[state.levelIdx];$('mIsland').textContent=lvl.name;$('mTow').textContent=lvl.basePos?'Tau hjem til basen (20 ⚙)':'Tau til kaia (20 ⚙)';setMapTab(MAP.tab||'island');$('mClose').focus()}
  else if(state.mode==='pause'&&$('pause').hidden)state.mode='play'}
function bigLayout(){const cv=MAP.big,fr=cv.parentElement.parentElement,sz=Math.max(200,Math.min(fr.clientWidth-32,innerHeight*.58));cv.parentElement.style.width=cv.parentElement.style.height=sz+'px';if(cv.width!==sz){cv.width=cv.height=sz}MAP.scale=sz/MAP.W;return sz}
function setMapTab(t){MAP.tab=t;$('mTabIsland').setAttribute('aria-pressed',t==='island');$('mTabArch').setAttribute('aria-pressed',t==='arch');
  if(t==='island')$('mapInfo').textContent=(gpsLive()?'GPS: '+GPS.dest.name+' · '+gpsM(gpsLeft())+' igjen. ':'Trykk der du vil kjøre, så viser GPS-en veien. ')+(coursesDone()+' av '+LV.courses.length+' løyper fullført. Gullmuttere: '+foundOn(LEVELS[state.levelIdx])+' av '+SECRET_PER+' funnet.');else $('mapInfo').textContent='Skjærgården: fergen går mellom kaiene langs de stiplede rutene. Trykk på en øy, så viser GPS-en vei til fergen. Du er på '+LEVELS[state.levelIdx].name+'. Gullmuttere: '+foundSecrets()+' av '+totalSecrets()+'.';gpsChips();drawBigMap()}
function drawBigMap(){if(!MAP.open)return;if(MAP.tab==='arch')return drawArchipelago();const sz=bigLayout(),x=MAP.bigCtx,sc=MAP.scale,lvl=LEVELS[state.levelIdx];
  x.clearRect(0,0,sz,sz);x.save();x.scale(sc,sc);x.drawImage(MAP.base,0,0);drawFog(x,MAP.W,.74);x.restore();
  // dashed line home
  if(lvl.basePos){if(!gpsLive()){x.save();x.setLineDash([6,6]);x.strokeStyle='rgba(229,169,43,.9)';x.lineWidth=2;x.beginPath();x.moveTo(mapX(car.pos.x)*sc,mapY(car.pos.z)*sc);x.lineTo(mapX(lvl.basePos[0])*sc,mapY(lvl.basePos[1])*sc);x.stroke();x.restore()}drawBase(x,mapX(lvl.basePos[0])*sc,mapY(lvl.basePos[1])*sc,10)}
  for(const k of LV.courses)drawCourseIcon(x,mapX(k.start.p.x)*sc,mapY(k.start.p.z)*sc,k,!!best[courseKey(lvl,k)],9,MAP.hover===k);
  if(LV.ferry)drawFerryIcon(x,mapX(LV.ferry.quay.x)*sc,mapY(LV.ferry.quay.z)*sc,10);
  if(LV.marinaDef)drawBoatIcon(x,mapX(LV.marinaDef.x)*sc,mapY(LV.marinaDef.z)*sc,10);
  if(LV.airportDef)drawPlaneIcon(x,mapX(LV.airportDef.x)*sc,mapY(LV.airportDef.z)*sc,10);
  (LV.secrets||[]).forEach((sc2,i)=>{if(!prof.secrets[secretKey(lvl,i)])return;x.save();x.translate(mapX(sc2.x)*sc,mapY(sc2.z)*sc);x.fillStyle='#e6b43a';x.strokeStyle='#5a3a1a';x.lineWidth=1.2;x.beginPath();x.arc(0,0,5,0,6.283);x.fill();x.stroke();x.fillStyle='#5a3a1a';x.beginPath();x.arc(0,0,1.8,0,6.283);x.fill();x.restore()});
  if(typeof netDots==='function')for(const d of netDots())drawFriend(x,mapX(d.x)*sc,mapY(d.z)*sc,d.col,7,d.name);
  gpsDrawBig(x,sc);
  drawCar(x,mapX(car.pos.x)*sc,mapY(car.pos.z)*sc,mapAng(car.fw),9);
  // compass
  x.save();x.translate(sz-36,sz-36);x.fillStyle='rgba(233,220,185,.85)';x.beginPath();x.arc(0,0,24,0,6.283);x.fill();x.strokeStyle=MAPCOL.ink;x.lineWidth=1.5;x.stroke();x.fillStyle='#d9432f';x.beginPath();x.moveTo(0,-20);x.lineTo(5,0);x.lineTo(-5,0);x.closePath();x.fill();x.fillStyle=MAPCOL.ink;x.beginPath();x.moveTo(0,20);x.lineTo(5,0);x.lineTo(-5,0);x.closePath();x.fill();x.font='700 11px "Barlow Condensed",sans-serif';x.textAlign='center';x.fillText('N',0,-26);x.restore()}
// a little ferry: hull and wheelhouse
function drawFerryIcon(x,u,v,s){x.save();x.translate(u,v);x.fillStyle='#3f5f78';x.strokeStyle='#14120E';x.lineWidth=1.2;x.beginPath();x.moveTo(-s,-s*.1);x.lineTo(s,-s*.1);x.lineTo(s*.7,s*.5);x.lineTo(-s*.7,s*.5);x.closePath();x.fill();x.stroke();x.fillStyle='#eef0ea';x.fillRect(-s*.35,-s*.6,s*.7,s*.5);x.strokeRect(-s*.35,-s*.6,s*.7,s*.5);x.fillStyle='#c8463a';x.fillRect(s*.1,-s*.95,s*.18,s*.35);x.restore()}
// the marina: a little motorboat with its windscreen and a wake
function drawBoatIcon(x,u,v,s){x.save();x.translate(u,v);x.strokeStyle='#14120E';x.lineWidth=1.2;x.fillStyle='#f2e8d0';x.beginPath();x.moveTo(-s*1.1,s*.55);x.lineTo(-s*.4,s*.55);x.stroke();
  x.fillStyle='#d9432f';x.beginPath();x.moveTo(-s,-s*.15);x.lineTo(s*.65,-s*.15);x.lineTo(s*1.05,-s*.45);x.lineTo(s*.55,s*.35);x.lineTo(-s*.85,s*.35);x.closePath();x.fill();x.stroke();
  x.fillStyle='#9fd3f0';x.beginPath();x.moveTo(-s*.15,-s*.15);x.lineTo(s*.15,-s*.65);x.lineTo(s*.35,-s*.15);x.closePath();x.fill();x.stroke();x.restore()}
// the airport: a little plane seen from above
function drawPlaneIcon(x,u,v,s){x.save();x.translate(u,v);x.fillStyle='#f2e8d0';x.strokeStyle='#14120E';x.lineWidth=1.2;x.beginPath();
  x.moveTo(0,-s);x.lineTo(s*.18,-s*.3);x.lineTo(s,-s*.05);x.lineTo(s,s*.15);x.lineTo(s*.18,s*.05);x.lineTo(s*.12,s*.65);x.lineTo(s*.45,s*.85);x.lineTo(-s*.45,s*.85);x.lineTo(-s*.12,s*.65);x.lineTo(-s*.18,s*.05);x.lineTo(-s,s*.15);x.lineTo(-s,-s*.05);x.lineTo(-s*.18,-s*.3);x.closePath();x.fill();x.stroke();x.restore()}
// the archipelago: every island as a blob with its name, the ferry routes between them, and where you are
function drawArchipelago(){const sz=bigLayout(),x=MAP.bigCtx,here=LEVELS[state.levelIdx].id;x.clearRect(0,0,sz,sz);
  x.fillStyle='#6fa3c4';x.fillRect(0,0,sz,sz);x.strokeStyle='rgba(255,255,255,.12)';x.lineWidth=1;for(let i=1;i<8;i++){x.beginPath();x.moveTo(i*sz/8,0);x.lineTo(i*sz/8,sz);x.stroke();x.beginPath();x.moveTo(0,i*sz/8);x.lineTo(sz,i*sz/8);x.stroke()}
  const P=id=>{const k=ISLANDS.find(i=>i.id===id);return k?[k.pos[0]*sz,k.pos[1]*sz]:null};
  x.setLineDash([7,6]);x.strokeStyle='rgba(20,18,14,.55)';x.lineWidth=2;for(const[a,b]of ROUTES){const A=P(a),B=P(b);if(!A||!B)continue;x.beginPath();x.moveTo(A[0],A[1]);x.lineTo(B[0],B[1]);x.stroke()}x.setLineDash([]);
  for(const isl of ISLANDS){const l=LEVELS.find(v=>v.id===isl.id);if(!l)continue;const[u,v]=P(isl.id),r=(l.world?sz*.085:sz*.055);const done=starKeys(l).filter(k=>best[k]).length,tot=starKeys(l).length;
    x.save();x.translate(u,v);x.fillStyle='#e9dcb9';x.strokeStyle=isl.id===here?'#ff6a2a':'#5a3a1a';x.lineWidth=isl.id===here?4:2;x.beginPath();for(let i=0;i<=24;i++){const a=i/24*6.283,rr=r*(1+.14*Math.sin(a*3+u)+.08*Math.cos(a*5+v));x.lineTo(Math.cos(a)*rr,Math.sin(a)*rr)}x.closePath();x.fill();x.stroke();
    x.fillStyle='#8aa65a';x.beginPath();x.arc(0,0,r*.55,0,6.283);x.fill();if(l.world||l.id==='vulkan'){x.fillStyle=l.id==='vulkan'?'#6b5a52':'#e8eef2';x.beginPath();x.moveTo(-r*.3,r*.2);x.lineTo(0,-r*.35);x.lineTo(r*.3,r*.2);x.closePath();x.fill()}
    x.fillStyle='#2a241c';x.textAlign='center';x.font='700 '+Math.round(sz*.028)+'px "Barlow Condensed",sans-serif';x.fillText(l.name,0,r+sz*.03);x.font='600 '+Math.round(sz*.022)+'px "Barlow Condensed",sans-serif';x.fillStyle='#4a3a28';x.fillText(done+'/'+tot+(tot>1?' løyper':' løype')+' · '+foundOn(l)+'/'+SECRET_PER+' ⚙',0,r+sz*.055);
    drawFerryIcon(x,r*.75,-r*.75,sz*.014);if(isl.id===here)drawCar(x,0,0,0,sz*.016);
    if(typeof netWhere==='function'){const fr=netWhere().filter(w=>w.lv===isl.id);fr.forEach((w,i)=>{const a=-2.4+i*.75;drawFriend(x,Math.cos(a)*r*.62,Math.sin(a)*r*.62,w.col,sz*.012,w.name)})}
    x.restore()}}
function mapHover(e){if(MAP.tab==='arch'){MAP.big.style.cursor='pointer';return}const r=MAP.big.getBoundingClientRect(),u=(e.clientX-r.left)/MAP.scale,v=(e.clientY-r.top)/MAP.scale;let h=null;for(const k of LV.courses){if(Math.hypot(mapX(k.start.p.x)-u,mapY(k.start.p.z)-v)<14/MAP.scale)h=k}if(h!==MAP.hover){MAP.hover=h;drawBigMap()}MAP.big.style.cursor=h?'pointer':'crosshair'}
function mapInfoText(k){const b=best[LEVELS[state.levelIdx].id+'/'+k.id];const d=Math.hypot(k.start.p.x-car.pos.x,k.start.p.z-car.pos.z)*UNIT_CM/100;
  return k.name+' · '+['','lett','middels','vanskelig'][k.diff]+' · '+k.gates.length+' porter · '+d.toFixed(1).replace('.',',')+' m unna. '+(b?'Beste: '+fmtTime(b.t)+', '+b.p+' straff, '+b.s+' stjerner.':'Ikke kjørt ennå.')}
