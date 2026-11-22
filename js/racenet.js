'use strict';
/* =================================================================
   RACENET: «Kjør sammen» on Racerøya. The same rooms as the rest of the game (js/net.js): one player invites the room from the race menu,
   the others get «Vil du bli med?» wherever they are and come straight to the race. The leader picks the track and the rivals and starts it
   for everyone: the same five lights at the same moment on every screen.
   - Every player drives their own car on their own screen and sends where it is 15 times a second (Rp).
   - The leader drives the rivals and sends where they are (Ra); the others show them. If the leader leaves, everyone drives the rivals themselves.
   - Bumping works between players: each screen pushes only its own car, the other screen pushes the other one (raceCollide in js/racesim.js).
   - Prizes, stars and records stay personal.
   Messages (all start with R, passed on by js/net.js):
     Ri invite {id,track,lvl}, Rx the leader cancels, Rj join, Rl leave the lobby, Rq quit a race, Rr ready again {ready},
     Rm the lobby {track,lvl,list}, Rs start {track,lvl,order,rivals,go}, Rp my car, Ra the rivals, Rf I am at the finish {t,best}.
   Loaded after race.js and net.js; uses their globals at run time.
   ================================================================= */
const RN_HZ=15;
const rnSend=m=>{if(typeof NET!=='undefined'&&NET.on)netSend(m)};
const rnOn=()=>typeof NET!=='undefined'&&NET.on;
const rnLead=()=>RC.net&&RC.net.lead===NET.me;
const rnRacing=()=>!!(RC.net&&RC.net.racing);
const rnName=id=>id===NET.me?NET.name:((NET.players.get(id)||{}).name||'Sjåfør');
// a player's colour: their paint, or the room colour of their slot when somebody earlier in the order has the same paint
function rnColors(order){const used=[];return order.map(id=>{const p=id===NET.me?{info:myInfo(),slot:NET.slot}:NET.players.get(id)||{info:{paint:0},slot:0},c=(PAINTS[p.info&&p.info.paint]||PAINTS[0]).c;
  const col=used.includes(c)?netCol(p.slot|0):c;used.push(col);return col})}

/* ---------- the lobby ---------- */
function rnHost(){if(RC.net||!rnOn())return;RC.two=false;store.set('raceTwo',false);RC.invite=null;
  RC.net={id:Math.random().toString(36).slice(2,10),lead:NET.me,track:rcTrack().id,lvl:RC.lvl,mem:new Map(),list:[],racing:false};
  rnSend({t:'Ri',id:RC.net.id,track:RC.net.track,lvl:RC.net.lvl});rcMenuRender();toast('Invitasjonen er sendt til rommet')}
function rnJoin(inv){RC.invite=null;RC.two=false;RC.net={id:inv.id,lead:inv.from,track:inv.track,lvl:inv.lvl,mem:new Map(),list:[],racing:false};rnSend({t:'Rj',id:inv.id})}
function rnLeave(){const N=RC.net;if(!N)return;rnSend({t:N.lead===NET.me?'Rx':N.racing?'Rq':'Rl',id:N.id});if(N.racing&&N.lead!==NET.me)rnSend({t:'Rl',id:N.id});RC.net=null}
// the leader tells everyone who is in and which track: after every change
function rnList(){const N=RC.net;if(!N||N.lead!==NET.me)return;N.track=rcTrack().id;N.lvl=RC.lvl;
  rnSend({t:'Rm',id:N.id,track:N.track,lvl:N.lvl,list:[{id:NET.me,ready:1},...[...N.mem.values()].map(e=>({id:e.id,ready:e.ready?1:0}))]});if(RC.on&&RC.phase==='menu')rcMenuRender()}
