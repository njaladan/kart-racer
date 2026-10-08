import { sampleStormSea } from "../adventure/tempest-waves.js";

/** Storm coast: authored rock shelves, working boats and rays through sea spray. */
export function tempestArt(w) {
  const { THREE, scene, track, mat, safe, at, asset, box, motion, lamp, beam, particles } = w;
  const stone = mat("#82949d");
  for (let section = 0; section < track.SECTIONS.length; section++) {
    for (let i = 0; i < 9; i++) {
      const side = i % 2 ? 1 : -1;
      const g = safe(section, (i + 0.5) / 9, side * (68 + (i % 3) * 25), 24);
      if (!g) continue;
      g.position.y = -16;
      const stackHeight = 38 + (i % 4) * 11;
      const rock = asset("rock-tallb", g, [0, -14, 0], [32 + (i % 3) * 5, stackHeight, 30]);
      if (rock) rock.rotation.y = i * 1.41;
      for (let j = 0; j < 3; j++)
        asset("rock-largee", g, [side * (j * 8 - 12), 1 - j * 2, j * 12], [14, 12, 18]);
      asset("coastal-grass", g, [0, stackHeight - 15, 0], 3);
      if (section % 2 === 0 && i === 4) asset("coastal-cottage", g, [0, stackHeight - 15, 0], 14);
      scene.userData.tempestSea?.addShore(g.position.x, g.position.z, 18 + (i % 3) * 2);
    }
    const g = at(section, 0.5, section % 2 ? -125 : 125);
    g.position.y = -10;
    g.rotation.set(0, track.yawFor(track.frameAt(track.sectorT(section, 0.5)).tangent), 0);
    asset("ship-medium", g, [0, 0, 0], 17);
    const anchor = g.position.clone(),
      seaSample = {};
    motion(g, (time) => {
      sampleStormSea(anchor.x, anchor.z, time, seaSample);
      g.position.y = seaSample.height;
      const yaw = g.rotation.y,
        c = Math.cos(yaw),
        s = Math.sin(yaw);
      g.rotation.x = Math.atan2(seaSample.nx * s + seaSample.nz * c, seaSample.ny);
      g.rotation.z = -Math.atan2(seaSample.nx * c - seaSample.nz * s, seaSample.ny);
    });
    const dock = safe(section, 0.3, 42, 8);
    if (dock) {
      dock.position.y = -10;
      dock.rotation.set(0, track.yawFor(track.frameAt(track.sectorT(section, 0.3)).tangent), 0);
      box(stone, dock, [0, 0.8, 0], [8, 1.2, 12]);
      for (const x of [-3, 3])
        for (const z of [-5, 5]) box(stone, dock, [x, -20, z], [0.8, 40, 0.8]);
      box(stone, dock, [0, 3.5, 0], [0.35, 6, 0.35]);
      const boat = asset("boat-row-large", dock, [8, 0, 0], 4);
      if (boat) {
        const anchor = dock.localToWorld(new THREE.Vector3(8, 0, 0)),
          seaSample = {};
        motion(boat, (time) => {
          sampleStormSea(anchor.x, anchor.z, time, seaSample);
          boat.position.y = seaSample.height + 10;
          const yaw = dock.rotation.y,
            c = Math.cos(yaw),
            s = Math.sin(yaw);
          boat.rotation.x = Math.atan2(seaSample.nx * s + seaSample.nz * c, seaSample.ny);
          boat.rotation.z = -Math.atan2(seaSample.nx * c - seaSample.nz * s, seaSample.ny);
        });
      }
      lamp(dock, [0, 6, 0], "#ffbb70", 32, 45);
      beam(dock, [0, 12, 0], "#b9dae9", 25, 9, 0.25);
    }
  }
  // Far crags use imported silhouettes with broad aerial-perspective tint.
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const g = new THREE.Group();
    w.scenery.add(g);
    g.position.set(Math.sin(angle) * 620, -30, Math.cos(angle) * 620);
    const cliff = asset("rock-tallb", g, [0, 0, 0], [75, 95 + (i % 4) * 24, 80]);
    if (cliff)
      cliff.traverse((m) => {
        if (m.isMesh) {
          m.material = stone;
          m.castShadow = false;
        }
      });
  }
  // A distant beacon turns through the spray; its glow also enters the bake.
  const beacon = at(3, 0.6, -95);
  lamp(beacon, [0, 50, 0], "#ffc980", 90, 60);
  const ray = beam(beacon, [0, 50, 0], "#f5deaf", 140, 17, Math.PI / 2);
  motion(ray, (time) => {
    ray.rotation.y = time * 0.12;
  });
  particles({ color: "#b8ecf0", style: "star", count: 340, size: 0.22, speed: 1.4, height: 24 });
  particles({ color: "#ffe4af", count: 100, size: 0.18, height: 6, sections: [0, 2, 4, 6] });
  scene.userData.adventureArt =
    "Storm coast with rock strata, distant crags, working boats and rotating mist beams";
}
