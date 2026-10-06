import { CART_T, TRACK, poseAt, activeTrack } from "../track/track.js";

// One race clock drives rendering, vehicle contact, shell contact and AI.
// It waits through the introductory part of the race, then stays in the
// inside half of the yard. There is always a clear outside passing lane.
export function cartAt(time) {
  const definition = activeTrack.course.hazard;
  const active = definition.enabled !== false && time >= definition.activation;
  const cycle = active ? (time - definition.activation) % definition.period : 0;
  const warningSeconds = definition.warningSeconds;
  const moveSeconds = (definition.period - warningSeconds - 4) / 2;
  const phase = Math.max(0, Math.min(1, (cycle - warningSeconds) / moveSeconds));
  const returnPhase = Math.max(
    0,
    Math.min(1, (cycle - warningSeconds - moveSeconds - 2) / moveSeconds),
  );
  const offset =
    definition.parkOffset - (definition.parkOffset - definition.minOffset) * (phase - returnPhase);
  const pose = poseAt(CART_T * TRACK, offset, 0.15);
  return {
    active,
    warning: active && cycle < warningSeconds,
    offset,
    s: CART_T * TRACK,
    halfWidth: definition.halfWidth,
    halfLength: definition.halfLength,
    ...pose,
  };
}
// Resolve oriented-box contact in world space. A collision cannot grant
// progress or launch a vehicle. Returned normal also reflects projectiles.
export function cartContact(position, time, radius = 0.9) {
  if (activeTrack.course.hazard.enabled === false) return null;
  const cart = cartAt(time);
  const dx = position.x - cart.p.x,
    dz = position.z - cart.p.z;
  const length = Math.hypot(cart.right.x, cart.right.z);
  const rx = cart.right.x / length,
    rz = cart.right.z / length;
  const tx = rz,
    tz = -rx;
  const lateral = dx * rx + dz * rz,
    longitudinal = dx * tx + dz * tz;
  const sidePenetration = cart.halfWidth + radius - Math.abs(lateral);
  const endPenetration = cart.halfLength + radius - Math.abs(longitudinal);
  if (sidePenetration <= 0 || endPenetration <= 0 || Math.abs(position.y - cart.p.y) > 2.4)
    return null;
  const side = sidePenetration < endPenetration;
  const sign = Math.sign(side ? lateral : longitudinal) || 1;
  return {
    nx: -(side ? rx : tx) * sign,
    nz: -(side ? rz : tz) * sign,
    penetration: side ? sidePenetration : endPenetration,
  };
}

// Bridge cars use the race clock and authored course distances for both their
// render pose and every contact query. The short off-span staging keeps the
// wrapped reset outside the visible bridge deck.
export function trafficAt(time) {
  const definition = activeTrack.course.traffic;
  if (!definition) return [];
  const startT = activeTrack.sectorT(definition.section, definition.startFraction);
  const endT = activeTrack.sectorT(definition.section, definition.endFraction);
  const span = (endT - startT) * activeTrack.COURSE_LENGTH;
  const staging = 45;
  const cycleLength = span + staging * 2;
  const count = definition.count || definition.lanes.length;
  const kinds = definition.kinds || [];
  return Array.from({ length: count }, (_, index) => {
    const distance = ((index * cycleLength) / count + time * definition.speed) % cycleLength;
    const inSection = distance >= staging && distance <= staging + span;
    const t = startT + (distance - staging) / activeTrack.COURSE_LENGTH;
    const lane = definition.lanes[index % definition.lanes.length];
    return {
      index,
      kind: kinds[index % Math.max(1, kinds.length)] || "sedan",
      active: inSection,
      lane,
      s: t * TRACK,
      halfWidth: index % 3 === 2 ? 1.15 : 1.05,
      halfLength: index % 3 === 2 ? 2.6 : 2.2,
      ...poseAt(t * TRACK, lane, 0.15),
    };
  });
}

export function trafficContact(position, time, radius = 0.9) {
  for (const vehicle of trafficAt(time)) {
    if (!vehicle.active) continue;
    const dx = position.x - vehicle.p.x;
    const dz = position.z - vehicle.p.z;
    const length = Math.hypot(vehicle.right.x, vehicle.right.z);
    const rx = vehicle.right.x / length;
    const rz = vehicle.right.z / length;
    const tx = rz;
    const tz = -rx;
    const lateral = dx * rx + dz * rz;
    const longitudinal = dx * tx + dz * tz;
    const sidePenetration = vehicle.halfWidth + radius - Math.abs(lateral);
    const endPenetration = vehicle.halfLength + radius - Math.abs(longitudinal);
    if (sidePenetration <= 0 || endPenetration <= 0 || Math.abs(position.y - vehicle.p.y) > 2.4)
      continue;
    const side = sidePenetration < endPenetration;
    const sign = Math.sign(side ? lateral : longitudinal) || 1;
    return {
      nx: -(side ? rx : tx) * sign,
      nz: -(side ? rz : tz) * sign,
      penetration: side ? sidePenetration : endPenetration,
      vehicle,
    };
  }
  return null;
}
