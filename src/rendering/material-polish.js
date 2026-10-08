import * as THREE from "../../vendor/three/three.module.js";
import { patchMaterial } from "./surface-detail.js";

const POLISH_PATCH = "material-polish-screen-footprint";

function shouldPolish(material) {
  return (
    (material?.isMeshStandardMaterial || material?.isMeshPhysicalMaterial) &&
    !material.userData?.skipMaterialPolish &&
    !material.userData?.preservePolishedSurface &&
    !material.userData?.["water-two-layer-v4"] &&
    !material.userData?.["wet-pavement-v2"] &&
    !material.userData?.["surface-detail-ice-v2"] &&
    !/water|glass|ice|mirror|chrome|polish/i.test(material.name || "") &&
    !material.transparent &&
    !(material.transmission > 0) &&
    material.metalness < 0.42 &&
    (material.roughness < 0.92 || material.normalMap || material.roughnessMap)
  );
}

function installScreenFootprintFilter(material) {
  if (!shouldPolish(material) || material.userData?.materialPolishInstalled) return;
  const minRoughness = THREE.MathUtils.clamp(
    Number(material.userData?.minimumStableRoughness ?? 0.18),
    0.08,
    0.38,
  );
  patchMaterial(material, `${POLISH_PATCH}:${minRoughness.toFixed(3)}`, (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
#ifdef USE_NORMALMAP
  float polishNormalVariation = length(dFdx(normal)) + length(dFdy(normal));
#else
  float polishNormalVariation = 0.0;
#endif
  float polishWorldPixel = length(dFdx(vViewPosition)) + length(dFdy(vViewPosition));
  float polishDistanceFloor = mix(${minRoughness.toFixed(3)}, 0.48, smoothstep(0.012, 0.12, polishWorldPixel));
  float polishVariationFloor = clamp(polishNormalVariation * 0.12, 0.0, 0.20);
  roughnessFactor = max(roughnessFactor, max(polishDistanceFloor, ${minRoughness.toFixed(3)} + polishVariationFloor));`,
    );
  });
  material.userData.materialPolishInstalled = true;
}

/**
 * Adds a restrained roughness floor to fine nonmetal normal detail. Screen-space
 * derivatives make distant micro-normal variation broaden its specular response,
 * reducing shimmer without changing authored maps or flattening base materials.
 */
export function installMaterialPolish(scene, options = {}) {
  if (!scene?.traverse) return scene;
  const { roughnessFloor = 0.18 } = options;
  scene.traverse((object) => {
    if (!object.isMesh || !object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!shouldPolish(material)) continue;
      if (Number.isFinite(roughnessFloor))
        material.userData.minimumStableRoughness = roughnessFloor;
      installScreenFootprintFilter(material);
    }
  });
  return scene;
}
