#!/usr/bin/env node
import { auditRouteGeometry } from "./scene-route-audit.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as THREE from "../vendor/three/three.module.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
import { decodeCourseModels, normalizeCourseModel } from "../src/rendering/course-assets.js";
import { createCourseKit } from "../src/rendering/course-kit.js";
import { buildCourseWorld } from "../src/rendering/course-runtime.js";
import { decodeLivingModels } from "../src/rendering/living-assets.js";
import { COURSES } from "../src/courses/registry.js";
import { selectCourse } from "../src/track/track.js";

const root = resolve(new URL("..", import.meta.url).pathname);
const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require("sharp");
} catch {
  sharp = require("/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp");
}
const output = process.env.LIGHTING_SCENE_DIR || "/tmp/turbo-trail-lighting-scenes";
await mkdir(output, { recursive: true });
const wanted = process.argv.slice(2);
const arrayBuffer = (data) => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

async function loadAssets(id) {
  const base = resolve(root, "assets/courses");
  const assets = {
    textures: {},
    models: decodeCourseModels(
      JSON.parse(await readFile(`${base}/models.json`)),
      arrayBuffer(await readFile(`${base}/models.bin`)),
    ),
  };
  for (const pack of ["shared", id]) {
    const folder = `${base}/packs/${pack}`;
    const manifest = JSON.parse(await readFile(`${folder}/manifest.json`));
    for (const entry of manifest.textures || []) {
      const { data, info } = await sharp(await readFile(resolve(folder, entry.file)))
        .resize(16, 16)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const average = new THREE.Color(0, 0, 0);
      for (let i = 0; i < data.length; i += info.channels)
        average.add(
          new THREE.Color().setRGB(
            data[i] / 255,
            data[i + 1] / 255,
            data[i + 2] / 255,
            THREE.SRGBColorSpace,
          ),
        );
      average.multiplyScalar(info.channels / data.length);
      const texture = new THREE.Texture();
      texture.userData.averageLinear = average.toArray();
      assets.textures[entry.name] = texture;
    }
    for (const entry of manifest.models) {
      if (entry.name.startsWith("stk-kart-")) continue;
      const loader = new GLTFLoader();
      loader.register((parser) => {
        // Decode only for color estimates in the offline lighting solver. This
        // replaces both regular glTF and EXT_texture_webp image loading.
        const loadImageSource = parser.loadImageSource.bind(parser);
        parser.loadImageSource = async (sourceIndex) => {
          const image = parser.json.images[sourceIndex];
          let bytes;
          if (image.bufferView !== undefined)
            bytes = Buffer.from(await parser.getDependency("bufferView", image.bufferView));
          else if (image.uri?.startsWith("data:"))
            bytes = Buffer.from(image.uri.split(",")[1], "base64");
          else if (image.uri) bytes = await readFile(resolve(folder, entry.file, "..", image.uri));
          else return loadImageSource(sourceIndex);
          const { data, info } = await sharp(bytes)
            .resize(16, 16)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
          const average = new THREE.Color(0, 0, 0);
          let coverage = 0;
          for (let p = 0; p < data.length; p += info.channels) {
            const alpha = data[p + 3] / 255;
            average.add(
              new THREE.Color()
                .setRGB(data[p] / 255, data[p + 1] / 255, data[p + 2] / 255, THREE.SRGBColorSpace)
                .multiplyScalar(alpha),
            );
            coverage += alpha;
          }
          average.multiplyScalar(1 / Math.max(1, coverage));
          const texture = new THREE.Texture();
          texture.image = { width: info.width, height: info.height };
          texture.userData.averageLinear = average.toArray();
          texture.userData.coverage = coverage / (info.width * info.height);
          return texture;
        };
        return { name: "COURSE_LIGHTING_AVERAGE_TEXTURES" };
      });
      const gltf = await loader.parseAsync(
        arrayBuffer(await readFile(resolve(folder, entry.file))),
        "",
      );
      const model = normalizeCourseModel(gltf.scene);
      model.userData.animationClips = gltf.animations;
      model.userData.lods = entry.lods || null;
      model.userData.lodDistances = entry.lodDistances || [0, 85, 180];
      model.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      assets.models[entry.name] = model;
    }
  }
  const living = resolve(root, "assets/living");
  Object.assign(
    assets.models,
    decodeLivingModels(
      JSON.parse(await readFile(`${living}/index.json`)),
      arrayBuffer(await readFile(`${living}/props.bin`)),
    ),
  );
  return assets;
}

const selected = wanted.length
  ? await Promise.all(
      wanted.map(async (id) => {
        if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Expected a course ID");
        return (
          COURSES.find((course) => course.id === id) ||
          (await import(`../src/courses/${id}.js`)).default
        );
      }),
    )
  : COURSES;
