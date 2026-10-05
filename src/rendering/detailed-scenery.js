import * as THREE from "../../vendor/three/three.module.js";
import { createCourseKit, batchScenery } from "./course-kit.js";
import { createContactShadowMesh } from "./visual-effects.js";

export function addDetailedScenery(scene, track, assets) {
  if (!assets?.models?.painted_wooden_bench) return;
  const root = new THREE.Group();
  root.name = "Downloaded textured scenery";
  scene.add(root);
  const kit = createCourseKit(root, track, assets),
    city = track.course.id === "neon-harbor";
  // Use a few high-detail imported props at focal places instead of filling
  // the whole lap with unique expensive assets. Every footprint clears rails.
  const stops = city
    ? [
        [0, 0.18],
        [0, 0.64],
        [1, 0.2],
        [5, 0.8],
      ]
    : track.course.id === "frostpeak-festival"
      ? [
          [0, 0.18],
          [0, 0.61],
          [2, 0.7],
        ]
      : track.course.id === "sunstone-ruins"
        ? [
            [0, 0.15],
            [0, 0.77],
            [3, 0.3],
          ]
        : [
            [0, 0.19],
            [0, 0.72],
            [2, 0.64],
            [5, 0.77],
          ];
  for (const [sector, fraction] of stops) {
    const t = track.sectorT(sector, fraction),
      offset = track.surfaceAt(t).leftEdge - 6;
    const g = kit.safeGroup(t, offset, 2.8);
    if (!g) continue;
    g.rotation.y += Math.PI / 2;
    const shadow = createContactShadowMesh({ width: 3.6, depth: 2.5, opacity: 0.24 });
    shadow.position.y = 0.03;
    g.add(shadow);
    kit.asset("painted_wooden_bench", g, [0, 0, 0], [1.25, 1.25, 1.25]);
    if (city && kit.hasAsset("planter_box_01"))
      kit.asset("planter_box_01", g, [0, 0, 3.2], [1.1, 1.1, 1.1]);
  }
  if (city)
    for (const [sector, fraction] of [
      [0, 0.08],
      [0, 0.45],
      [1, 0.8],
      [5, 0.81],
    ]) {
      const t = track.sectorT(sector, fraction),
        g = kit.safeGroup(t, track.surfaceAt(t).leftEdge - 3.5, 1.4);
      if (!g) continue;
      kit.asset("street_lamp_02", g, [0, 0, 0], [2.3, 2.3, 2.3]);
    }
  batchScenery(root);
}
