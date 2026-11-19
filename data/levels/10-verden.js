// Tromøya: åpen verden (120 × 120). Fri kjøring med basen i midten og sju løyper spredt rundt på øya.
// Biomer: regnskog i øst, sump i sørøst, strand i sør, canyon/ørken i vest, snøfjell i nord. Bekken renner fra tjernet
// på fjellet, over fossen, gjennom canyonen og ut i havet. Løypene registreres med c.course(...) og testes hver for seg:
//   node tools/test-levels.js verden
(function(){
const DEG=Math.PI/180;
const smt=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const lineD=(L,x,z)=>{let m=1e9;for(let i=0;i<L.length-1;i++){const a=L[i],b=L[i+1],ex=b[0]-a[0],ez=b[1]-a[1],L2=ex*ex+ez*ez||1e-9;let t=((x-a[0])*ex+(z-a[1])*ez)/L2;t=t<0?0:t>1?1:t;m=Math.min(m,Math.hypot(x-a[0]-ex*t,z-a[1]-ez*t))}return m};
// ---------- geografi ----------
const M=[-4,24];                                                   // fjelltoppen
const rM=(x,z)=>Math.hypot(x-M[0],z-M[1]), aM=(x,z)=>Math.atan2(z-M[1],x-M[0])/DEG;
const polM=(r,d)=>[M[0]+r*Math.cos(d*DEG),M[1]+r*Math.sin(d*DEG)];
const mount=r=>{const u=Math.max(0,Math.min(1,(24-r)/20));return 8.6*(u*u*(3-2*u)*.3+u*.7)+.8*smt((4.5-r)/4.5)};
const isl=(x,z)=>{const a=Math.atan2(z,x);return 50+3*Math.sin(3*a+1)+2*Math.sin(7*a+2)};
const BASE=[0,-6], BASE_R=9;                                       // basen: flat dal med gammel flystripe
const SW=[-24,-22], SW_R=12;                                       // sumpen
const dSw=(x,z)=>Math.hypot(x-SW[0],z-SW[1]);
const inDesert=(x,z)=>x>14&&z>-30&&rM(x,z)>21;
const inJungle=(x,z)=>x<-10&&z<16&&rM(x,z)>22&&dSw(x,z)>SW_R+2;
// bekken: tjern på fjellet → foss → canyon (oase) → havet i vest
const TARN=polM(8.5,22);
const STREAM=[TARN,polM(10.2,20),polM(12,17),polM(13.4,14),polM(15.6,12),polM(18.5,8),[20,22],[27,17],[33,11],[38,2],[44,-5],[50,-11],[56,-15]];
const CLIFF=(x,z)=>{const r=rM(x,z),a=aM(x,z);return smt((13.6-r)/1.4)*smt((r-12)/1.0)*smt((a-2)/8)*smt((26-a)/8)};
const OASIS=[33,11];
// isbreen: en tunge av snø og is ned nordsiden av fjellet, der Issvingen går
const GLACIER=(x,z)=>{const r=rM(x,z),a=aM(x,z);return smt((a-62)/6)*smt((120-a)/6)*smt((27-r)/3)*smt((r-11)/2)};
// ---------- løypene ----------
const CH=[
 {id:'jungel',name:'Jungelstien',diff:1,gates:8,desc:'Gjørmesti under urgamle trær. Papegøyer og aper følger med.',
  path:[[-22,-8],[-27,-12],[-33,-8],[-38,0],[-34,7],[-27,6],[-21,1],[-18,-3]],surf:S.DIRT,skip:S.MUD},
 {id:'sump',name:'Sumpen',diff:2,gates:8,desc:'Dyp gjørme, siv og tåke. Hold farten oppe, ellers synker du.',
  path:[[-14,-22],[-19,-27],[-24,-31],[-30,-27],[-32,-20],[-27,-15],[-20,-17]],surf:S.MUD,hw:1.3},
 {id:'strand',name:'Strandsprinten',diff:1,gates:10,desc:'Høyt gir langs vannkanten, med tre hopp. Måkene letter når du kommer.',
  path:[[-8,-38],[0,-40],[8,-39],[16,-40],[24,-38],[29,-34]],surf:S.SAND},
 {id:'canyon',name:'Canyonkrabbingen',diff:3,gates:10,desc:'Rød stein, trange passasjer og en oase. Lavt gir og tålmodighet.',
  path:[[24,-20],[30,-16],[34,-9],[39,-2],[36,6],[30,3],[26,-5],[22,-12]],surf:S.GRAVEL,hw:1.1},
 {id:'is',name:'Issvingen',diff:2,gates:10,desc:'Ned isbreen på nordsiden og opp igjen gjennom snøen. Glatt som såpe. Avkjøring fra Toppturen.',
  path:[polM(17.6,66),polM(19,74),polM(21.5,82),polM(22.6,92),polM(22.2,102),polM(21.4,110),polM(20.6,116),polM(18.6,118),polM(17.2,112),polM(17,102)],hw:1.3},
 {id:'topp',name:'Toppturen',diff:3,gates:14,desc:'Spiralveien til toppen: over hengebroa ved fossen, gjennom snøen og opp på selve tinden.',
  path:(()=>{const p=[[0,6]];for(let d=-80;d<=380;d+=12){const r=20-15.2*(d+80)/460;p.push(polM(r,d))}p.push(polM(2.5,400),polM(1,440));return p})(),hw:1.3,blend:1.8},
 {id:'natt',name:'Nattløpet',diff:2,gates:8,night:true,desc:'En kort runde rundt basen etter mørkets frembrudd. Lysene på!',
  path:[[6,-13],[12,-17],[9,-25],[0,-27],[-8,-21],[-5,-15],[1,-13]],surf:S.GRAVEL},
];
// hovedveiene fra basen ut til løypene
const ROADS=[
 [[0,-10],[0,-1],[0,6]],                     // nord: Toppturen
 [[-6,-8],[-14,-8],[-22,-8]],                // øst: Jungelstien
 [[-5,-11],[-10,-17],[-14,-22]],             // sørøst: Sumpen
 [[1,-13],[-2,-28],[-6,-34],[-8,-38]],        // sør: stranden
 [[7,-9],[16,-13],[24,-20]],                  // vest: canyonen
 [[29,-34],[31,-29],[28,-24],[24,-20]],        // kystveien mellom stranden og canyonen
 [[-12,-8],[-13,-2],[-16,5],[-20,11],[-23.5,16.5],[-26.5,22.1]],   // nordøst: langs jungelen til marinaen
];

LEVELS.push(
{ id:'verden', name:'Tromøya', diff:2, seed:4242, size:120, world:true,
  desc:'Hele øya i fri kjøring. Basen i midten, sju løyper rundt omkring. Kjør bort til en startstrek for å begynne.',
  start:[0,-11,0],
  // kaldt lys på fjellet …
  sky:['#3f7cc4','#d4e4f0'], fog:0xdde5ec, fogNear:14, fogFar:70, sun:0xf4f6ff, sunI:.85, hemi:[0xe8eef5,0x5a6068,.7], sunDir:[-14,22,-18], rockCol:'#6f6c68',
  // … og varmt nede på øya
  alt:{fog:0xcfe0e6, fogNear:34, fogFar:120, sun:0xfff0d0, sunI:1.1, hemi:[0xd6ebff,0x4e5a3a,.6]},
  zone:(x,z)=>smt((17-rM(x,z))/6),
  water:.3, waterCol:'#1f6f86', waterOpacity:.85,
  waterBand:(x,z)=>Math.hypot(x,z)>isl(x,z)-4||dSw(x,z)<SW_R+3||lineD(STREAM,x,z)<2.8||Math.hypot(x-TARN[0],z-TARN[1])<3.2,
  snow:true, precip:(x,z)=>Math.max(smt((12.5-rM(x,z))/5),GLACIER(x,z)), wind:true, ambience:'jungle',
  biome:(x,z)=>{const r=rM(x,z);return{snow:smt((15-r)/5),jungle:inJungle(x,z)?1:0,swamp:smt((SW_R+4-dSw(x,z))/6),beach:smt((Math.hypot(x,z)-(isl(x,z)-12))/5),desert:inDesert(x,z)?1:0}},
  path:[[0,-10],[4,-7],[0,-3],[-4,-7],[0,-10]], challenges:CH, roads:ROADS, basePos:BASE, garageAt:[BASE[0],BASE[1]-.2], airport:{at:[33.5,-33.5],dir:315,len:38,end:1,road:[[24,-24]]}, village:{at:[29.1,24.4],out:165},
  marina:{at:[-36.5,30.5]},   // Captain Theis' marina: parker på den blå ruta, så kan du låne en motorbåt (js/boat.js)
  mapLabels:[[-30,-2,'Jungelen'],[-24,-30,'Sumpen'],[8,-45,'Stranden'],[36,-14,'Canyonen'],[-4,24,'Snøfjellet'],[0,-6,'Basen'],[33,12,'Oasen'],[31,30,'Landsbyen'],[-1,46,'Isbreen'],[-41,37,'Marinaen']],
  animals:{parrots:14,circling:3,monkeys:9,butterflies:40,crabs:10,crabsAt:[-4,-41],eagle:M,bear:[polM(19,150),polM(21,120)],gulls:{at:[12,-41],n:7},
    deer:[{at:[-18,10],r:7,n:3},{at:[14,20],r:6,n:2}],rabbits:[{at:[-10,-14],r:6,n:4},{at:[10,-30],r:5,n:3}],fish:[{at:[33,11],r:2.5,n:2},{at:[26,34],r:6,n:3},{at:[-8,-44],r:6,n:2}],lizards:[{at:[34,-12],r:8,n:6}]},
  base(x,z,n){const r=rM(x,z),ri=isl(x,z),R=Math.hypot(x,z),ds=lineD(STREAM,x,z),sw=dSw(x,z);
    let h=1.0+.5*fbm(n,x*.035,z*.035,3)+.08*fbm(n,x*.3,z*.3,2);
    h-=2.4*smt((R-ri+2)/4);                                                   // havet
    h+=mount(r)+.3*fbm(n,x*.2,z*.2,3)*smt((24-r)/5)+.16*Math.max(0,Math.sin(r*1.6+n(x*.3,z*.3)))*smt((20-r)/3)*smt((r-8)/3);   // fjellet
    h+=1.6*CLIFF(x,z);                                                        // klippen fossen faller over
    h-=.55*smt((SW_R-sw)/6)*(1-.3*n(x*.25,z*.25));                             // sumpen: lav og våt
    if(inDesert(x,z))h+=.35*fbm(n,x*.09,z*.09,3)+.25*smt((R-30)/10);          // ørkenen: tørre bølger
    {const ff=smt(1-Math.hypot(x-OASIS[0],z-OASIS[1])/4);h+=(1.0-h)*ff*.6}     // oasen
    const fd=smt(1-Math.hypot(x-38,z-1.5)/3.5);h+=(.95-h)*fd;                    // vadestedet i canyonen
    if(ds<2.6&&r>10.5)h-=(.9+.4*smt((r-20)/4))*(1-(ds/2.6)**2)*(1-.5*CLIFF(x,z))*(1-.45*fd);   // bekkedalen
    {const d=Math.hypot(x-TARN[0],z-TARN[1]);if(d<3.2)h-=.6*(1-(d/3.2)**2)}       // tjernet
    return h},
  surf(x,z,n){const r=rM(x,z),ri=isl(x,z),R=Math.hypot(x,z);
    if(GLACIER(x,z)>.5){const a=aM(x,z);return n(x*.6+7,z*.6)>(a<96?.5:.72)?S.ICE:S.SNOW}   // isbreen: mest is på vei ned
    if(R>ri-12)return S.SAND;
    if(lineD(STREAM,x,z)<2.8)return S.GRAVEL;
    if(r<12.5+1.2*n(x*.5,z*.5))return r<11.5&&n(x*.7+3,z*.7)>.64?S.ICE:S.SNOW;
    if(r<16)return n(x*.5,z*.5)>.5?S.ROCK:S.GRAVEL;
    if(r<21)return n(x*.4+5,z*.4)>.55?S.GRAVEL:S.DIRT;
    if(dSw(x,z)<SW_R+2){const v=n(x*.3+9,z*.3);return v>.6?S.BOG:v>.42?S.MUD:S.GRASS}
    if(inDesert(x,z))return Math.abs(x-38)+Math.abs(z-1.5)<5?S.GRAVEL:n(x*.3,z*.3)>.55?S.GRAVEL:S.SAND;
    return n(x*.4+5,z*.4)>.68?S.MUD:S.GRASS},
  build(c){const R=c.rng,def=this;
    // --- basen: flat dal med flystripe; toppen: en liten flat tind ---
    c.flat(BASE[0],BASE[1],BASE_R,1.1,4);
    c.flat(M[0],M[1],2.6,H(M[0],M[1])-.5,3.8);
    for(let x=-11;x<=11;x+=.5)for(let z=-2.5;z<=2.5;z+=.5)paint(BASE[0]+x,BASE[1]+z-3,.45,S.ASPHALT);
    // --- verkstedet: hall med to porter, kontor, lysmaster, radiomast, løftebukk, mekanikere, dekkstabler og tønner ---
    {const bx=BASE[0],bz=BASE[1]+4.2,y=1.1;                                  // hallen står nord på flaten, portene vender mot flystripa (sør)
      c.box(bx,y,bz,7.4,.1,5.2,'#3a3a3a');c.box(bx,y,bz,7.0,2.6,4.8,'#6f7f8a');c.box(bx,y+2.6,bz,7.6,.25,5.4,'#3f4a52');c.box(bx,y+2.85,bz+.3,7.0,.12,4.2,'#8a2f22');
      for(const dx of[-1.9,1.9]){c.box(bx+dx,y,bz-2.42,2.2,2.0,.1,'#1d1c1a');c.box(bx+dx,y+2.0,bz-2.42,2.4,.14,.16,'#e5a92b');for(let k=0;k<5;k++)c.box(bx+dx,y+.2+k*.42,bz-2.46,2.2,.04,.04,'#3a3a3a')}
      c.box(bx,y+1.2,bz-2.5,.9,.7,.05,'#1a262d');c.box(bx,y+2.3,bz-2.5,3.6,.5,.08,'#e5a92b');c.box(bx,y+2.3,bz-2.55,3.2,.3,.02,'#14120e');  // vindu og skilt
      c.box(bx+5.2,y,bz-.6,2.6,2.1,3.0,'#8a7f70');c.box(bx+5.2,y+2.1,bz-.6,2.9,.2,3.3,'#4a4038');c.box(bx+5.2,y+1.0,bz-2.12,1.2,.7,.05,'#1a262d');   // kontoret
      c.cyl(bx+7.6,y,bz+1.2,.09,7.5,'#9a9a96');c.box(bx+7.6,y+7.5,bz+1.2,.5,.5,.5,'#d9432f');for(let k=0;k<3;k++)c.box(bx+7.6,y+2+k*1.8,bz+1.2,1.4-k*.3,.05,.05,'#9a9a96');   // radiomast
      for(const[mx,mz]of[[bx-9,bz-7.5],[bx+9,bz-7.5],[bx-9,bz-1],[bx+9,bz-1]]){c.cyl(mx,y,mz,.07,3.6,'#5a5a58');c.box(mx,y+3.5,mz,.6,.22,.3,'#2a2a2a');c.box(mx,y+3.42,mz,.5,.06,.22,'#fff3c0');c.fx.push({type:'lamp',x:mx,y:y+3.4,z:mz})}   // lysmaster (lyser om natta)
      c.box(bx-3.2,y,bz-4.4,1.9,.12,3.2,'#4a4a48');for(const dz of[-1.2,1.2]){c.box(bx-3.2,y+.12,bz-4.4+dz,1.9,.08,.25,'#e5a92b')}for(const dx of[-.6,.6])for(const dz of[-1,1])c.cyl(bx-3.2+dx,y+.2,bz-4.4+dz,.08,.9,'#5a5a58');   // løftebukk
      const guy=(gx,gz,col,ry)=>{c.cyl(gx,y,gz,.09,.42,'#2c4a6b');c.cyl(gx,y+.4,gz,.13,.32,col);c.cyl(gx,y+.74,gz,.09,.17,'#d9a07a');c.box(gx,y+.9,gz,.22,.06,.22,'#e5a92b',ry);c.colliders.push({x:gx,z:gz,r:.18})};
      guy(bx-3.9,bz-6.4,'#e5a92b',.3);guy(bx+2.6,bz-5.2,'#d9432f',1.2);guy(bx+4.2,bz-3.6,'#2c4a6b',2.4);
      for(let k=0;k<4;k++)c.cyl(bx+3.6,y+k*.17,bz-6.8,.24,.16,'#1a1918');for(let k=0;k<3;k++)c.cyl(bx+4.2,y+k*.17,bz-6.6,.24,.16,'#1a1918');   // dekkstabler
      for(const[ox,oz,col]of[[bx-5.4,bz-5.6,'#d9432f'],[bx-5.8,bz-5.2,'#2c4a6b'],[bx-5.5,bz-4.9,'#e5a92b']])c.cyl(ox,y,oz,.17,.44,col);   // tønner
      c.box(bx-7.2,y,bz-5.8,.6,.9,.35,'#d9432f');c.box(bx-7.2,y+.9,bz-5.8,.5,.3,.25,'#1d1c1a');   // bensinpumpe
      for(let k=-10;k<=10;k+=2.5)c.box(bx+k,y,bz-7.2,1.2,.02,.14,'#f2e8d0');c.box(bx-11,y,bz-7.2,.14,.02,5,'#f2e8d0');c.box(bx+11,y,bz-7.2,.14,.02,5,'#f2e8d0');   // striper på flystripa
      c.cyl(bx-8.5,y,bz-10.8,.04,2.4,'#9a9a96');c.box(bx-8.2,y+2.0,bz-10.8,.6,.36,.03,'#e5a92b');   // flaggstang
      for(const[ox,oz]of[[bx-5,bz+.5],[bx-4.6,bz-1.5],[bx+1.2,bz+3.4],[bx+2.0,bz+3.2]])c.colliders.push({x:ox,z:oz,r:.3});
      c.block(bx,bz,6);c.block(bx+5.2,bz-.6,2.4)}
    // --- veier og løyper (før alt annet, så steiner og trær holder seg unna) ---
    for(const r of ROADS)c.road(r,{hw:1.3,blend:1.7,surf:S.DIRT,skip:S.MUD});
    for(const ch of CH)c.course(ch);
    const topp=c.courses.find(k=>k.id==='topp'),strand=c.courses.find(k=>k.id==='strand'),sump=c.courses.find(k=>k.id==='sump'),jungel=c.courses.find(k=>k.id==='jungel'),canyon=c.courses.find(k=>k.id==='canyon');
    // --- tjernet, bekken som kulper, fossekulpen, oasen ---
    c.pond(TARN[0],TARN[1],2.4,.3,{fill:.7,bed:S.GRAVEL});
    for(let i=1;i<6;i++){const a=STREAM[i],b=STREAM[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let k=0;k<L;k+=2.6){const u=k/L,x=a[0]+(b[0]-a[0])*u,z=a[1]+(b[1]-a[1])*u,r=rM(x,z);
      if(r<11||CLIFF(x,z)>.05||c.dist(x,z)<2.4)continue;c.pond(x,z,1.1,.22,{fill:.55,bed:S.GRAVEL})}}
    const FOOT=polM(12.2,13);c.pond(FOOT[0],FOOT[1],1.7,.3,{fill:.6,bed:S.GRAVEL});
    c.pond(OASIS[0],OASIS[1],2.6,.5,{fill:.8,bed:S.GRAVEL});
    // --- hengebroa der Toppturen krysser bekken ---
    {const X=polM(16.9,10),tau=[-Math.sin(10*DEG),Math.cos(10*DEG)];c.bridge(X[0]-tau[0]*3.2,X[1]-tau[1]*3.2,X[0]+tau[0]*3.2,X[1]+tau[1]*3.2,1.1,{sag:.2})}
    // --- jungel: hjulspor, søledammer, røtter, veltet stamme ---
    const bark=(u,d)=>d>.8?'#3d2a1a':mix('#5a3f28','#7a5638',G.noise(u*30,d*4));
    for(const[t,off,r]of[[.15,.3,.8],[.3,-.4,.7],[.5,.3,.9],[.7,-.3,.8]]){const p=jungel.P(t),s=jungel.side(t);if(jungel.nearGate(p.x+s.x*off,p.z+s.z*off,1.3))continue;c.pond(p.x+s.x*off,p.z+s.z*off,r,.13,{fill:.55,mud:true,bed:S.MUD})}
    {const t=.42,p=jungel.P(t),s=jungel.side(t);log(p.x-s.x*2.2,p.z-s.z*2.2,p.x+s.x*2.2,p.z+s.z*2.2,.13,S.BARK,bark)}
    for(let i=0;i<40;i++){const t=R(),p=jungel.P(t),s=jungel.side(t),b=(R()-.5)*2.4;if(jungel.nearGate(p.x,p.z,1.3))continue;const a=R()*6.28,len=.5+R()*1.2,x0=p.x+s.x*b,z0=p.z+s.z*b;
      if(R()<.5)log(x0,z0,x0+Math.sin(a)*len,z0+Math.cos(a)*len,.035+R()*.03,S.BARK,()=>'#4e3a28');else rock(x0,z0,.2+R()*.25,.1+R()*.14,{ang:R()*6.3})}
    // --- sumpen: gjørmehull på løypa ---
    for(const t of[.2,.45,.7,.88]){const p=sump.P(t);if(sump.nearGate(p.x,p.z,1.5))continue;c.pond(p.x,p.z,2.1,.17,{fill:.55,bog:true})}
    // --- stranden: tre hopp ---
    for(const t of[.25,.5,.75]){const p=strand.P(t),an=strand.ang(t);c.block(p.x,p.z,3);shape(p.x,p.z,an,3.2,2.6,(a,b)=>{const u=(a+1.6)/3.2;if(u<.08)return u/.08*.02;if(u<.88)return .02+(u-.08)/.8*.42;return null},S.DIRT,(a,b)=>mix('#6d4b2d','#8d6a44',G.noise(a*3,b*3)*.7+(Math.abs(b)>1.1?.5:0)))}
    // --- canyonen: mesaer av rød stein, kaktus, steiner på løypa ---
    const MESAS=[[28,-24,4,3.2],[36,-18,5,4.0],[44,-8,4.5,3.6],[42,4,5,4.4],[32,-6,3.2,2.6],[26,2,3.6,3.0],[20,-4,2.8,2.4],[48,-18,3.5,3.0],[36,12,3.4,2.8],[46,14,4,3.4]];
    for(const[x,z,r,h]of MESAS){const ax=1+R()*.5;if(c.dist(x,z)<r*ax+1.8)continue;rock(x,z,r,h,{sharp:.18,nz:.25,ax,ang:R()*6.3,surf:S.REDROCK});for(let k=0;k<4;k++){const a2=k*1.57+.4;c.anchor(x+Math.cos(a2)*r*ax*.9,z+Math.sin(a2)*r*.9)}rock(x+(R()-.5)*r,z+(R()-.5)*r,r*.55,h*.3,{sharp:.3,nz:.3,surf:S.REDROCK});c.block(x,z,r*1.5)}
    for(let i=0;i<26;i++){const t=.05+R()*.9,p=canyon.P(t),s=canyon.side(t),b=(R()-.5)*2.2;if(canyon.nearGate(p.x,p.z,1.4))continue;rock(p.x+s.x*b,p.z+s.z*b,.3+R()*.35,.16+R()*.2,{ang:R()*6.3,surf:S.REDROCK})}
    // --- store steiner over hele øya ---
    const near=(x,z,m)=>c.dist(x,z)<m;
    for(let i=0;i<360;i++){const x=(R()-.5)*104,z=(R()-.5)*104,r=.5+R()*1.6,h=.4+R()*1.2,rr=rM(x,z),ax=1+R()*.6,Rx=r*ax;
      if(rr<2.6||Math.hypot(x,z)>isl(x,z)-6||near(x,z,Rx+1.6)||c.nearGate(x,z,Rx+1.6)||!c.free(x,z,Rx+.8)||Math.hypot(x-BASE[0],z-BASE[1])<BASE_R+Rx+2||c.pools.some(p=>Math.hypot(p.x-x,p.z-z)<p.r+Rx+.6)||lineD(STREAM,x,z)<Rx+2.6)continue;
      const red=inDesert(x,z);rock(x,z,r,h*(rr<16?1.1:red?.9:.6),{ang:R()*6.3,ax,surf:rr<11?S.SNOW:red?S.REDROCK:S.ROCK});if(r>1.0)c.anchor(x,z)}
    for(let i=0;i<30;i++){const t=.3+R()*.68,p=topp.P(t),s=topp.side(t),b=(R()-.5)*2.2;if(topp.nearGate(p.x,p.z,1.4)||lineD(STREAM,p.x,p.z)<4)continue;rock(p.x+s.x*b,p.z+s.z*b,.3+R()*.3,.14+R()*.18,{ang:R()*6.3})}
    for(let i=0;i<10;i++){const t=.8+R()*.17,p=topp.P(t),tn=topp.T(t);if(topp.nearGate(p.x,p.z,1.4))continue;rock(p.x+tn.x*(R()-.5),p.z+tn.z*(R()-.5),.9+R()*.6,.06+R()*.05,{ang:topp.ang(t)+1.57,ax:2.2,sharp:1.2,nz:.15,surf:S.SNOW})}
    // --- trær: regnskog i øst, før finish ---
    const slope=(x,z)=>Math.abs(H(x+.5,z)-H(x-.5,z))+Math.abs(H(x,z+.5)-H(x,z-.5));
    const trunkOK=(x,z,r,minPath)=>!(near(x,z,minPath)||c.nearGate(x,z,2.2)||Math.hypot(x,z)>isl(x,z)-8||lineD(STREAM,x,z)<3.2||c.pools.some(p=>Math.hypot(p.x-x,p.z-z)<p.r+1.2)||c.trees.some(t=>Math.hypot(t.x-x,t.z-z)<r+t.r+1.6)||slope(x,z)>.4);
    for(let i=0;i<9000&&c.trees.length<150;i++){const x=-50+R()*44,z=-44+R()*60;if(!inJungle(x,z)||!trunkOK(x,z,.3,2.4))continue;c.tree(x,z,{h:4.5+R()*4,r:.2+R()*.18})}
    {const p=polM(14.6,14);c.secret(p[0],p[1],'Bak fossen')}c.secret(44,-8,'Oppå mesaen');c.secret(33,-30,'Sandbanken');{const p=polM(25,100);c.secret(p[0],p[1],'Nederst på isbreen')}c.secret(M[0],M[1],'På tinden');
    c.finish();
    c.forest();
    // --- fossen ---
    {const top=polM(13.8,13),pool=c.pools.find(p=>Math.hypot(p.x-FOOT[0],p.z-FOOT[1])<.1),yT=H(top[0],top[1])+.1,ang=Math.atan2(FOOT[0]-top[0],FOOT[1]-top[1]);c.fall(top[0],top[1],ang,2.6,yT,pool.level,{spray:false})}
    // --- grantrær på fjellsiden ---
    const trunks=[];
    for(let i=0;i<4000&&trunks.length<90;i++){const x=M[0]+(R()-.5)*50,z=M[1]+(R()-.5)*50,rr=rM(x,z);if(rr<12.5||rr>23||near(x,z,2.4)||c.nearGate(x,z,2.4)||lineD(STREAM,x,z)<3||!c.free(x,z,1)||trunks.some(q=>Math.hypot(q.x-x,q.z-z)<1.8)||c.trees.some(t=>Math.hypot(t.x-x,t.z-z)<1.8)||slope(x,z)>.5)continue;
      const h=1.8+R()*1.6;trunks.push({x,z});c.plant('gran',x,z,{h,snow:rr<14.5?.9:rr<16?.35:0,ry:R()*6.28})}   // js/props/gran.js: snø høyt oppe, grønn lenger ned
    c.plants();
    // --- palmer langs strendene og ved oasen ---
    const palms=[];
    for(let i=0;i<3000&&palms.length<70;i++){const x=(R()-.5)*110,z=(R()-.5)*110,Rr=Math.hypot(x,z),oa=Math.hypot(x-OASIS[0],z-OASIS[1]);
      if(!(Rr>isl(x,z)-11&&Rr<isl(x,z)-4.5)&&!(oa>3&&oa<6))continue;
      if(near(x,z,2.5)||c.nearGate(x,z,2.5)||!c.free(x,z,1.2)||c.pools.some(p=>Math.hypot(p.x-x,p.z-z)<p.r+1.6)||lineD(STREAM,x,z)<3||slope(x,z)>.3||H(x,z)<def.water+.3)continue;
      if(palms.some(q=>Math.hypot(q.x-x,q.z-z)<2.4)||c.trees.some(t=>Math.hypot(t.x-x,t.z-z)<1.6))continue;palms.push({x,z,h:2.8+R()*1.8,lean:(R()-.5)*.35})}
    for(const q of palms)c.plant('palme',q.x,q.z,{h:q.h,lean:q.lean});c.plants();   // js/props/palme.js
    // --- kaktus i ørkenen ---
    const cacti=[];
    for(let i=0;i<2500&&cacti.length<60;i++){const x=14+R()*44,z=-30+R()*52;if(!inDesert(x,z)||near(x,z,2.2)||c.nearGate(x,z,2.2)||!c.free(x,z,.8)||lineD(STREAM,x,z)<3.5||slope(x,z)>.35||Math.hypot(x,z)>isl(x,z)-7)continue;
      if(cacti.some(q=>Math.hypot(q.x-x,q.z-z)<2.2))continue;const h=.6+R()*.9,y=H(x,z);cacti.push({x,z});
      const ids=[c.cyl(x,y,z,.11,h,'#3f7a3a')];for(const sd of[-1,1])if(R()<.7){ids.push(c.cyl(x+sd*.22,y+h*.45,z,.07,h*.4,'#3f7a3a'),c.cyl(x+sd*.14,y+h*.45,z,.07,.16,'#3f7a3a',{rz:1.57}))}
      c.breakable(x,z,.16,ids)}   // kaktusene knekker når bilen treffer dem
    // --- bregner, blomster og underskog i jungelen; siv i sumpen ---
    const ferns=[],flowers=[],leaves=[],reeds=[];c.flowers=[];
    for(let i=0;i<5000&&ferns.length<480;i++){const x=-52+R()*46,z=-46+R()*64;if(!inJungle(x,z)||near(x,z,1.6)||lineD(STREAM,x,z)<2.6||c.pools.some(p=>Math.hypot(p.x-x,p.z-z)<p.r))continue;const s=.3+R()*.5;
      ferns.push(c.plant('bregne',x,z,{s,palett:1,c:['#2f7a2c','#3e8f35','#1f6a2a','#58a03a'][i%4]}));
      if(R()<.4)leaves.push({x:x+(R()-.5)*.8,y:H(x,z)+.02,z:z+(R()-.5)*.8,sx:.28+R()*.2,sy:.6+R()*.6,sz:.1,rx:.5+R()*.6,ry:R()*6.28,c:['#2a7a3a','#3f9a4a','#1e6a30'][i%3],ord:'YXZ'});
      if(R()<.22){const f={x:x+(R()-.5)*.4,y:H(x,z)+s*.62,z:z+(R()-.5)*.4};flowers.push({...f,sx:.07,sy:.07,sz:.07,c:['#e0405a','#f08a3a','#f2d24a','#d35aa8'][i%4]});c.flowers.push(f)}}
    for(let i=0;i<4000&&reeds.length<700;i++){const x=SW[0]+(R()-.5)*2*(SW_R+3),z=SW[1]+(R()-.5)*2*(SW_R+3);const d=dSw(x,z);if(d>SW_R+2||near(x,z,1.5)||H(x,z)>def.water+.5)continue;
      reeds.push({x,y:H(x,z)-.02,z,sx:.045,sy:.7+R()*.8,sz:.045,rx:(R()-.5)*.4,rz:(R()-.5)*.4,c:['#6d8a3a','#8a9a4a','#5a6b2a'][i%3]});
      if(R()<.08){const f={x,y:H(x,z)+.9,z};c.flowers.push(f)}}   // øyenstikkere svirrer her
    c.plants();instanced(DG.leaf,DM.leaf,leaves,c.decor,false);instanced(DG.cone,DM.white,flowers,c.decor,false);instanced(DG.tuft,DM.tuft,reeds,c.decor,false);
    // --- tåke i sumpen og rundt toppen ---
    for(let i=0;i<40;i++){const a=R()*6.28,d=R()*SW_R;c.fx.push({type:'mist',x:SW[0]+Math.cos(a)*d,z:SW[1]+Math.sin(a)*d,y:.9+R()*.5,s:5+R()*5})}
    for(let i=0;i<36;i++){const a=R()*6.28,d=4+R()*9,x=M[0]+Math.cos(a)*d,z=M[1]+Math.sin(a)*d;c.fx.push({type:'mist',x,z,y:H(x,z)+.8+R()*.8,s:4+R()*5})}
    // --- drivved på stranden ---
    for(let i=0;i<16;i++){const a=R()*6.28,Rr=isl(0,0)-9+R()*3,x=Math.cos(a)*Rr,z=Math.sin(a)*Rr;if(c.dist(x,z)<1.6||H(x,z)<def.water+.1)continue;const b=R()*6.28,len=.8+R()*1.4;log(x,z,x+Math.sin(b)*len,z+Math.cos(b)*len,.06+R()*.05,S.BARK,()=>'#9a8468')}
    // --- jungelens planter og dyr (data/vegetasjon.js, data/dyr.js) ---
    const jg=[-28,-14],JR=26,inJ=(x,z)=>inJungle(x,z)&&lineD(STREAM,x,z)>3;
    c.sow('jungel_kapok',5,jg,JR,{r:.5,gap:8,ok:inJ,p:R=>({s:1+R()*.5,lianer:1+Math.floor(R()*3)})});
    c.sow('jungel_bregnetre',12,jg,JR,{r:.3,gap:2.5,ok:inJ,p:R=>({s:.8+R()*.5})});
    c.sow('jungel_banan',14,jg,JR,{r:.3,gap:2,ok:inJ,p:R=>({s:.8+R()*.4,klase:R()<.4?1:0})});
    c.sow('jungel_jaguar',2,jg,JR,{r:.5,gap:12,ok:inJ,p:R=>({svart:R()<.3?1:0})});
    c.sow('jungel_dovendyr',2,jg,JR,{r:.8,gap:8,ok:inJ,p:R=>({unge:R()<.5?1:0})});
    c.sow('jungel_tukan',4,jg,JR,{r:.2,gap:5,ok:inJ});
    c.sow('jungel_giftfrosk',6,jg,JR,{r:.15,gap:3,ok:inJ,p:R=>({farge:Math.floor(R()*3)})});
    c.props();
    c.pebbles(1400,['#6f6a63','#8a847a','#4f4a44'],.04,.11);
    c.tufts(160,['#4d7a2f','#6b9a3c']);
    c.bushes(90,['#3e7a34','#4f8f3c','#2f6a2c','#6a9a40'],(x,z)=>{const r=rM(x,z);return r>16&&!inDesert(x,z)&&dSw(x,z)>SW_R+2&&Math.hypot(x,z)<isl(x,z)-9&&surfAt(x,z)===S.GRASS},{soft:true});   // de grønne buskene kan du kjøre gjennom
    c.bushes(30,['#8a8a4a','#9a9a5a','#6a7a3a'],(x,z)=>inDesert(x,z)&&Math.hypot(x,z)<isl(x,z)-9);
    c.mushrooms(60,(x,z)=>inJungle(x,z));c.shells(220);
  }}
);
})();
