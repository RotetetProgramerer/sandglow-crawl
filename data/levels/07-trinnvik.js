// Trinnvik: en liten, fargerik by på en flat øy der alt har kanter. Fortauskanter, rådhustrapp, skatepark, stadion,
// parkeringshus med spiral opp til taket, og en liten byggetomt. Byen ligger på to terrasser (Nedre by 1,2 og Øvre by 2,39)
// med utsiktstoppen (3,59) øverst. Terrassene, bollen, amfiet og P-huskjeglen ligger i base(); trapper, gater og kanter
// stemples absolutt med c.stairs/c.street/shape(...,level). Sju løyper testes hver for seg:
//   node tools/test-levels.js trinnvik
(function(){
const DEG=Math.PI/180;
const smt=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const clamp=(v,a=0,b=1)=>v<a?a:v>b?b:v;
// ---------- nivåer og geografi ----------
const L0=1.2, L1=L0+1.19, L2=L1+1.2;                            // Nedre by, Øvre by, Utsikten
const UP={x0:-10.5,x1:10.5,z0:10,z1:29.5};                      // Øvre by
const BAKKEN={x0:10.5,x1:13,z0:4.9,z1:13};                      // gaterampa opp til Øvre by (23 %) med landing øverst
const UTS=[-.5,30], UTS_R=5.5;                                  // utsiktstoppen: stor nok til å snu på
const PH=[22,-8], PH_R=8.2, PH_TOP=4.8, PH_H=3.0;               // P-huset: kjegle, takdekke og høyde over gata
const AMF=[-23,-1], AMF_R=4;                                    // amfiet i parken (nedsenket)
const BOWL=[-19,-24], BOWL_R=3.4;                               // bollen i skateparken (nedsenket)
const PITCH={x0:16,x1:29,z0:11,z1:18.4};                          // stadionbanen (0,1 under ringen rundt)
const SITE={x0:10.5,x1:20,z0:22,z1:28.5};                       // byggetomta
const rectIn=(R,x,z,e)=>smt((x-R.x0+e)/(2*e))*smt((R.x1-x+e)/(2*e))*smt((z-R.z0+e)/(2*e))*smt((R.z1-z+e)/(2*e));
const inR=(R,x,z)=>x>=R.x0&&x<=R.x1&&z>=R.z0&&z<=R.z1;
const upper=(x,z)=>Math.max(rectIn(UP,x,z,.25),rectIn(BAKKEN,x,z,.25)*clamp((z-BAKKEN.z0)/5.1));
const dPH=(x,z)=>Math.hypot(x-PH[0],z-PH[1]);
// flyplassen øst på øya (js/plane.js): fylt ut i sjøen, rullebanen nord–sør, oppstillingsplassen med terminal, tårn og hangar.
// Flyplassveien går fra enden av Promenaden langs stranda; den ligger også på fylling der stranda er smal.
const AIR={x0:-57,x1:-36,z0:-44,z1:16}, AIRH=1.05;
const RWY={x0:-53.2,x1:-48.4,z0:-31,z1:13}, APRON={x0:-46.5,x1:-38.5,z0:-16,z1:-1.5}, CPAD={x0:-55.2,x1:-45.2,z0:-42.6,z1:-31};   // CPAD: plassen bak lasteflyet
const AIRVEI=[[-8,-30.5],[-14,-34.2],[-22,-35.2],[-30,-32.2],[-36,-27.2],[-40,-21.8],[-41.6,-16.8]];
const lineD=(L,x,z)=>{let m=1e9;for(let i=0;i<L.length-1;i++){const a=L[i],b=L[i+1],ex=b[0]-a[0],ez=b[1]-a[1],L2=ex*ex+ez*ez||1e-9;let t=((x-a[0])*ex+(z-a[1])*ez)/L2;t=t<0?0:t>1?1:t;m=Math.min(m,Math.hypot(x-a[0]-ex*t,z-a[1]-ez*t))}return m};
const airLand=(x,z)=>Math.max(rectIn(AIR,x,z,1.2),smt((2.8-lineD(AIRVEI,x,z))/1.2)*smt((Math.hypot(x,z)-33)/3));
const inCity=(x,z)=>(x>-17&&x<14&&z>-20&&z<6)||upper(x,z)>.5||(x>-30&&x<-11&&z>-29&&z<-6)||(x>12&&x<31.5&&z>1&&z<24);
// ---------- gatene ----------
const RING=[[-11,-14],[12,-14],[12,3],[-11,3],[-11,-14]];
const HAVNEGATA=[[12,-14],[20.5,-20.5]];
const KAIVEIEN=[[16.5,-18.5],[22,-18.3],[31,-18.3]];
const STADIONV=[[12,2.5],[20,2.5],[28,2.5],[30.5,4],[30.8,8],[30.8,17]];
const PROMENADEN=[[12,-14],[12,-22],[6,-29],[-2,-32],[-8,-30.5]];
const OVREGATE=[[-10,11.6],[11.25,11.6]];
const SMAUET=[[6,12.4],[6,19.8]];
// P-husspiralen: én omgang fra r 8,2 (ved Havnegata, sørvest) inn til takdekket r 4,8. Én omgang gir 3,4 i radiell avstand per runde, nok til kjørebanen (2 × 1,3) og kanten.
const SP0=225,SP1=585;
const spR=d=>PH_R-(PH_R-PH_TOP)*(d-SP0)/(SP1-SP0);
const spP=d=>{const r=spR(d);return[PH[0]+r*Math.cos(d*DEG),PH[1]+r*Math.sin(d*DEG)]};
const spY=d=>L0+PH_H*clamp((PH_R-spR(d))/(PH_R-PH_TOP));
const SPIRAL=[];for(let d=SP0;d<=SP1+.01;d+=7.5)SPIRAL.push(spP(d));
const inArrival=th=>th>160&&th<250;   // der rampa går inn på takdekket (grader rundt P-husets midtpunkt)
// tribunen: høyde over L0 i tribunens eget rutenett (a langs x fra midten 21,5, b mot sør fra z 8,5)
const tribRow=b=>b<-1.6?-1:b<.5?Math.floor((b+1.6)/.525):4;   // fire rader à 0,525 og en dyp øverste rad (2,0) som bilen kan kjøre langs
const tribH=(a,b)=>{const aa=Math.abs(a);if(aa>5)return .9*clamp((7.5-aa)/2.5)*(b<-1.6?clamp((b+2.5)/.9):1);const i=tribRow(b);return i<0?0:.18*(i+1)};
// ---------- løypene (bench:false der bakken er stemplet by) ----------
const CH=[
 {id:'torget',name:'Torgrunden',diff:1,gates:8,bench:false,desc:'Én runde på Ringveien rundt Torget: fortauskanter, fartsdumper, gangfelt, Tretrinnet og kjegler som velter.',
  path:[[-6,-14],[0,-14],[8,-14],[12,-13],[12,-8],[12,-4],[12,0],[11,3],[4,3],[-4,3],[-11,2],[-11,-6],[-11,-13],[-8,-14]]},
 {id:'park',name:'Parkstien',diff:1,gates:9,hw:1.1,surf:S.GRAVEL,desc:'Grusstier gjennom Byparken: sandkassa, opp stigen og ned sklia, trappepyramiden og rundt dammen.',
  path:[[-15,2.8],[-19,2.8],[-22,4],[-26,4.5],[-28.6,5.5],[-29.6,7.5],[-29.6,10],[-29.6,13],[-29.4,16],[-28,18.5],[-25.5,19.5],[-23.6,17.5],[-23.5,14.5],[-23.5,11],[-23.5,8],[-21.5,6.5],[-18.5,7.5],[-14,11.5],[-11.8,14],[-11.8,17.5],[-12,21],[-14.5,23.5],[-18,23],[-20.5,20.5],[-20.5,17],[-19,13.5],[-16.5,9.5],[-15.5,5.5],[-15,3.2]]},
 {id:'skate',name:'Skateparken',diff:2,gates:10,bench:false,desc:'Bølgene, pyramiden, skinnene, Seksern og inn i røret. Rundt bollen, ikke ned i den.',
  path:[[-13,-14],[-13,-17],[-13,-22],[-13,-27],[-13.8,-29.2],[-16,-30.2],[-18.5,-29.8],[-21,-28.5],[-23,-26.2],[-24.5,-23.8],[-24.5,-21],[-24.5,-17],[-24.5,-14.6],[-24.5,-12.4],[-22.8,-12],[-19,-12],[-15.5,-12],[-14.8,-14],[-16,-16.5],[-19.5,-16.5],[-22.5,-16.5],[-24.3,-15],[-25.8,-13],[-27.4,-11.2],[-28,-8.5],[-28,-5.8],[-27,-4.4],[-25,-5],[-22.5,-6],[-19,-6.8],[-15.8,-8.4],[-15,-11],[-14.2,-13.5],[-13.2,-15.5]]},
 {id:'stadion',name:'Stadionrunden',diff:2,gates:10,bench:false,desc:'Opp enderampen på tribunen og langs øverste rad, ned i østenden, gjennom spillertunnelen, over gresset og opp seteradene.',
  path:[[17,2.5],[22,2.5],[28,2.5],[30.5,3.8],[31.5,5.6],[30.8,6.85],[28,6.85],[22,6.85],[18,6.85],[16.2,6.85],[14.8,6.6],[14.4,8.5],[14.4,12],[14.4,16],[15.5,19.8],[18,21.1],[22,21.1],[26.5,21.1],[29.3,21.1],[30.3,19.5],[29.5,18.4],[28,17.2],[26,15.9],[24,14.7],[20.5,14.7],[18.4,13.5],[18.4,11],[18.4,8.5],[18.4,7],[20,6.85],[22,6.85],[26,6.85],[28.5,6.85],[30.8,6.85],[31.5,5.6],[30.5,3.8],[28,2.6],[24,2.5],[20,2.5]]},
 {id:'spiral',name:'Spiraltoppen',diff:2,gates:8,bench:false,desc:'Inn under bommen og én omgang opp spiralrampen i P-huset. Mål på takdekket.',
  path:[...SPIRAL.filter((_,i)=>i%2===0),[20.5,-9.6],[22.3,-8.2]]},
 {id:'trapp',name:'Trappeløpet',diff:3,gates:12,bench:false,desc:'Byens trappemaraton: Rådhustrappa opp, Trappegata opp til Utsikten, ned Utsiktsveien, gjennom Smauet og Bibliotekstrappa ned.',
  path:[[-3,-9],[-2.5,-5],[-2,-1],[-2,2.8],[-2,6],[-2,10],[-2,13],[-2,16.5],[-2,19.5],[-2,23],[-2,26.5],[-2,28.8],[-2.8,30.5],[-2,32.4],[-.2,33],[1.6,32.2],[2.3,30.4],[2.1,28.5],[2.9,27.5],[4.7,25.7],[6.5,23.9],[6.4,21.8],[6,19.8],[6,16.5],[6,13.5],[6,10.8],[6,8],[6,4.8],[6,1.5],[5,-2.5],[2.5,-6.5],[-1,-9.5]]},
 {id:'natt',name:'Nattbyen',diff:2,gates:8,bench:false,night:true,desc:'Byen etter mørkets frembrudd: Ringveien, ut Havnegata og langs Kaiveien til containerkaia med lyskasterne.',
  path:[[-8,3],[0,3],[8,3],[11.6,1.5],[12,-5],[12,-9],[12.5,-12],[13.8,-14.2],[15.6,-16.4],[17.5,-18.3],[22,-18.3],[27,-18.3],[31,-18.3]]},
];
// ---------- hjelpere for stempler ----------
const rectCells=(x0,z0,x1,z1,fn)=>cellsIn(x0,z0,x1,z1,(k,px,pz)=>{if(px<x0||px>x1||pz<z0||pz>z1)return;fn(k,px,pz)});
const stripe=(a,w,c0,c1)=>(Math.floor(a/w)%2===0)?c0:c1;
// fartsdump på en gate: 0,12 høy sinushump, gule og svarte striper. level = gatenivået
const bump=(x,z,ang,level,h=.12)=>shape(x,z,ang,.9,3.2,(a,b)=>h*(1-Math.cos(2*Math.PI*(a+.45)/.9))/2,S.ASPHALT,(a,b)=>stripe(b+1.6,.4,'#e5c13a','#2a2a2a'),level);
// bytre (js/props/tre-by.js): plasseres nå, bygges av c.plants() etter c.finish, så stamme og krone står på ferdig bakke
const tree=(c,x,z,s=1)=>c.plant('bytre',x,z,{s});

LEVELS.push(
{ id:'trinnvik', name:'Trinnvik', diff:2, seed:7171, size:120, coast:42, world:true,
  desc:'En by der alt har kanter: trapper, fortauskanter, skatepark, stadion og et parkeringshus med spiral. Sju løyper.',
  start:[2,-11.5,Math.PI/2],
  sky:['#4a9be0','#eaf2f7'], fog:0xe3ecf2, fogNear:30, fogFar:110, sun:0xfff0d8, sunI:.95, hemi:[0xcfe4f7,0x7a7f70,.5], sunDir:[-18,22,14], rockCol:'#8f8b83',
  water:.3, waterCol:'#2f7a96', waterOpacity:.85, ambience:'town', bellAt:[-7.2,14.3],
  dark:(x,z)=>smt(1-Math.hypot((x-26.5)/2.6,(z-21.1)/1.7)),
  biome:(x,z)=>{const R=Math.hypot(x,z),park=smt((10-Math.hypot(x+23,z-9))/6),city=smt((22-Math.hypot(x,z+4))/9)*(1-park);
    return{beach:smt((R-30)/5),city,stadium:rectIn(PITCH,x,z,2.5),site:smt((6-Math.hypot(x-15.5,z-25.5))/3),jungle:park*.25,swamp:0,snow:0}},
  path:[[0,-13],[2,-11],[0,-9],[-2,-11],[0,-13]], challenges:CH, village:{at:[26.2,-26.2]}, landExtra:airLand,
  mapLabels:[[0,-5,'Torget'],[-2,18,'Øvre by'],[-2,32,'Utsikten'],[-20,-19,'Skateparken'],[-24,9,'Byparken'],[21.5,15,'Stadion'],[22,-8,'P-huset'],[15,25.5,'Byggetomta'],[27,-25,'Havna'],[2,-31,'Promenaden'],[31,-14,'Kaia'],[-47,-3,'Flyplassen']],
  animals:{pigeons:14,gulls:{at:[4,-35.5],n:7},crabs:6,crabsAt:[3.5,-36],fish:[{at:[-16.5,19],r:2,n:2},{at:[-4,-42],r:5,n:3},{at:[36,-30],r:4,n:2}],
    rabbits:[{at:[-22,10],r:6,n:5}],butterflies:20,rats:[{at:[32,-10.5],r:1.5,n:3},{at:[14,25],r:3,n:3}],cats:[{at:[-4,-18.5],r:5,n:2},{at:[-13,-5],r:4,n:1}]},
  boulder:{trigger:[22.5,14.7],from:[17,16.4],to:[28,13],speed:4.5,r:.35,col:'#f4f4f0',msg:'⚽ Ballen!'},
  base(x,z,n){const R=Math.hypot(x,z),u=upper(x,z);
    let h=L0+1.19*u+.18*fbm(n,x*.08,z*.08,3)*smt((R-27)/5)*(1-u)*(inCity(x,z)?0:1)-.22*smt((R-35)/4);   // flat by, litt bølger i utkanten, stranda skråner svakt mot sjøen
    {const d=Math.hypot(x-UTS[0],z-UTS[1]),w=smt((UTS_R+.3-d)/.6);h+=(L2-h)*w}      // utsiktstoppen
    {const d=dPH(x,z);if(d<PH_R)h=Math.max(h,L0+PH_H*clamp((PH_R-d)/(PH_R-PH_TOP)))} // P-huskjeglen
    {const d=Math.hypot(x-AMF[0],z-AMF[1]);if(d<AMF_R){const i=Math.min(3,Math.floor((AMF_R-d)/.56));h-=d<1.76?.68:.17*(i+1)}}   // amfiet: fire seterader ned til scenen
    {const d=Math.hypot(x-BOWL[0],z-BOWL[1]);if(d<BOWL_R)h-=.8*(1-(d/BOWL_R)**2);else if(d<BOWL_R+.35)h+=.08}        // bollen med coping
    h-=.10*rectIn(PITCH,x,z,.15);                                                   // gresset ligger under ringen rundt banen
    {const w=airLand(x,z);if(w>0)h+=(AIRH-h)*w}                                    // flyplassen og veien dit: flatt, på fylling ut i sjøen
    return h},
  surf(x,z,n){if(inR(RWY,x,z)||inR(APRON,x,z)||inR(CPAD,x,z))return S.ASPHALT;if(rectIn(AIR,x,z,.6)>.5)return S.GRASS;   // flyplassen
    const u=upper(x,z);if(u>.03&&u<.97)return S.ROCK;                   // terrassemurene
    if(Math.hypot(x-UTS[0],z-UTS[1])<UTS_R)return S.ROCK;                          // utsiktsplatået er steinlagt
    const d=dPH(x,z);if(d<PH_TOP)return S.ASPHALT;if(d<PH_R)return S.GRAVEL;       // P-huset: takdekke og betongkjegle (veien males asfalt)
    if(inR(PITCH,x,z))return S.GRASS;if(inR(SITE,x,z))return S.GRAVEL;
    if(Math.hypot(x-BOWL[0],z-BOWL[1])<BOWL_R+.4)return S.ROCK;
    if(inCity(x,z))return S.ROCK;                                                  // fortau og betong
    return n(x*.4+5,z*.4)>.7?S.DIRT:S.GRASS},
  build(c){const R=c.rng,def=this,P=c.perches;c.flowers=[];
    // --- murer, torg, øvre by, amfi og bollen får farge før gatene legges ---
    cellsIn(-HALF,-HALF,HALF,HALF,(k,px,pz)=>{const u=upper(px,pz);if(u>.03&&u<.97)setC(k,mix('#6a6662','#7d7974',G.noise(px*3,pz*3)));
      const d=Math.hypot(px-BOWL[0],pz-BOWL[1]);if(d<BOWL_R)setC(k,mix('#4a7fb5','#7fb0d8',(d/BOWL_R)**2));else if(d<BOWL_R+.35)setC(k,'#e9e4da')});
    rectCells(-7.4,-11.4,7.4,1.4,(k,px,pz)=>setC(k,((Math.floor(px/1.2)+Math.floor(pz/1.2))%2)?'#9f9b92':'#8f8b83'));                   // torget: heller i to gråtoner
    rectCells(UP.x0,UP.z0,UP.x1,UP.z1,(k,px,pz)=>{if(upper(px,pz)>.97)setC(k,mix('#949089','#a29e95',G.noise(px*2,pz*2)))});                 // øvre by
    cellsIn(AMF[0]-AMF_R,AMF[1]-AMF_R,AMF[0]+AMF_R,AMF[1]+AMF_R,(k,px,pz)=>{const d=Math.hypot(px-AMF[0],pz-AMF[1]);if(d>AMF_R)return;const i=Math.floor((AMF_R-d)/.56);TS[k]=S.ROCK;setC(k,d<1.76?'#8a6a3a':(i%2?'#a9a59c':'#938f86'))});
    // --- løypene først (fri sone for pynt), så gatene ---
    for(const ch of CH)c.course(ch);
    c.street(RING,{cross:[[0,-14],[12,-10],[-11,-6],[0,3]]});c.street(HAVNEGATA,{});c.street(KAIVEIEN,{});c.street(STADIONV,{cross:[[20,2.5]]});
    c.street(PROMENADEN,{hw:1.5,cross:[[12,-18]]});c.street(OVREGATE,{hw:1.4,cross:[[-2,11.6],[6,11.6]]});c.street(SMAUET,{hw:1.5,drop:.1});
    c.road([[13.6,-14.5],[15.9,-14.1]],{hw:1.3,blend:.6,surf:S.ASPHALT});c.road(SPIRAL,{hw:1.3,blend:.6,surf:S.ASPHALT});                     // innkjøring og spiral
    // takdekket igjen der spiralens utjevning senket kanten, unntatt i sektoren der rampa kommer inn
    cellsIn(PH[0]-PH_TOP-.4,PH[1]-PH_TOP-.4,PH[0]+PH_TOP+.4,PH[1]+PH_TOP+.4,(k,px,pz)=>{const r=dPH(px,pz);if(r>PH_TOP+.3)return;let th=Math.atan2(pz-PH[1],px-PH[0])/DEG;if(th<0)th+=360;if(inArrival(th))return;TH[k]=Math.max(TH[k],L0+PH_H*(1-smt((r-PH_TOP)/.3)))});
    paint(PH[0],PH[1],PH_TOP+.2,S.ASPHALT);
    // P-husets kant: en 0,12 ribbe i rampenivå langs ytterkanten av spiralen så ingen drifter ut over kanten
    cellsIn(PH[0]-PH_R-1,PH[1]-PH_R-1,PH[0]+PH_R+1,PH[1]+PH_R+1,(k,px,pz)=>{const r=dPH(px,pz);if(r<PH_TOP+.8||r>PH_R+1.2)return;let th=Math.atan2(pz-PH[1],px-PH[0])/DEG;if(th<0)th+=360;
      for(let kk=0;kk<2;kk++){const d=th+360*kk;if(d<SP0+6||d>SP1)continue;const lat=r-spR(d);if(lat>1.3&&lat<1.62){TH[k]=Math.max(TH[k],spY(d)+.12*(1-smt((lat-1.42)/.2)));TS[k]=S.ROCK;setC(k,'#d9d5cc')}}});
    // --- trappene (absolutt stempel) ---
    c.stairs(-2,4.9,0,7,.17,.7,8,{level:L0,land:.6});                                     // Rådhustrappa: 7 × 0,17, 8 bred
    c.stairs(6,5.0,0,7,.17,.7,3,{level:L0,land:.4,wall:true});                            // Bibliotekstrappa: 7 × 0,17, 3 bred, med murer
    c.stairs(-2,19,0,4,.15,.8,3,{level:L1,land:1.4});c.stairs(-2,23.6,0,4,.15,.8,3,{level:L1+.6,land:.8});   // Trappegata: 4 + repos + 4 × 0,15 opp til Utsikten
    c.stairs(-15.5,26.5,Math.PI/2,5,.238,.55,2,{level:L0,land:2.3,wall:true,c0:'#7a766f',c1:'#8c8880'});      // Kjerringtrappa: ekspert, bare lavt gir
    shape(4.7,25.7,135*DEG,5.1,2.8,(a,b)=>1.2*(.5-a/5.1)+(Math.abs(b)>1.15?.1:0),S.ROCK,(a,b)=>Math.abs(b)>1.15?'#aaa69e':mix('#7d7974','#8a867e',G.noise(a*2,b*2)),L1);   // Utsiktsveien: rampe ned fra platået mot Smauet (24 %)
    c.fx.push({type:'sign',x:14.4,z:4.2,ang:Math.PI,text:'LETT VEI OPP',sub:'← Bakken'});c.fx.push({type:'sign',x:-16.6,z:24.9,ang:Math.PI/2,text:'BRATT!',sub:'lavt gir'});
    // Tretrinnet: opphøyd kryss på østgata, 3 trinn à 0,14 opp og ned
    shape(12,-4,0,4.6,3.2,(a,b)=>{const u=a+2.3;return u<1.8?(Math.floor(u/.6)+1)*.14:u<2.8?.42:(Math.floor((4.6-u)/.6)+1)*.14},S.ROCK,(a,b)=>{const u=a+2.3,st=u<1.8?Math.floor(u/.6):u<2.8?3:Math.floor((4.6-u)/.6);return st===3?'#a9a59c':(st%2?'#9f9b92':'#8a867e')},L0-.12);
    bump(4,-14,Math.PI/2,L0-.12);bump(-11,-9,0,L0-.12);bump(24,2.5,Math.PI/2,L0-.12);bump(8,-27.2,Math.atan2(-6,-7),L0-.12);
    // --- Torget: fontene, kiosk, benker, boder, kjegler, trær ---
    c.pond(0,-5,1.5,.3,{fill:.6,bed:S.ROCK});disc(0,-5,.45,.3,S.ROCK,'#a7a39a',L0);c.cyl(0,L0+.3,-5,.1,.9,'#8d8984');c.cyl(0,L0+1.2,-5,.56,.07,'#8d8984');for(let i=0;i<4;i++){const a=i*Math.PI/2;c.fall(Math.sin(a)*.58,-5+Math.cos(a)*.58,a,.42,L0+1.2,L0-.18,{spray:false})}   // vannet faller fra skålkanten, utenfor sokkelenc.colliders.push({x:0,z:-5,r:.5});
    c.box(4.6,L0,-9,1.6,1.1,1.2,'#e76f51');c.box(4.6,L0+1.1,-9,2.0,.08,1.6,'#f2e8d0');c.box(4.6,L0+.6,-9.62,1.2,.4,.03,'#1a262d');c.colliders.push({x:4.6,z:-9,w:1.7,d:1.3,ry:0});   // kiosken
    for(const[bx,bz,ry]of[[-4.5,-9,0],[-6.2,-2,Math.PI/2],[6.6,-2.5,Math.PI/2],[-4.2,0,0]]){c.box(bx,L0+.3,bz,1.1,.06,.34,'#8a6a3a',ry);for(const sd of[-.42,.42])c.box(bx+Math.cos(ry)*sd,L0,bz-Math.sin(ry)*sd,.08,.3,.3,'#3a3a3a',ry);c.colliders.push({x:bx,z:bz,r:.45})}   // benker
    for(const[sx,sz]of[[-5.2,-7],[-5.2,-3.5]]){for(const[dx,dz]of[[-.6,-.45],[.6,-.45],[-.6,.45],[.6,.45]])c.cyl(sx+dx,L0,sz+dz,.03,1.4,'#8a8a88');c.box(sx,L0+.85,sz,1.4,.05,1.1,'#8a6a3a');c.box(sx,L0+1.4,sz,1.6,.06,1.3,'#d9432f');c.box(sx,L0+1.46,sz,1.6,.06,.4,'#f4f4f0');c.colliders.push({x:sx,z:sz,w:1.5,d:1.2,ry:0})}   // markedsboder
    for(const[cx,cz]of[[2,-12.6],[5,-15.4],[8,-12.6],[13.3,-8],[10.7,-9.5]])c.cone(cx,cz);
    for(const[tx,tz]of[[-6.8,-9.5],[6.8,-9.5],[-6.8,.5]])tree(c,tx,tz,1.1);
    for(let i=0;i<10;i++){const a=i/10*6.28;c.flowers.push({x:Math.cos(a)*2.4,y:L0+.2,z:-5+Math.sin(a)*2.4})}
    // busskur, trafikklys
    for(const[bx,bz,ry]of[[-13.2,-11,-Math.PI/2],[-13.2,-2,-Math.PI/2]]){for(const sd of[-1.1,1.1])c.cyl(bx+Math.cos(ry)*sd,L0,bz-Math.sin(ry)*sd,.04,1.7,'#5a5a58');c.box(bx,L0+1.65,bz,2.6,.08,1.0,'#2c4a6b',ry);c.box(bx+Math.sin(ry)*.45,L0+.4,bz+Math.cos(ry)*.45,2.4,1.2,.03,'#9ec6e0',ry);c.box(bx,L0+.3,bz,1.8,.06,.3,'#8a6a3a',ry);for(const sd of[-.7,.7])c.box(bx+Math.cos(ry)*sd,L0,bz-Math.sin(ry)*sd,.06,.3,.22,'#5a5a58',ry);c.colliders.push({x:bx,z:bz,w:2.6,d:1.0,ry})}   // benken har bein
    for(const[tx,tz]of[[-9.2,-15.8],[13.8,1.4],[10.2,4.8],[-12.8,4.8]]){{const tb=H(tx,tz)-.03;c.cyl(tx,tb,tz,.05,L0+2.2-tb,'#3a3a3a')}c.box(tx,L0+1.6,tz,.2,.6,.2,'#1d1c1a');for(const[dy,col]of[[2.05,'#d9432f'],[1.9,'#e5c13a'],[1.75,'#3fae3a']]){c.box(tx,L0+dy,tz,.26,.1,.1,col);c.box(tx,L0+dy,tz,.1,.1,.26,col)}c.colliders.push({x:tx,z:tz,r:.08,anchor:true,y:L0+.6})}
    // --- Nedre by: husrekker rundt Ringveien ---
    const PAST=['#e9c46a','#f4a261','#8ecae6','#cdb4db','#a8d5a2','#f2e8d0','#e76f51','#90be6d','#f6bd60','#84a59d'];
    for(let i=0;i<8;i++){const hx=-9.1+i*2.6,hh=2.2+(i%3)*.6;c.building(hx,L0,-18.2,2.4,hh,2.4,PAST[i%PAST.length],0,{fh:1.15,sign:i===3?'#d9432f':null})}    // sør
    for(let i=2;i<4;i++){const hz=-9.8+i*2.6,hh=2.4+(i%2)*.6;c.building(-15.2,L0,hz,2.4,hh,2.4,PAST[(i+4)%PAST.length],Math.PI/2,{fh:1.15})}                 // vest
    c.building(-8.6,L0,6.6,2.6,1.7,2.0,'#f2e8d0',Math.PI,{fh:1.3,sign:'#2c4a6b',roofBox:false});c.building(9.3,L0,7.2,1.9,1.6,1.9,'#e76f51',Math.PI,{fh:1.3,roofBox:false});   // kafé og kiosk ved trappene
    // --- Øvre by: rådhus med klokketårn, Smauets husrekker (det første østhuset er biblioteket) ---
    c.building(-7.2,L1,14.3,6.4,2.6,2.8,'#f2e8d0',Math.PI,{fh:1.3,roof:'#6b3a2a',roofBox:false,sign:'#2c4a6b'});c.box(-7.2,L1+2.6,15.2,1.4,2.2,1.4,'#f2e8d0');c.box(-7.2,L1+4.8,15.2,1.6,.5,1.6,'#6b3a2a');c.box(-7.2,L1+3.9,14.48,.7,.7,.03,'#1a262d');c.box(-7.2,L1+3.95,14.46,.06,.4,.02,'#d9432f');   // rådhuset med ur på tårnet
    for(const[hz,i]of[[14.7,0],[17.3,1]]){c.building(2.95,L1,hz,2.4,2.4+i*.5,2.4,PAST[(i+1)%PAST.length],Math.PI/2,{fh:1.15});c.building(9.05,L1,hz,2.4,2.2+i*.7,2.4,PAST[(i+6)%PAST.length],-Math.PI/2,{fh:1.15,sign:i===0?'#2c4a6b':null})}   // Smauet
    for(const[tx,tz]of[[-6,20],[1.6,20.5],[-12.5,8],[-12.5,21]])tree(c,tx,tz,1.0);
    c.cyl(-4.2,L2,30.5,.05,2.0,'#9a9a96');c.box(-3.9,L2+1.7,30.5,.5,.3,.02,'#d9432f');c.cyl(-3.2,L2,32.8,.06,.9,'#5a5a58');c.cyl(-3.2,L2+.9,32.8,.14,.3,'#2a2a2a',{rx:1.2});c.colliders.push({x:-4.2,z:30.5,r:.08},{x:-3.2,z:32.8,r:.1});   // flagg og kikkert på Utsikten
    // --- Havna: lasterampe, containerkai, jernbanespor med planovergang, promenade med molo og badebrygge ---
    shape(17.5,-26.5,0,7,3,(a)=>{const u=a+3.5;return u<2.4?u/2.4*.3:u<5.4?.3:u<6.1?.15:0},S.ROCK,(a,b)=>{const u=a+3.5;return Math.abs(b)>1.3?'#e5c13a':u<2.4?'#8f8b83':mix('#a29e95','#8a867e',u<5.4?.2:.8)},L0);
    for(let i=0;i<2;i++)for(let j=0;j<2;j++){const cx=30.3+j*2.6,cz=-15.8+i*2.6,cy=Math.min(H(cx-1.2,cz-.5),H(cx+1.2,cz-.5),H(cx-1.2,cz+.5),H(cx+1.2,cz+.5))-.02,col=['#c8463a','#2c4a6b','#4a7a3a','#a86a3a'][(i*2+j)%4];c.box(cx,cy,cz,2.4,1.0,1.0,col);for(let s=0;s<4;s++)c.box(cx-.9+s*.6,cy,cz,.03,1.0,1.04,mix(col,'#000',.25));if((i+j)%2)c.box(cx,cy+1.0,cz,2.4,1.0,1.0,['#e5a92b','#8ecae6'][j]);c.colliders.push({x:cx,z:cz,w:2.44,d:1.04,ry:0,anchor:true,y:cy+.5})}
    for(const rz of[-20.3,-21.0])log(15,rz,22.5,rz,.035,S.ROCK,(u,d)=>d<.3?'#9a9a9c':'#5a5a58');for(let x=15.2;x<22.5;x+=.5)c.box(x,Math.min(H(x,-20.2),H(x,-20.65),H(x,-21.1))-.015,-20.65,.12,.03,1.1,'#5a4330');
    for(const[bx,bz]of[[18.9,-22.1]]){c.cyl(bx,L0,bz,.06,1.1,'#5a5a58');c.box(bx,L0+1.0,bz,.06,.5,.06,'#f4f4f0',0,{rz:.6});c.box(bx,L0+1.0,bz,.06,.5,.06,'#f4f4f0',0,{rz:-.6});c.box(bx,L0+.5,bz,2.0,.07,.07,'#d9432f',Math.PI/4);c.colliders.push({x:bx,z:bz,r:.1,anchor:true,y:L0+.5})}   // andreaskors og åpne bomarmer
    for(const[px2,pz2]of[[35,-20],[35.4,-17],[35.2,-14],[34.6,-11.5]])c.cyl(px2,H(px2,pz2)-.02,pz2,.1,.35,'#2a2a2a');                                       // pullerter mot sjøen
    {const B={x0:-8.6,x1:.6,z0:-42.5,z1:-33.9},deep=def.water-.45;   // havnebassenget
      cellsIn(B.x0-1,B.z0-1,B.x1+1,B.z1+1,(k,px,pz)=>{const f=rectIn(B,px,pz,.9);if(f<=0)return;const t=deep;if(t<TH[k]){TH[k]+=(t-TH[k])*f;if(f>.3)TS[k]=S.SAND}})}
    c.bridge(-7,-32.5,-7,-39.2,.9,{sag:0,y0:L0,y1:L0,pier:true});c.bridge(-1,-32.5,-1,-37,.9,{sag:0,y0:L0,y1:L0,pier:true});c.bridge(-7,-37,-1,-37,.9,{sag:.22,y0:L0,y1:L0,pier:true});   // moloen og badebrygga som sløyfe
    for(const[qx,qz,ax]of[[-7,-34.5,1],[-7,-36.5,1],[-7,-38.6,1],[-1,-34.5,1],[-1,-36.5,1],[-3,-37,0],[-5,-37,0]])for(const sd of[-.97,.97]){const px=qx+(ax?sd:0),pz=qz+(ax?0:sd),top=H(qx,qz)+.2,bottom=Math.min(Hterr(px,pz),def.water-.3)-.05;c.cyl(px,bottom,pz,.07,top-bottom,'#4a3a2a')}   // pælene langs kantene av dekket
    {const fb=Math.min(Hterr(-7,-40.4),def.water-.4)-.05;c.cyl(-7,fb,-40.4,.42,def.water+1.4-fb,'#f4f4f0')}c.cyl(-7,def.water+1.4,-40.4,.46,.3,'#d9432f');c.box(-7,def.water+1.7,-40.4,.4,.3,.4,'#1a262d');c.box(-7,def.water+1.74,-40.4,.42,.18,.42,'#fff3c0');c.fx.push({type:'lamp',x:-7,y:def.water+1.75,z:-40.4});c.cyl(-7,def.water+2.0,-40.4,.3,.12,'#d9432f');c.colliders.push({x:-7,z:-40.4,r:.45});   // fyrlykta
    for(const[bx,bz,col]of[[-4.5,-34.8,'#c8463a'],[2,-34.8,'#4f7bb5']]){const by=Math.max(H(bx,bz)-.04,def.water-.14);c.box(bx,by,bz,1.5,.34,.6,col,.3);c.box(bx,by+.33,bz,1.1,.04,.4,'#8a6a3a',.3);c.colliders.push({x:bx,z:bz,r:.8})}   // båter på stranda
    // --- Byparken: sandkasse, sklie, trappepyramide, dam, lekeplass ---
    shape(-19,2,0,4,4,(a,b)=>Math.max(Math.abs(a),Math.abs(b))>1.75?.16:.04,null,(a,b)=>Math.max(Math.abs(a),Math.abs(b))>1.75?'#8a6a3a':'#d2ab66',L0);paint(-19,2,1.7,S.SAND);
    shape(-29.6,10,0,6,3.0,(a,b)=>{const h=a<-1?.18*(Math.floor((a+3)/.5)+1):a<0?.72:.72*(1-a/3);return h+(Math.abs(b)>1.2?.15:0)},S.ROCK,(a,b)=>Math.abs(b)>1.2?'#e5c13a':a<0?'#9a9a96':'#d9432f',L0);   // sklia (kjøres nordover): stige opp, platting, rutsjebane ned, kanter på sidene
    shape(-23.5,13,0,7.2,7.2,(a,b)=>{const r=Math.hypot(a,b);return r>3.6?null:Math.min(.36,.12*(Math.floor((3.6-r)/.9)+1))},S.ROCK,(a,b)=>['#d9432f','#e5a92b','#3fae3a','#4f7bb5'][Math.min(3,Math.floor((3.6-Math.hypot(a,b))/.9))],L0);   // trappepyramiden i regnbuefarger: tre ringer à 0,12
    c.pond(-16.5,19,2.5,1.25,{fill:.62,bed:S.MUD});
    {const L=[];for(let i=0;i<60;i++){const a=R()*6.28,d=2.6+R()*.7,x=-16.5+Math.cos(a)*d,z=19+Math.sin(a)*d;L.push({x,y:H(x,z)-.02,z,sx:.045,sy:.6+R()*.5,sz:.045,rx:(R()-.5)*.4,rz:(R()-.5)*.4,c:['#6d8a3a','#8a9a4a','#5a6b2a'][i%3]});if(i%5===0)c.flowers.push({x,y:H(x,z)+.5,z})}instanced(DG.tuft,DM.tuft,L,c.decor,false)}   // siv
    for(const[hx,hz]of[[-16,26]]){for(const sd of[-.9,.9]){c.cyl(hx+sd,L0,hz-.2,.03,1.6,'#5a5a58',{rx:.253});c.cyl(hx+sd,L0,hz+.2,.03,1.6,'#5a5a58',{rx:-.253})}c.cyl(hx,L0+1.55-1.0,hz,.03,2.0,'#5a5a58',{rz:1.57});for(const sd of[-.35,.35]){c.box(hx+sd,L0+.5,hz,.3,.04,.14,'#d9432f');c.cyl(hx+sd-.1,L0+.5,hz,.008,1.05,'#8a8a88');c.cyl(hx+sd+.1,L0+.5,hz,.008,1.05,'#8a8a88')}c.colliders.push({x:hx,z:hz,w:2.2,d:1.0,ry:0})}   // husker
    {const kx=-22,kz=25;c.cyl(kx,L0,kz,.9,.08,'#2c4a6b');c.cyl(kx,L0,kz,.05,.9,'#9a9a96');for(let i=0;i<6;i++){const a=i/6*6.28;c.cyl(kx+Math.cos(a)*.75,L0+.08,kz+Math.sin(a)*.75,.03,.6,'#e5a92b')}c.colliders.push({x:kx,z:kz,r:.95})}   // karusell
    for(let i=0;i<16;i++){const a=R()*6.28,d=1+R()*1.2;c.flowers.push({x:-20+Math.cos(a)*d,y:L0+.2,z:12.5+Math.sin(a)*d})}
    {const L=[];for(const f of c.flowers)L.push({x:f.x,y:f.y,z:f.z,sx:.07,sy:.07,sz:.07,c:['#e0405a','#f08a3a','#f2d24a','#d35aa8'][L.length%4]});instanced(DG.cone,DM.white,L,c.decor,false)}
    for(const[tx,tz,s]of[[-17.5,-2,1.2],[-13.5,7.5,1.1],[-30,-5,1.0],[-18.2,16,1.2],[-8,23,1.1],[-11.5,9,1.0],[-30.5,2,1.0],[-23.5,22.5,1.0]])tree(c,tx,tz,s);
    // --- Skateparken: bølgene, pyramiden, skinnene, Seksern, røret ---
    shape(-13,-22,0,14,3,(a,b)=>.22*(1-Math.cos(2*Math.PI*(a+7)/2.333))/2,S.ROCK,(a,b)=>Math.abs(b)<.08?'#e9e4da':mix('#5a5a58','#6e6c68',G.noise(a*2,b*3)),L0);
    shape(-19,-12,Math.PI/2,4.8,4.8,(a,b)=>{const ax=Math.abs(a),bz=Math.abs(b),m=Math.max(ax,bz);if(m>2.4)return null;if(m<.6)return .48;if(ax>=bz&&a<0)return Math.min(.48,.16*(Math.floor((2.4-m)/.6)+1));return .48*(2.4-m)/1.8},S.ROCK,(a,b)=>{const m=Math.max(Math.abs(a),Math.abs(b));return a<0&&Math.abs(a)>=Math.abs(b)?(Math.floor((2.4-m)/.6)%2?'#a9a59c':'#7f8d9c'):mix('#4a7fb5','#7fb0d8',(2.4-m)/1.8)},L0);   // pyramiden: tre trinn opp fra vest, bank ned mot øst
    for(const rx of[-20.6,-19.7,-18.8])log(rx,-18,rx,-15,.05,S.ROCK,(u,d)=>d<.3?'#c9c6be':'#5a5a58');
    shape(-24.5,-19,0,8,3,(a,b)=>{let h=a<-1.5?1.08*clamp((a+4)/2.5):a<.5?1.08:Math.max(0,1.08-.18*(Math.floor((a-.5)/.5)+1));if(b<-1.2&&a>.5&&a<2.5)h=Math.max(h,1.0);return h},S.ROCK,(a,b)=>b<-1.2&&a>.5&&a<2.5?'#6e6c68':a<-1.5?'#7f8d9c':a<.5?'#a9a59c':(Math.floor((a-.5)/.5)%2?'#9f9b92':'#8a867e'),L0);   // Seksern (kjøres nordover): bank opp, dekk, seks trinn ned med hubba
    shape(-28,-8.5,0,6,5.2,(a,b)=>{const u=Math.abs(b);if(u<.6)return 0;const v=u-.6;return v<1.6?1.6-Math.sqrt(Math.max(0,1.6*1.6-v*v)):1.6},S.ROCK,(a,b)=>Math.abs(b)>2.1?'#e9e4da':mix('#4a7fb5','#2c4a6b',Math.abs(b)/2.2),L0);   // røret: halfpipe med kvartsirkler
    for(let z=-21;z<-9;z+=1.5){const b=Math.min(H(-31,z),H(-31,z+.75),H(-31,z+1.5))-.02;c.box(-31,b,z+.75,.04,L0+1.1-b,1.5,'#9a9a96')}for(let z=-21;z<=-9;z+=1.5){const b=H(-31,z)-.03;c.cyl(-31,b,z,.03,L0+1.2-b,'#5a5a58')}c.colliders.push({x:-31,z:-15,w:.1,d:12,ry:0});   // gjerdet mot sjøen
    // --- Stadion: tribune med enderamper og rekkverk bak, bane med linjer, mål, spillertunnel, lysmaster ---
    shape(22.5,8.5,Math.PI/2,15,5,tribH,S.ROCK,(a,b)=>{const i=tribRow(b);if(i<0)return '#8f8b83';return Math.abs(a)>5?'#85817a':(i%2?'#a9a59c':'#7f8d9c')},L0);
    for(let x=15.5;x<=29.5;x+=1){const y0=tribH(x-23,2.3),y1=tribH(x-22,2.3),y=L0+(y0+y1)/2;c.box(x,y,6.05,1.02,.5,.14,'#9a968e',0,{rz:Math.atan2(y1-y0,1)});c.colliders.push({x,z:6.05,w:1.02,d:.14,ry:0})}   // rekkverket bak øverste rad
    {const cx=(PITCH.x0+PITCH.x1)/2,cz=(PITCH.z0+PITCH.z1)/2,pw=PITCH.x1-PITCH.x0,pd=PITCH.z1-PITCH.z0;for(const[bx,bz,w,d]of[[cx,PITCH.z0+.1,pw,.12],[cx,PITCH.z1-.1,pw,.12],[PITCH.x0+.1,cz,.12,pd],[PITCH.x1-.1,cz,.12,pd],[cx,cz,.12,pd]])c.box(bx,L0-.1,bz,w,.02,d,'#f4f4f0');
    for(let i=0;i<16;i++){const a=i/16*6.28;c.box(cx+Math.cos(a)*1.3,L0-.1,cz+Math.sin(a)*1.3,.52,.02,.1,'#f4f4f0',Math.PI/2-a)}
    for(const gx of[PITCH.x0+.6,PITCH.x1-.6]){for(const gz of[cz-.9,cz+.9]){c.cyl(gx,L0-.1,gz,.035,.8,'#f4f4f0');c.colliders.push({x:gx,z:gz,r:.06})}c.cyl(gx,L0+.7-.95,cz,.035,1.9,'#f4f4f0',{rx:1.57});c.box(gx+(gx<cx?-.3:.3),L0-.1,cz,.02,.8,1.86,'#d9d9d6')}}   // linjer og mål
    c.building(26.5,L0,19.0,5,2.2,1.2,'#8a8f96',Math.PI,{fh:1.1,roofBox:false});c.building(26.5,L0,23.2,5,2.2,1.2,'#8a8f96',0,{fh:1.1,roofBox:false});c.box(26.5,L0+1.9,21.1,5,.18,4.6,'#55534f');c.fx.push({type:'sign',x:22.6,z:22.6,ang:Math.PI/2,text:'SPILLER-',sub:'tunnelen'});   // garderobebyggene med tunnelen mellom
    for(const[lx,lz]of[[13.3,16],[31.8,15],[13.4,21.6]]){{const fb=H(lx,lz)-.05;c.cyl(lx,fb,lz,.08,L0+5.2-fb,'#5a5a58')}c.box(lx,L0+5.1,lz,.9,.3,.4,'#2a2a2a');c.box(lx,L0+5.05,lz,.8,.08,.3,'#fff3c0');c.colliders.push({x:lx,z:lz,r:.12,anchor:true,y:L0+.6});c.fx.push({type:'lamp',x:lx,y:L0+5.0,z:lz})}
    // --- P-huset: brystning, søyler, bom, takdekke med striper, lekebiler og heissjakt ---
    for(let i=0,d=SP0+7;d<=SP1-4;d+=5.5,i++){const p=spP(d),q=spP(d+1),ang=Math.atan2(q[0]-p[0],q[1]-p[1]),ox=Math.cos(d*DEG),oz=Math.sin(d*DEG),bx=p[0]+ox*1.5,bz=p[1]+oz*1.5;
      c.box(bx,H(bx,bz)-.02,bz,.1,.32,.78,'#c9c6be',ang);if(d>300&&d<540&&i%3===0)c.cyl(p[0]-ox*1.6,spY(d)-.1,p[1]-oz*1.6,.13,2.2,'#9a968e')}
    for(let a=0;a<360;a+=9){if(inArrival(a))continue;const rr=PH_TOP-.12,x=PH[0]+Math.cos(a*DEG)*rr,z=PH[1]+Math.sin(a*DEG)*rr;c.box(x,H(x,z)-.02,z,.1,.32,.78,'#c9c6be',-a*DEG)}   // brystningen på takkanten
    for(let i=0;i<6;i++){const a=[0,40,80,120,280,320][i]*DEG,x=PH[0]+Math.cos(a)*2.9,z=PH[1]+Math.sin(a)*2.9,ry=-a;for(const sd of[-1,1])c.box(x+Math.cos(ry)*sd*.78,L0+PH_H+.01,z-Math.sin(ry)*sd*.78,.08,.02,1.9,'#f4f4f0',ry);
      if(i%2===0){const col=['#d9432f','#4f7bb5','#3fae3a'][i/2|0];c.box(x,L0+PH_H+.08,z,1.0,.38,1.8,col,ry);c.box(x,L0+PH_H+.46,z,.9,.32,.9,mix(col,'#1a262d',.6),ry);for(const sx of[-.5,.5])for(const sz of[-.55,.55])c.cyl(x+Math.cos(ry)*sx+Math.sin(ry)*sz,L0+PH_H+.09,z-Math.sin(ry)*sx+Math.cos(ry)*sz,.16,.14,'#1a1918',{rz:1.57,ry});c.colliders.push({x,z,w:1.0,d:1.8,ry})}}
    c.box(24.6,L0+PH_H,-6.5,1.6,1.5,1.6,'#8a8f96');c.box(24.6,L0+PH_H+.4,-7.31,.7,.9,.03,'#1a262d');c.colliders.push({x:24.6,z:-6.5,w:1.64,d:1.64,ry:0,anchor:true,y:L0+PH_H+.5});c.cyl(24.6,L0+PH_H+1.5,-6.5,.12,.9,'#5a5a58');
    {const e=spP(228),ang=Math.atan2(spP(232)[0]-e[0],spP(232)[1]-e[1]);for(const sd of[-1.6,1.6]){const qx=e[0]+Math.cos(ang)*sd,qz=e[1]-Math.sin(ang)*sd,qb=H(qx,qz)-.03;c.cyl(qx,qb,qz,.06,L0+1.2-qb,'#8a8a88')}c.cyl(e[0],L0+1.15-1.6,e[1],.04,3.2,'#d9432f',{rz:1.57,ry:ang});c.fx.push({type:'sign',x:e[0]+Math.cos(ang)*2.4,z:e[1]-Math.sin(ang)*2.4,ang:ang+Math.PI,text:'P-HUS',sub:'spiral til taket'})}
    // --- Byggetomta: gjerde med port, kran, brakke, gjørme, hauger, trappa som ender i lufta ---
    for(let x=SITE.x0;x<SITE.x1-.01;x+=1.9){if(x>16.4&&x<19.2)continue;c.box(x+.95,L0,SITE.z0,1.9,1.0,.03,'#9a9a98');c.box(x+.95,L0,SITE.z1,1.9,1.0,.03,'#9a9a98')}for(let z=SITE.z0;z<SITE.z1-.01;z+=1.3){c.box(SITE.x0,L0,z+.65,.03,1.0,1.3,'#9a9a98');c.box(SITE.x1,L0,z+.65,.03,1.0,1.3,'#9a9a98')}
    c.colliders.push({x:(SITE.x0+16.4)/2,z:SITE.z0,w:16.4-SITE.x0,d:.1,ry:0},{x:(19.2+SITE.x1)/2,z:SITE.z0,w:SITE.x1-19.2,d:.1,ry:0},{x:SITE.x0,z:(SITE.z0+SITE.z1)/2,w:.1,d:SITE.z1-SITE.z0,ry:0},{x:SITE.x1,z:(SITE.z0+SITE.z1)/2,w:.1,d:SITE.z1-SITE.z0,ry:0},{x:(SITE.x0+SITE.x1)/2,z:SITE.z1,w:SITE.x1-SITE.x0,d:.1,ry:0});
    c.fx.push({type:'sign',x:15.6,z:21.3,ang:0,text:'RIVNING PÅGÅR',sub:'hjelm påbudt'});
    {const kx=11.6,kz=27.6;c.cyl(kx,L0,kz,.17,9,'#f2c230');c.box(kx+2.6,L0+9,kz,6.4,.3,.3,'#f2c230');c.box(kx-1.4,L0+9,kz,2.6,.3,.3,'#f2c230');c.box(kx+.5,L0+8.3,kz,.7,.7,.7,'#2c4a6b');c.cyl(kx+4.8,L0+6.2,kz,.015,2.8,'#3a3a3a');c.box(kx+4.8,L0+5.9,kz,.5,.3,.5,'#5a5a58');c.colliders.push({x:kx,z:kz,r:.3,anchor:true,y:L0+.7});P.push({x:kx+3,y:L0+9.3,z:kz,kind:'post'},{x:kx+5.5,y:L0+9.3,z:kz,kind:'post'})}
    c.building(18.3,L0,27.3,2.4,1.0,1.2,'#e9e6df',Math.PI,{fh:1.0,roofBox:false,plinth:'#2c4a6b'});
    c.pond(13.4,27.2,1.0,.16,{fill:.55,mud:true,bed:S.MUD});rock(19.1,26.7,1.1,.8,{surf:S.SAND,sharp:.7,nz:.1});
    c.stairs(11,24,Math.PI/2,8,.18,.55,2.0,{level:L0,land:1.0,wall:true,wallCol:'#9a4a3a',wallH:1.1});
    shape(17.45,24,Math.PI/2,2.1,2.0,(a,b)=>a<-.75?1.19:Math.max(0,1.19*(1-(a+.75)/1.7)),S.GRAVEL,(a,b)=>a<-.75?'#8d8a84':mix('#8a7a66','#a89a86',G.noise(a*3,b*3)),L0);   // brukket kant og rasbakke ned på sandhaugen
    for(const[cx,cz]of[[16.3,22.9],[17,22.7],[19.6,22.8],[11.6,26.1],[16,25.9]])c.cone(cx,cz);c.barrier(14.6,22.8,0);c.barrier(19.6,26.0,Math.PI/2);
    for(const rz of[26.3,27.0])log(14.9,rz,16.9,rz,.2,S.ROCK,()=>'#8e8e8a');c.box(11.5,L0,25.6,.6,.5,.4,'#d9432f');c.steam(11.5,25.6,L0+.5,.3);
    // --- lykter: Ringveien, Havnegata, Kaiveien, promenaden, Øvre gate, Smauet, parken ---
    const lamps=[[-9,-16.4],[-4,-16.4],[1,-16.4],[6,-16.4],[10.5,-16.4],[-13.4,-12.5],[-13.4,-7],[-13.4,.3],[-9,5.3],[3.2,5.3],[9,5.3],[14.3,-11.8],[17.6,-19.3],[23,-19.6],[28,-16.4],[31.5,-16.5],
      [14.3,-20.5],[13.8,-24],[8.6,-30.2],[2,-33.6],[-5,-33],[-9.6,-30],[-3.6,13.6],[1,13.3],[11.3,13.4],[4.3,15.5],[7.7,17.9],[-5,22],[1,24],[-4,32.5],[-15.5,-.5],[-18.5,-4.5],[-27.5,7],[-21.5,17.5],[-12.6,23.2],[-25.8,22.8],[-31,-13],[-17,-32.3],[-10,-20],[9.6,21.4],[28.3,-13.9],[33,-19.8],[-4.5,26.5]];
    for(const[lx,lz]of lamps)c.lamp(lx,lz,{ang:Math.atan2(-lx,-(lz+4))});
    // --- flyplassen (js/plane.js tegner flyet, vindposen og ser etter den blå ruta) ---
    c.road(AIRVEI,{hw:1.3,blend:2,surf:S.ASPHALT});
    cellsIn(AIR.x0,AIR.z0,AIR.x1,AIR.z1,(k,px,pz)=>{if(inR(RWY,px,pz))setC(k,mix('#3a3d40','#45484b',G.noise(px*2,pz*2)));else if(inR(APRON,px,pz)||inR(CPAD,px,pz))setC(k,mix('#8a8a86','#9a9994',G.noise(px*2,pz*2)));else if(rectIn(AIR,px,pz,.6)>.5)setC(k,mix('#6f9a48','#7fa852',G.noise(px*.6,pz*.6)))});
    {const cx=(RWY.x0+RWY.x1)/2,y=AIRH+.004;for(let z=RWY.z0+5;z<RWY.z1-4;z+=3.2)c.box(cx,y,z,.18,.012,1.6,'#f4f4f0');   // midtlinja
      for(const zz of[RWY.z0+1.2,RWY.z1-1.2])for(let k=-3;k<=3;k++)if(k)c.box(cx+k*.6,y,zz,.3,.012,1.8,'#f4f4f0');            // terskelfeltene i begge ender
      for(let z=RWY.z0;z<=RWY.z1;z+=4)for(const sx of[RWY.x0-.25,RWY.x1+.25])c.cyl(sx,AIRH,z,.06,.12,z<RWY.z0+1||z>RWY.z1-1?'#d9432f':'#fff3c0')}   // kantlys
    // terminalen med vinduer mot plassen, tårnet og hangaren med porten mot rullebanen
    c.box(-38.9,AIRH,-9.5,2.6,1.7,7,'#e9dcb9');c.box(-38.9,AIRH+1.7,-9.5,2.8,.12,7.2,'#3f4a52');c.box(-40.22,AIRH+.55,-9.5,.05,.6,6.2,'#1a262d');c.box(-40.22,AIRH,-9.5,.06,.95,1.2,'#5a6066');
    c.colliders.push({x:-38.9,z:-9.5,w:2.64,d:7.04,ry:0,anchor:true,y:AIRH+.6});
    c.fx.push({type:'sign',x:-40.4,z:-13.6,ang:-Math.PI/2,text:'TRINNVIK LUFTHAVN',sub:'rundflyging over skjærgården',w:2.1});
    c.cyl(-44.5,AIRH,-21,.5,3.2,'#f2e8d0');c.box(-44.5,AIRH+3.2,-21,1.4,.75,1.4,'#1a262d');c.box(-44.5,AIRH+3.95,-21,1.6,.12,1.6,'#d9432f');c.colliders.push({x:-44.5,z:-21,r:.55,anchor:true,y:AIRH+.6});
    c.box(-42.4,AIRH,6.5,5.4,2.3,6,'#8a9096');for(const sd of[-1,1])c.box(-42.4+sd*1.4,AIRH+2.55,6.5,3.0,.1,6.3,'#5a6066',0,{rz:sd*.33});c.box(-45.12,AIRH,6.5,.05,1.9,4.4,'#3a3f44');c.box(-45.15,AIRH+1.95,6.5,.07,.12,4.6,'#e5a92b');
    c.colliders.push({x:-42.4,z:6.5,w:5.44,d:6.04,ry:0,anchor:true,y:AIRH+.6});
    c.cyl(-55.4,AIRH,-6,.04,1.7,'#e9e6df');c.colliders.push({x:-55.4,z:-6,r:.08});c.colliders.push({x:-43.6,z:-8.4,r:1.3});   // vindposen, flyet
    c.box(-41.8,AIRH+.004,-12.9,1.9,.012,1.6,'#2f6fd6');   // den blå ruta: parker her, så får du spørsmålet
    c.fx.push({type:'sign',x:-44.6,z:-15.4,ang:Math.PI,text:'FLYPLASS',sub:'kjør inn på den blå ruta'});
    for(const[lx,lz]of[[-37.6,-17.5],[-37.6,-2],[-46.8,-1]])c.lamp(lx,lz,{ang:Math.atan2(-lx-42,-(lz+9))});
    // lasteflyet står sør på rullebanen med nesa mot nord og rampa ned på plassen bak (c.cargoPlane, js/plane.js tegner det); veien dit går fra oppstillingsplassen
    c.road([[-44.6,-15],[-46.6,-26],[-47.4,-34.5],[-49.6,-38.4]],{hw:1.2,bench:false,surf:S.ASPHALT});
    const CG=c.cargoPlane((RWY.x0+RWY.x1)/2,-24.6,0,AIRH);c.fx.push({type:'sign',x:-44.4,z:-33.6,ang:-Math.PI/2,text:'LASTEFLY',sub:'kjør opp rampa'});
    c.airportDef={x:-42.5,z:-9,y:AIRH,ask:{x:-41.8,z:-12.9},plane:{x:-43.6,z:-8.4,yaw:-Math.PI/2},sock:{x:-55.4,z:-6},rwy:RWY,cargo:CG,
      route:[...AIRVEI.slice(1).map(p=>({x:p[0],z:p[1]})),{x:-41.8,z:-12.9}],from:{x:AIRVEI[0][0],z:AIRVEI[0][1]}};
    // --- gullmutterne ---
    c.secret(25.6,-5.3,'På taket av P-huset');c.secret(BOWL[0],BOWL[1],'Bunnen av Bollen');c.secret(1,30.5,'Utsikten');c.secret(AMF[0],AMF[1],'På scenen i Amfiet');c.secret(-7,-38.6,'Ytterst på moloen');
    c.finish();
    c.plants();   // bytrærne
    c.props();
    c.pebbles(300,['#8a847a','#a49d90'],.04,.1);c.tufts(70,['#5d8a3a','#7aa048']);c.shells(140);
  }}
);
})();
