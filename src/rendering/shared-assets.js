import * as THREE from "../../vendor/three/three.module.js";
import { loadCompressedTexture } from "./compressed-textures.js";

// Assets are local at runtime. Failed optional downloads fall back to the
// game's procedural artwork, so an unavailable texture cannot stop a race.
export async function loadGraphicsAssets(renderer) {
  const texture = async (name) => {
    try {
      const t = await loadCompressedTexture(renderer, `./assets/${name}.webp`, {
        colorSpace: THREE.SRGBColorSpace,
      });
      return t;
    } catch (error) {
      console.warn(`Using procedural fallback for ${name}`, error);
      return null;
    }
  };
  const [grass, asphalt] = await Promise.all([texture("grass"), texture("asphalt")]);
  return { grass, asphalt };
}
