import test from "node:test";
import assert from "node:assert/strict";
import course from "../src/courses/clockwork-citadel.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { initializeRacer, advanceRacer, botInput } from "../src/simulation/simulation.js";
import { traversalPose, rangeFor } from "../src/simulation/course-mechanics.js";
import { packRacer, applyRacer } from "../src/multiplayer/protocol.js";
import { createRacerState } from "../src/simulation/racer-state.js";
import { createRaceSession } from "../src/simulation/race-session.js";
const track = selectCourse(course),
  lift = course.traversals[0],
  range = rangeFor(track, lift);

test("Clockwork lift crosses 74 metres vertically with stable level docking frames", () => {
  const bottom = traversalPose(track, lift, 0),
    top = traversalPose(track, lift, 1);
  assert.ok(top.p.y - bottom.p.y > 73);
  for (let i = 1; i < 20; i++) {
    const q = i / 20,
      pose = traversalPose(track, lift, q),
      p = track.projectTrack(pose.p, pose.t * TRACK);
    assert.ok(Math.abs(pose.p.x - bottom.p.x) < 0.25);
    assert.ok(Math.abs(pose.p.z - bottom.p.z) < 0.25);
    assert.ok(pose.up.y > 0.99);
    assert.ok(Math.abs(p.height - pose.p.y) < 0.025);
    assert.ok(Math.abs(p.t - pose.t) < 0.001);
    assert.ok(
      Object.values(p)
        .filter((x) => typeof x === "number")
        .every(Number.isFinite),
    );
  }
});
test("AI completes all Clockwork places and uses each lift on every lap", () => {
  for (let i = 0; i < 5; i++) {
    const r = initializeRacer({ s: 0, x: 0, skill: 0.9 - i * 0.045 });
    let rides = 0,
      hits = 0;
    for (let k = 1; k < 120 * 330 && !r.finished; k++) {
      const e = advanceRacer(r, botInput(r, i, k / 120), 1 / 120, k / 120);
      rides += !!e.traversalStarted;
      hits += !!e.wallImpact;
    }
    assert.ok(r.finished);
    assert.equal(rides, 3);
    assert.ok(hits <= 3);
  }
});
test("two authority replicas share lift timing and recover to a real boarding dock", () => {
  const a = initializeRacer(createRacerState({ s: range.start * TRACK + 0.01, x: 0.15 }));
  advanceRacer(a, {}, 1 / 120, 6);
  const b = createRacerState();
  applyRacer(b, packRacer(a));
  for (let i = 1; i < 120 * 12; i++) {
    const time = 6 + i / 120;
    const ea = advanceRacer(a, {}, 1 / 120, time),
      eb = advanceRacer(b, {}, 1 / 120, time);
    assert.ok(a.worldPos.distanceTo(b.worldPos) < 1e-8);
    assert.equal(ea.traversalFinished, eb.traversalFinished);
    if (ea.traversalFinished) break;
  }
  assert.equal(a.traversalIndex, -1);
  assert.ok(a.grounded);
  const player = createRacerState({ isPlayer: true });
  const session = createRaceSession({
    racers: [player],
    items: { reset() {}, step() {} },
    getPlayerInput: () => ({}),
  });
  player.s = (range.start + range.end) * 0.5 * TRACK;
  player.traversalIndex = 0;
  session.recoverPlayer();
  assert.ok(player.s < range.start * TRACK);
  assert.equal(player.traversalIndex, -1);
  assert.ok(player.worldPos.y < 20);
});
