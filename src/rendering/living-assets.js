import * as THREE from "../../vendor/three/three.module.js";
import { loadCompressedTexture } from "./compressed-textures.js";

// Keep the road's scanned grain without letting its contrast dominate the frame.
// Prepare the shared map once rather than adding a shader variant to every road.
function softenAsphalt(map, renderer) {
  const canvas = document.createElement("canvas");
  canvas.width = map.image.width;
  canvas.height = map.image.height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#868686";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalAlpha = 0.26;
  context.drawImage(map.image, 0, 0);
  const softened = new THREE.CanvasTexture(canvas);
  softened.colorSpace = THREE.SRGBColorSpace;
  softened.wrapS = softened.wrapT = THREE.RepeatWrapping;
  softened.anisotropy = Math.min(8, renderer.getMaxAnisotropy());
  return softened;
}

// Locally bundled 1K CC0 scans and textured Poly Haven props. All network
// downloads happen during preparation, never while a player is racing.
const COURSE_SCANS = {
  "windmill-wilds": [
    "grass",
    "asphalt",
    "wood",
    "paving",
    "needles",
    "rock",
    "brick",
    "roof",
    "gravel",
  ],
  "neon-harbor": ["asphalt", "wood", "paving", "rock", "brick"],
  "sunstone-ruins": ["asphalt", "sand", "rock", "wood", "paving"],
  "frostpeak-festival": ["asphalt", "wood", "rock", "paving", "needles"],
};
const ADVENTURE_SCANS = ["asphalt", "wood", "rock", "sand", "gravel", "paving"];
export async function loadLivingAssets(renderer, courseId) {
  const response = await fetch("./assets/living/index.json");
  if (!response.ok) throw new Error("Detailed material index could not load");
  const index = await response.json(),
    loader = new THREE.TextureLoader(),
    cache = new Map();
  const load = (path, color = false, compressed = true) => {
    if (!cache.has(path))
      cache.set(
        path,
        compressed
          ? loadCompressedTexture(renderer, `./assets/living/${path}`, {
              colorSpace: color ? THREE.SRGBColorSpace : THREE.NoColorSpace,
            })
          : loader.loadAsync(`./assets/living/${path}`).then((map) => {
              map.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
              map.wrapS = map.wrapT = THREE.RepeatWrapping;
              map.anisotropy = Math.min(8, renderer.getMaxAnisotropy());
              return map;
            }),
      );
    return cache.get(path);
  };
  const textures = Object.fromEntries(
    await Promise.all(
      Object.entries(index.textures)
        .filter(([name]) => !courseId || (COURSE_SCANS[courseId] || ADVENTURE_SCANS).includes(name))
        .map(async ([name, paths]) => {
          const [colorMap, normalMap, roughnessMap] = await Promise.all([
            load(paths.color, true, name !== "asphalt"),
            load(paths.normal),
            load(paths.roughness),
          ]);
          const map = name === "asphalt" ? softenAsphalt(colorMap, renderer) : colorMap;
          map.name = `ambientCG ${name} 1K scan`;
          const relief = name === "asphalt" ? 0.09 : 0.38;
          map.userData.pbr = {
            normalMap,
            normalScale: new THREE.Vector2(relief, relief),
            roughnessMap,
          };
          return [name, map];
        }),
    ),
  );
  // Rocky verges and cliffs share the same scan rather than duplicating it.
  textures.stone = textures.rock;
  await Promise.all(
    index.models.flatMap((model) =>
      model.materials.flatMap((m) =>
        ["map", "normalMap", "armMap"].filter((k) => m[k]).map((k) => load(m[k], k === "map")),
      ),
    ),
  );
  const binaryResponse = await fetch("./assets/living/props.bin");
  if (!binaryResponse.ok) throw new Error("Detailed scenery props could not load");
  const data = await binaryResponse.arrayBuffer(),
    maps = Object.fromEntries(
      await Promise.all([...cache].map(async ([path, p]) => [path, await p])),
    );
  return { textures, models: decodeLivingModels(index, data, maps) };
}

export function decodeLivingModels(index, data, maps = {}) {
  const models = {};
  for (const definition of index.models) {
    const group = new THREE.Group();
    group.name = `Poly Haven ${definition.name}`;
    const materials = definition.materials.map(
      (m) =>
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setRGB(...m.color, THREE.LinearSRGBColorSpace),
          roughness: m.roughness,
          metalness: m.metalness,
          map: maps[m.map] || null,
          normalMap: maps[m.normalMap] || null,
          normalScale: new THREE.Vector2(0.55, 0.55),
          roughnessMap: maps[m.armMap] || null,
          metalnessMap: maps[m.armMap] || null,
          aoMap: maps[m.armMap] || null,
          aoMapIntensity: 0.85,
        }),
    );
    for (const part of definition.primitives) {
      const source = new Float32Array(data, part.offset, part.vertices * index.stride),
        geometry = new THREE.BufferGeometry();
      for (const [name, size, offset] of [
        ["position", 3, 0],
        ["normal", 3, 3],
        ["uv", 2, 6],
      ]) {
        const values = new Float32Array(part.vertices * size);
        for (let i = 0; i < part.vertices; i++)
          for (let c = 0; c < size; c++)
            values[i * size + c] = source[i * index.stride + offset + c];
        geometry.setAttribute(name, new THREE.BufferAttribute(values, size));
      }
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, materials[part.material]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    models[definition.name] = group;
  }
  return models;
}
