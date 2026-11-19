'use strict';
/* =================================================================
   GRUVESIM: the mine wagon race in Gruve 7 on Svalbard. No DOM, no three.js, so tools/test-gruve7.js can drive it in node.
   Four miners race through the mine, each in a wagon that rolls by itself along three tracks, faster in every part of
   the mine. s is how far in a wagon has come, lane is the track it is heading for (-1 left, 0 middle, 1 right), x is
   where it is sideways (in lanes) and y how high it has jumped. There are four things to do: change track, jump, duck
   and use what you found in a crate.
     rocks, parked wagons, barriers and walls close a track: change to another one
     low beams and icicles hang over the track: duck
     broken rails over a shaft: jump (a jump started late, close to the edge, gives a burst of speed)
   A hit spins the wagon round: it loses speed and two lumps of coal, and rolls on. Nobody is put back and nobody is out.
   What makes a wagon fast:
     coal        every lump you carry makes the wagon a little faster (up to 20 lumps)
     speed pads  glowing arrows on a track
     slipstream  stay right behind another wagon for a moment
     the start   jump just as the countdown ends
     crates      turbo (fast, and smashes through everything), pickaxe (thrown ahead: spins a rival or breaks what closes
                 the track), trap (a pile of rocks dropped behind), shield (takes one hit) and magnet (pulls in coal)
   makeMine(def) builds the mine once from data/gruve7.js; makeMineRace(m) starts a race in it, and stepMineRace moves
   it on. The first wagon is the player's, the others are driven by minePilot.
   ================================================================= */
const MSTEP=1/120;
// lane: the distance between two tracks; g and jv: gravity and the speed of a jump (0.72 s in the air); duckT: how long a duck lasts;
// laneRate/slipRate: tracks a second when changing track, on dry rails and on ice; acc/accBoost/brk: how fast the wagon picks up and loses speed;
// half/len: half the length of a wagon, and how close two can be on the same track; hitW: how far into a track a wagon must be to hit
// what stands there (in lanes); coalS/coalH: how close a lump of coal must be, along the track and in height.
// spinT/fallT: how long a hit or a fall into a shaft takes; invT: how long nothing can hit the wagon afterwards; drop: lumps lost;
// coalCap/coalV: how many lumps count for the speed, and how much each gives. The rest are the bursts of speed: how long, and how much faster
const MCFG={lane:2,g:24,jv:8.6,duckT:.8,laneRate:6.5,slipRate:3.3,acc:3.2,accBoost:16,brk:9,half:1.2,len:2.6,hitW:.5,coalS:1.25,coalH:1.15,jumpBuf:.22,
  spinT:.8,fallT:1.2,invT:1.4,drop:2,coalCap:20,coalV:.004,count:3,startEarly:.35,startLate:.22,startT:1.5,startK:1.3,stallT:.8,
  padT:1.1,padK:1.22,padLen:3.4,turboT:2.6,turboK:1.38,trickT:.7,trickK:1.15,perfT:1.1,perfK:1.22,perfD:2.4,draftMin:2.7,draftMax:11,draftT:1.1,draftBoostT:1.3,draftK:1.16,
  boxS:1.4,boxRe:5,rollT:1,magT:7,magS:4,shotV:24,shotLife:2.2,trapBack:2.8};
const MLANE={V:-1,M:0,H:1};
// what you do about each kind of obstacle, how long it is along the track, and whether a pickaxe or a turbo breaks it
const MKIND={ras:{need:'lane',d:.8,brk:true},vogn:{need:'lane',d:1.3,brk:true},bukk:{need:'lane',d:.35,brk:true},vegg:{need:'lane',d:.6},bjelke:{need:'duck',d:.25},istapper:{need:'duck',d:.35,brk:true},brudd:{need:'jump',d:0}};
// the three rivals. skill: how fast they are; react: how far ahead they see (seconds); flub: how often they miss an obstacle
const MRIVALS=[{name:'Kull-Kari',skill:.985,react:.8,flub:.09},{name:'Dynamitt-Dag',skill:.97,react:.62,flub:.15},{name:'Gamle Olaf',skill:.955,react:.95,flub:.12}];
const MITEMS={turbo:'Turbo',hakke:'Hakke',felle:'Steinfelle',skjold:'Skjold',magnet:'Magnet'};

