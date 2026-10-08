// World distances are metres; velocity is metres/second. Track coordinates
// are used for surface queries and race progress, never to steer the vehicle.
export const FIXED_DT = 1 / 120;
export const MAX_SPEED = 112; // km/h
export const AI_MAX_SPEED = 126; // tougher rivals still obey traction and braking
export const MAX_BOOST_SPEED = 144; // km/h
export const FULL_SPEED_TURN_RADIUS = 22; // metres, also maintained during boosts
const AI_DRIFT_TURN_RADIUS = 17; // metres
const AI_LOW_SPEED_TURN_RADIUS = 5; // metres
export const MAX_REVERSE_SPEED = 46; // km/h
export const JUMP_GRAVITY = 24;
export const MAX_JUMP_HEIGHT = 1.1; // metres above the racing surface
export const MAX_JUMP_TIME = 0.85;
export const JUMP_TAKEOFF_SPEED = 6;
const LOW_SPEED_YAW_RATE = 2.2; // radians/second
const PLAYER_TURN_RAMP_SPEED = (MAX_SPEED / 3.6) * 0.75; // metres/second
const LOW_SPEED_STEER_RAMP = 4; // metres/second
export const DRIFT_TIGHT_RADIUS = 17; // inward steering at cruise and boost speed
export const DRIFT_WIDE_RADIUS = 120; // countersteering opens the line without flipping it
export const DRIFT_RECOVERY_TIME = 0.3;
const DRIFT_ENTRY_SPEED = 12; // metres/second; no stationary or low-speed farming
const DRIFT_HOLD_SPEED = 10;
const DRIFT_ENTRY_TIME = 0.18;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function resetMotion(state) {
  Object.assign(state, {
    vx: 0,
    vz: 0,
    vy: 0,
    airTime: 0,
    yawRate: 0,
    hitFlipDuration: 0,
    hitFlipElapsed: 0,
    hitFlipDirection: 1,
    hitSlideVx: 0,
    hitSlideVz: 0,
    hitStartYaw: 0,
    hitLift: 0,
    steering: 0,
    grounded: true,
    falling: false,
    offPathTime: 0,
    lastSafeS: null,
    reverseHold: 0,
    lateralSpeed: 0,
    longitudinalSpeed: 0,
    contactCooldown: 0,
    invulnerable: 0,
    drift: 0,
    driftTier: 0,
    driftHeld: false,
    driftButtonDown: false,
    driftCooldown: 0,
    driftAge: 0,
    driftExit: 0,
    driftTime: 0,
    driftArc: 0,
    driftTurnRate: 0,
    driftSurfaceValid: false,
    driftCornerQuality: 0,
    driftDirection: 0,
    driftBoost: 0,
    driftBoostTier: 0,
    trickHeld: false,
    trickBuffer: 0,
    trickActive: false,
    trickVariant: 0,
    trickCount: 0,
    trickAge: 0,
    routeChoice: 0,
    routeGroup: -1,
    lastSafeRoute: 0,
    lastSafeOffset: 0,
    jumpKind: "hop",
    jumpMaxHeight: MAX_JUMP_HEIGHT,
    jumpMaxTime: MAX_JUMP_TIME,
    jumpTakeoffSpeed: JUMP_TAKEOFF_SPEED,
    trickReward: 0.7,
    drumCooldown: 0,
    traversalIndex: -1,
    traversalProgress: 0,
    traversalDeparture: 0,
    traversalOffset: 0,
    movingDeckId: null,
    deckCoordinate: 0,
    scale: 1,
    underwater: false,
  });
}

