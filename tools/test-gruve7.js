// Kjør:  node tools/test-gruve7.js [v]
// Kjører kappløpet i Gruve 7 (data/gruve7.js) uten nettleser: en autopilot kjører spillerens vogn mot de tre rivalene, i flere hastigheter.
// Hver rad bør vise MÅL. «treff» er hvor ofte spilleren ble snurret rundt (av hindringer, hakker og feller), «kull» er hvor mange klumper
// piloten fikk med seg, og «rivaler» er tidene til de tre andre.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..');
const load=f=>vm.runInThisContext(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
load('js/gruvesim.js');load('data/gruve7.js');
const verbose=process.argv[2]==='v';
const m=makeMine(GRUVE7);let fail=0;
const n=k=>m.obs.filter(o=>o.need===k).length;
console.log(m.name+': lengde',m.len.toFixed(0),'hindringer',m.obs.length,'(bytt spor',n('lane')+', dukk',n('duck')+', hopp',n('jump')+')','kull',m.coal.length,'kasser',m.boxes.length,'fartsfelt',m.pads.length,'soner',m.zones.length);
// sanity: every obstacle leaves a way past, the coal, crates and pads are not inside what closes their track, and there is time to react
{const bad=[];let tight=1e9,tightS=0;
  for(const o of m.obs)if(o.need==='lane'&&o.lanes.every(Boolean))bad.push('alle spor stengt@'+o.s.toFixed(0));
  for(let i=1;i<m.obs.length;i++){const a=m.obs[i-1],b=m.obs[i],t=(b.s0-a.s1)/m.zones[mineZone(m,b.s)].v;if(t<tight){tight=t;tightS=b.s}}
  for(const[what,L]of[['kull',m.coal],['kasse',m.boxes],['fartsfelt',m.pads]])for(const k of L)for(const o of m.obs)if(o.lanes[k.lane+1]&&k.s+(k.len||0)>o.s0-1.5&&k.s<o.s1+1.5&&(o.need==='lane'||what!=='kull'))bad.push(what+' i '+o.kind+'@'+k.s.toFixed(0));
  if(tight<.5)bad.push('for tett');if(bad.length)fail++;
  console.log('Knappest mellom to hindringer:',tight.toFixed(2)+'s ved',tightS.toFixed(0),bad.length?'  FEIL: '+bad.join(', '):'');}
const tm=t=>t.toFixed(1)+'s';
function run(label,o,expect){const R=makeMineRace(m,o),P=R.P,ev=[],used={};let i=0;const none={};
  for(;i<120*400&&!(R.carts.every(c=>c.fin));i++){stepMineRace(R,none,MSTEP);
    for(const e of R.ev){if(e.type==='hit'&&e.c===0)ev.push(e.kind+'@'+e.s.toFixed(0));if(e.type==='use')used[e.item]=(used[e.item]||0)+1}R.ev.length=0}
  const all=R.carts.every(c=>c.fin),ok=all&&(!expect||expect(R));if(!ok)fail++;
  console.log(label.padEnd(24),all?(ok?'MÅL ':'FEIL'):'FAST',P.place+'. plass','tid',tm(P.fin||0).padStart(6),'treff',P.hits,'kull',(P.got+'/'+m.coal.length).padEnd(8),'rivaler',R.carts.slice(1).map(c=>c.name.split(/[- ]/).pop()+' '+tm(c.fin||0)+' ('+c.hits+')').join(', '),
    'brukt',Object.keys(used).map(k=>k+' '+used[k]).join(' ')||'-');
  if(verbose&&ev.length)console.log('   ',ev.join(' '))}
for(const seed of[7,21,99])run('vanlig fart, frø '+seed,{pilot:true,seed,react:.9});
run('ser kort',{pilot:true,react:.55,seed:3});run('lett modus',{pilot:true,easy:true,speedScale:.9,seed:5});
run('saktest (70 %)',{pilot:true,speedScale:.7,seed:11});run('fortest (115 %)',{pilot:true,speedScale:1.15,seed:13});
// a wagon nobody drives rolls through everything, and must come in last
run('uten sjåfør',{seed:17},R=>R.P.place===4&&R.P.hits>20);
process.exit(fail?1:0);
