/** White cliff towns, blue domes, terrace gardens and a fishing harbor. */
export function buildSantorini(w) {
  const { THREE, track, mat, mesh, box, at, cylinder, sphere, tube } = w;
  const white = mat("#f3ecdf", "paving"),
    blue = mat("#347ebe", "stone"),
    cobalt = mat("#275d9a"),
    shadow = mat("#5a6480"),
    warm = mat("#ffdeb0", "stone", { emissive: "#efbb78", emissiveIntensity: 0.4 }),
    stone = mat("#8e8797", "rock"),
    leaves = mat("#68856d", "leaves"),
    wood = mat("#a07959", "wood");
  const dome = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  function house(g, width, height, depth, chapel) {
    box(white, g, [0, height / 2, 0], [width, height, depth]);
    box(white, g, [0, height + 0.3, 0], [width + 0.6, 0.6, depth + 0.6]);
    for (const x of [-width * 0.3, width * 0.3]) {
      box(cobalt, g, [x, height * 0.55, depth / 2 + 0.05], [1.5, 2.6, 0.12]);
      box(warm, g, [x, height * 0.55, depth / 2 + 0.13], [0.85, 1.9, 0.1]);
      for (const side of [-1, 1])
        box(blue, g, [x + side * 0.85, height * 0.55, depth / 2 + 0.2], [0.5, 2.7, 0.13]);
    }
    box(cobalt, g, [0, 1.8, depth / 2 + 0.1], [1.9, 3.6, 0.16]);
    if (chapel) {
      mesh(cylinder, white, g, [0, height + 2, 0], [width * 0.42, 4, width * 0.42]);
      mesh(dome, blue, g, [0, height + 4, 0], [width * 0.46, width * 0.42, width * 0.46]);
      box(white, g, [0, height + width * 0.42 + 5, 0], [0.24, 2, 0.24]);
      box(white, g, [0, height + width * 0.42 + 5.3, 0], [1, 0.24, 0.24]);
    } else {
      for (const side of [-1, 1])
        box(white, g, [(side * width) / 2, height + 1, 0], [0.3, 1.4, depth]);
      mesh(cylinder, blue, g, [width * 0.28, height + 0.6, depth * 0.25], [0.9, 1.2, 0.9]);
      mesh(sphere, leaves, g, [width * 0.28, height + 1.9, depth * 0.25], [1.4, 1.2, 1.4]);
    }
  }
  for (const section of [0, 1, 4, 6, 7]) {
    for (let i = 0; i < 14; i++) {
      const t = track.sectorT(section, (i + 0.5) / 14);
      const side = i % 2 ? 1 : -1;
      const offset = side * (track.roadHalfWidth(t) + 12 + (i % 3) * 4);
      const g = w.safe(section, (i + 0.5) / 14, offset, 8);
      if (!g) continue;
      // These are cliff terraces at the lane elevation, with retaining walls
      // down to the sea; ground-planted houses disappear beneath the route.
      g.position.y = track.poseAt(t * track.TRACK, offset, 0).p.y;
      g.name = "Whitewashed caldera terrace";
      const foundation = g.position.y + 46;
      box(stone, g, [0, -foundation / 2, 0], [19, foundation, 17]);
      box(white, g, [0, -0.15, 0], [20, 0.4, 18]);
      house(g, 9 + (i % 3), 7 + (i % 4), 8, i % 5 === 0);
      const balcony = new THREE.Group();
      g.add(balcony);
      balcony.position.set(side * -3, 0, 9);
      for (let n = 0; n < 4; n++) box(blue, balcony, [-5 + n * 3.3, 0.8, 0], [0.15, 1.6, 0.15]);
      box(blue, balcony, [0, 1.5, 0], [11, 0.12, 0.12]);
      for (let n = 0; n < 4; n++) box(white, g, [side * 7, -n * 0.3, 4 + n], [2, 0.3, 1]);
      if (section === 4) {
        for (let n = 0; n < 3; n++) {
          mesh(cylinder, blue, g, [-5 + n * 5, 0.7, 13], [1, 1.4, 1]);
          mesh(sphere, leaves, g, [-5 + n * 5, 2.1, 13], [1.9, 1.5, 1.9]);
        }
      }
    }
  }
  // Flat pergolas frame the lanes without placing roof beams in the camera path.
  for (const section of [0, 7]) {
    for (let i = 0; i < 5; i++) {
      const g = at(section, (i + 0.5) / 5, 0);
      for (const side of [-1, 1]) box(white, g, [side * 12, 7, 0], [0.7, 14, 0.7]);
      for (let n = 0; n < 5; n++) box(wood, g, [0, 15.2, n - 2], [25, 0.35, 0.25]);
      for (const side of [-1, 1]) mesh(sphere, leaves, g, [side * 11, 14.5, 0], [4, 0.5, 4]);
    }
  }
  // Obsidian vineyard: orderly terraces against irregular volcanic slopes.
  for (let i = 0; i < 12; i++) {
    const g = at(5, (i + 0.5) / 12, (i % 2 ? 1 : -1) * 24);
    box(stone, g, [0, -1, 0], [12, 2, 10]);
    for (const x of [-4, 0, 4]) {
      box(wood, g, [x, 1.5, 0], [0.18, 3, 0.18]);
      mesh(sphere, leaves, g, [x, 2, 0], [1.7, 1.2, 2.2]);
      box(shadow, g, [x, 2.3, 0], [0.06, 0.08, 9]);
    }
  }
  w.water("#568ba5", -29, 2200);
  for (let i = 0; i < 8; i++) {
    const g = at(6, (i + 0.5) / 8, 30 + (i % 3) * 5);
    g.position.y = -28.4;
    const boat = new THREE.Group();
    g.add(boat);
    mesh(
      new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      i % 2 ? blue : white,
      boat,
      [0, 0, 0],
      [2.8, 2.2, 8],
    );
    box(wood, boat, [0, 0, 0], [4.7, 0.25, 12]);
    tube(boat, [0, 0, 0], [0, 10, 0], 0.12, wood);
    const sail = mesh(new THREE.PlaneGeometry(5, 7), white, boat, [2.2, 6, 0]);
    sail.material.side = THREE.DoubleSide;
    w.motion(boat, (time) => {
      boat.position.y = Math.sin(time * 0.8 + i) * 0.35;
      boat.rotation.z = Math.sin(time * 0.65 + i) * 0.04;
    });
    const dock = at(6, (i + 0.5) / 8, 19);
    box(wood, dock, [0, -2, 0], [5, 0.5, 15]);
  }
}
