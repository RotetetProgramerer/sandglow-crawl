'use strict';
/* =================================================================
   FRØHVELVET på Svalbard: et lite læringsspill om frø og planter for de minste (6–7 år).
   Frøken Frø passer på frøene inne i fjellet, og barnet hjelper henne på fire stasjoner.
   Alt barnet ser og hører står her. Teksten leses høyt (js/frohvelv.js), så hold setningene korte.
   Bildene er navn på tegninger i VICON (js/frohvelv.js) eller en emoji.

   Slik er stasjonene bygd (logikken står i js/frohvelvsim.js):
   - grow: trykk på frøet for å plante det, og gi det det det trenger (ok:1). Det som ikke hjelper (ok:0) spretter tilbake.
   - pick: én eller flere runder. Velg riktig bilde blant tre (answer er id-en til det riktige).
   - sort: tingene kommer én og én. Skal den inn i det kalde rommet (in:1) eller ikke (in:0)?
   ================================================================= */
const FROHVELV={
  name:'Frøhvelvet',
  host:'Frøken Frø',
  nuts:50,   // muttere første gang barnet blir frøvokter
  intro:{say:'Hei! Jeg heter Frøken Frø. Inne i dette fjellet passer jeg på frø fra hele verden. Vil du hjelpe meg?',btn:'Ja, jeg hjelper!'},
  again:'Hei igjen, frøvokter! Vil du hjelpe meg en gang til?',
  stations:[
    {id:'sa',kind:'grow',title:'Hva trenger frøet?',
      plant:'Her er et lite frø. Trykk på frøet, så planter vi det i potta.',
      say:'Hva trenger frøet for å vokse? Trykk på det som hjelper.',
      seed:'frø_solsikke',
      items:[
        {id:'jord',icon:'jord',label:'Jord',ok:1,say:'Jord! I jorda kan røttene vokse.'},
        {id:'sokk',icon:'🧦',label:'Sokk',ok:0,say:'En sokk? Nei, den hjelper ikke frøet.'},
        {id:'vann',icon:'vann',label:'Vann',ok:1,say:'Vann! Frøet blir tørst, akkurat som deg.'},
        {id:'godteri',icon:'🍭',label:'Godteri',ok:0,say:'Godteri er for deg, ikke for frøet!'},
        {id:'sol',icon:'sol',label:'Sol',ok:1,say:'Sol! Planten trenger lys for å vokse.'}],
      done:'Se! Frøet ble til en solsikke. Det trengte jord, vann og sol.'},
    {id:'blir',kind:'pick',title:'Hva blir frøet til?',
      hint:'Nesten! Prøv en gang til.',
      rounds:[
        {seed:'frø_eple',label:'Eplefrø',say:'Dette frøet fant jeg inni et eple. Hva blir det til?',answer:'eple',
          options:[{id:'mais',icon:'🌽',label:'Mais'},{id:'eple',icon:'🍎',label:'Epletre'},{id:'sol',icon:'🌻',label:'Solsikke'}],
          yes:'Riktig! Et lite eplefrø kan bli et stort epletre.'},
        {seed:'frø_mais',label:'Maiskorn',say:'Dette gule frøet er et maiskorn. Hva blir det til?',answer:'mais',
          options:[{id:'eple',icon:'🍎',label:'Epletre'},{id:'sol',icon:'🌻',label:'Solsikke'},{id:'mais',icon:'🌽',label:'Mais'}],
          yes:'Riktig! Av ett maiskorn vokser en høy maisplante.'},
        {seed:'frø_solsikke',label:'Solsikkefrø',say:'Dette frøet er stripete. Hva blir det til?',answer:'sol',
          options:[{id:'sol',icon:'🌻',label:'Solsikke'},{id:'mais',icon:'🌽',label:'Mais'},{id:'eple',icon:'🍎',label:'Epletre'}],
          yes:'Riktig! Solsikka er full av nye frø. Dem liker fuglene.'}]},
    {id:'inn',kind:'sort',title:'Inn i hvelvet',
      say:'Bare frø skal inn i det kalde rommet. Skal denne inn?',
      yesBtn:'Ja, inn!',noBtn:'Nei',
      hint:{in:'Jo! Det er en frøpose. Den skal inn.',out:'Nei, bare frø skal inn i hvelvet.'},
      items:[
        {icon:'pose',on:'🍎',label:'Eplefrø',in:1},
        {icon:'🧸',label:'Bamse',in:0},
        {icon:'pose',on:'🌽',label:'Maisfrø',in:1},
        {icon:'⚽',label:'Ball',in:0},
        {icon:'pose',on:'🥕',label:'Gulrotfrø',in:1},
        {icon:'👟',label:'Sko',in:0},
        {icon:'pose',on:'🌾',label:'Risfrø',in:1}],
      done:'Bra jobba! Her inne er det like kaldt som i fryseren hjemme. Da sover frøene i mange, mange år.'},
    {id:'hvorfor',kind:'pick',title:'Hvorfor tar vi vare på frø?',
      hint:'Hmm, tenk en gang til. Hva lager vi av planter?',
      rounds:[
        {say:'Hvorfor tar vi vare på frø her inne?',answer:'mat',
          options:[{id:'leke',icon:'🎈',label:'Så vi kan leke med dem'},{id:'mat',icon:'🥕🍞',label:'Så vi alltid kan dyrke mat'},{id:'pynt',icon:'🎀',label:'Fordi de er fine å se på'}],
          yes:'Ja! Hvis plantene blir borte et sted, kan vi hente frø her og så dem igjen. Da har vi alltid mat.'}]}],
  end:{title:'Du er frøvokter!',say:'Tusen takk for hjelpen! Nå er du en ekte frøvokter. Se på bilen din: Du har fått en liten spire.',
    again:'Tusen takk for hjelpen igjen, frøvokter!',btn:'Gå ut av hvelvet',more:'Spill igjen'},
  praise:['Bra!','Flott!','Supert!','Så flink du er!']
};
