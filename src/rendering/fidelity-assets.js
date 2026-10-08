import * as THREE from "../../vendor/three/three.module.js";
import { KTX2Loader } from "../../vendor/three/addons/loaders/KTX2Loader.js";
import { GLTFLoader } from "../../vendor/three/addons/loaders/GLTFLoader.js";
import { normalizeCourseModel } from "./course-assets.js";

const loaders = new WeakMap();
const imageLoader = new THREE.TextureLoader();
const imageCache = new Map();
let manifestPromise;

/** One transcoder and URL cache per renderer; LODs share the same GPU textures. */
export function compressedTextureLoader(renderer) {
  if (!renderer?.extensions?.has) return null;
  if (!loaders.has(renderer)) {
    const loader = new KTX2Loader()
      .setTranscoderPath("./vendor/three/addons/libs/basis/")
      .setWorkerLimit(2)
      .detectSupport(renderer);
    const originalLoad = loader.load.bind(loader);
    const load = (url) =>
      new Promise((resolve, reject) => originalLoad(url, resolve, undefined, reject));
    const cache = new Map();
    loader.loadAsync = (url) => {
      if (!cache.has(url)) cache.set(url, load(url));
      return cache.get(url);
    };
    // GLTFLoader uses the callback interface, so retain the same promise cache.
    loader.load = (url, onLoad, _onProgress, onError) => {
      loader.loadAsync(url).then(onLoad).catch(onError);
    };
    loaders.set(renderer, loader);
  }
  return loaders.get(renderer);
}

export function loadImageTexture(url) {
  if (!imageCache.has(url)) imageCache.set(url, imageLoader.loadAsync(url));
  return imageCache.get(url);
}

export function fidelityManifest() {
  return (manifestPromise ||= fetch("./assets/fidelity/manifest.json").then((response) => {
    if (!response.ok) throw new Error("Detailed scenery manifest could not load");
    return response.json();
  }));
}

/** Load only the downloaded hero models required by the selected course. */
export async function loadFidelityAssets(renderer, courseId) {
  const manifest = await fidelityManifest();
  const compressed = compressedTextureLoader(renderer);
  const loader = new GLTFLoader();
  if (compressed) loader.setKTX2Loader(compressed);
  const models = {};
  await Promise.all(
    manifest.heroes
      .filter((hero) => hero.courses.includes(courseId))
      .map(async (hero) => {
        await Promise.all(
          hero.variants.map(async (variant, index) => {
            const file = compressed ? variant.file : variant.offlineFile;
            const loaded = await loader.loadAsync(`./assets/fidelity/${file}`);
            const model = normalizeCourseModel(loaded.scene);
            model.name = variant.name;
            model.userData.assetName = variant.name;
            model.userData.heroAsset = hero.key;
            model.userData.lodDistances = hero.lodDistances;
            if (!index)
              model.userData.lods = {
                mid: `hero:${hero.key}-mid`,
                far: `hero:${hero.key}-far`,
              };
            model.traverse((object) => {
              if (!object.isMesh) return;
              object.castShadow = true;
              object.receiveShadow = true;
              const materials = Array.isArray(object.material)
                ? object.material
                : [object.material];
              for (const material of materials)
                for (const key of [
                  "map",
                  "normalMap",
                  "roughnessMap",
                  "metalnessMap",
                  "aoMap",
                  "emissiveMap",
                ])
                  if (material[key])
                    material[key].anisotropy = Math.min(
                      8,
                      renderer.capabilities.getMaxAnisotropy(),
                    );
            });
            models[variant.name] = model;
          }),
        );
      }),
  );
  const atlases = Object.fromEntries(
    await Promise.all(
      Object.entries(manifest.atlases).map(async ([name, entry]) => {
        const texture = compressed
          ? await compressed.loadAsync(`./assets/fidelity/${entry.file}`)
          : await loadImageTexture(`./assets/fidelity/${entry.fallback}`);
        texture.colorSpace =
          entry.colorSpace === "srgb" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        texture.flipY = false;
        return [name, texture];
      }),
    ),
  );
  return { models, atlases, materials: manifest.materials, quality: { value: 1 } };
}
