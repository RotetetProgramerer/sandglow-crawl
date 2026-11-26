'use strict';
/* =================================================================
   RACE: the races on Racerøya, seen straight from above. Park on the blue square at the start line on the island → «Vil du kjøre race?»
   → the race menu (track, rivals, one or two players) → five red lights → three laps against the others → the result → back to the car.
   Steering: ← → (or A D), gas ↑ (W), brake and reverse ↓ (S), handbrake SPACE or SHIFT. Two players share the keyboard:
   player 1 WASD and SPACE, player 2 the arrows and ENTER (or right SHIFT, or -). Z and X zoom. R puts the car back on the track.
   The physics and the rivals are in js/racesim.js, the tracks in data/racer.js. This file draws everything on its own 2D canvas
   (the track as paths in world metres, scaled by the camera), keeps the HUD, the menus, the sound (WebAudio, no files) and the prizes.
   Loaded after grotte.js; uses the globals of game.js (state, prof, best, store, AC, keys, $, toast …) at run time.
   ================================================================= */
const RC={on:false,fade:null,phase:'',track:null,T:null,R:null,two:false,lvl:1,cv:null,ctx:null,dpr:1,W:0,H:0,views:[],parts:[],codes:new Set(),
  skid:null,deco:null,paths:null,pat:{},snd:null,paused:false,t0:0,countT:0,lights:0,goT:0,finT:0,zoom:1,result:null,sprites:new Map(),hudT:0,cheer:0,flash:0};
const RC_FONT='"Saira Stencil One", Impact, "Arial Narrow", sans-serif',RC_BODY='"Barlow Condensed", "Arial Narrow", sans-serif';
const rcKey=tr=>'racer/'+tr.id;
const rcTrack=()=>RACE_TRACKS.find(t=>t.id===(RC.net?RC.net.track:store.get('raceTrack','palme')))||RACE_TRACKS[0];   // online: the leader's track (js/racenet.js)
const rcHex=h=>{const n=parseInt(h.slice(1),16);return[n>>16&255,n>>8&255,n&255]};
const rcShade=(h,f)=>{const c=rcHex(h);return'rgb('+c.map(v=>Math.max(0,Math.min(255,Math.round(f<1?v*f:v+(255-v)*(f-1))))).join(',')+')'};
const rcSpeedTxt=u=>Math.round(Math.abs(u)*3.6)+' km/t';
const rcPlace=n=>n+'.';

/* ---------- the track: paths in world metres, patterns, decor (once per track) ---------- */
// a polyline offset to the side of the centre line, broken where it folds over itself (the inside of a tight corner)
function rcOffset(T,off,filter){const P=T.pts,N=T.N,runs=[];let cur=null;
  for(let i=0;i<=N;i++){const p=P[i%N],x=p.x+p.nx*off,y=p.y+p.ny*off;let ok=true;
    if(filter){const q=trackAt(T,x,y);ok=Math.abs(q.d)>=Math.abs(off)-.6}
    if(ok){if(!cur){cur=[];runs.push(cur)}cur.push([x,y])}else cur=null}
  return runs}
function rcPath(runs,close){const p=new Path2D();for(const r of runs){r.forEach((q,i)=>i?p.lineTo(q[0],q[1]):p.moveTo(q[0],q[1]));if(close)p.closePath()}return p}
// is (x,y) inside the loop of the centre line?
function rcInside(T,x,y){const P=T.pts;let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)c=!c}return c}
function rcPattern(ctx,size,draw,scale){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const p=ctx.createPattern(c,'repeat');
  if(p.setTransform&&typeof DOMMatrix!=='undefined')p.setTransform(new DOMMatrix().scale(scale));return p}
function rcNoiseTile(x,s,base,spots,n,r0,r1){x.fillStyle=base;x.fillRect(0,0,s,s);const R=mulberry32(s*7+n);for(let i=0;i<n;i++){x.fillStyle=spots[i%spots.length];x.globalAlpha=.15+R()*.3;const r=r0+R()*(r1-r0);x.beginPath();x.arc(R()*s,R()*s,r,0,6.283);x.fill()}x.globalAlpha=1}
function rcBuildTrack(tr){const T=RC.T=makeTrack(tr),ctx=RC.ctx,look=tr.look,P=T.pts,N=T.N,R=mulberry32(tr.id.length*977+13);
  const center=[P.map(p=>[p.x,p.y])],cp=rcPath(center,true);
  const sandC=look.sand,grassC=look.grass,offC=T.off==='sand'?look.sand:look.grass2;
  RC.pat={
    sea:rcPattern(ctx,256,(x,s)=>{x.fillStyle=look.sea;x.fillRect(0,0,s,s);const r=mulberry32(5);x.strokeStyle='rgba(255,255,255,.16)';x.lineWidth=2;
      for(let i=0;i<46;i++){const px=r()*s,py=r()*s,w=10+r()*26;x.beginPath();x.moveTo(px-w,py);x.quadraticCurveTo(px,py-5,px+w,py);x.stroke()}
      x.fillStyle='rgba(0,30,60,.12)';for(let i=0;i<30;i++){x.beginPath();x.arc(r()*s,r()*s,8+r()*20,0,6.283);x.fill()}},.25),
    grass:rcPattern(ctx,128,(x,s)=>{rcNoiseTile(x,s,grassC,[rcShade(grassC,.85),rcShade(grassC,1.12),rcShade(grassC,.75)],260,1,3.5)},1/8),
    off:rcPattern(ctx,128,(x,s)=>{rcNoiseTile(x,s,offC,T.off==='sand'?[rcShade(offC,.88),rcShade(offC,1.08),'#a08a60']:[rcShade(offC,.9),rcShade(offC,1.1)],T.off==='sand'?420:240,.8,2.6);
      if(T.off!=='sand'){x.fillStyle='rgba(255,255,255,.05)';x.fillRect(0,0,s,s/2)}},1/8),
    sand:rcPattern(ctx,128,(x,s)=>rcNoiseTile(x,s,sandC,[rcShade(sandC,.9),rcShade(sandC,1.06),'#b89a6a'],400,.6,2),1/8),
    road:rcPattern(ctx,64,(x,s)=>{rcNoiseTile(x,s,look.dark?'#3f3d3f':'#4b4b4e',['#5a5a5e','#3a3a3c','#626266'],380,.4,1.3)},1/16),
  };
  // gravel traps on the outside of the corners: a strip between the curb and the wall
  let traps=[];{let cur=null;for(let i=0;i<=N;i++){const p=P[i%N];if(p.curb&&Math.abs(p.k)>1/70){const sg=p.k>0?-1:1,off=sg*(T.hw+2+(T.wallD-T.hw-2)/2);if(!cur){cur=[];traps.push({run:cur})}cur.push([p.x+p.nx*off,p.y+p.ny*off])}else cur=null}}traps=traps.filter(t=>t.run.length>4);
  // curbs: runs of samples with p.curb, on both sides
  const curbs=[];for(const sg of[-1,1]){let cur=null;for(let i=0;i<=N;i++){const p=P[i%N];if(p.curb){if(!cur){cur=[];curbs.push(cur)}const o=sg*(T.hw+.65);cur.push([p.x+p.nx*o,p.y+p.ny*o])}else cur=null}}
  RC.paths={cp,land:cp,edgeL:rcPath([P.map(p=>[p.x-p.nx*(T.hw-.45),p.y-p.ny*(T.hw-.45)])],true),edgeR:rcPath([P.map(p=>[p.x+p.nx*(T.hw-.45),p.y+p.ny*(T.hw-.45)])],true),
    wallL:rcPath(rcOffset(T,-(T.wallD+.7),true)),wallR:rcPath(rcOffset(T,T.wallD+.7,true)),traps:rcPath(traps.map(t=>t.run)),curbs:rcPath(curbs)};
  // which side of the start straight is the outside of the loop
  const p0=P[0],outS=rcInside(T,p0.x+p0.nx*(T.wallD+12),p0.y+p0.ny*(T.wallD+12))?-1:1;T.outS=outS;
  // decor: grandstands and the start gantry by the start straight, the pit building on the inside, billboards, tyre stacks, trees, boats
  const D=RC.deco={stands:[],trees:[],boards:[],tyres:[],boats:[],rocks:[],pit:null,gantry:null,volcano:null,light:null};
  const at=(s,off)=>trackPos(T,s,off);
  // the straight round the start line: from where it begins behind the grid to where it ends after the line
  let s0=0,s1=0;for(let i=N-1;i>N/2&&Math.abs(P[i].k)<1/260;i--)s0=P[i].s-T.L;for(let i=0;i<N/2&&Math.abs(P[i].k)<1/260;i++)s1=P[i].s;T.straight=[s0,s1];
  for(let k=0;k<look.stands;k++){const s=s1-22-k*34;if(s<s0+16)break;const q=at(s,outS*(T.wallD+8.5));D.stands.push({x:q.x,y:q.y,a:q.a+(outS<0?Math.PI:0),w:30,d:10,seed:k})}
  {const q=at(0,0);D.gantry={x:q.x,y:q.y,a:q.a}}
  {const len=Math.min(70,s1-s0-24),q=at(Math.max(s0+len/2+8,Math.min(s1-len/2-8,-20)),-outS*(T.wallD+14));if(len>30)D.pit={x:q.x,y:q.y,a:q.a+(outS<0?Math.PI:0),w:len,d:12}}
  const BOARDS=['RACERØYA','SKARE','MUTTER-OLJE','KJAPP DEKK','KAPTEIN THEIS','PALMEBRUS','SLADDEKONGEN','TURBO-TOVE'];
  for(let i=0,b=0;i<N;i+=9){const p=P[i];if(Math.abs(p.k)<1/400&&R()<.18&&i>30&&i<N-60){const sg=R()<.5?-1:1,q=at(p.s,sg*(T.wallD+2.2));D.boards.push({x:q.x,y:q.y,a:q.a,text:BOARDS[b++%BOARDS.length],col:['#d9432f','#2f6fd6','#e5a92b','#14120E'][b%4]})}}
  // corner signs: yellow chevrons on the outside of every sharp corner, and 100 and 50 boards before the ones you must brake for
  D.chev=[];D.brake=[];for(let i=0;i<N;i+=5){const p=P[i];if(Math.abs(p.k)>1/45){const sg=p.k>0?-1:1,q=at(p.s,sg*(T.wallD+1.9));D.chev.push({x:q.x,y:q.y,a:q.a,dir:p.k>0?1:-1})}}
  for(let i=0,last=-99;i<N;i++){const p=P[i],prev=P[(i-8+N)%N];if(i-last>40&&Math.abs(p.k)>1/45&&Math.abs(prev.k)<=1/60&&T.vmax[i]<RCFG.vtop*.8){last=i;const sg=p.k>0?-1:1;
    for(const m of[100,50]){const q=at(p.s-m,sg*(T.wallD+1.9));if(Math.abs(trackAt(T,q.x,q.y).d)>T.wallD)D.brake.push({x:q.x,y:q.y,a:q.a,m})}}}
  for(let i=0;i<N;i+=4){const p=P[i];if(Math.abs(p.k)>1/55&&R()<.5){const sg=p.k>0?-1:1,q=at(p.s,sg*(T.wallD+2.4));D.tyres.push({x:q.x,y:q.y,n:3+Math.floor(R()*4),a:R()*6.28})}}
  const free=(x,y,m)=>{const q=trackAt(T,x,y);if(Math.abs(q.d)<T.wallD+m)return false;for(const s of D.stands)if(Math.hypot(s.x-x,s.y-y)<s.w*.6+m)return false;
    if(D.pit&&Math.hypot(D.pit.x-x,D.pit.y-y)<D.pit.w*.55+m)return false;return true};
  // the land: everything within LAND m of the centre line is island
  const LAND=T.wallD+42,b=T.bounds;T.land=LAND;
  if(look.dark){const cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;let best=null;for(let k=0;k<400;k++){const x=b.x0+R()*(b.x1-b.x0),y=b.y0+R()*(b.y1-b.y0);if(!rcInside(T,x,y))continue;const d=Math.abs(trackAt(T,x,y).d);if(!best||d>best.d)best={x,y,d}}
    if(best&&best.d>T.wallD+14)D.volcano={x:best.x,y:best.y,r:Math.min(42,best.d-T.wallD-4)}}
  for(let k=0;k<2600&&D.trees.length<150;k++){const x=b.x0-LAND+R()*(b.x1-b.x0+2*LAND),y=b.y0-LAND+R()*(b.y1-b.y0+2*LAND),q=trackAt(T,x,y),ad=Math.abs(q.d);
    if(ad<T.wallD+4||(ad>LAND-8&&!rcInside(T,x,y)))continue;if(!free(x,y,4))continue;if(D.volcano&&Math.hypot(x-D.volcano.x,y-D.volcano.y)<D.volcano.r+3)continue;
    if(D.trees.some(t=>Math.hypot(t.x-x,t.y-y)<5.5))continue;D.trees.push({x,y,s:.8+R()*.55,a:R()*6.28,k:Math.floor(R()*3)})}
  if(look.dark)for(let k=0;k<300&&D.rocks.length<60;k++){const x=b.x0-LAND+R()*(b.x1-b.x0+2*LAND),y=b.y0-LAND+R()*(b.y1-b.y0+2*LAND),q=trackAt(T,x,y),ad=Math.abs(q.d);if(ad<T.wallD+3||ad>LAND-6||!free(x,y,2))continue;D.rocks.push({x,y,r:.8+R()*2.2,a:R()*6.28})}
  // sailing boats round the island, and a lighthouse at the far end
  for(let k=0;k<9;k++){const ang=R()*6.283,cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2,r=Math.max(b.x1-b.x0,b.y1-b.y0)/2+LAND+20+R()*80;D.boats.push({x:cx+Math.cos(ang)*r,y:cy+Math.sin(ang)*r,a:R()*6.28,v:1.5+R()*2.5,sail:R()<.6,col:['#f2e8d0','#d9432f','#2f6fd6','#e5a92b'][k%4]})}
  {let far=null;for(const p of P){const q=at(p.s,outS*(LAND-6)),dd=Math.hypot(q.x-(b.x0+b.x1)/2,q.y-(b.y0+b.y1)/2);if(!far||dd>far.d)far={x:q.x,y:q.y,d:dd}}if(far&&free(far.x,far.y,3))D.light=far}
  // the skid marks: a canvas over the whole track at 3 px per metre
  const PX=3,pad=T.wallD+6;RC.skid={x0:b.x0-pad,y0:b.y0-pad,px:PX,cv:document.createElement('canvas')};RC.skid.cv.width=Math.ceil((b.x1-b.x0+2*pad)*PX);RC.skid.cv.height=Math.ceil((b.y1-b.y0+2*pad)*PX);
  RC.skid.ctx=RC.skid.cv.getContext('2d');RC.skid.ctx.lineCap='round';
  // the minimap: the centre line scaled into a box
  RC.mini={b,w:b.x1-b.x0,h:b.y1-b.y0};
  return T}

