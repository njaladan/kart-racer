/** Offshore refuges and working vessels keep the exposed bridge vistas inhabited. */
export function tempestBackground(b) {
  const { track, mat, mesh, box, group, tube, place, motion } = b;
  const rock = mat("#6c8493", "rock"),
    plaster = mat("#bcc7c8"),
    roof = mat("#5a6d7d"),
    hull = mat("#3e586a"),
    deck = mat("#a9b5bc"),
    beacon = mat("#edd19b", null, { emissive: "#cfb174", emissiveIntensity: 0.6 });
  for (let s = 0; s < track.SECTIONS.length; s++) {
    const side = s % 2 ? 1 : -1;
    place(
      s,
      0.3,
      side,
      "Offshore lighthouse refuge and rugged sea stacks",
      (g) => {
        mesh("ridge", rock, g, [0, -10, 0], [160, 72 + (s % 3) * 18, 110]);
        for (let i = 0; i < 3; i++)
          mesh("ridge", rock, g, [-48 + i * 47, -8, -50], [45, 55 + i * 18, 38]).rotation.y =
            i * 0.7;
        mesh("cylinder", rock, g, [28, 1, 20], [18, 24, 18]);
        mesh("cylinder", plaster, g, [28, 30, 20], [6, 42, 6]);
        mesh("cylinder", roof, g, [28, 48, 20], [7, 2, 7]);
        mesh("cylinder", beacon, g, [28, 53, 20], [5, 7, 5]);
        mesh("cone", roof, g, [28, 59, 20], [8, 6, 8]);
        box(rock, g, [-22, 0, 34], [26, 20, 23]);
        box(plaster, g, [-22, 14, 34], [22, 10, 20]);
        mesh("roof", roof, g, [-22, 19, 34], [27, 8, 25]);
        box(beacon, g, [-22, 15, 44.1], [5, 4, 0.2]);
      },
      { distance: 270, floor: -10 },
    );
    place(
      s,
      0.72,
      -side,
      "Fishing fleet beyond the causeway",
      (g) => {
        for (let i = 0; i < 3; i++) {
          const boat = group(g, [-35 + i * 35, 0, (i % 2) * 24]);
          mesh("sphere", hull, boat, [0, 0, 0], [5, 2.8, 17]);
          box(deck, boat, [0, 2, 0], [8, 0.7, 26]);
          box(plaster, boat, [0, 5, -6], [7, 6, 8]);
          box(beacon, boat, [0, 6, -1.9], [5, 2, 0.2]);
          tube(boat, [0, 3, 5], [0, 22, 5], 0.35, roof);
          tube(boat, [0, 20, 5], [0, 12, 16], 0.2, roof);
          motion(boat, (time) => {
            boat.position.y = Math.sin(time * 0.6 + s + i) * 1.4;
            boat.rotation.z = Math.sin(time * 0.4 + i) * 0.045;
          });
        }
      },
      { distance: 230, floor: -10, padding: 5 },
    );
  }
}