export function drive(state, input, surface, dt) {
  const pressed = !!input.drift && !state.driftButtonDown;
  state.driftButtonDown = !!input.drift;
  state.driftCooldown = Math.max(0, state.driftCooldown - dt);
  state.driftExit = Math.max(0, state.driftExit - dt);
  if (state.spin > 0) {
    cancelDrift(state);
    // Coast along the incoming line while the visual flip plays, then settle
    // at a complete stop. Keep the chassis heading locked through the hit.
    const fraction = clamp(state.spin / (state.hitFlipDuration || 1), 0, 1);
    state.yaw = state.hitStartYaw;
    state.yawRate = 0;
    state.steering *= Math.exp(-18 * dt);
    state.vx = state.hitSlideVx * fraction;
    state.vz = state.hitSlideVz * fraction;
    state.worldPos.x += state.vx * dt;
    state.worldPos.z += state.vz * dt;
    const fx = -Math.sin(state.yaw),
      fz = -Math.cos(state.yaw);
    const rx = Math.cos(state.yaw),
      rz = -Math.sin(state.yaw);
    state.longitudinalSpeed = state.vx * fx + state.vz * fz;
    state.lateralSpeed = state.vx * rx + state.vz * rz;
    state.speed = Math.hypot(state.vx, state.vz) * 3.6;
    return false;
  }
  const fx = -Math.sin(state.yaw),
    fz = -Math.cos(state.yaw);
  const rx = Math.cos(state.yaw),
    rz = -Math.sin(state.yaw);
  let forward = state.vx * fx + state.vz * fz;
  let lateral = state.vx * rx + state.vz * rz;
  const steeringTarget = clamp(input.steer ?? 0, -1, 1);
  // Quick turn-in, quicker release/countersteer: smooth without a long input tail.
  const steeringResponse = state.isPlayer
    ? steeringTarget === 0 || steeringTarget * state.steering < 0
      ? 26
      : 18
    : 18;
  state.steering += (steeringTarget - state.steering) * (1 - Math.exp(-steeringResponse * dt));
  // Entry is a deliberate press while steering at racing speed. Holding the
  // button through a failed entry, landing or collision cannot restart a slide.
  state.driftSurfaceValid = state.grounded && !surface.offroad && !input.brake;
  const wasSliding = !!state.driftDirection;
  const canSlide = state.driftSurfaceValid && forward > DRIFT_HOLD_SPEED;
  const sliding =
    !!input.drift &&
    canSlide &&
    (wasSliding ||
      (pressed &&
        state.driftCooldown === 0 &&
        !(state.driftBoost > 0) &&
        forward >= DRIFT_ENTRY_SPEED &&
        Math.abs(steeringTarget) >= 0.45));
  state.driftDirection = sliding ? state.driftDirection || Math.sign(steeringTarget) : 0;
  state.driftAge = sliding ? state.driftAge + dt : 0;
  if (wasSliding && !sliding) {
    state.driftCooldown = DRIFT_RECOVERY_TIME;
    state.driftExit = 0.2;
  }
  state.driftCornerQuality =
    surface.curvature == null
      ? 1
      : clamp((-state.driftDirection * surface.curvature - 1 / 240) / (1 / 100 - 1 / 240), 0, 1);
  const previousTravelYaw = Math.atan2(-state.vx, -state.vz);
  const boosted = state.boost > 0 || state.star > 0;
  if (state.grounded) {
    const isBot = state.isBot === true;
    const limit = (boosted ? MAX_BOOST_SPEED : isBot ? AI_MAX_SPEED : MAX_SPEED) / 3.6;
    // Engine/brake forces act on travel speed. Using only its forward component
    // lets a sideways kart accelerate past the limit and makes braking uneven.
    const travelSpeed = Math.hypot(forward, lateral);
    const travelDirection = Math.sign(forward) || Math.sign(state.longitudinalSpeed) || 1;
    const signedSpeed = travelDirection * travelSpeed;
    let acceleration = 0;
    if (input.brake) {
      state.reverseHold = travelSpeed < 0.5 ? state.reverseHold + dt : state.reverseHold;
      acceleration =
        signedSpeed > 0.5
          ? -28
          : state.reverseHold > 0.18
            ? -15 * Math.max(0, 1 - (Math.abs(signedSpeed) / (MAX_REVERSE_SPEED / 3.6)) ** 3)
            : 0;
    } else if (input.throttle) {
      acceleration =
        forward < 0
          ? 24
          : (boosted ? 27 : isBot ? 23 : 19) * Math.max(0, 1 - (travelSpeed / limit) ** 3);
      state.reverseHold = 0;
    } else state.reverseHold = 0;
    if (boosted && !input.brake)
      acceleration = Math.max(acceleration, 22 * Math.max(0, 1 - signedSpeed / limit));
    acceleration -=
      Math.sign(signedSpeed) *
      (0.45 +
        0.002 * travelSpeed * travelSpeed +
        (surface.offroad && !boosted ? (5 + travelSpeed * 0.38) * (surface.offroadDrag ?? 1) : 0));
    // A slide pays a small speed cost; weaving down a straight is slower than
    // cruising. Momentum is still conserved by the tire-grip calculation.
    if (sliding) acceleration -= 0.9;
    // Area floors can be driven in any direction, so gravity follows the
    // vehicle heading and the local normal rather than a route guide's bank.
    const slope = surface.normal ? -(surface.normal.x * fx + surface.normal.z * fz) : surface.slope;
    acceleration -= slope * 9.81;
    const next = signedSpeed + acceleration * dt;
    const nextSpeed =
      (!input.throttle || input.brake) &&
      (!input.brake || state.reverseHold <= 0.18) &&
      Math.sign(next) !== Math.sign(signedSpeed)
        ? 0
        : next;
    if (travelSpeed > 0.001 && Math.sign(nextSpeed) === Math.sign(signedSpeed)) {
      forward *= Math.abs(nextSpeed) / travelSpeed;
      lateral *= Math.abs(nextSpeed) / travelSpeed;
    } else {
      forward = nextSpeed;
      lateral = 0;
    }

    const speed = Math.abs(nextSpeed);
    let targetYaw;
    if (state.isPlayer) {
      // Steering authority is strongest at low speed and tapers with speed.
      // Above normal top speed, scale yaw with speed to preserve the same radius
      // through a boost rather than letting the kart drift wide.
      const fullSpeed = MAX_SPEED / 3.6;
      const tuningSpeed = Math.min(speed, fullSpeed);
      const lowSpeedBlend = clamp(
        (PLAYER_TURN_RAMP_SPEED - tuningSpeed) / (PLAYER_TURN_RAMP_SPEED - LOW_SPEED_STEER_RAMP),
        0,
        1,
      );
      const yawRateAtSpeed =
        tuningSpeed / FULL_SPEED_TURN_RADIUS +
        (LOW_SPEED_YAW_RATE - LOW_SPEED_STEER_RAMP / FULL_SPEED_TURN_RADIUS) *
          lowSpeedBlend *
          clamp(tuningSpeed / LOW_SPEED_STEER_RAMP, 0, 1);
      const yawRate = tuningSpeed > 0 ? yawRateAtSpeed * (speed / tuningSpeed) : 0;
      const direction = nextSpeed >= 0 ? 1 : -1;
      targetYaw = -state.steering * direction * yawRate;
      if (sliding) {
        // Blend curvature (rather than a fixed yaw rate) so boost speed keeps
        // the same line. Neutral holds the bend; countersteer widens it.
        const inward = (state.steering * state.driftDirection + 1) / 2;
        const curvature =
          1 / DRIFT_WIDE_RADIUS + inward * (1 / DRIFT_TIGHT_RADIUS - 1 / DRIFT_WIDE_RADIUS);
        const entry = clamp(state.driftAge / DRIFT_ENTRY_TIME, 0, 1);
        targetYaw += (-state.driftDirection * speed * curvature - targetYaw) * entry;
      }
    } else {
      // Responsive AI steering preserves its physical turn-radius limits.
      const radius =
        AI_LOW_SPEED_TURN_RADIUS +
        ((sliding ? AI_DRIFT_TURN_RADIUS : FULL_SPEED_TURN_RADIUS) - AI_LOW_SPEED_TURN_RADIUS) *
          clamp(speed / (MAX_SPEED / 3.6), 0, 1);
      targetYaw = clamp((-nextSpeed / radius) * state.steering, -2.8, 2.8);
    }
    // Normal steering releases/countersteers promptly. A held drift keeps its
    // latched turn and uses the reference response rate through neutral input.
    const yawResponse = state.isPlayer
      ? sliding
        ? 12
        : steeringTarget === 0 || targetYaw * state.yawRate < 0
          ? 26
          : 12
      : 14;
    state.yawRate += (targetYaw - state.yawRate) * (1 - Math.exp(-yawResponse * dt));
    const grip =
      surface.offroad && !boosted
        ? (surface.offroadGrip ?? 5)
        : sliding
          ? (surface.grip || 12) * 0.46
          : (surface.grip || 12) * (1 - 0.35 * clamp(state.driftExit / 0.2, 0, 1));
    // Grip redirects momentum; it must not delete sideways energy every tick.
    // Retain a bounded slip angle in a drift, then regain traction on release.
    const momentum = Math.hypot(forward, lateral);
    lateral *= Math.exp(-grip * dt);
    forward =
      (Math.sign(forward) || travelDirection) *
      Math.sqrt(Math.max(0, momentum * momentum - lateral * lateral));
    const parked =
      !input.throttle && !input.brake && Math.abs(forward) < 0.12 && Math.abs(lateral) < 0.12;
    if (parked) {
      forward = 0;
      lateral = 0;
      state.yawRate = 0;
    } else {
      const bank = surface.normal ? surface.normal.x * rx + surface.normal.z * rz : surface.bank;
      lateral += bank * 9.81 * dt;
    }
    state.vx = fx * forward + rx * lateral;
    state.vz = fz * forward + rz * lateral;
  } else {
    // Deliberate flights retain momentum with modest aerial control.
    if (["drum", "quarterpipe", "train", "wave"].includes(state.jumpKind)) {
      const turn = -steeringTarget * (state.jumpKind === "train" ? 0.9 : 0.65) * dt;
      const cosine = Math.cos(turn),
        sine = Math.sin(turn),
        vx = state.vx;
      state.vx = vx * cosine + state.vz * sine;
      state.vz = state.vz * cosine - vx * sine;
      state.yaw = wrapAngle(state.yaw + turn);
    }
    state.yawRate *= Math.exp(-3 * dt);
  }
  state.yaw = wrapAngle(state.yaw + state.yawRate * dt);
  state.worldPos.x += state.vx * dt;
  state.worldPos.z += state.vz * dt;
  state.longitudinalSpeed = forward;
  state.lateralSpeed = lateral;
  state.speed = Math.hypot(state.vx, state.vz) * 3.6;
  const travelYaw = Math.atan2(-state.vx, -state.vz);
  state.driftTurnRate = sliding
    ? clamp((-state.driftDirection * wrapAngle(travelYaw - previousTravelYaw)) / dt, 0, 3)
    : 0;
  return sliding;
}

