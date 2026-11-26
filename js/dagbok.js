/* ===========================================================================
   DAGBOK: the travel diary and today's challenge.
   The diary (Reisedagbok in the main menu and the pause menu) shows, island by island, what is done and what is left:
   courses, stars, golden nuts and the island's own games, and the badges earned. Nothing new is saved: it is all read from best and prof.
   Today's challenge: one course and one car, the same for everyone that day (picked from the date). The car is lent to you for the run.
   Finishing gives a bonus once a day, more for a clean run; prof.daily={day,streak} remembers it.
   =========================================================================== */
const dbHas=k=>!!best[k];
// the island's own games: [label, done, of]
function dbExtras(l){const E=[];
  if(l.marina)E.push(['Båtløp',BOAT_RACES.filter(r=>dbHas(boatKey(r))).length,BOAT_RACES.length]);
  if(l.id==='trinnvik')E.push(['Rundflyging',FLIGHTS.filter(f=>dbHas(flyKey(f))).length,FLIGHTS.length]);
  if(l.pistes)E.push(['Nedfarter på ski',l.pistes.filter(k=>dbHas(l.id+'/ski/'+k.id)).length,l.pistes.length]);
  if(l.cavePath){const b=best[caveKey()];E.push(['Diamantgrotten',b&&b.done?1:0,1])}
  if(l.minePath){const b=best[mineKey()];E.push(['Gruve 7 vunnet',b&&b.p===1?1:0,1]);E.push(['Frøhvelvet',prof.frohvelv&&prof.frohvelv.done?1:0,1])}
  if(l.racePath)E.push(['Race vunnet',RACE_TRACKS.filter(t=>best[rcKey(t)]&&best[rcKey(t)].win).length,RACE_TRACKS.length]);
  if(l.id==='pirat'){const P=prof.pirat||{};E.push(['Piratprøver',(P.x?1:0)+(P.duel?1:0)+(P.boo?1:0),3])}
  return E}
function dbIsland(l){const keys=starKeys(l),done=keys.filter(dbHas).length,stars=keys.reduce((a,k)=>a+((best[k]&&best[k].s)||0),0),nuts=foundOn(l),ex=dbExtras(l);
  const all=done===keys.length&&nuts===SECRET_PER&&ex.every(e=>e[1]>=e[2]);return{l,keys,done,stars,nuts,ex,all}}
function dbBadges(I){const every=f=>I.every(f),some=f=>I.some(f),ex=(id,n)=>{const i=I.find(x=>x.l.id===id),e=i&&i.ex[n];return!!e&&e[1]>=e[2]};
  return[
    ['Første mål','Fullfør en løype',some(i=>i.done>0)],
    ['Feilfri','Tre stjerner i en løype',some(i=>i.keys.some(k=>best[k]&&best[k].s===3))],
    ['Øymester','Alle løypene på en øy',some(i=>i.done===i.keys.length)],
    ['Verdensmester','Alle løypene på alle øyene',every(i=>i.done===i.keys.length)],
    ['Gullgraver','Alle gullmutterne på en øy',some(i=>i.nuts===SECRET_PER)],
    ['Skattejeger','Alle gullmutterne i skjærgården',every(i=>i.nuts===SECRET_PER)],
    ['Kaptein','Alle båtløpene',ex('verden',0)],
    ['Pilot','Alle rundflygingene',ex('trinnvik',0)],
    ['Skiløper','Alle nedfartene i Gautefall',ex('gautefall',0)],
    ['Diamantjeger','Gjennom Diamantgrotten',ex('orken',0)],
    ['Gruvemester','Vinn kappløpet i Gruve 7',ex('svalbard',0)],
    ['Frøvenn','Hjelp Frøken Frø i frøhvelvet',ex('svalbard',1)],
    ['Racerkonge','Vinn på alle racerbanene',ex('racer',0)],
    ['Sjørøver','Klar alle de tre piratprøvene',ex('pirat',0)],
    ['Mekaniker','Alle delene fullt oppgradert',PARTS.every(p=>(prof.parts[p.id]||0)>=3)],
    ['Stayer','Dagens utfordring sju dager på rad',!!(prof.daily&&prof.daily.best>=7)]
  ]}
