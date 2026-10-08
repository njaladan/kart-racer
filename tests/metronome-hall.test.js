import test from "node:test";
import assert from "node:assert/strict";
import course from "../src/courses/metronome-hall.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { initializeRacer, advanceRacer, botInput } from "../src/simulation/simulation.js";
import { pendulumAt, mechanismContact } from "../src/simulation/course-mechanics.js";
const track = selectCourse(course);
test("all beat hazards repeat on the shared clock and require a timed passage", () => {
  for (const d of course.pendulums)
    for (const time of [0, 0.15, 0.5, 1.2]) {
      const a = pendulumAt(track, d, time),
        b = pendulumAt(track, d, time + d.period);
      assert.ok(a.p.distanceTo(b.p) < 1e-8);
      assert.ok(mechanismContact(track, a.p, time));
      const centerTime = (-d.phase * d.period) / (2 * Math.PI);
      for (const offset of [-9, 0, 9]) {
        const lane = track.poseAt(a.t * TRACK, offset, 0.065).p;
        assert.ok(mechanismContact(track, lane, centerTime));
      }
      const center = track.poseAt(a.t * TRACK, 0, 0.065).p;
      assert.equal(mechanismContact(track, center, centerTime + d.period / 4), null);
    }
});
test("a moving kart clears an open beat but hits a closed beat", () => {
  for (const d of course.pendulums) {
    const station = track.sectorT(d.section, d.fraction) * TRACK;
    const centerTime = (-d.phase * d.period) / (2 * Math.PI);
    let closedContacts = 0;
    for (let step = -30; step <= 30; step++) {
      const distance = step / 2;
      const position = track.poseAt(station + distance / track.WORLD_PER_UNIT, 0, 0.065).p;
      const crossingTime = distance / 25;
      closedContacts += !!mechanismContact(track, position, centerTime + crossingTime);
      assert.equal(
        mechanismContact(track, position, centerTime + d.period / 4 + crossingTime),
        null,
      );
    }
    assert.ok(closedContacts > 0);
    const overhead = pendulumAt(track, d, centerTime).p.clone();
    overhead.y += d.height + 2;
    assert.equal(mechanismContact(track, overhead, centerTime), null);
  }
});
test("all five drivers navigate the entire instrument and beat gates without impacts", () => {
  for (let i = 0; i < 5; i++) {
    const r = initializeRacer({ s: 0, x: 0, skill: 0.9 - i * 0.045 });
    let walls = 0,
      contacts = 0,
      timingSteps = 0;
    for (let k = 1; k < 120 * 280 && !r.finished; k++) {
      const e = advanceRacer(r, botInput(r, i, k / 120), 1 / 120, k / 120);
      timingSteps += r.speed < 20 && r.s > 30;
      walls += !!e.wallImpact;
      contacts += !!e.cartImpact;
    }
    assert.ok(r.finished);
    assert.ok(timingSteps > 120, "drivers slow down to time the hammers");
    assert.equal(walls, 0);
    assert.equal(contacts, 0);
  }
});