function rnRoster(){const N=RC.net;if(!N)return[];return N.lead===NET.me?[{id:NET.me,ready:true},...N.mem.values()]:N.list}
// the «Kjør sammen» part of the race menu: invite, answer an invitation, or wait in the lobby
function rnMenu(){const N=RC.net,room=rnOn()&&NET.players.size>0,inv=!N&&RC.invite,box=$('rmNet');box.hidden=!room&&!N&&!inv;
  const lead=!N||N.lead===NET.me;for(const b of $('rmTracks').querySelectorAll('button'))b.disabled=!lead;for(let i=0;i<3;i++)$('rmLv'+i).disabled=!lead;
  $('rmSeg').hidden=!!N;$('rmGo').hidden=!lead;$('rmGo').textContent=N?'Start løpet for alle':'Til start!';$('rmWait').hidden=lead;
  if(box.hidden)return;$('rmNetCode').textContent=NET.code;const list=$('rmNetList');list.innerHTML='';
  $('rmInvite').hidden=!!N||!!inv||RC.two;$('rmJoin').hidden=$('rmDecline').hidden=!inv;$('rmLeave').hidden=!N;
  if(inv){const tr=RACE_TRACKS.find(t=>t.id===inv.track);$('rmNetNote').textContent=inv.name+' har startet et race på '+(tr?tr.name:'Racerøya')+' og venter på deg.'}
  else if(!N)$('rmNetNote').textContent=RC.two?'Velg 1 spiller for å kjøre mot de andre i rommet.':'Vil du kjøre mot de andre i rommet? Inviter dem, så kan de bli med fra der de er. De andre plassene fylles med motstandere.';
  else{$('rmNetNote').textContent=lead?'Velg bane og motstandere, og start når de andre er klare. De som ikke er klare, står over denne runden.':'Venter på at '+rnName(N.lead)+' starter løpet.';
    for(const e of rnRoster()){const li=document.createElement('li'),dot=document.createElement('i'),nm=document.createElement('span'),st=document.createElement('small');
      dot.style.background=e.id===NET.me?'#ff6a2a':netCol((NET.players.get(e.id)||{}).slot|0);nm.textContent=rnName(e.id)+(e.id===NET.me?' (deg)':'')+(e.id===N.lead?' · leder':'');st.textContent=e.ready?'klar':'kjører';li.append(dot,nm,st);list.appendChild(li)}}}

/* ---------- the start: the same grid on every screen ---------- */
function rnStart(){const N=RC.net;if(!N||N.lead!==NET.me)return;rnList();
  const order=[NET.me,...[...N.mem.values()].filter(e=>e.ready&&NET.players.has(e.id)).map(e=>e.id)].slice(0,6),L=RACE_LEVELS[RC.lvl],cols=rnColors(order).map(rcHex);
  const riv=RACE_RIVALS.slice();for(let i=riv.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[riv[i],riv[j]]=[riv[j],riv[i]]}
  const far=r=>cols.every(h=>{const c=rcHex(r.col);return Math.abs(c[0]-h[0])+Math.abs(c[1]-h[1])+Math.abs(c[2]-h[2])>150});riv.sort((a,b)=>far(b)-far(a));
  const rivals=riv.slice(0,Math.max(0,6-order.length)).map((r,i)=>({name:r.name,col:r.col,num:r.num,skill:+(L.skill*(1-.025*Math.random())*(1-.004*i)).toFixed(4)}));
  for(const e of N.mem.values())e.ready=false;const go=netNow()+5600;
  rnSend({t:'Rs',id:N.id,track:N.track,lvl:N.lvl,order,rivals,go});rnBegin(order,rivals,performance.now()+5600)}
