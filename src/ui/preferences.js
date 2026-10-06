export const DEFAULT_PREFERENCES = Object.freeze({
  quality: 2,
  adaptive: true,
  bloom: true,
  motion: true,
  master: 0.8,
  effects: 0.8,
  ambience: 0.55,
});
const KEY = "turbo-trail-preferences-v1";
export function loadPreferences(storage = globalThis.localStorage) {
  let saved = {};
  try {
    saved = JSON.parse(storage?.getItem(KEY) || "{}");
  } catch {
    /* Private mode remains playable. */
  }
  const values = { ...DEFAULT_PREFERENCES };
  for (const key of ["quality", "master", "effects", "ambience"]) {
    if (Number.isFinite(saved?.[key]))
      values[key] = Math.max(0, Math.min(key === "quality" ? 3 : 1, saved[key]));
  }
  values.quality = Math.round(values.quality);
  for (const key of ["adaptive", "bloom", "motion"])
    if (typeof saved?.[key] === "boolean") values[key] = saved[key];
  return values;
}
export function savePreferences(value, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, JSON.stringify(value));
  } catch {
    /* Storage denial is nonfatal. */
  }
}
