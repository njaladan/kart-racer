import { registerLightPool } from "../../rendering/course-lighting.js";
import { createContactShadowMesh, addGlow } from "../../rendering/visual-effects.js";
import { placeRock } from "./ruins-assets.js";
import { addRuinsDressing } from "./add-ruins-dressing.js";
import { carvedSandstone, sunShaft } from "./sunstone-materials.js";

/** Authored foreground/midground/horizon clusters, lit interiors and wildlife. */
export function buildExpeditionLife({
  THREE,
  scene,
  scenery,
  track,
  kit,
  textures,
  palette,
  animated,
  motions,
}) {
  const { mesh, box, material, groupAt, sectorT } = kit;
  const { stone, pale, dark, sand, gold, teal, glow } = palette;
  const cloth = material("#b75740", { map: textures.fabric, side: THREE.DoubleSide });
  const leaf = material("#92ac6d", { map: textures.leaves, side: THREE.DoubleSide });
  const cool = material("#697c91", { bumpMap: textures.stone, bumpScale: 0.045 });
  const silt = material("#d4aa71", { bumpMap: textures.sand, bumpScale: 0.04 });
  carvedSandstone(stone, { carved: true });
  carvedSandstone(pale, { carved: true });
  carvedSandstone(dark, { carved: true });
  carvedSandstone(silt);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12),
    sphere = new THREE.SphereGeometry(1, 12, 8);
  const cone = new THREE.ConeGeometry(1, 1, 8),
    dune = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const safe = (t, offset, footprint = 4) => kit.safeGroup(t, offset, footprint);
  const motion = (object, fn) => {
    animated.push(object);
    motions.push(fn);
  };
  const shadow = (g, width = 8, depth = 7, opacity = 0.3) => {
    const m = createContactShadowMesh({ width, depth, opacity });
    m.position.y = 0.04;
    g.add(m);
  };
  // Restore real textured focal assets, layered beds and material transitions,
  // adapted to the new route instead of transplanting the old temple layout.
  const mapping = [0, 1, 2, 3, 5, 6];
  addRuinsDressing({
    kit: { ...kit, sectorT: (s, f) => sectorT(mapping[s], f) },
    track,
    grounded: safe,
    groundShadow: shadow,
    duneGeometry: dune,
    sand,
    sandShade: silt,
  });
  // Oasis: reed fringe, merchant rugs, pottery stalls, sailing cloth and herons.
  for (let i = 0; i < 18; i++) {
    const t = sectorT(0, (i + 0.5) / 18),
      g = safe(t, (i % 2 ? 1 : -1) * (22 + (i % 4) * 3), 5);
    if (!g) continue;
    shadow(g, 11, 9);
    for (let j = 0; j < 4; j++) {
      kit.asset("ruins:grass", g, [-3 + j * 2, 0, (j % 2) * 3], [1.5, 1.5, 1.5]);
      kit.asset("ruins:shrub", g, [-1 + j, 0, -3], [1.7, 1.4, 1.7]);
    }
    if (i % 3 === 0) {
      const roof = mesh(new THREE.PlaneGeometry(9, 7, 8, 5), i % 2 ? cloth : teal, g, [0, 5.8, 0]);
      roof.rotation.x = -Math.PI / 2;
      roof.rotation.z = 0.07;
      motion(roof, (time) => {
        roof.position.y = 5.8 + Math.sin(time * 1.5 + i) * 0.12;
      });
      for (const x of [-4, 4])
        for (const z of [-3, 3]) mesh(cylinder, gold, g, [x, 2.8, z], [0.1, 5.6, 0.1]);
      box(dark, g, [0, 0.4, 0], [7, 0.8, 2.5]);
      for (let j = 0; j < 6; j++) {
        const vase = kit.asset(
          "ruins:vase",
          g,
          [-2.8 + j * 1.1, 0.8, 0],
          [0.6 + (j % 3) * 0.15, 0.8 + (j % 3) * 0.15, 0.7],
        );
        vase.rotation.y = j * 0.71;
      }
      const rug = mesh(new THREE.PlaneGeometry(8, 5), cloth, g, [0, 0.065, 4]);
      rug.rotation.x = -Math.PI / 2;
    }
  }
  // Distant dunes and broken watchtowers fill the entire expedition's skyline.
  for (let section = 0; section < 8; section++)
    for (let i = 0; i < 6; i++) {
      const t = sectorT(section, (i + 0.5) / 6),
        side = i % 2 ? 1 : -1,
        g = safe(t, side * (135 + (i % 3) * 38), 60 + (i % 3) * 14);
      if (!g) continue;
      const hill = mesh(
        dune,
        i % 2 ? silt : sand,
        g,
        [0, -2, 0],
        [60 + (i % 3) * 14, 24 + (i % 4) * 8, 48],
      );
      hill.rotation.y = i * 0.9 + section;
      hill.castShadow = false;
      hill.userData.bakeReceiver = true;
      if (i % 3 === 0) {
        const ruin = kit.asset("ruins:ruined-house", g, [0, 16, 0], [22, 22, 22]);
        ruin.rotation.y = 0.35 + i;
      }
    }
  // Mesa is now a sculpted landscape with buttresses, textured eroded shelves,
  // trailing grasses and archaeological fragments visible from the kart camera.
  for (let i = 0; i < 22; i++) {
    const t = sectorT(2, (i + 0.5) / 22),
      side = i % 2 ? 1 : -1,
      g = groupAt(t, side * 29);
    placeRock(kit, "ruins:cliff", g, [0, -27, 0], [24, 44 + (i % 4) * 5, 22]);
    placeRock(kit, "ruins:boulder", g, [-side * 7, -1, 0], [7, 4, 8]);
    if (i % 3 === 0) {
      kit.asset("ruins:shrub", g, [-side * 9, 1, 1], [2.5, 2, 2.5]);
      kit.asset("ruins:grass", g, [-side * 7, 2, -2], [2, 2, 2]);
    }
    if (i % 4 === 0) box(pale, g, [side * 5, 12, 0], [3, 24, 3]);
  }
  for (const [section, f, side] of [
    [1, 0.18, 1],
    [1, 0.78, -1],
    [2, 0.2, 1],
    [2, 0.75, -1],
    [6, 0.4, -1],
  ]) {
    const g = safe(sectorT(section, f), side * 66, 24);
    if (!g) continue;
    placeRock(kit, "ruins:cliff", g, [0, -5, 0], [32, 58, 26]);
    placeRock(kit, "ruins:boulder", g, [-15, 0, 12], [17, 12, 18]);
  }
  // The monumental complex has actual recesses, eaves, stairs and textured
  // sculptural silhouettes rather than a lone block pyramid off the road.
  for (let i = 0; i < 8; i++) {
    const t = sectorT(3, (i + 0.5) / 8),
      side = i % 2 ? 1 : -1,
      g = safe(t, side * (49 + (i % 3) * 13), 21);
    if (!g) continue;
    shadow(g, 35, 28, 0.35);
    const shrine = kit.asset(
      i % 3 ? "ruins:shrine" : "ruins:ruined-house",
      g,
      [0, 0, 0],
      [22 + (i % 3) * 5, 22 + (i % 3) * 5, 22 + (i % 3) * 5],
    );
    shrine.rotation.y = (side * Math.PI) / 2;
    for (const x of [-12, 12]) kit.asset("ruins:dragon", g, [x, 1, -15], [8, 8, 8]);
    for (let j = 0; j < 4; j++)
      box(stone, g, [0, -0.5 + j * 0.6, -20 - j * 2], [24 - j * 3, 1.2, 4]);
  }
  // Carved relief panels and diagonal shadow galleries are authored at eye
  // height, with varied motifs so a passage is rich without unreadable clutter.
  for (let section = 3; section <= 5; section++)
    for (let i = 0; i < 18; i++) {
      const t = sectorT(section, (i + 0.5) / 18),
        g = groupAt(t),
        side = i % 2 ? 1 : -1,
        edge = side < 0 ? -track.surfaceAt(t).leftEdge : track.surfaceAt(t).rightEdge,
        x = side * (section === 4 ? Math.max(14.7, edge + 2.7) : 18.5);
      const panel = box(dark, g, [x, 6, 0], [0.25, 7, 5.5]);
      panel.name = "Carved solar history relief";
      for (const y of [2.4, 9.6]) box(gold, g, [x - side * 0.2, y, 0], [0.12, 0.2, 5.8]);
      for (let j = 0; j < 5; j++) {
        const q = box(
          i % 3 ? stone : gold,
          g,
          [x - side * 0.26, 3.5 + (j % 3) * 1.8, -1.8 + j * 0.9],
          [0.13, 0.8, 0.62],
        );
        q.rotation.x = (j % 2 ? 1 : -1) * 0.6;
        if (j % 2) mesh(sphere, pale, g, [x - side * 0.3, 7.5, -1.8 + j * 0.9], [0.11, 0.33, 0.33]);
      }
      if (section === 3 && i % 2 === 0) {
        box(stone, g, [0, 24, 0], [41, 2, 2.6]);
        for (let j = 0; j < 6; j++) box(pale, g, [-12 + j * 4, 25, 0], [1, 2, 3]);
      }
      if (section === 5 && i % 3 === 0) {
        const statue = kit.asset("ruins:dragon", g, [side * 25, 0, 0], [12, 12, 12]);
        statue.rotation.y = (-side * Math.PI) / 2;
      }
    }
  // Slotted temple roof: warm shafts, cool occluded stone, amber lamp pools.
  for (let i = 0; i < 9; i++) {
    const t = sectorT(4, 0.06 + i * 0.105),
      g = groupAt(t);
    const lamp = kit.asset("ruins:torch", g, [-12.7, 0, 0], [4.8, 4.8, 4.8]);
    lamp.rotation.y = 0.4;
    const flame = mesh(cone, glow, g, [-12.7, 5.1, 0], [0.45, 1.1, 0.45]);
    motion(flame, (time) => {
      flame.scale.y = 1.1 + Math.sin(time * 9 + i) * 0.18;
    });
    addGlow(g, { color: "#ffb45e", size: 3.5, opacity: 0.27, position: [-12.7, 5.2, 0] });
    g.updateWorldMatrix(true, false);
    registerLightPool(scene, {
      position: g.localToWorld(new THREE.Vector3(-12.7, 5.2, 0)),
      color: "#ffad58",
      intensity: 35,
      radius: 19,
    });
    if (i % 2 === 0) {
      const shaft = sunShaft(THREE, { width: 4, height: 20, color: "#ffd088" });
      shaft.position.set(2, 10, 0);
      g.add(shaft);
      animated.push(shaft);
    }
    for (const side of [-1, 1]) {
      const edge = side < 0 ? -track.surfaceAt(t).leftEdge : track.surfaceAt(t).rightEdge;
      mesh(cylinder, cool, g, [side * Math.max(16, edge + 3), 9, 0], [0.28, 18, 0.28]);
    }
  }
  // Floor mosaics and weathered fragments put tactile detail beside the line.
  for (let section = 0; section < 8; section++)
    for (let i = 0; i < 20; i++) {
      const t = sectorT(section, (i + 0.5) / 20),
        side = i % 2 ? 1 : -1,
        g = groupAt(t, side * (track.roadHalfWidth(t) + 0.9));
      const color = i % 3 ? stone : pale;
      box(color, g, [0, 0.15, 0], [0.8, 0.3, 3]);
      if (i % 5 === 0) {
        const root = safe(t, side * (track.roadHalfWidth(t) + 5), 2.3);
        if (root) {
          shadow(root, 5, 4);
          placeRock(kit, "ruins:boulder", root, [0, 0, 0], [3, 1.3, 2.5]);
          kit.asset("ruins:shrub", root, [1.2, 0, -0.8], [1.2, 1.2, 1.2]);
        }
      }
    }
  // Flocks circling the mesa and oasis animate as coherent groups, not random
  // decorative particles. Their wings and banking make motion readable.
  const wingGeometry = new THREE.BufferGeometry();
  wingGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [0, 0, 0, -1.7, 0.2, 0.3, -0.3, 0, -0.2, 0, 0, 0, 0.3, 0, -0.2, 1.7, 0.2, 0.3],
      3,
    ),
  );
  wingGeometry.computeVertexNormals();
  const birdMat = material("#4b5b6d", { side: THREE.DoubleSide });
  for (let flock = 0; flock < 3; flock++) {
    const g = groupAt(sectorT(flock === 0 ? 0 : 2, 0.25 + flock * 0.2), flock % 2 ? 55 : -55);
    g.position.y += 28;
    const base = g.position.clone(),
      wings = [];
    for (let i = 0; i < 5; i++) {
      const b = mesh(wingGeometry, birdMat, g, [i * 2.8, (i % 2) * 1.4, i * 2], [1, 1, 1]);
      b.castShadow = false;
      wings.push(b);
    }
    motion(g, (time) => {
      const a = time * 0.12 + flock * 2;
      g.position
        .copy(base)
        .add(
          new THREE.Vector3(Math.cos(a) * 25, Math.sin(time * 0.35 + flock) * 2, Math.sin(a) * 25),
        );
      g.rotation.y = -a;
      for (const [i, b] of wings.entries()) b.scale.y = 0.35 + Math.sin(time * 4.5 + i) * 0.65;
    });
  }
  // Small reptiles move between warm stone and shade at the oasis margin.
  for (let i = 0; i < 6; i++) {
    const g = safe(sectorT(0, 0.1 + i * 0.14), i % 2 ? 17 : -18, 1);
    if (!g) continue;
    const lizard = new THREE.Group();
    g.add(lizard);
    mesh(sphere, leaf, lizard, [0, 0.18, 0], [0.45, 0.14, 0.9]);
    mesh(cone, leaf, lizard, [0, 0.18, 0.8], [0.1, 0.9, 0.1]).rotation.x = Math.PI / 2;
    for (const x of [-0.35, 0.35])
      for (const z of [-0.3, 0.3]) box(leaf, lizard, [x, 0.12, z], [0.35, 0.08, 0.15]);
    motion(lizard, (time) => {
      lizard.position.z = Math.sin(time * 0.5 + i) * 1.2;
      lizard.rotation.y = Math.sin(time * 0.5 + i) * 0.15;
    });
  }
  return { shadow };
}
