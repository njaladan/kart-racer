import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { createSceneryChunks } from "../src/rendering/scenery-chunks.js";
import { stabilizeSceneryMaterials } from "../src/rendering/scenery-performance.js";
import { patchMaterial } from "../src/rendering/surface-detail.js";

function staticMesh(parent, material, x = 5, z = -10, baked = 127) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.setAttribute(
    "lightBake",
    new THREE.Uint8BufferAttribute(
      new Uint8Array(geometry.attributes.position.count * 4).fill(baked),
      4,
      true,
    ),
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, 0, z);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.updateMatrix();
  mesh.matrixAutoUpdate = false;
  mesh.userData.staticScenery = true;
  parent.add(mesh);
  return mesh;
}

function chunks(scene) {
  const result = [];
  scene.traverse((o) => {
    if (o.isBatchedMesh) result.push(o);
  });
  return result;
}

test("chunks preserve world transforms, normalized bake bytes and shader uniforms across builders", () => {
  const scene = new THREE.Scene();
  const material = new THREE.MeshStandardMaterial();
  const clock = { value: 7 };
  patchMaterial(material, "test-clock", (shader) => {
    shader.uniforms.clock = clock;
  });
  const a = new THREE.Group(),
    b = new THREE.Group();
  scene.add(a, b);
  const first = staticMesh(a, material, 5, -10, 42);
  const second = staticMesh(b, material, 15, -10, 230);
  b.position.set(2, 3, 1);
  b.rotation.y = 0.4;
  second.scale.set(2, 3, 4);
  second.updateMatrix();
  scene.updateMatrixWorld(true);
  const original = [first.matrixWorld.clone(), second.matrixWorld.clone()];
  const runtime = createSceneryChunks(scene);
  assert.equal(runtime.stats.fewerRenderObjects, 1);
  const [chunk] = chunks(scene);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 2; i++) {
    chunk.getMatrixAt(i, matrix);
    const world = new THREE.Matrix4().multiplyMatrices(chunk.matrixWorld, matrix);
    for (let j = 0; j < 16; j++)
      assert.ok(Math.abs(world.elements[j] - original[i].elements[j]) < 0.00001);
  }
  const baked = chunk.geometry.getAttribute("lightBake");
  assert.equal(baked.normalized, true);
  assert.ok(baked.array instanceof Uint8Array);
  assert.deepEqual(
    [...baked.array],
    [...first.geometry.attributes.lightBake.array, ...second.geometry.attributes.lightBake.array],
  );
  const shader = { uniforms: {} };
  chunk.material.onBeforeCompile(shader);
  clock.value = 11;
  assert.equal(shader.uniforms.clock.value, 11);
  assert.equal(chunk.castShadow, true);
  assert.equal(chunk.receiveShadow, true);
  runtime.dispose();
});

test("chunk visibility is recomputed for main, reflection and shadow cameras", () => {
  const scene = new THREE.Scene();
  const material = new THREE.MeshStandardMaterial();
  staticMesh(scene, material, 5);
  staticMesh(scene, material, 15);
  const runtime = createSceneryChunks(scene);
  const [chunk] = chunks(scene);
  const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 30);
  camera.position.x = 5;
  camera.updateMatrixWorld(true);
  chunk.onBeforeRender({}, scene, camera, chunk.geometry, chunk.material);
  assert.equal(chunk._multiDrawCount, 1);
  const firstId = chunk._indirectTexture.image.data[0];
  camera.position.x = 15;
  camera.updateMatrixWorld(true);
  chunk.onBeforeRender({}, scene, camera, chunk.geometry, chunk.material);
  assert.equal(chunk._multiDrawCount, 1);
  assert.notEqual(chunk._indirectTexture.image.data[0], firstId);
  const shadow = new THREE.OrthographicCamera(-30, 30, 30, -30, 0.1, 30);
  shadow.updateMatrixWorld(true);
  chunk.onBeforeShadow({}, chunk, camera, shadow, chunk.geometry, chunk.material);
  assert.equal(chunk._multiDrawCount, 2);
  runtime.dispose();
});

