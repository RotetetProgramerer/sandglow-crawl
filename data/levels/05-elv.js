// Bane: se README for hva feltene betyr. Rekkefølgen i menyen følger rekkefølgen i index.html.
LEVELS.push(
{ id:'elv', name:'Nidelva', diff:3, seed:97, gates:10, water:.74, waterCol:'#4d7064', size:120, coast:42, airport:{at:[0,-41],dir:270,end:-1,road:[[-22,-28]]}, village:{at:[-26.2,26.2]}, animals:{fish:[{at:[-16,-3],r:5,n:3},{at:[15,7],r:5,n:2}],deer:[{at:[20,-20],r:6,n:2}],rabbits:[{at:[-8,16],r:5,n:3}]},
  desc:'Tre vadesteder, to gjørmehull og et hopp. Hold deg på grunnene, ellers drukner motoren.',
  sky:['#5c9ad1','#dce9ea'], fog:0xcfdad6, fogNear:26, fogFar:84, sun:0xfff0d0, sunI:1.1, hemi:[0xd8e6f0,0x6a6a4a,.62], sunDir:[-18,26,-12], rockCol:'#8d8a7e',
  path:[[-27,-24],[-21,-14],[-16,-3],[-10,8],[-3,12],[2,3],[6,-8],[14,-7],[15,7],[20,16],[26,24]],
  stream:x=>2+5*Math.sin(x*.1), fords:[[-16,-3],[2,3],[15,7]],
  base(x,z,n){const ds=Math.abs(z-this.stream(x)),sm=Math.min(1,Math.max(0,(ds-2.6)/7)),s2=sm*sm*(3-2*sm);
    let h=.9+(1.5*Math.min(1,Math.max(0,fbm(n,x*.05,z*.05,4)+.5))+.35*(Math.sin(x*.08+1)*Math.cos(z*.09)+1))*s2;
    if(ds<2.8){let dep=1.15*(1-(ds/2.8)**2),f=0;for(const fd of this.fords){const d=Math.hypot(x-fd[0],z-fd[1]);f=Math.max(f,Math.min(1,Math.max(0,1-d/4.4)))}dep*=1-.74*f*f*(3-2*f);h-=dep}
    return h+.03*fbm(n,x*1.5,z*1.5,2)},
  surf(x,z){const ds=Math.abs(z-this.stream(x));return ds<3.4?(ds<2.3?S.GRAVEL:S.MUD):S.GRASS},
  build(c){const R=c.rng,def=this;
    for(let i=0;i<c.pts.length;i+=2){const p=c.pts[i];if(Math.abs(p.z-def.stream(p.x))>3.4)paint(p.x,p.z,1.3,S.DIRT)}
    for(const t of[.35,.68]){const p=c.P(t);c.pond(p.x,p.z,2.3,.18,{fill:.55,bog:true})}
    c.ramp(.62,.6,3.4,2.6);
    for(let i=0;i<150;i++){const x=(R()-.5)*66,z=(R()-.5)*66,r=.6+R()*1.9,h=.4+R()*1.3;if(Math.abs(z-def.stream(x))<r+3||c.dist(x,z)<r+1.3||c.nearGate(x,z,r+1.5)||c.nearStart(x,z,r+3)||!c.free(x,z,r))continue;rock(x,z,r,h,{ang:R()*6.3,ax:1+R()*.7});if(r>1.0)c.anchor(x,z)}
    for(let i=0;i<24;i++){const t=.04+R()*.92,p=c.P(t),s=c.side(t),b=(R()-.5)*2.2;if(c.nearGate(p.x,p.z,1.2)||Math.abs(p.z-def.stream(p.x))<3.5)continue;rock(p.x+s.x*b,p.z+s.z*b,.35+R()*.4,.18+R()*.2,{ang:R()*6.3})}
    // river stones poking out of the fords
    for(const fd of def.fords)for(let i=0;i<7;i++){const a=R()*6.28,d=1.2+R()*2.2;rock(fd[0]+Math.cos(a)*d,fd[1]+Math.sin(a)*d,.3+R()*.3,.35+R()*.3,{sharp:.5,nz:.2})}
    const trunks=[];
    for(let i=0;i<500&&trunks.length<34;i++){const x=(R()-.5)*66,z=(R()-.5)*66,r=.5+R()*.7;if(Math.abs(z-def.stream(x))<r+4.5||c.dist(x,z)<r+2.4||c.nearGate(x,z,r+2.5)||c.nearStart(x,z,r+3)||!c.onLand(x,z))continue;
      if(trunks.some(t=>Math.hypot(t.x-x,t.z-z)<t.r+r+1.6))continue;trunks.push({x,z,r});c.plant('kjempestamme',x,z,{r});rock(x,z,r*1.9,.3,{surf:S.BARK,sharp:1.8,nz:.2})}
    c.secret(36,def.stream(36)+4.5,'Elvemunningen i vest');c.secret(-36,def.stream(-36)+4.5,'Elvemunningen i øst');c.secret(0,36,'Nordspissen');c.secret(10,-36,'Sørspissen');c.secret(2,def.stream(2)+5.5,'Over vadestedet');
    c.finish();
    c.plants();   // kjempestammene (js/props/kjempestamme.js)
    // reeds along the banks
    const reeds=[];for(let i=0;i<900&&reeds.length<420;i++){const x=(R()-.5)*66,z=(R()-.5)*66,ds=Math.abs(z-def.stream(x));if(ds<2.2||ds>4.2||c.dist(x,z)<1.6)continue;
      reeds.push({x,y:H(x,z)-.02,z,sx:.045,sy:.6+R()*.7,sz:.045,rx:(R()-.5)*.4,rz:(R()-.5)*.4,c:['#5d7f2f','#7a9a3c','#4b6b27'][i%3]})}
    instanced(DG.tuft,DM.tuft,reeds,c.decor,false);
    c.pebbles(700,['#7c7669','#9a9385','#5f5a50'],.04,.12);
    c.bushes(45,['#4b6629','#7f9441','#5a7a2f'],(x,z)=>Math.abs(z-def.stream(x))>5&&c.onLand(x,z));c.shells(60);
  }}
);
