/** Understory, spatially varied canopy, limestone outcrops, overlook, and birds. */
export function buildForestAndRidge({
  THREE,
  asset,
  animate,
  birds,
  groundShadow,
  random,
  roadside,
  rockModels,
  scene,
  treeModels,
  kit,
  palette,
  geometry,
}) {
  const { box, mesh } = kit;
  const { cream, dark, fernMat, grass, steel, wood } = palette;
  const { cone, cylinder, leafGeometry } = geometry;
  // Forest floor has authored understory islands and fallen timber.
  for (let i = 0; i < 60; i++) {
    const g = roadside(1, 0.03 + random() * 0.94, i % 2 ? 1 : -1, 2.5 + random() * 11, 1.6);
    if (!g) continue;
    asset(
      rockModels[i % rockModels.length],
      g,
      [0, 0.12, 0],
      [1.3 + (i % 4) * 0.18, 1.2, 1.1 + (i % 3) * 0.17],
    );
    if (i % 3 === 0)
      asset(rockModels[(i + 2) % rockModels.length], g, [1.05, 0.08, -0.3], [0.62, 0.68, 0.7]);
    for (let j = 0; j < 7; j++) {
      const frond = mesh(leafGeometry, fernMat, g, [0, 0.28, 0], [1.2, 1.2, 1.8]);
      frond.rotation.y = (j * Math.PI * 2) / 7;
      frond.rotation.x = -0.6 - random() * 0.35;
    }
    for (let j = 0; j < 2; j++) {
      const x = 1 + random(),
        z = random() - 0.5;
      const mushroom = asset("mushroom-redgroup", g, [x, 0.05, z], [0.48, 0.5, 0.48]);
      mushroom.rotation.y = random() * Math.PI * 2;
    }
    if (i % 4 === 0) asset("plant-bushdetailed", g, [-1.1, 0.05, 0.4], [1.35, 1.35, 1.35]);
  }
  // A layered pine canopy frames the turns; oak and broadleaf trees open the
  // meadow and orchard instead of leaving the skyline empty.
  let treeIndex = 0;
  function tree(section, fraction, side, clearance, size, species) {
    const g = roadside(section, fraction, side, clearance, size * 0.38);
    if (!g) return;
    const model =
      species ?? treeModels[(treeIndex * 7 + Math.floor(fraction * 31)) % treeModels.length];
    treeIndex++;
    const height = size * (model.includes("detailed") ? 1.08 : 1);
    g.rotation.y += (treeIndex * 2.399) % (Math.PI * 2);
    const width = height * (0.94 + Math.sin(treeIndex * 1.7) * 0.06);
    asset(model, g, [0, 0, 0], [width, height, width]);
    if (section !== 1 && treeIndex % 2 === 0) groundShadow(g, width * 0.9);
  }
  for (let i = 0; i < 18; i++) {
    const f = 0.04 + i * 0.052;
    for (const side of [-1, 1]) {
      tree(
        1,
        f,
        side,
        7 + (i % 4) * 2.7,
        13 + (i % 5) * 1.9,
        i % 4 === 0
          ? "tree-pinedefaultb"
          : i % 4 === 1
            ? "tree-pinetalla-detailed"
            : "tree-pinetallb-detailed",
      );
      if (i % 3 === 0)
        tree(1, f + 0.013, side, 20 + (i % 3) * 3, 10 + (i % 4) * 1.7, "tree-pinedefaultb");
    }
  }
  for (let i = 0; i < 20; i++) {
    const f = 0.05 + i * 0.045,
      side = i % 2 ? 1 : -1;
    tree(5, f, side, 8 + (i % 3) * 3, 9 + (i % 4) * 1.25, i % 3 ? "tree-oak" : "tree-default");
  }
  for (let i = 0; i < 10; i++) {
    const f = 0.08 + i * 0.09,
      side = i % 2 ? -1 : 1;
    tree(0, f, side, 15 + (i % 3) * 4, 10 + (i % 3) * 1.5, i % 2 ? "tree-oak" : "tree-default");
  }
  for (let i = 0; i < 16; i++) {
    const f = 0.08 + i * 0.052,
      side = i % 2 ? 1 : -1;
    const g = roadside(5, f, side, 3.4 + (i % 3), 0.9);
    if (g) asset("flower-yellowb", g, [0, 0.02, 0], [0.8 + (i % 3) * 0.15, 0.8, 0.8]);
  }
  for (const [f, side] of [
    [0.16, 1],
    [0.39, -1],
    [0.71, 1],
    [0.88, -1],
  ]) {
    const g = roadside(1, f, side, 8, 4);
    if (!g) continue;
    g.name = "Mossy fallen log";
    g.rotation.y += 0.6;
    const log = asset("log-large", g, [0, 0.25, 0], [1, 1, 7]);
    log.rotation.y = Math.PI / 2;
    asset("stump-oldtall", g, [3.5, 0, 0.4], [1.35, 1.35, 1.35]);
  }
  // Imported stone silhouettes form varied ridge outcrops while preserving
  // the open valley view between geological clusters.
  for (let i = 0; i < 9; i++) {
    const g = roadside(2, 0.08 + i * 0.087, -1, 17, 8);
    if (!g) continue;
    g.name = "Layered limestone outcrop";
    for (let j = 0; j < 4; j++) {
      const slug = rockModels[(i + j) % rockModels.length];
      const scale = j === 0 ? [5.2, 5.4, 4.8] : [2.7 + (j % 2) * 0.5, 2.6 + (j % 3) * 0.3, 2.8];
      const m = asset(
        slug,
        g,
        [Math.sin(i * 1.7 + j) * (j ? 3.3 : 0.4), j ? 0.4 : 0, j ? (j % 2 ? 2.4 : -2.2) : 0],
        scale,
      );
      m.rotation.y = 0.37 * Math.sin(i + j * 1.9);
    }
    for (let j = 0; j < 4; j++)
      mesh(cone, grass, g, [random() * 8 - 4, 0.35, 5 + random()], [0.25, 0.8, 0.25]);
  }
  const overlook = roadside(2, 0.6, 1, 13, 6);
  if (overlook) {
    overlook.name = "Valley viewing terrace";
    box(wood, overlook, [0, 0.15, 0], [9, 0.3, 5]);
    for (const x of [-4.3, 4.3])
      for (const z of [-2.2, 2.2]) box(dark, overlook, [x, -1, z], [0.35, 2.2, 0.35]);
    for (let i = 0; i < 7; i++) box(wood, overlook, [-4.2 + i * 1.4, 1.1, -2.4], [0.15, 2, 0.15]);
    box(cream, overlook, [0, 1.8, -2.4], [9, 0.15, 0.15]);
    for (const x of [-2.3, 2.3]) {
      box(dark, overlook, [x, 1.1, 0.2], [0.12, 2.2, 0.12]);
      mesh(cylinder, steel, overlook, [x, 2.3, 0.2], [0.22, 1, 0.22]).rotation.x = 0.85;
    }
  }
  for (let i = 0; i < 4; i++) {
    const g = animate(roadside(2, 0.25 + i * 0.18, 1, 35, 1, scene));
    if (!g) continue;
    g.position.y += 24 + i * 4;
    g.name = "Circling ridge bird";
    const wings = [];
    for (const side of [-1, 1]) {
      const w = new THREE.Group();
      g.add(w);
      mesh(leafGeometry, cream, w, [side * 0.12, 0, 0], [1.5, 1, 2.2]);
      w.rotation.y = (side * Math.PI) / 2;
      wings.push(w);
    }
    birds.push({ g, wings, x: g.position.x, z: g.position.z, phase: i * 1.8 });
  }
}
