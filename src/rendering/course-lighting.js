import * as THREE from "../../vendor/three/three.module.js";
import { sectionAt, trackT } from "../track/track.js";

export function registerLightPool(scene, { position, color, intensity = 2, radius = 14 }) {
  const pool = {
    position: position?.isVector3 ? position.clone() : new THREE.Vector3(...position),
    color: new THREE.Color(color),
    intensity,
    radius,
  };
  (scene.userData.localLightPools ||= []).push(pool);
  return pool;
}

/** Three nearby non-shadow lights illuminate racers only; static light is baked. */
export function createCourseLighting(scene, { theme, ambientLight, sun, environmentMaps }) {
  const lights = Array.from({ length: 3 }, () => {
    const light = new THREE.PointLight("#ffffff", 0, 18, 2);
    light.layers.set(1);
    scene.add(light);
    return light;
  });
  let quality = 3;
  let enclosure = 0;
  const nearby = [];
  return {
    lights,
    setQuality(tier) {
      quality = tier;
    },
    update(dt, position, section, racers) {
      const enclosed =
        section.enclosed ||
        ["forest", "pines", "warehouse", "temple", "canyon", "ice-cave", "ferry"].includes(
          section.id,
        );
      enclosure += ((enclosed ? 1 : 0) - enclosure) * (dt ? 1 - Math.exp(-2.2 * dt) : 1);
      const baseAmbient = theme.ambientIntensity ?? 1.55;
      ambientLight.intensity =
        baseAmbient * (1 - enclosure * (1 - (theme.interiorAmbientScale ?? 0.78)));
      sun.intensity = theme.sunIntensity * (1 - enclosure * 0.12);
      // Switch filtered maps only at the shaded midpoint, avoiding per-frame captures.
      const environment = enclosure > 0.65 ? environmentMaps.interior : environmentMaps.exterior;
      scene.environment = environment;
      scene.environmentIntensity =
        theme.environmentIntensity ?? (theme.terrain === "concrete" ? 0.38 : 0.5);
      for (const state of racers) {
        const kart = state.kart;
        if (!kart) continue;
        const racerSection = sectionAt(trackT(state.s));
        const racerEnclosed =
          racerSection.enclosed ||
          ["forest", "pines", "warehouse", "temple", "canyon", "ice-cave", "ferry"].includes(
            racerSection.id,
          );
        const shade = state.renderShade ?? 1;
        state.renderShade =
          shade +
          ((racerEnclosed ? (theme.interiorAmbientScale ?? 0.76) : 1) - shade) *
            (1 - Math.exp(-2.8 * dt));
        for (const material of kart.litMaterials || []) {
          if (material.envMap !== environment) material.envMap = environment;
          const baseline = material.userData.baseKartColor;
          if (baseline) material.color.copy(baseline).multiplyScalar(state.renderShade);
          material.envMapIntensity =
            (theme.terrain === "concrete" ? 0.65 : 0.55) * (1 - enclosure * 0.15);
        }
      }
      nearby.length = 0;
      for (const pool of scene.userData.localLightPools || []) {
        const distance = pool.position.distanceToSquared(position);
        if (distance < (pool.radius + 20) ** 2) nearby.push({ pool, distance });
      }
      nearby.sort((a, b) => a.distance - b.distance);
      lights.forEach((light, i) => {
        const pool = i < (quality >= 2 ? 3 : quality === 1 ? 2 : 1) ? nearby[i]?.pool : null;
        light.intensity = pool ? pool.intensity : 0;
        if (!pool) return;
        light.position.copy(pool.position);
        light.color.copy(pool.color);
        light.distance = pool.radius;
      });
    },
  };
}
