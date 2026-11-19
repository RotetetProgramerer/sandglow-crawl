// Gruve 7: den gamle kullgruva i Gruvefjellet på Svalbard. Kjører du inn i gruveinngangen, blir det kappløp i gruvevogn mot tre andre gruvearbeidere, på tre spor.
// Spillet er i js/gruve7.js, fysikken i js/gruvesim.js. Gruva bygges med en «penn» som går innover:
//   c.rett(lengde)            rett fram                     c.sving(lengde, dx)        gangen flytter seg dx til siden (dx>0 er mot høyre)
//   c.bakke(lengde, dy, dx)   opp (dy>0) eller ned          c.sone(navn, tema, fart)   en ny del av gruva: 'stoll', 'kull', 'is', 'sjakt', 'dag'
// Hindringene står der pennen er. Sporene heter 'V' (venstre), 'M' (midten) og 'H' (høyre). Uten spor gjelder hindringen alle tre.
//   c.ras('V','M')            steinras: bytt spor            c.vogn('M')                parkert kullvogn: bytt spor
//   c.bukk('H')               stengt spor med lykt           c.veksel('M', varsel)      bare dette sporet går videre, skiltet henger «varsel» før
//   c.bjelke()                lav takbjelke: dukk            c.istapper('V','M')        istapper: dukk (eller bytt spor)
//   c.brudd(lengde)           brudd i skinnene: hopp
//   c.kull(spor, n, avstand, dx, h)   n kullklumper på rad, fra dx forbi pennen (dx<0 er før), h over skinnene
//   c.bue(spor, n, lengde)    kullklumper i en bue over et hopp
//   c.kasse(dx, 'V','M')      kasser med utstyr, dx forbi pennen (uten spor: på alle tre)
//   c.fart(spor, dx)          fartsfelt: et kort støt med fart
//   c.cp(navn)                lykt på veggen: her får du se plassen din      c.mal()        slutten
// Farten er i enheter per sekund. I 'is' er skinnene glatte, så sporbyttene går tregere. 1 kullklump er 3 muttere,
// og hver klump du har om bord (opptil 20), gjør vogna litt raskere.
//   node tools/test-gruve7.js   (kjører gruva med autopilot)
const GRUVE7={name:'Gruve 7',
  build(c){
    // --- Stollen: rett og rolig. Her lærer du å bytte spor, dukke og hoppe ---
    c.sone('Stollen','stoll',11);
    c.rett(30);c.kull('M',5,2.4,-18);c.ras('V');
    c.rett(16);c.kull('H',4,2.4,-9);c.ras('M');
    c.rett(16);c.kull('M',4,2.4,-9);c.ras('H');
    c.sving(18,2);c.kull('M',3,3,-3);c.bjelke();
    c.rett(10);c.cp('Første lykt');c.kasse(4);
    c.rett(14);c.kull('H',4,2.4,-8);c.vogn('V','M');
    c.sving(16,-3);c.bue('H',4,6.5);c.brudd();
    c.rett(18);c.kull('V',4,2.4,-8);c.bukk('M','H');c.fart('V',6);
    c.rett(16);c.kull('V',3,3,-3);c.bjelke();
    c.bakke(16,-1.2);c.bue('V',4,6.5);c.brudd();
    c.rett(18);c.kull('M',4,2.4,-8);c.ras('V');
    c.sving(22,2);

    // --- Kullfløtsen: lavt under taket. Mye dukking, og vogner som står igjen på sporene ---
    c.sone('Kullfløtsen','kull',12.5);c.cp('Kullfløtsen');c.kasse(5);
    c.rett(14);c.kull('M',2,3,-1.5);c.bjelke();
    c.rett(13);c.kull('M',2,3,-1.5);c.bjelke();
    c.sving(15,-2);c.kull('V',4,2.4,-8);c.vogn('M');
    c.rett(13);c.bjelke();
    c.rett(14);c.kull('M',4,2.4,-8);c.vogn('V','H');
    c.bakke(15,-1);c.bue('M',4,7);c.brudd();
    c.rett(16);c.kull('V',4,2.4,-8);c.ras('M','H');c.fart('V',4);
    c.rett(12);c.kull('V',2,3,-1.5);c.bjelke();
    c.rett(13);c.cp('Midt i fløtsen');c.kasse(5);
    c.sving(15,3);c.vogn('V');
    c.rett(11);c.kull('H',3,2.4,-5);c.vogn('M');
    c.rett(11);c.kull('M',3,2.4,-5);c.vogn('H');
    c.rett(14);c.bjelke();c.rett(9);c.kull('M',2,3,-1.5);c.bjelke();
    c.sving(15,-2);c.kull('H',4,2.4,-8);c.bukk('V','M');c.fart('H',4);
    c.rett(13);c.bue('H',4,7);c.brudd();
    c.rett(14);c.kull('H',2,3,-1.5);c.bjelke();
    c.rett(12);c.kull('M',3,2.4,-5);c.ras('H');
    c.bakke(14,-.8);

    // --- Permafrosten: is på veggene, istapper fra taket og glatte skinner. Bytt spor i god tid ---
    c.sone('Permafrosten','is',13.5);c.cp('Permafrosten');c.kasse(6);
    c.rett(18);c.kull('H',5,2.4,-10);c.istapper('V','M');
    c.sving(16,2);c.kull('M',4,2.4,-8);c.ras('H');
    c.rett(17);c.kull('M',2,3,-1.5);c.istapper();
    c.rett(16);c.kull('V',4,2.4,-8);c.vogn('M');
    c.bakke(17,-1);c.bue('V',4,7.5);c.brudd();
    c.rett(16);c.kull('V',4,2.4,-8);c.istapper('M','H');
    c.sving(16,-3);c.kull('M',4,2.4,-8);c.bukk('V');
    c.rett(9);c.cp('Isgangen');c.kasse(5);
    c.rett(14);c.kull('M',2,3,-1.5);c.istapper();
    c.rett(15);c.kull('H',4,2.4,-8);c.ras('V','M');
    c.rett(17);c.kull('M',4,2.4,-8);c.ras('H');
    c.rett(15);c.bue('M',4,7.5);c.brudd();
    c.sving(14,2);c.kull('M',2,3,-1.5);c.istapper();
    c.rett(16);c.kull('M',5,2.4,-11);c.veksel('M');c.fart('M',5);
    c.rett(16);c.kull('M',2,3,-1.5);c.bjelke();
    c.rett(18);

    // --- Den gamle sjakta: bratt nedover og fort. Skinnene er brutt flere steder ---
    c.sone('Den gamle sjakta','sjakt',16.5);c.cp('Den gamle sjakta');c.kasse(7);
    c.bakke(20,-3);c.bue('M',4,8.5);c.brudd();
    c.bakke(16,-2.5);c.bue('M',4,8.5);c.brudd();
    c.bakke(17,-2.5);c.kull('V',4,2.6,-9);c.ras('M');
    c.bakke(15,-2);c.kull('H',4,2.6,-8);c.ras('V');
    c.bakke(16,-2,2);c.kull('H',2,3.4,-1.7);c.bjelke();
    c.bakke(16,-2);c.cp('Halvveis ned');c.kasse(6);
    c.bakke(18,-2.5);c.kull('H',4,2.6,-9);c.vogn('V','M');
    c.bakke(17,-2.5,-3);c.kull('V',4,2.6,-9);c.vogn('M','H');
    c.bakke(16,-2);c.bue('V',4,8.5);c.brudd();
    c.bakke(15,-2);c.kull('V',2,3.4,-1.7);c.bjelke();
    c.bakke(16,-2.5);c.bue('V',4,8.5);c.brudd();
    c.bakke(15,-2);c.cp('Bunnen av sjakta');c.fart('V',5);
    c.bakke(17,-1.5);c.kull('V',5,2.6,-12);c.veksel('V',30);
    c.bakke(17,-1,3);c.bue('V',4,8.5);c.brudd();
    c.rett(15);c.kull('M',4,2.6,-9);c.ras('V');
    c.rett(15);c.kull('H',4,2.6,-9);c.ras('M');
    c.rett(15);c.kull('H',2,3.4,-1.7);c.bjelke();
    c.rett(16);

    // --- Opp i dagen: det siste strekket opp mot lyset og taubanen ---
    c.sone('Opp i dagen','dag',14);c.cp('Opp i dagen');c.kasse(5);
    c.bakke(16,1.5);c.kull('V',4,2.4,-8);c.bukk('M');
    c.bakke(14,1.5);c.kull('M',4,2.4,-7);c.bukk('V','H');
    c.bakke(15,1.5);c.bue('M',4,7.5);c.brudd();
    c.bakke(14,1.5,-2);c.kull('M',2,3,-1.5);c.bjelke();
    c.bakke(14,1.5);c.kull('V',3,2.4,-6);c.vogn('H');
    c.bakke(13,1.5);c.kull('H',3,2.4,-6);c.vogn('V','M');
    c.bakke(14,1.5);c.cp('Lyset der framme');c.fart('H',4);
    c.bakke(14,1.5);c.bue('H',4,7.5);c.brudd();
    c.bakke(13,1.5,2);c.kull('H',2,3,-1.5);c.bjelke();
    c.bakke(14,1.5);c.kull('H',3,2.4,-6);c.ras('V','M');
    c.bakke(14,1.5);c.kull('V',3,2.4,-6);c.ras('M','H');
    c.bakke(14,1.5);c.bue('V',4,7.5);c.brudd();
    c.bakke(31,2);c.kull('M',8,2.6,-24);c.fart('M',-21);
    c.mal()}};
