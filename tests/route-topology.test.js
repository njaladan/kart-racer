import test from "node:test";
import assert from "node:assert/strict";
import { createTrack, TRACK } from "../src/track/track-builder.js";
import course from "../src/courses/sunstone-ruins.js";

test("global projection chooses the right deck at an elevated crossing", () => {
  const controls = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    return [Math.sin(a) * 260, 28 + Math.cos(a) * 24, Math.sin(2 * a) * 155];
  });
  const track = createTrack({
    ...course,
    controls,
    minimumRadius: 18,
    sections: course.sections.map((s, i) => ({ ...s, controlIndex: i * 6 })),
  });
  for (const t of [0, 0.5]) {
    const p = track.poseAt(t * TRACK, 0).p;
    const result = track.projectTrack(p, 0, true);
    assert.ok(Math.abs(result.height - p.y) < 0.1);
    assert.ok(Math.abs(result.t - t) < 0.001 || result.t > 0.999);
    assert.match(result.routeId, /^sunstone-ruins:/);
  }
  const upper = track.poseAt(0, 0, 1).p;
  assert.ok(track.projectTrack(upper, 0).t < 0.001);
});
