/** An orchard press and a busy apiary make the harvest valley work for a living. */
export function buildWindmillStories(w) {
  const { mat, mesh, box, sphere, cylinder, torus, group, site, tube, wheel, motion } = w;
  const timber = mat("#80563b", "wood"),
    cream = mat("#efd8a0", "wood"),
    iron = mat("#556365", "metal", { metalness: 0.5 }),
    apple = mat("#df6749"),
    honey = mat("#efb847"),
    ink = mat("#363936"),
    flower = mat("#b991db"),
    green = mat("#769b53", "leaves"),
    wing = mat("#e9f3d7", "fabric", { side: w.THREE.DoubleSide });
  const press = site("Cider orchard screw press", 5, 0.48, -1, 11, 17);
  for (const x of [-4, 4]) box(timber, press, [x, 6, 0], [1, 12, 1.2]);
  box(timber, press, [0, 11.5, 0], [10, 1, 1.5]);
  mesh(cylinder, iron, press, [0, 7, 0], [0.35, 9, 0.35]);
  for (let i = 0; i < 16; i++) {
    const thread = mesh(torus, iron, press, [0, 4 + i * 0.4, 0], [0.55, 0.55, 0.55]);
    thread.rotation.x = Math.PI / 2;
  }
  const basket = group(press, [0, 2.6, 0]);
  for (let i = 0; i < 20; i++) {
    const a = (i * Math.PI) / 10;
    box(cream, basket, [Math.cos(a) * 3, 0, Math.sin(a) * 3], [0.45, 4.6, 0.45]);
  }
  for (const y of [-1.7, 1.7])
    mesh(torus, iron, basket, [0, y, 0], [3.1, 3.1, 3.1]).rotation.x = Math.PI / 2;
  const plate = mesh(cylinder, timber, press, [0, 5, 0], [2.9, 0.5, 2.9]);
  motion(plate, (time) => {
    plate.position.y = 4.8 + Math.sin(time * 0.45) * 0.6;
  });
  const crank = wheel(press, [0, 10, 0], 2.8, iron, 8);
  motion(crank, (time) => {
    crank.rotation.z = time * 0.35;
  });
  tube(press, [3, 1, 0], [7, 1, 0], 0.22, iron);
  mesh(cylinder, cream, press, [7, 0.8, 0], [1.3, 1.6, 1.3]);
  mesh(cylinder, honey, press, [7, 1.55, 0], [1.15, 0.05, 1.15]);
  box(timber, press, [-6, 0.9, 3], [3.6, 1.8, 4]);
  for (let i = 0; i < 15; i++)
    mesh(
      sphere,
      apple,
      press,
      [-7 + (i % 3) * 0.9, 1.8 + Math.floor(i / 9) * 0.8, 1.8 + (Math.floor(i / 3) % 3)],
      [0.55, 0.5, 0.55],
    );

  const apiary = site("Lavender apiary and dancing bees", 0, 0.62, 1, 12, 15);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 5;
    box(timber, apiary, [x, 0.6, 0], [3, 1.2, 3]);
    for (let j = 0; j < 4; j++)
      box(j % 2 ? cream : honey, apiary, [x, 1.5 + j * 0.85, 0], [2.8, 0.8, 2.6]);
    box(timber, apiary, [x, 4.8, 0], [3.5, 0.45, 3.3]);
    box(ink, apiary, [x, 1.5, 1.31], [1.4, 0.17, 0.05]);
  }
  for (let i = 0; i < 30; i++) {
    const x = Math.sin(i * 2.4) * 9,
      z = 4 + (i % 4) * 1.2;
    tube(apiary, [x, 0, z], [x, 1.4, z], 0.06, green);
    mesh(sphere, flower, apiary, [x, 1.3, z], [0.24, 0.65, 0.24]);
  }
  for (let i = 0; i < 6; i++) {
    const bee = group(apiary);
    mesh(sphere, honey, bee, [0, 0, 0], [0.5, 0.4, 0.85]);
    for (const z of [-0.3, 0.25]) mesh(torus, ink, bee, [0, 0, z], [0.43, 0.43, 0.43]);
    mesh(sphere, ink, bee, [0, 0.05, 0.8], [0.35, 0.3, 0.3]);
    const wings = [-1, 1].map((side) =>
      mesh(sphere, wing, bee, [side * 0.55, 0.35, 0], [0.7, 0.04, 0.42]),
    );
    motion(bee, (time) => {
      const a = time * 0.5 + i * 1.7;
      bee.position.set(Math.cos(a) * (4 + i * 0.55), 6 + Math.sin(a * 1.7) * 2, Math.sin(a) * 5);
      bee.rotation.y = -a;
    });
    for (const [j, part] of wings.entries())
      motion(part, (time) => {
        part.rotation.z = Math.sin(time * 24 + i) * 0.6 * (j ? 1 : -1);
      });
  }
}
