import { buildHarborLife } from "./neon-harbor/build-harbor-life.js";
import { buildWaterfront } from "./neon-harbor/build-waterfront.js";
import { buildCityProps } from "./neon-harbor/build-city-props.js";
// Place-specific scenery only. Shared road, walls, progression and contact
// surfaces remain in the engine; the shuttle uses the same hazard pose as AI.
import { addGlow } from "../rendering/visual-effects.js";

export default function buildWorld(context) {
  const { THREE, scene, scenery, track, kit, hazardAt, textures = {} } = context;
  const { material, mesh, box, groupAt, sectorT, batch, asset } = kit;
  const steel = material("#344d68", {
    map: textures.metal ?? null,
    metalness: 0.42,
    roughness: 0.56,
  });
  const concrete = material("#a2becb", { map: textures.concrete ?? null, roughness: 0.86 });
  const amber = material("#f5ba66", {
    map: textures.metal ?? null,
    metalness: 0.2,
    roughness: 0.66,
  });
  const masonry = material("#9c7687", { map: textures.brick ?? null, roughness: 0.9 });
  const paleMasonry = material("#c5a2ab", { map: textures.brick ?? null, roughness: 0.9 });
  const trim = material("#c4dde1", { map: textures.concrete ?? null, roughness: 0.78 });
  const cyan = material("#76f0ed", { emissive: "#23bbbd", emissiveIntensity: 1.15 });
  const pink = material("#ff7dc8", { emissive: "#bd388c", emissiveIntensity: 1 });
  const blue = material("#708ad0", {
    map: textures.metal ?? null,
    metalness: 0.24,
    roughness: 0.65,
  });
  const rust = material("#c78668", {
      map: textures.metal ?? null,
      metalness: 0.2,
      roughness: 0.72,
    }),
    dark = material("#18283a");
  const cloth = material("#f9c1ba", { roughness: 0.96 });
  const glass = material("#284c6a", { metalness: 0.35, roughness: 0.29 });
  const windowLight = material("#ffe4a0", { emissive: "#edac57", emissiveIntensity: 0.85 });
  const skin = material("#edc5a7", { roughness: 0.88 });
  const sphere = new THREE.SphereGeometry(1, 10, 6);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const ring = new THREE.TorusGeometry(1.3, 0.14, 5, 14);
  const animated = [],
    ferries = [],
    craneHooks = [];
  const industrialModels = ["building-a", "building-e", "building-m", "building-q"];

  const palette = {
    amber,
    blue,
    cloth,
    concrete,
    cyan,
    dark,
    glass,
    masonry,
    paleMasonry,
    pink,
    rust,
    skin,
    steel,
    trim,
    window: windowLight,
  };
  const geometry = { cylinder, ring, sphere };
  const { safeGroup, groundShadow, building, industrialBuilding, lamp } = buildCityProps({
    industrialModels,
    kit,
    scenery,
    track,
    palette,
    geometry,
  });
  // Promenade: waterfront lamps and a city skyline, with open sightlines.
  for (let i = 0; i < 20; i++) {
    const t = sectorT(0, (i + 0.5) / 20);
    lamp(t, -13, i);
    if (i % 4 === 0) industrialBuilding(t, 25 + (i % 3) * 9, 14, 21 + (i % 5) * 3, 10, i);
    else if (i % 2 === 0) building(t, 25 + (i % 3) * 9, 12, 18 + (i % 5) * 6, 12, i);
    const g = safeGroup(t, -19, 2.5);
    if (g) {
      if (i % 3 === 0 && asset) {
        box(concrete, g, [0, 0.55, 0], [3, 1.1, 3]);
        box(dark, g, [0, 1.12, 0], [2.75, 0.08, 2.75]);
        asset("pine", g, [0, 1.16, 0], [3, 5, 3]);
      } else {
        box(concrete, g, [0, 0.4, 0], [4, 0.8, 1.2]);
        box(steel, g, [0, 1.3, 0.4], [4, 0.18, 0.15]);
      }
    }
  }

  // Market compresses into two color districts with freestanding stalls.
  // Awnings remain outside the road; street banners clear the camera by 13 m.
  for (let i = 0; i < 18; i++) {
    const t = sectorT(1, (i + 0.5) / 18),
      side = i % 2 ? 1 : -1;
    building(t, side * (23 + (i % 3) * 3), 10, 13 + (i % 4) * 3, 10, i + 20);
    const g = safeGroup(t, side * 14, 3.2);
    if (!g) continue;
    groundShadow(g, 6.2, 5.6);
    box(rust, g, [0, 1, 0], [4.5, 2, 3]);
    for (const x of [-2, 2]) box(steel, g, [x, 3, 0], [0.12, 4, 0.12]);
    box(cloth, g, [0, 4.5, 0], [5.2, 0.24, 3.4]);
    for (let stripe = 0; stripe < 7; stripe++) {
      const x = -2.25 + stripe * 0.75;
      box(i % 2 ? pink : cyan, g, [x, 4.65, 0], [0.36, 0.06, 3.4]);
      box(i % 2 ? pink : cyan, g, [x, 4.23, 1.68], [0.55, 0.45, 0.08]);
    }
    for (const x of [-1.7, 1.7]) {
      box(steel, g, [x, 4.05, 0], [0.07, 0.6, 0.07]);
      mesh(sphere, windowLight, g, [x, 3.6, 0], [0.28, 0.4, 0.28]);
      if (i % 3 === 0)
        addGlow(g, { color: "#ffe4a0", size: 1.6, opacity: 0.3, position: [x, 3.6, 0] });
    }
    box(trim, g, [0, 2.08, 0], [4.7, 0.2, 3.1]);
    for (let j = 0; j < 4; j++) {
      const x = -1.5 + j;
      box(steel, g, [x, 2.3, 0.3], [0.85, 0.45, 1.35]);
      for (let k = 0; k < 3; k++)
        mesh(
          sphere,
          j % 2 ? amber : pink,
          g,
          [x + (k - 1) * 0.2, 2.59, 0.22 + k * 0.23],
          [0.15, 0.16, 0.15],
        );
    }
    for (const z of [-0.85, 0.85]) box(amber, g, [2.1, 0.5, z], [0.5, 0.95, 0.9]);
    box(steel, g, [-1.3, 0.4, -2], [1.2, 0.8, 0.9]);
    mesh(cylinder, dark, g, [1.7, 0.65, -2.2], [0.48, 1.3, 0.48]);
  }
  for (const f of [0.22, 0.67]) {
    const g = groupAt(sectorT(1, f), 0, scenery);
    box(pink, g, [0, 13.4, 0], [24, 0.28, 0.3]);
    for (let i = 0; i < 7; i++) box(i % 2 ? cyan : pink, g, [-9 + i * 3, 13, 0], [1.1, 0.6, 0.08]);
  }

  // A short loading hall, rather than a full-sector tunnel. Wide sidewalls
  // leave the curved route and trailing camera room; overhead begins at 13 m.
  const hall = groupAt(sectorT(2, 0.4), 0, scenery);
  for (const side of [-1, 1]) {
    box(steel, hall, [side * 15, 6.5, 0], [2, 13, 30]);
    for (const z of [-14, 0, 14]) box(concrete, hall, [side * 13.7, 6.5, z], [0.6, 13, 0.6]);
    box(amber, hall, [side * 13.45, 3, 0], [0.08, 0.3, 28]);
  }
  box(steel, hall, [0, 13.6, 0], [32, 1.2, 30]);
  for (const z of [-14, 0, 14]) box(concrete, hall, [0, 13.4, z], [28, 0.8, 0.5]);
  for (const x of [-7, 7]) box(windowLight, hall, [x, 13.05, 0], [0.3, 0.08, 25]);
  batch(hall);
  for (let i = 0; i < 10; i++) {
    const t = sectorT(2, 0.12 + i * 0.075),
      g = safeGroup(t, (i % 2 ? 1 : -1) * 23, 4.5);
    if (!g) continue;
    box(i % 2 ? rust : blue, g, [0, 2, 0], [6, 4, 5]);
    for (const x of [-2, 0, 2]) box(amber, g, [x, 2, 2.53], [0.1, 4, 0.06]);
    box(steel, g, [0, 0.12, 0], [6.15, 0.24, 5.15]);
    box(trim, g, [0, 4.08, 0], [6.15, 0.16, 5.15]);
  }
  // A few compact factory blocks and tank details turn the loading hall into
  // an active industrial district while retaining the hall's road clearance.
  for (let i = 0; i < 6; i++) {
    const t = sectorT(2, 0.18 + i * 0.12),
      side = i % 2 ? 1 : -1;
    industrialBuilding(t, side * 34, 12, 12, 11, i + 2);
    const utility = safeGroup(t, side * 47, 3.2);
    if (!utility || !asset) continue;
    const tank = asset(
      "kenney:city-kit-industrial/detail-tank",
      utility,
      [0, 0, 0],
      [4.4, 4.4, 4.4],
    );
    if (tank) {
      tank.rotation.y = i * 0.73;
      batch(utility);
    }
    if (i % 2 === 0) {
      const stackGroup = safeGroup(t, side * 41, 1.8);
      const stack =
        stackGroup &&
        asset("kenney:city-kit-industrial/chimney-large", stackGroup, [0, 0, 0], [2.4, 9, 2.4]);
      if (stack) batch(stackGroup);
    }
  }

  const { harborPose } = buildWaterfront({
    THREE,
    animated,
    craneHooks,
    ferries,
    lamp,
    safeGroup,
    scenery,
    textures,
    track,
    kit,
    palette,
    geometry,
  });
  // Terminal: alternating tall container walls and an open crossing yard.
  for (let i = 0; i < 20; i++) {
    const t = sectorT(4, (i + 0.5) / 20),
      side = i % 2 ? 1 : -1;
    // Leave the moving shuttle's right-side parking bay clear.
    if (side > 0 && i > 7 && i < 15) continue;
    const g = safeGroup(t, side * (20 + (i % 3) * 4), 6.5);
    if (!g) continue;
    for (let row = 0; row < (i % 3 ? 2 : 1); row++) {
      box(i % 2 ? blue : rust, g, [0, 1.7 + row * 3.4, 0], [5, 3.3, 11]);
      for (let k = 0; k < 5; k++)
        box(steel, g, [2.52, 1.7 + row * 3.4, -4 + k * 2], [0.04, 3, 0.12]);
      for (const z of [-5.5, 5.5]) {
        box(steel, g, [0, 1.7 + row * 3.4, z], [0.13, 3.2, 0.08]);
        for (const x of [-2.1, 2.1]) box(trim, g, [x, 1.7 + row * 3.4, z], [0.13, 2.7, 0.1]);
        box(amber, g, [0, 0.25 + row * 3.4, z], [4.7, 0.13, 0.11]);
      }
      for (const x of [-2.45, 2.45])
        for (const z of [-5.45, 5.45]) box(steel, g, [x, 1.7 + row * 3.4, z], [0.12, 3.35, 0.12]);
    }
    batch(g);
  }

  // Boulevard has a visible rough service apron inside its right-hand bend.
  // Skyline façades and palms of light line the finish without filling the cut.
  for (let i = 0; i < 20; i++) {
    const t = sectorT(5, (i + 0.5) / 20),
      side = i % 2 ? 1 : -1;
    const extra = side > 0 ? track.shortcutWidth(t) : 0;
    lamp(t, side * (13 + extra), i);
    if (i % 6 === 0) industrialBuilding(t, side * (28 + extra), 14, 21 + (i % 4) * 3, 10, i + 40);
    else if (i % 3 === 0) building(t, side * (28 + extra), 12, 24 + (i % 4) * 6, 12, i + 40);
  }
  for (const fraction of [0.31, 0.47, 0.63]) {
    const t = sectorT(5, fraction),
      g = safeGroup(t, 23 + track.shortcutWidth(t), 2);
    if (!g) continue;
    for (const z of [-0.65, 0.65]) {
      const arm = box(cyan, g, [0, 2, z], [2, 0.28, 0.28]);
      arm.rotation.y = z > 0 ? -0.6 : 0.6;
    }
    box(steel, g, [0, 1, 0], [0.18, 2, 0.18]);
  }

  // Every district gets foreground street furniture and a readable urban
  // ground layer. These puddles live on sidewalks, never as a road blanket.
  const wet = material("#235368", {
    metalness: 0.64,
    roughness: 0.16,
    emissive: "#143346",
    emissiveIntensity: 0.2,
  });
  const leaf = material("#527e70", { map: textures.leaves ?? null });
  const puddleGeometry = new THREE.CircleGeometry(1, 16);
  for (let district = 0; district < 6; district++)
    for (let i = 0; i < 9; i++) {
      const t = sectorT(district, (i + 0.4) / 9),
        side = i % 2 ? -1 : 1;
      const edges = track.surfaceAt(t),
        offset = side * (side > 0 ? edges.rightEdge : -edges.leftEdge);
      const g = safeGroup(t, offset + side * 4.5, 2.4);
      if (!g) continue;
      box(concrete, g, [0, 0.06, 0], [3.7, 0.12, 3.7]);
      groundShadow(g, 2.5, 2.5, 0.145);
      for (const x of [-1.55, 1.55]) box(trim, g, [x, 0.14, 0], [0.2, 0.2, 3.7]);
      const puddle = mesh(puddleGeometry, wet, g, [0.2, 0.135, -0.45], [1.45, 0.8, 1]);
      puddle.rotation.x = -Math.PI / 2;
      puddle.castShadow = false;
      if (i % 3 === 0) {
        box(steel, g, [0, 0.5, 0], [1.4, 1, 1.4]);
        for (let sprig = 0; sprig < 3; sprig++)
          mesh(
            sphere,
            leaf,
            g,
            [(sprig - 1) * 0.36, 1.3 + (sprig % 2) * 0.3, 0],
            [0.55, 0.65, 0.55],
          );
      } else if (i % 3 === 1) {
        mesh(cylinder, dark, g, [-0.8, 0.65, 0.5], [0.36, 1.3, 0.36]);
        box(steel, g, [0.6, 0.6, 0.4], [1.5, 0.15, 0.8]);
        for (const x of [0.1, 1.1]) box(steel, g, [x, 0.3, 0.4], [0.12, 0.6, 0.7]);
      } else {
        // A parked delivery bicycle's wheel and frame silhouette.
        for (const z of [-0.65, 0.65]) {
          const wheel = mesh(ring, dark, g, [0.2, 0.55, z], [0.4, 0.4, 0.4]);
          wheel.rotation.y = Math.PI / 2;
        }
        const frame = box(cyan, g, [0.2, 0.76, 0], [0.08, 0.08, 1.25]);
        frame.rotation.x = 0.25;
        box(steel, g, [0.2, 0.9, -0.3], [0.08, 0.72, 0.08]);
        box(steel, g, [0.2, 1.18, -0.6], [0.6, 0.08, 0.08]);
      }
    }

  // Delivery-lane entrances/rejoins are marked by paired low cyan lights.
  // The physical lane itself is rendered by the shared verge ribbon.
  for (const v of context.course.verges || [])
    for (const f of [v.startFraction + 0.015, v.endFraction - 0.015]) {
      const t = sectorT(v.section, f),
        s = track.surfaceAt(t);
      const edge = v.side > 0 ? s.rightEdge : -s.leftEdge;
      const g = safeGroup(t, v.side * (edge + 2.4), 0.8);
      if (!g) continue;
      box(steel, g, [0, 0.75, 0], [0.25, 1.5, 0.25]);
      for (const z of [-0.32, 0.32]) box(cyan, g, [0, 1.4, z], [0.42, 0.12, 0.22]);
    }

  // The warehouse feels like a working loading hall: ducts, suspended
  // fixtures, doors, loading platforms and rails beyond the actual road.
  for (const side of [-1, 1]) {
    for (const z of [-11, -4, 4, 11]) {
      box(glass, hall, [side * 13.88, 7, z], [0.12, 3.2, 4]);
      box(amber, hall, [side * 13.78, 5.3, z], [0.15, 0.17, 4.3]);
    }
    for (const z of [-10, 10])
      mesh(cylinder, steel, hall, [side * 11.7, 12.9, z], [0.35, 0.5, 0.35]).rotation.z =
        Math.PI / 2;
  }
  const loading = safeGroup(sectorT(2, 0.64), 24, 6);
  if (loading) {
    box(concrete, loading, [0, 0.65, 0], [7, 1.3, 8]);
    for (const x of [-2, 0, 2])
      for (const z of [-2, 2]) {
        box(rust, loading, [x, 1.8, z], [1.5, 2, 1.5]);
        box(amber, loading, [x, 1.8, z + 0.76], [0.14, 2, 0.08]);
        box(steel, loading, [x, 2.1, z + 0.82], [1, 0.08, 0.08]);
      }
  }

  // A layered panorama beyond the race: small distant high-rises form a
  // coherent port skyline rather than repeating only roadside facades.
  for (let i = 0; i < 15; i++) {
    const t = sectorT(0, (i + 0.5) / 15),
      offset = 75 + (i % 3) * 17;
    if (i % 4 === 0 || i % 4 === 2)
      industrialBuilding(t, offset, 16 + (i % 3) * 3, 24 + (i % 5) * 5, 12 + (i % 2) * 2, i + 60);
    else building(t, offset, 12 + (i % 3) * 5, 30 + (i % 5) * 10, 13, i + 60);
  }

  // The distant bank fills the open waterfront sightline, while its simpler,
  // cooler silhouettes keep the detailed street facades in the foreground.
  for (const district of [0, 3])
    for (let i = 0; i < 10; i++) {
      const t = sectorT(district, 0.07 + i * 0.09),
        width = 16 + (i % 3) * 4,
        depth = 13,
        height = 26 + ((i * 3 + district) % 7) * 5;
      const g = safeGroup(t, -104 - (i % 2) * 19, Math.hypot(width + 2, depth + 2) / 2);
      if (!g) continue;
      // There is no road embankment on the far bank. Anchor its skyline to
      // the ground plane, rather than inheriting the nearby elevated quay.
      g.position.y = -1.7;
      box(concrete, g, [0, 0.15, 0], [width + 2, 0.3, depth + 2]);
      box(steel, g, [0, height / 2, 0], [width, height, depth]);
      box(dark, g, [0, height + 1.2, 0], [width * 0.74, 2.4, depth * 0.75]);
      for (const side of [-1, 1])
        for (let row = 0; row < 4; row++)
          box(cyan, g, [0, 5 + row * (height / 5), side * 6.55], [width * 0.68, 0.55, 0.1]);
      if (i % 3 === 0) box(dark, g, [0, height + 4, 0], [0.4, 5, 0.4]);
      batch(g);
    }

  return buildHarborLife({
    THREE,
    animated,
    craneHooks,
    ferries,
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
}
