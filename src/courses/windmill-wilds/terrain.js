import * as THREE from "../../../vendor/three/three.module.js";
import { createWaterMaterial, installSurfaceDetail } from "../../rendering/surface-detail.js";
import { createRailGeometry } from "../../rendering/course-rails.js";
import { TERRAIN_VERGE_WIDTH } from "../../rendering/terrain-height.js";
import {
  TRACK,
  COURSE_LENGTH,
  SECTIONS,
  frameAt,
  poseAt,
  roadHalfWidth,
  surfaceAt,
  shortcutWidth,
  BRIDGE_RANGE,
  VERGES,
  vergeWidth,
} from "../../track/track.js";

/** Road ribbons, collision-aligned rails, bridge support, and the lake surface. */
export function buildWindmillTerrain({ scene, scenery, textures, mats, palette, primitives }) {
  const { wood, darkWood, stone, bridgeRailMaterial } = palette;
  const { mesh, box, groupAt, sectorT, mat } = primitives;
  const inBridge = (t) => t >= BRIDGE_RANGE.start && t <= BRIDGE_RANGE.end;
  const ground = mesh(new THREE.PlaneGeometry(1800, 1800), mats.grass, scenery, [0, -1.7, 0]);
  ground.rotation.x = -Math.PI / 2;
  ground.castShadow = false;
  ground.userData.bakeReceiver = true;
  installSurfaceDetail(mats.grass, { kind: "terrain", scale: 0.045, strength: 0.16 });
  installSurfaceDetail(mats.road, { kind: "road", scale: 0.05, strength: 0.09 });
  const groundUV = ground.geometry.attributes.uv;
  // World-aligned grass tiles meet the banks without an obvious texture seam.
  const groundPos = ground.geometry.getAttribute("position");
  for (let i = 0; i < groundUV.count; i++)
    groundUV.setXY(i, groundPos.getX(i) / 6, -groundPos.getY(i) / 6);

  function ribbon(edgeA, edgeB, materials, lift = 0.045, terrain = false, startT = 0, endT = 1) {
    const pos = [],
      uv = [],
      colors = [],
      indices = [],
      groups = [],
      n = Math.max(8, Math.ceil(1800 * (endT - startT)));
    const grassy = materials === mats.grass;
    for (let i = 0; i <= n; i++) {
      const t = THREE.MathUtils.lerp(startT, endT, i / n),
        frame = frameAt(t);
      for (const edge of [edgeA(t), edgeB(t)]) {
        const p = frame.p.clone().addScaledVector(frame.right, edge);
        if (terrain) {
          const surface = surfaceAt(t);
          const distance = Math.abs(edge) - (edge > 0 ? surface.rightEdge : -surface.leftEdge);
          p.y = THREE.MathUtils.lerp(
            p.y - 0.06,
            -1.7,
            THREE.MathUtils.clamp(distance / TERRAIN_VERGE_WIDTH, 0, 1),
          );
        } else p.addScaledVector(frame.up, lift);
        pos.push(p.x, p.y, p.z);
        if (grassy) uv.push(p.x / 6, p.z / 6);
        else uv.push(edge / 8, (t * COURSE_LENGTH) / 8);
        // Painted edge wear and broad turf variation live in existing vertices.
        const variation = 0.5 + 0.5 * Math.sin(p.x * 0.047 + Math.sin(p.z * 0.035) * 2);
        const shade = grassy
          ? 0.87 + variation * 0.13
          : Array.isArray(materials)
            ? 0.9 + variation * 0.06
            : 0.95;
        colors.push(shade, shade, shade);
      }
      if (i < n) {
        if (terrain && inBridge(THREE.MathUtils.lerp(startT, endT, (i + 0.5) / n))) continue;
        const a = i * 2,
          start = indices.length;
        if (edgeB(t) >= edgeA(t)) indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        else indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        if (Array.isArray(materials)) {
          const midpoint = THREE.MathUtils.lerp(startT, endT, (i + 0.5) / n);
          const materialIndex = Math.max(
            0,
            ["earth", "wood", "stone", "needles", "gravel"].indexOf(surfaceAt(midpoint).material),
          );
          const last = groups.at(-1);
          if (last && last.materialIndex === materialIndex && last.start + last.count === start)
            last.count += 6;
          else groups.push({ start, count: 6, materialIndex });
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices);
    for (const g of groups) geo.addGroup(g.start, g.count, g.materialIndex);
    geo.computeVertexNormals();
    const m = mesh(geo, materials);
    m.castShadow = false;
    m.userData.bakeReceiver = true;
    return m;
  }
  ribbon(
    (t) => -roadHalfWidth(t) - 0.55,
    (t) => roadHalfWidth(t) + 0.55,
    mats.roadside,
    -0.02,
  );
  ribbon(
    (t) => -roadHalfWidth(t),
    (t) => roadHalfWidth(t),
    [
      mat("#d4bd91", textures.gravel),
      wood,
      stone,
      mat("#afba89", textures.needles),
      mat("#c8c8aa", textures.gravel),
    ],
  );
  ribbon(
    (t) => roadHalfWidth(t),
    (t) => roadHalfWidth(t) + shortcutWidth(t),
    mats.grass,
    0.035,
  );
  const vergeMaterials = {
    grass: mats.grass,
    needles: mat("#b7b792", textures.needles),
    gravel: mat("#ccc9b6", textures.gravel),
    wood,
  };
  for (const v of VERGES)
    ribbon(
      (t) => v.side * roadHalfWidth(t),
      (t) => v.side * (roadHalfWidth(t) + vergeWidth(t, v.side)),
      vergeMaterials[v.material] || mats.grass,
      0.04,
      false,
      v.start,
      v.end,
    );
  for (const side of [-1, 1]) {
    const edge = (t) => (side < 0 ? surfaceAt(t).leftEdge : surfaceAt(t).rightEdge);
    ribbon(
      (t) => edge(t),
      (t) => edge(t) + side * TERRAIN_VERGE_WIDTH,
      mats.grass,
      0,
      true,
    );
    // The same physical limit is expressed by each place's natural boundary.
    // Rounded turf lips, exposed roots and old stonework replace the metal cage.
    for (const [index, section] of SECTIONS.entries()) {
      const boundary =
        index === 3
          ? { material: darkWood, width: 0.18, height: 0.28, above: 0.72 }
          : index === 6
            ? { material: stone, width: 0.65, height: 1.45, above: 0.62 }
            : index === 1
              ? { material: mats.trunk, width: 0.65, height: 0.35, above: 0.08 }
              : { material: mats.grass, width: 1.2, height: 0.4, above: 0.05 };
      mesh(
        createRailGeometry(side, { ...boundary, start: section.start, end: section.end }),
        boundary.material,
      );
    }
    mesh(
      createRailGeometry(side, {
        width: 0.12,
        height: 0.15,
        above: 1.25,
        start: BRIDGE_RANGE.start,
        end: BRIDGE_RANGE.end,
      }),
      bridgeRailMaterial,
    );
    for (let i = 0; i < 40; i++) {
      const t = THREE.MathUtils.lerp(BRIDGE_RANGE.start, BRIDGE_RANGE.end, i / 39),
        g = groupAt(t, edge(t));
      box(darkWood, g, [0, 0.72, 0], [0.19, 1.5, 0.19]);
    }
  }
  // Tire-worn earth has two subtle wheel ruts. Timber has actual cross planks.
  const rut = mat("#b29e7a", textures.gravel);
  for (const section of SECTIONS) {
    if (section.material !== "earth" && section.material !== "needles") continue;
    for (const side of [-1, 1])
      ribbon(
        () => side * 2 - 0.48,
        () => side * 2 + 0.48,
        rut,
        0.054,
        false,
        section.start,
        section.end,
      );
  }
  for (let i = 0; i < 330; i++) {
    const t = i / 330,
      g = groupAt(t),
      half = roadHalfWidth(t);
    if (SECTIONS[3].start <= t && t < SECTIONS[3].end) {
      box(darkWood, g, [0, 0.057, 0], [half * 2, 0.015, 0.06]);
    }
  }
  // Lift the wooden deck off the lake on beams and trestles. No missing road.
  for (let i = 0; i < 16; i++) {
    const t = THREE.MathUtils.lerp(BRIDGE_RANGE.start, BRIDGE_RANGE.end, i / 15);
    const g = groupAt(t);
    // Keep the crossbeam well below the timber deck, including at the raised
    // bridge hop where a near-flush beam can poke through the road.
    box(darkWood, g, [0, -1.2, 0], [12.8, 0.45, 1.5]);
    // Piles stay world-vertical and reach the valley floor; road-normal posts
    // followed the steep bridge grade and floated above or pierced the deck.
    const frame = frameAt(t);
    for (const x of [-5, 5]) {
      const top = frame.p
        .clone()
        .addScaledVector(frame.right, x)
        .addScaledVector(frame.up, -0.25);
      const height = Math.max(0.8, top.y + 1.65);
      box(darkWood, scenery, [top.x, top.y - height / 2, top.z], [0.7, height, 0.7]);
    }
  }
  const lakeFrame = poseAt(sectorT(3, 0.38) * TRACK, 39, 0);
  const lake = mesh(
    createLakeGeometry(),
    createWaterMaterial({
      scene,
      color: "#409db1",
      roughness: 0.2,
      normalMap: textures.water?.userData?.pbr?.normalMap || null,
      shoreRadius: 1,
      flow: 0.045,
      foam: true,
    }),
    scenery,
    [lakeFrame.p.x, -1.55, lakeFrame.p.z],
    [63, 51, 1],
  );
  lake.rotation.x = -Math.PI / 2;
  lake.castShadow = false;

  return { lake };
}

// An irregular authored shoreline replaces the perfect circular disc. UVs are
// reusable; two normal flows, Fresnel and foam come from the shared water shader.
function createLakeGeometry() {
  const n = 96,
    position = [0, 0, 0],
    uv = [0.5, 0.5],
    indices = [];
  for (let i = 0; i <= n; i++) {
    const a = (i * Math.PI * 2) / n;
    const r = 1 + 0.035 * Math.sin(a * 5) + 0.025 * Math.cos(a * 9);
    const x = Math.cos(a) * r,
      y = Math.sin(a) * r;
    position.push(x, y, 0);
    uv.push(x * 0.5 + 0.5, y * 0.5 + 0.5);
    if (i < n) indices.push(0, i + 1, i + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
