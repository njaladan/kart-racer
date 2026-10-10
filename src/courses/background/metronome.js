/** Concert galleries surround the music box without enclosing its drum jumps. */
export function metronomeBackground(b) {
  const { track, mat, mesh, box, tube, place } = b;
  const wood = mat("#77594e", "wood"),
    velvet = mat("#786078", "fabric"),
    brass = mat("#b9a078", "metal", { metalness: 0.35 }),
    dark = mat("#51495a"),
    light = mat("#e2c797", null, { emissive: "#cfaa70", emissiveIntensity: 0.35 });
  for (let s = 0; s < track.SECTIONS.length; s++) {
    const side = s % 2 ? 1 : -1;
    place(
      s,
      0.3,
      side,
      "Distant concert balconies and velvet curtain bays",
      (g) => {
        box(wood, g, [0, 1, 0], [130, 2, 60]);
        for (const x of [-58, 58]) {
          mesh("cylinder", brass, g, [x, 38, -17], [2, 76, 2]);
          mesh("sphere", brass, g, [x, 77, -17], [4, 3, 4]);
        }
        for (let i = 0; i < 12; i++)
          box(velvet, g, [-52 + i * 9.5, 39, -24 + Math.sin(i * 2) * 2], [9, 74, 4]);
        for (const y of [18, 43]) {
          box(wood, g, [0, y, 0], [116, 3, 44]);
          tube(g, [-58, y + 7, 21], [58, y + 7, 21], 0.5, brass);
          for (let i = 0; i < 15; i++)
            tube(g, [-54 + i * 7.7, y, 21], [-54 + i * 7.7, y + 7, 21], 0.22, brass);
          for (let i = 0; i < 7; i++) {
            const x = -44 + i * 15;
            box(dark, g, [x, y + 3, 1], [7, 2, 7]);
            box(velvet, g, [x, y + 6, -2], [7, 7, 1]);
          }
        }
        box(wood, g, [0, 78, -17], [128, 4, 9]);
        mesh("ring", brass, g, [0, 66, 17], [19, 19, 19]).rotation.x = Math.PI / 2;
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          tube(g, [0, 78, 17], [Math.cos(a) * 19, 66, 17 + Math.sin(a) * 19], 0.25, brass);
          mesh("sphere", light, g, [Math.cos(a) * 19, 68, 17 + Math.sin(a) * 19], [1, 2, 1]);
        }
      },
      { distance: 240 },
    );
    place(
      s,
      0.72,
      -side,
      "Brass organ gallery and distant instrument ensemble",
      (g) => {
        box(wood, g, [0, 8, 0], [100, 16, 40]);
        for (let i = 0; i < 9; i++) {
          const x = -40 + i * 10,
            h = 35 + (4 - Math.abs(4 - i)) * 10;
          mesh("cylinder", brass, g, [x, h / 2 + 16, -8], [3, h, 3]);
          box(dark, g, [x, 24, -4.9], [2.2, 5, 0.3]);
        }
        for (const x of [-30, 0, 30]) {
          mesh("sphere", wood, g, [x, 26, 16], [7, 11, 4]);
          tube(g, [x, 32, 16], [x, 50, 16], 0.8, dark);
          box(brass, g, [x, 48, 16], [4, 0.6, 1]);
          box(wood, g, [x, 17, 30], [10, 1, 6]);
          tube(g, [x, 16, 30], [x, 25, 30], 0.5, brass);
          box(dark, g, [x, 25, 30], [10, 8, 0.5]);
        }
      },
      { distance: 225 },
    );
  }
}
