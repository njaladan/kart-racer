// World distances are metres; velocity is metres/second. Track coordinates
// are used for surface queries and race progress, never to steer the vehicle.
export const FIXED_DT = 1 / 120;
export const MAX_SPEED = 112; // km/h
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
  state.steering +=
    (clamp(input.steer, -1, 1) - state.steering) * (1 - Math.exp(-10 * dt));
  const sliding =
    input.drift &&
    Math.abs(state.steering) > 0.15 &&
    forward > 9 &&
    state.grounded;
  const boosted = state.boost > 0 || state.star > 0;
  if (state.grounded) {
    const limit = (boosted ? 144 : MAX_SPEED) / 3.6;
    let acceleration = 0;
    if (input.throttle) {
      acceleration =
        forward < 0
          ? 24
          : (boosted ? 27 : 19) * Math.max(0, 1 - (forward / limit) ** 3);
      state.reverseHold = 0;
    } else if (input.brake) {
      state.reverseHold =
        Math.abs(forward) < 0.5 ? state.reverseHold + dt : state.reverseHold;
      acceleration =
        forward > 0.5
          ? -28
          : state.reverseHold > 0.18
            ? -15 *
              Math.max(
                0,
                1 - (Math.abs(forward) / (MAX_REVERSE_SPEED / 3.6)) ** 3,
              )
            : 0;
    } else state.reverseHold = 0;
    if (boosted && !input.brake)
      acceleration = Math.max(
        acceleration,
        22 * Math.max(0, 1 - forward / limit),
      );
    acceleration -=
      Math.sign(forward) *
      (0.45 +
        0.002 * forward * forward +
        (surface.offroad && !boosted ? 5 + Math.abs(forward) * 0.38 : 0));
    acceleration -= surface.slope * 9.81;
    if (state.spin > 0) acceleration -= Math.sign(forward) * 14;
    const next = forward + acceleration * dt;
    forward =
      !input.throttle &&
      (!input.brake || state.reverseHold <= 0.18) &&
      Math.sign(next) !== Math.sign(forward)
        ? 0
        : next;

    // A bicycle steering model, limited by available lateral tire force.
    // Drift lowers side grip without rotating the velocity to the heading.
    const maxLateral = surface.offroad && !boosted ? 11 : sliding ? 25 : 23;
    const wheelAngle = state.steering * (0.46 / (1 + Math.abs(forward) / 23));
    const desiredYaw =
      (-forward / 1.6) * Math.tan(wheelAngle) * (sliding ? 1.3 : 1);
    const yawLimit = maxLateral / Math.max(5, Math.abs(forward));
    const targetYaw =
      state.spin > 0 ? 5 : clamp(desiredYaw, -yawLimit, yawLimit);
    state.yawRate += (targetYaw - state.yawRate) * (1 - Math.exp(-8 * dt));
    const grip = surface.offroad && !boosted ? 5 : sliding ? 2.5 : (surface.grip || 12);
    lateral *= Math.exp(-grip * dt);
    const parked =
      !input.throttle &&
      !input.brake &&
      Math.abs(forward) < 0.12 &&
      Math.abs(lateral) < 0.12;
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
  if (sliding) state.drift = Math.min(1, state.drift + dt * 0.48);
  if (state.driftHeld && !held) {
    releasedTier = state.drift >= 0.8 ? 2 : state.drift >= 0.42 ? 1 : 0;
    state.drift = 0;
  } else if (!held || !state.grounded || state.spin > 0) state.drift = 0;
  state.driftHeld = held;
  state.driftTier = state.drift >= 0.8 ? 2 : state.drift >= 0.42 ? 1 : 0;
  return releasedTier;
}
