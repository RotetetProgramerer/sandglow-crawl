// Flyturene fra Arendal lufthavn. Spillet er i js/plane.js, flyfysikken i js/planesim.js.
// Havet er det samme som i båtløpet (data/boats.js): øyene ligger der de ligger på skjærgårdskartet, nord er −z, og en motorbåt er ca. 17 enheter lang.
// Flyplassen ligger på en fylling øst i Arendal, som på øya. Alle mål i AIRPORT er fra midten av Arendal (+x er øst).
//   land: fyllingen, rwy: rullebanen (nord–sør), start: der flyet står klart (sørenden, nesa mot nord)
// En flytur har ringer [x, høyde, z] som flys gjennom i rekkefølge. Den siste ringen er mål.
//   par: [tre stjerner, to stjerner] i sekunder
// Flyplassene til de andre øyene, og lasteflyet som flyr bilen mellom dem, står i banefilene (airport:{…}), js/planesim.js og js/cargo.js.
// Test: node tools/test-flights.js
const AIRPORT={island:'arendal',land:{x0:120,x1:196,z0:-144,z1:126},rwy:{x:166,w:30,z0:-134,z1:116},start:{dz:104},
  hangar:[133,-22],tower:[138,70],terminal:[130,31],sock:[186,90]};
const FLIGHTS=[
 {id:'arendal',name:'Rundt Arendal',diff:1,desc:'Sju ringer i en runde rundt byøya. Ta av mot nord og hold deg lavt.',
  rings:[[169,60,980],[-60,90,860],[-320,110,1060],[-330,90,1420],[-60,70,1600],[300,70,1560],[390,60,1200]],par:[22,29]},
 {id:'tromoya',name:'Over Tromøya',diff:2,desc:'Nordover til Tromøya, rundt snøfjellet og hjem igjen. Høye ringer og lange svinger.',
  rings:[[169,80,950],[120,140,560],[330,160,230],[200,220,-260],[-120,240,-330],[-330,160,40],[-200,120,420],[60,90,700],[169,60,1000]],par:[32,42]},
 {id:'vulkan',name:'Vulkanflyget',diff:3,desc:'Helt nord til Hisøya, gjennom røyken over vulkanen og hjem forbi Skilsø.',
  rings:[[300,100,900],[700,160,300],[1000,200,-300],[500,240,-1100],[220,300,-1560],[-220,260,-1400],[-640,200,-900],[-500,160,-200],[-300,110,600],[100,60,1000]],par:[57,75]},
];
