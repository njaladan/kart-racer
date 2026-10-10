import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { COURSES } from "../src/courses/registry.js";
import { createTrack } from "../src/track/track-builder.js";
import { createPolishKit } from "../src/rendering/course-polish-kit.js";
import { createRouteClearance } from "../src/rendering/route-clearance.js";
import { COURSE_BACKGROUNDS, buildCourseBackground } from "../src/courses/background/index.js";

test("all twelve courses have authored backgrounds or the retained continuous desert", () => {
  assert.equal(COURSES.length, 12);
  for (const course of COURSES)
    assert.ok(COURSE_BACKGROUNDS[course.id] || course.id === "sunstone-ruins", course.id);
});

for (const course of COURSES.filter((course) => COURSE_BACKGROUNDS[course.id])) {
  test(`${course.name} backgrounds fill both sides, clear all routes and stay bounded through animation`, () => {
    const track = createTrack(course),
      scene = new THREE.Scene();
    const w = createPolishKit({ scene, track });
    buildCourseBackground(w);
    const sites = scene.userData.courseBackground;
    const allows = createRouteClearance(track),
      identity = new THREE.Group();
    for (let section = 0; section < track.SECTIONS.length; section++) {
      assert.ok(sites.some((site) => site.section === section && site.side === -1));
      assert.ok(sites.some((site) => site.section === section && site.side === 1));
    }
    for (const site of sites)
      assert.ok(
        allows(
          identity,
          site.bounds.getCenter(new THREE.Vector3()).toArray(),
          site.bounds.getSize(new THREE.Vector3()).toArray(),
        ),
        site.label,
      );
    const world = w.finish();
    for (const time of [0, 15, 60, 120]) {
      world.update(time);
      scene.updateMatrixWorld(true);
      for (const site of sites) {
        // Static meshes move into spatial batches; surviving moving assemblies
        // must stay within the envelope reserved before batching.
        const bounds = new THREE.Box3().setFromObject(site.root);
        if (!bounds.isEmpty()) assert.ok(site.bounds.containsBox(bounds), site.label);
      }
      scene.traverse((object) => assert.ok(object.matrixWorld.elements.every(Number.isFinite)));
    }
    world.update(99, { motionEnabled: false });
    scene.updateMatrixWorld(true);
    const frozen = world.animated.map((object) => object.matrixWorld.clone());
    world.update(199, { motionEnabled: false });
    scene.updateMatrixWorld(true);
    world.animated.forEach((object, i) => assert.ok(object.matrixWorld.equals(frozen[i])));
    let draws = 0;
    scene.traverse((object) => {
      if (!object.isMesh) return;
      draws++;
      assert.equal(object.castShadow, false);
      for (const attribute of Object.values(object.geometry.attributes))
        assert.ok(attribute.array.every(Number.isFinite));
    });
    assert.ok(draws < 220, `${draws} background draw objects`);
    assert.equal(scene.userData.sceneryClearance.moved, 0);
    assert.equal(scene.userData.sceneryClearance.omitted, 0);
  });
}
