import { clockPendulumBob } from "../adventure/clock-pendulum.js";

/** Music-box architecture and warm practical light for Metronome Hall. */
export function polishMetronome(w) {
  const { THREE, track, mat, at, safe, mesh, box, motion, light, source, bevelBox } = w;
  const wood = mat("#573b36", "wood", { roughness: 0.88 });
  const edge = mat("#a7774e", "wood", { roughness: 0.64 });
  const brass = mat("#d4ad70", "metal", { metalness: 0.72, roughness: 0.28 });
  const darkBrass = mat("#735a45", "metal", { metalness: 0.65, roughness: 0.38 });
  const velvet = mat("#353b5b", "fabric", { roughness: 0.98 });
  const recess = mat("#211f31", "fabric", { roughness: 1 });
  const ivory = mat("#f1ddbb", null, { roughness: 0.34 });
  const geometry = {
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 14),
    pipe: new THREE.CylinderGeometry(0.56, 0.66, 1, 14, 1, true),
    bell: new THREE.CylinderGeometry(1.2, 0.5, 1, 14, 1, true),
    sphere: new THREE.SphereGeometry(1, 12, 8),
    arch: new THREE.TorusGeometry(1, 0.11, 8, 36, Math.PI),
    rim: new THREE.TorusGeometry(1, 0.1, 6, 18),
  };

  // Repeated but varied bays establish one long instrument case. The dark
  // inner panels recede behind gilded ribs; lamps sit in the real recesses.
  for (let section = 0; section < track.SECTIONS.length; section++) {
    for (let bay = 0; bay < 3; bay++) {
      const fraction = 0.18 + bay * 0.31;
      for (const side of [-1, 1]) {
        if (section === 4 && bay === 0 && side === -1) continue;
        if (section === 2 && side === (bay % 2 ? 1 : -1)) continue;
        const g = safe(section, fraction, side * 33, 10);
        if (!g) continue;
        g.name = "Metronome velvet resonant chamber";
        const height = 22 + ((section + bay) % 3) * 4;
        box(wood, g, [0, height / 2, 0], [12, height, 5]);
        box(recess, g, [0, height * 0.52, -2.62], [8.8, height * 0.67, 0.12]);
        box(velvet, g, [0, height * 0.5, -2.72], [7.7, height * 0.53, 0.12]);
        box(edge, g, [0, 1.8, -3.12], [8.4, 0.32, 0.28]);
        for (const x of [-5.4, 5.4]) {
          const rib = mesh(
            geometry.cylinder,
            brass,
            g,
            [x, height / 2, -3.1],
            [0.42, height + 1.2, 0.42],
          );
          mesh(geometry.sphere, brass, g, [x, height + 0.2, -3.1], [0.7, 0.8, 0.7]);
          box(darkBrass, g, [x, 2.2, -3.25], [1.25, 3.5, 0.9]);
          if (section % 2 === 0) rib.rotation.z = 0.015 * side;
        }
        box(brass, g, [0, height + 0.6, -2.8], [11.8, 0.65, 0.85]);
        box(wood, g, [0, 1.1, -1.1], [11.8, 1.2, 3.3]);
        // A small lantern in every other bay gives the velvet a warm edge and
        // leaves the neighboring alcoves shadowed for a strong light rhythm.
        if ((section + bay + (side > 0 ? 1 : 0)) % 2 === 0) {
          box(darkBrass, g, [0, height - 3, -3.15], [1.8, 2.4, 1.1]);
          const lantern = source(g, [0, height - 3, -3.7], "#ffcf91", 0.34);
          light({
            parent: g,
            position: [0, height - 3, -3.7],
            color: "#ffc77e",
            intensity: 7,
            radius: 13,
            kind: "practical",
            sourceObject: lantern,
          });
        }
      }
    }
  }

  // Three high chamber crowns make the hall legible as a resonator from the
  // chase view. The openings stay tall and broad over the full race ribbon.
  for (const section of [1, 3, 5]) {
    const g = at(section, 0.5);
    const half = Math.max(15, Math.abs(track.platformEdgeAt(track.sectorT(section, 0.5), -1)) + 8);
    for (const side of [-1, 1]) {
      const x = side * (half + 1.5);
      box(wood, g, [x, 12, 0], [3.2, 24, 5.2]);
      box(brass, g, [x, 23.5, 0], [4.1, 1.2, 6]);
      box(brass, g, [x, 2, 0], [5.2, 2, 7]);
      box(velvet, g, [x - side * 2, 12, -2.68], [0.22, 18, 0.13]);
    }
    box(wood, g, [0, 26, 0], [half * 2 + 9, 3.2, 5.2]);
    box(brass, g, [0, 24.1, 0], [half * 2 + 10, 0.65, 6]);
    const arch = mesh(geometry.arch, brass, g, [0, 26, 0], [half + 1.6, 8, half + 1.6]);
    arch.rotation.x = Math.PI / 2;
    if (section === 3) {
      const crownLamp = source(g, [0, 22.8, 0], "#ffe0ad", 0.44);
      light({
        parent: g,
        position: [0, 22.8, 0],
        color: "#ffcb87",
        intensity: 11,
        radius: 24,
        kind: "practical",
        sourceObject: crownLamp,
      });
    }
  }

  // The distant pipe gallery uses long tapered resonators with flared bells,
  // two banks at different heights, and a gilded comb running above them.
  for (const section of [2, 3, 4]) {
    for (const side of [-1, 1]) {
      const g = safe(section, 0.52, side * 61, 14);
      if (!g) continue;
      const baseY = 4;
      mesh(bevelBox(31, 1.1, 13, 0.18), wood, g, [0, 1.5, 2.4]);
      const pipe = (x, z, height, material) => {
        mesh(geometry.pipe, material, g, [x, baseY + height / 2, z], [1, height, 1]);
        mesh(geometry.bell, brass, g, [x, baseY + height + 1, z], [1, 2.4, 1]);
        const lip = mesh(geometry.rim, ivory, g, [x, baseY + height + 2.18, z], [1.12, 1.12, 1.12]);
        lip.rotation.x = Math.PI / 2;
      };
      for (let i = 0; i < 7; i++) {
        const x = (i - 3) * 3.8;
        pipe(x, 0, 24 + ((i + section) % 5) * 5, i % 3 ? brass : darkBrass);
      }
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 4.5;
        pipe(x, 4.9, 17 + ((i + section + 2) % 4) * 4, i % 2 ? darkBrass : brass);
      }
      const comb = bevelBox(30, 0.85, 2.6, 0.18);
      mesh(comb, wood, g, [0, 3, 0]);
      for (let tooth = 0; tooth < 13; tooth++)
        box(brass, g, [-14 + tooth * 2.35, 3.58, 0], [0.42, 0.36, 2.7]);
      if (section === 3) {
        const pipeLamp = source(g, [0, 8, -2.7], "#ffd398", 0.3);
        light({
          parent: g,
          position: [0, 8, -2.7],
          color: "#ffce8e",
          intensity: 6,
          radius: 14,
          kind: "practical",
          sourceObject: pipeLamp,
        });
      }
    }
  }

  // A slow, readable pendular accent is anchored above the return chamber.
  const mechanism = safe(5, 0.38, -56, 16);
  if (mechanism) {
    box(wood, mechanism, [0, 23, 0], [21, 3, 8]);
    box(brass, mechanism, [0, 24.8, 0], [18, 0.55, 7.2]);
    const arm = new THREE.Group();
    mechanism.add(arm);
    arm.position.set(0, 22, 0);
    mesh(geometry.cylinder, brass, arm, [0, -8, 0], [0.45, 16, 0.45]);
    clockPendulumBob(w, arm, 2.6, 0.85, brass, darkBrass).position.set(0, -17, 0);
    const collar = mesh(geometry.cylinder, darkBrass, arm, [0, -1, 0], [1.6, 1.2, 1.6]);
    collar.rotation.z = Math.PI / 2;
    const pendulumLamp = source(mechanism, [0, 21, 3], "#ffdaa3", 0.32);
    light({
      parent: mechanism,
      position: [0, 21, 3],
      color: "#ffd29a",
      intensity: 8,
      radius: 16,
      kind: "practical",
      sourceObject: pendulumLamp,
    });
    motion(arm, (time, state) => {
      const clock = state?.motionEnabled === false ? 0 : time;
      arm.rotation.z = Math.sin(clock * Math.PI) * 0.16;
    });
  }
}
