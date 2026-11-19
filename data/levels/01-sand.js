// Bane: se README for hva feltene betyr. Rekkefølgen i menyen følger rekkefølgen i index.html.
LEVELS.push(
{ id:'sand', name:'Bykkevika', diff:1, seed:11, gates:10, size:120, coast:42, airport:{at:[41,0],dir:0,end:-1,road:[[30,-17]]}, village:{at:[-26.2,26.2]}, animals:{lizards:[{at:[8,8],r:12,n:6}],gulls:{at:[2,-37],n:5},crabs:6,crabsAt:[10,37]},
  desc:'Lyse klitter, en oase, et sandhopp og en vannpytt. Fin bane for å lære lavgiret.',
  sky:['#4f95d6','#d9ecf7'], fog:0xd3e5ee, fogNear:28, fogFar:88, sun:0xfff2da, sunI:1.1, hemi:[0xd6ebff,0xd0bf9c,.62], sunDir:[-16,28,14], rockCol:'#cbc4b4', waterCol:'#4fb0b6',
  path:[[-27,-27],[-16,-22],[-8,-26],[2,-20],[6,-10],[-2,-2],[-12,4],[-14,15],[-6,24],[8,24],[18,15],[22,4],[27,-6],[24,-18],[28,-27]],
  base:(x,z,n)=>2+.9*Math.sin(x*.13+1.3)*Math.cos(z*.11)+.7*Math.sin((x+z)*.07)+fbm(n,x*.05,z*.05,4)*2.4+.03*Math.sin(x*2.2+z*.9),
  surf:()=>S.SAND,
  build(c){const R=c.rng;
    for(let i=0;i<90;i++){const x=(R()-.5)*64,z=(R()-.5)*64,r=1.1+R()*2.3,h=.7+R()*1.9;if(c.dist(x,z)<r+1.5||c.nearGate(x,z,r+2)||c.nearStart(x,z,r+4))continue;rock(x,z,r,h,{ang:R()*6.3,ax:1+R()*.7,sharp:.45+R()*.3});if(r>1.0)c.anchor(x,z)}
    for(let i=0;i<120;i++){const x=(R()-.5)*64,z=(R()-.5)*64;let r=.35+R()*.7,h=.18+R()*.5;if(c.dist(x,z)<1.8){h=Math.min(h,.36);r=Math.min(r,.8)}if(c.nearGate(x,z,r+.8)||c.nearStart(x,z,3.5))continue;rock(x,z,r,h,{ang:R()*6.3,ax:1+R()*.5})}
    for(const t of[.17,.36,.65,.83]){const p=c.P(t),tn=c.T(t),s=c.side(t);for(let i=0;i<9;i++){const a=(R()-.5)*4.4,b=(R()-.5)*3;rock(p.x+tn.x*a+s.x*b,p.z+tn.z*a+s.z*b,.4+R()*.5,.2+R()*.3,{ang:R()*6.3,ax:1+R()*.6})}}
    {const t=.553,p=c.P(t),s=c.side(t);for(let b=-3.2;b<=3.21;b+=.8)rock(p.x+s.x*b,p.z+s.z*b,.95,.5,{sharp:.5,nz:.2})}
    // oasis beside the line, a shallow puddle on it, and a sand jump
    {const t=.45,p=c.P(t),s=c.side(t);c.pond(p.x+s.x*3.6,p.z+s.z*3.6,2.6,.7,{bed:S.MUD})}
    {const t=.72,p=c.P(t);c.pond(p.x,p.z,1.7,.26,{fill:.4})}
    c.ramp(.3,.45,3,2.8);
    {const p=c.P(.45),s=c.side(.45);c.secret(p.x+s.x*6.4,p.z+s.z*6.4,'Bak oasen')}c.secret(0,0,'Midt i klittene');c.secret(2,-37,'Stranden i sør');c.secret(10,37,'Stranden i nord');c.secret(-33,18,'Bak landsbyen');
    c.finish();
    c.pebbles(900,['#bdb6a6','#d2cbbb','#a59e90'],.04,.13);
    c.tufts(110,['#b9a467','#a89558','#c9b77d']);c.bushes(25,['#8a8a4a','#9a9a5a'],(x,z)=>c.onLand(x,z));c.shells(160);
    // subtropiske planter og dyr (data/vegetasjon.js, data/dyr.js): palmer og flamingoer ved oasen, agave og øgler i klittene, sypresser og oliventrær ved landsbyen
    {const t=.45,p=c.P(t),s=c.side(t),O=[p.x+s.x*3.6,p.z+s.z*3.6];
      c.sow('subtrop_palme',6,O,6.5,{r:.35,gap:1.8,p:R=>({s:.8+R()*.4,helning:R()*1.6})});
      c.sow('subtrop_flamingo',3,O,4.2,{r:.2,gap:.7,p:R=>({ettbein:R()<.6?1:0})})}
    c.sow('subtrop_agave',14,[0,0],32,{r:.45,gap:3,p:R=>({s:.8+R()*.5,stilk:R()<.25?1:0})});
    c.sow('subtrop_perleogle',4,[0,0],30,{r:.4,gap:6});
    c.sow('subtrop_skilpadde',3,[0,0],30,{r:.35,gap:6,p:R=>({hode:R()<.7?1:0})});
    c.sow('subtrop_sypress',6,[-26.2,26.2],12,{r:.3,gap:1.5});
    c.sow('subtrop_oliven',4,[-20,18],10,{r:.3,gap:2.5});
    {const t=.45,p=c.P(t),s=c.side(t),L=[];const R2=c.rng;for(let i=0;i<40;i++){const a=R2()*6.28,d=2.5+R2()*1.1,x=p.x+s.x*3.6+Math.cos(a)*d,z=p.z+s.z*3.6+Math.sin(a)*d;
      L.push({x,y:H(x,z)-.02,z,sx:.06,sy:.5+R2()*.5,sz:.06,rx:(R2()-.5)*.5,rz:(R2()-.5)*.5,c:['#4f7a2c','#6c9a3a'][i%2]})}instanced(DG.tuft,DM.tuft,L,c.decor,false)}
  }}
);