/* ---------- the mine ---------- */
function makeMine(def){
  const m={name:def.name,P:[{s:0,x:0,y:0}],zones:[],obs:[],coal:[],cps:[],boxes:[],pads:[],len:0};let s=0,x=0,y=0;
  const lanes=a=>{const L=[false,false,false];if(!a.length)return[true,true,true];for(const k of a){if(!(k in MLANE))throw new Error('Ukjent spor: '+k);L[MLANE[k]+1]=true}return L};
  const go=(l,dx,dy)=>{s+=l;x+=dx;y+=dy;m.P.push({s,x,y})};
  const ob=(kind,a,len=0)=>{const K=MKIND[kind],o={kind,need:K.need,brk:!!K.brk,s0:s-K.d,s1:s+len+K.d,s,len,lanes:lanes(a)};m.obs.push(o);return o};
  const c={
    get s(){return s},
    sone(name,theme,v){m.zones.push({s,name,theme,v})},
    rett(l){go(l,0,0)},sving(l,dx){go(l,dx,0)},bakke(l,dy,dx=0){go(l,dx,dy)},
    ras(...a){ob('ras',a)},vogn(...a){ob('vogn',a)},bukk(...a){ob('bukk',a)},
    bjelke(...a){ob('bjelke',a)},istapper(...a){ob('istapper',a)},
    brudd(len=3){ob('brudd',[],len)},
    // a set of points: only the given track goes on, the other two end in a wall. A sign over the tracks warns well before
    veksel(open,warn=26){const o=ob('vegg',['V','M','H'].filter(k=>k!==open));o.open=MLANE[open];o.warn=s-warn},
    // n lumps of coal in a row on one track, from dx past the pen; h is how high over the rails they hang
    kull(lane,n=5,gap=2.2,dx=0,h=0){for(let i=0;i<n;i++)m.coal.push({s:s+dx+i*gap,lane:MLANE[lane],h})},
    // n lumps in an arc over a jump, from dx past the pen and len long
    bue(lane,n=4,len=6,dx=-1.5,top=1.7){for(let i=0;i<n;i++){const u=n>1?i/(n-1):.5;m.coal.push({s:s+dx+len*u,lane:MLANE[lane],h:.35+top*4*u*(1-u)})}},
    // crates with something in them, dx past the pen (on all three tracks if none is given), and a speed pad on one track
    kasse(dx=0,...a){lanes(a).forEach((on,i)=>{if(on)m.boxes.push({s:s+dx,lane:i-1})})},
    fart(lane,dx=0){m.pads.push({s:s+dx,lane:MLANE[lane],len:MCFG.padLen})},
    cp(name){m.cps.push({s,name})},
    mal(){m.len=s}};
  def.build(c);if(!m.len)m.len=s;
  m.P.push({s:m.len+90,x,y});   // the tunnel goes straight on past the end, out into the daylight
  m.obs.sort((a,b)=>a.s0-b.s0);m.coal.sort((a,b)=>a.s-b.s);m.cps.sort((a,b)=>a.s-b.s);m.boxes.sort((a,b)=>a.s-b.s);m.pads.sort((a,b)=>a.s-b.s);m.coal.forEach((k,i)=>k.i=i);m.obs.forEach((o,i)=>o.i=i);
  return m}
// the centre line at s: every stretch eases in and out, so the tunnel never has a kink
function mSeg(m,s){const P=m.P;let a=0,b=P.length-1;while(b-a>1){const k=(a+b)>>1;if(P[k].s<=s)a=k;else b=k}return a}
function mineAt(m,s,o){const P=m.P;o=o||{};if(s<=0){o.x=P[0].x;o.y=P[0].y;o.dx=o.dy=0;return o}const i=mSeg(m,s),A=P[i],B=P[i+1],L=B.s-A.s,u=Math.max(0,Math.min(1,(s-A.s)/L)),e=u*u*(3-2*u),de=6*u*(1-u)/L;
  o.x=A.x+(B.x-A.x)*e;o.y=A.y+(B.y-A.y)*e;o.dx=(B.x-A.x)*de;o.dy=(B.y-A.y)*de;return o}
