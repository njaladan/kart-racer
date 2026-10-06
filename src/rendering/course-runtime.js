import * as THREE from "../../vendor/three/three.module.js";
import { createCourseKit, batchScenery } from "./course-kit.js";
import { cartAt, trafficAt } from "../simulation/hazards.js";
import { buildWindmillWorld } from "../courses/windmill-wilds/world.js";
import { installWetPavement } from "./surface-detail.js";
import { createRailGeometry } from "./course-rails.js";
import { buildPathwayEdges } from "./pathway-edges.js";
import { addDetailedScenery } from "./detailed-scenery.js";
import { TERRAIN_VERGE_WIDTH } from "./terrain-height.js";
import { createSceneryDetailController } from "./scenery-lod.js";
import { templePaving } from "../courses/sunstone-ruins/sunstone-materials.js";
import { kitchenRoadDetail } from "../courses/adventure/pantry-materials.js";
import { glasshouseRoad } from "../courses/adventure/pelagic-materials.js";
import { metalDeckDetail } from "../courses/adventure/architectural-detail.js";

// Shared geometry uses exactly the surface/edge queries used by karts and shells.
export function buildCourseWorld({
  scene,
  renderer,
  materials: mats,
  textures,
  track,
  assets,
  sharedAssets: commonAssets,
}) {
  const course = track.course;
  if (course.id === "windmill-wilds") {
    const world = buildWindmillWorld({
      scene,
      renderer,
      materials: mats,
      textures,
      track,
      nature: commonAssets?.nature,
      assets,
    });
    addDetailedScenery(scene, track, assets);
    return { ...world, ...createSceneryDetailController(scene) };
  }
  const scenery = new THREE.Group();
  scene.add(scenery);
  const kit = createCourseKit(scenery, track, assets);
  const { mesh, box, groupAt, material } = kit;
  const roadMaterials = {
    asphalt: mats.road,
    stone: material("#e0d0ae", {
      map: course.id === "neon-harbor" ? textures.paving || textures.concrete : textures.stone,
      roughness: course.id === "neon-harbor" ? 0.58 : 0.85,
      metalness: course.id === "neon-harbor" ? 0.12 : 0,
    }),
    concrete: material("#b4c4d0", { map: textures.concrete }),
    wood: material("#d2b38d", {
      map: textures.wood,
      bumpMap: textures.wood,
      bumpScale: 0.04,
    }),
    ice: material("#b9e5ff", {
      map: textures.frostIce,
      normalMap: textures.frostIceNormal,
      normalScale: new THREE.Vector2(0.4, 0.4),
      roughnessMap: textures.frostIceRoughness,
      roughness: 0.65,
      metalness: 0.12,
    }),
    grass: mats.grass,
    snow: material("#f3f6ff", { map: textures.frostSnow || textures.snow }),
    sand: material("#ead3a0", { map: textures.sand }),
    gravel: material("#c7c7ba", {
      map: textures.gravel || textures.stone,
      bumpMap: textures.gravel || textures.stone,
      bumpScale: 0.04,
    }),
    needles: material("#b4ab80", {
      map: textures.needles || textures.bark,
      bumpScale: 0.025,
    }),
    paving: material("#c9c4c1", {
      map: textures.paving || textures.concrete,
      bumpMap: textures.paving || textures.concrete,
      bumpScale: 0.035,
    }),
  };
  if (course.edgeStyle === "adventure") {
    const road = course.theme.road;
    roadMaterials.stone = material(road, { bumpMap: textures.stone, bumpScale: 0.025 });
    roadMaterials.paper = material(road, { roughness: 0.8 });
    roadMaterials.glass = material(road, { roughness: 0.3, metalness: 0.2 });
    roadMaterials.metal = material(road, {
      bumpMap: textures.metal,
      bumpScale: 0.02,
      metalness: 0.42,
      roughness: 0.5,
    });
    roadMaterials.wood = material(road, { bumpMap: textures.wood, bumpScale: 0.03 });
    roadMaterials.paving = material(road, { bumpMap: textures.paving, bumpScale: 0.025 });
    metalDeckDetail(roadMaterials.metal);
    if (course.id === "pelagic-glasshouse") glasshouseRoad(roadMaterials.glass, scene);
    if (["pocket-pantry", "metronome-hall"].includes(course.id)) {
      kitchenRoadDetail(roadMaterials.wood);
      kitchenRoadDetail(roadMaterials.paving, true);
    } else templePaving(roadMaterials.paving);
  }
  if (course.theme.wetPavement) installWetPavement(roadMaterials.stone);
  if (!course.pathwayEdges && course.edgeStyle === "adventure") {
    const rail = material(course.theme.shoulder, { metalness: 0.25 });
    for (const side of [-1, 1]) {
      for (const section of track.SECTIONS) {
        if (
          (course.verges || []).some(
            (v) =>
              (v.gate === "unfold" || v.maxScale) &&
              v.side === side &&
              track.SECTIONS[v.section] === section,
          )
        )
          continue;
        const range = (course.traversals || []).find((r) => track.SECTIONS[r.section] === section);
        if (
          range ||
          (course.movingDecks || []).some(
            (d) =>
              section.end > track.sectorT(d.section, d.startFraction) &&
              section.start < track.sectorT(d.endSection ?? d.section, d.endFraction),
          )
        )
          continue;
        const geometry = createRailGeometry(side, {
          width: 0.25,
          height: 0.4,
          above: 0.5,
          start: section.start,
          end: section.end,
        });
        mesh(geometry, rail);
      }
    }
  }
  if (course.edgeStyle === "sunstone") {
    roadMaterials.stone = material("#d7bc93", { bumpMap: textures.stone, bumpScale: 0.035 });
    roadMaterials.paving = material("#dccaab", { bumpMap: textures.paving, bumpScale: 0.02 });
    roadMaterials.sand = material("#ebca85", { bumpMap: textures.sand, bumpScale: 0.03 });
    templePaving(roadMaterials.stone);
    templePaving(roadMaterials.paving, { ceremonial: true });
  }
  const groundHeight = course.theme.groundHeight ?? -1.7;
  const conveyorTextures = [];
  const materialNames = [
    ...new Set([
      ...course.sections.map((s) => s.material),
      ...(course.surfaces || []).map((s) => s.material),
      ...(course.verges || []).map((v) => v.material),
      ...(course.shortcut?.material ? [course.shortcut.material] : []),
    ]),
  ];
  const roads = materialNames.map((name) => roadMaterials[name] || mats.road);
  const ground = mesh(new THREE.PlaneGeometry(1800, 1800), mats.grass, scenery, [
    0,
    groundHeight,
    0,
  ]);
  ground.rotation.x = -Math.PI / 2;
  ground.castShadow = false;
  ground.name = "Course ground";
  ground.userData.bakeReceiver = true;
  const uvGround = ground.geometry.attributes.uv;
  for (let i = 0; i < uvGround.count; i++)
    uvGround.setXY(i, uvGround.getX(i) * 120, uvGround.getY(i) * 120);
  const isElevated = (t) => track.ELEVATED.some((s) => t >= s.start && t < s.end);
  function ribbon(edgeA, edgeB, mat, lift = 0.045, terrain = false, startT = 0, endT = 1) {
    const positions = [],
      uv = [],
      indices = [],
      groups = [],
      n = Math.max(8, Math.ceil(1800 * (endT - startT)));
    for (let i = 0; i <= n; i++) {
      const t = THREE.MathUtils.lerp(startT, endT, i / n),
        f = track.frameAt(t);
      for (const edge of [edgeA(t), edgeB(t)]) {
        const p = f.p.clone().addScaledVector(f.right, edge);
        p.y += track.rampHeight(t, edge) - track.rampHeight(t, 0);
        if (terrain) {
          const bounds = track.surfaceAt(t);
          const distance = Math.abs(edge) - (edge > 0 ? bounds.rightEdge : -bounds.leftEdge);
          p.y = THREE.MathUtils.lerp(
            p.y - 0.06,
            groundHeight,
            THREE.MathUtils.clamp(distance / TERRAIN_VERGE_WIDTH, 0, 1),
          );
        } else p.addScaledVector(f.up, lift);
        positions.push(p.x, p.y, p.z);
        uv.push(edge / 8, (t * track.COURSE_LENGTH) / 8);
      }
      const midpoint = THREE.MathUtils.lerp(startT, endT, (i + 0.5) / n);
      const transit = (course.traversals || []).some(
        (r) =>
          midpoint >= track.sectorT(r.section, r.startFraction) &&
          midpoint < track.sectorT(r.section, r.endFraction),
      );
      const moving = (course.movingDecks || []).some(
        (d) =>
          midpoint > track.sectorT(d.section, d.startFraction) + 18 / track.COURSE_LENGTH &&
          midpoint <
            track.sectorT(d.endSection ?? d.section, d.endFraction) - 18 / track.COURSE_LENGTH,
      );
      if (i === n || transit || moving || (terrain && isElevated(midpoint))) continue;
      const a = i * 2,
        start = indices.length;
      if (edgeB(t) >= edgeA(t)) indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      else indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      if (Array.isArray(mat)) {
        const materialIndex = materialNames.indexOf(track.surfaceAt(midpoint).material);
        const last = groups.at(-1);
        if (last && last.materialIndex === materialIndex && last.start + last.count === start)
          last.count += 6;
        else groups.push({ start, count: 6, materialIndex });
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices);
    groups.forEach((g) => geo.addGroup(g.start, g.count, g.materialIndex));
    geo.computeVertexNormals();
    const m = mesh(geo, mat);
    m.castShadow = false;
    m.name = terrain ? "Course terrain verge" : "Course road surface";
    m.userData.bakeReceiver = true;
  }
  ribbon(
    (t) => -track.roadHalfWidth(t) - 0.55,
    (t) => track.roadHalfWidth(t) + 0.55,
    course.pathwayEdges ? roads : mats.roadside,
    -0.02,
  );
  ribbon(
    (t) => -track.roadHalfWidth(t),
    (t) => track.roadHalfWidth(t),
    roads,
  );
  ribbon(
    (t) => track.roadHalfWidth(t),
    (t) => track.roadHalfWidth(t) + track.shortcutWidth(t),
    roadMaterials[course.shortcut.material] || mats.grass,
    0.035,
  );
  for (const v of track.VERGES) {
    if (v.gate === "unfold") continue;
    ribbon(
      (t) => v.side * track.roadHalfWidth(t),
      (t) => v.side * (track.roadHalfWidth(t) + track.vergeWidth(t, v.side)),
      roadMaterials[v.material] || mats.grass,
      0.04,
      false,
      v.start,
      v.end,
    );
  }
  for (const belt of track.CONVEYORS) {
    const texture = textures.harborConveyor?.clone() || new THREE.Texture();
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    const beltMaterial = material("#ffffff", {
      map: texture,
      roughness: 0.62,
      metalness: 0.24,
      emissive: "#173d45",
      emissiveIntensity: 0.32,
    });
    const half = (t) => track.roadHalfWidth(t) + 0.55;
    ribbon((t) => -half(t), half, beltMaterial, 0.07, false, belt.start, belt.end);
    conveyorTextures.push({ texture, speed: belt.speed });
  }
  const laneRamps = track.RAMPS.filter((ramp) => ramp.width != null || ramp.halfWidth != null);
  if (laneRamps.length) {
    const plateMaterial = material("#b5a374", {
      color: "#c49a55",
      metalness: 0.58,
      roughness: 0.5,
      emissive: "#382819",
      emissiveIntensity: 0.25,
    });
    for (const ramp of laneRamps) {
      const width = ramp.width ?? ramp.halfWidth * 2;
      const center = ramp.offset ?? 0;
      const rows = Math.max(12, Math.ceil((ramp.halfLength * 2) / 0.65));
      const columns = 6;
      const positions = [];
      const uvs = [];
      const indices = [];
      for (let row = 0; row <= rows; row++) {
        const q = row / rows;
        const t = ramp.t + ((q - 0.5) * ramp.halfLength * 2) / track.COURSE_LENGTH;
        const frame = track.frameAt(t);
        for (let column = 0; column <= columns; column++) {
          const across = column / columns;
          const offset = center + (across - 0.5) * width;
          const p = frame.p.clone().addScaledVector(frame.right, offset);
          p.y += track.rampHeight(t, offset) - track.rampHeight(t, 0) + 0.045;
          positions.push(p.x, p.y, p.z);
          uvs.push(across, q * 3);
          if (row < rows && column < columns) {
            const a = row * (columns + 1) + column;
            indices.push(a, a + 1, a + columns + 1, a + 1, a + columns + 2, a + columns + 1);
          }
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const plate = mesh(geometry, plateMaterial);
      plate.name = "Localized maintenance ramp plate";
      plate.castShadow = false;
    }
  }
  if (course.bridgeJoint) {
    const joint = course.bridgeJoint;
    const t = track.sectorT(joint.section, joint.fraction);
    const half = track.roadHalfWidth(t) + 0.45;
    const halfLength = (joint.length || 1) / 2;
    const positions = [];
    for (const along of [-1, 1]) {
      const station = t + (along * halfLength) / track.COURSE_LENGTH;
      const frame = track.frameAt(station);
      for (const offset of [-half, half]) {
        const p = frame.p.clone().addScaledVector(frame.right, offset);
        p.y += track.rampHeight(station, offset) - track.rampHeight(station, 0) + 0.09;
        positions.push(p.x, p.y, p.z);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex([0, 1, 2, 1, 3, 2]);
    geometry.computeVertexNormals();
    const jointMaterial = material("#71808b", { metalness: 0.72, roughness: 0.42 });
    const strip = mesh(geometry, jointMaterial);
    strip.name = "Bridge expansion joint";
    strip.castShadow = false;
  }
  for (const side of [-1, 1]) {
    const edge = (t) => (side < 0 ? track.surfaceAt(t).leftEdge : track.surfaceAt(t).rightEdge);
    if (course.pathwayEdges) continue;
    ribbon(edge, (t) => edge(t) + side * TERRAIN_VERGE_WIDTH, mats.grass, 0, true);
    if (["port-lumen", "sunstone", "frostpeak", "adventure"].includes(course.edgeStyle)) continue;
    const railMaterial = mats.rail.clone();
    railMaterial.side = THREE.DoubleSide;
    mesh(createRailGeometry(side, { width: 0.15, height: 0.32, above: 0.72 }), railMaterial);
    for (let i = 0; i < 370; i++) {
      const t = (i + 0.5) / 370,
        g = groupAt(t, edge(t));
      box(mats.rail, g, [0, 0.42, 0], [0.19, 0.86, 0.19]);
    }
  }
  for (
    let i = 0;
    !course.pathwayEdges &&
    !["port-lumen", "sunstone", "frostpeak", "adventure"].includes(course.edgeStyle) &&
    i < 330;
    i++
  ) {
    const t = i / 330,
      g = groupAt(t),
      half = track.roadHalfWidth(t);
    if (i % 2 === 0) box(mats.white, g, [0, 0.065, 0], [0.13, 0.025, 2.4]);
    for (const side of [-1, 1]) {
      if (track.vergeWidth(t, side) > 0.1 || (side > 0 && track.shortcutWidth(t) > 0.1)) continue;
      box(
        i % 2 ? mats.red : mats.white,
        g,
        // Keep the outer curb edge inside the physical .55m shoulder. The
        // wider painted lip overlaps the road without changing collision data.
        [side * (half + 0.15), 0.105, 0],
        [0.8, 0.12, track.COURSE_LENGTH / 330 + 0.1],
      );
    }
  }
  if (!course.pathwayEdges && course.edgeStyle === "sunstone") {
    const edgeMaterial = material("#c49663", { bumpMap: textures.stone, bumpScale: 0.02 });
    for (const side of [-1, 1]) {
      const rail = mesh(
        createRailGeometry(side, { width: 0.7, height: 0.65, above: 0 }),
        edgeMaterial,
      );
      rail.name = "Continuous sandstone parapet";
    }
  }
  buildPathwayEdges({ track, kit, textures });
  const warningMaterial = material("#ffc850", {
    emissive: "#ff9d25",
    emissiveIntensity: 0,
  });
  const warning = groupAt(track.CART_T, -track.roadHalfWidth(track.CART_T) - 2);
  box(mats.black, warning, [0, 2, 0], [0.2, 4, 0.2]);
  mesh(new THREE.SphereGeometry(0.45, 12, 8), warningMaterial, warning, [0, 4.2, 0]);
  // Batch only common static road furniture. Scenery authors batch their own props,
  // leaving declared dynamic assemblies separate and transformable.
  batchScenery(scenery);
  const world =
    course.buildWorld({
      THREE,
      scene,
      scenery,
      track,
      course,
      mats,
      textures,
      renderer,
      kit,
      assets,
      hazardAt: cartAt,
      trafficAt,
    }) || {};
  batchScenery(scenery, world.animated || []);
  addDetailedScenery(scene, track, assets);
  return {
    ...createSceneryDetailController(scene),
    animated: world.animated || [],
    update(time, courseState) {
      for (const belt of conveyorTextures) belt.texture.offset.y = -(time * belt.speed) / 8;
      warningMaterial.emissiveIntensity = cartAt(time).warning ? 1.5 + Math.sin(time * 12) : 0;
      world.update?.(time, courseState);
    },
  };
}
