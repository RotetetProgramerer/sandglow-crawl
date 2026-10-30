'use strict';
/* =================================================================
   MULTIPLAYER: drive together in the archipelago.
   A room has a host and up to three guests. Guests connect only to the host, and the host passes their messages on to the others.
   Two transports share all the room logic below:
   - PeerJS: WebRTC straight between the browsers. The free public PeerJS broker finds the host by the room code. Loaded only when used.
   - Local test: BroadcastChannel between tabs in the same browser, no network. For testing on one machine.
   Every player simulates their own car exactly as in single player. Only the car's pose is sent, 15 times a second,
   and the other cars are drawn a little behind real time so they glide smoothly between updates. Cars do not collide.
   Progress (nuts, courses, golden nuts) stays personal.
   Loaded after world.js; uses the globals of game.js/world.js/map.js at run time.
   ================================================================= */
const NET_VER=2,NET_MAX=4,NET_HZ=15,NET_DELAY=120,NET_STALE=60000;
const PEER_URL='https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js';
const NET_COLS=['#3fa9f5','#8bd14a','#d94fd0','#f2c230'];   // by slot; your own car is the orange arrow on the maps
const NET_WORDS=['KRABBE','OTER','SEL','ELG','REV','HARE','ULV','GAUPE','LUNDE','ORRE','JERV','HJORT','MAKRELL','TORSK','LAKS','EKORN','SKARV','TERNE','HUMMER','GREVLING'];
const NET={on:false,joining:false,host:false,local:false,code:'',me:'',name:'',slot:0,players:new Map(),links:new Map(),hostLink:null,tr:null,
  sendT:0,hostSeen:0,infoT:0,infoSig:'',hudT:0,t0:performance.now(),leaving:false,retry:0,welcomeT:null};
