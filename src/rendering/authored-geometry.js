import * as THREE from "../../vendor/three/three.module.js";
import { mergeGeometries } from "../../vendor/three/addons/utils/BufferGeometryUtils.js";

/** Fit an imported part to dimensions, explicit bounds, or a still-used geometry. */
export function createAuthoredGeometryLibrary(models = {}) {
  const sources = new Map();
  const fitted = new Map();
  return (name, reference = [1, 1, 1]) => {
    let bounds;
    if (reference.isBufferGeometry) {
      reference.computeBoundingBox();
      bounds = reference.boundingBox;
    } else {
      const min = Array.isArray(reference) ? reference.map((value) => -value / 2) : reference.min;
      const max = Array.isArray(reference) ? reference.map((value) => value / 2) : reference.max;
      // Match the Float32 envelopes formerly measured from generated meshes.
      bounds = new THREE.Box3(
        new THREE.Vector3(...min.map(Math.fround)),
        new THREE.Vector3(...max.map(Math.fround)),
      );
    }
    const key = `${name}:${bounds.min.toArray()}:${bounds.max.toArray()}`;
    const model = models[name];
    if (!model?.isObject3D) {
      if (reference.isBufferGeometry) return reference;
      // Geometry-only simulation fixtures omit art. They need a small finite
      // placeholder, rather than copies of the retired scenery builders.
      const placeholderKey = `placeholder:${key}`;
      if (!fitted.has(placeholderKey)) {
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        fitted.set(
          placeholderKey,
          new THREE.BoxGeometry(...size.toArray()).translate(...center.toArray()),
        );
      }
      return fitted.get(placeholderKey);
    }
    if (!sources.has(name)) {
      model.updateWorldMatrix(true, true);
      const pieces = [];
      model.traverse((object) => {
        if (!object.isMesh) return;
        const geometry = object.geometry.index
          ? object.geometry.toNonIndexed()
          : object.geometry.clone();
        geometry.applyMatrix4(object.matrixWorld);
        for (const attribute of Object.keys(geometry.attributes))
          if (!["position", "normal", "uv", "color"].includes(attribute))
            geometry.deleteAttribute(attribute);
        pieces.push(geometry);
      });
      const geometry = mergeGeometries(pieces);
      pieces.forEach((piece) => piece.dispose());
      if (!geometry) throw new Error(`Authored geometry ${name} has incompatible mesh attributes`);
      geometry.computeBoundingBox();
      sources.set(name, geometry);
    }
    if (!fitted.has(key)) {
      const source = sources.get(name);
      const size = source.boundingBox.getSize(new THREE.Vector3());
      const target = bounds.getSize(new THREE.Vector3());
      const center = source.boundingBox.getCenter(new THREE.Vector3());
      const geometry = source.clone();
      geometry.translate(-center.x, -center.y, -center.z);
      geometry.scale(
        ...target.toArray().map((value, i) => value / Math.max(1e-6, size.getComponent(i))),
      );
      const pivot = bounds.getCenter(new THREE.Vector3());
      geometry.translate(pivot.x, pivot.y, pivot.z);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      fitted.set(key, geometry);
    }
    return fitted.get(key);
  };
}
