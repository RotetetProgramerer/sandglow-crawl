// Piratøya: sjørøverøya i evig solnedgang (120 × 120). Sjørøverbyen med Skumkroa i sør, Apejungelen med lagunen og hengebroa midt på øya,
// Kanonfortet på klippen i øst, Hodeskalleklippen i nord, skipsvraket på stranda i vest og Skattestranda i nordvest.
// Ute på havet seiler Spøkelsesskuta rundt øya, og kanonene på fortet skyter etter den.
// De tre prøvene (js/pirater.js): finn skatten under krysset, vinn ordduellen mot sverdmesteren og kjør inn i gapet på hodeskallen.
// Klarer du alle tre, blir du sjørøverkaptein og får piratflagg på bilen. Husk: på øyene er +x vest og +z nord.
//   node tools/test-levels.js pirat
(function(){
const DEG=Math.PI/180;
const smt=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const isl=(x,z)=>{const a=Math.atan2(z,x);return 40+2.2*Math.sin(3*a+2.3)+1.2*Math.sin(5*a+1.1)};
const onRim=(deg,inn)=>{const a=deg*DEG,r=isl(Math.cos(a),Math.sin(a))-inn;return[Math.cos(a)*r,Math.sin(a)*r]};
// ---------- stedene ----------
const VA=262*DEG, VIL=onRim(262,1.6);                              // sjørøverbyen med fergekaia, i sør
const VROAD=[VIL[0]-Math.cos(VA)*16,VIL[1]-Math.sin(VA)*16];       // der veien ut av byen slutter
const KRO=[3.8,-20.8], BORD=[1.3,-19.3];                           // Skumkroa og bordet der de tre gamle sjørøverne sitter
const J=[1,-12];                                                   // veikrysset
const JUN=[13,4], LAG=[14,5], LAG_R=3.5;                           // Apejungelen og lagunen
const BRO=[[9.2,5],[18.8,5]];                                      // hengebroa over lagunen
const MAS=[-22,2], MAS_TOP=3.0;                                    // Kanonfortet: midten av klippen og hvor høyt platået er
const masR=(x,z)=>{const a=Math.atan2(z-MAS[1],x-MAS[0]);return 8.2+.8*Math.sin(3*a+.5)+.4*Math.sin(5*a+2)};
const RAMPS=[[[-19.5,17.5],[-21.5,8.5]],[[-20,-13.5],[-21.6,-4.5]]];   // veiene opp på klippen fra nord og fra sør (fra foten til toppen)
const SK=[6,23.2], SK_R=2.88, MND=[6,29.5];                        // hodeskallen (gapet vender mot sør) og haugen den ligger inntil
const SVERD=[22.5,-12];                                            // sverdmesterens hytte
const VRAK=onRim(-14,2.2);                                         // skipsvraket på stranda i vest
const KRYSS=onRim(48,3.6);                                         // krysset på Skattestranda
const SMUG=onRim(118,4);                                           // Smuglerbukta i nordøst
const mesa=(x,z,n)=>{const d=Math.hypot(x-MAS[0],z-MAS[1]),r=masR(x,z);let h=MAS_TOP*smt((r-d)/1.3)+.2*smt((r-1.5-d)/2)*(n(x*.4,z*.4)-.4);
  for(const[A,B]of RAMPS){const ex=B[0]-A[0],ez=B[1]-A[1],L2=ex*ex+ez*ez;let t=((x-A[0])*ex+(z-A[1])*ez)/L2;if(t<-.1||t>1.08)continue;const tc=Math.max(0,Math.min(1,t)),lat=Math.hypot(x-A[0]-ex*tc,z-A[1]-ez*tc);
    h=Math.max(h,MAS_TOP*tc*smt((2.6-lat)/1.4))}
  return h};
// ---------- løypene ----------
const CH=[
 {id:'strand',name:'Strandhuggerrunden',diff:1,gates:10,desc:'Fra Skumkroa langs stranda til skipsvraket og hjem forbi sverdmesteren. Flatt og fint, men pass på krabbene.',
  path:[[10,-23.5],[15.5,-23],[21,-21],[26,-17.5],[30,-13],[33,-8],[31.5,-2.5],[27,-1.5],[23.5,-5],[19.5,-8],[15,-12],[10.5,-15.5]],surf:S.DIRT,hw:1.3},
 {id:'jungel',name:'Apestien',diff:2,gates:10,desc:'Inn i Apejungelen, over hengebroa på lagunen og rundt de store trærne. Apekattene følger med fra greinene.',
  path:[[2,-3],[3.5,1.5],[6,4.4],[9.2,5],[14,5],[18.8,5],[22,6.5],[24,10.5],[22,15],[17,17],[12,15.5],[8,12]],surf:S.DIRT,hw:1.2},
 {id:'fort',name:'Kanonløpet',diff:3,gates:10,desc:'Opp den bratte veien til Kanonfortet, tvers gjennom borggården mens kanonene dundrer, og ned sørsiden. Lavt gir opp, forsiktig ned.',
  path:[[-15,22],[-17.5,20.5],[-19.5,17.5],[-20.6,13],[-21.5,8.5],[-21.9,4],[-22,0],[-21.8,-4.5],[-20.9,-9],[-20,-13.5],[-17,-17.5],[-12.5,-19.5]],hw:1.3,blend:1.4},
];
const ROADS=[
 [VROAD,[-1,-17],J],                                               // fra byen til veikrysset
 [J,[1.5,-6],[2,-3],[1,4],[2,11],[5,16],[6,19.2]],                 // nordover til Apestien og Hodeskalleklippen
 [J,[-6,-13.5],[-13,-14.5],[-20,-13.5]],                           // østover til foten av fortet
 [[2,11],[-6,15],[-12,19],[-15,22]],                               // til starten på Kanonløpet
 [J,[6,-17],[10,-23.5]],                                           // til Skumkroa og Strandhuggerrunden
 [J,[8,-12.6],[15,-12.3],[20,-12.1]],                              // til sverdmesteren
 [[5,16],[12,20],[18,22.5],[KRYSS[0]-2.2,KRYSS[1]-1.6]],           // til Skattestranda
];

LEVELS.push(
{ id:'pirat', name:'Piratøya', diff:2, seed:1717, size:120, coast:42, world:true,
  desc:'Sjørøverøya i evig solnedgang. Klar de tre prøvene og bli sjørøverkaptein: finn skatten, vinn ordduellen og tør å kjøre inn i hodeskallen.',
  start:[VROAD[0]-.4,VROAD[1]+1.5,10*DEG],
  sky:['#232a66','#c0527a'], fog:0xf0a070, fogNear:26, fogFar:120, sun:0xffb070, sunI:1.25, hemi:[0xd8b0d8,0x5a4a58,.78], sunDir:[22,9,-10], rockCol:'#8a7a70',
  water:.3, waterCol:'#3a7a9a', waterOpacity:.8,
  grassCol:['#3f8a3a','#5aa648'], dirtCol:['#a8845a','#c0986a'],
  ambience:'jungle', wind:true,
  biome:(x,z)=>{const R=Math.hypot(x,z),dJ=Math.hypot(x-JUN[0],z-JUN[1]),dL=Math.hypot(x-LAG[0],z-LAG[1]);return{jungle:.25+.75*smt((15-dJ)/6),swamp:.6*smt((7-dL)/3),beach:smt((R-(isl(x,z)-9))/5),snow:0,desert:0}},
  path:[[-5,-18],[-6.5,-16.5],[-8,-18],[-6.5,-19.5],[-5,-18]],
  challenges:CH, roads:ROADS, airport:{at:[-31,-25],dir:225,len:40,end:1,road:[[-22,-21]]}, village:{at:VIL,dir:VA/DEG},
  mapLabels:[[VIL[0]+3,VIL[1]+1,'Kaia'],[KRO[0]+2.5,KRO[1]-3,'Skumkroa'],[JUN[0]+3,JUN[1]+8,'Apejungelen'],[MAS[0],MAS[1]+10.5,'Kanonfortet'],[SK[0],SK[1]-6.5,'Hodeskalleklippen'],
    [VRAK[0]-4.5,VRAK[1]+2,'Skipsvraket'],[KRYSS[0]-3,KRYSS[1]-3,'Skattestranda'],[SVERD[0]-2,SVERD[1]+3.2,'Sverdmesteren']],
  animals:{parrots:12,circling:5,monkeys:10,butterflies:40,crabs:9,crabsAt:[VRAK[0]-4,VRAK[1]+1],gulls:{at:[VIL[0]+2,VIL[1]+3],n:6}},
  base(x,z,n){const R=Math.hypot(x,z),ri=isl(x,z),dJ=Math.hypot(x-JUN[0],z-JUN[1]),dL=Math.hypot(x-LAG[0],z-LAG[1]),dS=Math.hypot(x-MND[0],z-MND[1]);
    let h=1.0+.34*fbm(n,x*.045,z*.045,3)+.05*fbm(n,x*.3,z*.3,2);
    h+=.45*smt((14-dJ)/8)*fbm(n,x*.13+3,z*.13,2);                       // jungelen er litt kupert
    h-=.5*smt((7.5-dL)/4);                                              // lagunen ligger i en grunn senkning
    h+=3.8*smt((7-dS)/5);                                               // haugen bak hodeskallen
    h=Math.max(h,1.0+mesa(x,z,n));
    h-=2.4*smt((R-ri+2)/4);                                             // havet
    return h},
  surf(x,z,n){const R=Math.hypot(x,z),ri=isl(x,z),dJ=Math.hypot(x-JUN[0],z-JUN[1]),dL=Math.hypot(x-LAG[0],z-LAG[1]),dM=Math.hypot(x-MAS[0],z-MAS[1]),dS=Math.hypot(x-MND[0],z-MND[1]);
    if(R>ri-6)return S.SAND;
    if(dM<masR(x,z)+.4)return S.ROCK;
    if(dS<6.5)return S.ROCK;
    if(dL<LAG_R+1.3)return S.MUD;
    if(dJ<13)return n(x*.6,z*.6)>.62?S.DIRT:S.GRASS;
    if(R>ri-10&&n(x*.5,z*.5)>.45)return S.SAND;
    return n(x*.35+9,z*.35)>.7?S.DIRT:S.GRASS},
  build(c){const R=c.rng;
    // --- veiene og løypene ---
    for(const r of ROADS)c.road(r,{hw:1.3,blend:2,surf:S.DIRT});
    for(const ch of CH)c.course(ch);
    // --- lagunen og hengebroa ---
    c.pond(LAG[0],LAG[1],LAG_R,.8,{bed:S.MUD});c.block(LAG[0],LAG[1],LAG_R+1);
    c.bridge(BRO[0][0],BRO[0][1],BRO[1][0],BRO[1][1],1.05,{sag:.2});
    c.fx.push({type:'sign',x:7.2,z:2.6,ang:Math.PI*.3,text:'LAGUNEN',sub:'bading på eget ansvar · arr!'});
    // --- Skumkroa: skjevt hus med skilt, tønner, bord og benker (sjørøverne som sitter der, tegnes av js/pirater.js) ---
    {const[kx,kz]=KRO,y=H(kx,kz);c.flat(kx,kz,3.4,y,2.5);c.block(kx,kz,4.4);const ry=-.5;
      c.box(kx,y,kz,3.4,1.5,2.4,'#7a4a2e',ry);c.box(kx,y,kz,3.5,.1,2.5,'#3a2a22',ry);c.box(kx,y+1.5,kz,3.7,.1,2.7,'#3a2a22',ry);
      c.box(kx,y+1.6,kz,3.0,.9,2.0,'#8a5a36',ry+.06);c.box(kx,y+2.5,kz,3.4,.12,2.4,'#4a3026',ry+.06,{rz:.05});     // den skjeve andre etasjen
      c.box(kx+.9,y+2.6,kz-.4,.4,.8,.4,'#6b5a52',ry);                                                              // pipa
      c.colliders.push({x:kx,z:kz,w:3.6,d:2.6,ry,anchor:true,y:y+.6});
      for(const[dx,dz,col]of[[-2.6,.6,'#8a6a3a'],[-2.9,.1,'#6a4a2a'],[-2.5,-.3,'#8a6a3a'],[2.5,1.6,'#6a4a2a']]){c.cyl(kx+dx,y,kz+dz,.2,.46,col);c.cyl(kx+dx,y+.1,kz+dz,.21,.04,'#2a2a2a');c.cyl(kx+dx,y+.32,kz+dz,.21,.04,'#2a2a2a');c.colliders.push({x:kx+dx,z:kz+dz,r:.24})}
      // bordet ute: en stor tønne med planker rundt, og tre krakker
      const[bx,bz]=BORD,by=H(bx,bz);c.cyl(bx,by,bz,.3,.5,'#6a4a2a');c.cyl(bx,by+.5,bz,.62,.05,'#8a6a3a');c.colliders.push({x:bx,z:bz,r:.6});c.block(bx,bz,2.2);
      for(let i=0;i<3;i++){const a=.4+i*2.1;c.cyl(bx+Math.cos(a)*.95,by,bz+Math.sin(a)*.95,.14,.26,'#5a3a22')}
      c.cyl(bx+.2,by+.55,bz-.1,.05,.12,'#d8c597');c.cyl(bx-.25,by+.55,bz+.15,.05,.12,'#d8c597');                      // krus med rotbrus
      c.fx.push({type:'sign',x:kx-2.4,z:kz+2.6,ang:Math.PI*1.25,text:'SKUMKROA',sub:'rotbrus · røverhistorier',w:1.5})}
    // --- Kanonfortet: murer rundt borggården, porter mot nord og sør, tårn i hjørnene og kanoner mot havet i øst ---
    {const[fx,fz]=MAS,y=1.0+MAS_TOP,HS=4,st='#8a8478',dk='#6f6a60',cannons=[];c.block(fx,fz,HS+1.5);
      const wall=(x,z,w,d,h=1.3)=>{c.box(x,y-.1,z,w,h+.1,d,st);c.box(x,y+h,z,w+.08,.12,d+.08,dk);c.colliders.push({x,z,w:w+.1,d:d+.1,ry:0,anchor:true,y:y+.6})};
      for(const sz of[1,-1]){const gx=sz>0?-21.6:-21.9;                                   // porten ligger der løypa går
        const l0=fx-HS,l1=gx-1.6,r0=gx+1.6,r1=fx+HS;wall((l0+l1)/2,fz+sz*HS,l1-l0,.5);wall((r0+r1)/2,fz+sz*HS,r1-r0,.5);
        c.box(gx,y+1.5,fz+sz*HS,3.6,.3,.55,dk);for(const sd of[-1,1])c.box(gx+sd*1.75,y-.1,fz+sz*HS,.4,1.7,.6,dk)}   // portbuen
      wall(fx+HS,fz,.5,HS*2-.6);                                                           // vestmuren (inn mot øya)
      wall(fx-HS,fz,.5,HS*2-.6,.42);                                                        // østmuren er lav: kanonene skyter over den
      for(const sx of[-1,1])for(const sz of[-1,1]){const tx=fx+sx*HS,tz=fz+sz*HS;c.cyl(tx,y-.2,tz,.8,2.4,st);c.cyl(tx,y+2.2,tz,.92,.3,dk);c.colliders.push({x:tx,z:tz,r:.9,anchor:true,y:y+.6})}
      for(const dz of[-2.2,0,2.2])cannons.push({x:fx-HS+.95,z:fz+dz,y,dir:-Math.PI/2});      // retningen er yaw: −90° er rett østover
      for(const dz of[-2.2,0,2.2])c.colliders.push({x:fx-HS+.95,z:fz+dz,r:.42});
      for(const[dx,dz]of[[-2.2,-3.2],[-2.5,3.1]]){for(let k=0;k<3;k++)c.cyl(fx+dx+(k%2)*.2,y+Math.floor(k/2)*.17,fz+dz+(k%3)*.19,.09,.17,'#1d1c1a')}   // hauger med kanonkuler
      c.fx.push({type:'sign',x:-17.3,z:19.4,ang:Math.PI*.75,text:'KANONFORTET',sub:'hold deg for ørene'});
      c.piratCannons=cannons}
    // steiner rundt foten av klippen
    for(let i=0;i<60;i++){const a=R()*6.28,d=masR(MAS[0]+Math.cos(a)*9,MAS[1]+Math.sin(a)*9)+.6+R()*3,x=MAS[0]+Math.cos(a)*d,z=MAS[1]+Math.sin(a)*d,r=.4+R()*.9;
      if(c.dist(x,z)<r+1.7||!c.free(x,z,r))continue;rock(x,z,r,.4+R()*.8,{ang:R()*6.3,ax:1+R()*.5,sharp:.35,surf:S.ROCK});if(r>.9)c.anchor(x,z)}
    // --- Hodeskalleklippen: en flat plass foran haugen der hodeskallen står (selve skallen tegnes av js/pirater.js) ---
    {const[sx,sz]=SK,y=H(sx,sz-2.2);c.flat(sx,sz-1,3.5,y,2);c.block(sx,sz,4.6);
      for(let a=0;a<6.28;a+=.2){if(Math.cos(a)<-.8)continue;c.colliders.push({x:sx+Math.sin(a)*SK_R,z:sz+Math.cos(a)*SK_R,r:.36})}   // veggen rundt, åpen i gapet mot sør
      c.colliders.push({x:sx,z:sz+1.4,r:1.1});                                              // innerst i skallen
      c.fx.push({type:'sign',x:sx+3.6,z:sz-6.2,ang:Math.PI,text:'HODESKALLEKLIPPEN',sub:'bare for de modige',w:1.7});
      for(let i=0;i<26;i++){const a=R()*6.28,d=5+R()*4.5,x=MND[0]+Math.cos(a)*d,z=MND[1]+Math.sin(a)*d,r=.35+R()*.8;if(c.dist(x,z)<r+1.6||!c.free(x,z,r)||Math.hypot(x-sx,z-sz)<4.8)continue;rock(x,z,r,.4+R()*.7,{ang:R()*6.3,ax:1+R()*.5,sharp:.4,surf:S.ROCK})}
      c.piratSkull={x:sx,z:sz,y,dir:Math.PI,r:SK_R,boo:{x:sx,z:sz-1.1,r:.95}}}
    // --- sverdmesterens hytte: en liten hytte av drivved, treningsdukke og et stativ med tresverd ---
    {const[hx,hz]=SVERD,y=H(hx,hz);c.flat(hx,hz,2.6,y,2);c.block(hx,hz,3.4);
      c.box(hx+1.5,y,hz-1.2,1.8,1.1,1.5,'#8a6a46',.5);c.box(hx+1.5,y+1.1,hz-1.2,2.1,.1,1.8,'#5a7a3a',.5,{rz:.12});c.colliders.push({x:hx+1.5,z:hz-1.2,w:1.9,d:1.6,ry:.5,anchor:true,y:y+.6});
      c.cyl(hx-1.4,y,hz-1.1,.05,.95,'#6a4a2a');c.box(hx-1.4,y+.6,hz-1.1,.7,.07,.07,'#6a4a2a',.3);c.cyl(hx-1.4,y+.5,hz-1.1,.16,.4,'#d8c597');c.cyl(hx-1.4,y+.92,hz-1.1,.12,.2,'#d8c597');c.colliders.push({x:hx-1.4,z:hz-1.1,r:.2});   // treningsdukka
      c.fx.push({type:'sign',x:hx-2.6,z:hz+2.2,ang:Math.PI*1.2,text:'SVERDMESTEREN',sub:'ordkrig hver dag',w:1.5})}
    // --- skipsvraket: bare kollidere og et fritt område her, skroget tegnes av js/pirater.js ---
    {const[wx,wz]=VRAK;c.block(wx,wz,4.5);for(const k of[-1.6,0,1.6])c.colliders.push({x:wx+Math.sin(.9)*k,z:wz+Math.cos(.9)*k,r:.95,anchor:true,y:H(wx,wz)+.6})}
    // --- Skattestranda: to palmer som bøyer seg mot hverandre, og krysset mellom dem ---
    c.block(KRYSS[0],KRYSS[1],2.6);
    // --- gullmutterne ---
    for(const[x,z,l]of[[MAS[0]+2.9,MAS[1]+2.9,'I borggården på Kanonfortet'],[VRAK[0]-2.6,VRAK[1]-2.2,'Bak skipsvraket'],[LAG[0]+.4,LAG[1]+5.2,'På bredden av lagunen'],
      [SMUG[0],SMUG[1],'I Smuglerbukta'],[KRO[0]+2.6,KRO[1]-2.6,'Bak Skumkroa']]){c.secret(x,z,l);c.block(x,z,1.2)}
    // det js/pirater.js trenger: hodeskallen, kanonene, krysset, kroa, sverdmesteren, vraket, skuta ved kaia og folkene
    {const dx=Math.cos(VA),dz=Math.sin(VA),px=-dz,pz=dx,at=(f,s)=>[VIL[0]+dx*f+px*s,VIL[1]+dz*f+pz*s],yaw=Math.atan2(dx,dz),sk=at(10.5,-8.5),fy=1.0+MAS_TOP;
      c.piratDef={skull:c.piratSkull,cannons:c.piratCannons,dig:{x:KRYSS[0],z:KRYSS[1]},inn:{x:BORD[0],z:BORD[1],r:2.1},duel:{x:SVERD[0],z:SVERD[1],r:1.9},
        wreck:{x:VRAK[0],z:VRAK[1],ry:.9},ship:{x:sk[0],z:sk[1],ry:yaw+Math.PI/2},ghost:{r:58.5,speed:.035},
        lights:[[KRO[0]-1.6,KRO[1]+1.5,1.5],[BORD[0],BORD[1],1.0],[MAS[0]-.4,MAS[1]+4,2.2],[MAS[0]-.2,MAS[1]-4,2.2],[SVERD[0]+.4,SVERD[1]-.4,1.2]],
        folk:[
          {x:BORD[0]+Math.cos(.4)*.95,z:BORD[1]+Math.sin(.4)*.95,face:BORD,sit:1,hat:'tricorn',coat:'#7a2a2a',beard:'#d8d8d0',mug:1},
          {x:BORD[0]+Math.cos(2.5)*.95,z:BORD[1]+Math.sin(2.5)*.95,face:BORD,sit:1,hat:'bandana',coat:'#2f5a8a',patch:1,mug:1},
          {x:BORD[0]+Math.cos(4.6)*.95,z:BORD[1]+Math.sin(4.6)*.95,face:BORD,sit:1,hat:'tricorn',coat:'#3a5a3a',beard:'#3a2a20',parrot:1},
          {x:KRO[0]-1.9,z:KRO[1]+1.9,ry:-2.2,hat:'bandana',coat:'#e8dcc0',apron:1,wave:1},                 // verten i døra
          {x:SVERD[0],z:SVERD[1],ry:Math.PI,hat:'tricorn',coat:'#6a2a6a',sword:1,name:'duel'},              // sverdmesteren
          {x:MAS[0]-2.2,z:MAS[1]+1.1,y:fy,ry:-Math.PI/2,hat:'bandana',coat:'#8a3a2a',patch:1},              // kanonmannskapet
          {x:MAS[0]-2.2,z:MAS[1]-1.2,y:fy,ry:-Math.PI/2,hat:'tricorn',coat:'#2a3a5a',scope:1},
          {x:VRAK[0]-3.2,z:VRAK[1]+2.6,ry:1.2,sit:1,hat:'bandana',coat:'#c8a03a',peg:1},                    // skipbrudden på stranda
          {x:KRYSS[0]+2.6,z:KRYSS[1]-2.4,ry:-2.4,hat:'bandana',coat:'#4a7a6a',peg:1,name:'dig'}],
        patrol:{path:[[VRAK[0]-4.5,VRAK[1]+6],[VRAK[0]-2.5,VRAK[1]+3.4],[VRAK[0]-5,VRAK[1]-4.5],[VRAK[0]-7.5,VRAK[1]-1]],speed:.55}}}
    for(const f of c.piratDef.folk)if(!f.name)c.colliders.push({x:f.x,z:f.z,r:.17});
    c.finish();
    // --- jungelen: store trær med lianer, bananplanter, bregner og palmer rundt lagunen ---
    for(let i=0;i<5000&&c.trees.length<70;i++){const a=R()*6.28,d=Math.sqrt(R())*13.5,x=JUN[0]+Math.cos(a)*d,z=JUN[1]+Math.sin(a)*d;if(!c.plantOK(x,z,.6)||Math.hypot(x-LAG[0],z-LAG[1])<LAG_R+1.2)continue;c.tree(x,z,{h:4.5+R()*4.5,r:.18+R()*.2})}
    for(let i=0;i<1500&&c.trees.length<92;i++){const x=(R()-.5)*60,z=(R()-.5)*60;if(!c.plantOK(x,z,.6)||Math.hypot(x,z)>30||Math.hypot(x-MAS[0],z-MAS[1])<masR(x,z)+1.5||Math.hypot(x-MND[0],z-MND[1])<8)continue;c.tree(x,z,{h:4+R()*3.5,r:.16+R()*.16})}
    c.forest();
    c.sow('jungel_banan',16,JUN,13,{r:.3,gap:1.8});c.sow('bregne',40,JUN,14,{r:.2,gap:1.2});
    c.sow('palme',7,LAG,LAG_R+3.5,{r:.3,gap:1.8,ok:(x,z)=>Math.hypot(x-LAG[0],z-LAG[1])>LAG_R+.8,p:R=>({h:2.6+R()*2})});
    c.sow('palme',70,[0,0],40,{r:.3,gap:3,ok:(x,z)=>Math.hypot(x,z)>isl(x,z)-9,p:R=>({h:2.6+R()*2.4,lean:(R()-.5)*.5,kokos:Math.floor(R()*4)})});   // palmer langs strendene
    c.sow('palme',6,[VIL[0],VIL[1]+6],7,{r:.3,gap:2.4,p:R=>({h:2.4+R()*1.6})});
    c.plant('palme',KRYSS[0]+1.7,KRYSS[1]+.5,{h:3.6,lean:.42,bue:1.6});c.plant('palme',KRYSS[0]-1.7,KRYSS[1]-.5,{h:3.4,lean:-.42,bue:1.6});       // de to skjeve palmene ved krysset
    c.props();
    // --- småting ---
    c.bushes(40,['#2f7a34','#3f8a3a','#57a04a'],(x,z)=>Math.hypot(x,z)<isl(x,z)-9&&Math.hypot(x-MAS[0],z-MAS[1])>masR(x,z)+1&&Math.hypot(x-MND[0],z-MND[1])>8,{soft:true});
    c.tufts(140,['#4a9a3a','#6ab04a','#3a8a34']);c.pebbles(300,['#8a7a70','#a09084','#6f665e','#d8c8a8'],.04,.12);c.shells(120);
  }}
);
})();