const netNow=()=>Math.round(performance.now()-NET.t0);
const netCol=s=>NET_COLS[s]||NET_COLS[0];
const netName=()=>(store.get('mpName','')||'Sjåfør');
function netCleanName(s){return String(s||'').replace(/[<>&"]/g,'').replace(/\s+/g,' ').trim().slice(0,14)||'Sjåfør'}
function netNewCode(){return NET_WORDS[Math.floor(Math.random()*NET_WORDS.length)]+'-'+(10+Math.floor(Math.random()*90))}
// «krabbe 42», «KRABBE42» and «Krabbe-42» all become KRABBE-42
function netNormCode(s){const t=String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,''),m=t.match(/^([A-Z]{2,10})(\d{2})$/);return m?m[1]+'-'+m[2]:null}

/* ---------- transports: open a room as host or join one; both give links {id,open,send(m),close()} ---------- */
function loadPeerJS(){if(window.Peer)return Promise.resolve();return new Promise((ok,no)=>{const s=document.createElement('script');s.src=PEER_URL;s.async=true;
  s.onload=()=>window.Peer?ok():no(new Error('lib'));s.onerror=()=>no(new Error('lib'));document.head.appendChild(s)})}
const netPeerId=code=>'sandglow-crawl-v1-'+code.toLowerCase();
function peerTransport(){
  const T={peer:null,code:''};
  function wire(c,ev,onOpen){const L={id:c.peer,open:false,send:m=>{if(L.open)try{c.send(m)}catch(e){}},close:()=>{L.open=false;try{c.close()}catch(e){}}};
    c.on('open',()=>{L.open=true;ev.link(L);if(onOpen)onOpen()});c.on('data',m=>{if(L.open)ev.data(L,m)});
    const gone=()=>{if(L.open){L.open=false;ev.close(L)}};c.on('close',gone);c.on('error',gone)}
  T.start=(code,asHost,ev)=>loadPeerJS().then(()=>new Promise((ok,no)=>{T.code=code;let done=false;const fail=w=>{if(!done){done=true;T.stop();no(new Error(w))}};
    const p=T.peer=asHost?new Peer(netPeerId(code),{debug:0}):new Peer({debug:0});
    const to=setTimeout(()=>fail('net'),15000);
    p.on('open',id=>{if(asHost){if(!done){done=true;clearTimeout(to);ok(id)}}else wire(p.connect(netPeerId(code),{serialization:'json',reliable:true}),ev,()=>{if(!done){done=true;clearTimeout(to);ok(id)}})});
    p.on('connection',c=>{if(asHost)wire(c,ev)});
    p.on('error',e=>{const ty=e&&e.type;if(!done){clearTimeout(to);fail(ty==='unavailable-id'?'taken':ty==='peer-unavailable'?'noroom':ty==='browser-incompatible'?'browser':'net')}});
    // the broker connection can drop while the room still works; get it back so new players can find the host
    p.on('disconnected',()=>{if(T.peer===p&&!p.destroyed)setTimeout(()=>{try{if(T.peer===p&&!p.destroyed)p.reconnect()}catch(e){}},2000)})}));
  // a guest that lost the host tries a new connection with the same id
  T.again=ev=>new Promise((ok,no)=>{if(!T.peer||T.peer.destroyed)return no(new Error('net'));let done=false;
    wire(T.peer.connect(netPeerId(T.code),{serialization:'json',reliable:true}),ev,()=>{done=true;ok()});setTimeout(()=>{if(!done)no(new Error('noroom'))},6000)});
  T.stop=()=>{const p=T.peer;T.peer=null;if(p)try{p.destroy()}catch(e){}};
  return T}
function localTransport(){
  const T={ch:null,id:'',hostId:'',links:new Map(),ev:null};
  function mk(to){const L={id:to,open:true,send:m=>{if(L.open&&T.ch)T.ch.postMessage({k:'d',f:T.id,to,m})},close:()=>{if(!L.open)return;L.open=false;T.links.delete(to);if(T.ch)T.ch.postMessage({k:'x',f:T.id,to})}};T.links.set(to,L);return L}
  T.start=(code,asHost,ev)=>new Promise((ok,no)=>{T.ev=ev;T.hostId='host-'+code;T.id=asHost?T.hostId:'tab-'+Math.random().toString(36).slice(2,9);let done=false;
    const ch=T.ch=new BroadcastChannel('sgc-local-'+code);
    ch.onmessage=e=>{const d=e.data;if(!d)return;
      if(d.k==='who'){if(asHost&&done)ch.postMessage({k:'here',f:T.id,to:d.f});return}   // someone else wants to host this code
      if(d.to!==T.id)return;
      if(d.k==='here'){if(!done){done=true;T.stop();no(new Error('taken'))}return}
      if(d.k==='open'&&asHost){const had=T.links.get(d.f);ch.postMessage({k:'ack',f:T.id,to:d.f});if(!had)ev.link(mk(d.f));return}
      if(d.k==='ack'&&!asHost){if(!T.links.has(d.f)){ev.link(mk(d.f));if(T.wait){const w=T.wait;T.wait=null;w()}}return}
      const L=T.links.get(d.f);if(!L)return;
      if(d.k==='d')ev.data(L,d.m);else if(d.k==='x'){L.open=false;T.links.delete(d.f);ev.close(L)}};
    if(asHost){ch.postMessage({k:'who',f:T.id});setTimeout(()=>{if(!done){done=true;ok(T.id)}},300)}
    else{T.wait=()=>{if(!done){done=true;ok(T.id)}};ch.postMessage({k:'open',f:T.id,to:T.hostId});setTimeout(()=>{if(!done){done=true;T.wait=null;T.stop();no(new Error('noroom'))}},2500)}});
  T.again=()=>new Promise((ok,no)=>{if(!T.ch)return no(new Error('net'));T.wait=ok;T.ch.postMessage({k:'open',f:T.id,to:T.hostId});setTimeout(()=>{if(T.wait===ok){T.wait=null;no(new Error('noroom'))}},2500)});
  T.stop=()=>{for(const L of[...T.links.values()])L.close();if(T.ch){T.ch.close();T.ch=null}};
  return T}

/* ---------- the room ---------- */
const netEv={link:netOnLink,data:netOnData,close:netOnClose};
function netErrText(w){return{taken:'Koden var opptatt. Prøv igjen.',noroom:'Fant ikke rommet. Sjekk koden, og at verten fortsatt er i rommet.',browser:'Denne nettleseren støtter ikke flerspiller.',lib:'Fikk ikke lastet flerspiller. Sjekk nettet.',net:'Fikk ikke kontakt med koblingstjenesten. Sjekk nettet, eller prøv et annet nett.',full:'Rommet er fullt. Det er plass til fire.',old:'Den andre spilleren har en annen versjon av spillet. Last siden på nytt begge to.'}[w]||'Noe gikk galt med tilkoblingen.'}
function netCreate(local,tries=0){if(NET.on||NET.joining)return;NET.joining=true;NET.local=local;NET.name=netName();const code=netNewCode();NET.tr=local?localTransport():peerTransport();netStatus('Lager rom …');
  NET.tr.start(code,true,netEv).then(id=>{NET.joining=false;Object.assign(NET,{on:true,host:true,me:id,code,slot:0,leaving:false});netStatus('');netUI();toast('Rom '+code+' er klart')})
  .catch(e=>{NET.joining=false;NET.tr=null;if(e.message==='taken'&&tries<3)return netCreate(local,tries+1);netStatus(netErrText(e.message),true)})}
function netJoin(raw,local){if(NET.on||NET.joining)return;const code=netNormCode(raw);if(!code){netStatus('Skriv koden slik: KRABBE-42',true);return}
  NET.joining=true;NET.local=local;NET.name=netName();NET.code=code;NET.tr=local?localTransport():peerTransport();netStatus('Kobler til '+code+' …');
  NET.tr.start(code,false,netEv).then(id=>{NET.me=id;NET.leaving=false;
    // the host answers the hello with welcome (or full/old); give up if it never does
    NET.welcomeT=setTimeout(()=>{if(!NET.on){netStop();netStatus(netErrText('noroom'),true)}},8000)})
  .catch(e=>{NET.joining=false;NET.tr=null;netStatus(netErrText(e.message),true)})}
function netStop(){clearTimeout(NET.welcomeT);if(NET.tr){NET.leaving=true;NET.tr.stop()}NET.tr=null;NET.on=false;NET.joining=false;NET.host=false;NET.hostLink=null;NET.links.clear();NET.retry=0;
  for(const p of NET.players.values())netDropVis(p);NET.players.clear();RF=null;NET.infoSig='';if(typeof boatNetGone==='function')boatNetGone(null);if(typeof seaGone==='function')seaGone(null);netUI()}
function netLeave(msg){if(!NET.on&&!NET.joining)return;NET.leaving=true;netSend({t:'bye'});setTimeout(netStop,60);NET.on=false;if(msg)toast(msg);netUI()}
addEventListener('pagehide',()=>{if(NET.on){NET.leaving=true;netSend({t:'bye'});if(NET.tr)NET.tr.stop()}});
// a hidden tab stops drawing, so it would stop sending; a slow ping tells the others it is still there
setInterval(()=>{if(NET.on&&document.hidden)netSend({t:'ping'})},1000);

function myInfo(){return{car:CARS[state.carIdx].id,paint:prof.paint|0,parts:Object.assign({},prof.parts)}}
function rosterList(){const L=[{id:NET.me,name:NET.name,slot:NET.slot,info:myInfo()}];for(const p of NET.players.values())L.push({id:p.id,name:p.name,slot:p.slot,info:p.info});return L}
// messages from others are checked before use: names, car ids, paint and part levels, numbers
function cleanInfo(i){i=i||{};const car=CARS.some(c=>c.id===i.car)?i.car:CARS[0].id,paint=Number.isInteger(i.paint)&&PAINTS[i.paint]?i.paint:0,parts={};
  for(const k of['tyres','susp','motor','weight','gear']){const v=i.parts&&i.parts[k];if(Number.isInteger(v)&&v>=0&&v<=3)parts[k]=v}return{car,paint,parts}}
const netFin=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(v=>typeof v==='number'&&isFinite(v)&&Math.abs(v)<1e5);

function netSend(m){if(!NET.tr)return;m.f=NET.me;if(NET.host){for(const L of NET.links.values())L.send(m)}else if(NET.hostLink)NET.hostLink.send(m)}
function netRelay(from,m){for(const L of NET.links.values())if(L.id!==from)L.send(m)}
function netOnLink(L){if(NET.host){NET.links.set(L.id,L);return}
  NET.hostLink=L;L.send({t:'hello',f:NET.me,v:NET_VER,name:NET.name,info:myInfo()})}
function netOnClose(L){
  if(NET.host){NET.links.delete(L.id);const p=NET.players.get(L.id);if(p){netRemove(p,p.name+' forlot rommet');netSendRoster()}return}
  if(L!==NET.hostLink||NET.leaving)return;NET.hostLink=null;if(!NET.on){netStop();netStatus(netErrText('noroom'),true);return}
  // lost the host: try to get back in a few times before giving up
  NET.retry=0;toast('Mistet kontakten med verten, prøver igjen …',true);netReconnect()}
function netReconnect(){if(!NET.tr||NET.hostLink||NET.leaving)return;NET.retry++;
  NET.tr.again(netEv).then(()=>{NET.retry=0}).catch(()=>{if(NET.retry<5)setTimeout(netReconnect,3000);else{netStop();toast('Rommet er borte. Du kjører alene nå.',true)}})}
function netOnData(L,m){if(!m||typeof m!=='object'||typeof m.t!=='string')return;
  if(NET.host){m.f=L.id;   // a guest cannot speak for anyone else
    if(m.t==='hello'){netHello(L,m);return}
    const p=NET.players.get(L.id);if(!p)return;netHandle(p,m);if(m.t!=='bye')netRelay(L.id,m);else{L.close();NET.links.delete(L.id);netRemove(p,p.name+' forlot rommet');netSendRoster()}return}
  // guest: everything comes from the host, on behalf of whoever sent it
  NET.hostSeen=performance.now();
  if(m.t==='welcome'){clearTimeout(NET.welcomeT);const first=!NET.on;NET.on=true;NET.joining=false;NET.slot=m.slot|0;netRoster(m.list);netStatus('');netUI();if(first)toast('Du er med i rom '+NET.code);return}
  if(m.t==='full'||m.t==='old'){netStop();netStatus(netErrText(m.t),true);return}
  if(m.t==='roster'){netRoster(m.list);return}
  if(m.t==='bye'&&m.f===L.id){netStop();toast('Verten avsluttet rommet. Du kjører alene nå.',true);return}
  const p=NET.players.get(m.f);if(p)netHandle(p,m)}
function netHello(L,m){
  if(m.v!==NET_VER){L.send({t:'old'});setTimeout(()=>L.close(),200);return}
  let p=NET.players.get(L.id);
  if(!p){const used=new Set([0,...[...NET.players.values()].map(q=>q.slot)]);let slot=1;while(used.has(slot))slot++;
    if(slot>=NET_MAX){L.send({t:'full'});setTimeout(()=>L.close(),200);return}
    p=netAddPlayer(L.id,netCleanName(m.name),slot,cleanInfo(m.info));toast(p.name+' er med og kjører sammen med deg')}
  else{p.name=netCleanName(m.name);p.info=cleanInfo(m.info);netBuildVis(p)}
  p.seen=performance.now();L.send({t:'welcome',f:NET.me,slot:p.slot,list:rosterList()});netSendRoster(L.id);netUI()}
function netSendRoster(except){const m={t:'roster',f:NET.me,list:rosterList()};for(const L of NET.links.values())if(L.id!==except&&NET.players.has(L.id))L.send(m)}
function netRoster(list){if(!Array.isArray(list))return;const keep=new Set();
  for(const e of list.slice(0,NET_MAX)){if(!e||typeof e.id!=='string'||e.id===NET.me)continue;keep.add(e.id);const info=cleanInfo(e.info),name=netCleanName(e.name),slot=Math.max(0,Math.min(NET_MAX-1,e.slot|0));
    const p=NET.players.get(e.id);if(!p){netAddPlayer(e.id,name,slot,info);if(NET.on)toast(name+' er med i rommet')}
    else{const ch=JSON.stringify(p.info)!==JSON.stringify(info)||p.slot!==slot||p.name!==name;p.name=name;p.slot=slot;p.info=info;if(ch)netBuildVis(p)}}
  for(const p of[...NET.players.values()])if(!keep.has(p.id))netRemove(p,p.name+' forlot rommet');netUI()}
function netAddPlayer(id,name,slot,info){const p={id,name,slot,info,buf:[],off:null,lv:null,vis:null,seen:performance.now(),hidden:true};NET.players.set(id,p);netBuildVis(p);return p}
function netRemove(p,msg){netDropVis(p);NET.players.delete(p.id);if(typeof boatNetGone==='function')boatNetGone(p.id);if(typeof seaGone==='function')seaGone(p.id);if(msg&&NET.on)toast(msg);netUI()}
function netHandle(p,m){p.seen=performance.now();
  if(m.t==='Bv'){if(typeof seaNet==='function')seaNet(p,m);return}   // where someone at sea is, in a boat or a plane (js/plane.js)
  if(m.t.charAt(0)==='B'){if(typeof boatNet==='function')boatNet(p,m);return}   // the boat race (js/boat.js)
  if(m.t==='s'){if(!netFin(m.p,3)||!netFin(m.q,4)||!netFin(m.w,4)||!netFin(m.sp,4)||typeof m.tm!=='number'||typeof m.lv!=='string')return;
    const o=performance.now()-m.tm;p.off=p.off==null||o<p.off?o:p.off+(o-p.off)*.02;   // clock offset: the smallest delay seen, drifting slowly
    if(p.lv!==m.lv)p.buf.length=0;p.lv=m.lv;
    const ql=Math.hypot(m.q[0],m.q[1],m.q[2],m.q[3])||1;
    p.buf.push({tm:m.tm,p:new V3(m.p[0],m.p[1],m.p[2]),q:new Q4(m.q[0]/ql,m.q[1]/ql,m.q[2]/ql,m.q[3]/ql),w:m.w,sp:m.sp,st:+m.st||0,l:!!m.l,v:!!m.v});if(p.buf.length>40)p.buf.shift();return}
  if(m.t==='info'){p.info=cleanInfo(m.info);netBuildVis(p);netUI();return}
  if(m.t==='fy'){if(m.lv===LEVELS[state.levelIdx].id&&(m.ph==='out'||m.ph==='in'))netRemoteFerry(m.ph);return}}

/* ---------- each frame: send my car, draw the others ---------- */
function netTick(dt){if(!NET.on)return;const now=performance.now();
  NET.sendT-=dt;if(NET.sendT<=0){NET.sendT=Math.max(0,NET.sendT+1/NET_HZ);netSend(netPose())}
  if(now>=NET.infoT){NET.infoT=now+1000;const i=myInfo(),sig=JSON.stringify(i);if(sig!==NET.infoSig){const first=!NET.infoSig;NET.infoSig=sig;if(!first)netSend({t:'info',info:i})}}
  if(NET.host)for(const p of[...NET.players.values()])if(now-p.seen>NET_STALE){const L=NET.links.get(p.id);if(L){L.close();NET.links.delete(p.id)}netRemove(p,p.name+' mistet forbindelsen');netSendRoster()}
  if(!NET.host&&NET.hostLink&&NET.hostSeen&&now-NET.hostSeen>NET_STALE){const L=NET.hostLink;L.close();netOnClose(L)}
  for(const p of NET.players.values())netDrawRemote(p,now);
  updateRemoteFerry(dt);
  NET.hudT-=dt;if(NET.hudT<=0){NET.hudT=.5;netHud()}}
// pose: position, rotation, how far each wheel hangs below its mount, wheel spin, steering, lights, and whether the car is out driving at all
const _nUp=new V3(),_nMt=new V3();
function netPose(){const up=_nUp.set(0,1,0).applyQuaternion(car.q),w=[],sp=[];
  for(const wh of car.wheels){_nMt.copy(wh.mount).applyQuaternion(car.q).add(car.pos);w.push(+_nMt.sub(wh.center).dot(up).toFixed(3));sp.push(+(wh.spin%6.2832).toFixed(2))}
  const out=state.mode!=='menu'&&state.mode!=='garage';
  return{t:'s',tm:netNow(),lv:LEVELS[state.levelIdx].id,v:out?1:0,p:[+car.pos.x.toFixed(3),+car.pos.y.toFixed(3),+car.pos.z.toFixed(3)],q:[+car.q.x.toFixed(4),+car.q.y.toFixed(4),+car.q.z.toFixed(4),+car.q.w.toFixed(4)],w,sp,st:+car.steer.toFixed(3),l:state.lights?1:0}}
// a remote car is drawn NET_DELAY ms behind its newest pose, between the two poses around that moment
const _nP=new V3(),_nQ=new Q4(),_nS=new Q4(),_nU=new V3(),_nC=new V3(),_nL=new V3(),_nR=new V3();
function netDrawRemote(p,now){const V=p.vis;if(!V)return;const b=p.buf,here=LEVELS[state.levelIdx].id;
  const show=b.length&&p.lv===here&&b[b.length-1].v&&state.mode!=='garage'&&now-p.seen<8000;p.hidden=!show;V.root.visible=!!show;if(!show)return;
  const rt=now-p.off-NET_DELAY;let a=b[0],c=b[0],k=0;
  if(rt>=b[b.length-1].tm){a=c=b[b.length-1]}else if(rt>b[0].tm){for(let i=1;i<b.length;i++)if(b[i].tm>=rt){a=b[i-1];c=b[i];k=(rt-a.tm)/Math.max(1,c.tm-a.tm);break}}
  while(b.length>2&&b[1].tm<rt-500)b.shift();
  // a jump of more than a few metres (towed home, ferry) is not glided across
  if(a.p.distanceToSquared(c.p)>16)k=1;
  _nP.copy(a.p).lerp(c.p,k);_nQ.copy(a.q).slerp(c.q,k);
  V.body.position.copy(_nP);V.body.quaternion.copy(_nQ);p.x=_nP.x;p.z=_nP.z;p.h=Math.atan2(_nL.set(0,0,1).applyQuaternion(_nQ).x,_nL.z);
  const up=_nU.set(0,1,0).applyQuaternion(_nQ),st=a.st+(c.st-a.st)*k;
  V.wheels.forEach((wv,i)=>{_nC.copy(V.mounts[i]).applyQuaternion(_nQ).add(_nP).addScaledVector(up,-(a.w[i]+(c.w[i]-a.w[i])*k));wv.root.position.copy(_nC);
    _nS.setFromAxisAngle(YAX,V.mounts[i].z>0?st:0);wv.root.quaternion.copy(_nQ).multiply(_nS);
    let ds=c.sp[i]-a.sp[i];if(ds>3.1416)ds-=6.2832;else if(ds<-3.1416)ds+=6.2832;wv.spin.rotation.x=a.sp[i]+ds*k});
  for(let ax=0;ax<2;ax++){const L=V.wheels[ax*2].root.position,R=V.wheels[ax*2+1].root.position,o=V.axles[ax];o.position.copy(L).add(R).multiplyScalar(.5);_nR.copy(L).sub(R);const len=_nR.length();o.quaternion.setFromUnitVectors(YAX,_nR.normalize());o.userData.tube.scale.y=len}
  const lit=c.l;if(lit!==V.lit){V.lit=lit;V.mats.lamp.emissive.set(lit?0xfff1c0:0x000000);V.mats.tail.emissive.set(lit?0x8a1010:0x000000);V.mats.beam.opacity=lit?.085:0}
  // the name stays readable at a distance, and shows through hills so you can find each other
  const d=camera.position.distanceTo(_nP),s=Math.max(1,Math.min(3,d/10));V.tag.position.copy(_nP).add(_nL.set(0,1.0+.12*s,0));V.tag.scale.set(1.5*s,.375*s,1)}

/* ---------- remote car models: the garage model with their car, paint and parts, merged into a few meshes ---------- */
function netMerge(root){root.updateMatrixWorld(true);const by=new Map(),olds=[];
  root.traverse(o=>{if(!o.isMesh)return;olds.push(o.geometry);const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);if(!by.has(o.material))by.set(o.material,[]);by.get(o.material).push({g,cs:o.castShadow})});
  const out=new THREE.Group();
  for(const[mat,list]of by){let n=0;for(const e of list)n+=e.g.attributes.position.count;const P=new Float32Array(n*3),N=new Float32Array(n*3),U=new Float32Array(n*2);let o=0;
    for(const e of list){const a=e.g.attributes;P.set(a.position.array,o*3);if(a.normal)N.set(a.normal.array,o*3);if(a.uv)U.set(a.uv.array,o*2);o+=a.position.count;e.g.dispose()}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('normal',new THREE.BufferAttribute(N,3));g.setAttribute('uv',new THREE.BufferAttribute(U,2));g.computeBoundingSphere();
    const m=new THREE.Mesh(g,mat);m.castShadow=list.some(e=>e.cs)&&!mat.transparent;m.receiveShadow=true;out.add(m)}
  for(const g of new Set(olds))g.dispose();return out}
function netMats(info){const own=m=>{const c=m.clone();if(Object.prototype.hasOwnProperty.call(c,'onBeforeCompile'))delete c.onBeforeCompile;return c};   // no mud shader: that one follows your own car
  const mats={yel:own(M.yel),blkC:own(M.blkC),tire:own(M.tire),rim:own(M.rim),lamp:own(M.lamp),tail:own(M.tail),beam:own(M.beam)};
  const cc=CARS.find(c=>c.id===info.car);mats.yel.color.set(!info.paint&&cc&&cc.col||(PAINTS[info.paint]||PAINTS[0]).c).convertSRGBToLinear();const heavy=(info.parts.weight|0)>=2;mats.rim.color.set(heavy?'#b08a3a':'#e3a62a').convertSRGBToLinear();mats.rim.metalness=heavy?.6:.2;
  mats.lamp.emissive.set(0);mats.tail.emissive.set(0);mats.beam.opacity=0;return mats}
function netSwap(root,mats){root.traverse(o=>{if(!o.isMesh)return;for(const k in mats)if(o.material===M[k]){o.material=mats[k];break}})}
function netTag(name,col){const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');x.font='700 34px "Barlow Condensed",sans-serif';const w=Math.min(244,x.measureText(name).width+36);
  x.fillStyle='rgba(20,18,14,.78)';x.fillRect((256-w)/2,8,w,48);x.fillStyle=col;x.fillRect((256-w)/2,8,8,48);x.fillStyle='#f2e8d0';x.textAlign='center';x.textBaseline='middle';x.fillText(name,128+4,33);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthTest:false,depthWrite:false,fog:false}));s.renderOrder=20;return s}
