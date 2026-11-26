// Garasjedeler og lakkfarger. Prisene er i muttere (⚙).
// garage parts: four levels each (0 = standard). Effects are applied through car.tune.
const PARTS=[
  {id:'tyres',name:'Dekk',lv:['Standard','Myke dekk','Klatredekk','Konkurransedekk'],price:[0,100,220,400],desc:'Bedre grep på stein, sand og i gjørme. Litt lavere toppfart.'},
  {id:'susp',name:'Fjæring',lv:['Standard','Lang vandring','Portalaksler','Fullt oppsett'],price:[0,120,260,450],desc:'Lengre fjæringsvei og bedre dempere. Hjulene følger steinene, og bilen ligger roligere.'},
  {id:'motor',name:'Motor',lv:['050 børstet','Børsteløs','Høyt dreiemoment','Konkurransemotor'],price:[0,150,300,520],desc:'Mer kraft i lavgir og høyere toppfart i høygir.'},
  {id:'weight',name:'Vekter',lv:['Ingen','Hjulvekter','Messingfelger','Blylodd i akslene'],price:[0,80,180,340],desc:'Lavere tyngdepunkt. Bilen holder seg på hjulene i bratte skråninger, men blir litt tregere.'},
  {id:'gear',name:'Utstyr',lv:['Ingen','Snorkel','Snorkel og hentevinsj','Snorkel, ekte vinsj og LED'],price:[0,120,240,380],desc:'Snorkel tåler dypere vann. Hentevinsjen henter bilen for 2 straffepoeng i stedet for 5. Den ekte vinsjen (nivå 3) lar deg feste tauet i et tre eller en stein og dra deg opp. LED gir kraftige lys.'}
];
const PAINTS=[{n:'Sandgul',c:'#e3a62a',p:0},{n:'Ekspedisjonsrød',c:'#c43b2f',p:120},{n:'Fjordblå',c:'#2f6fb0',p:120},{n:'Mosegrønn',c:'#5a7a3a',p:120},{n:'Nattsvart',c:'#2a2a2c',p:160},{n:'Isbrehvit',c:'#e8e4da',p:160},{n:'Solnedgangrosa',c:'#e0607a',p:200},{n:'Gull (alle gullmutterne)',c:'#d9a93a',p:0,locked:true}];
// Pynt: felger og antenneflagg. Endrer bare utseendet. p er prisen, c fargen. Rekkefølgen lagres, så legg nye til sist.
// Felger: m er metallglans (0–1), r ruhet. Standard er gul, og messing med vekter fra nivå 2.
const RIMS=[{n:'Standard',p:0},{n:'Hvit',c:'#ecebe6',m:.15,p:90},{n:'Svart',c:'#1e1e20',m:.3,p:90},{n:'Rød',c:'#c43b2f',m:.25,p:120},{n:'Blå',c:'#2f6fb0',m:.25,p:120},{n:'Krom',c:'#dfe3e8',m:.95,r:.15,p:200}];
// Antenneflagg: k velger tegningen (flagTex i js/carmodel.js). Vises på bilene som har antenne.
const FLAGS=[{n:'Ingen',p:0},{n:'Oransje vimpel',k:'plain',c:'#ff7a1a',p:60},{n:'Norsk flagg',k:'norge',p:120},{n:'Målflagg',k:'ruter',p:120},{n:'Regnbue',k:'regnbue',p:150},{n:'Sjørøverflagg',k:'pirat',p:180}];
