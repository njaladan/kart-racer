/** Wind-cut snow, exposed ice seams and warm chalet accents for Frostpeak. */
export function polishFrostpeak(w) {
  const { THREE } = w;
  const rand = w.seeded(28631);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const snow = ["#e7f2f3", "#d4e6eb", "#c4dbe5", "#f2f5ee"].map((c) =>
    w.mat(c, "snow", { roughness: 0.96, bumpScale: 0.035 }),
  );
  const blue = ["#4e87a5", "#6ca6bd", "#87bdcc"].map((c) =>
    w.mat(c, "ice", { roughness: 0.34, metalness: 0.08, bumpScale: 0.055 }),
  );
  const wood = w.mat("#563f36", "wood", { roughness: 0.89 });
  const shardGeo = new THREE.IcosahedronGeometry(1, 0);
  const crackGeo = new THREE.BufferGeometry();
  const crackPoints = [];
  for (let i = 0; i <= 8; i++)
    crackPoints.push(new THREE.Vector3((i - 4) * 0.28, 0, Math.sin(i * 1.7) * 0.44));
  crackGeo.setFromPoints(crackPoints);
  const crackMat = w.mat("#234f70", null, {
    emissive: "#367ea0",
    emissiveIntensity: 0.22,
    roughness: 0.42,
  });

  // Wind-sculpted snow lips form scalloped banks around open turns. The blue
  // hollow faces contrast the powder caps and remain grounded beside the route.
  for (let i = 0; i < 11; i++) {
    const section = [1, 2, 4, 5, 7][i % 5];
    const side = i % 2 ? 1 : -1;
    const g = w.safe(section, 0.06 + rand() * 0.88, side * (11 + rand() * 12), 3.4);
    if (!g) continue;
    const width = 3 + rand() * 4.8;
    const height = 1.1 + rand() * 2.3;
    const bank = w.mesh(
      shardGeo,
      pick(snow),
      g,
      [0, height * 0.48, 0],
      [width, height, width * (0.7 + rand() * 0.45)],
    );
    bank.rotation.z = (side > 0 ? -1 : 1) * (0.08 + rand() * 0.2);
    bank.rotation.y = rand() * Math.PI;
    const hollow = w.mesh(
      shardGeo,
      pick(blue),
      g,
      [side * width * 0.37, 0.34, 0.1],
      [width * 0.66, height * 0.42, width * 0.55],
    );
    hollow.rotation.y = bank.rotation.y + 0.12;
    if (i % 4 === 0) {
      const crest = w.mesh(
        shardGeo,
        pick(snow),
        g,
        [0, height + 0.24, -0.18],
        [width * 0.9, 0.38, width * 0.64],
      );
      crest.rotation.z = bank.rotation.z * 0.4;
    }
  }
  // Compact grooming lines cross the descent shoulders in groups, describing
  // packed snow without painting giant road-like colored strips.
  const grooveGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1;
    const g = w.safe(4, 0.1 + i * 0.067, side * (10.5 + rand() * 2.5), 2.4);
    if (!g) continue;
    for (let j = 0; j < 3; j++) {
      const line = w.mesh(
        grooveGeo,
        j % 2 ? pick(snow) : w.mat("#b2cbd5", "snow", { roughness: 0.9 }),
        g,
        [(j - 1.5) * 0.72, 0.04 + (j % 2) * 0.012, (j - 1.5) * 0.22],
        [0.075, 0.025, 3.8],
      );
      line.rotation.y = (rand() - 0.5) * 0.14;
    }
  }
  for (const [section, side, color, width] of [
    [0, -1, "#dce9ec", 1.5],
    [1, 1, "#c8dfe6", 1.4],
    [2, -1, "#8bb9ca", 1.35],
    [4, -1, "#dceaf0", 1.7],
    [5, 1, "#c6dce5", 1.5],
    [7, -1, "#e2e9e4", 1.6],
  ])
    w.edgeRibbon(section, side, {
      color,
      width,
      textureName: section === 2 ? "ice" : "snow",
      roughness: section === 2 ? 0.32 : 0.96,
      lift: 0.03,
      noise: 0.3,
    });

  // Fine cracks and rough blue shelves sit within safe glacier pockets.
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1;
    const g = w.safe(2, 0.08 + rand() * 0.84, side * (12 + rand() * 8), 2.4);
    if (!g) continue;
    const shelf = w.mesh(
      shardGeo,
      pick(blue),
      g,
      [0, 0.35, 0],
      [2.1 + rand() * 2.2, 0.45, 1.7 + rand() * 2.4],
    );
    shelf.rotation.y = rand() * Math.PI;
    for (let j = 0; j < 1; j++) {
      const crack = new THREE.Line(crackGeo, crackMat);
      crack.position.set((j - 0.5) * 1.4, 0.63, j ? 0.6 : -0.45);
      crack.rotation.y = rand() * Math.PI;
      crack.scale.setScalar(0.7 + rand() * 0.6);
      g.add(crack);
    }
  }
  // Authored snow-laden pine LODs provide natural silhouettes and branching.
  // Small attached caps emphasize near branch tips and blend into wind banks.
  for (let i = 0; i < 6; i++) {
    const section = i < 4 ? 1 : [0, 3, 5, 7, 2, 4][i % 6];
    const side = i % 2 ? 1 : -1;
    const g = w.safe(section, 0.07 + rand() * 0.86, side * (17 + rand() * 21), 4.2);
    if (!g) continue;
    const name = i % 3 === 0 ? "frostpeak:pine-near" : "frostpeak:pine-mid";
    if (w.kit.hasAsset(name)) {
      const tree = w.kit.asset(
        name,
        g,
        [0, 0, 0],
        [9 + rand() * 4, 9 + rand() * 4, 9 + rand() * 4],
      );
      tree.rotation.y = rand() * Math.PI * 2;
      const capMat = pick(snow);
      for (let branch = 0; branch < 3; branch++) {
        const angle = (branch / 3) * Math.PI * 2 + tree.rotation.y;
        const cap = w.mesh(
          shardGeo,
          capMat,
          g,
          [
            Math.cos(angle) * (1.2 + branch * 0.25),
            5.4 + branch * 1.35,
            Math.sin(angle) * (1.2 + branch * 0.25),
          ],
          [1.05 - branch * 0.12, 0.2, 0.62],
        );
        cap.rotation.y = angle;
      }
    }
  }
  // Existing chalet models already carry timber joints, eaves, pitched snow
  // roofs and recessed windows. Bevelled stone plinths ground the houses, and
  // the local lantern sources warm those same facades.
  for (let i = 0; i < 4; i++) {
    const section = i % 2 ? 0 : 6;
    const side = i % 2 ? 1 : -1;
    const g = w.safe(section, 0.12 + (i % 3) * 0.29, side * (17 + rand() * 8), 6.2);
    if (!g) continue;
    g.name = "Snow capped chalet with warm facade light";
    const scale = 8 + rand() * 2.5;
    w.mesh(w.bevelBox(scale * 1.18, 0.72, scale * 1.1, 0.22), wood, g, [0, 0.36, 0]);
    if (w.kit.hasAsset("frostpeak:chalet"))
      w.kit.asset("frostpeak:chalet", g, [0, 0.5, 0], [scale, scale, scale]);
    for (const x of [-scale * 0.24, scale * 0.24])
      w.light({
        parent: g,
        position: [x, scale * 0.36, scale * 0.47],
        color: "#ffad5e",
        intensity: 0.88,
        radius: 12,
        kind: "practical",
        pattern: null,
        staticBake: true,
      });
  }
  // The festival sky builder already authors a wide, animated aurora ribbon
  // above the far ridge, so this local dressing leaves that horizon clear.
}
