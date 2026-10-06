import test from "node:test";
import assert from "node:assert/strict";
import course from "../src/courses/paper-revel.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { initializeRacer, advanceRacer, botInput } from "../src/simulation/simulation.js";
import { unfoldPhase } from "../src/simulation/course-mechanics.js";
const track = selectCourse(course);
test("paper crossing preserves its two floors and the fan opens once without closing on racers", () => {
  const upper = track.frameAt(0),
    lower = track.frameAt(0.5);
  assert.ok(upper.p.y - lower.p.y > 45);
  for (const t of [0, 0.5]) {
    const p = track.poseAt(t * TRACK, 0, 0.065).p,
      s = track.projectTrack(p, 0, true);
    assert.ok(Math.abs(s.height - p.y) < 0.03);
  }
  const verge = track.VERGES.find((v) => v.gate === "unfold"),
    mid = (verge.start + verge.end) / 2;
  for (const time of [0, 27, 28, 29]) {
    track.setTime(time);
    assert.equal(track.vergeWidth(mid, 1), 0);
  }
  for (const time of [30, 60, 120]) {
    track.setTime(time);
    assert.equal(unfoldPhase(course, time), 1);
    assert.equal(track.vergeWidth(mid, 1), 13);
  }
  for (let i = 1; i < 30; i++) {
    const t = verge.start + ((verge.end - verge.start) * i) / 30,
      w = track.vergeWidth(t, 1),
      offset = track.roadHalfWidth(t) + w * 0.5;
    const p = track.poseAt(t * TRACK, offset, 0.065).p,
      s = track.projectTrack(p, t * TRACK);
    assert.ok(Math.abs(s.height - p.y) < 0.03);
    assert.ok(s.rightEdge > offset);
  }
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
