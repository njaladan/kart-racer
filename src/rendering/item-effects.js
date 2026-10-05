import * as THREE from "../../vendor/three/three.module.js";
import { bakeVertexShade } from "./vertex-shading.js";

/** Each effect owns its geometry/materials; shared course materials stay alive. */
export function createItemEffects({ scene, materials: mats, createMaterial: mat }) {
  const sharedMaterials = new Set(Object.values(mats));
  function addMesh(geometry, material, parent) {
    if (material.vertexColors) bakeVertexShade(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function getItemModel(kind) {
    let g = new THREE.Group();
    if (kind === "banana") {
      const body = addMesh(
        new THREE.TorusGeometry(0.43, 0.17, 6, 8, Math.PI * 1.45),
        mat("#f6d33f", 0.42, { emissive: "#80631a", emissiveIntensity: 0.25 }),
        g,
      );
      body.rotation.z = -0.15;
      for (const side of [-1, 1]) {
        const tip = addMesh(new THREE.ConeGeometry(0.17, 0.3, 6), mat("#66b36c"), g);
        tip.position.set(side * 0.39, 0.27, 0);
        tip.rotation.z = side * 0.75;
      }
    } else {
      const red = kind === "red",
        shellMat = mat(red ? "#eb4e4b" : "#6acb4a", 0.29, {
          metalness: 0.12,
          emissive: red ? "#76201d" : "#244d1c",
          emissiveIntensity: 0.32,
        });
      const shell = addMesh(new THREE.SphereGeometry(0.58, 9, 7), shellMat, g);
      shell.scale.set(1, 1.05, 1);
      const cap = addMesh(
        new THREE.ConeGeometry(0.52, 0.45, 8),
        mat(red ? "#ff8172" : "#b8ed69"),
        g,
      );
      cap.position.y = 0.35;
      const stripe = addMesh(new THREE.TorusGeometry(0.54, 0.075, 5, 12), mats.white, g);
      stripe.rotation.x = Math.PI / 2;
    }
    return g;
  }
  function disposeEffect(mesh) {
    scene.remove(mesh);
    mesh.traverse((m) => {
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        const materials = Array.isArray(m.material) ? m.material : [m.material];
        for (const material of materials) if (!sharedMaterials.has(material)) material.dispose();
      }
    });
  }
  return {
    create(kind) {
      const mesh = getItemModel(kind);
      scene.add(mesh);
      return mesh;
    },
    remove: disposeEffect,
  };
}
