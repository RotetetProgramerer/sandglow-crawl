// Kaimanøya: jungeløya (120 × 120). Tett regnskog, tre elver, gjørmesletter og et mangrovedelta. Fri kjøring, fem løyper.
// Storelva faller fra tjernet på Apeberget i nord, over fossen og ut i havet i vest. Sølebekken renner inn i den fra nordvest.
// Østelva renner fra kilden øst for berget og ned i mangrovedeltaet i sørøst. Gjørmesletta ligger i sørvest, tempelruinen i nordøst.
// Kaimaner soler seg på elvebreddene, tukaner og papegøyer sitter i trærne, kapybaraer beiter ved vannet og en jaguar lusker i skogkanten.
//   node tools/test-levels.js kaiman
(function(){
const DEG=Math.PI/180;
const smt=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const lineD=(L,x,z)=>{let m=1e9;for(let i=0;i<L.length-1;i++){const a=L[i],b=L[i+1],ex=b[0]-a[0],ez=b[1]-a[1],L2=ex*ex+ez*ez||1e-9;let t=((x-a[0])*ex+(z-a[1])*ez)/L2;t=t<0?0:t>1?1:t;m=Math.min(m,Math.hypot(x-a[0]-ex*t,z-a[1]-ez*t))}return m};
// glatter en brutt linje (Chaikin), så elvene svinger mykt
const soft=(L,n=3)=>{for(let k=0;k<n;k++){const o=[L[0]];for(let i=0;i<L.length-1;i++){const a=L[i],b=L[i+1];o.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75])}o.push(L[L.length-1]);L=o}return L};
const WATER=.3;
// ---------- geografi ----------
const isl=(x,z)=>{const a=Math.atan2(z,x);return 46+3*Math.sin(3*a+.4)+2*Math.sin(5*a+1.3)+1.2*Math.sin(9*a+.2)};
const HILL=[-3,28], HILL_R=14;                                       // Apeberget: flatt berg i nord med stup mot sør
const rH=(x,z)=>Math.hypot(x-HILL[0],z-HILL[1]);
const TARN=[-3,19.2];                                                // tjernet på toppen, rett ved stupkanten
const POOL=[-3,11.8];                                                // kulpen under fossen
const MUDF=[-23,-25], MUDF_R=12;                                     // Gjørmesletta
const DELTA=[27,-24], DELTA_R=10;                                    // mangrovedeltaet
const TEMPLE=[23,19];                                                // tempelruinen
const VIL=[6,-40.5];                                                 // landsbyen og kaia
const HUB=[6,-21];                                                   // leiren der veiene møtes
const TEMPLE_H=1.3, TIERS=[[4.2,.42],[3.3,.84],[2.4,1.26],[1.5,1.68]], RAMP_L=6;   // tempelets avsatser [halv bredde, høyde] og trappa
const BRIDGE=[[-15,-6.4],[-15,1.4]];                                 // hengebroa over Storelva
const TOWER=[28.4,-25.4];                                                // utkikkstårnet i deltaet
const SANDBARS=[[-9.4,-2.2,1.2],[-27.2,1.0,1.0],[-38.5,-4.8,1.1],[19.4,-7.3,.8]];   // sandbanker midt i elva [x,z,r]
const GIANTS=[[-18,17],[-32,8],[12,-1],[-8,-12],[18,-4],[-36,-12],[30,8],[-17,27],[19,22],[24,30],[-26,26],[34,-6]];
// elvene: linje, halv bredde, dybde under vannflaten og vadesteder (der er elva grunn)
const RIVERS=[
 {id:'stor',name:'Storelva',hw:2.5,dep:.62,pts:soft([POOL,[-4.5,9],[-3.5,4],[-6.5,-.5],[-12,-3],[-18,-2],[-23.5,1.5],[-29.5,.5],[-34.5,-3.5],[-41,-5.5],[-52,-6]]),fords:[[-3.6,4.6],[-23.3,1.3]]},
 {id:'ost',name:'Østelva',hw:1.9,dep:.5,pts:soft([[13.6,21.4],[14.6,16],[15.2,10],[14.6,3],[17.5,-4],[21.5,-10.5],[25.5,-17],[29,-23],[33,-29],[39,-35],[48,-41]]),fords:[[15.1,9.4],[21.4,-10.4]]},
 {id:'sole',name:'Sølebekken',hw:1.3,dep:.38,pts:soft([[-28,19],[-24.5,13.5],[-21.5,8],[-17.5,3],[-13,-1.4],[-11,-2.8]]),fords:[[-21.4,7.8]]},
];
const rivD=(x,z)=>{let m=1e9;for(const r of RIVERS)m=Math.min(m,lineD(r.pts,x,z)-r.hw);return m};   // avstand til nærmeste elvebredd (negativ: i elva)
const fordF=(r,x,z)=>{let f=0;for(const p of r.fords)f=Math.max(f,smt(1-Math.hypot(x-p[0],z-p[1])/3.4));return f};
const fordNear=(x,z)=>RIVERS.some(r=>r.fords.some(p=>Math.hypot(x-p[0],z-p[1])<4));
// avstand til midten av Gjørmesletta og deltaet, med bølgete kanter (ikke perfekte sirkler)
const wob=(dx,dz,p)=>{const a=Math.atan2(dz,dx);return Math.hypot(dx,dz)*(1+.16*Math.sin(3*a+p)+.09*Math.sin(5*a+2*p)+.05*Math.sin(9*a+p*3))};
const dMud=(x,z)=>wob(x-MUDF[0],z-MUDF[1],1.1), dDel=(x,z)=>wob(x-DELTA[0],z-DELTA[1],2.3);
const inJungle=(x,z)=>Math.hypot(x,z)<isl(x,z)-7&&dMud(x,z)>MUDF_R-1&&dDel(x,z)>DELTA_R-1;
// anakondaen svømmer i en lang sløyfe midt i Storelva, der elva er bred
const SNAKE=(()=>{const L=RIVERS[0].pts;let bi=0,bd=1e9;L.forEach((p,i)=>{const d=Math.hypot(p[0]+31.5,p[1]+1.2);if(d<bd){bd=d;bi=i}});const a=L[bi-3],b=L[bi+3],tx=(b[0]-a[0]),tz=(b[1]-a[1]),l=Math.hypot(tx,tz),ux=tx/l,uz=tz/l,c=L[bi],o=[];
  for(let k=0;k<=40;k++){const t=k/40*6.283;o.push([c[0]+ux*Math.cos(t)*3.2-uz*Math.sin(t)*.9,c[1]+uz*Math.cos(t)*3.2+ux*Math.sin(t)*.9])}return o})();
