import test from "node:test";
import assert from "node:assert/strict";
import { COURSES } from "../courses/registry.js";
import { validateCourseDefinition } from "../course-contract.js";
import { createTrack } from "../track-builder.js";

test("registered course descriptors satisfy the shared runtime contract", () => {
  for (const course of COURSES) {
    assert.equal(validateCourseDefinition(course), course);
    assert.equal(createTrack(course).SECTIONS.length, 6);
  }
});

test("course validation reports the path of invalid authored data", () => {
  const course = {
    ...COURSES[0],
    sections: COURSES[0].sections.map((section, index) =>
      index === 2 ? { ...section, halfWidth: 0 } : section,
    ),
  };

  assert.throws(
    () => validateCourseDefinition(course),
    /windmill-wilds.*sections\[2\]\.halfWidth/,
  );
});
