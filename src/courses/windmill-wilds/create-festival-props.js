/** Reusable festival props, visitor poses, flags, and produce crates. */
export function createFestivalProps({
  THREE,
  animate,
  arms,
  flags,
  groundShadow,
  random,
  roadside,
  kit,
  palette,
  geometry,
}) {
  const { box, mesh } = kit;
  const { butter, coral, cream, dark, fruit, mint, navy, skin, wood } = palette;
  const { cone, cylinder, disc, sphere } = geometry;
  function beam(parent, a, b, thickness = 0.15, mat = wood) {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b);
    const m = mesh(cylinder, mat, parent, start.clone().add(end).multiplyScalar(0.5).toArray(), [
      thickness,
      start.distanceTo(end),
      thickness,
    ]);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    return m;
  }
  function flag(parent, x, y, z, color = coral, length = 1.7) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    animate(g);
    const geo = new THREE.PlaneGeometry(length, 0.8, 7, 2);
    geo.translate(length / 2, 0, 0);
    const m = color.clone();
    m.side = THREE.DoubleSide;
    const cloth = mesh(geo, m, g);
    cloth.castShadow = false;
    const rest = Float32Array.from(geo.attributes.position.array);
    flags.push({ geo, rest, phase: random() * 6, length });
    return g;
  }
  function pennantLine(parent, a, b, count = 8) {
    beam(parent, a, b, 0.04, dark);
    for (let i = 0; i < count; i++) {
      const f = (i + 0.5) / count;
      const g = new THREE.Group();
      g.position.set(
        THREE.MathUtils.lerp(a[0], b[0], f),
        THREE.MathUtils.lerp(a[1], b[1], f) - 0.25,
        THREE.MathUtils.lerp(a[2], b[2], f),
      );
      parent.add(g);
      const m = mesh(cone, [coral, butter, mint, cream][i % 4], g, [0, -0.3, 0], [0.3, 0.6, 0.06]);
      m.rotation.z = Math.PI;
    }
  }
  function crate(parent, x, y, z, produce = true) {
    box(dark, parent, [x, y + 0.5, z], [1.7, 0.95, 1.25]);
    for (const side of [-1, 1])
      for (let row = 0; row < 3; row++)
        box(wood, parent, [x, y + 0.2 + row * 0.28, z + side * 0.65], [1.8, 0.18, 0.09]);
    for (const side of [-1, 1]) box(wood, parent, [x + side * 0.84, y + 0.47, z], [0.1, 0.95, 1.4]);
    if (produce)
      for (let i = 0; i < 8; i++)
        mesh(
          sphere,
          i % 3 ? fruit : butter,
          parent,
          [x - 0.57 + (i % 4) * 0.37, y + 1.05, z - 0.25 + Math.floor(i / 4) * 0.5],
          [0.21, 0.2, 0.21],
        );
  }
  function tent(section, f, side, color = coral, size = 1) {
    const g = roadside(section, f, side, 13, 5.7);
    if (!g) return;
    g.name = "Striped country fair stall";
    g.scale.setScalar(size);
    groundShadow(g, 9, 8);
    for (const x of [-3, 3]) for (const z of [-2.4, 2.4]) box(wood, g, [x, 2, z], [0.15, 4, 0.15]);
    for (let i = 0; i < 10; i++) {
      const x = -3.15 + (i + 0.5) * 0.63;
      for (const sign of [-1, 1]) {
        const roof = box(i % 2 ? cream : color, g, [x, 4.6, sign * 1.3], [0.63, 0.13, 2.95]);
        roof.rotation.x = sign * 0.38;
      }
      box(i % 2 ? cream : color, g, [x, 3.8, 2.6], [0.63, 0.65, 0.09]);
    }
    box(dark, g, [0, 1.2, 1.7], [5.4, 0.18, 1.4]);
    for (let i = 0; i < 6; i++)
      box(i % 2 ? color : cream, g, [-2.2 + i * 0.88, 0.57, 2.3], [0.85, 1.1, 0.12]);
    crate(g, -1.5, 1.3, 1.7);
    crate(g, 1.2, 1.3, 1.7);
    box(cream, g, [0, 1.3, -1.9], [4.8, 2.5, 0.1]);
    for (const side of [-1, 1]) beam(g, [side * 3, 3.9, 2.5], [side * 4.5, 0.1, 3.4], 0.025, dark);
    flag(g, 0, 5.35, 0, color, 2);
  }
  function visitor(parent, x, y, z, index) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    const color = [coral, mint, navy, butter][index % 4];
    mesh(sphere, color, g, [0, 0.7, 0], [0.33, 0.48, 0.28]);
    for (const side of [-1, 1]) box(dark, g, [side * 0.13, 0.2, 0], [0.17, 0.42, 0.18]);
    mesh(sphere, skin, g, [0, 1.34, 0], [0.26, 0.28, 0.26]);
    mesh(disc, color, g, [0, 1.55, 0], [0.37, 0.08, 0.34]);
    mesh(sphere, color, g, [0, 1.61, 0], [0.24, 0.15, 0.24]);
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.3, 1.02, 0);
      g.add(arm);
      box(color, arm, [side * 0.1, -0.14, 0], [0.16, 0.4, 0.18]);
      mesh(sphere, skin, arm, [side * 0.1, -0.4, 0], [0.12, 0.12, 0.12]);
      if (index % 3 === 0) {
        animate(arm);
        arms.push({ g: arm, side, phase: index * 0.7 });
      } else arm.rotation.z = side * 0.18;
    }
  }

  return { beam, flag, pennantLine, crate, tent, visitor };
}
