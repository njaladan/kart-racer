/** Temple architecture, gateways, arcades, courtyard pillars, and hazard mechanism. */
export function buildTemple({
  THREE,
  animated,
  canopy,
  grounded,
  scenery,
  torch,
  track,
  kit,
  palette,
  geometry,
}) {
  const { batch, box, groupAt, mesh, sectorT } = kit;
  const { bronze, chalk, cool, dark, gold, rune, stone } = palette;
  const { cone, cylinder, rock, sphere } = geometry;
  // A stepped temple remains in front of the ridge's south-west heading.
  const temple = grounded(sectorT(3, 0.2), 52, 30);
  if (temple) {
    for (let i = 0; i < 4; i++) {
      box(i % 2 ? gold : stone, temple, [0, 3 + i * 6, 0], [54 - i * 9, 6, 42 - i * 7]);
      box(chalk, temple, [0, 5.65 + i * 6, 0], [54 - i * 9, 0.5, 42 - i * 7]);
      const front = -(42 - i * 7) / 2;
      for (let x = -18 + i * 3; x <= 18 - i * 3; x += 6) {
        box(dark, temple, [x, 3.3 + i * 6, front - 0.06], [0.25, 2.8, 0.12]);
        const carving = box(gold, temple, [x, 4 + i * 6, front - 0.18], [1.3, 1.3, 0.2]);
        carving.rotation.z = Math.PI / 4;
      }
      // Recessed pilasters break the flat block face into architectural bays.
      // The center stays clear for the road, stairs and sun-seal sightline.
      const bayWidth = (54 - i * 9) / 4;
      for (const x of [-1.45, -0.55, 0.55, 1.45].map((f) => f * bayWidth)) {
        const y = 3 + i * 6,
          frontZ = front - 0.38;
        box(dark, temple, [x, y + 0.2, frontZ - 0.03], [1.9, 5.7, 0.22]);
        mesh(new THREE.CylinderGeometry(0.76, 0.92, 5, 10), gold, temple, [
          x,
          y + 0.15,
          frontZ - 0.22,
        ]);
        for (const h of [y - 2.55, y + 2.55]) {
          box(chalk, temple, [x, h, frontZ - 0.25], [2.2, 0.38, 0.78]);
          box(stone, temple, [x, h + 0.28, frontZ - 0.25], [1.65, 0.18, 0.58]);
        }
        for (let flute = 0; flute < 5; flute++) {
          const mark = box(
            chalk,
            temple,
            [x - 0.48 + flute * 0.24, y + 0.1, frontZ - 0.76],
            [0.07, 3.9, 0.05],
          );
          mark.rotation.z = (flute - 2) * 0.025;
        }
      }
      // Roof cornice and corner blocks make the mass read as built masonry.
      for (const x of [-1, 1])
        box(chalk, temple, [x * (25 - i * 4.5), 4 + i * 6, 0], [1, 3, 40 - i * 7]);
    }
    box(cool, temple, [0, 19, -17], [12, 12, 1]);
    for (const x of [-6.7, 6.7]) box(chalk, temple, [x, 19, -17.2], [0.8, 12.8, 1]);
    box(gold, temple, [0, 25.2, -17.2], [14.2, 1, 1]);
    const sunSeal = mesh(
      new THREE.CylinderGeometry(2.1, 2.1, 0.25, 16),
      gold,
      temple,
      [0, 22, -17.65],
    );
    sunSeal.rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        ray = box(
          chalk,
          temple,
          [Math.sin(a) * 3.1, 22 + Math.cos(a) * 3.1, -17.67],
          [0.5, 1.1, 0.2],
        );
      ray.rotation.z = -a;
    }
    for (let i = 0; i < 7; i++)
      box(chalk, temple, [0, 12 + i * 0.62, -22.2 + i * 0.7], [12 - i * 0.6, 0.4, 1.35]);
    for (const x of [-20, 20]) {
      box(dark, temple, [x, 15, 0], [5, 30, 5]);
      mesh(cone, gold, temple, [x, 31, 0], [4, 3, 4]);
      for (const y of [5, 15, 25]) box(chalk, temple, [x, y, -2.6], [5.2, 0.55, 0.2]);
    }
  }
  // Gateway lintel clears the chase camera by 13 m; every support remains
  // outside the physical road. The processional shoulder opens further on.
  const gate = groupAt(sectorT(3, 0.14));
  for (const x of [-16, 16]) {
    box(stone, gate, [x, 8, 0], [5, 16, 5]);
    box(dark, gate, [x, 1, 0], [7, 2, 7]);
    for (const y of [3.5, 8, 12.5]) box(chalk, gate, [x, y, 0], [5.1, 0.45, 5.1]);
    box(dark, gate, [x, 8, -2.55], [1.8, 8, 0.18]);
    for (const y of [5, 8, 11]) {
      const c = box(gold, gate, [x, y, -2.7], [1.1, 1.1, 0.17]);
      c.rotation.z = Math.PI / 4;
    }
  }
  box(stone, gate, [0, 15, 0], [37, 4, 5]);
  box(gold, gate, [0, 17.4, 0], [39, 0.8, 6]);
  box(dark, gate, [0, 15, -2.57], [25, 1.55, 0.16]);
  for (let x = -10; x <= 10; x += 4) {
    const c = box(chalk, gate, [x, 15, -2.72], [1.05, 1.05, 0.15]);
    c.rotation.z = Math.PI / 4;
    box(gold, gate, [x, 15, -2.83], [0.45, 0.45, 0.09]);
  }
  for (const f of [0.04, 0.28])
    for (const side of [-1, 1]) {
      const g = grounded(sectorT(3, f), side * 23, 2.5);
      if (!g) continue;
      box(dark, g, [0, 8, 0], [3, 16, 3]);
      mesh(cone, gold, g, [0, 17, 0], [2, 2, 2]);
      for (const y of [2, 14]) box(chalk, g, [0, y, 0], [3.3, 0.5, 3.3]);
      for (const y of [6, 8, 10]) box(gold, g, [0, y, -1.56], [0.65, 1.1, 0.12]);
    }
  // Broad paving lane leads past low ceremonial markers and shaded arcades.
  // The arcade roof stays outside the lane; it is scenery, not a false tunnel.
  for (let i = 0; i < 8; i++) {
    const t = sectorT(3, 0.42 + i * 0.056),
      g = grounded(t, 25, 5);
    if (!g) continue;
    for (const z of [-3, 3]) {
      box(dark, g, [0, 0.5, z], [3.2, 1, 3.2]);
      mesh(cylinder, stone, g, [0, 5, z], [1, 9, 1]);
      box(gold, g, [0, 9.8, z], [2.8, 0.7, 2.8]);
      for (const y of [2, 8]) mesh(cylinder, chalk, g, [0, y, z], [1.1, 0.25, 1.1]);
    }
    box(stone, g, [0, 10.5, 0], [3.4, 0.7, 9]);
    box(chalk, g, [0, 11, 0], [3.7, 0.3, 9.2]);
    const outer = grounded(t, track.surfaceAt(t).rightEdge + 1.6, 0.6);
    if (outer) {
      box(chalk, outer, [0, 0.45, 0], [0.75, 0.9, 0.75]);
      mesh(rock, rune, outer, [0, 1, 0], [0.25, 0.3, 0.25]);
    }
  }
  for (const [i, f] of [0.33, 0.64].entries()) canopy(sectorT(3, f), -24, i + 2);
  // Courtyard pillars have flute carving, capitals, decorative bases and
  // broken companions. Intentional gaps reveal machinery and the passing lane.
  for (let i = 0; i < 18; i++) {
    const t = sectorT(4, (i + 0.5) / 18),
      g = grounded(t, (i % 2 ? 1 : -1) * 24, 3.5);
    if (!g) continue;
    box(stone, g, [0, 0.6, 0], [5, 1.2, 5]);
    mesh(cylinder, i % 3 ? stone : cool, g, [0, 7, 0], [1.5, 13, 1.5]);
    box(gold, g, [0, 14, 0], [4, 1, 4]);
    for (const y of [1.4, 3, 11.7, 13.2]) mesh(cylinder, chalk, g, [0, y, 0], [1.65, 0.3, 1.65]);
    for (let j = 0; j < 6; j++) {
      const a = (j * Math.PI) / 3,
        c = box(dark, g, [Math.cos(a) * 1.44, 7, Math.sin(a) * 1.44], [0.11, 7, 0.18]);
      c.rotation.y = -a;
    }
    if (i % 4 === 0) mesh(rock, stone, g, [3, 0.2, 2], [1.2, 0.7, 1.5]);
  }
  for (let i = 0; i < 6; i++)
    torch(
      sectorT(i < 2 ? 3 : 4, i < 2 ? 0.2 + i * 0.45 : 0.12 + (i - 2) * 0.23),
      i % 2 ? 19 : -18,
      i,
    );
  const hazard = new THREE.Group();
  scenery.add(hazard);
  box(cool, hazard, [0, 1, 0], [2.7, 2, 4.3]);
  box(gold, hazard, [0, 2.05, 0], [2.65, 0.15, 4.2]);
  for (const z of [-1.3, 0, 1.3]) box(rune, hazard, [0, 1.15, z], [2.68, 0.2, 0.24]);
  batch(hazard);
  animated.push(hazard);
  const gearAnchor = grounded(track.CART_T, 24, 5) || groupAt(track.CART_T, 24);
  box(dark, gearAnchor, [0, 3, 0], [5, 6, 5]);
  const gearGroup = new THREE.Group();
  gearAnchor.add(gearGroup);
  gearGroup.position.y = 7;
  gearGroup.rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(3, 3, 0.7, 16), gold, gearGroup);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      tooth = box(dark, gearGroup, [Math.cos(a) * 3.1, 0.05, Math.sin(a) * 3.1], [0.8, 0.9, 0.8]);
    tooth.rotation.y = -a;
  }
  mesh(new THREE.CylinderGeometry(0.55, 0.55, 1, 10), bronze, gearGroup);
  batch(gearGroup);
  animated.push(gearGroup);
  const signal = grounded(track.CART_T, -16, 1.5) || groupAt(track.CART_T, -16);
  box(dark, signal, [0, 2, 0], [2, 4, 2]);
  const beacon = mesh(sphere, rune, signal, [0, 4.7, 0], [0.8, 0.8, 0.8]);
  animated.push(beacon);
  // A low tooth-marked plinth beside the mechanism shows the ancient moving
  // assembly without putting any additional colliders on the racing road.
  const machinery = grounded(track.CART_T, 31, 5);
  if (machinery) {
    box(stone, machinery, [0, 0.6, 0], [8, 1.2, 8]);
    for (let i = 0; i < 6; i++) box(bronze, machinery, [-2.5 + i, 0.95, -3.5], [0.5, 0.6, 1.3]);
    box(dark, machinery, [0, 2.2, 0], [3, 3.2, 3]);
    for (const x of [-1, 1]) box(rune, machinery, [x, 2.2, -1.53], [0.16, 1.8, 0.12]);
  }

  return { hazard, gearGroup, beacon };
}
