import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "../vendor/three/three.module.js";
import {
  collectMeshLightSamples,
  installMeshLightAttributes,
  loadMeshLightBake,
} from "../src/rendering/mesh-light-bake.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bakeScript = resolve(root, "tools/bake-mesh-lighting.py");
const blenderAvailable = spawnSync("blender", ["--version"], { encoding: "utf8" }).status === 0;

function standardMaterial(color = "#ffffff") {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
}

function triangleMesh(name, points, material = standardMaterial()) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points.flat(), 3));
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  return mesh;
}

function makeFixture() {
  const scene = new THREE.Scene();
  const world = { animated: [] };
  const contactFloor = triangleMesh("contact-floor", [
    [1.7, 0, 1.7],
    [1.7, 0, 2.5],
    [2.5, 0, 1.7],
  ]);
  const openFloor = triangleMesh("open-floor", [
    [9, 0, 9],
    [9, 0, 10],
    [10, 0, 9],
  ]);
  scene.add(contactFloor, openFloor);

  // Two perpendicular walls create a concave corner above the contact sample.
  const xWall = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), standardMaterial("#b8a78f"));
  xWall.name = "east-wall";
  xWall.position.set(2, 2, 0);
  xWall.rotation.y = Math.PI / 2;
  xWall.updateMatrix();
  const zWall = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), standardMaterial("#988f81"));
  zWall.name = "north-wall";
  zWall.position.set(0, 2, 2);
  scene.add(xWall, zWall);

  const ignored = triangleMesh("animated-marker", [
    [0, 0, 0],
    [0, 0, 1],
    [1, 0, 0],
  ]);
  scene.add(ignored);
  world.animated.push(ignored);
  const fx = triangleMesh("fx-source", [
    [0, 0, 0],
    [0, 0, 1],
    [1, 0, 0],
  ]);
  fx.userData.skipBake = true;
  scene.add(fx);
  const rock = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 2, 2), standardMaterial(), 1);
  rock.name = "open-box-instance";
  rock.setMatrixAt(
    0,
    new THREE.Matrix4().compose(
      new THREE.Vector3(18, 0, 18),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, 0.32, 0.12)),
      new THREE.Vector3(1, 1, 1),
    ),
  );
  scene.add(rock);
  for (const [name, x, z] of [
    ["positive-boundary-west", 31.9, 31.9],
    ["positive-boundary-east", 32.1, 32.1],
    ["zero-boundary-negative", -0.1, -0.1],
    ["zero-boundary-positive", 0.1, 0.1],
    ["negative-32-boundary-west", -32.1, -32.1],
    ["negative-32-boundary-east", -31.9, -31.9],
  ]) {
    scene.add(
      triangleMesh(name, [
        [x, 0, z],
        [x, 0, z + 0.24],
        [x + 0.24, 0, z],
      ]),
    );
  }
  scene.updateMatrixWorld(true);
  return { scene, world };
}

function exportSceneInput(scene, world, folder, course, sunIntensity = 0) {
  const collected = collectMeshLightSamples(scene, world);
  const positions = [];
  const indices = [];
  const colors = [];
  const receivers = [];
  let vertexOffset = 0;
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!object.isMesh || object.userData.skipBake || world.animated.includes(object)) return;
    const geometry = object.geometry;
    const position = geometry.attributes.position;
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    const color = material.color.toArray();
    const count = geometry.index?.count ?? position.count;
    const instance = new THREE.Matrix4();
    for (let copy = 0; copy < (object.isInstancedMesh ? object.count : 1); copy++) {
      const matrix = object.matrixWorld.clone();
      if (object.isInstancedMesh) {
        object.getMatrixAt(copy, instance);
        matrix.multiply(instance);
      }
      for (let index = 0; index < position.count; index++) {
        const point = new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(matrix);
        positions.push(point.x, point.y, point.z);
      }
      for (let index = 0; index < count; index += 3) {
        const face = [0, 1, 2].map(
          (corner) => geometry.index?.getX(index + corner) ?? index + corner,
        );
        indices.push(...face.map((value) => value + vertexOffset));
        colors.push(...color, 1);
        receivers.push(0);
      }
      vertexOffset += position.count;
    }
  });
  const streams = [
    new Float32Array(positions),
    new Uint32Array(indices),
    new Float32Array(colors),
    new Uint8Array(receivers),
  ];
  const binary = Buffer.concat(streams.map((stream) => Buffer.from(stream.buffer)));
  const metadata = {
    course,
    positions: positions.length / 3,
    triangles: indices.length / 3,
    offsets: [
      0,
      streams[0].byteLength,
      streams[0].byteLength + streams[1].byteLength,
      streams[0].byteLength + streams[1].byteLength + streams[2].byteLength,
    ],
    bounds: [-8, -8, 32, 32],
    lights: [
      { position: [32, 2, 32], color: [0.9, 0.2, 0.1], intensity: 3, radius: 8 },
      { position: [0, 2, 0], color: [0.1, 0.6, 0.9], intensity: 2.5, radius: 8 },
      { position: [-32, 2, -32], color: [0.8, 0.5, 0.2], intensity: 4, radius: 8 },
    ],
    sunIntensity,
  };
  const sceneJson = Buffer.from(JSON.stringify(metadata));
  const sourceSceneSha256 = createHash("sha256").update(sceneJson).update(binary).digest("hex");
  const sampleBinary = Buffer.from(
    collected.samples.buffer,
    collected.samples.byteOffset,
    collected.samples.byteLength,
  );
  const sampleMetadata = {
    version: 1,
    course,
    sourceSceneSha256,
    sampleCount: collected.samplesCount,
    sampleSha256: createHash("sha256").update(sampleBinary).digest("hex"),
    entries: collected.entries,
  };
  writeFileSync(resolve(folder, `${course}.json`), sceneJson);
  writeFileSync(resolve(folder, `${course}.bin`), binary);
  writeFileSync(resolve(folder, `${course}-mesh-samples.json`), JSON.stringify(sampleMetadata));
  writeFileSync(resolve(folder, `${course}-mesh-samples.bin`), sampleBinary);
  return { sourceSceneSha256, sampleMetadata };
}