function renderDiary(){const I=LEVELS.filter(isIsland).map(dbIsland),B=dbBadges(I),nb=B.filter(b=>b[2]).length,tot=I.reduce((a,i)=>a+i.keys.length,0),dn=I.reduce((a,i)=>a+i.done,0);
  $('dbSum').innerHTML=`<div><span>Løyper</span><b>${dn}/${tot}</b></div><div><span>Stjerner</span><b>${totalStars()}/${maxStars()}</b></div><div><span>Gullmuttere</span><b>${foundSecrets()}/${totalSecrets()}</b></div><div><span>Merker</span><b>${nb}/${B.length}</b></div>`;
  $('dbIslands').innerHTML=I.map(i=>`<li class="${i.all?'all':''}"><b>${i.l.name}${i.all?' ✓':''}</b><span>Løyper ${i.done}/${i.keys.length}</span><span>★ ${i.stars}/${i.keys.length*3}</span><span>Gullmuttere ${i.nuts}/${SECRET_PER}</span>${i.ex.map(e=>`<span class="${e[1]>=e[2]?'ok':''}">${e[0]}${e[2]>1?' '+e[1]+'/'+e[2]:e[1]?' ✓':''}</span>`).join('')}</li>`).join('');
  $('dbBadges').innerHTML=B.map(b=>`<li class="${b[2]?'got':''}"><b>${b[2]?'★':'☆'} ${b[0]}</b><span>${b[1]}</span></li>`).join('')}
function openDiary(back){const b=$(back);renderDiary();if(b)b.hidden=true;$('diary').hidden=false;$('diary').scrollTop=0;
  $('dbClose').onclick=()=>{$('diary').hidden=true;if(b&&(back!=='pause'||state.mode==='pause')){b.hidden=false;const f=b.querySelector('#pResume,#startBtn');if(f)f.focus()}};$('dbClose').focus({preventScroll:true})}

/* ---------- today's challenge ---------- */
const DAILY={active:null};
const dailyDay=(d=new Date())=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function dailyPick(){const list=[];LEVELS.forEach((l,i)=>{if(!isIsland(l))return;if(l.world)l.challenges.forEach(c=>{if(!c.skuter)list.push({i,key:l.id+'/'+c.id,name:c.name,isl:l.name})});else list.push({i,key:l.id,name:l.name,isl:''})});
  const cars=CARS.map((c,i)=>i).filter(i=>!CARS[i].hire),d=new Date(),n=Math.floor(new Date(d.getFullYear(),d.getMonth(),d.getDate(),12).getTime()/864e5),R=mulberry32(n*7919+13);R();
  const c=list[Math.floor(R()*list.length)];return Object.assign({car:cars[Math.floor(R()*cars.length)]},c)}
const dailyDone=()=>!!(prof.daily&&prof.daily.day===dailyDay());
function dailyStreak(){const p=prof.daily;if(!p)return 0;const y=new Date();y.setDate(y.getDate()-1);return p.day===dailyDay()||p.day===dailyDay(y)?p.streak||0:0}
function dailyRender(){const el=$('dailyBox');if(!el)return;const D=dailyPick(),done=dailyDone(),st=dailyStreak(),onl=typeof NET!=='undefined'&&NET.on;
  $('dailyTxt').innerHTML=`<b>${D.name}</b>${D.isl?' på '+D.isl:''} med <b>${CARS[D.car].name}</b>. `+(done?'Klart i dag ✓ Ny utfordring i morgen.':'Du får låne bilen. 50 muttere for å komme i mål, 100 for en feilfri tur.')+(st>1?` ${st} dager på rad.`:'');
  $('dailyGo').textContent=done?'Kjør den igjen':'Kjør dagens utfordring';$('dailyGo').hidden=onl}
function dailyStart(){const D=dailyPick();initAudio();if(AC&&AC.state==='suspended')AC.resume();dailyEnd();
  DAILY.active={key:D.key,prevCar:state.carIdx};if(state.carIdx!==D.car)setCar(D.car);
  state.roam=true;if(D.i!==state.levelIdx||!state.world)loadLevel(D.i);startFree();
  const lvl=LEVELS[D.i],k=LV.courses.find(c=>courseKey(lvl,c)===D.key);if(!k){toast('Fant ikke dagens løype',true);return}
  startCourse(k)}
// back in the menu (or off roaming): the borrowed car goes back
function dailyEnd(){const a=DAILY.active;DAILY.active=null;if(a&&a.prevCar!==state.carIdx&&CARS[a.prevCar])setCar(a.prevCar)}
// the bonus when the daily course is finished (finishRun in js/game.js): once a day
function dailyBonus(key,pen){const a=DAILY.active;if(!a||a.key!==key||dailyDone())return 0;const st=dailyStreak()+1,p=prof.daily||{};prof.daily={day:dailyDay(),streak:st,best:Math.max(p.best||0,st)};return pen===0?100:50}
