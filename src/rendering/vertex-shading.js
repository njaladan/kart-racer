import * as THREE from "../../vendor/three/three.module.js";

// Soft, fixed underside shading without a screen-space AO pass. Clone a
// geometry before using this helper if it is shared by differently lit meshes.
export function bakeVertexShade(geometry, strength = 0.18) {
  if (geometry.getAttribute("color")) return geometry;
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const span = Math.max(0.001, max.y - min.y);
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const height = (positions.getY(i) - min.y) / span;
    const underside = Math.max(0, -normals.getY(i));
    const shade = 1 - strength * (0.55 * (1 - height) + 0.45 * underside);
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = shade;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}
