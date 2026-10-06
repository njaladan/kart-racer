/** Offline atlases supply most of the city's small-scale detail. */
export function createLumenMaterials({ THREE, kit, textures, palette }) {
  const { material } = kit;
  const facades = [0, 1, 2].map((index) =>
    material("#d5e5f5", {
      map: textures[`harborFacade${index}`],
      emissiveMap: textures[`harborFacadeEmission${index}`],
      emissive: "#ffffff",
      emissiveIntensity: 0.95,
      roughness: 0.67,
      metalness: 0.12,
    }),
  );
  const cargo = ["#277f95", "#c87852", "#7763a8", "#b29c51", "#32796f"].map((color) =>
    material(color, { map: textures.harborCargo, roughness: 0.73, metalness: 0.25 }),
  );
  const signs = material("#ffffff", {
    map: textures.harborSigns,
    emissiveMap: textures.harborSigns,
    emissive: "#ffffff",
    emissiveIntensity: 1.4,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });
  const signGeometries = Array.from({ length: 16 }, (_, index) => {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, (uv.getX(i) + (index % 4)) / 4, (uv.getY(i) + 3 - Math.floor(index / 4)) / 4);
    return geometry;
  });
  function sign(parent, index, position, width, height, rotation = 0) {
    const panel = kit.mesh(signGeometries[index % 16], signs, parent, position, [width, height, 1]);
    panel.rotation.y = rotation;
    panel.castShadow = false;
    return panel;
  }
  const shopMaterial = material("#ffffff", {
    map: textures.harborShops,
    emissiveMap: textures.harborShops,
    emissive: "#ffffff",
    emissiveIntensity: 0.65,
    roughness: 0.4,
  });
  const shopGeometries = Array.from({ length: 4 }, (_, index) => {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, (uv.getX(i) + (index % 2)) / 2, (uv.getY(i) + 1 - Math.floor(index / 2)) / 2);
    return geometry;
  });
  function shopWindow(parent, index, position, rotation) {
    const panel = kit.mesh(
      shopGeometries[index % 4],
      shopMaterial,
      parent,
      position,
      [3.4, 2.6, 1],
    );
    panel.rotation.y = rotation;
    panel.castShadow = false;
  }
  // Elliptical gradient cards bake the colored falloff into one shared texture.
  const data = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const k = (y * 64 + x) * 4;
      const r = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5);
      data[k] = data[k + 1] = data[k + 2] = 255;
      data[k + 3] = Math.round(Math.max(0, 1 - r) ** 2 * 105);
    }
  const poolMap = new THREE.DataTexture(data, 64, 64);
  poolMap.needsUpdate = true;
  const pools = ["#38dace", "#f146a1", "#ffb85c"].map(
    (color) =>
      new THREE.MeshBasicMaterial({
        color,
        map: poolMap,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
  );
  function lightPool(parent, index, position, width, length) {
    const plane = kit.mesh(new THREE.PlaneGeometry(1, 1), pools[index % 3], parent, position, [
      width,
      length,
      1,
    ]);
    plane.rotation.x = -Math.PI / 2;
    plane.castShadow = plane.receiveShadow = false;
    plane.userData.skipBake = true;
    return plane;
  }
  return { facades, cargo, sign, shopWindow, lightPool, ...palette };
}