// build the race: the rivals in front, the players behind them in the order the leader gave. goLocal: the start, on this computer's clock
function rnBegin(order,rivals,goLocal){const N=RC.net,tr=rcTrack();if(RC.track!==tr){RC.track=tr;rcBuildTrack(tr)}
  N.racing=true;N.order=order;N.done=false;const cols=rnColors(order),lead=N.lead===NET.me;
  const ents=rivals.map(r=>({name:r.name,col:r.col,num:r.num,skill:r.skill}));order.forEach((id,i)=>ents.push({name:rnName(id),col:cols[i],num:i+1,human:id===NET.me,pid:id}));
  RC.two=false;RC.goWall=goLocal;rcStart(ents,Math.max(1.5,(goLocal-performance.now())/1000));
  const R=RC.R;R.remoteStep=rnRemoteStep;RC.rivalCars=[];
  R.cars.forEach((c,i)=>{const e=ents[i];if(e.pid){c.pid=e.pid;if(e.pid!==NET.me){c.remote=true;c.net={}}}else{RC.rivalCars.push(c);if(!lead){c.remote=true;c.net={}}}});
  RC.sendT=0}

/* ---------- during the race: send my car (and the rivals, for the leader), move the others ---------- */
const rnF=v=>+v.toFixed(2);
function rnTick(dt){const N=RC.net;if(!N||!N.racing||!RC.R||!rnOn())return;RC.sendT-=dt;if(RC.sendT>0)return;RC.sendT=1/RN_HZ;const tm=netNow();
  const me=RC.humans[0];if(me)rnSend({t:'Rp',id:N.id,tm,c:rnPack(me)});
  if(N.lead===NET.me&&RC.rivalCars.length)rnSend({t:'Ra',id:N.id,tm,c:RC.rivalCars.map(rnPack)})}
function rnPack(c){return[rnF(c.x),rnF(c.y),+c.a.toFixed(3),rnF(c.vx),rnF(c.vy),+c.w.toFixed(3),+c.steer.toFixed(2),(c.brk>0?1:0)|(c.hb?2:0)|(c.boost>0?4:0)|(c.done?8:0),rnF(c.prog)]}
function rnStore(p,c,a,tm){if(!Array.isArray(a)||a.length!==9||!a.every(v=>typeof v==='number'&&isFinite(v)&&Math.abs(v)<1e6))return;const n=c.net||(c.net={});
  const o=performance.now()-tm;if(p){p.off=p.off==null||o<p.off?o:p.off+(o-p.off)*.02}
  n.x=a[0];n.y=a[1];n.a=a[2];n.vx=a[3];n.vy=a[4];n.w=a[5];n.st=a[6];n.fl=a[7];n.prog=a[8];n.at=p&&p.off!=null?tm+p.off:performance.now();n.seen=performance.now()}
// a car from the network: where it was, moved on by its speed for the time the message took (at most a quarter second), and
// eased towards that, so it glides between updates and the bumps happen where the car really is
function rnRemoteStep(c,dt){const n=c.net;if(!n||n.x==null){c.vx=c.vy=c.w=0;return}const age=Math.min(.25,Math.max(0,(performance.now()-n.at)/1000));
  const tx=n.x+n.vx*age,ty=n.y+n.vy*age,ta=n.a+n.w*age;
  if(Math.hypot(tx-c.x,ty-c.y)>12){c.x=tx;c.y=ty;c.a=ta}   // far off (the first message, a reset): jump there
  const k=1-Math.exp(-dt*9);c.vx=n.vx;c.vy=n.vy;c.w=n.w;c.x+=c.vx*dt;c.y+=c.vy*dt;c.a=rwrap(c.a+c.w*dt);c.x+=(tx-c.x)*k;c.y+=(ty-c.y)*k;c.a=rwrap(c.a+rwrap(ta-c.a)*k);
  c.steer=n.st;c.brk=n.fl&1?1:0;c.hb=n.fl&2?1:0;c.boost=n.fl&4?.5:0;const ca=Math.cos(c.a),sa=Math.sin(c.a);c.u=c.vx*ca+c.vy*sa;c.v=-c.vx*sa+c.vy*ca;c.thr=c.u>1?1:0;
  const q=trackAt(RC.T,c.x,c.y,c.hint);c.hint=q.i;c.s=q.s;c.d=q.d;c.surfR=c.surfF=q.surf;c.beta=Math.hypot(c.vx,c.vy)>3?Math.atan2(c.v,Math.abs(c.u)):0;
  if(typeof n.prog==='number')c.prog=n.prog;const R=RC.R;c.lap=Math.max(0,Math.floor(c.prog/R.T.L));
  // a rival from the leader crosses the line for the last time: it is at the finish here too
  if(!c.pid&&!c.done&&c.prog>=R.laps*R.T.L){c.done=true;c.finT=R.t;R.finished.push(c)}
  // nothing heard for a long while: the player is gone
  if(c.pid&&performance.now()-n.seen>6000){c.gone=true}}
