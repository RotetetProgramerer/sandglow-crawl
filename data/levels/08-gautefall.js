// Gautefall: vinterøya med skianlegg (120 × 120). Fjellet står midt på øya med et flatt platå på toppen. Fjellveien går fra
// landsbyen ved kaia i sør opp til parkeringsplassen ved bunnstasjonen. Kjør inn på parkeringsplassen, og du får stå på ski:
// stolheisen tar deg til toppen, og fire nedfarter går ned til målområdet over parkeringen. Bilen har tre løyper på øya.
//   node tools/test-levels.js gautefall      (bilen kjører løypene, og en autopilot på ski kjører nedfartene)
(function(){
const DEG=Math.PI/180;
const smt=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const lineD=(L,x,z)=>{let m=1e9;for(let i=0;i<L.length-1;i++){const a=L[i],b=L[i+1],ex=b[0]-a[0],ez=b[1]-a[1],L2=ex*ex+ez*ez||1e-9;let t=((x-a[0])*ex+(z-a[1])*ez)/L2;t=t<0?0:t>1?1:t;m=Math.min(m,Math.hypot(x-a[0]-ex*t,z-a[1]-ez*t))}return m};
// ---------- fjellet ----------
const C=[0,6], TOP=13, PLAT=4.2, RM=31;                           // toppen, platået (radius) og foten
const rC=(x,z)=>Math.hypot(x-C[0],z-C[1]), aC=(x,z)=>Math.atan2(z-C[1],x-C[0])/DEG;
const polC=(r,d)=>[C[0]+r*Math.cos(d*DEG),C[1]+r*Math.sin(d*DEG)];
// fjellsiden er en jevn kjegle (ca. 25°) som runder av mot platået og flater ut mot foten
const PROF=(()=>{const n=200,s=[],h=[0];for(let i=0;i<=n;i++){const u=i/n;s.push(smt(u/.12)*smt((1-u)/.3))}for(let i=1;i<=n;i++)h.push(h[i-1]+(s[i-1]+s[i])/2);const tot=h[n];return h.map(v=>1-v/tot)})();
const mount=r=>{if(r<=PLAT)return 1;const u=(r-PLAT)/(RM-PLAT);if(u>=1)return 0;const f=u*200,i=Math.floor(f);return PROF[i]+(PROF[i+1]-PROF[i])*(f-i)};
const isl=(x,z)=>{const a=Math.atan2(z,x);return 39+2.5*Math.sin(3*a+.7)+1.5*Math.sin(5*a+2)};
// ---------- stedene ----------
const PARK=[0,-21.5], PARK_R=4.2;                                   // parkeringsplassen ved bunnstasjonen
const LIFT_A=[0,-18.2], LIFT_B=[0,2.4];                              // stolheisen: bunnstasjonen og toppstasjonen
const LAKE=[-25,-12], LAKE_R=6.5;                                    // Isvannet
const VIL=[14.5,-34.5];                                              // landsbyen og kaia
// ---------- nedfartene (start oppe på platåkanten, mål over parkeringsplassen) ----------
// gates: portene (den siste er målet). Slalåmløypa svinger gjennom portene, de andre har brede kontrollporter.
// Familiebakken: tre lange slake strekk i sikksakk på vestsiden, med god avstand så skrenten mellom dem ikke blir en vegg.
// Sørenden av hvert strekk holder seg øst for heisen.
const GREEN=(()=>{const L=[],n=3,r0=5,r1=23.4,A=r=>-Math.min(66,Math.acos(Math.min(1,4.4/r))/DEG),B=4;
  for(let i=0;i<n;i++)for(let s=0;s<6;s++){const u=s/6,r=r0+(r1-r0)*(i+u)/n,f=i%2?B:A(r),t=i%2?A(r):B;L.push(polC(r,f+(t-f)*(.5-.5*Math.cos(u*Math.PI))))}
  L.push(polC(r1,A(r1)));return L})();
// Slalåmbakken: tolv porter som svinger fra side til side ned sørvestsiden
const SLALOM=(()=>{const L=[polC(4.7,-138)],n=9;for(let i=1;i<=n;i++){const u=i/n,r=4.7+u*17.6,d=-124-38*u+(i<n?(i%2?1:-1)*1.1/r/DEG:0);L.push(polC(r,d))}return L})();
const PISTES=[
 {id:'fri',name:'Familiebakken',kind:'fri',diff:1,color:1,hw:1.9,desc:'Slake svinger i sikksakk ned vestsiden. Fin for å lære å svinge.',par:[22,27],
  path:GREEN,gates:[GREEN[3],GREEN[9],GREEN[15],GREEN[GREEN.length-1]],blend:2},
 {id:'slalom',name:'Slalåmbakken',kind:'slalom',diff:2,color:2,hw:2.4,desc:'Røde og blå porter på skrå ned sørøstsiden. Bom koster 5 sekunder.',par:[13,17],tilt:0,
  path:SLALOM,gates:SLALOM.slice(1)},
 {id:'utfor',name:'Utforløypa',kind:'utfor',diff:3,color:3,hw:2.2,desc:'Fra toppen i en lang bue over hele nordsiden. Bratt, rask og med is i svingene og kuler før mål. Kjører du for fort inn i en isete sving, sklir du ut.',par:[5.8,7.4],
  path:[polC(4.6,22),polC(6.5,42),polC(8.5,62),polC(10.5,82),polC(12.5,100),polC(14.5,116),polC(16.5,128),polC(18.5,138),polC(20.6,146),polC(23,150)],
  gates:[polC(8.5,62),polC(12.5,100),polC(16.5,128),polC(23,150)],ice:[[.3,.38],[.62,.7]],nets:true,moguls:[.8,.93]},
 {id:'hopp',name:'Big Jumps',kind:'hopp',diff:3,color:4,hw:2.4,desc:'Ned østsiden med tre store hopp. Snurr i lufta med ← og →, men land med skiene rett fram.',par:[650,350],
  path:[polC(4.6,184),polC(9,183),polC(13.5,181),polC(18,179),polC(22.5,178.5),polC(26,179),polC(27.6,179.5)],
  gates:[polC(13.5,181),polC(22.5,178.5),polC(27.6,179.5)],jumps:[.22,.5,.77]},
];
// ---------- bilens løyper ----------
const CH=[
 {id:'isvann',name:'Isvannet',diff:2,gates:8,desc:'Rundt og over det islagte vannet. Nesten ikke grep: rolig på gassen og styr tidlig.',
  path:[[-19.5,-14],[-22,-17.5],[-27,-18],[-30.5,-14],[-30,-8.5],[-26,-6],[-21.5,-8],[-23,-12],[-27,-12.5]],hw:1.3,bench:false},
 {id:'skog',name:'Granskogen',diff:1,gates:8,desc:'Snødekt skogsvei mellom tunge grantrær på vestsiden av øya.',
  path:[[13,-24],[20,-24],[27,-19],[31,-11],[30,-3],[26,3],[21,1]],surf:S.SNOW,hw:1.3},
 {id:'nord',name:'Nordkysten',diff:2,gates:10,desc:'Langs kysten på nordsiden av fjellet, der vinden har blåst isen blank.',
  path:[[-33.5,4],[-33,14],[-27,24],[-17,31],[-5,35],[6,34],[17,29],[25,21],[29,11]],surf:S.SNOW,hw:1.3},
];
const ROADS=[
 [[8.2,-20.4],[5.5,-21],[3.6,-21.3]],                                // landsbyveien inn på parkeringsplassen
 [[-3.6,-21.4],[-9,-19.5],[-14,-17],[-17,-15]],                      // vestover til Isvannet
 [[6,-24.5],[10,-25],[13,-24]],                                      // østover til Granskogen
 [[-19,-16],[-29,-4],[-33.5,4]],                                     // fra Isvannet nordover til kysten
];

LEVELS.push(
{ id:'gautefall', name:'Gautefall', diff:2, seed:2602, size:120, coast:42, world:true,
  desc:'Vinterøya med skianlegg på toppen. Kjør opp til parkeringsplassen, ta stolheisen og stå på ski ned fire nedfarter.',
  start:[2.5,-25,0],
  sky:['#5a8fcf','#e3edf5'], fog:0xe4ecf2, fogNear:30, fogFar:120, sun:0xfff4e4, sunI:1.0, hemi:[0xeaf1f8,0x8a96a3,.72], sunDir:[-16,20,-14], rockCol:'#6f7378',
  water:.3, waterCol:'#2c6a86', waterOpacity:.86, beachSurf:S.GRAVEL,
  snow:true, precip:(x,z)=>.35+.65*smt((14-rC(x,z))/8), wind:true, ambience:'jungle',
  biome:(x,z)=>{const R=Math.hypot(x,z);return{snow:.35+.65*smt((22-rC(x,z))/10),beach:smt((R-(isl(x,z)-9))/5),jungle:0,swamp:0,desert:0}},
  path:[[2.5,-25],[4,-23],[2.5,-21],[1,-23],[2.5,-25]], challenges:CH, roads:ROADS, airport:{at:[-38,0],dir:180,end:1,road:[[-30,-12]],ground:'snow'}, village:{at:VIL,snow:true},
  pistes:PISTES, skiAt:[LIFT_A[0],LIFT_A[1]-1.7], lift:{from:LIFT_A,to:LIFT_B},
  mapLabels:[[0,7,'Toppen'],[0,-24.5,'Parkering'],[-25,-12,'Isvannet'],[26,-11,'Granskogen'],[0,33,'Nordkysten'],[17,-37,'Kaia'],[-16,8,'Big Jumps'],[13,-2,'Familiebakken'],[-11,-4,'Slalåmbakken'],[-3,21,'Utforløypa']],
  animals:{eagle:C,deer:[{at:[22,-14],r:6,n:3},{at:[-20,20],r:7,n:3}],rabbits:[{at:[-12,-24],r:6,n:4},{at:[24,8],r:5,n:3}],gulls:{at:[16,-38],n:6}},
  base(x,z,n){const r=rC(x,z),R=Math.hypot(x,z),ri=isl(x,z);
    let h=1.05+.45*fbm(n,x*.04,z*.04,3)*smt((r-14)/10)+.06*fbm(n,x*.35,z*.35,2);
    h+=(TOP-1.05)*mount(r*(1+.04*(n(x*.07,z*.07)-.5)));
    h+=.5*fbm(n,x*.09+3,z*.09,3)*smt((r-PLAT-1)/4)*smt((RM-r)/6);       // rygger og søkk i fjellsiden
    h-=2.4*smt((R-ri+2)/4);                                             // havet
    {const d=Math.hypot(x-LAKE[0],z-LAKE[1]);const f=smt((LAKE_R+3-d)/3);h+=(1.15-h)*f}   // Isvannet: flatt
    return h},
  surf(x,z,n){const r=rC(x,z),R=Math.hypot(x,z),ri=isl(x,z);
    if(Math.hypot(x-LAKE[0],z-LAKE[1])<LAKE_R)return S.ICE;
    if(R>ri-6)return n(x*.5,z*.5)>.55?S.ROCK:S.GRAVEL;
    if(r<RM-6&&r>PLAT+2&&n(x*.6+11,z*.6)>.74)return S.ROCK;           // stein som stikker opp av snøen
    return S.SNOW},
  build(c){const R=c.rng;
    // --- platået på toppen, parkeringsplassen og bunnstasjonen ---
    c.flat(C[0],C[1],PLAT+.4,TOP,2.6);
    const ph=H(PARK[0],PARK[1]);c.flat(PARK[0],PARK[1]+.8,PARK_R+1.2,ph,3.5);
    for(let x=-4;x<=4;x+=.5)for(let z=-3.2;z<=3.2;z+=.5)paint(PARK[0]+x,PARK[1]+z-.4,.42,S.ASPHALT);
    // --- veiene og bilens løyper ---
    for(const r of ROADS)c.road(r,{hw:1.4,blend:2,surf:S.GRAVEL});
    for(const ch of CH)c.course(ch);
    // --- nedfartene: preparert, med hopp i Big Jumps ---
    const K={};for(const p of PISTES){const k=K[p.id]=c.piste(p);if(p.jumps)p.jumps.forEach((t,i)=>c.kicker(k,t,{h:.6+i*.08,len:2.3,land:5.2,drop:.9+i*.1}));if(p.moguls)c.moguls(k,p.moguls[0],p.moguls[1],{h:.09})}
    c.flat(C[0],C[1],PLAT-.4,TOP,1.6);
    c.lift(LIFT_A,LIFT_B,{span:5});
    // --- parkeringsplassen: oppmerking, biler, billettluke og skistativ ---
    for(let i=-3;i<=3;i++){const x=PARK[0]+i*1.15,z=PARK[1]-2.2;c.box(x+.575,Math.min(H(x+.575,z-.8),H(x+.575,z+.8))+.002,z,.06,.012,1.6,'#f4f4f0')}
    for(const[x,col]of[[-2.9,'#c8463a'],[-.6,'#4f7bb5'],[1.7,'#e9dcb9'],[2.9,'#3a3a3a']]){const z=PARK[1]-2.2;c.box(x,ph,z,.9,.42,1.7,col);c.box(x,ph+.42,z+.1,.8,.3,.9,'#1a262d');c.box(x,ph+.72,z+.1,.82,.05,.92,'#f1f5f8');c.colliders.push({x,z,w:.92,d:1.72,ry:0,anchor:true,y:ph+.4})}
    {const bx=PARK[0]+3.4,bz=PARK[1]+1.4;c.box(bx,ph,bz,1.3,1.1,1.0,'#b0533a');c.box(bx,ph+1.1,bz,1.5,.14,1.2,'#eef2f6');c.box(bx-.66,ph+.5,bz,.03,.35,.6,'#1a262d');c.colliders.push({x:bx,z:bz,w:1.32,d:1.02,ry:0,anchor:true,y:ph+.5})}
    for(let i=0;i<4;i++){const x=PARK[0]-3.6+i*.32,z=PARK[1]+1.2;c.box(x,ph,z,.04,.7,.08,['#d9432f','#2f6fd6','#f2c230','#3fae3a'][i])}c.box(PARK[0]-3.1,ph+.35,PARK[1]+1.2,1.4,.05,.12,'#5a6066');
    c.fx.push({type:'sign',x:LIFT_A[0]+2.2,z:LIFT_A[1]-1.4,ang:Math.PI,text:'SKIHEIS',sub:'kjør inn på den blå ruta'});c.box(LIFT_A[0],ph+.004,LIFT_A[1]-1.7,1.9,.012,1.6,'#2f6fd6');
    c.fx.push({type:'sign',x:7.5,z:-22.8,ang:Math.PI*.6,text:'GAUTEFALL',sub:'skisenter · parkering'});
    // --- toppstua: kafé med flaggstang på nordkanten av platået, ute av syne når du står i starten ---
    {const tx=-.4,tz=8.9;c.box(tx,TOP,tz,2.6,1.2,1.8,'#8a4a2e');c.box(tx,TOP+1.2,tz,2.9,.16,2.1,'#eef2f6');for(const s of[-.7,.7])c.box(tx+s,TOP+.45,tz-.91,.45,.35,.03,'#ffe3a0');c.colliders.push({x:tx,z:tz,w:2.64,d:1.84,ry:0,anchor:true,y:TOP+.5});c.steam(tx+.9,tz+.4,TOP+1.5,.3)
      c.cyl(-2.6,TOP,9.2,.04,2.4,'#d8d8d8');c.box(-2.25,TOP+2.1,9.2,.6,.38,.02,'#c8463a');c.colliders.push({x:-2.6,z:9.2,r:.08})}
    c.fx.push({type:'sign',x:-1.2,z:5.6,ang:Math.PI,text:'GAUTEFALL',sub:'toppen · 4 nedfarter'});
    // --- pistemaskinen parkert ved Familiebakken før mål, løypekartet ved toppstasjonen og snøkanoner som blåser inn over Familiebakken og Slalåmbakken ---
    {const k=K.fri,t=.9,q=k.P(t),sv=k.side(t),tn=k.T(t),at=sd=>[q.x+sv.x*sd*(k.hw+1.7),q.z+sv.z*sd*(k.hw+1.7)],sd=Math.abs(H(...at(1))-H(q.x,q.z))<Math.abs(H(...at(-1))-H(q.x,q.z))?1:-1;c.groomer(...at(sd),Math.atan2(-tn.x,-tn.z))}
    c.trailMap(1.6,4.4,Math.PI);
    for(const[id,t,sd]of[['fri',.22,1],['fri',.58,-1],['slalom',.35,1],['slalom',.72,-1]]){const k=K[id],q=k.P(t),sv=k.side(t),x=q.x+sv.x*sd*(k.hw+1.1),z=q.z+sv.z*sd*(k.hw+1.1);c.snowgun(x,z,Math.atan2(-sv.x*sd,-sv.z*sd)+.5*sd)}
    // --- steiner og grantrær utenfor løypene ---
    for(let i=0;i<70;i++){const x=(R()-.5)*76,z=(R()-.5)*76,rr=.5+R()*1.1;if(Math.hypot(x,z)>isl(x,z)-6||c.dist(x,z)<rr+2.6||!c.free(x,z,rr+.5)||rC(x,z)<PLAT+1.5||Math.hypot(x-LAKE[0],z-LAKE[1])<LAKE_R+2)continue;rock(x,z,rr,.25+R()*.5,{ang:R()*6.3,ax:1+R()*.5,surf:S.ROCK});if(rr>.9)c.anchor(x,z)}
    for(let i=0;i<3200&&c.spruceList.length<520;i++){const x=(R()-.5)*80,z=(R()-.5)*80,r=rC(x,z),hh=H(x,z);
      if(Math.hypot(x,z)>isl(x,z)-7||r<PLAT+3||hh>TOP-2.4||c.dist(x,z)<3.2||!c.free(x,z,.6)||Math.hypot(x-LAKE[0],z-LAKE[1])<LAKE_R+1.4||Math.hypot(x-PARK[0],z-PARK[1])<PARK_R+3)continue;
      const dens=.25+.75*smt((hh-2)/2)*smt((TOP-3-hh)/3)+(x>12&&z<5?.5:0);if(R()>dens)continue;c.spruce(x,z,{h:1.3+R()*1.8*(1-smt((hh-8)/4)*.5)})}
    // --- gullmutterne ---
    c.secret(-.4,10.6,'Bak toppstua');c.secret(-25,-12,'Midt på Isvannet');{const p=polC(16,140);c.secret(p[0],p[1],'Under fjellveggen i nordøst')}c.secret(30,-6,'Dypt i granskogen');c.secret(LIFT_A[0]+1.6,LIFT_A[1]+2.6,'Bak bunnstasjonen');
    c.dressPistes();
    c.finish();
    c.spruces();
    // --- tundraens planter og dyr (data/vegetasjon.js, data/dyr.js): dvergbjørk og myrull rundt Isvannet, isbjørn på nordkysten ---
    const low=(x,z)=>rC(x,z)>PLAT+4&&Math.hypot(x-LAKE[0],z-LAKE[1])>LAKE_R+.6;
    c.sow('arktis_myrull',12,LAKE,LAKE_R+5,{r:.2,gap:1,ok:low});
    c.sow('arktis_dvergbjork',24,[0,0],34,{r:.3,gap:2.5,ok:low,p:R=>({host:R()})});
    c.sow('arktis_isbjorn',1,[0,29],6,{r:1.4,ok:low});
    c.sow('arktis_fjellrev',3,[0,0],32,{r:.25,gap:12,ok:low,p:R=>({vinter:R()<.8?1:.2})});
    c.sow('arktis_snougle',3,[0,0],32,{r:.4,gap:12,ok:low,p:R=>({hunn:R()<.5?1:0})});
    c.props();
    c.pebbles(220,['#5f6368','#7a7f84'],.04,.1);
  }}
);
})();
