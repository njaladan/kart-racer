import * as THREE from "../../vendor/three/three.module.js";
import { sectionAt, trackT, frameAt, activeTrack } from "../track/track.js";
import { updateLayeredLighting } from "./layered-lighting.js";
import {
  updateRacerProbeLighting,
  updateMovingProbeLighting,
} from "./baked-global-illumination.js";

export function registerLightPool(
  scene,
  { position, color, intensity = 2, radius = 14, area = null },
) {
  const pool = {
    position: position?.isVector3 ? position.clone() : new THREE.Vector3(...position),
    color: new THREE.Color(color),
    intensity,
    radius,
    ...(area ? { area: [...area] } : {}),
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
    update(dt, position, section, racers, time = 0, state = {}) {
      const enclosed =
        section.enclosed ||
        [
          "forest",
          "rootwood",
          "root-wood",
          "woods",
          "pines",
          "warehouse",
          "temple",
          "canyon",
          "ice-cave",
          "ferry",
        ].includes(section.id);
      enclosure += ((enclosed ? 1 : 0) - enclosure) * (dt ? 1 - Math.exp(-2.2 * dt) : 1);
      const baseAmbient = theme.ambientIntensity ?? 1.55;
      const flash =
        state.motionEnabled === false ? 0 : THREE.MathUtils.clamp(state.stormFlash || 0, 0, 1);
      ambientLight.intensity =
        baseAmbient * (1 - enclosure * (1 - (theme.interiorAmbientScale ?? 0.78))) + flash * 0.65;
      sun.intensity = theme.sunIntensity * (1 - enclosure * 0.12) + flash * 1.8;
      // Switch filtered maps only at the shaded midpoint, avoiding per-frame captures.
      const environment =
        environmentMaps.forPosition?.(position, section) ||
        (enclosure > 0.65 ? environmentMaps.interior : environmentMaps.exterior);
      scene.environment = environment;
      scene.environmentIntensity =
        theme.environmentIntensity ?? (theme.terrain === "concrete" ? 0.38 : 0.5);
      for (const state of racers) {
        const kart = state.kart;
        if (!kart) continue;
        const racerSection = sectionAt(trackT(state.s));
        const racerEnclosed =
          racerSection.enclosed ||
          [
            "forest",
            "rootwood",
            "root-wood",
            "woods",
            "pines",
            "warehouse",
            "temple",
            "canyon",
            "ice-cave",
            "ferry",
          ].includes(racerSection.id);
        const racerPosition =
          kart.root?.getWorldPosition?.(new THREE.Vector3()) || state.worldPos || position;
        const racerEnvironment =
          environmentMaps.forPosition?.(racerPosition, racerSection) || environment;
        const shade = state.renderShade ?? 1;
        state.renderShade =
          shade +
          ((racerEnclosed ? (theme.interiorAmbientScale ?? 0.76) : 1) - shade) *
            (1 - Math.exp(-2.8 * dt));
        for (const material of kart.litMaterials || []) {
          if (material.envMap !== racerEnvironment) material.envMap = racerEnvironment;
          const baseline = material.userData.baseKartColor;
          if (baseline)
            material.color
              .copy(baseline)
              .multiplyScalar(scene.userData.bakedProbes ? 1 : state.renderShade);
          material.envMapIntensity =
            (theme.terrain === "concrete" ? 0.65 : 0.55) * (1 - enclosure * 0.15);
        }
        if (scene.userData.bakedProbes) {
          updateRacerProbeLighting(
            kart,
            scene.userData.bakedProbes,
            trackT(state.s),
            ((state.x || 0) * 6.25) / Math.max(1, racerSection.halfWidth),
            state.grounded === false
              ? 1.3 + Math.max(0, racerPosition.y - frameAt(trackT(state.s)).p.y)
              : 1.3,
          );
        }
      }
      nearby.length = 0;
      if (scene.userData.bakedProbes)
        updateMovingProbeLighting(scene, scene.userData.bakedProbes, activeTrack);
      updateLayeredLighting(scene, time, {
        ...state,
        viewerPosition: position,
        qualityTier: quality,
      });
      const layered = scene.userData.layeredLights || [];
      const layeredPools = new Set(layered.map((record) => record.pool).filter(Boolean));
      for (const pool of scene.userData.localLightPools || []) {
        if (scene.userData.bakedProbes) continue;
        if (layeredPools.has(pool)) continue;
        const distance = pool.position.distanceToSquared(position);
        if (distance < (pool.radius * 1.25) ** 2)
          nearby.push({
            pool,
            position: pool.position,
            intensity: pool.intensity,
            color: pool.color,
            radius: pool.radius,
            distance,
            score: distance / Math.max(1, pool.radius * pool.radius),
          });
      }
      for (const record of layered) {
        // Static lamp illumination is already in the probe volume. Only
        // separately authored moving/non-baked sources use live racer slots.
        if (scene.userData.bakedProbes && record.staticBake) continue;
        const distance = record.position.distanceToSquared(position);
        if (record.currentIntensity > 0 && distance < (record.radius * 1.25) ** 2)
          nearby.push({
            pool: record,
            position: record.position,
            intensity: record.currentIntensity,
            color: record.color,
            radius: record.radius,
            distance,
            score: distance / Math.max(1, record.radius * record.radius),
          });
      }
      nearby.sort((a, b) => (a.score ?? a.distance) - (b.score ?? b.distance));
      lights.forEach((light, i) => {
        const pool = i < (quality >= 2 ? 3 : quality === 1 ? 2 : 1) ? nearby[i] : null;
        if (!pool) {
          light.intensity = 0;
          return;
        }
        const normalizedDistance = Math.sqrt(pool.distance) / Math.max(pool.radius, 1);
        const fade = THREE.MathUtils.smoothstep(1.25 - normalizedDistance, 0, 0.35);
        light.intensity = pool.intensity * fade;
        light.position.copy(pool.position);
        light.color.copy(pool.color);
        light.distance = pool.radius;
      });
    },
  };
}