function mineZone(m,s){let k=0;for(let i=0;i<m.zones.length;i++)if(m.zones[i].s<=s)k=i;return k}

/* ---------- a race ---------- */
function mRng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
// o: speedScale (the speed limit from the menu), easy (the rivals are slower), seed, pilot (the player's wagon drives itself: the test)
function makeMineRace(m,o={}){const R={m,t:0,count:MCFG.count,go:false,early:false,rocket:false,carts:[],traps:[],shots:[],boxT:new Float32Array(m.boxes.length),gone:new Uint8Array(m.obs.length),ev:[],rng:mRng(o.seed||7),nfin:0,
    scale:o.speedScale||1,easy:!!o.easy};
  // the grid: the player starts at the back, so there is somebody to catch
  const grid=[[0,0],[5.5,-1],[5.5,1],[11,0]];
  grid.forEach(([s,lane],i)=>{const r=i?MRIVALS[i-1]:{name:'Du',skill:1,react:o.react||.9,flub:0};
    R.carts.push({i,ai:i>0||!!o.pilot,name:r.name,skill:r.skill,react:r.react,flub:r.flub,s,v:0,lane,x:lane,y:0,vy:0,duck:0,air:false,airT:0,buf:0,stun:0,fall:false,fallTo:0,inv:0,stall:0,boost:0,boostK:1,
      item:null,itemT:0,aiT:0,shield:false,magnet:0,draft:0,coal:0,got:0,combo:0,maxCombo:0,hits:0,ci:0,taken:i?null:new Uint8Array(m.coal.length),fin:0,place:i?4-i:4,lean:0,jumpS:-99,over:null,pad:-1,bumpT:0,skip:{},kind:''})});
  R.P=R.carts[0];return R}
function mBoost(c,t,k){if(c.boost<=0||k>c.boostK)c.boostK=k;c.boost=Math.max(c.boost,t)}
// a wagon is hit: by what stands on the track, by a pickaxe or by a trap. A shield takes the hit instead
function mCrash(R,c,kind,o){if(c.shield){c.shield=false;c.inv=MCFG.invT;R.ev.push({type:'shield',c:c.i,kind});return}
  const d=Math.min(c.coal,MCFG.drop);c.coal-=d;c.hits++;c.combo=0;c.boost=0;c.kind=kind;c.fall=kind==='brudd';c.stun=c.fall?MCFG.fallT:MCFG.spinT;c.inv=c.stun+MCFG.invT;c.air=false;c.buf=0;c.duck=0;c.over=null;
  if(c.fall){c.v=0;c.vy=-2;c.fallTo=o.s1+3}else{c.v*=.35;c.vy=0;c.y=0;if(kind==='vegg')c.lane=o.open}
  R.ev.push({type:'hit',c:c.i,kind,drop:d,s:c.s})}
// what is in the crate: the leader gets things to defend with, the last wagon things to catch up with
function mRoll(R,c){const p=c.place,r=R.rng(),T=p===1?[['felle',.4],['skjold',.3],['magnet',.2],['hakke',.1]]:p===R.carts.length?[['turbo',.5],['hakke',.3],['skjold',.2]]:[['hakke',.3],['turbo',.25],['felle',.15],['skjold',.15],['magnet',.15]];
  let a=0,k=T[0][0];for(const[n,w]of T){a+=w;if(r<a){k=n;break}}return c.i&&k==='magnet'?'skjold':k}
function mUse(R,c){const k=c.item;c.item=null;c.aiT=0;R.ev.push({type:'use',c:c.i,item:k});
  if(k==='turbo'){c.boostK=MCFG.turboK;c.boost=Math.max(c.boost,MCFG.turboT);c.inv=Math.max(c.inv,MCFG.turboT)}
  else if(k==='hakke')R.shots.push({s:c.s+1.6,lane:c.lane,v:c.v+MCFG.shotV,own:c.i,life:MCFG.shotLife});
  else if(k==='felle'){R.traps.push({s:c.s-MCFG.trapBack,lane:c.lane,own:c.i,t:0});if(R.traps.length>8)R.traps.shift()}
  else if(k==='skjold')c.shield=true;else if(k==='magnet')c.magnet=MCFG.magT}
