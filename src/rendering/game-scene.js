import * as THREE from "../../vendor/three/three.module.js";
import { surfaceTexture } from "./textures.js";
import { loadGraphicsAssets } from "./shared-assets.js";
import { createStableShadowFollower } from "./shadow-follower.js";
import { addGradientSky } from "./sky.js";
import { addAmbientWeather } from "./ambient-weather.js";
import { addRaceFinish } from "./display-finish.js";
import { loadCourseAssets } from "./course-assets.js";
import { loadLivingAssets } from "./living-assets.js";
import { createCourseEnvironments } from "./reflection-environments.js";
import { createCourseLighting } from "./course-lighting.js";
import { createPostProcessing } from "./postprocessing.js";
import { createGraphicsQuality } from "./graphics-quality.js";
import { installSurfaceDetail, installWetPavement } from "./surface-detail.js";
import { createWetRoadReflections } from "./wet-road-reflections.js";
import { loadFidelityAssets } from "./fidelity-assets.js";

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
  "wood",
  "rock",
  "gravel",
  "needles",
  "paving",
  "blossom",
  "brick",
  "roof",
];

function createMaterial(color, roughness = 0.74, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    vertexColors: true,
    ...extra,
  });
}

function createMaterials(theme, textures, environment) {
  const material = createMaterial;
  const surface = (map, bumpScale = 0.025) =>
    map?.userData?.pbr ? { map, ...map.userData.pbr } : { map, bumpMap: map, bumpScale };
  const railColor =
    theme.terrain === "concrete" ? "#426a80" : theme.terrain === "snow" ? "#78c5ed" : "#fff0c6";

  return {
    grass: material(theme.ground, 0.96, surface(textures[theme.terrain || "grass"], 0.06)),
    road: material(
      theme.road,
      theme.roadRoughness ?? (theme.terrain === "concrete" ? 0.34 : 0.96),
      {
        ...surface(textures.asphalt, theme.terrain === "concrete" ? 0.004 : 0.008),
        ...(theme.terrain === "concrete"
          ? {
              envMapIntensity: theme.roadReflectionIntensity ?? 0.13,
              metalness: theme.roadMetalness ?? 0,
            }
          : {}),
      },
    ),
    roadside: material(theme.shoulder, 0.95, surface(textures.asphalt, 0.008)),
    white: material("#fff9e8", 0.65),
    red: material("#ff3028"),
    rail: material(railColor, 0.4, { metalness: 0.22 }),
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
      metalness: 0,
      emissive: "#194955",
      emissiveIntensity: 0.22,
    }),
  };
}

/** Create the renderer, lighting, shared assets, and course material palette. */
export async function createGameScene({ canvas, course, viewport = window }) {
  const scene = new THREE.Scene();
  scene.userData.courseTheme = course.theme;
  scene.background = new THREE.Color(course.theme.sky);
  scene.fog = new THREE.Fog(course.theme.fog, 165, 480);

  const camera = new THREE.PerspectiveCamera(
    63,
    viewport.innerWidth / viewport.innerHeight,
    0.1,
    course.theme.cameraFar ?? 750,
  );
  camera.layers.enable(1);
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
  // Neutral preserves the painted palette while still compressing bright highlights.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = course.theme.exposure;

  scene.add(
    new THREE.HemisphereLight(
      course.theme.hemisphere,
      course.theme.ambientGround,
      course.theme.ambientIntensity ?? 1.55,
    ),
  );
  const ambientLight = scene.children.at(-1);
  const rim = new THREE.DirectionalLight(
    course.theme.rimColor ?? (course.theme.terrain === "concrete" ? "#98bfff" : "#a8d4ee"),
    course.theme.rimIntensity ?? 0.24,
  );
  rim.position.set(65, 35, -55);
  scene.add(rim);
  const sun = new THREE.DirectionalLight(course.theme.sun, course.theme.sunIntensity);
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

  const followShadow = createStableShadowFollower(sun, course.theme.sunPosition);
  const sharedAssets = await loadGraphicsAssets(renderer);
  const environmentMaps = createCourseEnvironments(renderer, course.theme);
  sharedAssets.environment = environmentMaps.exterior;
  scene.environment = environmentMaps.exterior;
  scene.environmentIntensity = 0.5;
  const sky = addGradientSky(scene, course.theme);
  const weather = addAmbientWeather(scene, course.theme);
  const displayFinish = addRaceFinish(scene);
  const textures = Object.fromEntries(
    SHARED_TEXTURES.map((kind) => [kind, sharedAssets[kind] || surfaceTexture(kind, renderer)]),
  );
  const [courseAssets, livingAssets, fidelityAssets] = await Promise.all([
    loadCourseAssets(renderer, course.id),
    loadLivingAssets(renderer, course.id),
    loadFidelityAssets(renderer, course.id),
  ]);
  Object.assign(textures, courseAssets.textures);
  Object.assign(textures, livingAssets.textures);
  // Selected adventure scans take precedence over the shared material fallback.
  for (const [name, texture] of Object.entries(courseAssets.textures))
    if (courseAssets.textures[`${name}Normal`]) textures[name] = texture;
  Object.assign(courseAssets.models, livingAssets.models, fidelityAssets.models);
  textures.stone ||= textures.rock;
  textures.cloth ||= textures.fabric;
  textures.canvas ||= textures.fabric;
  textures.metal ||= textures.paint;

  const materials = createMaterials(course.theme, textures, sharedAssets.environment);
  installSurfaceDetail(materials.grass, { kind: "terrain", strength: 0.18 });
  installSurfaceDetail(materials.road, { kind: "road", strength: 0.08 });
  if (course.theme.wetPavement) installWetPavement(materials.road);
  const wetReflections = course.theme.wetPavement ? createWetRoadReflections() : null;
  if (wetReflections) {
    wetReflections.install(materials.road);
    scene.userData.wetRoadReflections = wetReflections;
  }
  installSurfaceDetail(materials.roadside, { kind: "road", strength: 0.14 });
  const lighting = createCourseLighting(scene, {
    theme: course.theme,
    ambientLight,
    sun,
    environmentMaps,
  });
  const postprocessing = createPostProcessing(renderer, course.theme, wetReflections);
  const graphicsQuality = createGraphicsQuality({
    renderer,
    sun,
    weather,
    postprocessing,
    lighting,
    scannedMaterials: fidelityAssets,
  });
  renderer.info.autoReset = false;

  return {
    scene,
    camera,
    renderer,
    pixelRatio,
    followShadow,
    ambientLight,
    sun,
    lighting,
    postprocessing,
    graphicsQuality,
    environmentMaps,
    sky,
    weather,
    displayFinish,
    sharedAssets,
    courseAssets,
    fidelityAssets,
    textures,
    materials,
    createMaterial,
  };
}
