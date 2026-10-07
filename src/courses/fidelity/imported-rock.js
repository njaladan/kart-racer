import * as THREE from "../../../vendor/three/three.module.js";
import { mergeGeometries } from "../../../vendor/three/addons/utils/BufferGeometryUtils.js";

/** Reuse the artist's eroded outline in existing rock placements, with scan UVs. */
export function importedRockGeometry(assets) {
  const model = assets?.models?.["art:rock-largee"] || assets?.models?.["art:rock-tallb"];
  if (!model) return null;
  model.updateMatrixWorld(true);
  const pieces = [];
  model.traverse((object) => {
    if (!object.isMesh) return;
    const geometry = object.geometry.index
      ? object.geometry.toNonIndexed()
      : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    for (const name of Object.keys(geometry.attributes))
      if (!["position", "normal", "uv", "color"].includes(name)) geometry.deleteAttribute(name);
    pieces.push(geometry);
  });
  const geometry = mergeGeometries(pieces);
  pieces.forEach((piece) => piece.dispose());
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(2 / size.x, 2 / size.y, 2 / size.z);
  geometry.computeBoundingSphere();
  return geometry;
}
