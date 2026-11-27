'use strict';
/* =================================================================
   FRØHVELVET på Svalbard: et lite læringsspill om frø og planter for de minste.
   Stopp på den blå ruta foran døra i frøhvelvet (til fots eller med bilen), så spør spillet om du vil gå inn. Der inne møter du
   Frøken Frø, som passer på frøene, og hjelper henne på fire stasjoner (data/frohvelv.js):
     1. Plant et frø, og gi det jord, vann og sol til det blir en solsikke.
     2. Hva blir frøet til? Eplefrø, maiskorn og solsikkefrø.
     3. Inn i hvelvet: bare frøposene skal inn i det kalde rommet.
     4. Hvorfor tar vi vare på frø?
   Ingen kan tape. Feil svar gir et hint, og du prøver igjen. Frøken Frø leser alt høyt (nettleserens talesyntese, norsk stemme)
   når «Les høyt» er på. Første gang du blir frøvokter, får du muttere og en liten spire i en potte bak på bilen (på alle øyene).
   Reglene står i js/frohvelvsim.js. Skjermbildet er et vanlig HTML-lag (#vault i index.html) over spillet, og øya tegnes ikke
   mens du er inne. Det som er gjort, lagres i prof.frohvelv={done,read}.
   Banen setter c.vaultDef={ask:{x,z},r} i build(c) (data/levels/13-svalbard.js). Bruker globalene i game.js og world.js.
   ================================================================= */
