'use strict';
/* =================================================================
   AMBIENCE: jungle sounds made with WebAudio (no sound files)
   Insects, birds, the waterfall, the volcano's rumble, parrot squawks, monkey hoots and the boulder.
   A level turns it on with  ambience:'jungle'.  Volume follows def.zone (jungle → volcano) and distance to the waterfall.
   Loaded before game.js; uses game.js globals (AC, state, LV, camera, fxAnim, ZL) only inside functions, at run time.
   ================================================================= */
let AMB=null,birdT=2,insT=0;
function noiseBuf(ac,sec=2){const n=ac.sampleRate*sec,b=ac.createBuffer(1,n,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;return b}
function noiseSrc(ac,buf){const s=ac.createBufferSource();s.buffer=buf;s.loop=true;s.start();return s}
function initAmbience(){if(AMB||!AC)return;try{const ac=AC,buf=noiseBuf(ac);
  const master=ac.createGain();master.gain.value=0;master.connect(ac.destination);
  const mk=(type,freq,Q,g0)=>{const f=ac.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=Q;const g=ac.createGain();g.gain.value=g0;noiseSrc(ac,buf).connect(f);f.connect(g);g.connect(master);return{f,g}};
  const ins=mk('bandpass',4300,7,0);                 // cicadas: a narrow hiss …
  const trem=ac.createGain();trem.gain.value=.5;const lfo=ac.createOscillator();lfo.frequency.value=17;const lg=ac.createGain();lg.gain.value=.5;lfo.connect(lg);lg.connect(trem.gain);lfo.start();
  ins.g.disconnect();ins.g.connect(trem);trem.connect(master);ins.g.gain.value=1;ins.out=trem;      // … pulsing 17 times a second
  const wf=mk('lowpass',700,.7,0),wf2=mk('highpass',1800,.5,0);
  let wpan=null;try{wpan=ac.createStereoPanner();wf.g.disconnect();wf2.g.disconnect();wf.g.connect(wpan);wf2.g.connect(wpan);wpan.connect(master)}catch(e){}                                    // waterfall: a deep rush and a bright spray
  const rum=mk('lowpass',85,.8,0),hiss=mk('bandpass',2400,1.2,0);                                   // volcano: rumble and a hiss of steam
  const wind=mk('lowpass',380,.5,0);                                                                   // mountain: wind
  const waves=mk('lowpass',460,.6,0);                                                                  // beach: surf
  const city=mk('lowpass',160,.7,0),crowd=mk('bandpass',700,.9,0),gen=mk('bandpass',110,4,0);         // town: a low traffic hum; stadium: a murmur; building site: a generator
  AMB={ac,master,ins,trem,wf,wf2,rum,hiss,wind,waves,city,crowd,gen,wpan,frogT:0,hamT:0,cooT:4,hornT:30,bellT:60,siteT:2}}catch(e){AMB=null}}
function ambPan(x,z){if(!camera)return 0;const dx=x-camera.position.x,dz=z-camera.position.z,d=Math.hypot(dx,dz)||1;const e=camera.matrixWorld.elements;return Math.max(-1,Math.min(1,(dx*e[0]+dz*e[2])/d))}
function ambVoice(x,z,dist){if(!AMB)return null;const ac=AMB.ac,g=ac.createGain(),d=Math.hypot(x-camera.position.x,z-camera.position.z),vol=Math.max(0,1-d/dist);if(vol<=0||!(state.sound))return null;
  let out=g;try{const p=ac.createStereoPanner();p.pan.value=ambPan(x,z);g.connect(p);p.connect(AMB.master);out=g}catch(e){g.connect(AMB.master)}return{g,vol,t:ac.currentTime}}
// a parrot taking off
function ambSquawk(x,z){initAmbience();const v=ambVoice(x,z,28);if(!v)return;const ac=AMB.ac,o=ac.createOscillator();o.type='sawtooth';const f=ac.createBiquadFilter();f.type='bandpass';f.frequency.value=1600;f.Q.value=2;o.connect(f);f.connect(v.g);
  const t=v.t,n=2+Math.floor(Math.random()*2);for(let i=0;i<n;i++){const t0=t+i*.17;o.frequency.setValueAtTime(900+Math.random()*300,t0);o.frequency.linearRampToValueAtTime(1500,t0+.05);o.frequency.linearRampToValueAtTime(800,t0+.14);
    v.g.gain.setValueAtTime(0,t0);v.g.gain.linearRampToValueAtTime(.09*v.vol,t0+.02);v.g.gain.linearRampToValueAtTime(0,t0+.15)}o.start(t);o.stop(t+n*.17+.05)}
// a monkey calling
function ambHoot(x,z){initAmbience();const v=ambVoice(x,z,30);if(!v)return;const ac=AMB.ac,o=ac.createOscillator();o.type='triangle';o.connect(v.g);const t=v.t,n=2+Math.floor(Math.random()*3);
  for(let i=0;i<n;i++){const t0=t+i*.28;o.frequency.setValueAtTime(420,t0);o.frequency.exponentialRampToValueAtTime(760,t0+.1);o.frequency.exponentialRampToValueAtTime(380,t0+.25);
    v.g.gain.setValueAtTime(0,t0);v.g.gain.linearRampToValueAtTime(.11*v.vol,t0+.04);v.g.gain.linearRampToValueAtTime(0,t0+.26)}o.start(t);o.stop(t+n*.28+.05)}
// a bird somewhere in the trees
function ambChirp(){if(!AMB||!state.sound)return;const ac=AMB.ac,o=ac.createOscillator();o.type='sine';const g=ac.createGain();g.gain.value=0;let out=g;try{const p=ac.createStereoPanner();p.pan.value=Math.random()*2-1;g.connect(p);p.connect(AMB.master)}catch(e){g.connect(AMB.master)}
  o.connect(g);const t=ac.currentTime,base=1800+Math.random()*2200,n=2+Math.floor(Math.random()*4),vol=.025+Math.random()*.03;
  for(let i=0;i<n;i++){const t0=t+i*(.09+Math.random()*.08);o.frequency.setValueAtTime(base,t0);o.frequency.linearRampToValueAtTime(base*(1.25+Math.random()*.4),t0+.04);o.frequency.linearRampToValueAtTime(base*.9,t0+.08);
    g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(vol,t0+.015);g.gain.linearRampToValueAtTime(0,t0+.085)}o.start(t);o.stop(t+n*.17+.1)}
// a short rumble (the boulder)
function ambRumble(dur,vol){initAmbience();if(!AMB||!state.sound)return;try{const ac=AMB.ac,s=noiseSrc(ac,noiseBuf(ac,1)),f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=120;const g=ac.createGain(),t=ac.currentTime;
  vol*=state.volAmb/70;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.3);g.gain.setValueAtTime(vol,t+dur-.6);g.gain.linearRampToValueAtTime(0,t+dur);s.connect(f);f.connect(g);g.connect(ac.destination);s.stop(t+dur+.1)}catch(e){}}
