'use strict';
/* =================================================================
   FOLK: the small things that make the people in the game look like people.
   Everybody (the driver on foot and behind the wheel, the snowmobile rider, the skiers and the spectators, the pirates, the miners,
   the Bedouins and the boat drivers) gets the face from here: eyes with whites, eyebrows, a nose, a mouth, ears, hair and maybe a beard.
   The clothes get their details from here too: collars, buttons, pockets, cuffs, soles, stripes.
   Many small parts are baked into ONE mesh with vertex colours, so a whole face (or all the details of a jacket) is one draw call.
   A part is an array: [shape, colour, x, y, z, sx, sy, sz, rx, ry, rz]
     shape 'box' (sx, sy, sz are the full sizes), 'sph' (the radii), 'cyl' (sx and sz the radii, sy the height) or 'cap' (the upper half of a sphere)
   The parts are in the frame of what they are added to. Added to a bone (a unit box scaled between two joints, see bone() in js/ski.js)
   they are in the bone's own unit frame: y from −.5 at the first joint to +.5 at the second, x and z from −.5 to +.5 across it.
   Loaded after js/game.js (SHARED_GEO, M); the files that draw people come after it.
   ================================================================= */
const FOLK_MAT=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.75}),FOLK_FLAT=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,flatShading:true});
if(typeof M!=='undefined'){M.folk=FOLK_MAT;M.folkFlat=FOLK_FLAT}   // kept when a level is cleared (js/game.js keeps the materials in M)
const _folkBase={},_folkCache={};
function folkBase(k){return _folkBase[k]||(_folkBase[k]=(k==='sph'?new THREE.SphereGeometry(1,10,8):k==='cyl'?new THREE.CylinderGeometry(1,1,1,10):k==='cap'?new THREE.SphereGeometry(1,10,5,0,Math.PI*2,0,Math.PI/2):new THREE.BoxGeometry(1,1,1)).toNonIndexed())}
// a colour made darker (f<0) or lighter (f>0)
function folkShade(hex,f){const c=new THREE.Color(hex);if(f<0)c.multiplyScalar(1+f);else c.lerp(new THREE.Color(0xffffff),f);return '#'+c.getHexString()}
// the parts baked into one geometry with vertex colours
function folkGeo(parts){const pos=[],nrm=[],col=[],m4=new THREE.Matrix4(),nm=new THREE.Matrix3(),q=new THREE.Quaternion(),e=new THREE.Euler(),p=new THREE.Vector3(),s=new THREE.Vector3(),v=new THREE.Vector3(),cc=new THREE.Color();
  for(const a of parts){const g=folkBase(a[0]),P=g.attributes.position.array,N=g.attributes.normal.array,sx=a[5],sy=a[6]??sx,sz=a[7]??sx;
    e.set(a[8]||0,a[9]||0,a[10]||0);q.setFromEuler(e);m4.compose(p.set(a[2],a[3],a[4]),q,s.set(sx,sy,sz));nm.getNormalMatrix(m4);cc.set(a[1]).convertSRGBToLinear();
    for(let i=0;i<P.length;i+=3){v.set(P[i],P[i+1],P[i+2]).applyMatrix4(m4);pos.push(v.x,v.y,v.z);v.set(N[i],N[i+1],N[i+2]).applyMatrix3(nm).normalize();nrm.push(v.x,v.y,v.z);col.push(cc.r,cc.g,cc.b)}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nrm,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeBoundingSphere();return g}
// the parts as a mesh. key: a name to share the geometry under (the same parts are only baked once); flat: faceted like the animals and the pirates
function folkMesh(parts,key,flat){let g=key&&_folkCache[key];if(!g){g=folkGeo(parts);if(key){_folkCache[key]=g;if(typeof SHARED_GEO!=='undefined')SHARED_GEO.add(g)}}
  const m=new THREE.Mesh(g,flat?FOLK_FLAT:FOLK_MAT);m.castShadow=false;return m}
// … and added to a parent (a group, or a bone: see the top of the file)
function folkOn(parent,parts,key,flat){const m=folkMesh(parts,key,flat);parent.add(m);return m}

// a limb as a part: a cylinder of radius r from a to b ([x,y,z])
const _fq=new THREE.Quaternion(),_fe=new THREE.Euler(),_fd=new THREE.Vector3(),_fy=new THREE.Vector3(0,1,0);
function folkLimb(c,a,b,r){_fd.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);const L=_fd.length()||1e-4;_fe.setFromQuaternion(_fq.setFromUnitVectors(_fy,_fd.divideScalar(L)));return['cyl',c,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,r,L,r,_fe.x,_fe.y,_fe.z]}

