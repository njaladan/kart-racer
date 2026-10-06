import { rangeFor } from "./course-mechanics.js";
const clamp = (q) => Math.max(0, Math.min(1, q));
const smooth = (q) => {
  q = clamp(q);
  return q * q * (3 - 2 * q);
};

/** An actual travelling surface: race-clock deck lift, route-relative carrying
 * velocity and carriage coordinates are shared by rendering and authority. */
export function movingDeckAt(track, t, time) {
  for (const deck of track.course.movingDecks || []) {
    const { start, end } = rangeFor(track, deck);
    if (t < start || t > end) continue;
    const length = (end - start) * track.COURSE_LENGTH,
      distance = (t - start) * track.COURSE_LENGTH,
      spacing = length / Math.ceil(length / (deck.carLength || 24)),
      phase = ((distance - time * deck.speed) / spacing) % 1,
      blend = smooth(distance / 18) * smooth((length - distance) / 18);
    return {
      id: deck.id,
      height:
        (deck.suspension || 0.18) *
        Math.sin(time * 1.7) *
        (1 + Math.cos(phase * Math.PI * 2)) *
        0.5 *
        blend,
      speed: deck.speed * blend,
      coordinate: (((distance - time * deck.speed) % spacing) + spacing) % spacing,
      start,
      end,
      spacing,
      length,
    };
  }
  return null;
}

/** Car centres wrap inside covered boarding/disembarking stations. Deck panels
 * are clipped there; stationary 18 m docks hide the return of the convoy. */
export function trainCarriages(track, definition, time) {
  const { start, end } = rangeFor(track, definition),
    length = (end - start) * track.COURSE_LENGTH,
    count = Math.ceil(length / (definition.carLength || 24)),
    spacing = length / count;
  return Array.from({ length: count }, (_, i) => {
    const distance = (((i * spacing + time * definition.speed) % length) + length) % length;
    return {
      index: i,
      distance,
      t: start + distance / track.COURSE_LENGTH,
      start: start + Math.max(0, distance - spacing / 2) / track.COURSE_LENGTH,
      end: start + Math.min(length, distance + spacing / 2) / track.COURSE_LENGTH,
      length: spacing,
    };
  });
}