function updateAmbience(dt){if(!AC||!LV)return;initAmbience();if(!AMB)return;const def=LEVELS[state.levelIdx],ac=AMB.ac,t=ac.currentTime,S_=(g,v)=>g.gain.setTargetAtTime(v,t,.25);
  const on=state.sound&&!!def.ambience&&(state.mode==='play'||state.mode==='menu'||state.mode==='pause'),vol=(state.mode==='play'?1:.45)*(state.volAmb/70);
  S_(AMB.master,on?vol:0);if(!on)return;
  const k=ZL.on?Math.max(0,ZL.k):0;                                                   // 0 = jungle, 1 = volcano/mountain
  // biome weights: a world gives them with def.biome(x,z); older levels only know jungle vs. the zone
  const B=def.biome?def.biome(car.pos.x,car.pos.z):{jungle:1-k,snow:k},jungle=B.jungle||0,snowW=B.snow||0,beach=B.beach||0,swamp=B.swamp||0,city=B.city||0,crowd=B.stadium||0,site=B.site||0;
  // town: traffic hum, a far-off horn now and then, pigeons cooing and the town-hall bell; stadium: a murmur; building site: generator and hammer blows
  S_(AMB.city.g,.07*city*(.8+.2*Math.sin(insT*.23)));S_(AMB.crowd.g,.05*crowd*(.7+.3*Math.sin(insT*.9)));S_(AMB.gen.g,.06*site);
  AMB.cooT-=dt;if(city>.3&&AMB.cooT<=0){AMB.cooT=3+Math.random()*7/city;ambCoo(car.pos.x+(Math.random()-.5)*10,car.pos.z+(Math.random()-.5)*10)}
  AMB.hornT-=dt;if(city>.2&&AMB.hornT<=0){AMB.hornT=25+Math.random()*30;ambCarHorn()}
  AMB.bellT-=dt;if(city>.2&&AMB.bellT<=0){AMB.bellT=110+Math.random()*60;ambBell(def.bellAt?def.bellAt[0]:car.pos.x,def.bellAt?def.bellAt[1]:car.pos.z)}
  AMB.siteT-=dt;if(site>.1&&AMB.siteT<=0){AMB.siteT=.6+Math.random()*(Math.random()<.4?3:.5);ambHammer(car.pos.x+(Math.random()-.5)*6,car.pos.z+(Math.random()-.5)*6)}
  const bp=def.basePos,baseW=bp?Math.max(0,1-Math.hypot(bp[0]-car.pos.x,bp[1]-car.pos.z)/16):0;
  // cicadas: louder in the jungle, swelling and fading
  insT+=dt;S_(AMB.ins.out,.028*jungle*(.6+.4*Math.sin(insT*.5)));
  // birds
  birdT-=dt*(0.4+jungle);if(birdT<=0){birdT=1.2+Math.random()*3.5;if(Math.random()<.85*jungle+.1)ambChirp()}
  // waterfall: by distance to the nearest fall
  // waterfall: you hear it from far away, it swells as you come closer and roars when you drive behind it
  let wv=0,wf=null;for(const f of fxAnim.falls){const d=Math.hypot(f.x-car.pos.x,f.z-car.pos.z),v=Math.pow(Math.max(0,1-d/34),2.2);if(v>wv){wv=v;wf=f}}
  S_(AMB.wf.g,.55*wv);S_(AMB.wf2.g,.09*wv);if(AMB.wpan&&wf)AMB.wpan.pan.setTargetAtTime(ambPan(wf.x,wf.z)*(1-wv*.7),t,.3);
  // volcano (only where the level has eruptions) or wind (def.wind): both grow with zone k
  const vol_=def.erupt?1:0;S_(AMB.rum.g,.16*k*vol_+(ERU.phase?.1:0));S_(AMB.hiss.g,.02*k*vol_);
  S_(AMB.wind.g,def.wind?.09*Math.max(snowW,(B.desert||0)*.7)*(.65+.35*Math.sin(insT*.41)+.15*Math.sin(insT*1.7)):0);   // wind over the snow, and over the sand in a desert
  // beach: surf swelling and fading
  S_(AMB.waves.g,.16*beach*(.55+.45*Math.sin(insT*.62)));
  // swamp: frogs; the base: hammer blows from the workshop
  AMB.frogT-=dt;if(swamp>.15&&AMB.frogT<=0){AMB.frogT=.25+Math.random()*1.4/swamp;ambFrog(car.pos.x+(Math.random()-.5)*14,car.pos.z+(Math.random()-.5)*14)}
  AMB.hamT-=dt;if(baseW>.05&&AMB.hamT<=0){AMB.hamT=.5+Math.random()*(Math.random()<.3?2.5:.4);ambHammer(bp[0],bp[1]+4)}}