/* ---------- sprites: the cars and the palms, drawn once into small canvases ---------- */
const RC_SPX=24;   // pixels per metre in the sprites
function rcCarSprite(col,num,stripe){const key=col+'/'+num+'/'+stripe;if(RC.sprites.has(key))return RC.sprites.get(key);
  const L=RCFG.len,W=RCFG.wid,S=RC_SPX,c=document.createElement('canvas');c.width=Math.ceil((L+.6)*S);c.height=Math.ceil((W+.8)*S);const x=c.getContext('2d');
  x.translate(c.width/2,c.height/2);x.scale(S,S);
  const rr=(px,py,w,h,r)=>{x.beginPath();x.moveTo(px+r,py);x.lineTo(px+w-r,py);x.quadraticCurveTo(px+w,py,px+w,py+r);x.lineTo(px+w,py+h-r);x.quadraticCurveTo(px+w,py+h,px+w-r,py+h);x.lineTo(px+r,py+h);x.quadraticCurveTo(px,py+h,px,py+h-r);x.lineTo(px,py+r);x.quadraticCurveTo(px,py,px+r,py);x.closePath()};
  // rear wheels (the front wheels turn, they are drawn with the car)
  x.fillStyle='#141414';for(const sy of[-1,1])x.fillRect(-1.75,sy*(W/2+.05)-.22,1.0,.44);
  // the body: a wedge with a rounded nose
  x.fillStyle=col;x.strokeStyle='rgba(0,0,0,.55)';x.lineWidth=.08;
  x.beginPath();x.moveTo(-L/2+.15,-W/2+.05);x.lineTo(L/2-.75,-W/2+.08);x.quadraticCurveTo(L/2,-W/2+.25,L/2,-.2);x.lineTo(L/2,.2);x.quadraticCurveTo(L/2,W/2-.25,L/2-.75,W/2-.08);x.lineTo(-L/2+.15,W/2-.05);x.quadraticCurveTo(-L/2,W/2-.1,-L/2,W/2-.3);x.lineTo(-L/2,-W/2+.3);x.quadraticCurveTo(-L/2,-W/2+.1,-L/2+.15,-W/2+.05);x.closePath();x.fill();x.stroke();
  // shading: lighter along the middle, darker sides
  const g=x.createLinearGradient(0,-W/2,0,W/2);g.addColorStop(0,'rgba(0,0,0,.28)');g.addColorStop(.3,'rgba(255,255,255,.08)');g.addColorStop(.5,'rgba(255,255,255,.18)');g.addColorStop(.7,'rgba(255,255,255,.08)');g.addColorStop(1,'rgba(0,0,0,.3)');x.fillStyle=g;x.fill();
  // stripes over the whole car
  x.fillStyle=stripe;x.globalAlpha=.9;x.fillRect(-L/2+.1,-.36,L-.2,.2);x.fillRect(-L/2+.1,.16,L-.2,.2);x.globalAlpha=1;
  // windscreen, roof and rear window
  x.fillStyle='#1d2630';rr(.15,-.72,.85,1.44,.25);x.fill();x.fillStyle='rgba(160,200,230,.35)';rr(.3,-.6,.35,1.2,.15);x.fill();
  x.fillStyle=col;rr(-1.0,-.7,1.15,1.4,.2);x.fill();x.fillStyle='rgba(255,255,255,.12)';rr(-1.0,-.7,1.15,1.4,.2);x.fill();
  x.fillStyle='#1d2630';rr(-1.45,-.62,.45,1.24,.15);x.fill();
  // the number on the roof
  x.fillStyle='#f2e8d0';x.beginPath();x.arc(-.42,0,.46,0,6.283);x.fill();x.strokeStyle='#14120E';x.lineWidth=.06;x.stroke();
  x.save();x.translate(-.42,0);x.rotate(Math.PI/2);x.fillStyle='#14120E';x.font='700 .62px '+RC_BODY;x.textAlign='center';x.textBaseline='middle';x.fillText(String(num),0,.04);x.restore();
  // the rear wing, headlights and tail lights
  x.fillStyle='#1a1a1a';x.fillRect(-L/2-.18,-W/2+.02,.34,W-.04);x.fillStyle=col;x.fillRect(-L/2-.12,-W/2+.08,.2,W-.16);
  x.fillStyle='#fff6d0';for(const sy of[-1,1]){x.beginPath();x.ellipse(L/2-.28,sy*.62,.18,.12,0,0,6.283);x.fill()}
  x.fillStyle='#7a1010';for(const sy of[-1,1])x.fillRect(-L/2+.02,sy*.62-.14,.1,.28);
  RC.sprites.set(key,c);return c}
function rcPalmSprite(k){const key='palm'+k;if(RC.sprites.has(key))return RC.sprites.get(key);const S=10,r=4.2,c=document.createElement('canvas');c.width=c.height=Math.ceil(r*2*S+4);const x=c.getContext('2d');x.translate(c.width/2,c.height/2);x.scale(S,S);
  const n=7+k,cols=[['#2f7a2a','#4a9a36','#62b048'],['#3a7f2e','#559f3a','#7ab84c'],['#2a6a30','#3f8a3a','#5aa04a']][k%3];
  for(let i=0;i<n;i++){const a=i/n*6.283+k,len=r*(.82+.18*Math.sin(i*2.1));x.save();x.rotate(a);
    x.fillStyle=cols[i%2];x.beginPath();x.moveTo(0,0);x.quadraticCurveTo(len*.5,-.75,len,0);x.quadraticCurveTo(len*.5,.75,0,0);x.fill();
    x.strokeStyle=cols[2];x.lineWidth=.08;x.beginPath();x.moveTo(.2,0);x.lineTo(len*.95,0);x.stroke();x.restore()}
  x.fillStyle='#6a4a2a';x.beginPath();x.arc(0,0,.45,0,6.283);x.fill();x.fillStyle='#4a3218';for(const[a,b]of[[.3,.2],[-.25,.3],[0,-.35]]){x.beginPath();x.arc(a,b,.2,0,6.283);x.fill()}
  RC.sprites.set(key,c);return c}

