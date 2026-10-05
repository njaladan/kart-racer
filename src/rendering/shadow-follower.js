import * as THREE from "../../vendor/three/three.module.js";

export function createStableShadowFollower(sun) {
  const offset = new THREE.Vector3(-65, 95, 45);
  const z = offset.clone().normalize();
  const x = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  const center = new THREE.Vector3();
  const texelX = (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x;
  const texelY = (sun.shadow.camera.top - sun.shadow.camera.bottom) / sun.shadow.mapSize.y;
  return (position) => {
    // Quantize in light space, not world X/Z, to keep projected shadow texels
    // anchored as the kart moves. The light direction stays exactly constant.
    center
      .copy(position)
      .addScaledVector(x, Math.round(position.dot(x) / texelX) * texelX - position.dot(x))
      .addScaledVector(y, Math.round(position.dot(y) / texelY) * texelY - position.dot(y));
    sun.target.position.copy(center);
    sun.position.copy(center).add(offset);
    sun.target.updateMatrixWorld();
  };
}
