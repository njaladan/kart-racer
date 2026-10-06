/** A chalet snow globe and looping penguin sleds add festival-scale spectacle. */
export function buildFrostpeakStories(w) {
  const { mat, mesh, box, sphere, cylinder, cone, group, site, tube, motion } = w;
  const snow = mat("#f3f4ff", "snow"),
    blue = mat("#729acd", "metal"),
    pine = mat("#537f86", "leaves"),
    timber = mat("#aa786b", "wood"),
    glow = mat("#ffe4a0", "metal", { emissive: "#e2a047", emissiveIntensity: 0.5 }),
    ink = mat("#31364b"),
    red = mat("#cf656e"),
    gold = mat("#edc077");
  const globe = site("Swirling chalet snow globe", 3, 0.38, 1, 13, 28);
  mesh(cylinder, blue, globe, [0, 2, 0], [10.5, 4, 10.5]);
  mesh(cylinder, snow, globe, [0, 4, 0], [9.8, 0.5, 9.8]);
  box(timber, globe, [0, 7, 0], [7, 6, 6]);
  const roof = mesh(cone, red, globe, [0, 12, 0], [6.5, 5, 6.5]);
  roof.rotation.y = Math.PI / 4;
  for (const x of [-2, 2]) box(glow, globe, [x, 7.5, 3.05], [1.5, 2, 0.1]);
  for (const side of [-1, 1])
    for (let j = 0; j < 3; j++) {
      const x = side * (5.5 + j * 0.6),
        z = -3 + j * 3;
      mesh(cylinder, timber, globe, [x, 6, z], [0.2, 4, 0.2]);
      for (let k = 0; k < 3; k++)
        mesh(
          cone,
          k % 2 ? snow : pine,
          globe,
          [x, 6.5 + k * 1.1, z],
          [1.8 - k * 0.4, 3, 1.8 - k * 0.4],
        );
    }
  const shell = mat("#cceaff", "glass", {
    transparent: true,
    opacity: 0.085,
    depthWrite: false,
    side: w.THREE.DoubleSide,
    roughness: 0.2,
  });
  mesh(sphere, shell, globe, [0, 14, 0], [11.2, 11.2, 11.2]).castShadow = false;
  const flakes = new w.THREE.InstancedMesh(sphere, snow, 44),
    matrix = new w.THREE.Matrix4(),
    scale = new w.THREE.Vector3(0.11, 0.11, 0.11),
    rotation = new w.THREE.Quaternion(),
    point = new w.THREE.Vector3();
  globe.add(flakes);
  flakes.instanceMatrix.setUsage(w.THREE.DynamicDrawUsage);
  flakes.geometry.computeBoundingSphere();
  flakes.boundingSphere = new w.THREE.Sphere(new w.THREE.Vector3(0, 14, 0), 11);
  motion(flakes, (time) => {
    for (let i = 0; i < 44; i++) {
      const y = 6 + ((((i * 0.37 - time * 0.45) % 15) + 15) % 15),
        a = i * 2.4 + time * 0.25,
        radius = Math.min(8, Math.sqrt(Math.max(0, 100 - (y - 14) ** 2))) * (0.5 + (i % 5) * 0.08);
      point.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
      flakes.setMatrixAt(i, matrix.compose(point, rotation, scale));
    }
    flakes.instanceMatrix.needsUpdate = true;
  });

  const playground = site("Penguin toboggan playground", 7, 0.34, -1, 14, 15);
  box(snow, playground, [0, 0.4, 0], [21, 0.8, 13]);
  tube(playground, [-9, 7, 0], [9, 1, 0], 1.3, blue);
  for (const x of [-8, 8]) tube(playground, [x, 0, 0], [x, x < 0 ? 7 : 1, 0], 0.3, timber);
  for (let i = 0; i < 3; i++) {
    const sled = group(playground);
    box(red, sled, [0, 0.15, 0], [2.8, 0.25, 2]);
    for (const side of [-1, 1])
      tube(sled, [-1.3, -0.1, side * 0.8], [1.5, -0.1, side * 0.8], 0.07, gold);
    mesh(sphere, ink, sled, [0, 1.4, 0], [0.7, 1.2, 0.7]);
    mesh(sphere, snow, sled, [0, 1.4, 0.55], [0.5, 0.8, 0.15]);
    mesh(sphere, ink, sled, [0, 2.5, 0], [0.6, 0.6, 0.6]);
    mesh(cone, gold, sled, [0, 2.5, 0.65], [0.18, 0.5, 0.18]).rotation.x = Math.PI / 2;
    box(red, sled, [0, 2, 0], [1.3, 0.22, 1.3]);
    motion(sled, (time) => {
      const cycle = (((time * 0.1 + i / 3) % 1) + 1) % 1;
      const down = cycle < 0.65,
        q = down ? cycle / 0.65 : 1 - (cycle - 0.65) / 0.35;
      sled.position.set(-8 + q * 16, 6.8 - q * 5.3, down ? 0 : -5);
      sled.rotation.z = down ? -0.31 : 0.15;
      sled.rotation.y = down ? 0 : Math.PI;
    });
  }
}
