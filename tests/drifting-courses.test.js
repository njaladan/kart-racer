import test from "node:test";
import assert from "node:assert/strict";
import { courseById } from "../src/courses/registry.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { initializeRacer, advanceRacer } from "../src/simulation/simulation.js";
import {
  FIXED_DT,
  wrapAngle,
  clamp,
  DRIFT_TIGHT_RADIUS,
  DRIFT_WIDE_RADIUS,
} from "../src/simulation/physics.js";

// Follow the centerline by adjusting drift curvature using travel heading.
// This exercises road geometry, tire momentum, banking, charge and exit together.
for (const [id, section, fraction, expectedTier] of [
  ["windmill-wilds", 6, 0.38, 2],
  ["neon-harbor", 1, 0.62, 1],
  ["frostpeak-festival", 6, 0.5, 2],
  ["sunstone-ruins", 6, 0.02, 2],
]) {
  test(`${id} offers a sustained drift line with a clean mini-turbo exit`, () => {
    const track = selectCourse(courseById(id));
    const state = initializeRacer({
      s: track.sectorT(section, fraction) * TRACK,
      x: 0,
      isPlayer: true,
    });
    state.vx = -Math.sin(state.yaw) * 28;
    state.vz = -Math.cos(state.yaw) * 28;
    let direction = 0;
    for (let i = 0; i < 600; i++) {
      const target = track.poseAt(
        state.s + track.metresToProgress(10 + Math.abs(state.lateralSpeed)),
        0,
      ).p;
      const desired = Math.atan2(-(target.x - state.worldPos.x), -(target.z - state.worldPos.z));
      const travel = Math.atan2(-state.vx, -state.vz);
      const rate = wrapAngle(desired - travel) * 3;
      direction ||= -Math.sign(rate);
      if (-direction * rate < -0.1 && i > 80) break;
      const curvature = (-direction * rate) / Math.max(12, state.speed / 3.6 || 28);
      const steer =
        direction *
        clamp(
          (2 * (curvature - 1 / DRIFT_WIDE_RADIUS)) /
            (1 / DRIFT_TIGHT_RADIUS - 1 / DRIFT_WIDE_RADIUS) -
            1,
          -1,
          1,
        );
      const event = advanceRacer(
        state,
        { throttle: true, steer: i < 15 ? direction : steer, drift: true },
        FIXED_DT,
        i * FIXED_DT,
      );
      assert.equal(event.wallImpact, false);
      assert.equal(event.cartImpact, false);
      assert.ok(Math.abs(state.x) * 6.25 < track.roadHalfWidth(track.trackT(state.s)) - 1);
    }
    assert.equal(state.driftTier, expectedTier);
    const exit = advanceRacer(state, { throttle: true, steer: 0, drift: false }, FIXED_DT, 5);
    assert.equal(exit.turboTier, expectedTier);
    assert.equal(state.driftDirection, 0);
    assert.equal(state.driftTier, 0);
    assert.ok(state.driftBoost > 0);
    for (let i = 0; i < 24; i++)
      advanceRacer(state, { throttle: true, steer: 0, drift: false }, FIXED_DT, 5 + i * FIXED_DT);
    assert.ok(Math.abs(state.lateralSpeed) < 0.65, "exit regains traction promptly");
  });
}

test("releasing on a wall scrape cancels a ready turbo on the same simulation tick", () => {
  const track = selectCourse(courseById("windmill-wilds"));
  const t = track.sectorT(3, 0.3);
  const state = initializeRacer({
    s: t * TRACK,
    x: (-track.roadHalfWidth(t) + 0.1) / 6.25,
    isPlayer: true,
  });
  Object.assign(state, {
    drift: 1,
    driftTier: 2,
    driftTime: 2,
    driftArc: 2,
    driftDirection: 1,
    driftHeld: true,
    driftButtonDown: true,
  });
  state.vx = -Math.sin(state.yaw) * 28;
  state.vz = -Math.cos(state.yaw) * 28;
  const event = advanceRacer(state, { throttle: true, drift: false }, FIXED_DT, 0);
  assert.equal(event.turboTier, 0);
  assert.equal(state.driftTier, 0);
  assert.equal(state.driftDirection, 0);
  assert.equal(state.boost, 0);
});
