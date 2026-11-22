// Racerøya: øya med racerbanen (120 × 120). En asfaltert racerbane midt på øya med tribune, depot og startportal, palmer og hvite strender rundt.
// Kjør inn på den blå ruta foran depotet, så kommer spørsmålet «Vil du kjøre race?». JA: bildet skifter til racet sett ovenfra
// (js/race.js og js/racesim.js, banene i data/racer.js). Banerunden er en vanlig løype med porter rundt den samme asfaltbanen.
// Husk: på øyene er +x vest og +z nord.
//   node tools/test-levels.js racer      (øya)
//   node tools/test-race.js              (racene sett ovenfra)
(function(){
const DEG=Math.PI/180;
const smt=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const isl=(x,z)=>{const a=Math.atan2(z,x);return 39+2.2*Math.sin(3*a+.4)+1.4*Math.sin(5*a+2.1)};
// ---------- stedene ----------
// racerbanen: en lukket runde. Startrettstrekningen går langs sørsiden (fra øst mot vest, +x er vest), tribunen står sør for den og depotet nord for den.
const CIRC=[[-16,-7],[-4,-7.5],[8,-7.5],[18,-6],[24,0],[23.5,8],[17,12],[10,10],[4,13],[2,19],[-6,23],[-16,21],[-23,14],[-25,4],[-22,-3]];
const HW=2.2;                                                      // halve bredden av asfalten
const STAND=[7,-11.6], STAND_W=13;                                  // tribunen
const PIT=[3,-1.6], PIT_W=12;                                       // depotet
const ASK=[-6.5,-3.9];                                              // den blå ruta foran depotet
const GANTRY=-1;                                                    // startportalen over banen (x)
const VA=232*DEG, VIL=(()=>{const r=isl(Math.cos(VA),Math.sin(VA))-1.6;return[Math.cos(VA)*r,Math.sin(VA)*r]})();
const VROAD=[VIL[0]-Math.cos(VA)*16,VIL[1]-Math.sin(VA)*16];        // der veien ut av landsbyen slutter
// a closed Catmull-Rom curve through CIRC, so the asphalt is round in the corners
const loop=(()=>{const P=CIRC,n=P.length,out=[];const cr=(a,b,c,d,t)=>.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
  for(let i=0;i<n;i++){const a=P[(i-1+n)%n],b=P[i],c=P[(i+1)%n],d=P[(i+2)%n];for(let k=0;k<6;k++){const t=k/6;out.push([cr(a[0],b[0],c[0],d[0],t),cr(a[1],b[1],c[1],d[1],t)])}}return out})();
const lineD=(L,x,z)=>{let m=1e9;for(let i=0;i<L.length-1;i++){const a=L[i],b=L[i+1],ex=b[0]-a[0],ez=b[1]-a[1],L2=ex*ex+ez*ez||1e-9;let t=((x-a[0])*ex+(z-a[1])*ez)/L2;t=t<0?0:t>1?1:t;m=Math.min(m,Math.hypot(x-a[0]-ex*t,z-a[1]-ez*t))}return m};
const LOOPC=[...loop,loop[0]];
// ---------- løypene ----------
const CH=[
 {id:'banerunden',name:'Banerunden',diff:1,gates:10,desc:'Én runde på asfalten, gjennom portene. Raskt og jevnt: høyt gir og sving tidlig, så holder du farten gjennom svingene.',
  path:loop.slice(0,loop.length-2),surf:S.ASPHALT,hw:HW,blend:2},
 {id:'strand',name:'Palmestranda',diff:2,gates:10,desc:'Langs den hvite stranda i nord, mellom palmene og opp over sanddynene. Mykt underlag: hold farten oppe.',
  path:[[26,22],[20,27.5],[13,31],[5,33.5],[-3,34],[-11,32.5],[-18,30],[-25,26],[-30,20],[-33,13]],hw:1.3,bench:false},
];
const ROADS=[
 [VROAD,[-11,-13],[-8,-10.5],[-4,-9.6]],                            // fra landsbyen til startrettstrekningen
 [[18,-8.5],[24,-12],[30,-15]],                                     // fra banen til flyplassveien
 [[24.5,12],[26,17],[26,22]],                                       // fra banen til Palmestranda
 [[-25,15],[-29,17],[-33,13]],                                      // fra Palmestranda tilbake til banen
];

LEVELS.push(
{ id:'racer', name:'Racerøya', diff:1, seed:2424, size:120, coast:42, world:true,
  desc:'Øya med racerbanen. Parker på den blå ruta foran depotet, og kjør race mot fem andre, sett ovenfra. Sladd i svingene for å få turbo.',
  start:[VROAD[0]+1.5,VROAD[1]+1,60*DEG],
  sky:['#4a92d8','#d8ecf6'], fog:0xd6e8f0, fogNear:36, fogFar:125, sun:0xfff4dc, sunI:1.25, hemi:[0xdcecff,0x7a8a5a,.62], sunDir:[-14,24,-10], rockCol:'#a09a8a',
  water:.3, waterCol:'#2f9ac0', waterOpacity:.8,
  grassCol:['#4f9a3a','#6ab04a'], dirtCol:['#b89a6a','#c8aa78'],
  ambience:'jungle', wind:true,
  biome:(x,z)=>{const R=Math.hypot(x,z);return{jungle:.3,swamp:0,beach:smt((R-(isl(x,z)-9))/5),snow:0,desert:.1}},
  path:[[VROAD[0]+1.5,VROAD[1]+1],[VROAD[0]+3,VROAD[1]+2.5],[VROAD[0]+4.5,VROAD[1]+1],[VROAD[0]+3,VROAD[1]-.5],[VROAD[0]+1.5,VROAD[1]+1]],
  racePath:[VROAD,[-11,-13],[-8,-10.5],[-6.5,-7.5]],                // bare for testen: fra landsbyveien over startrettstrekningen til den blå ruta
  challenges:CH, roads:ROADS, airport:{at:[40.5,-3],dir:0,end:-1,road:[[30,-15]]}, village:{at:VIL,dir:VA/DEG},
  mapLabels:[[0,6,'Racerbanen'],[STAND[0],STAND[1]-2.5,'Tribunen'],[PIT[0],PIT[1]+2.2,'Depot'],[0,31,'Palmestranda'],[VIL[0]+3,VIL[1]-1,'Kaia']],
  animals:{gulls:{at:[VIL[0]+4,VIL[1]+2],n:6},crabs:8,crabsAt:[0,34],butterflies:20,parrots:6},
  base(x,z,n){const R=Math.hypot(x,z),ri=isl(x,z);
    let h=1.05+.22*fbm(n,x*.045,z*.045,3)+.04*fbm(n,x*.3,z*.3,2);
    h+=.6*smt((z-26)/6)*(.5+.5*n(x*.15,z*.15))*smt((ri-R-3)/4);       // småbakker bak stranda i nord
    {const d=lineD(LOOPC,x,z);h=h+(1.1-h)*smt((HW+6-d)/4)}            // banen og plassen rundt den er flat
    h-=2.4*smt((R-ri+2)/4);                                             // havet
    return h},
  surf(x,z,n){const R=Math.hypot(x,z),ri=isl(x,z);
    if(R>ri-6)return S.SAND;
    const d=lineD(LOOPC,x,z);if(d<HW+1.6&&d>HW)return S.GRAVEL;       // grus langs asfaltkanten
    if(z>26&&n(x*.3,z*.3)>.45)return S.SAND;
    return S.GRASS},
  build(c){const R=c.rng;
    // --- veiene, løypene og resten av runden (Banerunden stopper rett før start, så asfalten lukkes her) ---
    for(const r of ROADS)c.road(r,{hw:1.35,blend:2,surf:S.DIRT,skip:S.ASPHALT});
    for(const ch of CH)c.course(ch);
    c.road(loop.slice(loop.length-3).concat([loop[0],loop[1]]),{hw:HW,blend:2,surf:S.ASPHALT});
    // depotgata: en asfaltstripe mellom banen og depotet
    c.road([[-10,-4.2],[0,-4.4],[12,-4.4]],{hw:1.1,blend:1.5,surf:S.ASPHALT});
    const y0=H(0,-7.5);
    // --- startportalen over banen: to stolper, en bjelke og fem røde lys ---
    {const x=GANTRY,z=-7.5,y=H(x,z),L=HW+.7;for(const sd of[-1,1]){c.box(x,y,z+sd*L,.24,2.5,.24,'#3a3a3c');c.colliders.push({x,z:z+sd*L,r:.2,anchor:true,y:y+1})}
      c.box(x,y+2.4,z,.32,.36,2*L+.3,'#2a2a2c');c.box(x+.17,y+2.47,z,.02,.22,2*L-.6,'#f2e8d0');
      for(let i=0;i<5;i++)c.box(x-.18,y+2.46,z-1+i*.5,.04,.2,.2,'#ff2a1a');
      c.fx.push({type:'sign',x:x,z:z-L-1.2,ang:Math.PI,text:'START · MÅL',sub:'Racerøya',w:1.6})}
    // --- tribunen sør for startrettstrekningen: trinn med publikum i alle farger, tak og flagg ---
    {const[sx,sz]=STAND,y=H(sx,sz)-.05,W=STAND_W;c.block(sx,sz,W/2+1.5);
      for(let r=0;r<5;r++){const zz=sz-r*.55,hh=.25+r*.32;c.box(sx,y,zz,W,hh,.6,r%2?'#9a9a96':'#86867f');
        for(let i=0;i<W/.32-1;i++){if(R()<.22)continue;const px=sx-W/2+.25+i*.32;c.box(px,y+hh,zz+.05,.16,.18+R()*.06,.14,['#d9432f','#f2e8d0','#2f6fd6','#e5a92b','#8bbb4a','#14120E','#b05ad0'][Math.floor(R()*7)]);c.box(px,y+hh+.22,zz+.05,.1,.1,.1,'#e8c8a0')}}
      c.box(sx,y,sz-2.65,W,2.4,.12,'#5a5a5c');for(const sd of[-1,1])c.box(sx+sd*W/2,y,sz-1.1,.12,2.4,3.2,'#5a5a5c');
      for(const dx of[-W/2,-W/6,W/6,W/2])c.cyl(sx+dx,y,sz+.35,.06,2.7,'#3a3a3c');c.box(sx,y+2.7,sz-1.1,W+.4,.08,3.4,'#d9432f',0,{rx:-.08});
      for(let i=0;i<6;i++){const fx=sx-W/2+1+i*(W-2)/5;c.cyl(fx,y+2.7,sz+.3,.025,.7,'#cfcfcf');c.box(fx-.18,y+3.15,sz+.3,.36,.22,.02,['#d9432f','#E5A92B','#2f6fd6','#8bbb4a','#f2e8d0','#14120E'][i])}
      c.colliders.push({x:sx,z:sz-1.1,w:W+.3,d:3.3,ry:0,anchor:true,y:y+1});
      c.fx.push({type:'sign',x:sx-W/2-1.4,z:sz+.4,ang:Math.PI,text:'TRIBUNEN',sub:'Racerøya grand prix',w:1.6})}
    // --- depotet nord for banen: en lang hvit bygning med garasjeporter i alle farger, og den blå ruta foran ---
    {const[px,pz]=PIT,y=H(px,pz);c.block(px,pz,PIT_W/2+1);c.building(px,y,pz,PIT_W,1.3,2.4,'#e8e4da',Math.PI,{roof:'#3a3a3c'});
      for(let i=0;i<6;i++){const gx=px-PIT_W/2+1+i*(PIT_W-2)/5;c.box(gx,y,pz-1.22,1.2,.95,.04,['#d9432f','#2f6fd6','#8bbb4a','#f2c230','#b05ad0','#E5A92B'][i])}
      c.box(px,y+1.3,pz-1.25,PIT_W*.5,.36,.06,'#14120E');c.fx.push({type:'sign',x:px+PIT_W/2+1.6,z:pz-.6,ang:Math.PI,text:'DEPOT',sub:'racerbiler · dekk · bensin',w:1.6});
      // dekkstabler og en bensinpumpe ved portene
      for(const[dx,dz]of[[-4.6,-2],[4.4,-2.1]]){for(let k=0;k<3;k++)c.cyl(px+dx,y+k*.16,pz+dz,.22,.15,'#1a1a1a');c.colliders.push({x:px+dx,z:pz+dz,r:.26})}
      c.box(px+PIT_W/2-.6,y,pz-2,.34,.62,.26,'#d9432f');c.colliders.push({x:px+PIT_W/2-.6,z:pz-2,r:.24})}
    // the blue square: park here and you are asked whether you want to race (js/race.js)
    {const[ax,az]=ASK,y=H(ax,az);c.box(ax,y+.004,az,1.9,.012,1.6,'#2f6fd6');c.block(ax,az,1.5);
      c.fx.push({type:'sign',x:ax-2,z:az+1.4,ang:Math.PI*.75,text:'RACERLØP',sub:'kjør inn på den blå ruta',w:1.5});c.raceDef={ask:{x:ax,z:az}}}
    // --- dekkstabler på yttersiden av svingene, og rødt og hvitt på kantene ---
    for(let i=0;i<loop.length;i++){const a=loop[(i-1+loop.length)%loop.length],b=loop[i],d=loop[(i+1)%loop.length],ang=Math.atan2(d[1]-b[1],d[0]-b[0])-Math.atan2(b[1]-a[1],b[0]-a[0]),k=Math.atan2(Math.sin(ang),Math.cos(ang));
      if(Math.abs(k)<.18)continue;const tx=d[0]-a[0],tz=d[1]-a[1],L=Math.hypot(tx,tz),nx=-tz/L,nz=tx/L,sg=k>0?-1:1,ry=Math.atan2(tx,tz);
      for(const s of[-1,1]){const o=s*(HW+.18);c.box(b[0]+nx*o,H(b[0]+nx*o,b[1]+nz*o)-.01,b[1]+nz*o,.24,.04,Math.min(1.4,L/2.2),i%2?'#d9332a':'#f2f0e8',ry)}
      const ox=b[0]+nx*sg*(HW+2.6),oz=b[1]+nz*sg*(HW+2.6);if(c.free&&!c.free(ox,oz,.4))continue;
      for(let k2=0;k2<2;k2++)c.cyl(ox,H(ox,oz)+k2*.16,oz,.24,.15,k2?'#d9432f':'#1a1a1a');c.colliders.push({x:ox,z:oz,r:.28})}
    c.fx.push({type:'sign',x:VROAD[0]+2.2,z:VROAD[1]-1.4,ang:Math.PI*.7,text:'RACERØYA',sub:'racerbanen rett fram',w:1.6});
    // --- gullmutterne ---
    for(const[x,z,l]of[[0,8,'Midt inne på banen'],[STAND[0]+STAND_W/2+1.2,STAND[1]-2.4,'Bak tribunen'],[-30,24,'Ytterst på Palmestranda'],[24,22,'Mellom palmene i nordvest'],[PIT[0]-PIT_W/2-1.2,PIT[1]+.8,'Bak depotet']]){c.secret(x,z,l);c.block(x,z,1.3)}
    c.finish();
    // --- palmer langs stranda og rundt banen, busker inne på banen ---
    const land=(x,z)=>Math.hypot(x,z)<isl(x,z)-6.5&&lineD(LOOPC,x,z)>HW+3;
    c.sow('palme',40,[0,26],14,{r:.3,gap:2.2,ok:land,p:R=>({h:2.2+R()*2,kokos:Math.floor(R()*4)})});
    c.sow('palme',26,[0,0],34,{r:.3,gap:3,ok:(x,z)=>land(x,z)&&Math.hypot(x,z)>isl(x,z)-12,p:R=>({h:2+R()*1.8})});
    c.sow('palme',8,[-2,8],7,{r:.3,gap:2.5,ok:land,p:R=>({h:2.4+R()*1.4})});
    c.sow('subtrop_agave',14,[0,6],11,{r:.45,gap:2.5,ok:land,p:R=>({s:.8+R()*.5})});
    c.props();
    c.tufts(140,['#5a9a3a','#7ab04a','#4a8a32']);c.pebbles(300,['#bdb6a6','#d2cbbb','#a59e90'],.04,.12);c.shells(120);
  }}
);
})();
