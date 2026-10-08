/** Analytic race-clock mechanisms are shared by scenery and authority. */
export function solarLaneAt(course, time, index) {
  const engine = course.solarEngine;
  if (!engine) return 0;
  return Math.sin((time / engine.period) * Math.PI * 2 + index * 2.1) * engine.offset;
}
export function solarBoostAt(track, t, offset, time) {
  const engine = track.course.solarEngine;
  if (!engine) return 0;
  for (const [index, fraction] of engine.fractions.entries()) {
    const station = track.sectorT(engine.section, fraction);
    if (
      Math.abs(t - station) * track.COURSE_LENGTH < 3.4 &&
      Math.abs(offset - solarLaneAt(track.course, time, index)) < 2.1
    )
      return engine.duration;
  }
  return 0;
}

const smooth = (q) => {
  q = Math.max(0, Math.min(1, q));
  return q * q * (3 - 2 * q);
};
export function rangeFor(track, range) {
  return {
    start: track.sectorT(range.section, range.startFraction),
    end: track.sectorT(range.endSection ?? range.section, range.endFraction),
  };
}
export function scaleAt(track, t) {
  for (const zone of track.course.scaleZones || []) {
    const { start, end } = rangeFor(track, zone);
    if (t < start || t > end) continue;
    const fade = Math.min(20 / track.COURSE_LENGTH, (end - start) / 4);
    return 1 + (zone.scale - 1) * smooth((t - start) / fade) * smooth((end - t) / fade);
  }
  return 1;
}
export function underwaterAt(track, t) {
  const definition = track.course.underwater;
  if (!definition) return false;
  const { start, end } = rangeFor(track, definition);
  return t >= start && t <= end;
}
export function pendulumAt(track, definition, time) {
  const t = track.sectorT(definition.section, definition.fraction);
  const phase = (time * 2 * Math.PI) / definition.period + (definition.phase || 0);
  const offset = Math.sin(phase) * (definition.amplitude || 4.4);
  return {
    ...track.poseAt(t * track.TRACK, offset, 0.25),
    t,
    offset,
    warning: Math.abs(Math.cos(phase)) > 0.85,
  };
}
export function mechanismContact(track, position, time, radius = 0.9) {
  for (const definition of track.course.pendulums || []) {
    if (track.drumField && definition.section === track.course.drumField.section) continue;
    const pose = pendulumAt(track, definition, time),
      dx = position.x - pose.p.x,
      dz = position.z - pose.p.z;
    if (Math.abs(position.y - pose.p.y) > 2.5) continue;
    const distance = Math.hypot(dx, dz),
      overlap = (definition.radius || 1.3) + radius - distance;
    if (overlap > 0)
      return {
        nx: -dx / Math.max(distance, 0.001),
        nz: -dz / Math.max(distance, 0.001),
        penetration: overlap,
      };
  }
  return null;
}
export function currentAt(track, t, time) {
  for (const current of track.course.currents || []) {
    const { start, end } = rangeFor(track, current);
    if (t < start || t > end) continue;
    const fade = Math.min(20 / track.COURSE_LENGTH, (end - start) / 3);
    const amount = smooth((t - start) / fade) * smooth((end - t) / fade);
    return amount * current.strength * (0.6 + 0.4 * Math.sin(time * current.frequency));
  }
  return 0;
}

/** Travelling wind waves with zero displacement and slope at each fixed tower. */
export function bridgeWaveAt(track, t, time) {
  const wave = track.course.bridgeWave;
  const still = { height: 0, slope: 0, velocity: 0, launch: false };
  if (!wave) return still;
  const section = track.SECTIONS[wave.section];
  if (t <= section.start || t >= section.end) return still;
  const fraction = (t - section.start) / (section.end - section.start);
  const anchors = wave.anchors;
  const index = anchors.findIndex((end) => end > fraction);
  const start = anchors[index - 1],
    end = anchors[index];
  const length = (section.end - section.start) * track.COURSE_LENGTH;
  const bayLength = (end - start) * length;
  const q = (fraction - start) / (end - start);
  const envelope = Math.sin(q * Math.PI) ** 2;
  const envelopeSlope = (Math.PI * Math.sin(q * Math.PI * 2)) / bayLength;
  const omega = (Math.PI * 2) / wave.period;
  const k = (Math.PI * 2) / wave.wavelength;
  // Increasing race distance runs into the swell: crests travel toward the kart.
  const phase = omega * time + k * fraction * length;
  const height = wave.amplitude * envelope * Math.sin(phase);
  const velocity = wave.amplitude * envelope * omega * Math.cos(phase);
  return {
    height,
    slope: wave.amplitude * (envelopeSlope * Math.sin(phase) + envelope * k * Math.cos(phase)),
    velocity,
    launch: height > wave.amplitude * 0.35 && velocity > 1.5,
  };
}
export function liftPhase(definition, time) {
  const period = definition.period || 10,
    hold = definition.hold || 1,
    duration = definition.duration;
  const phase = ((time % period) + period) % period;
  if (phase < hold) return 0;
  if (phase < hold + duration) return smooth((phase - hold) / duration);
  if (phase < hold * 2 + duration) return 1;
  return 1 - smooth((phase - hold * 2 - duration) / (period - hold * 2 - duration));
}
export function traversalPose(track, definition, q, offset = 0) {
  const { start, end } = rangeFor(track, definition);
  const t = start + (end - start) * q,
    pose = track.poseAt(t * track.TRACK, offset, 0.065);
  if (definition.kind === "cannon") {
    if (definition.straight) {
      const a = track.poseAt(start * track.TRACK, offset, 0.065);
      const b = track.poseAt(end * track.TRACK, offset, 0.065);
      pose.p.copy(a.p).lerp(b.p, q);
      pose.tangent.copy(b.p).sub(a.p).normalize();
    }
    pose.p.y += Math.sin(q * Math.PI) * (definition.height || 45);
  }
  return { ...pose, t };
}

