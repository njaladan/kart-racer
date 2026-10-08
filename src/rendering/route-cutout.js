import * as THREE from "../../vendor/three/three.module.js";

/** Excavate a terrain slope where another road passes through it. Floor and
 * obstacle meshes normally bypass scenery pruning, so test their real faces.
 */
export function cutTerrainPassages(geometry, corridor, skipCell = () => false) {
  const positions = geometry.attributes.position,
    index = geometry.index;
  const triangle = new THREE.Triangle(),
    bounds = new THREE.Box3(),
    kept = [];
  geometry.computeBoundingBox();
  const cells = corridor.filter((cell) => cell.intersectsBox(geometry.boundingBox));
  if (!cells.length) return geometry;
  for (let i = 0; i < index.count; i += 3) {
    triangle.a.fromBufferAttribute(positions, index.getX(i));
    triangle.b.fromBufferAttribute(positions, index.getX(i + 1));
    triangle.c.fromBufferAttribute(positions, index.getX(i + 2));
    bounds.setFromPoints([triangle.a, triangle.b, triangle.c]);
    if (
      !cells.some(
        (cell) =>
          !skipCell(cell, i) && cell.intersectsBox(bounds) && cell.intersectsTriangle(triangle),
      )
    )
      kept.push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
  }
  geometry.setIndex(kept);
  return geometry;
}
