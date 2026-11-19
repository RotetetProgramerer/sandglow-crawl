'use strict';
/* =================================================================
   GRUVESIM: the mine wagon in Gruve 7 on Svalbard. No DOM, no three.js, so tools/test-gruve7.js can drive it in node.
   The wagon rolls by itself along three tracks, faster in every part of the mine. s is how far in it has come, lane is
   the track it is heading for (-1 left, 0 middle, 1 right), x is where it is sideways (in lanes) and y how high it has
   jumped. There are three things to do: change track, jump and duck.
     rocks, parked wagons, barriers and walls close a track: change to another one
     low beams and icicles hang over the track: duck
     broken rails over a shaft: jump
   A hit costs one lantern and puts the wagon back at the last checkpoint. With no lanterns left the trip is over.
   makeMine(def) builds the mine once from data/gruve7.js: the centre line (it bends and climbs a little, which is only
   for the eye), the parts, the obstacles, the coal and the checkpoints that js/gruve7.js draws.
   ================================================================= */
const MSTEP=1/120;
// lane: the distance between two tracks; g and jv: gravity and the speed of a jump (0.72 s in the air); duckT: how long a duck lasts;
// laneRate/slipRate: tracks a second when changing track, on dry rails and on ice; acc/brk: how fast the wagon picks up and loses speed;
// half: half the length of the wagon; hitW: how far into a track the wagon must be to hit what stands there (in lanes);
// coalS/coalH: how close a lump of coal must be, along the track and in height; crashT: how long the wagon lies still after a hit
const MCFG={lane:2,g:24,jv:8.6,duckT:.55,laneRate:6.5,slipRate:3.3,acc:3.2,brk:9,half:1.2,hitW:.42,coalS:1.25,coalH:1.15,crashT:1.15,lights:3,jumpBuf:.16};
const MLANE={V:-1,M:0,H:1};
// what you do about each kind of obstacle, and how long it is along the track
const MKIND={ras:{need:'lane',d:.8},vogn:{need:'lane',d:1.3},bukk:{need:'lane',d:.35},vegg:{need:'lane',d:.6},bjelke:{need:'duck',d:.25},istapper:{need:'duck',d:.35},brudd:{need:'jump',d:0}};

/* ---------- the mine ---------- */
function makeMine(def){
  const m={name:def.name,P:[{s:0,x:0,y:0}],zones:[],obs:[],coal:[],cps:[],len:0};let s=0,x=0,y=0;
  const lanes=a=>{const L=[false,false,false];if(!a.length)return[true,true,true];for(const k of a){if(!(k in MLANE))throw new Error('Ukjent spor: '+k);L[MLANE[k]+1]=true}return L};
  const go=(l,dx,dy)=>{s+=l;x+=dx;y+=dy;m.P.push({s,x,y})};
  const ob=(kind,a,len=0)=>{const K=MKIND[kind],o={kind,need:K.need,s0:s-K.d,s1:s+len+K.d,s,len,lanes:lanes(a)};m.obs.push(o);return o};
  const c={
    get s(){return s},
    sone(name,theme,v){m.zones.push({s,name,theme,v})},
    rett(l){go(l,0,0)},sving(l,dx){go(l,dx,0)},bakke(l,dy,dx=0){go(l,dx,dy)},
    ras(...a){ob('ras',a)},vogn(...a){ob('vogn',a)},bukk(...a){ob('bukk',a)},
    bjelke(...a){ob('bjelke',a)},istapper(...a){ob('istapper',a)},
    brudd(len=3.4){ob('brudd',[],len)},
    // a set of points: only the given track goes on, the other two end in a wall. A sign over the tracks warns well before
    veksel(open,warn=26){const o=ob('vegg',['V','M','H'].filter(k=>k!==open));o.open=MLANE[open];o.warn=s-warn},
    // n lumps of coal in a row on one track, from dx past the pen; h is how high over the rails they hang
    kull(lane,n=5,gap=2.2,dx=0,h=0){for(let i=0;i<n;i++)m.coal.push({s:s+dx+i*gap,lane:MLANE[lane],h})},
    // n lumps in an arc over a jump, from dx past the pen and len long
    bue(lane,n=4,len=6,dx=-1.5,top=1.7){for(let i=0;i<n;i++){const u=n>1?i/(n-1):.5;m.coal.push({s:s+dx+len*u,lane:MLANE[lane],h:.35+top*4*u*(1-u)})}},
    cp(name){m.cps.push({s,name})},
    mal(){m.len=s}};
  def.build(c);if(!m.len)m.len=s;
  if(!m.cps.length||m.cps[0].s>0)m.cps.unshift({s:0,name:'Inngangen'});
  m.P.push({s:m.len+60,x,y});   // the tunnel goes straight on past the end, out into the daylight
  m.obs.sort((a,b)=>a.s0-b.s0);m.coal.sort((a,b)=>a.s-b.s);m.cps.sort((a,b)=>a.s-b.s);m.coal.forEach((k,i)=>k.i=i);
  return m}
