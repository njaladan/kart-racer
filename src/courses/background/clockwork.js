/** An inhabited brass city surrounds the upper terraces and central gear bowl. */
export function clockworkBackground(b) {
  const { track, mat, mesh, box, group, tube, place, motion } = b;
  const brass = mat("#bba073", "metal", { metalness: 0.35 }),
    bronze = mat("#736456", "metal"),
    roof = mat("#61777a"),
    stone = mat("#a89a81", "stone"),
    light = mat("#dbc38d", null, { emissive: "#c59b54", emissiveIntensity: 0.3 });
  for (let s = 0; s < track.SECTIONS.length; s++) {
    const side = s % 2 ? 1 : -1;
    place(
      s,
      0.32,
      side,
      "Brass skyline and elevated clockmaker district",
      (g) => {
        box(stone, g, [0, 1, 0], [110, 2, 50]);
        for (let i = 0; i < 3; i++) {
          const tower = group(g, [-35 + i * 35, 0, (i % 2) * -12]);
          const h = 55 + ((s + i * 2) % 4) * 14;
          mesh("cylinder", stone, tower, [0, 4, 0], [14, 8, 14]);
          mesh("cylinder", brass, tower, [0, h / 2 + 4, 0], [10, h, 10]);
          mesh("sphere", roof, tower, [0, h + 5, 0], [11, 9, 11]);
          for (let y = 18; y < h; y += 16) {
            mesh("cylinder", bronze, tower, [0, y, 0], [11, 1.2, 11]);
            for (const x of [-4, 4]) box(light, tower, [x, y - 6, 9.3], [2.5, 5, 0.3]);
          }
          tube(tower, [5, h, 0], [5, h + 18, 0], 1.3, bronze);
          mesh("cone", brass, tower, [0, h + 17, 0], [3, 12, 3]);
        }
        for (const x of [-18, 18]) {
          box(bronze, g, [x, 35, 0], [20, 3, 8]);
          box(brass, g, [x, 39, -3.8], [20, 0.5, 0.5]);
          for (let i = 0; i < 5; i++) box(brass, g, [x - 8 + i * 4, 37, -3.8], [0.3, 4, 0.3]);
        }
      },
      { distance: 250 },
    );
    place(
      s,
      0.74,
      -side,
      "Distant clock towers and slow passenger airship",
      (g) => {
        for (const x of [-30, 30]) {
          box(stone, g, [x, 28, 0], [22, 56, 22]);
          mesh("roof", roof, g, [x, 56, 0], [28, 15, 28]);
          mesh("cylinder", light, g, [x, 43, 11.2], [7, 0.4, 7]).rotation.x = Math.PI / 2;
          box(bronze, g, [x, 45, 11.6], [0.5, 5, 0.3]);
          box(bronze, g, [x + 2, 43, 11.6], [4, 0.5, 0.3]);
        }
        const ship = group(g, [0, 120, 0]);
        mesh("sphere", brass, ship, [0, 0, 0], [14, 12, 32]);
        box(roof, ship, [0, -12, 0], [9, 5, 17]);
        for (const x of [-4, 4]) tube(ship, [x, -9, 0], [x, -3, 0], 0.3, bronze);
        box(light, ship, [0, -12, 8.6], [6, 2, 0.2]);
        motion(ship, (time) => {
          ship.position.x = Math.sin(time * 0.025 + s) * 25;
          ship.position.y = 120 + Math.sin(time * 0.1 + s) * 2;
        });
      },
      { distance: 300, padding: 30 },
    );
  }
}