/* ---------- the face ---------- */
// The parts of a face on a head that is a ball of radius 1 round the origin, looking along +z (+x is the person's left). Scale the mesh by the head's radius.
//   skin, hair (colour), eye (colour of the iris), dy (moves eyes, brows and nose down: for a cap or a hat low on the forehead)
//   style: 'none' (a helmet or a hood covers it), 'back' (what shows under a cap: the nape and the sideburns), 'backpony' (… and a ponytail), 'short', 'long', 'pony', 'bald' (a rim of hair)
//   eyes:false (goggles or a visor), brows:false, mouth:false, ears:false, patch (no eye on his left), smile, beard (colour), mous (colour),
//   stubble, shades (sunglasses), specs (round glasses), ring (an earring: its colour), freckles, neck (a neck down to the collar), lips (colour)
function folkFace(o={}){const P=[],skin=o.skin||'#d9a07a',hair=o.hair||'#3a2a1c',dy=o.dy||0,dk=folkShade(skin,-.14),S=(...a)=>P.push(a),Z=(x,y)=>Math.sqrt(Math.max(.2,1-x*x-y*y)),lips=o.lips||'#8a4a3c';
  const ey=.1+dy,by=.32+dy,ny=-.08+dy,my=-.47+dy*.5;
  for(const sx of[1,-1]){
    if(o.eyes!==false&&!o.shades&&!(o.patch&&sx>0)){const z=Z(.36,ey);S('sph','#f6f2ea',sx*.36,ey,z-.06,.17,.15,.1);S('sph',o.eye||'#2a1c14',sx*.365,ey,z,.095,.105,.06);S('sph','#ffffff',sx*.365+.03,ey+.04,z+.05,.028,.028,.015)}
    if(o.brows!==false&&!(o.patch&&sx>0))S('box',hair,sx*.37,by,Z(.37,by)+.03,.3,.065,.1,0,sx*.3,-sx*.16);
    if(o.ears!==false){S('sph',skin,sx*.97,-.02+dy*.5,-.02,.1,.2,.15);S('sph',dk,sx*1.0,-.02+dy*.5,.02,.05,.11,.07)}
    if(o.smile)S('box',lips,sx*.2,my+.04,Z(.2,my)-.02,.12,.055,.08,0,sx*.25,sx*.55);
    if(o.freckles)for(const[a,b]of[[.5,-.12],[.62,-.2],[.44,-.24]])S('sph','#b8794e',sx*a,b+dy,Z(a,b+dy)-.005,.03,.03,.012)}
  S('sph',dk,0,ny-.02,Z(0,ny)-.01,.12,.2,.16);S('sph',skin,0,ny+.01,Z(0,ny)+.005,.1,.17,.15);                     // the nose, and its shade
  if(o.mouth!==false)S('box',lips,0,my,Z(0,my)-.008,o.smile?.3:.34,.055,.08);
  if(o.shades){const z=Z(.36,ey);for(const sx of[1,-1]){S('box','#14120e',sx*.36,ey,z,.36,.22,.07,0,sx*.3,0);S('box','#14120e',sx*.86,ey+.02,z-.48,.05,.05,1.0)}S('box','#14120e',0,ey+.04,z+.06,.14,.05,.05)}
  if(o.specs){const z=Z(.36,ey)+.06;for(const sx of[1,-1])for(const[a,b,w,h]of[[0,.14,.3,.04],[0,-.14,.3,.04],[.15,0,.04,.3],[-.15,0,.04,.3]])S('box',o.specs,sx*.36+a,ey+b,z,w,h,.03);S('box',o.specs,0,ey+.02,z+.01,.14,.04,.03)}
  const st=o.style||'short';
  if(st==='back'||st==='bald'||st==='backpony'){S('sph',hair,0,-.22,-.42,.9,.56,.66);for(const sx of[1,-1])S('box',hair,sx*.9,-.02,.24,.14,.5,.3)}
  if(st==='short'||st==='long'||st==='pony'){S('sph',hair,0,.3,-.2,1.05,.84,1.0);for(const sx of[1,-1])S('box',hair,sx*.92,.02,.26,.14,.44,.28)}
  if(st==='long')S('sph',hair,0,-.55,-.5,.9,.95,.55);
  if(st==='pony'||st==='backpony'){S('sph',hair,0,-.1,-1.0,.2,.2,.2);S('sph',hair,0,-.55,-1.08,.17,.5,.17,.25)}
  if(o.beard){S('sph',o.beard,0,my-.27,.4,.7,.5,.56);for(const sx of[1,-1])S('box',o.beard,sx*.78,-.36,.36,.2,.5,.34)}
  if(o.mous||o.beard){const c=o.mous||o.beard;for(const sx of[1,-1])S('box',c,sx*.15,my+.14,Z(.15,my+.14)+.03,.3,.09,.1,0,sx*.2,-sx*.25)}
  if(o.stubble)S('sph',folkShade(skin,-.22),0,-.5,.34,.8,.5,.62);
  if(o.ring)S('sph',o.ring,.99,-.27,.0,.07,.09,.07);
  if(o.neck)S('cyl',dk,0,-1.02,-.06,.4,.6,.4);
  return P}