/* ---------- in and out ---------- */
function raceAsk(k){if(k==='raceInvite'){const v=RC.invite,tr=v&&RACE_TRACKS.find(t=>t.id===v.track);$('aYes').hidden=false;$('aList').hidden=true;$('aKind').textContent='Kjør sammen · race';$('aName').textContent=tr?tr.name:'Racerløpet';
    $('aDesc').textContent=(v?v.name:'En venn')+' vil kjøre race mot deg på Racerøya, sett ovenfra. Du blir med fra der du er, og bilen din blir stående.';$('aBest').textContent='';$('aQ').textContent='Vil du bli med?';$('aNo').textContent='Nei takk';$('ask').hidden=false;$('aYes').focus();return}
  const tr=rcTrack(),n=RACE_TRACKS.filter(t=>best[rcKey(t)]).length;$('aYes').hidden=false;$('aList').hidden=true;
  $('aKind').textContent='Racerøya · startstreken';$('aName').textContent='Racerløpet';
  $('aDesc').textContent='Sett deg i en racerbil og kjør tre runder mot fem andre på banen, sett ovenfra. Sladd gjennom svingene, dult de andre av veien og kom først i mål. Bilen din venter her.';
  $('aBest').textContent=n?'Du har kjørt '+n+' av '+RACE_TRACKS.length+' baner.':'Første seier på hver bane gir '+RACE_FIRST_WIN+' muttere ekstra.';$('aQ').textContent='Vil du kjøre race?';$('aNo').textContent='NEI, kjør videre';$('ask').hidden=false;$('aYes').focus()}
function raceAnswer(k,yes){if(k==='raceInvite'){const v=RC.invite;state.mode='play';if(yes&&v)raceEnter(v);else{if(v)rnSend({t:'Rl',id:v.id});RC.invite=null}return}
  if(yes)raceEnter();else{state.mode='play';state.askCool='race';toast('Kjør videre når du vil')}}
function raceEnter(join){if(RC.on||RC.fade)return;initAudio();if(AC&&AC.state==='suspended')AC.resume();state.mode='race';car.vel.set(0,0,0);car.w.set(0,0,0);car.throttle=0;setOffer(null);
  $('fade').classList.add('on');RC.fade={t:0,hold:.25,cb:()=>{RC.on=true;RC.two=!!store.get('raceTwo',false);RC.lvl=store.get('raceLvl',1);$('hud').hidden=true;$('hint').hidden=true;$('raceHud').hidden=false;rcLayout();if(join&&join.id)rnJoin(join);rcMenu()}}}
function raceExit(){if(RC.fade||!RC.on)return;rnLeave();$('fade').classList.add('on');
  RC.fade={t:0,hold:.2,cb:()=>{RC.on=false;RC.phase='';RC.paused=false;RC.R=null;if(RC.snd)RC.snd.master.gain.setTargetAtTime(0,AC.currentTime,.1);
    for(const id of['raceHud','raceMenu','racePause','raceResult'])$(id).hidden=true;state.mode='play';state.askCool='race';camSnap=true;showHud();toast('Tilbake ved bilen')}}}

/* ---------- the race menu ---------- */
function rcMenu(){const N=RC.net;if(N){if(N.racing&&N.lead!==NET.me)rnSend({t:'Rr',id:N.id,ready:1});N.racing=false;RC.lvl=N.lvl;if(N.lead===NET.me)setTimeout(rnList,0)}RC.phase='menu';RC.paused=false;RC.R=null;for(const id of['racePause','raceResult'])$(id).hidden=true;const tr=rcTrack();if(!RC.T||RC.track!==tr){RC.track=tr;rcBuildTrack(tr)}RC.menuT=0;
  rcMenuRender();$('raceMenu').hidden=false;$('rmGo').focus()}
function rcMenuRender(){rcCamTxt();const sel=rcTrack(),touch=document.body.classList.contains('is-touch');
  $('rmTracks').innerHTML=RACE_TRACKS.map(t=>{const b=best[rcKey(t)],st=b?'★'.repeat(b.s||0)+'☆'.repeat(3-(b.s||0)):'☆☆☆';
    return`<button data-track="${t.id}" aria-pressed="${t===sel}"><span><span class="nm"><i class="pdot" style="background:${DIFFCOL[t.diff]}"></i>${t.name}</span><span class="sub">${t.desc}${b&&b.t?' Beste: '+fmtTime(b.t)+(b.lap?', runde '+fmtTime(b.lap):'')+'.':''}</span></span><span class="pr">${st}</span></button>`}).join('');
  RACE_LEVELS.forEach((L,i)=>$('rmLv'+i).setAttribute('aria-pressed',i===RC.lvl));$('rm1').setAttribute('aria-pressed',!RC.two);$('rm2').setAttribute('aria-pressed',RC.two);
  $('rmKeys').innerHTML=RC.two?'<b>Spiller 1</b> (lakken din): W A S D, håndbrekk SPACE. <b>Spiller 2</b> (blå): piltastene, håndbrekk ENTER.'
    :touch?'Styr med pilene til venstre. Gass, brems og håndbrekk til høyre.':'Piltastene eller W A S D. Håndbrekk: SPACE eller SHIFT. R setter bilen tilbake på banen.';
  const L=RACE_LEVELS[RC.lvl];$('rmLvNote').textContent=L.name+' motstandere: '+(RC.lvl===0?'de kjører forsiktig og bremser tidlig.':RC.lvl===1?'de kjører fort, men gjør feil.':'de kjører på grensen hele veien.')+' Premien ganges med '+String(L.nuts).replace('.',',')+'.';rnMenu()}
// the colours: player 1 drives in the car's paint, player 2 in blue (red when the paint is blue)
function rcColors(){const c=(PAINTS[prof.paint]||PAINTS[0]).c,rgb=rcHex(c);return[c,rgb[2]>rgb[0]+30?'#e0443a':'#3b8cf0']}

/* ---------- the start: the grid, five red lights, go ---------- */
function rcStart(netEnts,netGo){if(RC.net&&!netEnts){rnStart();return}const tr=RC.track,T=RC.T,L=RACE_LEVELS[RC.lvl],cols=rcColors(),nh=RC.two?2:1,rivals=RACE_RIVALS.slice();
  // shuffle the rivals so the grid is different every time; humans start at the back
  for(let i=rivals.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[rivals[i],rivals[j]]=[rivals[j],rivals[i]]}
  const humCols=cols.slice(0,nh).map(rcHex),far=r=>humCols.every(h=>{const c=rcHex(r.col);return Math.abs(c[0]-h[0])+Math.abs(c[1]-h[1])+Math.abs(c[2]-h[2])>150});
  rivals.sort((a,b)=>far(b)-far(a));
  let ents=rivals.slice(0,6-nh).map((r,i)=>({name:r.name,col:r.col,num:r.num,skill:L.skill*(1-.025*Math.random())*(1-.004*i)}));
  for(let h=0;h<nh;h++)ents.push({name:nh>1?'Spiller '+(h+1):'Deg',col:cols[h],num:h?2:1,human:true,pi:h});
  if(netEnts)ents=netEnts.map(e=>Object.assign({pi:0},e));   // online (js/racenet.js): the leader's grid
  RC.R=makeRace(T,ents,tr.laps);RC.R.cars.forEach(c=>{c.base=c.skill;if(c.human)c.pi=ents[c.idx].pi;c.stripe=c.col==='#f2e8d0'?'#14120E':'#f2e8d0'});
  RC.humans=RC.R.cars.filter(c=>c.human).sort((a,b)=>a.pi-b.pi);RC.views=RC.humans.map((c,i)=>({car:c,cx:c.x+Math.cos(c.a)*8,cy:c.y+Math.sin(c.a)*8,z:1,notice:'',noticeT:0,noticeBad:false,lastPos:6,i}));
  RC.parts.length=0;RC.skid.ctx.clearRect(0,0,RC.skid.cv.width,RC.skid.cv.height);RC.prevW=RC.R.cars.map(()=>null);
  RC.phase='count';RC.countT=0;RC.lights=0;RC.goAt=netGo||4.2+.4+Math.random()*.9;RC.finT=0;RC.result=null;RC.paused=false;RC.flash=0;
  for(const id of['raceMenu','racePause','raceResult'])$(id).hidden=true;rcLayout();rcNotice(null,'Gjør deg klar!',1400)}
// the lights: one more red every .8 s, all five on, then out together (that is the start)
function rcCount(dt){RC.countT+=dt;const n=Math.min(5,Math.floor((RC.countT-.6)/.8)+1);if(RC.countT>.6&&n>RC.lights){RC.lights=n;rcBeep(440,.18)}
  if(RC.countT>=RC.goAt){RC.lights=0;RC.phase='race';RC.R.phase='race';rcBeep(880,.5);rcNotice(null,'KJØR!',900)}}

/* ---------- input ---------- */
addEventListener('keydown',e=>{if(!RC.on)return;RC.codes.add(e.code);if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)&&RC.phase!=='menu')e.preventDefault()});
addEventListener('keyup',e=>RC.codes.delete(e.code));addEventListener('blur',()=>RC.codes.clear());
function rcInput(c){const K=RC.codes,ti=state.input,two=RC.two,i=c.pi||0;let gas=0,brake=0,steer=0,hb=0;
  const has=(...a)=>a.some(k=>K.has(k));
  if(!two||i===0){if(has('KeyW'))gas=1;if(has('KeyS'))brake=1;if(has('KeyA'))steer-=1;if(has('KeyD'))steer+=1;if(has('Space','ShiftLeft'))hb=1}
  if(!two||i===1){if(has('ArrowUp'))gas=1;if(has('ArrowDown'))brake=1;if(has('ArrowLeft'))steer-=1;if(has('ArrowRight'))steer+=1;if(has(two?'Enter':'ShiftRight','ShiftRight','Slash','Minus','Period','Numpad0','ControlRight'))hb=1}
  if(i===0){gas=Math.max(gas,ti.gas||0);brake=Math.max(brake,ti.rev||0);steer+=(ti.right||0)-(ti.left||0);hb=Math.max(hb,ti.hb||0)}
  const pads=navigator.getGamepads?[...navigator.getGamepads()].filter(g=>g&&g.connected):[],gp=pads[two?i:0];
  if(gp){const ax=gp.axes[0]||0;if(Math.abs(ax)>.12)steer+=ax;gas=Math.max(gas,gp.buttons[7]?gp.buttons[7].value:0);brake=Math.max(brake,gp.buttons[6]?gp.buttons[6].value:0);
    if((gp.buttons[0]&&gp.buttons[0].pressed)||(gp.buttons[5]&&gp.buttons[5].pressed)||(gp.buttons[2]&&gp.buttons[2].pressed))hb=1}
  return{gas,brake,steer:Math.max(-1,Math.min(1,steer)),hb}}
function raceKeyDown(k){if(RC.fade||!RC.on)return;
  if(RC.phase==='menu'){if(k==='escape')raceExit();else if(k==='enter'&&document.activeElement===document.body)rcStart();return}
  if(RC.phase==='result'){if(k==='escape')rcMenu();return}
  if(k==='escape'||k==='p'){rcPause($('racePause').hidden);return}if(!$('racePause').hidden)return;
  if(k==='m')setSound(!state.sound);
  if(k==='c')rcCam();
  if(k==='z')rcZoom(1.12);if(k==='x')rcZoom(1/1.12);
  if(k==='r'&&RC.phase==='race')for(const c of RC.humans)if(!c.done&&(!RC.two||c.pi===0))rcReset(c);
  if(k==='backspace'&&RC.two&&RC.phase==='race'){const c=RC.humans[1];if(c&&!c.done)rcReset(c)}}
