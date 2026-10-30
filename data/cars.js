// Biler. Legg til en ny ved å kopiere en blokk og endre verdiene.
//  id       unik nøkkel (brukes i lagring)        name   navnet i menyen
//  kind     kort beskrivelse under navnet         L      total lengde (1 enhet ≈ 8,5 cm, 2.0 ≈ 17 cm)
//  wb       akselavstand                          mass   vekt (tyngre = roligere, tregere)
//  gh       høyde på kupeen                       hood   lengde på panseret
//  win      antall sidevinduer                    style  'box' | 'glass' | 'step'
//  snorkel  true/false                            spare  'rear' | 'hood' | 'rack' (plassering av reservehjul)
//  stats    [klatring, sving, stabilitet] 1–5 (bare visning i menyen)
//  valgfritt: wr hjulradius (standard .24)  track sporvidde (standard .9)  tireW dekkbredde (standard .19)
//             top toppfart i høy gir (1 = som de andre)  col fargen bilen har når lakken er standard (Sandgul)
//             style 'monster' tegner en monstertruck (js/carmodel.js buildMonster)
//             style 'sport' tegner en sportsbil (js/carmodel.js buildSport)   tireWr dekkbredde bak (standard som foran)
//             ride hjulene sitter så mye høyere under karosseriet (lavere bil)   susp fjæringsvei (1 = som de andre, mindre er kortere og stivere)
//             pow motorkraft (1 = som de andre)   gh styrer også hvor taket er når bilen velter
//             style 'trophy' tegner en trophy truck (js/carmodel.js buildTrophy)   damp støtdempere (1 = som de andre, mer demper hopp og humper)
//             stab bilen retter seg selv opp (som vekt-delen i verkstedet, legges til den)   air bilen flyr rett i lufta, og gass/brems styrer nesen
CARS.push(
{id:'kobbe',name:'Kobbe',kind:'Kort 2-dørs',L:1.62,wb:1.08,mass:9.2,gh:.31,hood:.42,win:1,style:'box',snorkel:true,spare:'rear',stats:[3,5,3],extras:['spade','axe','cans2'],
   desc:'Kort akselavstand. Snur nesten på stedet, men vipper lettere bakover i bratte bakker.'},
{id:'fjellrev',name:'Fjellrev',kind:'Lang 5-dørs',L:2.22,wb:1.52,mass:11,gh:.31,hood:.44,win:3,style:'box',snorkel:true,spare:'hood',stats:[4,2,5],extras:['cans2','box','sandLadders'],
   desc:'Lang og rolig. Ligger stødig i bratte bakker, men trenger plass når den svinger.'},
{id:'ravn',name:'Ravn',kind:'Lav stasjonsvogn',L:1.96,wb:1.3,mass:10,gh:.27,hood:.5,win:2,style:'glass',spare:'rack',stats:[3,4,4],extras:['lightbar','tent','crates','jack'],
   desc:'Lavt tak og godt utsyn. Et trygt valg for nye sjåfører.'},
{id:'jerv',name:'Jerv',kind:'Trinntak',L:2.02,wb:1.38,mass:10.4,gh:.29,hood:.46,win:2,style:'step',spare:'rear',stats:[4,3,4],extras:['ladder','cans3','toolbox','tarp'],
   desc:'Trinntak og høy last på taket. Allsidig i stein og skog.'},
{id:'vinsjen',name:'Vinsjen',kind:'Pickup med vinsj',L:2.3,wb:1.5,mass:11.4,gh:.3,hood:.52,win:1,style:'pickup',snorkel:true,spare:'rack',stats:[5,2,5],price:600,winch:true,extras:['lightbar'],
   desc:'Lang pickup med ekte vinsj i fronten: fest tauet i et tre eller en stein og dra deg opp. Tung og stødig, treig i svingene.'},
// monstertruck inspirert av en 1:18 elektrisk basher, skalert ned til 1:24: 20 cm lang, 15 cm bred, 6,3 cm høye dekk og 2,5 cm bakkeklaring
{id:'knott',name:'Knøtt',kind:'Monstertruck 4WD',L:2.35,wb:1.47,mass:9.6,gh:.1,hood:.5,win:1,style:'monster',spare:'none',stats:[3,4,3],price:500,
   wr:.37,track:1.41,tireW:.33,top:1.15,col:'#3f9a1e',
   desc:'Liten elektrisk monstertruck med store dekk og høy bakkeklaring. Rask i høy gir og bred mellom hjulene, men tyngdepunktet ligger høyt.'},
// Porsche 911 Turbo (992) i 1:24: 18,9 cm lang, 7,9 cm bred, 5,4 cm høy, 10,2 cm akselavstand og 5 mm bakkeklaring. Karosseriet er tegnet etter ekte mål i js/carmodel.js (SP911)
{id:'turbo',name:'Porsche 911 Turbo',kind:'Sportsbil 4WD',L:2.22,wb:1.2,mass:10,gh:-.104,hood:.5,win:2,style:'sport',spare:'none',stats:[1,4,5],price:1500,
   wr:.18,track:.78,tireW:.125,tireWr:.155,ride:.064,susp:.5,top:1.6,pow:1.8,col:'#c8102e',
   desc:'Lav og bred sportsbil med firehjulstrekk og turbo. Raskest av alle i høy gir og ligger som limt i svingene, men har nesten ingen bakkeklaring: hold deg på veien, for steiner, gjørme og dypt vann er ikke noe for den.'},
// trophy truck: ørkenracer med lang fjæring (nesten dobbelt så lang som de andre), kraftige støtdempere og bred sporvidde. Gratis.
// Bygget for fart i terrenget og store hopp: den flyr rett i lufta, og gass løfter nesen, brems senker den (som i en ekte trophy truck)
{id:'trophy',name:'Trophy Truck',kind:'Ørkenracer 4WD',L:2.7,wb:1.62,mass:10.4,gh:.2,hood:.62,win:1,style:'trophy',spare:'none',stats:[3,4,5],
   wr:.29,track:1.34,tireW:.25,susp:1.7,damp:1.5,stab:2,air:1,top:1.4,pow:1.3,col:'#1f5fc4',
   desc:'Ørkenracer med enorm fjæring, store dekk og bred sporvidde. Svært stødig, lander mykt etter store hopp og er rask i terrenget. I lufta løfter gass nesen og brems senker den. Ingen vinsj, og den er ingen klatrer i bratt stein.'}
);