function readEntryRgba(metadata, binary, name, sampleIndex = 0) {
  const entry = metadata.entries.find((candidate) => candidate.name === name);
  assert.ok(entry, `missing baked entry ${name}`);
  const start = entry.byteOffset + sampleIndex * 4;
  return [...binary.subarray(start, start + 4)];
}

test(
  "mesh bake resolves perpendicular contact darker than an open surface and excludes direct sun",
  {
    skip: !blenderAvailable && "Blender is not installed in this environment",
  },
  () => {
    const temp = mkdtempSync(resolve(tmpdir(), "mesh-light-bake-"));
    const inputDir = resolve(temp, "input");
    const outA = resolve(temp, "out-a");
    const outB = resolve(temp, "out-b");
    const outC = resolve(temp, "out-c");
    mkdirSync(inputDir);
    mkdirSync(outA);
    mkdirSync(outB);
    mkdirSync(outC);
    try {
      const { scene, world } = makeFixture();
      const initialSamples = collectMeshLightSamples(scene, world);
      const instanceEntry = initialSamples.entries.find(
        (entry) => entry.name === "open-box-instance",
      );
      assert.ok(instanceEntry);
      const instanceSample = initialSamples.samples.slice(
        instanceEntry.sampleOffset * 6,
        instanceEntry.sampleOffset * 6 + 6,
      );
      assert.ok(instanceSample.every(Number.isFinite));
      assert.ok(
        instanceSample[1] > 0.8,
        `instance sample should be on its upper surface, got y=${instanceSample[1]}`,
      );
      assert.ok(
        instanceSample[4] > 0.9,
        `instance normal should face upward, got y=${instanceSample[4]}`,
      );
      exportSceneInput(scene, world, inputDir, "mesh-light-test", 0);
      const runBake = (output, bruteForce = false) => {
        const result = spawnSync(
          "blender",
          ["-b", "-t", "2", "--python", bakeScript, "--", "mesh-light-test"],
          {
            cwd: root,
            encoding: "utf8",
            timeout: 120000,
            maxBuffer: 2 * 1024 * 1024,
            env: {
              ...process.env,
              LIGHTING_SCENE_DIR: inputDir,
              MESH_LIGHT_OUTPUT_DIR: output,
              MESH_LIGHT_BAKE_SAMPLES: "20",
              MESH_LIGHT_BAKE_RADIUS: "12",
              MESH_LIGHT_BRUTE_FORCE: bruteForce ? "1" : "0",
            },
          },
        );
        assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      };
      runBake(outA);
      const bakedPathA = resolve(outA, "mesh-light-test", "mesh-lighting.json");
      const metadataA = JSON.parse(readFileSync(bakedPathA, "utf8"));
      const binaryA = new Uint8Array(
        readFileSync(resolve(outA, "mesh-light-test", "mesh-lighting.bin")),
      );
      const contact = readEntryRgba(metadataA, binaryA, "contact-floor");
      const open = readEntryRgba(metadataA, binaryA, "open-floor");
      const instance = readEntryRgba(metadataA, binaryA, "open-box-instance");
      assert.ok(
        contact[3] < open[3],
        `contact AO ${contact[3]} should be darker than open AO ${open[3]}`,
      );
      assert.ok(
        instance[3] >= 245,
        `top surface of open instance should stay lit, got AO ${instance[3]}`,
      );
      assert.match(metadataA.method, /direct sunlight excluded/);

      // Bucket-boundary lamps at positive, zero, and negative cell edges must
      // produce the same float and byte results as checking every lamp.
      runBake(outB, true);
      const bruteBinary = readFileSync(resolve(outB, "mesh-light-test", "mesh-lighting.bin"));
      assert.deepEqual(
        bruteBinary,
        readFileSync(resolve(outA, "mesh-light-test", "mesh-lighting.bin")),
      );

      // Changing only the unconsumed sky/sun intensity cannot alter the mesh bake.
      exportSceneInput(scene, world, inputDir, "mesh-light-test", 9);
      runBake(outC);
      const binaryB = readFileSync(resolve(outC, "mesh-light-test", "mesh-lighting.bin"));
      assert.deepEqual(
        binaryB,
        readFileSync(resolve(outA, "mesh-light-test", "mesh-lighting.bin")),
      );

      // Runtime matches despite scene prefixes and material-color changes. The
      // geometry/matrix identity remains the stable binding contract.
      const prefixLight = new THREE.PointLight("#ffffff", 0.1);
      scene.add(prefixLight);
      scene.children.unshift(scene.children.pop());
      for (const object of scene.children) {
        if (object.isMesh && object.material?.color) object.material.color.set("#e5d7c2");
      }
      const extra = triangleMesh("new-runtime-mesh", [
        [20, 0, 20],
        [21, 0, 20],
        [20, 0, 21],
      ]);
      scene.add(extra);
      scene.updateMatrixWorld(true);
      const report = installMeshLightAttributes(
        scene,
        { metadata: metadataA, binary: binaryA },
        world,
      );
      assert.equal(report.matched, metadataA.entries.length);
      assert.equal(report.missing, 1);
      assert.equal(report.sourceMismatch, false);
      const contactMesh = scene.getObjectByName("contact-floor");
      assert.deepEqual(
        [...contactMesh.geometry.getAttribute("lightBake").array.slice(0, 4)],
        contact,
      );
      assert.deepEqual(
        [...extra.geometry.getAttribute("lightBake").array.slice(0, 4)],
        [0, 0, 0, 0],
      );
      scene.userData.courseBake = { sourceSceneSha256: "different-scene" };
      assert.equal(report.sourceMismatch, true);
      assert.equal(report.sourceDiagnostic.expected, metadataA.sourceSceneSha256);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  },
);

test("instances receive constant per-instance attributes and changed transforms fail the signature", () => {
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const instanced = new THREE.InstancedMesh(geometry, standardMaterial(), 2);
  instanced.name = "reef-rocks";
  instanced.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 0, 0));
  instanced.setMatrixAt(1, new THREE.Matrix4().makeTranslation(4, 0, 0));
  scene.add(instanced);
  scene.updateMatrixWorld(true);
  const collected = collectMeshLightSamples(scene, { animated: [] });
  assert.equal(collected.entries[0].kind, "instances");
  assert.equal(collected.entries[0].count, 2);
  assert.notDeepEqual([...collected.samples.slice(0, 3)], [...collected.samples.slice(6, 9)]);
  const entry = { ...collected.entries[0], byteOffset: 0, byteLength: 8 };
  const metadata = { entries: [entry] };
  const report = installMeshLightAttributes(scene, {
    metadata,
    binary: new Uint8Array([40, 50, 60, 180, 70, 80, 90, 200]),
  });
  assert.equal(report.matched, 1);
  assert.deepEqual(
    [...geometry.getAttribute("instanceLightBake").array],
    [40, 50, 60, 180, 70, 80, 90, 200],
  );
  instanced.setMatrixAt(1, new THREE.Matrix4().makeTranslation(5, 0, 0));
  scene.updateMatrixWorld(true);
  const changed = collectMeshLightSamples(scene, { animated: [] });
  assert.notEqual(changed.entries[0].signature, entry.signature);
});

