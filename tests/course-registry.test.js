import test from "node:test";
import assert from "node:assert/strict";
import { COURSES, courseById, findCourseById } from "../src/courses/registry.js";
import {
  selectCourse,
  activeTrack,
  COURSE_LENGTH,
  SECTIONS,
  poseAt,
  projectTrack,
  surfaceAt,
  collisionBounds,
  TRACK,
} from "../src/track/track.js";
import { cartAt, cartContact } from "../src/simulation/hazards.js";

// A single process switches through every course, exercising live engine bindings.
test("course selection updates geometry, surfaces and hazards without stale course state", () => {
  assert.equal(COURSES.length, 5);
  assert.equal(new Set(COURSES.map((c) => c.id)).size, COURSES.length);
  assert.equal(courseById("missing").id, "windmill-wilds");
  assert.equal(findCourseById("missing"), null);
  assert.equal(findCourseById(COURSES[1].id), COURSES[1]);
  for (const course of [...COURSES, COURSES[0]]) {
    selectCourse(course);
    assert.equal(activeTrack.course, course);
    const isLongCourse = ["neon-harbor", "sunstone-ruins", "frostpeak-festival"].includes(
      course.id,
    );
    assert.ok(
      course.topology === "adventure" && course.id !== "sunstone-ruins"
        ? Math.abs(COURSE_LENGTH - course.targetLength) < course.targetLength * 0.08
        : isLongCourse
          ? COURSE_LENGTH >= 1800 && COURSE_LENGTH <= 2000
          : COURSE_LENGTH >= 1450 && COURSE_LENGTH <= 1600,
    );
    assert.equal(SECTIONS.length, course.sections.length);
    for (let i = 0; i < 120; i++) {
      const t = i / 120,
        p = poseAt(t * TRACK, 2, 0.065).p,
        s = projectTrack(p, t * TRACK);
      assert.ok(Math.abs(s.offset - 2 * Math.hypot(s.frame.right.x, s.frame.right.z)) < 0.12);
      assert.ok(Number.isFinite(s.height));
      const surface = surfaceAt(t),
        kart = collisionBounds(t),
        shell = collisionBounds(t, 0.55);
      assert.ok(Math.abs(kart.left - 0.9 - surface.leftEdge) < 1e-9);
      assert.ok(Math.abs(shell.right + 0.55 - surface.rightEdge) < 1e-9);
    }
    for (
      let time = course.hazard.activation;
      time < course.hazard.activation + course.hazard.period;
      time += 0.1
    ) {
      const hazard = cartAt(time);
      assert.equal(hazard.halfWidth, course.hazard.halfWidth);
      assert.equal(cartContact(poseAt(hazard.s, course.hazard.safeLane, 0.065).p, time), null);
    }
    for (const patch of activeTrack.SURFACES) {
      const mid = (patch.start + patch.end) / 2;
      assert.equal(surfaceAt(mid).material, patch.material);
      assert.equal(surfaceAt(mid).grip, patch.grip);
      assert.equal(surfaceAt(patch.start - 0.001).material, SECTIONS[patch.section].material);
      assert.equal(surfaceAt(patch.end + 0.001).material, SECTIONS[patch.section].material);
    }
  }
});
