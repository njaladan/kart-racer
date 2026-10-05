export const mod = (n, length) => ((n % length) + length) % length;
export function progressDelta(current, previous, length) {
  const delta = mod(current - previous + length / 2, length) - length / 2;
  return delta;
}
export function ranking(racers) {
  return [...racers].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    return b.s - a.s;
  });
}
export function finishRacer(racer, distance, time) {
  if (!racer.finished && racer.s >= distance) {
    racer.finished = true;
    racer.finishTime = time;
    return true;
  }
  return false;
}
// Progress is signed, so backing over the line cannot manufacture laps.
export function lapNumber(distance, length, laps) {
  return Math.min(
    laps,
    Math.max(1, Math.floor(Math.max(0, distance) / length) + 1),
  );
}
