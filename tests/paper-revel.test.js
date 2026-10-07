import test from "node:test";
import assert from "node:assert/strict";
import course from "../src/courses/paper-revel.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { initializeRacer, advanceRacer, botInput } from "../src/simulation/simulation.js";
import { unfoldPhase } from "../src/simulation/course-mechanics.js";
const track = selectCourse(course);
test("paper crossing preserves its two floors and the route takes three different lap forms", () => {
  const upper = track.frameAt(0),
    lower = track.frameAt(0.5);
  assert.ok(upper.p.y - lower.p.y > 45);
  for (const t of [0, 0.5]) {
    const p = track.poseAt(t * TRACK, 0, 0.065).p,
      s = track.projectTrack(p, 0, true);
    assert.ok(Math.abs(s.height - p.y) < 0.03);
  }
  assert.deepEqual(
    track.branches.map((b) => b.lap),
    [0, 1, 2],
  );
  const heights = track.branches.map((b) => b.poseAt(0.5).p.y);
  assert.ok(heights[1] - heights[0] > 20);
  assert.ok(Math.abs(track.branches[2].frameAt(0.5).right.y) > 0.2);
  for (const branch of track.branches) {
    const pose = branch.poseAt(0.5),
      surface = branch.project(pose.p, (branch.start + branch.end) / 2);
    assert.ok(track.floorAt(surface).supported);
    assert.ok(Math.abs(surface.height - pose.p.y) < 0.03);
  }
  for (const time of [30, 60, 120]) assert.equal(unfoldPhase(course, time), 1);
});
test("five AI drivers complete all paper places and layered crossings", () => {
  for (let i = 0; i < 5; i++) {
    const r = initializeRacer({ s: 0, x: 0, skill: 0.9 - i * 0.045 });
    let hits = 0;
    for (let k = 1; k < 120 * 260 && !r.finished; k++) {
      const e = advanceRacer(r, botInput(r, i, k / 120), 1 / 120, k / 120);
      hits += !!e.wallImpact;
    }
    assert.ok(r.finished);
    assert.equal(hits, 0);
  }
});
