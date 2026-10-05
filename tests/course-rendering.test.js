import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as THREE from "../vendor/three/three.module.js";
import { decodeCourseModels, normalizeCourseModel } from "../course-assets.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
import { createCourseKit } from "../course-kit.js";
import { buildCourseWorld } from "../course-runtime.js";
import { COURSES } from "../courses/registry.js";
import { selectCourse } from "../track.js";
import { batchStaticMeshes } from "../visuals.js";

async function assets(courseId) {
  const raw = readFileSync(
    new URL("../assets/courses/models.bin", import.meta.url),
  );
  const data = raw.buffer.slice(
    raw.byteOffset,
    raw.byteOffset + raw.byteLength,
  );
  const result = {
    models: decodeCourseModels(
      JSON.parse(
        readFileSync(new URL("../assets/courses/models.json", import.meta.url)),
      ),
      data,
    ),
  };
  const base = new URL(`../assets/courses/packs/${courseId}/`, import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", base)));
  const loader = new GLTFLoader();
  // Node has no image decoder. Parse the real model geometry and materials,
  // replacing only texture decoding; browser smoke checks cover actual images.
  loader.register(() => ({
    name: "test-texture-decoder",
    loadTexture: () => Promise.resolve(new THREE.Texture()),
  }));
  for (const entry of manifest.models) {
    const rawModel = readFileSync(new URL(entry.file, base));
    const buffer = rawModel.buffer.slice(rawModel.byteOffset, rawModel.byteOffset + rawModel.byteLength);
    const gltf = await loader.parseAsync(buffer, "");
    result.models[entry.name] = normalizeCourseModel(gltf.scene);
  }
  return result;
}

test("static batching preserves colored geometry even when handmade props have no UVs", () => {
  const group = new THREE.Group(),
    material = new THREE.MeshStandardMaterial({ vertexColors: true });
  for (let i = 0; i < 2; i++) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    );
    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(
        [0.8, 0.4, 0.2, 0.9, 0.5, 0.3, 1, 0.6, 0.4],
        3,
      ),
    );
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = i * 3;
    group.add(mesh);
  }
  batchStaticMeshes(group);
  assert.equal(group.children.length, 1);
  assert.equal(group.children[0].geometry.getAttribute("position").count, 6);
  assert.equal(group.children[0].geometry.getAttribute("uv").count, 6);
  assert.ok(
    Math.abs(group.children[0].geometry.getAttribute("color").getX(0) - 0.8) <
      1e-6,
  );
});

test("all asset-backed scenery assembles and stays finite while each hazard moves", async () => {
  for (const course of COURSES) {
    const track = selectCourse(course),
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
    const mats = Object.fromEntries(
      [
        "grass",
        "road",
        "roadside",
        "rail",
        "white",
        "red",
        "black",
        "pine2",
        "trunk",
      ].map((k) => [k, new THREE.MeshStandardMaterial({ color: "#ffffff" })]),
    );
    const world = buildCourseWorld({
      scene,
      renderer: null,
      materials: mats,
      textures,
      track,
      assets: await assets(course.id),
      sharedAssets: {},
    });
    let meshes = 0;
    scene.traverse((object) => {
      if (!object.isMesh) return;
      meshes++;
      for (const attribute of Object.values(object.geometry.attributes))
        assert.ok(
          Array.from(attribute.array).every(Number.isFinite),
          `${course.id}: invalid attribute`,
        );
    });
    // Holiday models add distinct authored palette materials; keep their
    // batching budget bounded while retaining each variant's material colors.
    const meshBudget = course.id === "windmill-wilds" ? 170 : course.id === "frostpeak-festival" ? 100 : 75;
    assert.ok(
      meshes < meshBudget,
      `${course.id}: ${meshes} unbatched scenery meshes`,
    );
    for (const time of [0, 30, 31, 35, 40, 42]) world.update(time);
    scene.updateMatrixWorld(true);
    scene.traverse((object) =>
      assert.ok(object.matrixWorld.elements.every(Number.isFinite)),
    );
  }
});

test("placing imported scenery preserves its normalized height and ground pivot", async () => {
  const imported = await assets("windmill-wilds");
  const scenery = new THREE.Group();
  const kit = createCourseKit(scenery, {}, imported);
  const tree = kit.asset("kenney:nature/tree-oak", scenery, [7, 3, -2], [8, 8, 8]);
  const bounds = new THREE.Box3().setFromObject(tree);
  assert.ok(Math.abs(bounds.min.y - 3) < 1e-5);
  assert.ok(Math.abs(bounds.max.y - bounds.min.y - 8) < 1e-5);
  assert.ok(Math.abs((bounds.min.x + bounds.max.x) / 2 - 7) < 1e-5);
  assert.ok(Math.abs((bounds.min.z + bounds.max.z) / 2 + 2) < 1e-5);
});

// Pin the actual runtime bundle to the source/license manifest.
test("bundled course assets match their recorded sizes and SHA-256 digests", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../assets/courses/manifest.json", import.meta.url)),
  );
  for (const output of manifest.outputs) {
    const data = readFileSync(
      new URL(`../assets/courses/${output.path}`, import.meta.url),
    );
    assert.equal(data.length, output.bytes, output.path);
    assert.equal(
      createHash("sha256").update(data).digest("hex"),
      output.sha256,
      output.path,
    );
  }
  for (const pack of ["shared", ...COURSES.map(course => course.id)]) {
    const base = new URL(`../assets/courses/packs/${pack}/`, import.meta.url);
    const packManifest = JSON.parse(readFileSync(new URL("manifest.json", base)));
    const outputs = packManifest.sources ?? packManifest.models;
    for (const output of outputs) {
      const data = readFileSync(new URL(output.file, base));
      assert.equal(data.length, output.bytes, `${pack}/${output.file}`);
      assert.equal(createHash("sha256").update(data).digest("hex"), output.sha256, `${pack}/${output.file}`);
    }
  }
});
