// Place-specific scenery only. Shared road, walls, progression and contact
// surfaces remain in the engine; the shuttle uses the same hazard pose as AI.
export default function buildWorld(context) {
  const {THREE, scene, scenery, track, kit, hazardAt, textures={}} = context;
  const {material,mesh,box,groupAt,sectorT,batch,align,asset} = kit;
  const steel=material('#344d68',{map:textures.metal??null,metalness:.42,roughness:.56});
  const concrete=material('#a2becb',{map:textures.concrete??null,roughness:.86});
  const amber=material('#f5ba66',{map:textures.metal??null,metalness:.2,roughness:.66});
  const masonry=material('#9c7687',{map:textures.brick??null,roughness:.9});
  const paleMasonry=material('#c5a2ab',{map:textures.brick??null,roughness:.9});
  const trim=material('#c4dde1',{map:textures.concrete??null,roughness:.78});
  const cyan=material('#76f0ed',{emissive:'#23bbbd',emissiveIntensity:1.15});
  const pink=material('#ff7dc8',{emissive:'#bd388c',emissiveIntensity:1});
  const blue=material('#708ad0',{map:textures.metal??null,metalness:.24,roughness:.65});
  const rust=material('#c78668',{map:textures.metal??null,metalness:.2,roughness:.72}), dark=material('#18283a');
  const cloth=material('#f9c1ba',{roughness:.96});
  const glass=material('#284c6a',{metalness:.35,roughness:.29});
  const window=material('#ffe4a0',{emissive:'#edac57',emissiveIntensity:.85});
  const skin=material('#edc5a7',{roughness:.88});
  const sphere=new THREE.SphereGeometry(1,10,6);
  const cylinder=new THREE.CylinderGeometry(1,1,1,10);
  const ring=new THREE.TorusGeometry(1.3,.14,5,14);
  const animated=[], ferries=[], craneHooks=[];
  const industrialModels=['building-a','building-e','building-m','building-q'];

  // Test the complete circumscribed footprint against every route segment.
  // Large buildings can otherwise overlap an adjacent street on an S-bend.
  function safeGroup(t,offset,radius) {
    const pose=track.poseAt(t*track.TRACK,offset,0);
    const p=track.projectTrack(pose.p,t*track.TRACK,true);
    const edge=p.offset>0?p.rightEdge:-p.leftEdge;
    if(p.distance<edge+radius+2) return null;
    return kit.landGroup ? kit.landGroup(t,offset,scenery) : groupAt(t,offset,scenery);
  }
  function building(t,offset,width,height,depth,index) {
    const g=safeGroup(t,offset,Math.hypot(width,depth)/2);
    if(!g)return;
    box(index%3?masonry:paleMasonry,g,[0,height/2,0],[width,height,depth]);
    // Light edge strips suggest chamfered corners and dressed masonry.
    for(const x of [-width/2+.14,width/2-.14])for(const z of [-depth/2+.14,depth/2-.14])
      box(trim,g,[x,height/2,z],[.28,height,.28]);
    for(const y of [1.4,Math.min(height-1,8),height-.35])
      box(trim,g,[0,y,0],[width+.4,.24,depth+.4]);
    box(dark,g,[0,height+.35,0],[width+1,.7,depth+1]);
    if(index%3===0) {
      box(concrete,g,[0,height+2.1,0],[width*.7,3.5,depth*.7]);
      box(blue,g,[0,height+4,0],[width*.75,.35,depth*.75]);
      box(cyan,g,[0,height+3.6,depth*.355],[width*.58,.25,.08]);
    } else if(index%3===1) {
      for(const side of [-1,1]) {
        const roof=box(blue,g,[side*width*.23,height+1.5,0],[width*.55,.35,depth*.96]);
        roof.rotation.z=side*-.27;
      }
    } else {
      mesh(cylinder,steel,g,[width*.18,height+2,0],[1.5,3.4,1.5]);
      box(amber,g,[-width*.23,height+1.3,-depth*.15],[2.5,1.8,2.5]);
      box(steel,g,[-width*.23,height+2.7,-depth*.15],[.2,1,.2]);
    }
    for(let row=0;row<Math.floor(height/4);row++) for(let col=0;col<Math.floor(width/3);col++) {
      if((row+col+index)%4===0)continue;
      for(const side of [-1,1]) {
        const x=-width/2+1.6+col*3,y=2+row*4,z=side*(depth/2+.08);
        box(glass,g,[x,y,z],[1.65,2.1,.08]);
        box(window,g,[x,y,z+side*.06],[1.24,1.65,.06]);
        box(trim,g,[x,y-1.12,z+side*.08],[1.85,.16,.22]);
        box(steel,g,[x,y,z+side*.1],[.08,1.85,.05]);
      }
    }
    box(index%3?cyan:pink,g,[0,Math.min(height-1,7),depth/2+.1],[width*.85,.25,.12]);
    // Street-level recessed storefront, canopy, ducts and fire-escape frames
    // distinguish the facade from a stack of repeated glowing rectangles.
    box(dark,g,[0,1.9,depth/2+.07],[width*.65,3.3,.13]);
    box(glass,g,[0,1.9,depth/2+.17],[width*.59,2.9,.08]);
    box(index%2?cyan:window,g,[0,3.5,depth/2+.2],[width*.62,.12,.12]);
    for(const x of [-width*.21,0,width*.21])box(trim,g,[x,1.9,depth/2+.23],[.12,3.2,.1]);
    const canopy=box(index%2?blue:cloth,g,[0,3.9,depth/2+.8],[width*.72,.16,1.7]);canopy.rotation.x=.1;
    for(let floor=0;floor<Math.floor(height/7);floor++) {
      box(steel,g,[width/2+.65,4+floor*6,0],[1.4,.17,depth*.55]);
      box(steel,g,[width/2+1.26,4.8+floor*6,0],[.1,1.5,depth*.55]);
      box(amber,g,[width/2+.08,4.8+floor*6,-depth*.3],[.22,1.2,.6]);
    }
    box(steel,g,[-width*.27,height+1.1,depth*.22],[2.2,1.6,2.7]);
    for(let j=0;j<4;j++)box(trim,g,[-width*.27,height+1.95,depth*.08+j*.27],[2,.08,.1]);
    // Shape-only luminous rooftop symbol; no roadside text is needed.
    const emblem=mesh(ring,index%2?pink:cyan,g,[0,height+3.5,depth*.3]);
    box(steel,g,[0,height+1.6,depth*.3],[.15,3,.15]);
    emblem.rotation.z=index*.27;
    batch(g);
  }
  // The industrial kit's factory silhouettes add authored roof shapes and
  // window color breakup to the port skyline. Fit each source mesh to the
  // established scenery footprint so camera clearance and road splines stay
  // under course control.
  function industrialBuilding(t,offset,width,height,depth,index) {
    const g=safeGroup(t,offset,Math.hypot(width,depth)/2);
    if(!g||!asset)return null;
    const model=industrialModels[Math.abs(index)%industrialModels.length];
    const imported=asset(`kenney:city-kit-industrial/${model}`,g,[0,0,0],[width,height,depth]);
    if(imported)batch(g);
    return imported;
  }
  function lamp(t,offset,index) {
    const g=safeGroup(t,offset,1.3);if(!g)return;
    box(steel,g,[0,4.5,0],[.22,9,.22]);
    box(steel,g,[-Math.sign(offset)*.65,8.8,0],[1.4,.18,.2]);
    box(index%2?cyan:window,g,[-Math.sign(offset)*1.1,8.65,0],[.7,.18,.55]);
  }
  // Promenade: waterfront lamps and a city skyline, with open sightlines.
  for(let i=0;i<20;i++) {
    const t=sectorT(0,(i+.5)/20);lamp(t,-13,i);
    if(i%4===0)industrialBuilding(t,25+(i%3)*9,14,21+(i%5)*3,10,i);
    else if(i%2===0)building(t,25+(i%3)*9,12,18+(i%5)*6,12,i);
    const g=safeGroup(t,-19,2.5);
    if(g){
      if(i%3===0&&asset) {
        box(concrete,g,[0,.55,0],[3,1.1,3]);
        box(dark,g,[0,1.12,0],[2.75,.08,2.75]);
        asset('pine',g,[0,1.16,0],[3,5,3]);
      } else {box(concrete,g,[0,.4,0],[4,.8,1.2]);box(steel,g,[0,1.3,.4],[4,.18,.15]);}
    }
  }

  // Market compresses into two color districts with freestanding stalls.
  // Awnings remain outside the road; street banners clear the camera by 13 m.
  for(let i=0;i<18;i++) {
    const t=sectorT(1,(i+.5)/18),side=i%2?1:-1;
    building(t,side*(23+(i%3)*3),10,13+(i%4)*3,10,i+20);
    const g=safeGroup(t,side*14,3.2);if(!g)continue;
    box(rust,g,[0,1,0],[4.5,2,3]);
    for(const x of [-2,2])box(steel,g,[x,3,0],[.12,4,.12]);
    box(cloth,g,[0,4.5,0],[5.2,.24,3.4]);
    for(let stripe=0;stripe<7;stripe++) {
      const x=-2.25+stripe*.75;
      box(i%2?pink:cyan,g,[x,4.65,0],[.36,.06,3.4]);
      box(i%2?pink:cyan,g,[x,4.23,1.68],[.55,.45,.08]);
    }
    for(const x of [-1.7,1.7]) {
      box(steel,g,[x,4.05,0],[.07,.6,.07]);
      mesh(sphere,window,g,[x,3.6,0],[.28,.4,.28]);
    }
    box(trim,g,[0,2.08,0],[4.7,.2,3.1]);
    for(let j=0;j<4;j++) {
      const x=-1.5+j;
      box(steel,g,[x,2.3,.3],[.85,.45,1.35]);
      for(let k=0;k<3;k++)mesh(sphere,j%2?amber:pink,g,[x+(k-1)*.2,2.59,.22+k*.23],[.15,.16,.15]);
    }
    for(const z of [-.85,.85])box(amber,g,[2.1,.5,z],[.5,.95,.9]);
    box(steel,g,[-1.3,.4,-2],[1.2,.8,.9]);
    mesh(cylinder,dark,g,[1.7,.65,-2.2],[.48,1.3,.48]);
  }
  for(const f of [.22,.67]) {
    const g=groupAt(sectorT(1,f),0,scenery);
    box(pink,g,[0,13.4,0],[24,.28,.3]);
    for(let i=0;i<7;i++)box(i%2?cyan:pink,g,[-9+i*3,13,0],[1.1,.6,.08]);
  }

  // A short loading hall, rather than a full-sector tunnel. Wide sidewalls
  // leave the curved route and trailing camera room; overhead begins at 13 m.
  const hall=groupAt(sectorT(2,.40),0,scenery);
  for(const side of [-1,1]) {
    box(steel,hall,[side*15,6.5,0],[2,13,30]);
    for(const z of [-14,0,14])box(concrete,hall,[side*13.7,6.5,z],[.6,13,.6]);
    box(amber,hall,[side*13.45,3,0],[.08,.3,28]);
  }
  box(steel,hall,[0,13.6,0],[32,1.2,30]);
  for(const z of [-14,0,14])box(concrete,hall,[0,13.4,z],[28,.8,.5]);
  for(const x of [-7,7])box(window,hall,[x,13.05,0],[.3,.08,25]);
  batch(hall);
  for(let i=0;i<10;i++) {
    const t=sectorT(2,.12+i*.075),g=safeGroup(t,(i%2?1:-1)*23,4.5);if(!g)continue;
    box(i%2?rust:blue,g,[0,2,0],[6,4,5]);
    for(const x of [-2,0,2])box(amber,g,[x,2,2.53],[.1,4,.06]);
    box(steel,g,[0,.12,0],[6.15,.24,5.15]);
    box(trim,g,[0,4.08,0],[6.15,.16,5.15]);
  }
  // A few compact factory blocks and tank details turn the loading hall into
  // an active industrial district while retaining the hall's road clearance.
  for(let i=0;i<6;i++) {
    const t=sectorT(2,.18+i*.12),side=i%2?1:-1;
    industrialBuilding(t,side*34,12,12,11,i+2);
    const utility=safeGroup(t,side*47,3.2);if(!utility||!asset)continue;
    const tank=asset('kenney:city-kit-industrial/detail-tank',utility,[0,0,0],[4.4,4.4,4.4]);
    if(tank){tank.rotation.y=i*.73;batch(utility);}
    if(i%2===0) {
      const stackGroup=safeGroup(t,side*41,1.8);
      const stack=stackGroup&&asset('kenney:city-kit-industrial/chimney-large',stackGroup,[0,0,0],[2.4,9,2.4]);
      if(stack)batch(stackGroup);
    }
  }

  // Supported deck: no embankment under the declared elevated arc. Supports
  // are below the shared continuous road, never decorative road obstacles.
  for(let i=0;i<20;i++) {
    const t=sectorT(3,.04+.84*i/19),g=groupAt(t,0,scenery);
    const height=Math.max(3,track.frameAt(t).p.y+1.7);
    box(concrete,g,[0,-.5,0],[17.5,.9,1.4]);
    for(const x of [-6,6])box(steel,g,[x,-height/2-.3,0],[1,height,1]);
    box(steel,g,[0,-2,0],[13,.6,.7]);
    for(const side of [-1,1]) {const brace=box(amber,g,[side*4,-4,0],[.35,5,.35]);brace.rotation.z=side*-.5;}
    if(i%2===0)lamp(t,12,i);
  }
  // Water sits below the panorama, on the outside/south of the quay. Ships
  // and cranes sit beyond route footprints rather than becoming obstacles.
  const harborPose=track.poseAt(sectorT(3,.48)*track.TRACK,-90,0);
  const waterMaterial=material('#1b657d',{map:textures.water??null,metalness:.42,roughness:.19,
    emissive:'#0b3549',emissiveIntensity:.2});
  const water=mesh(new THREE.PlaneGeometry(370,125),waterMaterial,scenery,
    [harborPose.p.x,-1.48,harborPose.p.z]);
  water.rotation.x=-Math.PI/2;water.castShadow=false;
  const waterUV=water.geometry.attributes.uv;
  for(let i=0;i<waterUV.count;i++)waterUV.setXY(i,waterUV.getX(i)*18,waterUV.getY(i)*6);
  animated.push(water);
  for(let i=0;i<3;i++) {
    const t=sectorT(3,.21+i*.26),g=safeGroup(t,-58-i*13,20);if(!g)continue;
    g.position.y=-1.1;
    box(steel,g,[0,2,0],[12,4,34]);
    box(rust,g,[0,4.2,-2],[10,1.2,27]);
    box(concrete,g,[0,7,10],[8,5,9]);
    box(window,g,[0,8.3,14.55],[7,.7,.08]);
    for(let j=0;j<4;j++)box(j%2?rust:blue,g,[0,6,-11+j*5],[9,3.5,4]);
    box(steel,g,[0,12,10],[.4,8,.4]);
    for(const x of [-5.6,5.6])box(trim,g,[x,4.4,0],[.12,.22,29]);
    for(const z of [-10,-3,4])mesh(cylinder,steel,g,[6.1,2.5,z],[.6,.35,.6]);
    mesh(cylinder,amber,g,[0,10,10],[.8,2,.8]);batch(g);
    animated.push(g);ferries.push({g,x:g.position.x,z:g.position.z,phase:i*2.1});
  }
  for(let i=0;i<4;i++) {
    const t=sectorT(3,.13+i*.22),g=safeGroup(t,-35,10);if(!g)continue;
    g.position.y=-1.1;
    for(const x of [-4,4])box(amber,g,[x,14,0],[1,28,1]);
    box(amber,g,[0,28,0],[10,1,1]);
    box(amber,g,[0,27,8],[1,1,20]);
    for(const side of [-1,1]) {const brace=box(steel,g,[side*2,20,0],[.35,14,.35]);brace.rotation.z=side*.29;}
    for(let j=0;j<5;j++)box(steel,g,[0,27,1+j*3.1],[3,.25,.3]);
    box(cyan,g,[0,28.7,0],[3,.15,1.1]);batch(g);
    // Hook assembly moves entirely over the water; it never sweeps the road.
    if(i%2===0) {
      const hook=groupAt(t,-35,scenery);hook.position.y=-1.1;
      const cable=box(steel,hook,[0,19,16],[.15,16,.15]);
      box(amber,hook,[0,10.4,16],[2.3,.55,1.2]);
      box(blue,hook,[0,8.5,16],[4,3,4]);
      batch(hook);animated.push(hook);craneHooks.push({g:hook,phase:i*1.3});
    } else box(steel,g,[0,19,16],[.15,16,.15]);
  }
  // Downloaded low-poly shoreline blocks break up the waterfront silhouette.
  if(asset)for(let i=0;i<12;i++) {
    const t=sectorT(3,.06+.85*i/12),g=safeGroup(t,-40-(i%3)*5,5);if(!g)continue;
    g.position.y=-1.2;
    const rock=asset(i%2?'rock-a':'rock-b',g,[0,0,0],[4+(i%3),2.5+(i%2),4]);
    rock.rotation.y=i*.7;
  }
  // Terminal: alternating tall container walls and an open crossing yard.
  for(let i=0;i<20;i++) {
    const t=sectorT(4,(i+.5)/20),side=i%2?1:-1;
    // Leave the moving shuttle's right-side parking bay clear.
    if(side>0&&i>7&&i<15)continue;
    const g=safeGroup(t,side*(20+(i%3)*4),6.5);if(!g)continue;
    for(let row=0;row<(i%3?2:1);row++) {
      box(i%2?blue:rust,g,[0,1.7+row*3.4,0],[5,3.3,11]);
      for(let k=0;k<5;k++)box(steel,g,[2.52,1.7+row*3.4,-4+k*2],[.04,3,.12]);
      for(const z of [-5.5,5.5]) {
        box(steel,g,[0,1.7+row*3.4,z],[.13,3.2,.08]);
        for(const x of [-2.1,2.1])box(trim,g,[x,1.7+row*3.4,z],[.13,2.7,.1]);
        box(amber,g,[0,.25+row*3.4,z],[4.7,.13,.11]);
      }
      for(const x of [-2.45,2.45])for(const z of [-5.45,5.45])
        box(steel,g,[x,1.7+row*3.4,z],[.12,3.35,.12]);
    }
    batch(g);
  }

  // Boulevard has a visible rough service apron inside its right-hand bend.
  // Skyline façades and palms of light line the finish without filling the cut.
  for(let i=0;i<20;i++) {
    const t=sectorT(5,(i+.5)/20),side=i%2?1:-1;
    const extra=side>0?track.shortcutWidth(t):0;
    lamp(t,side*(13+extra),i);
    if(i%6===0)industrialBuilding(t,side*(28+extra),14,21+(i%4)*3,10,i+40);
    else if(i%3===0)building(t,side*(28+extra),12,24+(i%4)*6,12,i+40);
  }
  for(const fraction of [.31,.47,.63]) {
    const t=sectorT(5,fraction),g=safeGroup(t,23+track.shortcutWidth(t),2);if(!g)continue;
    for(const z of [-.65,.65]) {const arm=box(cyan,g,[0,2,z],[2,.28,.28]);arm.rotation.y=z>0?-.6:.6;}
    box(steel,g,[0,1,0],[.18,2,.18]);
  }

  // Every district gets foreground street furniture and a readable urban
  // ground layer. These puddles live on sidewalks, never as a road blanket.
  const wet=material('#235368',{metalness:.64,roughness:.16,emissive:'#143346',emissiveIntensity:.2});
  const leaf=material('#527e70',{map:textures.leaves??null});
  const puddleGeometry=new THREE.CircleGeometry(1,16);
  for(let district=0;district<6;district++)for(let i=0;i<9;i++) {
    const t=sectorT(district,(i+.4)/9),side=i%2?-1:1;
    const edges=track.surfaceAt(t),offset=side*(side>0?edges.rightEdge:-edges.leftEdge);
    const g=safeGroup(t,offset+side*4.5,2.4);if(!g)continue;
    box(concrete,g,[0,.06,0],[3.7,.12,3.7]);
    for(const x of [-1.55,1.55])box(trim,g,[x,.14,0],[.2,.2,3.7]);
    const puddle=mesh(puddleGeometry,wet,g,[.2,.135,-.45],[1.45,.8,1]);
    puddle.rotation.x=-Math.PI/2;puddle.castShadow=false;
    if(i%3===0) {
      box(steel,g,[0,.5,0],[1.4,1,1.4]);
      for(let sprig=0;sprig<3;sprig++)mesh(sphere,leaf,g,[(sprig-1)*.36,1.3+(sprig%2)*.3,0],[.55,.65,.55]);
    } else if(i%3===1) {
      mesh(cylinder,dark,g,[-.8,.65,.5],[.36,1.3,.36]);
      box(steel,g,[.6,.6,.4],[1.5,.15,.8]);
      for(const x of [.1,1.1])box(steel,g,[x,.3,.4],[.12,.6,.7]);
    } else {
      // A parked delivery bicycle's wheel and frame silhouette.
      for(const z of [-.65,.65]) {
        const wheel=mesh(ring,dark,g,[.2,.55,z],[.4,.4,.4]);wheel.rotation.y=Math.PI/2;
      }
      const frame=box(cyan,g,[.2,.76,0],[.08,.08,1.25]);frame.rotation.x=.25;
      box(steel,g,[.2,.9,-.3],[.08,.72,.08]);
      box(steel,g,[.2,1.18,-.6],[.6,.08,.08]);
    }
  }

  // Delivery-lane entrances/rejoins are marked by paired low cyan lights.
  // The physical lane itself is rendered by the shared verge ribbon.
  for(const v of context.course.verges||[])for(const f of [v.startFraction+.015,v.endFraction-.015]) {
    const t=sectorT(v.section,f),s=track.surfaceAt(t);
    const edge=v.side>0?s.rightEdge:-s.leftEdge;
    const g=safeGroup(t,v.side*(edge+2.4),.8);if(!g)continue;
    box(steel,g,[0,.75,0],[.25,1.5,.25]);
    for(const z of [-.32,.32])box(cyan,g,[0,1.4,z],[.42,.12,.22]);
  }

  // The warehouse feels like a working loading hall: ducts, suspended
  // fixtures, doors, loading platforms and rails beyond the actual road.
  for(const side of [-1,1]) {
    for(const z of [-11,-4,4,11]) {
      box(glass,hall,[side*13.88,7,z],[.12,3.2,4]);
      box(amber,hall,[side*13.78,5.3,z],[.15,.17,4.3]);
    }
    for(const z of [-10,10])mesh(cylinder,steel,hall,[side*11.7,12.9,z],[.35,.5,.35]).rotation.z=Math.PI/2;
  }
  const loading=safeGroup(sectorT(2,.64),24,6);
  if(loading) {
    box(concrete,loading,[0,.65,0],[7,1.3,8]);
    for(const x of [-2,0,2])for(const z of [-2,2]) {
      box(rust,loading,[x,1.8,z],[1.5,2,1.5]);
      box(amber,loading,[x,1.8,z+.76],[.14,2,.08]);
      box(steel,loading,[x,2.1,z+.82],[1,.08,.08]);
    }
  }

  // A layered panorama beyond the race: small distant high-rises form a
  // coherent port skyline rather than repeating only roadside facades.
  for(let i=0;i<15;i++) {
    const t=sectorT(0,(i+.5)/15),offset=75+(i%3)*17;
    if(i%4===0||i%4===2)industrialBuilding(t,offset,16+(i%3)*3,24+(i%5)*5,12+(i%2)*2,i+60);
    else building(t,offset,12+(i%3)*5,30+(i%5)*10,13,i+60);
  }

  // Bounded animated city life. Instanced figures share just two draw calls.
  const people=[],personBody=new THREE.CylinderGeometry(.22,.29,.85,6);
  const crowdMaterial=material('#df9bc6',{emissive:'#592842',emissiveIntensity:.2});
  for(let i=0;i<18;i++) {
    const district=i<12?1:0,t=sectorT(district,.08+(i%12)*.075),side=i%2?1:-1;
    const s=track.surfaceAt(t),edge=side>0?s.rightEdge:-s.leftEdge;
    const g=safeGroup(t,side*(edge+6.6),1.4);if(!g)continue;
    people.push({p:g.position.clone(),q:g.quaternion.clone(),phase:i*1.9});
    scenery.remove(g);
  }
  const bodies=new THREE.InstancedMesh(personBody,crowdMaterial,people.length);
  const heads=new THREE.InstancedMesh(sphere,skin,people.length);
  bodies.frustumCulled=heads.frustumCulled=false;
  scenery.add(bodies,heads);animated.push(bodies,heads);
  const dummy=new THREE.Object3D();
  const rippleAxis=new THREE.Vector3(1,0,0);
  const coatColors=['#d987b9','#739bdd','#e0b764','#69b7aa'];
  for(let i=0;i<people.length;i++)bodies.setColorAt(i,new THREE.Color(coatColors[i%4]));

  // An understated intersection signal gives the market a daily rhythm.
  // Its colors are atmospheric only, with no compulsory stopping for racers.
  const signalRed=material('#a86670',{emissive:'#ff4763',emissiveIntensity:.4});
  const signalGreen=material('#6fa9a3',{emissive:'#4ee7c8',emissiveIntensity:.4});
  for(const [district,f] of [[0,.94],[1,.86],[5,.06]])for(const side of [-1,1]) {
    const t=sectorT(district,f),s=track.surfaceAt(t),edge=side>0?s.rightEdge:-s.leftEdge;
    const g=safeGroup(t,side*(edge+2.7),.8);if(!g)continue;
    box(steel,g,[0,3.8,0],[.18,7.6,.18]);
    box(dark,g,[0,7.4,0],[.7,2.1,.6]);
    mesh(sphere,signalRed,g,[0,8, .33],[.2,.2,.1]);
    mesh(sphere,amber,g,[0,7.4,.33],[.2,.2,.1]);
    mesh(sphere,signalGreen,g,[0,6.8,.33],[.2,.2,.1]);
  }

  // One small particle buffer carries steam from sidewalk vents and a
  // warehouse exhaust. The soft sprite is generated without canvas or DOM.
  const spriteBytes=new Uint8Array(32*32*4);
  for(let y=0;y<32;y++)for(let x=0;x<32;x++) {
    const k=(y*32+x)*4,r=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5);
    spriteBytes[k]=spriteBytes[k+1]=spriteBytes[k+2]=255;
    spriteBytes[k+3]=Math.round(Math.max(0,1-r)**2*170);
  }
  const smokeMap=new THREE.DataTexture(spriteBytes,32,32);smokeMap.needsUpdate=true;
  const vents=[];
  for(const [district,f,side] of [[0,.5,-1],[1,.2,1],[1,.84,-1],[2,.8,-1],[5,.86,1]]) {
    const t=sectorT(district,f),s=track.surfaceAt(t),edge=side>0?s.rightEdge:-s.leftEdge;
    const g=safeGroup(t,side*(edge+5),1.8);if(!g)continue;
    box(steel,g,[0,.18,0],[1.7,.3,1.1]);
    for(let j=0;j<6;j++)box(dark,g,[-.65+j*.25,.34,0],[.12,.04,.95]);
    vents.push(g.position.clone());
  }
  const steamPositions=new Float32Array(vents.length*9*3);
  const steamGeometry=new THREE.BufferGeometry();
  steamGeometry.setAttribute('position',new THREE.BufferAttribute(steamPositions,3));
  const steam=new THREE.Points(steamGeometry,new THREE.PointsMaterial({color:'#9fbed1',size:2.7,
    map:smokeMap,transparent:true,opacity:.38,depthWrite:false}));
  steam.frustumCulled=false;scenery.add(steam);animated.push(steam);

  // Cheap world-space moving highlights read as harbor ripples and distant
  // ferry wake. No overlapping full-water transparent layers are involved.
  const rippleMaterial=material('#418d9f',{emissive:'#397b96',emissiveIntensity:.28,roughness:.3});
  const ripples=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),rippleMaterial,45);
  scenery.add(ripples);animated.push(ripples);
  ripples.castShadow=false;ripples.frustumCulled=false;

  // The visual shuttle body matches the engine contact box (2.7 × 4.3 m).
  const shuttle=new THREE.Group();scene.add(shuttle);
  box(steel,shuttle,[0,.7,0],[2.7,1.1,4.3]);
  box(blue,shuttle,[0,1.6,-.7],[2.4,.8,2.5]);
  box(amber,shuttle,[0,1.55,1.35],[2.2,.8,1.25]);
  for(const x of [-1.1,1.1])for(const z of [-1.4,1.4]){
    const wheel=mesh(cylinder,dark,shuttle,[x,.35,z],[.38,.35,.38]);wheel.rotation.z=Math.PI/2;
  }
  box(glass,shuttle,[0,1.6,2.03],[2,.62,.09]);
  box(window,shuttle,[0,1.6,2.09],[1.8,.5,.06]);
  for(const x of [-.95,.95])box(cyan,shuttle,[x,.9,2.1],[.35,.18,.08]);
  for(const x of [-1.25,1.25])box(amber,shuttle,[x,.55,0],[.08,.18,3.8]);
  batch(shuttle);
  const warningMaterial=material('#ffc04e',{emissive:'#ff9a22',emissiveIntensity:0});
  const warning=groupAt(track.CART_T,15,scenery);
  box(steel,warning,[0,2.5,0],[.25,5,.25]);
  mesh(sphere,warningMaterial,warning,[0,5.2,0],[.48,.48,.48]);
  batch(scenery,animated);
  animated.push(shuttle);
  return {animated,update(time){
    const state=hazardAt(time);align(shuttle,state);
    warningMaterial.emissiveIntensity=state.warning?1.6+Math.sin(time*14)*.7:0;
    signalRed.emissiveIntensity=time%16<8?.2:1.15;
    signalGreen.emissiveIntensity=time%16<8?1.15:.2;
    for(const ferry of ferries) {
      ferry.g.position.y=-1.1+Math.sin(time*.8+ferry.phase)*.15;
      ferry.g.position.x=ferry.x+Math.sin(time*.09+ferry.phase)*.6;
      ferry.g.position.z=ferry.z+Math.cos(time*.11+ferry.phase)*.5;
      ferry.g.rotation.z=Math.sin(time*.7+ferry.phase)*.009;
    }
    for(const crane of craneHooks) {
      const scale=1+Math.sin(time*.36+crane.phase)*.11;
      crane.g.scale.y=scale;crane.g.position.y=-1.1+27*(1-scale);
    }
    for(let i=0;i<people.length;i++) {
      const person=people[i];dummy.position.copy(person.p);dummy.quaternion.copy(person.q);
      dummy.position.x+=Math.sin(time*.32+person.phase)*.4;
      dummy.position.y+=.8+Math.sin(time*2+person.phase)*.035;
      dummy.scale.set(1,1,1);dummy.updateMatrix();bodies.setMatrixAt(i,dummy.matrix);
      dummy.position.y+=.7;dummy.scale.set(.24,.28,.24);dummy.updateMatrix();heads.setMatrixAt(i,dummy.matrix);
    }
    bodies.instanceMatrix.needsUpdate=heads.instanceMatrix.needsUpdate=true;
    for(let v=0;v<vents.length;v++)for(let j=0;j<9;j++) {
      const rise=(time*.7+j*.47+v*.8)%4.7,k=(v*9+j)*3,p=vents[v];
      steamPositions[k]=p.x+Math.sin(time*.38+j*1.7)*(.15+rise*.18);
      steamPositions[k+1]=p.y+.4+rise;steamPositions[k+2]=p.z+Math.cos(time*.3+j)*(.1+rise*.17);
    }
    steamGeometry.attributes.position.needsUpdate=true;
    for(let i=0;i<45;i++) {
      const x=(i*37.1)%340-170,z=(i*17.7)%110-55;
      dummy.position.set(harborPose.p.x+x+Math.sin(time*.4+i)*.8,-1.44,harborPose.p.z+z);
      dummy.quaternion.setFromAxisAngle(rippleAxis,-Math.PI/2);
      dummy.scale.set(2+Math.sin(time*.6+i)*.7,.08,1);dummy.updateMatrix();ripples.setMatrixAt(i,dummy.matrix);
    }
    ripples.instanceMatrix.needsUpdate=true;
  }};
}
