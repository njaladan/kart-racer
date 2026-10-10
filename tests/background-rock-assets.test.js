import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../vendor/three/three.module.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
import { createAuthoredGeometryLibrary } from "../src/rendering/authored-geometry.js";

test("downloaded rounded rocks remain closed shells rather than disconnected smoothed faces", async () => {
  const base = new URL("../assets/courses/packs/tempest-causeway/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", base)));
  const rocks = manifest.models.filter((model) => model.name.startsWith("background:rock-"));
  assert.equal(rocks.length, 4);
  const loader = new GLTFLoader();
  loader.register((parser) => {
    parser.loadImageSource = async () => new THREE.Texture();
    return { name: "test-texture-decoder" };
  });
  for (const model of rocks) {
    const raw = readFileSync(new URL(model.file, base));
    const gltf = await loader.parseAsync(
      raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
      "",
    );
    const geometry = createAuthoredGeometryLibrary({ [model.name]: gltf.scene })(model.name);
    const p = geometry.attributes.position,
      edges = new Map();
    const vertex = (index) =>
      [p.getX(index), p.getY(index), p.getZ(index)]
        .map((value) => Math.round(value * 1e6))
        .join(",");
    for (let i = 0; i < p.count; i += 3) {
      const points = [vertex(i), vertex(i + 1), vertex(i + 2)];
      for (let j = 0; j < 3; j++) {
        const key = [points[j], points[(j + 1) % 3]].sort().join("|");
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    assert.ok(
      // Upstream rocks can contain internal caps; require a covered edge,
      // rather than an open boundary around every smoothed source face.
      [...edges.values()].every((count) => count >= 2),
      `${model.name}: open rock shell`,
    );
    assert.ok(p.array.every(Number.isFinite));
    assert.ok(p.count < 15000, `${model.name}: keep distant triangle cost bounded`);
  }
});