// is there a wagon beside c on the track it wants to change to?
function mBeside(R,c,lane){for(const o of R.carts)if(o!==c&&!o.fall&&Math.abs(o.s-c.s)<MCFG.len&&(o.lane===lane||Math.abs(o.x-lane)<.6)&&Math.abs(o.y-c.y)<1)return true;return false}
// one step of one wagon. inp: left, right, jump, duck and use are true the step the key goes down, duckHold while it is held
function stepMineCart(R,c,inp,dt){const m=R.m,Z=m.zones[mineZone(m,c.s)],slip=Z.theme==='is',side=()=>{const r=(slip?MCFG.slipRate:MCFG.laneRate)*dt,d=c.lane-c.x;c.lean=d;c.x+=Math.abs(d)<=r?d:Math.sign(d)*r};
  c.inv=Math.max(0,c.inv-dt);c.magnet=Math.max(0,c.magnet-dt);c.itemT=Math.max(0,c.itemT-dt);c.bumpT=Math.max(0,c.bumpT-dt);
  if(c.fin){c.v=Math.max(0,c.v-(c.v*.9+1.5)*dt);c.s+=c.v*dt;side();if(c.y>0||c.vy>0){c.vy-=MCFG.g*dt;c.y+=c.vy*dt;if(c.y<0){c.y=0;c.vy=0;c.air=false}}return}
  // spinning after a hit, or at the bottom of a shaft: the wagon is put back on the rails on the far side
  if(c.stun>0){c.stun-=dt;
    if(c.fall){c.vy-=MCFG.g*dt;c.y=Math.max(-7,c.y+c.vy*dt);if(c.stun<=0){c.fall=false;c.s=Math.max(c.s,c.fallTo);c.y=0;c.vy=0;c.v=Z.v*R.scale*.45;R.ev.push({type:'back',c:c.i})}}
    else{c.v+=(Z.v*R.scale*.3-c.v)*Math.min(1,dt*3);c.s+=c.v*dt;side()}
    if(c.stun<=0)c.stun=0;return}
  if(c.stall>0){c.stall-=dt;return}
  // changing track: one track at a time, also in the air; not into a wagon that is right beside
  for(const d of[inp.left?-1:0,inp.right?1:0])if(d&&c.lane+d>=-1&&c.lane+d<=1){if(mBeside(R,c,c.lane+d)){c.lean=d*.6;R.ev.push({type:'side',c:c.i})}else{c.lane+=d;R.ev.push({type:'lane',c:c.i,d})}}
  side();
  // the speed follows the part of the mine; the coal on board, the rival's skill and a burst of speed come on top
  c.boost=Math.max(0,c.boost-dt);if(c.boost<=0)c.boostK=1;
  {let k=R.scale*(1+c.coal*MCFG.coalV)*c.boostK;if(c.i){k*=c.skill*(R.easy?.94:1)*(1+Math.max(-.1,Math.min(.07,(R.P.s-c.s)*.0014)))}
    const d=Z.v*k-c.v;c.v+=d>0?Math.min(d,(c.boost>0?MCFG.accBoost:MCFG.acc)*dt):Math.max(d,-MCFG.brk*dt)}
  // jump and duck. A jump asked for just before landing is remembered; ducking in the air brings the wagon down fast
  if(inp.jump)c.buf=MCFG.jumpBuf;else c.buf=Math.max(0,c.buf-dt);
  if(inp.duck){c.duck=MCFG.duckT;c.buf=0;if(c.air)c.vy=Math.min(c.vy,-11)}else if(inp.duckHold&&!c.air)c.duck=Math.max(c.duck,.08);
  if(!c.air&&c.buf>0){c.air=true;c.airT=0;c.vy=MCFG.jv;c.buf=0;c.duck=0;c.jumpS=c.s;c.over=null;R.ev.push({type:'jump',c:c.i})}
  if(c.air){c.airT+=dt;c.vy-=MCFG.g*dt;c.y+=c.vy*dt;if(c.y<=0){c.y=0;c.vy=0;c.air=false;R.ev.push({type:'land',c:c.i,air:c.airT});
    // over a break in the rails: a burst of speed, more for a jump started close to the edge
    if(c.over&&c.s>=c.over.s1-.3){const perf=c.over.s0-c.jumpS<MCFG.perfD;mBoost(c,perf?MCFG.perfT:MCFG.trickT,perf?MCFG.perfK:MCFG.trickK);R.ev.push({type:'trick',c:c.i,perf})}c.over=null}}
  c.duck=Math.max(0,c.duck-dt);
  c.s+=c.v*dt;
  // what the wagon runs into
  const turbo=c.boost>0&&c.boostK>=MCFG.turboK;
  for(const o of m.obs){if(o.s1<c.s-MCFG.half-1)continue;if(o.s0>c.s+MCFG.half)break;if(R.gone[o.i])continue;
    let on=false;for(let L=-1;L<=1;L++)if(o.lanes[L+1]&&Math.abs(c.x-L)<1-MCFG.hitW)on=true;if(!on)continue;
    if(o.need==='jump'){if(c.air&&c.s>o.s0)c.over=o;if(c.inv<=0&&c.s>o.s0+.25&&c.s<o.s1-.25&&c.y<=0){mCrash(R,c,o.kind,o);return}continue}
    if(c.s+MCFG.half<=o.s0||c.s-MCFG.half>=o.s1)continue;
    if(c.inv>0){if(turbo&&o.brk){R.gone[o.i]=1;R.ev.push({type:'smash',c:c.i,o:o.i})}continue}
    if(o.need==='lane'||!(c.duck>0&&c.y<.3)){if(o.brk&&o.need==='lane'){R.gone[o.i]=1;R.ev.push({type:'smash',c:c.i,o:o.i})}mCrash(R,c,o.kind,o);if(c.stun>0)return}}
  // speed pads
  if(!c.air)for(let i=0;i<m.pads.length;i++){const p=m.pads[i];if(p.s>c.s)break;if(i!==c.pad&&c.s<p.s+p.len&&Math.abs(c.x-p.lane)<.5){c.pad=i;mBoost(c,MCFG.padT,MCFG.padK);R.ev.push({type:'pad',c:c.i})}}
  // crates
  for(let i=0;i<m.boxes.length;i++){const b=m.boxes[i];if(b.s<c.s-MCFG.boxS)continue;if(b.s>c.s+MCFG.boxS)break;if(R.boxT[i]>0||Math.abs(c.x-b.lane)>.55||c.y>1.3)continue;
    R.boxT[i]=MCFG.boxRe;if(!c.item){c.item=mRoll(R,c);c.itemT=MCFG.rollT;c.aiT=.5+R.rng()*2.2}R.ev.push({type:'box',c:c.i,i,item:c.item})}
  if(c.item&&c.itemT<=0&&inp.use)mUse(R,c);
  // coal: only the player's wagon picks it up. With the magnet it comes from all three tracks
  if(c.taken){const K=m.coal,ds=c.magnet>0?MCFG.magS:MCFG.coalS;while(c.ci<K.length&&K[c.ci].s<c.s-ds-.5)c.ci++;
    for(let i=c.ci;i<K.length&&K[i].s<c.s+ds;i++){const k=K[i];if(c.taken[i]||Math.abs(k.s-c.s)>ds)continue;if(c.magnet<=0&&(Math.abs(c.x-k.lane)>.55||Math.abs(c.y+.5-k.h)>MCFG.coalH))continue;
      c.taken[i]=1;c.got++;c.coal=Math.min(MCFG.coalCap,c.coal+1);c.combo++;c.maxCombo=Math.max(c.maxCombo,c.combo);R.ev.push({type:'coal',c:0,i,combo:c.combo})}}
  if(c.s>=m.len){c.fin=R.t;c.place=++R.nfin;c.boost=0;R.ev.push({type:'fin',c:c.i,place:c.place})}}
