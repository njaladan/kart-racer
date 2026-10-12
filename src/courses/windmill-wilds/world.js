import * as THREE from "../../../vendor/three/three.module.js";
import { surfaceTexture } from "../../rendering/textures.js";
import { createCourseKit, batchScenery } from "../../rendering/course-kit.js";
import buildWindmillLife from "../windmill-wilds-world.js";
import { buildWindmillTerrain } from "./terrain.js";
import { buildWindmillVegetation } from "./vegetation.js";
import { buildWindmillLandmarks } from "./landmarks.js";
import { buildPathwayEdges } from "../../rendering/pathway-edges.js";
import { buildValleyStory } from "./build-valley-story.js";
import { buildMeadowGrass } from "./meadow-grass.js";

/** Compose countryside terrain, vegetation, landmarks, and animated life. */
export function buildWindmillWorld({
  scene,
  renderer,
  materials: mats,
  textures,
  track,
  assets = { models: {} },
}) {
  const scenery = new THREE.Group();
  scene.add(scenery);
  let seed = 8127;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const mat = (color, map = null) =>
    new THREE.MeshStandardMaterial({
      color,
      map,
      ...(map?.userData?.pbr || {}),
      roughness: 0.87,
      vertexColors: true,
    });
  const wood = mat("#d6b784", textures.wood),
    darkWood = mat("#76573b", textures.wood);
  const stone = mat(
    "#e8d9bf",
    textures.brick || (renderer ? surfaceTexture("brick", renderer) : null),
  );
  const roof = mat(
    "#e67851",
    textures.roof || (renderer ? surfaceTexture("roof", renderer) : null),
  );
  const ochre = mat("#ebc875"),
    cream = mat("#fff1c9"),
    red = mat("#ed644b");
  const curbRed = mat("#f13738"),
    curbWhite = mat("#fff9e6");
  const leaf = mat("#6d9d57", textures.leaves),
    pine = mat("#609782", textures.leaves);
  const flower = mat("#ffc2bd"),
    fruit = mat("#e66941"),
    rock = mat("#a2ae9c");
  const bark = mats.trunk;
  const sphereGeo = new THREE.SphereGeometry(1, 12, 8);
  const coneGeo = new THREE.ConeGeometry(1, 1, 12);
  const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
  const kit = createCourseKit(scenery, track, assets);
  const { mesh, box, align, groupAt, sectorT } = kit;
  const palette = {
    wood,
    darkWood,
    stone,
    roof,
    ochre,
    cream,
    red,
    curbRed,
    curbWhite,
    leaf,
    pine,
    flower,
    fruit,
    rock,
    bark,
  };
  const primitives = { mesh, box, mat, align, groupAt, sectorT, sphereGeo, coneGeo, cylinderGeo };
  const options = { scene, scenery, mats, textures, palette, primitives, kit, track };
  const { lake } = buildWindmillTerrain(options);
  buildPathwayEdges({ track, kit, textures });
  buildWindmillVegetation({ ...options, random });
  const landmarks = buildWindmillLandmarks(options);
  const life = buildWindmillLife({
    THREE,
    scene,
    scenery,
    track,
    kit,
    textures,
  });
  const story = buildValleyStory({ scene, scenery, track, kit, textures });
  batchScenery(scenery, [...landmarks.animated, ...life.animated, ...story.animated]);
  const meadow = buildMeadowGrass({ scene, scenery, track });
  return {
    animated: [...landmarks.animated, ...life.animated, ...story.animated],
    setQuality: (tier) => meadow.setQuality(tier),
    update(time, state) {
      meadow.update(time, state);
      landmarks.update(time);
      if (lake.material.map) lake.material.map.offset.set(time * 0.006, time * 0.003);
      life.update(time);
      story.update(time);
    },
  };
}
