import test from "node:test";
import assert from "node:assert/strict";
import course from "../src/courses/metronome-hall.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { initializeRacer, advanceRacer, botInput } from "../src/simulation/simulation.js";
import { pendulumAt, mechanismContact } from "../src/simulation/course-mechanics.js";
const track = selectCourse(course);
test("all beat hazards repeat on the shared clock and leave a readable outside line", () => {
  for (const d of course.pendulums)
    for (const time of [0, 0.15, 0.5, 1.2]) {
      const a = pendulumAt(track, d, time),
        b = pendulumAt(track, d, time + d.period);
      assert.ok(a.p.distanceTo(b.p) < 1e-8);
      assert.ok(mechanismContact(track, a.p, time));
      const safe = track.poseAt(a.t * TRACK, -7.4, 0.065).p;
      assert.equal(mechanismContact(track, safe, time), null);
    }
});
test("all five drivers navigate the entire instrument and beat gates without impacts", () => {
  for (let i = 0; i < 5; i++) {
    const r = initializeRacer({ s: 0, x: 0, skill: 0.9 - i * 0.045 });
    let walls = 0,
      contacts = 0;
    for (let k = 1; k < 120 * 280 && !r.finished; k++) {
      const e = advanceRacer(r, botInput(r, i, k / 120), 1 / 120, k / 120);
      walls += !!e.wallImpact;
      contacts += !!e.cartImpact;
    }
    assert.ok(r.finished);
    assert.equal(walls, 0);
    assert.equal(contacts, 0);
  }
});
