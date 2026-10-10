import { buildExpeditionLife } from "./sunstone-ruins/build-expedition-life.js";
import { buildSolarArchitecture } from "./sunstone-ruins/build-solar-architecture.js";
import { createWaterMaterial, installSurfaceDetail } from "../rendering/surface-detail.js";
import { addGlow } from "../rendering/visual-effects.js";
import { carvedSandstone } from "./sunstone-ruins/sunstone-materials.js";
import { buildTempleAtmosphere } from "./sunstone-ruins/build-temple-atmosphere.js";
import { createSandfall } from "./sunstone-ruins/sandfall.js";
import { createSolarFocus } from "./sunstone-ruins/solar-focus.js";
import { createRouteClearance } from "../rendering/route-clearance.js";
import { buildDesertHorizon } from "./sunstone-ruins/build-desert-horizon.js";

/** The road travels through the monument; architecture follows its actual frames. */
export function buildWorld({ THREE, scene, scenery, track, kit, textures, hazardAt }) {
  const { material, mesh, box, groupAt, sectorT, align } = kit;
  const animated = [],
    motions = [];
  const allows = createRouteClearance(track);
  const stone = material("#c5b494", { bumpMap: textures.stone, bumpScale: 0.05 });
  const pale = material("#e4d5b5", { bumpMap: textures.stone, bumpScale: 0.05 });
  const shade = material("#897c67", { bumpMap: textures.stone, bumpScale: 0.05 });
  const dark = material("#5f574d", { bumpMap: textures.stone, bumpScale: 0.05 });
  const sand = material("#d1b688", { bumpMap: textures.sand, bumpScale: 0.035 });
  const gold = material("#dfa744", { metalness: 0.55, roughness: 0.36 });
  const teal = material("#4e9a94", { map: textures.fabric, side: THREE.DoubleSide });
  const glow = material("#ffe4a1", { emissive: "#ffc75a", emissiveIntensity: 1.4 });
  const coolGlow = material("#8ef2db", { emissive: "#39c9be", emissiveIntensity: 0.7 });
  for (const m of [stone, pale, shade, dark, sand])
    installSurfaceDetail(m, { kind: "terrain", strength: 0.18 });
  for (const m of [stone, pale, shade, dark]) carvedSandstone(m, { carved: true });
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  const ring = new THREE.TorusGeometry(1, 0.075, 6, 48);
  const rock = new THREE.IcosahedronGeometry(1, 1);
  const mesa = kit.authoredGeometry("blender:sandstone-mesa", rock);
  const shaft = kit.authoredGeometry("blender:temple-column", [2, 1, 2]);
  const safe = (t, offset, footprint) => kit.safeGroup(t, offset, footprint);
  const pulse = (object, fn) => {
    animated.push(object);
    motions.push(fn);
  };
  function column(g, x, height = 19) {
    if (!allows(g, [x, height / 2, 0], [5.2, height + 2, 5.2])) return false;
    box(dark, g, [x, 0.7, 0], [5.2, 1.4, 5.2]);
    mesh(shaft, stone, g, [x, height / 2, 0], [1.7, height, 1.7]);
    for (const y of [1.6, height - 1.5, height]) box(pale, g, [x, y, 0], [4.5, 0.7, 4.5]);
    for (let y = 4; y < height - 2; y += 4) box(gold, g, [x, y, -1.72], [0.45, 1.3, 0.08]);
    return true;
  }
  function portal(t, width = 17, height = 23) {
    const g = groupAt(t);
    g.name = "Supported temple portal";
    const fits = (w) =>
      [-1, 1].every((side) => allows(g, [side * w, height / 2, 0], [5.2, height + 2, 5.2])) &&
      allows(g, [0, height + 3, 0], [w * 2 + 8, 10, 8]);
    while (width < 70 && !fits(width)) width += 3;
    if (!fits(width)) {
      g.removeFromParent();
      return null;
    }
    column(g, -width, height);
    column(g, width, height);
    box(stone, g, [0, height + 1, 0], [width * 2 + 6, 3.5, 6]);
    box(pale, g, [0, height + 3.2, 0], [width * 2 + 8, 0.9, 7]);
    const sun = mesh(ring, gold, g, [0, height + 6, 0], [4, 4, 4]);
    mesh(sphere, glow, g, [0, height + 6, 0], [1.5, 1.5, 0.6]);
    pulse(sun, (time) => {
      sun.rotation.z = time * 0.09;
    });
    return g;
  }
  // Oasis caravan: a broad turquoise basin, wind palms, woven market canopies.
  const pond = safe(sectorT(0, 0.42), -65, 35);
  if (pond) {
    const water = createWaterMaterial({ scene, color: "#37a5a6", shoreRadius: 35, foam: true });
    const pool = mesh(new THREE.CircleGeometry(1, 64), water, pond, [0, 0.12, 0], [38, 27, 1]);
    pool.rotation.x = -Math.PI / 2;
    pool.castShadow = false;
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      mesh(rock, pale, pond, [Math.cos(a) * 39, 0.3, Math.sin(a) * 28], [2.5, 0.8, 2]);
    }
  }
  for (let i = 0; i < 26; i++) {
    const t = sectorT(0, (i + 0.5) / 26),
      side = i % 2 ? 1 : -1;
    const g = safe(t, side * (29 + (i % 3) * 8), 6);
    if (!g) continue;
    const palm = kit.asset("ruins:palm", g, [0, 0, 0], [12 + (i % 4), 12 + (i % 4), 12 + (i % 4)]);
    if (i % 3 === 0)
      pulse(palm, (time) => {
        palm.rotation.z = Math.sin(time * 0.7 + i) * 0.045;
      });
    if (i % 6 === 0) {
      for (const x of [-4, 4]) box(gold, g, [x, 3, 9], [0.15, 6, 0.15]);
      const cloth = box(teal, g, [0, 6, 9], [9, 0.12, 6]);
      pulse(cloth, (time) => {
        cloth.rotation.z = Math.sin(time * 1.2 + i) * 0.035;
      });
      for (let j = 0; j < 4; j++) kit.asset("ruins:vase", g, [-3 + j * 2, 0, 9], [1.8, 1.8, 1.8]);
    }
  }
  portal(sectorT(0, 0.88), 18, 20);
  // Sculpted canyon walls: continuous strata rather than isolated rocks.
  for (const side of [-1, 1]) {
    const positions = [],
      colors = [],
      indices = [];
    const rows = 120,
      levels = 6;
    for (let i = 0; i <= rows; i++) {
      const t = sectorT(1, i / rows),
        f = track.frameAt(t);
      const h = 27 + Math.sin(i * 0.17) * 6 + Math.sin(i * 0.53) * 2;
      for (let j = 0; j < levels; j++) {
        const offset =
          track.platformEdgeAt(t, side) + side * (8 + j * 1.8 + Math.sin(i * 0.25 + j) * 1.1);
        const p = f.p.clone().addScaledVector(f.right, offset);
        p.y += (j * h) / (levels - 1) - 3;
        positions.push(p.x, p.y, p.z);
        const c = new THREE.Color(j % 2 ? "#ca8c5f" : "#e2ae77").multiplyScalar(0.8 + j * 0.035);
        colors.push(c.r, c.g, c.b);
        if (i < rows && j < levels - 1) {
          const a = i * levels + j;
          indices.push(a, a + 1, a + levels, a + 1, a + levels + 1, a + levels);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    // Cut the cliff back wherever another elevation of the road passes it.
    const triangle = new THREE.Triangle(),
      bounds = new THREE.Box3(),
      safeIndices = [];
    for (let i = 0; i < indices.length; i += 3) {
      triangle.a.fromBufferAttribute(geo.attributes.position, indices[i]);
      triangle.b.fromBufferAttribute(geo.attributes.position, indices[i + 1]);
      triangle.c.fromBufferAttribute(geo.attributes.position, indices[i + 2]);
      bounds.setFromPoints([triangle.a, triangle.b, triangle.c]);
      if (
        !allows.corridor.some(
          (cell) => cell.intersectsBox(bounds) && cell.intersectsTriangle(triangle),
        )
      )
        safeIndices.push(indices[i], indices[i + 1], indices[i + 2]);
    }
    geo.setIndex(safeIndices);
    geo.computeVertexNormals();
    mesh(geo, material("#ffffff", { side: THREE.DoubleSide }), scenery).name =
      "Sculpted canyon walls";
  }
  const sandfall = createSandfall(THREE);
  motions.push(sandfall.update);
  for (const f of [0.28, 0.7]) {
    const g = groupAt(sectorT(1, f));
    box(stone, g, [0, 32, 0], [48, 8, 12]);
    for (const side of [-1, 1]) {
      const curtain = mesh(sandfall.geometry, sandfall.material, g, [side * 18, 14, 0]);
      curtain.name = "Flowing canyon sandfall";
      curtain.castShadow = curtain.receiveShadow = false;
      animated.push(curtain);
    }
  }
  // High mesa: huge eroded pillars below the road, a sun crown on the skyline.
  for (let i = 0; i < 16; i++) {
    const t = sectorT(2, (i + 0.5) / 16),
      side = i % 2 ? 1 : -1;
    const g = groupAt(t, side * 28);
    const h = 24 + (i % 4) * 6;
    mesh(mesa, stone, g, [0, -h / 2 - 8, 0], [12, h, 11]);
  }
  const crown = groupAt(sectorT(3, 0.26), -70);
  for (let i = 0; i < 6; i++)
    box(i % 2 ? stone : pale, crown, [0, i * 6 - 8, 0], [88 - i * 11, 6, 72 - i * 9]);
  const sunDisc = mesh(ring, gold, crown, [0, 37, 0], [17, 17, 17]);
  mesh(sphere, glow, crown, [0, 37, 0], [7, 7, 1]);
  pulse(sunDisc, (time) => {
    sunDisc.rotation.z = time * 0.04;
  });
  for (let i = 0; i < 10; i++) {
    const t = sectorT(3, (i + 0.5) / 10),
      g = groupAt(t);
    for (const side of [-1, 1]) {
      column(g, side * 18, 22);
      if (i % 3 === 0) kit.asset("ruins:dragon", g, [side * 25, 0, 0], [7, 7, 7]);
    }
  }
  portal(sectorT(4, 0.01), 19, 28);
  // Buried engine: connected vaulted bays, shade, glowing wall channels and
  // three rotating lenses. A fixed left lane remains clear of the sentinel.
  for (let i = 0; i < 22; i++) {
    const t = sectorT(4, (i + 0.5) / 22),
      g = groupAt(t);
    g.name = "Supported sun engine bay";
    // A bay is built as one structure: a roof must never outlive its walls.
    const surface = track.surfaceAt(t);
    const widths = [Math.max(17, -surface.leftEdge + 5), Math.max(17, surface.rightEdge + 5)];
    const fits = () =>
      widths.every((width, j) => allows(g, [(j ? 1 : -1) * width, 11.75, 0], [4, 23.5, 14])) &&
      allows(g, [(widths[1] - widths[0]) / 2, 24, 0], [widths[0] + widths[1] + 4, 3, 15]);
    for (let attempt = 0; attempt < 16 && !fits(); attempt++) {
      widths[0] += 3;
      widths[1] += 3;
    }
    if (!fits()) {
      g.removeFromParent();
      continue;
    }
    for (const [j, side] of [-1, 1].entries()) {
      const width = widths[j];
      box(shade, g, [side * width, 11.75, 0], [4, 23.5, 14]);
      box(dark, g, [side * (width - 2.1), 7.5, 0], [0.2, 9, 7]);
      box(coolGlow, g, [side * (width - 2.3), 4, 0], [0.15, 0.2, 11]);
    }
    const center = (widths[1] - widths[0]) / 2,
      span = widths[0] + widths[1] + 4;
    if (i % 3 !== 1) box(dark, g, [center, 24, 0], [span, 3, 15]);
    else
      for (const [j, side] of [-1, 1].entries())
        box(stone, g, [side * (widths[j] - 2.5), 24, 0], [9, 3, 15]);
    box(stone, g, [center, 22.8, 0], [span, 1.1, 1.4]);
  }
  for (let i = 0; i < 3; i++) {
    const t = sectorT(4, track.course.solarEngine.fractions[i]);
    const g = groupAt(t),
      lens = mesh(ring, gold, g, [0, 18, 0], [6, 6, 6]);
    pulse(lens, (time) => {
      lens.rotation.z = time * 0.35 + i * 2;
    });
    for (const side of [-1, 1]) mesh(sphere, glow, g, [side * 12, 7, 0], [0.8, 0.8, 0.8]);
    const pad = groupAt(t);
    box(gold, pad, [0, 0.13, 0], [3.9, 0.1, 5.5]);
    for (let j = 0; j < 3; j++) {
      const stripe = box(glow, pad, [0, 0.2, -1.7 + j * 1.6], [2.3, 0.08, 0.2]);
      stripe.rotation.y = Math.PI / 8;
    }
    animated.push(pad);
    const focus = createSolarFocus({
      THREE,
      track,
      kit,
      t,
      index: i,
      pad,
      sourceGroup: g,
      scenery,
    });
    animated.push(focus.beam);
    motions.push(focus.update);
    addGlow(g, { color: "#ffcf83", size: 8, opacity: 0.18, position: [0, 18, 0] });
  }
  portal(sectorT(4, 0.96), 19, 24);
  // Courtyard roof fragments frame the newly open sky; giant statues and pools.
  for (let i = 0; i < 12; i++) {
    const g = groupAt(sectorT(5, (i + 0.5) / 12));
    for (const side of [-1, 1]) {
      const height = 17 + (i % 3) * 3;
      if (!allows(g, [side * 20, height + 1, 0], [8, 2, 15])) continue;
      if (column(g, side * 20, height)) box(pale, g, [side * 20, height + 1, 0], [8, 2, 15]);
    }
  }
  const sentinel = new THREE.Group();
  scenery.add(sentinel);
  box(shade, sentinel, [0, 1, 0], [2.7, 2, 4.3]);
  mesh(sphere, gold, sentinel, [0, 3, 0], [1.1, 1.1, 1.1]);
  box(coolGlow, sentinel, [0, 1.8, -2.16], [2.6, 0.3, 0.1]);
  animated.push(sentinel);
  buildExpeditionLife({
    THREE,
    scene,
    scenery,
    track,
    kit,
    textures,
    palette: { stone, pale, dark, sand, gold, teal, glow },
    animated,
    motions,
  });
  buildDesertHorizon({ THREE, scenery, track, kit, textures, motions });
  buildSolarArchitecture({
    THREE,
    kit,
    track,
    palette: { stone, pale, gold, dark, glow },
    animated,
    motions,
  });
  buildTempleAtmosphere({
    THREE,
    scene,
    track,
    kit,
    palette: { stone, pale, dark, gold, glow },
    animated,
    motions,
  });
  // Bounded points: drifting sandfall grains and dune motes, no sprite storm.
  const grains = [];
  for (let i = 0; i < 160; i++) {
    const t = sectorT(i < 96 ? 1 : 6, ((i % 80) + 0.5) / 80),
      side = i % 2 ? 1 : -1;
    const p = track.poseAt(t * track.TRACK, side * (i < 96 ? 17 : 23), 1 + (i % 19)).p;
    grains.push(p.x, p.y, p.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(grains, 3));
  const dust = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: "#ffe1a0",
      size: 0.18,
      transparent: true,
      opacity: 0.43,
      depthWrite: false,
    }),
  );
  scenery.add(dust);
  animated.push(dust);
  return {
    animated,
    update(time, state) {
      motions.forEach((fn) => fn(time, state));
      align(sentinel, hazardAt(time));
      dust.position.y = -((time * 0.5) % 3);
      dust.position.x = Math.sin(time * 0.4) * 0.4;
    },
  };
}
