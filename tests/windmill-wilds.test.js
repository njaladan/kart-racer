import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../vendor/three/three.module.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
import { normalizeCourseModel, decodeCourseModels } from "../src/rendering/course-assets.js";
import { buildWindmillWorld } from "../src/courses/windmill-wilds/world.js";
import { selectCourse } from "../src/track/track.js";
import course from "../src/courses/windmill-wilds.js";

async function loadArt() {
  const base = new URL("../assets/courses/packs/windmill-wilds/", import.meta.url);
  const spec = JSON.parse(readFileSync(new URL("manifest.json", base)));
  const raw = readFileSync(new URL("../assets/courses/models.bin", import.meta.url));
  const index = JSON.parse(readFileSync(new URL("../assets/courses/models.json", import.meta.url)));
  const models = decodeCourseModels(
    index,
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
  );
  const loader = new GLTFLoader();
  loader.register(() => ({
    name: "headless-textures",
    loadTexture: () => Promise.resolve(new THREE.Texture()),
  }));
  for (const entry of spec.models) {
    const bytes = readFileSync(new URL(entry.file, base));
    const loaded = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
    models[entry.name] = normalizeCourseModel(loaded.scene);
  }
  return { models };
}

test("Windmill authored scenery retains real UVs, cutout leaves and baked architectural AO", async () => {
  const { models } = await loadArt();
  for (const name of ["fir", "oak", "orchard", "farmhouse", "cottage", "boat", "stone-wall"])
    assert.ok(models[`windmill:${name}`], `${name} missing`);
  let cutouts = 0,
    occluded = 0;
  for (const name of ["fir", "oak", "orchard", "farmhouse"])
    models[`windmill:${name}`].traverse((m) => {
      if (!m.isMesh) return;
      const uv = m.geometry.getAttribute("uv");
      assert.ok(uv && uv.count > 0);
      assert.ok(Array.from(uv.array).every(Number.isFinite));
      if (m.material.alphaTest > 0.4) cutouts++;
      if (name === "farmhouse") {
        const c = m.geometry.getAttribute("color");
        // GLTFLoader preserves normalized U16 color buffers; inspect through
        // the attribute accessor so the normalized shader value is measured.
        if (c && Array.from({ length: c.count }, (_, i) => c.getX(i)).some((x) => x < 0.94))
          occluded++;
      }
    });
  assert.ok(cutouts >= 3, "foliage must use alpha-tested authored silhouettes");
  assert.ok(occluded > 0, "farmhouse needs the real offline obstruction bake");
});

test("Windmill upgraded world is finite and its animations are deterministic on pause", async () => {
  const track = selectCourse(course),
    scene = new THREE.Scene();
  const names = ["grass", "road", "roadside", "rail", "white", "red", "black", "pine2", "trunk"];
  const materials = Object.fromEntries(names.map((n) => [n, new THREE.MeshStandardMaterial()]));
  const textures = Object.fromEntries(
    ["wood", "brick", "roof", "leaves", "rock", "needles", "gravel", "water"].map((n) => [
      n,
      new THREE.Texture(),
    ]),
  );
  const world = buildWindmillWorld({
    scene,
    renderer: null,
    materials,
    textures,
    track,
    assets: await loadArt(),
  });
  for (const t of [0, 30, 31, 35, 40]) world.update(t);
  world.update(12.5);
  scene.updateMatrixWorld(true);
  const snapshot = [];
  scene.traverse((o) => snapshot.push([...o.matrixWorld.elements]));
  world.update(12.5);
  scene.updateMatrixWorld(true);
  let i = 0;
  scene.traverse((o) => {
    assert.deepEqual([...o.matrixWorld.elements], snapshot[i++]);
    if (o.isMesh)
      for (const a of Object.values(o.geometry.attributes))
        assert.ok(Array.from(a.array).every(Number.isFinite));
  });
  assert.ok(scene.getObjectByName("Authored iron windmill rotor"));
  assert.ok(track.minimumCurveRadius >= 40);
});
