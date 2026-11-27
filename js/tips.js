/* ===========================================================================
   TIPS: short hints while you play, instead of a long list before you start.
   Each hint is shown once, the first time it is useful: when the car comes near a place, sits stuck, or stands still.
   Doing the thing yourself (parking on the blue square, opening the map …) also ticks the hint off, so it never tells you what you know.
   The whole list is still in «Slik spiller du» in the pause menu and the main menu.
   A new hint: add a line to TIPS. id is saved, so do not change it afterwards. when() says when to show it,
   say(touch) gives the text (touch is true on a phone or tablet, where there are buttons instead of keys).
   =========================================================================== */
const TIP={seen:store.get('tips',{}),cur:null,t:0,gap:2,play:0,still:0,stuck:0};
const tipNear=(p,r)=>!!p&&Math.hypot((p.x??p[0])-car.pos.x,(p.z??p[1])-car.pos.z)<r;
const tipFree=()=>state.world&&!state.course;
const TIPS=[
  {id:'stuck',when:()=>TIP.stuck>4,say:t=>t?'Sitter du fast? Prøv lavt gir, Vinsj-knappen eller «Hent bilen» i pausemenyen.':'Sitter du fast? Prøv lavt gir (G), vinsjen (R) eller «Hent bilen» i pausemenyen (Esc).'},
  {id:'start',when:()=>tipFree()&&TIP.play>1.5,say:()=>'Hele øya er din. Pilen over bilen viser veien til en lett løype å begynne med.'},
  {id:'portal',when:()=>{if(!tipFree())return false;const n=nearestPortal();return!!n&&n.d<13},say:t=>'Kjør inn mellom flaggene og trykk START'+(t?'':' (Enter)')+'. Porter, kasser og hopp gir muttere.'},
  {id:'garage',when:()=>tipFree()&&tipNear(LEVELS[state.levelIdx].garageAt,13),say:()=>'Verkstedet: her bruker du mutterne på dekk, fjæring, motor, lakk og nye biler.'},
  {id:'ferry',when:()=>tipFree()&&LV.ferry&&tipNear(LV.ferry.quay,14),say:()=>'Fergekaia: kjør om bord på fergen for å reise til de andre øyene.'},
  {id:'boat',when:()=>tipFree()&&LV.marinaDef&&tipNear(LV.marinaDef.ask,16),say:()=>'Captain Theis\' marina: parker på den blå ruta for å kjøre motorbåtløp.'},
  {id:'fly',when:()=>tipFree()&&LV.airportDef&&tipNear(LV.airportDef.ask,16),say:()=>'Småflyet: parker på den blå ruta for å dra på rundflyging.'},
  {id:'cargo',when:()=>tipFree()&&LV.airportDef&&LV.airportDef.cargo&&cargoNear(),say:()=>'Lasteflyet: kjør opp rampa og inn i lasterommet, så flyr du selv til en annen øy. Det er gratis.'},
  {id:'ski',when:()=>tipFree()&&LV.liftDef&&tipNear(LEVELS[state.levelIdx].skiAt,14),say:()=>'Stolheisen: parker på den blå ruta for å stå på ski.'},
  {id:'race',when:()=>tipFree()&&LV.raceDef&&tipNear(LV.raceDef.ask,16),say:()=>'Racerbanen: parker på den blå ruta ved startstreken for å kjøre race.'},
  {id:'mine',when:()=>tipFree()&&LV.mineDef&&tipNear(LV.mineDef.mouth,LV.mineDef.r+14),say:()=>'Gruve 7: kjør inn i gruveinngangen og kjør om kapp i gruvevogn. Vinneren får 150 muttere.'},
  {id:'vault',when:()=>tipFree()&&LV.vaultDef&&tipNear(LV.vaultDef.ask,LV.vaultDef.r+12),say:()=>'Frøhvelvet: stopp på den blå ruta ved døra og hjelp Frøken Frø med frøene.'},
  {id:'skuter',when:()=>tipFree()&&LV.skuterDef&&tipNear(LV.skuterDef.ask,14),say:()=>'Skuterutleia: parker på den blå ruta for å låne en snøskuter. Den er rask på snø og is.'},
  {id:'secret',when:()=>tipFree()&&secretVis.some(s=>!s.taken&&tipNear(s.sc,9)),say:()=>'Lyssøylen viser en gullmutter. Det er '+SECRET_PER+' på hver øy, og hver er verdt 25 muttere.'},
  {id:'walk',when:()=>tipFree()&&TIP.play>25&&TIP.still>4&&!WALK.on,say:t=>t?'Du kan gå ut av bilen når den står stille: trykk på knappen med mannen.':'Du kan gå ut av bilen når den står stille: trykk E.'},
  {id:'gps',when:()=>tipFree()&&TIP.play>75&&!WALK.on,say:t=>'Usikker på veien? Åpne kartet'+(t?'':' (K)')+' og trykk på et sted, så viser en blå pil veien dit.'}
];
function tipSave(id){if(TIP.seen[id])return;TIP.seen[id]=1;store.set('tips',TIP.seen)}
function tipHide(){TIP.cur=null;TIP.gap=7;$('tip').classList.remove('on')}
// the player did it without being told: k is the key of a question (openAsk), a course (an object) or a hint id
function tipDone(k){const id=typeof k!=='string'?'portal':(TIPS.find(t=>k.startsWith(t.id))||{}).id;if(!id)return;tipSave(id);if(TIP.cur===id)tipHide()}
function tipShow(tp){TIP.cur=tp.id;TIP.t=9;tipSave(tp.id);$('tipTxt').textContent=tp.say(document.body.classList.contains('is-touch'));$('tip').hidden=false;void $('tip').offsetWidth;$('tip').classList.add('on')}
// every frame while the car is driven on an island or a course
function tipsUpdate(dt){
  if(state.mode!=='play'){if(TIP.cur)tipHide();return}
  if(tipFree())TIP.play+=dt;
  const sp=car.vel.length(),thr=Math.abs(car.throttle);
  TIP.still=sp<.05&&thr<.05&&!WALK.on?TIP.still+dt:0;
  TIP.stuck=sp<.12&&thr>.6&&car.up.y>.5&&!WALK.on?TIP.stuck+dt:Math.max(0,TIP.stuck-dt*2);
  if(TIP.cur){TIP.t-=dt;if(TIP.t<=0)tipHide();return}
  TIP.gap-=dt;if(TIP.gap>0)return;
  const tp=TIPS.find(t=>!TIP.seen[t.id]&&t.when());if(tp)tipShow(tp)}
function showHelp(back){const b=$(back);if(b)b.hidden=true;$('help').hidden=false;$('helpOk').onclick=()=>{$('help').hidden=true;if(b&&(back!=='pause'||state.mode==='pause')){b.hidden=false;const f=b.querySelector('#pResume,#startBtn');if(f)f.focus()}};$('helpOk').focus()}
