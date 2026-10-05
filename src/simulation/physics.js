// World distances are metres; velocity is metres/second. Track coordinates
// are used for surface queries and race progress, never to steer the vehicle.
export const FIXED_DT = 1 / 120;
export const MAX_SPEED = 112; // km/h
export const MAX_BOOST_SPEED = 144; // km/h
export const FULL_SPEED_TURN_RADIUS = 22; // metres, also maintained during boosts
export const DRIFT_TURN_RADIUS = 17; // metres
export const MAX_REVERSE_SPEED = 46; // km/h
export const JUMP_GRAVITY = 24;
export const MAX_JUMP_HEIGHT = 1.1; // metres above the racing surface
export const MAX_JUMP_TIME = 0.85;
export const JUMP_TAKEOFF_SPEED = 6;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function resetMotion(state) {
  Object.assign(state, {
    vx: 0,
    vz: 0,
    vy: 0,
    airTime: 0,
    yawRate: 0,
    steering: 0,
    grounded: true,
    reverseHold: 0,
    lateralSpeed: 0,
    longitudinalSpeed: 0,
    contactCooldown: 0,
    invulnerable: 0,
    driftHeld: false,
    driftDirection: 0,
    driftBoost: 0,
    driftBoostTier: 0,
    trickHeld: false,
    trickBuffer: 0,
    trickActive: false,
  });
}

export function drive(state, input, surface, dt) {
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
    : 10;
  state.steering += (steeringTarget - state.steering) * (1 - Math.exp(-steeringResponse * dt));
  // Latch the slide so crossing neutral during countersteer does not abruptly
  // switch tire grip. Release, a hit, a jump or low speed ends the drift.
  const sliding =
    !!input.drift &&
    state.grounded &&
    !(state.spin > 0) &&
    forward > (state.driftDirection ? 7 : 9) &&
    (!!state.driftDirection || Math.abs(state.steering) > 0.15);
  state.driftDirection = sliding ? state.driftDirection || Math.sign(state.steering) : 0;
  const boosted = state.boost > 0 || state.star > 0;
  if (state.grounded) {
    const limit = (boosted ? MAX_BOOST_SPEED : MAX_SPEED) / 3.6;
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
        forward < 0 ? 24 : (boosted ? 27 : 19) * Math.max(0, 1 - (travelSpeed / limit) ** 3);
      state.reverseHold = 0;
    } else state.reverseHold = 0;
    if (boosted && !input.brake)
      acceleration = Math.max(acceleration, 22 * Math.max(0, 1 - signedSpeed / limit));
    acceleration -=
      Math.sign(signedSpeed) *
      (0.45 +
        0.002 * travelSpeed * travelSpeed +
        (surface.offroad && !boosted ? (5 + travelSpeed * 0.38) * (surface.offroadDrag ?? 1) : 0));
    acceleration -= surface.slope * 9.81;
    if (state.spin > 0) acceleration -= Math.sign(forward) * 14;
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

    // Predictable curvature across the whole analog range, with a tighter
    // drift line. Boosts retain the full-speed radius instead of widening it.
    const speed = Math.abs(nextSpeed);
    const radius =
      5 +
      ((sliding ? DRIFT_TURN_RADIUS : FULL_SPEED_TURN_RADIUS) - 5) *
        clamp(speed / (MAX_SPEED / 3.6), 0, 1);
    const desiredYaw = (-nextSpeed / radius) * state.steering;
    // Rough ground already lowers grip and adds drag; also capping yaw makes
    // it impossible to steer back onto the road after a boost expires.
    const yawLimit = 2.8;
    const targetYaw = state.spin > 0 ? 5 : clamp(desiredYaw, -yawLimit, yawLimit);
    // Human input needs prompt release; AI retains its continuous-correction tuning.
    const yawResponse = state.isPlayer
      ? steeringTarget === 0 || targetYaw * state.yawRate < 0
        ? 26
        : sliding
          ? 12
          : 16
      : 8;
    state.yawRate += (targetYaw - state.yawRate) * (1 - Math.exp(-yawResponse * dt));
    const grip =
      surface.offroad && !boosted
        ? (surface.offroadGrip ?? 5)
        : sliding
          ? (surface.grip || 12) * 0.5
          : surface.grip || 12;
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
    } else lateral += surface.bank * 9.81 * dt;
    state.vx = fx * forward + rx * lateral;
    state.vz = fz * forward + rz * lateral;
  } else {
    // No tire forces or air steering; momentum survives a jump.
    state.yawRate *= Math.exp(-3 * dt);
  }
  state.yaw = wrapAngle(state.yaw + state.yawRate * dt);
  state.worldPos.x += state.vx * dt;
  state.worldPos.z += state.vz * dt;
  state.longitudinalSpeed = forward;
  state.lateralSpeed = lateral;
  state.speed = Math.hypot(state.vx, state.vz) * 3.6;
  return sliding && (Math.abs(state.steering) > 0.1 || Math.abs(lateral) > 0.6);
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

export function verticalMotion(state, height, slopeVelocity, dt) {
  let landed = false;
  if (state.grounded) {
    // Surface corrections, banks and kart contact cannot launch the kart.
    // A deliberate ramp takeoff is the only way to leave the ground.
    state.worldPos.y = height;
    state.vy = clamp(slopeVelocity, -3, 3);
    state.airTime = 0;
  } else {
    state.airTime = (state.airTime || 0) + dt;
    state.vy = clamp(state.vy - JUMP_GRAVITY * dt, -32, JUMP_TAKEOFF_SPEED);
    state.worldPos.y += state.vy * dt;
    if (state.worldPos.y > height + MAX_JUMP_HEIGHT) {
      state.worldPos.y = height + MAX_JUMP_HEIGHT;
      state.vy = Math.min(state.vy, 0);
    }
    if (state.worldPos.y <= height || state.airTime >= MAX_JUMP_TIME) {
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

export function chargeDrift(state, sliding, held, dt) {
  let releasedTier = 0;
  if (!state.grounded || state.spin > 0) {
    state.drift = 0;
    state.driftHeld = held;
    state.driftTier = 0;
    return 0;
  }
  if (sliding) state.drift = Math.min(1, state.drift + dt * 0.48);
  else if (held) state.drift = Math.max(0, state.drift - dt * 0.8);
  if (state.driftHeld && !held) {
    releasedTier = state.drift >= 0.8 ? 2 : state.drift >= 0.42 ? 1 : 0;
    state.drift = 0;
  } else if (!held) state.drift = 0;
  state.driftHeld = held;
  state.driftTier = state.drift >= 0.8 ? 2 : state.drift >= 0.42 ? 1 : 0;
  return releasedTier;
}
