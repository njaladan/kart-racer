/** Monumental ice, an airy summit deck and a snow-dragon downhill landmark. */
export function buildMountainWonders({ THREE, scene, scenery, track, festival }) {
  const {
    palette: p,
    geometry: geo,
    mesh,
    box,
    beam,
    groupAt,
    landAt,
    safeGroup,
    edgeOffset,
    sectorT,
    lantern,
    asset,
    pole,
  } = festival;
  const iceDark = festival.material("#608aba", { map: p.ice.map, roughness: 0.45 });
  const iceLight = festival.material("#caf0ff", {
    map: p.ice.map,
    roughness: 0.28,
    metalness: 0.12,
  });
  const shard = festival.authoredGeometry(
    "blender:glacier-cluster",
    new THREE.CylinderGeometry(0.4, 1, 1, 6, 3),
  );
  const icicle = new THREE.ConeGeometry(1, 1, 5);
  function arch(section, fraction, height, ice = false) {
    const t = sectorT(section, fraction),
      g = groupAt(t);
    g.name = ice ? "Glacier vault with suspended frost teeth" : "Fallen snow pine gateway";
    const half = Math.max(-track.surfaceAt(t).leftEdge, track.surfaceAt(t).rightEdge) + 4;
    for (const side of [-1, 1]) {
      const mat = ice ? p.ice : p.bark;
      mesh(
        geo.cylinder,
        mat,
        g,
        [side * half, height * 0.43, 0],
        [ice ? 2.3 : 1.3, height * 0.86, ice ? 2.8 : 1.3],
      );
      beam(
        g,
        [side * half, height * 0.75, 0],
        [side * half * 0.5, height, 0],
        ice ? 2.2 : 1.2,
        mat,
      );
      if (!ice)
        for (let i = 0; i < 4; i++)
          beam(
            g,
            [side * half, 1, 0],
            [side * (half + 2 + i * 0.7), 0.2, (i - 1.5) * 2],
            0.45,
            p.bark,
          );
    }
    beam(
      g,
      [-half * 0.55, height, 0],
      [half * 0.55, height, 0],
      ice ? 2.4 : 1.3,
      ice ? iceLight : p.bark,
    );
    if (!ice) beam(g, [-half * 0.55, height + 1, 0], [half * 0.55, height + 1, 0], 1.25, p.snow);
    for (let i = -4; i <= 4; i++) {
      const length = ice ? 1.1 + Math.abs(Math.sin(i * 9.1)) * 2 : 0.5;
      const m = mesh(
        icicle,
        ice ? iceLight : p.gold,
        g,
        [(i * half) / 6, height - length * 0.5 - 1, 0],
        [ice ? 0.38 : 0.18, length, ice ? 0.38 : 0.18],
      );
      m.rotation.z = Math.PI;
    }
  }
  arch(1, 0.26, 15);
  arch(2, 0.22, 20, true);
  arch(2, 0.73, 22, true);
  for (let i = 0; i < 17; i++)
    for (const side of [-1, 1]) {
      const t = sectorT(2, (i + 0.3) / 17);
      const height = 15 + Math.sin(i * 1.91) * 6 + (i % 3) * 5;
      const width = 3.2 + (i % 3) * 0.7;
      const g = safeGroup(t, edgeOffset(t, side, width + 2.3), width + 0.5);
      if (!g) continue;
      g.name = "Faceted glacier organ pipes";
      const m = mesh(
        shard,
        i % 3 ? p.ice : iceDark,
        g,
        [0, height / 2, 0],
        [width, height, width * 1.2],
      );
      m.rotation.y = i * 2.4;
      m.rotation.z = side * (0.04 + (i % 2) * 0.07);
      mesh(
        shard,
        iceLight,
        g,
        [side * width * 0.7, height * 0.25, 1.1],
        [width * 0.4, height * 0.45, width * 0.7],
      );
      mesh(geo.sphere, p.snow, g, [0, 0.45, 0], [width * 1.1, 0.7, width * 1.3]);
      for (let j = 0; j < 3; j++) {
        const tooth = mesh(
          icicle,
          iceLight,
          g,
          [j * 0.8 - 0.8, height * 0.8, -width * 0.4],
          [0.24, 2.5 + j, 0.24],
        );
        tooth.rotation.z = Math.PI;
      }
    }

  // The road is a real timber overlook: repeated joists, exposed supports and
  // snow-capped huts sit under/around its continuous driveable surface.
  for (let i = 0; i < 26; i++) {
    const t = sectorT(3, 0.05 + (i / 26) * 0.86),
      g = groupAt(t);
    box(p.timber, g, [0, -0.55, 0], [20, 0.8, 1.1]);
    for (const side of [-1, 1]) {
      box(p.dark, g, [side * 7.8, -5, 0], [0.6, 9.5, 0.6]);
      if (i % 2 === 0) beam(g, [side * 7.8, -7, -2], [side * 7.8, -1, 2], 0.25, p.timber);
    }
  }
  const summit = landAt(sectorT(3, 0.4), edgeOffset(sectorT(3, 0.4), -1, 19));
  summit.name = "Cloudcap open festival pavilion";
  const summitLift = track.frameAt(sectorT(3, 0.4)).p.y - summit.position.y - 0.8;
  summit.position.y += summitLift;
  mesh(geo.cylinder, p.rock, summit, [0, -summitLift * 0.5, 0], [14, Math.max(1, summitLift), 14]);
  const roof = new THREE.ConeGeometry(1, 1, 8);
  mesh(geo.cylinder, p.timber, summit, [0, 0.4, 0], [13, 0.8, 13]);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      x = Math.sin(a) * 9,
      z = Math.cos(a) * 9;
    box(p.timber, summit, [x, 4.7, z], [0.4, 8.6, 0.4]);
    lantern(summit, [x, 6.5, z], 1.25);
    beam(summit, [x, 8.8, z], [0, 11.8, 0], 0.25);
  }
  mesh(roof, p.red, summit, [0, 10.5, 0], [14, 5, 14]);
  mesh(roof, p.snow, summit, [0, 11.7, 0], [10, 3.3, 10]);
  pole(summit, -11, 0, 6, 6);
  pole(summit, 11, 0, 6, 6);
  for (let i = 0; i < 7; i++)
    asset("kenney:holiday-kit/present", summit, [-6 + i * 2, 0.85, -6], [1.1, 1.1, 1.1]);

  const moving = new THREE.Group();
  scene.add(moving);
  moving.userData.skipBake = true;
  const ornament = new THREE.Group();
  moving.add(ornament);
  ornament.position.copy(summit.position);
  ornament.position.y += 16;
  const snowflake = new THREE.Group();
  ornament.add(snowflake);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const tip = [Math.cos(a) * 5, Math.sin(a) * 5, 0];
    beam(snowflake, [0, 0, 0], tip, 0.15, p.gold);
    for (const sign of [-1, 1]) {
      const branch = a + sign * 0.7;
      beam(
        snowflake,
        [Math.cos(a) * 3.1, Math.sin(a) * 3.1, 0],
        [Math.cos(a) * 3.1 + Math.cos(branch) * 1.6, Math.sin(a) * 3.1 + Math.sin(branch) * 1.6, 0],
        0.12,
        p.gold,
      );
    }
  }
  const wheelT = sectorT(3, 0.83),
    wheelBase = safeGroup(wheelT, edgeOffset(wheelT, -1, 30), 12);
  let wheel = null;
  if (wheelBase) {
    wheelBase.name = "Summit snowflake observation wheel";
    const wheelLift = track.frameAt(wheelT).p.y - wheelBase.position.y - 0.8;
    wheelBase.position.y += wheelLift;
    mesh(
      geo.cylinder,
      p.rock,
      wheelBase,
      [0, -wheelLift * 0.5, 0],
      [12, Math.max(1, wheelLift), 12],
    );
    for (const side of [-1, 1]) beam(wheelBase, [side * 6, 0, 0], [0, 14, 0], 0.55, p.timber);
    wheel = new THREE.Group();
    moving.add(wheel);
    wheel.position.copy(wheelBase.position);
    wheel.position.y += 14;
    wheel.rotation.y = wheelBase.rotation.y;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        b = ((i + 1) * Math.PI) / 6;
      beam(
        wheel,
        [Math.cos(a) * 10, Math.sin(a) * 10, 0],
        [Math.cos(b) * 10, Math.sin(b) * 10, 0],
        0.2,
        p.cyan,
      );
      beam(wheel, [0, 0, 0], [Math.cos(a) * 10, Math.sin(a) * 10, 0], 0.1, p.cream);
      mesh(geo.sphere, p.gold, wheel, [Math.cos(a) * 10, Math.sin(a) * 10, 0], [0.65, 0.65, 0.65]);
    }
  }

  // This dragon is a festival snow sculpture on the hill, beyond the trick lane.
  const dragonT = sectorT(4, 0.24),
    dragon = safeGroup(dragonT, edgeOffset(dragonT, 1, 17), 9);
  if (dragon) {
    dragon.name = "Snow dragon watching its namesake descent";
    for (let i = 0; i < 8; i++) {
      const a = (i / 7) * Math.PI * 1.3;
      mesh(
        geo.sphere,
        p.snow,
        dragon,
        [Math.sin(a) * 8, 2 + i * 0.6, Math.cos(a) * 5],
        [3.6 - i * 0.22, 2.8 - i * 0.16, 3.3 - i * 0.18],
      );
      mesh(
        geo.cone,
        p.ice,
        dragon,
        [Math.sin(a) * 8, 5 + i * 0.45, Math.cos(a) * 5],
        [0.8, 1.8, 0.8],
      );
    }
    mesh(geo.sphere, p.snow, dragon, [0, 10, 6], [4.2, 3.2, 3.3]);
    mesh(geo.sphere, p.snow, dragon, [0, 9.2, 9], [3.1, 1.9, 2.8]);
    for (const side of [-1, 1]) {
      mesh(geo.sphere, p.dark, dragon, [side * 2.5, 11, 7.5], [0.35, 0.45, 0.35]);
      mesh(geo.cone, p.ice, dragon, [side * 2.2, 13.5, 4.7], [0.7, 3, 0.7]);
    }
  }
  // Frozen waterfall backed by rock: a long-distance silhouette you approach.
  const waterfallT = sectorT(4, 0.61),
    fall = safeGroup(waterfallT, edgeOffset(waterfallT, 1, 43), 20);
  if (fall) {
    asset("frostpeak:snow-rock", fall, [0, -8, 0], [38, 47, 27]);
    for (let i = 0; i < 11; i++) {
      const height = 20 + Math.sin(i * 2.1) * 5;
      mesh(shard, i % 2 ? p.ice : iceLight, fall, [-12 + i * 2.3, 8, -7], [1.8, height, 2.3]);
      mesh(geo.sphere, p.snow, fall, [-12 + i * 2.3, -3, -9], [3.1, 1, 3.5]);
    }
  }
  return {
    animated: [moving],
    update(time) {
      ornament.rotation.y = time * 0.18;
      ornament.rotation.z = Math.sin(time * 0.5) * 0.12;
      if (wheel) wheel.rotation.z = time * 0.055;
    },
  };
}