const VT={on:false,fade:null,V:null,timer:0,sayT:0,voiceOk:null,nextFn:null};
const vtProf=()=>prof.frohvelv||(prof.frohvelv={read:1});
const vtRead=()=>vtProf().read!==0;
const vEsc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- the drawings ---------- */
// Frøken Frø: round glasses, freckles, red braids and a fringe, earrings, a knitted hat with a pattern and a sprout on top, a striped scarf and a warm green jacket with a zip. The mouth opens while she talks (.talk)
const VT_FIA=`<svg viewBox="0 0 140 170" aria-hidden="true">
  <path d="M22 170c0-40 18-62 48-62s48 22 48 62z" fill="#2f8f6a"/><path d="M70 112v58" stroke="#1f6a4c" stroke-width="3"/>
  <path d="M44 112c8 10 44 10 52 0l-4-8H48z" fill="#f2c230"/><rect x="88" y="132" width="16" height="14" rx="3" fill="#1f6a4c"/><path d="M96 132v-6m-4 2 4-4 4 4" stroke="#8bdc6a" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M36 66c-10 14-10 34-2 42" stroke="#c8622a" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M104 66c10 14 10 34 2 42" stroke="#c8622a" stroke-width="10" fill="none" stroke-linecap="round"/>
  <circle cx="34" cy="110" r="5" fill="#f2c230"/><circle cx="106" cy="110" r="5" fill="#f2c230"/>
  <path d="M30 76l9 4M29 87l9 4M29 98l8 3M110 76l-9 4M111 87l-9 4M111 98l-8 3" stroke="#a04e20" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M34 128q7 16 5 42M106 128q-7 16-5 42" stroke="#1f6a4c" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M53 109l-2 7M64 111l-1 8M76 111l1 8M87 109l2 7" stroke="#d99a1a" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="70" cy="124" r="3" fill="#f2c230"/><circle cx="70" cy="140" r="2.2" fill="#1f6a4c"/><circle cx="70" cy="154" r="2.2" fill="#1f6a4c"/>
  <ellipse cx="37" cy="74" rx="5" ry="8" fill="#f4c9a2"/><ellipse cx="103" cy="74" rx="5" ry="8" fill="#f4c9a2"/><circle cx="36" cy="82" r="2.2" fill="#f2c230"/><circle cx="104" cy="82" r="2.2" fill="#f2c230"/>
  <ellipse cx="70" cy="70" rx="33" ry="35" fill="#f4c9a2"/>
  <path d="M38 64c4 7 12 7 16 2 4 6 12 6 16 0 4 6 12 6 16 0 4 5 12 5 16-2v-8H38z" fill="#c8622a"/>
  <g fill="#d99a72"><circle cx="45" cy="77" r="1.1"/><circle cx="49" cy="75" r="1.1"/><circle cx="53" cy="78" r="1.1"/><circle cx="87" cy="78" r="1.1"/><circle cx="91" cy="75" r="1.1"/><circle cx="95" cy="77" r="1.1"/></g>
  <path d="M67 79q3 4 6 0" stroke="#d99a72" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <ellipse cx="50" cy="82" rx="7" ry="4.5" fill="#f19a8e" opacity=".7"/><ellipse cx="90" cy="82" rx="7" ry="4.5" fill="#f19a8e" opacity=".7"/>
  <g class="vt-eyes"><circle cx="57" cy="70" r="4" fill="#2a2420"/><circle cx="83" cy="70" r="4" fill="#2a2420"/><circle cx="58.5" cy="68.5" r="1.3" fill="#fff"/><circle cx="84.5" cy="68.5" r="1.3" fill="#fff"/></g>
  <g fill="none" stroke="#5a4636" stroke-width="2.4"><circle cx="57" cy="70" r="10"/><circle cx="83" cy="70" r="10"/><path d="M67 70h6"/></g>
  <path class="vt-smile" d="M58 88q12 11 24 0" stroke="#8a3a2a" stroke-width="3" fill="none" stroke-linecap="round"/>
  <ellipse class="vt-mouth" cx="70" cy="91" rx="8" ry="6" fill="#8a3a2a"/>
  <path d="M34 58c0-26 16-40 36-40s36 14 36 40z" fill="#5aa83a"/><path d="M32 56h76v10H32z" fill="#3f8a2a" rx="4"/>
  <path d="M40 56v10M50 56v10M60 56v10M70 56v10M80 56v10M90 56v10M100 56v10" stroke="#2f6a1f" stroke-width="2"/>
  <path d="M41 46l6-6 6 6 6-6 6 6 5-6 5 6 6-6 6 6 6-6 6 6" stroke="#8bdc6a" stroke-width="2.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/><path d="M50 30h40" stroke="#3f8a2a" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M70 18V4" stroke="#3f8a2a" stroke-width="4" stroke-linecap="round"/><path d="M70 9c-10-8-20-4-20 2 8 4 16 2 20-2zM70 7c8-9 18-7 19-1-7 5-15 4-19 1z" fill="#8bdc6a"/>
</svg>`;
const SEED_SVG={
  'frø_eple':'<svg viewBox="0 0 60 60"><path d="M30 6c12 14 18 26 18 34a18 16 0 0 1-36 0c0-8 6-20 18-34z" fill="#6b3a1e"/><path d="M24 26c-3 6-4 12-3 18" stroke="#a8683a" stroke-width="4" fill="none" stroke-linecap="round"/></svg>',
  'frø_mais':'<svg viewBox="0 0 60 60"><path d="M14 10h32c4 0 6 3 5 7l-8 33c-1 4-4 6-8 6h-10c-4 0-7-2-8-6L9 17c-1-4 1-7 5-7z" fill="#f2c230"/><path d="M22 16c-2 8-1 18 2 26" stroke="#fff3b0" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="30" cy="50" rx="6" ry="3" fill="#d8a020"/></svg>',
  'frø_solsikke':'<svg viewBox="0 0 60 60"><path d="M30 4c11 12 16 26 16 36a16 16 0 0 1-32 0c0-10 5-24 16-36z" fill="#2a2a2e"/><path d="M30 8v46M23 18c-3 10-3 24 0 34M37 18c3 10 3 24 0 34" stroke="#e8e8e8" stroke-width="2.5" fill="none"/></svg>'};