// the centre line at s: every stretch eases in and out, so the tunnel never has a kink
function mSeg(m,s){const P=m.P;let a=0,b=P.length-1;while(b-a>1){const k=(a+b)>>1;if(P[k].s<=s)a=k;else b=k}return a}
function mineAt(m,s,o){const P=m.P;o=o||{};if(s<=0){o.x=P[0].x;o.y=P[0].y;o.dx=o.dy=0;return o}const i=mSeg(m,s),A=P[i],B=P[i+1],L=B.s-A.s,u=Math.max(0,Math.min(1,(s-A.s)/L)),e=u*u*(3-2*u),de=6*u*(1-u)/L;
  o.x=A.x+(B.x-A.x)*e;o.y=A.y+(B.y-A.y)*e;o.dx=(B.x-A.x)*de;o.dy=(B.y-A.y)*de;return o}
function mineZone(m,s){let k=0;for(let i=0;i<m.zones.length;i++)if(m.zones[i].s<=s)k=i;return k}
const mineSlip=(m,s)=>m.zones[mineZone(m,s)].theme==='is';

/* ---------- the wagon ---------- */
function makeMineCart(m,speedScale=1){return{s:0,v:0,lane:0,x:0,y:0,vy:0,duck:0,air:false,airT:0,buf:0,lights:MCFG.lights,crashT:0,cp:0,t:0,got:0,combo:0,maxCombo:0,hits:0,ci:0,
  taken:new Uint8Array(m.coal.length),speedScale,state:'run',ev:[],lean:0}}
function mineRespawn(c,m){const p=m.cps[c.cp];c.s=p.s;c.v=m.zones[mineZone(m,p.s)].v*c.speedScale*.45;c.lane=0;c.x=0;c.y=0;c.vy=0;c.duck=0;c.air=false;c.buf=0;c.crashT=0;c.lean=0;
  let a=0,b=m.coal.length;while(a<b){const k=(a+b)>>1;if(m.coal[k].s<c.s-3)a=k+1;else b=k}c.ci=a}
