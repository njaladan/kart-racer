import * as THREE from "../../vendor/three/three.module.js";

/** Regional LODs keep authored detail close to the racer without per-tree draws. */
export function batchSceneryLods(scene, cellSize = 64) {
  scene.updateMatrixWorld(true);
  const regions = new Map();
  const sources = [];
  scene.traverse((object) => {
    if (!object.isLOD || !object.userData.sceneryLod || object.userData.dynamicScenery) return;
    sources.push(object);
    const p = object.getWorldPosition(new THREE.Vector3());
    const key = `${Math.floor(p.x / cellSize)}:${Math.floor(p.z / cellSize)}:${object.levels.map((level) => level.distance).join(",")}`;
    if (!regions.has(key)) regions.set(key, { objects: [], position: new THREE.Vector3() });
    const region = regions.get(key);
    region.objects.push(object);
    region.position.add(p);
  });
  for (const region of regions.values()) {
    if (region.objects.length < 2) continue;
    region.position.divideScalar(region.objects.length);
    const lod = new THREE.LOD();
    lod.name = "Regional authored scenery detail";
    lod.position.copy(region.position);
    lod.autoUpdate = false;
    lod.userData.sceneryLod = true;
    lod.userData.lodDistances = region.objects[0].levels.map((level) => level.distance);
    for (let level = 0; level < region.objects[0].levels.length; level++) {
      const group = new THREE.Group();
      const batches = new Map();
      for (const source of region.objects) {
        source.levels[level].object.traverse((mesh) => {
          if (!mesh.isMesh) return;
          const key = `${mesh.geometry.id}:${mesh.material.id}:${mesh.castShadow}:${mesh.receiveShadow}`;
          if (!batches.has(key)) batches.set(key, { mesh, matrices: [] });
          const matrix = mesh.matrixWorld.clone();
          matrix.elements[12] -= region.position.x;
          matrix.elements[13] -= region.position.y;
          matrix.elements[14] -= region.position.z;
          batches.get(key).matrices.push(matrix);
        });
      }
      for (const { mesh, matrices } of batches.values()) {
        const instances = new THREE.InstancedMesh(mesh.geometry, mesh.material, matrices.length);
        instances.name = "Regional scenery LOD instances";
        matrices.forEach((matrix, i) => instances.setMatrixAt(i, matrix));
        instances.castShadow = mesh.castShadow && level < 2;
        instances.receiveShadow = mesh.receiveShadow;
        instances.computeBoundingBox();
        instances.computeBoundingSphere();
        group.add(instances);
      }
      lod.addLevel(group, lod.userData.lodDistances[level], 0.12);
    }
    scene.add(lod);
    region.objects.forEach((source) => source.removeFromParent());
  }
  return sources.length;
}

export function createSceneryDetailController(scene) {
  batchSceneryLods(scene);
  const lods = [];
  scene.traverse((object) => {
    if (object.isLOD && object.userData.sceneryLod) lods.push(object);
  });
  const camera = { position: new THREE.Vector3(), matrixWorld: new THREE.Matrix4(), zoom: 1 };
  return {
    setQuality() {
      // Quality tiers adjust optional rendering costs, not authored detail.
      // Moving LOD thresholds with quality made nearby trees visibly change
      // color and silhouette whenever the renderer changed tiers.
      for (const lod of lods)
        lod.levels.forEach((level, i) => {
          level.distance = lod.userData.lodDistances[i];
        });
    },
    updateCamera(position) {
      camera.position.copy(position);
      camera.matrixWorld.makeTranslation(position.x, position.y, position.z);
      for (const lod of lods) {
        // Only a moving LOD's ancestry can affect its distance. Updating the
        // entire course here repeated the renderer's traversal every frame.
        lod.updateWorldMatrix(true, false);
        lod.update(camera);
      }
    },
  };
}