function netBuildVis(p){netDropVis(p);if(typeof buildBody!=='function')return;
  const ci=Math.max(0,CARS.findIndex(c=>c.id===p.info.car)),tune=tuneFrom(p.info.parts),cfg=Object.assign({},CARS[ci],{tune}),mats=netMats(p.info);
  const root=new THREE.Group();root.visible=false;
  const raw=buildBody(cfg);netSwap(raw,mats);const body=netMerge(raw);root.add(body);
  const wheels=[];for(let i=0;i<4;i++){const w=carWheel(cfg,i%2===0?1:-1,i>1);netSwap(w.root,mats);const spin=netMerge(w.spin);w.root.remove(w.spin);w.root.add(spin);root.add(w.root);wheels.push({root:w.root,spin})}
  const axles=[];for(let i=0;i<2;i++){const a=new THREE.Group(),tube=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,1,8),M.blk);tube.castShadow=true;a.add(tube);const diff=new THREE.Mesh(new THREE.SphereGeometry(.075,12,10),M.blk);diff.castShadow=true;a.add(diff);a.userData.tube=tube;root.add(a);axles.push(a)}
  if(cfg.style==='trophy')axles[0].visible=false;   // the trophy truck's front wheels hang on their own arms
  const tag=netTag(p.name,netCol(p.slot));root.add(tag);
  const mounts=makeCar(CARS[ci],tune).wheels.map(w=>w.mount.clone());
  scene.add(root);p.vis={root,body,wheels,axles,tag,mats,mounts,lit:false}}
