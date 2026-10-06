/** District fixtures and their bake emitters share positions and palettes. */
export function buildPortLighting({ scenery, track, kit, props, materials }) {
  const { box, groupAt, sectorT, batch, material } = kit;
  const { steel, dark, cyan, pink } = materials;
  const { lightAt } = props;
  const warm = material("#ffe3af", { emissive: "#ffd29a", emissiveIntensity: 1.5 });
  const cool = material("#b3e9ff", { emissive: "#8dcfff", emissiveIntensity: 1.35 });
  const upright = (t, offset = 0) => {
    const g = groupAt(t, offset, scenery);
    g.rotation.set(0, track.yawFor(track.frameAt(t).tangent), 0);
    return g;
  };

  // Warm market canopy light reaches the stalls and the central driving lane.
  for (let i = 0; i < 9; i++) {
    const g = upright(sectorT(2, (i + 0.5) / 9));
    for (const side of [-1, 1]) {
      const x = side * (track.roadHalfWidth(sectorT(2, (i + 0.5) / 9)) + 1.8);
      box(steel, g, [x, 5.5, 0], [0.12, 11, 0.12]);
      box(steel, g, [x - side * 1.3, 11, 0], [2.9, 0.15, 0.7]);
      box(warm, g, [x - side * 1.5, 10.89, 0], [2.2, 0.08, 0.5]);
      lightAt(g, [x - side * 1.5, 10.65, 0], "#ffd2a0", 6, 23);
    }
    batch(g);
  }

  // Cargo floodlights sit on tall poles outside the legal driving footprint.
  // A cool fill alternates with amber fixtures, revealing each stack's color.
  for (let i = 0; i < 12; i++) {
    const t = sectorT(4, (i + 0.5) / 12);
    const g = upright(t);
    const side = i % 2 ? 1 : -1;
    const surface = track.surfaceAt(t);
    const edge = side > 0 ? surface.rightEdge : -surface.leftEdge;
    const x = side * (edge + 0.5);
    box(steel, g, [x, 7.2, 0], [0.2, 14.4, 0.2]);
    box(dark, g, [x - side * 1.6, 14.4, 0], [3.4, 0.5, 1.2]);
    for (const z of [-0.34, 0.34])
      box(i % 3 === 0 ? warm : cool, g, [x - side * 1.6, 14.1, z], [2.8, 0.08, 0.28]);
    lightAt(g, [x - side * 1.6, 13.8, 0], i % 3 === 0 ? "#ffd09b" : "#abdfff", 8, 31);
    batch(g);
  }

  // Paired ceiling bars illuminate the ferry deck and its bulkheads evenly.
  for (let i = 0; i <= 10; i++) {
    const g = groupAt(sectorT(5, 0.2 + i * 0.06));
    for (const x of [-6.5, 6.5]) {
      box(dark, g, [x, 13.25, 0], [1.6, 0.18, 5.2]);
      box(warm, g, [x, 13.13, 0], [1.15, 0.08, 4.8]);
      lightAt(g, [x, 12.9, 0], "#ffe0b5", 7, 24);
      box(cool, g, [Math.sign(x) * 11.12, 4.2, 0], [0.12, 0.32, 1.1]);
      lightAt(g, [Math.sign(x) * 10.9, 4.2, 0], "#a2dce9", 2.5, 10);
    }
    batch(g);
  }

  // Deck lamps mark bridge edges; up-lighting makes the tall towers readable.
  for (let i = 0; i < 10; i++) {
    const t = sectorT(3, 0.08 + i * 0.092);
    const g = upright(t);
    for (const side of [-1, 1]) {
      const x = side * (track.roadHalfWidth(t) + 1.1);
      box(steel, g, [x, 4, 0], [0.12, 8, 0.12]);
      box(cool, g, [x - side * 0.75, 8, 0], [1.8, 0.16, 0.5]);
      lightAt(g, [x - side * 0.75, 7.8, 0], "#b6d8ff", 4, 23);
    }
    batch(g);
  }
  for (const fraction of [0.2, 0.76]) {
    const g = upright(sectorT(3, fraction));
    for (const side of [-1, 1]) {
      box(cyan, g, [side * 15, 10, 1.66], [0.16, 14, 0.08]);
      lightAt(g, [side * 15, 15, 2.3], "#6fdce3", 5, 22);
      lightAt(g, [side * 15, 30, 2.3], "#8acbf5", 5, 22);
    }
    batch(g);
  }
  const lighthouse = upright(sectorT(6, 0.66), 34);
  for (const x of [-4.5, 4.5]) {
    box(cool, lighthouse, [x, 0.5, 0], [0.6, 0.1, 0.6]);
    lightAt(lighthouse, [x, 1, 0], "#b1d9ff", 5, 25);
  }
  lightAt(lighthouse, [0, 21, 0], "#ffdda0", 4, 14);
  batch(lighthouse);

  // The tower crown supplies a broad blue-violet wash above downtown.
  const tower = upright(sectorT(1, 0.78), 36);
  box(pink, tower, [0, 74.5, 11.7], [15, 0.12, 0.12]);
  lightAt(tower, [0, 72, 13], "#ab9cfa", 5, 26);
}
