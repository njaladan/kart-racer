import { trainCarriages } from "../../simulation/moving-surfaces.js";

/** Railway construction and moving convoy light cues for Railstorm Express. */
export function polishRailstorm(w) {
  const {
    THREE,
    scene,
    track,
    scenery,
    mat,
    mesh,
    box,
    at,
    safe,
    motion,
    light,
    source,
    sweep,
    align,
  } = w;
  const ballast = mat("#77838a", "rock", { roughness: 0.96 });
  const ballastLight = mat("#9a9c91", "rock", { roughness: 0.93 });
  const sleeper = mat("#725d49", "wood", { roughness: 0.97 });
  const iron = mat("#3e4e59", "metal", { metalness: 0.62, roughness: 0.42 });
  const railTop = mat("#aab8b9", "metal", { metalness: 0.76, roughness: 0.26 });
  const stone = mat("#71818a", "rock", { roughness: 0.94 });
  const rust = mat("#9b5f46", "metal", { metalness: 0.45, roughness: 0.62 });
  const amber = mat("#ffca7a", null, {
    emissive: "#e5994c",
    emissiveIntensity: 1.1,
    roughness: 0.5,
  });
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
  const boltGeo = new THREE.SphereGeometry(0.11, 6, 4);

  // Rail shoulders, tie plates and visible fasteners explain how the steel
  // lines attach to the bed. Existing sleeper rows stay the load-bearing base.
  for (let section = 2; section <= 4; section++) {
    sweep(section, 0, 1, -8.3, -5.5, ballastLight, -4.45);
    sweep(section, 0, 1, 5.5, 8.3, ballast, -4.45);
    sweep(section, 0, 1, -5.15, -4.78, railTop, -4.48);
    sweep(section, 0, 1, 4.78, 5.15, railTop, -4.48);
    const sleepers = 16;
    for (let i = 0; i < sleepers; i++) {
      const g = at(section, (i + 0.5) / sleepers);
      box(sleeper, g, [0, -5.03, 0], [15.6, 0.28, 1.05]);
      for (const side of [-1, 1]) {
        box(iron, g, [side * 4.95, -4.79, 0], [0.72, 0.16, 1.22]);
        for (const z of [-0.38, 0.38])
          mesh(boltGeo, railTop, g, [side * 4.95, -4.68, z], [0.16, 0.1, 0.16]);
        box(rust, g, [side * 6.65, -4.83, 0], [0.16, 0.13, 0.76]);
      }
    }
    // Rail joints expose short fishplates and paired bolts at a practical
    // interval, while bridge chords tie into the trestles at the outside.
    for (let i = 0; i < 5; i++) {
      const g = at(section, 0.09 + i * 0.205);
      for (const side of [-1, 1]) {
        box(iron, g, [side * 4.95, -4.34, 0], [0.62, 0.82, 0.12]);
        for (const z of [-0.23, 0.23])
          mesh(boltGeo, railTop, g, [side * 4.95, -4.1, z], [0.13, 0.13, 0.13]);
        box(iron, g, [side * 11.8, -6.4, 0], [0.45, 0.55, 2.6]);
        box(rust, g, [side * 10.2, -6.75, 0], [3.4, 0.35, 0.44]);
      }
    }
  }

  // Retaining construction frames the cliff approach and the return tunnel.
  // Short buttresses and coping stones keep the wall profile readable nearby.
  for (const section of [1, 5, 6]) {
    for (const side of [-1, 1]) {
      const edge = side > 0 ? 21 : -21;
      const wall = mat(side > 0 ? "#727e80" : "#667980", "rock", { roughness: 0.97 });
      sweep(section, 0.04, 0.96, edge, edge + side * 2.4, wall, -7.5);
      sweep(section, 0.04, 0.96, edge, edge + side * 2.4, ballastLight, 1.3);
      for (let i = 0; i < 6; i++) {
        const g = safe(section, 0.1 + i * 0.16, side * 22, 3.4);
        if (!g) continue;
        const h = 7 + (i % 3) * 2;
        box(stone, g, [0, h / 2 - 4, 0], [3.3, h, 5.2]);
        box(ballastLight, g, [0, h - 3.85, 0], [3.7, 0.42, 5.5]);
        for (let j = 0; j < 3; j++)
          box(wall, g, [-1 + j, 1 + (j % 2) * 1.3, 2.67], [0.82, 0.55, 0.12]);
      }
    }
  }

  // Bolted gussets strengthen selected bridge bents and connect their cross
  // members to the deck girders. They sit below the driving surface.
  for (const section of [2, 3, 4]) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const g = at(section, 0.12 + i * 0.245, side * 10);
        const y = -8 - (i % 2) * 1.2;
        box(iron, g, [side * 2.7, y, 0], [0.32, 4.5, 0.42]);
        const brace = mesh(cylinder, rust, g, [side * 1.45, y, 0], [0.16, 4.6, 0.16]);
        brace.rotation.z = -side * 0.57;
        box(railTop, g, [side * 2.7, y + 1.8, 0.28], [0.76, 0.9, 0.08]);
        for (const x of [-0.2, 0.2])
          mesh(boltGeo, amber, g, [side * 2.7 + x, y + 1.8, 0.34], [0.12, 0.12, 0.12]);
      }
    }
  }

  // A signal lantern and a headlamp travel with the analytic moving deck. Their
  // small transmitted pools move over the road and remain independent of race
  // collision or progress state.
  const definition = track.course.movingDecks?.[0];
  if (definition) {
    const cars = w.vehicles || [];
    const firstCar = cars[0];
    const head = new THREE.Group();
    head.name = "Express supported moving headlamp";
    let support;
    let position;
    if (firstCar) {
      support = firstCar;
      const length = definition.carLength || 92;
      position = [0, 5.1, -length * 0.43];
      box(iron, support, [0, 4.45, -length * 0.43], [2.2, 0.32, 2.6]);
      box(iron, support, [0, 4.82, -length * 0.43], [1.45, 0.38, 1.75]);
      box(railTop, support, [0, 4.84, -length * 0.43 - 0.9], [1.05, 0.2, 0.35]);
      support.add(head);
    } else {
      // The locomotive is an authored moving assembly in the world builder.
      let locomotive = null;
      scene.traverse((object) => {
        if (object.userData?.environmentSource === "express-boiler") locomotive = object;
      });
      support = locomotive || scenery;
      position = locomotive ? [0, 8.1, -16] : [0, 4, -2];
      if (!locomotive) {
        motion(head, (time) => {
          const first = trainCarriages(track, definition, time)[0];
          if (first) align(head, track.poseAt(first.t * track.TRACK, 0, 5.2));
        });
        scenery.add(head);
      } else support.add(head);
    }
    if (position) head.position.set(...position);
    const bulb = source(head, [0, 0, 0], "#ffe1a4", 0.46);
    bulb.userData.skipBake = true;
    light({
      parent: head,
      position: [0, 0, 0],
      color: "#ffd9a0",
      intensity: 11,
      radius: 25,
      kind: "searchlight",
      pattern: "lattice",
      direction: [0, -1, 0],
      staticBake: false,
    });
  }

  // Station and tunnel practicals create authored pools at transitions, with
  // visible sources placed on their supporting iron brackets.
  for (const [section, fraction, side, hue] of [
    [0, 0.24, -1, "#ffd89a"],
    [5, 0.5, 1, "#f7c982"],
    [6, 0.74, -1, "#ffe0aa"],
  ]) {
    const g = safe(section, fraction, side * 19, 5);
    if (!g) continue;
    box(iron, g, [0, 8, 0], [0.46, 11, 0.55]);
    box(iron, g, [0, 13.4, 0], [2.4, 0.34, 0.72]);
    const bulb = source(g, [0, 12.3, 0.5], hue, 0.3);
    bulb.userData.skipBake = true;
    light({
      parent: g,
      position: [0, 12.3, 0.5],
      color: hue,
      intensity: 4.2,
      radius: 14,
      kind: "practical",
      pattern: "lattice",
      direction: [0, -1, 0],
      staticBake: true,
    });
  }
}
