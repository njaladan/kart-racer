import { marineCaustics } from "../adventure/pelagic-materials.js";

/** An abundant reef garden, with moving fish and translucent jellyfish lamps. */
export function pelagicArt(w) {
  const { THREE, scene, track, mat, safe, at, asset, mesh, motion, lamp, beam, particles } = w;
  const reef = mat("#86aaa0", "rock"),
    seaweed = mat("#539777", "rock");
  marineCaustics(reef, scene);
  const glass = new THREE.MeshStandardMaterial({
    color: "#9bf6e0",
    emissive: "#49cba9",
    emissiveIntensity: 0.32,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide,
    roughness: 0.24,
  });
  const tentacle = new THREE.MeshBasicMaterial({
    color: "#b4f3e2",
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  for (let section = 0; section < track.SECTIONS.length; section++) {
    for (let i = 0; i < 15; i++) {
      const side = i % 2 ? 1 : -1,
        g = safe(section, (i + 0.5) / 15, side * (33 + (i % 4) * 11), 10);
      if (!g) continue;
      const floor = track.course.theme.groundHeight;
      const rock = asset(
        "rock-largee",
        g,
        [0, floor - g.position.y, 0],
        [17, g.position.y + 5 - floor, 17],
      );
      if (rock)
        rock.traverse((m) => {
          if (m.isMesh) m.material = reef;
        });
      asset("reef-fern", g, [0, 2, 0], 8 + (i % 4) * 3);
      asset("reef-grass", g, [side * 7, 1, 4], 4);
      asset("plant-bushdetailed", g, [side * 4, 1, -5], 4);
      asset("flower-purplec", g, [-side * 5, 3, -5], 4);
      if (i % 3 === 0) {
        const kelp = asset("hanging-moss", g, [0, 12, 0], [5, 12, 5]);
        if (kelp) {
          kelp.traverse((m) => {
            if (m.isMesh) m.material = seaweed;
          });
          motion(kelp, (time) => {
            kelp.rotation.z = Math.sin(time * 0.55 + i) * 0.075;
          });
        }
        lamp(g, [0, 5, 0], "#82e9d2", 22, 16);
      }
    }
    if (section === 0 || section === 5) continue;
    for (let school = 0; school < 3; school++) {
      const g = at(section, 0.2 + school * 0.28, school % 2 ? 48 : -48);
      g.rotation.set(0, track.yawFor(track.frameAt(track.sectorT(section, 0.5)).tangent), 0);
      g.position.y = Math.min(g.position.y, -12);
      g.name = "Submerged imported fish school";
      const origin = g.position.clone(),
        axis = track.frameAt(track.sectorT(section, 0.5)).tangent;
      for (let j = 0; j < 7; j++) {
        const fish = asset(
          "fish",
          g,
          [(j % 3) * 3 - 3, 4 + (j % 3), j * 2 - 6],
          1.4 + (j % 2) * 0.3,
        );
        if (fish) fish.rotation.y = Math.PI / 2;
      }
      motion(g, (time) => {
        g.position.copy(origin).addScaledVector(axis, Math.sin(time * 0.15 + school) * 14);
        g.position.y += Math.sin(time * 0.6 + school) * 1.1;
      });
    }
    for (let i = 0; i < 3; i++) {
      const g = at(section, 0.2 + i * 0.27, i % 2 ? 28 : -28);
      g.rotation.set(0, 0, 0);
      g.position.y = Math.min(g.position.y + 14 + i * 2, -7);
      g.name = "Submerged glowing jellyfish";
      mesh(new THREE.SphereGeometry(2.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass, g);
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * Math.PI * 2;
        const points = Array.from(
          { length: 7 },
          (_, k) =>
            new THREE.Vector3(
              Math.cos(a) * (1.7 + k * 0.08) + Math.sin(k * 0.9) * 0.3,
              -k * 0.9,
              Math.sin(a) * 1.7,
            ),
        );
        mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, 0.045, 4, false),
          tentacle,
          g,
        ).castShadow = false;
      }
      const y = g.position.y;
      motion(g, (time) => {
        g.position.y = y + Math.sin(time * 0.65 + i) * 1.6;
        g.rotation.y = Math.sin(time * 0.2 + i) * 0.3;
      });
      lamp(g, [0, 0, 0], "#89efd8", 20, 14);
    }
    const shaft = at(section, 0.5, -12);
    beam(shaft, [0, 38, 0], "#a7f5df", 40, 12, -0.23);
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2,
      g = new THREE.Group();
    w.scenery.add(g);
    g.position.set(Math.sin(a) * 400, -48, Math.cos(a) * 400);
    const wall = asset("rock-largee", g, [0, 0, 0], [85, 75 + (i % 4) * 20, 85]);
    if (wall)
      wall.traverse((m) => {
        if (m.isMesh) {
          m.material = reef;
          m.castShadow = false;
        }
      });
  }
  particles({
    color: "#bdfff1",
    style: "bubble",
    count: 400,
    size: 0.35,
    height: 22,
    waterCeiling: -1,
    sections: [1, 2, 3, 4],
    speed: 0.5,
    offset: 10,
  });
  particles({
    waterCeiling: -1,
    sections: [1, 2, 3, 4],
    color: "#73f0d0",
    style: "star",
    count: 260,
    size: 0.15,
    height: 16,
    speed: 0.35,
  });
}
