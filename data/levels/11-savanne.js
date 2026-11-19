// Løveøya: savanneøya (120 × 120). Gyllent gress og rød jord, spredte akasier og termittuer, Løveklippen (en haug av granittblokker)
// øst på øya, vannhullet i vest og Krokodilleelva som renner fra vannhullet nordøstover til havet. Baobablunden ligger nord for elva,
// og over elva går en hengebro. Landsbyen og kaia ligger i sørøst, safarileiren midt på øya. Husk: på øyene er +x vest og +z nord.
// Pass deg for dyrene (js/savannedyr.js): løvene ligger på Løveklippen, gepardene jakter på sletta i sørvest, og krokodillene
// lurer i elva og vannhullet. Kommer du for nær, angriper de: 5 straffepoeng i et løp, 3 muttere når du kjører fritt.
//   node tools/test-levels.js savanne
(function(){
const DEG=Math.PI/180;
const smt=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const lineD=(L,x,z)=>{let m=1e9;for(let i=0;i<L.length-1;i++){const a=L[i],b=L[i+1],ex=b[0]-a[0],ez=b[1]-a[1],L2=ex*ex+ez*ez||1e-9;let t=((x-a[0])*ex+(z-a[1])*ez)/L2;t=t<0?0:t>1?1:t;m=Math.min(m,Math.hypot(x-a[0]-ex*t,z-a[1]-ez*t))}return m};
const isl=(x,z)=>{const a=Math.atan2(z,x);return 39+2.2*Math.sin(3*a+.4)+1.4*Math.sin(5*a+2.1)};
// ---------- stedene ----------
const WATER=.3;                                                     // havet, elva og vannhullet ligger i samme høyde
const WH=[17,5], WH_R=5.2;                                          // vannhullet
const RIV=[[13,8],[8,11],[2,12.5],[-4,15],[-10,17],[-16,17],[-22,19],[-28,22],[-34,24],[-46,27]], RIV_W=2.3;   // Krokodilleelva
const FORDS=[[2,12.5],[-22,19]];                                    // vadestedene: grus rett under overflaten
const KOP=[-14,-4], KOP_R=7.5, KOP_H=2.3;                           // Løveklippen
const CAMP=[-3,-12];                                                // safarileiren med vakttårnet
const GROVE=[6,28];                                                 // baobablunden
const BRIDGE=[[-8.4,12.4],[-10.9,21.4]];                            // hengebroa over elva
const VA=232*DEG, VIL=(()=>{const r=isl(Math.cos(VA),Math.sin(VA))-1.6;return[Math.cos(VA)*r,Math.sin(VA)*r]})();
const VROAD=[VIL[0]-Math.cos(VA)*16,VIL[1]-Math.sin(VA)*16];        // der veien ut av landsbyen slutter
// Løveklippen: en lav kjegle med humper, så blokkene som ligger oppå ser ut som de har rullet ned
const kopH=(x,z,n)=>{const r=Math.hypot(x-KOP[0],z-KOP[1]);if(r>KOP_R)return 0;const u=r/KOP_R;return KOP_H*smt((1-u)/.75)*(1+.18*(n(x*.6,z*.6)-.5))+.9*Math.max(0,n(x*1.1+5,z*1.1)-.45)*smt((1-u)/.45)};
// ---------- løypene ----------
const CH=[
 {id:'safari',name:'Safarirunden',diff:1,gates:10,desc:'En runde over den åpne sletta i sørvest, mellom sebraer og gnuer. Se opp for gepardene: de er raskere enn bilen, men svinger dårlig.',
  path:[[0,-19],[7,-23],[14,-25],[21,-22],[26,-16],[28,-9],[25,-3],[19,-5],[13,-8],[7,-11]],surf:S.DIRT,hw:1.3},
 {id:'elva',name:'Krokodilleelva',diff:2,gates:10,desc:'Over to vadesteder i Krokodilleelva og rundt baobablunden. Kjør rolig i vannet, men ikke bli stående: krokodillene ligger på lur.',
  path:[[8,-2],[6,4],[3,8.5],[2,12.5],[1,17],[-3,21],[-9,23.5],[-15,23.5],[-19.5,22],[-22,19],[-23,14],[-20,9]],hw:1.3,bench:false},
 {id:'klippe',name:'Løveklippen',diff:3,gates:10,desc:'Opp granittblokkene og over toppen av Løveklippen, der løvene ligger i skyggen. Lavt gir og ingen stopp.',
  path:[[-25,-14],[-20,-15],[-15,-13],[-11.5,-9.5],[-10.5,-5.5],[-12,-1.5],[-15.5,.5],[-19,3],[-18.5,7],[-13.5,8.5]],hw:1.3,blend:1.4},
];
const ROADS=[
 [VROAD,[-11,-17],[-6,-15.5],[-3,-14.5]],                            // fra landsbyen til safarileiren
 [[-2,-15.5],[0,-17.5],[0,-19]],                                     // fra leiren til Safarirunden
 [[-1,-9.5],[3,-6],[8,-2]],                                          // fra leiren vestover til elveløypa
 [[-14,-18.5],[-20,-17],[-25,-14]],                                  // østover til Løveklippen
 [[-5,-9.5],[-6,-2],[-7,5],[-8,10.6]],                               // nordover, vest for klippen, til broa
 [[-11.3,23.2],[-6,26],[0,27.5],[GROVE[0]-2.5,GROVE[1]-.5]],         // fra broa til baobablunden
];

LEVELS.push(
{ id:'savanne', name:'Løveøya', diff:2, seed:7311, size:120, coast:42, world:true,
  desc:'Savanneøya med løver, geparder og krokodiller. Kjør safari mellom sebraer, sjiraffer og elefanter, men hold avstand til rovdyrene.',
  start:[VROAD[0]+1.5,VROAD[1]+1,60*DEG],
  sky:['#6aa2d6','#f2dcae'], fog:0xe8d6b0, fogNear:34, fogFar:120, sun:0xfff0d2, sunI:1.25, hemi:[0xf4e6c8,0x8a6a3a,.62], sunDir:[-14,22,-10], rockCol:'#6e6052',
  water:WATER, waterCol:'#3e5638', waterOpacity:.9,
  grassCol:['#9c8432','#c6a548'], dirtCol:['#8a4426','#ad6438'],      // gyllent gress og rød jord
  ambience:'jungle',
  biome:(x,z)=>{const R=Math.hypot(x,z),dr=lineD(RIV,x,z),dw=Math.hypot(x-WH[0],z-WH[1]);return{jungle:.35,swamp:Math.max(smt((6-dr)/4),smt((WH_R+5-dw)/4))*.8,beach:smt((R-(isl(x,z)-9))/5),snow:0,desert:.5}},
  path:[[VROAD[0]+1.5,VROAD[1]+1],[VROAD[0]+3,VROAD[1]+2.5],[VROAD[0]+4.5,VROAD[1]+1],[VROAD[0]+3,VROAD[1]-.5],[VROAD[0]+1.5,VROAD[1]+1]],
  challenges:CH, roads:ROADS, airport:{at:[40.5,-3],dir:0,end:-1,road:[[30,-15]]}, village:{at:VIL,dir:VA/DEG},
  mapLabels:[[KOP[0],KOP[1]-1,'Løveklippen'],[WH[0],WH[1]+.5,'Vannhullet'],[-14,19.5,'Krokodilleelva'],[CAMP[0],CAMP[1]-2.5,'Safarileiren'],[GROVE[0],GROVE[1]+2.5,'Baobablunden'],[20,-16,'Sletta'],[VIL[0]+3,VIL[1]-1,'Kaia']],
  animals:{
    lions:[{at:[KOP[0]+1.5,KOP[1]+1],r:3.5,n:3},{at:[24,14],r:2.5,n:2}],
    cheetahs:[{at:[20,-15],r:6,n:2}],
    crocs:[{at:FORDS[0],r:3.5,n:2},{at:FORDS[1],r:3.5,n:2},{at:WH,r:3,n:2},{at:[-32,23],r:3,n:1}],
    zebras:[{at:[22,-9],r:6,n:7}], gnus:[{at:[11,-20],r:7,n:8}], gazelles:[{at:[28,-17],r:5,n:6},{at:[-2,-28],r:5,n:4}], giraffes:[{at:[GROVE[0]+3,GROVE[1]-4],r:6,n:3},{at:[24,-2],r:4,n:2}],
    vultures:{at:[16,-14],n:5,r:7}, gulls:{at:[VIL[0]+4,VIL[1]+2],n:5}, lizards:[{at:KOP,r:6,n:6}]},
  base(x,z,n){const R=Math.hypot(x,z),ri=isl(x,z);
    let h=1.0+.3*fbm(n,x*.045,z*.045,3)+.06*fbm(n,x*.3,z*.3,2);
    h+=.9*smt((z-20)/12)*(.6+.4*n(x*.08,z*.08));                       // de lave åsene i nord
    h+=kopH(x,z,n);                                                     // Løveklippen
    h-=2.4*smt((R-ri+2)/4);                                             // havet
    // Krokodilleelva: en renne under vannflaten, grunnere ved vadestedene
    {const d=lineD(RIV,x,z);if(d<RIV_W+3.2){let bed=WATER-.48*(1-(d/RIV_W)**2);let f=0;for(const fd of FORDS)f=Math.max(f,smt((3.6-Math.hypot(x-fd[0],z-fd[1]))/2));
      bed=bed*(1-f)+(WATER-.11)*f;const w=smt((RIV_W+3.2-d)/3.2);h=Math.min(h,h*(1-w)+bed*w+(d>RIV_W?(d-RIV_W)*.22:0))}}
    // vannhullet: en skål med gjørmekant
    {const d=Math.hypot(x-WH[0],z-WH[1]);if(d<WH_R+4){const bed=WATER-.55*(1-(Math.min(d,WH_R)/WH_R)**2)+(d>WH_R?(d-WH_R)*.2:0);h=Math.min(h,h*(1-smt((WH_R+4-d)/4))+bed*smt((WH_R+4-d)/4))}}
    return h},
  surf(x,z,n){const R=Math.hypot(x,z),ri=isl(x,z),dr=lineD(RIV,x,z),dw=Math.hypot(x-WH[0],z-WH[1]),dk=Math.hypot(x-KOP[0],z-KOP[1]);
    if(R>ri-6)return S.SAND;
    if(dr<RIV_W+.4){for(const fd of FORDS)if(Math.hypot(x-fd[0],z-fd[1])<3.8)return S.GRAVEL;return S.MUD}
    if(dr<RIV_W+1.6)return n(x*.8,z*.8)>.5?S.MUD:S.GRASS;
    if(dw<WH_R+1.6)return S.MUD;
    if(dk<KOP_R-1.5&&n(x*.5+7,z*.5)>.3)return S.ROCK;
    if(dk<KOP_R)return S.GRAVEL;
    return n(x*.12+3,z*.12)>.68?S.DIRT:S.GRASS},
  build(c){const R=c.rng;
    // --- veiene, løypene og broa ---
    for(const r of ROADS)c.road(r,{hw:1.35,blend:2,surf:S.DIRT});
    for(const ch of CH)c.course(ch);
    c.bridge(BRIDGE[0][0],BRIDGE[0][1],BRIDGE[1][0],BRIDGE[1][1],1.2,{sag:.18});
    for(const[x,z]of BRIDGE)c.anchor(x,z);
    // --- safarileiren: telt, vakttårn, safaribiler, bålplass og skilt ---
    {const[cx,cz]=CAMP,ch=H(cx,cz);c.flat(cx,cz,3.4,ch,2.4);c.block(cx,cz,4);
      for(const[dx,dz,ry,col]of[[-2.2,1.6,.3,'#c8b48a'],[0,2.4,0,'#b8a478'],[2.2,1.6,-.3,'#c8b48a']]){const x=cx+dx,z=cz+dz;   // teltene: vegger og to takflater
        c.box(x,ch,z,1.3,.5,1.0,col,ry);for(const sd of[-1,1])c.box(x+Math.cos(ry)*sd*.33,ch+.62,z-Math.sin(ry)*sd*.33,.75,.05,1.1,'#9a8a62',ry,{rz:-sd*.62});c.box(x+Math.sin(ry)*.51,ch,z+Math.cos(ry)*.51,.34,.4,.02,'#3a3022',ry);c.colliders.push({x,z,r:.7,anchor:true,y:ch+.3})}
      {const tx=cx+2.6,tz=cz-1.6;for(const[ox,oz]of[[-.45,-.45],[.45,-.45],[-.45,.45],[.45,.45]])c.cyl(tx+ox,ch,tz+oz,.06,2.4,'#6a4a2e');   // vakttårnet
        c.box(tx,ch+2.4,tz,1.3,.08,1.3,'#8a6a3e');for(const s of[-1,1]){c.box(tx+s*.62,ch+2.62,tz,.04,.36,1.3,'#7a5a34');c.box(tx,ch+2.62,tz+s*.62,1.3,.36,.04,'#7a5a34')}
        for(const sd of[-1,1])c.box(tx+sd*.38,ch+3.2,tz,.82,.05,1.5,'#c9b070',0,{rz:-sd*.5});for(let i=0;i<8;i++)c.box(tx+.62,ch+.3*i+.15,tz+.3,.04,.03,.3,'#6a4a2e');
        c.colliders.push({x:tx,z:tz,w:1.1,d:1.1,ry:0,anchor:true,y:ch+1})}
      for(const[dx,dz,ry,col]of[[-2.6,-1.8,.4,'#6a7a4a'],[.2,-2.6,-.2,'#c8b48a']]){const x=cx+dx,z=cz+dz;c.box(x,ch+.12,z,.9,.34,1.8,col,ry);c.box(x+Math.sin(ry)*-.2,ch+.46,z+Math.cos(ry)*-.2,.82,.32,.9,'#2a3a3a',ry);   // safaribilene
        c.box(x,ch+.82,z,.9,.03,1.1,'#5a4a32',ry);for(const s of[-1,1])for(const f of[-.55,.55])c.cyl(x+Math.cos(ry)*s*.45+Math.sin(ry)*f,ch,z-Math.sin(ry)*s*.45+Math.cos(ry)*f,.17,.17,'#1a1918',{rz:Math.PI/2,ry});c.colliders.push({x,z,w:.95,d:1.85,ry,anchor:true,y:ch+.4})}
      c.cyl(cx,ch,cz,.32,.06,'#4a4440');for(let i=0;i<6;i++){const a=i*1.05;c.box(cx+Math.cos(a)*.38,ch+.06,cz+Math.sin(a)*.38,.14,.1,.12,'#6a6460',a)}c.steam(cx,cz,ch+.1,.25);   // bålet
      for(let i=0;i<4;i++){const a=i*1.57+.6;c.box(cx+Math.cos(a)*1.0,ch,cz+Math.sin(a)*1.0,.5,.12,.16,'#7a5a34',a)}   // benker rundt bålet
      c.fx.push({type:'sign',x:cx-3.6,z:cz-2.2,ang:Math.PI*.8,text:'SAFARILEIREN',sub:'pass deg for løvene'})}
    c.fx.push({type:'sign',x:VROAD[0]+2.2,z:VROAD[1]-1.4,ang:Math.PI*.7,text:'LØVEØYA',sub:'nasjonalpark · ikke gå ut av bilen'});
    c.fx.push({type:'sign',x:BRIDGE[0][0]+1.8,z:BRIDGE[0][1]-1,ang:Math.PI,text:'KROKODILLER',sub:'kjør over broa'});
    // --- gullmutterne: plassen rundt dem holdes fri, så ingen stein, trær eller dyr havner oppå ---
    for(const[x,z,l]of[[KOP[0]-1.5,KOP[1]-1.2,'Mellom blokkene på Løveklippen'],[GROVE[0]+1.5,GROVE[1]+2.2,'Inne i baobablunden'],[WH[0]+6.5,WH[1]+3.5,'Der elefantene drikker'],
      [CAMP[0]+2.6,CAMP[1]-3.1,'Under vakttårnet'],[-32,19.5,'Ved elveosen']]){c.secret(x,z,l);c.block(x,z,1.3)}
    // --- Løveklippen: avrundede granittblokker utenfor løypa, noen stablet oppå hverandre ---
    for(let i=0;i<160;i++){const a=R()*6.28,d=Math.sqrt(R())*KOP_R*1.05,x=KOP[0]+Math.cos(a)*d,z=KOP[1]+Math.sin(a)*d,r=.6+R()*1.6*(1-d/KOP_R*.4);if(c.dist(x,z)<r+1.5||!c.free(x,z,r*.8))continue;
      rock(x,z,r,.8+R()*1.3,{ang:R()*6.3,ax:1+R()*.45,sharp:.25,nz:.25,surf:S.ROCK});if(r>.9)c.anchor(x,z)}
    for(let i=0;i<40;i++){const x=(R()-.5)*72,z=(R()-.5)*72,r=.4+R()*.9;if(Math.hypot(x,z)>isl(x,z)-7||c.dist(x,z)<r+2.2||!c.free(x,z,r)||lineD(RIV,x,z)<RIV_W+2||Math.hypot(x-WH[0],z-WH[1])<WH_R+2)continue;
      rock(x,z,r,.3+R()*.6,{ang:R()*6.3,ax:1+R()*.6,sharp:.4,surf:S.ROCK});if(r>.9)c.anchor(x,z)}
    c.finish();
    // --- trær, tuer og gress (data/savanne.js) ---
    const dry=(x,z)=>lineD(RIV,x,z)>RIV_W+2.4&&Math.hypot(x-WH[0],z-WH[1])>WH_R+2.5&&Math.hypot(x-KOP[0],z-KOP[1])>KOP_R-2&&Math.hypot(x,z)<isl(x,z)-8;
    // r for akasiene er kronen, ikke stammen: da henger ingen krone inn over veier og løyper, og kameraet havner ikke inni dem
    c.sow('savanne_baobab',6,GROVE,8,{r:.8,gap:3.6,ok:dry,p:R=>({s:1+R()*.5,blad:R()*.6})});
    c.sow('savanne_baobab',5,[0,0],32,{r:.8,gap:12,ok:dry,p:R=>({s:.8+R()*.5,blad:R()*.4})});
    c.sow('savanne_akasie',55,[0,0],34,{r:1.5,gap:3.2,ok:dry,p:R=>({s:.8+R()*.6,krone:.8+R()*.5,reir:Math.floor(R()*5)})});
    c.sow('savanne_akasie',8,WH,WH_R+7,{r:1.5,gap:2.6,ok:dry,p:R=>({s:1.1+R()*.4,reir:2+Math.floor(R()*4)})});
    c.sow('savanne_termitt',34,[0,0],34,{r:.4,gap:3,ok:dry,p:R=>({s:.6+R()*.9,spir:1+Math.floor(R()*5)})});
    c.sow('savanne_knokler',6,[14,-16],14,{r:.3,gap:4,ok:dry});
    c.sow('savanne_gress',260,[0,0],35,{r:.2,gap:1,ok:dry,p:R=>({s:.7+R()*.7})});
    // --- de store dyrene som står i ro: elefanter ved vannhullet, flodhester i vannet ---
    {const ea=[[-.6,'drikk'],[.2,'drikk'],[.9,'kalv']];for(const[k,kind]of ea){const a=k,d=WH_R+.9,x=WH[0]+Math.cos(a)*d,z=WH[1]+Math.sin(a)*d;c.plant('savanne_elefant',x,z,{s:.85,retning:a+Math.PI,drikker:kind==='drikk'?1:0,unge:kind==='kalv'?1:0})}}
    for(const[dx,dz,a]of[[-1.5,.5,.4],[.8,-1.6,2.2],[1.8,1.2,4]])c.plant('savanne_flodhest',WH[0]+dx,WH[1]+dz,{y:WATER,retning:a,s:.9});
    c.plant('savanne_flodhest',-26,20.5,{y:WATER,retning:1.2,s:.8});
    c.props();
    // --- småting: tørre gresstuster, småstein og skjell på stranda ---
    c.tufts(260,['#c9a84a','#b8963c','#d8bc66','#9a8a3c']);
    c.pebbles(500,['#8a5a3a','#a07050','#6a4a32','#b89a7a'],.04,.12);c.shells(80);
    // siv langs elva og vannhullet
    const reeds=[];for(let i=0;i<1400&&reeds.length<480;i++){const x=(R()-.5)*80,z=(R()-.5)*80,dr=lineD(RIV,x,z),dw=Math.hypot(x-WH[0],z-WH[1]);
      if(!((dr>RIV_W-.3&&dr<RIV_W+1.2)||(dw>WH_R-.4&&dw<WH_R+1))||c.dist(x,z)<1.6||!c.free(x,z,.1))continue;
      reeds.push({x,y:H(x,z)-.02,z,sx:.04,sy:.5+R()*.6,sz:.04,rx:(R()-.5)*.4,rz:(R()-.5)*.4,c:['#6a8a3a','#8a9a4a','#5a7a32'][i%3]})}
    instanced(DG.tuft,DM.tuft,reeds,c.decor,false);
  }}
);
})();
