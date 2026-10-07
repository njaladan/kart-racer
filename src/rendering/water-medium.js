import { MathUtils } from "../../vendor/three/three.module.js";

/** The chase camera crosses later than the kart; keep its atmosphere in its medium. */
export function waterImmersion(cameraY, waterLevel) {
  return 1 - MathUtils.smoothstep(cameraY - waterLevel, -0.65, 0.45);
}
