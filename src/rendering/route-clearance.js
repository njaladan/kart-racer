import * as THREE from "../../vendor/three/three.module.js";

/** Reserve the whole stacked route, including shoulders and chase-camera space.
 * A nearest-centerline test misses tall props reaching through another floor.
 */
export function createRouteClearance(track) {
  const count = Math.ceil(track.COURSE_LENGTH / 2);
  const corridor = Array.from({ length: count }, (_, i) => {
    const bounds = new THREE.Box3();
    for (const t of [i / count, (i + 1) / count]) {
      const mountain = track.mountainSurface?.containsT(t);
      const sides = mountain ? [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1] : [-1, 1];
      for (const side of sides) {
        const offset = mountain
          ? side * (track.mountainSurface.widthAt(t) + 1)
          : track.platformEdgeAt(t, side) + side;
        const p = track.poseAt(t * track.TRACK, offset, 0).p;
        bounds.expandByPoint(p.clone().add(new THREE.Vector3(0, mountain ? -0.1 : 0.35, 0)));
        bounds.expandByPoint(p.clone().add(new THREE.Vector3(0, 7, 0)));
      }
    }
    return bounds.expandByVector(new THREE.Vector3(0.3, 0, 0.3));
  });
  for (const area of track.areaSurfaces || []) {
    const sectors = 96,
      rings = 24;
    for (let i = 0; i < sectors; i++)
      for (let j = 0; j < rings; j++) {
        const bounds = new THREE.Box3();
        for (const angle of [i, i + 1])
          for (const ring of [j, j + 1]) {
            const r = THREE.MathUtils.lerp(area.innerRadius, area.radius, ring / rings);
            const p = area.pointAt((angle / sectors) * Math.PI * 2, r);
            bounds.expandByPoint(p.clone().add(new THREE.Vector3(0, 0.35, 0)));
            bounds.expandByPoint(p.clone().add(new THREE.Vector3(0, 7, 0)));
          }
        corridor.push(bounds.expandByVector(new THREE.Vector3(0.3, 0, 0.3)));
      }
  }
  for (const branch of track.branches || []) {
    if (branch.areaSurface) continue;
    for (let i = 0; i < branch.count; i++) {
      const bounds = new THREE.Box3();
      for (const q of [i / branch.count, (i + 1) / branch.count])
        for (const side of [-1, 1]) {
          const p = branch.poseAt(q, side * (branch.halfWidth + 1), 0).p;
          bounds.expandByPoint(p.clone().add(new THREE.Vector3(0, 0.35, 0)));
          bounds.expandByPoint(p.clone().add(new THREE.Vector3(0, 7, 0)));
        }
      corridor.push(bounds);
    }
  }
  const allows = (group, center, size) => {
    group.updateWorldMatrix(true, false);
    const half = new THREE.Vector3(...size).multiplyScalar(0.5);
    const bounds = new THREE.Box3(
      new THREE.Vector3(...center).sub(half),
      new THREE.Vector3(...center).add(half),
    ).applyMatrix4(group.matrixWorld);
    return !corridor.some((road) => road.intersectsBox(bounds));
  };
  allows.corridor = corridor;
  return allows;
}
