import { buildHarborLife } from "./neon-harbor/build-harbor-life.js";
import { buildWaterfront } from "./neon-harbor/build-waterfront.js";
import { buildCityProps } from "./neon-harbor/build-city-props.js";
import { buildStreetDressing } from "./neon-harbor/build-street-dressing.js";
import { buildPortLandmarks } from "./neon-harbor/build-port-landmarks.js";
import { installSurfaceDetail } from "../rendering/surface-detail.js";

// Authored imported architecture supplies silhouettes, recesses and baked AO.
// The shared engine retains every physical road, verge and camera boundary.
export default function buildWorld(context) {
  const { THREE, scene, scenery, track, kit, hazardAt, trafficAt, textures = {} } = context;
  const { material, mesh, box, groupAt, sectorT, batch } = kit;
  const steel = material("#647889", { map: textures.metal, metalness: 0.28, roughness: 0.58 });
  const concrete = material("#a0adb5", { map: textures.concrete, roughness: 0.85 });
  const amber = material("#d5a761", { map: textures.metal, metalness: 0.15, roughness: 0.65 });
  const trim = material("#adc2ce", { map: textures.concrete, roughness: 0.8 });
  const cyan = material("#78ded5", { emissive: "#26aebb", emissiveIntensity: 1.35 });
  const pink = material("#eb91c7", { emissive: "#bf4789", emissiveIntensity: 1.3 });
  const blue = material("#547896", { map: textures.metal, roughness: 0.57 });
  const rust = material("#a27665", { map: textures.metal, roughness: 0.8 });
  const dark = material("#202b39", { roughness: 0.87 });
  const glass = material("#324f6d", { metalness: 0, roughness: 0.2, envMapIntensity: 1.25 });
  const window = material("#e6c393", { emissive: "#d39247", emissiveIntensity: 0.95 });
  installSurfaceDetail(concrete, { kind: "terrain", scale: 0.12, strength: 0.13 });
  installSurfaceDetail(steel, { kind: "terrain", scale: 0.08, strength: 0.075 });
  const palette = {
    amber,
    blue,
    concrete,
    cyan,
    dark,
    glass,
    pink,
    rust,
    steel,
    trim,
    window,
  };
  const geometry = {
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
    sphere: new THREE.SphereGeometry(1, 12, 8),
  };
  const animated = [],
    ferries = [],
    craneHooks = [];
  const props = buildCityProps({ THREE, scene, kit, scenery, track, palette });
  const { safeGroup, building, industrialBuilding, lamp, fitAsset, groundShadow, lightAt } = props;

  // Promenade: staggered townhouses behind palms and street furniture.
  for (let i = 0; i < 20; i++) {
    const t = sectorT(0, (i + 0.5) / 20);
    lamp(t, -14.5, i);
    if (i % 2 === 0) building(t, 29 + (i % 3) * 7, 13, 18 + (i % 4) * 5, 11, i);
    if (i % 3 === 0) {
      const g = safeGroup(t, -22, 4.5);
      if (!g) continue;
      fitAsset("harbor:palm", g, [0, 0, 0], [7, 10 + (i % 3), 7]);
      fitAsset("harbor:bench", g, [4, 0, 0], [3.2, 1.2, 1.1]);
      groundShadow(g, 8, 7);
    }
  }
  // Downtown: uninterrupted storefronts and apartments on both sides of
  // three linked street bends. Their near walls make the district read as a
  // street canyon while keeping the road itself open.
  for (let i = 0; i < 24; i++) {
    const t = sectorT(1, (i + 0.5) / 24);
    for (const side of [-1, 1]) {
      const offset = side * (21 + (i % 3) * 2.5);
      building(t, offset, 13 + (i % 3) * 2, 17 + (i % 4) * 3, 15, i + 70);
      if (i % 3 === 0) lamp(t, side * 13.5, i + 80);
    }
  }
  // Market: textured rooflines, intimate storefronts and imported kiosks.
  for (let i = 0; i < 18; i++) {
    const t = sectorT(2, (i + 0.5) / 18),
      side = i % 2 ? 1 : -1;
    building(t, side * (28 + (i % 3) * 4), 12, 14 + (i % 4) * 2.5, 11, i + 20);
    const edge = side > 0 ? track.surfaceAt(t).rightEdge : -track.surfaceAt(t).leftEdge;
    const g = safeGroup(t, side * (edge + 5.3), 3);
    if (!g) continue;
    fitAsset("harbor:kiosk", g, [0, 0, 0], [4.6, 4, 3.2]);
    groundShadow(g, 6.3, 4.8);
    box(i % 2 ? cyan : pink, g, [0, 3.35, 1.65], [3.4, 0.13, 0.06]);
    fitAsset("harbor:pallet", g, [2.8, 0, -0.2], [1.3, 0.2, 1.1]);
    lightAt(g, [0, 3.1, 1.9], i % 2 ? "#e8ba7a" : "#cf76b0", 2.5, 14);
  }
  // Banners occupy only the overhead camera-safe envelope.
  for (const f of [0.22, 0.67]) {
    const g = groupAt(sectorT(2, f), 0, scenery);
    box(steel, g, [0, 13.8, 0], [24, 0.07, 0.07]);
    for (let i = 0; i < 7; i++) {
      const lantern = mesh(
        geometry.cylinder,
        i % 2 ? cyan : pink,
        g,
        [-9 + i * 3, 13.45, 0],
        [0.25, 0.55, 0.25],
      );
      lantern.castShadow = false;
    }
  }
  // Industrial hall: structural pieces are appropriate modular trim geometry.
  // All bulky decorative buildings and machinery are offline authored assets.
  const hall = groupAt(sectorT(4, 0.4), 0, scenery);
  for (const side of [-1, 1]) {
    box(steel, hall, [side * 15, 6.5, 0], [2, 13, 30]);
    for (const z of [-14, -7, 0, 7, 14]) {
      box(concrete, hall, [side * 13.7, 6.5, z], [0.6, 13, 0.6]);
      box(glass, hall, [side * 13.88, 7, z], [0.08, 3.2, 4]);
      box(window, hall, [side * 13.78, 4.3, z], [0.06, 0.12, 4.2]);
    }
    box(amber, hall, [side * 13.45, 1.5, 0], [0.08, 0.22, 28]);
    for (const z of [-9, 9]) lightAt(hall, [side * 11.7, 9.5, z], "#eecb91", 3, 20);
  }
  box(steel, hall, [0, 13.7, 0], [32, 1.2, 30]);
  for (const z of [-14, -7, 0, 7, 14]) box(concrete, hall, [0, 13.25, z], [28, 0.6, 0.35]);
  for (const x of [-7, 7]) box(window, hall, [x, 13.05, 0], [0.22, 0.06, 25]);
  batch(hall);
  for (let i = 0; i < 10; i++) {
    const t = sectorT(4, 0.1 + i * 0.083),
      side = i % 2 ? 1 : -1;
    industrialBuilding(t, side * (34 + (i % 3) * 5), 14, 12 + (i % 3) * 5, 12, i);
    const g = safeGroup(t, side * 22, 5.5);
    if (g) {
      fitAsset("harbor:container", g, [0, 0, 0], [4, 3.6, 8]);
      fitAsset("harbor:pallet", g, [-3.5, 0, 0], [2, 0.4, 2]);
      if (i % 3 === 0) fitAsset("harbor:aircon", g, [2.7, 0, 3], [2, 2.5, 2]);
      groundShadow(g, 7.5, 10);
    }
    lamp(t, side * 14, i + 20);
  }

  const { harborPose } = buildWaterfront({
    THREE,
    scene,
    animated,
    craneHooks,
    ferries,
    lamp,
    safeGroup,
    fitAsset,
    scenery,
    textures,
    track,
    kit,
    palette,
    geometry,
  });
  // Terminal: individually corrugated containers with real locking hardware.
  for (let i = 0; i < 20; i++) {
    const t = sectorT(4, (i + 0.5) / 20),
      side = i % 2 ? 1 : -1;
    if (side > 0 && i > 7 && i < 15) continue;
    const g = safeGroup(t, side * (22 + (i % 3) * 5), 6.5);
    if (!g) continue;
    for (let row = 0; row < (i % 3 ? 2 : 1); row++)
      fitAsset("harbor:container", g, [row * 0.18, row * 3.4, 0], [5, 3.3, 11]);
    groundShadow(g, 7, 13);
    if (i % 3 === 0) lamp(t, side * 14, i + 40);
    if (i % 5 === 0) industrialBuilding(t, side * 54, 18, 22, 14, i);
  }
  // Boulevard: metropolitan frontage around the final competing corner.
  for (let i = 0; i < 22; i++) {
    const t = sectorT(7, (i + 0.5) / 22),
      side = i % 2 ? 1 : -1;
    const extra = side > 0 ? track.shortcutWidth(t) : 0;
    lamp(t, side * (14 + extra), i + 60);
    if (i % 2 === 0) building(t, side * (32 + extra), 14, 28 + (i % 4) * 7, 13, i + 40);
    if (i % 4 === 1) {
      const g = safeGroup(t, side * (23 + extra), 4.4);
      if (g) fitAsset("harbor:palm", g, [0, 0, 0], [6.5, 11, 6.5]);
    }
  }
  buildStreetDressing({ THREE, scenery, track, kit, palette, props });
  const portLandmarks = buildPortLandmarks({
    THREE,
    scenery,
    kit,
    palette,
    track,
    trafficAt,
    animated,
    geometry,
  });

  // Atmospheric layered skylines use the same authored meshes at modest cost.
  for (const district of [0, 3, 7])
    for (let i = 0; i < 12; i++) {
      const t = sectorT(district, 0.045 + i * 0.081),
        offset = district === 3 ? -117 - (i % 3) * 19 : 77 + (i % 3) * 18;
      const width = 13 + (i % 3) * 4,
        height = 30 + ((i * 3 + district) % 7) * 7;
      const g = safeGroup(t, offset, Math.hypot(width, 13) / 2);
      if (!g) continue;
      if (district === 3) g.position.y = -1.7;
      fitAsset(`harbor:${i % 2 ? "housing-a" : "housing-b"}`, g, [0, 0, 0], [width, height, 13]);
    }
  const harborLife = buildHarborLife({
    THREE,
    animated,
    craneHooks,
    harborPose,
    hazardAt,
    safeGroup,
    scene,
    scenery,
    track,
    kit,
    palette,
    geometry,
  });
  return {
    animated,
    update(time, state) {
      harborLife.update(time, state);
      portLandmarks.update(time, state);
    },
  };
}