/** Scalars only: these states survive snapshots, prediction replay and reconnect. */
export function advanceTraversal(state, track, dt, time, advanceProgress) {
  const definitions = track.course.traversals || [];
  let index = state.traversalIndex ?? -1,
    started = false;
  if (index < 0) {
    const t = track.trackT(state.s);
    index = definitions.findIndex((definition) => {
      const r = rangeFor(track, definition);
      return t >= r.start - 1e-9 && t < r.end - 1 / track.COURSE_LENGTH;
    });
    if (index < 0) return null;
    const definition = definitions[index],
      { start } = rangeFor(track, definition);
    state.traversalIndex = index;
    state.traversalOffset = state.x * 6.25;
    const phase = time % (definition.period || 10),
      hold = definition.hold || 1;
    state.traversalDeparture =
      definition.kind === "lift"
        ? time + (phase <= hold ? hold - phase : (definition.period || 10) - phase + hold)
        : time;
    state.traversalLap = Math.floor(state.s / track.TRACK);
    state.traversalProgress = 0;
    // Mid-traversal recovery resumes at the same route location, rather than
    // dropping through a missing surface or projecting to another floor.
    const initial = Math.max(0, (t - start) / (rangeFor(track, definition).end - start));
    if (initial > 0.03) {
      state.traversalDeparture = time - initial * definition.duration;
    }
    started = true;
  }
  const definition = definitions[index];
  const linear = Math.max(0, Math.min(1, (time - state.traversalDeparture) / definition.duration));
  const q = definition.kind === "lift" ? smooth(linear) : linear;
  const pose = traversalPose(track, definition, q, state.traversalOffset);
  state.prevS = state.s;
  state.renderYawFrom = state.yaw;
  if (!state.renderFrom) state.renderFrom = state.worldPos.clone();
  else state.renderFrom.copy(state.worldPos);
  state.worldPos.copy(pose.p);
  state.yaw = track.yawFor(pose.tangent);
  const travel = state.worldPos.distanceTo(state.renderFrom);
  advanceProgress(state, pose.t * track.TRACK, track.TRACK, track.WORLD_PER_UNIT, travel);
  state.traversalProgress = q;
  const flying = definition.kind === "cannon";
  state.vx = flying ? (state.worldPos.x - state.renderFrom.x) / dt : 0;
  state.vz = flying ? (state.worldPos.z - state.renderFrom.z) / dt : 0;
  state.vy = flying ? (state.worldPos.y - state.renderFrom.y) / dt : 0;
  state.speed = Math.hypot(state.vx, state.vz) * 3.6;
  state.grounded = definition.kind !== "cannon";
  state.air = state.grounded ? 0 : 1;
  state.boost = Math.max(0, (state.boost || 0) - dt);
  state.spin = 0;
  state.trickActive = false;
  state.drift = 0;
  if (linear >= 1) {
    state.traversalIndex = -1;
    state.grounded = true;
    state.air = 0;
    state.boost = 0.7;
    state.vx = pose.tangent.x * 18;
    state.vz = pose.tangent.z * 18;
    state.yaw = track.yawFor(pose.tangent);
  }
  return {
    traversalStarted: started,
    traversalKind: definition.kind,
    traversalFinished: linear >= 1,
    landed: linear >= 1,
    padBoost: linear >= 1,
  };
}
export function unfoldPhase(course, time) {
  return course.unfold ? smooth((time - course.unfold.openAfter) / 2) : 1;
}
