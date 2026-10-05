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

// Ordered gates plus a physical-travel check prevent projection or teleports
// from manufacturing laps. Allow local projection changes across bend normals
// and wall correction; the wide grass cut follows these same gates.
export const CHECKPOINT_COUNT = 12;
export function resetRaceProgress(state, trackLength) {
  state.nextCheckpoint = Math.floor(state.s / (trackLength / CHECKPOINT_COUNT)) + 1;
}
export function advanceRaceProgress(state, projected, trackLength, worldPerUnit, travelledMetres) {
  if (state.nextCheckpoint == null) resetRaceProgress(state, trackLength);
  const delta = progressDelta(projected, state.s, trackLength);
  if (Math.abs(delta) * worldPerUnit > travelledMetres * 4 + 18) return false;
  const previous = state.s;
  state.s += delta;
  const spacing = trackLength / CHECKPOINT_COUNT;
  while (previous < state.nextCheckpoint * spacing && state.s >= state.nextCheckpoint * spacing)
    state.nextCheckpoint++;
  return true;
}
