import * as THREE from "../../../vendor/three/three.module.js";
import { batchStaticMeshes } from "../../rendering/visuals.js";
import { createContactShadowMesh } from "../../rendering/visual-effects.js";
import { sceneryGroundHeight } from "../../rendering/terrain-height.js";
import { TRACK, poseAt, projectTrack, surfaceAt, MILL_T } from "../../track/track.js";
import { cartAt } from "../../simulation/hazards.js";

/** Festival stands, barns, windmill mechanism, and the moving delivery hazard. */
export function buildWindmillLandmarks({ scene, scenery, mats, palette, primitives }) {
  const { wood, darkWood, roof, cream, red, ochre, stone } = palette;
  const { mesh, box, groupAt, sectorT, sphereGeo, cylinderGeo, align } = primitives;
  function baseAt(p) {
    const surface = projectTrack(p, 0, true);
    return { surface, y: sceneryGroundHeight(surface) };
  }
  function barn(t, offset, scale = 1) {
    const g = groupAt(t, offset);
    // Buildings stand upright on the same embankment as the nearby trees.
    g.position.y = baseAt(g.position).y;
    const frame = poseAt(t * TRACK, offset, 0);
    g.rotation.set(0, Math.atan2(-frame.tangent.x, -frame.tangent.z), 0);
    const shadow = createContactShadowMesh({ width: 13, depth: 15, opacity: 0.24 });
    shadow.position.y = 0.035;
    g.add(shadow);
    box(red, g, [0, 3, 0], [9, 6, 11]);
    for (const x of [-3.8, 3.8]) box(cream, g, [x, 3, 5.6], [0.2, 6.1, 0.15]);
    box(darkWood, g, [0, 2.1, 5.6], [3.4, 4.2, 0.15]);
    for (const side of [-1, 1]) {
      const m = box(roof, g, [side * 2.6, 7.1, 0], [6.2, 0.3, 12]);
      m.rotation.z = side * -0.46;
    }
    g.scale.setScalar(scale);
    return g;
  }
  barn(sectorT(0, 0.3), -29, 1.4);
  for (let i = 0; i < 12; i++) {
    const t = sectorT(0, 0.4 + i * 0.012),
      g = groupAt(t, surfaceAt(t).rightEdge + 5 + (i % 3) * 4);
    mesh(cylinderGeo, ochre, g, [0, 1.1, 0], [1.1, 2.5, 1.1]).rotation.z = Math.PI / 2;
  }
  // Festival stands and pennants form a lively wide first sector.
  for (const side of [-1, 1]) {
    const g = groupAt(sectorT(0, 0.08), side * 22);
    for (let row = 0; row < 4; row++) {
      box(wood, g, [0, row * 0.7 + 0.3, row * 1.1], [20, 0.6, 1.1]);
      for (let n = 0; n < 18; n++)
        mesh(
          sphereGeo,
          n % 2 ? cream : red,
          g,
          [-9 + n, row * 0.7 + 1.1, row * 1.1],
          [0.28, 0.4, 0.28],
        );
    }
  }
  for (let i = 0; i < 20; i++) {
    const t = sectorT(0, i / 20),
      side = i % 2 ? 1 : -1,
      g = groupAt(t, side < 0 ? surfaceAt(t).leftEdge - 3 : surfaceAt(t).rightEdge + 3);
    box(wood, g, [0, 2.2, 0], [0.13, 4.4, 0.13]);
    box(i % 2 ? cream : red, g, [0.6, 3.7, 0], [1.2, 0.75, 0.035]);
  }

  // The mill straddles the road; the 18 m wide, 10 m tall portal clears kart and camera.
  const mill = groupAt(MILL_T);
  for (const side of [-1, 1]) {
    box(stone, mill, [side * 10.4, 5, 0], [2.2, 10, 10]);
    box(darkWood, mill, [side * 9.5, 5.1, 4.4], [0.3, 10.2, 0.35]);
  }
  box(stone, mill, [0, 11.2, 0], [23, 2.4, 10]);
  box(darkWood, mill, [0, 10.1, 4.6], [21, 0.45, 0.45]);
  mesh(new THREE.CylinderGeometry(6, 7, 11, 16), stone, mill, [0, 17.8, 0]);
  mesh(new THREE.ConeGeometry(8, 6, 16), roof, mill, [0, 26.1, 0]);
  box(darkWood, mill, [0, 18, 6.9], [2.2, 2.8, 0.12]);
  const rotor = new THREE.Group();
  rotor.position.set(0, 20, 8);
  mill.add(rotor);
  mesh(cylinderGeo, darkWood, rotor, [0, 0, 0], [0.6, 0.7, 0.6]).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Group();
    blade.rotation.z = (i * Math.PI) / 2;
    rotor.add(blade);
    box(darkWood, blade, [0, 4.2, 0], [0.35, 8.4, 0.22]);
    box(cream, blade, [0.9, 5.1, 0.12], [1.8, 5.4, 0.12]);
    for (let j = 0; j < 5; j++) box(wood, blade, [0.9, 3 + j, 0.2], [1.9, 0.12, 0.13]);
    batchStaticMeshes(blade);
  }
  batchStaticMeshes(mill, [rotor]);
  barn(sectorT(4, 0.8), 24, 0.85);
  for (let i = 0; i < 12; i++) {
    const g = groupAt(sectorT(4, 0.6 + i * 0.008), 13 + (i % 3) * 2.5);
    box(wood, g, [0, 0.9, 0], [1.8, 1.8, 1.8]);
    for (const x of [-0.8, 0.8]) box(darkWood, g, [x, 0.9, 0.93], [0.12, 1.9, 0.05]);
  }
  const cart = new THREE.Group();
  scene.add(cart);
  box(darkWood, cart, [0, 0.6, 0], [2.7, 0.45, 4.3]);
  for (const x of [-1.35, 1.35])
    for (const z of [-1.5, 1.5]) {
      const wheel = mesh(cylinderGeo, mats.black, cart, [x, 0.3, z], [0.5, 0.22, 0.5]);
      wheel.rotation.z = Math.PI / 2;
    }
  for (let i = 0; i < 3; i++) box(ochre, cart, [0, 1.4, (i - 1) * 1.15], [2.4, 1.2, 1]);
  batchStaticMeshes(cart);
  const warningMaterial = new THREE.MeshStandardMaterial({
    color: "#ffc850",
    emissive: "#ff9d25",
    emissiveIntensity: 0,
  });
  const warning = groupAt(cartAt(0).s / TRACK, 9.6);
  box(darkWood, warning, [0, 2, 0], [0.17, 4, 0.17]);
  mesh(sphereGeo, warningMaterial, warning, [0, 4.2, 0], [0.45, 0.45, 0.45]);

  return {
    mill,
    update(time) {
      rotor.rotation.z = time * 0.75;
      const state = cartAt(time);
      align(cart, state);
      warningMaterial.emissiveIntensity = state.warning ? 1.5 + Math.sin(time * 12) : 0;
    },
  };
}