// the pictures on the buttons: a few drawings, else an emoji
const VICON={
  jord:'<svg viewBox="0 0 60 60"><path d="M6 46c4-14 14-22 24-22s20 8 24 22z" fill="#6b4a2a"/><circle cx="20" cy="40" r="3" fill="#4a3018"/><circle cx="34" cy="34" r="2.5" fill="#4a3018"/><circle cx="42" cy="42" r="3" fill="#8a6a44"/><path d="M4 48h52" stroke="#4a3018" stroke-width="4" stroke-linecap="round"/></svg>',
  vann:'<svg viewBox="0 0 60 60"><path d="M30 4C22 18 14 28 14 38a16 16 0 0 0 32 0c0-10-8-20-16-34z" fill="#3a9ae8"/><path d="M22 38c0 6 4 10 9 10" stroke="#bfe6ff" stroke-width="4" fill="none" stroke-linecap="round"/></svg>',
  sol:'<svg viewBox="0 0 60 60"><g stroke="#f2a020" stroke-width="4" stroke-linecap="round"><path d="M30 3v8M30 49v8M3 30h8M49 30h8M11 11l6 6M43 43l6 6M49 11l-6 6M17 43l-6 6"/></g><circle cx="30" cy="30" r="13" fill="#f7c830"/></svg>',
  pose:on=>`<svg viewBox="0 0 70 80"><path d="M10 14h50l4 60H6z" fill="#e8d4a8"/><path d="M10 14l4-8h42l4 8" fill="#d4bc8a"/><path d="M10 14h50" stroke="#b89a64" stroke-width="2"/><rect x="16" y="54" width="38" height="10" rx="2" fill="#5aa83a"/><text x="35" y="62" font-size="8" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="700">FRØ</text><text x="35" y="46" font-size="26" text-anchor="middle">${on||''}</text></svg>`};
const vIcon=(k,on)=>{const v=VICON[k]||SEED_SVG[k];if(typeof v==='function')return v(on);if(v)return v;return`<span class="vt-emoji">${k}</span>`};
// the pot in the first station: the soil, the water, the sun and the plant in three steps (sprout, leaves, a sunflower)
const VT_POT=`<svg class="vt-pot" viewBox="0 0 220 240" aria-hidden="true">
  <g class="vg-sun"><g class="vg-rays" stroke="#f2a020" stroke-width="5" stroke-linecap="round"><path d="M182 4v10M182 62v10M150 38h10M204 38h10M160 16l7 7M197 53l7 7M204 16l-7 7M167 53l-7 7"/></g><circle cx="182" cy="38" r="16" fill="#f7c830"/></g>
  <g class="vg-rain">${[70,95,120,145].map((x,i)=>`<path style="animation-delay:${i*.18}s" d="M${x} 60c-5 9-8 13-8 17a8 8 0 0 0 16 0c0-4-3-8-8-17z" fill="#3a9ae8"/>`).join('')}</g>
  <g class="vg-plant">
    <g class="vg-p1"><path d="M110 168v-24" stroke="#3f8a2a" stroke-width="5" stroke-linecap="round"/><path d="M110 150c-10-8-20-6-20 0 8 5 14 4 20 0zM110 148c10-8 20-6 20 0-8 5-14 4-20 0z" fill="#6ac04a"/></g>
    <g class="vg-p2"><path d="M110 168v-62" stroke="#3f8a2a" stroke-width="6" stroke-linecap="round"/><path d="M110 140c-18-12-32-6-32 2 12 7 24 5 32-2zM110 124c18-12 32-6 32 2-12 7-24 5-32-2z" fill="#5aa83a"/></g>
    <g class="vg-p3"><path d="M110 106v-46" stroke="#3f8a2a" stroke-width="6" stroke-linecap="round"/>
      ${Array.from({length:12},(_,i)=>`<ellipse cx="110" cy="38" rx="7" ry="16" fill="#f7c830" transform="rotate(${i*30} 110 56)"/>`).join('')}<circle cx="110" cy="56" r="13" fill="#6b3a1e"/><circle cx="106" cy="52" r="2" fill="#4a2810"/><circle cx="114" cy="58" r="2" fill="#4a2810"/><circle cx="108" cy="61" r="2" fill="#4a2810"/></g>
  </g>
  <g class="vg-seed"><path d="M110 156c5 5 7 10 7 13a7 6 0 0 1-14 0c0-3 2-8 7-13z" fill="#2a2a2e"/><path d="M110 158v16" stroke="#e8e8e8" stroke-width="1.5"/></g>
  <path d="M60 168h100l-12 64H72z" fill="#c8653a"/><path d="M54 160h112v14H54z" fill="#d97a4a"/><path d="M72 196h76" stroke="#b05430" stroke-width="3"/>
  <path class="vg-soil" d="M62 168h96l-1 8H63z" fill="#6b4a2a"/>
</svg>`;

