/** Folded villages and airborne festival shapes occupy the distant paper world. */
export function paperBackground(b) {
  const { track, mat, mesh, box, group, tube, place, motion } = b;
  const paper = ["#e4b6c3", "#b2bdd8", "#9bc3b7", "#e5c08c"].map((c) => mat(c, "fabric")),
    ink = mat("#876a83"),
    bamboo = mat("#a58b71", "wood"),
    lantern = mat("#edce9c", null, { emissive: "#d3aa72", emissiveIntensity: 0.25 });
  for (let s = 0; s < track.SECTIONS.length; s++) {
    const side = s % 2 ? 1 : -1;
    place(
      s,
      0.3,
      side,
      "Folded mountain village and pagoda silhouette",
      (g) => {
        for (let i = 0; i < 3; i++) {
          const mountain = mesh(
            "roof",
            paper[s % 4],
            g,
            [-60 + i * 60, 0, -40],
            [100, 50 + i * 17, 95],
          );
          mountain.rotation.y = i * 0.4;
          const house = group(g, [-40 + i * 38, 0, 30]);
          box(paper[(s + 1) % 4], house, [0, 7, 0], [21, 14, 17]);
          mesh("roof", paper[(s + 1) % 4], house, [0, 14, 0], [29, 10, 23]);
          box(ink, house, [0, 5, 8.6], [4, 10, 0.3]);
        }
        for (let tier = 0; tier < 4; tier++) {
          const width = 30 - tier * 5;
          box(paper[s % 4], g, [0, 28 + tier * 12, 30], [width * 0.65, 8, width * 0.6]);
          mesh("roof", paper[(s + 1) % 4], g, [0, 32 + tier * 12, 30], [width, 7, width]);
        }
      },
      { distance: 230 },
    );
    place(
      s,
      0.72,
      -side,
      "Distant origami cranes and festival lantern grove",
      (g) => {
        for (let i = 0; i < 5; i++) {
          const x = -45 + i * 23;
          tube(g, [x, 0, 0], [x, 18, 0], 0.45, bamboo);
          mesh("sphere", lantern, g, [x, 19, 0], [4, 5, 4]);
          box(ink, g, [x, 14, 0], [3, 0.6, 3]);
        }
        const flock = group(g, [0, 80, 0]);
        for (let i = 0; i < 4; i++) {
          const crane = group(flock, [-30 + i * 20, (i % 2) * 7, (i % 3) * 12]);
          mesh("roof", paper[s % 4], crane, [0, 0, 0], [3, 3, 7]);
          for (const sign of [-1, 1])
            mesh("roof", paper[(s + 1) % 4], crane, [sign * 5, 0, 0], [10, 2, 5]).rotation.z =
              sign * 0.2;
          tube(crane, [0, 1, -3], [0, 7, -5], 0.5, paper[s % 4]);
          mesh("cone", ink, crane, [0, 7, -7], [0.7, 5, 0.7]).rotation.x = Math.PI / 2;
        }
        motion(flock, (time) => {
          flock.position.x = Math.sin(time * 0.03 + s) * 20;
          flock.position.y = 80 + Math.sin(time * 0.2 + s) * 3;
        });
      },
      { distance: 265, padding: 25 },
    );
  }
}
