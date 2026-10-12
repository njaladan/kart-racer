import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as THREE from "../vendor/three/three.module.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
import { normalizeCourseModel } from "../src/rendering/course-assets.js";

const folder = new URL("../assets/courses/packs/windmill-wilds/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", folder)));
const trees = manifest.models.filter(({ name }) => name.startsWith("meadow:tree-"));

export async function loadMeadowTrees() {
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
