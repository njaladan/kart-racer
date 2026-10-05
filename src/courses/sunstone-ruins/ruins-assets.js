// The rock packs normalize by height. Undo their source aspect ratios when
// placing shelves/boulders, so the requested footprint stays physically safe.
const ROCK_RATIO = {
  "ruins:cliff": [0.8636, 1, 0.875],
  "ruins:boulder": [3.7931, 1, 3.1724],
};
export function placeRock(kit, name, parent, position, size) {
  const ratio = ROCK_RATIO[name];
  return kit.asset(
    name,
    parent,
    position,
    size.map((value, axis) => value / ratio[axis]),
  );
}
