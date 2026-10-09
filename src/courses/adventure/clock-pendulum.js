/** Turned brass bob with the lenticular face and regulator of an upright clock. */
export function clockPendulumBob(w, parent, radius, depth, brass, darkBrass) {
  const { THREE, mesh } = w;
  const bob = new THREE.Group();
  bob.name = "Upright clock pendulum bob";
  parent.add(bob);
  mesh(new THREE.SphereGeometry(1, 32, 16), brass, bob, [0, 0, 0], [radius, radius, depth / 2]);
  const rim = new THREE.TorusGeometry(radius * 0.92, radius * 0.045, 8, 48);
  const engraving = new THREE.TorusGeometry(radius * 0.7, radius * 0.012, 6, 48);
  const boss = new THREE.SphereGeometry(1, 16, 10);
  // Both faces are finished: racers see the clock from either side of the gate.
  for (const side of [-1, 1]) {
    mesh(rim, brass, bob, [0, 0, side * depth * 0.2]);
    mesh(engraving, darkBrass, bob, [0, 0, side * depth * 0.36]);
    mesh(boss, brass, bob, [0, 0, side * depth * 0.48], [radius * 0.2, radius * 0.2, depth * 0.1]);
    mesh(
      boss,
      darkBrass,
      bob,
      [0, 0, side * depth * 0.57],
      [radius * 0.055, radius * 0.055, depth * 0.025],
    );
  }
  mesh(
    new THREE.CylinderGeometry(radius * 0.025, radius * 0.025, radius * 0.17, 10),
    darkBrass,
    bob,
    [0, -radius * 1.04, 0],
  );
  mesh(new THREE.CylinderGeometry(radius * 0.12, radius * 0.12, radius * 0.06, 16), brass, bob, [
    0,
    -radius * 1.12,
    0,
  ]);
  return bob;
}
