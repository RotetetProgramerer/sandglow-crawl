// Motorbåtløpet fra Captain Theis' marina på Tromøya. Spillet er i js/boat.js, fysikken i js/boatsim.js.
// Havet er skjærgården sett fra sjøen: øyene ligger der de ligger på skjærgårdskartet (pos i data/archipelago.js ganger SEA.span),
// og Skilsø ligger for seg selv nordvest for Tromøya. Her er en motorbåt ca. 17 enheter lang, og nord er −z.
// Hvert løp har bøyer [x,z] som rundes i rekkefølge, og mål ved en brygge der du må sakke farten for å fortøye.
//   finish: 'marina' (tilbake til Tromøya) eller 'skilso' (brygga på Skilsø)
//   pirates: antall piratskuter (færre i Lett-modus)
//   par: [tre stjerner, to stjerner] i sekunder
//   lava: true lar vulkanen på Hisøya kaste lavabomber
// Test: node tools/test-boats.js
const SEA={span:3600,bound:2100,
  // øyene i skjærgården: radius (kollisjon) og utseende (se bIsland i js/boat.js)
  islands:{verden:{r:280,look:'tromoya'},vulkan:{r:170,look:'vulkan'},gautefall:{r:160,look:'vinter'},trinnvik:{r:140,look:'by'},
    sand:{r:150,look:'sand'},savanne:{r:150,look:'savanne'},stein:{r:140,look:'stein'},skog:{r:160,look:'skog'},elv:{r:150,look:'elv'},kaiman:{r:110,look:'skog'},orken:{r:150,look:'orken'}},
  extra:[{id:'skilso',name:'Skilsø',at:[-660,-620],r:150,look:'skilso'}],
  // bryggene: hvilken øy, retningen ut fra øya i grader (0 = øst, 90 = sør, 180 = vest, 270 = nord), navnet og «Kurs mot …»
  docks:{marina:{island:'verden',dir:315,name:'Marinaen',to:'marinaen'},skilso:{island:'skilso',dir:270,name:'Brygga på Skilsø',to:'Skilsø'}},
  start:{dock:'marina',out:130},   // startstreken ligger så langt ute fra brygga ved marinaen
  chest:[880,-80]};                // skattekista: 50 muttere første gang en båt finner den
const BOAT_RACES=[
 {id:'rundt',name:'Rundt Tromøya',diff:1,desc:'Sju bøyer i en stor runde rundt øya og hjem til marinaen. Få pirater og god plass.',
  buoys:[[700,72],[495,567],[0,772],[-495,567],[-700,72],[-495,-423],[0,-628]],finish:'marina',pirates:3,par:[32,42]},
 {id:'skilso',name:'Skilsø-løpet',diff:2,desc:'Det klassiske løpet: fire bøyer på kryss og tvers, og fortøy først ved brygga på Skilsø.',
  buoys:[[560,-420],[-420,-1000],[700,-1250],[-1000,-1150]],finish:'skilso',pirates:7,par:[44,56]},
 {id:'vulkan',name:'Vulkanløpet',diff:3,desc:'Rundt Hisøya mens vulkanen har utbrudd, og hjem til marinaen. Lavabomber og mange pirater.',
  buoys:[[-480,-1000],[-560,-1700],[0,-1960],[560,-1700],[480,-1000],[40,-620]],finish:'marina',pirates:9,lava:true,par:[40,52]},
];
