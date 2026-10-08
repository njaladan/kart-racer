/** Shared art direction for foliage, cloth and atmospheric drift. */
export function courseWind(theme = {}) {
  const direction = theme.windDirection ?? [0.94, 0, 0.34];
  const length = Math.hypot(direction[0], direction[2]) || 1;
  return [direction[0] / length, 0, direction[2] / length];
}

export function windGust(time) {
  return 0.8 + Math.sin(time * 0.55) * 0.14 + Math.sin(time * 1.1) * 0.06;
}
