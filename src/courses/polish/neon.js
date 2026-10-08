/** Local lighting and silhouette accents for Port Lumen. */
export function polishNeon(w) {
  const { THREE, mat, at, safe, mesh, box, motion, light, source, bevelBox } = w;
  const shell = mat("#17253a", "concrete", { roughness: 0.94 });
  const stone = mat("#344155", "concrete", { roughness: 0.86 });
  const steel = mat("#35485d", "metal", { metalness: 0.58, roughness: 0.48 });
  const cyan = mat("#55e4df", null, { emissive: "#24b8c4", emissiveIntensity: 1.7 });
  const pink = mat("#e980c4", null, { emissive: "#c43c91", emissiveIntensity: 1.55 });
  const amber = mat("#ffc477", null, { emissive: "#dc803a", emissiveIntensity: 1.35 });
  const geometry = {
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 10),
    sphere: new THREE.SphereGeometry(1, 10, 8),
  };

  // Three deliberately different silhouettes break the repeating commercial
  // frontage: a stepped beacon, a dockside gantry, and a narrow antenna tower.
  const skylineSites = [
    [0, 0.56, -94, 46, 32],
    [2, 0.4, 88, 54, 25],
    [4, 0.68, -76, 42, 27],
  ];
  for (let i = 0; i < skylineSites.length; i++) {
    const [section, fraction, offset, height, width] = skylineSites[i];
    const g = safe(section, fraction, offset, 25);
    if (!g) continue;
    g.name = `Port Lumen skyline landmark ${i + 1}`;
    const profile = i === 0 ? [1, 0.78, 0.53] : i === 1 ? [1, 1, 0.72] : [0.72, 0.58, 0.38];
    let y = 0;
    for (let tier = 0; tier < 3; tier++) {
      const h = height * (tier === 0 ? 0.34 : 0.29);
      const bw = width * profile[tier];
      mesh(bevelBox(bw, h, 15 + tier * 2, 0.38), tier === 1 ? stone : shell, g, [0, y + h / 2, 0]);
      box(steel, g, [0, y + h + 0.45, 0], [bw + 1.8, 0.9, 17 + tier * 2]);
      for (let x = -1; x <= 1; x += 2) {
        const lit = (x + tier + i) % 3 !== 0;
        box(
          lit ? (x % 2 ? cyan : pink) : steel,
          g,
          [x * bw * 0.27, y + h * 0.48, -7.72],
          [2.1, h * 0.38, 0.18],
        );
      }
      y += h;
    }
    box(steel, g, [0, y + 2, 0], [width * 0.32, 4, 7]);
    mesh(geometry.cylinder, steel, g, [0, y + 11, 0], [0.38, 15, 0.38]);
    mesh(geometry.sphere, i === 1 ? amber : cyan, g, [0, y + 18.8, 0], [1.4, 1.4, 1.4]);
    for (const side of [-1, 1]) box(steel, g, [side * width * 0.39, y - 2, 0], [1.4, 8, 18]);
  }

  // Recessed service doors, heavy jambs and sparse lit bays give the existing
  // dense storefront wall a readable rhythm from the low chase camera.
  for (const section of [0, 1, 2, 4, 5, 7]) {
    for (let i = 0; i < 2; i++) {
      const side = i % 2 ? 1 : -1;
      const g = safe(section, (i + 0.55) / 4, side * (23 + (i % 3) * 5), 10);
      if (!g) continue;
      const width = 7 + (i % 2) * 2;
      mesh(bevelBox(width, 8, 2.3, 0.16), shell, g, [0, 4, 0]);
      mesh(bevelBox(width + 1.4, 0.65, 3.2, 0.12), steel, g, [0, 8.4, 0]);
      box(i % 3 === 0 ? cyan : stone, g, [0, 4.1, -1.22], [width * 0.58, 5.5, 0.16]);
      if (section === 2 && i === 1) {
        const bulb = source(g, [0, 9, 1], "#ffbd73", 0.32);
        light({
          parent: g,
          position: [0, 9, 1],
          color: "#ffac68",
          intensity: 8,
          radius: 12,
          kind: "practical",
          sourceObject: bulb,
        });
      }
    }
  }

  // The harbor searchlight pivots over the quay. Its beam is a single soft,
  // translucent cone; the actual light pool is kept small and non-shadowed.
  const quay = at(7, 0.45, 44);
  box(steel, quay, [0, 1.1, 0], [8, 2.2, 8]);
  const pivot = new THREE.Group();
  quay.add(pivot);
  pivot.position.set(0, 3.4, 0);
  pivot.userData.skipBake = true;
  box(steel, pivot, [0, 0, 0], [2.4, 1.4, 4.4]);
  const searchlamp = source(pivot, [0, 0.45, -2.1], "#c4fbff", 0.56);
  const beamGeo = new THREE.ConeGeometry(3.4, 46, 14, 1, true);
  // ConeGeometry points up its local Y axis. After the quarter turn the tip
  // sits at the lamp and the broad end extends forward along local -Z.
  beamGeo.translate(0, -23, 0);
  const beamMat = new THREE.MeshBasicMaterial({
    color: "#79dfe8",
    transparent: true,
    opacity: 0.055,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beam = mesh(beamGeo, beamMat, pivot, [0, 0.45, -2.1]);
  beam.rotation.x = Math.PI / 2;
  beam.userData.skipBake = true;
  beam.userData.excludeFromReflectionProbe = true;
  beam.castShadow = beam.receiveShadow = false;
  motion(pivot, (time, state) => {
    const clock = state?.motionEnabled === false ? 0 : time;
    pivot.rotation.y = Math.sin(clock * 0.19) * 0.72;
    pivot.rotation.x = -0.08 + Math.sin(clock * 0.13 + 0.7) * 0.11;
  });
  light({
    parent: pivot,
    position: [0, 0.45, -2.1],
    color: "#77e7f0",
    intensity: 14,
    radius: 36,
    kind: "searchlight",
    direction: [0, 0, -1],
    target: [0, 0, -42],
    speed: 0.19,
    amplitude: 0.72,
    staticBake: false,
    sourceObject: searchlamp,
  });

  // A few rough, asymmetrical wet patches sit on the safe quayside apron. The
  // paired slivers catch neon without covering a driving surface or adding FX.
  const puddle = mat("#192737", "paving", {
    metalness: 0,
    roughness: 0.24,
    transparent: true,
    opacity: 0.78,
  });
  const puddleGeometry = new THREE.CircleGeometry(1, 11);
  for (let i = 0; i < 7; i++) {
    const section = [0, 2, 4, 5, 7][i % 5];
    const side = i % 2 ? 1 : -1;
    const g = safe(section, 0.17 + ((i * 37) % 67) / 100, side * (17 + (i % 3) * 4), 5);
    if (!g) continue;
    const rx = 1.8 + (i % 3) * 0.7;
    const water = mesh(puddleGeometry, puddle, g, [0, 0.11, 0], [rx, 2.2 + (i % 2) * 1.1, 1]);
    water.rotation.x = -Math.PI / 2;
    water.rotation.z = i * 0.73;
  }

  // Small delivery runners use the outside service lane. Each body, source,
  // and light pool moves as one assembly, so the headlights stay attached to
  // visible traffic and never invent a free-floating pool on the track.
  const trafficPaint = [
    mat("#273444", "metal", { metalness: 0.42, roughness: 0.52 }),
    mat("#70485b", "metal", { metalness: 0.36, roughness: 0.48 }),
  ];
  const glass = mat("#213b52", null, { metalness: 0.16, roughness: 0.2 });
  const tire = mat("#161a22", "rubber", { roughness: 0.94 });
  for (let i = 0; i < 1; i++) {
    const section = 1;
    const side = -1;
    const lane = safe(section, 0.46, side * 19, 5);
    if (!lane) continue;
    lane.name = "Port Lumen passing service traffic";
    const van = new THREE.Group();
    lane.add(van);
    van.position.y = 0.38;
    const protectedMeshes = [];
    box(trafficPaint[i], van, [0, 0.62, 0], [3.3, 1.1, 5.8]);
    box(glass, van, [0, 1.37, -0.35], [2.65, 0.6, 2.55]);
    box(steel, van, [0, 1.15, 1.5], [2.85, 0.12, 1.25]);
    for (const x of [-1.38, 1.38]) {
      for (const z of [-1.75, 1.75])
        mesh(geometry.cylinder, tire, van, [x, 0.2, z], [0.48, 0.25, 0.48]).rotation.z =
          Math.PI / 2;
      const lens = source(van, [x * 0.66, 0.78, 2.95], "#fff0c8", 0.24);
      protectedMeshes.push(lens);
      lens.name = "Passing van headlamp";
      light({
        parent: van,
        position: [x * 0.66, 0.78, 2.95],
        color: "#ffe8b8",
        intensity: 5.5,
        radius: 18,
        kind: "headlight",
        direction: [0, 0, 1],
        target: [x * 0.66, 0.3, 18],
        staticBake: false,
        sourceObject: lens,
      });
      const lampGeo = new THREE.ConeGeometry(2.4, 15, 12, 1, true);
      // Its flat end meets the lens; the narrow tip fades into the service lane.
      lampGeo.translate(0, 7.5, 0);
      const lampMat = new THREE.MeshBasicMaterial({
        color: "#ffe7bd",
        transparent: true,
        opacity: 0.045,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const ray = mesh(lampGeo, lampMat, van, [x * 0.66, 0.76, 2.95]);
      ray.rotation.x = Math.PI / 2;
      ray.userData.skipBake = true;
      ray.userData.excludeFromReflectionProbe = true;
      ray.castShadow = ray.receiveShadow = false;
      protectedMeshes.push(ray);
    }
    for (const x of [-1.55, 1.55]) box(steel, van, [x, 0.45, 0], [0.12, 0.3, 5.4]);
    // Batch the body's fixed materials inside the moving assembly; only the
    // two sources and two beam volumes remain individual moving meshes.
    w.kit.batch(van, protectedMeshes);
    motion(van, (time, state) => {
      const clock = state?.motionEnabled === false ? 0 : time;
      van.position.z = Math.sin(clock * 0.42 + i * 2.2) * 8;
      van.rotation.y = 0;
    });
  }
}
