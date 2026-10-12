import * as THREE from "../../../vendor/three/three.module.js";

export const MEADOW_TREE_NAMES = Object.freeze([
  "round",
  "tiered",
  "branching",
  "slender",
  "plump",
  "soft-pine",
  "spruce",
]);

/** One opaque material and seven authored meshes, with no camera-dependent variants. */
export function prepareWindmillTreeAssets(assets) {
  if (assets.windmillTreePalette) return assets;
  const models = { ...assets.models };
  const material = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
  });
  material.name = "Fixed meadow tree palette";
  material.userData.skipSurfaceDetail = true;
  material.userData.skipMaterialPolish = true;
  for (const name of MEADOW_TREE_NAMES) {
    const key = `meadow:tree-${name}`;
    const source = models[key];
    if (!source?.isObject3D) throw new Error(`Missing meadow tree asset: ${key}`);
    const tree = source.clone(true);
    tree.userData.fixedDetail = true;
    tree.userData.meadowTree = name;
    tree.traverse((part) => {
      if (!part.isMesh) return;
      part.material = material;
      part.castShadow = part.receiveShadow = true;
      part.userData.meadowTree = name;
    });
    models[key] = tree;
  }
  // Existing forest/maze landmarks and the alternate grove route use the same
  // palette as the meadow, including old keys whose source pack had far LODs.
  for (const [alias, name] of Object.entries({
    fir: "soft-pine",
    oak: "branching",
    orchard: "round",
    willow: "round",
  }))
    models[`windmill:${alias}`] = models[`meadow:tree-${name}`];
  return { ...assets, models, windmillTreePalette: true };
}
