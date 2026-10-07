import * as THREE from "../../../vendor/three/three.module.js";
import { batchStaticMeshes } from "../../rendering/visuals.js";
import { createContactShadowMesh } from "../../rendering/visual-effects.js";
import { TRACK, surfaceAt, MILL_T } from "../../track/track.js";
import { cartAt } from "../../simulation/hazards.js";

/** Authored countryside buildings, curved mill masonry, and the cart hazard. */
export function buildWindmillLandmarks({ scene, scenery, mats, palette, primitives, kit, track }) {
  const { wood, darkWood, stone } = palette;
  const { mesh, box, groupAt, sectorT, sphereGeo, cylinderGeo, align } = primitives;
  const asset = (name, parent, position, size) =>
    kit.asset(`windmill:${name}`, parent, position, [size, size, size]);
  function building(section, f, side, height, name = "farmhouse") {
    const t = sectorT(section, f),
      s = surfaceAt(t);
    const g = kit.safeGroup(
      t,
      side * ((side > 0 ? s.rightEdge : -s.leftEdge) + height * 1.2 + 7),
      height * 0.8,
    );
    if (!g) return;
    g.name = `Textured ${name} with recessed windows and roof eaves`;
    g.rotation.y += side < 0 ? 0.3 : Math.PI + 0.25;
    asset(name, g, [0, 0, 0], height);
    const shadow = createContactShadowMesh({
      width: height * 1.4,
      depth: height * 1.5,
      opacity: 0.23,
    });
    shadow.position.y = 0.025;
    g.add(shadow);
    // A coherent working yard: true timber grain, stone foundations, loaded
    // pallets and flower borders share modular imported UV-painted pieces.
    for (let j = 0; j < 3; j++) {
      asset("pallet", g, [(j - 1) * 2.4, 0.04, height * 0.75], 0.34);
      if (j % 2 === 0) asset("hay-bale", g, [(j - 1) * 2.4, 0.36, height * 0.75], 1.5);
    }
    asset("flower-bush", g, [-height * 0.6, 0.03, height * 0.5], 1.1);
    asset("flower-bush", g, [height * 0.6, 0.03, height * 0.5], 1.1);
    return g;
  }
  building(0, 0.29, -1, 10.5);
  building(0, 0.79, 1, 7.5, "cottage");
  building(1, 0.79, -1, 7.5);
  building(2, 0.16, -1, 8);
  building(3, 0.08, 1, 7.5);
  building(3, 0.83, -1, 6.5);
  building(4, 0.12, -1, 9);
  building(4, 0.8, 1, 8);
  building(5, 0.47, -1, 8, "cottage");
  building(5, 0.83, 1, 7.5);

  for (let i = 0; i < 12; i++) {
    const t = sectorT(0, 0.4 + i * 0.012),
      s = surfaceAt(t);
    const g = kit.safeGroup(t, s.rightEdge + 8 + (i % 3) * 4, 1.5);
    if (g) asset("hay-bale", g, [0, 0, 0], 1.8);
  }
  // Field boundaries read as old stonework with real mottled texture, while
  // posts never trespass onto shortcuts or the declared kart passing lane.
  for (const section of [0, 2, 4, 5])
    for (let i = 0; i < 8; i++) {
      const t = sectorT(section, 0.1 + i * 0.105),
        side = i % 2 ? 1 : -1,
        s = surfaceAt(t);
      const g = kit.safeGroup(t, side * ((side > 0 ? s.rightEdge : -s.leftEdge) + 7), 2);
      if (!g) continue;
      g.name = "Countryside dry stone field wall";
      asset("stone-wall", g, [0, -0.08, 0], 1.25);
      if (i % 3 === 0) asset("bench", g, [0, 0, 2.5], 1.05);
    }

  // Purpose-built bevelled arch module replaces the rectangular mill portal.
  // The 13 m intrados covers the complete deck and asymmetric soft apron,
  // with three metres of clearance for the curve through its eight-metre depth.
  const mill = groupAt(MILL_T);
  mill.name = "Working countryside windmill arch";
  mill.userData.scenicAssembly = false;
  const left = track.platformEdgeAt(MILL_T, -1),
    right = track.platformEdgeAt(MILL_T, 1),
    passageScale = (right - left + 6) / 21,
    passageCenter = (left + right) / 2;
  mill.position.addScaledVector(track.frameAt(MILL_T).right, passageCenter);
  // Preserve the fitted envelope, including the former bevel/crown extents,
  // without constructing and immediately discarding an extruded arch.
  const halfSpan = Math.fround(Math.fround(14.16) * passageScale);
  const archBounds = {
    min: [-halfSpan, -0.16, -0.16],
    max: [halfSpan, 23.160011291503906, 8.16],
  };
  const archMesh = mesh(
    kit.authoredGeometry("blender:mill-masonry", archBounds),
    stone,
    mill,
    [0, 0, -4],
  );
  archMesh.name = "Blender mill arch masonry";
  // Architectural masonry uses a consistent metre-based tile density.
  const uv = archMesh.geometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, uv.getY(i) / 4);
  asset("farmhouse", mill, [0, 21.5, -0.5], 10);
  for (const side of [-1, 1]) {
    asset("stone-wall", mill, [side * (12 * passageScale + 2), 0, 4.2], 1.7);
    box(darkWood, mill, [side * 11.2 * passageScale, 6, 4.15], [0.3, 12, 0.45]);
    box(wood, mill, [side * 12 * passageScale, 12.7, 4.15], [3.7, 0.35, 0.5]);
  }
  const rotor = new THREE.Group();
  rotor.position.set(0, 26.5, 7);
  mill.add(rotor);
  rotor.name = "Authored iron windmill rotor";
  rotor.userData.skipBake = true;
  const blades = asset("windpump-rotor", rotor, [0, -5.5, 0], 11);
  // Upstream windpump blades are mounted vertically. Normalized asset pivots
  // are grounded, so subtract half their normalized height for axle rotation.
  blades.position.y = -5.5;
  // Additional pump silhouettes tie the main landmark to the working farms.
  for (const [f, side] of [
    [0.3, -1],
    [0.88, 1],
  ]) {
    const t = sectorT(4, f),
      s = surfaceAt(t);
    const g = kit.safeGroup(t, side * ((side > 0 ? s.rightEdge : -s.leftEdge) + 24), 5);
    if (g) asset("windpump", g, [0, 0, 0], 16);
  }

  // Delivery cart retains its exact physics footprint and clock. Timber trim
  // is legitimate modular geometry; the load uses downloaded textured hay.
  const cart = new THREE.Group();
  scene.add(cart);
  cart.userData.skipBake = true;
  box(darkWood, cart, [0, 0.6, 0], [2.7, 0.45, 4.3]);
  for (const x of [-1.35, 1.35])
    for (const z of [-1.5, 1.5]) {
      const wheel = mesh(cylinderGeo, mats.black, cart, [x, 0.3, z], [0.5, 0.22, 0.5]);
      wheel.rotation.z = Math.PI / 2;
    }
  for (let i = 0; i < 3; i++) asset("hay-bale", cart, [0, 0.85, (i - 1) * 1.15], 1.15);
  batchStaticMeshes(cart);
  const warningMaterial = new THREE.MeshStandardMaterial({
    color: "#ffc850",
    emissive: "#ff9d25",
    emissiveIntensity: 0,
  });
  const warning = groupAt(cartAt(0).s / TRACK, 9.6);
  box(darkWood, warning, [0, 2, 0], [0.17, 4, 0.17]);
  mesh(sphereGeo, warningMaterial, warning, [0, 4.2, 0], [0.45, 0.45, 0.45]);
  warning.userData.skipBake = true;
  return {
    mill,
    animated: [rotor, warning],
    update(time) {
      rotor.rotation.z = time * 0.5;
      const state = cartAt(time);
      align(cart, state);
      warningMaterial.emissiveIntensity = state.warning ? 1.5 + Math.sin(time * 12) : 0;
    },
  };
}
