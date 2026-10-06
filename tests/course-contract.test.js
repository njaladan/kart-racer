import test from "node:test";
import assert from "node:assert/strict";
import { COURSES } from "../src/courses/registry.js";
import { validateCourseDefinition } from "../src/courses/course-contract.js";
import { createTrack, MIN_ROAD_CURVE_RADIUS } from "../src/track/track-builder.js";

test("registered course descriptors satisfy the shared runtime contract", () => {
  for (const course of COURSES) {
    assert.equal(validateCourseDefinition(course), course);
    const track = createTrack(course);
    assert.equal(track.SECTIONS.length, course.id === "neon-harbor" ? 8 : 6);
    assert.ok(track.minimumCurveRadius >= MIN_ROAD_CURVE_RADIUS);
  }
});

test("track construction rejects road bends below the curvature floor", () => {
  const course = { ...COURSES[0], targetLength: 200 };
  assert.throws(() => createTrack(course), /road curves require at least 40 m radius/);
});

test("course validation reports the path of invalid authored data", () => {
  const course = {
    ...COURSES[0],
    sections: COURSES[0].sections.map((section, index) =>
      index === 2 ? { ...section, halfWidth: 0 } : section,
    ),
  };

  assert.throws(() => validateCourseDefinition(course), /windmill-wilds.*sections\[2\]\.halfWidth/);
});
