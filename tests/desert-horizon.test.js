import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import course from "../src/courses/sunstone-ruins.js";
import { selectCourse } from "../src/track/track.js";
import { createCourseKit, batchScenery } from "../src/rendering/course-kit.js";
import { createRouteClearance } from "../src/rendering/route-clearance.js";
import { buildDesertHorizon } from "../src/courses/sunstone-ruins/build-desert-horizon.js";
import { createDuneGeometry } from "../src/courses/sunstone-ruins/create-desert-geometry.js";

test("wind sculpted dunes meet the ground at every perimeter vertex and face upward", () => {
  for (const segments of [18, 24, 36]) {
    const geometry = createDuneGeometry(THREE, segments);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        z = positions.getZ(i);
      assert.ok(Number.isFinite(positions.getY(i)) && positions.getY(i) >= 0);
      if (Math.abs(x) > 0.999 || Math.abs(z) > 0.999)
        assert.ok(positions.getY(i) < 1e-6, "no exposed vertical dune seams");
      assert.ok(geometry.attributes.normal.getY(i) > 0);
    }
    assert.ok(geometry.boundingBox.max.y > 0.98);
  }
});

test("every horizon assembly clears all routes and survives batching with a shared reversible clock", () => {
  const track = selectCourse(course),
    scene = new THREE.Scene(),
    scenery = new THREE.Group();
  scene.add(scenery);
  const kit = createCourseKit(scenery, track),
    motions = [];
  buildDesertHorizon({ THREE, scenery, track, kit, textures: {}, motions });
  const allows = createRouteClearance(track),
    identity = new THREE.Group();
  const dunes = scenery.children.filter((o) => o.isGroup);
  assert.equal(dunes.length, 90);
  const silhouettes = new Set();
  for (const dune of dunes) {
    const bounds = new THREE.Box3().setFromObject(dune);
    assert.ok(
      allows(
        identity,
        bounds.getCenter(new THREE.Vector3()).toArray(),
        bounds.getSize(new THREE.Vector3()).toArray(),
      ),
      dune.name,
    );
    for (const child of dune.children) if (child.isGroup) silhouettes.add(child.name);
  }
  assert.equal(silhouettes.size, 5);
  const materials = new Set();
  scenery.traverse((o) => {
    if (o.isMesh) materials.add(o.material);
  });
  const clocks = [];
  for (const material of materials) {
    if (!material.isMeshStandardMaterial) continue;
    const shader = {
      uniforms: {},
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    };
    material.onBeforeCompile(shader);
    clocks.push(shader.uniforms.mirageTime);
  }
  assert.ok(clocks.length >= 6);
  assert.ok(clocks.every((clock) => clock === clocks[0]));
  const objects = [];
  scenery.traverse((o) => objects.push(o));
  for (const time of [0, 8.5, 8.5, 0]) {
    motions.forEach((update) => update(time));
    assert.equal(clocks[0].value, time);
  }
  motions.forEach((update) => update(12, { motionEnabled: false }));
  assert.equal(clocks[0].value, 0);
  const after = [];
  scenery.traverse((o) => after.push(o));
  assert.deepEqual(after, objects, "animation reuses all geometry and scene objects");
  batchScenery(scenery);
  assert.deepEqual(scene.userData.sceneryClearance, { checked: 90, moved: 0, omitted: 0 });
});
