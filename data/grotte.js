// Diamantgrotten: den hemmelige grotten på Kameløya. Kjører du inn i grotteåpningen på øya, ser du bilen fra siden, som i Hill Climb Racing.
// Spillet er i js/grotte.js, fysikken i js/grottesim.js. Grotten bygges med en «penn» som går innover (x) og opp og ned (y):
//   c.flat(lengde)             flatt                         c.slope(lengde, dy)        jevn bakke opp (dy>0) eller ned
//   c.hills(lengde, høyde, n)  n runde bakker                c.bumps(lengde, høyde)     ujevnt med småstein
//   c.ramp(lengde, høyde)      hopp med bratt kant bak        c.gap(bredde, dy, dybde)   et juv: faller du ned, starter du ved forrige sjekkpunkt
//   c.step(dy)                 en kant opp eller ned          c.bridge(lengde, {sag})    plankebro over et juv
//   c.pool(lengde, dybde)      grunt vann                     c.end()                    bakveggen i skattkammeret (slutten)
//   c.room(h)                  høyden opp til taket herfra    c.surf(S.SAND)             underlaget herfra (S.SAND, S.ROCK, S.GRAVEL …)
//   c.zone(navn, tema)         en ny del av grotten: 'sand', 'mine', 'crystal', 'narrow', 'lake', 'deep', 'treasure' (stein, lys og pynt)
//   c.row(dx, n, avstand, h)   n diamanter på rad, h over bakken      c.arc(dx, n, lengde, topp)  diamanter i en bue over et hopp
//   c.gem(dx, h)               én diamant                    c.can(dx)                  bensinkanne (full tank)
//   c.cp(dx, navn)             sjekkpunkt (lykt)             c.deco(type, dx, {...})    pynt: 'sign', 'cart', 'beam', 'lamp', 'crystal', 'chest', 'pile', 'bones', 'pick', 'barrel', 'rails'
// dx er avstanden fra der pennen står. 1 diamant er 10 muttere.
//   node tools/test-grotte.js   (kjører grotten med autopilot for alle bilene)
const GROTTE={name:'Diamantgrotten',x0:-16,start:1.5,
  build(c){
    // --- utenfor: sanden skråner ned mot åpningen i fjellet (x = 0) ---
    c.surf(S.SAND);c.room(5);
    c.flat(5);c.slope(9,-.9);c.flat(2);
    c.zone('Inngangen','sand');c.deco('sign',2.6,{text:'DIAMANTGROTTEN',sub:'gass → · brems ←'});
    c.flat(5);c.row(1.2,3,.9);
    c.hills(12,.6,2);c.gem(-9,1.1);c.gem(-3,1.1);
    c.slope(7,-1.1);c.deco('bones',2);c.bumps(8,.2);c.row(2,2,1.6,.55);

    // --- den gamle gruva: stolper og bjelker, skinner, en gruvevogn, et sjakt å hoppe over og en plankebro ---
    c.zone('Den gamle gruva','mine');c.room(4.4);c.surf(S.GRAVEL);
    c.cp(1.2,'Den gamle gruva');c.flat(5);c.deco('cart',3.5);
    c.hills(9,.45,1);c.row(-5.5,2,1);
    c.flat(2);c.ramp(3.5,.75);c.arc(-.2,4,4.4,1.25);c.gap(2,-.15,9);c.flat(5);c.deco('pick',2.5);
    c.slope(8,1.1);c.flat(2.5);
    c.bridge(9,{sag:.3,depth:9});c.row(-7.2,4,1.8,.62);
    c.flat(3);c.deco('barrel',1.5);c.slope(7,-1.4);c.bumps(9,.2);c.row(2.5,2,2.2,.55);

    // --- krystallsalen: en høy sal med lysende krystaller og store, runde bakker å hoppe på ---
    c.zone('Krystallsalen','crystal');c.room(10);c.surf(S.ROCK);
    c.cp(1,'Krystallsalen');c.flat(5);c.can(3);
    c.hills(12,1.7,1);c.arc(-7,3,4.2,1);
    c.flat(1.5);c.hills(11,1.5,1);c.arc(-6.4,3,4,.9);
    c.flat(1.5);c.hills(10,1.2,1);c.arc(-5.6,3,3.4,.8);
    c.slope(9,-1.6);c.flat(3);c.row(-2,2,.9);

    // --- den trange gangen: lavt tak, kanter og ujevn stein. Rolig nå ---
    c.zone('Den trange gangen','narrow');c.room(3.1);c.surf(S.ROCK);
    c.cp(1,'Den trange gangen');c.flat(4);
    c.bumps(12,.18);c.row(1,3,3,.5);
    c.step(.3);c.flat(3.5);c.step(.28);c.flat(4);c.gem(-2,.5);c.step(-.45);c.bumps(10,.2);c.row(2,2,3,.5);c.flat(3);

    // --- kjempebakken: lang og bratt opp, så et hopp på vei ned ---
    c.zone('Kjempebakken','mine');c.room(6);c.surf(S.GRAVEL);
    c.cp(1,'Kjempebakken');c.flat(6);c.can(2.5);
    c.slope(14,3.2);c.row(-10,3,3,.6);c.slope(11,2.6);c.row(-7,2,3.5,.6);c.flat(4);c.deco('lamp',2);c.gem(-1.5,.6);
    c.slope(6,-1.2);c.ramp(3.2,.6);c.arc(-.2,3,4,1.1);c.slope(5,-1.6);c.slope(14,-2.8);c.flat(2);

    // --- den underjordiske sjøen: grunt vann og en lang plankebro ---
    c.zone('Den underjordiske sjøen','lake');c.room(7.5);c.surf(S.SAND);
    c.cp(1,'Sjøen');c.flat(4);
    c.pool(9,.42);c.row(-6.5,2,2.4,.75);c.flat(3);
    c.bridge(12,{sag:.35,depth:3.5});c.row(-10,4,2.6,.62);
    c.flat(3);c.can(1.5);c.pool(10,.48);c.row(-7,2,3,.75);c.flat(3);c.slope(6,.8);

    // --- dypet: hopp over juv etter juv, med diamanter i lufta ---
    c.zone('Dypet','deep');c.room(7);c.surf(S.ROCK);
    c.cp(1,'Dypet');c.flat(6);
    c.ramp(3.5,.8);c.arc(-.2,3,4.6,1.3);c.gap(2.1,-.35,10);c.flat(5);
    c.hills(9,.8,1);c.gem(-4.5,1.4);
    c.ramp(3.5,.85);c.arc(-.2,3,4.8,1.4);c.gap(2.3,-.3,10);c.flat(6);
    c.slope(7,.9);c.ramp(3.8,.9);c.arc(-.2,4,5.2,1.6);c.gap(2.5,-.6,10);c.flat(5);c.slope(6,-.6);

    // --- skattkammeret: diamantene ligger i hauger, og kisten står ved bakveggen ---
    c.zone('Skattkammeret','treasure');c.room(9);c.surf(S.SAND);
    c.cp(1,'Skattkammeret');c.flat(6);c.row(1,5,.85,.6);
    c.deco('pile',9);c.deco('pile',12.5,{s:1.3});c.flat(10);c.deco('chest',-2.4);c.end();
  }};