// one step. inp: left, right, jump and duck are true the step the key goes down, duckHold while it is held
function stepMineCart(c,inp,m,dt){
  if(c.state==='out')return;
  if(c.state==='done'){c.v=Math.max(0,c.v-c.v*1.2*dt-1.5*dt);c.s+=c.v*dt;c.x+=(c.lane-c.x)*Math.min(1,dt*8);if(c.y>0||c.vy>0){c.vy-=MCFG.g*dt;c.y+=c.vy*dt;if(c.y<0){c.y=0;c.vy=0}}return}
  if(c.crashT>0){c.crashT-=dt;if(c.y>0||c.vy!==0){c.vy-=MCFG.g*dt;c.y=Math.max(c.fall?-6:0,c.y+c.vy*dt)}
    if(c.crashT<=0){c.fall=false;if(c.lights<=0){c.state='out';c.ev.push({type:'out'})}else{mineRespawn(c,m);c.ev.push({type:'respawn'})}}return}
  c.t+=dt;const zi=mineZone(m,c.s),Z=m.zones[zi],slip=Z.theme==='is';
  // changing track: one track at a time, also in the air
  if(inp.left&&c.lane>-1){c.lane--;c.ev.push({type:'lane',d:-1})}if(inp.right&&c.lane<1){c.lane++;c.ev.push({type:'lane',d:1})}
  {const r=(slip?MCFG.slipRate:MCFG.laneRate)*dt,d=c.lane-c.x;c.lean=d;c.x+=Math.abs(d)<=r?d:Math.sign(d)*r}
  // the speed follows the part of the mine
  {const vt=Z.v*c.speedScale,d=vt-c.v;c.v+=d>0?Math.min(d,MCFG.acc*dt):Math.max(d,-MCFG.brk*dt)}
  // jump and duck. A jump asked for just before landing is remembered; ducking in the air brings the wagon down fast
  if(inp.jump)c.buf=MCFG.jumpBuf;else c.buf=Math.max(0,c.buf-dt);
  if(inp.duck){c.duck=MCFG.duckT;c.buf=0;if(c.air)c.vy=Math.min(c.vy,-11)}else if(inp.duckHold&&!c.air)c.duck=Math.max(c.duck,.08);
  if(!c.air&&c.buf>0){c.air=true;c.airT=0;c.vy=MCFG.jv;c.buf=0;c.duck=0;c.ev.push({type:'jump'})}
  if(c.air){c.airT+=dt;c.vy-=MCFG.g*dt;c.y+=c.vy*dt;if(c.y<=0){c.y=0;c.vy=0;c.air=false;c.ev.push({type:'land',air:c.airT})}}
  c.duck=Math.max(0,c.duck-dt);
  c.s+=c.v*dt;
  // what the wagon runs into
  for(const o of m.obs){if(o.s1<c.s-MCFG.half-1)continue;if(o.s0>c.s+MCFG.half)break;
    let on=false;for(let L=-1;L<=1;L++)if(o.lanes[L+1]&&Math.abs(c.x-L)<1-MCFG.hitW)on=true;if(!on)continue;
    let hit=false;
    if(o.need==='jump')hit=c.s>o.s0+.25&&c.s<o.s1-.25&&c.y<=0;
    else if(c.s+MCFG.half>o.s0&&c.s-MCFG.half<o.s1)hit=o.need==='lane'||!(c.duck>0&&c.y<.3);
    if(hit){c.lights--;c.hits++;c.combo=0;c.crashT=MCFG.crashT;c.v=0;c.fall=o.need==='jump';if(!c.fall){c.vy=0;c.y=0;c.air=false}else c.vy=-2;c.ev.push({type:'hit',kind:o.kind,s:o.s,left:c.lights});return}}
  // coal
  const K=m.coal;while(c.ci<K.length&&K[c.ci].s<c.s-MCFG.coalS-.5)c.ci++;
  for(let i=c.ci;i<K.length&&K[i].s<c.s+MCFG.coalS;i++){const k=K[i];if(c.taken[i]||Math.abs(k.s-c.s)>MCFG.coalS||Math.abs(c.x-k.lane)>.55||Math.abs(c.y+.5-k.h)>MCFG.coalH)continue;
    c.taken[i]=1;c.got++;c.combo++;c.maxCombo=Math.max(c.maxCombo,c.combo);c.ev.push({type:'coal',i,combo:c.combo})}
  // checkpoints and the end
  while(c.cp+1<m.cps.length&&m.cps[c.cp+1].s<=c.s){c.cp++;c.ev.push({type:'cp',i:c.cp,name:m.cps[c.cp].name})}
  if(c.s>=m.len){c.state='done';c.ev.push({type:'end'})}}

/* ---------- an autopilot (the test, and nothing else) ---------- */
// react is how many seconds ahead the pilot sees. It changes track away from what is closed, towards the coal when there is time,
// ducks under what hangs low and jumps the broken rails
function minePilot(c,m,react=.9){const inp={left:false,right:false,jump:false,duck:false,duckHold:false};if(c.state!=='run'||c.crashT>0)return inp;
  const see=Math.max(6,c.v*react),ahead=m.obs.filter(o=>o.s1>c.s-MCFG.half&&o.s0<c.s+see),block=ahead.filter(o=>o.need==='lane'),A=block[0],B=block[1];
  const near=L=>Math.abs(L-c.lane);let want=c.lane;
  if(A){let free=[-1,0,1].filter(L=>!A.lanes[L+1]);const both=B?free.filter(L=>!B.lanes[L+1]):free;if(both.length)free=both;   // a track that is open past the next one too, if there is one
    if(A.lanes[want+1]||!free.includes(want)&&near(free[0])<=1)want=free.sort((a,b)=>near(a)-near(b))[0]}
  else{const k=m.coal.find((k,i)=>!c.taken[i]&&k.s>c.s+1&&k.s<c.s+see);if(k)want=k.lane}
  if(want<c.lane)inp.left=true;else if(want>c.lane)inp.right=true;
  for(const o of ahead){if(!o.lanes[Math.round(c.x)+1]&&!o.lanes[c.lane+1])continue;
    if(o.need==='duck'&&o.s0-c.s-MCFG.half<c.v*.22)inp.duckHold=true,inp.duck=c.duck<=0||c.air;
    if(o.need==='jump'&&!c.air&&o.s0-c.s<Math.max(.9,c.v*.07)&&c.s<o.s0+.2)inp.jump=true}
  return inp}
