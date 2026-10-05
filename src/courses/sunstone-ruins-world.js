import { buildTemple } from "./sunstone-ruins/build-temple.js";
import { createDesertGeometry } from "./sunstone-ruins/create-desert-geometry.js";
// Sunstone has a quiet expedition rhythm: moving water and cloth in the oasis,
// rock strata on the climb, monumental carved architecture, then open dunes.
import { addGlow, createContactShadowMesh } from "../rendering/visual-effects.js";

export function buildWorld(context) {
  const { THREE, scenery, track, kit, hazardAt, textures = {} } = context;
  const { material, mesh, box, groupAt, sectorT, batch, align } = kit;
  const animated = [],
    windPalms = [],
    cloth = [],
    flames = [],
    ripples = [],
    birds = [];
  const stone = material("#e1ba85", { map: textures.stone }),
    dark = material("#a58a6e", { map: textures.stone });
  const gold = material("#ecd097", { map: textures.stone }),
    chalk = material("#f0dbc0", { map: textures.stone });
  const cool = material("#878394", { map: textures.stone });
  const leaf = material("#819957", { map: textures.leaves, side: THREE.DoubleSide });
  const reed = material("#91a276"),
    trunk = material("#a18660", { map: textures.bark });
  const sand = material("#e3c584", { map: textures.sand }),
    sandShade = material("#d4b47c", { map: textures.sand });
  const water = material("#5fb5ad", { map: textures.water, roughness: 0.2, metalness: 0.22 });
  const poolDeep = material("#348f94", { roughness: 0.35 });
  const rippleMat = material("#b0e7d3", {
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    roughness: 0.3,
  });
  const rune = material("#94ddd1", { emissive: "#65b5ac", emissiveIntensity: 0.5 });
  const coral = material("#b55345", { map: textures.fabric, side: THREE.DoubleSide });
  const teal = material("#4b9091", { map: textures.fabric, side: THREE.DoubleSide });
  const flameMat = material("#ffbd61", { emissive: "#ff923c", emissiveIntensity: 1.5 });
  const bronze = material("#9e7648", { map: textures.metal, roughness: 0.62, metalness: 0.32 });
  const ceramic = material("#c27658", { map: textures.stone });
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const cone = new THREE.ConeGeometry(1, 1, 8);
  const rock = new THREE.IcosahedronGeometry(1, 0);
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  const ring = new THREE.RingGeometry(0.93, 1, 40);
  ring.rotateX(-Math.PI / 2);
  const rockMaterials = new Map();
  function importedRock(name, parent, position, size) {
    // Kenney's faceted rock forms are split across several meshes in glTF.
    // Scale the whole authored silhouette, and tint cloned materials so each
    // canyon cluster keeps the warm sandstone palette without flattening its
    // facet shading or mutating the shared asset cache.
    const model = kit.asset(`kenney:nature/${name}`, parent, position, size);
    const tint = name === "rock-tallb" ? "#c7a37a" : name === "rock-largee" ? "#d9b78b" : "#be9d7c";
    model.traverse((child) => {
      if (!child.isMesh) return;
      const originals = Array.isArray(child.material) ? child.material : [child.material];
      const clones = originals.map((source) => {
        if (!rockMaterials.has(source)) rockMaterials.set(source, new Map());
        const variants = rockMaterials.get(source);
        if (!variants.has(tint)) {
          const mat = source.clone();
          mat.color.set(tint);
          mat.roughness = 0.94;
          variants.set(tint, mat);
        }
        return variants.get(tint);
      });
      child.material = Array.isArray(child.material) ? clones : clones[0];
    });
    return model;
  }
  const palette = { bronze, chalk, cool, dark, gold, rune, stone };
  const geometry = { cone, cylinder, rock, sphere };
  const {
    beddedLayerGeometry,
    duneGeometry,
    frondGeometry,
    fabricGeometry,
    wingGeometry,
    birdMat,
  } = createDesertGeometry({ THREE, kit });
  function grounded(t, offset, footprint = 0) {
    // safeGroup also tests against other nearby sectors, protecting tight bends.
    if (kit.safeGroup) return kit.safeGroup(t, offset, footprint);
    return kit.landGroup ? kit.landGroup(t, offset) : groupAt(t, offset);
  }
  function groundShadow(parent, width, depth) {
    const shadow = createContactShadowMesh({ width, depth, opacity: 0.24 });
    shadow.position.y = 0.035;
    parent.add(shadow);
  }
  function palm(t, side, size = 1, wind = false) {
    const g = grounded(t, side * (26 + size * 2), 6 * size);
    if (!g) return;
    groundShadow(g, 4.8 * size, 4.8 * size);
    mesh(cylinder, trunk, g, [0, 5 * size, 0], [0.55 * size, 10 * size, 0.55 * size]);
    for (let i = 0; i < 6; i++)
      mesh(
        cylinder,
        dark,
        g,
        [0, (1 + i * 1.3) * size, 0],
        [0.59 * size, 0.12 * size, 0.59 * size],
      );
    const crown = new THREE.Group();
    g.add(crown);
    crown.position.y = 10 * size;
    crown.rotation.y = t * 37;
    mesh(sphere, leaf, crown, [0, 0, 0], [0.8 * size, 0.34 * size, 0.8 * size]);
    for (let i = 0; i < 9; i++) {
      const reach = size * (0.88 + (i % 3) * 0.08),
        frond = mesh(frondGeometry, leaf, crown, [0, 0, 0], [reach, size, size]);
      frond.rotation.y = (i * Math.PI * 2) / 9 + Math.sin(i * 1.8 + t * 23) * 0.09;
      frond.rotation.z = Math.sin(i * 2.1 + t * 11) * 0.1;
    }
    for (let i = 0; i < 3; i++)
      mesh(
        sphere,
        dark,
        g,
        [(i - 1) * 0.35 * size, 9.6 * size, 0.25 * size],
        [0.33 * size, 0.43 * size, 0.33 * size],
      );
    batch(crown);
    if (wind) {
      windPalms.push({ object: crown, phase: t * 25 });
      animated.push(crown);
    } else batch(g);
  }
  function canopy(t, offset, index) {
    const g = grounded(t, offset, 6);
    if (!g) return;
    groundShadow(g, 11, 8);
    for (const x of [-4.5, 4.5])
      for (const z of [-3, 3]) {
        mesh(cylinder, trunk, g, [x, 2.8, z], [0.14, 5.6, 0.14]);
        mesh(sphere, gold, g, [x, 5.7, z], [0.24, 0.24, 0.24]);
      }
    const roof = mesh(fabricGeometry, index % 2 ? coral : teal, g, [0, 5.3, 0]);
    roof.rotation.x = -Math.PI / 2;
    cloth.push({ object: roof, phase: index * 1.3, baseY: 5.3 });
    animated.push(roof);
    box(dark, g, [0, 0.45, 0], [5.8, 0.9, 2.8]);
    for (let i = 0; i < 5; i++) {
      const pot = mesh(
        new THREE.SphereGeometry(1, 8, 6),
        i % 2 ? ceramic : gold,
        g,
        [-2 + i, 1.4, 0],
        [0.45, 0.62, 0.45],
      );
      mesh(cylinder, dark, g, [pot.position.x, 1.99, 0], [0.2, 0.07, 0.2]);
    }
  }
  function torch(t, offset, index) {
    const g = grounded(t, offset, 1.2);
    if (!g) return;
    groundShadow(g, 3.2, 3.2);
    box(dark, g, [0, 1.25, 0], [1.6, 2.5, 1.6]);
    mesh(cylinder, bronze, g, [0, 3, 0], [0.25, 2, 0.25]);
    mesh(new THREE.CylinderGeometry(0.65, 0.3, 0.6, 8), bronze, g, [0, 4, 0]);
    const flame = mesh(rock, flameMat, g, [0, 4.65, 0], [0.42, 0.85, 0.42]);
    flame.castShadow = false;
    flames.push({ object: flame, phase: index * 1.71 });
    animated.push(flame);
    addGlow(g, { color: "#ffbb65", size: 2.9, opacity: 0.28, position: [0, 4.65, 0] });
  }
  // A shallow edge, a turquoise inner basin, concentric moving ripples and reeds
  // distinguish the optional sandy shore from the main opening road.
  const pond = grounded(sectorT(0, 0.43), -49, 29);
  if (pond) {
    const basin = mesh(new THREE.CircleGeometry(1, 48), water, pond, [0, -0.1, 0], [28, 20, 1]);
    basin.rotation.x = -Math.PI / 2;
    basin.castShadow = false;
    const deep = mesh(
      new THREE.CircleGeometry(1, 48),
      poolDeep,
      pond,
      [-3, -0.085, 0],
      [19, 12.5, 1],
    );
    deep.rotation.x = -Math.PI / 2;
    deep.castShadow = false;
    for (let i = 0; i < 36; i++) {
      const a = (i * Math.PI) / 18,
        x = Math.cos(a) * 27,
        z = Math.sin(a) * 19;
      mesh(rock, i % 3 ? chalk : dark, pond, [x, -0.15, z], [1.5, 0.7, 1.1]);
      for (let j = 0; j < 3; j++) {
        const stalk = mesh(
          cylinder,
          reed,
          pond,
          [x + j * 0.25, 0.6 + (i % 3) * 0.18, z + 0.2],
          [0.045, 1.5 + (i % 3) * 0.35, 0.045],
        );
        stalk.rotation.z = Math.sin(i + j) * 0.13;
        mesh(cone, leaf, pond, [x + j * 0.25, 1, z + 0.3], [0.16, 1.5, 0.12]);
      }
    }
    for (let i = 0; i < 4; i++) {
      const wave = mesh(ring, rippleMat, pond, [-3, 0.015 + i * 0.006, 1], [8, 1, 5]);
      wave.castShadow = false;
      ripples.push({ object: wave, phase: i * 0.25 });
      animated.push(wave);
    }
  }
  for (let i = 0; i < 24; i++)
    palm(sectorT(0, 0.035 + i * 0.04), i % 2 ? 1 : -1, 0.8 + (i % 3) * 0.2, i % 4 === 0);
  for (const [i, f] of [0.13, 0.78].entries()) canopy(sectorT(0, f), i ? -31 : 32, i);
  // Two staggered dune layers frame the oasis opening and put a silhouette
  // above the flat ground. The outer layer stays lower contrast than the palms.
  const horizonSand = material("#d5ad7a", { roughness: 0.95 });
  for (let i = 0; i < 14; i++) {
    const t = sectorT(0, 0.055 + (i % 7) * 0.145),
      outer = i >= 7,
      width = 30 + (i % 3) * 3,
      depth = 21,
      g = grounded(t, outer ? -101 : 65 + (i % 2) * 10, Math.hypot(width, depth));
    if (!g) continue;
    const d = mesh(
      duneGeometry,
      outer ? horizonSand : sandShade,
      g,
      [0, -0.3, 0],
      [width, 23 + (i % 4) * 4, depth],
    );
    d.rotation.y = 0.4 + i * 0.57;
    d.castShadow = false;
  }
  // Paired low markers communicate the shoulder without covering its entrance.
  for (const f of [0.24, 0.37, 0.52, 0.69]) {
    const t = sectorT(0, f),
      g = grounded(t, -(Math.abs(track.surfaceAt(t).leftEdge ?? -9) + 2), 0.6);
    if (!g) continue;
    box(chalk, g, [0, 0.35, 0], [0.65, 0.7, 0.65]);
    mesh(rock, teal, g, [0, 0.85, 0], [0.38, 0.22, 0.38]);
  }
  // Tall irregular rock walls are layered with shelves, crevices and fallen
  // fragments; low shelves leave the S-bend's exit visible from kart height.
  for (let i = 0; i < 28; i++) {
    const t = sectorT(1, (i + 0.5) / 28),
      side = i % 2 ? 1 : -1,
      g = grounded(t, side * 30, 12);
    if (!g) continue;
    const wall = importedRock(
      i % 3 ? "rock-largeb" : "rock-tallb",
      g,
      [0, -4, 0],
      [14, 22 + (i % 3) * 3, 16],
    );
    wall.rotation.y = i * 0.9;
    for (let band = 0; band < 4; band++) {
      const ledge = box(
        band % 2 ? chalk : dark,
        g,
        [0, 1.5 + band * 4, 0],
        [11, 0.4 + (band % 2) * 0.2, 9],
      );
      ledge.rotation.y = i * 0.9;
      if (band < 3) {
        const seam = mesh(
          beddedLayerGeometry(11, band * 5 - 1.5, i * 1.7 + band),
          band % 2 ? dark : stone,
          g,
        );
        seam.rotation.y = i * 0.9;
      }
    }
    for (let j = 0; j < 3; j++)
      mesh(rock, j % 2 ? stone : chalk, g, [-5 + j * 5, -0.2, 7], [2 + j * 0.7, 1.5, 2]);
  }
  for (let i = 0; i < 15; i++) {
    const g = grounded(sectorT(2, (i + 0.5) / 15), -29, 10);
    if (!g) continue;
    importedRock(i % 2 ? "rock-largee" : "rock-largeb", g, [0, -4, 0], [14, 14, 10]);
    box(chalk, g, [0, 1.5, 0], [12, 0.5, 8]);
    for (let j = 0; j < 3; j++) mesh(cone, leaf, g, [-4 + j * 4, 0.7, 3], [0.7, 1.7, 0.7]);
  }
  const { hazard, gearGroup, beacon } = buildTemple({
    THREE,
    animated,
    canopy,
    grounded,
    scenery,
    torch,
    track,
    kit,
    palette,
    geometry,
  });
  // Open wind-sculpted dunes lead back to the oasis, with clear sand-cut entry.
  for (let i = 0; i < 24; i++) {
    const t = sectorT(5, (i + 0.5) / 24),
      side = i % 2 ? 1 : -1;
    const edge = track.surfaceAt(t).rightEdge;
    const g = grounded(t, side > 0 ? edge + 23 : -37, 19);
    if (!g) continue;
    const d = mesh(
      duneGeometry,
      i % 3 ? sand : sandShade,
      g,
      [0, -0.4, 0],
      [17 + (i % 3) * 2, 12 + (i % 4), 14],
    );
    d.rotation.y = i * 0.44;
    if (i % 5 === 0) importedRock("rock-larged", g, [10, -1, 0], [5, 4, 5]);
  }
  for (const f of [0.28, 0.65]) {
    const t = sectorT(5, f),
      g = grounded(t, track.surfaceAt(t).rightEdge + 3, 1.5);
    if (!g) continue;
    box(stone, g, [0, 2.5, 0], [1.3, 5, 1.3]);
    mesh(cone, gold, g, [0, 5.5, 0], [1.2, 1.2, 1.2]);
  }
  // Distant broken watchtowers repeat the temple motif across the horizon.
  for (const [section, f, offset] of [
    [0, 0.22, -75],
    [0, 0.83, -82],
    [1, 0.7, 72],
    [2, 0.46, -66],
    [5, 0.66, 74],
  ]) {
    const g = grounded(sectorT(section, f), offset, 10);
    if (!g) continue;
    for (let i = 0; i < 3; i++)
      box(i % 2 ? gold : stone, g, [0, 3 + i * 5, 0], [14 - i * 3, 6, 14 - i * 3]);
    for (const x of [-4, 4]) box(dark, g, [x, 17, 0], [2, 6, 2]);
    box(chalk, g, [0, 13, 0], [10, 0.8, 10]);
  }
  // Sand motes stay beside the canyon and dune sector, below eye-level opacity.
  const dustPositions = [];
  for (let i = 0; i < 64; i++) {
    const t = sectorT(i < 32 ? 1 : 5, ((i % 32) + 0.5) / 32),
      side = i % 2 ? 1 : -1;
    const edge = track.surfaceAt(t),
      offset = side > 0 ? edge.rightEdge + 8 : -(Math.abs(edge.leftEdge ?? -9) + 8);
    const p = track.poseAt(t * track.TRACK, offset, 1.5 + (i % 5) * 0.55).p;
    dustPositions.push(p.x, p.y, p.z);
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute("position", new THREE.Float32BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      color: "#ffe5b0",
      size: 0.16,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
    }),
  );
  scenery.add(dust);
  animated.push(dust);
  for (let i = 0; i < 3; i++) {
    const g =
      grounded(sectorT(2, 0.3 + i * 0.17), i % 2 ? -55 : 52, 2) ||
      groupAt(sectorT(2, 0.3 + i * 0.17), 52);
    g.position.y += 24 + i * 3;
    const b = mesh(wingGeometry, birdMat, g);
    b.castShadow = false;
    birds.push({
      object: g,
      wing: b,
      baseX: g.position.x,
      baseZ: g.position.z,
      baseY: g.position.y,
      phase: i * 2,
    });
    animated.push(g);
  }
  return {
    animated,
    update(time) {
      const pose = hazardAt(time);
      align(hazard, pose);
      gearGroup.rotation.y = time * 0.35;
      rune.emissiveIntensity = pose.warning ? 0.9 + 0.6 * Math.sin(time * 10) : 0.5;
      beacon.scale.setScalar(pose.warning ? 1.12 : 1);
      for (const p of windPalms) {
        p.object.rotation.z = Math.sin(time * 0.9 + p.phase) * 0.035;
        p.object.rotation.x = Math.cos(time * 0.73 + p.phase) * 0.028;
      }
      for (const c of cloth) {
        c.object.rotation.z = Math.sin(time * 1.3 + c.phase) * 0.024;
        c.object.position.y = c.baseY + Math.sin(time * 1.5 + c.phase) * 0.09;
      }
      for (const f of flames) {
        const pulse = 1 + Math.sin(time * 8 + f.phase) * 0.13;
        f.object.scale.set(0.42 / pulse, 0.85 * pulse, 0.42 / pulse);
        f.object.rotation.y = time * 0.5 + f.phase;
      }
      for (const r of ripples) {
        const phase = (time * 0.12 + r.phase) % 1;
        r.object.scale.set(3 + phase * 14, 1, 2 + phase * 9);
        r.object.visible = phase > 0.035;
      }
      for (const b of birds) {
        const a = time * 0.14 + b.phase;
        b.object.position.set(
          b.baseX + Math.cos(a) * 13,
          b.baseY + Math.sin(time * 0.4 + b.phase) * 1.5,
          b.baseZ + Math.sin(a) * 13,
        );
        b.object.rotation.y = -a;
        b.wing.scale.y = 0.6 + Math.sin(time * 3 + b.phase) * 0.4;
      }
      dust.position.x = Math.sin(time * 0.15) * 2;
      dust.position.z = Math.cos(time * 0.12) * 1.2;
    },
  };
}
