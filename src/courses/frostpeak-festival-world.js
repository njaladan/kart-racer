import { buildSkiLift } from "./frostpeak-festival/build-ski-lift.js";
import { buildSnowTerrain } from "./frostpeak-festival/build-snow-terrain.js";
import { buildMountainHorizon } from "./frostpeak-festival/build-mountain-horizon.js";
// A complete alpine resort. Static detail is batched by the shared runtime;
// only fabric, lift cabins, cheering spectators, flakes and the groomer move.
import { registerLightPool } from "../rendering/course-lighting.js";
import { installSurfaceDetail } from "../rendering/surface-detail.js";
import { createContactShadowMesh, addGlow } from "../rendering/visual-effects.js";

export function buildWorld({ THREE, scene, scenery, track, textures, kit, hazardAt }) {
  const { material, mesh, box, groupAt, sectorT, asset, batch, align } = kit;
  const snow = material("#f2f8ff", { map: textures.snow, roughness: 0.96 });
  const timber = material("#c6a17f", { map: textures.wood });
  const bark = material("#97765c", { map: textures.bark }),
    cream = material("#efdfc8");
  const dark = material("#344958"),
    cyan = material("#53cbd7"),
    red = material("#e97087");
  const yellow = material("#ffe19e", { emissive: "#ffb85e", emissiveIntensity: 0.26 });
  const glass = material("#bedceb", { metalness: 0.02, roughness: 0.18 });
  const rock = material("#9bb1c5", { map: textures.stone }),
    amber = material("#ffaf45", { emissive: "#df7900", emissiveIntensity: 0.3 });
  const sphere = new THREE.SphereGeometry(1, 10, 7);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10),
    clothGeo = new THREE.PlaneGeometry(1, 1, 8, 3);
  const edgeOffset = (t, side, margin) =>
    side * (side > 0 ? track.surfaceAt(t).rightEdge : -track.surfaceAt(t).leftEdge) + side * margin;
  const landAt = (t, offset, parent = scenery) =>
    kit.landGroup ? kit.landGroup(t, offset, parent) : groupAt(t, offset, parent);
  const lampPoolMaterial = createContactShadowMesh({ opacity: 0.16 }).material.clone();
  lampPoolMaterial.color.set("#ffc274");
  lampPoolMaterial.blending = THREE.AdditiveBlending;
  lampPoolMaterial.toneMapped = false;
  const flags = new THREE.Group();
  scenery.add(flags);
  const cheerers = new THREE.Group();
  scenery.add(cheerers);
  const groundShadow = (parent, width, depth = width) => {
    const shadow = createContactShadowMesh({ width, depth, opacity: 0.24 });
    shadow.position.y = 0.035;
    parent.add(shadow);
  };

  function pole(g, x, y, z, height = 4) {
    asset("frostpeak:wood-lamp", g, [x, y, z], [height, height, height]);
    addGlow(g, {
      color: "#ffd390",
      size: [1.5, 1.5],
      opacity: 0.17,
      position: [x + 0.5, y + height - 0.4, z],
    });
    const pool = createContactShadowMesh({ width: 8, depth: 7, opacity: 0.16 });
    pool.material = lampPoolMaterial;
    pool.position.set(x + 0.7, y + 0.055, z);
    pool.name = "Warm lamp illumination baked on snow";
    g.add(pool);
    g.updateWorldMatrix(true, false);
    registerLightPool(scene, {
      position: g.localToWorld(new THREE.Vector3(x + 0.7, y + height - 0.4, z)),
      color: "#ffbf76",
      intensity: 7,
      radius: 16,
    });
  }
  function rail(g, x, y, z, width, axis = "x") {
    box(bark, g, [x, y, z], axis === "x" ? [width, 0.15, 0.15] : [0.15, 0.15, width]);
    for (let i = -1; i <= 1; i += 0.5)
      box(
        bark,
        g,
        [
          x + (axis === "x" ? (i * width) / 2 : 0),
          y - 0.5,
          z + (axis === "z" ? (i * width) / 2 : 0),
        ],
        [0.12, 1.1, 0.12],
      );
  }
  function chalet(t, side, large = false) {
    const height = large ? 12.8 : 8.9;
    const margin = large ? 24 : 17;
    const g = kit.safeGroup(t, edgeOffset(t, side, margin), height * 0.65);
    if (!g) return null;
    g.name = "Textured snow-roofed alpine lodge";
    g.rotation.y += side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    groundShadow(g, height * 1.55, height * 1.65);
    asset("frostpeak:chalet", g, [0, 0, 0], [height, height, height]);
    // The imported model already has sculpted snow, stone foundations, eaves,
    // balcony timber and recessed openings. A pool is painted onto the snow
    // rather than adding another real-time shadow light to every lodge.
    addGlow(g, { color: "#ffd28a", size: [7, 4], opacity: 0.1, position: [0, 3.1, -3.8] });
    pole(g, -height * 0.61, 0, -height * 0.47, 3.5);
    const sled = asset(
      "kenney:holiday-kit/sled",
      g,
      [height * 0.56, 0.08, -height * 0.4],
      [1.9, 1.9, 1.9],
    );
    sled.rotation.y = 0.3;
    return g;
  }
  for (const f of [0.08, 0.28, 0.49, 0.73]) for (const side of [-1, 1]) chalet(sectorT(0, f), side);
  for (const f of [0.64, 0.88]) chalet(sectorT(5, f), -1);
  chalet(sectorT(2, 0.84), -1, true);

  function pine(t, side, size, depth = 0, index = 0) {
    const height = 11.5 * size;
    const offset = edgeOffset(t, side, 9 + height * 0.36 + depth);
    const g = kit.safeGroup(t, offset, height * 0.42);
    if (!g) return;
    g.name = "Snow-painted textured conifer cluster";
    g.rotation.y += index * 2.399;
    // Downloaded textured branches carry the silhouette. Near/mid/far models
    // are switched and region-batched by the shared runtime.
    const width = height * (0.84 + Math.sin(index * 1.7 + side) * 0.09);
    asset("frostpeak:pine-near", g, [0, 0, 0], [width, height, width]);
    if (depth === 0 && index % 4 === 0) {
      asset("frostpeak:snow-bush", g, [side * 2.8, -0.15, -2], [2.7, 2.3, 2.7]);
      groundShadow(g, width * 0.8);
    }
  }
  for (let s = 0; s < 6; s++) {
    const count = s === 1 ? 34 : s === 2 ? 22 : 14;
    for (let i = 0; i < count; i++)
      for (const side of [-1, 1]) {
        const f = (i + 0.25 + (Math.sin(i * 6.1) + 1) * 0.25) / count;
        // Resort views deliberately leave sightline windows between clusters.
        if ((s === 0 || s === 5) && i % 3 === 0) continue;
        pine(sectorT(s, f), side, 0.8 + (i % 5) * 0.12, s === 0 ? 12 : 0, i + s * 31);
        if (i % 2 === 0)
          pine(sectorT(s, Math.min(0.985, f + 0.008)), side, 1.18 + (i % 3) * 0.12, 17, i + 5);
      }
  }

  function flag(t, side, index) {
    const offset = edgeOffset(t, side, 3.2),
      g = landAt(t, offset);
    mesh(cylinder, dark, g, [0, 3.6, 0], [0.09, 7.2, 0.09]);
    asset("frostpeak:snow-bush", g, [side * 0.5, -0.25, 0], [0.9, 0.62, 0.9]);
    const moving = landAt(t, offset, flags);
    mesh(clothGeo, index % 2 ? cyan : red, moving, [side * 1.3, 6.3, 0], [2.6, 1.3, 1]);
  }
  for (let s = 0; s < 6; s++)
    for (let i = 0; i < 8; i++)
      for (const side of [-1, 1]) flag(sectorT(s, (i + 0.5) / 8), side, i + s);

  const palette = { cream, cyan, dark, glass, red, rock, snow, timber };
  const geometry = { cylinder };
  buildMountainHorizon({ THREE, edgeOffset, landAt, scenery, kit, palette, textures });
  buildSnowTerrain({ THREE, scene, scenery, track, kit, textures, edgeOffset, landAt });
  // Little resort props use the same winter-festival kit as the trees and
  // rocks. All are outside the physical course edge and clear of the camera.
  for (const [fraction, side, kind] of [
    [0.19, -1, "fancy"],
    [0.47, 1, "plain"],
    [0.76, -1, "plain"],
  ]) {
    const g = landAt(sectorT(0, fraction), edgeOffset(sectorT(0, fraction), side, 15));
    asset(
      `kenney:holiday-kit/snowman${kind === "fancy" ? "_fancy" : ""}`,
      g,
      [0, 0, 0],
      [2.25, 2.25, 2.25],
    );
  }
  for (const [fraction, side] of [
    [0.29, 1],
    [0.7, -1],
  ]) {
    const g = landAt(sectorT(0, fraction), edgeOffset(sectorT(0, fraction), side, 18));
    asset("kenney:holiday-kit/sled", g, [0, 0, 0], [2.2, 2.2, 2.2]);
    asset("kenney:holiday-kit/present", g, [2.25, 0.05, 0.35], [0.8, 0.8, 0.8]);
    asset("kenney:holiday-kit/present_round", g, [-2.2, 0.05, -0.25], [0.8, 0.8, 0.8]);
  }
  const festivalPole = landAt(sectorT(0, 0.52), edgeOffset(sectorT(0, 0.52), -1, 24));
  asset("kenney:holiday-kit/festivus_pole", festivalPole, [0, 0, 0], [3.2, 3.2, 3.2]);
  const villageLights = landAt(sectorT(0, 0.51), edgeOffset(sectorT(0, 0.51), 1, 22));
  asset("kenney:holiday-kit/lights_multi", villageLights, [0, 5, 0], [5.8, 1.8, 1.8]);

  const { liftPoints, gondolas } = buildSkiLift({
    THREE,
    edgeOffset,
    groundShadow,
    landAt,
    rail,
    scene,
    scenery,
    track,
    kit,
    palette,
    geometry,
  });
  function banner(t, color) {
    const g = groupAt(t, 0);
    const width = Math.max(-track.surfaceAt(t).leftEdge, track.surfaceAt(t).rightEdge) + 7;
    for (const x of [-width, width]) box(timber, g, [x, 7.1, 0], [0.5, 14.2, 0.5]);
    box(dark, g, [0, 14.1, 0], [width * 2, 0.4, 0.4]);
    const cloth = groupAt(t, 0, flags);
    mesh(clothGeo, color, cloth, [0, 12.9, 0], [width * 2 - 1, 1.6, 1]);
    for (const x of [-width + 2, width - 2]) mesh(sphere, yellow, g, [x, 13.8, 0], [0.3, 0.3, 0.3]);
  }
  banner(sectorT(3, 0.13), red);
  banner(sectorT(3, 0.58), cyan);

  // A separate ornamental skating pond makes the on-road ice part of a resort,
  // with rubber approach matting represented by the firm main-route surface.
  const pond = landAt(sectorT(4, 0.31), edgeOffset(sectorT(4, 0.31), -1, 27));
  mesh(cylinder, dark, pond, [0, 0.1, 0], [19, 0.3, 14]);
  const pondIce = material("#b2dcea", {
    map: textures.snow,
    roughness: 0.19,
    metalness: 0.01,
    envMapIntensity: 0.7,
  });
  installSurfaceDetail(pondIce, { kind: "ice", scale: 0.18, strength: 0.2 });
  mesh(cylinder, pondIce, pond, [0, 0.3, 0], [18.6, 0.16, 13.6]);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2,
      x = Math.cos(a) * 19,
      z = Math.sin(a) * 14;
    box(cream, pond, [x, 1, z], [0.22, 1.8, 0.22]);
    const b = box(i % 2 ? red : cyan, pond, [x, 1.5, z], [3.3, 0.5, 0.13]);
    b.rotation.y = -a + Math.PI / 2;
  }
  for (const [x, z] of [
    [-18, 0],
    [18, 0],
    [0, -14],
    [0, 14],
  ])
    pole(pond, x, 0.35, z, 4.5);
  chalet(sectorT(4, 0.56), -1);
  chalet(sectorT(3, 0.8), 1);
  for (const f of [0.18, 0.39]) {
    const t = sectorT(4, f),
      g = landAt(t, edgeOffset(t, -1, 9));
    for (const x of [-2.5, 2.5]) box(red, g, [x, 1.5, 0], [0.14, 3, 0.14]);
    box(red, g, [0, 3, 0], [5, 0.14, 0.14]);
    for (let i = -2; i <= 2; i++) box(cream, g, [i, 1.4, 0.8], [0.035, 2.8, 0.035]);
    for (let y = 0.4; y < 3; y += 0.5) box(cream, g, [0, y, 0.8], [5, 0.035, 0.035]);
  }

  // Crowd bodies are static. All raised hands share two batched, waving meshes.
  for (const f of [0.22, 0.57, 0.8]) {
    const t = sectorT(5, f),
      offset = edgeOffset(t, -1, 15),
      g = landAt(t, offset);
    g.rotation.y += Math.PI;
    box(timber, g, [0, 1, 0], [11, 2, 20]);
    for (let row = 0; row < 4; row++) {
      const x = -3 + row * 2,
        y = 2.7 + row * 0.85;
      box(row % 2 ? cyan : red, g, [x, y, 0], [1.7, 0.3, 19]);
      for (let person = 0; person < 9; person++) {
        const z = -8 + person * 2;
        box(person % 2 ? red : cyan, g, [x, y + 0.55, z], [0.58, 0.8, 0.48]);
        mesh(sphere, person % 3 ? cream : bark, g, [x, y + 1.25, z], [0.31, 0.34, 0.3]);
        mesh(sphere, person % 2 ? cyan : red, g, [x, y + 1.48, z], [0.35, 0.15, 0.32]);
        const hands = landAt(t, offset, cheerers);
        hands.rotation.y += Math.PI;
        for (const dz of [-0.42, 0.42]) {
          const arm = box(person % 2 ? red : cyan, hands, [x, y + 1.1, z + dz], [0.16, 0.85, 0.17]);
          arm.rotation.x = dz > 0 ? 0.3 : -0.3;
          mesh(sphere, cream, hands, [x, y + 1.6, z + dz * 1.35], [0.15, 0.15, 0.15]);
        }
      }
    }
    for (const z of [-10.4, 10.4]) rail(g, 1, 5.6, z, 10);
    for (const x of [-5.5, 5.5]) pole(g, x, 0, -10.5, 7.5);
  }

  // Extra depth and surface dressing are kept beyond each physical off-road line.
  for (let s = 0; s < 6; s++)
    for (let i = 0; i < 8; i++)
      for (const side of [-1, 1]) {
        const t = sectorT(s, (i + 0.6) / 8),
          g = landAt(t, edgeOffset(t, side, 4.5));
        if (i % 2 === 0) asset("frostpeak:snow-bush", g, [0, -0.24, 0], [1.8, 1.1, 1.8]);
        if (s === 1 && i % 2 === 0) {
          const log = mesh(cylinder, bark, g, [side * 2, 0.3, 0], [0.33, 4.5, 0.33]);
          log.rotation.z = Math.PI / 2;
          asset("frostpeak:snow-bush", g, [side * 2, 0.18, 0.7], [1.4, 0.85, 1.4]);
        }
        if (s === 5 && side > 0 && track.shortcutWidth(t) > 2) {
          box(cyan, g, [0, 1, 0], [0.16, 2, 0.16]);
          mesh(
            clothGeo,
            red,
            landAt(t, edgeOffset(t, side, 4.5), flags),
            [0, 1.8, 0],
            [1.4, 0.65, 1],
          );
        }
      }

  const groomer = new THREE.Group();
  scene.add(groomer);
  box(red, groomer, [0, 0.9, 0], [2.3, 1.05, 3.4]);
  for (const x of [-0.98, 0.98]) {
    box(dark, groomer, [x, 0.35, 0], [0.5, 0.6, 3.8]);
    for (let z = -1.55; z <= 1.6; z += 0.45) box(rock, groomer, [x, 0.26, z], [0.51, 0.12, 0.15]);
  }
  box(red, groomer, [0, 1.8, 0.35], [1.65, 1.05, 1.9]);
  box(glass, groomer, [0, 1.9, -0.62], [1.4, 0.7, 0.08]);
  for (const x of [-0.83, 0.83]) box(glass, groomer, [x, 1.9, 0.35], [0.05, 0.7, 1.5]);
  box(rock, groomer, [0, 0.42, -1.98], [2.66, 0.55, 0.3]);
  mesh(cylinder, amber, groomer, [0, 2.44, 0.4], [0.21, 0.25, 0.21]);
  batch(groomer);
  const warning = landAt(sectorT(4, 0.78), edgeOffset(sectorT(4, 0.78), 1, 6));
  box(dark, warning, [0, 1.65, 0], [0.2, 3.3, 0.2]);
  const beacon = mesh(sphere, amber, warning, [0, 3.7, 0], [0.55, 0.55, 0.55]);

  // Batched world-coordinate fabric permits a small wind ripple at two draws.
  function prepareMotion(root) {
    // Flatten authored transforms before merging, retaining the dynamic root.
    root.updateMatrixWorld(true);
    const objects = [];
    root.traverse((o) => {
      if (o.isMesh) objects.push(o);
    });
    for (const o of objects) {
      o.matrixWorld.decompose(o.position, o.quaternion, o.scale);
      root.add(o);
    }
    batch(root);
    return root.children
      .filter((o) => o.isMesh)
      .map((o) => ({ mesh: o, base: o.geometry.attributes.position.array.slice() }));
  }
  for (const object of [groomer, beacon, flags, cheerers, ...gondolas])
    object.userData.skipBake = true;
  const flagMotion = prepareMotion(flags),
    crowdMotion = prepareMotion(cheerers);
  const flakesGeo = new THREE.BufferGeometry(),
    flakes = new Float32Array(180 * 3);
  for (let i = 0; i < 180; i++) {
    flakes[i * 3] = Math.sin(i * 89.7) * 285;
    flakes[i * 3 + 1] = 20 + (i % 17) * 5;
    flakes[i * 3 + 2] = Math.cos(i * 43.1) * 250;
  }
  flakesGeo.setAttribute("position", new THREE.BufferAttribute(flakes, 3));
  const flurries = new THREE.Points(
    flakesGeo,
    new THREE.PointsMaterial({
      color: "#ffffff",
      size: 0.19,
      transparent: true,
      opacity: 0.63,
      depthWrite: false,
    }),
  );
  scenery.add(flurries);
  return {
    animated: [groomer, beacon, flags, cheerers, flurries, ...gondolas],
    update(time) {
      const state = hazardAt(time);
      align(groomer, state);
      beacon.visible = state.warning ? Math.floor(time * 6) % 2 === 0 : state.active;
      for (const { mesh: m, base } of flagMotion) {
        const p = m.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const j = i * 3;
          p.array[j + 2] =
            base[j + 2] + Math.sin(time * 2.7 + base[j] * 0.43 + base[j + 1] * 0.7) * 0.16;
          p.array[j + 1] = base[j + 1] + Math.sin(time * 2 + base[j] * 0.4) * 0.055;
        }
        p.needsUpdate = true;
      }
      for (const { mesh: m, base } of crowdMotion) {
        const p = m.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const j = i * 3;
          p.array[j + 1] = base[j + 1] + Math.sin(time * 4 + base[j + 2] * 1.7) * 0.19;
        }
        p.needsUpdate = true;
      }
      for (let i = 0; i < gondolas.length; i++) {
        const u = (((time * 0.018 + i / 4) % 1) + 1) % 1,
          f = u * 48,
          k = Math.min(47, Math.floor(f));
        gondolas[i].position.copy(liftPoints[k]).lerp(liftPoints[k + 1], f - k);
        const a = liftPoints[k],
          b = liftPoints[k + 1];
        gondolas[i].rotation.set(
          Math.sin(time * 1.3 + i) * 0.025,
          Math.atan2(b.x - a.x, b.z - a.z),
          Math.sin(time * 0.7 + i) * 0.035,
        );
      }
      for (let i = 0; i < 180; i++) {
        flakes[i * 3 + 1] = 15 + (((i % 17) * 5 - time * (0.65 + (i % 5) * 0.1) + 1000) % 85);
        flakes[i * 3] = Math.sin(i * 89.7) * 285 + Math.sin(time * 0.3 + i) * 2.5;
      }
      flakesGeo.attributes.position.needsUpdate = true;
    },
  };
}
