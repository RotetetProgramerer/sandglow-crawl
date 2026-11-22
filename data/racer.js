// Racerøya: de tre racerbanene i 2D (sett ovenfra). Brukes av js/racesim.js (fysikken) og js/race.js (tegning, meny og lyd).
// Enheter: meter. x går mot høyre og y nedover på skjermen. Banen er en lukket kurve gjennom punktene i pts (Catmull-Rom),
// og bilene kjører i den rekkefølgen punktene står. Første punkt ligger på startrettstrekningen, og startstreken ligger startAt meter
// etter det (standard 70), så hele startoppstillingen bak streken står på rettstrekningen.
//   hw      halve bredden av asfalten (meter). Bilene er 4,4 m lange og 2 m brede.
//   runoff  hvor bredt det er fra asfaltkanten ut til dekkveggen. Kjører du på den, sakker bilen ned.
//   off     hva som ligger utenfor asfalten: 'grass' (gress) eller 'sand' (sandfelle, sakker enda mer).
//   scale   gang alle punktene med dette (gjør banen kortere eller lengre uten å flytte punktene).
//   laps    antall runder i løpet.
//   par     [tid for 3 stjerner, tid for 2 stjerner] i sekunder for hele løpet.
//   look    farger og pynt: grass, sand, sea (havet rundt øya), trees ('palm' eller 'pine'), stands (antall tribuner langs startrettstrekningen).
// Banen må ikke krysse seg selv, og to deler av banen må ligge minst 2×(hw+runoff)+6 meter fra hverandre.
// Sjekk alltid med:  node tools/test-race.js
const RACE_TRACKS=[
 {id:'palme',name:'Palmeringen',diff:1,laps:3,hw:8,runoff:9,off:'grass',par:[116,126],
  desc:'Brede, lange svinger rundt palmelunden. Lær deg å sladde: slipp gassen litt inn i svingen, og gi på igjen ut.',
  look:{grass:'#5f9a3c',grass2:'#6caa44',sand:'#e6d29a',sea:'#2f8fc0',trees:'palm',stands:3},
  pts:[[-140,0],[0,0],[140,0],[215,-25],[245,-95],[215,-165],[140,-190],[60,-170],[10,-130],[-40,-110],[-110,-130],[-170,-170],[-235,-150],[-255,-80],[-220,-20]]},
 {id:'havn',name:'Havnesvingen',diff:2,laps:3,hw:7,runoff:7,scale:.82,off:'grass',par:[137,147],
  desc:'En krapp hårnål ved moloen, en rask S-sving og en lang slakk sving tilbake til tribunene. Brems tidlig før hårnåla.',
  look:{grass:'#4f8f3a',grass2:'#5c9c40',sand:'#dcc890',sea:'#2a7fb2',trees:'palm',stands:2},
  pts:[[-100,0],[60,0],[160,0],[205,-30],[195,-85],[130,-100],[95,-140],[120,-190],[185,-205],[235,-245],[210,-295],[120,-300],[40,-265],[-20,-215],[-45,-155],[-90,-120],[-160,-140],[-210,-105],[-205,-45],[-160,-8]]},
 {id:'vulkan',name:'Vulkanslyngen',diff:3,laps:3,hw:6,runoff:6,scale:.68,off:'sand',par:[145,155],
  desc:'Smal og svingete langs lavastrendene, med sandfeller overalt. To hårnåler og en lang venstre du kan sladde gjennom.',
  look:{grass:'#6a7a3a',grass2:'#7a8a44',sand:'#cfb27a',sea:'#24689a',trees:'palm',stands:2,dark:true},
  pts:[[-80,0],[80,0],[150,10],[182,50],[150,90],[90,80],[40,100],[30,160],[80,200],[160,190],[230,220],[250,290],[190,330],[90,320],[0,300],[-60,250],[-50,190],[-110,160],[-190,180],[-240,130],[-220,60],[-160,20]]},
];
// motstanderne: navn, farge og hvor flinke de er (1 = like raske som banen tillater)
const RACE_RIVALS=[
 {name:'Turbo-Tove',col:'#d9432f',num:7},
 {name:'Kjappe Kåre',col:'#2f6fd6',num:12},
 {name:'Rally-Rita',col:'#8bbb4a',num:3},
 {name:'Sladde-Sigurd',col:'#f2c230',num:21},
 {name:'Fartsfrid',col:'#b05ad0',num:44},
 {name:'Dekk-Dag',col:'#f2e8d0',num:9},
];
// vanskelighetsgrad for motstanderne: skill = hvor nær grensen de kjører, nuts = gange med mutterne
const RACE_LEVELS=[
 {id:'lett',name:'Lett',skill:.84,nuts:1},
 {id:'middels',name:'Middels',skill:.92,nuts:1.5},
 {id:'vanskelig',name:'Vanskelig',skill:.985,nuts:2},
];
// mutter for plassering 1–6 (ganges med nuts over). Første seier på en bane gir i tillegg RACE_FIRST_WIN.
const RACE_PRIZE=[30,20,12,6,3,3], RACE_FIRST_WIN=50;
