// Bane: se README for hva feltene betyr. Rekkefølgen i menyen følger rekkefølgen i index.html.
LEVELS.push(
{ id:'skog', name:'Froland', diff:2, seed:53, gates:10, size:120, coast:42, airport:{at:[41,-17],dir:0,len:40,end:1,road:[[34,-7]]}, village:{at:[18.5,-32]},
  desc:'Regn, stokker, to gjørmehull og en bekk du må vade over. Trestammene er enorme i denne skalaen.',
  sky:['#7d94a3','#c9c6b4'], fog:0xa9b39c, fogNear:14, fogFar:58, sun:0xe8e0cc, sunI:.7, hemi:[0xb9c8c4,0x3e4428,.7], sunDir:[18,22,-10], rockCol:'#7d8270', water:.02, waterCol:'#3f5a4a', rain:true, clouds:false, animals:{deer:[{at:[-16,-12],r:7,n:3}],rabbits:[{at:[14,10],r:6,n:4}],fish:[{at:[0,6],r:5,n:2}]},
  path:[[-27,-24],[-18,-26],[-8,-20],[-6,-10],[-16,-4],[-20,6],[-12,14],[-2,10],[6,2],[14,-6],[24,-4],[26,8],[18,18],[6,24],[-4,27]],
  stream:x=>6+4*Math.sin(x*.12),
  base(x,z,n){const ds=Math.abs(z-(6+4*Math.sin(x*.12)));const sm=Math.min(1,Math.max(0,(ds-1.5)/6.5)),s2=sm*sm*(3-2*sm);
    let h=.35+(fbm(n,x*.05,z*.05,4)*1.8+.9*Math.sin(x*.08+z*.05)+2.8)*s2;if(ds<2.4)h-=.6*(1-(ds/2.4)**2);return h+.03*fbm(n,x*1.5,z*1.5,2)},
  surf(x,z){return Math.abs(z-(6+4*Math.sin(x*.12)))<1.9?S.MUD:S.GRASS},
  build(c){const R=c.rng,def=this;
    for(let i=0;i<c.pts.length;i+=2){const p=c.pts[i];paint(p.x,p.z,1.35,S.DIRT,S.MUD)}
    const bark=(u,d)=>d>.8?'#3d2a1a':mix('#5a3f28','#7a5638',G.noise(u*30,d*4));
    const L=(t,off,r,len)=>{const p=c.P(t),tn=c.T(t),s=c.side(t),cx=p.x+tn.x*off,cz=p.z+tn.z*off,tw=(R()-.5)*.6;
      log(cx-s.x*len/2+tn.x*tw,cz-s.z*len/2+tn.z*tw,cx+s.x*len/2-tn.x*tw,cz+s.z*len/2-tn.z*tw,r,S.BARK,bark)};
    L(.17,0,.24,4.6);L(.385,0,.28,5);L(.6,-.45,.2,4.4);L(.6,.45,.22,4.4);L(.84,0,.3,5.2);
    for(const t of[.46,.67]){const p=c.P(t);c.pond(p.x,p.z,2.1,.16,{fill:.55,bog:true})}
    for(let i=0;i<46;i++){const t=.02+R()*.95,p=c.P(t);if(c.nearGate(p.x,p.z,1.6))continue;const a=R()*6.28,len=.8+R()*1.6,x0=p.x+(R()-.5)*2.6,z0=p.z+(R()-.5)*2.6;
      log(x0,z0,x0+Math.sin(a)*len,z0+Math.cos(a)*len,.05+R()*.04,S.BARK,()=>'#4e3a28')}
    for(let i=0;i<70;i++){const x=(R()-.5)*66,z=(R()-.5)*66,r=.6+R()*1.8,h=.4+R()*1.2;if(c.dist(x,z)<r+1.2||c.nearGate(x,z,r+1.5)||c.nearStart(x,z,r+3))continue;rock(x,z,r,h,{ang:R()*6.3,ax:1+R()*.6});if(r>1.0)c.anchor(x,z)}
    for(let i=0;i<16;i++){const t=.04+R()*.92,p=c.P(t),s=c.side(t),b=(R()-.5)*2;if(c.nearGate(p.x,p.z,1.2))continue;rock(p.x+s.x*b,p.z+s.z*b,.35+R()*.35,.18+R()*.18,{ang:R()*6.3})}
    const trunks=[];
    for(let i=0;i<600&&trunks.length<80;i++){const x=(R()-.5)*66,z=(R()-.5)*66,r=.5+R()*.75;if(Math.abs(z-def.stream(x))<r+2.6||!c.onLand(x,z))continue;
      if(c.dist(x,z)<r+2.3||c.nearGate(x,z,r+2.5)||c.nearStart(x,z,r+3))continue;if(trunks.some(t=>Math.hypot(t.x-x,t.z-z)<t.r+r+1.4))continue;
      trunks.push({x,z,r});c.plant('kjempestamme',x,z,{r});rock(x,z,r*1.9,.32,{surf:S.BARK,sharp:1.8,nz:.2})}
    c.secret(0,def.stream(0)+3,'Ved bekken');c.secret(-24,22,'Mellom de store trærne');c.secret(-37,0,'Stranden i øst');c.secret(36,10,'Vestsiden');c.secret(11,-33,'Bak kaia');
    c.finish();
    c.plants();   // kjempestammene (js/props/kjempestamme.js)
    const ferns=[];for(let i=0;i<700&&ferns.length<260;i++){const x=(R()-.5)*66,z=(R()-.5)*66;if(c.dist(x,z)<1.9||Math.abs(z-def.stream(x))<1.8||!c.onLand(x,z))continue;const s=.25+R()*.4;
      ferns.push(c.plant('bregne',x,z,{s,c:['#3f6b28','#58802f','#2f5a22'][i%3]}))}
    c.plants();   // bregnene (js/props/bregne.js)
    const cones=[];for(let i=0;i<180;i++){const x=(R()-.5)*66,z=(R()-.5)*66;if(Math.abs(z-def.stream(x))<1.6)continue;cones.push({x,y:H(x,z)+.05,z,sx:.07,sy:.11,sz:.07,rx:1.5,ry:R()*6,c:'#6b4a2c'})}
    instanced(DG.cone,DM.white,cones,c.decor);
    c.pebbles(400,['#6e6d60','#83806f'],.04,.1);
    c.bushes(50,['#3e6b28','#58802f','#2f5a22'],(x,z)=>Math.abs(z-def.stream(x))>3&&c.onLand(x,z));c.mushrooms(70,(x,z)=>c.onLand(x,z));c.shells(60);
  }}
);
