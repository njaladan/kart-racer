/** Vaulted stone and the articulated sun engine; all movement is decorative. */
export function buildSolarArchitecture({ THREE, kit, track, palette, animated, motions }) {
  const { mesh, box, groupAt, sectorT } = kit;
  const { stone, pale, gold, dark, glow } = palette;
  const torus = new THREE.TorusGeometry(1, 0.028, 6, 64);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 16);
  const orbit = (object, update) => {
    animated.push(object);
    motions.push(update);
  };
  // Real voussoirs produce a curved silhouette and deep articulated soffit.
  const wedges = [];
  for (let j = 0; j < 17; j++) {
    const a = (j * Math.PI) / 17 + 0.008,
      b = ((j + 1) * Math.PI) / 17 - 0.008,
      shape = new THREE.Shape();
    shape.moveTo(Math.cos(a) * 19.5, Math.sin(a) * 19.5);
    shape.lineTo(Math.cos(a) * 22, Math.sin(a) * 22);
    shape.lineTo(Math.cos(b) * 22, Math.sin(b) * 22);
    shape.lineTo(Math.cos(b) * 19.5, Math.sin(b) * 19.5);
    shape.closePath();
    wedges.push(new THREE.ExtrudeGeometry(shape, { depth: 2.2, bevelEnabled: false }));
  }
  for (let i = 0; i < 7; i++) {
    const g = groupAt(sectorT(4, 0.04 + i * 0.15));
    for (const [j, wedge] of wedges.entries()) mesh(wedge, j % 4 ? stone : pale, g, [0, 5, -1.1]);
    for (const side of [-1, 1]) {
      box(stone, g, [side * 20.5, 2.5, 0], [3, 5, 3.5]);
      box(pale, g, [side * 20.5, 0.8, 0], [4, 1.6, 4]);
    }
  }
  // Inlaid sun mosaics sit exactly on the banked surface, under each lens.
  for (const [i, fraction] of track.course.solarEngine.fractions.entries()) {
    const g = groupAt(sectorT(4, fraction));
    for (const radius of [5.4, 6.1, 7.6]) {
      const ring = mesh(
        torus,
        radius === 6.1 ? dark : gold,
        g,
        [0, 0.09, 0],
        [radius, radius, 0.35],
      );
      ring.rotation.x = -Math.PI / 2;
      ring.castShadow = false;
    }
    for (let j = 0; j < 16; j++) {
      const a = (j * Math.PI) / 8,
        ray = box(gold, g, [Math.sin(a) * 6.8, 0.085, Math.cos(a) * 6.8], [0.22, 0.04, 1.1]);
      ray.rotation.y = a;
      ray.castShadow = false;
    }
    // Three concentric gimbals suspended above the full camera clearance.
    const engine = new THREE.Group();
    engine.position.y = 19;
    g.add(engine);
    const rings = [];
    for (let j = 0; j < 3; j++) {
      const pivot = new THREE.Group();
      engine.add(pivot);
      const radius = 5.2 - j * 0.8;
      mesh(torus, gold, pivot, [0, 0, 0], [radius, radius, radius]);
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI) / 6,
          lug = box(pale, pivot, [Math.cos(a) * radius, Math.sin(a) * radius, 0], [0.55, 0.3, 0.5]);
        lug.rotation.z = a;
      }
      rings.push(pivot);
    }
    mesh(new THREE.SphereGeometry(1, 20, 12), glow, engine, [0, 0, 0], [1.3, 1.3, 1.3]);
    orbit(engine, (time) => {
      for (const [j, ring] of rings.entries()) {
        ring.rotation.x = time * (0.09 + j * 0.035) + i;
        ring.rotation.y = time * (j % 2 ? -0.15 : 0.12) + j;
      }
    });
    for (const side of [-1, 1]) {
      const t = sectorT(4, fraction),
        edge = side < 0 ? -track.surfaceAt(t).leftEdge : track.surfaceAt(t).rightEdge,
        post = Math.max(12.8, edge + 2.8);
      box(dark, g, [side * post, 15, 0], [1.1, 30, 1.1]);
      box(gold, g, [(side * post) / 2, 26.5, 0], [post, 0.55, 1.1]);
      mesh(cylinder, gold, g, [side * post, 20, 0], [1, 0.6, 1]);
    }
  }
  // The distant monument gains broad terraces, pylons and oblique sun sails.
  const crown = groupAt(sectorT(3, 0.26), -70);
  for (const side of [-1, 1]) {
    box(stone, crown, [side * 43, 18, 0], [14, 44, 24]);
    box(pale, crown, [side * 43, 41, 0], [18, 3, 28]);
    for (let j = 0; j < 5; j++) box(gold, crown, [side * 43, 6 + j * 6, 12.05], [8, 0.6, 0.15]);
    for (let j = 0; j < 6; j++)
      box(pale, crown, [side * (54 + j * 3), -10 + j * 0.8, 0], [3.2, 2, 75]);
  }
}
