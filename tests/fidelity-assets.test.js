import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as THREE from "../vendor/three/three.module.js";
import {
  installScannedMaterials,
  scannedMaterialKind,
} from "../src/rendering/scanned-materials.js";

const folder = new URL("../assets/fidelity/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", folder)));

test("downloaded PBR artwork and scan maps have pinned sources, retained licenses and verified outputs", () => {
  assert.equal(manifest.materials.length, 16);
  assert.ok(manifest.materials.filter((role) => role.heightSource).length >= 10);
  for (const source of manifest.sources) {
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
