import { rangeFor } from "./course-mechanics.js";
const clamp = (q) => Math.max(0, Math.min(1, q));
const smooth = (q) => {
  q = clamp(q);
  return q * q * (3 - 2 * q);
};
const wrap = (value, length) => ((value % length) + length) % length;

function convoyLayout(track, deck) {
  const { start, end } = rangeFor(track, deck);
  const length = (end - start) * track.COURSE_LENGTH;
  const count = Math.ceil(length / (deck.carLength || 24));
  const spacing = length / count;
  return { start, end, length, count, spacing, gap: deck.gap || 0 };
}

/** An actual travelling surface: race-clock deck lift, route-relative carrying
 * velocity and carriage coordinates are shared by rendering and authority. */
export function movingDeckAt(track, t, time) {
  for (const deck of track.course.movingDecks || []) {
    const { start, end, length, count, spacing, gap } = convoyLayout(track, deck);
    if (t < start - 1e-12 || t > end + 1e-12) continue;
    const distance = Math.max(0, Math.min(length, (t - start) * track.COURSE_LENGTH)),
      relative = distance - time * deck.speed + spacing / 2,
      coordinate = wrap(relative, spacing),
      phase = coordinate / spacing,
      dockLength = deck.dockLength || 18,
      docked = distance <= dockLength || length - distance <= dockLength,
      blend = smooth(distance / dockLength) * smooth((length - distance) / dockLength),
      carIndex = wrap(Math.floor(relative / spacing), count),
      style = deck.carStyles?.[carIndex % deck.carStyles.length];
    return {
      id: deck.id,
      height:
        (deck.suspension || 0.18) *
        Math.sin(time * 1.7) *
        (1 + Math.cos(phase * Math.PI * 2)) *
        0.5 *
        blend,
      speed: deck.speed * blend,
      coordinate,
      distance,
      dockLength,
      carIndex,
      style,
      gap,
      supported: docked || (coordinate >= gap / 2 && coordinate <= spacing - gap / 2),
      docked,
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
  const { start, length, count, spacing, gap } = convoyLayout(track, definition);
  return Array.from({ length: count }, (_, i) => {
    const distance = wrap(i * spacing + time * definition.speed, length);
    const halfLength = (spacing - gap) / 2;
    return {
      index: i,
      distance,
      t: start + distance / track.COURSE_LENGTH,
      start: start + Math.max(0, distance - halfLength) / track.COURSE_LENGTH,
      end: start + Math.min(length, distance + halfLength) / track.COURSE_LENGTH,
      length: spacing - gap,
      spacing,
      style: definition.carStyles?.[i % definition.carStyles.length],
    };
  });
}