test("runtime loader verifies the mesh binary digest", async () => {
  const originalFetch = globalThis.fetch;
  const data = new Uint8Array([2, 4, 6, 8]);
  const digest = createHash("sha256").update(data).digest("hex");
  let expectedDigest = digest;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("mesh-lighting.json"))
      return {
        status: 200,
        ok: true,
        json: async () => ({
          binary: { file: "mesh-lighting.bin", bytes: 4, sha256: expectedDigest },
        }),
      };
    return { ok: true, arrayBuffer: async () => data.buffer.slice(0) };
  };
  try {
    const bake = await loadMeshLightBake("test-course", "/test/");
    assert.deepEqual([...bake.binary], [...data]);
    expectedDigest = "0".repeat(64);
    await assert.rejects(loadMeshLightBake("test-course", "/test/"), /digest mismatch/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("runtime loader keeps mesh lighting when Web Crypto is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  const data = new Uint8Array([11, 22, 33, 44]);
  const digest = createHash("sha256").update(data).digest("hex");
  globalThis.fetch = async (url) =>
    String(url).endsWith("mesh-lighting.json")
      ? {
          status: 200,
          ok: true,
          json: async () => ({
            binary: { file: "mesh-lighting.bin", bytes: data.length, sha256: digest },
          }),
        }
      : { ok: true, arrayBuffer: async () => data.buffer.slice(0) };
  try {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: undefined,
    });
    const bake = await loadMeshLightBake("lan-course", "/lan/");
    assert.deepEqual([...bake.binary], [...data]);
    assert.equal(bake.integrityVerified, false);
    assert.equal(bake.integrityDiagnostic, "webcrypto-unavailable");
  } finally {
    globalThis.fetch = originalFetch;
    if (cryptoDescriptor) Object.defineProperty(globalThis, "crypto", cryptoDescriptor);
    else delete globalThis.crypto;
  }
});
