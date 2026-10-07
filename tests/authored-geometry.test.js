import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../vendor/three/three.module.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
import { normalizeCourseModel } from "../src/rendering/course-assets.js";
import { createAuthoredGeometryLibrary } from "../src/rendering/authored-geometry.js";
import { COURSES } from "../src/courses/registry.js";

test("authored parts fit translated animation pivots without mutating either input", () => {
  const source = new THREE.BoxGeometry(2, 3, 4);
  source.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(
      new Float32Array(source.attributes.position.count * 3).fill(0.8),
      3,
    ),
  );
  const original = source.attributes.position.array.slice();
  const model = new THREE.Group();
  const child = new THREE.Mesh(source);
  child.position.set(3, 4, 5);
  child.rotation.y = Math.PI / 4;
  model.add(child);
  model.scale.setScalar(0.1);
  const fit = createAuthoredGeometryLibrary({ part: model });
  const reference = new THREE.BoxGeometry(7, 8, 9).translate(3.5, 4, -2);
  const geometry = fit("part", reference);
  assert.equal(
    fit("part", { min: [0, 0, -6.5], max: [7, 8, 2.5] }),
    geometry,
    "declared bounds replace reference meshes without changing the fitted part",
  );
  reference.computeBoundingBox();
  for (const end of ["min", "max"])
    assert.ok(geometry.boundingBox[end].distanceTo(reference.boundingBox[end]) < 1e-5);
  assert.equal(fit("part", reference), geometry, "repeated parts share fitted geometry");
  assert.equal(fit("missing", reference), reference, "headless callers retain the fallback");
  const placeholder = fit("missing", [2, 3, 4]);
  assert.equal(fit("missing", [2, 3, 4]), placeholder, "headless placeholders share geometry");
  placeholder.computeBoundingBox();
  assert.deepEqual(placeholder.boundingBox.getSize(new THREE.Vector3()).toArray(), [2, 3, 4]);
  assert.deepEqual(source.attributes.position.array, original);
  for (const name of ["normal", "uv", "color"])
    assert.ok(geometry.attributes[name], `fitting preserves ${name}`);
  assert.ok(Math.abs(geometry.attributes.color.getX(0) - 0.8) < 1e-6);
});

async function sculptures() {
  const models = {};
  const loader = new GLTFLoader();
  for (const course of COURSES) {
    const base = new URL(`../assets/courses/packs/${course.id}/`, import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL("manifest.json", base)));
    for (const entry of manifest.models.filter((entry) => entry.name.startsWith("blender:"))) {
      const bytes = readFileSync(new URL(entry.file, base));
      const loaded = await loader.parseAsync(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        "",
      );
      models[entry.name] = normalizeCourseModel(loaded.scene);
    }
  }
  return models;
}

test("Blender sculptures retain finite shading and actual hollow openings after runtime fitting", async () => {
  const models = await sculptures();
  const fit = createAuthoredGeometryLibrary(models);
  for (const name of Object.keys(models)) {
    const geometry = fit(name, new THREE.BoxGeometry());
    for (const attribute of ["position", "normal", "uv", "color"]) {
      const data = geometry.getAttribute(attribute);
      assert.ok(data?.count > 0, `${name}: missing ${attribute}`);
      assert.ok(Array.from(data.array).every(Number.isFinite), `${name}: invalid ${attribute}`);
    }
    assert.ok(geometry.attributes.position.count / 3 < 5000, `${name}: detail budget`);
  }
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const cast = (name, reference, origin, direction) => {
    const object = new THREE.Mesh(fit(name, reference), material);
    object.updateMatrixWorld();
    return new THREE.Raycaster(
      new THREE.Vector3(...origin),
      new THREE.Vector3(...direction),
    ).intersectObject(object);
  };
  for (const teeth of [16, 20, 28])
    assert.equal(
      cast(`blender:gear-${teeth}`, new THREE.BoxGeometry(), [0, 0, 2], [0, 0, -1]).length,
      0,
      "gear axle bore stays open",
    );
  assert.equal(
    cast("blender:freight-pipe", new THREE.CylinderGeometry(), [0, 2, 0], [0, -1, 0]).length,
    0,
    "cargo pipe is hollow end to end",
  );
  const cupHits = cast("blender:ceramic-cup", new THREE.CylinderGeometry(), [0, 2, 0], [0, -1, 0]);
  assert.ok(cupHits.length > 0 && cupHits[0].point.y < -0.25, "cup has a recessed inner floor");
});