// the camera: «Nord opp» (the track stands still, the default) or «Følger bilen» (the view turns with the car)
function rcCam(set){RC.camRot=set==null?!RC.camRot:!!set;store.set('raceCamRot',RC.camRot);rcCamTxt();for(const v of RC.views)rcNotice(v,RC.camRot?'Kamera: følger bilen':'Kamera: nord opp',1100)}
function rcCamTxt(){const t='Kamera: '+(RC.camRot?'følger bilen':'nord opp');for(const id of['rmCam','rpCam'])if($(id))$(id).textContent=t}
function rcZoom(f){RC.zoom=Math.max(.6,Math.min(1.7,RC.zoom*f));store.set('raceZoom',RC.zoom)}
// back on the track: on the centre line where the car is, facing the right way, stopped
function rcReset(c){const s=c.s;placeRaceCar(c,RC.T,s,0);c.s=s;const v=RC.views.find(q=>q.car===c);if(v)rcNotice(v,'Tilbake på banen',1000)}
function rcPause(on){if(!RC.on||!['count','race','finish'].includes(RC.phase))return;RC.paused=!!on;$('racePause').hidden=!on;if(on){const onl=rnRacing();$('rpRestart').hidden=onl;$('rpMenu').textContent=onl?'Forlat løpet':'Velg bane';$('rpNote').textContent=onl?'Løpet går videre for de andre mens du er her.':'';rcCamTxt();$('rpSound').textContent='Lyd: '+(state.sound?'på':'av');$('rpResume').focus()}}

/* ---------- every frame (from game.js) ---------- */
function updateRace(dt){
  if(RC.fade){const f=RC.fade;f.t+=dt;if(f.t>.9&&!f.done){f.done=true;f.cb()}if(f.t>.9+f.hold){$('fade').classList.remove('on');RC.fade=null}}
  if(!RC.on)return false;
  const R=RC.R;
  if(R&&(!RC.paused||rnRacing())){
    if(RC.phase==='count')rcCount(dt);
    // the rivals ease off a little when they are far ahead of the humans, and push when far behind
    if(RC.phase==='race'){const hp=Math.max(...RC.humans.map(c=>c.prog));for(const c of R.cars)if(!c.human){const gap=c.prog-hp;c.skill=c.base*(gap>120?.95:gap>60?.98:gap<-150?1.03:1)}}
    const ev=raceStep(R,rcInput,dt);rcEvents(ev);rnTick(dt);
    for(const c of RC.humans)if(c.wrongT>1.5){const v=RC.views.find(q=>q.car===c);if(v&&v.noticeT<=0)rcNotice(v,'Feil vei!',1200,true)}
    if(RC.phase==='finish'){RC.finT+=dt;if(RC.finT>3.2)rcResult()}}
  rcEffects(dt);rcSndUpdate(dt);rcDraw(dt);return true}
function rcEvents(ev){const R=RC.R;
  for(const e of ev){const c=e.car,v=RC.views.find(q=>q.car===c),near=rcNearCam(e.x,e.y);
    if(e.type==='wall'){if(near>0){rcThump(Math.min(1,e.v/14)*near);for(let i=0;i<Math.min(14,e.v);i++)rcPart(e.x,e.y,'spark')}if(v){v.shake=Math.min(1,e.v/12);buzz(v.shake,60+80*v.shake,RC.views.indexOf(v))}}
    else if(e.type==='bump'){if(near>0&&c.idx<e.other.idx){rcThump(Math.min(1,e.v/10)*near*.8,1);for(let i=0;i<6;i++)rcPart(e.x,e.y,'spark')}if(v){v.shake=Math.min(.8,e.v/12);buzz(v.shake,50+60*v.shake,RC.views.indexOf(v))}}
    else if(e.type==='boost'){if(v){rcNotice(v,e.charge>1.8?'SUPERTURBO!':'TURBO!',900);rcWhoosh()}}
    else if(e.type==='lap'&&c.human){const left=R.laps-e.lap;if(left===1)rcNotice(v,'Siste runde!',1600);else if(e.best&&e.lap>1)rcNotice(v,'Raskeste runde: '+fmtTime(e.t),1500);else if(left>0)rcNotice(v,'Runde '+(e.lap+1)+' av '+R.laps,1200);rcChime()}
    else if(e.type==='finish'&&c.human){rnFinish(c);rcNotice(v,e.place===1?'DU VANT!':'I mål: '+rcPlace(e.place)+' plass',3000);if(e.place===1)rcFanfare();else rcChime();RC.cheer=2.5;RC.flash=1;
      if(RC.humans.every(h=>h.done)){RC.phase='finish';RC.finT=0}}}}

/* ---------- effects: smoke, dust, sparks, skid marks ---------- */
function rcPart(x,y,kind,c){if(RC.parts.length>700)RC.parts.shift();const r=Math.random;let p;
  if(kind==='spark')p={x,y,vx:(r()-.5)*26,vy:(r()-.5)*26,life:.25+r()*.3,size:.15,col:'#ffd27a',kind};
  else if(kind==='smoke')p={x,y,vx:(c?c.vx*.15:0)+(r()-.5)*2,vy:(c?c.vy*.15:0)+(r()-.5)*2,life:1.1+r()*.9,size:.9+r()*.6,grow:2.2,col:'#d8d8d4',a:.35,kind};
  else if(kind==='dust')p={x,y,vx:(c?c.vx*.25:0)+(r()-.5)*3,vy:(c?c.vy*.25:0)+(r()-.5)*3,life:.8+r()*.6,size:.7+r()*.5,grow:1.6,col:c&&c.dustCol||'#c8b080',a:.45,kind};
  else if(kind==='flame')p={x,y,vx:(c?-Math.cos(c.a)*8+c.vx*.6:0)+(r()-.5)*2,vy:(c?-Math.sin(c.a)*8+c.vy*.6:0)+(r()-.5)*2,life:.18+r()*.12,size:.5+r()*.3,grow:-1,col:r()<.5?'#ffb030':'#6ad0ff',a:.9,kind};
  RC.parts.push(p)}
function rcEffects(dt){const R=RC.R,run=R&&!RC.paused;
  if(run){const SK=RC.skid,x=SK.ctx,PX=SK.px;
    R.cars.forEach((c,ci)=>{const ca=Math.cos(c.a),sa=Math.sin(c.a),sp=Math.hypot(c.vx,c.vy),slide=Math.max(Math.abs(c.slipR)-.08,Math.abs(c.beta)-.06,c.hb&&sp>3?.3:0,c.brk>0&&sp>8&&c.u>0?.12:0),
      off=c.surfR!=='road'&&c.surfR!=='curb',wheels=[[-RCFG.lr,-.95],[-RCFG.lr,.95],[RCFG.lf,-.95],[RCFG.lf,.95]].map(([a,b])=>[c.x+ca*a-sa*b,c.y+sa*a+ca*b]),prev=RC.prevW[ci];
      // marks: black rubber on the asphalt when the tyres slide, brown ruts in the grass and the sand
      if(prev&&(slide>.04||(off&&sp>3))){const a=off?Math.min(.35,sp*.02):Math.min(.55,slide*1.4);x.strokeStyle=off?(RC.T.off==='sand'?'rgba(120,90,50,'+a+')':'rgba(70,55,25,'+a+')'):'rgba(18,18,20,'+a+')';x.lineWidth=.42*PX;
        for(let w=0;w<(slide>.35?4:2);w++){x.beginPath();x.moveTo((prev[w][0]-SK.x0)*PX,(prev[w][1]-SK.y0)*PX);x.lineTo((wheels[w][0]-SK.x0)*PX,(wheels[w][1]-SK.y0)*PX);x.stroke()}}
      RC.prevW[ci]=wheels;
      // smoke from sliding tyres, dust off the track, flames from the turbo
      if(!off&&slide>.12&&sp>4&&Math.random()<dt*60*Math.min(1,slide*1.6))rcPart(wheels[Math.random()<.5?0:1][0],wheels[0][1]*.5+wheels[1][1]*.5,'smoke',c);
      if(off&&sp>4&&Math.random()<dt*40*Math.min(1,sp/20)){c.dustCol=RC.T.off==='sand'?'#d8bc84':'#8a7a4a';rcPart(wheels[0][0],wheels[0][1],'dust',c)}
      if(c.boost>0&&Math.random()<dt*90)rcPart(c.x-ca*2.4,c.y-sa*2.4,'flame',c)})}
  for(const p of RC.parts){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-dt*2);p.vy*=Math.exp(-dt*2);if(p.grow)p.size=Math.max(.05,p.size+p.grow*dt)}
  RC.parts=RC.parts.filter(p=>p.life>0);
  for(const v of RC.views){v.noticeT-=dt;v.shake=Math.max(0,(v.shake||0)-dt*3)}RC.cheer=Math.max(0,RC.cheer-dt);RC.flash=Math.max(0,RC.flash-dt*.8)}
// how close a point is to the nearest camera (1 = on screen, 0 = far away): the volume of what happens there
function rcNearCam(x,y){let m=0;for(const v of RC.views){const d=Math.hypot(x-v.cx,y-v.cy);m=Math.max(m,1-Math.max(0,d-30)/80)}return Math.max(0,m)}

/* ---------- drawing ---------- */
function rcLayout(){const cv=RC.cv=$('rcCv');RC.ctx=cv.getContext('2d');RC.dpr=Math.min(2,devicePixelRatio||1);RC.W=innerWidth;RC.H=innerHeight;cv.width=Math.round(RC.W*RC.dpr);cv.height=Math.round(RC.H*RC.dpr);
  const W=RC.W,H=RC.H,two=RC.views.length>1,por=W<H;RC.views.forEach((v,i)=>{v.vp=!two?{x:0,y:0,w:W,h:H}:por?{x:0,y:i?Math.floor(H/2):0,w:W,h:Math.ceil(H/2)}:{x:i?Math.floor(W/2):0,y:0,w:Math.ceil(W/2),h:H}});
  $('raceHud').classList.toggle('two',two);RC.zoom=store.get('raceZoom',1);RC.camRot=!!store.get('raceCamRot',false)}
