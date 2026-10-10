/** A second city depth and working port continue beyond the existing quays. */
export function neonBackground(b) {
  const { track, mat, mesh, box, group, tube, place, motion } = b;
  const facade = mat("#33455e", "concrete"),
    steel = mat("#486273", "metal"),
    glass = mat("#5793ab", null, { emissive: "#255a73", emissiveIntensity: 0.4 }),
    amber = mat("#d7b27a", null, { emissive: "#d7a564", emissiveIntensity: 0.5 }),
    cargo = mat("#596b7d"),
    hull = mat("#30495c"),
    deck = mat("#829caa");
  for (let s = 0; s < track.SECTIONS.length; s++) {
    const side = s % 2 ? 1 : -1;
    place(
      s,
      0.28,
      side,
      "Layered Port Lumen skyline",
      (g) => {
        box(steel, g, [0, 1, 0], [125, 2, 58]);
        for (let i = 0; i < 4; i++) {
          const tower = group(g, [-42 + i * 28, 0, (i % 2) * -12]);
          const h = 35 + ((s * 3 + i * 5) % 8) * 10;
          box(facade, tower, [0, h / 2, 0], [20, h, 24]);
          box(facade, tower, [0, h + 7, 0], [13, 14, 18]);
          for (let y = 8; y < h; y += 10)
            for (const z of [-12.1, 12.1])
              box((i + y) % 3 ? glass : amber, tower, [0, y, z], [16, 2, 0.2]);
          box(steel, tower, [0, h + 23, 0], [0.7, 18, 0.7]);
        }
      },
      { distance: 250 },
    );
    place(
      s,
      0.7,
      -side,
      "Distant container quay and harbor traffic",
      (g) => {
        box(steel, g, [0, 1, 0], [96, 2, 32]);
        for (let i = 0; i < 5; i++) {
          box(i % 2 ? cargo : hull, g, [-36 + i * 18, 6, 0], [16, 8, 12]);
          if (i % 2) box(cargo, g, [-36 + i * 18, 14, 0], [16, 8, 12]);
        }
        for (const x of [-35, 35]) {
          tube(g, [x, 0, -8], [x, 57, -8], 1.4, steel);
          tube(g, [x, 53, -8], [x + 25, 53, 32], 1, steel);
          tube(g, [x, 57, -8], [x + 25, 53, 32], 0.3, amber);
          tube(g, [x + 22, 53, 28], [x + 22, 15, 28], 0.18, steel);
        }
        const ship = group(g, [0, 0, 65]);
        mesh("sphere", hull, ship, [0, 1, 0], [9, 3, 32]);
        box(deck, ship, [0, 4, 0], [14, 1, 49]);
        box(deck, ship, [0, 9, -15], [11, 10, 11]);
        box(glass, ship, [0, 11, -9.4], [9, 2, 0.2]);
        for (let i = 0; i < 3; i++) box(cargo, ship, [0, 7, i * 11], [12, 5, 9]);
        motion(ship, (time) => {
          ship.position.x = Math.sin(time * 0.035 + s) * 16;
        });
      },
      { distance: 240, floor: -7, padding: 20 },
    );
  }
}
