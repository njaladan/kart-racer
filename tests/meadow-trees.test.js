import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as THREE from "../vendor/three/three.module.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
import { normalizeCourseModel } from "../src/rendering/course-assets.js";
import { prepareWindmillTreeAssets } from "../src/courses/windmill-wilds/tree-palette.js";
import { buildWindmillTreeGroves } from "../src/courses/windmill-wilds/tree-groves.js";
import { createCourseKit, batchScenery } from "../src/rendering/course-kit.js";
import { createSceneryDetailController } from "../src/rendering/scenery-lod.js";
import { selectCourse } from "../src/track/track.js";
import course from "../src/courses/windmill-wilds.js";
import { sceneryGroundHeight } from "../src/rendering/terrain-height.js";

const folder = new URL("../assets/courses/packs/windmill-wilds/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", folder)));
const trees = manifest.models.filter(({ name }) => name.startsWith("meadow:tree-"));

async function loadMeadowTrees() {
  const models = {};
  const loader = new GLTFLoader();
  for (const entry of trees) {
    const bytes = readFileSync(new URL(entry.file, folder));
    const loaded = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
    models[entry.name] = normalizeCourseModel(loaded.scene);
  }
  return { models };
}

test("the seven fixed tree assets retain pinned CC0 sources and fit a small opaque geometry budget", async () => {
  assert.equal(trees.length, 7);
  assert.equal(new Set(trees.map(({ author }) => author)).size, 2);
  const { models } = await loadMeadowTrees();
  for (const entry of trees) {
    const bytes = readFileSync(new URL(entry.file, folder));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256);
    assert.equal(bytes.length, entry.bytes);
    assert.equal(entry.license, "CC0-1.0");
    assert.ok(readFileSync(new URL(entry.licenseEvidence, folder)).length > 0);
    assert.equal(entry.fixedDetail, true);
    assert.equal(entry.lods, undefined);
    assert.ok(entry.triangles > 0 && entry.triangles <= 1000);
    assert.ok(
      entry.downloads.every(
        ({ url, sha256 }) => /\/[a-f0-9]{40}\//.test(url) && /^[a-f0-9]{64}$/.test(sha256),
      ),
    );
    const bounds = new THREE.Box3().setFromObject(models[entry.name]);
    assert.ok(Math.abs(bounds.min.y) < 1e-5);
    assert.ok(Math.abs(bounds.getSize(new THREE.Vector3()).y - 1) < 1e-5);
    models[entry.name].traverse((part) => {
      if (!part.isMesh) return;
      assert.ok(Array.from(part.geometry.attributes.position.array).every(Number.isFinite));
      assert.ok(part.geometry.attributes.color?.count > 0);
      assert.equal(part.material.map, null);
      assert.equal(part.material.transparent, false);
      assert.equal(part.material.alphaTest, 0);
    });
  }
});

test("fixed tree aliases ignore old far models and retain their meshes across camera distances and tiers", async () => {
  const assets = prepareWindmillTreeAssets(await loadMeadowTrees());
  // Old source aliases had implicit '-far' variants. Even with one present,
  // the fixed low-poly oak must never turn into that variant or a billboard.
  assets.models["windmill:oak-far"] = new THREE.Group();
  assets.models["windmill:oak-far"].add(
    new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()),
  );
  const scene = new THREE.Scene(),
    scenery = new THREE.Group();
  scene.add(scenery);
  const kit = createCourseKit(scenery, selectCourse(course), assets);
  for (const name of [
    "windmill:oak",
    "windmill:fir",
    "windmill:orchard",
    "windmill:willow",
    ...trees.map(({ name }) => name),
  ])
    kit.asset(name, scenery, [0, 0, 0], [6, 6, 6]);
  const detail = createSceneryDetailController(scene);
  const meshes = [];
  scene.traverse((object) => {
    assert.equal(object.isLOD, undefined);
    if (object.isMesh) meshes.push({ object, geometry: object.geometry, visible: object.visible });
  });
  for (const tier of [0, 1, 2, 3]) {
    detail.setQuality(tier);
    for (const distance of [0, 40, 95, 210, 600, 1200]) {
      detail.updateCamera(new THREE.Vector3(distance, 10, 0));
      for (const { object, geometry, visible } of meshes) {
        assert.equal(object.geometry, geometry);
        assert.equal(object.visible, visible);
        assert.equal(object.material.transparent, false);
        assert.equal(object.material.userData.skipSurfaceDetail, true);
      }
    }
  }
});

test("meadow groves vary species and size while keeping full tree footprints off roads and shortcuts", async () => {
  const assets = prepareWindmillTreeAssets(await loadMeadowTrees());
  const scene = new THREE.Scene(),
    scenery = new THREE.Group();
  scene.add(scenery);
  const track = selectCourse(course),
    kit = createCourseKit(scenery, track, assets);
  const { groves, placements } = buildWindmillTreeGroves({ scene, scenery, track, kit, assets });
  assert.ok(placements.length > 90 && placements.length < 250);
  assert.ok(new Set(placements.map(({ name }) => name)).size === 7);
  assert.ok(new Set(placements.map(({ height }) => height.toFixed(1))).size > 20);
  assert.equal(groves.filter(({ section }) => section === 0).length, 8);
  assert.ok(placements.filter(({ section }) => section === 0).every(({ height }) => height < 9));
  for (const { position, radius, fraction } of placements) {
    const surface = track.projectTrack(position, fraction * track.TRACK, true);
    const edge = surface.offset > 0 ? surface.rightEdge : -surface.leftEdge;
    assert.ok(surface.distance > edge + radius + 1);
    assert.ok(Math.abs(position.y - sceneryGroundHeight(surface)) < 0.01);
    for (const branch of track.branches)
      assert.ok(branch.project(position, fraction, true).distance > branch.halfWidth + radius + 2);
  }
  batchScenery(scenery);
  const detail = createSceneryDetailController(scene);
  let triangles = 0,
    meshes = 0;
  scene.traverse((object) => {
    assert.equal(object.isLOD, undefined);
    if (!object.isMesh) return;
    meshes++;
    triangles +=
      ((object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3) *
      (object.isInstancedMesh ? object.count : 1);
  });
  assert.ok(meshes < 100);
  assert.ok(triangles < 160000);
  detail.updateCamera(new THREE.Vector3(800, 100, 800));
});