function rcDraw(dt){const x=RC.ctx,W=RC.W,H=RC.H,T=RC.T;if(!x||!T)return;x.setTransform(RC.dpr,0,0,RC.dpr,0,0);x.clearRect(0,0,W,H);const t=performance.now()*.001;
  // the menu and the result: the camera drifts slowly along the track
  if(!RC.R||RC.phase==='menu'){RC.menuT=(RC.menuT||0)+dt;const q=trackPos(T,RC.menuT*14,0),vp={x:0,y:0,w:W,h:H};const z=Math.min(W,H)/150;rcWorld(x,vp,q.x,q.y,z,t,null);return}
  for(const v of RC.views){const c=v.car,sp=Math.hypot(c.vx,c.vy),la=Math.min(1,sp/40);
    // the camera: ahead of the car in the direction it moves, a little further out at speed
    // and a little towards where the track goes, so you see the next corner coming
    const ah=trackPos(RC.T,c.s+8+sp*.9,0),rot=RC.camRot;let tx=c.x+c.vx*.4,ty=c.y+c.vy*.4;if(!rot){tx=tx*.6+ah.x*.4;ty=ty*.6+ah.y*.4}
    const k=1-Math.exp(-dt*(RC.phase==='count'?20:4.5));v.cx+=(tx-v.cx)*k;v.cy+=(ty-v.cy)*k;
    // «Kamera følger bilen»: the view turns with the car, so it always points up the screen
    const want=-Math.PI/2-c.a;if(v.rot==null||!rot)v.rot=rot?want:0;else v.rot+=rwrap(want-v.rot)*(1-Math.exp(-dt*5));
    const m=Math.min(v.vp.w,v.vp.h),base=m/(RC.views.length>1?58:m<600?46:66)*RC.zoom,zt=base*(1-.38*la);v.z=v.z===1?zt:v.z+(zt-v.z)*Math.min(1,dt*1.5);
    const sh=(v.shake||0)*.6,sx=(Math.random()-.5)*sh,sy=(Math.random()-.5)*sh;rcWorld(x,v.vp,v.cx+sx,v.cy+sy,v.z,t,v);rcHud(x,v,t)}
  if(RC.views.length>1){x.fillStyle='#E5A92B';const v=RC.views[1].vp;if(v.y>0)x.fillRect(0,v.y-2,W,4);else x.fillRect(v.x-2,0,4,H)}
  rcHudShared(x,t)}
// the world in one view: sea, island, track, marks, decor, cars, smoke, the decor above the cars
function rcWorld(x,vp,cx,cy,z,t,view){const T=RC.T,P=RC.paths,D=RC.deco,look=RC.track.look;x.save();x.beginPath();x.rect(vp.x,vp.y,vp.w,vp.h);x.clip();
  const rot=view&&view.rot||0,cy0=rot&&view?vp.h*.18:0;x.translate(vp.x+vp.w/2,vp.y+vp.h/2+cy0);x.scale(z,z);if(rot)x.rotate(rot);x.translate(-cx,-cy);
  let hw=vp.w/2/z,hh=vp.h/2/z;if(rot){hw=hh=Math.hypot(hw,hh+cy0/z)}const X0=cx-hw-12,X1=cx+hw+12,Y0=cy-hh-12,Y1=cy+hh+12,vis=(px,py,r=0)=>px>X0-r&&px<X1+r&&py>Y0-r&&py<Y1+r;
  // the sea, moving slowly
  const sea=RC.pat.sea;if(sea.setTransform)sea.setTransform(new DOMMatrix().translate(Math.sin(t*.2)*6,t*1.5).scale(.25));x.fillStyle=sea;x.fillRect(X0,Y0,X1-X0,Y1-Y0);
  // the boats out at sea
  for(const b of D.boats){const bx=b.x+Math.cos(b.a)*b.v*t,by=b.y+Math.sin(b.a)*b.v*t;b.px=bx;b.py=by;if(!vis(bx,by,12))continue;x.save();x.translate(bx,by);x.rotate(b.a);
    x.fillStyle='rgba(255,255,255,.35)';x.beginPath();x.moveTo(-9,0);x.lineTo(-3,-1.6);x.lineTo(-3,1.6);x.fill();
    x.fillStyle=b.col;x.beginPath();x.moveTo(5,0);x.quadraticCurveTo(2,-2,-4,-1.6);x.lineTo(-4,1.6);x.quadraticCurveTo(2,2,5,0);x.fill();x.fillStyle='rgba(0,0,0,.25)';x.fillRect(-2.5,-.9,2.6,1.8);
    if(b.sail){x.fillStyle='#fffaf0';x.beginPath();x.moveTo(1,0);x.lineTo(-3,-.3);x.lineTo(-2,3.8+Math.sin(t+b.x)*.3);x.closePath();x.fill()}x.restore()}
  // the island: sand along the shore, foam where the waves break, grass inside
  x.lineJoin='round';x.lineCap='round';
  x.strokeStyle='rgba(255,255,255,'+(.35+.15*Math.sin(t*1.6))+')';x.lineWidth=2*(T.land+3+Math.sin(t*1.2)*1.2);x.stroke(P.cp);x.fillStyle=x.strokeStyle;x.fill(P.cp);
  x.strokeStyle=RC.pat.sand;x.fillStyle=RC.pat.sand;x.lineWidth=2*T.land;x.stroke(P.cp);x.fill(P.cp);
  x.strokeStyle=RC.pat.grass;x.fillStyle=RC.pat.grass;x.lineWidth=2*(T.land-9);x.stroke(P.cp);x.fill(P.cp);
  // the volcano on Vulkanslyngen
  if(D.volcano&&vis(D.volcano.x,D.volcano.y,D.volcano.r)){const V=D.volcano,g=x.createRadialGradient(V.x,V.y,V.r*.12,V.x,V.y,V.r);g.addColorStop(0,'#ff8a2a');g.addColorStop(.14,'#d9432f');g.addColorStop(.2,'#3a2a24');g.addColorStop(.55,'#5a4636');g.addColorStop(1,'rgba(90,70,54,0)');
    x.fillStyle=g;x.beginPath();x.arc(V.x,V.y,V.r,0,6.283);x.fill();x.fillStyle='rgba(255,200,80,'+(.4+.3*Math.sin(t*3))+')';x.beginPath();x.arc(V.x,V.y,V.r*.1,0,6.283);x.fill()}
  for(const r of D.rocks){if(!vis(r.x,r.y,r.r))continue;x.fillStyle='#2e2a28';x.beginPath();x.ellipse(r.x,r.y,r.r,r.r*.75,r.a,0,6.283);x.fill();x.fillStyle='rgba(255,255,255,.08)';x.beginPath();x.ellipse(r.x-r.r*.2,r.y-r.r*.2,r.r*.5,r.r*.35,r.a,0,6.283);x.fill()}
  // the run-off between the asphalt and the walls, and the gravel traps on the outside of the corners
  x.strokeStyle=RC.pat.off;x.lineWidth=2*(T.wallD+1.4);x.stroke(P.cp);
  if(T.off!=='sand'){x.strokeStyle=RC.pat.sand;x.lineWidth=T.wallD-T.hw-2;x.stroke(P.traps)}
  // the pit building and the paddock
  if(D.pit&&vis(D.pit.x,D.pit.y,40))rcPit(x,D.pit);
  // the tyre walls: black tyres with a red and white band
  x.lineCap='butt';for(const wp of[P.wallL,P.wallR]){x.strokeStyle='#1c1c1e';x.lineWidth=1.5;x.setLineDash([]);x.stroke(wp);x.strokeStyle='#d9432f';x.lineWidth=.7;x.setLineDash([1.4,1.4]);x.stroke(wp);x.strokeStyle='#f2e8d0';x.lineDashOffset=1.4;x.stroke(wp);x.lineDashOffset=0}x.setLineDash([]);
  // the asphalt, the white edge lines, the curbs
  x.lineCap='round';x.strokeStyle='rgba(0,0,0,.25)';x.lineWidth=2*T.hw+.8;x.stroke(P.cp);x.strokeStyle=RC.pat.road;x.lineWidth=2*T.hw;x.stroke(P.cp);
  x.strokeStyle='rgba(242,240,232,.85)';x.lineWidth=.3;x.stroke(P.edgeL);x.stroke(P.edgeR);
  x.lineCap='butt';x.strokeStyle='#f2f0e8';x.lineWidth=1.3;x.stroke(P.curbs);x.strokeStyle='#d9332a';x.setLineDash([1.6,1.6]);x.stroke(P.curbs);x.setLineDash([]);
  // the start line (chequered), the grid boxes
  {const q=trackPos(T,0,0),n=Math.round(T.hw*2/1.1),sq=T.hw*2/n;x.save();x.translate(q.x,q.y);x.rotate(q.a);for(let r=0;r<2;r++)for(let i=0;i<n;i++){x.fillStyle=(i+r)%2?'#14120E':'#f2f0e8';x.fillRect(-sq+r*sq,-T.hw+i*sq,sq,sq)}x.restore();
    x.strokeStyle='rgba(242,240,232,.75)';x.lineWidth=.25;for(const g of raceGrid(T,6)){const p=trackPos(T,g.s,g.off);x.save();x.translate(p.x,p.y);x.rotate(p.a);x.beginPath();x.moveTo(-1.2,-1.5);x.lineTo(2.9,-1.5);x.moveTo(2.9,-1.5);x.lineTo(2.9,1.5);x.lineTo(-1.2,1.5);x.stroke();x.restore()}}
  // skid marks
  {const S=RC.skid;x.drawImage(S.cv,S.x0,S.y0,S.cv.width/S.px,S.cv.height/S.px)}
  // billboards and tyre stacks by the walls
  for(const b of D.boards){if(!vis(b.x,b.y,8))continue;x.save();x.translate(b.x,b.y);x.rotate(b.a);x.fillStyle='rgba(0,0,0,.3)';x.fillRect(-6+.5,-.5+.6,12,1.1);x.fillStyle=b.col;x.fillRect(-6,-.6,12,1.2);
    x.fillStyle=b.col==='#14120E'?'#e5a92b':'#f2e8d0';x.font='700 1.05px '+RC_BODY;x.textAlign='center';x.textBaseline='middle';x.fillText(b.text,0,.05);x.restore()}
  for(const c of D.chev){if(!vis(c.x,c.y,3))continue;x.save();x.translate(c.x,c.y);x.rotate(c.a);x.fillStyle='rgba(0,0,0,.3)';x.fillRect(-1.1+.3,-.55+.3,2.2,1.1);x.fillStyle='#f2c230';x.fillRect(-1.1,-.55,2.2,1.1);
    x.strokeStyle='#14120E';x.lineWidth=.28;x.lineJoin='miter';x.beginPath();for(const o of[-.45,.35]){x.moveTo(o-.25,-.32*c.dir);x.lineTo(o+.15,.25*c.dir);x.lineTo(o+.55,-.32*c.dir)}x.stroke();x.restore()}
  for(const b of D.brake){if(!vis(b.x,b.y,3))continue;x.save();x.translate(b.x,b.y);x.rotate(b.a);x.fillStyle='rgba(0,0,0,.3)';x.fillRect(-.9+.3,-.9+.3,1.8,1.8);x.fillStyle='#f2f0e8';x.fillRect(-.9,-.9,1.8,1.8);
    x.strokeStyle='#d9332a';x.lineWidth=.16;x.strokeRect(-.8,-.8,1.6,1.6);x.rotate(-b.a-(view&&view.rot||0));x.fillStyle='#14120E';x.font='700 .95px '+RC_BODY;x.textAlign='center';x.textBaseline='middle';x.fillText(String(b.m),0,.05);x.restore()}
  for(const s of D.tyres){if(!vis(s.x,s.y,4))continue;for(let i=0;i<s.n;i++){const a=s.a+i*2.1,px=s.x+Math.cos(a)*(i?1:0)*.9,py=s.y+Math.sin(a)*(i?1:0)*.9;x.fillStyle='#1a1a1a';x.beginPath();x.arc(px,py,.55,0,6.283);x.fill();x.fillStyle='#3a3a3a';x.beginPath();x.arc(px,py,.25,0,6.283);x.fill()}}
  // the cars: shadow, body, front wheels, lights, the name
  if(RC.R)for(const c of RC.R.cars){if(c.gone||!vis(c.x,c.y,6))continue;rcCar(x,c,t,view)}
  // smoke, dust, sparks, flames
  for(const p of RC.parts){if(!vis(p.x,p.y,4))continue;const k=Math.max(0,Math.min(1,p.life*2));
    if(p.kind==='spark'){x.strokeStyle=p.col;x.globalAlpha=k;x.lineWidth=.15;x.beginPath();x.moveTo(p.x,p.y);x.lineTo(p.x-p.vx*.03,p.y-p.vy*.03);x.stroke()}
    else{x.globalAlpha=(p.a||.4)*Math.min(1,p.life);x.fillStyle=p.col;x.beginPath();x.arc(p.x,p.y,p.size,0,6.283);x.fill()}}x.globalAlpha=1;
  // above the cars: the start gantry with the lights, the grandstands, the trees, the lighthouse
  if(D.gantry&&vis(D.gantry.x,D.gantry.y,T.wallD+4))rcGantry(x,D.gantry,T);
  for(const s of D.stands)if(vis(s.x,s.y,24))rcStand(x,s,t);
  for(const tr of D.trees){if(!vis(tr.x,tr.y,6))continue;const sp=rcPalmSprite(tr.k),S=10/tr.s;x.save();x.translate(tr.x+.9,tr.y+.9);x.rotate(tr.a);x.globalAlpha=.25;x.fillStyle='#000';x.beginPath();x.arc(0,0,3.4*tr.s,0,6.283);x.fill();x.globalAlpha=1;x.restore();
    x.save();x.translate(tr.x,tr.y);x.rotate(tr.a+Math.sin(t*.8+tr.x)*.04);x.scale(1/S,1/S);x.drawImage(sp,-sp.width/2,-sp.height/2);x.restore()}
  if(D.light&&vis(D.light.x,D.light.y,8)){const L=D.light;x.fillStyle='rgba(0,0,0,.25)';x.beginPath();x.arc(L.x+1.5,L.y+1.5,2.6,0,6.283);x.fill();for(let i=0;i<4;i++){x.fillStyle=i%2?'#f2f0e8':'#d9332a';x.beginPath();x.arc(L.x,L.y,2.6-i*.55,0,6.283);x.fill()}
    const a=t*1.2;x.fillStyle='rgba(255,240,170,.18)';x.beginPath();x.moveTo(L.x,L.y);x.arc(L.x,L.y,40,a,a+.25);x.closePath();x.fill()}
  x.restore()}
