import {
  frameAt,
  trackT,
  collisionBounds,
  laneWidth,
  metresToProgress,
  WORLD_PER_UNIT,
  TRACK,
  activeTrack,
  BOOST_PADS,
  RAMPS,
} from "../track/track.js";
import { progressDelta } from "./race.js";
import { cartAt, trafficAt } from "./hazards.js";
import { bridgeWaveAt, pendulumOffsetAt } from "./course-mechanics.js";
import { trainRampAt } from "./experience-mechanics.js";

export function botInput(state, index, elapsed, rivals = [], items = {}) {
  const deck = activeTrack.movingSurfaceAt(trackT(state.s));
  const carrySpeed = deck?.speed || 0;
  const trainRamp = trainRampAt(activeTrack, deck);
  const aheadMetres = 12 + (state.speed + carrySpeed * 3.6) * 0.09;
  let upcoming = activeTrack.branches.find(
    (b) =>
      b.required &&
      b.start > trackT(state.s) &&
      (b.start - trackT(state.s)) * activeTrack.COURSE_LENGTH < 45 &&
      (b.lap == null || b.lap === Math.floor(Math.max(0, state.s) / TRACK) % 3),
  );
  if (upcoming) {
    const fork = activeTrack.branchGroups[upcoming.groupIndex];
    if (fork.branches.length === 2 && fork.branches.every((b) => b.required)) {
      // Preview the same side the shared entry gate will select. Looking down
      // the opposite street until commitment causes a sudden turn at the fork.
      const approach = activeTrack.projectTrack(state.worldPos, state.s);
      upcoming = fork.branches[approach.offset > 0 ? 1 : 0];
    }
  }
  const branch = activeTrack.branches[state.routeChoice - 1] || upcoming;
  const currentT = trackT(state.s);
  const aheadT = branch
    ? Math.min(branch.end, currentT + (aheadMetres * (branch.end - branch.start)) / branch.length)
    : trackT(state.s + metresToProgress(aheadMetres));
  const routeFrame = (t) =>
    branch && t >= branch.start && t <= branch.end
      ? branch.frameAt((t - branch.start) / (branch.end - branch.start))
      : frameAt(t);
  const lookahead = routeFrame(aheadT);
  const bounds = branch
    ? { left: -branch.halfWidth + 0.9, right: branch.halfWidth - 0.9 }
    : collisionBounds(aheadT);
  const current = routeFrame(currentT);
  const skill = state.skill ?? 0.95;
  let lane = (index % 2 ? 1 : -1) * 0.8;
  let gateSpeed = Infinity;
  // Seek the closest useful pickup or boost, without making a last-second dive.
  let bestGap = 48;
  for (const pad of BOOST_PADS) {
    const gap = progressDelta(pad.t * TRACK, state.s, TRACK) * WORLD_PER_UNIT;
    if (
      gap > 0 &&
      gap < bestGap &&
      Math.abs(pad.offset) < 5 &&
      Math.abs(pad.offset - laneWidth(state.x)) < gap * 0.3 + 1
    ) {
      bestGap = gap;
      lane = pad.offset;
    }
  }
  if (!state.item)
    for (const box of items.boxes || []) {
      if (!box.active) continue;
      const gap = progressDelta(box.s, state.s, TRACK) * WORLD_PER_UNIT;
      const offset = laneWidth(box.x);
      if (
        gap > 0 &&
        gap < bestGap &&
        Math.abs(offset) < 5 &&
        Math.abs(offset - laneWidth(state.x)) < gap * 0.3 + 1
      ) {
        bestGap = gap;
        lane = offset;
      }
    }
  // Leave room to pass a slower kart rather than continually pushing it.
  for (const rival of rivals) {
    if (rival === state || rival.finished) continue;
    const gap = progressDelta(rival.s, state.s, TRACK) * WORLD_PER_UNIT;
    if (
      gap > 0 &&
      gap < 22 &&
      Math.abs(laneWidth(rival.x) - lane) < 2.5 &&
      rival.speed < state.speed + 9
    )
      lane = rival.x > 0 ? -3.25 : 3.25;
  }
  for (const danger of [...(items.bananas || []), ...(items.projectiles || [])]) {
    if (danger.owner === state && danger.grace > 0) continue;
    const gap = progressDelta(danger.s, state.s, TRACK) * WORLD_PER_UNIT;
    if (gap > -2 && gap < 24 && Math.abs(laneWidth(danger.x) - lane) < 2.8)
      lane = danger.x > 0 ? -3.4 : 3.4;
  }
  const cart = cartAt(elapsed);
  const cartGap = progressDelta(cart.s, state.s, TRACK) * WORLD_PER_UNIT;
  if (activeTrack.course.hazard.enabled !== false && cartGap > -6 && cartGap < 40)
    lane = activeTrack.course.hazard.safeLane;
  for (const pendulum of activeTrack.course.pendulums || []) {
    const gap =
      progressDelta(
        activeTrack.sectorT(pendulum.section, pendulum.fraction) * TRACK,
        state.s,
        TRACK,
      ) * WORLD_PER_UNIT;
    if (!(pendulum.radius > 5)) {
      if (gap > -12 && gap < 60) lane = -7.9;
      continue;
    }
    if (gap > -pendulum.radius - 3 && gap < 75) {
      lane = 0;
      // Forecast the whole crossing, including acceleration from a stopped kart.
      let blocked = false;
      for (const acceleration of [10, 19, 27]) {
        let distance = gap,
          speed = Math.max(0, state.speed / 3.6);
        for (let dt = 0; dt < 6 && distance > -pendulum.radius - 3; dt += 0.05) {
          const offset = pendulumOffsetAt(pendulum, elapsed + dt);
          if (Math.hypot(distance, offset) < pendulum.radius + 3) blocked = true;
          speed +=
            0.05 * (acceleration * Math.max(0, 1 - (speed / 34) ** 3) - 0.45 - 0.002 * speed ** 2);
          distance -= speed * 0.05;
        }
      }
      if (blocked && gap > pendulum.radius + 2.5)
        gateSpeed = Math.min(
          gateSpeed,
          Math.sqrt(2 * 20 * Math.max(0, gap - pendulum.radius - 4)) * 3.6,
        );
    }
  }
  const traffic = activeTrack.course.traffic;
  if (
    traffic &&
    trackT(state.s) >= activeTrack.sectorT(traffic.section, traffic.startFraction) - 0.03
  ) {
    for (const vehicle of trafficAt(elapsed)) {
      const gap = progressDelta(vehicle.s, state.s, TRACK) * WORLD_PER_UNIT;
      if (vehicle.active && gap > -5 && gap < 42 && Math.abs(lane - vehicle.lane) < 3)
        lane = traffic.clearLane;
    }
  }
  if (branch) lane = 0;
  if (trainRamp) {
    // Commit early to this car's launch lane and keep that line across the gap.
    if (deck.coordinate >= trainRamp.start - 30) lane = trainRamp.offset;
  }
  if (!state.grounded && state.jumpKind === "train") lane = state.lastSafeOffset || 0;
  const field = activeTrack.drumField;
  if (field && currentT >= field.start - 0.02 && currentT <= field.end) {
    const drum =
      field.drums.find((d) => d.t > currentT + 2 / activeTrack.COURSE_LENGTH) || field.drums.at(-1);
    lane = drum.offset;
  }
  lane = Math.max(bounds.left + 1.1, Math.min(bounds.right - 1.1, lane));
  const target = lookahead.p.clone().addScaledVector(lookahead.right, lane);
  const desired = Math.atan2(-(target.x - state.worldPos.x), -(target.z - state.worldPos.z));
  const headingError = Math.atan2(Math.sin(desired - state.yaw), Math.cos(desired - state.yaw));
  // Preview several points rather than averaging a whole S-bend into a
  // straight. Brake early enough to reach the next corner's grip budget.
  let cruise = state.boost > 0 || state.star > 0 ? 143 : 117 + skill * 7;
  for (const distance of [0, 12, 28, 48]) {
    const preview = routeFrame(
      branch
        ? Math.min(branch.end, currentT + (distance * (branch.end - branch.start)) / branch.length)
        : trackT(state.s + metresToProgress(distance)),
    );
    const radius = 1 / Math.max(0.003, Math.abs(preview.curvature));
    const cornerSpeed = Math.max(9, Math.sqrt((22 + skill * 2) * radius) - carrySpeed);
    cruise = Math.min(cruise, Math.sqrt(cornerSpeed ** 2 + 2 * 22 * distance) * 3.6);
  }
  cruise = Math.min(cruise, gateSpeed);
  const headingCorrection = Math.max(-1, Math.min(1, -headingError * 3.1));
  // Tap a trick just before a ramp; do not hold the drift button through flight.
  const trainRampAhead =
    trainRamp &&
    trainRamp.lip - deck.coordinate > 0 &&
    trainRamp.lip - deck.coordinate < Math.max(1.5, (state.speed / 3.6) * 0.12);
  const rampAhead =
    trainRampAhead ||
    RAMPS.some((ramp) => {
      const gap = progressDelta(ramp.t * TRACK, state.s, TRACK) * WORLD_PER_UNIT;
      return (
        gap > 0 &&
        gap < Math.max(1.5, (state.speed / 3.6) * 0.12) &&
        (ramp.width == null || Math.abs(laneWidth(state.x) - (ramp.offset || 0)) < ramp.width / 2)
      );
    });
  const risingCrest = !branch && bridgeWaveAt(activeTrack, currentT, elapsed).launch;
  return {
    throttle: cruise > 0 && state.speed < cruise + 1,
    brake: state.speed > cruise + 5 && state.speed > 1,
    steer: headingCorrection,
    drift:
      state.grounded &&
      (rampAhead || risingCrest) &&
      !state.trickHeld &&
      Math.abs(current.curvature) < 0.018,
  };
}

/** Save speed items for a controllable exit and aim weapons at nearby rivals. */
export function shouldUseBotItem(state, rivals) {
  if (!state.item || state.finished || state.spin > 0 || !state.grounded) return false;
  if (state.item === "star") return state.star <= 0;
  if (state.item === "mushroom") {
    const preview = frameAt(trackT(state.s + metresToProgress(24)));
    return state.boost <= 0 && Math.abs(preview.curvature) < 0.025 && Math.abs(state.x) < 0.7;
  }
  return rivals.some((rival) => {
    if (rival === state || rival.finished || rival.star > 0 || rival.invulnerable > 0) return false;
    const gap = (rival.s - state.s) * WORLD_PER_UNIT;
    if (state.item === "banana") return gap < 0 && gap > -35 && Math.abs(rival.x - state.x) < 0.5;
    if (state.item === "red") return gap > 0 && gap < 180;
    return (
      gap > 0 &&
      gap < 65 &&
      Math.abs(rival.x - state.x) < 0.3 &&
      Math.abs(frameAt(trackT(state.s)).curvature) < 0.012
    );
  });
}
