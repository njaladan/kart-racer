import * as THREE from "../../../vendor/three/three.module.js";
import { installSurfaceDetail, patchMaterial } from "../../rendering/surface-detail.js";

/** Keep real scanned grain, with fine relief and a quiet earth/grass palette. */
export function createMeadowSoil(map, color = "#cfbe9d") {
  const material = new THREE.MeshStandardMaterial({
    color,
    map,
    ...(map?.userData.pbr || {}),
    normalScale: new THREE.Vector2(0.12, 0.12),
    roughness: 0.98,
    vertexColors: true,
  });
  material.name = "Fine meadow earth and worn pebble grain";
  material.userData.skipSurfaceDetail = true;
  patchMaterial(material, "meadow-soft-earth-v1", (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      diffuseColor.rgb=mix(diffuse*vec3(.48,.46,.42),diffuseColor.rgb,.32);`,
    );
  });
  installSurfaceDetail(material, { kind: "road", scale: 0.065, strength: 0.14 });
  return material;
}

export function softenMeadowTurf(material) {
  patchMaterial(material, "meadow-soft-turf-v1", (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      diffuseColor.rgb=mix(diffuse*vec3(.2,.26,.13),diffuseColor.rgb,.6);`,
    );
  });
  if (material.normalScale) material.normalScale.set(0.18, 0.18);
}
