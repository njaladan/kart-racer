/** Volcanic terraces meet an inhabited scientific outpost under drifting stars. */
export function emberwingArt(w) {
  const { THREE, track, mat, safe, at, asset, box, motion, lamp, beam, particles } = w;
  const basalt = mat("#696679", "rock"),
    distant = mat("#978a9d", "rock");
  for (let section = 0; section < track.SECTIONS.length; section++) {
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? 1 : -1,
        g = safe(section, (i + 0.5) / 8, side * (65 + (i % 3) * 12), 18);
      if (!g) continue;
      const floor = track.course.theme.groundHeight,
        top = 13 + (i % 3) * 8;
      const rock = asset(
        "rock-tallb",
        g,
        [0, floor - g.position.y, 0],
        [27, g.position.y + top - floor, 32],
      );
      if (rock)
        rock.traverse((m) => {
          if (m.isMesh) m.material = basalt;
        });
      asset("rock-largee", g, [side * 12, -4, 8], [19, 12, 20]);
      if ([0, 4, 6, 7].includes(section)) {
        asset("terrace-palm", g, [0, top - 1, 0], 14);
        asset("terrace-flowers", g, [8, 1, 0], 3);
        lamp(g, [0, 10, 0], "#ffd59b", 35, 30);
      } else {
        lamp(g, [0, -1, 0], "#ff884a", 30, 50);
        beam(g, [0, 15, 0], "#ffab68", 26, 6);
      }
    }
  }
  for (const section of [3, 5]) {
    for (let i = 0; i < 3; i++) {
      const g = safe(section, 0.2 + i * 0.28, -68, 15);
      if (!g) continue;
      const depth = g.position.y - track.course.theme.groundHeight;
      box(basalt, g, [0, -depth / 2, 0], [20, depth, 20]);
      const dish = asset("satellitedish-detailed", g, [0, 0, 0], 22);
      if (dish)
        motion(dish, (time) => {
          dish.rotation.y = Math.sin(time * 0.12 + i) * 0.5;
        });
      lamp(g, [0, 17, 0], "#93c4ee", 38, 28);
    }
  }
  // Large distant islands form a caldera rim, with visible gaps out to sea.
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2,
      g = new THREE.Group();
    w.scenery.add(g);
    g.position.set(Math.sin(a) * 580, -68, Math.cos(a) * 580);
    const island = asset("rock-tallb", g, [0, 0, 0], [95, 105 + (i % 5) * 16, 95]);
    if (island)
      island.traverse((m) => {
        if (m.isMesh) {
          m.material = distant;
          m.castShadow = false;
        }
      });
  }
  // Tiny slow orbital craft silhouettes are visible from the open terraces.
  for (let i = 0; i < 5; i++) {
    const g = at(3, 0.12 + i * 0.17, i % 2 ? 150 : -150);
    g.position.y = 130 + i * 9;
    const meteor = asset("meteor-detailed", g, [0, 0, 0], 3 + (i % 2));
    const origin = g.position.clone();
    motion(g, (time) => {
      g.position.x = origin.x + Math.sin(time * 0.025 + i) * 80;
      g.position.z = origin.z + Math.cos(time * 0.025 + i) * 50;
      if (meteor) meteor.rotation.y = time * 0.05;
    });
  }
  particles({
    color: "#ffb57b",
    style: "star",
    count: 340,
    size: 0.2,
    height: 25,
    speed: 0.6,
    sections: [1, 2, 3, 5],
  });
  particles({
    color: "#c9d9ff",
    count: 150,
    size: 0.11,
    height: 25,
    speed: 0.2,
    sections: [0, 4, 6, 7],
  });
}
