import { Vector3 } from "../../vendor/three/three.module.js";

// Only simulation fields cross the wire. Meshes, callbacks and interpolation
// snapshots stay in their owning process.
export function packRacer(racer) {
  const data = {};
  for (const [key, value] of Object.entries(racer)) {
    if (["kart", "renderFrom", "renderYawFrom", "isPlayer", "name", "color"].includes(key))
      continue;
    if (value?.isVector3) data[key] = value.toArray();
    else if (["number", "boolean", "string"].includes(typeof value) || value === null)
      data[key] = value === Infinity ? null : value;
  }
  return data;
}
export function applyRacer(racer, data) {
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      if (!racer[key]?.isVector3) racer[key] = new Vector3();
      racer[key].fromArray(value);
    } else racer[key] = key === "finishTime" && value === null ? Infinity : value;
  }
}
export function cleanInput(input = {}) {
  return {
    throttle: input.throttle === true,
    brake: input.brake === true,
    drift: input.drift === true,
    steer: Number.isFinite(input.steer) ? Math.max(-1, Math.min(1, input.steer)) : 0,
  };
}
export const NEUTRAL_INPUT = Object.freeze(cleanInput());
