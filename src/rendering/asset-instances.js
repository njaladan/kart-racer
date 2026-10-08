import * as THREE from "../../vendor/three/three.module.js";

/** Batch articulated assemblies in their own frame; keep every LOD on its moving parent. */
export function createAssetInstances(models, name, placements) {
  const source = models[name];
  if (!source) throw new Error(`Unknown instanced asset: ${name}`);
  const lod = new THREE.LOD();
  lod.autoUpdate = false;
  lod.name = `${name} animated instances`;
  lod.userData.sceneryLod = true;
  lod.userData.dynamicScenery = true;
  lod.userData.lodDistances = source.userData.lodDistances || [0, 65, 150];
  const variants = [
    source,
    models[source.userData.lods?.mid],
    models[source.userData.lods?.far],
  ].filter(Boolean);
  for (const [level, variant] of variants.entries()) {
    const group = new THREE.Group();
    variant.updateMatrixWorld(true);
    variant.traverse((object) => {
      if (!object.isMesh) return;
      const mesh = new THREE.InstancedMesh(object.geometry, object.material, placements.length);
      for (const [index, placement] of placements.entries()) {
        const transform = new THREE.Matrix4().compose(
          new THREE.Vector3(...placement.position),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, placement.rotationY || 0, 0)),
          new THREE.Vector3(...(placement.scale || [1, 1, 1])),
        );
        mesh.setMatrixAt(index, transform.multiply(object.matrixWorld));
      }
      mesh.castShadow = level < 2;
      mesh.receiveShadow = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      group.add(mesh);
    });
    lod.addLevel(group, lod.userData.lodDistances[level], 0.12);
  }
  return lod;
}
