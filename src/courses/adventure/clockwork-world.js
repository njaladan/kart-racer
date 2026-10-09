import { buildClockworkCity } from "./clockwork-city.js";
import { buildClockworkAviation } from "./clockwork-aviation.js";
import { worldKit } from "./world-kit.js";
import { createClockworkClearance } from "./clockwork-clearance.js";
import { architecturalDetail } from "./architectural-detail.js";
import { registerLightPool } from "../../rendering/course-lighting.js";
import { addGlow, createContactShadowMesh } from "../../rendering/visual-effects.js";

/** The climb is built through a working fortress, not around a scenic cylinder. */
export function buildClockwork(context) {
  const w = worldKit(context),
    { THREE, scene, track, mat, mesh, box, at, motion, cylinder, torus, sphere } = w;
  const allows = createClockworkClearance(track);
  // Move complete assemblies outwards until their full volume clears every
  // floor, rather than trusting the center's distance to one nearby ribbon.
  function clearAt(section, fraction, offset, center, size) {
    for (let step = 0; step < 8; step++) {
      const g = at(section, fraction, offset + Math.sign(offset) * step * 8);
      const f = track.frameAt(track.sectorT(section, fraction));
      g.rotation.set(0, track.yawFor(f.tangent), 0);
      g.position.y = f.p.y;
      const bottom = Math.min(
        center[1] - size[1] / 2,
        track.course.theme.groundHeight - g.position.y,
      );
      const top = center[1] + size[1] / 2;
      if (allows(g, [center[0], (bottom + top) / 2, center[2]], [size[0], top - bottom, size[2]]))
        return g;
      g.removeFromParent();
    }
    return null;
  }
  function supportBox(material, parent, position, size) {
    if (allows(parent, position, size)) return box(material, parent, position, size);
    return null;
  }
  const bronze = architecturalDetail(
      mat("#e4b85a", "metal", { metalness: 0.72, roughness: 0.34 }),
      "metal",
    ),
    iron = architecturalDetail(
      mat("#46566c", "metal", { metalness: 0.35, roughness: 0.65 }),
      "metal",
    ),
    pale = architecturalDetail(mat("#c2b2a6")),
    masonry = architecturalDetail(mat("#927754")),
    dark = mat("#293444", "metal"),
    copper = mat("#b7894b", "metal", { metalness: 0.65 }),
    glow = mat("#ffdf9e", "metal", { emissive: "#ffb865", emissiveIntensity: 1.3 }),
    cloth = mat("#8d3f46", "fabric", { side: THREE.DoubleSide });
  const arch = new THREE.TorusGeometry(1, 0.14, 6, 20, Math.PI);
  const cone = new THREE.ConeGeometry(1, 1, 12);
  const shade = (g, width, depth) => {
    const s = createContactShadowMesh({ width, depth, opacity: 0.32 });
    s.position.y = 0.07;
    g.add(s);
  };
  const lamp = (g, position, radius = 13) => {
    box(dark, g, [position[0], position[1] - 1, position[2]], [0.9, 0.5, 0.9]);
    mesh(sphere, glow, g, position, [0.5, 0.7, 0.5]);
    addGlow(g, { color: "#ffc17b", size: 2.5, opacity: 0.13, position });
    g.updateWorldMatrix(true, false);
    registerLightPool(scene, {
      position: g.localToWorld(new THREE.Vector3(...position)),
      color: "#ffc282",
      intensity: 16,
      radius,
    });
  };
  function pipe(g, a, b, radius = 0.4, material = copper) {
    const va = new THREE.Vector3(...a),
      vb = new THREE.Vector3(...b),
      d = vb.clone().sub(va);
    const p = mesh(cylinder, material, g, va.clone().add(vb).multiplyScalar(0.5).toArray(), [
      radius,
      d.length(),
      radius,
    ]);
    p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return p;
  }
  const gearBatches = new Map();
  function gear(parent, position, radius, speed, teeth = 28) {
    const root = new THREE.Group();
    parent.add(root);
    root.position.set(...position);
    root.userData.clockworkGear = true;
    const part = mesh(
      context.kit.authoredGeometry(`blender:gear-${teeth}`, [2, 2, 1]),
      bronze,
      root,
      [0, 0, 0],
      [radius, radius, 1.8],
    );
    part.updateMatrix();
    const entries = gearBatches.get(teeth) || [];
    gearBatches.set(teeth, entries);
    entries.push({ root, part, local: part.matrix.clone() });
    motion(root, (time, state) => {
      root.rotation.z = (state?.motionEnabled === false ? 0 : time) * speed;
    });
    return root;
  }
  // Visible giant meshed gears have fixed pivots, varied tooth counts and speed.
  for (const section of [0, 1, 3, 4, 5, 6, 7])
    for (let i = 0; i < 6; i++) {
      const g = clearAt(section, 0.08 + i * 0.17, i % 2 ? -48 : 48, [0, 12, 0], [32, 40, 8]);
      if (!g) continue;
      g.name = "Gallery gear train";
      const foot = track.course.theme.groundHeight - g.position.y;
      if (foot < -1.5)
        for (const x of [-13, 13]) box(iron, g, [x, (foot - 1.5) / 2, 0], [2, -1.5 - foot, 5]);
      gear(g, [0, 12, 0], 9 + (i % 2) * 2, i % 2 ? -0.13 : 0.11);
      gear(g, [9.5, 20, 1.5], 5, i % 2 ? 0.24 : -0.22, 20);
      for (const side of [-1, 1]) box(iron, g, [side * 13, 12, 0], [2, 27, 5]);
      box(bronze, g, [0, 26, 0], [29, 1.2, 4]);
      pipe(g, [-13, 27, 0], [13, 27, 0], 0.7);
      lamp(g, [-11, 4, -3], 16);
    }
  // Stacked racing galleries have connected subdecks and diagonals, never
  // ground hills stretched up into the elevated road.
  for (let section = 0; section <= 7; section++) {
    if (section === track.course.watchBowl?.section) continue;
    const count = Math.ceil(
      ((track.SECTIONS[section].end - track.SECTIONS[section].start) * track.COURSE_LENGTH) / 8,
    );
    for (let i = 0; i < count; i++) {
      const g = at(section, (i + 0.5) / count),
        f = track.frameAt(track.sectorT(section, (i + 0.5) / count));
      const t = track.sectorT(section, (i + 0.5) / count);
      const left = track.platformEdgeAt(t, -1),
        right = track.platformEdgeAt(t, 1);
      supportBox(iron, g, [(left + right) / 2, -1.1, 0], [right - left, 1.6, 9.3]);
      for (const side of [-1, 1]) {
        if (i % 2 === 0) {
          pipe(g, [side * 10, -1, -4], [side * 2, -1, 4], 0.45, iron);
        }
        if (i % 7 === 0) {
          const x = (side < 0 ? left : right) + side * 1.5;
          pipe(g, [x, -1, 0], [x, 2.2, 0], 0.1, iron);
          lamp(g, [x, 2.4, 0]);
        }
      }
      if (i % 4 === 0 && section >= 4) {
        const height = Math.max(0.5, f.p.y - track.course.theme.groundHeight - 2);
        supportBox(masonry, g, [0, -height / 2 - 2, 0], [7, height, 7]);
        for (const side of [-1, 1]) pipe(g, [side * 8, -2, 0], [0, -12, 0], 0.8, bronze);
      }
    }
  }
  // The clock face is a full building facade seen across the upper balcony.
  const clock = clearAt(3, 0.46, -60, [0, 26, -3], [68, 84, 26]);
  if (clock) {
    clock.name = "Clock face facade";
    const bottom = track.course.theme.groundHeight - clock.position.y;
    if (bottom < -13.5) box(masonry, clock, [0, (bottom - 13.5) / 2, -5], [56, -13.5 - bottom, 15]);
    box(masonry, clock, [0, 17, -5], [56, 61, 15]);
    for (const x of [-28, 28]) {
      box(pale, clock, [x, 18, -3], [8, 68, 20]);
      mesh(cone, copper, clock, [x, 56, -3], [7, 14, 7]);
      lamp(clock, [x, 7, 8], 23);
    }
    mesh(new THREE.CircleGeometry(23, 64), pale, clock, [0, 26, 3]);
    mesh(torus, bronze, clock, [0, 26, 4], [24, 24, 24]);
    for (let i = 0; i < 60; i++) {
      const a = (i * Math.PI) / 30,
        tick = box(
          i % 5 === 0 ? dark : bronze,
          clock,
          [Math.sin(a) * 20.5, 26 + Math.cos(a) * 20.5, 4.1],
          [i % 5 === 0 ? 0.9 : 0.3, i % 5 === 0 ? 3 : 1.3, 0.25],
        );
      tick.rotation.z = -a;
    }
    const hands = new THREE.Group();
    clock.add(hands);
    hands.position.set(0, 26, 4.4);
    box(dark, hands, [0, 7.5, 0], [0.65, 15, 0.5]);
    box(bronze, hands, [4.5, 0, 0.3], [9, 1, 0.5]);
    mesh(sphere, bronze, hands, [0, 0, 0.6], [1, 1, 0.5]);
    motion(hands, (time) => {
      hands.rotation.z = -time * 0.05;
    });
  }
  // Foundry neighborhoods: nested roofs, arched shops, pipes, courtyards,
  // repair awnings and chimneys create near, middle and distant silhouettes.
  function building(g, i, size = 1) {
    if (context.kit.hasAsset("art:old-house")) {
      context.kit.asset("art:old-house", g, [0, 0, 0], [24 * size, 24 * size, 24 * size]);
      shade(g, 28 * size, 25 * size);
      return;
    }
    const root = new THREE.Group();
    g.add(root);
    root.scale.setScalar(size);
    box(masonry, root, [0, 8, 0], [17, 16, 19]);
    box(pale, root, [0, 1, 0], [19, 2, 21]);
    box(bronze, root, [0, 17, 0], [20, 2, 22]);
    mesh(cone, copper, root, [0, 23, 0], [14, 11, 14]).rotation.y = Math.PI / 4;
    for (const x of [-5, 0, 5])
      for (const y of [5, 11]) {
        box(dark, root, [x, y, -9.6], [3.3, 4, 0.3]);
        box(glow, root, [x, y, -9.85], [2.2, 2.8, 0.15]);
        box(pale, root, [x, y - 2.2, -10], [4, 0.6, 1]);
      }
    mesh(arch, pale, root, [0, 3, -10], [3, 3, 1]);
    box(dark, root, [0, 1.5, -9.9], [5, 3, 0.3]);
    for (const x of [-9, 9]) pipe(root, [x, 0, -10], [x, 19, -10], 0.35);
    const awning = box(cloth, root, [0, 5, -12], [13, 0.2, 6]);
    awning.rotation.x = -0.15;
    for (const x of [-6, 6]) box(bronze, root, [x, 2.5, -14], [0.18, 5, 0.18]);
    mesh(cylinder, iron, root, [6, 23, 5], [1.5, 17, 1.5]);
    box(bronze, root, [6, 32, 5], [4, 1.5, 4]);
    if (i % 2 === 0) gear(root, [9, 12, 1], 3, 0.13, 16);
    for (let j = 0; j < 3; j++) mesh(cylinder, copper, root, [-6 + j * 5, 1.6, -15], [1, 3, 1]);
    shade(root, 23, 23);
  }
  buildClockworkCity(w, {
    allows,
    building,
    gear,
    pipe,
    lamp,
    bronze,
    iron,
    pale,
    masonry,
    dark,
    copper,
    glow,
  });
  buildClockworkAviation(w, { bronze, iron, copper, glow, cloth, pipe });
  // All working gears share three draws, with each pivot retaining its own
  // rate and direction. Dense machinery no longer needs one draw per rotor.
  for (const [teeth, entries] of gearBatches) {
    const instances = new THREE.InstancedMesh(entries[0].part.geometry, bronze, entries.length);
    instances.name = `Animated ${teeth}-tooth city gear instances`;
    instances.castShadow = instances.receiveShadow = true;
    instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    w.scenery.add(instances);
    entries.forEach(({ part }) => part.removeFromParent());
    const matrix = new THREE.Matrix4();
    const update = () => {
      entries.forEach(({ root, local }, i) => {
        root.updateWorldMatrix(true, false);
        instances.setMatrixAt(i, matrix.copy(root.matrixWorld).multiply(local));
      });
      instances.instanceMatrix.needsUpdate = true;
      instances.computeBoundingSphere();
    };
    update();
    motion(instances, update);
  }
  w.points("#ffd47d", [0, 1, 2, 3, 4, 5, 6, 7], 360, 0.2);
  return w.finish();
}
