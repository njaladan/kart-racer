import test from "node:test";
import assert from "node:assert/strict";
import { initializeRacer, advanceRacer, botInput } from "../src/simulation/simulation.js";
import { FIXED_DT, MAX_JUMP_TIME, MAX_JUMP_HEIGHT } from "../src/simulation/physics.js";
import { TRACK, projectTrack, RAMPS, metresToProgress } from "../src/track/track.js";

function rampRun(mode) {
  const racer = initializeRacer({
    s: RAMPS[0].t * TRACK - metresToProgress(24),
    x: 0,
    drift: 0,
    spin: 0,
  });
  racer.vx = -Math.sin(racer.yaw) * 30;
  racer.vz = -Math.cos(racer.yaw) * 30;
  let launched = false,
    starts = 0,
    rewards = 0,
    airTime = 0;
  for (let tick = 1; tick < 120 * 5; tick++) {
    const input = botInput(racer, 0, tick * FIXED_DT);
    input.drift =
      mode === "held" ||
      (mode === "buffered" &&
        racer.grounded &&
        racer.s >= RAMPS[0].t * TRACK - metresToProgress(3.8)) ||
      (mode === "early" && launched && racer.airTime < 0.05) ||
      (mode === "late" && launched && racer.airTime > 0.3);
    const events = advanceRacer(racer, input, FIXED_DT, tick * FIXED_DT);
    launched ||= events.launched;
    starts += !!events.trickStarted;
    rewards += !!events.trickLanded;
    airTime = Math.max(airTime, racer.airTime);
    assert.ok(
      racer.worldPos.y - projectTrack(racer.worldPos, racer.s).height <= MAX_JUMP_HEIGHT + 1e-5,
    );
    if (events.landed) return { racer, launched, starts, rewards, airTime };
  }
  assert.fail("ramp hop did not land");
}

test("a fresh trick tap before takeoff or early in a jump earns one landing boost", () => {
  for (const mode of ["buffered", "early"]) {
    const result = rampRun(mode);
    assert.ok(result.launched);
    assert.equal(result.starts, 1);
    assert.equal(result.rewards, 1);
    assert.ok(result.racer.boost >= 0.7);
    assert.equal(result.racer.trickActive, false);
    assert.ok(result.airTime > 0.28 && result.airTime <= MAX_JUMP_TIME);
    const event = advanceRacer(result.racer, { throttle: true }, FIXED_DT, 5);
    assert.equal(event.trickLanded, false);
  }
});

test("ordinary hops, held drift, and late taps do not earn trick rewards", () => {
  for (const mode of ["none", "held", "late"]) {
    const result = rampRun(mode);
    assert.ok(result.launched);
    assert.equal(result.starts, 0, mode);
    assert.equal(result.rewards, 0, mode);
  }
});

test("hits and recovery cancel a pending trick reward", () => {
  const racer = initializeRacer({ s: TRACK * 0.3, x: 0, drift: 0, spin: 0 });
  racer.grounded = false;
  racer.worldPos.y += 0.05;
  racer.vy = -3;
  racer.trickActive = true;
  racer.spin = 1;
  const event = advanceRacer(racer, {}, FIXED_DT, 1);
  assert.equal(event.trickLanded, false);
  assert.equal(racer.trickActive, false);
  racer.trickActive = true;
  racer.trickBuffer = 0.2;
  racer.driftBoost = 1;
  initializeRacer(racer);
  assert.equal(racer.trickActive, false);
  assert.equal(racer.trickBuffer, 0);
  assert.equal(racer.driftBoost, 0);
});
