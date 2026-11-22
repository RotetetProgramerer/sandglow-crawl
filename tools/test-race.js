// Kjør:  node tools/test-race.js            (alle banene)
//        node tools/test-race.js havn v     (én bane, med hendelser)
// Sjekker racerbanene på Racerøya (data/racer.js) uten nettleser:
//  1. at banen ikke kommer for nær seg selv (da blir det en usynlig vegg mellom to deler av banen),
//  2. at seks motstandere kjører hele løpet på hver vanskelighetsgrad uten å sette seg fast,
//  3. at en «spiller» som sladder med håndbrekket får turbo og kommer rundt.
// Alle rader skal vise OK.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..');
const load=f=>vm.runInThisContext(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
load('data/racer.js');load('js/racesim.js');
const only=process.argv[2],verbose=process.argv[3]==='v';let fail=0;
const fmt=t=>t==null?'-':(Math.floor(t/60)+':'+(t%60<10?'0':'')+(t%60).toFixed(1));
for(const def of RACE_TRACKS){if(only&&def.id!==only)continue;
  const T=makeTrack(def);
  // 1. how close the track comes to itself (samples more than 40 m apart along the lap)
  let minD=1e9,at=null;for(let i=0;i<T.N;i++)for(let j=i+1;j<T.N;j++){let ds=Math.abs(i-j)*2;ds=Math.min(ds,T.L-ds);if(ds<60)continue;const a=T.pts[i],b=T.pts[j],d=Math.hypot(a.x-b.x,a.y-b.y);if(d<minD){minD=d;at=[a,b]}}
  const need=2*T.wallD+6,okSep=minD>=need;if(!okSep)fail++;
  let kmin=1e9;for(const p of T.pts)if(Math.abs(p.k)>1e-6)kmin=Math.min(kmin,1/Math.abs(p.k));
  console.log(def.id.padEnd(8),'BANE    ',okSep?'OK  ':'FEIL','lengde',T.L+' m','nærmest seg selv',minD.toFixed(0)+' m (trenger '+need+')'+(okSep?'':' ved '+at[0].x.toFixed(0)+','+at[0].y.toFixed(0)),'krappeste radius',kmin.toFixed(0)+' m',
    'fart i svingene',Math.round(Math.min(...T.vmax)*3.6)+'–'+Math.round(Math.max(...T.vmax)*3.6)+' km/t');
  // 2. a race with six rivals on every level
  for(const L of RACE_LEVELS){const ents=RACE_RIVALS.map(r=>({name:r.name,col:r.col,num:r.num,skill:L.skill*(1-Math.random()*.02)}));const R=makeRace(T,ents,def.laps);R.phase='race';
    let walls=0,bumps=0,maxOut=0,wrong=0,boosts=0;const stuck=new Map();
    for(let t=0;t<600&&R.finished.length<R.cars.length;t+=1/60){const ev=raceStep(R,()=>({gas:0,brake:0,steer:0,hb:0}),1/60);
      for(const e of ev){if(e.type==='wall')walls++;if(e.type==='bump')bumps++;if(e.type==='boost')boosts++}
      for(const c of R.cars){maxOut=Math.max(maxOut,Math.abs(c.d)-T.hw);if(c.wrongT>2)wrong++}}
    const done=R.finished.length,ok=done===R.cars.length;if(!ok)fail++;const best=Math.min(...R.cars.map(c=>c.best||1e9));
    console.log(def.id.padEnd(8),('AI '+L.name).padEnd(13),ok?'OK  ':'FEIL','i mål',done+'/'+R.cars.length,'vinner',fmt(R.finished[0]&&R.finished[0].finT),'sist',fmt(R.finished[done-1]&&R.finished[done-1].finT),
      'beste runde',fmt(best),'vegg',walls,'dult',bumps/2,'turbo',boosts,'lengst ut',maxOut.toFixed(1)+' m','feil vei',wrong);
    if(verbose)console.log('   ',R.order.map((c,i)=>(i+1)+'. '+c.name+' '+fmt(raceEstimate(R,c))).join('  '))}
  // 3. a "player" that follows the line at full speed and pulls the handbrake into the tight corners
  {const R=makeRace(T,[{name:'Spiller',human:true,col:'#fff',num:1}],def.laps);R.phase='race';let boosts=0,drifts=0,walls=0,spin=0;const c=R.cars[0];
    // a short pull on the handbrake at the turn-in of a tight corner, then gas and the wheel, like a person does it
    let hbT=0,cool=0;const human=car=>{const I=aiInput(car,T,R.cars,1/120);const i0=car.hint;let kmax=0;for(let k=3;k<10;k++)kmax=Math.max(kmax,Math.abs(T.pts[(i0+k)%T.N].k));
      cool-=1/120;if(hbT>0){hbT-=1/120;I.hb=1;I.brake=0;I.gas=0}else if(kmax>1/40&&car.u>17&&cool<=0){hbT=.22;cool=2.5}return I};
    for(let t=0;t<400&&!c.done;t+=1/60){for(const e of raceStep(R,human,1/60)){if(e.type==='boost')boosts++;if(e.type==='wall')walls++}if(c.drift>0)drifts++;if(Math.abs(c.beta)>1.4)spin++}
    const ok=c.done;if(!ok)fail++;console.log(def.id.padEnd(8),'SPILLER      ',ok?'OK  ':'FEIL','tid',fmt(c.finT),'beste runde',fmt(c.best),'sladd',(drifts/60).toFixed(1)+' s','turbo',boosts,'vegg',walls,'spinn',(spin/60).toFixed(1)+' s')}
  // 4. a beginner on the keyboard: the wheel is only left, straight or right, full gas, never brakes, only lets go of the gas when far too fast.
  //    Should get round without hitting the walls much (at most 3 a lap) and without too much time off the asphalt (under 25 %).
  {const R=makeRace(T,[{name:'Nybegynner',human:true,col:'#fff',num:1}],def.laps);R.phase='race';let walls=0,off=0,tot=0;const c=R.cars[0];
    const beginner=car=>{const i0=car.hint,sp=Math.hypot(car.vx,car.vy),k=(i0+Math.round((9+sp*.35)/TSTEP))%T.N,P=T.pts[k],ang=Math.atan2(Math.sin(Math.atan2(P.y-car.y,P.x-car.x)-car.a),Math.cos(Math.atan2(P.y-car.y,P.x-car.x)-car.a));
      let vt=1e9;for(let j=0;j<12;j++)vt=Math.min(vt,T.vmax[(i0+j)%T.N]);const lift=car.u>vt*1.3;
      return{gas:lift?0:1,brake:0,steer:ang>.06?1:ang<-.06?-1:0,hb:0}};
    for(let t=0;t<500&&!c.done;t+=1/60){for(const e of raceStep(R,beginner,1/60))if(e.type==='wall')walls++;tot++;if(Math.abs(c.d)>T.hw+.5)off++}
    const ok=c.done&&walls<=3*def.laps&&off/tot<.25;if(!ok)fail++;console.log(def.id.padEnd(8),'NYBEGYNNER   ',ok?'OK  ':'FEIL','tid',fmt(c.finT),'beste runde',fmt(c.best),'vegg',walls,'utenfor asfalten',Math.round(off/tot*100)+' %')}
}
if(fail){console.log('\n'+fail+' FEIL');process.exitCode=1}