/* ---------- reading aloud ---------- */
// a Norwegian voice if the machine has one. With voices but none Norwegian we stay quiet: another language's voice can't read Norwegian
function vVoice(){if(!('speechSynthesis' in window))return null;const L=speechSynthesis.getVoices()||[];if(!L.length)return undefined;
  return L.find(v=>/^(nb|no|nn)([-_]|$)/i.test(v.lang))||L.find(v=>/norsk|norwegian/i.test(v.name))||null}
// more: [[text,button],…] read after the line, one utterance each (the browser queues them, so they can't cut the line off). The button lights up (.say) while its text is read
function vSpeak(text,more){if(VT.out)return;const fia=$('vtFia'),all=more&&more.length?text+' '+more.map(m=>m[0]).join(' '):text;clearTimeout(VT.talkTo);clearTimeout(VT.spkTo);fia.classList.remove('talk');vUnsay();
  if(!('speechSynthesis' in window)){vReadBtn();return vTalk(all)}speechSynthesis.cancel();vReadBtn();if(!vtRead())return vTalk(all);
  const v=vVoice();if(v===null)return vTalk(all);
  VT.spkTo=setTimeout(()=>{if(!VT.on||VT.out)return;const parts=[[text,null],...(more||[])];
    try{parts.forEach(([t,el],i)=>{const u=new SpeechSynthesisUtterance(t);u.lang=v?v.lang:'nb-NO';if(v)u.voice=v;u.rate=.92;u.pitch=1.12;
      u.onstart=()=>{fia.classList.add('talk');if(el)el.classList.add('say')};u.onend=u.onerror=()=>{if(el)el.classList.remove('say');if(i===parts.length-1)fia.classList.remove('talk')};speechSynthesis.speak(u)})}catch(e){vTalk(all)}},70)}
const vUnsay=()=>{const st=$('vtStage');if(st)st.querySelectorAll('.say').forEach(x=>x.classList.remove('say'))};
const vAgain=()=>{if(VT.said)vSpeak(VT.said,VT.more)};
// no voice: she moves her mouth for about as long as it takes to read the line
function vTalk(text){const fia=$('vtFia');fia.classList.add('talk');VT.talkTo=setTimeout(()=>fia.classList.remove('talk'),Math.min(6000,600+text.length*45))}
function vSay(text,more){VT.said=text;VT.more=more||null;$('vtSay').textContent=text;vSpeak(text,more);const b=$('vtBubble');b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop')}
// with no Norwegian voice (or no speech at all) the game is silent: say so in a line a grown-up can see, also on a touch screen (a title never shows there)
function vReadBtn(){const b=$('vtRead'),v=vVoice();if(v!==undefined)VT.voiceOk=v!==null;const nv=$('vtNoVoice');if(nv)nv.hidden=VT.voiceOk!==false;b.textContent=(vtRead()?'🔊':'🔇')+' Les høyt: '+(vtRead()?'på':'av');b.setAttribute('aria-pressed',vtRead());
  b.title=VT.voiceOk===false?'Fant ingen norsk stemme på denne maskinen, så teksten blir ikke lest høyt.':'Frøken Frø leser høyt';b.classList.toggle('novoice',VT.voiceOk===false)}
function vStopVoice(){clearTimeout(VT.spkTo);clearTimeout(VT.talkTo);try{if('speechSynthesis' in window)speechSynthesis.cancel()}catch(e){}const f=$('vtFia');if(f)f.classList.remove('talk');vUnsay()}

/* ---------- small sounds (WebAudio, no files) ---------- */
function vTone(fr,d,delay=0,type='triangle',v=.16){if(!AC||!state.sound)return;try{const t=AC.currentTime+delay,o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(fr,t);
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v*(state.volAmb??70)/70,t+.015);g.gain.exponentialRampToValueAtTime(.0008,t+d);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+d+.05)}catch(e){}}
const vRight=()=>{vTone(784,.25);vTone(1047,.35,.1)};
const vWrong=()=>{vTone(330,.22,0,'sine',.14);vTone(262,.3,.12,'sine',.12)};
const vFanfare=()=>[523,659,784,1047,784,1047].forEach((f,i)=>vTone(f,.35,i*.14));

