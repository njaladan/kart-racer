import { worldKit } from "./world-kit.js";
import { architecturalDetail } from "./architectural-detail.js";
import { liftPhase, traversalPose } from "../../simulation/course-mechanics.js";
import { registerLightPool } from "../../rendering/course-lighting.js";
import { addGlow, createContactShadowMesh } from "../../rendering/visual-effects.js";

/** The climb is built through a working fortress, not around a scenic cylinder. */
export function buildClockwork(context) {
  const w = worldKit(context),
    { THREE, scene, scenery, track, mat, mesh, box, at, motion, cylinder, torus, sphere } = w;
  const bronze = architecturalDetail(
      mat("#c69657", "metal", { metalness: 0.64, roughness: 0.4 }),
      "metal",
    ),
    iron = architecturalDetail(
      mat("#46566c", "metal", { metalness: 0.35, roughness: 0.65 }),
      "metal",
    ),
    pale = architecturalDetail(mat("#c2b2a6")),
    masonry = architecturalDetail(mat("#7b707c")),
    dark = mat("#293444", "metal"),
    copper = mat("#788f91", "metal", { metalness: 0.5 }),
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
  function gear(parent, position, radius, speed, teeth = 28) {
    const root = new THREE.Group();
    parent.add(root);
    root.position.set(...position);
    mesh(torus, bronze, root, [0, 0, 0], [radius, radius, radius]);
    mesh(
      new THREE.CylinderGeometry(1, 1, 1, 24),
      iron,
      root,
      [0, 0, 0],
      [radius * 0.23, 1.8, radius * 0.23],
    ).rotation.x = Math.PI / 2;
    for (let j = 0; j < teeth; j++) {
      const a = (j * Math.PI * 2) / teeth;
      const tooth = box(
        bronze,
        root,
        [Math.cos(a) * radius, Math.sin(a) * radius, 0],
        [radius * 0.13, radius * 0.11, 1.8],
      );
      tooth.rotation.z = a;
      if (j % 4 === 0) {
        const spoke = box(
          copper,
          root,
          [Math.cos(a) * radius * 0.5, Math.sin(a) * radius * 0.5, 0],
          [radius, 0.55, 0.6],
        );
        spoke.rotation.z = a;
      }
    }
    context.kit.batch(root);
    motion(root, (time) => {
      root.rotation.z = time * speed;
    });
    return root;
  }
  // Perforated bastion: window bays expose shafts and moving gear trains.
  const tower = new THREE.Group();
  scenery.add(tower);
  tower.name = "The hollow clockwork bastion";
  for (let tier = 0; tier < 7; tier++) {
    const y = tier * 15 - 12;
    mesh(cylinder, tier % 2 ? bronze : iron, tower, [0, y, 0], [54, 1.7, 54]);
    for (let bay = 0; bay < 12; bay++) {
      const a = (bay * Math.PI) / 6,
        g = new THREE.Group();
      tower.add(g);
      g.position.set(Math.sin(a) * 49, y, Math.cos(a) * 49);
      g.rotation.y = a;
      for (const side of [-1, 1]) {
        box(pale, g, [side * 10, 7.5, 0], [3, 15, 5]);
        box(bronze, g, [side * 10, 1, 0], [4, 2, 6]);
      }
      box(masonry, g, [0, 2.7, -1.5], [18, 5.4, 3]);
      box(pale, g, [0, 14, 0], [22, 2.4, 5]);
      const ar = mesh(arch, bronze, g, [0, 9.4, 0.6], [7.2, 4.3, 1]);
      ar.castShadow = true;
      for (const x of [-6.2, 0, 6.2]) box(iron, g, [x, 8, -0.6], [0.28, 6, 0.4]);
      box(dark, g, [0, 8.4, -4], [15, 6.2, 0.3]);
      for (let j = 0; j < 3; j++) box(glow, g, [-4.5 + j * 4.5, 8.3, -3.7], [2.4, 4, 0.1]);
      if (bay % 3 === 0 && tier % 2 === 0) lamp(g, [0, 11, 1.5], 18);
    }
  }
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    box(iron, tower, [Math.sin(a) * 51, 103, Math.cos(a) * 51], [10, 14, 10]);
    mesh(cone, bronze, tower, [Math.sin(a) * 51, 115, Math.cos(a) * 51], [7, 11, 7]);
    pipe(
      tower,
      [Math.sin(a) * 46, -22, Math.cos(a) * 46],
      [Math.sin(a) * 46, 105, Math.cos(a) * 46],
      0.7,
    );
  }
  mesh(cone, copper, tower, [0, 111, 0], [49, 25, 49]);
  mesh(cylinder, bronze, tower, [0, 128, 0], [4, 20, 4]);
  const windRose = new THREE.Group();
  tower.add(windRose);
  windRose.position.y = 140;
  box(bronze, windRose, [0, 0, 0], [18, 0.5, 0.6]);
  box(bronze, windRose, [0, 0, 0], [0.6, 0.5, 18]);
  motion(windRose, (time) => {
    windRose.rotation.y = time * 0.14;
  });
  // Visible giant meshed gears have fixed pivots, varied tooth counts and speed.
  for (let section = 1; section <= 3; section++)
    for (let i = 0; i < 4; i++) {
      const g = at(section, 0.12 + i * 0.23, 32);
      gear(g, [0, 12, 0], 9 + (i % 2) * 2, i % 2 ? -0.13 : 0.11);
      gear(g, [9.5, 20, 1.5], 5, i % 2 ? 0.24 : -0.22, 20);
      for (const side of [-1, 1]) box(iron, g, [side * 13, 12, 0], [2, 27, 5]);
      box(bronze, g, [0, 26, 0], [29, 1.2, 4]);
      pipe(g, [-13, 27, 0], [13, 27, 0], 0.7);
      lamp(g, [-11, 4, -3], 16);
    }
  // Stacked racing galleries have connected subdecks and diagonals, never
  // ground hills stretched up into the elevated road.
  for (let section = 1; section <= 6; section++) {
    if (section === 5) continue;
    const count = Math.ceil(
      ((track.SECTIONS[section].end - track.SECTIONS[section].start) * track.COURSE_LENGTH) / 8,
    );
    for (let i = 0; i < count; i++) {
      const g = at(section, (i + 0.5) / count),
        f = track.frameAt(track.sectorT(section, (i + 0.5) / count));
      box(iron, g, [0, -1.1, 0], [22, 1.6, 9.3]);
      for (const side of [-1, 1]) {
        box(bronze, g, [side * 10.9, 0.7, 0], [0.45, 1.3, 9.3]);
        if (i % 2 === 0) {
          box(iron, g, [side * 10.9, 1.5, 0], [0.32, 3, 0.32]);
          box(copper, g, [side * 10.9, 2.8, 0], [0.4, 0.3, 9.3]);
          pipe(g, [side * 10, -1, 0], [side * 20, -9, 0], 0.45, iron);
        }
        if (i % 7 === 0) lamp(g, [side * 11.5, 3.4, 0]);
      }
      if (i % 4 === 0 && section >= 4) {
        const height = Math.max(4, f.p.y + 25);
        box(masonry, g, [0, -height / 2 - 2, 0], [7, height, 7]);
        for (const side of [-1, 1]) pipe(g, [side * 8, -2, 0], [0, -12, 0], 0.8, bronze);
      }
    }
  }
  // The clock face is a full building facade seen across the upper balcony.
  const clock = at(3, 0.46, -45);
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
  // Genuine vertical lift: stationary shaft/counterweight, level moving deck,
  // two physically connected staging docks, ropes and guide wheels.
  const lift = track.course.traversals[0],
    base = traversalPose(track, lift, 0),
    top = traversalPose(track, lift, 1),
    height = top.p.y - base.p.y;
  const shaft = new THREE.Group();
  scenery.add(shaft);
  shaft.position.copy(base.p);
  shaft.rotation.y = track.yawFor(base.tangent);
  for (const x of [-14, 14])
    for (const z of [-10, 10]) {
      box(iron, shaft, [x, height / 2 + 1, z], [1.5, height + 8, 1.5]);
      pipe(shaft, [x, 0, z], [x, height + 5, z], 0.18, bronze);
    }
  for (let y = 0; y <= height + 6; y += 9) {
    box(bronze, shaft, [0, y, 11], [30, 0.9, 1]);
    for (const x of [-14, 14]) pipe(shaft, [x, y, -10], [x, y + 8, 10], 0.45, iron);
  }
  box(masonry, shaft, [0, -13, 0], [32, 25, 24]);
  box(bronze, shaft, [0, height + 8, 0], [34, 3, 27]);
  gear(shaft, [0, height + 13, 11], 7, 0.24, 24);
  for (const [q, label] of [
    [0, "Boarding dock"],
    [1, "Crown dock"],
  ]) {
    const g = new THREE.Group();
    scenery.add(g);
    g.position.copy(traversalPose(track, lift, q).p);
    g.rotation.y = shaft.rotation.y;
    g.name = label;
    box(iron, g, [0, -0.6, q ? -5 : 5], [24, 1.2, 12]);
    for (const x of [-12, 12]) {
      box(bronze, g, [x, 1.5, 0], [0.5, 3, 18]);
      lamp(g, [x, 4, 3]);
    }
  }
  const platform = new THREE.Group();
  scenery.add(platform);
  platform.name = "Rideable sky lift";
  box(iron, platform, [0, -0.5, 0], [23, 1, 18]);
  for (const side of [-1, 1]) {
    box(bronze, platform, [side * 11, 1.4, 0], [0.5, 2.8, 18]);
    for (const z of [-8, 8]) box(copper, platform, [side * 11, 5, z], [0.4, 10, 0.4]);
  }
  box(bronze, platform, [0, 10, 0], [23, 0.7, 18]);
  for (let i = 0; i < 4; i++) box(glow, platform, [-7.5 + i * 5, 9.5, 0], [2, 0.12, 2]);
  motion(platform, (time) => {
    const pose = traversalPose(track, lift, liftPhase(lift, time));
    platform.position.copy(pose.p);
    platform.rotation.y = shaft.rotation.y;
  });
  const weight = box(bronze, shaft, [0, height / 2, 12], [8, 12, 3]);
  motion(weight, (time) => {
    weight.position.y = height * (1 - liftPhase(lift, time));
  });
  // Foundry neighborhoods: nested roofs, arched shops, pipes, courtyards,
  // repair awnings and chimneys create near, middle and distant silhouettes.
  function building(g, i, size = 1) {
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
  for (const section of [0, 4, 7])
    for (let i = 0; i < 14; i++) {
      const g = w.safe(section, (i + 0.5) / 14, (i % 2 ? 1 : -1) * (30 + (i % 3) * 17), 12);
      if (g) building(g, i, 1 + (i % 3) * 0.15);
    }
  for (let section = 1; section <= 3; section++)
    for (let i = 0; i < 4; i++) {
      const g = at(section, 0.15 + i * 0.23, -28);
      box(iron, g, [0, -1.2, 0], [27, 2.4, 26]);
      building(g, i, 0.75);
      for (const x of [-11, 11]) {
        box(bronze, g, [x, 1.2, 0], [0.3, 2.4, 26]);
        const height = Math.max(10, g.position.y + 26);
        box(masonry, g, [x, -height / 2 - 2, 0], [3, height, 3]);
      }
    }
  for (let i = 0; i < 28; i++) {
    const a = (i * Math.PI * 2) / 28,
      g = new THREE.Group();
    scenery.add(g);
    g.position.set(Math.sin(a) * 330, -26, Math.cos(a) * 330);
    g.rotation.y = a + Math.PI;
    building(g, i, 1.5 + (i % 4) * 0.3);
  }
  // Busy rooftop workers, piston engines and tethered mail balloons.
  for (let section = 1; section <= 6; section++) {
    if (section === 5) continue;
    const g = at(section, 0.55, -17);
    box(pale, g, [0, -0.7, 0], [10, 1.4, 15]);
    const robot = new THREE.Group();
    g.add(robot);
    box(copper, robot, [0, 1.5, 0], [0.9, 1.3, 0.6]);
    mesh(sphere, bronze, robot, [0, 2.5, 0], [0.6, 0.5, 0.5]);
    box(glow, robot, [0, 2.5, 0.48], [0.55, 0.15, 0.08]);
    for (const side of [-1, 1]) {
      const leg = box(iron, robot, [side * 0.3, 0.5, 0], [0.3, 1, 0.35]);
      const arm = box(bronze, robot, [side * 0.7, 1.5, 0], [0.3, 1.2, 0.3]);
      motion(leg, (time) => {
        leg.rotation.x = Math.sin(time * 3 + side) * 0.2;
      });
      motion(arm, (time) => {
        arm.rotation.z = side * (0.2 + Math.sin(time * 2) * 0.3);
      });
    }
    motion(robot, (time) => {
      robot.position.z = Math.sin(time * 0.35 + section) * 4;
      robot.rotation.y = Math.cos(time * 0.35 + section) > 0 ? 0 : Math.PI;
    });
    for (let i = 0; i < 3; i++) {
      mesh(cylinder, iron, g, [-3 + i * 3, 2, -5], [0.7, 4, 0.7]);
      const piston = box(bronze, g, [-3 + i * 3, 4, -5], [1.1, 0.5, 1.1]);
      motion(piston, (time) => {
        piston.position.y = 4 + Math.sin(time * 2 + i) * 0.6;
      });
    }
  }
  for (let i = 0; i < 5; i++) {
    const g = at(i === 0 ? 0 : 6, 0.15 + i * 0.16, i % 2 ? 65 : -65),
      base = g.position.clone();
    g.position.y += 30;
    mesh(sphere, cloth, g, [0, 10, 0], [9, 12, 9]);
    for (const side of [-1, 1]) pipe(g, [side * 5, 2, 0], [side * 6, 10, 0], 0.08, bronze);
    box(copper, g, [0, 0, 0], [9, 3, 5]);
    mesh(torus, bronze, g, [0, 10, 0], [9.2, 9.2, 9.2]).rotation.x = Math.PI / 2;
    motion(g, (time) => {
      g.position.y = base.y + 30 + Math.sin(time * 0.5 + i) * 2;
      g.rotation.z = Math.sin(time * 0.4 + i) * 0.04;
    });
  }
  w.points("#e9c291", [0, 2, 4, 7], 130, 0.16);
  return w.finish();
}
