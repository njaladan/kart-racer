import * as THREE from "../../vendor/three/three.module.js";
import { bakeVertexShade } from "./vertex-shading.js";

function shellTexture(red) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const base = red ? "#c8323e" : "#378f3e";
  const light = red ? "#ff8174" : "#a8e774";
  const dark = red ? "#701d29" : "#1c5b2e";
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, light);
  gradient.addColorStop(0.42, base);
  gradient.addColorStop(1, dark);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.lineWidth = 4;
  context.strokeStyle = red ? "rgba(87,18,30,.68)" : "rgba(16,65,33,.68)";
  for (let panel = 0; panel <= 6; panel++) {
    const x = (panel / 6) * canvas.width;
    context.beginPath();
    context.moveTo(x, 0);
    context.bezierCurveTo(x - 12, 36, x + 12, 88, x, canvas.height);
    context.stroke();
  }
  for (const y of [34, 78, 105]) {
    context.beginPath();
    context.ellipse(canvas.width / 2, y, canvas.width * 0.51, 8, 0, 0, Math.PI * 2);
    context.stroke();
  }
  context.strokeStyle = "rgba(255,255,255,.24)";
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(canvas.width / 2, 23, 52, 13, 0, Math.PI * 1.08, Math.PI * 1.92);
  context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

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
      const red = kind === "red";
      const highlight = red ? "#ff8b79" : "#9fe36e";
      const shellMat = mat("#ffffff", 0.23, {
        metalness: 0.08,
        emissive: red ? "#481013" : "#153d19",
        emissiveIntensity: 0.16,
      });
      shellMat.map = shellTexture(red);
      shellMat.needsUpdate = true;
      const bellyMat = mat(red ? "#f1d8b2" : "#e4db9c", 0.68);
      const seamMat = mat(red ? "#8d202a" : "#226d31", 0.42);
      const shineMat = mat(highlight, 0.2, {
        metalness: 0.04,
        emissive: highlight,
        emissiveIntensity: 0.08,
      });
      addMesh(
        new THREE.SphereGeometry(0.57, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
        bellyMat,
        g,
      );
      addMesh(
        new THREE.SphereGeometry(0.6, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2),
        shellMat,
        g,
      );
      const rim = addMesh(new THREE.TorusGeometry(0.555, 0.09, 10, 32), bellyMat, g);
      rim.rotation.x = Math.PI / 2;
      const seam = addMesh(new THREE.TorusGeometry(0.46, 0.018, 6, 32), seamMat, g);
      seam.rotation.x = Math.PI / 2;
      seam.position.y = 0.12;
      const topPlate = addMesh(new THREE.CircleGeometry(0.22, 6), shineMat, g);
      topPlate.rotation.x = -Math.PI / 2;
      topPlate.position.y = 0.565;
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const plate = addMesh(new THREE.SphereGeometry(0.105, 10, 8), shineMat, g);
        plate.scale.set(1.1, 0.45, 1.35);
        plate.position.set(Math.cos(angle) * 0.36, 0.35, Math.sin(angle) * 0.36);
      }
    }
    return g;
  }
  function disposeEffect(mesh) {
    scene.remove(mesh);
    mesh.traverse((m) => {
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        const materials = Array.isArray(m.material) ? m.material : [m.material];
        for (const material of materials)
          if (!sharedMaterials.has(material)) {
            material.map?.dispose();
            material.dispose();
          }
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