/* ---------- the screens ---------- */
const vStage=()=>$('vtStage');
function vDots(){const V=VT.V,n=V.D.stations.length;$('vtDots').innerHTML=V.D.stations.map((s,i)=>`<i class="${i<V.i||V.done?'ok':i===V.i?'now':''}" title="${vEsc(s.title)}"></i>`).join('');
  $('vtStep').textContent=V.i<0?'':V.done?'Ferdig!':'Stasjon '+(V.i+1)+' av '+n+' · '+V.D.stations[V.i].title}
function vIntro(){const V=VT.V=makeVault(FROHVELV),D=V.D,again=vtProf().done;vDots();
  vStage().innerHTML=`<div class="vt-intro"><div class="vt-vaultdoor" aria-hidden="true"><span>❄</span></div>
    <button class="vt-big vt-go" id="vtStart">${vEsc(D.intro.btn)} ▶</button></div>`;
  $('vtStart').onclick=()=>{vTap();vNext()};vSay(again?D.again:D.intro.say)}
function vNext(){const V=VT.V,S=vaultNext(V);vDots();if(!S)return vEnd();
  if(S.kind==='grow')vGrow(S);else if(S.kind==='pick')vPick(S);else if(S.kind==='sort')vSort(S)}
// «Videre»: shown when a station is done
function vMore(label='Videre ▶'){const b=document.createElement('button');b.className='vt-big vt-go vt-more';b.textContent=label;b.onclick=()=>{vTap();vNext()};vStage().appendChild(b);setTimeout(()=>b.focus({preventScroll:true}),50)}
const vTap=()=>{initAudio();if(AC&&AC.state==='suspended')AC.resume()};
function vShake(el){el.classList.remove('shake');void el.offsetWidth;el.classList.add('shake')}

// 1. the pot: tap the seed to plant it, then give it what it needs
function vGrow(S){const st=vStage();
  st.innerHTML=`<div class="vt-grow"><div class="vt-potbox stage0">${VT_POT}<button class="vt-seedbtn" id="vtSeed" aria-label="Plant frøet">${SEED_SVG[S.seed]}<small>Trykk på frøet</small></button></div>
    <div class="vt-items" id="vtItems" hidden>${S.items.map((it,i)=>`<button class="vt-item" data-n="${i+1}" data-id="${it.id}">${vIcon(it.icon)}<b>${vEsc(it.label)}</b></button>`).join('')}</div></div>`;
  const box=st.querySelector('.vt-potbox');
  $('vtSeed').onclick=()=>{vTap();const r=vaultTry(VT.V,'plant');if(!r.ok)return;vRight();box.classList.add('planted');$('vtSeed').remove();$('vtItems').hidden=false;vSay(r.say)};
  st.querySelectorAll('.vt-item').forEach(b=>b.onclick=()=>{vTap();const id=b.dataset.id,r=vaultTry(VT.V,id);
    if(!r.ok){vWrong();vShake(b);vSay(r.say);return}if(r.again){vSay(r.say);return}
    vRight();b.classList.add('used');b.disabled=true;box.classList.add('got-'+id);box.classList.remove('stage'+(r.stage-1));box.classList.add('stage'+r.stage);vSay(r.say);
    if(r.done){st.querySelectorAll('.vt-item').forEach(x=>x.disabled=true);box.classList.add('bloom');vMore()}});
  vSay(S.plant)}
