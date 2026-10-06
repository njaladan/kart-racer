import { registerLightPool } from "../../rendering/course-lighting.js";
import { createContactShadowMesh, addGlow } from "../../rendering/visual-effects.js";

/** Shared winter materials and readable, grounded festival construction. */
export function createFestivalKit({ THREE, scene, scenery, track, textures, kit }) {
  const { material, box, mesh, asset } = kit;
  const palette = {
    snow: material("#f2f6ff", { map: textures.snow }),
    timber: material("#c49a73", { map: textures.wood }),
    bark: material("#766050", { map: textures.bark }),
    cream: material("#ffead0"),
    dark: material("#304859"),
    cyan: material("#54b6c6", { map: textures.fabric }),
    red: material("#ffffff", { map: textures.frostKnit || textures.fabric }),
    glass: material("#a6d7e7", { roughness: 0.18, metalness: 0.12 }),
    rock: material("#8297b7", { map: textures.stone }),
    gold: material("#ffe8a6", { emissive: "#ffc473", emissiveIntensity: 0.85 }),
    ice: material("#8fc6e9", { map: textures.frostIce, roughness: 0.24, metalness: 0.13 }),
  };
  const geometry = {
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 8),
    sphere: new THREE.SphereGeometry(1, 8, 6),
    cone: new THREE.ConeGeometry(1, 1, 7),
  };
  const edgeOffset = (t, side, margin = 0) =>
    (side < 0 ? track.surfaceAt(t).leftEdge : track.surfaceAt(t).rightEdge) + side * margin;
  const landAt = (t, offset, parent = scenery) => kit.landGroup(t, offset, parent);
  const groundShadow = (g, width, depth = width) => {
    const shadow = createContactShadowMesh({ width, depth, opacity: 0.21 });
    shadow.position.y = 0.045;
    g.add(shadow);
  };
  const beam = (g, a, b, radius = 0.1, mat = palette.timber) => {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b);
    const m = mesh(geometry.cylinder, mat, g, [0, 0, 0], [radius, start.distanceTo(end), radius]);
    m.position.copy(start).add(end).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    return m;
  };
  const rail = (g, x, y, z, width, axis = "x") => {
    box(palette.timber, g, [x, y, z], axis === "x" ? [width, 0.17, 0.17] : [0.17, 0.17, width]);
    for (const u of [-0.5, 0, 0.5])
      box(
        palette.bark,
        g,
        [x + (axis === "x" ? u * width : 0), y - 0.6, z + (axis === "z" ? u * width : 0)],
        [0.16, 1.4, 0.16],
      );
  };
  const lantern = (g, position, size = 1, color = palette.gold) => {
    const [x, y, z] = position;
    mesh(geometry.cylinder, color, g, [x, y, z], [0.34 * size, 0.7 * size, 0.34 * size]);
    for (const h of [-0.4, 0.4])
      box(palette.dark, g, [x, y + h * size, z], [0.65 * size, 0.07 * size, 0.65 * size]);
    addGlow(g, { color: "#ffd295", size: [2.1 * size, 2.1 * size], opacity: 0.14, position });
  };
  const pole = (g, x, y, z, height = 5) => {
    asset("frostpeak:wood-lamp", g, [x, y, z], [height, height, height]);
    addGlow(g, {
      color: "#ffcf87",
      size: [1.8, 1.8],
      opacity: 0.17,
      position: [x + 0.5, y + height - 0.4, z],
    });
    g.updateWorldMatrix(true, false);
    registerLightPool(scene, {
      position: g.localToWorld(new THREE.Vector3(x + 0.5, y + height - 0.4, z)),
      color: "#ffc78c",
      intensity: 8,
      radius: 18,
    });
  };
  const chalet = (section, fraction, side, height = 10, margin = 10) => {
    const t = kit.sectorT(section, fraction);
    const g = kit.safeGroup(t, edgeOffset(t, side, margin + height * 0.5), height * 0.6);
    if (!g) return null;
    g.name = "Snow lodge with festival windows";
    g.rotation.y += (side * Math.PI) / 2;
    groundShadow(g, height * 1.4);
    asset("frostpeak:chalet", g, [0, 0, 0], [height, height, height]);
    asset("kenney:holiday-kit/wreath", g, [0, height * 0.35, -height * 0.4], [1.5, 1.5, 1.5]);
    pole(g, -height * 0.57, 0, -height * 0.5, 4);
    return g;
  };
  return {
    ...kit,
    palette,
    geometry,
    edgeOffset,
    landAt,
    groundShadow,
    beam,
    rail,
    lantern,
    pole,
    chalet,
  };
}
