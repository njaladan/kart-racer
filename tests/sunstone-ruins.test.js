import test from "node:test";
import assert from "node:assert/strict";
import course from "../src/courses/sunstone-ruins.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { initializeRacer, advanceRacer, botInput } from "../src/simulation/simulation.js";
import { cartAt, cartContact } from "../src/simulation/hazards.js";
import { solarLaneAt, solarBoostAt } from "../src/simulation/course-mechanics.js";
const track = selectCourse(course);

test("Sunstone expedition connects eight places and a buried temple with continuous surfaces", () => {
  assert.equal(track.SECTIONS.length, 8);
  assert.ok(track.COURSE_LENGTH > 1750 && track.COURSE_LENGTH < 1850);
  const heights = Array.from({ length: 1000 }, (_, i) => track.frameAt(i / 1000).p.y);
  assert.ok(Math.max(...heights) - Math.min(...heights) > 60);
  for (let i = 0; i < 1000; i++) {
    const t = i / 1000,
      p = track.poseAt(t * TRACK, 0, 0.065).p;
    const projection = track.projectTrack(p, t * TRACK);
    assert.ok(Math.abs(projection.height - p.y) < 0.02);
    const next = track.frameAt((i + 1) / 1000).p;
    assert.ok(p.distanceTo(next) < 3, "No accidental route seams");
  }
});

test("all five drivers finish the rebuilt adventure without wall hits", () => {
  for (let i = 0; i < 5; i++) {
    const r = initializeRacer({ s: 0, x: 0, skill: 0.9 - i * 0.045 });
    let hits = 0;
    for (let k = 1; k < 120 * 240 && !r.finished; k++) {
      const e = advanceRacer(r, botInput(r, i, k / 120), 1 / 120, k / 120);
      hits += !!e.wallImpact;
    }
    assert.ok(r.finished);
    assert.equal(hits, 0);
    assert.ok(r.finishTime > 190 && r.finishTime < 215);
  }
});

test("solar lanes match moving lens pads and the sentinel preserves a safe bypass", () => {
  for (let time = 0; time < 48; time += 0.25) {
    for (const [i, f] of course.solarEngine.fractions.entries()) {
      const t = track.sectorT(course.solarEngine.section, f),
        offset = solarLaneAt(course, time, i);
      assert.equal(solarBoostAt(track, t, offset, time), course.solarEngine.duration);
      assert.equal(solarBoostAt(track, t, offset + 4.3, time), 0);
      const bounds = track.collisionBounds(t);
      assert.ok(offset > bounds.left && offset < bounds.right);
    }
    const h = cartAt(time);
    assert.equal(cartContact(track.poseAt(h.s, course.hazard.safeLane, 0.065).p, time), null);
  }
});

test("sand cut and temple apron share ground, boundaries and ordered route identity", () => {
  for (const patch of [track.SHORTCUT, ...track.VERGES]) {
    for (let t = patch.start + 0.01; t < patch.end - 0.01; t += 0.005) {
      const side = patch.side ?? 1,
        width =
          side < 0
            ? track.vergeWidth(t, side)
            : Math.max(track.shortcutWidth(t), track.vergeWidth(t, side));
      const offset = side * (track.roadHalfWidth(t) + width * 0.45),
        p = track.poseAt(t * TRACK, offset, 0.065).p;
      const s = track.projectTrack(p, t * TRACK);
      assert.ok(Math.abs(s.height - p.y) < 0.04);
      assert.ok(Math.abs(s.t - t) < 0.001);
      assert.ok(offset > s.leftEdge && offset < s.rightEdge);
    }
  }
});
