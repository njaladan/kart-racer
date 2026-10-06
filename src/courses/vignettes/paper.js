/** Pop-up books reveal folded forests; oversized pinwheels catch the festival wind. */
export function buildPaperStories(w) {
  const { mat, mesh, box, cylinder, sphere, group, site, tube, silhouette, motion } = w;
  const paper = mat("#fff1cd", "fabric", { side: w.THREE.DoubleSide }),
    rose = mat("#ce7697", "fabric", { side: w.THREE.DoubleSide }),
    teal = mat("#6fbbb4", "fabric", { side: w.THREE.DoubleSide }),
    violet = mat("#9d88ba", "fabric", { side: w.THREE.DoubleSide }),
    gold = mat("#e7b36b"),
    ink = mat("#664b75");
  const library = site("Unfolding pop-up storybook garden", 1, 0.54, -1, 14, 24);
  mesh(cylinder, violet, library, [0, 0.8, 0], [10, 1.6, 10]);
  const treeGeometry = silhouette([
    [-2, 0],
    [-0.8, 3],
    [-2.4, 3],
    [-0.5, 6],
    [-1.7, 6],
    [0, 9],
    [1.7, 6],
    [0.5, 6],
    [2.4, 3],
    [0.8, 3],
    [2, 0],
  ]);
  for (const side of [-1, 1]) {
    const page = group(library, [0, 2, 0]);
    box(rose, page, [side * 5, 0, 0], [10, 0.6, 15]);
    for (let i = 0; i < 4; i++) box(paper, page, [side * 5, 0.4 + i * 0.1, 0], [9.6, 0.07, 14.5]);
    for (let i = 0; i < 3; i++) {
      const tree = mesh(treeGeometry, i % 2 ? teal : violet, page, [
        side * (2.5 + i * 2.3),
        0.9,
        -4 + i * 3,
      ]);
      tree.rotation.y = i * 0.35;
    }
    const fox = group(page, [side * 5, 1.5, 3]);
    mesh(
      silhouette([
        [-2, 0],
        [-1, 1.8],
        [1.3, 1.5],
        [2.7, 0.2],
        [1, 0.3],
        [1, 0],
      ]),
      gold,
      fox,
    );
    mesh(
      silhouette([
        [0, 0],
        [-0.9, 2],
        [0.1, 1.5],
        [0.9, 2.2],
        [1.3, 0.4],
        [2, 0],
      ]),
      rose,
      fox,
      [1, 1.3, 0],
    );
    mesh(sphere, ink, fox, [1.7, 2.4, 0.19], [0.13, 0.13, 0.13]);
    tube(page, [side * 1, 1, -5], [side * 8, 1, -5], 0.07, ink);
    motion(page, (time) => {
      page.rotation.z = side * (0.08 + (0.5 + 0.5 * Math.sin(time * 0.28)) * 0.52);
    });
  }

  const meadow = site("Folded pinwheel flower meadow", 5, 0.62, 1, 14, 26);
  const blade = silhouette([
    [0, 0],
    [3, 0.2],
    [4.3, 3.2],
    [1.1, 2.1],
    [0.3, 4.5],
  ]);
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 4,
      y = 8 + (i % 3) * 3,
      z = (i % 2) * -4;
    tube(meadow, [x, 0, z], [x, y, z], 0.18, paper);
    const rotor = group(meadow, [x, y, z]);
    for (let j = 0; j < 4; j++)
      mesh(blade, [rose, teal, gold, violet][j], rotor).rotation.z = (j * Math.PI) / 2;
    mesh(sphere, paper, rotor, [0, 0, 0.3], [0.5, 0.5, 0.5]);
    motion(rotor, (time) => {
      rotor.rotation.z = time * (0.25 + i * 0.045) + i;
    });
    for (let j = 0; j < 3; j++)
      mesh(
        silhouette([
          [0, 0],
          [-2, 1],
          [-0.8, 2],
          [0, 0],
        ]),
        teal,
        meadow,
        [x, 2 + j * 1.5, z],
      ).rotation.y = j * 2;
  }
}
