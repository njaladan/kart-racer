/** Reef conservatory refinements: depth, sheltered pockets, and restrained glass light. */
export function polishPelagic(w) {
  const { THREE, mat, at, safe, mesh, motion, light, source, patch, bevelBox, edgeRibbon } = w;
  const reef = mat("#547d79", "rock", { roughness: 0.96 });
  const coralPink = mat("#d28b9a", "rock", { roughness: 0.8 });
  const coralCream = mat("#d9c9a4", "stone", { roughness: 0.82 });
  const brass = mat("#9e9271", "metal", { metalness: 0.63, roughness: 0.3 });
  const glassEdge = mat("#bcebe1", "glass", {
    emissive: "#5ac1aa",
    emissiveIntensity: 0.16,
    roughness: 0.18,
  });
  const grottoGlow = mat("#70e8cd", "glass", {
    emissive: "#39d8b7",
    emissiveIntensity: 1.1,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });
  const random = w.seeded(0x0be1a61c);
  const coralGeometry = w.kit.authoredGeometry(
    "blender:reef-coral",
    new THREE.IcosahedronGeometry(1, 1),
  );

  // Add varied, reef-like silhouettes around the existing terraces, with open gaps.
  for (let section = 1; section <= 4; section++) {
    for (let i = 0; i < 4; i++) {
      const fraction = 0.12 + i * 0.24;
      const side = (i + section) % 2 ? 1 : -1;
      const offset = side * (40 + (i % 3) * 12);
      const site = safe(section, fraction, offset, 13);
      if (!site) continue;
      site.name = "Layered reef pocket";
      for (let j = 0; j < 4; j++) {
        const height = 4 + random() * 10;
        const spread = 1.4 + random() * 1.4;
        const coral = mesh(
          coralGeometry,
          j % 3 ? coralPink : coralCream,
          site,
          [side * (j - 1.5) * 4, height * 0.28, (j % 2 ? 1 : -1) * 4],
          [spread * 2.8, height, spread * 2.8],
        );
        coral.rotation.y = random() * Math.PI * 2;
        coral.castShadow = false;
      }
      for (let j = 0; j < 3; j++) {
        const x = (j - 1) * 4;
        mesh(
          new THREE.ConeGeometry(1, 1, 5),
          j % 2 ? coralCream : coralPink,
          site,
          [x, 3.2, -7 + j * 2],
          [1.2, 6 + (j % 2) * 3, 1.2],
        ).castShadow = false;
      }
      const bubble = mesh(
        new THREE.SphereGeometry(1, 10, 8),
        grottoGlow,
        site,
        [0, -2, 0],
        [0.65, 0.65, 0.65],
      );
      bubble.castShadow = false;
      source(site, [0, -2, 0], "#76eed5", 0.24);
      light({
        parent: site,
        position: [0, -2, 0],
        color: "#43d9bb",
        intensity: 4,
        radius: 13,
        kind: "bioluminescent",
        staticBake: false,
      });
    }
  }

  // Glasshouse ribs gain fine edge glints instead of another transparent shell.
  for (const [section, fraction, radius] of [
    [0, 0.45, 63],
    [1, 0.55, 55],
    [2, 0.5, 72],
    [4, 0.5, 57],
    [5, 0.45, 66],
  ]) {
    const dome = at(section, fraction);
    dome.name = "Glasshouse edge reflection frame";
    for (const h of [0.31, 0.61, 0.84]) {
      const ringRadius = radius * Math.sqrt(1 - h * h);
      const glint = mesh(
        new THREE.TorusGeometry(1, 0.026, 5, 64),
        glassEdge,
        dome,
        [0, -3 + radius * 0.85 * h, 0],
        [ringRadius, ringRadius, ringRadius],
      );
      glint.rotation.x = Math.PI / 2;
      glint.castShadow = false;
    }
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const p = [Math.cos(angle) * radius, -3, Math.sin(angle) * radius];
      mesh(bevelBox(0.34, 1.1, 0.34, 0.08), brass, dome, p, [1, 1, 1]);
      mesh(new THREE.SphereGeometry(0.34, 8, 6), glassEdge, dome, [
        p[0],
        p[1] + 0.8,
        p[2],
      ]).castShadow = false;
    }
  }

  // Rock overhangs make these two localized grottos read as sheltered spaces.
  for (const [section, fraction, side] of [
    [2, 0.24, -1],
    [3, 0.72, 1],
  ]) {
    const grotto = safe(section, fraction, side * 65, 16);
    if (!grotto) continue;
    grotto.name = "Sheltered bioluminescent reef grotto";
    for (const [x, z, sx, sy, sz] of [
      [-15, 0, 12, 20, 15],
      [15, 0, 13, 18, 14],
      [0, -9, 17, 8, 13],
    ]) {
      const wall = mesh(coralGeometry, reef, grotto, [x, -3, z], [sx, sy, sz]);
      wall.rotation.y = x * 0.025;
      wall.castShadow = false;
    }
    const pool = mesh(
      new THREE.CircleGeometry(1, 32),
      grottoGlow,
      grotto,
      [0, -12, -1],
      [10, 1, 8],
    );
    pool.rotation.x = -Math.PI / 2;
    pool.castShadow = false;
    for (let i = 0; i < 6; i++) {
      const crystal = mesh(
        new THREE.ConeGeometry(1, 1, 6),
        grottoGlow,
        grotto,
        [-9 + i * 3.6, -5, 5 + (i % 2) * 2],
        [0.8, 3 + (i % 3), 0.8],
      );
      crystal.castShadow = false;
    }
    source(grotto, [0, -5, 0], "#59e8c8", 0.8);
    light({
      parent: grotto,
      position: [0, -4, 0],
      color: "#37cba9",
      intensity: 9,
      radius: 28,
      kind: "bioluminescent",
      staticBake: false,
    });
  }

  // Narrow shafts pass through existing dome and gallery spaces, not the whole reef.
  for (const [section, fraction, side] of [
    [1, 0.32, -1],
    [2, 0.7, 1],
    [4, 0.33, -1],
  ]) {
    const shaft = safe(section, fraction, side * 26, 4);
    if (!shaft) continue;
    const cone = mesh(
      new THREE.ConeGeometry(1, 1, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: "#b5fff0",
        transparent: true,
        opacity: 0.045,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      shaft,
      [0, 19, 0],
      [9, 38, 9],
    );
    cone.castShadow = false;
    motion(cone, (time) => {
      cone.material.opacity = 0.035 + 0.012 * (0.5 + 0.5 * Math.sin(time * 0.2 + section));
    });
    light({
      parent: shaft,
      position: [0, 35, 0],
      color: "#b4f4e5",
      intensity: 5,
      radius: 30,
      kind: "shaft",
      direction: [0, -1, 0],
      target: [0, -8, 0],
      staticBake: false,
    });
  }

  for (const section of [1, 2, 3, 4]) {
    for (const side of [-1, 1])
      edgeRibbon(section, side, {
        color: "#739d91",
        width: 0.1,
        roughness: 0.5,
        lift: 0.12,
        noise: 0.018,
      });
  }
  patch(glassEdge, "pelagic-edge-fresnel", (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
      float edgeFresnel=pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),3.);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.56,.94,.86),edgeFresnel*.24);`,
    );
  });
}
