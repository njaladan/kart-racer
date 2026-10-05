import * as THREE from "./vendor/three/three.module.js";
import { surfaceTexture } from "./textures.js";
import {
  loadGraphicsAssets,
  createStableShadowFollower,
  addGradientSky,
} from "./graphics.js";
import { loadCourseAssets } from "./course-assets.js";

const SHARED_TEXTURES = [
  "grass",
  "snow",
  "sand",
  "concrete",
  "water",
  "asphalt",
  "bark",
  "leaves",
  "fabric",
  "tire",
  "paint",
];

function createMaterial(color, roughness = 0.74, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    vertexColors: true,
    ...extra,
  });
}

function createMaterials(theme, textures) {
  const material = createMaterial;
  const surface = (map, bumpScale = 0.025) => ({
    map,
    bumpMap: map,
    bumpScale,
  });

  return {
    grass: material(
      theme.ground,
      0.96,
      surface(textures[theme.terrain || "grass"], 0.06),
    ),
    road: material(theme.road, 0.96, surface(textures.asphalt, 0.035)),
    roadside: material(theme.shoulder, 0.95, surface(textures.asphalt)),
    white: material("#fff4d4", 0.65),
    red: material("#fa634f"),
    rail: material("#e7e5d9", 0.4, { metalness: 0.22 }),
    pine: material("#b4d7ad", 0.85, surface(textures.leaves, 0.04)),
    pine2: material("#d4e7b8", 0.85, surface(textures.leaves, 0.04)),
    trunk: material("#ffffff", 0.9, surface(textures.bark, 0.07)),
    gold: material("#f7d65b", 0.3, {
      metalness: 0.32,
      emissive: "#aa771b",
      emissiveIntensity: 0.35,
    }),
    neon: material("#50f8dd", 0.27, {
      emissive: "#0af5cd",
      emissiveIntensity: 2.4,
    }),
    pad: material("#193b49", 0.3, {
      metalness: 0.5,
      emissive: "#0a878b",
      emissiveIntensity: 0.7,
    }),
    black: material("#17202a"),
    tire: material("#11151a", 0.9),
    glass: material("#9aeaff", 0.18, {
      metalness: 0.25,
      emissive: "#194955",
      emissiveIntensity: 0.22,
    }),
  };
}

/** Create the renderer, lighting, shared assets, and course material palette. */
export async function createGameScene({ canvas, course, viewport = window }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(course.theme.sky);
  scene.fog = new THREE.Fog(course.theme.fog, 165, 480);

  const camera = new THREE.PerspectiveCamera(
    63,
    viewport.innerWidth / viewport.innerHeight,
    0.1,
    750,
  );
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  const pixelRatio = Math.min(
    viewport.devicePixelRatio || 1,
    viewport.matchMedia("(pointer:coarse)").matches ? 1.25 : 1.6,
  );
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(viewport.innerWidth, viewport.innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = course.theme.exposure;

  scene.add(
    new THREE.HemisphereLight(
      course.theme.hemisphere,
      course.theme.ambientGround,
      course.theme.ambientIntensity ?? 1.55,
    ),
  );
  const sun = new THREE.DirectionalLight(
    course.theme.sun,
    course.theme.sunIntensity,
  );
  sun.position.set(-75, 130, 75);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -48,
    right: 48,
    top: 48,
    bottom: -48,
    near: 1,
    far: 220,
  });
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.00025;
  scene.add(sun, sun.target);

  const followShadow = createStableShadowFollower(sun);
  const sharedAssets = await loadGraphicsAssets(renderer);
  addGradientSky(scene, course.theme);
  const textures = Object.fromEntries(
    SHARED_TEXTURES.map((kind) => [
      kind,
      sharedAssets[kind] || surfaceTexture(kind, renderer),
    ]),
  );
  const courseAssets = course.buildWorld
    ? await loadCourseAssets(renderer)
    : { models: {}, textures: {} };
  Object.assign(textures, courseAssets.textures);

  return {
    scene,
    camera,
    renderer,
    pixelRatio,
    followShadow,
    sharedAssets,
    courseAssets,
    textures,
    materials: createMaterials(course.theme, textures),
    createMaterial,
  };
}
