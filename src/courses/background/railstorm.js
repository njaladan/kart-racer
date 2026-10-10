/** Settlements, trestles and freight traffic fill the railway's forested valley. */
export function railstormBackground(b) {
  const { track, mat, mesh, box, group, tube, place, motion } = b;
  const ridge = mat("#7b91a0", "rock"),
    pine = mat("#536e6b", "needles"),
    wood = mat("#8b7664", "wood"),
    station = mat("#adb7ae"),
    roof = mat("#657380"),
    iron = mat("#6b7c86", "metal"),
    cargo = mat("#a4836c"),
    light = mat("#d8bc87", null, { emissive: "#ad8b56", emissiveIntensity: 0.2 });
  for (let s = 0; s < track.SECTIONS.length; s++) {
    const side = s % 2 ? 1 : -1;
    place(
      s,
      0.3,
      side,
      "Forested railway valley and distant station village",
      (g) => {
        mesh("ridge", ridge, g, [0, 0, -50], [200, 115 + (s % 3) * 25, 125]);
        for (let i = 0; i < 8; i++) {
          const x = -70 + i * 20,
            h = 26 + (i % 3) * 8;
          mesh("cylinder", wood, g, [x, 5, 24], [1, 10, 1]);
          mesh("cone", pine, g, [x, 8 + h / 2, 24], [7, h, 7]);
        }
        for (let i = 0; i < 3; i++) {
          const house = group(g, [-42 + i * 40, 0, 55]);
          box(station, house, [0, 8, 0], [28, 16, 20]);
          mesh("roof", roof, house, [0, 16, 0], [34, 10, 26]);
          for (const x of [-8, 0, 8]) box(light, house, [x, 9, 10.2], [4, 5, 0.2]);
        }
      },
      { distance: 280 },
    );
    place(
      s,
      0.73,
      -side,
      "Freight train on a distant valley trestle",
      (g) => {
        box(iron, g, [0, 35, 0], [14, 2, 145]);
        for (const z of [-60, -20, 20, 60]) {
          for (const x of [-5, 5]) tube(g, [x, 0, z], [x, 35, z], 1.1, iron);
          tube(g, [-5, 0, z], [5, 35, z], 0.65, iron);
          tube(g, [5, 0, z], [-5, 35, z], 0.65, iron);
        }
        for (const x of [-3, 3]) tube(g, [x, 37, -72], [x, 37, 72], 0.3, roof);
        const train = group(g, [0, 39, 0]);
        for (let i = 0; i < 4; i++) {
          const car = group(train, [0, 0, -36 + i * 23]);
          box(i === 0 ? roof : cargo, car, [0, 5, 0], [10, 10, 20]);
          box(iron, car, [0, 0, 0], [12, 2, 21]);
          for (const z of [-7, 7])
            for (const x of [-5, 5])
              mesh("cylinder", iron, car, [x, -2, z], [2, 1, 2]).rotation.z = Math.PI / 2;
          if (i === 0) box(light, car, [0, 7, -10.1], [7, 3, 0.2]);
        }
        motion(train, (time) => {
          train.position.z = Math.sin(time * 0.035 + s) * 16;
        });
      },
      { distance: 250, padding: 20 },
    );
  }
}