test("LOD membership and source ordering survive compilation and rollback", () => {
  const scene = new THREE.Scene();
  const lod = new THREE.LOD();
  const near = new THREE.Group(),
    far = new THREE.Group();
  lod.addLevel(near, 0).addLevel(far, 30);
  scene.add(lod);
  const material = new THREE.MeshStandardMaterial();
  const a = staticMesh(near, material),
    b = staticMesh(near, material, 6);
  const distant = staticMesh(far, material);
  const order = [...near.children];
  const runtime = createSceneryChunks(scene);
  assert.equal(chunks(scene)[0].parent, near);
  const camera = new THREE.PerspectiveCamera();
  camera.position.z = 100;
  camera.updateMatrixWorld(true);
  lod.update(camera);
  assert.equal(near.visible, false);
  assert.equal(far.visible, true);
  assert.equal(distant.parent, far);
  scene.userData.layeredReceiverMeshes = [a, b];
  runtime.setEnabled(false);
  assert.deepEqual(near.children, order);
  assert.equal(scene.userData.layeredReceiverMeshes, undefined);
  runtime.setEnabled(true);
  runtime.dispose();
  assert.deepEqual(near.children, order);
});

test("moving, transparent, wind, partial geometry and incompatible layouts remain separate", () => {
  const scene = new THREE.Scene();
  const material = new THREE.MeshStandardMaterial();
  const moving = new THREE.Group();
  scene.add(moving);
  const protectedMesh = staticMesh(moving, material);
  const shared = staticMesh(scene, material, 6);
  const plain = new THREE.MeshStandardMaterial();
  const a = staticMesh(scene, plain),
    b = staticMesh(scene, plain, 6);
  const transparent = staticMesh(scene, new THREE.MeshStandardMaterial({ transparent: true }));
  const windMaterial = new THREE.MeshStandardMaterial();
  windMaterial.userData["foliage-wind-v2"] = true;
  const wind = staticMesh(scene, windMaterial);
  const partial = staticMesh(scene, plain, 7);
  partial.geometry.setDrawRange(0, 3);
  const mirrored = staticMesh(scene, plain, 8);
  mirrored.scale.x = -1;
  mirrored.updateMatrix();
  const sheared = staticMesh(scene, plain, 8);
  sheared.matrix.makeShear(0.3, 0, 0, 0, 0, 0);
  const different = staticMesh(scene, plain, 8);
  different.geometry.deleteAttribute("lightBake");
  const runtime = createSceneryChunks(scene, [moving]);
  assert.equal(runtime.stats.sourceMeshes, 2);
  assert.equal(a.parent, null);
  assert.equal(b.parent, null);
  for (const mesh of [
    protectedMesh,
    shared,
    transparent,
    wind,
    partial,
    mirrored,
    sheared,
    different,
  ])
    assert.ok(mesh.parent);
  moving.position.x = 20;
  scene.updateMatrixWorld(true);
  assert.equal(protectedMesh.getWorldPosition(new THREE.Vector3()).x, 25);
  runtime.dispose();
});

test("spatial and buffer limits bound batches; batched materials get their own shader layout", () => {
  const scene = new THREE.Scene();
  const material = new THREE.MeshStandardMaterial();
  for (let i = 0; i < 4; i++) staticMesh(scene, material, 5 + i);
  const distant = staticMesh(scene, material, 450);
  const runtime = createSceneryChunks(scene, [], { maxVertices: 8 });
  assert.equal(runtime.stats.chunks, 2);
  assert.equal(distant.parent, scene);
  assert.equal(stabilizeSceneryMaterials(scene), 1);
  assert.notEqual(distant.material, chunks(scene)[0].material);
  assert.equal(chunks(scene)[0].material, chunks(scene)[1].material);
  runtime.dispose();
});

test("unsupported multi-draw renderers keep the original scene without allocating chunks", () => {
  const scene = new THREE.Scene();
  const material = new THREE.MeshStandardMaterial();
  staticMesh(scene, material);
  staticMesh(scene, material, 6);
  const original = [...scene.children];
  const runtime = createSceneryChunks(scene, [], { supported: false });
  runtime.setEnabled(true);
  assert.equal(runtime.enabled, false);
  assert.equal(runtime.stats.chunks, 0);
  assert.deepEqual(scene.children, original);
  runtime.dispose();
});
