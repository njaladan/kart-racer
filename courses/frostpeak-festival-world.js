// Theme-only props. Ground, snow apron, road surfaces, rails and pickups are
// built by the shared engine from the same metadata used by vehicle physics.
export function buildWorld({
  THREE,
  scene,
  scenery,
  track,
  textures,
  kit,
  hazardAt,
}) {
  const { material, mesh, box, groupAt, sectorT, asset, batch, align } = kit;
  const snow = material("#f4fbff", { map: textures.snow, roughness: 0.95 });
  const timber = material("#d1ae89", { map: textures.wood }),
    roof = material("#bc6a7d", { map: textures.wood });
  const bark = material("#b8997d", { map: textures.bark }),
    cream = material("#eadbc7");
  const dark = material("#354952"),
    cyan = material("#54d9df"),
    red = material("#f2788b");
  const yellow = material("#ffe092"),
    glass = material("#9ddbe7", { metalness: 0.15, roughness: 0.25 });
  const rock = material("#b4c6d3", { map: textures.stone }),
    amber = material("#ffaf45", {
      emissive: "#df7900",
      emissiveIntensity: 0.3,
    });
  const cone = new THREE.ConeGeometry(1, 1, 8),
    sphere = new THREE.SphereGeometry(1, 8, 6);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
  const edgeOffset = (t, side, margin) =>
    side *
      (side > 0 ? track.surfaceAt(t).rightEdge : -track.surfaceAt(t).leftEdge) +
    side * margin;

  function chalet(t, side) {
    const g = groupAt(t, edgeOffset(t, side, 13), scenery);
    box(rock, g, [0, 0.3, 0], [9.4, 0.6, 11.4]);
    box(timber, g, [0, 2.9, 0], [9, 5.2, 11]);
    for (const x of [-4.25, 4.25])
      for (const z of [-5.5, 5.5]) box(bark, g, [x, 2.9, z], [0.28, 5.2, 0.18]);
    box(cream, g, [0, 5.35, -5.54], [8.8, 0.35, 0.12]);
    box(bark, g, [0, 2, -5.6], [8.8, 0.3, 0.18]);
    for (const x of [-2.65, 2.65]) {
      const r = box(roof, g, [x, 6, 0], [6.1, 0.35, 12]);
      r.rotation.z = x > 0 ? -0.48 : 0.48;
      const cap = box(snow, g, [x, 6.22, 0], [6.2, 0.18, 12.1]);
      cap.rotation.z = r.rotation.z;
    }
    for (const x of [-2.7, 2.7]) {
      box(bark, g, [x, 3.4, -5.62], [2.05, 2.1, 0.16]);
      box(yellow, g, [x, 3.4, -5.73], [1.7, 1.75, 0.06]);
      box(bark, g, [x, 3.4, -5.78], [0.1, 1.8, 0.04]);
      box(bark, g, [x, 3.4, -5.78], [1.7, 0.1, 0.04]);
      box(snow, g, [x, 2.43, -5.75], [2.3, 0.18, 0.35]);
      for (const dx of [-1.28, 1.28])
        box(red, g, [x + dx, 3.4, -5.66], [0.38, 1.9, 0.13]);
    }
    box(red, g, [0, 1.7, -5.55], [1.7, 3.4, 0.07]);
    box(rock, g, [3, 7.5, 1.8], [0.9, 2.5, 0.9]);
  }
  for (const f of [0.07, 0.27, 0.47, 0.78])
    for (const side of [-1, 1]) chalet(sectorT(0, f), side);
  for (const f of [0.63, 0.86]) chalet(sectorT(5, f), -1);

  function snowyPine(t, side, size = 1) {
    const g = groupAt(t, edgeOffset(t, side, 7 + size * 2), scenery);
    const height = 11 * size;
    // Kenney's tapered four-tier silhouette remains visible between the
    // smaller snow caps; source model colors retain their baked shading.
    asset("pine", g, [0, 0, 0], [height, height, height]);
    mesh(
      cylinder,
      bark,
      g,
      [0, 0.08 * height, 0],
      [0.022 * height, 0.16 * height, 0.022 * height],
    );
    for (const [y, r, h] of [
      [0.45, 0.13, 0.19],
      [0.625, 0.095, 0.14],
      [0.8, 0.055, 0.13],
      [0.937, 0.024, 0.13],
    ])
      mesh(
        cone,
        snow,
        g,
        [0, y * height, 0],
        [r * height, h * height, r * height],
      );
  }
  for (let i = 0; i < 38; i++)
    for (const side of [-1, 1])
      snowyPine(sectorT(1, (i + 0.5) / 38), side, 0.85 + (i % 4) * 0.13);
  for (let i = 0; i < 18; i++)
    for (const side of [-1, 1])
      snowyPine(sectorT(i % 2 ? 0 : 3, (i + 0.5) / 18), side, 0.85);

  function flag(t, side, index) {
    const g = groupAt(t, edgeOffset(t, side, 3), scenery);
    mesh(cylinder, dark, g, [0, 3.5, 0], [0.1, 7, 0.1]);
    box(index % 2 ? cyan : red, g, [side * 1.25, 6.1, 0], [2.5, 1.15, 0.09]);
    mesh(sphere, snow, g, [0, 0.25, 0], [1.2, 0.35, 1.2]);
  }
  for (let s = 0; s < 6; s++)
    for (let i = 0; i < 10; i++)
      for (const side of [-1, 1]) flag(sectorT(s, (i + 0.5) / 10), side, i + s);

  // Mountain silhouettes stand outside the loop. Ridge markers stay low so
  // the village and grandstands remain visible across the summit reveal.
  for (let i = 0; i < 5; i++) {
    const g = groupAt(
      sectorT(2, 0.15 + i * 0.17),
      -100 - (i % 2) * 18,
      scenery,
    );
    mesh(cone, rock, g, [0, 12, 0], [26, 52, 26]);
    mesh(cone, snow, g, [0, 29, 0], [10.5, 19, 10.5]);
  }
  for (const f of [0.18, 0.44, 0.71])
    for (const side of [-1, 1]) {
      const g = groupAt(
        sectorT(2, f),
        edgeOffset(sectorT(2, f), side, 9),
        scenery,
      );
      asset(f < 0.5 ? "rock-a" : "rock-b", g, [0, 0, 0], [1.65, 2.2, 1.35]);
      mesh(sphere, snow, g, [0, 1.9, 0], [2.6, 0.45, 2.1]);
    }

  function banner(t, color) {
    const g = groupAt(t, 0, scenery);
    for (const x of [-19, 19]) box(timber, g, [x, 6.7, 0], [0.4, 13.4, 0.4]);
    box(dark, g, [0, 13.3, 0], [38, 0.4, 0.4]);
    // Lowest fabric is 11.65 metres above the surface.
    box(color, g, [0, 12.4, 0], [36, 1.5, 0.12]);
  }
  banner(sectorT(3, 0.13), red);
  banner(sectorT(3, 0.58), cyan);

  // Resort rink fencing sits beyond the collision boundary; decorative
  // hockey goals and seating never occupy the driveable ice.
  for (const f of [0.18, 0.37]) {
    const g = groupAt(sectorT(4, f), -19, scenery);
    for (const x of [-3, 3]) box(red, g, [x, 1.8, 0], [0.14, 3.6, 0.14]);
    box(red, g, [0, 3.6, 0], [6, 0.14, 0.14]);
    box(glass, g, [0, 1.6, 1.3], [6, 3.2, 0.12]);
  }
  for (const f of [0.25, 0.57, 0.79]) {
    const t = sectorT(5, f),
      g = groupAt(t, edgeOffset(t, -1, 13), scenery);
    box(timber, g, [0, 1.2, 0], [9, 2.4, 18]);
    for (let row = 0; row < 3; row++) {
      box(
        row % 2 ? cyan : red,
        g,
        [-2 + row * 1.8, 2.7 + row * 0.8, 0],
        [1.5, 0.35, 17],
      );
      for (let person = 0; person < 8; person++) {
        const x = -2 + row * 1.8,
          z = -7 + person * 2;
        box(
          person % 2 ? red : cyan,
          g,
          [x, 3.1 + row * 0.8, z],
          [0.5, 0.8, 0.5],
        );
        mesh(sphere, snow, g, [x, 3.75 + row * 0.8, z], [0.32, 0.32, 0.32]);
      }
    }
  }

  const groomer = new THREE.Group();
  scene.add(groomer);
  box(red, groomer, [0, 0.9, 0], [2.3, 1.05, 3.4]);
  for (const x of [-0.98, 0.98])
    box(dark, groomer, [x, 0.35, 0], [0.5, 0.6, 3.8]);
  box(red, groomer, [0, 1.8, 0.35], [1.65, 1.05, 1.9]);
  box(glass, groomer, [0, 1.9, -0.62], [1.4, 0.7, 0.08]);
  box(rock, groomer, [0, 0.42, -1.98], [2.66, 0.55, 0.3]);
  mesh(cylinder, amber, groomer, [0, 2.44, 0.4], [0.21, 0.25, 0.21]);
  batch(groomer);
  const warning = groupAt(sectorT(4, 0.78), 16, scenery);
  box(dark, warning, [0, 1.65, 0], [0.2, 3.3, 0.2]);
  const beacon = mesh(sphere, amber, warning, [0, 3.7, 0], [0.55, 0.55, 0.55]);
  batch(scenery);
  return {
    animated: [groomer, beacon],
    update(time) {
      const state = hazardAt(time);
      align(groomer, state);
      beacon.visible = state.warning
        ? Math.floor(time * 6) % 2 === 0
        : state.active;
    },
  };
}
