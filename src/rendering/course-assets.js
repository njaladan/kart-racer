import * as THREE from "../../vendor/three/three.module.js";
import { GLTFLoader } from "../../vendor/three/addons/loaders/GLTFLoader.js";
import { getCompressedTextureLoader, loadCompressedTexture } from "./compressed-textures.js";

// The old compact mesh bundle remains available while the shared and selected
// course packs move to local, textured glTF models. Nothing is fetched remotely
// by the running game.
export async function loadCourseAssets(renderer, courseId = "windmill-wilds") {
  const names = ["asphalt", "concrete", "metal", "brick", "stone", "sand", "snow", "wood", "bark"];
  const maps = await Promise.all(
    names.map(async (name) => {
      const map = await loadCompressedTexture(renderer, `./assets/courses/textures/${name}.webp`, {
        colorSpace: THREE.SRGBColorSpace,
      });
      return [name, map];
    }),
  );
  const [indexResponse, dataResponse] = await Promise.all([
    fetch("./assets/courses/models.json"),
    fetch("./assets/courses/models.bin"),
  ]);
  if (!indexResponse.ok || !dataResponse.ok)
    throw new Error("Course scenery assets could not be loaded");
  const index = await indexResponse.json(),
    data = await dataResponse.arrayBuffer();
  const models = decodeCourseModels(index, data);
  const gltfLoader = new GLTFLoader();
  const ktx2Loader = getCompressedTextureLoader(renderer);
  if (ktx2Loader) gltfLoader.setKTX2Loader(ktx2Loader);
  const [, courseTextures] = await Promise.all([
    loadModelPack(gltfLoader, "./assets/courses/packs/shared/manifest.json", models, renderer),
    courseId
      ? await loadModelPack(
          gltfLoader,
          `./assets/courses/packs/${courseId}/manifest.json`,
          models,
          renderer,
          true,
        )
      : {},
  ]);
  const textures = { ...Object.fromEntries(maps), ...courseTextures };
  for (const [name, texture] of Object.entries(textures)) {
    if (textures[`${name}Normal`])
      texture.userData.pbr = {
        normalMap: textures[`${name}Normal`],
        roughnessMap: textures[`${name}Roughness`],
      };
  }
  return { textures, models };
}

async function loadModelPack(loader, manifestUrl, models, renderer, optional = false) {
  const response = await fetch(manifestUrl);
  if (optional && response.status === 404) return;
  if (!response.ok) throw new Error(`Course asset manifest could not be loaded: ${manifestUrl}`);
  const manifest = await response.json();
  await Promise.all(
    (manifest.models || []).map(async (entry) => {
      if (entry.type !== "gltf")
        throw new Error(`Unsupported model type in ${manifestUrl}: ${entry.type}`);
      const fileUrl = new URL(entry.file, new URL(".", new URL(manifestUrl, location.href))).href;
      const loaded = await loader.loadAsync(fileUrl);
      const object = normalizeCourseModel(loaded.scene);
      object.userData.assetName = entry.name;
      object.userData.animationClips = loaded.animations;
      object.userData.lods = entry.lods || null;
      object.userData.lodDistances = entry.lodDistances || [0, 85, 180];
      const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      object.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials)
          for (const key of [
            "map",
            "normalMap",
            "roughnessMap",
            "metalnessMap",
            "aoMap",
            "emissiveMap",
          ]) {
            const map = material?.[key];
            if (map) map.anisotropy = maxAnisotropy;
          }
      });
      object.name = entry.name;
      models[entry.name] = object;
    }),
  );
  return Object.fromEntries(
    await Promise.all(
      (manifest.textures || []).map(async (entry) => {
        const fileUrl = new URL(entry.file, new URL(".", new URL(manifestUrl, location.href))).href;
        const texture = await loadCompressedTexture(renderer, fileUrl, {
          colorSpace: entry.colorSpace === "linear" ? THREE.NoColorSpace : THREE.SRGBColorSpace,
        });
        return [entry.name, texture];
      }),
    ),
  );
}

// Imported kits use different authoring scales and pivots. A one metre tall,
// ground-centred source makes `kit.asset(..., scale)` predictable in metres.
export function normalizeCourseModel(scene) {
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  const size = bounds.getSize(new THREE.Vector3());
  const height = Math.max(0.001, size.y);
  scene.scale.multiplyScalar(1 / height);
  scene.position.set(
    -((bounds.min.x + bounds.max.x) * 0.5) / height,
    -bounds.min.y / height,
    -((bounds.min.z + bounds.max.z) * 0.5) / height,
  );
  scene.updateMatrixWorld(true);
  const model = new THREE.Group();
  model.add(scene);
  return model;
}

export function decodeCourseModels(index, data) {
  const models = {};
  const assetMaterial = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    vertexColors: true,
    roughness: 0.9,
  });
  for (const model of index.models) {
    const vertices = new Float32Array(data, model.offset, model.vertices * index.stride);
    const interleaved = new THREE.InterleavedBuffer(vertices, index.stride);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.InterleavedBufferAttribute(interleaved, 3, 0));
    geometry.setAttribute("normal", new THREE.InterleavedBufferAttribute(interleaved, 3, 3));
    geometry.setAttribute("color", new THREE.InterleavedBufferAttribute(interleaved, 3, 6));
    // Plain arrays let the shared static merger work without a GLTF dependency.
    const plain = new THREE.BufferGeometry();
    for (const attributeName of ["position", "normal", "color"]) {
      const values = new Float32Array(model.vertices * 3),
        attribute = geometry.getAttribute(attributeName);
      for (let i = 0; i < model.vertices; i++) {
        values[i * 3] = attribute.getX(i);
        values[i * 3 + 1] = attribute.getY(i);
        values[i * 3 + 2] = attribute.getZ(i);
      }
      plain.setAttribute(attributeName, new THREE.BufferAttribute(values, 3));
    }
    plain.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(model.vertices * 2), 2));
    plain.computeBoundingBox();
    plain.computeBoundingSphere();
    geometry.dispose();
    models[model.name] = { geometry: plain, material: assetMaterial };
  }
  return models;
}
