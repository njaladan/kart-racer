import {
  drive,
  verticalMotion,
  wallContact,
  chargeDrift,
  resetMotion,
  FIXED_DT,
  JUMP_TAKEOFF_SPEED,
} from "./physics.js";
import {
  frameAt,
  trackT,
  poseAt,
  projectTrack,
  WORLD_PER_UNIT,
  TRACK,
  yawFor,
  activeTrack,
  metresToProgress,
  collisionBounds,
  RAMPS,
  BOOST_PADS,
  laneWidth,
  laneFromOffset,
} from "../track/track.js";
import {
  progressDelta,
  finishRacer,
  lapNumber,
  resetRaceProgress,
  advanceRaceProgress,
  CHECKPOINT_COUNT,
} from "./race.js";
import { cartAt, cartContact } from "./hazards.js";

export function initializeRacer(state) {
  resetMotion(state);
  state.worldPos = poseAt(state.s, laneWidth(state.x || 0), 0.065).p;
  state.yaw = yawFor(frameAt(trackT(state.s)).tangent);
  state.renderYawFrom = state.yaw;
  state.speed = 0;
  state.lap = 0;
  state.finishTime = Infinity;
  state.finished = false;
  resetRaceProgress(state, TRACK);
  return state;
}
export function botInput(state, index, elapsed, rivals = []) {
  const aheadMetres = 12 + state.speed * 0.1;
  const aheadT = trackT(state.s + metresToProgress(aheadMetres));
  const lookahead = frameAt(aheadT);
  const bounds = collisionBounds(aheadT);
  let lane = (index % 2 ? 1 : -1) * (1.2 + Math.sin(elapsed * 0.35 + index) * 0.4);
  // Leave room to pass a slower kart rather than continually pushing it.
  for (const rival of rivals) {
    if (rival === state || rival.finished) continue;
    const gap = progressDelta(rival.s, state.s, TRACK) * WORLD_PER_UNIT;
    if (
      gap > 0 &&
      gap < 13 &&
      Math.abs(laneWidth(rival.x) - lane) < 2.5 &&
      rival.speed < state.speed + 5
    )
      lane = rival.x > 0 ? -3.25 : 3.25;
  }
  const cart = cartAt(elapsed);
  const cartGap = progressDelta(cart.s, state.s, TRACK) * WORLD_PER_UNIT;
  if (cartGap > -6 && cartGap < 40) lane = activeTrack.course.hazard.safeLane;
  lane = Math.max(bounds.left + 1.1, Math.min(bounds.right - 1.1, lane));
  const target = lookahead.p.clone().addScaledVector(lookahead.right, lane);
  const desired = Math.atan2(-(target.x - state.worldPos.x), -(target.z - state.worldPos.z));
  const headingError = Math.atan2(Math.sin(desired - state.yaw), Math.cos(desired - state.yaw));
  const curvature = Math.abs(
    Math.atan2(
      Math.sin(yawFor(lookahead.tangent) - yawFor(frameAt(trackT(state.s)).tangent)),
      Math.cos(yawFor(lookahead.tangent) - yawFor(frameAt(trackT(state.s)).tangent)),
    ),
  );
  const radius = aheadMetres / Math.max(0.04, curvature);
  const safeCornerSpeed = Math.sqrt(18 * radius) * 3.6;
  const cruise = Math.min(89.5 + (state.skill || 0.8) * 8, safeCornerSpeed);
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
  state.renderYawFrom = state.yaw;
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
    "driftBoost",
  ])
    state[key] = Math.max(0, (state[key] || 0) - dt);
  const trickPressed = !!input.drift && !state.trickHeld;
  state.trickHeld = !!input.drift;
  state.trickBuffer = trickPressed ? 0.22 : Math.max(0, state.trickBuffer - dt);
  const before = projectTrack(state.worldPos, state.s);
  const sliding = drive(
    state,
    input,
    {
      offroad: before.offroad,
      offroadDrag: before.offroadDrag,
      offroadGrip: before.offroadGrip,
      grip: before.grip,
      bank: -before.frame.up.dot(before.horizontalRight),
      slope: before.frame.tangent.y,
    },
    dt,
  );
  const projection = projectTrack(state.worldPos, state.s);
  advanceRaceProgress(
    state,
    projection.t * TRACK,
    TRACK,
    WORLD_PER_UNIT,
    state.worldPos.distanceTo(state.renderFrom),
  );
  state.x = laneFromOffset(projection.offset);
  const bounds = collisionBounds(projection.t);
  const side = projection.offset < bounds.left ? -1 : 1;
  const edge = side < 0 ? bounds.left : bounds.right;
  const penetration = side * (projection.offset - edge);
  const wallImpact = wallContact(
    state,
    projection.horizontalRight.x * side,
    projection.horizontalRight.z * side,
    penetration,
  );
  if (penetration > 0) state.x = laneFromOffset(edge);
  const contact = cartContact(state.worldPos, raceTime);
  const cartImpact = contact
    ? wallContact(state, contact.nx, contact.nz, contact.penetration)
    : false;
  if (cartImpact && state.invulnerable === 0) {
    state.vx *= 0.65;
    state.vz *= 0.65;
    state.invulnerable = 0.8;
    state.drift = 0;
  }
  const after = projectTrack(state.worldPos, state.s);
  const slopeVelocity = (after.height - before.height) / dt;
  const wasGrounded = state.grounded;
  // Arcade ramp hops: boost changes horizontal speed, never jump height.
  // Do not infer takeoff from a noisy surface derivative after a collision.
  if (state.grounded && state.speed > 50) {
    const travelled = progressDelta(after.t, before.t, 1);
    for (const ramp of RAMPS) {
      const distance = progressDelta(ramp.t, before.t, 1);
      if (travelled > 0 && distance > 0 && distance <= travelled) {
        state.grounded = false;
        state.vy = JUMP_TAKEOFF_SPEED;
        state.airTime = 0;
        state.trickActive = false;
        break;
      }
    }
  }
  // A fresh tap shortly before takeoff or early in the jump earns one trick.
  const trickStarted =
    !state.grounded &&
    !state.trickActive &&
    !(state.spin > 0) &&
    state.airTime <= 0.28 &&
    state.trickBuffer > 0;
  if (trickStarted) {
    state.trickActive = true;
    state.trickBuffer = 0;
  }
  const landed = verticalMotion(state, after.height, slopeVelocity, dt);
  const trickLanded = landed && state.trickActive && !(state.spin > 0);
  if (trickLanded) state.boost = Math.max(state.boost, 0.7);
  if (landed || state.spin > 0) state.trickActive = false;
  const turboTier = chargeDrift(state, sliding, input.drift, dt);
  if (turboTier) {
    state.boost = Math.max(state.boost, turboTier === 2 ? 1.05 : 0.55);
    state.driftBoost = turboTier === 2 ? 1.05 : 0.55;
    state.driftBoostTier = turboTier;
  }
  let padBoost = false;
  if (state.grounded && state.padCooldown === 0) {
    for (const pad of BOOST_PADS) {
      if (
        Math.abs(progressDelta(state.s, pad.t * TRACK, TRACK)) * WORLD_PER_UNIT < 3.4 &&
        Math.abs(after.offset - pad.offset) < 2.25
      ) {
        state.boost = Math.max(state.boost, pad.duration);
        state.padCooldown = 0.7;
        padBoost = true;
        break;
      }
    }
  }
  state.x = laneFromOffset(after.offset);
  state.speed = Math.hypot(state.vx, state.vz) * 3.6;
  state.lap = lapNumber(state.s, TRACK, 3) - 1;
  const finished =
    state.nextCheckpoint > CHECKPOINT_COUNT * 3 && finishRacer(state, TRACK * 3, raceTime);
  if (finished) {
    const fraction = Math.max(0, Math.min(1, (TRACK * 3 - state.prevS) / (state.s - state.prevS)));
    state.finishTime = raceTime - dt + dt * fraction;
  }
  return {
    sliding,
    wallImpact,
    cartImpact,
    padBoost,
    landed,
    launched: wasGrounded && !state.grounded,
    trickStarted,
    trickLanded,
    turboTier,
    newLap: state.lap > previousLap,
    finished,
  };
}
