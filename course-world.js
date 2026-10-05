import * as THREE from './vendor/three/three.module.js';
import { batchStaticMeshes } from './visuals.js';
import { surfaceTexture } from './textures.js';
import { createRailGeometry } from './course-rails.js';
import { bakeVertexShade } from './graphics.js';
import { createCourseKit, batchScenery } from './course-kit.js';
import buildWindmillLife from './courses/windmill-wilds-world.js';
import { TRACK, COURSE_LENGTH, SECTIONS, frameAt, poseAt, roadHalfWidth,
  surfaceAt, shortcutWidth, projectTrack, MILL_T, BRIDGE_RANGE, activeTrack, VERGES, vergeWidth } from './track.js';
import { cartAt } from './hazards.js';

// Every road edge, rail, shortcut and moving prop uses the simulation's data.
export function addCourseWorld(scene, renderer, mats, textures, nature = null) {
  const scenery = new THREE.Group();
  scene.add(scenery);
  let seed = 8127;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const mat = (color, map = null) => new THREE.MeshStandardMaterial({ color, map,
    ...(map?.userData?.pbr||{}),roughness: 0.87, vertexColors: true });
  const wood = mat('#d6b784',textures.wood), darkWood = mat('#76573b',textures.wood);
  // Tight inner bends can reverse the edge direction; keep both faces visible.
  const railMaterials = [mats.rail.clone(), darkWood.clone()], bridgeRailMaterial = wood.clone();
  for (const material of [...railMaterials, bridgeRailMaterial]) material.side = THREE.DoubleSide;
  const stone = mat('#e8d9bf', textures.brick || (renderer ? surfaceTexture('brick', renderer) : null));
  const roof = mat('#e67851', textures.roof || (renderer ? surfaceTexture('roof', renderer) : null));
  const ochre = mat('#ebc875'), cream = mat('#fff1c9'), red = mat('#ed644b');
  const leaf = mat('#6d9d57', textures.leaves), pine = mat('#609782', textures.leaves);
  const flower = mat('#ffc2bd'), fruit = mat('#e66941'), rock = mat('#a2ae9c');
  const bark = mats.trunk;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const sphereGeo = new THREE.SphereGeometry(1, 12, 8);
  const coneGeo = new THREE.ConeGeometry(1, 1, 12);
  const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
  const mesh = (geo, material, parent = scenery, p = [0, 0, 0], scale = [1, 1, 1]) => {
    if (Array.isArray(material) || material.vertexColors) bakeVertexShade(geo);
    const m = new THREE.Mesh(geo, material);
    m.position.set(...p); m.scale.set(...scale);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const box = (material, parent, p, scale) => mesh(boxGeo, material, parent, p, scale);
  const align = (group, frame) => {
    group.position.copy(frame.p);
    group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(frame.right, frame.up, frame.tangent.clone().negate()));
  };
  const groupAt = (t, offset = 0, parent = scenery) => {
    const g = new THREE.Group(); align(g, poseAt(t * TRACK, offset, 0)); parent.add(g); return g;
  };
  const sectorT = (i, f) => THREE.MathUtils.lerp(SECTIONS[i].start, SECTIONS[i].end, f);
  const inBridge = (t) => t >= BRIDGE_RANGE.start && t <= BRIDGE_RANGE.end;

  const ground = mesh(new THREE.PlaneGeometry(1800, 1800), mats.grass, scenery, [0, -1.7, 0]);
  ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
  const groundUV = ground.geometry.attributes.uv;
  // World-aligned grass tiles meet the banks without an obvious texture seam.
  const groundPos = ground.geometry.getAttribute('position');
  for (let i = 0; i < groundUV.count; i++) groundUV.setXY(i, groundPos.getX(i) / 6, -groundPos.getY(i) / 6);

  function ribbon(edgeA, edgeB, materials, lift = 0.045, terrain = false, startT=0, endT=1) {
    const pos = [], uv = [], colors = [], indices = [], groups = [], n = Math.max(8,Math.ceil(1800*(endT-startT)));
    const grassy = materials === mats.grass;
    for (let i = 0; i <= n; i++) {
      const t = THREE.MathUtils.lerp(startT,endT,i/n), frame = frameAt(t);
      for (const [j, edge] of [edgeA(t), edgeB(t)].entries()) {
        const p = frame.p.clone().addScaledVector(frame.right, edge);
        if (terrain) {
          const surface=surfaceAt(t);
          const distance = Math.abs(edge) - (edge > 0 ? surface.rightEdge : -surface.leftEdge);
          p.y = THREE.MathUtils.lerp(p.y - 0.06, -1.7, THREE.MathUtils.smoothstep(distance, 0, 38));
        } else p.addScaledVector(frame.up, lift);
        pos.push(p.x, p.y, p.z);
        if (grassy) uv.push(p.x / 6, p.z / 6);
        else uv.push(edge / 8, t * COURSE_LENGTH / 8);
        // Painted edge wear and broad turf variation live in existing vertices.
        const variation = 0.5 + 0.5 * Math.sin(p.x * 0.047 + Math.sin(p.z * 0.035) * 2);
        const shade = grassy ? 0.87 + variation * 0.13
          : Array.isArray(materials) ? 0.9 + variation * 0.06 : 0.95;
        colors.push(shade, shade, shade);
      }
      if (i < n) {
        if (terrain && inBridge(THREE.MathUtils.lerp(startT,endT,(i + 0.5) / n))) continue;
        const a = i * 2, start = indices.length;
        if (edgeB(t) >= edgeA(t)) indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        else indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        if (Array.isArray(materials)) {
          const section = SECTIONS.findIndex(s => (i + 0.5) / n < s.end);
          const materialIndex = section === 3 ? 1 : section === 4 ? 2 : 0;
          const last = groups.at(-1);
          if (last && last.materialIndex === materialIndex && last.start + last.count === start) last.count += 6;
          else groups.push({ start, count: 6, materialIndex });
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(indices);
    for (const g of groups) geo.addGroup(g.start, g.count, g.materialIndex);
    geo.computeVertexNormals();
    const m = mesh(geo, materials); m.castShadow = false; return m;
  }
  ribbon(t => -roadHalfWidth(t) - 0.55, t => roadHalfWidth(t) + 0.55, mats.roadside, -0.02);
  ribbon(t => -roadHalfWidth(t), t => roadHalfWidth(t), [mats.road, wood, stone]);
  ribbon(t => roadHalfWidth(t), t => roadHalfWidth(t) + shortcutWidth(t), mats.grass, 0.035);
  const vergeMaterials={grass:mats.grass,needles:mat('#b7b792',textures.needles),gravel:mat('#ccc9b6',textures.gravel)};
  for(const v of VERGES) ribbon(t=>v.side*roadHalfWidth(t),
    t=>v.side*(roadHalfWidth(t)+vergeWidth(t,v.side)),vergeMaterials[v.material]||mats.grass,.04,false,v.start,v.end);
  for (const side of [-1, 1]) {
    const edge = t => side < 0 ? surfaceAt(t).leftEdge : surfaceAt(t).rightEdge;
    ribbon(t => edge(t), t => edge(t) + side * 38, mats.grass, 0, true);
    // A low continuous rail marks the actual physical limit, including the grass cut.
    mesh(createRailGeometry(side, { width: 0.15, height: 0.32, above: 0.72 }), railMaterials);
    mesh(createRailGeometry(side, { width: 0.12, height: 0.15, above: 1.25,
      start: BRIDGE_RANGE.start, end: BRIDGE_RANGE.end }), bridgeRailMaterial);
    for (let i = 0; i < 370; i++) {
      const t = (i + 0.5) / 370, g = groupAt(t, edge(t));
      const material = inBridge(t) ? darkWood : mats.rail;
      box(material, g, [0, 0.42, 0], [0.19, 0.86, 0.19]);
      if (inBridge(t)) box(wood, g, [0, 1.0, 0], [0.19, 0.6, 0.19]);
    }
  }
  // Dashes and curb blocks establish each turn; timber uses visible cross planks.
  for (let i = 0; i < 330; i++) {
    const t = i / 330, g = groupAt(t), half = roadHalfWidth(t);
    if (SECTIONS[3].start <= t && t < SECTIONS[3].end) {
      box(darkWood, g, [0, 0.057, 0], [half * 2, 0.015, 0.06]);
    } else {
      if (i % 2 === 0) box(cream, g, [0, 0.065, 0], [0.13, 0.025, 2.4]);
      for (const side of [-1, 1]) {
        if (vergeWidth(t,side)>.1 || (side > 0 && shortcutWidth(t) > 0.1)) continue;
        box(i % 2 ? red : cream, g, [side * (half + 0.25), 0.07, 0], [0.5, 0.04, COURSE_LENGTH / 330 + 0.1]);
      }
    }
  }
  // Lift the wooden deck off the lake on beams and trestles. No missing road.
  for (let i = 0; i < 16; i++) {
    const t = THREE.MathUtils.lerp(BRIDGE_RANGE.start, BRIDGE_RANGE.end, i / 15);
    const g = groupAt(t);
    box(darkWood, g, [0, -0.28, 0], [12.8, 0.45, 1.5]);
    for (const x of [-5, 5]) box(darkWood, g, [x, -4.8, 0], [0.7, 9, 0.7]);
    const brace = box(wood, g, [0, -3.8, 0], [11, 0.5, 0.6]); brace.rotation.z = 0.32;
  }
  const lakeFrame = poseAt(sectorT(3, 0.38) * TRACK, 39, 0);
  const lake = mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshStandardMaterial({
    color: '#4aa9bf', roughness: 0.28, metalness: 0.25, map: textures.water,
  }), scenery, [lakeFrame.p.x, -1.55, lakeFrame.p.z], [63, 51, 1]);
  lake.rotation.x = -Math.PI / 2; lake.castShadow = false;

  function baseAt(p) {
    const surface = projectTrack(p, 0, true);
    const edge = surface.offset > 0 ? surface.rightEdge : -surface.leftEdge;
    return { surface, y: THREE.MathUtils.lerp(surface.height - 0.12, -1.7,
      THREE.MathUtils.smoothstep(surface.distance - edge, 0, 38)) };
  }
  const treeBuckets = new Map(), fruitBuckets = new Map();
  const treeMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.92 });
  const treeDummy = new THREE.Object3D();
  const treeTint = new THREE.Color();
  function instance(bucketMap, key, geometry, material, matrix, color) {
    if (!bucketMap.has(key)) bucketMap.set(key, { geometry, material, placements: [] });
    bucketMap.get(key).placements.push({ matrix: matrix.clone(), color: color.clone() });
  }
  function tree(t, offset, kind, size) {
    const p = poseAt(t * TRACK, offset, 0).p, base = baseAt(p);
    if (base.surface.distance < (base.surface.offset > 0 ? base.surface.rightEdge : -base.surface.leftEdge) + size*2.6) return;
    if (nature) {
      const type = kind === 'pine' ? 2 : kind === 'blossom' ? 3 : (Math.floor(t * 193) % 2);
      // A sector-sized batch balances culling with a low draw-call count.
      const tile = surfaceAt(t).section.id;
      const phase = t * 277 + offset;
      treeDummy.position.set(p.x, base.y, p.z);
      treeDummy.rotation.set(0, phase, 0);
      treeDummy.scale.set(size * (kind === 'pine' ? 2.8 : 1.8), size * (kind === 'pine' ? 1.6 : 1.45), size * (kind === 'pine' ? 2.8 : 1.8) * (0.94 + Math.sin(phase) * 0.08));
      treeDummy.updateMatrix();
      treeTint.setRGB(0.92 + Math.sin(phase) * 0.06, 0.94 + Math.cos(phase) * 0.05, 0.9);
      instance(treeBuckets, `${tile}:${type}`, nature[type], treeMaterial, treeDummy.matrix, treeTint);
      if (kind === 'orchard') for (let i = 0; i < 5; i++) {
        treeDummy.position.set(p.x + Math.cos(i * 1.7) * size * 1.4,
          base.y + size * (4.4 + (i % 2) * 0.5), p.z + Math.sin(i * 1.7) * size * 1.4);
        treeDummy.scale.setScalar(0.22); treeDummy.updateMatrix();
        treeTint.setRGB(1, 1, 1);
        instance(fruitBuckets, tile, fruitGeo, fruit, treeDummy.matrix, treeTint);
      }
      return;
    }
    const g = new THREE.Group(); g.position.set(p.x, base.y, p.z); scenery.add(g);
    mesh(cylinderGeo, bark, g, [0, size * 2.5, 0], [size * 0.25, size * 5, size * 0.25]);
    if (kind === 'pine') {
      for (let i = 0; i < 3; i++) mesh(coneGeo, i % 2 ? mats.pine2 : pine, g,
        [0, size * (3.0 + i * 1.2), 0], [size * (2.5 - i * 0.5), size * 3.6, size * (2.5 - i * 0.5)]);
    } else {
      for (let i = 0; i < 3; i++) mesh(sphereGeo, kind === 'blossom' ? flower : leaf, g,
        [(i - 1) * size * 0.85, size * (4.7 + (i % 2) * 0.6), 0], [size * 1.65, size * 1.5, size * 1.6]);
      if (kind === 'orchard') for (let i = 0; i < 5; i++) mesh(sphereGeo, fruit, g,
        [Math.cos(i * 1.7) * size * 1.6, size * (4.1 + (i % 2) * 0.5), Math.sin(i * 1.7) * size * 1.7], [0.22, 0.22, 0.22]);
    }
  }
  const fruitGeo = bakeVertexShade(new THREE.OctahedronGeometry(1));
  for (let i = 0; i < 160; i++) {
    const t = sectorT(1, random()), side = i % 2 ? 1 : -1;
    tree(t, side * (14 + random() * 32), 'pine', 1.8 + random() * 0.9);
  }
  // Canopy columns framing two shaded road passages, with clearance above the camera.
  for (const f of [0.2, 0.38, 0.62, 0.8]) for (const side of [-1, 1])
    tree(sectorT(1, f), side * 13, 'pine', 3.3);
  for (let i = 0; i < 100; i++) {
    const t = sectorT(5, random()), side = i % 2 ? 1 : -1;
    tree(t, side * (15 + (side > 0 ? shortcutWidth(t) : 0) + random() * 27), i % 3 ? 'orchard' : 'blossom', 1 + random() * 0.4);
  }
  for (let i = 0; i < 40; i++) tree(sectorT(0, random()), (i % 2 ? 1 : -1) * (20 + random() * 42), 'orchard', 1.3 + random());
  // Spatial batches retain culling: an orchard across the circuit does not
  // enter the nearby shadow map or main pass. Count and placement stay bounded.
  for (const buckets of [treeBuckets, fruitBuckets]) for (const bucket of buckets.values()) {
    const m = new THREE.InstancedMesh(bucket.geometry, bucket.material, bucket.placements.length);
    m.name = buckets === treeBuckets ? 'Kenney nature instances' : 'Orchard fruit instances';
    bucket.placements.forEach((p, i) => { m.setMatrixAt(i, p.matrix); m.setColorAt(i, p.color); });
    m.instanceMatrix.needsUpdate = true;
    m.castShadow = buckets === treeBuckets;
    m.receiveShadow = true;
    m.computeBoundingSphere();
    scene.add(m);
  }
  // Ridge rock faces lean away from the road; the outside is an open valley view.
  for (let i = 0; i < 45; i++) {
    const t = sectorT(2, random()), p = poseAt(t * TRACK, surfaceAt(t).leftEdge-12-random()*15, 0).p, base = baseAt(p);
    const m = mesh(new THREE.IcosahedronGeometry(1, 0), rock, scenery, [p.x, base.y + 2, p.z], [4 + random() * 5, 3 + random() * 9, 4 + random() * 5]);
    m.rotation.y = random() * 6;
  }
  for (let i = 0; i < 20; i++) {
    const a = i / 20 * Math.PI * 2, r = 430 + random() * 90;
    const hill = mesh(sphereGeo, i % 2 ? leaf : pine, scenery, [Math.cos(a) * r, -19, Math.sin(a) * r], [50 + random() * 40, 27 + random() * 45, 50 + random() * 40]);
    hill.castShadow = false;
  }

  function barn(t, offset, scale = 1) {
    const g = groupAt(t, offset);
    box(red, g, [0, 3, 0], [9, 6, 11]);
    for (const x of [-3.8, 3.8]) box(cream, g, [x, 3, 5.6], [0.2, 6.1, 0.15]);
    box(darkWood, g, [0, 2.1, 5.6], [3.4, 4.2, 0.15]);
    for (const side of [-1, 1]) { const m = box(roof, g, [side * 2.6, 7.1, 0], [6.2, 0.3, 12]); m.rotation.z = side * -0.46; }
    g.scale.setScalar(scale); return g;
  }
  barn(sectorT(0, 0.3), -29, 1.4);
  for (let i = 0; i < 12; i++) {
    const t=sectorT(0, 0.4 + i * 0.012),g = groupAt(t, surfaceAt(t).rightEdge+5+i%3*4);
    mesh(cylinderGeo, ochre, g, [0, 1.1, 0], [1.1, 2.5, 1.1]).rotation.z = Math.PI / 2;
  }
  // Festival stands and pennants form a lively wide first sector.
  for (const side of [-1, 1]) {
    const g = groupAt(sectorT(0, 0.08), side * 22);
    for (let row = 0; row < 4; row++) {
      box(wood, g, [0, row * 0.7 + 0.3, row * 1.1], [20, 0.6, 1.1]);
      for (let n = 0; n < 18; n++) mesh(sphereGeo, n % 2 ? cream : red, g,
        [-9 + n, row * 0.7 + 1.1, row * 1.1], [0.28, 0.4, 0.28]);
    }
  }
  for (let i = 0; i < 20; i++) {
    const t=sectorT(0,i/20),side=i%2?1:-1,g = groupAt(t,side<0?surfaceAt(t).leftEdge-3:surfaceAt(t).rightEdge+3);
    box(wood, g, [0, 2.2, 0], [0.13, 4.4, 0.13]);
    box(i % 2 ? cream : red, g, [0.6, 3.7, 0], [1.2, 0.75, 0.035]);
  }

  // The mill straddles the road; the 18 m wide, 10 m tall portal clears kart and camera.
  const mill = groupAt(MILL_T);
  for (const side of [-1, 1]) {
    box(stone, mill, [side * 10.4, 5, 0], [2.2, 10, 10]);
    box(darkWood, mill, [side * 9.5, 5.1, 4.4], [0.3, 10.2, 0.35]);
  }
  box(stone, mill, [0, 11.2, 0], [23, 2.4, 10]);
  box(darkWood, mill, [0, 10.1, 4.6], [21, 0.45, 0.45]);
  mesh(new THREE.CylinderGeometry(6, 7, 11, 16), stone, mill, [0, 17.8, 0]);
  mesh(new THREE.ConeGeometry(8, 6, 16), roof, mill, [0, 26.1, 0]);
  box(darkWood, mill, [0, 18, 6.9], [2.2, 2.8, 0.12]);
  const rotor = new THREE.Group(); rotor.position.set(0, 20, 8); mill.add(rotor);
  mesh(cylinderGeo, darkWood, rotor, [0, 0, 0], [0.6, 0.7, 0.6]).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Group(); blade.rotation.z = i * Math.PI / 2; rotor.add(blade);
    box(darkWood, blade, [0, 4.2, 0], [0.35, 8.4, 0.22]);
    box(cream, blade, [0.9, 5.1, 0.12], [1.8, 5.4, 0.12]);
    for (let j = 0; j < 5; j++) box(wood, blade, [0.9, 3 + j, 0.2], [1.9, 0.12, 0.13]);
    batchStaticMeshes(blade);
  }
  batchStaticMeshes(mill, [rotor]);
  barn(sectorT(4, 0.80), 24, 0.85);
  for (let i = 0; i < 12; i++) {
    const g = groupAt(sectorT(4, 0.60 + i * 0.008), 13 + i % 3 * 2.5);
    box(wood, g, [0, 0.9, 0], [1.8, 1.8, 1.8]);
    for (const x of [-0.8, 0.8]) box(darkWood, g, [x, 0.9, 0.93], [0.12, 1.9, 0.05]);
  }
  const cart = new THREE.Group(); scene.add(cart);
  box(darkWood, cart, [0, 0.6, 0], [2.7, 0.45, 4.3]);
  for (const x of [-1.35, 1.35]) for (const z of [-1.5, 1.5]) {
    const wheel = mesh(cylinderGeo, mats.black, cart, [x, 0.3, z], [0.5, 0.22, 0.5]); wheel.rotation.z = Math.PI / 2;
  }
  for (let i = 0; i < 3; i++) box(ochre, cart, [0, 1.4, (i - 1) * 1.15], [2.4, 1.2, 1]);
  batchStaticMeshes(cart);
  const warningMaterial = new THREE.MeshStandardMaterial({ color: '#ffc850', emissive: '#ff9d25', emissiveIntensity: 0 });
  const warning = groupAt(cartAt(0).s / TRACK, 9.6);
  box(darkWood, warning, [0, 2, 0], [0.17, 4, 0.17]);
  mesh(sphereGeo, warningMaterial, warning, [0, 4.2, 0], [0.45, 0.45, 0.45]);

  for (let i = 0; i < 22; i++) {
    const g = new THREE.Group(); scenery.add(g);
    g.position.set(random() * 950 - 475, 80 + random() * 35, random() * 950 - 475);
    for (let j = 0; j < 4; j++) mesh(sphereGeo, cream, g, [j * 5, Math.sin(j) * 2, 0], [5.5, 2.8, 3.2]);
    batchStaticMeshes(g);
  }
  const life=buildWindmillLife({THREE,scene,scenery,track:activeTrack,
    kit:createCourseKit(scenery,activeTrack),textures});
  batchScenery(scenery,[mill,...life.animated]);
  return {
    update(time) {
      rotor.rotation.z = time * 0.75;
      const state = cartAt(time); align(cart, state);
      warningMaterial.emissiveIntensity = state.warning ? 1.5 + Math.sin(time * 12) : 0;
      if(lake.material.map)lake.material.map.offset.set(time*.006,time*.003);
      life.update(time);
    },
  };
}
