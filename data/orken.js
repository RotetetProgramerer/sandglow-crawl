'use strict';
/* Ørkenen (Kameløya): kameler og beduiner som står eller sitter i ro, beduintelt, brønn og tornebusker. Prefikset er orken_*.
   Kamelene som går i karavane eller beiter og går unna bilen, og beduinen som leder karavanen, ligger i js/orkendyr.js.
   Samme regler som i data/dyr.js: place legger kollidere, build tegner. Retning 0 betyr at dyret eller personen ser langs +x. */

/* Kamel (dromedar): én pukkel, lange tynne bein med knoker, lang hals i en S-bue og et lite hode med tykke lepper.
   Liggende kamel har beina brettet under seg og halsen rett opp. Med last har den et teppe over pukkelen og sekker på sidene. */
PROPS.orken_kamel={dyr:true,
  navn:'Kamel (ørken)',info:'Dromedar som står eller ligger, med eller uten last. c.plant(\'orken_kamel\',x,z,{s,ligger,last})',
  params:{
    s:{v:1,min:.6,max:1.4,step:.05,navn:'Størrelse'},
    retning:DYR.retning,
    ligger:{v:0,min:0,max:1,step:1,navn:'Ligger'},
    last:{v:0,min:0,max:1,step:1,navn:'Teppe og sekker'},
    farge:{v:[0,1],min:0,max:1,step:.05,navn:'Lys–mørk'}
  },
  place(x,z,o,env){const p=propParams('orken_kamel',o,env.rng);env.colliders.push({x,z,r:(p.ligger>=.5?.45:.4)*p.s,anchor:true,y:env.H(x,z)+.6*p.s});return Object.assign({x,z},p)},
  build(t,env,out){const M=DYR.M,R=env.rng,s=t.s,lie=t.ligger>=.5,F=DYR.ramme(t.x,t.z,footY(env.H,t.x,t.z,.3*s),t.retning),P=F.P,V=F.V;
    const fur=DYR.blend('#d2a868','#9a7040',t.farge),lt=shade(fur,.18),dk=shade(fur,-.22);
    const bh=lie?.42*s:.98*s;                                                                       // høyden på kroppen
    DYR.el(out,M.pels,fur,P(0,bh,0),V(1,.05,0),.46*s,.25*s);                                         // kroppen
    DYR.el(out,M.pels,lt,P(.02*s,bh-.12*s,0),V(1,0,0),.36*s,.17*s);                                  // den lyse buken
    DYR.kule(out,M.pels,fur,P(-.02*s,bh+.2*s,0),.2*s,.17*s);DYR.kule(out,M.pels,shade(fur,-.06),P(-.02*s,bh+.3*s,0),.13*s,.08*s);   // pukkelen
    if(!lie){for(const sg of[-1,1])for(const f of[.3,-.3]){const hip=P(f*s,bh-.08*s,sg*.12*s),knee=P((f+.02)*s,.45*s,sg*.12*s),foot=P(f*s,.04*s,sg*.12*s);
        DYR.ledd(out,M.pels,fur,hip,knee,.055*s);DYR.kule(out,M.pels,dk,knee,.05*s);DYR.ledd(out,M.pels,fur,knee,foot,.04*s);DYR.kule(out,M.pels,dk,P((f+.03)*s,.03*s,sg*.12*s),.07*s,.03*s)}}
    else{for(const sg of[-1,1])for(const f of[.26,-.24]){DYR.el(out,M.pels,shade(fur,-.05),P(f*s,.12*s,sg*.2*s),V(1,0,0),.2*s,.07*s);DYR.kule(out,M.pels,dk,P((f+.18)*s,.08*s,sg*.2*s),.06*s,.04*s)}}   // beina brettet under seg
    // halsen: ned og fram fra skuldrene, så opp til hodet (liggende: rett opp)
    const neck=lie?[P(.36*s,bh+.05*s,0),P(.5*s,bh+.22*s,0),P(.58*s,bh+.5*s,0),P(.62*s,bh+.72*s,0)]:[P(.36*s,bh+.05*s,0),P(.55*s,bh-.08*s,0),P(.7*s,bh+.02*s,0),P(.78*s,bh+.24*s,0)];
    DYR.polse(out,M.pels,fur,neck,f=>(.085-.03*f)*s);
    const hd=neck[3],hp=(f,u,sd)=>({x:hd.x+(F.P(f*s,u*s,sd*s).x-F.P(0,0,0).x),y:hd.y+u*s,z:hd.z+(F.P(f*s,u*s,sd*s).z-F.P(0,0,0).z)});
    DYR.el(out,M.pels,fur,hp(.08,.03,0),V(1,-.15,0),.12*s,.065*s);                                   // hodet
    DYR.el(out,M.pels,lt,hp(.19,-.01,0),V(1,-.2,0),.06*s,.05*s);                                     // mulen med de tykke leppene
    for(const sg of[-1,1]){DYR.kule(out,M.glatt,'#1a1410',hp(.1,.07,sg*.05),.013*s);DYR.el(out,M.pels,dk,hp(-.01,.11,sg*.04),V(-.3,1,sg*.3),.035*s,.015*s)}   // øyne og ører
    DYR.polse(out,M.pels,dk,[P(-.44*s,bh+.05*s,0),P(-.5*s,bh-.15*s,0),P(-.5*s,bh-.32*s,0)],()=>.022*s);   // halen
    if(t.last>=.5){const rug=['#b8342a','#2f5a9a','#d9a030','#3f7a3a'][Math.floor(R()*4)];
      out.add(PG.blob,M.pels,{x:P(0,0,0).x,y:bh+.2*s,z:P(0,0,0).z,sx:.3*s,sy:.13*s,sz:.3*s,c:rug});                    // teppet over pukkelen
      out.add(PG.blob,M.pels,{x:P(0,0,0).x,y:bh+.31*s,z:P(0,0,0).z,sx:.18*s,sy:.05*s,sz:.18*s,c:shade(rug,.25)});
      for(const sg of[-1,1]){const b=P(-.04*s,bh-.02*s,sg*.3*s);out.add(PG.blob,M.pels,{x:b.x,y:b.y,z:b.z,sx:.13*s,sy:.17*s,sz:.13*s,c:sg>0?'#8a6a3e':'#a07a48'})}}   // sekkene
  }
};

