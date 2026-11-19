// Bane: se README for hva feltene betyr. Rekkefølgen i menyen følger rekkefølgen i index.html.
LEVELS.push(
{ id:'stein', name:'Spornes', diff:3, seed:27, gates:10, size:120, coast:42, airport:{at:[-41,0],dir:180,end:-1,road:[[-28,14]]}, village:{at:[26.2,-26.2]}, animals:{lizards:[{at:[0,0],r:14,n:6}],gulls:{at:[0,37],n:5}},
  desc:'Tett med stein, en steintrapp og en trang passasje. Her trengs presisjon.',
  sky:['#6f9ec6','#e6e2d6'], fog:0xd6d6cf, fogNear:24, fogFar:82, sun:0xfff0d8, sunI:1.05, hemi:[0xdfe9f2,0x6c6458,.6], sunDir:[20,26,10], rockCol:'#958f84', waterCol:'#5a7a80',
  path:[[-26,-26],[-14,-27],[-4,-20],[-10,-10],[-20,-4],[-22,8],[-12,14],[0,10],[8,0],[18,-6],[26,2],[22,14],[12,22],[24,27]],
  base:(x,z,n)=>.6+fbm(n,x*.06,z*.06,4)*1.6+.6*Math.sin(x*.09)*Math.sin(z*.1)+.06*fbm(n,x*1.2,z*1.2,2),
  surf:()=>S.GRAVEL,
  build(c){const R=c.rng;
    // stone staircase
    {const t=.17,p=c.P(t),an=c.ang(t);c.block(p.x,p.z,5.5);
     shape(p.x,p.z,an,7.2,5,(a)=>{const u=a+3.6;if(u<2.8)return(Math.floor(u/.7)+1)*.19;if(u<4.4)return .76;return(Math.floor((7.2-u)/.7)+1)*.19},S.ROCK,(a,b)=>{const u=a+3.6,st=Math.floor(u/.7);return mix('#8d887f','#aaa498',((st%2)*.6+G.noise(b*2,a*2)*.4))})}
    // narrow gap
    {const t=.55,p=c.P(t),s=c.side(t);c.block(p.x,p.z,2.5);for(const sg of[1,-1])rock(p.x+s.x*3.1*sg,p.z+s.z*3.1*sg,1.9,1.9,{sharp:.35,nz:.25})}
    // big hump
    {const t=.76,p=c.P(t);c.block(p.x,p.z,3);rock(p.x,p.z,2.6,1.0,{sharp:1.1,nz:.15})}
    // rain puddle between the rocks
    {const t=.44,p=c.P(t);c.block(p.x,p.z,2.2);c.pond(p.x,p.z,1.5,.22,{fill:.45,bed:S.GRAVEL})}
    for(let i=0;i<240;i++){const x=(R()-.5)*66,z=(R()-.5)*66;let r=.5+R()*2,h;const d=c.dist(x,z);
      if(d<r+.7){if(R()<.5)continue;r=Math.min(r,1.1);h=.18+R()*.32}else h=.4+R()*1.3;
      if((c.nearGate(x,z,r+.6)&&h>.35)||c.nearStart(x,z,r+3)||!c.free(x,z,r))continue;rock(x,z,r,h,{ang:R()*6.3,ax:1+R()*.8,sharp:.45});if(r>1.0)c.anchor(x,z)}
    for(const t of[.36,.64,.9]){const p=c.P(t),tn=c.T(t),s=c.side(t);for(let i=0;i<8;i++){const a=(R()-.5)*4,b=(R()-.5)*3;rock(p.x+tn.x*a+s.x*b,p.z+tn.z*a+s.z*b,.45+R()*.5,.28+R()*.25,{ang:R()*6.3,ax:1+R()*.6})}}
    {const p=c.P(.17),s=c.side(.17);c.secret(p.x+s.x*4.5,p.z+s.z*4.5,'Ved steintrappa')}{const p=c.P(.55);c.secret(p.x,p.z+5,'Over den trange passasjen')}c.secret(0,36,'Nordspissen');c.secret(19,-33,'Bak kaia');c.secret(-2,2,'Midt på øya');
    c.finish();
    c.pebbles(1500,['#6f685d','#8f887c','#a49d90','#5d574e'],.04,.14);c.bushes(20,['#6a7a3a','#8a8a4a'],(x,z)=>c.onLand(x,z));c.shells(80);
  }}
);