export function wallContact(state, nx, nz, penetration) {
  if (penetration <= 0) return false;
  state.worldPos.x -= nx * penetration;
  state.worldPos.z -= nz * penetration;
  const outward = state.vx * nx + state.vz * nz;
  if (outward > 0) {
    state.vx -= nx * outward * 1.12;
    state.vz -= nz * outward * 1.12;
  }
  return outward > 2;
}

export function verticalMotion(state, height, slopeVelocity, dt, supported = true) {
  let landed = false;
  if (!supported && state.grounded) {
    state.grounded = false;
    state.vy = Math.min(0, state.vy);
    state.airTime = 0;
  }
  if (state.grounded) {
    // Surface corrections, banks and kart contact cannot launch the kart.
    // Authored takeoffs (ramps, drums, timed bridge waves) leave the ground.
    state.worldPos.y = height;
    state.vy = clamp(slopeVelocity, -3, 3);
    state.airTime = 0;
  } else {
    state.airTime = (state.airTime || 0) + dt;
    state.vy = clamp(
      state.vy - JUMP_GRAVITY * (state.underwater ? 0.4 : 1) * dt,
      -32,
      state.jumpTakeoffSpeed ?? JUMP_TAKEOFF_SPEED,
    );
    state.worldPos.y += state.vy * dt;
    if (
      supported &&
      state.worldPos.y >
        height + (state.jumpMaxHeight ?? MAX_JUMP_HEIGHT) * (state.underwater ? 2.3 : 1)
    ) {
      state.worldPos.y =
        height + (state.jumpMaxHeight ?? MAX_JUMP_HEIGHT) * (state.underwater ? 2.3 : 1);
      state.vy = Math.min(state.vy, 0);
    }
    if (
      supported &&
      (state.worldPos.y <= height ||
        (state.jumpKind === "hop" &&
          state.airTime >= (state.jumpMaxTime ?? MAX_JUMP_TIME) * (state.underwater ? 1.6 : 1)))
    ) {
      landed = true;
      state.grounded = true;
      state.worldPos.y = height;
      state.vy = clamp(slopeVelocity, -3, 3);
      state.airTime = 0;
    }
  }
  state.air = state.grounded ? 0 : 1;
  return landed;
}