// Authors can bake a prepared world before exposing it in the playable registry.
for (const course of selected) {
  const assets = await loadAssets(course.id);
  const track = selectCourse(course);
  const scene = new THREE.Scene();
  const textures = Object.fromEntries(
    [
      "grass",
      "asphalt",
      "stone",
      "sand",
      "snow",
      "metal",
      "brick",
      "concrete",
      "wood",
      "bark",
      "water",
      "leaves",
      "fabric",
      "rock",
      "needles",
      "gravel",
      "roof",
      "paving",
    ].map((name) => [name, new THREE.Texture()]),
  );
  Object.assign(textures, assets.textures);
  const mats = Object.fromEntries(
    ["grass", "road", "roadside", "rail", "white", "red", "black", "pine2", "trunk"].map((name) => [
      name,
      new THREE.MeshStandardMaterial({ color: name === "grass" ? course.theme.ground : "#ffffff" }),
    ]),
  );
  const world = buildCourseWorld({
    scene,
    track,
    assets,
    textures,
    materials: mats,
    renderer: null,
    sharedAssets: {},
  });
  // Exercise kit import in the same runtime contract used by course authors.
  createCourseKit(new THREE.Group(), track, assets);
  world.update(0);
  scene.updateMatrixWorld(true);
  if (process.env.COURSE_ROUTE_AUDIT) {
    const reports = [];
    for (const lap of track.branches.some(b => b.lap != null) ? [0, 1, 2] : [0]) {
      world.update(0, {playerLap: lap, racers: [], motionEnabled: false, running: false});
      scene.updateMatrixWorld(true);
      reports.push(auditRouteGeometry(scene, track, world.animated, lap));
    }
    const report = { course: course.id, clearance: scene.userData.sceneryClearance, stations: reports.reduce((n,r)=>n+r.stations,0), hits: reports.flatMap((r,lap)=>r.hits.map(h=>({...h,lap}))) };
    await writeFile(`${output}/${course.id}-audit.json`, JSON.stringify(report, null, 2));
    console.log("Route audit", course.id, report.stations, "rays", report.hits.length, "intersections");
    if (process.env.COURSE_ROUTE_AUDIT === "only") continue;
  }
  const positions = [],
    indices = [],
    colors = [],
    receivers = [];
  const temporary = new THREE.Vector3(),
    instance = new THREE.Matrix4();
  function visit(object, skip = false) {
    skip ||= !!object.userData.skipBake || (world.animated || []).includes(object);
    if (skip) return;
    if (object.isLOD) {
      visit(object.levels[0].object);
      return;
    }
    if (object.isMesh && !object.isSprite) {
      const materialList = Array.isArray(object.material) ? object.material : [object.material];
      const receiver = !!object.userData.bakeReceiver;
      if (receiver || object.castShadow) {
        const geometry = object.geometry;
        const position = geometry.attributes.position;
        const groups = geometry.groups.length
          ? geometry.groups
          : [{ start: 0, count: geometry.index?.count ?? position.count, materialIndex: 0 }];
        for (let copy = 0; copy < (object.isInstancedMesh ? object.count : 1); copy++) {
          const matrix = object.matrixWorld.clone();
          if (object.isInstancedMesh) {
            object.getMatrixAt(copy, instance);
            matrix.multiply(instance);
          }
          const offset = positions.length / 3;
          for (let i = 0; i < position.count; i++) {
            temporary.fromBufferAttribute(position, i).applyMatrix4(matrix);
            positions.push(temporary.x, temporary.y, temporary.z);
          }
          for (const group of groups) {
            const material = materialList[group.materialIndex] || materialList[0];
            if (!material?.isMeshStandardMaterial) continue;
            const color = material.color.clone();
            if (material.map?.userData.averageLinear)
              color.multiply(new THREE.Color().fromArray(material.map.userData.averageLinear));
            const coverage =
              material.alphaTest > 0
                ? Math.max(0.18, material.map?.userData.coverage ?? 0.5)
                : material.transparent
                  ? 0.12
                  : 1;
            for (let i = group.start; i < group.start + group.count; i += 3) {
              const vertex = [0, 1, 2].map((j) =>
                geometry.index ? geometry.index.getX(i + j) : i + j,
              );
              indices.push(...vertex.map((v) => v + offset));
              colors.push(...color.toArray(), coverage);
              receivers.push(receiver ? 1 : 0);
            }
          }
        }
      }
    }
    for (const child of object.children) visit(child, skip);
  }
  visit(scene);
  const controls = course.controls;
  const minX = Math.min(...controls.map((p) => p[0])) - 85;
  const minZ = Math.min(...controls.map((p) => p[2])) - 85;
  const maxX = Math.max(...controls.map((p) => p[0])) + 85;
  const maxZ = Math.max(...controls.map((p) => p[2])) + 85;
  const streams = [
    new Float32Array(positions),
    new Uint32Array(indices),
    new Float32Array(colors),
    new Uint8Array(receivers),
  ];
  const binary = Buffer.concat(streams.map((stream) => Buffer.from(stream.buffer)));
  const metadata = {
    course: course.id,
    positions: positions.length / 3,
    triangles: indices.length / 3,
    offsets: [
      0,
      streams[0].byteLength,
      streams[0].byteLength + streams[1].byteLength,
      streams[0].byteLength + streams[1].byteLength + streams[2].byteLength,
    ],
    bounds: [minX, minZ, maxX - minX, maxZ - minZ],
    heightRange: [
      Math.min(-12, (course.theme.groundHeight ?? -1.7) - 10, ...controls.map((p) => p[1] - 30)),
      Math.max(75, ...controls.map((p) => p[1] + 70)),
    ],
    lightVolume: course.theme.lightVolume,
    lights: (scene.userData.localLightPools || []).map((pool) => ({
      position: pool.position.toArray(),
      color: pool.color.toArray(),
      intensity: pool.intensity,
      radius: pool.radius,
    })),
  };
  await writeFile(`${output}/${course.id}.bin`, binary);
  await writeFile(`${output}/${course.id}.json`, JSON.stringify(metadata));
  console.log(JSON.stringify(metadata));
}
