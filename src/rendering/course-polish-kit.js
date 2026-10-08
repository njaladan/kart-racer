import * as THREE from "../../vendor/three/three.module.js";
import { createCourseKit, batchScenery } from "./course-kit.js";
import { createScenerySite } from "./scenery-sites.js";
import { createRouteClearance } from "./route-clearance.js";
import { bevelBox } from "./visuals.js";
import { patchMaterial } from "./surface-detail.js";
import { registerLayeredLight, updateLayeredLighting } from "./layered-lighting.js";

/** Shared, bounded art tools. Driving geometry remains owned by track queries. */
export function createPolishKit({
  scene,
  track,
  textures = {},
  assets = {},
  baseWorld = {},
  vehicles = [],
}) {
  const scenery = new THREE.Group();
  scenery.name = `${track.course.name} lighting and silhouette polish`;
  scene.add(scenery);
  const kit = createCourseKit(scenery, track, assets);
  const materials = new Map(),
    geometries = new Map();
  const animated = [],
    updates = [];
  const safe = createScenerySite(kit, track, scenery);
  let routeCorridor;
  function mat(color, textureName = null, extra = {}) {
    const key = `${color}:${textureName}:${Object.entries(extra)
      .map(([k, v]) => `${k}=${v?.uuid ?? JSON.stringify(v)}`)
      .join(";")}`;
    if (!materials.has(key)) {
      const map = textureName ? textures[textureName] : null;
      materials.set(
        key,
        kit.material(color, {
          ...(map
            ? {
                map,
                normalMap: textures[`${textureName}Normal`],
                roughnessMap: textures[`${textureName}Roughness`],
              }
            : {}),
          normalScale: new THREE.Vector2(0.35, 0.35),
          roughness: 0.88,
          ...extra,
        }),
      );
    }
    return materials.get(key);
  }
  function rounded(width, height, depth, radius = 0.1) {
    const key = `${width}:${height}:${depth}:${radius}`;
    if (!geometries.has(key)) geometries.set(key, bevelBox(width, height, depth, radius));
    return geometries.get(key);
  }
  function motion(object, update) {
    if (!animated.includes(object)) animated.push(object);
    updates.push(update);
    return object;
  }
  function tube(parent, start, end, radius, material) {
    const a = new THREE.Vector3(...start),
      b = new THREE.Vector3(...end),
      d = b.clone().sub(a);
    const key = "tube-cylinder";
    if (!geometries.has(key)) geometries.set(key, new THREE.CylinderGeometry(1, 1, 1, 8));
    const object = kit.mesh(
      geometries.get(key),
      material,
      parent,
      a.clone().add(b).multiplyScalar(0.5).toArray(),
      [radius, d.length(), radius],
    );
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return object;
  }
  function sweep(section, start, end, left, right, material, above = 0.06) {
    const a = track.sectorT(section, start),
      b = track.sectorT(section, end);
    const count = Math.max(12, Math.ceil(((b - a) * track.COURSE_LENGTH) / 3));
    const positions = [],
      uv = [],
      indices = [];
    for (let i = 0; i <= count; i++) {
      const t = a + ((b - a) * i) / count;
      for (const side of [left, right]) {
        const offset = typeof side === "function" ? side(t) : side;
        const p = track.poseAt(t * track.TRACK, offset, above).p;
        positions.push(p.x, p.y, p.z);
        uv.push(offset * 0.25, t * track.COURSE_LENGTH * 0.25);
      }
      if (i < count) {
        const q = i * 2;
        indices.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const object = kit.mesh(geometry, material);
    object.castShadow = false;
    object.name = "Scenic construction trim";
    return object;
  }
  function light(options) {
    const p = new THREE.Vector3(
      ...(options.position?.isVector3 ? options.position.toArray() : options.position || [0, 0, 0]),
    );
    const candidates = options.parent?.userData.polishSources || [];
    const sourceObject = candidates.find((object) => object.position.distanceToSquared(p) < 1);
    return registerLayeredLight(scene, { ...options, ...(sourceObject ? { sourceObject } : {}) });
  }
  function source(parent, position, color, size = 0.2) {
    const geometry = rounded(size, size, size, size * 0.16);
    const bulb = kit.mesh(
      geometry,
      mat(color, null, { emissive: color, emissiveIntensity: 2.2 }).clone(),
      parent,
      position,
    );
    bulb.name = "Visible layered light source";
    bulb.userData.skipBake = true;
    bulb.userData.excludeFromReflectionProbe = true;
    bulb.castShadow = bulb.receiveShadow = false;
    (parent.userData.polishSources ||= []).push(bulb);
    return bulb;
  }
  function edgeRibbon(
    section,
    side,
    {
      color = "#b9a783",
      width = 1.4,
      textureName = null,
      roughness = 0.96,
      lift = 0.035,
      noise = 0.35,
    } = {},
  ) {
    const range = track.SECTIONS[section];
    const count = Math.max(12, Math.ceil(((range.end - range.start) * track.COURSE_LENGTH) / 3));
    const positions = [],
      uv = [],
      colors = [],
      indices = [];
    for (let row = 0; row <= count; row++) {
      const t = THREE.MathUtils.lerp(range.start, range.end, row / count);
      const frame = track.frameAt(t),
        surface = track.surfaceAt(t);
      const bound = side < 0 ? surface.leftEdge : surface.rightEdge;
      const wave = Math.sin(row * 0.69 + section * 2.4) * 0.5 + Math.sin(row * 0.21) * 0.5;
      for (let col = 0; col < 3; col++) {
        const offset = bound + side * (0.03 + col * 0.5 * width * (1 + wave * noise));
        const pose = track.poseAt(t * track.TRACK, offset, 0);
        const p = pose.p.clone().addScaledVector(frame.up, lift);
        positions.push(p.x, p.y, p.z);
        uv.push(offset * 0.25, row * 0.4);
        const value = col === 0 ? 0.84 : col === 1 ? 1 : 0.92;
        colors.push(value, value, value);
      }
      if (row < count)
        for (let col = 0; col < 2; col++) {
          const a = row * 3 + col;
          indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    routeCorridor ||= createRouteClearance(track).corridor;
    const safeIndices = [];
    const triangleBounds = new THREE.Box3(),
      point = new THREE.Vector3();
    for (let i = 0; i < indices.length; i += 3) {
      triangleBounds.makeEmpty();
      for (let corner = 0; corner < 3; corner++)
        triangleBounds.expandByPoint(point.fromArray(positions, indices[i + corner] * 3));
      if (routeCorridor.some((corridor) => corridor.intersectsBox(triangleBounds))) continue;
      safeIndices.push(...indices.slice(i, i + 3));
    }
    geometry.setIndex(
      side < 0 ? safeIndices : safeIndices.map((_, i) => safeIndices[i - (i % 3) + 2 - (i % 3)]),
    );
    geometry.computeVertexNormals();
    const strip = kit.mesh(
      geometry,
      mat(color, textureName, { roughness, side: THREE.DoubleSide }),
    );
    strip.name = "Irregular material transition outside driving edge";
    strip.castShadow = false;
    return strip;
  }
  return {
    THREE,
    scene,
    track,
    textures,
    assets,
    scenery,
    kit,
    mat,
    safe,
    baseWorld,
    vehicles,
    at: (section, fraction, offset = 0) =>
      kit.groupAt(track.sectorT(section, fraction), offset, scenery),
    mesh: kit.mesh,
    box: kit.box,
    motion,
    light,
    source,
    edgeRibbon,
    tube,
    sweep,
    align: kit.align,
    bevelBox: rounded,
    patch: patchMaterial,
    seeded(seed) {
      return () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
    },
    finish() {
      batchScenery(scenery, animated);
      return {
        scenery,
        animated,
        update(time, state = {}) {
          const seconds = state.motionEnabled === false ? 0 : time;
          updates.forEach((update) => update(seconds, state));
          updateLayeredLighting(scene, time, state);
        },
        setQuality(tier) {
          scene.userData.layeredLightingQuality = tier;
        },
        updateCamera(position) {
          scene.userData.layeredLightingCamera = position;
        },
      };
    },
  };
}
