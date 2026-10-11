import * as THREE from "../../vendor/three/three.module.js";
import { getCompressedTextureLoader } from "./compressed-textures.js";

/** Shared scanned materials; course models are loaded by course-assets.js. */
export async function loadFidelityAssets(renderer) {
  const response = await fetch("./assets/fidelity/manifest.json");
  if (!response.ok) throw new Error("Scanned material manifest could not load");
  const manifest = await response.json();
  const compressed = getCompressedTextureLoader(renderer),
    images = new THREE.TextureLoader();
  const atlases = Object.fromEntries(
    await Promise.all(
      Object.entries(manifest.atlases).map(async ([name, entry]) => {
        let texture;
        if (compressed) {
          try {
            texture = await compressed.loadAsync(`./assets/fidelity/${entry.file}`);
          } catch {
            /* Use the bundled image fallback. */
          }
        }
        texture ||= await images.loadAsync(`./assets/fidelity/${entry.fallback}`);
        texture.colorSpace =
          entry.colorSpace === "srgb" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        texture.flipY = false;
        return [name, texture];
      }),
    ),
  );
  return { atlases, materials: manifest.materials, quality: { value: 1 } };
}
