import { EMBERWING_GEOLOGY } from "./emberwing-geology-data.js";

/** Restore Blender's exact world-space placement after the shared asset loader normalizes it. */
export function buildEmberwingGeology({ kit, scenery }, material) {
  for (const { name, position, dimensions } of EMBERWING_GEOLOGY) {
    // Geometry-only unit contexts deliberately omit model packs.
    if (!kit.hasAsset(name)) continue;
    const object = kit.fitAsset(name, scenery, position, dimensions);
    object.name = name.startsWith("ember:cliff")
      ? "Blender volcanic cliff shoulder"
      : "Blender sculpted caldera rim";
    object.traverse((child) => {
      if (!child.isMesh) return;
      child.material = material;
      child.castShadow = true;
      child.receiveShadow = true;
      // These surfaces lie below the evaluated road and receive its offline
      // lighting. They must retain their authored position during clearance.
      child.userData.bakeReceiver = true;
    });
  }
}
