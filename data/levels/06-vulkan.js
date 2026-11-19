// Bane 6: Hisøya
// Strand → gjørmesti i regnskogen → en liten, tett skog → vadested i jungelelva → hyllen bak fossen → spiralvei opp en vulkan.
// Vulkanen ligger i (8,6). Veien går 1,25 runder opp mot krateret. Tre lavaelver renner ned fra kraterkanten og krysser veien,
// og i krateret ligger en lavasjø. Snarvei: etter port 13 kan du kjøre en smal bro rett over i stedet for den lange runden sør om.
// Dyr, foss, utbrudd og den rullende steinen er bare for stemning: ingenting av det stopper bilen.
(function(){
const C=[8,6], DEG=Math.PI/180;
const pol=(r,d)=>[C[0]+r*Math.cos(d*DEG), C[1]+r*Math.sin(d*DEG)];
// radius til veien ved vinkel d (grader): jevn stigning, én lang sving ut mot jungelen (hovedruten sør om) og en lang, slak bue inn igjen
const RK=[[225,19],[405,13.4],[430,20.4],[450,20.4],[600,8.0],[630,6.6],[675,5.0]];
const rS=d=>{for(let i=1;i<RK.length;i++)if(d<=RK[i][0]){const a=RK[i-1],b=RK[i],u=(d-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*u}return 5};
const smt=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const RW=r=>.85+.04*(r-4);                          // halv bredde på lavaelva ved avstand r fra krateret
const rOf=(x,z)=>Math.hypot(x-C[0],z-C[1]);
const seaD=(x,z)=>Math.hypot(x+36,z+36);            // avstand til midten av havet i hjørnet
// avstand fra (x,z) til en brutt linje
const lineD=(L,x,z)=>{let m=1e9;for(let i=0;i<L.length-1;i++){const a=L[i],b=L[i+1],ex=b[0]-a[0],ez=b[1]-a[1],L2=ex*ex+ez*ez;let t=((x-a[0])*ex+(z-a[1])*ez)/L2;t=t<0?0:t>1?1:t;m=Math.min(m,Math.hypot(x-a[0]-ex*t,z-a[1]-ez*t))}return m};

// Hvor veien krysser en lavaelv: a = elvas retning (grader), rb = avstand fra krateret, hw = halv bredde på broa
const cross=(a,rb,hw)=>{const X=pol(rb,a),tau=[-Math.sin(a*DEG),Math.cos(a*DEG)],Lh=RW(rb)+.8,pad=Lh+3.4;
  return{a,rb,hw,X,tau,Lh,A:[X[0]-tau[0]*Lh,X[1]-tau[1]*Lh],B:[X[0]+tau[0]*Lh,X[1]+tau[1]*Lh],
    pre:[X[0]-tau[0]*pad,X[1]-tau[1]*pad],post:[X[0]+tau[0]*pad,X[1]+tau[1]*pad]}};
const b1=cross(270,rS(270),1.1), b2=cross(355,rS(355),1.0), b3=cross(90,20.4,1.0), b5=cross(270,rS(630),.9);
const sc=cross(90,11.0,.8);                          // den smale snarveisbroa

// Lavaelvene: a = retning (grader fra krateret), end = sluttradius, x = radiene der veien eller snarveien krysser
const RIVERS=[{a:270,end:20.5,x:[b1.rb,b5.rb]},{a:355,end:21,x:[b2.rb]},{a:90,end:22.8,x:[b3.rb,sc.rb]}];
const riverPts=rv=>{const out=[];for(let r=4.3;r<=rv.end+.01;r+=1){const env=rv.x.reduce((e,rc)=>e*(1-Math.exp(-(((r-rc)/2.2)**2))),1),w=.9*Math.sin(.55*r+rv.a)*env,p=pol(r,rv.a);
  out.push([p[0]-Math.sin(rv.a*DEG)*w,p[1]+Math.cos(rv.a*DEG)*w])}return out};

// Jungelelva: fra stupebassenget under fossen og ned til havet. Vadestedet ligger der veien krysser.
const RIVER=[[-19.5,-15],[-21,-17],[-23,-19.5],[-25.2,-22.5],[-27,-25.5],[-29.5,-28.5]];
const FORD=[-23,-19.5], FORD_R=3.6;
const fordF=(x,z)=>smt(1-Math.hypot(x-FORD[0],z-FORD[1])/FORD_R);

// ---------- løypa ----------
const beach=[[-22,-30],[-16,-30.6],[-10,-30],[-4,-30.6],[2,-29.5]];                                   // strand og gjørmesti
const forest=[[7,-27],[11,-23.5],[16,-24],[20,-21],[19,-17],[14,-16.5],[8,-18.5],[2,-18.5],[-4,-18],[-9,-19]]; // den lille skogen
const toFall=[[-14,-20],[-19,-20.5],[-20.7,-21.4],FORD,[-25.3,-17.6],[-26.5,-13.5],[-25,-10],[-23.8,-8.9]];     // vadested og opp til hyllen
const ledge=[[-21.2,-7.9],[-18,-7.9],[-14.8,-7.9],[-11.5,-7.9],[-8.3,-7.8]];                                      // bak fossen
const A=pol(rS(390),390);                           // port 13: her kan du velge snarvei
const B=pol(rS(510),510);                           // port 14: her møtes snarveien og hovedveien igjen
const FIN=[12.6,2.6];
const ev=[{tp:270,w:26,pts:[b1.pre,b1.X,b1.post]},{tp:355,w:26,pts:[b2.pre,b2.X,b2.post]},{tp:450,w:46,pts:[[19.6,17.8],[17.9,22.4],[15.6,25.3],b3.pre,b3.X,b3.post,pol(rS(480),480),pol(rS(495),495)]},{tp:630,w:36,pts:[b5.pre,b5.X,b5.post,FIN]}];
const path=[...beach,...forest,...toFall,...ledge];
for(let d=225;d<=660;d+=15){const e=ev.find(e=>Math.abs(d-e.tp)<=e.w);if(e){if(!e.done){e.done=true;path.push(...e.pts)}continue}path.push(pol(rS(d),d))}
const spiralStart=pol(rS(225),225);
const bt=[-Math.sin(510*DEG),Math.cos(510*DEG)];
const shortcut=[A,[17.0,15.2],[12.6,16.8],sc.A,sc.X,sc.B,[2.6,16.4],[-1.8,15.2],B,[B[0]+bt[0]*1.8,B[1]+bt[1]*1.8]];
const dShort=(x,z)=>lineD(shortcut,x,z);
// den lille skogen: området inni og rundt skogsløkka
const FOREST_BOX=(x,z)=>x>-12&&x<25&&z>-31&&z<-12.5;

LEVELS.push(
{ id:'vulkan', name:'Hisøya', diff:3, seed:211, gates:18, size:120, coast:42, airport:{at:[8,-41],dir:270,end:-1,road:[[-10,-32]]}, village:{at:[-26.2,26.2]},
  desc:'Regnskog, gjørme, en foss du kjører bak, og opp en vulkan med lavaelver og hengebroer. Papegøyer, apekatter og en snarvei for de modige.',
  // lys ved vulkanen (brukes nær krateret) …
  sky:['#3b4a86','#f2b37a'], fog:0xd99f78, fogNear:22, fogFar:80, sun:0xffc690, sunI:1.0, hemi:[0xffdcb4,0x3a2418,.62], sunDir:[-20,15,-14], rockCol:'#3b3733',
  // … og i jungelen (kaldt, grønnhvitt, tett tåke). zone() sier hvor mye vulkan det er der bilen står.
  alt:{fog:0xb6c7b2, fogNear:9, fogFar:44, sun:0xe6efe0, sunI:.55, hemi:[0xd2e4d6,0x2d4a24,.78]},
  zone:(x,z)=>smt((21-rOf(x,z))/7),
  water:.32, waterCol:'#2f7f86', waterBand:(x,z)=>seaD(x,z)<12||lineD(RIVER,x,z)<2.6, ash:true, erupt:[16,26], ambience:'jungle',
  path, shortcut, shortcutGates:[12,13],
  gateT:c=>[[-10,-30],[2,-29.5],[16,-24],[14,-16.5],[-4,-18],[-20.7,-21.4],[-25,-10],[-18,-7.9],[-11.5,-7.9],b1.pre,b1.post,b2.pre,A,B,pol(rS(555),555),b5.pre,b5.post,FIN].map(p=>c.tOf(p[0],p[1])),
  // rullende stein: når bilen passerer trigger, løsner en stein i from og ruller til to (over veien)
  boulder:{trigger:pol(rS(231),231),from:pol(10,250),to:pol(25,250),speed:5.2,r:.55},
  animals:{parrots:12,circling:3,monkeys:9,butterflies:36,crabs:7,liana:[-9,-19],bridgeMonkeys:b1,fish:[{at:[-18,-12.6],r:3,n:2},{at:FORD,r:3,n:2}],lizards:[{at:[8,6],r:12,n:4}]},
  base(x,z,n){const rr=rOf(x,z),ds=lineD(RIVER,x,z),sd=seaD(x,z);
    const s2=smt((ds-2.6)/5);                                          // flatt nær elva
    let h=1.0+(.5*fbm(n,x*.045,z*.045,3)+.1*fbm(n,x*.3,z*.3,2))*s2;
    if(ds<2.4)h-=.95*(1-(ds/2.4)**2)*(1-.18*fordF(x,z));             // elvebunnen (grunnere ved vadestedet)
    h-=1.6*smt((12-sd)/5);                                             // havet i hjørnet
    h+=2.4*smt((z+6.65)/.9)*smt((-6-x)/6);                             // klippen foran fossen
    let b=0;if(rr<19){const u=Math.min(1,(19-rr)/15);b=5.6*u*u*(3-2*u);if(rr<4.2)b=5.6-1.8*(1-(rr/4.2)**2);b+=.22*fbm(n,x*.22,z*.22,3)*smt((19-rr)/6);
      b+=.12*Math.max(0,Math.sin(rr*2.1))*smt((17-rr)/2)*smt((rr-6)/2)}  // lagdelte askehyller på skråningen
    return h+b},
  surf(x,z,n){const rr=rOf(x,z);if(seaD(x,z)<15.5)return S.SAND;if(lineD(RIVER,x,z)<2.9)return S.GRAVEL;
    if(rr<15.5)return (rr>9&&rr<10.3)||(rr>13.6&&rr<14.6)?S.ROCK:S.ASH;if(rr<18.5)return n(x*.5,z*.5)>.5?S.ASH:S.DIRT;return n(x*.4+5,z*.4)>.64?S.MUD:S.GRASS},
  build(c){const R=c.rng,def=this,T=(x,z)=>c.tOf(x,z);
    // --- fossen: stupebasseng foran klippen, vanndammer på toppen ---
    c.pond(-18,-12.6,3.8,.7,{fill:.9});const pool=c.pools[c.pools.length-1];
    c.pond(-18,-1.2,3.1,.45,{fill:.6});c.pond(-24,2.5,2,.3,{fill:.6});
    // --- stien: jord i jungelen, mørk, våt stein på hyllen bak fossen ---
    for(let i=0;i<c.pts.length;i+=2){const p=c.pts[i];if(rOf(p.x,p.z)>17.8&&seaD(p.x,p.z)>15.5&&lineD(RIVER,p.x,p.z)>2.9)paint(p.x,p.z,1.3,S.DIRT,S.MUD)}
    for(let x=-23;x<=-9;x+=.6)paint(x,-7.9,1.45,S.GRAVEL);
    // --- veien jevnes ut så bilen ikke kjører på skrå ---
    c.bench(0,T(-20.7,-21.4),1.0,1.6);c.bench(T(-25.3,-17.6),T(-8.3,-7.8),1.1,1.6);
    c.bench(T(spiralStart[0],spiralStart[1]),1,1.5,1.8);
    c.benchLine(shortcut,1.2,1.6);
    // --- gjørmestien: hjulspor, søledammer, røtter og en veltet stamme ---
    c.ruts(T(-18,-30.5),T(0,-29.8),.05);c.ruts(T(7,-27),T(-9,-18.5),.035);
    for(const[t,off,r]of[[.035,.2,.9],[.055,-.5,.7],[.075,.3,1.0],[.1,-.3,.8],[.125,.4,.7],[.2,-.2,.9],[.27,.3,.8],[.33,-.4,.7]]){const p=c.P(t),s=c.side(t);if(c.nearGate(p.x+s.x*off,p.z+s.z*off,1.3))continue;c.pond(p.x+s.x*off,p.z+s.z*off,r,.13,{fill:.55,mud:true,bed:S.MUD})}
    c.pond(-18,-7.9,2.6,.06,{fill:.45,bed:S.GRAVEL});c.pond(-18,-10.0,1.7,.09,{fill:.5,bed:S.GRAVEL});   // vannfilm over veien der fossen treffer, og bekken ned i bassenget
    for(const[x,off,r]of[[-21.5,.35,.55],[-14,-.3,.5]])c.pond(x,-7.9+off,r,.07,{fill:.5,mud:true,bed:S.MUD});   // søledammer på hyllen
    paint(-6,-30.4,1.6,S.MUD);paint(-13,-30.3,1.4,S.MUD);paint(11,-23.5,1.3,S.MUD);
    {const p=c.P(T(-6.5,-30.4)),s=c.side(T(-6.5,-30.4));log(p.x-s.x*2.3,p.z-s.z*2.3,p.x+s.x*2.3,p.z+s.z*2.3,.14,S.BARK,(u,d)=>d>.8?'#3d2a1a':mix('#5a3f28','#7a5638',G.noise(u*30,d*4)))}   // veltet stamme over stien
    for(let i=0;i<40;i++){const t=.02+R()*.36,p=c.P(t),s=c.side(t),b=(R()-.5)*2.4;if(c.nearGate(p.x,p.z,1.3))continue;const a=R()*6.28,len=.5+R()*1.2,x0=p.x+s.x*b,z0=p.z+s.z*b;
      if(R()<.5)log(x0,z0,x0+Math.sin(a)*len,z0+Math.cos(a)*len,.035+R()*.03,S.BARK,()=>'#4e3a28');else rock(x0,z0,.2+R()*.25,.1+R()*.14,{ang:R()*6.3})}   // røtter og steiner i stien
    // --- lavaelver, krater, broer ---
    for(const rv of RIVERS){c.lava(riverPts(rv),(x,z)=>RW(rOf(x,z)));const p=pol(4.3,rv.a);c.vent(p[0],p[1])}
    c.lavaPool(C[0],C[1],2.5,H(C[0],C[1])-.6);c.vent(C[0],C[1]);
    for(const b of[b1,b2,b3,b5])c.bridge(b.A[0],b.A[1],b.B[0],b.B[1],b.hw,{sag:.2});
    c.bridge(sc.A[0],sc.A[1],sc.B[0],sc.B[1],sc.hw,{sag:.24});
    // snarveiskasser midt på den smale broa (belønning for å tørre), og bonus
    c.crate(sc.X[0]+sc.tau[0]*.6,sc.X[1]+sc.tau[1]*.6);c.crate(sc.X[0]-sc.tau[0]*.6,sc.X[1]-sc.tau[1]*.6);
    c.bonus(sc.X[0],sc.X[1],1.0,40,'Modig snarvei! +40 ⚙');
    // skjulte kasser: bak fossen og inne i skogen
    c.crate(-18.6,-9.5);c.crate(12.5,-19.6);c.crate(-27.5,-31.5);
    {const sx=18.4,sz=12.0,ang=Math.atan2(b2.post[0]-sx,b2.post[1]-sz);c.fx.push({type:'sign',x:sx,z:sz,ang,text:'SNARVEI',sub:'smal bro over lava'})}
    // --- steiner ---
    const onLedge=(x,z)=>Math.abs(z+7.9)<2.4&&x>-24&&x<-9;
    for(let i=0;i<150;i++){const x=(R()-.5)*62,z=(R()-.5)*62,r=.5+R()*1.5,h=.4+R()*1.2,rr=rOf(x,z);
      if(rr<5.2||c.dist(x,z)<r+1.5||dShort(x,z)<r+1.8||c.nearGate(x,z,r+1.6)||c.nearStart(x,z,r+3)||c.lavaNear(x,z,r+1.3)||!c.free(x,z,r+.8)||c.pools.some(p=>Math.hypot(p.x-x,p.z-z)<p.r+r+.6)||lineD(RIVER,x,z)<r+2.8||seaD(x,z)<13)continue;
      if(onLedge(x,z))continue;rock(x,z,r,h*(rr<17?1:.6),{ang:R()*6.3,ax:1+R()*.6});if(r>1.0)c.anchor(x,z)}
    for(let i=0;i<28;i++){const t=.45+R()*.53,p=c.P(t),s=c.side(t),b=(R()-.5)*2.2;if(c.nearGate(p.x,p.z,1.4)||c.lavaNear(p.x,p.z,3.5))continue;rock(p.x+s.x*b,p.z+s.z*b,.3+R()*.3,.16+R()*.18,{ang:R()*6.3})}
    for(const x of[-21.5,-20.2,-15.8,-14.5])rock(x,-9.6+R()*.4,.4+R()*.3,.3+R()*.2,{sharp:.5,nz:.2});   // steiner ved bassenget
    for(let x=-23;x<-9;x+=.5+R()*.5)if(R()<.7)rock(x,-9.35+R()*.3,.12+R()*.16,.08+R()*.1,{ang:R()*6.3});   // småstein langs ytterkanten av hyllen
    for(let i=0;i<9;i++){const a=R()*6.28,d=2.2+R()*2.2;const x=FORD[0]+Math.cos(a)*d,z=FORD[1]+Math.sin(a)*d;if(c.dist(x,z)<1.4)continue;rock(x,z,.3+R()*.3,.3+R()*.3,{sharp:.5,nz:.2})}   // elvesteiner ved vadestedet
    // --- trær (plasseres før finish så røttene står på riktig høyde etterpå) ---
    const trunkOK=(x,z,r,minPath)=>!(c.dist(x,z)<minPath||!c.onLand(x,z)||dShort(x,z)<2.2||c.nearGate(x,z,2.2)||c.nearStart(x,z,3)||rOf(x,z)<18.5||seaD(x,z)<13.5||lineD(RIVER,x,z)<3.2||onLedge(x,z)||c.pools.some(p=>Math.hypot(p.x-x,p.z-z)<p.r+1.2)||c.trees.some(t=>Math.hypot(t.x-x,t.z-z)<r+t.r+1.6)||Math.abs(H(x+.5,z)-H(x-.5,z))+Math.abs(H(x,z+.5)-H(x,z-.5))>.35);
    for(let i=0;i<4000&&c.trees.length<64;i++){const x=-10+R()*34,z=-31+R()*18;if(!FOREST_BOX(x,z)||!trunkOK(x,z,.3,1.75))continue;c.tree(x,z,{h:4.5+R()*3.5,r:.2+R()*.18})}       // den lille skogen: tett
    for(let i=0;i<4000&&c.trees.length<64+70;i++){const x=(R()-.5)*66,z=(R()-.5)*66;if(FOREST_BOX(x,z)||!trunkOK(x,z,.3,2.6))continue;c.tree(x,z,{h:5+R()*4.5,r:.22+R()*.2})}   // resten av regnskogen
    {const p=pol(5.4,135);c.secret(p[0],p[1],'Kraterkanten')}c.secret(-21.5,-8.4,'Bak fossen');c.secret(16,-28,'Den lille skogen');c.secret(-10,-33,'Stranden');c.secret(-20,20,'Jungelen i nord');
    c.finish();
    c.forest();
    // --- fossen: faller fra klippen rett innenfor veien og spruter ut over den. Vannet renner over veien og ned i bassenget.
    const hL=H(-18,-7.9),topY=H(-18,-5.0)+.15;
    c.fall(-18,-6.75,0,4.6,topY,hL,{spray:true});
    c.fx.push({type:'stream',pts:RIVER,level:def.water});
    c.smoke(C[0],C[1],H(C[0],C[1])+.2);
    for(const[a,r]of[[200,12],[320,9.5],[60,14],[130,11]]){const p=pol(r,a);if(c.dist(p[0],p[1])>2.5&&!c.lavaNear(p[0],p[1],1.5))c.steam(p[0],p[1])}   // dampende sprekker på skråningen
    // --- bakketåke i jungelen ---
    for(let i=0;i<48;i++){const x=(R()-.5)*66,z=(R()-.5)*66;if(rOf(x,z)<17||seaD(x,z)<11)continue;c.fx.push({type:'mist',x,z,y:H(x,z)+.9+R()*.6,s:5+R()*5})}
    // --- palmer ---
    const palms=[];
    for(let i=0;i<1400&&palms.length<55;i++){const x=(R()-.5)*62,z=(R()-.5)*62,rr=rOf(x,z);
      if(rr<17.5||!c.onLand(x,z)||c.dist(x,z)<2.5||dShort(x,z)<2.5||c.nearGate(x,z,2.5)||c.nearStart(x,z,2.6)||c.lavaNear(x,z,3)||!c.free(x,z,1.2)||c.pools.some(p=>Math.hypot(p.x-x,p.z-z)<p.r+1.6)||lineD(RIVER,x,z)<3||seaD(x,z)<12.5)continue;
      if(Math.abs(H(x+.5,z)-H(x-.5,z))+Math.abs(H(x,z+.5)-H(x,z-.5))>.3||H(x,z)<.6)continue;
      if(palms.some(q=>Math.hypot(q.x-x,q.z-z)<2.4)||c.trees.some(t=>Math.hypot(t.x-x,t.z-z)<1.6))continue;palms.push({x,z,h:2.8+R()*1.8,lean:(R()-.5)*.35})}
    for(const q of palms)c.plant('palme',q.x,q.z,{h:q.h,lean:q.lean});c.plants();   // js/props/palme.js
    // --- bregner, store blader, blomster og underskog ---
    const ferns=[],flowers=[],leaves=[];c.flowers=[];
    for(let i=0;i<2400&&ferns.length<420;i++){const x=(R()-.5)*64,z=(R()-.5)*64;if(rOf(x,z)<13.5||c.dist(x,z)<1.6||dShort(x,z)<1.5||c.lavaNear(x,z,1.2)||seaD(x,z)<12.5||lineD(RIVER,x,z)<2.6||onLedge(x,z)||c.pools.some(p=>Math.hypot(p.x-x,p.z-z)<p.r))continue;const s=.3+R()*.5;
      ferns.push(c.plant('bregne',x,z,{s,palett:1,c:['#2f7a2c','#3e8f35','#1f6a2a','#58a03a'][i%4]}));
      if(R()<.4)leaves.push({x:x+(R()-.5)*.8,y:H(x,z)+.02,z:z+(R()-.5)*.8,sx:.28+R()*.2,sy:.6+R()*.6,sz:.1,rx:.5+R()*.6,ry:R()*6.28,c:['#2a7a3a','#3f9a4a','#1e6a30'][i%3],ord:'YXZ'});
      if(R()<.22){const f={x:x+(R()-.5)*.4,y:H(x,z)+s*.62,z:z+(R()-.5)*.4};flowers.push({...f,sx:.07,sy:.07,sz:.07,c:['#e0405a','#f08a3a','#f2d24a','#d35aa8'][i%4]});c.flowers.push(f)}}
    c.plants();instanced(DG.leaf,DM.leaf,leaves,c.decor,false);instanced(DG.cone,DM.white,flowers,c.decor,false);
    c.pebbles(500,['#3a3631','#524b45','#2b2724'],.04,.11);
    c.tufts(60,['#4d7a2f','#6b9a3c']);
  }}
);
})();
