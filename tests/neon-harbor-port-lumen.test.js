import test from "node:test";
import assert from "node:assert/strict";
import course from "../src/courses/neon-harbor.js";
import { selectCourse, TRACK, activeTrack, CONVEYORS } from "../src/track/track.js";
import { initializeRacer, advanceRacer } from "../src/simulation/simulation.js";
import { trafficAt, trafficContact } from "../src/simulation/hazards.js";
import { FIXED_DT } from "../src/simulation/physics.js";

test("Port Lumen builds eight sections at the planned distance and safe curve radius", () => {
  const track = selectCourse(course);
  assert.deepEqual(
    track.SECTIONS.map((section) => section.id),
    ["promenade", "downtown", "market", "bridge", "cargo", "ferry", "seawall", "boulevard"],
  );
  assert.ok(track.COURSE_LENGTH >= 1800 && track.COURSE_LENGTH <= 2000);
  assert.ok(track.minimumCurveRadius >= course.minimumRadius);
});

test("optional ramps raise only their authored lane", () => {
  selectCourse(course);
  for (const ramp of activeTrack.RAMPS) {
    assert.ok(activeTrack.rampHeight(ramp.t, ramp.offset) > 0);
    assert.equal(activeTrack.rampHeight(ramp.t, ramp.offset + ramp.halfWidth + 0.2), 0);
  }
});

test("bridge traffic poses are shared with physical contact", () => {
  selectCourse(course);
  const traffic = trafficAt(0);
  assert.equal(traffic.length, 4);
  const active = traffic.find((vehicle) => vehicle.active);
  assert.ok(active);
  assert.ok(trafficContact(active.p, 0));
  assert.ok(trafficContact(active.p, 0).penetration > 0);
});

test("the grounded kart receives forward transport from the mandatory conveyor", () => {
  selectCourse(course);
  assert.equal(CONVEYORS.length, 1);
  const belt = CONVEYORS[0];
  assert.equal(belt.fullWidth, true);
  const start = (belt.start + belt.end) / 2;
  const racer = initializeRacer({ s: start * TRACK, x: 0 });
  const previous = racer.s;
  const events = advanceRacer(racer, {}, FIXED_DT, 0);
  assert.equal(events.conveyorMotion, true);
  assert.ok(racer.s > previous);
  assert.equal(racer.grounded, true);
});
