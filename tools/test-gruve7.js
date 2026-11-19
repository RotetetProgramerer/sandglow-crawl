// Kjør:  node tools/test-gruve7.js [v]
// Kjører Gruve 7 (data/gruve7.js) med en autopilot uten nettleser: i flere hastigheter, og med en pilot som ser kort og en som ser langt.
// Hver rad bør vise MÅL med 0 treff. «kull» er hvor mange klumper piloten fikk med seg, «knappest» er den korteste tiden mellom to hindringer.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..');
const load=f=>vm.runInThisContext(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
load('js/gruvesim.js');load('data/gruve7.js');
const verbose=process.argv[2]==='v';
const m=makeMine(GRUVE7);let fail=0;
const n=k=>m.obs.filter(o=>o.need===k).length;
console.log(m.name+': lengde',m.len.toFixed(0),'hindringer',m.obs.length,'(bytt spor',n('lane')+', dukk',n('duck')+', hopp',n('jump')+')','kull',m.coal.length,'sjekkpunkter',m.cps.length,'soner',m.zones.length);
// sanity: every obstacle leaves a way past, nothing stands right after a checkpoint, the coal is not inside what closes its track,
// and there is time to react between two obstacles
{const bad=[];let tight=1e9,tightS=0;
  for(const o of m.obs){if(o.need==='lane'&&o.lanes.every(Boolean))bad.push('alle spor stengt@'+o.s.toFixed(0));
    for(const p of m.cps)if(o.s0>p.s-2&&o.s0<p.s+m.zones[mineZone(m,p.s)].v*.9)bad.push(o.kind+' rett etter sjekkpunkt@'+p.s.toFixed(0))}
  for(let i=1;i<m.obs.length;i++){const a=m.obs[i-1],b=m.obs[i],t=(b.s0-a.s1)/m.zones[mineZone(m,b.s)].v;if(t<tight){tight=t;tightS=b.s}}
  for(const k of m.coal)for(const o of m.obs)if(o.need==='lane'&&o.lanes[k.lane+1]&&k.s>o.s0-1.5&&k.s<o.s1+1.5)bad.push('kull i '+o.kind+'@'+k.s.toFixed(0));
  if(m.cps.some((p,i)=>i&&p.s-m.cps[i-1].s>150))bad.push('mer enn 150 mellom to sjekkpunkter');
  if(tight<.5)bad.push('for tett');if(bad.length)fail++;
  console.log('Knappest mellom to hindringer:',tight.toFixed(2)+'s ved',tightS.toFixed(0),bad.length?'  FEIL: '+bad.join(', '):'');}
function run(label,scale,react){const c=makeMineCart(m,scale),ev=[];let jumps=0,i=0;
  for(;i<120*400&&c.state==='run';i++){stepMineCart(c,minePilot(c,m,react),m,MSTEP);
    for(const e of c.ev){if(e.type==='hit')ev.push(e.kind+'@'+e.s.toFixed(0));if(e.type==='jump')jumps++}c.ev.length=0}
  const ok=c.state==='done'&&c.hits===0;if(!ok)fail++;
  console.log(label.padEnd(26),c.state==='done'?(c.hits?'TREFF':'MÅL  '):'FEIL ','tid',c.t.toFixed(1).padStart(5)+'s','treff',c.hits,'kull',(c.got+'/'+m.coal.length).padEnd(8),'lengste rekke',String(c.maxCombo).padStart(3),'hopp',jumps);
  if((verbose||!ok)&&ev.length)console.log('   ',ev.join(' '))}
run('vanlig fart',1,.9);run('vanlig fart, ser kort',1,.55);run('vanlig fart, ser langt',1,1.4);
run('lett modus (88 %)',.88,.9);run('lett modus, ser kort',.88,.55);
run('saktest (70 %)',.7,.9);run('fortest (115 %)',1.15,.9);run('fortest, ser kort',1.15,.55);
// a wagon that does nothing must lose its three lanterns
{const c=makeMineCart(m,1),no={};for(let i=0;i<120*200&&c.state==='run';i++){stepMineCart(c,no,m,MSTEP);c.ev.length=0}
  const ok=c.state==='out'&&c.hits===MCFG.lights;if(!ok)fail++;console.log('uten sjåfør'.padEnd(26),ok?'UTE  ':'FEIL ','etter',c.hits,'treff, kom til',c.s.toFixed(0))}
process.exit(fail?1:0);