function rcCar(x,c,t,view){const sp=rcCarSprite(c.col,c.num,c.stripe||'#f2e8d0'),S=RC_SPX,ca=Math.cos(c.a),sa=Math.sin(c.a);
  // shadow, offset a little to the south-east
  x.save();x.translate(c.x+.45,c.y+.55);x.rotate(c.a);x.fillStyle='rgba(0,0,0,.32)';x.fillRect(-RCFG.len/2,-RCFG.wid/2,RCFG.len,RCFG.wid);x.restore();
  x.save();x.translate(c.x,c.y);x.rotate(c.a);
  // the front wheels, turned by the steering
  x.fillStyle='#141414';for(const sy of[-1,1]){x.save();x.translate(RCFG.lf,sy*(RCFG.wid/2+.05));x.rotate(c.steer);x.fillRect(-.48,-.21,.96,.42);x.restore()}
  x.scale(1/S,1/S);x.drawImage(sp,-sp.width/2,-sp.height/2);x.scale(S,S);
  // brake lights
  if(c.brk>0&&c.u>.5||c.hb){x.fillStyle='rgba(255,40,30,.95)';for(const sy of[-1,1])x.fillRect(-RCFG.len/2-.02,sy*.62-.15,.14,.3);x.fillStyle='rgba(255,40,30,.25)';for(const sy of[-1,1]){x.beginPath();x.arc(-RCFG.len/2-.3,sy*.62,.7,0,6.283);x.fill()}}
  // the turbo: a glow at the back
  if(c.boost>0){x.fillStyle='rgba(110,210,255,'+(.4+.3*Math.sin(t*40))+')';x.beginPath();x.ellipse(-RCFG.len/2-.9,0,1.1,.5,0,0,6.283);x.fill()}
  x.restore();
  // a ring under the human players' cars, and the name over the others
  if(c.human&&RC.views.length>1){x.strokeStyle=c.pi?'#3b8cf0':'#E5A92B';x.lineWidth=.25;x.beginPath();x.arc(c.x,c.y,3.2,0,6.283);x.stroke()}
  if(!c.human||RC.views.length>1){const z=view?view.z:10,r=view&&view.rot||0;x.save();x.translate(c.x-Math.sin(-r)*-3.1,c.y-Math.cos(-r)*3.1);x.rotate(-r);x.scale(1/z,1/z);x.font='600 12px '+RC_BODY;x.textAlign='center';x.textBaseline='middle';const w=x.measureText(c.name).width+8;
    x.fillStyle='rgba(20,18,14,.6)';x.fillRect(-w/2,-8,w,16);x.fillStyle=c.human?'#E5A92B':'#f2e8d0';x.fillText(c.name,0,1);x.restore()}}
function rcStand(x,s,t){x.save();x.translate(s.x,s.y);x.rotate(s.a);const w=s.w,d=s.d,R=mulberry32(s.seed*31+7);
  x.fillStyle='rgba(0,0,0,.3)';x.fillRect(-w/2+1.2,-d/2+1.4,w,d);x.fillStyle='#8a8a86';x.fillRect(-w/2,-d/2,w,d);
  // rows of people: coloured dots that jump when somebody finishes
  const rows=5,cols=Math.floor(w/1.05),jump=RC.cheer>0?.25:0;for(let r=0;r<rows;r++){x.fillStyle=r%2?'#9a9a96':'#7e7e7a';x.fillRect(-w/2,-d/2+1+r*(d-1.6)/rows,w,(d-1.6)/rows-.25)}
  for(let r=0;r<rows;r++)for(let i=0;i<cols;i++){if(R()<.18)continue;const px=-w/2+.6+i*1.05,py=-d/2+1.5+r*(d-1.6)/rows+(jump?Math.sin(t*14+i*1.7+r)*jump:0);
    x.fillStyle=['#d9432f','#f2e8d0','#2f6fd6','#e5a92b','#8bbb4a','#14120E','#b05ad0'][Math.floor(R()*7)];x.beginPath();x.arc(px,py,.36,0,6.283);x.fill();x.fillStyle='#e8c8a0';x.beginPath();x.arc(px,py-.05,.18,0,6.283);x.fill()}
  // the roof edge with flags
  x.fillStyle='#3a3a3c';x.fillRect(-w/2-.3,d/2-.3,w+.6,.9);for(let i=0;i<5;i++){const fx=-w/2+2+i*(w-4)/4;x.fillStyle=['#d9432f','#E5A92B','#2f6fd6','#8bbb4a','#f2e8d0'][i];x.beginPath();x.moveTo(fx,d/2+.6);x.lineTo(fx+1.6+Math.sin(t*5+i)*.3,d/2+1.1);x.lineTo(fx,d/2+1.6);x.fill()}
  x.restore()}
function rcPit(x,p){x.save();x.translate(p.x,p.y);x.rotate(p.a);const w=p.w,d=p.d;
  x.fillStyle='#5a5a5c';x.fillRect(-w/2-4,-d/2-6,w+8,d+12);x.fillStyle='rgba(0,0,0,.3)';x.fillRect(-w/2+1,-d/2+1.2,w,d);
  x.fillStyle='#e8e4da';x.fillRect(-w/2,-d/2,w,d);x.fillStyle='#c9c4b8';for(let i=0;i<7;i++)x.fillRect(-w/2+i*w/7+.4,-d/2+.4,w/7-.8,d-.8);
  const doors=['#d9432f','#2f6fd6','#8bbb4a','#f2c230','#b05ad0','#E5A92B','#3a3a3c'];for(let i=0;i<7;i++){x.fillStyle=doors[i];x.fillRect(-w/2+i*w/7+1,d/2-1.4,w/7-2,1)}
  x.fillStyle='#14120E';x.font='700 3px '+RC_FONT;x.textAlign='center';x.textBaseline='middle';x.fillText('DEPOT',0,.2);
  // trucks in the paddock behind
  for(let i=0;i<4;i++){const tx=-w/2+8+i*16,ty=-d/2-3.2;x.fillStyle=doors[i];x.fillRect(tx-5,ty-1.2,10,2.4);x.fillStyle='#2a2a2c';x.fillRect(tx+3.2,ty-1.1,1.8,2.2)}x.restore()}
function rcGantry(x,g,T){x.save();x.translate(g.x,g.y);x.rotate(g.a);const L=T.wallD+1.5;
  x.fillStyle='rgba(0,0,0,.25)';x.fillRect(-.2,-L+.8,1.6,2*L);x.fillStyle='#2a2a2c';x.fillRect(-.8,-L,1.6,2*L);x.fillStyle='#4a4a4e';for(const sy of[-1,1])x.fillRect(-1.2,sy*L-1.2,2.4,2.4);
  // the five lights: red one by one, then out; green after the start
  for(let i=0;i<5;i++){const on=RC.phase==='count'&&i<RC.lights,go=RC.phase==='race'&&RC.R&&RC.R.t<3;x.fillStyle=on?'#ff2a1a':go?'#3aff6a':'#3a2020';x.beginPath();x.arc(0,-3.2+i*1.6,.6,0,6.283);x.fill();
    if(on||go){x.fillStyle=on?'rgba(255,40,20,.25)':'rgba(60,255,100,.2)';x.beginPath();x.arc(0,-3.2+i*1.6,1.4,0,6.283);x.fill()}}
  x.restore()}

