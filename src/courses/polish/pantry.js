/** Tactile kitchen materials and close shelf construction for Pocket Pantry. */
export function polishPantry(w) {
  const { THREE, track, mat, mesh, box, safe, light, source, edgeRibbon, kit } = w;
  const ceramic = mat("#e4ede4", "paving", { roughness: 0.23, metalness: 0 });
  const ceramicBlue = mat("#88b7b1", "paving", { roughness: 0.25 });
  const glass = mat("#b8dfd5", "glass", {
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    roughness: 0.12,
    metalness: 0,
  });
  const bottleGlass = ["#a9c6a1", "#d69d68", "#9b788f"].map((color) =>
    mat(color, "glass", {
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      roughness: 0.14,
      metalness: 0,
    }),
  );
  const cloth = mat("#e7c7a8", "fabric", { roughness: 0.98 });
  const metal = mat("#a9b8b8", "metal", { metalness: 0.78, roughness: 0.28 });
  const brass = mat("#c19b5e", "metal", { metalness: 0.68, roughness: 0.3 });
  const wood = mat("#b6895d", "wood", { roughness: 0.9 });
  const darkWood = mat("#684d3a", "wood", { roughness: 0.96 });
  const bread = mat("#cf8c4e", "wood", { roughness: 0.9 });
  const crust = mat("#8d5734", "wood", { roughness: 0.93 });
  const flour = mat("#f0dfbf", "sand", {
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    roughness: 1,
  });
  const jam = mat("#8e4052", "glass", { roughness: 0.22, metalness: 0 });
  const glow = mat("#ffe5b3", null, {
    emissive: "#f7bf76",
    emissiveIntensity: 0.68,
    roughness: 0.62,
  });
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
  const torus = new THREE.TorusGeometry(1, 0.055, 6, 20);
  const crumbGeo = new THREE.IcosahedronGeometry(1, 0);
  const jarGeo = kit.authoredGeometry("blender:preserve-jar", cylinder);
  const cupGeo = kit.authoredGeometry("blender:ceramic-cup", cylinder);
  const breadGeo = new THREE.SphereGeometry(1, 14, 8);

  // A few fully built shelf bays give the existing giant pantry real depth:
  // thick boards, inset backs, brackets and product silhouettes.
  const bays = [
    [0, 0.52, -44, 15, 12],
    [2, 0.45, 43, 19, 14],
    [4, 0.56, -42, 18, 12],
    [5, 0.28, 44, 14, 12],
    [6, 0.67, -43, 17, 13],
  ];
  for (let b = 0; b < bays.length; b++) {
    const [section, fraction, offset, width, height] = bays[b];
    const g = safe(section, fraction, offset, 11);
    if (!g) continue;
    box(darkWood, g, [0, height / 2, 0], [width + 1.5, height, 1.1]);
    box(wood, g, [0, height - 0.3, 0.9], [width + 2.8, 0.65, 3.5]);
    box(darkWood, g, [0, 0.4, 2.1], [width + 2.8, 0.8, 4.1]);
    for (const x of [-width / 2, width / 2]) {
      box(darkWood, g, [x, height * 0.52, 1], [0.75, height, 3.4]);
      box(metal, g, [x * 0.78, height - 1.6, 0.12], [0.12, 2.8, 0.14]);
    }
    for (let level = 0; level < 3; level++) {
      const y = 2.1 + level * 3.7;
      box(wood, g, [0, y, 2], [width, 0.38, 4]);
      for (let j = 0; j < 4; j++) {
        const x = -width * 0.38 + j * width * 0.25;
        if ((j + level + b) % 3 === 0) {
          // Preserve glass readability with a colored inner liquid and a bright rim.
          mesh(
            jarGeo,
            bottleGlass[b % bottleGlass.length],
            g,
            [x, y + 1.35, 2],
            [1.05, 2.35, 1.05],
          );
          mesh(cylinder, (j + b) % 2 ? jam : ceramicBlue, g, [x, y + 0.95, 2], [0.88, 1.15, 0.88]);
          mesh(torus, brass, g, [x, y + 2.55, 2], [0.58, 0.58, 0.58]);
          box(glow, g, [x - 0.25, y + 1.25, 2.54], [0.15, 1.15, 0.035]);
          mesh(cylinder, brass, g, [x, y + 2.75, 2], [0.55, 0.32, 0.55]);
          if (level === 1) {
            const color = ["#c7f0a1", "#ffc379", "#dba8f5"][b % 3];
            const sourcePoint = [x, y + 2.78, 2];
            source(g, sourcePoint, color, 0.13);
            light({
              parent: g,
              position: sourcePoint,
              color,
              intensity: 1.25,
              radius: 3.6,
              kind: "practical",
              pattern: "stained-glass",
              direction: [0, -1, 0],
              staticBake: true,
            });
          }
        } else {
          mesh(cupGeo, ceramic, g, [x, y + 0.9, 2], [1.15, 1.75, 1.15]);
          mesh(torus, ceramic, g, [x + 1.15, y + 1.05, 2], [0.55, 0.75, 0.55]);
          box(cloth, g, [x, y + 2, 2], [1.7, 0.22, 1.7]);
          box(brass, g, [x, y + 2.17, 2], [0.75, 0.08, 0.75]);
        }
      }
    }
    for (const x of [-width * 0.42, width * 0.42])
      box(brass, g, [x, height - 1.1, 2.95], [0.7, 0.18, 0.22]);
  }

  // Close utensils, sink fittings and tiled backsplash create recognizable
  // kitchen silhouettes in the counter and wash-basin transitions.
  for (const [section, fraction, side] of [
    [1, 0.54, 1],
    [3, 0.43, -1],
    [5, 0.55, 1],
  ]) {
    const g = safe(section, fraction, side * 25, 10);
    if (!g) continue;
    const height = section === 5 ? 8 : 6;
    box(ceramicBlue, g, [0, height / 2, 0], [16, height, 8]);
    box(ceramic, g, [0, height + 0.22, 0], [18, 0.44, 9]);
    box(brass, g, [0, height + 0.52, -3.2], [7, 0.12, 0.12]);
    for (const x of [-3, 3]) {
      mesh(cylinder, brass, g, [x, height + 1.1, -3.2], [0.14, 1.2, 0.14]);
      mesh(torus, brass, g, [x, height + 1.7, -3.2], [0.42, 0.42, 0.42]);
    }
    // A white inset basin and arched faucet read cleanly against dark timber.
    box(ceramic, g, [0, height + 0.53, 1.2], [6.6, 0.18, 4.4]);
    box(darkWood, g, [0, height + 0.65, 1.2], [5, 0.08, 2.8]);
    const tap = mesh(cylinder, metal, g, [0, height + 1.5, -1.4], [0.22, 1.7, 0.22]);
    tap.rotation.z = Math.PI / 2;
    mesh(cylinder, metal, g, [0, height + 2.22, -0.65], [0.2, 0.85, 0.2]).rotation.x = Math.PI / 2;
    for (let j = 0; j < 4; j++) {
      const pane = box(
        j % 2 ? ceramicBlue : ceramic,
        g,
        [-6 + j * 4, height + 4.1, -4.1],
        [3.7, 2.6, 0.16],
      );
      pane.rotation.z = (j % 2 ? 1 : -1) * 0.015;
    }
  }

  // Flour and crumbs sit beside road shoulders, with an open strip retained
  // around the true driving edge. Geometry shares a handful of small meshes.
  for (let section = 0; section < track.SECTIONS.length; section++) {
    if (section === 3 || section === 4) continue;
    for (const side of [-1, 1]) {
      edgeRibbon(section, side, {
        color: "#c3a37f",
        width: 0.72,
        textureName: "wood",
        roughness: 0.95,
        lift: 0.018,
        noise: 0.12,
      });
      for (let i = 0; i < 3; i++) {
        const fraction = 0.22 + i * 0.28;
        const t = track.sectorT(section, fraction);
        const edgeAt = track.surfaceAt(t)[side > 0 ? "rightEdge" : "leftEdge"];
        const offset = side * (Math.abs(edgeAt) + 2.4);
        const g = safe(section, fraction, offset, 1.6);
        if (!g) continue;
        const flourPatch = mesh(
          new THREE.CircleGeometry(1, 9),
          flour,
          g,
          [0, 0.055, 0],
          [1.2 + i * 0.35, 0.6 + (i % 2) * 0.35, 1],
        );
        flourPatch.rotation.x = -Math.PI / 2;
        flourPatch.rotation.z = i * 0.47;
        for (let j = 0; j < 4; j++) {
          const crumb = mesh(
            crumbGeo,
            j % 2 ? crust : bread,
            g,
            [(j - 1.5) * 0.55, 0.12, (j % 2 ? 1 : -1) * (0.5 + i * 0.08)],
            [0.12 + (j % 2) * 0.07, 0.09, 0.16],
          );
          crumb.rotation.y = (j * 1.7 + i) % 3;
        }
      }
    }
  }

  // Two high kitchen windows add warm daylight and localized colored glass
  // patterns. Coffee and oven heat each have a compact, bounded pool.
  for (const [section, fraction, side, color] of [
    [0, 0.37, -1, "#ffe2b1"],
    [5, 0.46, 1, "#ffd29c"],
  ]) {
    const g = safe(section, fraction, side * 38, 14);
    if (!g) continue;
    box(darkWood, g, [0, 12, 0], [20, 24, 1.4]);
    box(glass, g, [0, 12, 0.78], [17.6, 20.8, 0.14]);
    box(wood, g, [0, 12, 0.9], [0.62, 21.5, 0.26]);
    box(wood, g, [0, 12, 0.9], [18, 0.62, 0.26]);
    box(wood, g, [0, 12, 1], [0.35, 20, 0.2]);
    box(wood, g, [0, 12, 1], [17, 0.35, 0.2]);
    const sun = source(g, [0, 15, 1.8], color, 0.32);
    sun.userData.skipBake = true;
    light({
      parent: g,
      position: [0, 15, 1.8],
      color,
      intensity: 8,
      radius: 22,
      kind: "practical",
      pattern: "stained-glass",
      direction: [0, -1, 0],
      staticBake: true,
    });
  }
  for (const [section, fraction, side, color, kind] of [
    [2, 0.53, -1, "#d6a6ff", "coffee"],
    [5, 0.58, 1, "#ff9d55", "heat"],
  ]) {
    const g = safe(section, fraction, side * 24, 8);
    if (!g) continue;
    const point = kind === "coffee" ? [-5, 7, 1] : [5, 5, -1];
    if (kind === "coffee") {
      box(darkWood, g, [-5, 3, 0], [5, 6, 4]);
      mesh(cylinder, metal, g, point, [1.2, 4.5, 1.2]);
      mesh(cylinder, ceramic, g, [-5, 5.2, 1], [1.35, 0.35, 1.35]);
    } else {
      box(darkWood, g, [5, 2.7, -1], [8, 5.4, 6]);
      box(metal, g, [5, 2.6, 2.1], [6.8, 3.9, 0.25]);
      box(glow, g, [5, 2.6, 2.3], [4.5, 2.1, 0.08]);
    }
    source(g, point, color, 0.25);
    light({
      parent: g,
      position: point,
      color,
      intensity: kind === "coffee" ? 3.5 : 5,
      radius: kind === "coffee" ? 9 : 11,
      kind,
      staticBake: true,
    });
  }
  // Hemmed tea towels and stamped bread boards break up broad hard surfaces.
  for (let i = 0; i < 6; i++) {
    const g = safe(i, 0.34 + (i % 3) * 0.2, (i % 2 ? 1 : -1) * 23, 5);
    if (!g) continue;
    box(wood, g, [0, 0.16, 0], [7.2, 0.32, 5.4]);
    box(cloth, g, [0, 0.42, 0], [5.8, 0.16, 4.6]);
    for (const x of [-2.7, 2.7]) box(brass, g, [x, 0.51, 0], [0.12, 0.06, 4.4]);
    if (kit.hasAsset("art:bread")) {
      kit.fitAsset("art:bread", g, [0, 0.45, 0], [2.6, 1.7, 3.3]);
    } else {
      mesh(breadGeo, crust, g, [0, 0.64, 0], [1.28, 0.66, 1.65]);
      mesh(breadGeo, bread, g, [0, 0.72, 0], [1.16, 0.64, 1.52]);
    }
  }
}
