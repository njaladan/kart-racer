/** Farmland continues beyond the existing orchard and wooded valley. */
export function windmillBackground(b) {
  const { track, mat, mesh, box, group, place, motion, surfaceY } = b;
  const meadow = mat("#739565", "grass"),
    grain = mat("#c4b473", "grass"),
    wood = mat("#806951", "wood"),
    plaster = mat("#eadbb7"),
    roof = mat("#687987", "roof"),
    leaves = mat("#4f795c", "leaves");
  for (let s = 0; s < track.SECTIONS.length; s++) {
    const side = s % 2 ? 1 : -1;
    place(
      s,
      0.35,
      side,
      "Patchwork fields and distant working farm",
      (g) => {
        mesh("ridge", meadow, g, [0, 0, -108], [165, 34 + (s % 3) * 12, 90]);
        for (let i = 0; i < 4; i++) {
          box(i % 2 ? grain : meadow, g, [-48 + i * 30, 0.2, -35], [28, 0.3, 38]);
          box(wood, g, [-48 + i * 30, 0.6, -57], [29, 0.6, 0.8]);
        }
        const farm = group(g, [30, 0, -38]);
        box(plaster, farm, [0, 7, 0], [20, 14, 16]);
        mesh("roof", roof, farm, [0, 14, 0], [24, 9, 20]);
        box(wood, farm, [0, 4, 8.1], [5, 8, 0.3]);
        box(plaster, farm, [18, 5, 0], [14, 10, 16]);
        mesh("roof", roof, farm, [18, 10, 0], [18, 7, 20]);
        if (s % 2 === 0) {
          mesh("cylinder", plaster, farm, [-23, 14, 0], [5, 28, 5]);
          mesh("cone", roof, farm, [-23, 31, 0], [7, 8, 7]);
          const sails = group(farm, [-23, 23, 6]);
          for (let j = 0; j < 4; j++) {
            const blade = group(sails);
            blade.rotation.z = (j * Math.PI) / 2;
            box(wood, blade, [0, 8, 0], [0.8, 17, 0.6]);
            box(plaster, blade, [2.2, 10, 0], [4, 10, 0.3]);
          }
          motion(sails, (time) => {
            sails.rotation.z = time * 0.13 + s;
          });
        }
      },
      { distance: 205, padding: 16 },
    );
    place(
      s,
      0.72,
      -side,
      "Wooded countryside ridge and circling birds",
      (g) => {
        const ridge = mesh("ridge", meadow, g, [0, 0, 0], [180, 48, 100]);
        for (let i = 0; i < 8; i++) {
          const x = -65 + i * 18,
            y = surfaceY(ridge, x, -20) - 0.15;
          mesh("cylinder", wood, g, [x, y + 5, -20], [1, 10, 1]);
          mesh("sphere", leaves, g, [x, y + 15, -20], [10, 12, 9]);
        }
        const flock = group(g, [0, 75, 0]);
        for (let i = 0; i < 3; i++) {
          const bird = group(flock, [i * 7, (i % 2) * 3, i * 5]);
          for (const sign of [-1, 1])
            mesh("roof", roof, bird, [sign * 1.7, 0, 0], [3.5, 0.8, 0.8]).rotation.z = sign * 0.2;
        }
        motion(flock, (time) => {
          flock.rotation.y = time * 0.09 + s;
        });
      },
      { distance: 300, padding: 25 },
    );
  }
}