/* ---------- the HUD, drawn on the canvas (one per view when two play) ---------- */
function rcTxt(x,s,px,py,size,col,align='left',font=RC_FONT,base='alphabetic'){const m=/^(\d{3}) (.*)$/.exec(font);x.font=m?m[1]+' '+size+'px '+m[2]:size+'px '+font;x.textAlign=align;x.textBaseline=base;x.lineWidth=Math.max(2,size*.14);x.strokeStyle='rgba(20,18,14,.85)';x.strokeText(s,px,py);x.fillStyle=col;x.fillText(s,px,py)}
function rcBox(x,px,py,w,h){x.fillStyle='rgba(20,18,14,.78)';x.fillRect(px,py,w,h);x.strokeStyle='rgba(229,169,43,.32)';x.lineWidth=1;x.strokeRect(px+.5,py+.5,w-1,h-1)}
function rcHud(x,v,t){const c=v.car,R=RC.R,vp=v.vp,two=RC.views.length>1,s=Math.max(.7,Math.min(1.15,Math.min(vp.w,vp.h)/620)),touch=document.body.classList.contains('is-touch');
  const L=vp.x+14,Tp=vp.y+12;
  // place and lap
  const place=R.order.indexOf(c)+1;rcBox(x,L,Tp,128*s,78*s);rcTxt(x,rcPlace(place),L+10*s,Tp+50*s,46*s,place===1?'#E5A92B':'#f2e8d0');rcTxt(x,'/'+R.cars.length,L+(place>9?80:58)*s,Tp+50*s,20*s,'#B5A988','left',RC_BODY);
  const lap=Math.min(R.laps,c.lap+1);rcTxt(x,c.done?'I MÅL':'RUNDE '+Math.max(1,lap)+'/'+R.laps,L+10*s,Tp+70*s,15*s,'#f2e8d0','left','600 '+RC_BODY);
  if(two){x.fillStyle=c.pi?'#3b8cf0':'#E5A92B';x.fillRect(L,Tp,4*s,78*s)}
  // time and the best lap
  const Rt=vp.x+vp.w-14-(two?0:58);rcBox(x,Rt-128*s,Tp,128*s,58*s);rcTxt(x,fmtTime(c.done?c.finT:R.t),Rt-10*s,Tp+30*s,26*s,'#f2e8d0','right','700 '+RC_BODY);
  rcTxt(x,c.best!=null?'BESTE '+fmtTime(c.best):'RUNDE '+fmtTime(c.lapT),Rt-10*s,Tp+50*s,14*s,'#B5A988','right','600 '+RC_BODY);
  // speed and the drift meter
  const bw=206*s,bh=56*s,by=touch&&!two?vp.y+100*s:vp.y+vp.h-70*s,bx=touch&&!two?L:vp.x+vp.w/2-bw/2;rcBox(x,bx,by,bw,bh);
  rcTxt(x,Math.round(Math.max(0,c.u)*3.6)+'',bx+56*s,by+36*s,32*s,'#f2e8d0','right','700 '+RC_BODY);rcTxt(x,'km/t',bx+60*s,by+36*s,14*s,'#B5A988','left','600 '+RC_BODY);
  const ch=Math.min(1,c.charge/2.5),bb=c.boost>0,mx=bx+104*s,mw=92*s;x.fillStyle='rgba(242,232,208,.12)';x.fillRect(mx,by+14*s,mw,10*s);x.fillStyle=bb?'#6ad0ff':ch>.28?'#ff6a2a':'#E5A92B';x.fillRect(mx,by+14*s,mw*(bb?c.boost/1.6:ch),10*s);
  rcTxt(x,bb?'TURBO!':c.drift>0?'SLADD …':'SLADD = TURBO',mx+mw/2,by+42*s,12*s,bb?'#6ad0ff':c.drift>0?'#ff6a2a':'#B5A988','center','700 '+RC_BODY);
  // the big notice in the middle of the view
  if(v.noticeT>0&&v.notice){const a=Math.min(1,v.noticeT*3);x.globalAlpha=a;rcTxt(x,v.notice,vp.x+vp.w/2,vp.y+vp.h*.3,Math.min(56,vp.w/12)*Math.max(.8,s),v.noticeBad?'#FF6A2A':'#E5A92B','center');x.globalAlpha=1}
  // the countdown lights, big
  if(RC.phase==='count'){const n=5,r=18*s,gx=vp.x+vp.w/2-(n-1)*r*1.3,gy=vp.y+vp.h*.18;rcBox(x,gx-r*1.6,gy-r*1.6,(n-1)*r*2.6+r*3.2,r*3.2);
    for(let i=0;i<n;i++){x.fillStyle=i<RC.lights?'#ff2a1a':'#3a2020';x.beginPath();x.arc(gx+i*r*2.6,gy,r,0,6.283);x.fill();if(i<RC.lights){x.fillStyle='rgba(255,60,30,.3)';x.beginPath();x.arc(gx+i*r*2.6,gy,r*1.5,0,6.283);x.fill()}}}
  // an arrow at the edge of the view towards the other player
  if(two){const o=RC.views[1-v.i].car,r0=v.rot||0,ex=o.x-v.cx,ey=o.y-v.cy,dx=ex*Math.cos(r0)-ey*Math.sin(r0),dy=ex*Math.sin(r0)+ey*Math.cos(r0),hw=vp.w/2/v.z,hh=vp.h/2/v.z;if(Math.abs(dx)>hw||Math.abs(dy)>hh){const a=Math.atan2(dy,dx),k=Math.min((hw-3)/Math.abs(Math.cos(a)||1e-6),(hh-3)/Math.abs(Math.sin(a)||1e-6)),
    px=vp.x+vp.w/2+Math.cos(a)*k*v.z*.92,py=vp.y+vp.h/2+Math.sin(a)*k*v.z*.92;x.save();x.translate(px,py);x.rotate(a);x.fillStyle=o.pi?'#3b8cf0':'#E5A92B';x.beginPath();x.moveTo(12,0);x.lineTo(-8,-9);x.lineTo(-8,9);x.fill();x.restore()}}}
// shared: the standings and the minimap (one player), the flash at the finish
function rcHudShared(x,t){const R=RC.R,W=RC.W,H=RC.H,two=RC.views.length>1,touch=document.body.classList.contains('is-touch');if(!R)return;
  if(!two&&W>700){const s0=Math.max(.7,Math.min(1.15,Math.min(W,H)/620)),L=14,Tp=12+78*s0+10,s=Math.max(.8,Math.min(1.1,H/700));R.order.forEach((c,i)=>{const y=Tp+i*24*s;x.fillStyle=c.human?'rgba(229,169,43,.88)':'rgba(20,18,14,.7)';x.fillRect(L,y,150*s,21*s);
    x.fillStyle=c.col;x.fillRect(L,y,5*s,21*s);x.font='600 '+Math.round(14*s)+'px '+RC_BODY;x.textAlign='left';x.textBaseline='middle';x.fillStyle=c.human?'#14120E':'#f2e8d0';x.fillText((i+1)+'. '+c.name,L+10*s,y+11*s);
    if(c.done){x.textAlign='right';x.fillText('🏁',L+146*s,y+11*s)}})}
  // the minimap
  const M=RC.mini,ms=two?Math.min(150,Math.min(W,H)*.22):Math.min(190,Math.min(W,H)*.28),k=ms/Math.max(M.w,M.h),mw=M.w*k+16,mh=M.h*k+16;
  let mx,my;if(two){const v=RC.views[1].vp;if(v.y>0){mx=W-mw-12;my=v.y-mh/2}else{mx=v.x-mw/2;my=H-mh-12}}else{mx=W-mw-14;my=touch?H-mh-150:H-mh-14}
  x.fillStyle='rgba(20,18,14,.7)';x.fillRect(mx,my,mw,mh);x.save();x.translate(mx+8-M.b.x0*k,my+8-M.b.y0*k);x.scale(k,k);
  x.strokeStyle='rgba(242,232,208,.85)';x.lineWidth=Math.max(2.5/k,RC.T.hw*1.2);x.lineJoin='round';x.stroke(RC.paths.cp);
  const p0=trackPos(RC.T,0,0);x.strokeStyle='#14120E';x.lineWidth=2/k;x.beginPath();x.moveTo(p0.x-p0.a*0,p0.y-RC.T.hw*1.5);x.lineTo(p0.x,p0.y+RC.T.hw*1.5);x.stroke();
  for(const c of R.cars.filter(c=>!c.gone).sort((a,b)=>a.human-b.human)){x.fillStyle=c.col;x.strokeStyle='#14120E';x.lineWidth=1.5/k;x.beginPath();x.arc(c.x,c.y,(c.human?5.5:4)/k,0,6.283);x.fill();x.stroke()}x.restore();
  if(RC.flash>0){x.fillStyle='rgba(255,255,255,'+RC.flash*.25+')';x.fillRect(0,0,W,H)}}
function rcNotice(v,text,ms,bad){for(const q of(v?[v]:RC.views)){q.notice=text;q.noticeT=ms/1000;q.noticeBad=!!bad}}

