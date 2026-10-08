const smooth = (x) => {
  const q = Math.max(0, Math.min(1, x));
  return q * q * (3 - 2 * q);
};

export function quarterPipeHeight(ramp, distance) {
  if (distance < -ramp.halfLength || distance >= 0) return 0;
  const q = 1 + distance / ramp.halfLength;
  return ramp.height * (1 - Math.sqrt(Math.max(0, 1 - q * q)));
}

/** Exactly one shared lightning cycle; thunder is delayed from that flash. */
export function stormAt(course, time) {
  const storm = course.storm;
  if (!storm) return { flash: 0, thunder: -1, gust: 0 };
  const cycle = Math.floor(time / storm.period);
  const phase = time - cycle * storm.period - storm.flashAt;
  const flash =
    phase >= 0 && phase < 0.24
      ? Math.exp(-phase * 19) * (phase < 0.07 || phase > 0.13 ? 1 : 0.15)
      : 0;
  return {
    flash,
    thunder: phase >= storm.thunderDelay - 1e-9 ? cycle : cycle - 1,
    gust: Math.sin(time * 0.55) * 0.7 + Math.sin(time * 1.1) * 0.3,
  };
}

export function bridgeRoll(track, t, time) {
  if (!track.course.bridgeSway) return 0;
  const section = track.SECTIONS.indexOf(track.sectionAt(t));
  if (!track.course.bridgeSway.includes(section)) return 0;
  const range = track.SECTIONS[section],
    q = (t - range.start) / (range.end - range.start);
  return (
    Math.sin(q * Math.PI) ** 2 *
    (track.course.storm.sway || 0.035) *
    stormAt(track.course, time).gust
  );
}

export function createDrumField(track) {
  const definition = track.course.drumField;
  if (!definition) return null;
  const start = track.sectorT(definition.section, definition.startFraction),
    end = track.sectorT(definition.section, definition.endFraction);
  const length = (end - start) * track.COURSE_LENGTH;
  const count = Math.max(3, Math.round(length / definition.spacing));
  const spacing = length / (count - 1);
  const drums = Array.from({ length: count }, (_, index) => {
    const t = start + ((end - start) * index) / (count - 1);
    const offset = index === 0 || index === count - 1 ? 0 : Math.sin(index * 1.8) * 2.2;
    const p = track.poseAt(t * track.TRACK, offset, 0).p;
    return {
      index,
      t,
      offset,
      p,
      radius: definition.radius,
      pitch: 135 + index * 37,
      bounce: Math.sqrt((spacing * 24) / (2 * 29)),
    };
  });
  return {
    ...definition,
    start: start - definition.radius / track.COURSE_LENGTH,
    end: end + definition.radius / track.COURSE_LENGTH,
    spacing,
    drums,
  };
}

export function drumAt(track, surface) {
  const field = track.drumField;
  if (!field || surface.branchIndex || surface.t < field.start || surface.t > field.end)
    return undefined;
  return (
    field.drums.find(
      (d) => Math.hypot(surface.worldX - d.p.x, surface.worldZ - d.p.z) <= d.radius,
    ) || null
  );
}

/** Actual moving ramps use carriage coordinates, so they travel with the train. */
export function trainRampAt(track, surface) {
  const definition = track.course.trainRamps;
  if (!surface || !definition || surface.docked) return null;
  const lip = surface.spacing - surface.gap / 2;
  const lipDistance = surface.distance + lip - surface.coordinate;
  if (lipDistance > surface.length - surface.dockLength) return null;
  return {
    ...definition,
    start: lip - definition.length,
    lip,
    offset: surface.style?.offset || 0,
  };
}

export function trainRampHeight(track, t, offset = 0) {
  const surface = track.movingSurfaceAt(t);
  const ramp = trainRampAt(track, surface);
  if (!ramp || Math.abs(offset - ramp.offset) > ramp.width / 2) return 0;
  const phase = (surface.coordinate - ramp.start) / (ramp.lip - ramp.start);
  return phase >= 0 && phase < 1
    ? ramp.height * (1 - Math.sqrt(Math.max(0, 1 - phase * phase)))
    : 0;
}

export function routeCarry(track, state, surface, dt) {
  const branch = track.branches[state.routeChoice - 1];
  if (!branch?.carrierSpeed || !state.grounded) return false;
  const blend = smooth(surface.q / 0.13) * smooth((1 - surface.q) / 0.13);
  const next = branch.poseAt(
    surface.q + (branch.carrierSpeed * blend * dt) / branch.length,
    surface.offset,
  );
  const previous = branch.poseAt(surface.q, surface.offset);
  state.worldPos.x += next.p.x - previous.p.x;
  state.worldPos.z += next.p.z - previous.p.z;
  return true;
}

/** Continuous snow between the packed run, ice chute and trick ridge. */
export function mountainHeight(track, position, t) {
  if (track.mountainSurface) return track.mountainSurface.heightAt(position, t);
  let height = track.poseAt(t * track.TRACK, 0, 0).p.y,
    best = Infinity;
  for (const branch of track.branches) {
    if (branch.theme !== "snow") continue;
    const surface = branch.project(position, t);
    const distance = Math.abs(surface.offset);
    if (distance < best) {
      best = distance;
      const blend = smooth(1 - Math.max(0, distance - branch.halfWidth) / 15);
      height =
        track.poseAt(t * track.TRACK, 0, 0).p.y +
        (surface.height - 0.065 - track.poseAt(t * track.TRACK, 0, 0).p.y) * blend;
    }
  }
  return height;
}
