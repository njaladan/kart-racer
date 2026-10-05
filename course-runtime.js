import * as THREE from "./vendor/three/three.module.js";
import { createCourseKit, batchScenery } from "./course-kit.js";
import { cartAt } from "./hazards.js";
import { addCourseWorld } from "./course-world.js";
import { createRailGeometry } from "./course-rails.js";

const WORLD_GROUND_Y = -1.7;
const ROAD_SAMPLE_COUNT = 1800;
const ROAD_DECAL_COUNT = 330;
const RAIL_POST_COUNT = 370;

// Shared geometry uses the same surface and edge queries as karts and shells.
export function buildCourseWorld({
  scene,
  renderer,
  materials,
  textures,
  track,
  assets,
  sharedAssets,
}) {
  const course = track.course;
  if (course.id === "windmill-wilds") {
    return addCourseWorld(
      scene,
      renderer,
      materials,
      textures,
      sharedAssets?.nature,
    );
  }

  const scenery = new THREE.Group();
  scene.add(scenery);
  const kit = createCourseKit(scenery, track, assets);
  const { mesh, box, groupAt, material } = kit;
  const roadMaterials = createRoadMaterials(materials, textures, material);
  const sectionMaterialNames = [
    ...new Set([
      ...course.sections.map(({ material: name }) => name),
      ...(course.surfaces || []).map(({ material: name }) => name),
    ]),
  ];
  const sectionMaterials = sectionMaterialNames.map(
    (name) => roadMaterials[name] || materials.road,
  );

  addGround(scenery, materials.grass, mesh);
  const updateHazardWarning = addRoadAndShoulders({
    scenery,
    track,
    materials,
    mesh,
    sectionMaterials,
    sectionMaterialNames,
    material,
    box,
    groupAt,
  });

  batchScenery(scenery);
  const authoredWorld =
    course.buildWorld({
      THREE,
      scene,
      scenery,
      track,
      course,
      mats: materials,
      textures,
      renderer,
      kit,
      hazardAt: cartAt,
    }) || {};
  batchScenery(scenery, authoredWorld.animated || []);

  return {
    update(time) {
      updateHazardWarning(time);
      authoredWorld.update?.(time);
    },
  };
}

function createRoadMaterials(materials, textures, createMaterial) {
  return {
    asphalt: materials.road,
    stone: createMaterial("#e0d0ae", { map: textures.stone }),
    concrete: createMaterial("#b4c4d0", { map: textures.concrete }),
    wood: createMaterial("#a98458", { map: textures.wood }),
    ice: createMaterial("#9ddaf0", { roughness: 0.2, metalness: 0.2 }),
    snow: createMaterial("#e5f2f5"),
    sand: createMaterial("#d9b579", { map: textures.sand }),
    paving: createMaterial("#aaa09b"),
  };
}

function addGround(scenery, grassMaterial, addMesh) {
  const ground = addMesh(
    new THREE.PlaneGeometry(1800, 1800),
    grassMaterial,
    scenery,
    [0, WORLD_GROUND_Y, 0],
  );
  ground.rotation.x = -Math.PI / 2;
  ground.castShadow = false;

  const uv = ground.geometry.attributes.uv;
  for (let index = 0; index < uv.count; index++) {
    uv.setXY(index, uv.getX(index) * 120, uv.getY(index) * 120);
  }
}