function netDropVis(p){const V=p.vis;if(!V)return;p.vis=null;scene.remove(V.root);
  V.root.traverse(o=>{if(o.isMesh&&o.geometry)o.geometry.dispose()});for(const k in V.mats)V.mats[k].dispose();V.tag.material.map.dispose();V.tag.material.dispose()}

/* ---------- the ferry: a friend leaving or arriving on your island takes your island's ferry along ---------- */
let RF=null;
function netFerry(ph){if(NET.on)netSend({t:'fy',ph,lv:LEVELS[state.levelIdx].id})}
function netRemoteFerry(ph){if(!LV.ferry||!ferryVis||FT||onFerryDeck())return;RF={ph,t:0}}
// same motion as your own trip: out 14 units in 4.2 s, then (for a departure) back in from 16 units so the ferry is at the quay again
function updateRemoteFerry(dt){if(!RF)return;if(!ferryVis||!LV.ferry||FT){RF=null;return}const f=LV.ferry,g=ferryVis.g;
  if(onFerryDeck()){g.position.set(f.x,f.y,f.z);g.rotation.z=0;RF=null;return}   // never sail away under your own car
  RF.t+=dt;const s=Math.min(1,RF.t/4.2);let d;
  if(RF.ph==='out'){d=14*s*s;if(s>=1){RF={ph:'back',t:0};d=16}}else d=16*(1-s)*(1-s);
  g.position.set(f.x+f.dx*d,f.y+.04*Math.sin(performance.now()*.0013),f.z+f.dz*d);g.rotation.z=.012*Math.sin(performance.now()*.0009);
  if(RF.ph!=='out'&&s>=1){g.position.set(f.x,f.y,f.z);g.rotation.z=0;RF=null}}
