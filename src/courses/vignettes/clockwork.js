/** A clockmaker's repair stage and a pneumatic exchange animate the working city. */
export function buildClockworkStories(w) {
  const { mat, mesh, box, sphere, cylinder, torus, group, site, tube, wheel, motion } = w;
  const brass = mat("#d2ae67", "metal", { metalness: 0.65, roughness: 0.38 }),
    blue = mat("#52627c", "metal"),
    ivory = mat("#f4dfb6"),
    ink = mat("#443d50"),
    copper = mat("#bd7962", "metal"),
    glass = mat("#bdd8d4", "glass", {
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      roughness: 0.25,
    });
  const bench = site("Clockmaker pocket-watch repair stage", 0, 0.63, -1, 12, 26);
  for (const x of [-8, 8]) tube(bench, [x, 0, 0], [x, 6, 0], 0.5, blue);
  box(copper, bench, [0, 6, 0], [19, 1.4, 10]);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 6,
      r = i === 1 ? 4 : 2.7,
      y = i === 1 ? 15 : 11;
    mesh(cylinder, ivory, bench, [x, y, 0], [r, 0.7, r]).rotation.x = Math.PI / 2;
    mesh(torus, brass, bench, [x, y, 0.5], [r, r, r]);
    mesh(torus, brass, bench, [x, y + r + 0.8, 0], [0.7, 0.7, 0.7]);
    for (let j = 0; j < 12; j++) {
      const a = (j * Math.PI) / 6;
      const mark = box(
        ink,
        bench,
        [x + Math.sin(a) * r * 0.78, y + Math.cos(a) * r * 0.78, 0.5],
        [0.13, 0.4, 0.1],
      );
      mark.rotation.z = -a;
    }
    for (let j = 0; j < 2; j++) {
      const hand = group(bench, [x, y, 0.65 + j * 0.1]);
      box(j ? brass : ink, hand, [0, r * 0.3, 0], [0.16, r * 0.6, 0.12]);
      motion(hand, (time) => {
        hand.rotation.z = -Math.floor(time * (j ? 4 : 1)) * (j ? 0.13 : 0.055) - i;
      });
    }
    const gear = wheel(bench, [x, 7.5, 2], 1.7, brass, 8);
    motion(gear, (time) => {
      gear.rotation.z = time * (i % 2 ? -0.5 : 0.5);
    });
  }
  tube(bench, [-8, 6.8, 4], [-4, 8.5, 4], 0.15, brass);
  mesh(torus, brass, bench, [-3, 9, 4], [1.6, 1.6, 1.6]);

  const exchange = site("Pneumatic copper message exchange", 5, 0.5, 1, 12, 30);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 5;
    box(blue, exchange, [x, 2, 0], [3.5, 4, 4]);
    mesh(cylinder, glass, exchange, [x, 14, 0], [0.9, 22, 0.9]).castShadow = false;
    for (let j = 0; j < 5; j++)
      mesh(torus, copper, exchange, [x, 4 + j * 5, 0], [1.05, 1.05, 1.05]).rotation.x = Math.PI / 2;
    tube(exchange, [x, 25, 0], [x, 25, -4], 0.7, copper);
    const capsule = group(exchange);
    mesh(cylinder, brass, capsule, [0, 0, 0], [0.62, 2, 0.62]);
    for (const y of [-1, 1]) mesh(sphere, ivory, capsule, [0, y, 0], [0.65, 0.35, 0.65]);
    motion(capsule, (time) => {
      capsule.position.set(x, 4 + (0.5 + 0.5 * Math.sin(time * 0.6 + i * 2)) * 18, 0);
    });
    const gauge = wheel(exchange, [x, 2.5, 2.1], 0.8, ivory, 4);
    motion(gauge, (time) => {
      gauge.rotation.z = Math.sin(time * 0.6 + i) * 0.7;
    });
  }
}