/* Beduin: lang kjortel, et hodetørkle med svart ring (agal), og et brunt, solbrent ansikt. Stående med armene inntil,
   eller sittende med beina i kors. farge velger kjortelen. */
PROPS.orken_beduin={dyr:true,
  navn:'Beduin (ørken)',info:'Beduin som står eller sitter i kors. c.plant(\'orken_beduin\',x,z,{s,sitter,farge})',
  params:{
    s:{v:1,min:.7,max:1.3,step:.05,navn:'Størrelse'},
    retning:DYR.retning,
    sitter:{v:0,min:0,max:1,step:1,navn:'Sitter'},
    farge:{v:[0,5],min:0,max:5,step:1,navn:'Kjortel'},
    vinker:{v:0,min:0,max:1,step:1,navn:'Vinker'}
  },
  ROBE:['#f2efe6','#2a2a2e','#6a4a32','#3a4a6a','#e8dcc0','#5a6a4a'],
  place(x,z,o,env){const p=propParams('orken_beduin',o,env.rng);env.colliders.push({x,z,r:.16*p.s});return Object.assign({x,z},p)},
  build(t,env,out){const M=DYR.M,R=env.rng,s=t.s,sit=t.sitter>=.5,F=DYR.ramme(t.x,t.z,footY(env.H,t.x,t.z,.12*s),t.retning),P=F.P,V=F.V;
    const robe=this.ROBE[Math.round(t.farge)%6],skin=shade('#9a6a44',(R()-.5)*.15),scarf=R()<.5?'#f4f2ec':'#e8e0d0',check=R()<.6?'#c43b2f':'#f4f2ec';
    const hip=sit?.12*s:.42*s,top=sit?.55*s:.82*s;
    if(sit){DYR.el(out,M.pels,robe,P(.04*s,.07*s,0),V(0,0,1),.17*s,.08*s);for(const sg of[-1,1])DYR.el(out,M.pels,shade(robe,-.08),P(.1*s,.06*s,sg*.08*s),V(.3,0,-sg),.13*s,.055*s)}   // beina i kors
    else DYR.el(out,M.pels,robe,P(0,.24*s,0),V(0,1,0),.24*s,.1*s);                                 // kjortelen ned til føttene
    DYR.el(out,M.pels,robe,P(0,(hip+top)/2,0),V(0,1,0),(top-hip)/2+.03*s,.085*s);                  // overkroppen
    // armene: inntil kroppen, eller den ene vinker
    for(const sg of[-1,1]){const sh=P(0,top-.06*s,sg*.09*s),wave=t.vinker>=.5&&sg>0,el=wave?P(.02*s,top+.06*s,sg*.17*s):P(.03*s,top-.2*s,sg*.11*s),hd=wave?P(.03*s,top+.2*s,sg*.18*s):sit?P(.12*s,hip+.08*s,sg*.08*s):P(.05*s,top-.36*s,sg*.11*s);
      DYR.ledd(out,M.pels,robe,sh,el,.03*s);DYR.ledd(out,M.pels,robe,el,hd,.027*s);DYR.kule(out,M.pels,skin,hd,.022*s)}
    // hodet, tørkleet som henger ned bak, den svarte ringen og skjegget
    const h=P(0,top+.08*s,0);DYR.kule(out,M.pels,skin,{x:h.x,y:h.y,z:h.z},.055*s,.065*s);
    DYR.kule(out,M.pels,scarf,P(-.01*s,top+.1*s,0),.064*s,.06*s);DYR.el(out,M.pels,scarf,P(-.05*s,top+.02*s,0),V(-.4,-1,0),.08*s,.06*s);
    for(let i=0;i<5;i++){const a=i/5*6.28;DYR.kule(out,M.pels,check,P(-.01*s+Math.cos(a)*.045*s,top+.13*s,Math.sin(a)*.045*s),.012*s)}   // det rutete mønsteret
    out.add(PG.blob,M.glatt,{x:P(0,0,0).x,y:top+.15*s,z:P(0,0,0).z,sx:.06*s,sy:.012*s,sz:.06*s,c:'#141210'});   // agalen
    DYR.kule(out,M.pels,'#2a2420',P(.045*s,top+.03*s,0),.025*s,.03*s);DYR.oye(out,F,.05*s,top+.1*s,.02*s,.007*s);DYR.oye(out,F,.05*s,top+.1*s,-.02*s,.007*s)}
};

