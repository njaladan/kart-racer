import { worldKit } from "./world-kit.js";
import { registerLightPool } from "../../rendering/course-lighting.js";
import { glasshouseWater, marineCaustics } from "./pelagic-materials.js";

/** A conservatory reclaimed by the sea: glass ribs, reef terraces and living water. */
export function buildPelagic(context) {
  const w = worldKit(context),
    { THREE, scene, track, mat, mesh, box, at, motion, sphere, cylinder, torus, tube } = w;
  const ivory = mat("#dbe9cd"),
    brass = mat("#bdab79", "metal", { metalness: 0.5 }),
    teal = mat("#4d8f90", "metal"),
    sand = mat("#cfbca0", "sand"),
    leaves = mat("#539882", "leaves"),
    pink = mat("#db92a6", "rock"),
    lavender = mat("#9b9ed0", "rock"),
    glow = mat("#b9f4dd", "glass", { emissive: "#87dec9", emissiveIntensity: 0.6 }),
    glass = mat("#b8e1db", "glass", {
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      side: THREE.DoubleSide,
      roughness: 0.2,
    });
  for (const m of [sand, pink, lavender, ivory, brass, teal, leaves]) marineCaustics(m, scene);
  const sea = mesh(new THREE.PlaneGeometry(1600, 1600), glasshouseWater(scene), w.scenery);
  const kelpBlade = context.kit.authoredGeometry("blender:kelp-leaf", sphere);
  const coralCluster = context.kit.authoredGeometry("blender:reef-coral", [11.4, 6.5, 3]);
  sea.name = "Pelagic water surface";
  sea.rotation.x = -Math.PI / 2;
  sea.castShadow = false;
  scene.userData.waterLevel = 0;
  // The underwater road has broad reef terraces instead of a featureless seabed.
  for (let section = 1; section <= 4; section++) {
    w.sweep(
      section,
      0,
      1,
      (t) => track.platformEdgeAt(t, -1),
      (t) => track.platformEdgeAt(t, 1),
      sand,
      -0.22,
    );
    for (const side of [-1, 1])
      for (let i = 0; i < 11; i++) {
        const t = track.sectorT(section, (i + 0.5) / 11),
          g = w.groupAt(t, side * (28 + (i % 3) * 8));
        mesh(w.rock, i % 3 ? sand : lavender, g, [0, -4, 0], [12, 9 + (i % 3) * 2, 12]);
      }
  }
  // Hemispherical glasshouses straddle the entire flooded and dry expedition.
  function dome(section, fraction, radius) {
    const g = at(section, fraction),
      cap = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    mesh(cap, glass, g, [0, -3, 0], [radius, radius * 0.85, radius]).castShadow = false;
    mesh(torus, brass, g, [0, -3, 0], [radius, radius, radius]).rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const rib = mesh(
        new THREE.TorusGeometry(1, 0.012, 5, 30, Math.PI),
        i % 3 ? ivory : brass,
        g,
        [0, -3, 0],
        [radius, radius * 0.85, radius],
      );
      rib.rotation.y = (i / 12) * Math.PI;
    }
    for (const h of [0.3, 0.58, 0.8]) {
      const r = radius * Math.sqrt(1 - h * h);
      mesh(torus, brass, g, [0, -3 + radius * 0.85 * h, 0], [r, r, r]).rotation.x = Math.PI / 2;
    }
    box(glow, g, [0, radius * 0.84, 0], [3, 2, 3]);
    g.updateWorldMatrix(true, false);
    registerLightPool(scene, {
      position: g.localToWorld(new THREE.Vector3(0, 18, 0)),
      color: "#a5e8d7",
      intensity: 40,
      radius: radius * 1.1,
    });
  }
  dome(0, 0.45, 63);
  dome(1, 0.55, 55);
  dome(2, 0.5, 72);
  dome(4, 0.5, 57);
  dome(5, 0.45, 66);
  // Ribbed galleries carry visual continuity between the great domes.
  for (let section = 0; section < 6; section++)
    for (let i = 0; i < 7; i++) {
      const g = at(section, (i + 0.5) / 7),
        radius = 21;
      mesh(
        new THREE.TorusGeometry(1, 0.022, 6, 28, Math.PI),
        ivory,
        g,
        [0, 1, 0],
        [radius, 23, radius],
      );
      for (const side of [-1, 1]) box(brass, g, [side * radius, 0.2, 0], [2, 0.5, 4]);
    }
  function plant(parent, size, phase, underwater) {
    const g = new THREE.Group();
    parent.add(g);
    g.scale.setScalar(size);
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * Math.PI * 2,
        height = 7 + (j % 3) * 3,
        blade = new THREE.Group();
      g.add(blade);
      blade.rotation.y = a;
      tube(blade, [0, 0, 0], [1.2, height, 0], 0.12, leaves);
      for (let k = 0; k < 4; k++) {
        const leaf = mesh(
          kelpBlade,
          underwater ? leaves : teal,
          blade,
          [1 + k * 0.4, 2 + k * 2, 0],
          [2.2, 0.2, 1.1],
        );
        leaf.rotation.z = -0.3 + k * 0.2;
      }
      context.kit.batch(blade);
      motion(blade, (time) => {
        blade.rotation.z = Math.sin(time * 0.7 + phase + j) * (underwater ? 0.12 : 0.035);
      });
    }
    return g;
  }
  // Reef clusters have a repeated botanical grammar, varied silhouettes and life.
  for (const section of [1, 2, 3, 4])
    for (let i = 0; i < 12; i++) {
      const g = at(
        section,
        0.04 + i * 0.081,
        (i % 2 ? 1 : -1) *
          (Math.max(
            20,
            Math.abs(
              i % 2
                ? track.surfaceAt(track.sectorT(section, 0.04 + i * 0.081)).rightEdge
                : track.surfaceAt(track.sectorT(section, 0.04 + i * 0.081)).leftEdge,
            ) + 9,
          ) +
            (i % 3) * 6),
      );
      if (i % 3 === 0) plant(g, 1.1, i + section, true);
      else mesh(coralCluster, i % 2 ? pink : lavender, g, [0, 3.25, 0]);
      for (let j = 0; j < 3; j++)
        mesh(sphere, i % 2 ? teal : lavender, g, [-3 + j * 3, 0.6, 5], [1.2, 0.7, 1.2]);
    }
  const fishBody = new THREE.SphereGeometry(1, 8, 5),
    tailGeo = new THREE.BufferGeometry();
  tailGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0, -1, 1, 0, -1, -1, 0], 3),
  );
  tailGeo.setIndex([0, 1, 2]);
  tailGeo.computeVertexNormals();
  const fishGold = mat("#f0c46e", "stone", { side: THREE.DoubleSide }),
    fishBlue = mat("#79c9d0", "stone", { side: THREE.DoubleSide });
  for (let school = 0; school < 12; school++) {
    const g = at(1 + (school % 4), 0.15 + (school % 3) * 0.3, school % 2 ? 29 : -29),
      group = new THREE.Group();
    g.rotation.set(0, track.yawFor(track.frameAt(track.sectorT(1 + (school % 4), 0.5)).tangent), 0);
    g.position.y = Math.min(g.position.y, -16);
    group.name = "Submerged fish school";
    g.add(group);
    for (let i = 0; i < 12; i++) {
      const x = (i % 4) * 2.5,
        y = 5 + Math.floor(i / 4) * 2;
      if (context.kit.hasAsset("art:fish")) {
        context.kit.asset("art:fish", group, [x, y, (-i % 3) * 3], [1.3, 1.3, 1.3]);
        continue;
      }
      mesh(
        fishBody,
        school % 2 ? fishGold : fishBlue,
        group,
        [x, y, (-i % 3) * 3],
        [1.1, 0.65, 0.35],
      );
      mesh(
        tailGeo,
        school % 2 ? fishGold : fishBlue,
        group,
        [x - 1, y, (-i % 3) * 3],
        [0.8, 0.8, 0.8],
      );
      mesh(sphere, ivory, group, [x + 0.75, y + 0.15, (-i % 3) * 3 + 0.3], [0.12, 0.12, 0.12]);
    }
    context.kit.batch(group);
    motion(group, (time) => {
      group.position.x = Math.sin(time * 0.21 + school) * 12;
      group.position.y = Math.sin(time * 0.5 + school) * 2;
      group.rotation.y = Math.sin(time * 0.21 + school) * 0.4;
    });
  }
  // Enormous suspended jellyfish are landmarks, above the readable racing line.
  const jellyMat = mat("#b6d9f0", "glass", {
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide,
    emissive: "#7caecd",
    emissiveIntensity: 0.15,
  });
  for (let i = 0; i < 7; i++) {
    const g = at(2 + (i % 2), 0.08 + (i % 4) * 0.24, (i % 2 ? 1 : -1) * 28),
      jelly = new THREE.Group();
    g.rotation.set(0, 0, 0);
    g.position.y = Math.min(g.position.y, -34);
    jelly.name = "Submerged jellyfish";
    g.add(jelly);
    jelly.position.y = 17 + (i % 2) * 7;
    mesh(
      new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
      jellyMat,
      jelly,
      [0, 0, 0],
      [7 + (i % 3), 5, 7 + (i % 3)],
    ).castShadow = false;
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2;
      for (let k = 0; k < 3; k++)
        tube(
          jelly,
          [Math.cos(a) * (5 - k), -k * 4, Math.sin(a) * (5 - k)],
          [Math.cos(a) * (4 - k), -(k + 1) * 4, Math.sin(a) * (4 - k)],
          0.1,
          glow,
        );
    }
    context.kit.batch(jelly);
    motion(jelly, (time) => {
      jelly.position.y = 17 + (i % 2) * 7 + Math.sin(time * 0.7 + i) * 2;
      jelly.rotation.y = Math.sin(time * 0.3 + i) * 0.12;
    });
  }
  // Dry garden bookends: terraced islands, palms, tiled fountains and attendants.
  for (const section of [0, 5]) {
    w.sweep(
      section,
      0,
      1,
      (t) => track.platformEdgeAt(t, -1),
      (t) => track.platformEdgeAt(t, 1),
      sand,
      -0.15,
    );
    for (let i = 0; i < 10; i++) {
      const g = at(section, 0.05 + i * 0.095, (i % 2 ? 1 : -1) * 25);
      mesh(cylinder, ivory, g, [0, 0.4, 0], [8, 0.8, 8]);
      mesh(cylinder, sand, g, [0, 0.85, 0], [7.5, 0.15, 7.5]);
      plant(g, 1.5, i, false);
      if (i % 3 === 0) {
        box(teal, g, [8, 1.4, 0], [1.4, 2.8, 1.4]);
        mesh(sphere, ivory, g, [8, 3.4, 0], [0.65, 0.65, 0.65]);
        tube(g, [8.5, 2.1, 0], [10, 2.4, 0], 0.15, ivory);
      }
      mesh(w.rock, sand, g, [0, -31, 0], [22, 33, 22]);
    }
  }
  const bubbles = w.points("#d4f9ef", [1, 2, 3, 4], 140, 0.23);
  motion(bubbles, (time) => {
    bubbles.position.y = ((time * 0.6) % 8) - 4;
    bubbles.position.x = Math.sin(time * 0.5) * 1.2;
  });
  return w.finish();
}
