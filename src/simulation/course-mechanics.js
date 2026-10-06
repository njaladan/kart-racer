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
