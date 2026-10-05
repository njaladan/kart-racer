import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as THREE from "../vendor/three/three.module.js";
import { decodeLivingModels } from "../src/rendering/living-assets.js";
import { COURSES } from "../src/courses/registry.js";
import { selectCourse } from "../src/track/track.js";
import { addDetailedScenery } from "../src/rendering/detailed-scenery.js";

const base = new URL("../assets/living/", import.meta.url);
const index = JSON.parse(readFileSync(new URL("index.json", base)));
const bytes = readFileSync(new URL("props.bin", base));
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

test("downloaded material and prop outputs match recorded sources and hashes", () => {
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", base)));
  assert.equal(manifest.sources.length, 13);
  assert.ok(
    manifest.sources.every(
      (s) => s.license === "CC0-1.0" && s.evidence.startsWith("https://raw.githubusercontent.com/"),
    ),
  );
  for (const out of manifest.outputs) {
    const data = readFileSync(new URL(out.path, base));
    assert.equal(data.length, out.bytes, out.path);
    assert.equal(createHash("sha256").update(data).digest("hex"), out.sha256, out.path);
  }
  assert.equal(Object.keys(index.textures).length, 10);
  for (const material of Object.values(index.textures))
    assert.ok(material.color && material.normal && material.roughness);
});

test("textured imported props preserve UVs, finite rooted geometry and batch into every course", () => {
  const models = decodeLivingModels(index, buffer);
  for (const model of Object.values(models)) {
    const box = new THREE.Box3().setFromObject(model);
    assert.ok(Math.abs(box.min.y) < 1e-5);
    let variedUV = false;
    model.traverse((m) => {
      if (!m.isMesh) return;
      const uv = m.geometry.attributes.uv;
      assert.equal(uv.count, m.geometry.attributes.position.count);
      variedUV ||= Array.from(uv.array).some((v) => v !== 0);
      for (const attribute of Object.values(m.geometry.attributes))
        assert.ok(Array.from(attribute.array).every(Number.isFinite));
    });
    assert.ok(variedUV, "downloaded photographic texture must retain its original UV mapping");
  }
  for (const course of COURSES) {
    const scene = new THREE.Scene(),
      track = selectCourse(course);
    addDetailedScenery(scene, track, { models });
    let meshes = 0;
    scene.traverse((m) => {
      if (m.isMesh) meshes++;
    });
    assert.ok(meshes >= 1 && meshes <= 32, `${course.id}: imported props remain region-batched`);
    scene.updateMatrixWorld(true);
    scene.traverse((m) => assert.ok(m.matrixWorld.elements.every(Number.isFinite)));
  }
});
