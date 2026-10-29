// Kameløya: ørkenøya (120 × 120). Store sanddyner i vest og sør der du kan kjøre fort og hoppe over kammene, oasen midt på øya,
// beduinleiren med telt og kameler, en karavane som går rundt på øya, Sandsteinsfjellet i øst og ruinbyen med den lille pyramiden i sørøst.
// Inne i fjellet ligger Diamantgrotten (js/grotte.js, data/grotte.js): kjør inn i den smale kløfta fra vest, og helt inn i den mørke åpningen,
// så ser du bilen fra siden som i Hill Climb Racing. Husk: på øyene er +x vest og +z nord.
// Dynene: vinden blåser fra nord, så dynene har en slak side mot nord og en bratt side mot sør. Kjør sørover i høy gir og hopp over kammen.
//   node tools/test-levels.js orken
(function(){
const DEG=Math.PI/180;
const smt=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const lineD=(L,x,z)=>{let m=1e9;for(let i=0;i<L.length-1;i++){const a=L[i],b=L[i+1],ex=b[0]-a[0],ez=b[1]-a[1],L2=ex*ex+ez*ez||1e-9;let t=((x-a[0])*ex+(z-a[1])*ez)/L2;t=t<0?0:t>1?1:t;m=Math.min(m,Math.hypot(x-a[0]-ex*t,z-a[1]-ez*t))}return m};
const isl=(x,z)=>{const a=Math.atan2(z,x);return 40.5+2*Math.sin(3*a+1.1)+1.3*Math.sin(5*a+.3)};
// ---------- stedene ----------
const OAS=[5,5], OAS_R=4.2;                                        // oasen
const CAMP=[-9,19];                                               // beduinleiren
const MAS=[-20,-8], MAS_TOP=4.2;                                   // Sandsteinsfjellet: midten og hvor høyt platået er
const masR=(x,z)=>{const a=Math.atan2(z-MAS[1],x-MAS[0]);return 8.6+1.1*Math.sin(3*a+.5)+.6*Math.sin(5*a+2)};
const SLOT=[[-10.2,-11.8],[-12.6,-10.9],[-15,-11.3],[-17.2,-10.4],[-18.6,-9.6]], SLOT_W=1.35;   // den smale kløfta inn til grotten (fra vest)
const MOUTH=SLOT[SLOT.length-1];                                   // grotteåpningen innerst i kløfta
const RAMPS=[[[-17.6,10.2],[-19.6,-.4]],[[-20.6,-25.5],[-21.6,-15.6]]];   // veiene opp på fjellet fra nord og fra sør (fra foten til toppen)
const RUIN=[-10,-26], PYR=[-3,-31.5];                              // ruinbyen og den lille pyramiden
const BIGD=[30,-3];                                                // Kjempedynen
const VA=84*DEG, VIL=(()=>{const r=isl(Math.cos(VA),Math.sin(VA))-1.6;return[Math.cos(VA)*r,Math.sin(VA)*r]})();
const VROAD=[VIL[0]-Math.cos(VA)*16,VIL[1]-Math.sin(VA)*16];       // der veien ut av landsbyen slutter
// dynene: rygger på tvers av nordavinden, med en slak side mot nord og en bratt skredside mot sør. Ingen dyner nær oasen, kaia eller stranda
const duneMask=(x,z)=>{const R=Math.hypot(x,z),dO=Math.hypot(x-OAS[0],z-OAS[1]);
  const west=smt((x-4)/7)*(1-smt((z-24)/6)),south=smt((-z-19)/5)*smt((x+7)/5)*(1-smt((7-Math.hypot(x-PYR[0],z-PYR[1]))/4));
  return Math.max(west,south)*smt((dO-9)/4)*smt((isl(x,z)-R-6)/5)};
// t grows southwards: the gentle side up to a sharp crest (where the car takes off), then the slip face, steepest at the top and flattening out
// at the bottom like the landing slope of a ski jump, so you land softly on the way down
const duneH=(x,z,n)=>{const m=duneMask(x,z);if(m<=0)return 0;const P=10,wob=1.3*Math.sin(x*.15+.6)+.6*Math.sin(x*.37+2)+1.6*(n(x*.05,z*.05)-.5);
  const ph=(z+wob)/P,t=1-(ph-Math.floor(ph)),rise=.56,p=t<rise?Math.pow(t/rise,1.4):Math.pow(1-(t-rise)/(1-rise),1.6);
  return(1.4+1.0*n(x*.035+7,z*.035))*m*p};
const bigDune=(x,z)=>{const d=Math.hypot(x-BIGD[0],z-BIGD[1]);if(d>9)return 0;const a=Math.atan2(z-BIGD[1],x-BIGD[0]);return 5*smt(1-d/(8+.8*Math.sin(3*a)))};
const mesa=(x,z,n)=>{const d=Math.hypot(x-MAS[0],z-MAS[1]),r=masR(x,z);let h=MAS_TOP*smt((r-d)/1.3)+.25*smt((r-1.5-d)/2)*(n(x*.4,z*.4)-.4);
  for(const[A,B]of RAMPS){const ex=B[0]-A[0],ez=B[1]-A[1],L2=ex*ex+ez*ez;let t=((x-A[0])*ex+(z-A[1])*ez)/L2;if(t<-.1||t>1.08)continue;const tc=Math.max(0,Math.min(1,t)),lat=Math.hypot(x-A[0]-ex*tc,z-A[1]-ez*tc);
    h=Math.max(h,MAS_TOP*tc*smt((2.6-lat)/1.4))}
  return h};
// ---------- løypene ----------
const CARAVAN=[[1,22],[-4,13.5],[-8,8],[-3,1.5],[5,-3],[12,1],[13,9],[9,15.5]];   // karavanens runde
const DUNEPATH=[[21,25],[20.6,19.5],[20.2,14],[19.6,8.5],[19.8,3],[20.2,-2.5],[19.6,-8],[18.8,-13.5],[17.6,-19],[15.6,-24.5]];
// across the dune course the ground is level (the height of the dunes on the line itself), so the car goes straight over the crests
// instead of leaning on a slope and rolling; along the course the dunes keep their shape
const nearLine=(L,x,z)=>{let m=1e9,bx=0,bz=0;for(let i=0;i<L.length-1;i++){const a=L[i],b=L[i+1],ex=b[0]-a[0],ez=b[1]-a[1],L2=ex*ex+ez*ez||1e-9;let t=((x-a[0])*ex+(z-a[1])*ez)/L2;t=t<0?0:t>1?1:t;
  const px=a[0]+ex*t,pz=a[1]+ez*t,d=Math.hypot(x-px,z-pz);if(d<m){m=d;bx=px;bz=pz}}return{d:m,x:bx,z:bz}};
const CH=[
 {id:'karavane',name:'Karavanestien',diff:1,gates:10,desc:'Følg karavaneveien rundt oasen, forbi beduinleiren og palmene. Hold avstand til kamelene: de går ikke av veien for deg.',
  path:[[-9,6],[-6,0],[-1,-3.5],[6,-5.5],[12,-2],[14.5,5],[12.5,12],[6,15],[0,14.5],[-4,11]],surf:S.DIRT,hw:1.3},
 {id:'dyner',name:'Dynehoppet',diff:2,gates:10,desc:'Rett sørover over Dynehavet i høy gir. Kjør opp den slake siden av dynene og hopp over kammen. Lander du skjevt, velter du.',
  path:DUNEPATH,bench:false,hw:1.3},
 {id:'fjellet',name:'Fjellstien',diff:3,gates:10,desc:'Opp den bratte veien til Sandsteinsfjellet, over det steinete platået og ned mot ruinbyen. Lavt gir opp, forsiktig ned.',
  path:[[-15.5,15],[-17.2,10.5],[-18.6,4.5],[-19.8,-.8],[-21.8,-4.4],[-23.2,-8.6],[-22.8,-12.6],[-21.6,-16],[-21,-21],[-20.4,-25.5],[-19.4,-30.5]],hw:1.3,blend:1.4},
];
const ROADS=[
 [VROAD,[1,19],[-1.5,14],[-2,9.5]],                                // fra landsbyen ned mot oasen
 [[-1.5,14],[-4.5,16.6],[-6,17.6]],                                // til beduinleiren
 [[-12,17.2],[-15.5,15]],                                          // fra leiren til Fjellstien
 [[-2,7],[-5,3],[-8.5,5.2]],                                       // fra oasen til Karavanestien
 [[10.5,7],[14,13],[17.5,20],[21,25]],                              // fra oasen til starten på Dynehoppet
 [[15.6,-24.5],[9,-26.5],[3,-26],[-1,-24],[-4.5,-26]],            // fra målet på Dynehoppet til ruinbyen
];

LEVELS.push(
{ id:'orken', name:'Kameløya', diff:2, seed:4419, size:120, coast:42, world:true,
  desc:'Ørkenøya med kameler, beduiner og store sanddyner du kan hoppe på. Et sted inne i fjellet skal det ligge en hemmelig grotte full av diamanter.',
  start:[VROAD[0]+1,VROAD[1]+2.5,195*DEG],
  sky:['#4f90d4','#f6e2b6'], fog:0xf0dcb0, fogNear:40, fogFar:130, sun:0xfff0d0, sunI:1.4, hemi:[0xfff0d0,0xb88a58,.66], sunDir:[-16,26,-8], rockCol:'#b0704a',
  water:.3, waterCol:'#3f9aa0', waterOpacity:.82,
  grassCol:['#5f8a34','#86a648'], dirtCol:['#b48a58','#c99e66'],    // grønt gress i oasen, hardtråkket sand på stiene
  ambience:'jungle', wind:true,
  biome:(x,z)=>{const R=Math.hypot(x,z),dO=Math.hypot(x-OAS[0],z-OAS[1]);return{jungle:.12+.6*smt((10-dO)/5),swamp:.5*smt((7-dO)/3),beach:smt((R-(isl(x,z)-9))/5),snow:0,desert:1-smt((10-dO)/5)}},
  path:[[VROAD[0]+1,VROAD[1]+2.5],[VROAD[0]+2.5,VROAD[1]+4],[VROAD[0]+4,VROAD[1]+2.5],[VROAD[0]+2.5,VROAD[1]+1],[VROAD[0]+1,VROAD[1]+2.5]],
  challenges:CH, roads:ROADS, village:{at:VIL,dir:VA/DEG,desert:true},
  cavePath:[[-6.2,-11.4],...SLOT],                                    // bare for testen: inn kløfta til grotteåpningen
  get mapLabels(){const L=[[OAS[0],OAS[1]+5.5,'Oasen'],[CAMP[0],CAMP[1]+3,'Beduinleiren'],[13,-8,'Dynehavet'],[BIGD[0],BIGD[1]+6,'Kjempedynen'],[MAS[0],MAS[1]+10,'Sandsteinsfjellet'],
      [RUIN[0],RUIN[1]-4.5,'Ruinbyen'],[VIL[0]+3,VIL[1]-1,'Kaia']];
    if(typeof prof!=='undefined'&&prof.cave&&prof.cave.found)L.push([MOUTH[0]+4,MOUTH[1]-3.5,'Diamantgrotten']);return L},
  animals:{
    camels:[{at:[OAS[0]+7,OAS[1]-3],r:4,n:4},{at:[CAMP[0]-1,CAMP[1]-4.5],r:2.5,n:2},{at:[18,-24],r:5,n:3}],
    caravan:{path:CARAVAN,n:4,speed:.6},
    lizards:[{at:MAS,r:13,n:6},{at:RUIN,r:6,n:4}], vultures:{at:RUIN,n:4,r:6}, gulls:{at:[VIL[0]-2,VIL[1]+2],n:5}},
  base(x,z,n){const R=Math.hypot(x,z),ri=isl(x,z),dO=Math.hypot(x-OAS[0],z-OAS[1]),dR=Math.hypot(x-RUIN[0],z-RUIN[1]);
    let h=1.05+.3*fbm(n,x*.045,z*.045,3)+.05*fbm(n,x*.35,z*.35,2)+.02*Math.sin(x*2.3+z*.7+6*n(x*.08,z*.08));   // flat sand with small wind ripples
    {let dh=duneH(x,z,n);const q=nearLine(DUNEPATH,x,z);if(q.d<3.2){const k=smt((q.d-1.5)/1.7);dh=duneH(q.x,q.z,n)*(1-k)+dh*k}h+=dh+bigDune(x,z)}
    h-=.55*smt((10-dO)/5);                                              // oasen ligger i en grunn senkning
    h=h+(1.1-h)*smt((8-dR)/3);                                          // ruinbyen: jevn sand
    h=Math.max(h,1.05+mesa(x,z,n));
    // kløfta: en smal renne gjennom fjellsiden, med bunnen i samme høyde som sanden utenfor
    {const d=lineD(SLOT,x,z);if(d<SLOT_W+1.4){const floor=1.05+.04*n(x*2,z*2);h=h*smt((d-SLOT_W)/1.4)+floor*(1-smt((d-SLOT_W)/1.4))}}
    h-=2.4*smt((R-ri+2)/4);                                             // havet
    return h},
  surf(x,z,n){const R=Math.hypot(x,z),ri=isl(x,z),dO=Math.hypot(x-OAS[0],z-OAS[1]),dM=Math.hypot(x-MAS[0],z-MAS[1]);
    if(R>ri-6)return S.SAND;
    if(dO<OAS_R+3.2)return dO<OAS_R+1.2?S.MUD:S.GRASS;
    if(dO<OAS_R+5&&n(x*.7,z*.7)>.45)return S.GRASS;
    if(lineD(SLOT,x,z)<SLOT_W+.2)return S.GRAVEL;
    if(dM<masR(x,z)+.4)return S.REDROCK;
    if(dM<masR(x,z)+2.5&&n(x*.9,z*.9)>.5)return S.GRAVEL;
    return S.SAND},
  build(c){const R=c.rng;
    // --- veiene og løypene ---
    for(const r of ROADS)c.road(r,{hw:1.3,blend:2,surf:S.DIRT});
    for(const ch of CH)c.course(ch);
    // --- oasen: dammen, palmene, sivet og brønnen ---
    c.pond(OAS[0],OAS[1],OAS_R,.75,{bed:S.MUD});c.block(OAS[0],OAS[1],OAS_R+1);
    c.fx.push({type:'sign',x:OAS[0]-5.8,z:OAS[1]-4.2,ang:Math.PI*.25,text:'OASEN',sub:'drikkevann for kameler'});
    // --- beduinleiren: telt, bål med kaffekanne, kameler som ligger og beduiner rundt bålet ---
    {const[cx,cz]=CAMP,ch=H(cx,cz);c.flat(cx,cz,4,ch,2.5);c.block(cx,cz,4.8);
      c.plant('orken_telt',cx-1.5,cz+2.2,{retning:-Math.PI/2,s:1.15});c.plant('orken_telt',cx+2.6,cz+1.2,{retning:-Math.PI/2-.5});c.plant('orken_telt',cx-3.6,cz-.8,{retning:-.3,s:.9});
      c.cyl(cx,ch,cz,.3,.05,'#4a4440');for(let i=0;i<7;i++){const a=i*.9;c.box(cx+Math.cos(a)*.34,ch+.05,cz+Math.sin(a)*.34,.13,.09,.11,'#7a7470',a)}c.steam(cx,cz,ch+.1,.22);   // bålet
      c.cyl(cx+.18,ch+.06,cz+.05,.06,.12,'#c9a03a');c.cyl(cx+.18,ch+.18,cz+.05,.035,.06,'#c9a03a');                                                                   // kaffekanna (dallah)
      for(const[a,f]of[[.4,0],[1.9,1],[3.3,2],[4.6,3]]){c.plant('orken_beduin',cx+Math.cos(a)*1.05,cz+Math.sin(a)*1.05,{sitter:1,retning:a+Math.PI,farge:f})}
      c.plant('orken_kamel',cx+3.6,cz-2.6,{ligger:1,retning:2.4,last:1});c.plant('orken_kamel',cx+1.4,cz-3.4,{ligger:1,retning:1.9});c.plant('orken_kamel',cx-2.8,cz-3.1,{retning:.6,last:1});
      c.box(cx-1.2,ch,cz-1.9,.9,.03,.6,'#b8342a',.4);c.box(cx-1.2,ch+.02,cz-1.9,.7,.02,.4,'#e5a92b',.4);   // et teppe ute
      c.fx.push({type:'sign',x:cx+3.2,z:cz+3.8,ang:Math.PI*.9,text:'BEDUINLEIREN',sub:'velkommen · ahlan wa sahlan',w:1.5})}
    // en beduin som vinker ved veien inn fra kaia
    c.plant('orken_beduin',VROAD[0]-1.9,VROAD[1]-1.5,{vinker:1,retning:-.6,farge:3});
    // --- Sandsteinsfjellet: kløfta inn til grotten, steiner rundt foten og på platået ---
    // langs veggene i kløfta: kollidere, så bilen holder seg på bunnen; to store steinblokker skjuler inngangen
    for(let i=0;i<SLOT.length-1;i++){const a=SLOT[i],b=SLOT[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),tx=(b[0]-a[0])/L,tz=(b[1]-a[1])/L;
      for(let d=0;d<L;d+=.8){const x=a[0]+tx*d,z=a[1]+tz*d;for(const sd of[-1,1])c.colliders.push({x:x-tz*sd*(SLOT_W+.55),z:z+tx*sd*(SLOT_W+.55),r:.4})}}
    c.block(MOUTH[0],MOUTH[1],3);for(const p of SLOT)c.block(p[0],p[1],SLOT_W+1);
    for(const[x,z,r,h]of[[-9.3,-14.2,1.5,1.6],[-9.6,-9.2,1.25,1.3],[-7.4,-13.9,.8,.8]]){rock(x,z,r,h,{ang:R()*6,ax:1.2,sharp:.3,nz:.25,surf:S.REDROCK});c.anchor(x,z)}
    // the cave: drive to the end of the slot (mouth, within r) and the side view begins (js/grotte.js). dir points into the rock,
    // open is the dark opening in the cliff, out is where you come back out, back the back door on the east side of the mountain
    {const a=SLOT[SLOT.length-2],L=Math.hypot(MOUTH[0]-a[0],MOUTH[1]-a[1]),fx=(MOUTH[0]-a[0])/L,fz=(MOUTH[1]-a[1])/L;
    c.caveDef={mouth:{x:MOUTH[0]+fx*.5,z:MOUTH[1]+fz*.5},r:.75,open:{x:MOUTH[0]+fx*1.45,z:MOUTH[1]+fz*1.45},
      dir:Math.atan2(fx,fz),
      out:{x:SLOT[2][0],z:SLOT[2][1],h:Math.atan2(SLOT[1][0]-SLOT[2][0],SLOT[1][1]-SLOT[2][1])},
      back:{x:MAS[0]-masR(MAS[0]-9,MAS[1]+.5)-3.8,z:MAS[1]+1.8,h:-.35},door:{x:MAS[0]-masR(MAS[0]-9,MAS[1]+.5)+.25,z:MAS[1]+.5}}}
    for(let i=0;i<70;i++){const a=R()*6.28,d=masR(MAS[0]+Math.cos(a)*9,MAS[1]+Math.sin(a)*9)+.5+R()*3.5,x=MAS[0]+Math.cos(a)*d,z=MAS[1]+Math.sin(a)*d,r=.4+R()*1.1;
      if(c.dist(x,z)<r+1.6||!c.free(x,z,r)||lineD(SLOT,x,z)<SLOT_W+1.6+r||Math.hypot(x-c.caveDef.back.x,z-c.caveDef.back.z)<3.5)continue;rock(x,z,r,.4+R()*.9,{ang:R()*6.3,ax:1+R()*.5,sharp:.35,surf:S.REDROCK});if(r>.9)c.anchor(x,z)}
    for(let i=0;i<40;i++){const a=R()*6.28,d=R()*6.5,x=MAS[0]+Math.cos(a)*d,z=MAS[1]+Math.sin(a)*d,r=.3+R()*.6;if(c.dist(x,z)<r+1.5||lineD(SLOT,x,z)<SLOT_W+2.2||!c.free(x,z,r))continue;rock(x,z,r,.25+R()*.4,{ang:R()*6.3,ax:1+R()*.6,sharp:.4,surf:S.REDROCK})}
    // --- ruinbyen: søyler (noen knekt), en mur, falne søyletrommer og den lille pyramiden ---
    {const[rx,rz]=RUIN,y=H(rx,rz),sand='#d8b882',st='#c9a46a';c.block(rx,rz,6);
      const HT=[2.3,2.3,1.1,2.3,.6,1.8,.6,2.3,2.3,1.2];
      for(let i=0;i<10;i++){const sd=i<5?-1:1,k=i%5,x=rx+(k-2)*2.1,z=rz+sd*2.6,ht=HT[i];c.box(x,y-.1,z,.66,.24,.66,st);c.cyl(x,y+.12,z,.26,ht,sand);if(ht>2)c.box(x,y+.12+ht,z,.64,.2,.64,st);c.colliders.push({x,z,r:.38,anchor:true,y:y+.6})}
      c.box(rx-3.15,y+2.62,rz-2.6,2.8,.28,.62,st);c.box(rx+1.05,y+2.62,rz+2.6,2.8,.28,.62,st);   // bjelker som fortsatt ligger over to søyler
      for(const[dx,dz,a]of[[-3,0,.4],[1.5,.8,1.9]]){c.cyl(rx+dx,y-.05,rz+dz,.26,.9,sand,{rz:Math.PI/2,ry:a});c.colliders.push({x:rx+dx,z:rz+dz,r:.45})}   // falne søyletrommer
      c.box(rx+5.6,y-.2,rz+.5,.7,1.3,4.4,st,.1);c.box(rx+5.6,y+1.1,rz-.6,.7,.5,2,st,.1);c.colliders.push({x:rx+5.6,z:rz+.5,w:.8,d:4.5,ry:.1,anchor:true,y:y+.6});   // muren
      c.fx.push({type:'sign',x:rx+3.6,z:rz+4.2,ang:Math.PI*1.1,text:'RUINBYEN',sub:'over 2000 år gammel'})}
    {const[px,pz]=PYR,y=Math.min(H(px,pz),H(px+3,pz+3),H(px-3,pz-3))-.1;c.block(px,pz,5.5);for(let k=0;k<6;k++){const w=6-k*1.0;c.box(px,y+k*.55,pz,w,.55,w,k%2?'#d2b07a':'#c9a46a',.3)}c.box(px,y+3.3,pz,.6,.4,.6,'#e5a92b',.3);
      c.colliders.push({x:px,z:pz,w:6.1,d:6.1,ry:.3,anchor:true,y:y+1})}
    // --- gullmutterne ---
    for(const[x,z,l]of[[BIGD[0],BIGD[1],'På toppen av Kjempedynen'],[OAS[0]+3.4,OAS[1]+5.3,'Under palmene i oasen'],[CAMP[0]-1.5,CAMP[1]+2.6,'Inne i beduinteltet'],
      [RUIN[0],RUIN[1],'Mellom søylene i ruinbyen'],[SLOT[0][0]+.6,SLOT[0][1]-.1,'Ved den smale kløfta']]){c.secret(x,z,l);c.block(x,z,1.2)}
    c.finish();
    // --- palmer, siv og busker ---
    c.sow('palme',14,OAS,OAS_R+4,{r:.3,gap:1.6,ok:(x,z)=>Math.hypot(x-OAS[0],z-OAS[1])>OAS_R+.8,p:R=>({h:2.6+R()*2,kokos:Math.floor(R()*4)})});
    c.sow('palme',5,CAMP,6,{r:.3,gap:2,ok:(x,z)=>Math.hypot(x-CAMP[0],z-CAMP[1])>4.4,p:R=>({h:2.4+R()*1.6})});
    c.sow('palme',4,[VIL[0],VIL[1]-5],7,{r:.3,gap:2.5,p:R=>({h:2.2+R()*1.6})});
    c.plant('orken_bronn',OAS[0]-5,OAS[1]+1.5,{retning:.3});
    c.sow('orken_tornebusk',60,[0,0],36,{r:.2,gap:2.5,ok:(x,z)=>duneMask(x,z)<.5&&Math.hypot(x-MAS[0],z-MAS[1])>masR(x,z)+.5});
    c.sow('orken_tornebusk',8,[SLOT[0][0]+1,SLOT[0][1]],2.5,{r:.15,gap:.7,ok:(x,z)=>lineD(SLOT,x,z)>SLOT_W-.2});   // noen busker skjuler inngangen til kløfta
    c.sow('savanne_knokler',4,[18,-14],12,{r:.3,gap:5});
    c.props();
    // --- småting: gresstuster i oasen, småstein på fjellet, skjell på stranda, siv rundt dammen ---
    c.tufts(80,['#c9b06a','#b8a058','#d8c27c']);c.pebbles(420,['#b8784a','#c98a5a','#a06a42','#d8b88a'],.04,.13);c.shells(90);
    const reeds=[];for(let i=0;i<500&&reeds.length<180;i++){const a=R()*6.28,d=OAS_R-.3+R()*1.4,x=OAS[0]+Math.cos(a)*d,z=OAS[1]+Math.sin(a)*d;if(c.dist(x,z)<1.5)continue;
      reeds.push({x,y:H(x,z)-.02,z,sx:.04,sy:.45+R()*.5,sz:.04,rx:(R()-.5)*.4,rz:(R()-.5)*.4,c:['#5a8a2a','#7a9a3a','#4a7a2a'][i%3]})}
    instanced(DG.tuft,DM.tuft,reeds,c.decor,false);
  }}
);
})();
