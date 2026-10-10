/** Keep each static material on one shader layout instead of selecting programs per draw. */
export function stabilizeSceneryMaterials(scene, animated = []) {
  const moving = new Set();
  for (const root of animated)
    root.traverse((object) => {
      if (!object.isMesh) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        moving.add(material);
    });
  scene.traverse((object) => {
    if (!object.isMesh || !object.userData.layeredLightSource) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      moving.add(material);
  });
  const variants = new Map();
  let replacements = 0;
  scene.traverse((object) => {
    if (!object.isMesh) return;
    const replace = (material) => {
      if (!material.isMeshStandardMaterial || moving.has(material)) return material;
      const geometry = object.geometry;
      const key = `${!!object.isBatchedMesh}:${!!object.isInstancedMesh}:${!!object.isSkinnedMesh}:${geometry.getAttribute("color")?.itemSize === 4}:${!!geometry.getAttribute("tangent")}`;
      if (!variants.has(material)) variants.set(material, new Map([[key, material]]));
      const layouts = variants.get(material);
      if (!layouts.has(key)) {
        const variant = material.clone();
        // Three's clone does not copy shader hooks. Keep the shared animation,
        // lighting, scan and reflection uniforms captured by those hooks.
        variant.onBeforeCompile = material.onBeforeCompile;
        variant.customProgramCacheKey = material.customProgramCacheKey;
        variant.defaultAttributeValues = material.defaultAttributeValues;
        layouts.set(key, variant);
        replacements++;
      }
      return layouts.get(key);
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(replace)
      : replace(object.material);
  });
  return replacements;
}
