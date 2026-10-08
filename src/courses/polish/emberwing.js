/** White caldera terraces, layered lava crust, and precise observatory detail. */
export function polishEmberwing(w) {
  const {
    THREE,
    scene,
    scenery,
    track,
    mat,
    safe,
    mesh,
    box,
    light,
    source,
    patch,
    bevelBox,
    edgeRibbon,
  } = w;
  const limestone = mat("#efe8d9", "paving", { roughness: 0.84 });
  const sunlit = mat("#f8f1df", "stone", { roughness: 0.8 });
  const indigo = mat("#356fa4", "stone", { roughness: 0.48 });
  const shadow = mat("#302f42", "rock", { roughness: 0.96 });
  const basalt = mat("#242535", "rock", { roughness: 0.98 });
  const hot = mat("#ee6739", "stone", {
    emissive: "#fa4f20",
    emissiveIntensity: 1.25,
    roughness: 0.52,
  });
  const warm = mat("#ffd294", "glass", { emissive: "#f28c48", emissiveIntensity: 0.88 });
  const brass = mat("#b89a65", "metal", { metalness: 0.66, roughness: 0.32 });
  const random = w.seeded(0xe6b3a7);

  // Dark, broken lava plates enclose narrow hot seams on the caldera floor.
  const caldera = new THREE.Group();
  scenery.add(caldera);
  caldera.name = "Basalt crust and concentrated caldera fissures";
  const flight = track.course.traversals[0];
  const flightStart = track.sectorT(flight.section, flight.startFraction);
  const flightEnd = track.sectorT(flight.section, flight.endFraction);
  const startPoint = track.poseAt(flightStart * track.TRACK, 0).p;
  const endPoint = track.poseAt(flightEnd * track.TRACK, 0).p;
  caldera.position.set((startPoint.x + endPoint.x) * 0.5, -7, (startPoint.z + endPoint.z) * 0.5);
  const plateGeo = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 30; i++) {
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    const radius = 58 + random() * 118;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const plate = mesh(
      plateGeo,
      i % 4 ? basalt : shadow,
      caldera,
      [x, -1.8 + random() * 2, z],
      [8 + random() * 13, 2.5 + random() * 5, 7 + random() * 11],
    );
    plate.rotation.set(random() * 0.14, random() * 2 * Math.PI, random() * 0.12);
    plate.castShadow = false;
  }
  const fissureMat = new THREE.MeshBasicMaterial({
    color: "#ff7940",
    transparent: true,
    opacity: 0.74,
    depthWrite: false,
  });
  for (let i = 0; i < 14; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 52 + random() * 105;
    const length = 12 + random() * 28;
    const fissure = mesh(bevelBox(length, 0.22, 0.8 + random() * 1.1, 0.04), fissureMat, caldera, [
      Math.cos(angle) * radius,
      1.4,
      Math.sin(angle) * radius,
    ]);
    fissure.rotation.y = angle + random() * 0.5;
    fissure.castShadow = false;
  }
  source(caldera, [0, 1, 0], "#ff6a32", 0.9);
  light({
    parent: caldera,
    position: [0, 2, 0],
    color: "#ff7137",
    intensity: 38,
    radius: 105,
    kind: "lava",
    staticBake: false,
  });

  // Village walls step down the cliffs, with shaded lanes and blue accents.
  for (const [section, fraction, side, tier] of [
    [0, 0.34, -1, 0],
    [0, 0.73, 1, 1],
    [1, 0.25, 1, 0],
    [4, 0.31, -1, 1],
    [5, 0.69, 1, 0],
    [6, 0.42, -1, 1],
  ]) {
    const terrace = safe(section, fraction, side * (52 + tier * 19), 14);
    if (!terrace) continue;
    terrace.name = "Whitewashed caldera village terrace";
    const foundation = terrace.position.y + 42 + tier * 13;
    box(shadow, terrace, [0, -foundation / 2, 0], [17 + tier * 4, foundation, 16]);
    box(limestone, terrace, [0, 0, 0], [19 + tier * 4, 0.55, 18]);
    for (let house = 0; house < 3; house++) {
      const x = (house - 1) * (9 + tier);
      const width = 7 + (house % 2) * 2;
      const height = 7 + (house % 3) * 2;
      box(house % 2 ? sunlit : limestone, terrace, [x, height / 2 + 0.3, -1], [width, height, 8]);
      box(limestone, terrace, [x, height + 0.55, -1], [width + 0.7, 0.5, 8.7]);
      const dome = mesh(
        new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        indigo,
        terrace,
        [x, height + 0.85, -1],
        [width * 0.47, 3.3, 3.4],
      );
      dome.rotation.z = (house - 1) * 0.025;
      for (const dx of [-width * 0.25, width * 0.25]) {
        box(indigo, terrace, [x + dx, height * 0.56, 3.08], [1.25, 2.4, 0.16]);
        box(warm, terrace, [x + dx, height * 0.56, 3.2], [0.62, 1.55, 0.1]);
        box(limestone, terrace, [x + dx, height * 0.56 - 1.35, 3.22], [1.7, 0.22, 0.3]);
      }
      if (house === 1) {
        box(shadow, terrace, [x, 1.7, 3.25], [1.8, 3.4, 0.22]);
        box(indigo, terrace, [x, 3.8, 3.4], [1.85, 0.55, 0.12]);
      }
      source(terrace, [x, height * 0.55, 3.45], "#ffc987", 0.17);
      if (house === 0) {
        for (let step = 0; step < 4; step++)
          box(
            limestone,
            terrace,
            [-width * 0.5 - 1.2, 0.26 - step * 0.32, 4 + step * 1.8],
            [2.6, 0.44, 2],
          );
      }
    }
    // A pergola and vine bed bind separate houses into one inhabitable edge.
    for (const x of [-16, 16]) box(brass, terrace, [x, 6, 7], [0.38, 12, 0.38]);
    box(brass, terrace, [0, 11.9, 7], [32.5, 0.42, 0.48]);
    for (let vine = 0; vine < 8; vine++)
      box(indigo, terrace, [-14 + vine * 4, 11.2 - (vine % 3) * 0.5, 7], [2.7, 0.18, 0.5]);
    light({
      parent: terrace,
      position: [0, 4, 4],
      color: "#ffd29a",
      intensity: 6,
      radius: 18,
      kind: "practical",
    });
  }

  // Crater overlooks are dark, layered silhouettes with a few ember seams.
  for (const [section, fraction, side] of [
    [2, 0.5, -1],
    [3, 0.51, 1],
  ]) {
    const rim = safe(section, fraction, side * 78, 16);
    if (!rim) continue;
    rim.name = "Cannon crater overlook";
    for (let i = 0; i < 9; i++) {
      const x = (i - 4) * 11;
      const h = 19 + (i % 4) * 12;
      const cliff = mesh(
        w.kit.authoredGeometry(
          `ember:basalt-${i % 3 === 0 ? "near" : "mid"}`,
          new THREE.IcosahedronGeometry(1, 1),
        ),
        basalt,
        rim,
        [x, h * 0.5 - 7, -8 - (i % 2) * 6],
        [12 + (i % 3) * 3, h, 12],
      );
      cliff.rotation.y = (i - 4) * 0.13;
    }
    const slit = mesh(bevelBox(34, 0.28, 1.1, 0.06), hot, rim, [0, 2, -2]);
    slit.rotation.y = 0.1;
    source(rim, [0, 4, -3], "#ff7239", 0.36);
    light({
      parent: rim,
      position: [0, 4, -3],
      color: "#ff7940",
      intensity: 10,
      radius: 31,
      kind: "lava",
      staticBake: false,
    });
  }

  // Observatory instruments add a deliberate fine scale against the cliffs.
  for (const [section, fraction, side] of [
    [1, 0.54, 1],
    [3, 0.7, 1],
    [5, 0.45, 1],
  ]) {
    const site = safe(section, fraction, side * 58, 14);
    if (!site) continue;
    site.name = "Astronomical instrument terrace";
    const base = mesh(
      new THREE.CylinderGeometry(1, 1, 1, 20),
      limestone,
      site,
      [0, 1, 0],
      [9, 2, 9],
    );
    base.castShadow = false;
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5;
      box(indigo, site, [Math.cos(a) * 8.3, 1.2, Math.sin(a) * 8.3], [0.18, 1.8, 0.55]).rotation.y =
        -a;
    }
    const ring = mesh(
      new THREE.TorusGeometry(1, 0.12, 8, 48),
      brass,
      site,
      [0, 8, 0],
      [11, 11, 11],
    );
    ring.rotation.x = Math.PI / 2.7;
    const meridian = mesh(
      new THREE.TorusGeometry(1, 0.075, 6, 40),
      indigo,
      site,
      [0, 8, 0],
      [8.5, 8.5, 8.5],
    );
    meridian.rotation.set(0.65, 0.1, 0.3);
    const axis = mesh(bevelBox(0.4, 14, 0.4, 0.08), brass, site, [0, 7, 0]);
    axis.rotation.z = 0.24;
    for (let i = 0; i < 3; i++) {
      const star = mesh(new THREE.SphereGeometry(0.35, 8, 6), warm, site, [
        Math.cos(i * 1.2) * (5 + i),
        11 + (i % 2) * 2.5,
        Math.sin(i * 1.2) * (5 + i),
      ]);
      star.castShadow = false;
      source(site, star.position.toArray(), "#ffe2ad", 0.16);
    }
    light({
      parent: site,
      position: [0, 9, 0],
      color: "#9ecdf4",
      intensity: 5,
      radius: 23,
      kind: "observatory",
    });
  }

  // Light spills remain close to their visible sources in the lantern alley.
  for (const [section, fraction] of [
    [0, 0.58],
    [4, 0.6],
  ]) {
    for (const side of [-1, 1]) {
      const alley = safe(section, fraction, side * 37, 5);
      if (!alley) continue;
      for (let i = 0; i < 2; i++) {
        const y = 3 + i * 4;
        box(brass, alley, [0, y, i * 5 - 5], [0.4, 1.1, 0.4]);
        mesh(new THREE.SphereGeometry(0.36, 10, 8), warm, alley, [0, y + 0.8, i * 5 - 5]);
        source(alley, [0, y + 0.8, i * 5 - 5], "#ffd29a", 0.24);
        light({
          parent: alley,
          position: [0, y + 0.8, i * 5 - 5],
          color: "#ffc783",
          intensity: 4,
          radius: 11,
          kind: "practical",
        });
      }
    }
  }

  edgeRibbon(2, -1, { color: "#d4c9b9", width: 0.12, roughness: 0.58, lift: 0.14, noise: 0.025 });
  edgeRibbon(2, 1, { color: "#d4c9b9", width: 0.12, roughness: 0.58, lift: 0.14, noise: 0.025 });
  patch(hot, "emberwing-fissure-pulse", (shader) => {
    const pulse = { value: 0 };
    (scene.userData.surfaceAnimations ||= []).push(pulse);
    shader.uniforms.fissurePulse = pulse;
    shader.fragmentShader = `uniform float fissurePulse;\n${shader.fragmentShader}`.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      totalEmissiveRadiance*=.82+.18*(.5+.5*sin(fissurePulse*.7));`,
    );
  });
}
