import * as THREE from "../../vendor/three/three.module.js";
import { createCourseKit, batchScenery } from "./course-kit.js";

export function createBackgroundContext({ scene, track, textures = {}, assets = {} }) {
  const scenery = new THREE.Group();
  scenery.name = `${track.course.name} distant scenery`;
  scene.add(scenery);
  const kit = createCourseKit(scenery, track, assets);
  const materials = new Map(),
    animated = [],
    updates = [];
  function mat(color, textureName = null, extra = {}) {
    const key = `${color}:${textureName}:${Object.entries(extra)
      .map(([k, v]) => `${k}=${v?.uuid ?? JSON.stringify(v)}`)
      .join(";")}`;
    if (!materials.has(key)) {
      const map = textureName ? textures[textureName] : null;
      materials.set(
        key,
        kit.material(color, {
          ...(map
            ? {
                map,
                normalMap: textures[`${textureName}Normal`],
                roughnessMap: textures[`${textureName}Roughness`],
              }
            : {}),
          normalScale: new THREE.Vector2(0.35, 0.35),
          roughness: 0.88,
          ...extra,
        }),
      );
    }
    return materials.get(key);
  }
  return {
    THREE,
    scene,
    track,
    textures,
    assets,
    scenery,
    kit,
    mat,
    mesh: kit.mesh,
    box: kit.box,
    tube: kit.tube,
    at: (section, fraction, offset = 0) => kit.groupAt(track.sectorT(section, fraction), offset),
    motion(object, update) {
      animated.push(object);
      updates.push(update);
      return object;
    },
    finish() {
      batchScenery(scenery, animated);
      return {
        scenery,
        animated,
        update(time, state = {}) {
          const seconds = state.motionEnabled === false ? 0 : time;
          for (const update of updates) update(seconds, state);
        },
      };
    },
  };
}
