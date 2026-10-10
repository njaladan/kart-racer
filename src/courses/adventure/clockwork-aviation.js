/** Air traffic above and beside the terraces; no characters or race obstacles. */
export function buildClockworkAviation(w, art) {
  const { THREE, scenery, mat, mesh, box, sphere, cylinder, torus, motion } = w;
  const { bronze, iron, copper, glow, pipe } = art;
  const silk = mat("#f3dab0", "fabric", { roughness: 0.7 });
  const burgundy = mat("#933d32", "fabric", { roughness: 0.7 });
  const goldSilk = mat("#e2b359", "fabric", { roughness: 0.68 });
  const flightTime = (time, state) => (state?.motionEnabled === false ? 0 : time);
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    scenery.add(g);
    g.name = "Golden passenger zeppelin";
    const base = new THREE.Vector3(-170 + i * 205, 178 + i * 39, -180 + i * 160);
    g.position.copy(base);
    g.rotation.y = 0.5 + i * 1.4;
    const size = 0.8 + i * 0.16;
    g.scale.setScalar(size);
    mesh(sphere, silk, g, [0, 0, 0], [14, 14, 49]);
    // Brass rings and longitudinal ribs trace the envelope rather than hiding
    // it behind a solid metal ellipsoid.
    for (let ring = -3; ring <= 3; ring++) {
      const z = ring * 11;
      const r = 14.15 * Math.sqrt(1 - (z / 49) ** 2);
      mesh(torus, bronze, g, [0, 0, z], [r, r, r]);
    }
    for (let rib = 0; rib < 8; rib++) {
      const angle = (rib * Math.PI) / 4;
      const points = Array.from({ length: 33 }, (_, j) => {
        const z = -47 + (j * 94) / 32;
        const r = 14.1 * Math.sqrt(1 - (z / 49) ** 2);
        return new THREE.Vector3(Math.cos(angle) * r, Math.sin(angle) * r, z);
      });
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, 0.12, 4), bronze, g);
    }
    box(copper, g, [0, -18, 0], [9, 5, 24]);
    mesh(sphere, bronze, g, [0, -18, 12], [4.5, 2.5, 5]);
    for (let j = 0; j < 7; j++)
      for (const side of [-1, 1]) {
        box(iron, g, [side * 4.55, -17.8, -9 + j * 3], [0.2, 2.4, 1.9]);
        box(glow, g, [side * 4.68, -17.8, -9 + j * 3], [0.1, 1.6, 1.3]);
      }
    for (const side of [-1, 1]) {
      pipe(g, [side * 4, -15.5, -9], [side * 7, -10, -14], 0.25, bronze);
      pipe(g, [side * 4, -15.5, 9], [side * 7, -10, 14], 0.25, bronze);
      const fin = box(burgundy, g, [side * 11, 0, -37], [19, 0.8, 16]);
      fin.rotation.y = side * 0.35;
      mesh(sphere, copper, g, [side * 11, -14, -5], [2.2, 2.2, 6]);
      const propeller = new THREE.Group();
      g.add(propeller);
      propeller.position.set(side * 11, -14, 2);
      mesh(cylinder, bronze, propeller, [0, 0, 0], [0.6, 1, 0.6]).rotation.x = Math.PI / 2;
      box(iron, propeller, [0, 0, 0.5], [0.7, 10, 0.25]);
      box(iron, propeller, [0, 0, 0.5], [10, 0.7, 0.25]);
      motion(propeller, (time, state) => {
        propeller.rotation.z = flightTime(time, state) * side * 3;
      });
    }
    box(burgundy, g, [0, 12, -38], [0.8, 20, 16]);
    motion(g, (time, state) => {
      const t = flightTime(time, state);
      g.position
        .copy(base)
        .add(
          new THREE.Vector3(
            Math.sin(t * 0.035 + i) * 55,
            Math.sin(t * 0.2 + i) * 2.5,
            Math.cos(t * 0.035 + i) * 35,
          ),
        );
      g.rotation.z = Math.sin(t * 0.12 + i) * 0.02;
    });
  }
  const envelope = new THREE.SphereGeometry(1, 32, 20);
  envelope.clearGroups();
  // Alternating silk gores remain visible as the balloons drift.
  for (let row = 0; row < 20; row++)
    for (let col = 0; col < 32; col++) {
      // SphereGeometry omits one triangle at each pole.
      const start = row === 0 ? col * 3 : 32 * 3 + (row - 1) * 32 * 6 + col * (row === 19 ? 3 : 6);
      envelope.addGroup(start, row === 0 || row === 19 ? 3 : 6, Math.floor(col / 4) % 2);
    }
  for (let i = 0; i < 9; i++) {
    const angle = (i * Math.PI * 2) / 9;
    const base = new THREE.Vector3(
      Math.cos(angle) * (300 + (i % 3) * 55),
      125 + (i % 4) * 35,
      Math.sin(angle) * (300 + (i % 3) * 55),
    );
    const g = new THREE.Group();
    scenery.add(g);
    g.name = "Striped hot air balloon";
    g.position.copy(base);
    const r = 9 + (i % 3);
    mesh(envelope, [silk, i % 2 ? burgundy : goldSilk], g, [0, 15, 0], [r, r * 1.28, r]);
    mesh(torus, bronze, g, [0, 15, 0], [r + 0.15, r + 0.15, r + 0.15]).rotation.x = Math.PI / 2;
    mesh(cylinder, bronze, g, [0, 3, 0], [1.7, 2, 1.7]);
    box(copper, g, [0, -2, 0], [5.5, 3.2, 5.5]);
    for (const x of [-1, 1])
      for (const z of [-1, 1])
        pipe(g, [x * 2.5, -0.4, z * 2.5], [x * 3.5, 7, z * 3.5], 0.09, bronze);
    mesh(sphere, glow, g, [0, 3, 0], [0.5, 1.3, 0.5]);
    motion(g, (time, state) => {
      const t = flightTime(time, state);
      g.position
        .copy(base)
        .add(
          new THREE.Vector3(
            Math.sin(t * 0.04 + i) * 8,
            Math.sin(t * 0.32 + i) * 3,
            Math.cos(t * 0.04 + i) * 8,
          ),
        );
      g.rotation.z = Math.sin(t * 0.25 + i) * 0.035;
    });
  }
}
