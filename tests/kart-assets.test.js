import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../vendor/three/three.module.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
import { normalizeCourseModel } from "../src/rendering/course-assets.js";
import { createKartBuilder } from "../src/rendering/kart-builder.js";
import { RACERS, raceRoster } from "../src/rendering/racer-roster.js";

async function loadRacers() {
  const base = new URL("../assets/courses/packs/shared/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", base)));
  const loader = new GLTFLoader();
  loader.register(() => ({
    name: "test-texture-decoder",
    loadTexture: () => Promise.resolve(new THREE.Texture()),
  }));
  const models = {};
  for (const entry of manifest.models) {
    const raw = readFileSync(new URL(entry.file, base));
    const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    const jsonLength = new DataView(buffer).getUint32(12, true);
    const gltfJson = JSON.parse(new TextDecoder().decode(buffer.slice(20, 20 + jsonLength)));
    assert.ok(gltfJson.images.length > 0, `${entry.racer}: authored textures`);
    assert.ok(gltfJson.images.every((image) => image.bufferView != null && !image.uri));
    assert.equal(entry.racer, RACERS.find((racer) => entry.name === `stk-kart-${racer.id}`).name);
    assert.ok(readFileSync(new URL(entry.attribution, base)).length > 0);
    const gltf = await loader.parseAsync(buffer, "");
    models[entry.name] = normalizeCourseModel(gltf.scene);
  }
  return models;
}

test("each selection produces six unique racers with the selected player first", () => {
  for (const racer of RACERS) {
    const roster = raceRoster(racer.id);
    assert.equal(roster[0], racer);
    assert.equal(new Set(roster.map((entry) => entry.id)).size, 6);
  }
  assert.equal(raceRoster("unknown")[0].id, "tux");
  assert.equal(raceRoster(null)[0].id, "tux");
});

test("real textured racers preserve proportions, grounded bounds and independent wheel transforms", async () => {
  const models = await loadRacers();
  const build = createKartBuilder({
    scene: new THREE.Scene(),
    models,
    textures: {},
    shadowTexture: null,
  });
  for (const racer of RACERS) {
    const first = build(racer.color, racer.name, true, racer.id);
    const second = build(racer.color, racer.name, false, racer.id);
    const bounds = new THREE.Box3().setFromObject(first.bodyGroup);
    const size = bounds.getSize(new THREE.Vector3());
    assert.ok(Math.abs(bounds.min.y) < 1e-5, `${racer.id}: wheels meet the ground`);
    assert.ok(size.x <= 2.65 && size.y <= 2.61 && size.z <= 3.41);
    assert.equal(first.bodyGroup.scale.x, first.bodyGroup.scale.y);
    assert.equal(first.bodyGroup.scale.y, first.bodyGroup.scale.z);
    assert.equal(first.wheels.length, 4);
    assert.equal(first.wheels.filter((wheel) => wheel.front).length, 2);
    for (const [index, wheel] of first.wheels.entries()) {
      const originalCenter = wheel.pivot.getWorldPosition(new THREE.Vector3());
      const originalSpin = second.wheels[index].spin.rotation.x;
      assert.notEqual(wheel.pivot, wheel.spin);
      assert.ok(wheel.radius > 0.2 && wheel.radius < 0.5);
      wheel.pivot.rotation.y = 0.3;
      wheel.spin.rotation.x = 4.2;
      first.root.updateMatrixWorld(true);
      assert.ok(
        wheel.pivot.getWorldPosition(new THREE.Vector3()).distanceTo(originalCenter) < 1e-6,
      );
      assert.equal(second.wheels[index].spin.rotation.x, originalSpin);
    }
    let firstMaterial;
    first.bodyGroup.traverse((part) => {
      if (part.isMesh) firstMaterial ??= part.material;
    });
    let secondMaterial;
    second.bodyGroup.traverse((part) => {
      if (part.isMesh) secondMaterial ??= part.material;
    });
    assert.notEqual(firstMaterial, secondMaterial);
    assert.throws(
      () => build(racer.color, racer.name, false, "missing"),
      /Missing shared racer model/,
    );
  }
});