/** Cancel rewards as well as steering; a new press is required after interruption. */
export function cancelDrift(state) {
  state.driftDirection = 0;
  state.drift = 0;
  state.driftTier = 0;
  state.driftAge = 0;
  state.driftTime = 0;
  state.driftArc = 0;
  state.driftTurnRate = 0;
  state.driftSurfaceValid = false;
  state.driftCornerQuality = 0;
  state.driftCooldown = DRIFT_RECOVERY_TIME;
}

function driftTier(state) {
  // Both time and corner rotation must be earned within one uninterrupted
  // slide. Blue needs ~40 degrees; orange needs ~80, never a string of taps.
  return state.drift >= 0.8 && state.driftTime >= 1.65 && state.driftArc >= 1.4
    ? 2
    : state.drift >= 0.42 && state.driftTime >= 0.85 && state.driftArc >= 0.7
      ? 1
      : 0;
}

export function chargeDrift(state, sliding, held, dt) {
  const valid =
    state.driftSurfaceValid &&
    state.grounded &&
    !(state.spin > 0) &&
    !(state.boost > 0 || state.star > 0) &&
    state.speed >= DRIFT_HOLD_SPEED * 3.6;
  let releasedTier = 0;
  if (!valid) {
    state.drift = 0;
    state.driftTime = 0;
    state.driftArc = 0;
  } else if (sliding && held) {
    const inward = clamp(state.steering * state.driftDirection, 0, 1);
    const slip = Math.abs(Math.atan2(state.lateralSpeed, state.longitudinalSpeed));
    const corner = clamp((state.driftTurnRate - 0.12) / 0.25, 0, 1);
    const quality = corner * clamp((slip - 0.012) / 0.035, 0, 1) * state.driftCornerQuality;
    state.driftTime += dt * quality;
    state.driftArc += state.driftTurnRate * dt * quality;
    state.drift = clamp(state.drift + dt * (0.22 + 0.4 * inward) * quality, 0, 1);
  } else if (state.driftHeld && !held) {
    releasedTier = driftTier(state);
  } else {
    // Low speed, lost grip or a failed entry cannot bank progress for later.
    state.drift = 0;
    state.driftTime = 0;
    state.driftArc = 0;
  }
  if (!held) {
    state.drift = 0;
    state.driftTime = 0;
    state.driftArc = 0;
  }
  state.driftHeld = !!held;
  state.driftTier = driftTier(state);
  return releasedTier;
}
