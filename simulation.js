import {
  drive,
  verticalMotion,
  wallContact,
  chargeDrift,
  resetMotion,
  FIXED_DT,
} from "./physics.js";
import {
  frameAt,
  trackT,
  poseAt,
  projectTrack,
  WORLD_PER_UNIT,
  TRACK,
  yawFor,
} from "./track.js";
import { progressDelta, finishRacer, lapNumber } from "./race.js";

export function initializeRacer(state) {
  resetMotion(state);
  state.worldPos = poseAt(state.s, (state.x || 0) * 6.25, 0.065).p;
  state.yaw = yawFor(frameAt(trackT(state.s)).tangent);
  state.speed = 0;
  state.lap = 0;
  state.finishTime = Infinity;
  state.finished = false;
  return state;
}
export function botInput(state, index, elapsed, rivals = []) {
  const lookahead = frameAt(trackT(state.s + 70 + state.speed * 0.25));
  let lane =
    (index % 2 ? 1 : -1) * (1.2 + Math.sin(elapsed * 0.35 + index) * 0.4);
  // Leave room to pass a slower kart rather than continually pushing it.
  for (const rival of rivals) {
    if (rival === state || rival.finished) continue;
    const gap = progressDelta(rival.s, state.s, TRACK) * WORLD_PER_UNIT;
    if (
      gap > 0 &&
      gap < 13 &&
      Math.abs(rival.x * 6.25 - lane) < 2.5 &&
      rival.speed < state.speed + 5
    )
      lane = rival.x > 0 ? -3.25 : 3.25;
  }
  const target = lookahead.p.clone().addScaledVector(lookahead.right, lane);
  const desired = Math.atan2(
    -(target.x - state.worldPos.x),
    -(target.z - state.worldPos.z),
  );
  const headingError = Math.atan2(
    Math.sin(desired - state.yaw),
    Math.cos(desired - state.yaw),
  );
  const curvature = Math.abs(
    Math.atan2(
      Math.sin(
        yawFor(lookahead.tangent) - yawFor(frameAt(trackT(state.s)).tangent),
      ),
      Math.cos(
        yawFor(lookahead.tangent) - yawFor(frameAt(trackT(state.s)).tangent),
      ),
    ),
  );
  const cruise = 94 + (state.skill || 0.8) * 12 - Math.min(28, curvature * 26);
  return {
    throttle: state.speed < cruise || state.boost > 0,
    brake: state.speed > cruise + 8,
    steer: Math.max(-1, Math.min(1, -headingError * 2.8)),
    drift: false,
  };
}
export function advanceRacer(state, input, dt = FIXED_DT, raceTime = 0) {
  if (state.finished) return {};
  state.prevS = state.s;
  if (!state.renderFrom) state.renderFrom = state.worldPos.clone();
  else state.renderFrom.copy(state.worldPos);
  const previousLap = state.lap;
  for (const key of [
    "boost",
    "star",
    "spin",
    "invulnerable",
    "contactCooldown",
    "padCooldown",
  ])
    state[key] = Math.max(0, (state[key] || 0) - dt);
  const before = projectTrack(state.worldPos, state.s);
  const sliding = drive(
    state,
    input,
    {
      offroad: Math.abs(before.offset) > 8,
      bank: -before.frame.up.dot(before.horizontalRight),
      slope: before.frame.tangent.y,
    },
    dt,
  );
  const projection = projectTrack(state.worldPos, state.s);
  state.s += progressDelta(projection.t * TRACK, state.s, TRACK);
  state.x = projection.offset / 6.25;
  const side = Math.sign(projection.offset),
    penetration = Math.abs(projection.offset) - 8.65;
  const wallImpact = wallContact(
    state,
    projection.horizontalRight.x * side,
    projection.horizontalRight.z * side,
    penetration,
  );
  if (penetration > 0) state.x = (side * 8.65) / 6.25;
  const after = projectTrack(state.worldPos, state.s);
  const slopeVelocity = (after.height - before.height) / dt;
  const wasGrounded = state.grounded;
  // Arcade ramp hops: boost changes horizontal speed, never jump height.
  // Do not infer takeoff from a noisy surface derivative after a collision.
  if (state.grounded && state.speed > 50) {
    const travelled = progressDelta(after.t, before.t, 1);
    for (const crest of [0.2, 0.51, 0.78]) {
      const distance = progressDelta(crest - 0.004, before.t, 1);
      if (travelled > 0 && distance > 0 && distance <= travelled) {
        state.grounded = false;
        state.vy = 3;
        state.airTime = 0;
        break;
      }
    }
  }
  const landed = verticalMotion(state, after.height, slopeVelocity, dt);
  const turboTier = chargeDrift(state, sliding, input.drift, dt);
  if (turboTier)
    state.boost = Math.max(state.boost, turboTier === 2 ? 1.05 : 0.55);
  state.speed = Math.hypot(state.vx, state.vz) * 3.6;
  state.lap = lapNumber(state.s, TRACK, 3) - 1;
  const finished = finishRacer(state, TRACK * 3, raceTime);
  if (finished) {
    const fraction = Math.max(
      0,
      Math.min(1, (TRACK * 3 - state.prevS) / (state.s - state.prevS)),
    );
    state.finishTime = raceTime - dt + dt * fraction;
  }
  return {
    sliding,
    wallImpact,
    landed,
    launched: wasGrounded && !state.grounded,
    turboTier,
    newLap: state.lap > previousLap,
    finished,
  };
}
