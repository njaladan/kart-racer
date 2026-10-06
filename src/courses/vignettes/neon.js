/** A playful noodle sign and a working cargo hoist belong to different districts. */
export function buildNeonStories(w) {
  const { mat, mesh, box, sphere, cylinder, group, site, tube, motion } = w;
  const navy = mat("#253750", "metal", { metalness: 0.45 }),
    copper = mat("#c2795f", "metal"),
    pink = mat("#ff70b2", "metal", { emissive: "#d7276f", emissiveIntensity: 0.65 }),
    aqua = mat("#73e7db", "metal", { emissive: "#1d9b98", emissiveIntensity: 0.55 }),
    ivory = mat("#efe3bb"),
    ink = mat("#131c34"),
    amber = mat("#f2b75d", "metal");
  const shop = site("Mechanical octopus noodle kiosk", 2, 0.55, -1, 12, 22);
  box(navy, shop, [0, 3, 0], [13, 6, 7]);
  box(copper, shop, [0, 6.5, 0], [15, 1, 9]);
  box(ink, shop, [0, 3.7, 3.55], [11, 3, 0.1]);
  for (const x of [-5, 0, 5]) mesh(cylinder, pink, shop, [x, 7.5, 4], [0.45, 1.5, 0.45]);
  for (let i = 0; i < 6; i++) {
    mesh(
      new w.THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      ivory,
      shop,
      [-5 + i * 2, 2.4, 4.5],
      [0.7, 0.5, 0.7],
    );
    tube(shop, [-5.4 + i * 2, 2.9, 4.5], [-4.5 + i * 2, 3.5, 4.5], 0.05, copper);
  }
  const mascot = group(shop, [0, 13, 0]);
  mesh(sphere, pink, mascot, [0, 0, 0], [3.8, 4.1, 2.5]);
  for (const side of [-1, 1]) {
    mesh(sphere, ivory, mascot, [side * 1.2, 0.4, 2.15], [0.65, 0.75, 0.35]);
    mesh(sphere, ink, mascot, [side * 1.2, 0.4, 2.48], [0.24, 0.4, 0.1]);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      arm = group(mascot, [Math.cos(a) * 2.4, -2, Math.sin(a) * 1.3]);
    const curve = new w.THREE.CatmullRomCurve3(
      [
        [0, 0, 0],
        [2.3, -1.3, 0],
        [3, -3, 0],
        [2, -3.7, 0],
        [1.2, -3, 0],
      ].map((p) => new w.THREE.Vector3(...p)),
    );
    mesh(new w.THREE.TubeGeometry(curve, 16, 0.42, 7, false), i % 2 ? aqua : pink, arm);
    motion(arm, (time) => {
      arm.rotation.y = a;
      arm.rotation.z = Math.sin(time * 0.8 + i) * 0.22;
    });
  }

  const dock = site("Container crane with suspended freight", 4, 0.3, 1, 14, 30);
  for (const x of [-8, 8]) {
    tube(dock, [x, 0, -5], [x, 24, 0], 0.55, amber);
    tube(dock, [x, 0, 5], [x, 24, 0], 0.55, amber);
  }
  box(amber, dock, [0, 24, 0], [19, 1.1, 2.8]);
  box(navy, dock, [0, 24.8, 0], [20, 0.3, 1.8]);
  for (let i = 0; i < 8; i++) tube(dock, [-8 + i * 2, 24, 0], [-6 + i * 2, 20, 0], 0.13, navy);
  const carriage = group(dock, [0, 23, 0]);
  box(navy, carriage, [0, 0, 0], [3, 2, 4]);
  const load = group(carriage, [0, -13, 0]);
  box(aqua, load, [0, 0, 0], [6, 4, 4]);
  for (let i = 0; i < 9; i++) box(navy, load, [-2.7 + i * 0.68, 0, 2.03], [0.12, 3.8, 0.09]);
  const cable = tube(carriage, [0, -0.8, 0], [0, -11, 0], 0.07, ivory);
  motion(carriage, (time) => {
    carriage.position.x = Math.sin(time * 0.24) * 5;
  });
  motion(load, (time) => {
    load.position.y = -12 + Math.sin(time * 0.48) * 3;
    load.rotation.y = Math.sin(time * 0.4) * 0.08;
  });
  motion(cable, (time) => {
    const length = 9 + Math.sin(time * 0.48) * -3;
    cable.position.y = -0.8 - length / 2;
    cable.scale.y = length;
  });
}
