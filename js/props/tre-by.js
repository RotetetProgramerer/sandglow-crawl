'use strict';
/* Bytre: rett stamme, to korte greiner og en rund krone av tre kuler. Duene sitter på toppen. Brukes i Arendal. */
PROPS.bytre={
  navn:'Bytre',info:'Parktre i Arendal. c.plant(\'bytre\',x,z,{s})',
  params:{
    s:{v:1,min:.5,max:2,step:.05,navn:'Størrelse'},
    stamme:{v:1,min:.6,max:1.6,step:.05,navn:'Stammelengde'},
    krone:{v:1,min:.6,max:1.6,step:.05,navn:'Kronestørrelse'}
  },
  LEAF:['#4f8a3a','#3f7a34','#5a9a44'],
  place(x,z,o,env){const p=propParams('bytre',o,env.rng);env.colliders.push({x,z,r:.1*p.s,anchor:true,y:env.H(x,z)+.6});return Object.assign({x,z},p)},
  build(t,env,out){const R=env.rng,s=t.s,k=s*t.krone,h=(1.4*s+.3)*t.stamme,r=.075*s;
    const y=footY(env.H,t.x,t.z,r)-.03,top=y+h,bark=tint('#5a4330',(R()-.5)*.15),hue=(R()-.5)*.12;
    out.add(PG.taper,DM.bark,{x:t.x,y:y+h/2,z:t.z,sx:r,sy:h,sz:r,c:bark});
    // to greiner fra øvre del av stammen og inn i kronen
    const a0=R()*6.28;for(let i=0;i<2;i++){const a=a0+i*Math.PI+(R()-.5)*.6,b={x:t.x,y:y+h*.72,z:t.z},v=tiltVec(a,.75),L=.42*k;
      out.add(DG.branch,DM.bark,stemBetween(b,{x:b.x+v.x*L,y:b.y+v.y*L,z:b.z+v.z*L},r*.45,{c:bark}))}
    // kronen: hovedkula senkes ned rundt stammetoppen, så det aldri blir glipe mellom stamme og løv
    const L=[{x:t.x,y:top+.28*k,z:t.z,sx:.72*k,sy:.52*k,sz:.72*k,c:tint(this.LEAF[0],hue)}];
    for(let i=0;i<2;i++){const a=i*2.6+a0,d=.32*k;L.push({x:t.x+Math.cos(a)*d,y:top+.45*k,z:t.z+Math.sin(a)*d,sx:.55*k,sy:.48*k,sz:.55*k,c:tint(this.LEAF[i+1],hue+.04)})}
    L.push({x:t.x+Math.cos(a0+4.4)*.22*k,y:top+.02*k,z:t.z+Math.sin(a0+4.4)*.22*k,sx:.48*k,sy:.36*k,sz:.48*k,c:tint(this.LEAF[1],hue-.15)});
    let hi=L[0];for(const b of L){out.add(PG.crown,DM.leaf,b);if(b.y+b.sy>hi.y+hi.sy)hi=b}
    env.perches.push({x:hi.x,y:hi.y+hi.sy*.9,z:hi.z,kind:'top'})}
};
