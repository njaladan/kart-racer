/** Forest depth, lived-in houses and physical snow/wood boundaries. */
export function buildWinterValley({ THREE, scenery, track, festival }) {
  const {
    palette: p,
    geometry: geo,
    asset,
    mesh,
    box,
    sectorT,
    edgeOffset,
    safeGroup,
    groupAt,
    chalet,
    pole,
  } = festival;
  for (let section = 0; section < track.SECTIONS.length; section++) {
    const count = section === 1 ? 29 : section === 2 ? 12 : section === 6 ? 5 : 15;
    for (let i = 0; i < count; i++)
      for (const side of [-1, 1]) {
        if ((section === 3 || section === 4) && side === 1) continue;
        const t = sectorT(section, (i + 0.45) / count);
        const height = 10 + (i % 5) * 1.6;
        for (const depth of [0, 21]) {
          if (depth && i % 2) continue;
          const g = safeGroup(t, edgeOffset(t, side, 7 + height * 0.38 + depth), height * 0.39);
          if (!g) continue;
          g.rotation.y += i * 2.399;
          asset("frostpeak:pine-near", g, [0, 0, 0], [height * 0.76, height, height * 0.76]);
          if (i % 3 === 0) asset("frostpeak:snow-bush", g, [side * 3, -0.15, 1], [2.5, 1.7, 2.5]);
        }
      }
  }
  for (const section of [0, 6, 7])
    for (let i = 0; i < (section === 6 ? 13 : 6); i++)
      for (const side of [-1, 1])
        chalet(
          section,
          (i + 0.3) / (section === 6 ? 13 : 6),
          side,
          8.5 + (i % 3) * 1.8,
          section === 6 ? 5 : 12,
        );

  // The snowbank starts at the collision edge; its rounded top identifies the
  // physical boundary without enclosing the whole lap in a racing guardrail.
  for (const side of [-1, 1]) {
    const positions = [],
      uv = [],
      indices = [];
    const n = 1300,
      columns = 5;
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        f = track.frameAt(t),
        section = track.SECTIONS.indexOf(track.sectionAt(t));
      const timber = section === 3 || (section === 6 && track.surfaceAt(t).material === "wood");
      for (let j = 0; j <= columns; j++) {
        const u = j / columns,
          offset = edgeOffset(t, side, u * 2);
        const point = f.p.clone().addScaledVector(f.right, offset);
        point.y += 0.045 + Math.sin(u * Math.PI) * (section === 2 ? 1.35 : 0.85);
        positions.push(point.x, point.y, point.z);
        uv.push(u, (t * track.COURSE_LENGTH) / 6);
        if (i < n && j < columns && !timber) {
          const a = i * (columns + 1) + j,
            b = a + columns + 1;
          if (side > 0) indices.push(a, a + 1, b, a + 1, b + 1, b);
          else indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    const bank = mesh(g, p.snow, scenery);
    bank.name = "Rounded snow boundary along the actual driveable edge";
    bank.castShadow = false;
    bank.userData.bakeReceiver = true;
  }
  for (let section = 0; section < 8; section++) {
    const count = Math.ceil(
      ((track.SECTIONS[section].end - track.SECTIONS[section].start) * track.COURSE_LENGTH) / 7,
    );
    for (let i = 0; i < count; i++)
      for (const side of [-1, 1]) {
        const t = sectorT(section, (i + 0.5) / count),
          g = groupAt(t, edgeOffset(t, side, 0.15));
        if (section === 3 || (section === 6 && track.surfaceAt(t).material === "wood")) {
          box(p.timber, g, [0, 0.6, 0], [0.22, 1.2, 0.22]);
          box(p.timber, g, [0, 1.1, 0], [0.15, 0.17, 7.4]);
          box(p.timber, g, [0, 0.55, 0], [0.13, 0.13, 7.4]);
        } else if (i % 3 === 0) {
          box(i % 2 ? p.red : p.cyan, g, [side * 0.8, 1.3, 0], [0.12, 2.6, 0.12]);
          mesh(geo.sphere, p.gold, g, [side * 0.8, 2.7, 0], [0.2, 0.2, 0.2]);
        }
        if (i % 5 === 0 && [0, 3, 6, 7].includes(section)) {
          const lamp = safeGroup(t, edgeOffset(t, side, 3.5), 1.2);
          if (lamp) pole(lamp, 0, 0, 0, 4.8);
        }
      }
  }
}
