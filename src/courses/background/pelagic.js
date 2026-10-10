/** Distinct reef habitats replace identical kelp-and-arch rows around the route. */
export function pelagicBackground(b) {
  const { track, mat, mesh, box, rock, downloaded, group, tube, place, motion, THREE } = b;
  const stone = mat("#82a6a3", "stone"),
    reef = ["#507c88", "#829994", "#627893"].map((color) => mat(color, "rock")),
    kelp = ["#538e70", "#90ac69", "#438f92"].map((color) => mat(color, "leaves")),
    coral = ["#d0959a", "#dbb17e", "#a798c9", "#87bfac"].map((color) => mat(color, "rock")),
    fish = ["#e5c984", "#aacddd", "#cc9ea8"].map((color) => mat(color)),
    glass = mat("#8fbcbf", null, { transparent: true, opacity: 0.2, depthWrite: false }),
    frame = mat("#6c9694", "metal"),
    sand = mat("#b5c4ac", "sand");
  const habitatNames = [
    "Swaying kelp channels",
    "Golden plate coral garden",
    "Basalt chimneys and lavender reef",
    "Fan coral and sandstone canyon",
  ];
  function coralGarden(g, seed, count = 7) {
    for (let i = 0; i < count; i++) {
      const x = Math.sin(i * 2.399 + seed) * (22 + i * 3),
        z = 16 + Math.cos(i * 1.73 + seed) * 19,
        h = 3 + ((i * 7 + seed * 3) % 10);
      const color = coral[(i + seed) % coral.length];
      if ((i + seed) % 3 === 0) {
        mesh("cylinder", color, g, [x, h / 2, z], [1.7, h, 1.7]);
        for (let plate = 0; plate < 3; plate++)
          mesh(
            "sphere",
            color,
            g,
            [x + plate * 0.7, h * (0.45 + plate * 0.22), z],
            [6 - plate, 0.7, 4.5 - plate * 0.5],
          );
      } else {
        for (let branch = 0; branch < 3 + (i % 3); branch++) {
          const tip = [
            x + Math.sin(branch * 2.4) * 4,
            h + (branch % 2) * 3,
            z + Math.cos(branch * 2.4) * 2,
          ];
          tube(g, [x, 0, z], tip, 0.55, color);
          mesh("sphere", color, g, tip, [2.7, 1.3, 1.5]);
        }
      }
    }
  }
  for (let s = 0; s < track.SECTIONS.length; s++) {
    const side = s % 2 ? 1 : -1,
      wet = s >= 1 && s <= 4,
      habitat = s - 1;
    place(
      s,
      0.28 + (s % 3) * 0.035,
      side,
      wet
        ? habitatNames[habitat]
        : s === 0
          ? "Coastal mangrove reef shelf"
          : "Open seagrass and coral shoal",
      (g) => {
        for (let i = 0; i < 2 + (s % 2); i++) {
          const h = wet ? 16 + ((s * 17 + i * 13) % 27) : 32 + i * 18;
          rock(
            s + i,
            reef[(s + i) % reef.length],
            g,
            [-45 + i * 51, h / 2 - 8, -35 - i * 13],
            [72 + i * 19, h, 68 + (s % 3) * 11],
          ).rotation.y = s * 0.77 + i * 1.9;
        }
        if (habitat === 0 || !wet) {
          const blades = new THREE.PlaneGeometry(1, 1, 2, 12);
          const p = blades.attributes.position;
          for (let i = 0; i < p.count; i++) {
            const height = p.getY(i) + 0.5;
            p.setX(i, p.getX(i) * (0.6 + Math.sin(height * 7) * 0.2) + Math.sin(height * 5) * 0.28);
            p.setZ(i, Math.sin(height * 8) * 0.16);
          }
          blades.translate(0, 0.5, 0);
          blades.computeVertexNormals();
          for (let i = 0; i < 15; i++) {
            const plant = kelp[i % kelp.length];
            plant.side = THREE.DoubleSide;
            const blade = b.kit.mesh(
              blades,
              plant,
              g,
              [-58 + i * 8.4, 0, 7 + Math.sin(i * 1.9) * 18],
              [4, 11 + ((i * 7) % 21), 4],
            );
            blade.castShadow = false;
            blade.rotation.y = i * 2.399;
          }
        } else if (habitat === 2) {
          for (let i = 0; i < 4; i++) {
            const h = 15 + i * 6,
              x = -42 + i * 27;
            rock(
              i + 1,
              reef[2],
              g,
              [x, h / 2, 12 + (i % 2) * 16],
              [13 + (i % 2) * 6, h, 15],
            ).rotation.y = i;
            mesh("ring", coral[2], g, [x, h - 2, 12 + (i % 2) * 16], [4, 4, 4]).rotation.x =
              Math.PI / 2;
          }
        }
        coralGarden(g, s, habitat === 1 ? 11 : 5);
        if (wet && habitat !== 2) {
          const school = group(g, [0, 25 + (s % 2) * 7, 34]);
          for (let i = 0; i < 9 + s; i++) {
            const animal = group(school, [
              Math.sin(i * 2.399) * (12 + i * 2.5),
              Math.cos(i * 1.7) * 5,
              Math.sin(i * 0.8) * 13,
            ]);
            const size = 0.8 + (i % 4) * 0.25;
            mesh(
              "sphere",
              fish[i % fish.length],
              animal,
              [0, 0, 0],
              [2.4 * size, size, 0.7 * size],
            );
            mesh(
              "roof",
              fish[i % fish.length],
              animal,
              [-2.5 * size, 0, 0],
              [1.8 * size, 1.8 * size, 0.3],
            ).rotation.z = Math.PI / 2;
          }
          const baseY = school.position.y;
          motion(school, (time) => {
            school.position.x = Math.sin(time * 0.04 + s) * 15;
            school.position.y = baseY + Math.sin(time * 0.16 + s) * 2;
          });
        }
      },
      { distance: 220 + (s % 3) * 18, floor: wet ? -55 : -30, padding: wet ? 20 : 3 },
    );
    const landmark = [
      "Island palm house",
      "Collapsed conservatory wall and reef",
      "Coral reclaimed shipwreck",
      "Weathered underwater arch and canyon",
      "Sunken column garden",
      "Low botanical island terraces",
      "Coastal observatory glasshouse",
    ];
    place(
      s,
      0.72,
      -side,
      landmark[s],
      (g) => {
        if (s === 2) {
          downloaded("background:shipwreck", g, [0, -2, 0], [95, 28, 53]).rotation.y = -0.4;
          coralGarden(g, 2, 5);
        } else if (wet) {
          if (s === 1) {
            box(stone, g, [0, 11, -8], [76, 22, 5]);
            for (let i = 0; i < 4; i++)
              box(frame, g, [-30 + i * 20, 23 + (i % 2) * 7, -8], [2, 15, 2]);
          } else if (s === 3) {
            for (const x of [-13, 13]) rock(s, stone, g, [x, 13, 0], [8, 26, 11]);
            mesh("ring", stone, g, [0, 25, 0], [17, 15, 5]);
            rock(0, reef[0], g, [-48, 24, -30], [38, 50, 55]);
            rock(2, reef[1], g, [48, 18, -20], [40, 40, 46]);
          } else {
            for (let i = 0; i < 6; i++) {
              const h = 8 + (i % 3) * 7;
              const column = mesh(
                "cylinder",
                stone,
                g,
                [-45 + i * 18, h / 2, (i % 2) * 16],
                [3, h, 3],
              );
              column.rotation.z = (i % 2 ? -1 : 1) * 0.13;
            }
          }
          coralGarden(g, s + 1, 7);
        } else {
          rock(s, sand, g, [0, 7, 0], [135, 32, 100]);
          const width = s === 5 ? 38 : 52;
          box(stone, g, [0, 17, 0], [width, 18, 40]);
          if (s === 5) {
            for (const x of [-19, 19]) {
              box(stone, g, [x, 31, 0], [21, 10, 28]);
              mesh("roof", frame, g, [x, 36, 0], [25, 12, 32]);
            }
          } else {
            mesh("sphere", glass, g, [0, 25, 0], [25, s === 0 ? 27 : 18, 23]);
            for (const angle of [0, Math.PI / 3, (Math.PI * 2) / 3]) {
              const rib = mesh("ring", frame, g, [0, 25, 0], [25, s === 0 ? 27 : 18, 23]);
              rib.rotation.y = angle;
            }
          }
          for (const x of [-11, 11]) {
            tube(g, [x, 21, 0], [x, 40, 0], 0.7, frame);
            mesh("sphere", kelp[s % kelp.length], g, [x, 39, 0], [7, 9, 7]);
          }
        }
      },
      { distance: 240 + (s % 2) * 25, floor: wet ? -55 : -10 },
    );
  }
}