// a frog croaking somewhere in the reeds
function ambFrog(x,z){const v=ambVoice(x,z,18);if(!v)return;const ac=AMB.ac,o=ac.createOscillator();o.type='sawtooth';const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=520;o.connect(f);f.connect(v.g);const t=v.t,f0=85+Math.random()*60;
  o.frequency.setValueAtTime(f0,t);o.frequency.linearRampToValueAtTime(f0*1.25,t+.12);o.frequency.linearRampToValueAtTime(f0*.9,t+.3);v.g.gain.setValueAtTime(0,t);v.g.gain.linearRampToValueAtTime(.07*v.vol,t+.03);v.g.gain.linearRampToValueAtTime(0,t+.32);o.start(t);o.stop(t+.35)}
// a caiman hissing as it slides into the river: a short burst of filtered noise
function ambHiss(x,z){initAmbience();const v=ambVoice(x,z,14);if(!v)return;const ac=AMB.ac,s=noiseSrc(ac,noiseBuf(ac,.8)),f=ac.createBiquadFilter();f.type='bandpass';f.frequency.value=3200;f.Q.value=.8;s.connect(f);f.connect(v.g);const t=v.t;
  v.g.gain.setValueAtTime(0,t);v.g.gain.linearRampToValueAtTime(.12*v.vol,t+.06);v.g.gain.exponentialRampToValueAtTime(.001,t+.7);s.stop(t+.75)}
// the jaguar: a low, rough growl (two detuned saws through a lowpass, with a rumble of noise)
function ambGrowl(x,z){initAmbience();const v=ambVoice(x,z,24);if(!v)return;const ac=AMB.ac,t=v.t,f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=380;f.connect(v.g);
  for(const d of[1,1.07]){const o=ac.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(62*d,t);o.frequency.linearRampToValueAtTime(48*d,t+1.1);o.connect(f);o.start(t);o.stop(t+1.25)}
  const s=noiseSrc(ac,noiseBuf(ac,1.3));s.connect(f);s.stop(t+1.25);v.g.gain.setValueAtTime(0,t);v.g.gain.linearRampToValueAtTime(.16*v.vol,t+.15);v.g.gain.setValueAtTime(.16*v.vol,t+.7);v.g.gain.linearRampToValueAtTime(0,t+1.2)}