// take the ferry to the island where a friend is (from wherever you are on this island), 5 nuts like any crossing
function netFerryTo(id){const p=NET.players.get(id);if(!p||!p.lv)return;const di=LEVELS.findIndex(l=>l.id===p.lv);
  if(di<0||!isIsland(LEVELS[di])){toast(p.name+' kjører et hurtigløp. Vent til de er tilbake i skjærgården.',true);return}
  if(!state.world){toast('Det går bare i fri kjøring i skjærgården',true);return}
  if(di===state.levelIdx){toast(p.name+' er her på øya',true);return}
  if(!LV.ferry||!ferryVis){toast('Det går ingen ferge herfra',true);return}
  if(prof.nuts<5){toast('Du trenger 5 muttere til fergen',true);return}
  $('pause').hidden=true;if(MAP.open)openMap(false);state.mode='play';if(state.course)endCourse(true);
  const f=LV.ferry;placeCar(car,f.x,f.z,Math.atan2(f.dx,f.dz));car.pos.y=f.y+.5;for(let i=0;i<120;i++)stepCar(car,FIXED);camSnap=true;startFerry(p.lv)}

/* ---------- where the others are, for the maps ---------- */
// on this island: name, colour, position and heading
function netDots(){const L=[];if(!NET.on)return L;for(const p of NET.players.values())if(!p.hidden&&p.x!=null)L.push({name:p.name,col:netCol(p.slot),x:p.x,z:p.z,h:p.h||0});return L}
// in the archipelago: name, colour and island
function netWhere(){const L=[];if(!NET.on)return L;for(const p of NET.players.values())if(p.lv)L.push({name:p.name,col:netCol(p.slot),lv:p.lv});return L}
function drawFriend(x,u,v,col,s,name){x.save();x.translate(u,v);x.fillStyle=col;x.strokeStyle='#14120E';x.lineWidth=1.5;x.beginPath();x.arc(0,0,s,0,6.283);x.fill();x.stroke();
  if(name){x.font='700 '+Math.round(s*1.9)+'px "Barlow Condensed",sans-serif';x.textAlign='center';x.textBaseline='bottom';x.lineWidth=3;x.strokeStyle='rgba(20,18,14,.85)';x.strokeText(name,0,-s-2);x.fillStyle='#f2e8d0';x.fillText(name,0,-s-2)}x.restore()}