// 2 and 4: pick the right picture of three, one round after another
function vPick(S){const V=VT.V,r=S.rounds[V.round],st=vStage();
  st.innerHTML=`<div class="vt-pick">${r.seed?`<div class="vt-bigseed">${SEED_SVG[r.seed]}<b>${vEsc(r.label)}</b></div>`:`<div class="vt-q">${vEsc(r.say)}</div>`}
    <div class="vt-opts">${r.options.map((o,i)=>`<button class="vt-opt" data-n="${i+1}" data-id="${o.id}">${vIcon(o.icon)}<b>${vEsc(o.label)}</b></button>`).join('')}</div>
    ${S.rounds.length>1?`<div class="vt-rounds">${S.rounds.map((_,i)=>`<i class="${i<V.round?'ok':i===V.round?'now':''}"></i>`).join('')}</div>`:''}</div>`;
  st.querySelectorAll('.vt-opt').forEach(b=>b.onclick=()=>{vTap();if(b.disabled)return;const res=vaultTry(V,b.dataset.id);
    if(!res.ok){vWrong();vShake(b);b.classList.add('off');b.disabled=true;vSay(res.say);return}
    vRight();b.classList.add('right');st.querySelectorAll('.vt-opt').forEach(x=>x.disabled=true);vSay(res.say);
    if(res.done)vMore();else{const nb=document.createElement('button');nb.className='vt-big vt-go vt-more';nb.textContent='Neste frø ▶';nb.onclick=()=>{vTap();vPick(S)};st.appendChild(nb);setTimeout(()=>nb.focus({preventScroll:true}),50)}});
  // the answers of a question without a picture seed are whole sentences (station 4): read them too, each with its number (the keys 1–3)
  vSay(r.say,r.seed?null:[...st.querySelectorAll('.vt-opt')].map((b,i)=>[(['Én','To','Tre'][i]||i+1)+': '+r.options[i].label+'.',b]))}
// 3. the belt: one thing at a time. Into the cold room, or not?
function vSort(S){const V=VT.V,st=vStage();
  st.innerHTML=`<div class="vt-sort"><div class="vt-belt"><div class="vt-thing" id="vtThing"></div><div class="vt-rollers" aria-hidden="true"></div></div>
    <div class="vt-doors"><button class="vt-door yes" data-n="1" id="vtIn"><span class="vt-door-ic">❄️</span><b>${vEsc(S.yesBtn)}</b></button>
      <button class="vt-door no" data-n="2" id="vtNo"><span class="vt-door-ic">✋</span><b>${vEsc(S.noBtn)}</b></button></div>
    <div class="vt-shelf" id="vtShelf" aria-label="Frø i hvelvet"><span>I hvelvet:</span></div></div>`;
  const show=()=>{const it=S.items[V.k],t=$('vtThing');if(!it)return;t.className='vt-thing arrive';t.innerHTML=vIcon(it.icon,it.on)+`<b>${vEsc(it.label)}</b>`};
  let busy=false;
  const go=yes=>{if(busy)return;vTap();const it=S.items[V.k],r=vaultTry(V,yes),t=$('vtThing');
    if(!r.ok){vWrong();vShake(t);vSay(r.say);return}
    vRight();busy=true;t.classList.remove('arrive');t.classList.add(yes?'go-in':'go-out');
    if(yes){const s=document.createElement('span');s.className='vt-bag';s.innerHTML=vIcon(it.icon,it.on);$('vtShelf').appendChild(s)}
    vSay(r.say);
    setTimeout(()=>{busy=false;if(r.done){$('vtIn').disabled=$('vtNo').disabled=true;t.className='vt-thing gone';st.querySelector('.vt-sort').classList.add('cold');vMore()}else show()},650)};
  $('vtIn').onclick=()=>go(true);$('vtNo').onclick=()=>go(false);
  show();vSay(S.say)}