// a pigeon cooing: two soft, low triangle notes with a wobble
function ambCoo(x,z){initAmbience();const v=ambVoice(x,z,16);if(!v)return;const ac=AMB.ac,o=ac.createOscillator();o.type='triangle';const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=900;o.connect(f);f.connect(v.g);const t=v.t;
  for(let i=0;i<2;i++){const t0=t+i*.42;o.frequency.setValueAtTime(380,t0);o.frequency.linearRampToValueAtTime(470,t0+.08);o.frequency.linearRampToValueAtTime(340,t0+.3);v.g.gain.setValueAtTime(0,t0);v.g.gain.linearRampToValueAtTime(.05*v.vol,t0+.04);v.g.gain.linearRampToValueAtTime(0,t0+.32)}o.start(t);o.stop(t+.9)}
// a car horn somewhere in the town, far away
function ambCarHorn(){if(!AMB||!state.sound)return;const ac=AMB.ac,g=ac.createGain(),t=ac.currentTime,vol=.025*(state.volAmb/70);g.gain.value=0;let out=g;try{const p=ac.createStereoPanner();p.pan.value=Math.random()*2-1;g.connect(p);p.connect(AMB.master)}catch(e){g.connect(AMB.master)}
  for(const fq of[440,554]){const o=ac.createOscillator();o.type='square';const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=1200;o.frequency.value=fq;o.connect(f);f.connect(g);o.start(t);o.stop(t+.5)}
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.03);g.gain.setValueAtTime(vol,t+.25);g.gain.linearRampToValueAtTime(0,t+.4)}
// the town-hall bell: a struck tone with two partials, rung a few times
function ambBell(x,z){initAmbience();const v=ambVoice(x,z,60);if(!v)return;const ac=AMB.ac,t=v.t,n=2+Math.floor(Math.random()*3);
  for(let i=0;i<n;i++){const t0=t+i*1.6;for(const[fq,a]of[[523,.07],[1319,.03],[2093,.012]]){const o=ac.createOscillator();o.type='sine';o.frequency.value=fq;const g=ac.createGain();o.connect(g);g.connect(v.g);g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(a,t0+.01);g.gain.exponentialRampToValueAtTime(.0005,t0+1.5);o.start(t0);o.stop(t0+1.55)}}
  v.g.gain.value=v.vol}
// a hammer on steel at the workshop
function ambHammer(x,z){const v=ambVoice(x,z,22);if(!v)return;const ac=AMB.ac,s=noiseSrc(ac,noiseBuf(ac,.2)),f=ac.createBiquadFilter();f.type='bandpass';f.frequency.value=2600+Math.random()*800;f.Q.value=6;s.connect(f);f.connect(v.g);const t=v.t;
  v.g.gain.setValueAtTime(.12*v.vol,t);v.g.gain.exponentialRampToValueAtTime(.001,t+.16);s.stop(t+.2)}
// a gull taking off, and the eagle's cry high above
function ambGull(x,z){initAmbience();const v=ambVoice(x,z,26);if(!v)return;const ac=AMB.ac,o=ac.createOscillator();o.type='triangle';o.connect(v.g);const t=v.t,n=1+Math.floor(Math.random()*3);
  for(let i=0;i<n;i++){const t0=t+i*.3;o.frequency.setValueAtTime(1500,t0);o.frequency.linearRampToValueAtTime(1100,t0+.08);o.frequency.linearRampToValueAtTime(800,t0+.24);v.g.gain.setValueAtTime(0,t0);v.g.gain.linearRampToValueAtTime(.06*v.vol,t0+.03);v.g.gain.linearRampToValueAtTime(0,t0+.25)}o.start(t);o.stop(t+n*.3+.05)}
function ambEagle(x,z){initAmbience();const v=ambVoice(x,z,40);if(!v)return;const ac=AMB.ac,o=ac.createOscillator();o.type='sine';o.connect(v.g);const t=v.t;
  o.frequency.setValueAtTime(2600,t);o.frequency.exponentialRampToValueAtTime(1900,t+.5);o.frequency.exponentialRampToValueAtTime(2300,t+.8);v.g.gain.setValueAtTime(0,t);v.g.gain.linearRampToValueAtTime(.05*v.vol,t+.08);v.g.gain.linearRampToValueAtTime(0,t+.85);o.start(t);o.stop(t+.9)}

