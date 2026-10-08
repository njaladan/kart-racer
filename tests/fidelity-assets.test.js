import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as THREE from "../vendor/three/three.module.js";
import { createAssetInstances } from "../src/rendering/asset-instances.js";
import { batchSceneryLods } from "../src/rendering/scenery-lod.js";
import {
  installScannedMaterials,
  scannedMaterialKind,
} from "../src/rendering/scanned-materials.js";
import { HERO_SITES } from "../src/rendering/hero-scenery.js";
import { COURSES } from "../src/courses/registry.js";

const folder = new URL("../assets/fidelity/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", folder)));

test("downloaded PBR artwork and scan maps have pinned sources, retained licenses and verified outputs", () => {
  assert.ok(manifest.heroes.length >= 8);
  assert.equal(manifest.materials.length, 16);
  assert.ok(manifest.materials.filter((role) => role.heightSource).length >= 10);
  for (const source of [...manifest.heroes, ...manifest.sources]) {
    assert.ok(["CC0-1.0", "CC-BY-4.0"].includes(source.license));
    assert.ok(readFileSync(new URL(source.attribution || source.evidence, folder)).length > 0);
    assert.ok(
      source.downloads.every(
        (entry) =>
          entry.url.includes("raw.githubusercontent.com/") &&
          /\/[a-f0-9]{40}\//.test(entry.url) &&
          /^[a-f0-9]{64}$/.test(entry.sha256),
      ),
    );
  }
  for (const output of manifest.outputs) {
    const data = readFileSync(new URL(output.file, folder));
    assert.equal(data.length, output.bytes, output.file);
    assert.equal(createHash("sha256").update(data).digest("hex"), output.sha256, output.file);
  }
  for (const course of COURSES)
    assert.ok(
      HERO_SITES[course.id].some(([key]) =>
        manifest.heroes.some((hero) => hero.key === key && hero.courses.includes(course.id)),
      ),
    );
});

test("hero LODs retain authored UVs and share external mipmapped GPU textures", () => {
  for (const hero of manifest.heroes) {
    const [near, mid, far] = hero.variants;
    assert.ok(near.triangles >= mid.triangles && mid.triangles >= far.triangles);
    assert.ok(near.triangles < 55000 && far.triangles < near.triangles * 0.5);
    let imageUris;
    for (const variant of hero.variants) {
      const model = JSON.parse(readFileSync(new URL(variant.file, folder)));
      const fallback = JSON.parse(readFileSync(new URL(variant.offlineFile, folder)));
      assert.ok(model.extensionsRequired.includes("KHR_texture_basisu"));
      assert.equal(model.accessors.length, fallback.accessors.length);
      for (const mesh of model.meshes)
        for (const primitive of mesh.primitives) {
          assert.ok(primitive.attributes.NORMAL !== undefined);
          assert.ok(primitive.attributes.TEXCOORD_0 !== undefined);
        }
      const uris = model.images.map((image) => image.uri).sort();
      if (imageUris) assert.deepEqual(uris, imageUris);
      imageUris = uris;
      for (const image of model.images) {
        const bytes = readFileSync(new URL(image.uri, new URL(variant.file, folder)));
        assert.equal(bytes.subarray(0, 12).toString("hex"), "ab4b5458203230bb0d0a1a0a");
        assert.ok(bytes.readUInt32LE(40) > 1, "KTX2 contains mipmaps");
      }
    }
  }
});

function library() {
  return {
    atlases: {
      color: new THREE.Texture(),
      normal: new THREE.Texture(),
      response: new THREE.Texture(),
    },
    materials: manifest.materials,
    quality: { value: 1 },
  };
}

test("scan coverage preserves artist maps and glass, composes shader hooks, and gives moving props local detail", () => {
  const scene = new THREE.Scene();
  const moving = new THREE.Group();
  scene.add(moving);
  const bare = new THREE.MeshStandardMaterial({ color: "#dbb277", metalness: 0.5 });
  const paintedMap = new THREE.Texture();
  const painted = new THREE.MeshStandardMaterial({ map: paintedMap });
  paintedMap.userData.surfaceKind = "gravel";
  assert.equal(
    scannedMaterialKind(painted),
    "stone",
    "surface identity takes precedence over a brown palette",
  );
  const artistNormal = new THREE.Texture();
  const authored = new THREE.MeshStandardMaterial({ map: paintedMap, normalMap: artistNormal });
  const glass = new THREE.MeshPhysicalMaterial({ transparent: true, opacity: 0.2 });
  let originalHook = false;
  bare.onBeforeCompile = () => {
    originalHook = true;
  };
  for (const material of [bare, painted, authored, glass])
    moving.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
  const scans = library();
  const unhookedBare = new THREE.MeshStandardMaterial();
  moving.add(new THREE.Mesh(new THREE.BoxGeometry(), unhookedBare));
  assert.deepEqual(installScannedMaterials(scene, scans, "clockwork-citadel", [moving]), {
    covered: 3,
    retained: 2,
  });
  assert.equal(painted.map, paintedMap);
  assert.equal(authored.normalMap, artistNormal);
  assert.equal(glass.map, null);
  assert.equal(bare.userData.scannedSurface, "metal");
  const shader = {
    ...THREE.ShaderLib.standard,
    uniforms: {},
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  };
  bare.onBeforeCompile(shader, null);
  assert.ok(originalHook);
  assert.equal(shader.uniforms.scanLocal.value, 1);
  assert.equal(shader.uniforms.scanQuality, scans.quality);
  assert.ok(shader.fragmentShader.includes("float roughnessFactor="));
  assert.notEqual(
    unhookedBare.customProgramCacheKey(),
    painted.customProgramCacheKey(),
    "a preserved artist map needs a distinct program from a bare atlas surface",
  );
});

test("animated instanced LODs stay attached to their moving parent and retain all instance transforms", () => {
  const material = new THREE.MeshStandardMaterial();
  const model = new THREE.Group();
  model.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
  model.userData.lodDistances = [0, 45, 100];
  model.userData.lods = { mid: "mid", far: "far" };
  const models = { fish: model, mid: model.clone(true), far: model.clone(true) };
  const scene = new THREE.Scene();
  const school = new THREE.Group();
  scene.add(school);
  const lod = createAssetInstances(models, "fish", [
    { position: [2, 3, 4] },
    { position: [5, 6, 7] },
  ]);
  school.add(lod);
  batchSceneryLods(scene);
  assert.equal(lod.parent, school);
  assert.equal(lod.levels.length, 3);
  for (const level of lod.levels) assert.equal(level.object.children[0].count, 2);
  const before = new THREE.Box3().setFromObject(school).getCenter(new THREE.Vector3());
  school.position.x = 12;
  const after = new THREE.Box3().setFromObject(school).getCenter(new THREE.Vector3());
  assert.ok(Math.abs(after.x - before.x - 12) < 1e-5);
});
