// Place-specific scenery only. Shared road, walls, progression and contact
// surfaces remain in the engine; the shuttle uses the same hazard pose as AI.
export default function buildWorld(context) {
  const {THREE, scene, scenery, track, kit, hazardAt, textures={}} = context;
  const {material,mesh,box,groupAt,sectorT,sign,batch,align,asset} = kit;
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
  const sphere=new THREE.SphereGeometry(1,10,6);
  const cylinder=new THREE.CylinderGeometry(1,1,1,10);

  // Test the complete circumscribed footprint against every route segment.
  // Large buildings can otherwise overlap an adjacent street on an S-bend.
  function safeGroup(t,offset,radius) {
    const pose=track.poseAt(t*track.TRACK,offset,0);
    const p=track.projectTrack(pose.p,t*track.TRACK,true);
    const edge=p.offset>0?p.rightEdge:-p.leftEdge;
    if(p.distance<edge+radius+2) return null;
    return groupAt(t,offset,scenery);
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
    batch(g);
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
    if(i%2===0)building(t,25+(i%3)*9,12,18+(i%5)*6,12,i);
    const g=safeGroup(t,-19,2.5);
    if(g){
      if(i%3===0&&asset) {
        box(concrete,g,[0,.55,0],[3,1.1,3]);
        box(dark,g,[0,1.12,0],[2.75,.08,2.75]);
        asset('pine',g,[0,1.16,0],[3,5,3]);
      } else {box(concrete,g,[0,.4,0],[4,.8,1.2]);box(steel,g,[0,1.3,.4],[4,.18,.15]);}
    }
  }
  sign(sectorT(0,.43),-18,'NEON HARBOR · NIGHT RACE','#7af1e6',10);

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
    for(let j=0;j<4;j++)mesh(sphere,j%2?amber:window,g,[-1.5+j,2.2,.6],[.3,.28,.3]);
  }
  for(const f of [.22,.67]) {
    const g=groupAt(sectorT(1,f),0,scenery);
    box(pink,g,[0,13.4,0],[24,.28,.3]);
    for(let i=0;i<7;i++)box(i%2?cyan:pink,g,[-9+i*3,13,0],[1.1,.6,.08]);
  }
  sign(sectorT(1,.16),-16,'NIGHT MARKET','#ff94cd',7);

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
  sign(sectorT(2,.63),-17,'QUAY ↑ SKYLINE VIEW','#8ad9ff',8);

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
  const waterMaterial=material('#1b657d',{metalness:.35,roughness:.24});
  const water=mesh(new THREE.PlaneGeometry(370,125),waterMaterial,scenery,
    [harborPose.p.x,-1.48,harborPose.p.z]);
  water.rotation.x=-Math.PI/2;water.castShadow=false;
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
  }
  for(let i=0;i<4;i++) {
    const t=sectorT(3,.13+i*.22),g=safeGroup(t,-35,10);if(!g)continue;
    g.position.y=-1.1;
    for(const x of [-4,4])box(amber,g,[x,14,0],[1,28,1]);
    box(amber,g,[0,28,0],[10,1,1]);
    box(amber,g,[0,27,8],[1,1,20]);
    box(steel,g,[0,19,16],[.15,16,.15]);
    for(const side of [-1,1]) {const brace=box(steel,g,[side*2,20,0],[.35,14,.35]);brace.rotation.z=side*.29;}
    for(let j=0;j<5;j++)box(steel,g,[0,27,1+j*3.1],[3,.25,.3]);
    box(cyan,g,[0,28.7,0],[3,.15,1.1]);batch(g);
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
  sign(sectorT(4,.39),-16,'CARGO CROSSING · KEEP LEFT','#ffd36c',10);

  // Boulevard has a visible rough service apron inside its right-hand bend.
  // Skyline façades and palms of light line the finish without filling the cut.
  for(let i=0;i<20;i++) {
    const t=sectorT(5,(i+.5)/20),side=i%2?1:-1;
    const extra=side>0?track.shortcutWidth(t):0;
    lamp(t,side*(13+extra),i);
    if(i%3===0)building(t,side*(28+extra),12,24+(i%4)*6,12,i+40);
  }
  sign(sectorT(5,.32),23,'BOOST → SERVICE APRON','#ffe7ad',8);
  for(const fraction of [.31,.47,.63]) {
    const t=sectorT(5,fraction),g=safeGroup(t,23+track.shortcutWidth(t),2);if(!g)continue;
    for(const z of [-.65,.65]) {const arm=box(cyan,g,[0,2,z],[2,.28,.28]);arm.rotation.y=z>0?-.6:.6;}
    box(steel,g,[0,1,0],[.18,2,.18]);
  }
  sign(sectorT(5,.18),-17,'← OUTSIDE TURBO','#7af1e6',7);

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
  batch(scenery);
  return {animated:[shuttle],update(time){
    const state=hazardAt(time);align(shuttle,state);
    warningMaterial.emissiveIntensity=state.warning?1.6+Math.sin(time*14)*.7:0;
  }};
}
