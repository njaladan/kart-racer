import * as THREE from "../../../vendor/three/three.module.js";
import { batchStaticMeshes } from "../../rendering/visuals.js";
import { bakeVertexShade } from "../../rendering/vertex-shading.js";
import { sceneryGroundHeight } from "../../rendering/terrain-height.js";
import { TRACK, poseAt, projectTrack, surfaceAt, shortcutWidth } from "../../track/track.js";

/** Seeded spatial nature batches, procedural fallbacks, ridge rocks, and horizon. */
export function buildWindmillVegetation({
  scene,
  scenery,
  mats,
  nature,
  palette,
  primitives,
  random,
}) {
  const { leaf, pine, flower, fruit, rock, bark, cream } = palette;
  const { mesh, sphereGeo, coneGeo, cylinderGeo, sectorT } = primitives;
  function baseAt(p) {
    const surface = projectTrack(p, 0, true);
    return { surface, y: sceneryGroundHeight(surface) };
  }
  const treeBuckets = new Map(),
    fruitBuckets = new Map();
  const treeMaterial = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    vertexColors: true,
    roughness: 0.92,
  });
  const treeDummy = new THREE.Object3D();
  const treeTint = new THREE.Color();
  function instance(bucketMap, key, geometry, material, matrix, color) {
    if (!bucketMap.has(key)) bucketMap.set(key, { geometry, material, placements: [] });
    bucketMap.get(key).placements.push({ matrix: matrix.clone(), color: color.clone() });
  }
  function tree(t, offset, kind, size) {
    const p = poseAt(t * TRACK, offset, 0).p,
      base = baseAt(p);
    if (
      base.surface.distance <
      (base.surface.offset > 0 ? base.surface.rightEdge : -base.surface.leftEdge) + size * 2.6
    )
      return;
    if (nature) {
      const type = kind === "pine" ? 2 : kind === "blossom" ? 3 : Math.floor(t * 193) % 2;
      // A sector-sized batch balances culling with a low draw-call count.
      const tile = surfaceAt(t).section.id;
      const phase = t * 277 + offset;
      treeDummy.position.set(p.x, base.y, p.z);
      treeDummy.rotation.set(0, phase, 0);
      treeDummy.scale.set(
        size * (kind === "pine" ? 2.8 : 1.8),
        size * (kind === "pine" ? 1.6 : 1.45),
        size * (kind === "pine" ? 2.8 : 1.8) * (0.94 + Math.sin(phase) * 0.08),
      );
      treeDummy.updateMatrix();
      treeTint.setRGB(0.92 + Math.sin(phase) * 0.06, 0.94 + Math.cos(phase) * 0.05, 0.9);
      instance(
        treeBuckets,
        `${tile}:${type}`,
        nature[type],
        treeMaterial,
        treeDummy.matrix,
        treeTint,
      );
      if (kind === "orchard")
        for (let i = 0; i < 5; i++) {
          treeDummy.position.set(
            p.x + Math.cos(i * 1.7) * size * 1.4,
            base.y + size * (4.4 + (i % 2) * 0.5),
            p.z + Math.sin(i * 1.7) * size * 1.4,
          );
          treeDummy.scale.setScalar(0.22);
          treeDummy.updateMatrix();
          treeTint.setRGB(1, 1, 1);
          instance(fruitBuckets, tile, fruitGeo, fruit, treeDummy.matrix, treeTint);
        }
      return;
    }
    const g = new THREE.Group();
    g.position.set(p.x, base.y, p.z);
    scenery.add(g);
    mesh(cylinderGeo, bark, g, [0, size * 2.5, 0], [size * 0.25, size * 5, size * 0.25]);
    if (kind === "pine") {
      for (let i = 0; i < 3; i++)
        mesh(
          coneGeo,
          i % 2 ? mats.pine2 : pine,
          g,
          [0, size * (3.0 + i * 1.2), 0],
          [size * (2.5 - i * 0.5), size * 3.6, size * (2.5 - i * 0.5)],
        );
    } else {
      for (let i = 0; i < 3; i++)
        mesh(
          sphereGeo,
          kind === "blossom" ? flower : leaf,
          g,
          [(i - 1) * size * 0.85, size * (4.7 + (i % 2) * 0.6), 0],
          [size * 1.65, size * 1.5, size * 1.6],
        );
      if (kind === "orchard")
        for (let i = 0; i < 5; i++)
          mesh(
            sphereGeo,
            fruit,
            g,
            [
              Math.cos(i * 1.7) * size * 1.6,
              size * (4.1 + (i % 2) * 0.5),
              Math.sin(i * 1.7) * size * 1.7,
            ],
            [0.22, 0.22, 0.22],
          );
    }
  }
  const fruitGeo = bakeVertexShade(new THREE.OctahedronGeometry(1));
  for (let i = 0; i < 160; i++) {
    const t = sectorT(1, random()),
      side = i % 2 ? 1 : -1;
    tree(t, side * (14 + random() * 32), "pine", 1.8 + random() * 0.9);
  }
  // Canopy columns framing two shaded road passages, with clearance above the camera.
  for (const f of [0.2, 0.38, 0.62, 0.8])
    for (const side of [-1, 1]) tree(sectorT(1, f), side * 13, "pine", 3.3);
  for (let i = 0; i < 100; i++) {
    const t = sectorT(5, random()),
      side = i % 2 ? 1 : -1;
    tree(
      t,
      side * (15 + (side > 0 ? shortcutWidth(t) : 0) + random() * 27),
      i % 3 ? "orchard" : "blossom",
      1 + random() * 0.4,
    );
  }
  for (let i = 0; i < 40; i++)
    tree(sectorT(0, random()), (i % 2 ? 1 : -1) * (20 + random() * 42), "orchard", 1.3 + random());
  // Spatial batches retain culling: an orchard across the circuit does not
  // enter the nearby shadow map or main pass. Count and placement stay bounded.
  for (const buckets of [treeBuckets, fruitBuckets])
    for (const bucket of buckets.values()) {
      const m = new THREE.InstancedMesh(bucket.geometry, bucket.material, bucket.placements.length);
      m.name = buckets === treeBuckets ? "Kenney nature instances" : "Orchard fruit instances";
      bucket.placements.forEach((p, i) => {
        m.setMatrixAt(i, p.matrix);
        m.setColorAt(i, p.color);
      });
      m.instanceMatrix.needsUpdate = true;
      m.castShadow = buckets === treeBuckets;
      m.receiveShadow = true;
      m.computeBoundingSphere();
      scene.add(m);
    }
  // Ridge rock faces lean away from the road; the outside is an open valley view.
  for (let i = 0; i < 45; i++) {
    const t = sectorT(2, random()),
      p = poseAt(t * TRACK, surfaceAt(t).leftEdge - 12 - random() * 15, 0).p,
      base = baseAt(p);
    const m = mesh(
      new THREE.IcosahedronGeometry(1, 0),
      rock,
      scenery,
      [p.x, base.y + 2, p.z],
      [4 + random() * 5, 3 + random() * 9, 4 + random() * 5],
    );
    m.rotation.y = random() * 6;
  }
  // Broad overlapping hills stay outside the course footprint, but close
  // enough to read through the fog from the opening meadow and valley turns.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2,
      r = 345 + random() * 25;
    const hill = mesh(
      sphereGeo,
      i % 2 ? leaf : pine,
      scenery,
      [Math.cos(a) * r, -23, Math.sin(a) * r],
      [64 + random() * 30, 48 + random() * 41, 64 + random() * 30],
    );
    hill.name = "Layered countryside horizon";
    hill.castShadow = false;
  }

  for (let i = 0; i < 22; i++) {
    const g = new THREE.Group();
    scenery.add(g);
    g.position.set(random() * 950 - 475, 80 + random() * 35, random() * 950 - 475);
    for (let j = 0; j < 4; j++)
      mesh(sphereGeo, cream, g, [j * 5, Math.sin(j) * 2, 0], [5.5, 2.8, 3.2]);
    batchStaticMeshes(g);
  }
}
