import { CART_T, TRACK, poseAt } from './track.js';

// One race clock drives rendering, vehicle contact, shell contact and AI.
// It waits through the introductory part of the race, then stays in the
// inside half of the yard. There is always a clear outside passing lane.
export function cartAt(time) {
  const active = time >= 30;
  const cycle = active ? ((time - 30) % 12) : 0;
  const phase = Math.max(0, Math.min(1, (cycle - 2) / 3));
  const returnPhase = Math.max(0, Math.min(1, (cycle - 7) / 3));
  const offset = 10 - 13 * (phase - returnPhase);
  const pose = poseAt(CART_T * TRACK, offset, 0.15);
  return { active, warning: active && cycle < 2, offset, s: CART_T * TRACK,
    halfWidth: 1.35, halfLength: 2.15, ...pose };
}
// Resolve oriented-box contact in world space. A collision cannot grant
// progress or launch a vehicle. Returned normal also reflects projectiles.
export function cartContact(position, time, radius = 0.9) {
  const cart = cartAt(time);
  const dx = position.x - cart.p.x, dz = position.z - cart.p.z;
  const length = Math.hypot(cart.right.x, cart.right.z);
  const rx = cart.right.x / length, rz = cart.right.z / length;
  const tx = rz, tz = -rx;
  const lateral = dx * rx + dz * rz, longitudinal = dx * tx + dz * tz;
  const sidePenetration = cart.halfWidth + radius - Math.abs(lateral);
  const endPenetration = cart.halfLength + radius - Math.abs(longitudinal);
  if (sidePenetration <= 0 || endPenetration <= 0 || Math.abs(position.y - cart.p.y) > 2.4) return null;
  const side = sidePenetration < endPenetration;
  const sign = Math.sign(side ? lateral : longitudinal) || 1;
  return { nx: -(side ? rx : tx) * sign, nz: -(side ? rz : tz) * sign,
    penetration: side ? sidePenetration : endPenetration };
}
