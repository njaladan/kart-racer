/** Full-scale kitchen fixtures make the miniature route feel part of a real room. */
export function pantryBackground(b) {
  const { track, mat, mesh, box, group, tube, place } = b;
  const cream = mat("#e6d7b8"),
    teal = mat("#729792"),
    wood = mat("#a08061", "wood"),
    metal = mat("#a9bbbc", "metal", { metalness: 0.3 }),
    glass = mat("#a9c8ce"),
    leaves = mat("#77976c", "leaves"),
    jar = mat("#ad7f84"),
    dark = mat("#657576");
  for (let s = 0; s < track.SECTIONS.length; s++) {
    const side = s % 2 ? 1 : -1;
    place(
      s,
      0.3,
      side,
      "Kitchen cabinets appliances and hanging utensils",
      (g) => {
        box(teal, g, [0, 45, -20], [130, 90, 8]);
        for (let i = 0; i < 3; i++) {
          const cabinet = group(g, [-40 + i * 40, 0, 0]);
          box(cream, cabinet, [0, 18, 0], [38, 36, 38]);
          box(wood, cabinet, [0, 37, 0], [40, 2, 42]);
          box(teal, cabinet, [0, 19, 19.2], [31, 27, 0.7]);
          box(metal, cabinet, [10, 23, 20], [1.2, 8, 1]);
          if (i !== 1) {
            box(cream, cabinet, [0, 72, -4], [35, 30, 28]);
            box(teal, cabinet, [0, 72, 10.2], [29, 24, 0.7]);
            box(metal, cabinet, [9, 70, 11], [1.2, 7, 1]);
          }
        }
        if (s % 2 === 0) {
          box(metal, g, [0, 38.5, 0], [34, 1, 28]);
          for (const x of [-9, 9])
            for (const z of [-7, 7])
              mesh("ring", dark, g, [x, 39.2, z], [5, 5, 5]).rotation.x = Math.PI / 2;
          box(metal, g, [0, 68, -4], [37, 4, 32]);
          box(metal, g, [0, 78, -12], [16, 18, 12]);
        } else {
          const fridge = group(g, [0, 0, 0]);
          box(cream, fridge, [0, 40, 0], [34, 80, 34]);
          for (const [y, h] of [
            [22, 40],
            [62, 34],
          ])
            box(teal, fridge, [0, y, 17.4], [31, h, 1]);
          for (const y of [30, 58]) box(metal, fridge, [11, y, 18.5], [1.5, 15, 1.2]);
        }
        tube(g, [-50, 53, 25], [50, 53, 25], 0.6, metal);
        for (let i = 0; i < 3; i++) {
          const x = -42 + i * 14;
          tube(g, [x, 53, 25], [x, 42, 25], 0.6, metal);
          mesh("sphere", metal, g, [x, 39, 25], [3.5, 5, 0.7]);
        }
      },
      { distance: 230 },
    );
    place(
      s,
      0.72,
      -side,
      "Stocked pantry shelves and garden window",
      (g) => {
        box(cream, g, [0, 52, -22], [140, 104, 6]);
        box(glass, g, [0, 73, -18.5], [60, 43, 0.8]);
        for (const x of [-22, 19]) {
          box(wood, g, [x, 65, -17], [2, 22, 1]);
          mesh("sphere", leaves, g, [x, 76, -15.5], [11, 13, 1]);
        }
        for (const x of [-32, 0, 32]) box(wood, g, [x, 73, -13], [3, 47, 3]);
        for (const y of [50, 73, 96]) box(wood, g, [0, y, -13], [67, 3, 3]);
        for (const y of [1, 23, 45]) {
          box(wood, g, [0, y, 0], [130, 2, 42]);
          for (let i = 0; i < 6; i++) {
            const x = -50 + i * 20;
            mesh("cylinder", i % 2 ? jar : teal, g, [x, y + 10, 3], [7, 17, 7]);
            mesh("cylinder", cream, g, [x, y + 19, 3], [7.4, 2, 7.4]);
            box(cream, g, [x, y + 10, 10.1], [8, 7, 0.2]);
          }
        }
      },
      { distance: 245 },
    );
  }
}