// I am at the finish: tell the others my time
// the time is measured from the common start on the wall clock, so a slow computer (fewer steps) does not get a better time
function rnFinish(c){const N=RC.net;if(!N||!N.racing)return;if(RC.goWall)c.finT=Math.max(c.finT,(performance.now()-RC.goWall)/1000);rnSend({t:'Rf',id:N.id,tm:netNow(),time:+c.finT.toFixed(2),best:c.best!=null?+c.best.toFixed(2):null,c:rnPack(c)})}
// the leader is gone in the middle of a race: everyone drives the rivals themselves from where they are
function rnTakeRivals(){if(!RC.R)return;for(const c of RC.rivalCars||[]){if(!c.remote)continue;c.remote=false;c.net=null;c.ai=null;c.base=c.base||c.skill}}

/* ---------- messages from the others (js/net.js passes on everything whose type starts with R) ---------- */
function raceNet(p,m){const N=RC.net,num=v=>typeof v==='number'&&isFinite(v);if(typeof m.id!=='string'||m.id.length>16)return;
  if(m.t==='Ri'){if(N||!RACE_TRACKS.some(t=>t.id===m.track))return;RC.invite={id:m.id,track:m.track,lvl:Math.max(0,Math.min(2,m.lvl|0)),from:p.id,name:p.name};
    if(RC.on){if(RC.phase==='menu')rcMenuRender()}else if(state.mode==='play'&&state.world&&!state.course)openAsk('raceInvite');else toast(p.name+' inviterer til race på Racerøya');return}
  if(m.t==='Rx'){if(RC.invite&&RC.invite.id===m.id){RC.invite=null;if(RC.on&&RC.phase==='menu')rcMenuRender()}
    if(N&&N.id===m.id&&N.lead===p.id)rnLeadGone(p.name+' avsluttet racet');return}
  if(!N||N.id!==m.id)return;
  if(m.t==='Rj'&&N.lead===NET.me){N.mem.set(p.id,{id:p.id,ready:true});rnList();toast(p.name+' er med i racet');return}
  if(m.t==='Rl'){if(N.lead===NET.me){N.mem.delete(p.id);rnList()}else if(N.list){N.list=N.list.filter(e=>e.id!==p.id);if(RC.on&&RC.phase==='menu')rcMenuRender()}rnGoneCar(p.id);return}
  if(m.t==='Rq'){rnGoneCar(p.id);const e=N.mem.get(p.id);if(e){e.ready=false;rnList()}return}
  if(m.t==='Rr'){const e=N.mem.get(p.id);if(e){e.ready=!!m.ready;rnList()}return}
  if(m.t==='Rm'&&N.lead===p.id&&Array.isArray(m.list)){N.list=m.list.filter(e=>e&&typeof e.id==='string').slice(0,NET_MAX).map(e=>({id:e.id,ready:!!e.ready}));
    if(RACE_TRACKS.some(t=>t.id===m.track))N.track=m.track;N.lvl=Math.max(0,Math.min(2,m.lvl|0));RC.lvl=N.lvl;
    if(!N.list.some(e=>e.id===NET.me))rnSend({t:'Rj',id:N.id});if(RC.on&&RC.phase==='menu'){const tr=rcTrack();if(RC.track!==tr){RC.track=tr;rcBuildTrack(tr);RC.menuT=0}rcMenuRender()}return}
  if(m.t==='Rs'&&N.lead===p.id){if(!RACE_TRACKS.some(t=>t.id===m.track)||!num(m.go)||!Array.isArray(m.order)||!m.order.includes(NET.me)||!Array.isArray(m.rivals))return;
    if(!RC.on||RC.phase!=='menu')return;   // still busy (the result of the last race): this round goes without you
    N.track=m.track;N.lvl=Math.max(0,Math.min(2,m.lvl|0));RC.lvl=N.lvl;
    const rivals=m.rivals.slice(0,6).filter(r=>r&&typeof r.name==='string').map(r=>({name:String(r.name).slice(0,16),col:/^#[0-9a-f]{6}$/i.test(r.col)?r.col:'#888888',num:Math.max(0,Math.min(99,r.num|0)),skill:num(r.skill)?Math.max(.5,Math.min(1.1,r.skill)):.9}));
    rnBegin(m.order.filter(id=>typeof id==='string').slice(0,6),rivals,p.off!=null?m.go+p.off:performance.now()+4000);return}
  if(!N.racing||!RC.R)return;
  if(m.t==='Rp'&&num(m.tm)){const c=RC.R.cars.find(q=>q.pid===p.id);if(c&&!c.gone)rnStore(p,c,m.c,m.tm);return}
  if(m.t==='Ra'&&N.lead===p.id&&num(m.tm)&&Array.isArray(m.c)){(RC.rivalCars||[]).forEach((c,i)=>{if(c.remote&&m.c[i])rnStore(p,c,m.c[i],m.tm)});return}
  if(m.t==='Rf'&&num(m.time)){const c=RC.R.cars.find(q=>q.pid===p.id);if(!c||c.done)return;if(Array.isArray(m.c))rnStore(p,c,m.c,num(m.tm)?m.tm:netNow());
    c.done=true;c.finT=m.time;c.best=num(m.best)?m.best:c.best;RC.R.finished.push(c);const v=RC.views[0];if(v&&!RC.humans[0].done)rcNotice(v,p.name+' er i mål!',1600);if(RC.phase==='result')rcResultTable();return}}
// a player is out of this race: their car disappears
function rnGoneCar(id){if(!RC.R)return;const c=RC.R.cars.find(q=>q.pid===id);if(c&&!c.human){c.gone=true;if(RC.phase==='result')rcResultTable()}}
function rnLeadGone(msg){const N=RC.net;if(!N)return;RC.net=null;toast(msg,true);if(N.racing)rnTakeRivals();if(RC.on&&RC.phase==='menu')rcMenu()}
// a player left the room (id), or the room is gone (null). Called by js/net.js
function raceNetGone(id){const N=RC.net;if(id===null){RC.invite=null;if(N){RC.net=null;if(N.racing){rnTakeRivals();if(RC.R)for(const c of RC.R.cars)if(c.pid&&!c.human)c.gone=true}if(RC.on&&RC.phase==='menu')rcMenu()}return}
  if(RC.invite&&RC.invite.from===id){RC.invite=null;if(RC.on&&RC.phase==='menu')rcMenuRender()}if(!N)return;
  if(N.lead===id){rnLeadGone('Lederen for racet forlot rommet');rnGoneCar(id);return}
  N.mem.delete(id);if(N.list)N.list=N.list.filter(e=>e.id!==id);rnGoneCar(id);if(N.lead===NET.me)rnList();else if(RC.on&&RC.phase==='menu')rcMenuRender()}

function initRaceNet(){
  $('rmInvite').onclick=()=>rnHost();
  $('rmJoin').onclick=()=>{const v=RC.invite;if(v){rnJoin(v);rcMenu()}};
  $('rmDecline').onclick=()=>{const v=RC.invite;if(v){rnSend({t:'Rl',id:v.id});RC.invite=null;rcMenuRender()}};
  $('rmLeave').onclick=()=>{rnLeave();rcMenu()}}
initRaceNet();