/* Beduintelt: lavt telt av svart geitehår på stenger, åpent foran, med fargerike tepper og puter inni. */
PROPS.orken_telt={
  navn:'Beduintelt (ørken)',info:'Svart telt av geitehår, åpent mot retningen. c.plant(\'orken_telt\',x,z,{s,retning})',
  params:{s:{v:1,min:.7,max:1.5,step:.05,navn:'Størrelse'},retning:{v:0,min:0,max:6.28,step:.05,navn:'Åpningen mot'}},
  place(x,z,o,env){const p=propParams('orken_telt',o,env.rng);const ry=-p.retning+Math.PI/2;env.colliders.push({x,z,w:2.3*p.s,d:1.5*p.s,ry,anchor:true,y:env.H(x,z)+.4*p.s});return Object.assign({x,z,ry},p)},
  build(t,env,out){const R=env.rng,s=t.s,y=footY(env.H,t.x,t.z,1.1*s),F=DYR.ramme(t.x,t.z,y,t.retning),P=F.P,ry=t.ry,cloth=shade('#2e2620',(R()-.5)*.1),stripe='#e8dcc0';
    const box=(f,u,sd,w,h,d,c,rz=0)=>{const p=P(f*s,u*s,sd*s);out.add(DG.root,DM.white,{x:p.x,y:p.y,z:p.z,sx:d*s,sy:h*s,sz:w*s,ry:-t.retning,rz,ord:'YXZ',c})};
    for(const sd of[-1.05,0,1.05])for(const f of[.55,-.55]){const p=P(f*s,0,sd*s);out.add(DG.trunk,DM.white,{x:p.x,y:y+.42*s,z:p.z,sx:.025*s,sy:.84*s,sz:.025*s,c:'#5a3a22'})}   // stengene
    box(0,.82,0,2.3,.05,1.25,cloth);box(-.62,.7,0,2.3,.05,.3,cloth,-.5);box(.68,.74,0,2.3,.04,.22,cloth,.6);   // taket: flatt i midten, skrått ned bak og fram
    for(const u of[.79,.84])box(-.2,u,0,2.32,.02,.06,stripe);                                     // de lyse stripene i duken
    box(-.74,.36,0,2.3,.72,.04,shade(cloth,.05));for(const sd of[-1,1])box(-.15,.36,sd*1.14,.04,.72,1.15,shade(cloth,-.05));   // bakveggen og sideveggene
    // tepper og puter inni
    const rugs=['#b8342a','#8a2a2a','#2f4a7a','#c97a2a'];for(let i=0;i<3;i++)box(-.1+(i-1)*.06,.012,(i-1)*.7,.7,.02,1,rugs[(i+Math.floor(R()*4))%4]);
    for(let i=0;i<4;i++){const p=P(-.5*s,.1*s,(-.75+i*.5)*s);out.add(PG.blob,DM.white,{x:p.x,y:p.y,z:p.z,sx:.14*s,sy:.09*s,sz:.14*s,c:rugs[(i+1)%4]})}}
};

