// Svalbard: den arktiske øya helt nord i skjærgården (120 × 120), oppkalt etter og inspirert av det ekte Svalbard. Ingen trær, bare snø, is og stein.
// Fargerike hus ved kaia i sør, Skuterutleia rett innenfor, Reindalen midt på øya, Isbjørnbreen i nord med brefront rett i havet,
// Isfjorden i vest med sel ved pustehullene og en isbjørn ute ved iskanten, Gruvefjellet i øst med taubane, radarkupler og frøhvelv,
// og fangsthytta med sledehunder og hvalross i nordvest. Husk: på øyene er +x vest og +z nord.
// Snøskuteren (data/cars.js, js/world.js): kjør inn på den blå ruta ved Skuterutleia. Løypene med skuter:true låner deg en skuter ved start.
// Dyrene som beveger seg, ligger i js/polardyr.js.
//   node tools/test-levels.js svalbard
(function(){
const DEG=Math.PI/180;
const smt=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const lineD=(L,x,z)=>{let m=1e9;for(let i=0;i<L.length-1;i++){const a=L[i],b=L[i+1],ex=b[0]-a[0],ez=b[1]-a[1],L2=ex*ex+ez*ez||1e-9;let t=((x-a[0])*ex+(z-a[1])*ez)/L2;t=t<0?0:t>1?1:t;m=Math.min(m,Math.hypot(x-a[0]-ex*t,z-a[1]-ez*t))}return m};
const isl=(x,z)=>{const a=Math.atan2(z,x);return 40+2*Math.sin(3*a+2.2)+1.2*Math.sin(5*a+.9)};
// ---------- stedene ----------
const GL=[6,26], GL_R=16, GL_H=5;                                   // Isbjørnbreen: midten, radius og hvor høy iskappen er
const CREV=[[[-3.5,24],[-1.5,28],[-1,32]],[[-6.5,26],[-5,30]]];     // bresprekker (øst på breen, unna skuterløypa)
const FJ=[30,-2], FJ_R=10.5, ICE_Y=.44;                             // Isfjorden: islagt, flat og blank
const HOLES=[[28,-5.8],[32.5,-3.2],[29,3]];                         // pustehullene til selene
const MT=[-22,2], MT_TOP=4.5;                                       // Gruvefjellet: et platåfjell med bratte vegger
const mtR=(x,z)=>{const a=Math.atan2(z-MT[1],x-MT[0]);return 8.6+.9*Math.sin(3*a+1.3)+.5*Math.sin(5*a+.4)};
const RAMPS=[[[-7.5,-10.8],[-16.5,-2.9]],[[-11.2,18.1],[-17.9,8.2]]];   // gruveveien opp fra sør og ned mot nord (fra foten til platåkanten)
const PORT=[-22,-7.1];                                              // gruveinngangen i sørveggen
const SENTRAL=[-17.5,-30];                                          // taubanesentralen ved sjøen
const VAULT=[-12.1,3];                                              // frøhvelvet i vestveggen
const HUT=[28,15];                                                  // fangsthytta
const RENT=[7.5,-18.5], ASK=[7.5,-17.7];                                  // Skuterutleia og den blå ruta
const VA=-94*DEG, VIL=(()=>{const r=isl(Math.cos(VA),Math.sin(VA))-1.6;return[Math.cos(VA)*r,Math.sin(VA)*r]})();
const VROAD=[VIL[0]-Math.cos(VA)*16,VIL[1]-Math.sin(VA)*16];       // der veien ut av landsbyen slutter
const HUB=[-1,-16];                                                 // veikrysset innenfor landsbyen
// breen: en slak snøbakke opp fra sør, og en bratt isvegg mot havet i nord
const glH=(x,z,n)=>{const dz=z-GL[1],d=Math.hypot(x-GL[0],dz);if(d>=GL_R)return 0;const s=dz/(d||1),w=15-12.6*smt((s-.05)/.55);
  return GL_H*smt((GL_R-d)/w)*(1+.06*(n(x*.25,z*.25)-.5))};
const glMask=(x,z)=>smt((GL_R+1-Math.hypot(x-GL[0],z-GL[1]))/1.5);
const mesa=(x,z,n)=>{const d=Math.hypot(x-MT[0],z-MT[1]),r=mtR(x,z);let h=MT_TOP*smt((r-d)/1.3)+.3*smt((r-1.5-d)/2)*(n(x*.4,z*.4)-.4);
  for(const[A,B]of RAMPS){const ex=B[0]-A[0],ez=B[1]-A[1],L2=ex*ex+ez*ez;let t=((x-A[0])*ex+(z-A[1])*ez)/L2;if(t<-.1||t>1.6)continue;const tc=Math.max(0,Math.min(1,t)),lat=Math.hypot(x-A[0]-ex*tc,z-A[1]-ez*tc);
    h=Math.max(h,MT_TOP*tc*smt((2.6-lat)/1.4))}
  return h};
// ---------- løypene ----------
const CH=[
 {id:'safari',name:'Skutersafari',diff:1,gates:12,skuter:true,desc:'En lang runde med snøskuter gjennom Reindalen og over viddene i sørvest. Du får låne en skuter ved start. Reinsdyrene går unna, bare du ikke kjører rett på dem.',
  path:[[4.5,-13],[6,-6],[6.5,1],[7.5,6],[11,9.5],[15,9.5],[18,6.5],[18.5,1.5],[17.5,-4],[16,-9],[16.5,-13.5],[20,-17.5],[21,-22.5],[19.1,-27.1],[14.5,-29],[9.9,-27.1],[8.3,-24.5]],surf:S.SNOW,hw:1.4},
 {id:'breen',name:'Breløpet',diff:2,gates:10,skuter:true,desc:'Med snøskuter opp på Isbjørnbreen, en runde oppe på iskappen og ned igjen med to hopp. Blåisen er glatt, og nordkanten av breen er et stup rett i havet.',
  path:[[0,7],[.5,12],[1.5,17],[3,22],[3.5,27],[5.2,31],[9,32.6],[12.8,31],[14.5,27],[13.5,22.5],[11.5,18.5],[11.5,15],[14.5,13],[18,13],[21.5,13]],surf:S.SNOW,hw:1.4,blend:2.2},
 {id:'fjord',name:'Fjordisen',diff:2,gates:9,desc:'Med bil over den blanke isen på Isfjorden, rundt pustehullene til selene. Nesten ikke grep: styr tidlig og vær rolig på gassen. Isbjørnen ute ved iskanten følger med.',
  path:[[21.5,-7],[25,-9.5],[29.5,-9.8],[32,-6.5],[32.2,-.5],[32,5.5],[27,6.2],[23.5,2.5],[25,-2.5],[29.2,-1.4]],bench:false,hw:1.3},
 {id:'gruva',name:'Gruveveien',diff:3,gates:10,desc:'Med bil opp den bratte gruveveien til radarkuplene på Gruvefjellet, over platået og ned nordsiden. Lavt gir opp, forsiktig ned.',
  path:[[-4,-13.5],[-7.5,-10.8],[-12,-6.8],[-16.5,-2.9],[-19.3,-.2],[-20.9,2.8],[-20.6,4.9],[-19.3,6.1],[-17.9,8.2],[-14.5,13.2],[-11.2,18.1],[-7,19.5]],surf:S.GRAVEL,hw:1.3,blend:1.4},
];
const ROADS=[
 [VROAD,[-1.2,-19],HUB],                                           // fra landsbyen til veikrysset
 [HUB,[2.5,-17.1],[5,-17.7],ASK],                                            // til Skuterutleia
 [HUB,[1,-10],[1.5,-3],[.5,4],[0,7]],                              // Reindalen nordover til brefoten
 [HUB,[-2.6,-14.4],[-4,-13.5]],                                    // til starten på Gruveveien
 [[1,-10],[3,-12.2],[4.5,-13]],                                    // til starten på Skutersafari
 [[1.5,-3],[8,-4.2],[15,-6],[21.5,-7]],                            // vestover til Isfjorden
 [[24,8.8],[25.6,12.2],[27,13.2]],                                 // fra fjorden til fangsthytta
 [[21.5,13],[24.5,13.4],[27,13.2]],                                // fra målet på Breløpet til fangsthytta
 [[-7,19.5],[-4,13.5],[-1,8.5],[0,7]],                             // fra målet på Gruveveien tilbake til dalen
 [[.5,4],[-4.5,3.6],[-8.6,3.2]],                                   // til frøhvelvet
 [[-7.5,-10.8],[-13,-11.6],[-19.2,-10.2]],                         // til gruva
];

LEVELS.push(
{ id:'svalbard', name:'Svalbard', diff:2, seed:7818, size:120, coast:42, world:true,
  desc:'Den arktiske øya helt i nord: bre, islagt fjord, gruvefjell og isbjørner som ikke liker besøk. Lei en snøskuter ved kaia og kjør over viddene.',
  start:[VROAD[0]+1,VROAD[1]+2.5,0],
  sky:['#4577b8','#f6dcc8'], fog:0xe9e4e8, fogNear:34, fogFar:128, sun:0xffe9d2, sunI:1.05, hemi:[0xe2ecf8,0x8c96a8,.74], sunDir:[-22,13,-10], rockCol:'#5f6268',
  water:.3, waterCol:'#27617e', waterOpacity:.88, beachSurf:S.GRAVEL,
  snow:true, precip:(x,z)=>.25+.55*smt((GL_R-Math.hypot(x-GL[0],z-GL[1]))/8), wind:true, ambience:'jungle',
  biome:(x,z)=>{const R=Math.hypot(x,z);return{snow:.8+.2*glMask(x,z),beach:.6*smt((R-(isl(x,z)-9))/5),jungle:0,swamp:0,desert:0}},
  landExtra:(x,z)=>Math.max(glMask(x,z),smt((FJ_R+1.2-Math.hypot(x-FJ[0],z-FJ[1]))/.8)),   // breen og fjordisen går helt ut i havet
  path:[[VROAD[0]+1,VROAD[1]+2.5],[VROAD[0]+2.5,VROAD[1]+4],[VROAD[0]+4,VROAD[1]+2.5],[VROAD[0]+2.5,VROAD[1]+1],[VROAD[0]+1,VROAD[1]+2.5]],
  challenges:CH, roads:ROADS, village:{at:VIL,dir:VA/DEG,snow:true},
  mapLabels:[[VIL[0]+3.5,VIL[1]+1,'Kaia'],[RENT[0]+5,RENT[1]-2.5,'Skuterutleia'],[4,-4,'Reindalen'],[GL[0],GL[1]+3,'Isbjørnbreen'],[FJ[0],FJ[1]-1,'Isfjorden'],
    [MT[0],MT[1]+11.5,'Gruvefjellet'],[VAULT[0]+3.5,VAULT[1]+2.6,'Frøhvelvet'],[HUT[0]+1,HUT[1]+3.4,'Fangsthytta'],[SENTRAL[0]-1,SENTRAL[1]+3.5,'Taubanen']],
  animals:{
    polarbears:[{at:[39,-1.5],r:1.5,n:1},{at:[-14,30],r:4,n:1},{at:[-27,-20],r:4,n:1}],
    reindeer:[{at:[3.5,-2],r:6,n:4},{at:[13,-20],r:6,n:4},{at:[19.5,9],r:4,n:3}],
    seals:[{at:HOLES[0],n:2},{at:HOLES[1],n:2},{at:HOLES[2],n:1}],
    walruses:[{at:[33.6,14.4],r:2.4,n:4}],
    dogs:[0,1,2,3,4].map(i=>[HUT[0]-3.4+i*.75,HUT[1]-2.9-(i%2)*.35,Math.PI+(i-2)*.25]),
    gulls:{at:[VIL[0]+1,VIL[1]-2],n:6}},
  base(x,z,n){const R=Math.hypot(x,z),ri=isl(x,z),dF=Math.hypot(x-FJ[0],z-FJ[1]);
    let h=1.15+.4*fbm(n,x*.045,z*.045,3)+.05*fbm(n,x*.35,z*.35,2);                 // slake snøvidder
    h=Math.max(h,1.15+mesa(x,z,n));                                                // Gruvefjellet
    h+=glH(x,z,n);                                                                 // breen
    {const d=Math.min(lineD(CREV[0],x,z),lineD(CREV[1],x,z));if(d<.75)h-=.38*smt((.75-d)/.45)}   // bresprekkene
    h+=(ICE_Y-h)*smt((FJ_R+2.5-dF)/2.5);                                           // fjordisen: flat, like over vannet
    h-=2.4*smt((R-ri+2)/4)*(1-glMask(x,z));                                        // havet (iskanten på fjorden ligger der øya ellers slutter)
    return h},
  surf(x,z,n){const R=Math.hypot(x,z),ri=isl(x,z),dG=Math.hypot(x-GL[0],z-GL[1]),dM=Math.hypot(x-MT[0],z-MT[1]),mr=mtR(x,z);
    if(Math.hypot(x-FJ[0],z-FJ[1])<FJ_R+.6)return S.ICE;
    if(dG<GL_R){if(Math.min(lineD(CREV[0],x,z),lineD(CREV[1],x,z))<.6)return S.ICE;if(dG>GL_R-3.4&&(z-GL[1])/(dG||1)>.15)return S.ICE;   // sprekkene og brefronten er blå is
      return n(x*.3+4,z*.3)>.68?S.ICE:S.SNOW}                                      // flekker med blåis på breen
    if(dM<mr+.5)return dM>mr-1.7||n(x*.5,z*.5)>.62?S.ROCK:S.SNOW;                  // fjellveggen er bar stein, platået har snø
    if(R>ri-6)return n(x*.5,z*.5)>.55?S.ROCK:S.GRAVEL;                             // strendene: mørk grus og stein
    if(n(x*.22+9,z*.22)>.72)return S.GRAVEL;                                       // rabber der vinden har blåst snøen bort
    return S.SNOW},
  build(c){const R=c.rng,balls=[];
    const ball=(x,y,z,r,col,sy)=>balls.push({x,y,z,sx:r,sy:sy??r,sz:r,c:col});
    // --- veiene og løypene ---
    for(const r of ROADS)c.road(r,{hw:1.4,blend:2,surf:S.SNOW});
    const K={};for(const ch of CH)K[ch.id]=c.course(ch);
    // hopp på vei ned fra breen: en kile av snø med blå kant, som hoppene i skibakken
    const jump=(k,t,h,len)=>{const p=k.P(t),tn=k.T(t),w=1.5;cellsIn(p.x-len-2.5,p.z-len-2.5,p.x+len+2.5,p.z+len+2.5,(kk,px,pz)=>{const rx=px-p.x,rz=pz-p.z,a=rx*tn.x+rz*tn.z,b=Math.abs(rx*tn.z-rz*tn.x);
        if(a<-len||a>0||b>w+1)return;TH[kk]+=h*Math.pow((a+len)/len,1.7)*(b<=w?1:1-smt(b-w));if(a>-.3&&b<=w+.2)setC(kk,'#6fb0e2')});c.block(p.x,p.z,len+2)};
    jump(K.breen,.8,.55,2.6);jump(K.breen,.94,.5,2.4);
    // --- Skuterutleia: hytta, den blå ruta, skutere på rekke, bensinpumpe, veiviser til Nordpolen og en snømann ---
    {const[rx,rz]=RENT,y=H(rx,rz);c.flat(rx+.6,rz-.4,3.8,y,2.6);c.block(rx+.6,rz-.4,4.6);
      c.box(ASK[0],y+.004,ASK[1],1.9,.012,1.6,'#2f6fd6');
      const hx=rx+2.6,hz=rz-2.2;c.box(hx,y,hz,1.9,1.15,1.4,'#b0382e');c.box(hx,y+1.15,hz,2.15,.16,1.65,'#eef2f6');c.box(hx,y,hz+.71,.4,.74,.03,'#3a2a22');c.box(hx-.55,y+.5,hz+.71,.42,.34,.03,'#ffe3a0');
      c.box(hx+.6,y+1.3,hz-.3,.2,.45,.2,'#6b5a52');c.steam(hx+.6,hz-.3,y+1.8,.25);c.colliders.push({x:hx,z:hz,w:1.94,d:1.44,ry:0,anchor:true,y:y+.5});
      [['#d9432f',0],['#2f6fd6',1],['#f2c230',2],['#3fae3a',3]].forEach(([col,i])=>{const x=rx-2.6+i*.95,z=rz-2.9;   // skutere på rekke, med nesen mot nord
        c.box(x,y,z-.2,.28,.14,.9,'#1c1c1c');c.box(x,y+.08,z+.38,.5,.2,.56,col);c.box(x,y+.14,z-.22,.24,.1,.5,'#151515');c.box(x,y+.3,z+.2,.36,.17,.03,'#a8cfe2',0,{rx:-.5});
        for(const sd of[-1,1])c.box(x+sd*.36,y,z+.5,.08,.03,.7,'#222');c.colliders.push({x,z,r:.5})});
      c.cyl(rx+4.1,y,rz-.6,.16,.7,'#d9432f');c.box(rx+4.1,y+.7,rz-.6,.3,.22,.2,'#f4f4f0');c.colliders.push({x:rx+4.1,z:rz-.6,r:.22});
      c.fx.push({type:'sign',x:rx+2.4,z:rz+1.3,ang:-.5,text:'SKUTERUTLEIE',sub:'kjør inn på den blå ruta',w:1.6});
      c.fx.push({type:'sign',x:rx-2.9,z:rz+1.6,ang:-.5,text:'NORDPOLEN',sub:'1309 km · rett fram'});
      // the hire for the game (js/world.js): ask is the blue square, park is where your own car stands while you are out on the snowmobile
      c.skuterDef={ask:{x:ASK[0],z:ASK[1]},park:{x:rx+2.7,z:rz+.3,h:Math.PI/2}};
      const sx=rx-3.5,sz=rz-.9;ball(sx,y+.3,sz,.34,'#f6f9fc');ball(sx,y+.74,sz,.25,'#f6f9fc');ball(sx,y+1.07,sz,.18,'#f6f9fc');   // snømannen
      c.cyl(sx,y+1.2,sz,.15,.03,'#2a2a2a');c.cyl(sx,y+1.23,sz,.1,.16,'#2a2a2a');c.cyl(sx,y+1.03,sz+.2,.025,.16,'#f08a2a',{rx:Math.PI/2});c.box(sx,y+.9,sz,.4,.06,.4,'#c8463a',.4);
      for(const sd of[-1,1]){ball(sx+sd*.07,y+1.12,sz+.16,.022,'#14110e');c.cyl(sx+sd*.42,y+.72,sz,.018,.4,'#5a4330',{rz:sd*1.1})}c.colliders.push({x:sx,z:sz,r:.36})}
    // isbjørnskiltet ved veien inn fra kaia
    c.fx.push({type:'sign',x:VROAD[0]-1.9,z:VROAD[1]+1.5,ang:Math.PI,text:'ISBJØRNFARE',sub:'gjelder hele Svalbard',w:1.5});
    // --- Isfjorden: pustehull, en innefrosset skøyte og isfiske ---
    for(const[x,z]of HOLES){c.cyl(x,ICE_Y+.004,z,.62,.012,'#173f5a');c.cyl(x,ICE_Y+.002,z,.78,.012,'#8fbcd4');c.block(x,z,2.4)}
    {const bx=34.2,bz=2.6,y=ICE_Y;c.box(bx,y-.12,bz,.95,.62,2.7,'#c8463a',.5,{rz:.16});c.box(bx,y+.44,bz,.8,.05,2.4,'#8a6a3a',.5,{rz:.16});c.box(bx-.1,y+.46,bz-.5,.55,.42,.8,'#f2efe6',.5,{rz:.16});
      c.cyl(bx+.25,y+.4,bz+.2,.045,3.1,'#6b5a4a',{rz:-.16});c.colliders.push({x:bx,z:bz,r:1.1,anchor:true,y:y+.6});c.block(bx,bz,2.2)}
    {const fx=24.6,fz=-5.4;c.cyl(fx,ICE_Y+.003,fz,.22,.012,'#173f5a');c.box(fx+.5,ICE_Y,fz+.1,.3,.28,.3,'#3f6fb0');c.cyl(fx+.2,ICE_Y+.25,fz,.012,.75,'#d8c597',{rz:1.2});c.colliders.push({x:fx+.5,z:fz+.1,r:.25})}   // en krakk og en pilkestikke
    c.fx.push({type:'sign',x:21.2,z:-9.4,ang:-Math.PI/2,text:'ISFJORDEN',sub:'isen bærer · stort sett'});
    // --- Gruvefjellet: gruveinngangen, kullvogna, taubanen ned til sjøen, radarkuplene og masten på toppen ---
    {const[px,pz]=PORT,y=H(px,pz-1.4),wood='#5a4330';c.block(px,pz-1.5,3.2);
      c.box(px,y,pz+.2,1.5,1.7,1.4,'#0e0e0e');for(const sd of[-1,1])c.box(px+sd*.82,y,pz-.5,.2,1.9,.22,wood);c.box(px,y+1.9,pz-.5,2.1,.22,.26,wood);c.box(px,y+2.1,pz-.4,2.3,.1,.6,'#eef2f6');
      for(const sd of[-1,1])c.box(px+sd*.3,y+.01,pz-2.4,.05,.04,3.6,'#3a3a3a');for(let i=0;i<6;i++)c.box(px,y,pz-.9-i*.6,.9,.03,.12,wood);     // skinnene
      c.box(px,y+.12,pz-2.6,.62,.42,.9,'#4a4e54');c.box(px,y+.5,pz-2.6,.5,.12,.76,'#141414');for(const dz of[-.3,.3])c.cyl(px,y+.11,pz-2.6+dz,.11,.7,'#222',{rz:Math.PI/2});c.colliders.push({x:px,z:pz-2.6,r:.55});
      c.colliders.push({x:px,z:pz+.2,w:2,d:1.6,ry:0,anchor:true,y:y+.8});
      c.fx.push({type:'sign',x:px+2.6,z:pz-1.6,ang:Math.PI,text:'GRUVE 7',sub:'kull siden 1916'});
      // taubanen: bukker av tømmer, wire og kibber med kull, fra gruva til sentralen
      const Y=y+3.7,A=[px+.4,pz-1.9],B=SENTRAL,L=Math.hypot(B[0]-A[0],B[1]-A[1]),ux=(B[0]-A[0])/L,uz=(B[1]-A[1])/L,ang=Math.atan2(-uz,ux);
      for(const d of[4.6,9.8,15]){const x=A[0]+ux*d,z=A[1]+uz*d,g=H(x,z);for(const sd of[-1,1]){const lx=x-uz*sd*.5,lz=z+ux*sd*.5;c.cyl(lx,g-.1,lz,.07,Y-g+.1,wood);c.colliders.push({x:lx,z:lz,r:.12,anchor:true,y:g+.5})}
        c.cyl(x,Y-.65,z,.06,1.3,wood,{rz:Math.PI/2,ry:ang+Math.PI/2});c.cyl(x,g+(Y-g)*.5-.65,z,.045,1.3,wood,{rz:Math.PI/2,ry:ang+Math.PI/2});c.block(x,z,1.4)}
      c.cyl(A[0]+ux*L/2,Y+.06-L/2,A[1]+uz*L/2,.018,L,'#2a2a2a',{rz:Math.PI/2,ry:ang});
      for(const d of[1.6,6.2,11.6,17.2]){const x=A[0]+ux*d,z=A[1]+uz*d;c.box(x,Y-.36,z,.03,.42,.03,'#2a2a2a');c.box(x,Y-.66,z,.3,.3,.4,'#4a4e54',-ang);c.box(x,Y-.38,z,.24,.05,.32,'#141414',-ang)}
      {const[sx,sz]=B,g=H(sx,sz);c.flat(sx,sz,2,g,2);c.block(sx,sz,3);for(const ax of[-1,1])for(const az of[-1,1])c.cyl(sx+ax*.8,g-.1,sz+az*.8,.09,2.1,wood);
        c.box(sx,g+2,sz,2.3,1.7,2.3,'#6a5a4a');c.box(sx,g+3.7,sz,2.6,.18,2.6,'#eef2f6');c.box(sx,g+2.5,sz+1.16,.5,.5,.03,'#1a262d');c.colliders.push({x:sx,z:sz,r:1.25,anchor:true,y:g+.6})}}
    {const y=1.15+MT_TOP;for(const[x,z,r]of[[-25.6,-2.4,1.15],[-27.2,1.6,.9]]){c.cyl(x,y-.1,z,r*.55,.7,'#8a9098');ball(x,y+.6+r*.75,z,r,'#f4f6f8');c.colliders.push({x,z,r:r*.8,anchor:true,y:y+.5});c.block(x,z,r+1)}
      const mx=-21.4,mz=-4;c.cyl(mx,y-.1,mz,.07,4.2,'#c8463a');for(let i=0;i<3;i++)c.cyl(mx,y+1+i*1.1,mz,.09,.5,'#f4f4f0');c.box(mx,y+3.4,mz,.7,.05,.05,'#8a9098');c.colliders.push({x:mx,z:mz,r:.12,anchor:true,y:y+.5});
      c.box(-24.2,y-.05,.2,1.5,.9,1.1,'#3f6fb0',.5);c.box(-24.2,y+.85,.2,1.7,.12,1.3,'#eef2f6',.5);c.colliders.push({x:-24.2,z:.2,w:1.54,d:1.14,ry:.5,anchor:true,y:y+.4});
      c.fx.push({type:'sign',x:-23,z:-.8,ang:Math.PI/2,text:'SATELLITTSTASJONEN',sub:'snakker med romfartøy',w:1.9})}
    // --- frøhvelvet: en betongkile som stikker ut av fjellveggen, med lysende kunst øverst på fronten ---
    {const[vx,vz]=VAULT,y=H(vx+2.2,vz)-.1;c.block(vx+1,vz,3);
      c.box(vx,y,vz,3.2,2.5,1.15,'#a9adb0');c.box(vx+1.61,y+1.15,vz,.03,1.3,1,'#58e0d8');c.box(vx+1.62,y,vz,.03,1.1,.62,'#6a7078');c.box(vx+.4,y+2.5,vz,2.4,.04,.9,'#58e0d8');
      c.colliders.push({x:vx,z:vz,w:3.24,d:1.2,ry:0,anchor:true,y:y+.8});
      c.fx.push({type:'sign',x:vx+3.2,z:vz+1.9,ang:Math.PI/2,text:'FRØHVELVET',sub:'frø fra hele verden'})}
    // --- fangsthytta: tjæret hytte, fiskehjell, slede, en hvelvet robåt og sledehundene (js/polardyr.js) ---
    {const[hx,hz]=HUT,y=H(hx,hz);c.flat(hx,hz-.6,3.6,y,2.6);c.block(hx,hz-.6,4.6);
      c.box(hx,y,hz,2.3,1.1,1.6,'#3e3028');c.box(hx,y+1.1,hz,2.6,.16,1.9,'#eef2f6');c.box(hx+.4,y,hz-.81,.42,.74,.03,'#7a2a22');c.box(hx-.55,y+.48,hz-.81,.36,.3,.03,'#ffe3a0');
      c.box(hx-.8,y+1.2,hz+.3,.22,.5,.22,'#6b5a52');c.steam(hx-.8,hz+.3,y+1.75,.28);c.colliders.push({x:hx,z:hz,w:2.34,d:1.64,ry:0,anchor:true,y:y+.5});
      const jx=hx+3,jz=hz-1.2;for(const sd of[-1,1]){c.cyl(jx+sd*.9,y-.1,jz,.04,1.4,'#6b5a4a');c.colliders.push({x:jx+sd*.9,z:jz,r:.08})}c.cyl(jx,y+1.25-.95,jz,.03,1.9,'#6b5a4a',{rz:Math.PI/2});   // fiskehjellen
      for(let i=0;i<7;i++)c.box(jx-.72+i*.24,y+.92,jz,.05,.3,.1,'#c9b99a');
      c.box(hx-2.4,y+.12,hz-2,.5,.05,1.5,'#8a6a3a',.3);for(const sd of[-1,1])c.box(hx-2.4+sd*.22,y,hz-2,.04,.12,1.6,'#5a4330',.3);c.box(hx-2.4,y+.17,hz-2.1,.4,.2,.7,'#b0a898',.3);   // sleden med last
      c.box(hx+3.1,y,hz+1.6,.7,.3,1.8,'#2f5a7a',.9);c.colliders.push({x:hx+3.1,z:hz+1.6,r:.7});
      c.fx.push({type:'sign',x:hx-3.2,z:hz-3.9,ang:Math.PI,text:'FANGSTHYTTA',sub:'sledehunder · vær snill'})}
    // --- steiner på viddene, en nunatak som stikker opp av breen, og isfjell i havet ---
    for(let i=0;i<90;i++){const x=(R()-.5)*76,z=(R()-.5)*76,rr=.4+R()*1;if(Math.hypot(x,z)>isl(x,z)-5||c.dist(x,z)<rr+2.4||!c.free(x,z,rr+.5)||Math.hypot(x-GL[0],z-GL[1])<GL_R+1||Math.hypot(x-FJ[0],z-FJ[1])<FJ_R+2.5||Math.hypot(x-MT[0],z-MT[1])<mtR(x,z)+.5)continue;
      rock(x,z,rr,.25+R()*.55,{ang:R()*6.3,ax:1+R()*.5,surf:S.ROCK});if(rr>.9)c.anchor(x,z)}
    for(let i=0;i<40;i++){const a=R()*6.28,d=mtR(MT[0]+Math.cos(a)*9,MT[1]+Math.sin(a)*9)+.6+R()*3,x=MT[0]+Math.cos(a)*d,z=MT[1]+Math.sin(a)*d,rr=.4+R()*.9;if(c.dist(x,z)<rr+1.8||!c.free(x,z,rr+.4))continue;rock(x,z,rr,.4+R()*.8,{ang:R()*6.3,ax:1+R()*.5,sharp:.4,surf:S.ROCK});if(rr>.9)c.anchor(x,z)}   // ur under fjellveggen
    rock(-2,35,2.6,3.4,{ang:.6,ax:1.3,sharp:.75,surf:S.ROCK});c.block(-2,35,3.4);c.anchor(-2,35);
    for(const[x,z,r,h]of[[2,47.5,2.6,5.6],[13,48,3.2,6.4],[-9,46,2.2,5],[22,45.5,2,4.8],[46.5,-9,2.4,5.2],[47,5,1.9,4.6],[-32,37,2.3,5.2],[40,26,1.8,4.6]])rock(x,z,r,h,{ang:R()*6,ax:1.2+R()*.5,sharp:.42,nz:.3,surf:S.ICE});
    // --- gullmutterne ---
    for(const[x,z,l]of[[-27.3,-.5,'Mellom radarkuplene på Gruvefjellet'],[VAULT[0]+2.6,VAULT[1]-1.5,'Ved døra til frøhvelvet'],[GL[0],GL[1]+1,'På toppen av Isbjørnbreen'],
      [HUT[0]+.2,HUT[1]+1.9,'Bak fangsthytta'],[35.6,3.4,'Ved den innefrosne skøyta']]){c.secret(x,z,l);c.block(x,z,1.2)}
    c.finish();
    // --- det lille som vokser: myrull og polarvier på rabbene, og dyrene som står i ro (data/dyr.js) ---
    const low=(x,z)=>Math.hypot(x-GL[0],z-GL[1])>GL_R+1&&Math.hypot(x-FJ[0],z-FJ[1])>FJ_R+1.5&&Math.hypot(x-MT[0],z-MT[1])>mtR(x,z)+1;
    c.sow('arktis_myrull',16,[6,-22],12,{r:.2,gap:1.2,ok:low});
    c.sow('arktis_dvergbjork',14,[0,-6],30,{r:.3,gap:4,ok:low,p:R=>({host:1,s:.6+R()*.3})});
    c.plant('arktis_isbjorn',36.2,-9.6,{});                                     // binna med ungen ved iskanten sør i fjorden
    c.sow('arktis_fjellrev',4,[0,0],32,{r:.25,gap:12,ok:low,p:()=>({vinter:1})});
    c.sow('arktis_snougle',3,[-4,-4],30,{r:.4,gap:14,ok:low,p:R=>({hunn:R()<.5?1:0})});
    c.props();
    instanced(DG.canopy,DM.white,balls,c.decor);
    c.pebbles(260,['#55585e','#74787e','#3e4046'],.04,.11);
  }}
);
})();
