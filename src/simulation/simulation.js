export { botInput } from "./ai-driver.js";
import {
  solarBoostAt,
  scaleAt,
  underwaterAt,
  mechanismContact,
  advanceTraversal,
  currentAt,
} from "./course-mechanics.js";
import {
  drive,
  verticalMotion,
  wallContact,
  chargeDrift,
  cancelDrift,
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
import { cartContact, trafficContact } from "./hazards.js";

export function initializeRacer(state) {
  resetMotion(state);
  state.lastSafeS = state.s;
  state.scale = scaleAt(activeTrack, trackT(state.s));
  state.underwater = underwaterAt(activeTrack, trackT(state.s));
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

/** Recovery runs in authority and prediction, with the same interpolation reset. */
export function recoverRacer(state) {
  state.recoveryCount = (state.recoveryCount || 0) + 1;
  if (state.traversalIndex >= 0) {
    const traversal = activeTrack.course.traversals?.[state.traversalIndex];
    if (traversal)
      state.s =
        Math.floor(state.s / TRACK) * TRACK +
        activeTrack.sectorT(traversal.section, traversal.startFraction) * TRACK -
        2;
  } else if ((state.falling || state.offPathTime > 0) && Number.isFinite(state.lastSafeS)) {
    state.s = state.lastSafeS;
  }
  const pose = poseAt(state.s, 0, 0.065);
  resetMotion(state);
  state.worldPos.copy(pose.p);
  if (!state.renderFrom) state.renderFrom = pose.p.clone();
  else state.renderFrom.copy(pose.p);
  state.yaw = yawFor(pose.tangent);
  state.renderYawFrom = state.yaw;
  state.prevS = state.s;
  state.lastSafeS = state.s;
  state.x = 0;
  state.speed = 0;
  state.spin = 0;
  state.boost = 0;
  state.scale = scaleAt(activeTrack, trackT(state.s));
  state.underwater = underwaterAt(activeTrack, trackT(state.s));
  state.invulnerable = 1.5;
  state.visualOffset?.set(0, 0, 0);
  state.visualYawOffset = 0;
}
export function advanceRacer(state, input, dt = FIXED_DT, raceTime = 0, totalLaps = 3) {
  if (state.finished) return {};
  activeTrack.setTime(raceTime);
  state.scale = scaleAt(activeTrack, trackT(state.s));
  state.underwater = underwaterAt(activeTrack, trackT(state.s));
  const entry = projectTrack(state.worldPos, state.s);
  const transit =
    !state.falling &&
    !entry.offroad &&
    advanceTraversal(state, activeTrack, dt, raceTime, advanceRaceProgress);
  if (transit) {
    cancelDrift(state);
    state.driftButtonDown = !!input.drift;
    state.driftHeld = !!input.drift;
    return transit;
  }
  const hitWasActive = state.spin > 0;
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
  if (hitWasActive) {
    state.hitFlipElapsed = Math.min(state.hitFlipDuration, state.hitFlipElapsed + dt);
    const progress = state.hitFlipDuration ? state.hitFlipElapsed / state.hitFlipDuration : 1;
    const flight = Math.min(1, progress / 0.82);
    const landing = Math.max(0, (progress - 0.82) / 0.18);
    state.hitLift =
      Math.sin(flight * Math.PI) * 1.35 +
      Math.abs(Math.sin(landing * Math.PI * 2)) * Math.exp(-landing * 4) * 0.28;
  }
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
      curvature: before.frame.curvature,
    },
    dt,
  );
  const current = currentAt(activeTrack, before.t, raceTime);
  if (state.grounded && current) {
    state.vx += before.horizontalRight.x * current * dt;
    state.vz += before.horizontalRight.z * current * dt;
  }
  const deck = before.movingSurface;
  const previousDeck = state.movingDeckId;
  state.movingDeckId = state.grounded && deck ? deck.id : null;
  state.deckCoordinate = state.movingDeckId ? deck.coordinate : 0;
  if (state.movingDeckId && !state.finished) {
    const next = poseAt(
        (before.t + (deck.speed * dt) / activeTrack.COURSE_LENGTH) * TRACK,
        before.offset,
      ),
      currentPose = poseAt(before.t * TRACK, before.offset);
    state.worldPos.x += next.p.x - currentPose.p.x;
    state.worldPos.z += next.p.z - currentPose.p.z;
  }
  let conveyorMotion = false;
  if (state.grounded && !state.finished) {
    for (const belt of activeTrack.CONVEYORS) {
      if (before.t < belt.start || before.t > belt.end) continue;
      const inBounds = before.offset >= before.leftEdge && before.offset <= before.rightEdge;
      if (belt.fullWidth !== false && !inBounds) continue;
      if (
        belt.fullWidth === false &&
        Math.abs(before.offset - (belt.offset || 0)) > (belt.width || 4) / 2
      )
        continue;
      const metres = before.t * activeTrack.COURSE_LENGTH;
      const fromStart = metres - belt.start * activeTrack.COURSE_LENGTH;
      const toEnd = belt.end * activeTrack.COURSE_LENGTH - metres;
      const blend =
        belt.blendDistance > 0
          ? Math.min(
              1,
              Math.max(0, fromStart / belt.blendDistance),
              Math.max(0, toEnd / belt.blendDistance),
            )
          : 1;
      const tangent = before.frame.tangent;
      const horizontalLength = Math.hypot(tangent.x, tangent.z) || 1;
      state.worldPos.x += (tangent.x / horizontalLength) * belt.speed * blend * dt;
      state.worldPos.z += (tangent.z / horizontalLength) * belt.speed * blend * dt;
      conveyorMotion = true;
      break;
    }
  }
  if (hitWasActive && state.spin === 0) {
    state.vx = state.vz = state.speed = state.longitudinalSpeed = state.lateralSpeed = 0;
    state.yaw = state.hitStartYaw;
    state.yawRate = 0;
    state.hitLift = 0;
  }
  const projection = projectTrack(state.worldPos, state.s);
  const floor = activeTrack.floorAt(projection);
  if (!floor.supported) {
    state.falling = true;
    state.trickActive = false;
    state.trickBuffer = 0;
  } else if (state.falling) {
    // Once below a platform, driving underneath it cannot snap you onto it.
    if (state.worldPos.y < floor.height - 0.4) floor.supported = false;
    else state.falling = false;
  }
  state.offPathTime = floor.outside || state.falling ? (state.offPathTime || 0) + dt : 0;
  if (!state.falling && !floor.outside)
    advanceRaceProgress(
      state,
      projection.t * TRACK,
      TRACK,
      WORLD_PER_UNIT,
      state.worldPos.distanceTo(state.renderFrom),
    );
  state.x = laneFromOffset(projection.offset);
  const bounds = collisionBounds(projection.t, 0.9 * state.scale);
  const side = projection.offset < bounds.left ? -1 : 1;
  const edge = side < 0 ? bounds.left : bounds.right;
  const solid = side < 0 ? bounds.leftSolid : bounds.rightSolid;
  const penetration = solid && !state.falling ? side * (projection.offset - edge) : 0;
  const wallImpact = wallContact(
    state,
    projection.horizontalRight.x * side,
    projection.horizontalRight.z * side,
    penetration,
  );
  if (penetration > 0) state.x = laneFromOffset(edge);
  const trafficHit = trafficContact(state.worldPos, raceTime);
  const contact =
    activeTrack.pathwayContact(state.worldPos, 0.9 * state.scale) ||
    mechanismContact(activeTrack, state.worldPos, raceTime, 0.9 * state.scale) ||
    trafficHit ||
    cartContact(state.worldPos, raceTime, 0.9 * state.scale);
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
  if (floor.supported && state.grounded && state.speed > 50) {
    const travelled = progressDelta(after.t, before.t, 1);
    for (const ramp of RAMPS) {
      const distance = progressDelta(ramp.t, before.t, 1);
      const rampWidth = ramp.width ?? (ramp.halfWidth != null ? ramp.halfWidth * 2 : null);
      const onRamp =
        rampWidth == null || Math.abs(after.offset - (ramp.offset ?? 0)) <= rampWidth / 2;
      if (travelled > 0 && distance > 0 && distance <= travelled && onRamp) {
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
    !state.falling &&
    !state.grounded &&
    !state.trickActive &&
    !(state.spin > 0) &&
    state.airTime <= 0.28 &&
    state.trickBuffer > 0;
  if (trickStarted) {
    state.trickActive = true;
    state.trickBuffer = 0;
    state.trickVariant = (state.trickCount || 0) % 3;
    state.trickCount = (state.trickCount || 0) + 1;
    state.trickAge = 0;
  }
  if (state.trickActive) state.trickAge = (state.trickAge || 0) + dt;
  const support = activeTrack.floorAt(after);
  const landed = verticalMotion(
    state,
    support.height,
    slopeVelocity,
    dt,
    floor.supported && support.supported,
  );
  const trickLanded = landed && state.trickActive && !(state.spin > 0);
  if (trickLanded) state.boost = Math.max(state.boost, 0.7);
  if (landed || state.spin > 0) state.trickActive = false;
  // Even a glancing wall scrape interrupts the attempt. Cancel after contact
  // and vertical motion so releasing on the collision/takeoff tick cannot pay.
  if (penetration > 0 || contact || !state.grounded || landed) cancelDrift(state);
  const turboTier = chargeDrift(state, sliding && !!state.driftDirection, input.drift, dt);
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
  if (state.grounded && state.padCooldown === 0) {
    const duration = solarBoostAt(activeTrack, after.t, after.offset, raceTime);
    if (duration) {
      state.boost = Math.max(state.boost, duration);
      state.padCooldown = 0.7;
      padBoost = true;
    }
  }
  state.x = laneFromOffset(after.offset);
  state.speed = Math.hypot(state.vx, state.vz) * 3.6;
  if (state.grounded && !after.offroad && !state.falling) state.lastSafeS = state.s;
  if (
    !Number.isFinite(state.worldPos.y) ||
    (state.falling && (state.airTime > 1.15 || state.worldPos.y < after.height - 14)) ||
    state.offPathTime > 1.4
  ) {
    recoverRacer(state);
    return { recovered: true };
  }
  state.lap = lapNumber(state.s, TRACK, totalLaps) - 1;
  const finished =
    state.nextCheckpoint > CHECKPOINT_COUNT * totalLaps &&
    finishRacer(state, TRACK * totalLaps, raceTime);
  if (finished) {
    const fraction = Math.max(
      0,
      Math.min(1, (TRACK * totalLaps - state.prevS) / (state.s - state.prevS)),
    );
    state.finishTime = raceTime - dt + dt * fraction;
  }
  return {
    sliding: sliding && !!state.driftDirection,
    wallImpact,
    cartImpact,
    trafficImpact: !!trafficHit && cartImpact,
    conveyorMotion,
    deckBoarded: !!state.movingDeckId && previousDeck !== state.movingDeckId,
    deckLeft: !!previousDeck && previousDeck !== state.movingDeckId,
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
