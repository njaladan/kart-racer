import { racerProjection, updateRouteChoice } from "../track/route-branches.js";
import { routeCarry, trainRampAt } from "./experience-mechanics.js";
export { botInput } from "./ai-driver.js";
import {
  solarBoostAt,
  scaleAt,
  underwaterAt,
  mechanismContact,
  advanceTraversal,
  currentAt,
  bridgeWaveAt,
  bellowsAirAt,
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
  WORLD_PER_UNIT,
  metresToProgress,
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
  const safeChoice = state.routeChoice > 0 ? state.lastSafeRoute || state.routeChoice : 0;
  const safeGroup = state.routeGroup;
  const branch = activeTrack.branches[safeChoice - 1];
  const recoveryDeck = activeTrack.movingSurfaceAt(trackT(state.s));
  if (!branch && recoveryDeck?.gap && !recoveryDeck.docked) {
    // Rejoin a current roof, with a run-up to its ramp, even after the cars move.
    let rewind = recoveryDeck.coordinate - recoveryDeck.spacing / 2;
    if (rewind < 0) rewind += recoveryDeck.spacing;
    state.s -= metresToProgress(rewind);
  }
  const offset = branch ? state.lastSafeOffset || 0 : 0;
  const pose = branch
    ? branch.poseAt((trackT(state.s) - branch.start) / (branch.end - branch.start), offset)
    : poseAt(state.s, 0, 0.065);
  resetMotion(state);
  state.routeChoice = safeChoice;
  state.routeGroup = safeGroup;
  state.lastSafeRoute = safeChoice;
  state.lastSafeOffset = offset;
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
  updateRouteChoice(activeTrack, state);
  const entry = racerProjection(activeTrack, state);
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
    "drumCooldown",
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
  const before = racerProjection(activeTrack, state);
  const sliding = drive(
    state,
    input,
    {
      offroad: before.offroad,
      offroadDrag: before.offroadDrag,
      offroadGrip: before.offroadGrip,
      grip: before.grip * (activeTrack.course.storm ? 0.87 : 1),
      bank: -before.frame.up.dot(before.horizontalRight),
      slope: before.frame.tangent.y,
      normal: activeTrack.branches[before.branchIndex - 1]?.areaSurface ? before.frame.up : null,
      curvature: before.frame.curvature,
    },
    dt,
  );
  const current = currentAt(activeTrack, before.t, raceTime);
  if (state.grounded && current) {
    state.vx += before.horizontalRight.x * current * dt;
    state.vz += before.horizontalRight.z * current * dt;
  }
  const bellowsAir =
    !state.falling && !before.branchIndex && bellowsAirAt(activeTrack, state.worldPos, raceTime);
  if (bellowsAir) {
    state.vx += bellowsAir.x * dt;
    state.vz += bellowsAir.z * dt;
  }
  const ringCarry = routeCarry(activeTrack, state, before, dt);
  const deck = before.movingSurface;
  const previousDeck = state.movingDeckId;
  // Roof jumps retain the express's forward momentum while steering stays relative to it.
  state.movingDeckId = deck && !state.falling ? deck.id : null;
  state.deckCoordinate = state.movingDeckId ? deck.coordinate : 0;
  if (
    state.movingDeckId &&
    (state.grounded || state.jumpKind === "train") &&
    !state.falling &&
    !state.finished
  ) {
    const next = poseAt(
        (before.t + (deck.speed * dt) / activeTrack.COURSE_LENGTH) * TRACK,
        before.offset,
      ),
      currentPose = poseAt(before.t * TRACK, before.offset);
    state.worldPos.x += next.p.x - currentPose.p.x;
    state.worldPos.z += next.p.z - currentPose.p.z;
  }
  let conveyorMotion = false;
  if (state.grounded && !state.finished && !before.branchIndex) {
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
  const projection = racerProjection(activeTrack, state);
  const floor = activeTrack.floorAt(projection);
  const overGap =
    !state.grounded &&
    ["drum", "quarterpipe", "train", "drop", "wave"].includes(state.jumpKind) &&
    state.worldPos.y >= floor.height - 0.5;
  if (!floor.supported && !overGap) {
    state.falling = true;
    state.trickActive = false;
    state.trickBuffer = 0;
  } else if (state.falling) {
    // Once below a platform, driving underneath it cannot snap you onto it.
    if (state.worldPos.y < floor.height - 0.4) floor.supported = false;
    else state.falling = false;
  }
  state.offPathTime =
    (floor.outside && !overGap) || state.falling ? (state.offPathTime || 0) + dt : 0;
  if (!state.falling && (!floor.outside || overGap))
    advanceRaceProgress(
      state,
      projection.t * TRACK,
      TRACK,
      WORLD_PER_UNIT,
      state.worldPos.distanceTo(state.renderFrom),
    );
  state.x = laneFromOffset(projection.offset);
  const selectedBranch = activeTrack.branches[state.routeChoice - 1];
  const bounds = selectedBranch
    ? {
        left: -selectedBranch.halfWidth + 0.9,
        right: selectedBranch.halfWidth - 0.9,
        leftSolid: !selectedBranch.dropToMain && !selectedBranch.areaSurface,
        rightSolid: !selectedBranch.dropToMain && !selectedBranch.areaSurface,
      }
    : collisionBounds(projection.t, 0.9 * state.scale);
  const side = projection.offset < bounds.left ? -1 : 1;
  const edge = side < 0 ? bounds.left : bounds.right;
  const solid = side < 0 ? bounds.leftSolid : bounds.rightSolid;
  const penetration = solid && !state.falling ? side * (projection.offset - edge) : 0;
  let wallImpact = wallContact(
    state,
    projection.horizontalRight.x * side,
    projection.horizontalRight.z * side,
    penetration,
  );
  const areaContact = selectedBranch?.areaSurface?.contactAt(state.worldPos, 0.9 * state.scale);
  if (areaContact && !state.falling)
    wallImpact =
      wallContact(state, areaContact.nx, areaContact.nz, areaContact.penetration) || wallImpact;
  if (penetration > 0) state.x = laneFromOffset(edge);
  const trafficHit = !selectedBranch && trafficContact(state.worldPos, raceTime);
  const contact =
    (!selectedBranch && activeTrack.pathwayContact(state.worldPos, 0.9 * state.scale)) ||
    mechanismContact(activeTrack, state.worldPos, raceTime, 0.9 * state.scale) ||
    trafficHit ||
    (!selectedBranch && cartContact(state.worldPos, raceTime, 0.9 * state.scale));
  const cartImpact = contact
    ? wallContact(state, contact.nx, contact.nz, contact.penetration)
    : false;
  if (cartImpact && state.invulnerable === 0) {
    state.vx *= 0.65;
    state.vz *= 0.65;
    state.invulnerable = 0.8;
    state.drift = 0;
  }
  const after = racerProjection(activeTrack, state);
  const slopeVelocity = (after.height - before.height) / dt;
  const wasGrounded = state.grounded;
  const wave = bridgeWaveAt(activeTrack, after.t, raceTime);
  if (
    !selectedBranch &&
    floor.supported &&
    !after.offroad &&
    state.grounded &&
    state.speed > 45 &&
    !(state.spin > 0) &&
    !contact &&
    penetration <= 0 &&
    state.trickBuffer > 0 &&
    wave.launch
  ) {
    state.grounded = false;
    state.jumpKind = "wave";
    state.jumpTakeoffSpeed = Math.min(12, 8 + wave.velocity * 0.65);
    state.jumpMaxHeight = 6;
    state.trickReward = 1;
    // Start on the current moving deck; its upward momentum adds to the hop.
    state.worldPos.y = after.height;
    state.vy = state.jumpTakeoffSpeed;
    state.airTime = 0;
    state.trickActive = false;
  }
  // Arcade ramp hops: boost changes horizontal speed, never jump height.
  // Do not infer takeoff from a noisy surface derivative after a collision.
  if (floor.supported && state.grounded && state.speed > 50) {
    const travelled = progressDelta(after.t, before.t, 1);
    for (const ramp of selectedBranch ? [] : RAMPS) {
      const distance = progressDelta(ramp.t, before.t, 1);
      const rampWidth = ramp.width ?? (ramp.halfWidth != null ? ramp.halfWidth * 2 : null);
      const onRamp =
        rampWidth == null || Math.abs(after.offset - (ramp.offset ?? 0)) <= rampWidth / 2;
      if (travelled > 0 && distance > 0 && distance <= travelled && onRamp) {
        state.grounded = false;
        state.jumpKind = ramp.kind === "quarterpipe" ? "quarterpipe" : "hop";
        state.jumpTakeoffSpeed = ramp.kind === "quarterpipe" ? 9 : JUMP_TAKEOFF_SPEED;
        state.jumpMaxHeight = ramp.kind === "quarterpipe" ? 5 : 1.1;
        state.trickReward = ramp.kind === "quarterpipe" ? 1 : 0.7;
        state.vy = state.jumpTakeoffSpeed;
        state.airTime = 0;
        state.trickActive = false;
        break;
      }
    }
  }
  const roofRamp = selectedBranch?.ramp;
  const roofLaunch = roofRamp && before.q < roofRamp.lip && after.q >= roofRamp.lip;
  const trainRamp = trainRampAt(activeTrack, deck);
  const trainLaunch =
    trainRamp &&
    deck.supported &&
    deck.coordinate < trainRamp.lip &&
    after.movingSurface?.coordinate >= trainRamp.lip &&
    Math.abs(before.offset - trainRamp.offset) <= trainRamp.width / 2;
  if (state.grounded && state.speed > 45 && (roofLaunch || trainLaunch)) {
    state.grounded = false;
    state.jumpKind = trainLaunch ? "train" : "quarterpipe";
    state.jumpTakeoffSpeed = trainLaunch ? 11 : 9;
    state.jumpMaxHeight = 7;
    state.trickReward = 1;
    state.vy = state.jumpTakeoffSpeed;
    if (trainLaunch) {
      state.falling = false;
      state.offPathTime = 0;
    }
    state.airTime = 0;
    state.trickActive = false;
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
  if (trickLanded) state.boost = Math.max(state.boost, state.trickReward ?? 0.7);
  if (landed || state.spin > 0) state.trickActive = false;
  let drumBounce = null;
  if (support.drum && state.grounded && state.drumCooldown === 0 && !(state.spin > 0)) {
    drumBounce = support.drum.index;
    state.grounded = false;
    state.falling = false;
    state.jumpKind = "drum";
    const nextDrum = activeTrack.drumField.drums[support.drum.index + 1];
    const destination = nextDrum
      ? nextDrum.p
      : poseAt((activeTrack.drumField.end + 12 / activeTrack.COURSE_LENGTH) * TRACK).p;
    const dx = destination.x - state.worldPos.x,
      dz = destination.z - state.worldPos.z;
    const distance = Math.hypot(dx, dz);
    const speed = Math.max(23, Math.min(34, state.speed / 3.6));
    const flightTime = Math.max(0.45, distance / speed, activeTrack.drumField.bounce / 12);
    state.vx = dx / flightTime;
    state.vz = dz / flightTime;
    state.yaw = Math.atan2(-state.vx, -state.vz);
    state.jumpTakeoffSpeed = Math.max(
      7,
      Math.min(19, (destination.y - state.worldPos.y + 12 * flightTime * flightTime) / flightTime),
    );
    state.jumpMaxHeight = 12;
    state.lastDrumIndex = support.drum.index;
    state.lastDrumAt = raceTime;
    state.lastSafeS = state.s;
    state.lastSafeRoute = 0;
    state.lastSafeOffset = after.offset;
    state.trickReward = 0.85;
    state.vy = state.jumpTakeoffSpeed;
    state.airTime = 0;
    state.air = 1;
    state.drumCooldown = 0.2;
    state.offPathTime = 0;
  }
  // Even a glancing wall scrape interrupts the attempt. Cancel after contact
  // and vertical motion so releasing on the collision/takeoff tick cannot pay.
  if (penetration > 0 || areaContact || contact || !state.grounded || landed) cancelDrift(state);
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
  if (state.grounded && !after.offroad && !state.falling) {
    state.lastSafeS = state.s;
    state.lastSafeRoute = state.routeChoice;
    state.lastSafeOffset = after.offset;
  }
  updateRouteChoice(activeTrack, state);
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
    ringCarry,
    bellowsPuff: !!bellowsAir,
    drumBounce,
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
