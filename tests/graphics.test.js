import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import {
  ParticlePool,
  bakeVertexShade,
  createStableShadowFollower,
} from "../src/rendering/graphics.js";
import { batchStaticMeshes } from "../src/rendering/visuals.js";

test("sparks remain bounded and expire without allocating or leaking scene objects", () => {
  const scene = new THREE.Scene(),
    pool = new ParticlePool(scene, 4);
  const geometry = pool.mesh.geometry,
    material = pool.mesh.material;
  const position = new THREE.Vector3(1, 2, 3);
  for (let i = 0; i < 20; i++) pool.spawn(position, "#ff8844", 0.5, 0.1);
  assert.equal(pool.count, 4);
  assert.equal(scene.children.length, 1);
  pool.sync();
  assert.equal(pool.mesh.count, 4);
  pool.step(0.25);
  pool.spawn(position, "#22ddff", 1, 0.2);
  pool.step(0.3);
  pool.sync();
  assert.equal(pool.count, 1);
  assert.equal(pool.mesh.count, 1);
  assert.ok(pool.opacity.getX(0) > 0 && pool.opacity.getX(0) < 1);
  assert.equal(pool.mesh.geometry, geometry);
  assert.equal(pool.mesh.material, material);
  pool.clear();
  assert.equal(pool.mesh.count, 0);
  assert.equal(pool.mesh.visible, false);
  pool.spawn(position, "#ffffff", 0.1);
  pool.step(0.2);
  pool.sync();
  assert.equal(pool.count, 0);
  assert.equal(scene.children.length, 1);
});

test("static batching retains baked shading and neutral colors on unshaded pieces", () => {
  const group = new THREE.Group(),
    material = new THREE.MeshStandardMaterial({ vertexColors: true });
  const shaded = bakeVertexShade(new THREE.BoxGeometry(1, 1, 1));
  const neutral = new THREE.BoxGeometry(1, 1, 1);
  group.add(new THREE.Mesh(shaded, material), new THREE.Mesh(neutral, material));
  const expected = [...shaded.getAttribute("color").array];
  batchStaticMeshes(group);
  assert.equal(group.children.length, 1);
  const colors = group.children[0].geometry.getAttribute("color");
  assert.deepEqual([...colors.array.slice(0, expected.length)], expected);
  assert.ok([...colors.array.slice(expected.length)].every((v) => v === 1));
});

test("shadow following snaps in light space while preserving sun direction", () => {
  const sun = new THREE.DirectionalLight();
  sun.shadow.camera.left = sun.shadow.camera.bottom = -48;
  sun.shadow.camera.right = sun.shadow.camera.top = 48;
  sun.shadow.mapSize.set(2048, 2048);
  const follow = createStableShadowFollower(sun);
  const direction = new THREE.Vector3(-65, 95, 45).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right);
  const texel = 96 / 2048;
  follow(new THREE.Vector3());
  follow(right.clone().multiplyScalar(texel * 0.2));
  assert.ok(Math.abs(sun.target.position.dot(right)) < 1e-9);
  const p = new THREE.Vector3(120.1, 12.9, -56.4);
  follow(p);
  for (const axis of [right, up]) {
    const cells = sun.target.position.dot(axis) / texel;
    assert.ok(Math.abs(cells - Math.round(cells)) < 1e-8);
    assert.ok(Math.abs(sun.target.position.clone().sub(p).dot(axis)) <= texel / 2 + 1e-9);
  }
  assert.ok(sun.position.clone().sub(sun.target.position).normalize().distanceTo(direction) < 1e-9);
});