// the end: a badge, the nuts the first time, and the sprout on the car
function vEnd(){const D=FROHVELV,P=vtProf(),first=!P.done;vDots();
  if(first){P.done=1;prof.nuts+=D.nuts;saveProf()}
  vStage().innerHTML=`<div class="vt-end"><div class="vt-badge" aria-hidden="true"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="#f2c230"/><circle cx="60" cy="60" r="44" fill="#5aa83a"/>
      <path d="M60 92V52" stroke="#e8ffd8" stroke-width="7" stroke-linecap="round"/><path d="M60 64c-16-14-30-8-30 2 12 8 22 6 30-2zM60 56c16-14 30-8 30 2-12 8-22 6-30-2z" fill="#e8ffd8"/></svg></div>
    <h3>${vEsc(D.end.title)}</h3>${first?`<p class="vt-prize">+${D.nuts} ⚙ · en spire på bilen din</p>`:''}
    <div class="vt-endrow"><button class="vt-big vt-go" id="vtEndOut">${vEsc(D.end.btn)}</button><button class="vt-big vt-ghost" id="vtEndMore">${vEsc(D.end.more)}</button></div></div>`;
  $('vtEndOut').onclick=()=>vaultExit();$('vtEndMore').onclick=()=>{vTap();vIntro()};vFanfare();vSay(first?D.end.say:D.end.again);
  setTimeout(()=>{const b=$('vtEndOut');if(b)b.focus({preventScroll:true})},60)}

/* ---------- in and out ---------- */
function vaultAsk(){const P=vtProf();$('aKind').textContent='Svalbard';$('aName').textContent='Frøhvelvet';
  $('aDesc').textContent='Frøken Frø står i døra og vinker: «Hei! Vil du hjelpe meg å passe på frøene?»';
  $('aBest').textContent=P.done?'Du er frøvokter. Du kan spille igjen når du vil.':'Et lite spill om frø og planter. Første gang får du '+FROHVELV.nuts+' muttere.';
  $('aQ').textContent='Vil du gå inn i frøhvelvet?';$('aYes').textContent='JA';$('aNo').textContent='NEI, ikke nå';$('ask').hidden=false;$('aYes').focus()}
function vaultAnswer(yes){state.askCool='vault';if(yes)vaultEnter();else state.mode='play'}
// called from updateWorld while roaming: ask when the car (or the driver on foot) stops on the blue square by the door
function vaultWorld(){const D=LV&&LV.vaultDef;if(!D||state.mode!=='play')return false;const p=WALK.on?WALK.pos:car.pos,d=Math.hypot(D.ask.x-p.x,D.ask.z-p.z);
  if(d<D.r&&state.askCool!=='vault'&&(WALK.on||car.vel.lengthSq()<4)){openAsk('vault');return true}if(d>D.r+2.5&&state.askCool==='vault')state.askCool=null;return false}
function vaultEnter(){if(VT.on||VT.fade)return;vTap();
  try{if('speechSynthesis' in window){const u=new SpeechSynthesisUtterance(' ');u.volume=0;speechSynthesis.speak(u)}}catch(e){}   // iOS: the first speech must start inside a tap, and this runs in the JA tap. A silent one opens it up
  state.mode='vault';car.vel.set(0,0,0);car.w.set(0,0,0);car.throttle=0;setOffer(null);
  $('fade').classList.add('on');VT.fade={t:0,hold:.2,cb:()=>{VT.on=true;VT.out=false;$('hud').hidden=true;$('hint').hidden=true;$('vault').hidden=false;vReadBtn();vIntro()}}}
// VT.out: on the way out. Taps in the game are swallowed (see initVault) and nothing new is said, so Frøken Frø can't go on talking out on the island
function vaultExit(){if(VT.fade||!VT.on)return;VT.out=true;vStopVoice();$('fade').classList.add('on');
  VT.fade={t:0,hold:.2,cb:()=>{vStopVoice();VT.on=false;VT.out=false;$('vault').hidden=true;vStage().innerHTML='';state.mode='play';state.askCool='vault';showHud();camSnap=true;
    toast(vtProf().done?'🌱 Ut i kulda igjen, frøvokter!':'Ut i kulda igjen')}}}
