import test from "node:test";
import assert from "node:assert/strict";
import course from "../src/courses/emberwing-observatory.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { initializeRacer, advanceRacer, botInput } from "../src/simulation/simulation.js";
import { traversalPose, rangeFor } from "../src/simulation/course-mechanics.js";
import { createRacerState } from "../src/simulation/racer-state.js";
import { packRacer, applyRacer } from "../src/multiplayer/protocol.js";
import { createRaceSession } from "../src/simulation/race-session.js";
const track = selectCourse(course);
test("caldera cannon joins its launch and landing continuously and clears the caldera", () => {
  const d = course.traversals[0],
    { start, end } = rangeFor(track, d);
  assert.ok(
    traversalPose(track, d, 0).p.distanceTo(track.poseAt(start * TRACK, 0, 0.065).p) < 1e-8,
  );
  assert.ok(traversalPose(track, d, 1).p.distanceTo(track.poseAt(end * TRACK, 0, 0.065).p) < 1e-8);
  const apex = traversalPose(track, d, 0.5);
  assert.ok(apex.p.y - track.poseAt(apex.t * TRACK, 0).p.y > 57);
});
test("five drivers launch across the caldera each lap and complete the observatory adventure", () => {
  for (let i = 0; i < 5; i++) {
    const r = initializeRacer({ s: 0, x: 0, skill: 0.9 - i * 0.045 });
    let flights = 0,
      hits = 0;
    for (let k = 1; k < 120 * 270 && !r.finished; k++) {
      const e = advanceRacer(r, botInput(r, i, k / 120), 1 / 120, k / 120);
      flights += !!e.traversalStarted;
      hits += !!e.wallImpact;
    }
    assert.ok(r.finished);
    assert.equal(flights, 3);
    assert.equal(hits, 0);
  }
});

test("cannon snapshots agree through landing, recovery returns to the lip, and restart clears flight", () => {
  const { start } = rangeFor(track, course.traversals[0]);
  const a = initializeRacer(createRacerState({ s: start * TRACK, isPlayer: true }));
  for (let k = 0; k < 110; k++) advanceRacer(a, {}, 1 / 120, k / 120);
  assert.equal(a.traversalIndex, 0);
  assert.ok(a.worldPos.y > 80);
  assert.ok(a.speed > 100);
  const b = createRacerState();
  applyRacer(b, packRacer(a));
  for (let k = 110; k < Math.ceil(course.traversals[0].duration * 120) + 2; k++) {
    advanceRacer(a, {}, 1 / 120, k / 120);
    advanceRacer(b, {}, 1 / 120, k / 120);
    assert.ok(a.worldPos.distanceTo(b.worldPos) < 1e-8);
    assert.equal(a.traversalIndex, b.traversalIndex);
  }
  assert.equal(a.traversalIndex, -1);
  assert.equal(a.grounded, true);
  const session = createRaceSession({
    racers: [a],
    items: { reset() {}, step() {} },
    getPlayerInput: () => ({}),
  });
  a.s = track.sectorT(2, 0.5) * TRACK;
  a.traversalIndex = 0;
  session.recoverPlayer();
  assert.ok(a.s < start * TRACK);
  assert.equal(a.traversalIndex, -1);
  assert.ok(a.worldPos.distanceTo(track.poseAt(a.s, 0, 0.065).p) < 1e-8);
  session.begin();
  assert.equal(a.traversalIndex, -1);
  assert.ok(a.worldPos.y < 20);
});
