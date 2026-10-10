import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { stabilizeSceneryMaterials } from "../src/rendering/scenery-performance.js";
import { patchMaterial } from "../src/rendering/surface-detail.js";
import { batchStaticMeshes } from "../src/rendering/visuals.js";

test("static shader layouts retain shared effects while moving material changes remain live", () => {
  const scene = new THREE.Scene();
  const material = new THREE.MeshStandardMaterial({ color: "#56a17c" });
  const clock = { value: 17 };
  patchMaterial(material, "test-shared-clock", (shader) => {
    shader.uniforms.clock = clock;
  });
  const geometry = new THREE.BoxGeometry();
  const mesh = new THREE.Mesh(geometry, material);
  const instances = new THREE.InstancedMesh(geometry, material, 3);
  const otherInstances = new THREE.InstancedMesh(geometry, material, 2);
  const movingMaterial = material.clone();
  const moving = new THREE.Mesh(geometry, movingMaterial);
  const movingInstances = new THREE.InstancedMesh(geometry, movingMaterial, 2);
  scene.add(mesh, instances, otherInstances, moving, movingInstances);
  assert.equal(stabilizeSceneryMaterials(scene, [moving]), 1);
  assert.equal(mesh.material, material);
  assert.notEqual(instances.material, material);
  assert.equal(instances.material, otherInstances.material);
  assert.equal(instances.material.customProgramCacheKey(), material.customProgramCacheKey());
  assert.equal(instances.material.color.getHex(), material.color.getHex());
  const shader = { uniforms: {} };
  instances.material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.clock, clock);
  clock.value = 25;
  assert.equal(shader.uniforms.clock.value, 25);
  movingMaterial.emissiveIntensity = 3;
  assert.equal(movingInstances.material.emissiveIntensity, 3);
  assert.equal(stabilizeSceneryMaterials(scene, [moving]), 0);
});

test("static batch transforms still follow moving parents and leave excluded children animated", () => {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial();
  const geometry = new THREE.BoxGeometry();
  const source = new THREE.Mesh(geometry, material);
  source.position.set(4, 2, 1);
  const moving = new THREE.Mesh(geometry, material);
  group.add(source, moving);
  batchStaticMeshes(group, [moving]);
  assert.equal(source.matrixAutoUpdate, false);
  assert.equal(moving.matrixAutoUpdate, true);
  group.position.set(20, 5, 3);
  moving.position.x = 9;
  group.updateMatrixWorld(true);
  assert.deepEqual(source.getWorldPosition(new THREE.Vector3()).toArray(), [24, 7, 4]);
  assert.deepEqual(moving.getWorldPosition(new THREE.Vector3()).toArray(), [29, 5, 3]);
});
