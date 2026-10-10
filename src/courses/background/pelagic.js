/** Reef shelves, kelp and fish extend the submerged world beyond the glasshouse. */
export function pelagicBackground(b) {
  const { track, mat, mesh, box, group, tube, place, motion } = b;
  const rock = mat("#528c92", "rock"),
    kelp = mat("#498e7b", "leaves"),
    coral = mat("#b88991"),
    stone = mat("#82ada9", "stone"),
    fish = mat("#bac6a1"),
    glass = mat("#8fbcbf", null, { transparent: true, opacity: 0.2, depthWrite: false }),
    frame = mat("#6c9694", "metal"),
    sand = mat("#a7c4b1", "sand");
  for (let s = 0; s < track.SECTIONS.length; s++) {
    const side = s % 2 ? 1 : -1,
      wet = s >= 1 && s <= 4;
    place(
      s,
      0.3,
      side,
      "Layered reef shelf kelp forest and fish school",
      (g) => {
        mesh("ridge", rock, g, [0, -5, -20], [160, wet ? 42 : 90, 105]);
        for (let i = 0; i < 8; i++) {
          const x = -55 + i * 16,
            h = 12 + (i % 4) * 5;
          for (const sign of [-1, 1]) {
            const stem = mesh("cone", kelp, g, [x + sign * 2, h / 2, 24], [2, h, 2]);
            stem.rotation.z = sign * 0.13;
          }
          if (i % 2 === 0) mesh("sphere", coral, g, [x, 3, 38], [7, 4, 6]);
        }
        if (wet) {
          const school = group(g, [0, 24, 35]);
          for (let i = 0; i < 12; i++) {
            const animal = group(school, [-30 + (i % 6) * 12, Math.floor(i / 6) * 4, (i % 3) * 5]);
            mesh("sphere", fish, animal, [0, 0, 0], [2.4, 1.2, 0.7]);
            mesh("roof", fish, animal, [-2.7, 0, 0], [2, 2, 0.3]).rotation.z = Math.PI / 2;
          }
          motion(school, (time) => {
            school.position.x = Math.sin(time * 0.04 + s) * 15;
            school.position.y = 24 + Math.sin(time * 0.16 + s) * 2;
          });
        }
      },
      { distance: 220, floor: wet ? -55 : -30, padding: wet ? 20 : 3 },
    );
    place(
      s,
      0.72,
      -side,
      wet ? "Sunken stone arches and reef terraces" : "Distant botanical glasshouse island",
      (g) => {
        if (wet) {
          for (let i = 0; i < 3; i++) {
            const x = -38 + i * 38;
            for (const dx of [-10, 10]) mesh("cylinder", stone, g, [x + dx, 11, 0], [3, 22, 3]);
            mesh("ring", stone, g, [x, 22, 0], [12, 12, 4]);
            box(stone, g, [x, 1, 0], [29, 2, 18]);
            mesh("sphere", coral, g, [x + 5, 4, 8], [6, 3, 4]);
          }
        } else {
          mesh("ridge", sand, g, [0, -10, 0], [140, 60, 110]);
          box(stone, g, [0, 8, 0], [52, 26, 45]);
          mesh("sphere", glass, g, [0, 22, 0], [25, 27, 23]);
          for (const angle of [0, Math.PI / 3, (Math.PI * 2) / 3]) {
            const rib = mesh("ring", frame, g, [0, 22, 0], [25, 27, 23]);
            rib.rotation.y = angle;
          }
          for (const x of [-11, 11]) {
            tube(g, [x, 21, 0], [x, 38, 0], 0.7, frame);
            mesh("sphere", kelp, g, [x, 37, 0], [7, 9, 7]);
          }
        }
      },
      { distance: 240, floor: wet ? -55 : -10 },
    );
  }
}
