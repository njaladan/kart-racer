import { registerLightPool } from "../rendering/course-lighting.js";
import { createWaterMaterial, installSurfaceDetail } from "../rendering/surface-detail.js";
import { addRuinsDressing } from "./sunstone-ruins/add-ruins-dressing.js";
import { placeRock } from "./sunstone-ruins/ruins-assets.js";
import { buildTemple } from "./sunstone-ruins/build-temple.js";
import { createDesertGeometry } from "./sunstone-ruins/create-desert-geometry.js";
// Sunstone has a quiet expedition rhythm: moving water and cloth in the oasis,
// rock strata on the climb, monumental carved architecture, then open dunes.
import { addGlow, createContactShadowMesh } from "../rendering/visual-effects.js";

export function buildWorld(context) {
  const { THREE, scenery, track, kit, hazardAt, textures = {} } = context;
  const scene = context.scene || scenery;
  const { material, mesh, box, groupAt, sectorT, align } = kit;
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
  const water = createWaterMaterial({
    scene,
    color: "#4aada8",
    roughness: 0.2,
    shoreRadius: 26,
    foam: true,
  });
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
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const cone = new THREE.ConeGeometry(1, 1, 8);
  const rock = new THREE.IcosahedronGeometry(1, 0);
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  const ring = new THREE.RingGeometry(0.93, 1, 40);
  ring.rotateX(-Math.PI / 2);
  for (const m of [sand, sandShade, stone, dark, gold, chalk])
    installSurfaceDetail(m, { kind: "terrain", scale: 0.065, strength: 0.15 });
  function importedRock(name, parent, position, size) {
    // These downloaded rock silhouettes are eroded, UV-unwrapped and textured
    // offline; the runtime only instances their rounded, stratified GLBs.
    const model = placeRock(
      kit,
      name === "rock-tallb" ? "ruins:cliff" : "ruins:boulder",
      parent,
      position,
      size,
    );
    return model;
  }
  const palette = { bronze, chalk, cool, dark, gold, rune, stone };
  const geometry = { cone, cylinder, rock, sphere };
  const { duneGeometry, fabricGeometry, wingGeometry, birdMat } = createDesertGeometry({
    THREE,
    kit,
  });
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
    groundShadow(g, 6.8 * size, 6.8 * size);
    const tree = kit.asset("ruins:palm", g, [0, 0, 0], [12 * size, 12 * size, 12 * size]);
    tree.rotation.y = t * 37;
    if (wind) {
      windPalms.push({ object: tree, phase: t * 25 });
      animated.push(tree);
    }
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
    for (let i = 0; i < 4; i++) {
      const pot = kit.asset("ruins:vase", g, [-2.4 + i * 1.5, 0.9, 0], [0.8, 0.8, 0.8]);
      pot.rotation.y = i * 1.31;
    }
  }

  function torch(t, offset, index) {
    const g = grounded(t, offset, 1.2);
    if (!g) return;
    groundShadow(g, 3.2, 3.2);
    kit.asset("ruins:torch", g, [0, 0, 0], [4.3, 4.3, 4.3]);
    g.updateWorldMatrix(true, false);
    const lightPosition = g.localToWorld(new THREE.Vector3(0, 4.5, 0));
    registerLightPool(scene, {
      position: lightPosition,
      color: "#ffaa55",
      intensity: 28,
      radius: 13,
    });
    const pool = createContactShadowMesh({ width: 12, depth: 12, opacity: 0.24 });
    pool.material = pool.material.clone();
    pool.material.color.set("#d4944b");
    pool.material.blending = THREE.AdditiveBlending;
    pool.position.y = 0.05;
    g.add(pool);
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
      if (i % 3 === 0) placeRock(kit, "ruins:boulder", pond, [x, -0.1, z], [1.5, 0.8, 1.2]);
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
    d.userData.bakeReceiver = true;
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
    for (let j = 0; j < 3; j++)
      placeRock(kit, "ruins:boulder", g, [-5 + j * 5, -0.2, 7], [2 + j * 0.7, 1.5, 2]);
  }
  for (let i = 0; i < 15; i++) {
    const g = grounded(sectorT(2, (i + 0.5) / 15), -29, 10);
    if (!g) continue;
    importedRock(i % 2 ? "rock-largee" : "rock-largeb", g, [0, -2, 0], [14, 14, 10]);
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
    d.userData.bakeReceiver = true;
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
    const g = grounded(sectorT(section, f), offset, 16);
    if (!g) continue;
    const tower = kit.asset("ruins:ruined-house", g, [0, 0, 0], [18, 18, 18]);
    tower.rotation.y = section * 0.73;
  }
  addRuinsDressing({ ...context, grounded, groundShadow, duneGeometry, sand, sandShade, animated });

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
