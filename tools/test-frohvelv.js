// Kjør:  node tools/test-frohvelv.js [v]
// Sjekker læringsspillet i frøhvelvet (data/frohvelv.js) uten nettleser: at hver stasjon har riktige svar, at bildene finnes,
// at teksten er kort nok for de minste, og at en «perfekt» og en «uheldig» spiller begge kommer seg gjennom alle fire stasjonene.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..');
const load=f=>vm.runInThisContext(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
load('js/frohvelvsim.js');load('data/frohvelv.js');
const verbose=process.argv[2]==='v',D=FROHVELV;let fail=0;
const bad=(...a)=>{fail++;console.log('  FEIL:',...a)};
// the drawings js/frohvelv.js knows (an icon that is none of these must be an emoji)
const src=fs.readFileSync(path.join(root,'js/frohvelv.js'),'utf8');
const known=new Set([...src.matchAll(/^\s*'?([\wæøå_]+)'?:(?:'<svg|on=>)/gm)].map(m=>m[1]));
const isEmoji=s=>/\p{Extended_Pictographic}/u.test(s);
const icon=(k,where)=>{if(!known.has(k)&&!isEmoji(k))bad(where+': ukjent bilde «'+k+'»')};
// every line Frøken Frø says is read aloud: keep it short
const lines=[];const line=(t,where)=>{if(!t||typeof t!=='string')return bad(where+': mangler tekst');lines.push(t);
  for(const s of t.split(/(?<=[.!?])\s+/))if(s.split(/\s+/).length>16)bad(where+': for lang setning: «'+s+'»')};
line(D.intro.say,'intro');line(D.again,'igjen');line(D.end.say,'slutt');
console.log(D.name+': '+D.stations.length+' stasjoner');
D.stations.forEach((S,si)=>{const w='stasjon '+(si+1)+' ('+S.id+')';
  if(S.kind==='grow'){line(S.plant,w);line(S.say,w);line(S.done,w);icon(S.seed,w);const ok=S.items.filter(i=>i.ok);if(ok.length!==3)bad(w+': planten vokser i tre steg, så det må være tre ting som hjelper');
    for(const it of S.items){icon(it.icon,w);line(it.say,w)}if(S.items.length>6)bad(w+': for mange ting å velge mellom')}
  else if(S.kind==='pick'){line(S.hint,w);for(const r of S.rounds){line(r.say,w);line(r.yes,w);if(r.seed)icon(r.seed,w);
      if(r.options.length!==3)bad(w+': tre bilder å velge mellom');if(r.options.filter(o=>o.id===r.answer).length!==1)bad(w+': svaret «'+r.answer+'» er ikke ett av bildene');
      if(r.options[0].id===r.answer&&r.options.length&&S.rounds.every(q=>q.options[0].id===q.answer)&&S.rounds.length>1)bad(w+': svaret står først hver gang');
      for(const o of r.options)icon(o.icon,w)}}
  else if(S.kind==='sort'){line(S.say,w);line(S.done,w);line(S.hint.in,w);line(S.hint.out,w);for(const it of S.items)icon(it.icon,w);
    const n=S.items.filter(i=>i.in).length;if(!n||n===S.items.length)bad(w+': både noe som skal inn og noe som ikke skal');
    for(let i=2;i<S.items.length;i++)if(!!S.items[i].in===!!S.items[i-1].in&&!!S.items[i].in===!!S.items[i-2].in)bad(w+': tre like på rad')}
  else bad(w+': ukjent type «'+S.kind+'»')});
// play it: answer(V) gives the next answer; the unlucky player tries every wrong answer first
function play(label,unlucky){const V=makeVault(D);let tries=0;const seen=[];
  while(vaultNext(V)){const S=vaultStation(V);let guard=0;
    while(guard++<60){const now=vaultNow(V);if(!now)break;let c;
      if(S.kind==='grow'){if(now.need==='plant')c='plant';else{const left=S.items.filter(i=>unlucky?!V.got.has(i.id):i.ok&&!V.got.has(i.id));c=(unlucky&&left.find(i=>!i.ok&&!seen.includes(i.id))||left.find(i=>i.ok)).id;seen.push(c)}}
      else if(S.kind==='pick'){const r=now.round,wrong=r.options.find(o=>o.id!==r.answer&&!V.off.has(o.id));c=unlucky&&wrong?wrong.id:r.answer}
      else{const it=now.item,key='k'+V.k;c=unlucky&&!seen.includes(key)?(seen.push(key),!it.in):!!it.in}
      const r=vaultTry(V,c);tries++;if(verbose)console.log('   ',S.id,JSON.stringify(c),r.ok?'✓':'✗',r.say);if(r.done)break}
    if(guard>=60){bad(label+': kom seg ikke gjennom '+S.id);return}}
  const ok=V.done&&V.i===D.stations.length;if(!ok)bad(label+': ble ikke ferdig');
  console.log(label.padEnd(22),ok?'FERDIG':'FAST  ','forsøk',String(tries).padStart(3),'riktige',V.right,'feil',V.wrong)}
play('perfekt spiller',false);play('uheldig spiller',true);
const words=lines.join(' ').split(/\s+/).length;
console.log('Frøken Frø sier',lines.length,'linjer,',words,'ord i alt (lengste setning',Math.max(...lines.flatMap(t=>t.split(/(?<=[.!?])\s+/).map(s=>s.split(/\s+/).length))),'ord)');
console.log(fail?fail+' feil':'Alt i orden.');process.exit(fail?1:0);
