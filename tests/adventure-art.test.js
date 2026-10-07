import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as THREE from "../vendor/three/three.module.js";
import { ADVENTURE_ART, buildAdventureArt } from "../src/courses/fidelity/index.js";
import { COURSES } from "../src/courses/registry.js";
import { selectCourse } from "../src/track/track.js";
import { createCourseKit } from "../src/rendering/course-kit.js";

test("six adventure packs have local licensed models and matched color/normal/roughness scans", () => {
  assert.equal(Object.keys(ADVENTURE_ART).length, 6);
  for (const id of Object.keys(ADVENTURE_ART)) {
    const base = new URL(`../assets/courses/packs/${id}/`, import.meta.url);
    const pack = JSON.parse(readFileSync(new URL("manifest.json", base)));
    assert.ok(pack.models.length >= 5, id);
    const textures = new Set(pack.textures.map((entry) => entry.name));
    for (const entry of [...pack.models, ...pack.textures]) {
      assert.ok(["CC0-1.0", "CC-BY-SA-3.0", "CC-BY-SA-4.0"].includes(entry.license));
      if (entry.license.startsWith("CC-BY"))
        assert.ok(readFileSync(new URL(entry.attribution, base)).length);
      const bytes = readFileSync(new URL(entry.file, base));
      assert.equal(bytes.length, entry.bytes, entry.file);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, entry.file);
      if (entry.colorSpace === "srgb") {
        assert.ok(textures.has(`${entry.name}Normal`), entry.name);
        assert.ok(textures.has(`${entry.name}Roughness`), entry.name);
      }
    }
  }
});

test("ambient art obeys quality and reduced motion without changing the route", () => {
  for (const id of Object.keys(ADVENTURE_ART)) {
    const course = COURSES.find((c) => c.id === id);
    const track = selectCourse(course);
    const scene = new THREE.Scene();
    const kit = createCourseKit(new THREE.Group(), track);
    const art = buildAdventureArt({ scene, track, kit });
    assert.ok(art.animated.length > 10, id);
    const fields = [];
    art.scenery.traverse((object) => {
      if (object.isPoints) fields.push(object);
    });
    assert.equal(fields.length, 2, id);
    art.setQuality(3);
    const capacity = fields.map((field) => field.geometry.drawRange.count);
    art.setQuality(0);
    fields.forEach((field, i) => assert.ok(field.geometry.drawRange.count < capacity[i]));
    art.update(17);
    const clocks = fields.map((field) => field.material.uniforms.clock.value);
    assert.deepEqual(clocks, [17, 17]);
    art.update(80, { motionEnabled: false });
    fields.forEach((field) => assert.equal(field.material.uniforms.clock.value, 0));
    art.setQuality(3);
    fields.forEach((field, i) => assert.equal(field.geometry.drawRange.count, capacity[i]));
    art.update(0);
    scene.updateMatrixWorld(true);
    scene.traverse((object) => assert.ok(object.matrixWorld.elements.every(Number.isFinite), id));
  }
});