// one step of the whole race. inp is the player's
function stepMineRace(R,inp,dt){const m=R.m,C=R.carts,P=R.P;
  // the countdown: a jump just as it ends is a flying start, one too early stalls the wagon
  if(R.count>0){R.count-=dt;if(inp.jump&&!P.ai){if(R.count>MCFG.startEarly)R.early=true;else if(!R.early)R.rocket=true}
    if(R.count<=0){R.go=true;R.ev.push({type:'go'});for(const c of C){if(c.ai){if(R.rng()<.4)mBoost(c,MCFG.startT*.6,MCFG.startK)}else if(R.rocket){mBoost(c,MCFG.startT,MCFG.startK);R.ev.push({type:'rocket',c:0})}else if(R.early){c.stall=MCFG.stallT;R.ev.push({type:'early',c:0})}}}
    return}
  R.t+=dt;
  if(!P.ai&&!R.rocket&&!R.early&&R.t<MCFG.startLate&&inp.jump){R.rocket=true;mBoost(P,MCFG.startT,MCFG.startK);R.ev.push({type:'rocket',c:0});inp=Object.assign({},inp,{jump:false})}
  // who is where: those who are in, in the order they came, then the others by how far they have come
  {const o=C.filter(c=>!c.fin).sort((a,b)=>b.s-a.s);o.forEach((c,i)=>c.place=R.nfin+i+1)}
  for(const c of C){if(c.ai&&c.item)c.aiT-=dt;stepMineCart(R,c,c.ai?minePilot(c,R):inp,dt)}
  // slipstream: right behind another wagon for a moment
  for(const c of C){if(c.fin||c.stun>0||c.air){c.draft=0;continue}let near=false;for(const o of C)if(o!==c&&!o.fall&&o.s-c.s>MCFG.draftMin&&o.s-c.s<MCFG.draftMax&&Math.abs(o.x-c.x)<.5)near=true;
    c.draft=near?c.draft+dt:Math.max(0,c.draft-dt*2);if(c.draft>=MCFG.draftT){c.draft=0;mBoost(c,MCFG.draftBoostT,MCFG.draftK);R.ev.push({type:'draft',c:c.i})}}
  // two wagons on the same track cannot be in the same place: the one behind is held back and gives the one in front a push
  // (a wagon that is in does not stand in the way of those still coming)
  for(const a of C)for(const b of C){if(a===b||a.fall||b.fall||b.fin||b.s<=a.s||b.s-a.s>=MCFG.len||Math.abs(a.x-b.x)>=.7||Math.abs(a.y-b.y)>=1)continue;
    a.s=b.s-MCFG.len;if(a.v>b.v){const dv=a.v-b.v;a.v-=dv*.8;b.v+=dv*.25;if(a.bumpT<=0){a.bumpT=.5;R.ev.push({type:'bump',c:a.i,o:b.i})}}}
  // pickaxes in the air: they spin the first wagon they reach, or break what closes the track
  for(let i=R.shots.length-1;i>=0;i--){const q=R.shots[i];q.s+=q.v*dt;q.life-=dt;let done=q.life<=0||q.s>m.len+20;
    for(const c of C)if(!done&&c.i!==q.own&&!c.fin&&!c.fall&&Math.abs(c.x-q.lane)<.6&&Math.abs(c.s-q.s)<1.7){done=true;if(c.inv<=0){mCrash(R,c,'hakke');R.ev.push({type:'struck',c:c.i,by:q.own})}}
    if(!done)for(const o of m.obs){if(o.s0>q.s+1)break;if(o.s1<q.s-1||R.gone[o.i]||!o.lanes[q.lane+1]||o.need==='jump'||o.kind==='bjelke')continue;if(q.s>=o.s0-.5){done=true;if(o.brk){R.gone[o.i]=1;R.ev.push({type:'smash',c:q.own,o:o.i})}}}
    if(done)R.shots.splice(i,1)}
  // traps on the track: jump them or go round
  for(let i=R.traps.length-1;i>=0;i--){const q=R.traps[i];q.t+=dt;for(const c of C)if((c.i!==q.own||q.t>1.5)&&!c.fin&&!c.fall&&Math.abs(c.x-q.lane)<.58&&Math.abs(c.s-q.s)<1.4&&c.y<.7){
      if(c.inv<=0){mCrash(R,c,'felle');R.ev.push({type:'trapped',c:c.i,by:q.own})}R.traps.splice(i,1);break}}
  for(let i=0;i<R.boxT.length;i++)if(R.boxT[i]>0)R.boxT[i]-=dt}
