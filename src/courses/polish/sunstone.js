/** Sandstone strata, eroded rims and transmitted skylight for Sunstone Ruins. */
export function polishSunstone(w) {
  const { THREE } = w;
  const rand = w.seeded(94821);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const rock = ["#b78359", "#c99568", "#d7ab78", "#e2be8d"].map((c) =>
    w.mat(c, "stone", { roughness: 0.96, bumpScale: 0.055 }),
  );
  const shadow = w.mat("#795640", "stone", { roughness: 1, bumpScale: 0.04 });
  const chalk = w.mat("#f0d2a2", "stone", { roughness: 0.91, bumpScale: 0.045 });
  const sand = w.mat("#d2a966", "sand", { roughness: 1, bumpScale: 0.035 });
  const gold = w.mat("#dda84e", null, { metalness: 0.5, roughness: 0.42 });
  const warmGlass = w.mat("#f7c875", null, {
    emissive: "#ff9e3d",
    emissiveIntensity: 1.7,
    roughness: 0.4,
    transparent: true,
    opacity: 0.82,
  });
  const tealGlass = w.mat("#77c3ad", null, {
    emissive: "#388f85",
    emissiveIntensity: 0.65,
    roughness: 0.34,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
  });
  const shardGeo = new THREE.DodecahedronGeometry(1, 0);
  const columnGeo = new THREE.CylinderGeometry(0.75, 1.05, 1, 7, 1);
  const ringGeo = new THREE.TorusGeometry(1, 0.08, 6, 24);
  const layers = ["#b78359", "#c99568", "#d7ab78", "#e2be8d"].map((hex) => new THREE.Color(hex));
  const outcropMat = w.mat("#ffffff", "stone", {
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.97,
  });

  // Smooth, eroded profiles carry their strata as vertex color bands. Small
  // radial scallops break the contour, while alternating ledges stay rounded.
  function outcropGeometry(seed, height, radius) {
    const around = 28,
      levels = 9,
      positions = [],
      colors = [],
      indices = [];
    for (let row = 0; row <= levels; row++) {
      const t = row / levels;
      const y = t * height;
      const terrace = Math.floor(row / 2) % 2 ? 0.09 : -0.025;
      const base = radius * (1 - t * 0.36 + terrace);
      for (let col = 0; col <= around; col++) {
        const a = (col / around) * Math.PI * 2;
        const noise = 1 + 0.055 * Math.sin(a * 3 + seed) + 0.035 * Math.cos(a * 7 - seed * 0.7);
        const r = Math.max(radius * 0.2, base * noise);
        positions.push(Math.cos(a) * r, y + Math.sin(a * 2 + seed + row) * 0.12, Math.sin(a) * r);
        const color = layers[Math.min(3, Math.floor(row / 2))].clone();
        color.multiplyScalar(0.88 + 0.12 * Math.sin(a * 2 + seed) + t * 0.08);
        colors.push(color.r, color.g, color.b);
        if (row < levels && col < around) {
          const a0 = row * (around + 1) + col;
          indices.push(a0, a0 + around + 1, a0 + 1, a0 + 1, a0 + around + 1, a0 + around + 2);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }
  for (let i = 0; i < 16; i++) {
    const section = i < 9 ? 1 : 2;
    const side = i % 2 ? 1 : -1;
    const g = w.safe(section, 0.07 + rand() * 0.86, side * (15 + rand() * 14), 8.2);
    if (!g) continue;
    const height = 5 + rand() * 8;
    const radius = 3.3 + rand() * 3.7;
    const geo = outcropGeometry(i * 0.73, height, radius);
    const face = w.mesh(geo, outcropMat, g, [0, 0, 0]);
    face.name = "Eroded sandstone strata with sun bleached ledges";
    face.rotation.y = rand() * Math.PI;
    // A bevelled shelf at the foot binds the sculpted face into accumulated soil.
    const footing = w.mesh(
      w.bevelBox(radius * 1.65, 0.48, radius * 1.5, 0.24),
      shadow,
      g,
      [0, 0.22, 0],
    );
    footing.rotation.y = face.rotation.y;
  }
  // Eroded columns carry a wider foot, fractured cap and fine mineral seams.
  for (let i = 0; i < 12; i++) {
    const section = i < 6 ? 2 : i < 9 ? 3 : 5;
    const side = i % 2 ? 1 : -1;
    const g = w.safe(section, 0.08 + rand() * 0.84, side * (13 + rand() * 15), 3.8);
    if (!g) continue;
    const h = 5.5 + rand() * 11;
    const r = 1.25 + rand() * 1.2;
    const shaftMaterial =
      i % 4 === 0
        ? w.mat("#75838a", "stone", { roughness: 0.9, bumpScale: 0.06 })
        : i % 2
          ? chalk
          : pick(rock);
    const shaft = w.mesh(columnGeo, shaftMaterial, g, [0, h / 2, 0], [r, h, r]);
    shaft.rotation.z = rand() * 0.1 - 0.05;
    shaft.rotation.x = rand() * 0.08 - 0.04;
    w.mesh(w.bevelBox(r * 2.35, 0.68, r * 2.2, 0.22), shadow, g, [0, 0.34, 0]);
    w.mesh(w.bevelBox(r * 2.2, 0.48, r * 2.05, 0.2), chalk, g, [0, h + 0.18, 0]).rotation.y =
      rand() * Math.PI;
    for (let band = 0; band < (i % 3 === 0 ? 2 : 1); band++) {
      const seam = w.mesh(
        ringGeo,
        gold,
        g,
        [0, h * (0.34 + band * 0.31), 0],
        [r * 0.95, r * 0.95, r * 0.95],
      );
      seam.rotation.x = Math.PI / 2;
    }
  }
  // Sand gathers in shallow drifts against walls and beside the processional
  // paving; every patch is small and grounded outside every route surface.
  const duneGeo = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
  for (let i = 0; i < 18; i++) {
    const section = [0, 1, 2, 3, 5, 6][i % 6];
    const side = i % 2 ? 1 : -1;
    const g = w.safe(section, 0.07 + rand() * 0.86, side * (12 + rand() * 12), 2.7);
    if (!g) continue;
    const radius = 1.8 + rand() * 3.5;
    const drift = w.mesh(
      duneGeo,
      sand,
      g,
      [0, 0.04, 0],
      [radius * 1.5, 0.45 + rand() * 0.3, radius],
    );
    drift.rotation.y = rand() * Math.PI;
    for (let j = 0; j < 1; j++) {
      const pebble = w.mesh(
        shardGeo,
        pick(rock),
        g,
        [(j - 1) * 1.05, 0.2, 0.5 + rand()],
        [0.36 + rand() * 0.3, 0.24, 0.4],
      );
      pebble.rotation.y = rand() * Math.PI;
    }
  }
  for (const [section, side, color, width] of [
    [1, -1, "#bd8b61", 1.6],
    [1, 1, "#c49265", 1.25],
    [2, -1, "#d9b47c", 1.5],
    [3, 1, "#c8a477", 1.2],
    [5, -1, "#aa865f", 1.4],
    [6, 1, "#e1ba74", 1.7],
  ])
    w.edgeRibbon(section, side, {
      color,
      width,
      textureName: "sand",
      roughness: 1,
      lift: 0.03,
      noise: 0.38,
    });

  // Procession details stop short of the solar mechanism's sight line. Repeated
  // low steles, inset gold bands and small sand piles frame the approach.
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1;
    const g = w.safe(3, 0.12 + i * 0.078, side * (13 + (i % 3) * 2), 2.3);
    if (!g) continue;
    w.mesh(w.bevelBox(2.1, 0.9, 1.5, 0.18), shadow, g, [0, 0.45, 0]);
    w.mesh(w.bevelBox(1.45, 2.1 + (i % 3) * 0.35, 1.05, 0.16), chalk, g, [0, 1.55, 0]);
    w.mesh(w.bevelBox(0.14, 1.25, 0.06, 0.025), gold, g, [0, 1.15, 0.57]);
  }
  // Stained skylight fins cast restrained colored light onto the temple floor.
  // These stay high above the race corridor and keep the existing lenses clear.
  const beams = [];
  for (let i = 0; i < 8; i++) {
    const g = w.at(4, 0.18 + i * 0.083, 0);
    const color = i % 3 === 0 ? "#ffcc78" : i % 3 === 1 ? "#83d6c8" : "#daa0d0";
    const glass = w.mesh(
      new THREE.BoxGeometry(1, 1, 1),
      i % 3 === 1 ? tealGlass : warmGlass,
      g,
      [i % 2 ? -8 : 8, 20.2, 0],
      [0.42, 0.13, 10.5],
    );
    glass.rotation.z = i % 2 ? -0.12 : 0.12;
    const strip = w.mesh(
      new THREE.PlaneGeometry(1, 1),
      w.mat(color, null, {
        emissive: color,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      g,
      [((i % 4) - 1.5) * 2.7, 0.028, 0],
      [1.1, 6.5, 1],
    );
    strip.rotation.x = -Math.PI / 2;
    beams.push({ strip, phase: i * 0.53 });
  }
  w.light({
    parent: w.at(4, 0.52, 0),
    position: [0, 21, 0],
    color: "#f5c785",
    intensity: 0.82,
    radius: 15,
    kind: "shaft",
    pattern: "stained-glass",
    direction: [0, -1, 0],
    staticBake: false,
  });
  // Warm torch brackets reveal local sources and softly color the buried stone.
  const flame = w.mat("#ffd07a", null, {
    emissive: "#ff8d34",
    emissiveIntensity: 2.8,
    roughness: 0.4,
  });
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1;
    const g = w.at(4, 0.12 + i * 0.105, side * 8.2);
    w.mesh(w.bevelBox(0.22, 0.6, 0.22, 0.06), gold, g, [0, 3.05, 0]);
    w.mesh(new THREE.ConeGeometry(0.2, 0.62, 7), flame, g, [0, 3.65, 0], [1, 1, 1]);
    w.light({
      parent: g,
      position: [0, 3.7, 0.1],
      color: "#ffab57",
      intensity: 1.25,
      radius: 11,
      kind: "fire",
      pattern: null,
      staticBake: true,
      speed: 1.8,
      phase: i,
    });
  }
  for (const { strip, phase } of beams)
    w.motion(strip, (time) => {
      strip.material.opacity = 0.12 + 0.035 * (0.5 + 0.5 * Math.sin(time * 0.32 + phase));
    });
}
