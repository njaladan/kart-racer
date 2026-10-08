#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import * as THREE from "../vendor/three/three.module.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
import { COURSES } from "../src/courses/registry.js";
import { selectCourse } from "../src/track/track.js";
import { buildCourseWorld } from "../src/rendering/course-runtime.js";
import { normalizeCourseModel, decodeCourseModels } from "../src/rendering/course-assets.js";
import { decodeLivingModels } from "../src/rendering/living-assets.js";
import { auditRouteGeometry } from "./scene-route-audit.mjs";
const root = new URL("../", import.meta.url);
const json = (p) => JSON.parse(readFileSync(new URL(p, root)));
const binary = (p) => {
  const b = readFileSync(new URL(p, root));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
const models = {
  ...decodeCourseModels(json("assets/courses/models.json"), binary("assets/courses/models.bin")),
  ...decodeLivingModels(json("assets/living/index.json"), binary("assets/living/props.bin")),
};
const loader = new GLTFLoader();
loader.register((parser) => {
  parser.loadImageSource = async () => new THREE.Texture();
  return { name: "audit-images" };
});
const reports = [];
const output = process.env.PLAYTEST_OUTPUT || "/tmp/kart-review/geometry";
mkdirSync(output, { recursive: true });
for (const c of COURSES.filter(
  (c) => !process.argv.slice(2).length || process.argv.slice(2).includes(c.id),
)) {
  const assets = { models: { ...models } },
    base = "assets/courses/packs/" + c.id + "/";
  for (const e of json(base + "manifest.json").models) {
    const g = await loader.parseAsync(binary(base + e.file), "");
    assets.models[e.name] = normalizeCourseModel(g.scene);
  }
  const track = selectCourse(c),
    scene = new THREE.Scene();
  const textures = Object.fromEntries(
    [
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
    ].map((k) => [k, new THREE.Texture()]),
  );
  const materials = Object.fromEntries(
    ["grass", "road", "roadside", "rail", "white", "red", "black", "pine2", "trunk"].map((k) => [
      k,
      new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true }),
    ]),
  );
  const world = buildCourseWorld({
    scene,
    renderer: null,
    materials,
    textures,
    track,
    assets,
    sharedAssets: {},
  });
  for (const lap of c.id === "paper-revel" ? [0, 1, 2] : [0]) {
    world.update(5, { playerLap: lap, racers: [] });
    const r = auditRouteGeometry(scene, track, world.animated || [], lap);
    r.lap = lap;
    r.clearance = scene.userData.sceneryClearance;
    reports.push(r);
    console.log(
      JSON.stringify({
        course: c.id,
        lap,
        stations: r.stations,
        hits: r.hits.length,
        examples: r.hits.slice(0, 5),
      }),
    );
  }
  writeFileSync(
    `${output}/${c.id}.json`,
    JSON.stringify(
      reports.filter((r) => r.course === c.id),
      null,
      2,
    ),
  );
}

writeFileSync(`${output}/report.json`, JSON.stringify(reports, null, 2));
if (reports.some((r) => r.hits.length)) process.exitCode = 1;
