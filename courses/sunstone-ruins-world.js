export function buildWorld(context) {
  const { THREE, scenery, track, kit, hazardAt, textures = {} } = context;
  const { material, mesh, box, groupAt, sectorT, batch, align } = kit;
  // Downloaded, palette-adapted stone and sand retain the arcade silhouettes
  // while adding weathering that catches the shared baked vertex shading.
  const stone = material("#e1ba85", { map: textures.stone }),
    dark = material("#a58a6e", { map: textures.stone });
  const gold = material("#ecd097", { map: textures.stone }),
    chalk = material("#f0dbc0", { map: textures.stone });
  const cool = material("#878394", { map: textures.stone });
  const leaf = material("#829b60"),
    leafLight = material("#a4b777");
  const trunk = material("#a18660", { map: textures.bark });
  const sand = material("#e3c584", { map: textures.sand }),
    sandShade = material("#d4b47c", { map: textures.sand });
  const water = material("#77b5b1", {
    map: textures.water,
    roughness: 0.24,
    metalness: 0.16,
  });
  const rune = material("#94ddd1", {
    emissive: "#65b5ac",
    emissiveIntensity: 0.5,
  });
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const cone = new THREE.ConeGeometry(1, 1, 8);
  const rock = new THREE.IcosahedronGeometry(1, 0);
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  const importedRockMaterials = new Map();
  function importedRock(name, parent, position, size) {
    const model = kit.asset(name, parent, position);
    model.geometry.computeBoundingBox();
    const bounds = model.geometry.boundingBox,
      dimensions = bounds.getSize(new THREE.Vector3());
    model.scale.set(
      size[0] / dimensions.x,
      size[1] / dimensions.y,
      size[2] / dimensions.z,
    );
    if (!importedRockMaterials.has(name)) {
      const mat = model.material.clone();
      mat.color.set(name === "rock-a" ? "#d9b78b" : "#be9d7c");
      mat.roughness = 0.94;
      importedRockMaterials.set(name, mat);
    }
    model.material = importedRockMaterials.get(name);
    return model;
  }
  const frondGeometry = new THREE.BufferGeometry();
  frondGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        0, 0, 0, 1.4, 0.3, 0.6, 3.6, 0.05, 0.45, 5.1, -0.8, 0, 3.6, 0.05, -0.45,
        1.4, 0.3, -0.6,
      ],
      3,
    ),
  );
  frondGeometry.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]);
  frondGeometry.computeVertexNormals();
  leaf.side = THREE.DoubleSide;
  leafLight.side = THREE.DoubleSide;
  // Scenery anchors are route-relative. Broad footprints stay well beyond rails.
  function palm(t, side, size = 1) {
    const g = groupAt(t, side * (24 + size * 2));
    mesh(
      cylinder,
      trunk,
      g,
      [0, 5 * size, 0],
      [0.55 * size, 10 * size, 0.55 * size],
    );
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const frond = mesh(
        frondGeometry,
        i % 2 ? leaf : leafLight,
        g,
        [0, 10 * size, 0],
        [size, size, size],
      );
      frond.rotation.y = -a;
    }
    for (let i = 0; i < 6; i++)
      mesh(
        cylinder,
        dark,
        g,
        [0, (1 + i * 1.3) * size, 0],
        [0.58 * size, 0.1 * size, 0.58 * size],
      );
    for (let i = 0; i < 3; i++)
      mesh(
        sphere,
        dark,
        g,
        [(i - 1) * 0.35 * size, 9.6 * size, 0.25 * size],
        [0.33 * size, 0.43 * size, 0.33 * size],
      );
    batch(g);
  }
  const pond = groupAt(sectorT(0, 0.43), -49);
  const basin = mesh(
    new THREE.CircleGeometry(1, 48),
    water,
    pond,
    [0, -0.1, 0],
    [28, 20, 1],
  );
  basin.rotation.x = -Math.PI / 2;
  basin.castShadow = false;
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 12;
    mesh(
      rock,
      i % 3 ? chalk : dark,
      pond,
      [Math.cos(a) * 27, -0.15, Math.sin(a) * 19],
      [1.5, 0.7, 1.1],
    );
  }
  batch(pond);
  for (let i = 0; i < 20; i++)
    palm(sectorT(0, 0.05 + i * 0.045), i % 2 ? 1 : -1, 0.8 + (i % 3) * 0.2);
  // Broken canyon faces leave a view through each S-bend; no canopy hides it.
  for (let i = 0; i < 24; i++) {
    const t = sectorT(1, (i + 0.5) / 24),
      side = i % 2 ? 1 : -1;
    const g = groupAt(t, side * 29);
    const wall = importedRock(
      i % 3 ? "rock-a" : "rock-b",
      g,
      [0, -4, 0],
      [14, 22 + (i % 3) * 3, 16],
    );
    wall.rotation.y = i * 0.9;
    // Sparse horizontal strata interrupt the facets without filling sightlines.
    for (let band = 0; band < 3; band++) {
      const ledge = box(
        band % 2 ? chalk : dark,
        g,
        [0, 2.5 + band * 4, 0],
        [11, 0.45, 9],
      );
      ledge.rotation.y = i * 0.9;
    }
    batch(g);
  }
  for (let i = 0; i < 14; i++) {
    const g = groupAt(sectorT(2, (i + 0.5) / 14), -26);
    importedRock(i % 2 ? "rock-a" : "rock-b", g, [0, -4, 0], [14, 14, 10]);
    batch(g);
  }
  // A stepped temple mass stands beyond the entrance road and ahead of the
  // ridge's south-west heading. Its tall silhouette is readable before descent.
  const temple = groupAt(sectorT(3, 0.2), 52);
  for (let i = 0; i < 4; i++) {
    box(
      i % 2 ? gold : stone,
      temple,
      [0, 3 + i * 6, 0],
      [54 - i * 9, 6, 42 - i * 7],
    );
    box(chalk, temple, [0, 5.65 + i * 6, 0], [54 - i * 9, 0.5, 42 - i * 7]);
    const front = -(42 - i * 7) / 2;
    for (let x = -18 + i * 3; x <= 18 - i * 3; x += 6)
      box(dark, temple, [x, 3.3 + i * 6, front - 0.06], [0.2, 2.8, 0.12]);
  }
  box(cool, temple, [0, 19, -17], [12, 12, 1]);
  for (const x of [-6.7, 6.7])
    box(chalk, temple, [x, 19, -17.2], [0.8, 12.8, 1]);
  box(gold, temple, [0, 25.2, -17.2], [14.2, 1, 1]);
  const sunSeal = mesh(
    new THREE.CylinderGeometry(2.1, 2.1, 0.25, 12),
    gold,
    temple,
    [0, 22, -17.65],
  );
  sunSeal.rotation.x = Math.PI / 2;
  for (let i = 0; i < 5; i++)
    box(
      chalk,
      temple,
      [0, 13.4 + i * 0.62, -20.8 + i * 0.7],
      [11 - i * 0.6, 0.4, 1.35],
    );
  for (const x of [-20, 20]) {
    box(dark, temple, [x, 15, 0], [5, 30, 5]);
    mesh(cone, gold, temple, [x, 31, 0], [4, 3, 4]);
  }
  batch(temple);
  // Full-height gateway: supports have >5 m extra lateral clearance, and the
  // lintel's underside is 13 m above its anchor even with road banking.
  const gate = groupAt(sectorT(3, 0.14));
  for (const x of [-16, 16]) {
    box(stone, gate, [x, 8, 0], [5, 16, 5]);
    box(dark, gate, [x, 1, 0], [7, 2, 7]);
    for (const y of [3.5, 8, 12.5])
      box(chalk, gate, [x, y, 0], [5.1, 0.45, 5.1]);
    box(dark, gate, [x, 8, -2.55], [1.8, 8, 0.18]);
    for (const y of [5, 8, 11]) {
      const carving = box(gold, gate, [x, y, -2.7], [1.1, 1.1, 0.17]);
      carving.rotation.z = Math.PI / 4;
    }
  }
  box(stone, gate, [0, 15, 0], [37, 4, 5]);
  box(gold, gate, [0, 17.4, 0], [39, 0.8, 6]);
  box(dark, gate, [0, 15, -2.57], [25, 1.55, 0.16]);
  for (let x = -10; x <= 10; x += 4) {
    const carving = box(chalk, gate, [x, 15, -2.72], [1.05, 1.05, 0.15]);
    carving.rotation.z = Math.PI / 4;
    box(gold, gate, [x, 15, -2.83], [0.45, 0.45, 0.09]);
  }
  batch(gate);
  for (const f of [0.04, 0.28])
    for (const side of [-1, 1]) {
      const g = groupAt(sectorT(3, f), side * 23);
      box(dark, g, [0, 8, 0], [3, 16, 3]);
      mesh(cone, gold, g, [0, 17, 0], [2, 2, 2]);
      for (const y of [2, 14]) box(chalk, g, [0, y, 0], [3.3, 0.5, 3.3]);
      for (const y of [6, 8, 10])
        box(gold, g, [0, y, -1.56], [0.65, 1.1, 0.12]);
      batch(g);
    }
  // Repeated pillars describe a courtyard without placing decorative collision
  // objects in the road. Their bases remain beyond the complete prop footprint.
  for (let i = 0; i < 16; i++) {
    const g = groupAt(sectorT(4, (i + 0.5) / 16), (i % 2 ? 1 : -1) * 23);
    box(stone, g, [0, 0.6, 0], [5, 1.2, 5]);
    mesh(cylinder, i % 3 ? stone : cool, g, [0, 7, 0], [1.5, 13, 1.5]);
    box(gold, g, [0, 14, 0], [4, 1, 4]);
    for (const y of [1.4, 3, 11.7, 13.2])
      mesh(cylinder, chalk, g, [0, y, 0], [1.65, 0.3, 1.65]);
    for (let j = 0; j < 6; j++) {
      const a = (j * Math.PI) / 3;
      const flute = box(
        dark,
        g,
        [Math.cos(a) * 1.44, 7, Math.sin(a) * 1.44],
        [0.11, 7, 0.18],
      );
      flute.rotation.y = -a;
    }
    batch(g);
  }
  const hazard = new THREE.Group();
  scenery.add(hazard);
  const body = box(cool, hazard, [0, 1, 0], [2.7, 2, 4.3]);
  box(gold, hazard, [0, 2.05, 0], [2.65, 0.15, 4.2]);
  for (const z of [-1.3, 0, 1.3])
    box(rune, hazard, [0, 1.15, z], [2.68, 0.2, 0.24]);
  batch(hazard);
  const gearAnchor = groupAt(track.CART_T, 24);
  box(dark, gearAnchor, [0, 3, 0], [5, 6, 5]);
  const gear = mesh(
    new THREE.CylinderGeometry(3, 3, 0.7, 16),
    gold,
    gearAnchor,
    [0, 7, 0],
  );
  gear.rotation.x = Math.PI / 2;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const tooth = box(
      dark,
      gear,
      [Math.cos(a) * 3.1, 0.05, Math.sin(a) * 3.1],
      [0.8, 0.9, 0.8],
    );
    tooth.rotation.y = -a;
  }
  const signal = groupAt(track.CART_T, -16);
  box(dark, signal, [0, 2, 0], [2, 4, 2]);
  const beacon = mesh(sphere, rune, signal, [0, 4.7, 0], [0.8, 0.8, 0.8]);
  // Dunes stay beyond the expanded shortcut, rather than obscuring its entry.
  for (let i = 0; i < 18; i++) {
    const t = sectorT(5, (i + 0.5) / 18),
      side = i % 2 ? 1 : -1;
    const edge = track.surfaceAt(t).rightEdge;
    const g = groupAt(t, side > 0 ? edge + 21 : -35);
    mesh(
      sphere,
      i % 3 ? sand : sandShade,
      g,
      [0, -3, 0],
      [14 + (i % 3) * 4, 8 + (i % 4), 12],
    );
    batch(g);
  }
  for (const f of [0.28, 0.65]) {
    const t = sectorT(5, f),
      g = groupAt(t, track.surfaceAt(t).rightEdge + 3);
    box(stone, g, [0, 2.5, 0], [1.3, 5, 1.3]);
    mesh(cone, gold, g, [0, 5.5, 0], [1.2, 1.2, 1.2]);
    batch(g);
  }
  return {
    animated: [hazard, gearAnchor, beacon],
    update(time) {
      const pose = hazardAt(time);
      align(hazard, pose);
      gear.rotation.y = time * 0.35;
      const glow = pose.warning ? 0.9 + 0.6 * Math.sin(time * 10) : 0.5;
      rune.emissiveIntensity = glow;
      beacon.scale.setScalar(pose.warning ? 1.12 : 1);
    },
  };
}
