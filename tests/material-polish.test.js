import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import * as THREE from "../vendor/three/three.module.js";
import {
  chooseCompressedUrl,
  loadCompressedTexture,
  resetCompressedTextureState,
} from "../src/rendering/compressed-textures.js";
import { installMaterialPolish } from "../src/rendering/material-polish.js";
import { patchMaterial } from "../src/rendering/surface-detail.js";

const root = path.resolve(import.meta.dirname, "..");

function hash(data) {
  return createHash("sha256").update(data).digest("hex");
}

test("compressed manifest points to valid KTX2 assets and matches both content hashes", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(root, "assets/compressed-textures.json"), "utf8"),
  );
  assert.equal(manifest.version, 1);
  assert.ok(manifest.summary.count > 0);
  assert.ok(manifest.summary.compressedBytes > 0);
  let sawColor = false;
  let sawLinear = false;
  for (const [sourceRelative, entry] of Object.entries(manifest.textures)) {
    const source = await readFile(path.join(root, sourceRelative));
    const compressed = await readFile(path.join(root, entry.file.replace(/^\.\//, "")));
    assert.equal(hash(source), entry.sourceSha256, `${sourceRelative} source hash`);
    assert.equal(hash(compressed), entry.sha256, `${sourceRelative} compressed hash`);
    assert.equal(compressed.subarray(0, 12).toString("hex"), "ab4b5458203230bb0d0a1a0a");
    assert.equal(compressed.byteLength, entry.bytes);
    assert.equal(source.byteLength, entry.sourceBytes);
    sawColor ||= entry.channel === "color";
    sawLinear ||= entry.channel === "linear" || entry.channel === "normal";
  }
  assert.ok(sawColor && sawLinear, "color and linear data use distinct encodings");
});

test("compressed URL selection handles app-root and absolute asset URLs", () => {
  const manifest = {
    textures: {
      "assets/living/textures/rock-normal.webp": {
        file: "./assets/compressed/living/textures/rock-normal.webp.ktx2",
      },
    },
  };
  assert.equal(
    chooseCompressedUrl("./assets/living/textures/rock-normal.webp", manifest),
    "./assets/compressed/living/textures/rock-normal.webp.ktx2",
  );
  assert.equal(
    chooseCompressedUrl(
      "https://game.example/kart/assets/living/textures/rock-normal.webp?v=2",
      manifest,
    ),
    "./assets/compressed/living/textures/rock-normal.webp.ktx2",
  );
  assert.equal(chooseCompressedUrl("./assets/missing.webp", manifest), "./assets/missing.webp");
});

test("unsupported renderers use the source image and keep sampler settings", async () => {
  const originalFetch = globalThis.fetch;
  const fallback = new THREE.Texture();
  let loadedUrl;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      textures: {
        "assets/ground.webp": { file: "./assets/compressed/ground.webp.ktx2" },
      },
    }),
  });
  resetCompressedTextureState();
  try {
    const texture = await loadCompressedTexture(undefined, "./assets/ground.webp", {
      colorSpace: THREE.SRGBColorSpace,
      textureLoader: {
        loadAsync: async (url) => {
          loadedUrl = url;
          return fallback;
        },
      },
    });
    assert.equal(texture, fallback);
    assert.equal(loadedUrl, "./assets/ground.webp");
    assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
    assert.equal(texture.wrapS, THREE.RepeatWrapping);
    assert.equal(texture.wrapT, THREE.RepeatWrapping);
    assert.equal(texture.anisotropy, 1);
    assert.equal(texture.generateMipmaps, true);
  } finally {
    globalThis.fetch = originalFetch;
    resetCompressedTextureState();
  }
});

test("material polish composes shader patches and filters only eligible materials", () => {
  const scene = new THREE.Scene();
  const eligible = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0 });
  eligible.normalMap = new THREE.Texture();
  const metal = new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0.9 });
  const glass = new THREE.MeshPhysicalMaterial({ roughness: 0.08, transmission: 1 });
  const water = new THREE.MeshStandardMaterial({ name: "Race water", roughness: 0.12 });
  scene.add(new THREE.Mesh(new THREE.BufferGeometry(), [eligible, metal, glass, water]));

  let originalCalls = 0;
  eligible.onBeforeCompile = () => originalCalls++;
  patchMaterial(eligible, "test-existing-patch", (shader) => {
    shader.fragmentShader += "\n// preserved patch\n";
  });
  installMaterialPolish(scene);
  const shader = {
    fragmentShader:
      "#include <roughnessmap_fragment>\n#include <normal_fragment_maps>\nvoid main() { }",
  };
  eligible.onBeforeCompile(shader, {});
  assert.equal(originalCalls, 1);
  assert.match(shader.fragmentShader, /preserved patch/);
  assert.match(shader.fragmentShader, /polishWorldPixel/);
  assert.match(shader.fragmentShader, /dFdx\(normal\)/);
  assert.match(shader.fragmentShader, /roughnessFactor = max/);
  assert.ok(
    shader.fragmentShader.indexOf("polishWorldPixel") >
      shader.fragmentShader.indexOf("#include <normal_fragment_maps>"),
  );
  assert.ok(eligible.userData.materialPolishInstalled);
  assert.ok(!metal.userData.materialPolishInstalled);
  assert.ok(!glass.userData.materialPolishInstalled);
  assert.ok(!water.userData.materialPolishInstalled);
  assert.match(eligible.customProgramCacheKey(), /material-polish-screen-footprint/);
});
