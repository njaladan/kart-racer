import * as THREE from "../../vendor/three/three.module.js";
import { addGlow } from "./visual-effects.js";

export const DRIFT_COLORS = ["#d6edf1", "#36bfff", "#ff961f"];

/** Persistent, kart-local readiness: one blue diamond, two orange diamonds. */
export function createDriftReadiness(root) {
  const group = new THREE.Group();
  group.name = "Mini-turbo readiness";
  group.visible = false;
  const geometry = new THREE.OctahedronGeometry(0.19);
  const material = new THREE.MeshBasicMaterial({ color: DRIFT_COLORS[1], toneMapped: false });
  for (const side of [-1, 1]) {
    const marker = new THREE.Group();
    marker.position.set(side * 1.24, 0.62, 0.85);
    for (let i = 0; i < 2; i++) {
      const diamond = new THREE.Mesh(geometry, material);
      diamond.position.y = i * 0.36;
      diamond.userData.orangeOnly = i === 1;
      marker.add(diamond);
    }
    addGlow(marker, { color: DRIFT_COLORS[1], size: 1.1, opacity: 0.65 });
    group.add(marker);
  }
  root.add(group);
  return group;
}

export function updateDriftReadiness(group, state, time) {
  const tier = state.driftTier || 0;
  group.visible = tier > 0 && !!state.driftDirection && state.grounded && !(state.spin > 0);
  if (!group.visible) return;
  const color = DRIFT_COLORS[Math.min(2, tier)];
  const pulse = 1 + Math.sin(time * (tier === 2 ? 15 : 10)) * 0.07;
  for (const marker of group.children) {
    marker.scale.setScalar(pulse);
    for (const part of marker.children) {
      part.visible = !part.userData.orangeOnly || tier === 2;
      part.material.color.set(color);
    }
  }
}