// the face as a mesh: scale it by the head's radius. extra: more parts in the same mesh (a badge on the cap, a strap); key: only needed with extra
function folkHead(o,extra,key,flat){return folkMesh(extra?folkFace(o).concat(extra):folkFace(o),'head:'+JSON.stringify(o)+(extra?'+'+key:''),flat)}

/* ---------- the driver (on foot in js/walker.js, behind the wheel in js/carmodel.js) ---------- */
const FOLK_DRIVER={style:'back',dy:-.22,neck:1,smile:1};
// on his cap, in head radii: the button on top, the badge in front and the strap behind
const FOLK_CAP=[['sph','#2a2826',0,1.17,0,.1,.05,.1],['box','#e3a62a',0,.6,.97,.3,.2,.05,-.5],['box','#2e2c2a',0,.22,-1.04,.5,.1,.06]];
// the navigator beside him: fair hair in a ponytail under the cap, and sunglasses
const FOLK_NAVIGATOR={style:'backpony',hair:'#c8963a',dy:-.22,neck:1,smile:1,shades:1,skin:'#e2ae88'};
// the shoulders of the two in the car, in the frame of the box they are (x and y across it, +z forward): the placket and buttons, the collar, a pocket; white: the navigator's shirt
const folkShirt=white=>{const a=white?'#cfcabc':'#22394f',b=white?'#ffffff':'#40658c';
  return[['box',a,0,-.04,.5,.09,.9,.05],...[-.3,.0,.28].map(y=>['sph',white?'#8a8478':'#e8e2d0',0,y,.54,.028,.035,.035]),['box',b,.17,.5,.25,.26,.14,.6],['box',b,-.17,.5,.25,.26,.14,.6],['box',b,0,.5,-.36,.6,.14,.36],
    ['box',a,.27,.1,.5,.26,.3,.05],['box',b,.27,.24,.51,.28,.08,.06]]};
