import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import course from "../src/courses/windmill-wilds.js";
import { selectCourse } from "../src/track/track.js";
import { buildMeadowGrass } from "../src/courses/windmill-wilds/meadow-grass.js";
import { sceneryGroundHeight } from "../src/rendering/terrain-height.js";
import { loadPreferences, savePreferences } from "../src/ui/preferences.js";

test("living meadow grass stays off driving surfaces, follows terrain and has a bounded draw budget", () => {
  const scene = new THREE.Scene(),
    scenery = new THREE.Group();
  scene.add(scenery);
  const track = selectCourse(course);
  const meadow = buildMeadowGrass({ scene, scenery, track });
  assert.ok(
    meadow.locations.length > 12000 && meadow.locations.length < 35000,
    `dense valley coverage stays within its instance budget (${meadow.locations.length})`,
  );
  assert.ok(meadow.meshes.length < 160, "regional instances keep grass draw objects bounded");
  const sections = new Set();
  const lake = track.poseAt(track.sectorT(3, 0.38) * track.TRACK, 39, 0).p;
  for (const p of meadow.locations) {
    const surface = track.projectTrack(p, 0, true);
    sections.add(track.SECTIONS.findIndex((s) => surface.t >= s.start && surface.t < s.end));
    assert.ok(
      ((p.x - lake.x) / 66) ** 2 + ((p.z - lake.z) / 54) ** 2 >= 1,
      "open water stays clear",
    );
    const edge = surface.offset > 0 ? surface.rightEdge : -surface.leftEdge;
    assert.ok(
      surface.distance >= edge + 0.7 - 1e-5,
      "grass does not cover the racing/verge surface",
    );
    assert.ok(Math.abs(p.y - sceneryGroundHeight(surface) + 0.025) < 1e-5);
    for (const branch of track.branches)
      assert.ok(branch.project(p, 0, true).distance >= branch.halfWidth + 1);
  }
  for (const section of [0, 1, 2, 4, 5, 6, 7])
    assert.ok(sections.has(section), `living grass reaches section ${section}`);
  for (const mesh of meadow.meshes) {
    assert.equal(mesh.castShadow, false);
    assert.equal(mesh.userData.skipBake, true);
    assert.ok(Array.from(mesh.instanceMatrix.array).every(Number.isFinite));
    assert.ok(Number.isFinite(mesh.boundingSphere.radius));
  }
  const full = meadow.meshes.reduce((n, mesh) => n + mesh.count, 0);
  meadow.setQuality(0);
  const low = meadow.meshes.reduce((n, mesh) => n + mesh.count, 0);
  assert.ok(low < full * 0.4);
  meadow.setQuality(3);
  assert.equal(
    meadow.meshes.reduce((n, mesh) => n + mesh.count, 0),
    full,
  );
  meadow.update(12);
  assert.equal(meadow.uniforms.meadowTime.value, 12);
  meadow.update(12);
  assert.equal(meadow.uniforms.meadowTime.value, 12, "pause repeats the same phase");
  meadow.update(0);
  assert.equal(meadow.uniforms.meadowTime.value, 0);
  meadow.update(15, { motionEnabled: false });
  assert.equal(meadow.uniforms.meadowTime.value, 0);
  const map = new THREE.Texture();
  scene.userData.courseBakeUniforms = {
    courseBakeMap: { value: map },
    courseBakeBounds: { value: new THREE.Vector4(-200, -200, 400, 400) },
    courseBakeEnabled: { value: 1 },
  };
  meadow.update(1);
  assert.equal(meadow.uniforms.meadowBakeMap.value, map);
  assert.equal(meadow.uniforms.meadowBakeEnabled.value, 1);
  scene.userData.courseBakeUniforms.courseBakeEnabled.value = 0;
  meadow.update(1);
  assert.equal(meadow.uniforms.meadowBakeEnabled.value, 0);
});

test("contact-shading preference persists and rejects invalid stored values", () => {
  const storage = {
    data: '{"ambientOcclusion":"false"}',
    getItem() {
      return this.data;
    },
    setItem(_key, value) {
      this.data = value;
    },
  };
  assert.equal(loadPreferences(storage).ambientOcclusion, true);
  savePreferences({ ...loadPreferences(storage), ambientOcclusion: false }, storage);
  assert.equal(loadPreferences(storage).ambientOcclusion, false);
});
