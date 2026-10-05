import * as THREE from "../../vendor/three/three.module.js";

// Shared small masks keep local halos and grounding independent of DOM/canvas
// APIs, so course assembly works in both the browser and Node checks.
const MASK_SIZE = 64;
const shadowMaterials = new Map();
const shadowGeometry = new THREE.PlaneGeometry(1, 1);
shadowGeometry.rotateX(-Math.PI / 2);
let glowMask;
let shadowMask;

function radialMask(shadow = false) {
  const data = new Uint8Array(MASK_SIZE * MASK_SIZE * 4);
  for (let y = 0; y < MASK_SIZE; y++) {
    for (let x = 0; x < MASK_SIZE; x++) {
      const radius = Math.hypot((x + 0.5) / MASK_SIZE - 0.5, (y + 0.5) / MASK_SIZE - 0.5) * 2;
      const falloff = Math.max(0, 1 - radius);
      const alpha = shadow ? falloff * falloff : Math.pow(falloff, 2.5);
      const offset = (y * MASK_SIZE + x) * 4;
      data[offset] = data[offset + 1] = data[offset + 2] = 255;
      data[offset + 3] = Math.round(alpha * 255);
    }
  }
  const texture = new THREE.DataTexture(data, MASK_SIZE, MASK_SIZE);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** A depth-tested additive halo. Size is a diameter, or [width, height]. */
export function createGlowSprite({
  color = "#b8ffff",
  size = 2,
  opacity = 0.3,
  position = [0, 0, 0],
} = {}) {
  glowMask ||= radialMask();
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowMask,
      color,
      opacity,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  sprite.name = "Local light halo";
  sprite.scale.set(Array.isArray(size) ? size[0] : size, Array.isArray(size) ? size[1] : size, 1);
  sprite.position.set(...position);
  return sprite;
}

export function addGlow(parent, options) {
  const sprite = createGlowSprite(options);
  parent.add(sprite);
  return sprite;
}

/** Soft XZ footprint; set local position.y to the receiver height + a small lift.
 * Materials and geometry are shared so static scenery can batch these planes.
 */
export function createContactShadowMesh({ width = 3, depth = 3, opacity = 0.24 } = {}) {
  shadowMask ||= radialMask(true);
  if (!shadowMaterials.has(opacity)) {
    shadowMaterials.set(
      opacity,
      new THREE.MeshBasicMaterial({
        map: shadowMask,
        color: "#10202b",
        transparent: true,
        opacity,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
  }
  const mesh = new THREE.Mesh(shadowGeometry, shadowMaterials.get(opacity));
  mesh.name = "Soft scenery contact shadow";
  mesh.scale.set(width, 1, depth);
  mesh.castShadow = mesh.receiveShadow = false;
  return mesh;
}
