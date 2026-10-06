import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { COURSES } from "../src/courses/registry.js";
import { selectCourse } from "../src/track/track.js";
import { COURSE_ENVIRONMENTS } from "../src/courses/environment-palettes.js";
import { buildCourseEnvironment } from "../src/courses/course-environment.js";
import { createClockworkClearance } from "../src/courses/adventure/clockwork-clearance.js";
import { createCourseKit, batchScenery } from "../src/rendering/course-kit.js";

test("every course has bounded local particles, quality scaling and pause/restart-safe clocks", () => {
  assert.deepEqual(Object.keys(COURSE_ENVIRONMENTS).sort(), COURSES.map((c) => c.id).sort());
  const shapes = new Set(),
    motions = new Set();
  for (const course of COURSES) {
    const track = selectCourse(course),
      scene = new THREE.Scene(),
      surface = new THREE.MeshStandardMaterial(),
      environment = buildCourseEnvironment({ scene, track, surfaces: [surface] });
    assert.ok(environment.fields.length >= 6 && environment.fields.length <= 10, course.id);
    assert.ok(environment.fields.reduce((sum, field) => sum + field.capacity, 0) <= 1200);
    const resources = environment.fields.map(({ object }) => [object.geometry, object.material]);
    for (const field of environment.fields) {
      shapes.add(field.spec.shape);
      motions.add(field.spec.motion);
      assert.equal(field.object.material.depthWrite, false);
      assert.equal(field.object.castShadow, false);
      assert.equal(field.object.userData.skipBake, true);
      for (const attribute of Object.values(field.object.geometry.attributes))
        assert.ok([...attribute.array].every(Number.isFinite), `${course.id}: ${field.spec.name}`);
      const box = field.object.geometry.boundingBox;
      for (const point of [box.min, box.max]) assert.ok(point.toArray().every(Number.isFinite));
      const data = field.object.geometry.attributes.particleBase;
      for (let i = 0; i < data.count; i++)
        assert.ok(box.containsPoint(new THREE.Vector3().fromBufferAttribute(data, i)));
    }
    const objects = [];
    scene.traverse((object) => objects.push(object));
    assert.ok(
      objects.filter((object) => object.isMesh).length < 160,
      `${course.id}: bounded extra draws`,
    );
    for (const tier of [3, 0, 2, 1, 3]) {
      environment.setQuality(tier);
      for (const field of environment.fields)
        assert.ok(
          field.object.geometry.instanceCount > 0 &&
            field.object.geometry.instanceCount <= field.capacity,
        );
      assert.equal(
        environment.fields[0].object.geometry.instanceCount,
        Math.ceil(environment.fields[0].capacity * [0.45, 0.65, 0.85, 1][tier]),
      );
    }
    environment.updateCamera(new THREE.Vector3(10000, 10000, 10000));
    assert.ok(environment.fields.every((field) => !field.object.visible));
    for (const time of [0, 12, 12, 0]) {
      environment.update(time);
      for (const field of environment.fields)
        assert.equal(field.object.material.uniforms.fieldTime.value, time);
      assert.equal(environment.clock.value, time);
    }
    environment.update(43, { motionEnabled: false });
    assert.equal(environment.clock.value, 0);
    assert.ok(
      environment.fields.every((field) => field.object.material.uniforms.fieldTime.value === 0),
    );
    assert.deepEqual(
      environment.fields.map(({ object }) => [object.geometry, object.material]),
      resources,
    );
    const after = [];
    scene.traverse((object) => after.push(object));
    assert.deepEqual(after, objects, "Clocks, quality and culling never allocate scene objects");
    const shader = {
      uniforms: {},
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    };
    surface.onBeforeCompile(shader);
    assert.equal(shader.uniforms.environmentClock, environment.clock);
  }
  assert.equal(shapes.size, 12);
  assert.equal(motions.size, 5);
});

test("authored machinery and festival motion remain outside every road floor", () => {
  const identity = new THREE.Group();
  for (const course of COURSES) {
    const track = selectCourse(course),
      scene = new THREE.Scene(),
      environment = buildCourseEnvironment({ scene, track }),
      clear = createClockworkClearance(track);
    for (const time of [0, 1, 4, 8, 17, 29]) {
      environment.update(time);
      scene.updateMatrixWorld(true);
      environment.scenery.traverse((object) => {
        if (!object.isMesh || object.userData.environmentParticle) return;
        const bounds = new THREE.Box3().setFromObject(object);
        assert.ok(
          clear(
            identity,
            bounds.getCenter(new THREE.Vector3()).toArray(),
            bounds.getSize(new THREE.Vector3()).toArray(),
          ),
          `${course.id}: ${object.name || object.id} at ${time}`,
        );
        assert.ok(object.matrixWorld.elements.every(Number.isFinite));
      });
    }
  }
});

test("particle sources survive static batching and camera culling follows moving exhaust", () => {
  const course = COURSES.find((c) => c.id === "railstorm-express"),
    track = selectCourse(course),
    scene = new THREE.Scene(),
    root = new THREE.Group();
  scene.add(root);
  const kit = createCourseKit(root, track),
    source = kit.groupAt(track.sectorT(1, 0.5));
  source.userData.environmentSource = "express-boiler";
  kit.box(new THREE.MeshStandardMaterial(), source, [0, 0, 0], [2, 2, 2]);
  batchScenery(root);
  assert.equal(source.parent, root, "Empty source anchors survive static flattening");
  const environment = buildCourseEnvironment({ scene, track }),
    exhaust = environment.fields.filter((field) => field.spec.source === "express-boiler");
  assert.equal(exhaust.length, 2);
  for (const field of exhaust) assert.equal(field.object.parent, source);
  const field = exhaust[0],
    before = field.object.getWorldPosition(new THREE.Vector3());
  environment.updateCamera(before);
  assert.equal(field.object.visible, true);
  source.position.add(new THREE.Vector3(5000, 30, 0));
  source.rotation.y += 0.7;
  environment.update(4);
  environment.updateCamera(before);
  assert.equal(field.object.visible, false, "A moved train does not retain its old emitter bound");
  const after = field.object.getWorldPosition(new THREE.Vector3());
  environment.updateCamera(after);
  assert.equal(field.object.visible, true);
  assert.ok(after.distanceTo(before) > 4900);
});
