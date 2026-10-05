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
  const { cone, sphere } = geometry;
  // A stepped temple remains in front of the ridge's south-west heading.
  const temple = grounded(sectorT(3, 0.2), 57, 35);
  if (temple) {
    // Authored architecture provides recessed doorways, roof eaves, texture
    // trims and real geometry AO; reuse it at monumental scale as the reveal.
    const shrine = kit.asset("ruins:shrine", temple, [0, 0, 0], [24, 24, 24]);
    shrine.rotation.y = Math.PI;
    for (const x of [-21, 21]) {
      kit.asset("ruins:dragon", temple, [x, 0, -23], [7, 7, 7]);
    }
    const annex = kit.asset("ruins:ruined-house", temple, [-23, 0, 12], [15, 15, 15]);
    annex.rotation.y = -0.22;
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
  // Carved roadside shrines and ruined rooms compose the procession and
  // courtyard without placing their broad footprints on the paved apron.
  for (let sector = 3; sector <= 4; sector++) {
    for (let i = 0; i < 7; i++) {
      const t = sectorT(sector, 0.08 + i * 0.13);
      const side = i % 2 ? 1 : -1;
      const edge = track.surfaceAt(t);
      const offset = side > 0 ? edge.rightEdge + 22 : edge.leftEdge - 22;
      const g = grounded(t, offset, 14);
      if (!g) continue;
      const ruin = kit.asset(
        i % 3 ? "ruins:ruined-house" : "ruins:shrine",
        g,
        [0, 0, 0],
        [i % 3 ? 11 : 8, i % 3 ? 11 : 8, i % 3 ? 11 : 8],
      );
      ruin.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      kit.asset("ruins:dragon", g, [side * -7, 0, -5], [3.5, 3.5, 3.5]);
    }
  }
  for (const [i, f] of [0.33, 0.64].entries()) canopy(sectorT(3, f), -24, i + 2);
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
