/** Blue-domed island settlements and research terraces continue out to sea. */
export function emberwingBackground(b) {
  const { track, mat, mesh, box, group, tube, place, motion } = b;
  const basalt = mat("#778f95", "rock"),
    white = mat("#e4ddca"),
    blue = mat("#5e95ad"),
    green = mat("#6c9680", "leaves"),
    stone = mat("#b2b8a5", "stone"),
    dark = mat("#55727b"),
    light = mat("#d3c396", null, { emissive: "#bca378", emissiveIntensity: 0.2 });
  for (let s = 0; s < track.SECTIONS.length; s++) {
    const side = s % 2 ? 1 : -1;
    place(
      s,
      0.3,
      side,
      "Distant volcanic island and blue dome village",
      (g) => {
        mesh("ridge", basalt, g, [0, -10, -42], [200, 115 + (s % 3) * 25, 130]);
        mesh("ridge", basalt, g, [55, -8, -12], [95, 75, 65]);
        box(stone, g, [-15, 8, 42], [130, 38, 52]);
        for (let i = 0; i < 4; i++) {
          const house = group(g, [-60 + i * 28, 27, 42]);
          const h = 10 + (i % 2) * 8;
          box(white, house, [0, h / 2, 0], [22, h, 19]);
          box(white, house, [0, h, 0], [24, 1.5, 21]);
          box(blue, house, [0, 5, 9.6], [5, 10, 0.4]);
          for (const x of [-7, 7]) box(dark, house, [x, h - 4, 9.6], [3, 3, 0.3]);
          if (i % 2 === 0) mesh("sphere", blue, house, [0, h, 0], [9, 8, 9]);
          if (i === 3) {
            mesh("cylinder", white, house, [0, h + 8, 0], [6, 16, 6]);
            mesh("sphere", blue, house, [0, h + 17, 0], [7, 6, 7]);
          }
        }
      },
      { distance: 280, floor: -30 },
    );
    place(
      s,
      0.72,
      -side,
      "Island observatory terraces and fishing harbor boats",
      (g) => {
        mesh("ridge", basalt, g, [0, -5, -25], [150, 85, 100]);
        box(stone, g, [0, 10, 20], [80, 42, 45]);
        mesh("cylinder", white, g, [-17, 42, 20], [14, 22, 14]);
        mesh("sphere", blue, g, [-17, 53, 20], [15, 12, 15]);
        box(dark, g, [-17, 58, 32], [2.5, 12, 1]);
        tube(g, [21, 31, 20], [21, 44, 20], 1, dark);
        tube(g, [17, 42, 25], [29, 51, 11], 2.8, white);
        for (const x of [-32, 32]) {
          box(stone, g, [x, 32, 26], [14, 2, 13]);
          mesh("sphere", green, g, [x, 36, 26], [5, 4, 5]);
        }
        const fleet = group(g, [0, 20, 0]);
        for (let i = 0; i < 3; i++) {
          const boat = group(fleet, [-35 + i * 30, 0, 85 + (i % 2) * 20]);
          mesh("sphere", blue, boat, [0, 0, 0], [4, 2, 11]);
          box(white, boat, [0, 3, -3], [5, 4, 5]);
          box(light, boat, [0, 3, -0.4], [3, 1.4, 0.2]);
          tube(boat, [0, 2, 3], [0, 14, 3], 0.25, dark);
        }
        motion(fleet, (time) => {
          fleet.position.y = 20 + Math.sin(time * 0.4 + s) * 0.6;
          fleet.position.x = Math.sin(time * 0.025 + s) * 5;
        });
      },
      { distance: 250, floor: -30, padding: 8 },
    );
  }
}
