/** Structural framing and warm foundry light for the exposed citadel route. */
export function polishClockwork(w) {
  const { THREE, track, mat, safe, mesh, box, motion, light, source, bevelBox } = w;
  const iron = mat("#283645", "metal", { metalness: 0.72, roughness: 0.46 });
  const steel = mat("#66737a", "metal", { metalness: 0.68, roughness: 0.35 });
  const brass = mat("#c39450", "metal", { metalness: 0.76, roughness: 0.29 });
  const soot = mat("#493e40", "stone", { roughness: 0.91 });
  const forge = mat("#ff9d4a", null, { emissive: "#f05d20", emissiveIntensity: 1.65 });
  const geometry = {
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
    brace: new THREE.BoxGeometry(1, 1, 1),
    gear: new THREE.TorusGeometry(1, 0.35, 7, 24),
  };
  const strut = (parent, a, b, width, material = iron) => {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const delta = end.clone().sub(start);
    const beam = mesh(
      geometry.brace,
      material,
      parent,
      start.clone().add(end).multiplyScalar(0.5).toArray(),
      [width, delta.length(), width],
    );
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return beam;
  };

  // Portal-like truss bays are placed as complete safe assemblies outside each
  // road envelope. Their paired braces and continuous shaft read as supports
  // from both the chase camera and the distant spiral silhouette.
  const groundY = track.course.theme.groundHeight ?? -26;
  for (const section of [1, 2, 3, 4, 5, 6]) {
    for (let bay = 0; bay < 3; bay++) {
      const fraction = 0.17 + bay * 0.32;
      for (const side of [-1, 1]) {
        const g = safe(section, fraction, side * 20, 9);
        if (!g) continue;
        g.name = "Citadel exposed gallery support";
        // The column ends at the authored terrain datum and its diagonal tie
        // reaches the outside edge of the original deck skin.
        const footY = groundY - g.position.y + 1;
        const columnHeight = Math.max(4, -footY - 1);
        box(iron, g, [0, footY - 0.25, 0], [4.8, 1.4, 8]);
        box(steel, g, [0, footY + 1.65, 0], [3.3, 3.4, 5.2]);
        box(iron, g, [0, (footY - 1) / 2, 0], [1.7, columnHeight, 1.7]);
        box(brass, g, [0, 0.1, 0], [3.2, 0.55, 3.2]);
        strut(g, [-side * 8, -1.15, -5.2], [0, footY + 1.5, 0], 0.6);
        strut(g, [-side * 8, -1.15, 5.2], [0, footY + 1.5, 0], 0.6, steel);
        strut(g, [-side * 8, -1.15, 0], [0, -1.15, 0], 0.55, brass);
        if (bay === 1) {
          mesh(geometry.cylinder, steel, g, [0, 6.4, 0], [0.52, 12.8, 0.52]);
          const wheel = mesh(geometry.gear, brass, g, [0, 7.2, 0], [2.1, 2.1, 2.1]);
          wheel.rotation.x = Math.PI / 2;
          const counterweight = box(iron, g, [0, 3.2, 0], [1.6, 3.2, 1.6]);
          motion(counterweight, (time, state) => {
            const clock = state?.motionEnabled === false ? 0 : time;
            counterweight.position.y = 3.2 + Math.sin(clock * 0.52 + section) * 1.05;
            wheel.rotation.z = clock * (section % 2 ? 0.12 : -0.12);
          });
        }
      }
    }
  }

  // A foundry throat creates a warm pocket with a visible source and a slow
  // rotating perforated wheel, set back from the route behind a deep arch.
  const forgeSite = safe(0, 0.58, -47, 18);
  if (forgeSite) {
    forgeSite.name = "Counterweight foundry throat";
    box(soot, forgeSite, [0, 13, 0], [26, 26, 8]);
    box(iron, forgeSite, [0, 26.4, 0], [31, 1.5, 10]);
    box(soot, forgeSite, [-10.7, 13, -4.1], [4.6, 26, 1.8]);
    box(soot, forgeSite, [10.7, 13, -4.1], [4.6, 26, 1.8]);
    const apertureMaterial = forge.clone();
    apertureMaterial.transparent = true;
    apertureMaterial.opacity = 0.38;
    apertureMaterial.depthWrite = false;
    box(apertureMaterial, forgeSite, [0, 12.8, -4.3], [16.5, 17, 0.14]);
    const rotor = new THREE.Group();
    forgeSite.add(rotor);
    rotor.position.set(0, 13, -3.2);
    mesh(geometry.gear, brass, rotor, [0, 0, 0], [8.1, 8.1, 8.1]).rotation.x = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      box(iron, rotor, [Math.sin(a) * 5.6, Math.cos(a) * 5.6, 0], [0.7, 3.6, 0.4]).rotation.z = -a;
    }
    const forgeSource = source(forgeSite, [0, 4.3, -2.8], "#ffad63", 0.6);
    light({
      parent: forgeSite,
      position: [0, 4.3, -2.8],
      color: "#ff873e",
      intensity: 18,
      radius: 24,
      kind: "practical",
      sourceObject: forgeSource,
    });
    motion(rotor, (time, state) => {
      const clock = state?.motionEnabled === false ? 0 : time;
      rotor.rotation.z = Math.sin(clock * 0.35) * 0.16;
    });
  }

  // Worn deck plates and brass edge caps stay in the safe outer shoulders and
  // pick up the existing baked light without adding another full road layer.
  for (const section of [1, 2, 3, 4, 5, 6]) {
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      const g = safe(section, (i + 0.5) / 6, side * 14.5, 4);
      if (!g) continue;
      const plate = bevelBox(5.8, 0.18, 2.8, 0.12);
      mesh(plate, i % 3 ? iron : steel, g, [0, 0.12, 0], [1, 1, 1]);
      box(brass, g, [0, 0.23, 0], [5.1, 0.035, 0.1]);
    }
  }
}