function addRoadAndShoulders({
  scenery,
  track,
  materials,
  mesh,
  sectionMaterials,
  sectionMaterialNames,
  material,
  box,
  groupAt,
}) {
  const elevatedAt = (t) =>
    track.ELEVATED.some((range) => t >= range.start && t < range.end);
  const outerEdge = (t, side) =>
    side *
    (track.roadHalfWidth(t) + 0.55 + (side > 0 ? track.shortcutWidth(t) : 0));

  createRibbon(
    (t) => -track.roadHalfWidth(t) - 0.55,
    (t) => track.roadHalfWidth(t) + 0.55,
    materials.roadside,
    -0.02,
  );
  createRibbon(
    (t) => -track.roadHalfWidth(t),
    (t) => track.roadHalfWidth(t),
    sectionMaterials,
  );
  createRibbon(
    (t) => track.roadHalfWidth(t),
    (t) => track.roadHalfWidth(t) + track.shortcutWidth(t),
    materials.grass,
    0.035,
  );

  for (const side of [-1, 1]) {
    const edge = (t) => outerEdge(t, side);
    createRibbon(edge, (t) => edge(t) + side * 38, materials.grass, 0, true);

    const railMaterial = materials.rail.clone();
    railMaterial.side = THREE.DoubleSide;
    mesh(
      createRailGeometry(side, { width: 0.15, height: 0.32, above: 0.72 }),
      railMaterial,
    );

    for (let index = 0; index < RAIL_POST_COUNT; index++) {
      const t = (index + 0.5) / RAIL_POST_COUNT;
      const post = groupAt(t, edge(t));
      box(materials.rail, post, [0, 0.42, 0], [0.19, 0.86, 0.19]);
    }
  }

  addRoadMarkings();
  return addHazardWarning();

  function createRibbon(
    edgeA,
    edgeB,
    ribbonMaterial,
    lift = 0.045,
    terrain = false,
  ) {
    const positions = [];
    const uvs = [];
    const indices = [];
    const materialGroups = [];

    for (let index = 0; index <= ROAD_SAMPLE_COUNT; index++) {
      const t = index / ROAD_SAMPLE_COUNT;
      const frame = track.frameAt(t);
      const edges = [edgeA(t), edgeB(t)];

      for (const edge of edges) {
        const point = frame.p.clone().addScaledVector(frame.right, edge);
        if (terrain) {
          const roadEdge =
            track.roadHalfWidth(t) + (edge > 0 ? track.shortcutWidth(t) : 0);
          const distanceFromRoad = Math.abs(edge) - roadEdge;
          point.y = THREE.MathUtils.lerp(
            point.y - 0.06,
            WORLD_GROUND_Y,
            THREE.MathUtils.smoothstep(distanceFromRoad, 0, 38),
          );
        } else {
          point.addScaledVector(frame.up, lift);
        }
        positions.push(point.x, point.y, point.z);
        uvs.push(edge / 8, (t * track.COURSE_LENGTH) / 8);
      }

      if (
        index === ROAD_SAMPLE_COUNT ||
        (terrain && elevatedAt((index + 0.5) / ROAD_SAMPLE_COUNT))
      ) {
        continue;
      }

      const firstVertex = index * 2;
      const groupStart = indices.length;
      if (edgeB(t) >= edgeA(t)) {
        indices.push(
          firstVertex,
          firstVertex + 1,
          firstVertex + 2,
          firstVertex + 1,
          firstVertex + 3,
          firstVertex + 2,
        );
      } else {
        indices.push(
          firstVertex,
          firstVertex + 2,
          firstVertex + 1,
          firstVertex + 1,
          firstVertex + 2,
          firstVertex + 3,
        );
      }

      if (Array.isArray(ribbonMaterial)) {
        const sectionMaterial = track.surfaceAt(
          (index + 0.5) / ROAD_SAMPLE_COUNT,
        ).material;
        const materialIndex = sectionMaterialNames.indexOf(sectionMaterial);
        appendMaterialGroup(materialGroups, groupStart, materialIndex);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    materialGroups.forEach(({ start, count, materialIndex }) => {
      geometry.addGroup(start, count, materialIndex);
    });
    geometry.computeVertexNormals();

    const ribbonMesh = mesh(geometry, ribbonMaterial);
    ribbonMesh.castShadow = false;
  }

  function addRoadMarkings() {
    for (let index = 0; index < ROAD_DECAL_COUNT; index++) {
      const t = index / ROAD_DECAL_COUNT;
      const markingGroup = groupAt(t);
      const halfWidth = track.roadHalfWidth(t);
      if (index % 2 === 0) {
        box(materials.white, markingGroup, [0, 0.065, 0], [0.13, 0.025, 2.4]);
      }
      for (const side of [-1, 1]) {
        if (side > 0 && track.shortcutWidth(t) > 0.1) continue;
        const paint = index % 2 ? materials.red : materials.white;
        box(
          paint,
          markingGroup,
          [side * (halfWidth + 0.25), 0.07, 0],
          [0.5, 0.04, track.COURSE_LENGTH / ROAD_DECAL_COUNT + 0.1],
        );
      }
    }
  }

  function addHazardWarning() {
    const warningMaterial = material("#ffc850", {
      emissive: "#ff9d25",
      emissiveIntensity: 0,
    });
    const warning = groupAt(
      track.CART_T,
      -track.roadHalfWidth(track.CART_T) - 2,
    );
    box(materials.black, warning, [0, 2, 0], [0.2, 4, 0.2]);
    mesh(
      new THREE.SphereGeometry(0.45, 12, 8),
      warningMaterial,
      warning,
      [0, 4.2, 0],
    );
    return (time) => {
      warningMaterial.emissiveIntensity = cartAt(time).warning
        ? 1.5 + Math.sin(time * 12)
        : 0;
    };
  }
}

function appendMaterialGroup(groups, start, materialIndex) {
  const previous = groups.at(-1);
  if (
    previous &&
    previous.materialIndex === materialIndex &&
    previous.start + previous.count === start
  ) {
    previous.count += 6;
  } else {
    groups.push({ start, count: 6, materialIndex });
  }
}
