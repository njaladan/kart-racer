/** Keep artwork at every tier; lower optional fill-rate, shadow and effect work. */
export const GRAPHICS_TIERS = Object.freeze([
  { name: "Performance", shadowSize: 512, shadows: false, effectDensity: 0.45, targetFps: 30 },
  { name: "Balanced", shadowSize: 1024, shadows: true, effectDensity: 0.65, targetFps: 60 },
  { name: "High", shadowSize: 1024, shadows: true, effectDensity: 0.85, targetFps: 60 },
  { name: "Ultra", shadowSize: 2048, shadows: true, effectDensity: 1, targetFps: 60 },
]);

export function createGraphicsQuality({ renderer, sun, weather, postprocessing, lighting }) {
  let tier = 3;
  let world = null;
  let particles = null;
  function apply(next) {
    tier = Math.max(0, Math.min(3, Math.round(next)));
    const settings = GRAPHICS_TIERS[tier];
    renderer.shadowMap.enabled = settings.shadows;
    if (sun.shadow.mapSize.x !== settings.shadowSize) {
      sun.shadow.mapSize.set(settings.shadowSize, settings.shadowSize);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      sun.shadow.needsUpdate = true;
    }
    weather?.setQuality(tier);
    postprocessing?.setQuality(tier);
    lighting?.setQuality(tier);
    world?.setQuality?.(tier);
    if (particles) particles.setQuality?.(tier);
    return settings;
  }
  return {
    apply,
    getTier: () => tier,
    getSettings: () => GRAPHICS_TIERS[tier],
    attachWorld(value, pool) {
      world = value;
      particles = pool;
      apply(tier);
    },
  };
}