function updateVault(dt){
  if(VT.fade){const f=VT.fade;f.t+=dt;if(f.t>.9&&!f.done){f.done=true;f.cb()}if(f.t>.9+f.hold){$('fade').classList.remove('on');VT.fade=null}}
  return VT.on}
function vaultKeyDown(k){if(!VT.on||VT.fade)return;
  if(k==='escape'){vaultExit();return}
  if(k==='r'){vAgain();return}
  if(/^[1-9]$/.test(k)){const b=[...vStage().querySelectorAll('[data-n]')].find(x=>x.dataset.n===k&&!x.disabled&&!x.closest('[hidden]'));if(b)b.click();else{const s=$('vtSeed');if(s&&k==='1')s.click()}}}

/* ---------- the sprout on the car: a little pot at the back, on every island once you are a seed keeper ---------- */
function vaultSprout(tm){if(typeof carVis==='undefined'||!carVis||!carVis.body||!prof.frohvelv||!prof.frohvelv.done)return;const b=carVis.body;let s=b.userData.vtSprout;
  if(!s){const L=(car&&car.cfg.L)||2,G=ANIMAL_GEO,leaf=amat('#6ac04a');s=new THREE.Group();
    apart(s,G.cyl,amat('#c8653a'),0,.05,0,.06,.1,.06).castShadow=false;apart(s,G.cyl,amat('#6b4a2a'),0,.1,0,.055,.01,.055);
    const top=new THREE.Group();top.position.y=.1;s.add(top);apart(top,G.cyl,amat('#3f8a2a'),0,.07,0,.008,.14,.008);
    for(const sd of[-1,1])apart(top,G.sph,leaf,sd*.03,.12,0,.035,.01,.018,0,0,sd*.4);apart(top,G.sph,amat('#f7c830'),0,.15,0,.022);
    // stand it on whatever is on top at the back left (the roof, the rack or the bed): a ray straight down through the body finds it
    const x=.2,z=-L/2+.32;b.updateMatrixWorld(true);const o=b.localToWorld(new THREE.Vector3(x,3,z)),d=b.localToWorld(new THREE.Vector3(x,2,z)).sub(o).normalize();
    const hit=new THREE.Raycaster(o,d).intersectObject(b,true).find(h=>h.object.visible&&h.object.isMesh);
    s.userData.top=top;s.scale.setScalar(1.4);s.position.set(x,hit?b.worldToLocal(hit.point.clone()).y:.3,z);b.add(s);b.userData.vtSprout=s}
  const sp=car?Math.min(1,car.vel.length()/4):0;s.userData.top.rotation.z=Math.sin(tm*(3+sp*7))*(.12+.2*sp);s.userData.top.rotation.x=-sp*.25}

function initVault(){$('vtFia').innerHTML=VT_FIA;
  {const n=document.createElement('p');n.id='vtNoVoice';n.className='vt-novoice';n.hidden=true;n.textContent='🔇 Ingen norsk stemme på denne enheten. Les høyt for barnet.';const V=$('vault');V.insertBefore(n,V.querySelector('.vt-main'));
    V.addEventListener('click',e=>{if(VT.out){e.stopPropagation();e.preventDefault()}},true)}   // capture: no button in here gets a tap while the screen fades out
  $('vtOut').onclick=()=>vaultExit();
  $('vtRead').onclick=()=>{vTap();const P=vtProf();P.read=vtRead()?0:1;saveProf();vReadBtn();if(vtRead())vAgain();else vStopVoice()};
  $('vtAgain').onclick=()=>{vTap();vAgain()};
  if('speechSynthesis' in window&&speechSynthesis.addEventListener)speechSynthesis.addEventListener('voiceschanged',()=>{if(VT.on)vReadBtn()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&VT.on)vStopVoice()})}
initVault();
