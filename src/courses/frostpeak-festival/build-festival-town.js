/** Close, useful village detail and a supported balcony-level racing passage. */
export function buildFestivalTown({ THREE, scenery, track, festival, textures }) {
  const {
    palette: p,
    geometry: geo,
    mesh,
    box,
    asset,
    sectorT,
    safeGroup,
    edgeOffset,
    groupAt,
    lantern,
    pole,
    beam,
  } = festival;
  const signMaterial = festival.material("#ffffff", { map: textures.frostSigns, roughness: 0.9 });
  const signs = Array.from({ length: 4 }, (_, i) => {
    const geometry = new THREE.PlaneGeometry(2.4, 2.9);
    const uv = geometry.attributes.uv;
    for (let j = 0; j < uv.count; j++) uv.setXY(j, (uv.getX(j) + i) / 4, uv.getY(j));
    return geometry;
  });
  const roof = new THREE.ConeGeometry(1, 1, 4);
  const footprints = new THREE.CircleGeometry(1, 7);
  function trail(g, x, z, length, angle = 0) {
    for (let i = 0; i < length; i++) {
      const stamp = mesh(
        footprints,
        p.rock,
        g,
        [
          x + Math.sin(angle) * i * 0.62 + (i % 2 ? 0.17 : -0.17),
          0.05,
          z + Math.cos(angle) * i * 0.62,
        ],
        [0.12, 0.24, 1],
      );
      stamp.rotation.x = -Math.PI / 2;
      stamp.rotation.z = angle;
      stamp.castShadow = false;
    }
  }
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? -1 : 1,
      t = sectorT(0, (i + 0.4) / 12),
      g = safeGroup(t, edgeOffset(t, side, 6.3), 4.6);
    if (!g) continue;
    g.name = "Lantern market stall with goods and illustrated shop sign";
    g.rotation.y += (side * Math.PI) / 2;
    box(p.timber, g, [0, 1.1, 0], [6, 2.2, 2.2]);
    for (const x of [-2.8, 2.8])
      for (const z of [-1.2, 1.2]) box(p.timber, g, [x, 2.8, z], [0.2, 5.6, 0.2]);
    const canopy = mesh(roof, i % 2 ? p.red : p.cyan, g, [0, 5.4, 0], [5.1, 2.2, 2.7]);
    canopy.rotation.y = Math.PI / 4;
    for (let j = 0; j < 6; j++)
      box(j % 2 ? p.cream : p.gold, g, [-2.2 + j * 0.85, 2.25, 0], [0.64, 0.45, 0.65]);
    if (i % 3 === 0)
      for (let j = 0; j < 3; j++) {
        mesh(geo.cylinder, p.cream, g, [-1 + j, 2.7, -0.6], [0.16, 0.3, 0.16]);
        mesh(geo.cylinder, p.dark, g, [-1 + j, 2.9, -0.6], [0.15, 0.025, 0.15]);
      }
    else asset("kenney:holiday-kit/present_round", g, [-1, 2.5, -0.3], [0.75, 0.75, 0.75]);
    const sign = mesh(signs[i % 4], signMaterial, g, [0, 3.55, -1.25]);
    sign.rotation.y = Math.PI;
    lantern(g, [-2.2, 4.4, -1.3], 0.75);
    lantern(g, [2.2, 4.4, -1.3], 0.75);
    asset("kenney:holiday-kit/sled", g, [3.2, 0.08, 1.5], [1.5, 1.5, 1.5]);
    trail(g, -2.1, -4, 8);
  }
  function garland(section, fraction, plain = false) {
    const t = sectorT(section, fraction),
      g = groupAt(t);
    const half = Math.max(-track.surfaceAt(t).leftEdge, track.surfaceAt(t).rightEdge) + 3;
    const high = plain ? 13.5 : 14;
    for (const side of [-1, 1]) box(p.timber, g, [side * half, high / 2, 0], [0.28, high, 0.28]);
    for (let i = 0; i < 12; i++) {
      const x = -half + i * ((half * 2) / 11),
        next = -half + (i + 1) * ((half * 2) / 11);
      const h = high - 1.3 * Math.sin((i / 11) * Math.PI);
      if (i < 11)
        beam(
          g,
          [x, h, 0],
          [next, high - 1.3 * Math.sin(((i + 1) / 11) * Math.PI), 0],
          0.04,
          p.dark,
        );
      if (i % 2 === 0) lantern(g, [x, h - 0.8, 0], plain ? 0.6 : 1);
      else {
        const pennant = mesh(
          geo.cone,
          i % 3 ? p.red : p.cyan,
          g,
          [x, h - 0.6, 0],
          [0.55, 1.1, 0.08],
        );
        pennant.rotation.z = Math.PI;
      }
    }
  }
  for (const f of [0.14, 0.44, 0.84]) garland(0, f);
  for (const f of [0.34, 0.77]) garland(1, f, true);
  for (const f of [0.13, 0.62]) garland(7, f);

  const treeT = sectorT(0, 0.055),
    tree = safeGroup(treeT, edgeOffset(treeT, 1, 25), 13);
  if (tree) {
    tree.name = "Festival homecoming tree and gifts";
    asset("kenney:holiday-kit/tree_decorated", tree, [0, 0, 0], [23, 23, 23]);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      asset(
        i % 2 ? "kenney:holiday-kit/present" : "kenney:holiday-kit/present_round",
        tree,
        [Math.cos(a) * 7, 0, Math.sin(a) * 7],
        [1.6 + (i % 3) * 0.3, 1.6, 1.6],
      );
    }
    for (const x of [-10, 10]) pole(tree, x, 0, 0, 6);
    asset("kenney:holiday-kit/snowman_fancy", tree, [8, 0, -5], [3.5, 3.5, 3.5]);
  }

  // The elevated timber ribbon is a row of snow-covered houses whose roof
  // is the racing surface. Everything structural stays below that surface.
  const range = track.ELEVATED.find((s) => s.section === 6);
  for (let i = 0; i < 16; i++) {
    const t = range.start + ((range.end - range.start) * (i + 0.5)) / 16,
      g = groupAt(t);
    const height = 5.5;
    g.name = "Inhabited house below the balcony racing passage";
    box(i % 2 ? p.cream : p.rock, g, [0, -height / 2 - 0.15, 0], [13.6, height, 6.9]);
    box(p.timber, g, [0, -0.24, 0], [15, 0.38, 7.1]);
    for (const side of [-1, 1]) {
      for (const z of [-2, 2]) {
        box(p.timber, g, [side * 6.88, -2.9, z], [0.15, 5.2, 0.22]);
        box(p.gold, g, [side * 6.92, -2.8, z], [0.12, 1.5, 1.15]);
        box(p.timber, g, [side * 7.0, -2.8, z], [0.12, 0.1, 1.25]);
      }
      box(p.snow, g, [side * 6.9, -0.05, 0], [0.6, 0.3, 7]);
    }
  }
  for (const f of [0.1, 0.36, 0.62, 0.85]) garland(6, f, true);
  // Overhead balconies connect the village's route framing at camera-safe height.
  for (const f of [0.54, 0.78]) {
    const t = sectorT(6, f),
      g = groupAt(t),
      half = track.roadHalfWidth(t) + 4.5;
    for (const side of [-1, 1]) {
      box(p.timber, g, [side * half, 5.5, 0], [0.45, 11, 0.45]);
      beam(g, [side * half, 8, 0], [side * half * 0.68, 11, 0], 0.2, p.bark);
    }
    box(p.timber, g, [0, 11.5, 0], [half * 2, 0.5, 2.8]);
    box(p.snow, g, [0, 11.85, 0], [half * 2 + 0.4, 0.28, 3]);
    for (let i = 0; i < 10; i++)
      box(p.timber, g, [-half + (i * half * 2) / 9, 12.4, -1.3], [0.12, 1.2, 0.12]);
    box(p.timber, g, [0, 12.9, -1.3], [half * 2, 0.12, 0.12]);
  }
  // Firewood, sleds, mittens and domestic marks fill the backstreets.
  for (let i = 0; i < 15; i++)
    for (const side of [-1, 1]) {
      const t = sectorT(6, (i + 0.5) / 15),
        g = safeGroup(t, edgeOffset(t, side, 4.3), 2.4);
      if (!g) continue;
      if (i % 3 === 0) {
        for (let j = 0; j < 6; j++) {
          const log = mesh(
            geo.cylinder,
            p.bark,
            g,
            [(j % 3) * 0.52 - 0.5, 0.3 + Math.floor(j / 3) * 0.45, 0],
            [0.26, 2, 0.26],
          );
          log.rotation.x = Math.PI / 2;
        }
        box(p.snow, g, [0, 1.2, 0], [2, 0.25, 2.2]);
      } else
        asset(
          i % 3 === 1 ? "kenney:holiday-kit/sled" : "kenney:holiday-kit/snowman",
          g,
          [0, 0, 0],
          [1.6, 1.6, 1.6],
        );
      trail(g, -1.8, -3, 7, 0.3);
    }
  const paradeT = sectorT(7, 0.46),
    parade = safeGroup(paradeT, edgeOffset(paradeT, -1, 18), 10);
  if (parade) {
    parade.name = "Starfall parade sleigh ready for the procession";
    asset("kenney:holiday-kit/sled", parade, [0, 0, 0], [7.5, 7.5, 7.5]);
    for (let i = 0; i < 6; i++)
      asset("kenney:holiday-kit/present", parade, [-2.5 + i, 2, 0], [1.3, 1.3, 1.3]);
    for (const x of [-4, 4]) {
      box(p.timber, parade, [x, 4, 0], [0.2, 7, 0.2]);
      lantern(parade, [x, 7.3, 0], 2);
    }
    trail(parade, -3, -12, 17);
  }
  const finish = groupAt(0),
    half = track.roadHalfWidth(0) + 3;
  for (const side of [-1, 1]) box(p.timber, finish, [side * half, 6.5, 0], [0.6, 13, 0.6]);
  box(p.red, finish, [0, 12.6, 0], [half * 2, 2, 0.4]);
  for (let i = -4; i <= 4; i++) {
    const star = mesh(geo.cone, p.gold, finish, [i * 2, 12.7, -0.3], [0.4, 0.8, 0.1]);
    star.rotation.z = i % 2 ? Math.PI : 0;
  }
  lantern(finish, [-half, 10.5, 0], 1.7);
  lantern(finish, [half, 10.5, 0], 1.7);
  // A separate pond keeps skaters beyond the physical racing edge.
  const pondT = sectorT(5, 0.37),
    pond = safeGroup(pondT, edgeOffset(pondT, -1, 32), 17);
  if (pond) {
    pond.name = "Festival skating pond separate from the lake racing line";
    mesh(geo.cylinder, p.dark, pond, [0, 0.12, 0], [16, 0.25, 12]);
    mesh(geo.cylinder, p.ice, pond, [0, 0.3, 0], [15.7, 0.14, 11.7]);
    for (let i = 0; i < 18; i++) {
      const a = (i * Math.PI) / 9;
      box(p.cream, pond, [Math.cos(a) * 16, 1.0, Math.sin(a) * 12], [0.16, 1.6, 0.16]);
      const board = box(
        i % 2 ? p.red : p.cyan,
        pond,
        [Math.cos(a) * 16, 1.5, Math.sin(a) * 12],
        [5.6, 0.5, 0.15],
      );
      board.rotation.y = -a + Math.PI / 2;
    }
    for (const x of [-16, 16]) pole(pond, x, 0.3, 0, 5.5);
  }
  return { pond };
}