// ---------- løypene ----------
const CH=[
 {id:'gjorme',name:'Gjørmesletta',diff:1,gates:8,desc:'Rundt den store gjørmesletta i sørvest. Gjørmehull, siv og hegrer. Hold farten oppe!',
  path:[[-11.5,-21],[-15,-24.5],[-19,-30],[-25,-33.5],[-31,-30.5],[-33,-24],[-30,-18],[-24,-16.5],[-18.5,-18],[-15.5,-21.5]],surf:S.MUD,skip:S.BOG,hw:1.3},
 {id:'vad',name:'Vadestedene',diff:2,gates:9,desc:'Tre vadesteder over Storelva og Sølebekken. Kaimanene ligger på bredden og ser på deg.',
  path:[[2,3],[-1,4.2],[-3.6,4.6],[-7,5.5],[-10.5,7.5],[-14.5,9.8],[-17.9,9.7],[-21.4,7.8],[-24.6,5.6],[-24.3,3.4],[-23.3,1.3],[-22.4,-1.4],[-20.5,-5.5],[-17,-8],[-12.5,-9]],surf:S.DIRT,skip:S.MUD},
 {id:'tempel',name:'Tempelstien',diff:2,gates:8,desc:'Gjennom tett regnskog, over Østelva og fram til den gamle tempelruinen. Tør du kjøre opp trappa?',
  path:[[10.5,-10.5],[12.8,-5],[11.8,0],[11,5],[11.6,8.8],[15.1,9.4],[18.8,10.2],[21.5,9.6],[23,10.6]],surf:S.DIRT,skip:S.MUD},
 {id:'mangrove',name:'Mangrovedeltaet',diff:3,gates:10,desc:'Grunne kanaler mellom mangrovetrærnes stylterøtter. Vått, glatt og fullt av liv.',
  path:[[16.5,-24.5],[19.5,-27.5],[22.5,-25],[24.5,-20.5],[28.5,-18],[32.5,-20],[34,-24.5],[32,-29],[28,-31],[24,-30.5],[21.5,-32]],hw:1.3},
 {id:'foss',name:'Fosseklatringen',diff:3,gates:10,desc:'Opp den steinete flanken på Apeberget, rundt toppen og fram til stupkanten der fossen faller.',
  path:[[3.5,9],[6,13.5],[8.6,18.5],[10.2,24],[10,30],[7,35],[1,38],[-5,37.5],[-10,34],[-12,29],[-10.5,24],[-8.5,21],[-6.2,18.4]],surf:S.DIRT,skip:S.ROCK,hw:1.3,blend:1.8},
];
const ROADS=[
 [[6,-25],[6,-21]],                                                  // fra landsbyen til leiren
 [[3,-21],[-3,-20],[-8,-19.5],[-11,-20.5]],                          // vest til Gjørmesletta
 [[6,-18],[5.5,-12],[4.5,-5],[4,1.5],[3.6,8.5]],                     // nord til Vadestedene og Fosseklatringen
 [[8.5,-19.5],[10,-15],[10.5,-11]],                                  // nordøst til Tempelstien
 [[9,-22.5],[13,-24],[16.5,-24.5]],                                  // øst til mangroven
 [[-11,-17],[-13.5,-12],[-15,-7.4]],                                 // fra Gjørmesletta til hengebroa
 [[-15,2.4],[-15.3,6]],                                              // fra hengebroa til Vadestedene
];
// ---------- lys, vann og lyd ----------
LEVELS.push(
{ id:'kaiman', name:'Kaimanøya', diff:2, seed:7319, size:120, world:true,
  desc:'Jungeløya: tett regnskog, tre elver og mye gjørme. Kaimaner på elvebredden, tukaner i trærne og en gammel tempelruin.',
  start:[6,-31.5,0],
  sky:['#5d8fae','#e8dcb4'], fog:0xb9c9a6, fogNear:16, fogFar:78, sun:0xfff0c8, sunI:1.05, hemi:[0xdcebd2,0x3b4a22,.72], sunDir:[-16,24,-10], rockCol:'#6c6e5c',
  water:WATER, waterCol:'#3a4824', waterOpacity:.9, waterEnv:.25,
  waterBand:(x,z)=>Math.hypot(x,z)>isl(x,z)-6||rivD(x,z)<.6||dDel(x,z)<DELTA_R+2||rH(x,z)<HILL_R-1,
  ambience:'jungle',
  biome:(x,z)=>{const R=Math.hypot(x,z);return{jungle:inJungle(x,z)?1:.4,swamp:Math.max(smt((MUDF_R+4-dMud(x,z))/6),smt((DELTA_R+3-dDel(x,z))/5),smt((1.5-rivD(x,z))/3)*.6),beach:smt((R-(isl(x,z)-10))/5),snow:0,desert:0}},
  path:[[6,-31.5],[8,-29],[6,-27],[4,-29],[6,-31.5]], challenges:CH, roads:ROADS, airport:{at:[33,33],dir:45,len:38,end:1,road:[[20,37.5]]}, village:{at:VIL,out:90},
  animals:{parrots:12,circling:4,toucans:9,monkeys:12,butterflies:60,crabs:8,crabsAt:[-5,-42],liana:[12.6,-3.5],
    caimans:[{at:[-9,-3],r:4,n:3},{at:[-27,1],r:4,n:2},{at:[-38.5,-5],r:4,n:2},{at:[19,-7],r:4,n:2},{at:[26,-21],r:5,n:2},{at:[-21,6],r:3,n:1}],
    capybaras:[{at:[-32,-7.5],r:3.5,n:4},{at:[-13,-6.5],r:2.5,n:3},{at:[18,2],r:3,n:3}],jaguar:[[-35,13],[-23,24]],
    frogs:[{at:[-22,-24],r:8,n:8},{at:[-4,9],r:4,n:4},{at:[25,-26],r:6,n:5},{at:[-20,5],r:4,n:4},{at:TEMPLE,r:6,n:3}],
    egrets:[{at:[-24,-26],r:9,n:4},{at:[27,-26],r:7,n:3},{at:[-36,-5],r:5,n:2}],
    snakes:[{path:SNAKE,speed:.32}],
    fish:[{at:[-20,-1],r:4,n:3},{at:POOL,r:2,n:2},{at:[22,-12],r:3,n:2},{at:[-35,-4],r:3,n:2}],lizards:[{at:TEMPLE,r:7,n:6}]},
  mapLabels:[[-3,31,'Apeberget'],[-30,-26,'Gjørmesletta'],[28,-25,'Mangroven'],[23,22,'Tempelet'],[-36,-1,'Storelva'],[19,2,'Østelva'],[-24,13,'Sølebekken'],[6,-19,'Leiren'],[9,-43,'Kaia']],
  base(x,z,n){const R=Math.hypot(x,z),ri=isl(x,z),r=rH(x,z);
    let h=1.05+.45*fbm(n,x*.04,z*.04,3)+.1*fbm(n,x*.25,z*.25,2);
    h-=2.4*smt((R-ri+2)/4);                                                       // havet
    // Apeberget: et flatt berg (3,6 over sletta). Slakk mot nord, øst og vest, stup mot sør der fossen faller.
    {const a=Math.atan2(z-HILL[1],x-HILL[0])/DEG,south=smt(1-Math.abs(a+90)/45),w=11-9.7*south;h+=3.4*smt((HILL_R-r)/w)+.25*fbm(n,x*.2,z*.2,2)*smt((HILL_R+2-r)/4)}
    // Gjørmesletta: lav, våt og flat, bare litt over vannet
    {const k=smt((MUDF_R+3-dMud(x,z))/6);h+=((WATER+.2+.18*fbm(n,x*.18,z*.18,3))-h)*k}
    // mangrovedeltaet: grunne kanaler mellom lave holmer
    {const k=smt((DELTA_R+2-dDel(x,z))/5);h+=((WATER-.06+.32*fbm(n,x*.16+4,z*.16,3))-h)*k}
    // elvene: lave breddene og elvebunnen. Grunt ved vadestedene.
    for(const rv of RIVERS){const d=lineD(rv.pts,x,z);if(d>rv.hw+3.2)continue;
      const bank=WATER+.24+.06*n(x*.6,z*.6);h+=(Math.min(h,bank+.35)-h)*smt((rv.hw+3.2-d)/3.2);h=Math.min(h,bank+(d-rv.hw)*.25);
      if(d<rv.hw+.3){const f=fordF(rv,x,z),bed=WATER-(rv.dep*(1-f*.8)*(1-.7*smt((DELTA_R+3-dDel(x,z))/4)))*(1-(d/(rv.hw+.3))**2)-.04*f;h=Math.min(h,bed)}}
    return h},
  surf(x,z,n){const R=Math.hypot(x,z),ri=isl(x,z),rd=rivD(x,z);
    if(rH(x,z)<HILL_R-1.5)return n(x*.5,z*.5)>.6?S.ROCK:n(x*.3+9,z*.3)>.55?S.DIRT:S.GRASS;
    if(dDel(x,z)<DELTA_R+1)return n(x*.4,z*.4)>.7?S.SAND:S.MUD;
    if(dMud(x,z)<MUDF_R+1){const v=n(x*.3+9,z*.3);return v>.58?S.BOG:v>.3?S.MUD:S.DIRT}
    if(rd<.2)return S.GRAVEL;
    if(rd<1.6)return n(x*.7,z*.7)>.4?S.MUD:S.SAND;
    if(R>ri-8)return S.SAND;
    return n(x*.4+5,z*.4)>.66?S.MUD:n(x*.5,z*.5+3)>.7?S.DIRT:S.GRASS},
  build(c){const R=c.rng,def=this;
    // --- tjernet på berget, kulpen under fossen og bekken mellom dem ---
    c.pond(TARN[0],TARN[1],2.6,.5,{fill:.75,bed:S.GRAVEL});
    c.pond(POOL[0],POOL[1],2.9,.5,{fill:.9,bed:S.GRAVEL});
    c.pond(13.6,21.4,1.6,.4,{fill:.85,bed:S.GRAVEL});   // kilden til Østelva
    c.pond(TARN[0],16.4,1.1,.25,{fill:.7,bed:S.GRAVEL});   // utløpet fra tjernet mot stupkanten
    // --- veiene og løypene (før alt annet, så steiner og trær holder seg unna) ---
    for(const r of ROADS)c.road(r,{hw:1.3,blend:1.8,surf:S.DIRT,skip:S.MUD});
    for(const ch of CH)c.course(ch);
    const K=id=>c.courses.find(k=>k.id===id),gj=K('gjorme'),vad=K('vad'),tem=K('tempel'),man=K('mangrove'),foss=K('foss');
    // --- hengebroa over Storelva mellom Gjørmesletta og Sølebekken ---
    c.bridge(BRIDGE[0][0],BRIDGE[0][1],BRIDGE[1][0],BRIDGE[1][1],1.05,{sag:.22});
    // --- tempelruinen: fire avsatser i stein, en trapp (rampe) opp sørsiden med slangehoder ved foten, og et lite tempelhus på toppen ---
    const TP=TEMPLE,hp=TEMPLE_H;c.flat(TP[0],TP[1]-1,7,hp,2.5);
    const stone=(px,pz,lvl)=>{const v=G.noise(px*1.7,pz*1.7),m=G.noise(px*.6+40,pz*.6),seam=(Math.abs(((pz*2.2)%1+1)%1-.5)<.06||Math.abs(((px*1.4+(Math.floor(pz*2.2)%2)*.5)%1+1)%1-.5)<.04)?.75:1;
      const b=mix('#7d7b6a','#9d9a86',v),f=seam*(.9+.12*lvl);let r=[b[0]*f,b[1]*f,b[2]*f];if(m>.55){const g=mix('#45602e','#5f7a38',v);const t=Math.min(1,(m-.55)*3.5);r=[r[0]+(g[0]-r[0])*t,r[1]+(g[1]-r[1])*t,r[2]+(g[2]-r[2])*t]}return r};
    cellsIn(TP[0]-5,TP[1]-10,TP[0]+5,TP[1]+5,(k,px,pz)=>{const ax=Math.abs(px-TP[0]),az=Math.abs(pz-TP[1]),m=Math.max(ax,az);let top=-1,lvl=0;
      TIERS.forEach(([s,h],i)=>{if(m<=s){top=h;lvl=i}});
      const along=(TP[1]-1.5)-pz;if(along>0&&along<RAMP_L&&ax<1.15){const rt=TIERS[3][1]*(1-along/RAMP_L);if(ax<.85){if(rt>top){top=rt;lvl=-1}}else if(rt+.16>top){top=rt+.16;lvl=-2}}
      if(top<0)return;TH[k]=hp+top;TS[k]=S.ROCK;
      if(lvl===-1){const st=((along*4.2)%1+1)%1;const b=stone(px,pz,1);const f=st<.18?.68:1;setC(k,[b[0]*f,b[1]*f,b[2]*f])}else setC(k,stone(px,pz,lvl))});
    c.block(TP[0],TP[1],8.5);
    // utjevningen fyller elvebunnen ved vadestedene: grav den ut igjen, så bilen må vade
    for(let k=0;k<N*N;k++){const x=-HALF+(k%N)*CELL,z=-HALF+((k/N)|0)*CELL;if(rivD(x,z)<.2&&TB[k]<TH[k])TH[k]=TB[k]}
    {const y=hp+TIERS[3][1];c.box(TP[0],y,TP[1]+.75,2.3,.95,1.3,'#8a8775');c.box(TP[0],y+.95,TP[1]+.75,2.55,.16,1.55,'#6f6d5e');c.box(TP[0],y+1.11,TP[1]+.75,1.7,.2,1.0,'#7d7b6a');
      c.box(TP[0],y,TP[1]+.09,.62,.72,.04,'#14120e');for(const sd of[-1,1])c.box(TP[0]+sd*.75,y+.3,TP[1]+.09,.3,.3,.03,'#4a5a30');c.colliders.push({x:TP[0],z:TP[1]+.75,w:2.3,d:1.3,ry:0,anchor:true,y:y+.5})}
    {const fy=hp,fz=TP[1]-1.5-RAMP_L;for(const sd of[-1,1]){const x=TP[0]+sd*1.4;c.box(x,fy,fz+.3,.75,.55,.95,'#8a8775');c.box(x,fy+.55,fz+.1,.62,.28,.72,'#7d7b6a');c.box(x,fy+.3,fz-.2,.5,.1,.08,'#c8463a');
      for(const ex of[-.2,.2])c.box(x+ex,fy+.66,fz-.27,.1,.1,.04,'#e5a92b');c.colliders.push({x,z:fz+.2,w:.8,d:1.0,ry:0,anchor:true,y:fy+.4})}}
    // falne søyler og mosegrodde blokker rundt tempelplassen
    for(const[x,z,a,l]of[[TP[0]-6.4,TP[1]-3.5,.4,1.8],[TP[0]+6.2,TP[1]-5.2,1.9,1.5],[TP[0]+5.8,TP[1]+3.2,.9,2.1],[TP[0]-5.6,TP[1]+4.4,2.6,1.6]]){const y=H(x,z);c.cyl(x,y+.22,z,.22,l,'#8d8a77',{rz:1.57,ry:a});c.colliders.push({x,z,r:.5})}
    for(const[x,z]of[[TP[0]-6.8,TP[1]-6.6],[TP[0]+6.9,TP[1]-7.4],[TP[0]+6.6,TP[1]+.2],[TP[0]-6.5,TP[1]+1.2]]){const y=H(x,z);c.cyl(x,y,z,.24,1.2+R()*.7,'#8d8a77');c.box(x,y+1.25,z,.6,.2,.6,'#7d7b6a');c.colliders.push({x,z,r:.32,anchor:true,y:y+.5})}
    for(let i=0;i<14;i++){const a=R()*6.28,d=5.4+R()*3,x=TP[0]+Math.cos(a)*d,z=TP[1]+Math.sin(a)*d;if(c.dist(x,z)<1.8)continue;const s=.25+R()*.25;c.box(x,H(x,z)-.05,z,s*1.6,s,s*1.2,R()<.5?'#7d7b6a':'#5f6e44',R()*3)}
    // --- leiren der veiene møtes: telt, kasser, radiomast og veiviser ---
    {const[hx,hz]=HUB,y=H(hx,hz);c.flat(hx,hz,3.2,y,2.5);
      const tx=hx+3.4,tz=hz+.6;c.box(tx,y,tz,1.8,.05,1.4,'#5a4a32');for(const sd of[-1,1])c.box(tx+sd*.42,y+.5,tz,1.0,.05,1.5,'#6b7a3a',0,{rz:sd*.95});c.box(tx,y,tz+.72,1.0,.85,.03,'#4a5a2a');c.colliders.push({x:tx,z:tz,w:1.8,d:1.5,ry:0,anchor:true,y:y+.4});
      for(const[ox,oz,s]of[[-3.2,1.6,.5],[-3.5,2.2,.42],[-2.8,2.0,.36],[2.6,-2.4,.45]]){c.box(hx+ox,y,hz+oz,s,s,s,'#8a6a3a',R());c.colliders.push({x:hx+ox,z:hz+oz,r:s*.6})}
      c.cyl(hx-3,y,hz-2.6,.05,4.2,'#9a9a96');c.box(hx-3,y+4.2,hz-2.6,.3,.3,.3,'#d9432f');for(let k=0;k<3;k++)c.box(hx-3,y+1.2+k*1.1,hz-2.6,.8-k*.2,.04,.04,'#9a9a96');c.colliders.push({x:hx-3,z:hz-2.6,r:.12,anchor:true,y:y+.6});
      c.cyl(hx+.9,y,hz+2.6,.05,1.7,'#5a3a22');c.colliders.push({x:hx+.9,z:hz+2.6,r:.1});
      for(const[t,a,y2]of[['GJØRME ←',-.5,1.5],['TEMPEL ↗',.6,1.3],['ELV ↑',0,1.1]])c.box(hx+.9,y+y2,hz+2.6,.9,.18,.04,'#c8a050',a);
      c.fx.push({type:'sign',x:hx-1.8,z:hz+3.3,ang:Math.PI,text:'KAIMANØYA',sub:'leiren · 5 løyper'})}
    // --- en gammel brygge med kano i Storelva ---
    {const A=[-30.5,-4.6],B=[-30.2,-1.8];c.bridge(A[0],A[1],B[0],B[1],.55,{sag:0,y0:H(A[0],A[1])+.05,y1:WATER+.2,pier:true});c.box(-29.1,WATER-.07,-2.6,.4,.18,1.8,'#a0522d',.15);c.box(-29.1,WATER+.1,-2.6,.3,.03,1.5,'#6b4325',.15)}
    // --- utkikkstårnet i deltaet ---
    {const[x,z]=TOWER,y=H(x,z);for(const[ox,oz]of[[-.5,-.5],[.5,-.5],[-.5,.5],[.5,.5]])c.cyl(x+ox,Math.min(y,WATER)-.2,z+oz,.06,4.2,'#5a3a22');c.box(x,y+3.6,z,1.4,.1,1.4,'#7b4e2c');c.box(x,y+4.4,z,1.6,.08,1.6,'#c9a868');
      for(const sd of[-1,1]){c.box(x+sd*.68,y+3.7,z,.04,.4,1.4,'#7b4e2c');c.box(x,y+3.7,z+sd*.68,1.4,.4,.04,'#7b4e2c')}c.colliders.push({x,z,w:1.2,d:1.2,ry:0,anchor:true,y:y+.6})}
    // --- gjørmehull i Gjørmesletta og søledammer langs stiene ---
    for(const t of[.12,.3,.48,.66,.84]){const p=gj.P(t),s=gj.side(t),o=(R()-.5)*.8;if(gj.nearGate(p.x,p.z,1.4))continue;c.pond(p.x+s.x*o,p.z+s.z*o,1.9+R()*.5,.17,{fill:.6,bog:true,mud:true})}
    for(let i=0;i<26;i++){const a=R()*6.28,d=R()*MUDF_R,x=MUDF[0]+Math.cos(a)*d,z=MUDF[1]+Math.sin(a)*d;if(c.dist(x,z)<2.4||c.pools.some(p=>Math.hypot(p.x-x,p.z-z)<p.r+1.8))continue;c.pond(x,z,.9+R()*1.6,.18,{fill:.6,mud:true,bed:S.BOG})}
    for(const k of[tem,foss,vad])for(let i=0;i<5;i++){const t=.08+R()*.84,p=k.P(t),s=k.side(t),o=(R()-.5)*1.2;if(k.nearGate(p.x,p.z,1.5)||rivD(p.x,p.z)<3)continue;c.pond(p.x+s.x*o,p.z+s.z*o,.6+R()*.4,.12,{fill:.55,mud:true,bed:S.MUD})}
    // --- røtter og steiner i stiene, en veltet stamme over Tempelstien ---
    const bark=(u,d)=>d>.8?'#3d2a1a':mix('#5a3f28','#7a5638',G.noise(u*30,d*4));
    {const t=.36,p=tem.P(t),s=tem.side(t);log(p.x-s.x*2.3,p.z-s.z*2.3,p.x+s.x*2.3,p.z+s.z*2.3,.13,S.BARK,bark)}
    for(const k of[tem,vad,man])for(let i=0;i<22;i++){const t=R(),p=k.P(t),s=k.side(t),b=(R()-.5)*2.4;if(k.nearGate(p.x,p.z,1.3)||rivD(p.x,p.z)<1)continue;const a=R()*6.28,len=.5+R()*1.2,x0=p.x+s.x*b,z0=p.z+s.z*b;
      if(R()<.55)log(x0,z0,x0+Math.sin(a)*len,z0+Math.cos(a)*len,.035+R()*.03,S.BARK,()=>'#4e3a28');else rock(x0,z0,.2+R()*.25,.1+R()*.14,{ang:R()*6.3})}
    for(let i=0;i<26;i++){const t=.15+R()*.8,p=foss.P(t),s=foss.side(t),b=(R()-.5)*2.2;if(foss.nearGate(p.x,p.z,1.4))continue;rock(p.x+s.x*b,p.z+s.z*b,.3+R()*.3,.1+R()*.13,{ang:R()*6.3})}   // steinete opp berget
    // --- sandbanker i elvene: kaimanene ligger her ---
    for(const[x,z,r]of SANDBARS)cellsIn(x-r*1.6,z-r,x+r*1.6,z+r,(k,px,pz)=>{const d=Math.hypot((px-x)/1.6,pz-z)/r;if(d>1)return;const nh=WATER+.1*(1-d*d)-.04+.03*G.noise(px*3,pz*3);if(nh>TH[k]){TH[k]=nh;TS[k]=S.SAND}});
    // --- elvesteiner ved vadestedene og ved fossen ---
    for(const rv of RIVERS)for(const f of rv.fords)for(let i=0;i<7;i++){const a=R()*6.28,d=1.8+R()*2.2,x=f[0]+Math.cos(a)*d,z=f[1]+Math.sin(a)*d;if(c.dist(x,z)<1.5)continue;rock(x,z,.25+R()*.3,.25+R()*.3,{sharp:.5,nz:.2})}
    for(let i=0;i<12;i++){const a=R()*3.14,d=2.6+R()*1.2,x=POOL[0]+Math.cos(a)*d,z=POOL[1]+Math.sin(a)*d*.8;if(c.dist(x,z)<1.6)continue;rock(x,z,.3+R()*.4,.3+R()*.35,{sharp:.5,nz:.2})}
    // --- store steiner, mest på berget ---
    for(let i=0;i<220;i++){const x=(R()-.5)*96,z=(R()-.5)*96,r=.45+R()*1.2,ax=1+R()*.6,Rx=r*ax,hill=rH(x,z)<HILL_R+2;if(!hill&&R()<.6)continue;
      if(Math.hypot(x,z)>isl(x,z)-7||c.dist(x,z)<Rx+1.6||c.nearGate(x,z,Rx+1.6)||!c.free(x,z,Rx+.8)||rivD(x,z)<Rx+1||c.pools.some(p=>Math.hypot(p.x-x,p.z-z)<p.r+Rx+.6)||dDel(x,z)<DELTA_R+2||dMud(x,z)<MUDF_R)continue;
      rock(x,z,r,(.4+R()*.9)*(hill?1:.6),{ang:R()*6.3,ax,surf:S.ROCK});if(r>.9)c.anchor(x,z)}
    // --- regnskogen: trær før finish, så røttene står riktig ---
    const slope=(x,z)=>Math.abs(H(x+.5,z)-H(x-.5,z))+Math.abs(H(x,z+.5)-H(x,z-.5));
    const trunkOK=(x,z,r,minPath)=>!(c.dist(x,z)<minPath||c.nearGate(x,z,2.2)||!inJungle(x,z)||rivD(x,z)<1.4||H(x,z)<WATER+.2||!c.free(x,z,r+.4)||c.pools.some(p=>Math.hypot(p.x-x,p.z-z)<p.r+1)||c.trees.some(t=>Math.hypot(t.x-x,t.z-z)<r+t.r+1.5)||slope(x,z)>.45);
    for(const[x,z]of GIANTS)if(trunkOK(x,z,.6,3))c.tree(x,z,{h:10+R()*2.5,r:.5+R()*.12,branches:5,moss:true});    // kjempetrær som rager over resten
    for(let i=0;i<14000&&c.trees.length<250;i++){const x=(R()-.5)*92,z=(R()-.5)*92;const near=c.dist(x,z);if(!trunkOK(x,z,.3,2.2))continue;if(near>9&&R()<.35)continue;c.tree(x,z,{h:4.5+R()*4.5,r:.18+R()*.2})}
    // --- gullmutterne ---
    c.secret(TP[0],TP[1]-.55,'På toppen av tempelet');c.secret(.4,13.6,'Ved foten av fossen');c.secret(SANDBARS[0][0],SANDBARS[0][1],'Kaimanenes sandbanke');c.secret(-27.5,-30.5,'Midt i gjørma');c.secret(34.5,-31.5,'Ytterst i mangroven');
    // --- jungelbunnen: egne farger (løvstrø, mose, våt jord) i stedet for vanlig gress ---
    for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i;if(TCF[k])continue;const x=-HALF+i*CELL,z=-HALF+j*CELL,s=TS[k],v=G.noise(x*.45+50,z*.45),w=G.noise(x*2.7,z*2.7-40),u=G.noise(x*.12-20,z*.12);
      if(s===S.GRASS){setC(k,u>.45?mix('#2f4a1c','#4d6a26',v*.6+w*.4):u>.3?mix('#3a4a20','#56602a',v*.5+w*.5):mix('#4a3a22','#665230',v*.5+w*.5))}
      else if(s===S.MUD){const wet=smt((WATER+.35-TH[k])/.3);const a=mix('#4a3826','#6a5034',w*.7+v*.3),b=col('#2e2418'),t=wet*.7;setC(k,[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t])}
      else if(s===S.BOG)setC(k,mix('#241a10','#3a2c1c',w*.6+v*.4));
      else if(s===S.DIRT)setC(k,mix('#4e3622','#6f5236',v*.6+w*.4));
      else if((s===S.GRAVEL||s===S.SAND)&&TH[k]<WATER+.12)setC(k,mix('#3e3626','#5a4e38',v*.5+w*.5))}   // elvebunn og våt sand: mørk og gjørmete
    c.finish();
    c.forest();
    // --- fossen fra tjernet ned i kulpen ---
    {const top=[TARN[0],HILL[1]-HILL_R+1.3],yT=c.pools.find(p=>Math.hypot(p.x-TARN[0],p.z-TARN[1])<.1).level,pool=c.pools.find(p=>Math.hypot(p.x-POOL[0],p.z-POOL[1])<.1);
      c.fall(top[0],top[1],Math.PI,3.0,yT+.05,pool.level,{spray:false});c.fx.push({type:'mist',x:POOL[0],z:POOL[1]+.8,y:pool.level+.8,s:4})}
    // --- elvene: rennende vann med drivende blader ---
    for(const rv of RIVERS)c.fx.push({type:'river',pts:rv.pts,hw:rv.hw,y:WATER,speed:rv.id==='stor'?.55:.45});
    // --- mangrovetrær: stammen står på buede stylterøtter over vannet ---
    const mTr=[],mRoot=[],mCan=[];
    const mangroves=[];for(let i=0;i<5000&&mangroves.length<70;i++){const a=R()*6.28,d=Math.sqrt(R())*(DELTA_R+2.5),x=DELTA[0]+Math.cos(a)*d,z=DELTA[1]+Math.sin(a)*d;
      if(c.dist(x,z)<3.4||c.nearGate(x,z,3)||Math.hypot(x,z)>isl(x,z)-3||Math.hypot(x-TOWER[0],z-TOWER[1])<1.8||mangroves.some(m=>Math.hypot(m.x-x,m.z-z)<1.7))continue;mangroves.push({x,z,h:1.5+R()*1.3})}
    for(const m of mangroves){const g=Math.max(H(m.x,m.z),WATER-.25),base=g+.55+R()*.25,top=base+m.h;c.colliders.push({x:m.x,z:m.z,r:.32,anchor:true,y:base});
      mTr.push({x:m.x,y:(base+top)/2,z:m.z,sx:.07,sy:top-base,sz:.07,rz:(R()-.5)*.2,c:mix('#5a4a38','#7a6650',R())});
      const nr=6+Math.floor(R()*3),a0=R()*6.28;for(let k=0;k<nr;k++){const a=a0+k*6.28/nr+(R()-.5)*.4,sp=.5+R()*.35,dx=Math.cos(a),dz=Math.sin(a);
        // en rot er to stykker: ut og litt ned fra stammen, så bratt ned i gjørma
        const mx=m.x+dx*sp*.55,mz=m.z+dz*sp*.55,my=base-.12,ex=m.x+dx*sp,ez=m.z+dz*sp,ey=Math.min(H(ex,ez),WATER)-.1;
        for(const[ax,ay,az,bx,by,bz,r]of[[m.x,base+.15,m.z,mx,my,mz,.03],[mx,my,mz,ex,ey,ez,.026]]){const L=Math.hypot(bx-ax,by-ay,bz-az),yaw=Math.atan2(bx-ax,bz-az),pitch=Math.acos((by-ay)/L);
          mRoot.push({x:ax,y:ay,z:az,sx:r,sy:L,sz:r,rx:pitch,ry:yaw,ord:'YXZ',c:'#6a5a44'})}}
      for(let k=0;k<4;k++){const a=R()*6.28,d=R()*.5;mCan.push({x:m.x+Math.cos(a)*d,y:top+R()*.3,z:m.z+Math.sin(a)*d,sx:.6+R()*.3,sy:.4+R()*.15,sz:.6+R()*.3,c:['#2f5a2a','#3d6a30','#4a7a35','#28502a'][k]})}
      c.perches.push({x:m.x,y:top+.45,z:m.z,kind:'top'})}
    instanced(DG.trunk,DM.bark,mTr,c.decor);instanced(DG.branch,DM.bark,mRoot,c.decor);instanced(DG.canopy,DM.leaf,mCan,c.decor);
    // --- palmer langs strendene og elvebreddene ---
    const palms=[];
    for(let i=0;i<5000&&palms.length<80;i++){const x=(R()-.5)*96,z=(R()-.5)*96,Rr=Math.hypot(x,z),beach=Rr>isl(x,z)-11&&Rr<isl(x,z)-4.5,bank=rivD(x,z)>1.4&&rivD(x,z)<3.6;
      if(!beach&&!(bank&&R()<.35))continue;
      if(c.dist(x,z)<2.4||c.nearGate(x,z,2.5)||!c.free(x,z,1.2)||c.pools.some(p=>Math.hypot(p.x-x,p.z-z)<p.r+1.4)||dDel(x,z)<DELTA_R+2||slope(x,z)>.35||H(x,z)<WATER+.25)continue;
      if(palms.some(q=>Math.hypot(q.x-x,q.z-z)<2.2)||c.trees.some(t=>Math.hypot(t.x-x,t.z-z)<1.6))continue;palms.push({x,z,h:2.6+R()*2,lean:(R()-.5)*.5,ry:R()*6.28})}
    const ptr=[],rings=[],fronds=[],nuts=[];
    for(const q of palms){const y=H(q.x,q.z),th=q.h,lx=Math.sin(q.lean)*Math.cos(q.ry),lz=Math.sin(q.lean)*Math.sin(q.ry),tx=q.x+lx*th,tz=q.z+lz*th,ty=y+Math.cos(q.lean)*th;c.colliders.push({x:q.x,z:q.z,r:.17,anchor:true,y:y+.5});
      // stammen i fem ledd som bøyer seg litt mer mot toppen, med ringer
      let px=q.x,py=y,pz=q.z;for(let k=0;k<5;k++){const u=(k+1)/5,cx=q.x+lx*th*u*u,cz=q.z+lz*th*u*u,cy=y+th*u,L=Math.hypot(cx-px,cy-py,cz-pz);
        ptr.push({x:px,y:py,z:pz,sx:.11-.012*k,sy:L,sz:.11-.012*k,rx:Math.acos((cy-py)/L),ry:Math.atan2(cx-px,cz-pz),ord:'YXZ',c:mix('#8a7048','#a58a5a',(k%2)*.6+R()*.3)});
        rings.push({x:cx,y:cy-.02,z:cz,sx:.12-.012*k,sy:.05,sz:.12-.012*k,c:'#6a5638'});px=cx;py=cy;pz=cz}
      c.perches.push({x:px,y:py+.5,z:pz,kind:'top'});
      const k0=R()*6.3;for(let k=0;k<9;k++)fronds.push({x:px,y:py,z:pz,sx:.2,sy:1.4+R()*.4,sz:.55,ry:k0+k*.7,rz:1.05+R()*.4,c:['#2d7a2b','#3f9a3a','#25682a','#5a8a2a'][k%4]});
      for(let k=0;k<3;k++)nuts.push({x:px+(R()-.5)*.18,y:py-.12,z:pz+(R()-.5)*.18,sx:.07,c:'#5a4a22'})}
    instanced(DG.branch,DM.white,ptr,c.decor);instanced(DG.trunk,DM.white,rings,c.decor,false);instanced(DG.tuft,DM.tuft,fronds,c.decor);instanced(DG.cone,DM.white,nuts,c.decor,false);
    // --- underskogen: bregner, store blader (elefantører), helikonia og blomster ---
    const ferns=[],leaves=[],flowers=[],heli=[],helS=[];c.flowers=[];
    for(let i=0;i<12000&&ferns.length<900;i++){const x=(R()-.5)*94,z=(R()-.5)*94;if(!inJungle(x,z)&&!(rivD(x,z)>1&&rivD(x,z)<4))continue;
      if(c.dist(x,z)<1.6||rivD(x,z)<.9||H(x,z)<WATER+.15||c.pools.some(p=>Math.hypot(p.x-x,p.z-z)<p.r)||rH(x,z)<HILL_R-2&&R()<.6)continue;const s=.3+R()*.55,y=H(x,z);
      ferns.push({x,y:y-.02,z,sx:s*.9,sy:s*1.1,sz:s*.9,ry:R()*6,c:['#2f7a2c','#3e8f35','#1f6a2a','#58a03a','#2a5a24'][i%5]});
      if(R()<.45){const n=3+Math.floor(R()*3),a0=R()*6.28,big=R()<.35;for(let k=0;k<n;k++)leaves.push({x:x+(R()-.5)*.3,y:y+.02,z:z+(R()-.5)*.3,sx:big?.42:.26,sy:(big?.9:.55)+R()*.4,sz:.1,rx:.45+R()*.5,ry:a0+k*6.28/n,c:['#2a7a3a','#3f9a4a','#1e6a30','#4aa040'][k%4],ord:'YXZ'})}
      if(R()<.12){const hh=.5+R()*.4;helS.push({x,y:y+hh/2,z,sx:.025,sy:hh,sz:.025,c:'#3f7a2a'});const red=R()<.6;for(let k=0;k<5;k++)heli.push({x:x+(k%2?.05:-.05),y:y+hh-.05-k*.09,z,sx:.035,sy:.13,sz:.035,rz:(k%2?1:-1)*1.0,c:red?(k%2?'#d9302a':'#e8452a'):'#f2b51a'})}
      if(R()<.2){const f={x:x+(R()-.5)*.4,y:y+s*.9,z:z+(R()-.5)*.4};flowers.push({...f,sx:.07,sy:.07,sz:.07,c:['#e0405a','#f08a3a','#f2d24a','#d35aa8','#ffffff'][i%5]});c.flowers.push(f)}}
    instanced(DG.fern,DM.tuft,ferns,c.decor);instanced(DG.leaf,DM.leaf,leaves,c.decor,false);instanced(DG.cone,DM.white,flowers,c.decor,false);
    instanced(DG.trunk,DM.white,helS,c.decor,false);instanced(DG.leaf,DM.leaf,heli,c.decor,false);for(let i=0;i<heli.length;i+=5)c.flowers.push({x:heli[i].x,y:heli[i].y,z:heli[i].z});
    // --- siv og gress langs elvebreddene og i gjørma ---
    const reeds=[];for(let i=0;i<14000&&reeds.length<1600;i++){const x=(R()-.5)*94,z=(R()-.5)*94,rd=rivD(x,z),mf=dMud(x,z)<MUDF_R+1,dl=dDel(x,z)<DELTA_R+2;
      if(!(rd>-.5&&rd<1.6)&&!mf&&!(dl&&R()<.3))continue;const y=H(x,z);if(y<WATER-.2||c.dist(x,z)<1.5||c.pools.some(p=>Math.hypot(p.x-x,p.z-z)<p.r*.8))continue;
      for(let k=0;k<3;k++)reeds.push({x:x+(R()-.5)*.25,y:y-.02,z:z+(R()-.5)*.25,sx:.04,sy:.55+R()*.75,sz:.04,rx:(R()-.5)*.4,rz:(R()-.5)*.4,c:['#6d8a3a','#8a9a4a','#5a6b2a','#9aa058'][(i+k)%4]});
      if(R()<.12){const f={x,y:y+.9,z};c.flowers.push(f)}}   // øyenstikkere og sommerfugler svirrer her
    instanced(DG.tuft,DM.tuft,reeds,c.decor,false);
    // --- vannliljer og kjempevannliljer (med opprett kant) på stille vann ---
    const pads=[],rims=[],lily=[];
    for(let i=0;i<9000&&pads.length<260;i++){const x=(R()-.5)*94,z=(R()-.5)*94;let wl=WL(x,z);if(wl<H(x,z)+.08||Math.hypot(x,z)>isl(x,z)-4||c.dist(x,z)<1.4||fordNear(x,z))continue;
      const pool=c.pools.find(p=>Math.hypot(p.x-x,p.z-z)<p.r);if(pool&&pool.mud)continue;if(!pool&&rivD(x,z)>-.25&&dDel(x,z)>DELTA_R+2)continue;
      if(R()<.16&&rivD(x,z)<-.8){const r=.45+R()*.35;rims.push({x,y:wl+.012,z,sx:r,sy:.05,sz:r,c:mix('#4a7a2a','#6a8a34',R())});pads.push({x,y:wl+.03,z,sx:r*.93,sy:.004,sz:r*.93,c:mix('#3f6e26','#56883a',R())})}
      else{const r=.12+R()*.12;pads.push({x,y:wl+.008,z,sx:r,sy:.004,sz:r,c:mix('#3a6a28','#5f8f3a',R())});if(R()<.25){const f={x,y:wl+.05,z};lily.push({...f,sx:.045,sy:.035,sz:.045,c:R()<.5?'#f4c4d8':'#ffffff'})}}}
    instanced(DG.trunk,DM.white,rims,c.decor,false);instanced(DG.canopy,DM.white,pads,c.decor,false);instanced(DG.cone,DM.white,lily,c.decor,false);
    // --- termittuer: høye tuer av rød jord ---
    const mounds=[];for(let i=0;i<3000&&mounds.length<22;i++){const x=(R()-.5)*80,z=(R()-.5)*80;if(!inJungle(x,z)||c.dist(x,z)<2.6||c.nearGate(x,z,2.4)||!c.free(x,z,.8)||rivD(x,z)<3||rH(x,z)<HILL_R+1||c.trees.some(t=>Math.hypot(t.x-x,t.z-z)<1.2)||mounds.some(m=>Math.hypot(m.x-x,m.z-z)<6))continue;
      const y=H(x,z),h=.7+R()*.6;mounds.push({x,z});c.colliders.push({x,z,r:.32});for(let k=0;k<3;k++){const a=R()*6.28,d=k?.18:0;mounds.push({x:x+Math.cos(a)*d,z:z+Math.sin(a)*d,y:y-.05,sx:.32-k*.06,sy:h*(1-k*.25),sz:.32-k*.06,ry:R()*3,c:mix('#8a5a32','#a8704a',R()),part:1})}}
    instanced(DG.fern,DM.white,mounds.filter(m=>m.part),c.decor);
    // --- bakketåke i jungelen og over gjørma, og solstråler gjennom løvtaket ---
    for(let i=0;i<70;i++){const x=(R()-.5)*88,z=(R()-.5)*88;if(Math.hypot(x,z)>isl(x,z)-6)continue;const wet=dMud(x,z)<MUDF_R+3||dDel(x,z)<DELTA_R+2||rivD(x,z)<2;if(!wet&&!inJungle(x,z))continue;c.fx.push({type:'mist',x,z,y:H(x,z)+.7+R()*.6,s:4+R()*5})}
    for(let i=0,n=0;i<600&&n<26;i++){const t=c.trees[Math.floor(R()*c.trees.length)];if(!t)break;const a=R()*6.28,x=t.x+Math.cos(a)*1.6,z=t.z+Math.sin(a)*1.6;if(c.dist(x,z)>7)continue;c.fx.push({type:'beam',x,z,y:H(x,z),h:7+R()*3,w:1.3+R()*1.1});n++}
    c.props();
    c.pebbles(700,['#5a5648','#6f6a5a','#4a463c'],.04,.1);
    c.tufts(220,['#4d7a2f','#6b9a3c','#3a6a28']);
    c.bushes(120,['#2f6a2c','#3e7a34','#4f8f3c','#2a5a26'],(x,z)=>inJungle(x,z)&&rivD(x,z)>2);
    c.mushrooms(90,(x,z)=>inJungle(x,z));c.shells(160);
    // --- drivved på stranden ---
    for(let i=0;i<20;i++){const a=R()*6.28,Rr=isl(Math.cos(a),Math.sin(a))-8+R()*3,x=Math.cos(a)*Rr,z=Math.sin(a)*Rr;if(c.dist(x,z)<1.6||H(x,z)<WATER+.1)continue;const b=R()*6.28,len=.8+R()*1.4;log(x,z,x+Math.sin(b)*len,z+Math.cos(b)*len,.06+R()*.05,S.BARK,()=>'#9a8468')}
  }}
);
})();