/* ---------- the result: places, times, prizes ---------- */
// the places: finished cars by time, the others by when they would finish at their pace
function rcOrder(){const R=RC.R;return R.cars.filter(c=>!c.gone||c.done).sort((a,b)=>raceEstimate(R,a)-raceEstimate(R,b))}
function rcResultTable(){const R=RC.R;$('rrTable').innerHTML=rcOrder().map((c,i)=>`<li class="${c.human?'me':''}"><b>${i+1}.</b><i class="chip" style="background:${c.col}"></i><span>${c.name}${c.pid&&!c.human?' 🌐':''}</span><em>${c.done?fmtTime(c.finT):'~'+fmtTime(raceEstimate(R,c))}</em></li>`).join('')}
function rcResult(){if(RC.phase==='result')return;RC.phase='result';const R=RC.R,tr=RC.track,L=RACE_LEVELS[RC.lvl],key=rcKey(tr),prev=best[key]||{};
  const order=rcOrder(),hs=RC.humans,top=hs.reduce((m,c)=>Math.min(m,order.indexOf(c)),9),me=order[top];
  const placeN=top+1,prize=Math.round((RACE_PRIZE[top]||0)*L.nuts),firstWin=placeN===1&&!prev.win,bonus=firstWin?RACE_FIRST_WIN:0,t=me.finT,lapBest=Math.min(...hs.map(c=>c.best||1e9));
  const stars=placeN===1&&t<=tr.par[0]?3:placeN<=2&&t<=tr.par[1]?2:placeN<=3?1:0;
  prof.nuts+=prize+bonus;if(!prof.race)prof.race={};prof.race.runs=(prof.race.runs||0)+1;saveProf();
  const rec={t:prev.t&&prev.t<t?prev.t:t,lap:prev.lap&&prev.lap<lapBest?prev.lap:(lapBest<1e9?lapBest:prev.lap),s:Math.max(prev.s||0,stars),win:Math.max(prev.win||0,placeN===1?RC.lvl+1:0)};best[key]=rec;store.set('best',best);
  $('rrLevel').textContent='Racerøya · '+tr.name+' · '+L.name;$('rrTitle').textContent=RC.net?(placeN===1?'Du vant!':rcPlace(placeN)+' plass')+' av '+order.length:RC.two?(order.indexOf(hs[0])<order.indexOf(hs[1])?'Spiller 1 vant duellen!':'Spiller 2 vant duellen!'):placeN===1?'Du vant!':rcPlace(placeN)+' plass';
  $('rrStars').innerHTML=[0,1,2].map(i=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z" fill="${i<stars?'#E5A92B':'rgba(242,232,208,.15)'}"/></svg>`).join('');$('rrStars').setAttribute('aria-label',stars+' av 3 stjerner');
  rcResultTable();$('rrAgain').textContent=RC.net?'Til lobbyen':'Kjør igjen';
  const Lg=[`<li><b>${rcPlace(placeN)} plass:</b> +${prize} ⚙${L.nuts!==1?' ('+L.name+': ×'+String(L.nuts).replace('.',',')+')':''}</li>`];
  if(bonus)Lg.push(`<li><b>Første seier på ${tr.name}:</b> +${bonus} ⚙</li>`);
  if(lapBest<1e9)Lg.push(`<li><b>Beste runde:</b> ${fmtTime(lapBest)}${prev.lap&&lapBest<prev.lap?' (ny rekord!)':prev.lap?' (rekorden din er '+fmtTime(prev.lap)+')':''}</li>`);
  if(prev.t&&t<prev.t)Lg.push('<li><b>Ny rekord</b> for hele løpet: '+fmtTime(t)+'.</li>');
  Lg.push(`<li><b>Stjerner:</b> vinn på under ${fmtTime(tr.par[0])} for tre, kom blant de to første på under ${fmtTime(tr.par[1])} for to.</li>`);
  $('rrLog').innerHTML=Lg.join('');$('rrNuts').textContent='+'+fmtN(prize+bonus);$('rrNutsNote').textContent='Du har nå '+fmtN(prof.nuts)+' ⚙.';
  $('raceResult').hidden=false;$('rrAgain').focus()}

/* ---------- sound: an engine for each player, the nearest rival, tyres, bumps, the lights (WebAudio, no files) ---------- */
function rcSnd(){if(RC.snd||!AC)return RC.snd;try{const C=AC,master=C.createGain();master.gain.value=0;master.connect(C.destination);const fx=C.createGain();fx.gain.value=.9;fx.connect(master);
  const engine=()=>{const o=C.createOscillator();o.type='sawtooth';const o2=C.createOscillator();o2.type='square';const f=C.createBiquadFilter();f.type='lowpass';f.frequency.value=900;const g=C.createGain();g.gain.value=0;const g2=C.createGain();g2.gain.value=.35;
    o.connect(f);o2.connect(g2);g2.connect(f);f.connect(g);g.connect(master);o.start();o2.start();return{o,o2,f,g,rpm:0}};
  const nb=noiseBuf(C,2),noise=(type,fr,q)=>{const s=C.createBufferSource();s.buffer=nb;s.loop=true;const f=C.createBiquadFilter();f.type=type;f.frequency.value=fr;if(q)f.Q.value=q;const g=C.createGain();g.gain.value=0;s.connect(f);f.connect(g);g.connect(master);s.start();return{f,g}};
  RC.snd={master,fx,nb,eng:[engine(),engine()],ai:engine(),skid:[noise('bandpass',1700,4),noise('bandpass',1500,4)],gravel:noise('lowpass',420),crowd:noise('bandpass',900,.6)}}catch(e){RC.snd=null}return RC.snd}
// a gear box: the engine climbs through each gear and drops at the change
const RC_GEARS=[0,9,17,25,33,40,48];
function rcRpm(u){u=Math.abs(u);let g=0;while(g<RC_GEARS.length-2&&u>RC_GEARS[g+1])g++;const a=RC_GEARS[g],b=RC_GEARS[g+1];return .25+.75*Math.min(1,(u-a)/(b-a))}
function rcSndUpdate(dt){const S=rcSnd();if(!S)return;const t=AC.currentTime,run=RC.on&&state.sound&&!RC.paused&&RC.R&&RC.phase!=='menu',vc=state.volCar/70,va=state.volAmb/70;
  S.master.gain.setTargetAtTime(run?1:0,t,.12);if(!run)return;const R=RC.R,n=RC.humans.length;
  S.eng.forEach((e,i)=>{const c=RC.humans[i];if(!c){e.g.gain.setTargetAtTime(0,t,.1);return}const rpm=RC.phase==='count'?.2+.25*Math.max(0,rcInput(c).gas):rcRpm(c.u)*(c.thr>0?1:.85);e.rpm+=(rpm-e.rpm)*Math.min(1,dt*12);
    const f=55+e.rpm*190+(c.boost>0?25:0);e.o.frequency.setTargetAtTime(f,t,.03);e.o2.frequency.setTargetAtTime(f*.5,t,.03);e.f.frequency.setTargetAtTime(500+e.rpm*1400+c.thr*500,t,.05);
    e.g.gain.setTargetAtTime((.018+.04*c.thr+.02*e.rpm)*vc/(n>1?1.4:1),t,.06);
    // the tyres: a squeal when they slide on the asphalt
    const sl=Math.max(Math.abs(c.slipR)-.1,Math.abs(c.beta)-.08,c.hb&&Math.abs(c.u)>4?.3:0),off=c.surfR!=='road'&&c.surfR!=='curb',sp=Math.hypot(c.vx,c.vy);
    S.skid[i].g.gain.setTargetAtTime(!off&&sp>4?Math.min(.12,sl*.3)*vc:0,t,.05);S.skid[i].f.frequency.setTargetAtTime(1500+Math.min(600,sp*12)+i*150,t,.1)});
  for(let i=n;i<2;i++){S.eng[i].g.gain.setTargetAtTime(0,t,.1);S.skid[i].g.gain.setTargetAtTime(0,t,.1)}
  {let off=0;for(const c of RC.humans)if(c.surfR!=='road'&&c.surfR!=='curb')off=Math.max(off,Math.min(1,Math.hypot(c.vx,c.vy)/20));S.gravel.g.gain.setTargetAtTime(off*.12*vc,t,.08)}
  // the nearest rival
  {let nc=null,nd=1e9;const v=RC.views[0];for(const c of R.cars){if(c.human)continue;const d=Math.hypot(c.x-v.cx,c.y-v.cy);if(d<nd){nd=d;nc=c}}
    const e=S.ai;if(nc){const rpm=rcRpm(nc.u);e.o.frequency.setTargetAtTime(60+rpm*180,t,.05);e.o2.frequency.setTargetAtTime(30+rpm*90,t,.05);e.f.frequency.setTargetAtTime(400+rpm*900,t,.05);e.g.gain.setTargetAtTime(Math.max(0,1-nd/60)*.035*vc,t,.1)}}
  // the crowd: a murmur on the start straight, cheers at the finish
  {const v=RC.views[0],st=RC.deco.stands[0],d=st?Math.hypot(st.x-v.cx,st.y-v.cy):999;S.crowd.g.gain.setTargetAtTime((Math.max(0,1-d/90)*.05+(RC.cheer>0?.12:0))*va,t,.3)}}
function rcTone(fr,d,type='triangle',v=.2,glide=0,delay=0){const S=rcSnd();if(!S||!state.sound)return;const C=AC,t=C.currentTime+delay,o=C.createOscillator(),g=C.createGain();o.type=type;o.frequency.setValueAtTime(fr,t);if(glide)o.frequency.exponentialRampToValueAtTime(Math.max(40,fr+glide),t+d);
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+d+.05);o.connect(g);g.connect(S.fx);o.start(t);o.stop(t+d+.1)}
function rcNoise(d,type,fr,v,delay=0,sweep){const S=rcSnd();if(!S||!state.sound)return;const C=AC,t=C.currentTime+delay,n=C.createBufferSource();n.buffer=S.nb;const f=C.createBiquadFilter();f.type=type;f.frequency.setValueAtTime(fr,t);if(sweep)f.frequency.exponentialRampToValueAtTime(sweep,t+d);
  const g=C.createGain();g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);n.connect(f);f.connect(g);g.connect(S.fx);n.start(t);n.stop(t+d+.05)}
const rcBeep=(fr,d)=>rcTone(fr,d,'square',.12*state.volCar/70+.04);
function rcThump(v,soft){rcNoise(.25,'lowpass',soft?380:600,.6*v*state.volCar/70);rcTone(soft?90:120,.15,'sine',.4*v,-50);if(!soft&&v>.4)rcTone(1800+Math.random()*900,.08,'square',.05*v)}
function rcWhoosh(){rcNoise(.7,'bandpass',500,.35*state.volCar/70,0,2600)}
function rcChime(){rcTone(784,.12,'triangle',.18);rcTone(1047,.2,'triangle',.18,0,.1)}
function rcFanfare(){[523,659,784,1047,784,1047].forEach((n,i)=>rcTone(n,i===5?.9:.16,'triangle',.22,0,i*.17))}

/* ---------- buttons ---------- */
function initRace(){
  $('rmTracks').addEventListener('click',e=>{const b=e.target.closest('[data-track]');if(!b)return;if(RC.net&&RC.net.lead!==NET.me)return;store.set('raceTrack',b.dataset.track);if(RC.net)RC.net.track=b.dataset.track;const tr=rcTrack();if(RC.track!==tr){RC.track=tr;rcBuildTrack(tr);RC.menuT=0}rcMenuRender();rnList()});
  RACE_LEVELS.forEach((L,i)=>$('rmLv'+i).onclick=()=>{if(RC.net&&RC.net.lead!==NET.me)return;RC.lvl=i;store.set('raceLvl',i);if(RC.net)RC.net.lvl=i;rcMenuRender();rnList()});
  $('rm1').onclick=()=>{RC.two=false;store.set('raceTwo',false);rcMenuRender()};$('rm2').onclick=()=>{RC.two=true;store.set('raceTwo',true);rcMenuRender()};
  $('rmCam').onclick=()=>rcCam();$('rpCam').onclick=()=>rcCam();
  $('rmGo').onclick=()=>rcStart();$('rmBack').onclick=()=>raceExit();
  $('rcPauseB').onclick=()=>rcPause(true);$('rpResume').onclick=()=>rcPause(false);$('rpRestart').onclick=()=>{rcPause(false);rcStart()};$('rpMenu').onclick=()=>{rcPause(false);if(rnRacing())rnSend({t:'Rq',id:RC.net.id});rcMenu()};
  $('rpCar').onclick=()=>{rcPause(false);raceExit()};$('rpSound').onclick=()=>{setSound(!state.sound);$('rpSound').textContent='Lyd: '+(state.sound?'på':'av')};
  $('rrAgain').onclick=()=>{if(RC.net)rcMenu();else rcStart()};$('rrMenu').onclick=()=>rcMenu();$('rrCar').onclick=()=>raceExit();
  $('rcReset').onclick=()=>{if(RC.phase==='race')for(const c of RC.humans)if(!c.done&&c.pi===0)rcReset(c)};
  addEventListener('resize',()=>{if(RC.on)rcLayout()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&RC.on&&RC.phase==='race')rcPause(true)})}
initRace();
