/** Freight valley: a railway embedded in layered fir forests and misty crags. */
export function railstormArt(w) {
  const { THREE, track, mat, safe, at, asset, box, motion, lamp, beam, particles } = w;
  const iron = mat("#627179", "metal", { metalness: 0.55, roughness: 0.48 });
  const blue = mat("#566e86", "rock");
  for (let section = 0; section < track.SECTIONS.length; section++) {
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1,
        g = safe(section, (i + 0.5) / 16, side * (48 + (i % 4) * 16), 14);
      if (!g) continue;
      g.position.y = track.course.theme.groundHeight;
      asset("fir", g, [0, 0, 0], 25 + (i % 5) * 5);
      asset("fern", g, [-side * 8, 3, -6], 4);
      if (i % 4 === 0) {
        asset("rock-tallb", g, [side * 16, -9, 5], [22, 38, 26]);
        asset("log-stacklarge", g, [-side * 9, 0, -8], 5);
      }
    }
    for (let i = 0; i < 4; i++) {
      const g = safe(section, 0.18 + i * 0.21, 34, 8);
      if (!g) continue;
      const height = g.position.y - track.course.theme.groundHeight;
      box(iron, g, [0, -height / 2, 0], [10, height, 10]);
      asset(i % 2 ? "barrels" : "machine-generatorlarge", g, [0, 0, 0], 4 + (i % 2) * 2);
      box(iron, g, [0, 7, -4], [0.4, 14, 0.4]);
      lamp(g, [0, 13, -4], "#ffc481", 32, 40);
      if (i % 2 === 0) beam(g, [0, 14, -4], "#f7d1a0", 28, 7);
    }
  }
  // An independent distant freight train moves through its own wooded corridor.
  const line = at(2, 0.5, 360);
  line.position.y -= 20;
  line.rotation.set(0, track.yawFor(track.frameAt(track.sectorT(2, 0.5)).tangent), 0);
  const bridge = at(2, 0.5, 360);
  bridge.position.copy(line.position);
  bridge.rotation.copy(line.rotation);
  const foot = line.position.y - track.course.theme.groundHeight;
  box(iron, bridge, [0, -0.7, 66], [12, 1, 390]);
  for (const side of [-1, 1]) box(iron, bridge, [side * 3, -0.1, 66], [0.3, 0.3, 390]);
  for (let z = -110; z <= 240; z += 35) box(iron, bridge, [0, -foot / 2, z], [5, foot, 6]);
  for (let i = 0; i < 7; i++) {
    const car = asset("monorail-traincargo", line, [0, 0, i * 22], 8);
    if (car) car.rotation.y = Math.PI;
  }
  const origin = line.position.clone(),
    axis = track.frameAt(track.sectorT(2, 0.5)).tangent.clone().setY(0).normalize();
  motion(line, (time) => {
    line.position.copy(origin).addScaledVector(axis, Math.sin(time * 0.045) * 70);
  });
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2,
      g = new THREE.Group();
    w.scenery.add(g);
    g.position.set(Math.sin(a) * 570, -80, Math.cos(a) * 570);
    const crag = asset("rock-tallb", g, [0, 0, 0], [100, 150 + (i % 5) * 18, 85]);
    if (crag)
      crag.traverse((m) => {
        if (m.isMesh) {
          m.material = blue;
          m.castShadow = false;
        }
      });
  }
  particles({ color: "#e1e8d5", count: 290, size: 0.2, height: 22, speed: 0.45 });
  particles({
    color: "#ffcc78",
    style: "star",
    count: 100,
    size: 0.2,
    height: 6,
    sections: [1, 3, 5],
  });
}
