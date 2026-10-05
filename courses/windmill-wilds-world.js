// Original countryside dressing. Static parts are batched by course-world;
// wind, animals, visitors, boats and machinery share the race animation clock.
export default function buildWindmillLife(context) {
  const { THREE, scene, scenery, track, kit, textures = {} } = context;
  const { mesh, box, material, sectorT } = kit;
  let seed = 47191;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const animated = [], flags = [], arms = [], butterflies = [], boats = [], birds = [];
  const wood = material('#c59b62', { map: textures.wood ?? null });
  const dark = material('#72533b', { map: textures.wood ?? null });
  const cream = material('#fff0cd'), coral = material('#ec785b'), butter = material('#edc765');
  const mint = material('#82bb9a'), navy = material('#537f9c'), skin = material('#eac297');
  const leaf = material('#669766', { map: textures.leaves ?? null });
  const moss = material('#8fa369'), grass = material('#7eae59'), deep = material('#386859');
  const stone = material('#b6b4a0', { map: textures.rock ?? null });
  const paleStone = material('#d5ccad', { map: textures.rock ?? null });
  const fruit = material('#e98353'), blossom = material('#ffccbf');
  const steel = material('#7c918d', { metalness: .25, roughness: .55 });
  const sphere = new THREE.SphereGeometry(1, 10, 6);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const disc = new THREE.CylinderGeometry(1, 1, 1, 12);
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const cone = new THREE.ConeGeometry(1, 1, 8);
  const torus = new THREE.TorusGeometry(1, .1, 5, 14);
  const leafGeometry = new THREE.BufferGeometry();
  leafGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, .24,.02,-.35, 0,.04,-1, -.24,.02,-.35], 3));
  leafGeometry.setIndex([0,1,2,0,2,3]); leafGeometry.computeVertexNormals();
  const fernMat = deep.clone(); fernMat.side = THREE.DoubleSide;

  function ground(t, offset, radius = 1, parent = scenery) {
    const frame = track.poseAt(t * track.TRACK, offset, 0);
    const near = track.projectTrack(frame.p, t * track.TRACK, true);
    const edge = near.offset > 0 ? near.rightEdge : -near.leftEdge;
    if (near.distance < edge + radius + 1) return null;
    const g = new THREE.Group();
    const blend = THREE.MathUtils.smoothstep(near.distance - edge, 0, 38);
    g.position.set(frame.p.x, THREE.MathUtils.lerp(near.height - .12, -1.7, blend), frame.p.z);
    g.rotation.y = Math.atan2(-frame.tangent.x, -frame.tangent.z);
    parent.add(g); return g;
  }
  const roadside = (section, f, side, clearance = 4, radius = 1, parent = scenery) => {
    const t = sectorT(section, f), s = track.surfaceAt(t);
    return ground(t, side * ((side > 0 ? s.rightEdge : -s.leftEdge) + clearance), radius, parent);
  };
  const animate = g => { if (g) animated.push(g); return g; };
  function beam(parent, a, b, thickness = .15, mat = wood) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const m = mesh(cylinder, mat, parent, start.clone().add(end).multiplyScalar(.5).toArray(), [thickness, start.distanceTo(end), thickness]);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), end.sub(start).normalize());
    return m;
  }
  function flag(parent, x, y, z, color = coral, length = 1.7) {
    const g = new THREE.Group(); g.position.set(x,y,z); parent.add(g); animate(g);
    const geo = new THREE.PlaneGeometry(length, .8, 7, 2); geo.translate(length / 2, 0, 0);
    const m = color.clone(); m.side = THREE.DoubleSide;
    const cloth = mesh(geo, m, g); cloth.castShadow = false;
    const rest = Float32Array.from(geo.attributes.position.array);
    flags.push({geo, rest, phase: random() * 6, length}); return g;
  }
  function pennantLine(parent, a, b, count = 8) {
    beam(parent,a,b,.04,dark);
    for(let i=0;i<count;i++) {
      const f=(i+.5)/count;
      const g=new THREE.Group(); g.position.set(THREE.MathUtils.lerp(a[0],b[0],f),THREE.MathUtils.lerp(a[1],b[1],f)-.25,THREE.MathUtils.lerp(a[2],b[2],f));
      parent.add(g); const m=mesh(cone,[coral,butter,mint,cream][i%4],g,[0,-.3,0],[.3,.6,.06]); m.rotation.z=Math.PI;
    }
  }
  function crate(parent,x,y,z,produce=true) {
    box(dark,parent,[x,y+.5,z],[1.7,.95,1.25]);
    for(const side of [-1,1])for(let row=0;row<3;row++)box(wood,parent,[x,y+.2+row*.28,z+side*.65],[1.8,.18,.09]);
    for(const side of [-1,1])box(wood,parent,[x+side*.84,y+.47,z],[.1,.95,1.4]);
    if(produce)for(let i=0;i<8;i++)mesh(sphere,i%3?fruit:butter,parent,[x-.57+i%4*.37,y+1.05,z-.25+Math.floor(i/4)*.5],[.21,.2,.21]);
  }
  function tent(section,f,side,color=coral,size=1) {
    const g=roadside(section,f,side,13,5.7);if(!g)return;
    g.name='Striped country fair stall';g.scale.setScalar(size);
    for(const x of [-3,3])for(const z of [-2.4,2.4])box(wood,g,[x,2,z],[.15,4,.15]);
    for(let i=0;i<10;i++) {
      const x=-3.15+(i+.5)*.63;
      for(const sign of [-1,1]) {const roof=box(i%2?cream:color,g,[x,4.6,sign*1.3],[.63,.13,2.95]);roof.rotation.x=sign*.38;}
      box(i%2?cream:color,g,[x,3.8,2.6],[.63,.65,.09]);
    }
    box(dark,g,[0,1.2,1.7],[5.4,.18,1.4]);
    for(let i=0;i<6;i++)box(i%2?color:cream,g,[-2.2+i*.88,.57,2.3],[.85,1.1,.12]);
    crate(g,-1.5,1.3,1.7);crate(g,1.2,1.3,1.7);
    box(cream,g,[0,1.3,-1.9],[4.8,2.5,.1]);
    for(const side of [-1,1])beam(g,[side*3,3.9,2.5],[side*4.5,.1,3.4],.025,dark);
    flag(g,0,5.35,0,color,2);
  }
  function visitor(parent,x,y,z,index) {
    const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
    const color=[coral,mint,navy,butter][index%4];
    mesh(sphere,color,g,[0,.7,0],[.33,.48,.28]);
    for(const side of [-1,1])box(dark,g,[side*.13,.2,0],[.17,.42,.18]);
    mesh(sphere,skin,g,[0,1.34,0],[.26,.28,.26]);
    mesh(disc,color,g,[0,1.55,0],[.37,.08,.34]);
    mesh(sphere,color,g,[0,1.61,0],[.24,.15,.24]);
    for(const side of [-1,1]) {
      const arm=new THREE.Group();arm.position.set(side*.3,1.02,0);g.add(arm);
      box(color,arm,[side*.1,-.14,0],[.16,.4,.18]);
      mesh(sphere,skin,arm,[side*.1,-.4,0],[.12,.12,.12]);
      if(index%3===0){animate(arm);arms.push({g:arm,side,phase:index*.7});}
      else arm.rotation.z=side*.18;
    }
  }
  // Meadow opens as a country fair rather than another row of generic trees.
  for(const [f,side,color,size]of [[.13,-1,coral,1.15],[.27,1,butter,1],[.36,-1,mint,1],[.77,1,coral,1.1],[.84,-1,navy,.9]])tent(0,f,side,color,size);
  for(const side of [-1,1]) {
    const g=roadside(0,.055,side,10,6);if(!g)continue;g.name='Festival viewing terrace';
    for(let row=0;row<3;row++) {
      box(wood,g,[0,.35+row*.55,row*1.3],[11,.3,1.2]);
      for(let col=0;col<9;col++)visitor(g,-4.3+col*1.05,.55+row*.55,row*1.3,(col+row*3));
    }
    for(const x of [-5.5,5.5])box(wood,g,[x,2.8,3.6],[.13,5.6,.13]);
    pennantLine(g,[-5.5,5.5,3.6],[5.5,5.5,3.6],12);
  }
  const welcome=kit.groupAt(sectorT(0,.025),0,scenery);welcome.name='High festival welcome arch';
  const half=track.roadHalfWidth(sectorT(0,.025))+4;
  for(const side of [-1,1]) {
    box(wood,welcome,[side*half,6.8,0],[.65,13.6,.65]);
    box(cream,welcome,[side*half,1,0],[1.1,2,1.1]);
    flag(welcome,side*half,14.2,0,side<0?coral:mint,2.2);
  }
  beam(welcome,[-half,13.4,0],[half,13.4,0],.2);
  pennantLine(welcome,[-half,13.2,0],[half,13.2,0],22);
  // Meadow cut is visually edged by isolated tall pennants, not obstacles.
  for(const f of [.405,.715]) {
    const g=roadside(0,f,1,3,1);if(!g)continue;
    box(wood,g,[0,2.3,0],[.16,4.6,.16]);flag(g,0,4.2,0,butter,2.1);
    mesh(disc,cream,g,[0,.09,0],[1.2,.15,1.2]);
  }
  for(let i=0;i<95;i++) {
    const section=i<60?0:5,side=i%2?1:-1,f=.08+random()*.86;
    const g=roadside(section,f,side,2.5+random()*7,.7);if(!g)continue;
    for(let j=0;j<8;j++) {
      const x=random()*2-1,z=random()*2-1,h=.22+random()*.35;
      box(grass,g,[x,h/2,z],[.04,h,.04]);
      if(j%2===0) {
        mesh(sphere,j%3?blossom:butter,g,[x,h,z],[.18,.07,.18]);
        mesh(sphere,cream,g,[x,h+.035,z],[.055,.055,.055]);
      }
    }
  }
  const pasture=roadside(0,.55,-1,30,10);
  if(pasture) {
    pasture.name='Sheep pasture';
    for(let i=0;i<7;i++) {
      const x=i%4*3-4,z=Math.floor(i/4)*4;
      mesh(sphere,cream,pasture,[x,.9,z],[1.05,.7,.6]);
      mesh(sphere,cream,pasture,[x+.75,1.2,z],[.47,.42,.42]);
      mesh(sphere,dark,pasture,[x+1.02,1.14,z],[.25,.24,.27]);
      for(const sx of [-1,1])for(const sz of [-1,1])box(dark,pasture,[x+sx*.6,.3,z+sz*.3],[.13,.6,.13]);
    }
    for(let i=0;i<9;i++)box(wood,pasture,[-13+i*3,1,-5],[.17,2,.17]);
    for(const y of [.65,1.45])box(cream,pasture,[-1,y,-5],[24,.12,.1]);
  }
  // Forest floor has authored understory islands and fallen timber.
  for(let i=0;i<60;i++) {
    const g=roadside(1,.03+random()*.94,i%2?1:-1,2.5+random()*11,1.6);if(!g)continue;
    mesh(rockGeo,moss,g,[0,.17,0],[1.4,.3,1]);
    for(let j=0;j<7;j++) {
      const frond=mesh(leafGeometry,fernMat,g,[0,.28,0],[1.2,1.2,1.8]);
      frond.rotation.y=j*Math.PI*2/7;frond.rotation.x=-.6-random()*.35;
    }
    for(let j=0;j<3;j++) {
      const x=1+random(),z=random()-.5;
      mesh(cylinder,cream,g,[x,.25,z],[.07,.5,.07]);
      mesh(sphere,j%2?coral:butter,g,[x,.48,z],[.28,.15,.28]);
    }
  }
  for(const [f,side]of [[.16,1],[.39,-1],[.71,1],[.88,-1]]) {
    const g=roadside(1,f,side,8,4);if(!g)continue;g.name='Mossy fallen log';g.rotation.y+=.6;
    mesh(cylinder,dark,g,[0,.6,0],[.6,7,.6]).rotation.z=Math.PI/2;
    for(const sign of [-1,1])mesh(disc,wood,g,[sign*3.52,.6,0],[.5,.035,.5]).rotation.z=Math.PI/2;
    for(let i=0;i<6;i++)mesh(sphere,moss,g,[-2+i*.8,.99,0],[.65,.19,.55]);
    beam(g,[.5,.7,0],[1.2,1.9,.6],.17,dark);
  }
  // Ridge strata deliberately expose horizontal shelves and the valley view.
  for(let i=0;i<9;i++) {
    const g=roadside(2,.08+i*.087,-1,17,8);if(!g)continue;g.name='Layered limestone outcrop';
    for(let layer=0;layer<4;layer++) {
      const m=mesh(rockGeo,layer%2?stone:paleStone,g,[Math.sin(i+layer)*1.2,layer*2.1+1.1,0],[7-layer*.75,1.5,5-layer*.45]);
      m.rotation.y=.1*Math.sin(i+layer);
    }
    for(let j=0;j<4;j++)mesh(cone,grass,g,[random()*8-4,.35,5+random()],[.25,.8,.25]);
  }
  const overlook=roadside(2,.6,1,13,6);
  if(overlook) {
    overlook.name='Valley viewing terrace';
    box(wood,overlook,[0,.15,0],[9,.3,5]);
    for(const x of [-4.3,4.3])for(const z of [-2.2,2.2])box(dark,overlook,[x,-1,z],[.35,2.2,.35]);
    for(let i=0;i<7;i++)box(wood,overlook,[-4.2+i*1.4,1.1,-2.4],[.15,2,.15]);
    box(cream,overlook,[0,1.8,-2.4],[9,.15,.15]);
    for(const x of [-2.3,2.3]){box(dark,overlook,[x,1.1,.2],[.12,2.2,.12]);mesh(cylinder,steel,overlook,[x,2.3,.2],[.22,1,.22]).rotation.x=.85;}
  }
  for(let i=0;i<4;i++) {
    const g=animate(roadside(2,.25+i*.18,1,35,1,scene));if(!g)continue;g.position.y+=24+i*4;g.name='Circling ridge bird';
    const wings=[];
    for(const side of [-1,1]) {
      const w=new THREE.Group();g.add(w);mesh(leafGeometry,cream,w,[side*.12,0,0],[1.5,1,2.2]);w.rotation.y=side*Math.PI/2;wings.push(w);
    }
    birds.push({g,wings,x:g.position.x,z:g.position.z,phase:i*1.8});
  }
  // Shoreline craft: hull ribs, dock planks, wet posts, reeds and lilies.
  for(const [f,offset,index]of [[.22,36,0],[.43,47,1],[.59,29,2]]) {
    const t=sectorT(3,f),frame=track.poseAt(t*track.TRACK,offset,0);
    const g=new THREE.Group();g.position.set(frame.p.x,-1.08,frame.p.z);g.rotation.y=index*1.4;scene.add(g);animate(g);g.name='Bobbing rowboat';
    mesh(sphere,index%2?navy:coral,g,[0,0,0],[1.4,.55,3.5]);
    mesh(sphere,dark,g,[0,.19,0],[1.18,.17,3.0]);
    for(const z of [-1.8,0,1.8])box(wood,g,[0,.3,z],[2.5,.13,.35]);
    for(const side of [-1,1])beam(g,[side*.7,.35,.5],[side*3,.18,-1.1],.06,wood);
    boats.push({g,baseY:g.position.y,phase:index*2,baseR:g.rotation.y});
  }
  for(const [f,side]of [[.10,1],[.7,1],[.86,-1]]) {
    const g=roadside(3,f,side,20,6);if(!g)continue;g.name='Timber fishing dock';
    for(let i=0;i<13;i++)box(wood,g,[0,.1,-3+i*.6],[4,.15,.55]);
    for(const x of [-1.8,1.8])for(const z of [-3,3.8]) {
      box(dark,g,[x,-1,z],[.32,3.2,.32]);mesh(torus,dark,g,[x,.8,z],[.45,.45,.45]);
    }
    crate(g,0,.2,-1,false);
    beam(g,[1,.2,2.5],[1.5,4.3,2],.025,dark);
  }
  for(let i=0;i<48;i++) {
    const g=roadside(3,.03+random()*.93,i%3?1:-1,6+random()*12,.8);if(!g)continue;
    for(let j=0;j<6;j++) {
      const x=random()*1.8-.9,z=random()*1.8-.9,h=.8+random()*1.4;
      beam(g,[x,0,z],[x+.15,h,z],.025,leaf);
      mesh(cylinder,dark,g,[x+.13,h-.1,z],[.1,.35,.1]);
    }
  }
  // Farm machinery reads as a mechanism: spokes, paddles, gear and transmission.
  const wheelBase=roadside(4,.46,1,10,5);
  let wheel=null,gear=null;
  if(wheelBase) {
    wheelBase.name='Working mill waterwheel';
    for(const x of [-.7,.7])box(stone,wheelBase,[x,2,0],[.55,4,1.5]);
    wheel=new THREE.Group();wheel.position.set(0,4,0);wheelBase.add(wheel);animate(wheel);
    for(const x of [-.7,.7]) {
      const rim=mesh(torus,dark,wheel,[x,0,0],[3.6,3.6,3.6]);rim.rotation.y=Math.PI/2;
      for(let i=0;i<10;i++) {
        const a=i*Math.PI*2/10;
        beam(wheel,[x,0,0],[x,Math.cos(a)*3.6,Math.sin(a)*3.6],.12,wood);
      }
    }
    for(let i=0;i<16;i++) {
      const a=i*Math.PI*2/16,paddle=box(wood,wheel,[0,Math.cos(a)*3.65,Math.sin(a)*3.65],[1.65,.7,.25]);paddle.rotation.x=-a;
    }
    gear=new THREE.Group();gear.position.set(-2,4,0);wheelBase.add(gear);animate(gear);
    mesh(cylinder,steel,gear,[0,0,0],[1.3,.25,1.3]).rotation.z=Math.PI/2;
    for(let i=0;i<12;i++){const a=i*Math.PI*2/12;const tooth=box(dark,gear,[0,Math.cos(a)*1.4,Math.sin(a)*1.4],[.35,.4,.32]);tooth.rotation.x=-a;}
    beam(wheelBase,[-2.6,4,0],[1,4,0],.25,steel);
  }
  for(const [f,side]of [[.13,-1],[.27,1],[.84,1]]) {
    const g=roadside(4,f,side,9,6);if(!g)continue;g.name='Mill yard loading canopy';
    for(const x of [-4,4])for(const z of [-2.5,2.5])box(dark,g,[x,2.4,z],[.3,4.8,.3]);
    box(wood,g,[0,4.9,0],[9,.25,6]);
    for(let i=0;i<8;i++)box(cream,g,[-3.9+i*1.1,4.6,2.8],[.95,.45,.1]);
    for(let i=0;i<5;i++) {
      const x=i%3*2.3-2.3,z=Math.floor(i/3)*2;
      mesh(sphere,cream,g,[x,.8,z],[.75,.9,.62]);
      mesh(torus,dark,g,[x,1.4,z],[.29,.29,.29]).rotation.x=Math.PI/2;
    }
    for(const z of [-1.8,1.8]){mesh(cylinder,wood,g,[3,.9,z],[.7,1.8,.7]);for(const y of [.35,1.4])mesh(torus,steel,g,[3,y,z],[.7,.7,.7]).rotation.x=Math.PI/2;}
    box(dark,g,[0,.3,-1.9],[4,.25,1]);
  }
  // Fruit stalls and irrigation distinguish the orchard from meadow scatter.
  tent(5,.45,-1,coral,.9);tent(5,.74,1,mint,.9);
  for(let i=0;i<22;i++) {
    const side=i%2?1:-1,g=roadside(5,.06+i*.04,side,4,2);if(!g)continue;
    box(steel,g,[0,.08,0],[.09,.1,3.4]);
    mesh(cylinder,steel,g,[0,.32,0],[.07,.5,.07]);
    const spray=mesh(cone,mint,g,[0,.65,0],[.18,.07,.18]);spray.castShadow=false;
    if(i%5===0){crate(g,1.1,0,0);const ladder=box(wood,g,[-1.2,1.7,0],[.08,3.5,.08]);ladder.rotation.z=.22;for(let rung=0;rung<7;rung++)box(wood,g,[-.8, .25+rung*.42,0],[.8,.07,.07]);box(wood,g,[-.4,1.7,0],[.08,3.5,.08]);}
  }
  // Thin colored wings remain recognizable from chase height without alpha cards.
  for(let i=0;i<10;i++) {
    const section=i<6?0:5,g=animate(roadside(section,.12+random()*.7,i%2?1:-1,6,1,scene));if(!g)continue;
    g.position.y+=2.4;g.name='Meadow butterfly';
    const wings=[];
    for(const side of [-1,1]) {
      const w=new THREE.Group();g.add(w);
      mesh(sphere,i%2?butter:blossom,w,[side*.22,0,0],[.28,.035,.32]);wings.push(w);
    }
    butterflies.push({g,wings,x:g.position.x,y:g.position.y,z:g.position.z,phase:i*1.7});
  }
  function driftingParticles(section,count,color,size,name) {
    const positions=new Float32Array(count*3),origins=new Float32Array(count*3),phase=new Float32Array(count);
    for(let i=0;i<count;i++) {
      const f=.1+random()*.8,t=sectorT(section,f),side=i%2?1:-1,s=track.surfaceAt(t);
      const edge=side>0?s.rightEdge:-s.leftEdge;
      const frame=track.poseAt(t*track.TRACK,side*(edge+3+random()*10),0);
      positions[i*3]=frame.p.x;positions[i*3+1]=frame.p.y+1+random()*5;positions[i*3+2]=frame.p.z;
      phase[i]=random()*6;
    }
    origins.set(positions);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const m=new THREE.Points(geo,new THREE.PointsMaterial({color,size,transparent:true,opacity:.55,depthWrite:false,sizeAttenuation:true}));
    m.name=name;scene.add(m);animate(m);geo.computeBoundingSphere();
    return {geo,positions,origins,phase,count};
  }
  const motes=driftingParticles(1,60,'#bce6bb',.12,'Pine hollow drifting motes');
  const petals=driftingParticles(5,80,'#ffcabd',.19,'Orchard drifting blossom');
  // Crowd arms share a few moving batches, rather than one draw per limb.
  const cheering=new THREE.Group();scene.add(cheering);
  for(const arm of arms)arm.g.rotation.z=arm.side*1.9;
  scene.updateMatrixWorld(true);
  for(const arm of arms) {
    for(const limb of [...arm.g.children]) {
      limb.matrixWorld.decompose(limb.position,limb.quaternion,limb.scale);cheering.add(limb);
    }
    animated.splice(animated.indexOf(arm.g),1);arm.g.removeFromParent();
  }
  kit.batch(cheering);animated.push(cheering);
  const cheerMotion=cheering.children.map(m=>({mesh:m,base:m.geometry.attributes.position.array.slice()}));
  // Merge each moving assembly while preserving its animated transform.
  for(const b of boats)kit.batch(b.g);
  if(wheel)kit.batch(wheel);
  if(gear)kit.batch(gear);
  return {
    animated,
    update(time) {
      for(const f of flags) {
        const a=f.geo.attributes.position.array;
        for(let i=0;i<a.length;i+=3){const x=f.rest[i];a[i+2]=Math.sin(time*3+f.phase-x*2.6)*.21*(x/f.length);a[i+1]=f.rest[i+1]+Math.sin(time*2+f.phase-x)*.04*(x/f.length);}
        f.geo.attributes.position.needsUpdate=true;
      }
      for(const {mesh:m,base} of cheerMotion) {
        const p=m.geometry.attributes.position;
        for(let i=0;i<p.count;i++) {
          const j=i*3,wave=Math.sin(time*4+base[j]*.35+base[j+2]*.8);
          p.array[j+1]=base[j+1]+wave*.14;p.array[j+2]=base[j+2]+wave*.09;
        }
        p.needsUpdate=true;
      }
      for(const b of boats){b.g.position.y=b.baseY+Math.sin(time*1.1+b.phase)*.14;b.g.rotation.z=Math.sin(time*.7+b.phase)*.035;b.g.rotation.y=b.baseR+Math.sin(time*.3+b.phase)*.09;}
      for(const b of butterflies){b.g.position.set(b.x+Math.sin(time*.55+b.phase)*1.8,b.y+Math.sin(time*.9+b.phase)*.5,b.z+Math.cos(time*.65+b.phase)*1.6);b.g.rotation.y=time*.4+b.phase;b.wings[0].rotation.z=Math.sin(time*18+b.phase)*.7;b.wings[1].rotation.z=-b.wings[0].rotation.z;}
      for(const b of birds){b.g.position.x=b.x+Math.cos(time*.16+b.phase)*13;b.g.position.z=b.z+Math.sin(time*.16+b.phase)*13;b.g.rotation.y=-time*.16-b.phase;b.wings[0].rotation.z=Math.sin(time*3+b.phase)*.25;b.wings[1].rotation.z=-b.wings[0].rotation.z;}
      if(wheel)wheel.rotation.x=time*.42;
      if(gear)gear.rotation.x=-time*1.17;
      for(const p of [motes,petals]) {
        for(let i=0;i<p.count;i++){const j=i*3;p.positions[j]=p.origins[j]+Math.sin(time*.3+p.phase[i])*1.5;p.positions[j+1]=p.origins[j+1]+Math.sin(time*.5+p.phase[i])*.7;p.positions[j+2]=p.origins[j+2]+Math.cos(time*.24+p.phase[i])*1.4;}
        p.geo.attributes.position.needsUpdate=true;
      }
    },
  };
}