/* ---------- screens: the «Kjør sammen» dialog, the pause list and a small badge in the HUD ---------- */
function netStatus(t,bad){const el=$('mpStatus');if(!el)return;el.textContent=t||'';el.classList.toggle('bad',!!bad)}
function netOpen(){$('mpName').value=store.get('mpName','');$('mpLocal').checked=!!store.get('mpLocal',false);netStatus('');netUI();$('mp').hidden=false;(NET.on?$('mpGo'):$('mpName').value?$('mpCreate'):$('mpName')).focus()}
function netClose(){$('mp').hidden=true;$('startBtn').focus()}
function netSaveForm(){const n=netCleanName($('mpName').value);$('mpName').value=n;store.set('mpName',n);store.set('mpLocal',$('mpLocal').checked)}
function netUI(){if(!$('mp'))return;const inRoom=NET.on;$('mpOut').hidden=inRoom;$('mpIn').hidden=!inRoom;
  for(const id of['mpCreate','mpJoin'])$(id).disabled=NET.joining;
  if(inRoom){$('mpRoom').textContent=NET.code;$('mpMode').textContent=NET.local?'Lokal test: bare faner i denne nettleseren kan bli med.':'Gi koden til de du vil kjøre med. Det er plass til fire.';
    const list=rosterList().sort((a,b)=>a.slot-b.slot);$('mpList').innerHTML='';
    for(const e of list){const li=document.createElement('li');const dot=document.createElement('i');dot.style.background=e.id===NET.me?'#ff6a2a':netCol(e.slot);li.appendChild(dot);
      const nm=document.createElement('span');nm.textContent=e.name+(e.id===NET.me?' (deg)':'')+(e.slot===0?' · vert':'');li.appendChild(nm);
      const cr=document.createElement('small');cr.textContent=(CARS.find(c=>c.id===e.info.car)||CARS[0]).name;li.appendChild(cr);$('mpList').appendChild(li)}}
  netHud();if(!$('pause').hidden)netPauseUI()}