// the order at the end: those who are in by their time, the others by how far they have come, with the time they are heading for
function mineRanking(R){const m=R.m;return R.carts.map(c=>({c,t:c.fin||R.t+(m.len-c.s)/Math.max(8,c.v)})).sort((a,b)=>(a.c.fin?0:1)-(b.c.fin?0:1)||a.t-b.t).map((r,i)=>({name:r.c.name,i:r.c.i,t:r.t,place:i+1,fin:!!r.c.fin}))}

/* ---------- the pilot: drives the rivals, and the player's wagon in the test ---------- */
// It changes track away from what is closed (and from traps and wagons that are spinning), towards crates, pads and coal when there is time,
// ducks under what hangs low, jumps the broken rails and uses what it finds in the crates. A rival now and then misses an obstacle (flub)
function minePilot(c,R){const m=R.m,inp={left:false,right:false,jump:false,duck:false,duckHold:false,use:false};if(c.fin||c.stun>0||c.stall>0)return inp;
  const see=Math.max(6,c.v*c.react),miss=o=>{if(!c.flub)return false;if(c.skip[o.i]===undefined)c.skip[o.i]=R.rng()<c.flub;return c.skip[o.i]};
  const ahead=m.obs.filter(o=>!R.gone[o.i]&&o.s1>c.s-MCFG.half&&o.s0<c.s+see&&!miss(o)),block=ahead.filter(o=>o.need==='lane').map(o=>o.lanes.slice());
  // what else closes a track: a trap, or a wagon that is spinning or much slower
  {const extra=[false,false,false];let any=false;for(const q of R.traps)if(q.s>c.s&&q.s<c.s+see&&(q.own!==c.i||q.t>1.5)){extra[q.lane+1]=true;any=true}
    for(const o of R.carts)if(o!==c&&!o.fin&&o.s>c.s&&o.s-c.s<see*.7&&o.v<c.v-3){extra[Math.round(o.x)+1]=true;any=true}
    if(any&&!extra.every(Boolean))block.unshift(extra)}
  const A=block[0],B=block[1],near=L=>Math.abs(L-c.lane);let want=c.lane;
  if(A){let free=[-1,0,1].filter(L=>!A[L+1]);const both=B?free.filter(L=>!B[L+1]):free;if(both.length)free=both;   // a track that is open past the next one too, if there is one
    if(free.length&&(A[want+1]||!free.includes(want)&&near(free[0])<=1))want=free.sort((a,b)=>near(a)-near(b))[0]}
  else{const p=m.pads.find(p=>p.s>c.s+2&&p.s<c.s+see),b=!c.item&&m.boxes.find((b,i)=>R.boxT[i]<=0&&b.s>c.s+1&&b.s<c.s+see&&Math.abs(b.lane-c.lane)<=1),k=c.taken&&m.coal.find((k,i)=>!c.taken[i]&&k.s>c.s+1&&k.s<c.s+see);
    if(p)want=p.lane;else if(b)want=b.lane;else if(k)want=k.lane}
  if(want<c.lane)inp.left=true;else if(want>c.lane)inp.right=true;
  for(const o of ahead){if(!o.lanes[Math.round(c.x)+1]&&!o.lanes[c.lane+1])continue;
    if(o.need==='duck'&&o.s0-c.s-MCFG.half<c.v*.22){inp.duckHold=true;inp.duck=c.duck<=0||c.air}
    if(o.need==='jump'&&!c.air&&o.s0-c.s<Math.max(.9,c.v*.07)&&c.s<o.s0+.2)inp.jump=true}
  for(const q of R.traps)if(!c.air&&q.lane===c.lane&&(q.own!==c.i||q.t>1.5)&&q.s>c.s&&q.s-c.s<Math.max(1.6,c.v*.1))inp.jump=true;   // a trap it could not go round
  if(c.item&&c.itemT<=0&&c.aiT<=0){const k=c.item,inLane=(a,b)=>R.carts.some(o=>o!==c&&!o.fin&&Math.abs(o.x-c.x)<.6&&o.s-c.s>a&&o.s-c.s<b);
    inp.use=k==='turbo'||k==='skjold'||k==='magnet'||(k==='hakke'?inLane(3,40)||c.aiT<-4:inLane(-30,-3)||c.aiT<-3)}
  return inp}
