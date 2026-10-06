import * as THREE from "../../../vendor/three/three.module.js";

/** Reserve the whole stacked route, including shoulders and chase-camera space.
 * A nearest-centerline test misses tall props reaching through another floor.
 */
export function createClockworkClearance(track) {
  const count = Math.ceil(track.COURSE_LENGTH / 2);
  const corridor = Array.from({ length: count }, (_, i) => {
    const bounds = new THREE.Box3();
    for (const t of [i / count, (i + 1) / count]) {
      for (const side of [-1, 1]) {
        const offset = track.platformEdgeAt(t, side) + side;
        const p = track.poseAt(t * track.TRACK, offset, 0).p;
        bounds.expandByPoint(p.clone().add(new THREE.Vector3(0, 0.35, 0)));
        bounds.expandByPoint(p.clone().add(new THREE.Vector3(0, 7, 0)));
      }
    }
    return bounds.expandByVector(new THREE.Vector3(0.3, 0, 0.3));
  });
  return (group, center, size) => {
    group.updateWorldMatrix(true, false);
    const half = new THREE.Vector3(...size).multiplyScalar(0.5);
    const bounds = new THREE.Box3(
      new THREE.Vector3(...center).sub(half),
      new THREE.Vector3(...center).add(half),
    ).applyMatrix4(group.matrixWorld);
    return !corridor.some((road) => road.intersectsBox(bounds));
  };
}