function netHud(){const el=$('hNet');if(!el)return;el.hidden=!NET.on||$('hud').hidden;if(el.hidden)return;el.textContent='👥 '+(NET.players.size+1)+' · '+NET.code}
function netPauseUI(){const box=$('pNet');if(!box)return;box.hidden=!NET.on;if(!NET.on)return;$('pNetCode').textContent=NET.code;const list=$('pNetList');list.innerHTML='';
  if(!NET.players.size){const p=document.createElement('p');p.className='note';p.textContent='Ingen andre i rommet ennå. Gi dem koden '+NET.code+'.';list.appendChild(p);return}
  const here=LEVELS[state.levelIdx].id;
  for(const p of[...NET.players.values()].sort((a,b)=>a.slot-b.slot)){const b=document.createElement('button'),nm=document.createElement('span'),sub=document.createElement('span'),pr=document.createElement('span'),l=LEVELS.find(v=>v.id===p.lv);
    nm.className='nm';nm.textContent=p.name;nm.style.borderLeft='6px solid '+netCol(p.slot);nm.style.paddingLeft='8px';sub.className='sub';pr.className='pr';
    if(!l){sub.textContent='Er ikke ute og kjører ennå';b.disabled=true}
    else if(p.lv===here){const d=p.x!=null?Math.hypot(p.x-car.pos.x,p.z-car.pos.z)*UNIT_CM/100:null;sub.textContent='Her på '+l.name+(d!=null?' · '+d.toFixed(0)+' m unna':'');b.disabled=true}
    else{sub.textContent='På '+l.name+' · ta fergen dit';pr.textContent='5 ⚙';b.onclick=()=>netFerryTo(p.id);b.disabled=!state.world}
    nm.appendChild(sub);b.append(nm,pr);list.appendChild(b)}}
