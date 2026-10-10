/** Inhabited alpine slopes connect the mountain skyline to the winter festival. */
export function frostpeakBackground(b) {
  const { track, mat, mesh, box, group, tube, place, motion } = b;
  const snow = mat("#cbdde8", "snow"),
    stone = mat("#8198af", "rock"),
    pine = mat("#5e7c88", "needles"),
    wood = mat("#896e62", "wood"),
    light = mat("#e9c798", null, { emissive: "#cbaa77", emissiveIntensity: 0.35 }),
    iron = mat("#61748b", "metal"),
    red = mat("#ad6c77");
  for (let s = 0; s < track.SECTIONS.length; s++) {
    const side = s % 2 ? 1 : -1;
    place(
      s,
      0.3,
      side,
      "Snowy mountain village beyond the festival",
      (g) => {
        mesh("ridge", snow, g, [0, 0, -75], [200, 115 + (s % 3) * 20, 130]);
        mesh("ridge", stone, g, [35, 0, -45], [130, 65, 90]);
        for (let i = 0; i < 3; i++) {
          const chalet = group(g, [-38 + i * 35, 0, 22 + (i % 2) * 10]);
          box(wood, chalet, [0, 8, 0], [22, 16, 18]);
          mesh("roof", snow, chalet, [0, 16, 0], [28, 12, 24]);
          box(stone, chalet, [8, 23, 0], [3, 11, 3]);
          for (const x of [-6, 6]) box(light, chalet, [x, 10, 9.1], [4, 5, 0.2]);
        }
        for (let i = 0; i < 7; i++) {
          const x = -70 + i * 23,
            h = 17 + (i % 3) * 7;
          mesh("cylinder", wood, g, [x, 4, 55], [0.9, 8, 0.9]);
          mesh("cone", pine, g, [x, h / 2 + 5, 55], [7, h, 7]);
          mesh("cone", snow, g, [x, h / 2 + 8, 55], [6, h - 4, 6]);
        }
      },
      { distance: 250 },
    );
    place(
      s,
      0.72,
      -side,
      "Distant ski lift and alpine beacon ridge",
      (g) => {
        mesh("ridge", snow, g, [0, 0, -35], [180, 90, 90]);
        for (const x of [-55, 55]) {
          tube(g, [x, 0, 18], [x, 48, 18], 1.8, iron);
          box(iron, g, [x, 48, 18], [13, 2, 3]);
        }
        tube(g, [-55, 49, 18], [55, 49, 18], 0.22, iron);
        const lift = group(g, [0, 38, 18]);
        box(red, lift, [0, 3, 0], [7, 6, 6]);
        box(light, lift, [0, 6, 3.1], [5, 2, 0.2]);
        tube(lift, [0, 6, 0], [0, 11, 0], 0.4, iron);
        motion(lift, (time) => {
          lift.position.x = Math.sin(time * 0.035 + s) * 45;
        });
      },
      { distance: 280, padding: 50 },
    );
  }
}