/* Brønn: en ring av stein, to stolper med en bjelke og en bøtte i et tau. */
PROPS.orken_bronn={
  navn:'Brønn (ørken)',info:'Brønn av stein med vinsj og bøtte. c.plant(\'orken_bronn\',x,z)',
  params:{s:{v:1,min:.7,max:1.4,step:.05,navn:'Størrelse'},retning:{v:0,min:0,max:6.28,step:.05,navn:'Retning'}},
  place(x,z,o,env){const p=propParams('orken_bronn',o,env.rng);env.colliders.push({x,z,r:.42*p.s,anchor:true,y:env.H(x,z)+.4*p.s});return Object.assign({x,z},p)},
  build(t,env,out){const R=env.rng,s=t.s,y=footY(env.H,t.x,t.z,.4*s),F=DYR.ramme(t.x,t.z,y,t.retning),P=F.P;
    for(let i=0;i<12;i++){const a=i/12*6.28,p={x:t.x+Math.cos(a)*.34*s,z:t.z+Math.sin(a)*.34*s};out.add(PG.blob,DM.white,{x:p.x,y:y+.14*s,z:p.z,sx:.12*s,sy:.15*s,sz:.12*s,c:shade('#b8a07a',(R()-.5)*.2)})}
    out.add(DG.trunk,DM.white,{x:t.x,y:y+.25*s,z:t.z,sx:.26*s,sy:.02*s,sz:.26*s,c:'#1a2a30'});   // vannet langt nede
    for(const sd of[-1,1]){const p=P(0,0,sd*.4*s);out.add(DG.trunk,DM.white,{x:p.x,y:y+.4*s,z:p.z,sx:.03*s,sy:.8*s,sz:.03*s,c:'#6a4a2e'})}
    const a=P(0,.78*s,-.42*s),b=P(0,.78*s,.42*s);out.add(DG.trunk,DM.white,stemBetween(a,b,.03*s,{c:'#5a3a22'}));
    out.add(DG.trunk,DM.white,{x:t.x,y:y+.6*s,z:t.z,sx:.005*s,sy:.36*s,sz:.005*s,c:'#d8c597'});out.add(DG.trunk,DM.white,{x:t.x,y:y+.4*s,z:t.z,sx:.06*s,sy:.08*s,sz:.06*s,c:'#8a5a2e'})}
};

/* Tornebusk: lav, tørr busk med grå-grønne blader på tynne greiner. Ingen kollider: bilen kjører gjennom. */
PROPS.orken_tornebusk={
  navn:'Tornebusk (ørken)',info:'Lav, tørr busk uten kollider. c.plant(\'orken_tornebusk\',x,z,{s})',
  params:{s:{v:[.6,1.2],min:.3,max:2,step:.05,navn:'Størrelse'}},
  place(x,z,o,env){const p=propParams('orken_tornebusk',o,env.rng);return Object.assign({x,z},p)},
  build(t,env,out){const R=env.rng,s=t.s,y=footY(env.H,t.x,t.z,.15*s)-.02,base={x:t.x,y,z:t.z},leaf=['#8a8f5a','#9a9a68','#7a7a4e','#a8a070'];
    for(let i=0;i<7;i++){const a=R()*6.28,e=.4+R()*.7,l=(.25+R()*.25)*s,v=dirVec(a,e),tip={x:t.x+v.x*l,y:y+v.y*l,z:t.z+v.z*l};out.add(DG.branch,DM.bark,stemBetween(base,tip,.012*s,{c:'#6a5a44'}));
      for(let k=0;k<3;k++){const d=.06*s;out.add(DG.canopy,DM.leaf,{x:tip.x+(R()-.5)*d*2,y:tip.y+(R()-.5)*d,z:tip.z+(R()-.5)*d*2,sx:(.05+R()*.04)*s,sy:(.035+R()*.02)*s,sz:(.05+R()*.04)*s,c:leaf[(i+k)%4]},false)}}}
};