// «Kjør!» in the room: free driving on the same island as the others, side by side at the start
function netGo(){$('mp').hidden=true;let lv=null;for(const p of[...NET.players.values()].sort((a,b)=>a.slot-b.slot))if(p.lv&&isIsland(LEVELS.find(l=>l.id===p.lv)||{})){lv=p.lv;break}
  if(lv)store.set('roam',{id:lv});startRoam();
  if(lv){const s=LV.start,h=Math.atan2(s.tan.x,s.tan.z),side=NET.slot%2?1:-1,k=Math.ceil(NET.slot/2)*1.5;placeCar(car,s.p.x+Math.cos(h)*side*k,s.p.z-Math.sin(h)*side*k,h);camSnap=true;state.checkpoint={x:car.pos.x,z:car.pos.z,h}}}
function initNet(){if(!$('mp'))return;
  $('mpBtn').onclick=netOpen;$('mpClose').onclick=netClose;
  $('mpCreate').onclick=()=>{netSaveForm();initAudio();netCreate($('mpLocal').checked)};
  $('mpJoin').onclick=()=>{netSaveForm();initAudio();netJoin($('mpCode').value,$('mpLocal').checked)};
  $('mpCode').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('mpJoin').click()}e.stopPropagation()});
  $('mpName').addEventListener('keydown',e=>e.stopPropagation());
  $('mp').addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();netClose()}});
  $('mpGo').onclick=netGo;$('mpLeave').onclick=()=>{netLeave('Du forlot rommet');netUI()};
  $('pNetLeave').onclick=()=>{netLeave('Du forlot rommet');netPauseUI()};
  if(new URLSearchParams(location.search).has('local'))store.set('mpLocal',true)}
initNet();