// the ferry's horn: two deep tones
function ambHorn(x,z){initAmbience();if(!AMB||!state.sound)return;const ac=AMB.ac,g=ac.createGain(),t=ac.currentTime,vol=.18*(state.volAmb/70);g.gain.value=0;g.connect(ac.destination);
  for(const[f,t0,d]of[[110,0,.9],[165,0,.9],[110,1.2,1.4],[165,1.2,1.4]]){const o=ac.createOscillator();o.type='sawtooth';const fl=ac.createBiquadFilter();fl.type='lowpass';fl.frequency.value=420;o.frequency.value=f;o.connect(fl);fl.connect(g);o.start(t+t0);o.stop(t+t0+d+.1)}
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.08);g.gain.setValueAtTime(vol,t+.8);g.gain.linearRampToValueAtTime(0,t+.95);g.gain.setValueAtTime(0,t+1.2);g.gain.linearRampToValueAtTime(vol,t+1.3);g.gain.setValueAtTime(vol,t+2.4);g.gain.linearRampToValueAtTime(0,t+2.65)}

// the golden nuts: a soft ping when one is near, a chime when you take it
function ambPing(x,z,k){initAmbience();if(!AMB||!state.sound)return;const ac=AMB.ac,o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime,vol=(.012+.05*k)*(state.volAmb/70);o.type='sine';o.frequency.value=1320;o.connect(g);g.connect(ac.destination);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.35);o.start(t);o.stop(t+.4)}
function ambChime(x,z){initAmbience();if(!AMB||!state.sound)return;const ac=AMB.ac,t=ac.currentTime,vol=.09*(state.volAmb/70);
  [[880,0],[1108,.09],[1318,.18],[1760,.3]].forEach(([f,d])=>{const o=ac.createOscillator(),g=ac.createGain();o.type='triangle';o.frequency.value=f;o.connect(g);g.connect(ac.destination);g.gain.setValueAtTime(0,t+d);g.gain.linearRampToValueAtTime(vol,t+d+.02);g.gain.exponentialRampToValueAtTime(.0001,t+d+.8);o.start(t+d);o.stop(t+d+.85)})}

// the winch motor: a low electric whine under load while the rope pulls
let winchSnd=null;
function ambWinch(on){initAmbience();if(!AMB)return;const ac=AMB.ac;
  if(on&&!winchSnd){const o=ac.createOscillator(),o2=ac.createOscillator(),g=ac.createGain(),f=ac.createBiquadFilter();o.type='sawtooth';o2.type='square';o.frequency.value=95;o2.frequency.value=190;f.type='lowpass';f.frequency.value=700;g.gain.value=0;o.connect(f);o2.connect(f);f.connect(g);g.connect(ac.destination);o.start();o2.start();
    g.gain.setTargetAtTime(state.sound?.05*(state.volCar/70):0,ac.currentTime,.08);winchSnd={o,o2,g}}
  else if(!on&&winchSnd){const w=winchSnd;winchSnd=null;w.g.gain.setTargetAtTime(0,ac.currentTime,.1);setTimeout(()=>{try{w.o.stop();w.o2.stop()}catch(e){}},400)}}

// game feel: a thump when the car lands hard, a soft two-note chime through a gate
function ambThump(k){initAmbience();if(!AMB||!state.sound)return;const ac=AMB.ac,t=ac.currentTime,vol=.25*k*(state.volCar/70);const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.setValueAtTime(90,t);o.frequency.exponentialRampToValueAtTime(38,t+.18);o.connect(g);g.connect(ac.destination);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+.22);o.start(t);o.stop(t+.25);const s=noiseSrc(ac,noiseBuf(ac,.3)),f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=600;const g2=ac.createGain();s.connect(f);f.connect(g2);g2.connect(ac.destination);g2.gain.setValueAtTime(vol*.5,t);g2.gain.exponentialRampToValueAtTime(.001,t+.15);s.stop(t+.2)}
function ambGate(){initAmbience();if(!AMB||!state.sound)return;const ac=AMB.ac,t=ac.currentTime,vol=.06*(state.volAmb/70);[[660,0],[990,.08]].forEach(([fq,d])=>{const o=ac.createOscillator(),g=ac.createGain();o.type='triangle';o.frequency.value=fq;o.connect(g);g.connect(ac.destination);g.gain.setValueAtTime(0,t+d);g.gain.linearRampToValueAtTime(vol,t+d+.015);g.gain.exponentialRampToValueAtTime(.0001,t+d+.3);o.start(t+d);o.stop(t+d+.32)})}
