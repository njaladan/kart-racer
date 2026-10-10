import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as THREE from "../vendor/three/three.module.js";
import { prepareSurfaceLightmap } from "../src/rendering/surface-lightmap.js";
import { batchStaticMeshes } from "../src/rendering/visuals.js";
import {
  sampleBakedProbes,
  updateRacerProbeLighting,
  installGlobalIllumination,
  updateMovingProbeLighting,
} from "../src/rendering/baked-global-illumination.js";
import { installCourseBake } from "../src/rendering/baked-lighting.js";

test("architecture charts retain separate lighting UVs through regional batching", () => {
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry();
  const originalUv = [...geometry.attributes.uv.array];
  const material = new THREE.MeshStandardMaterial();
  material.userData.surfaceLightmap = true;
  const a = new THREE.Mesh(geometry, material);
  const b = a.clone();
  const moving = a.clone();
  a.scale.set(4, 8, 4);
  b.position.x = 12;
  b.scale.set(4, 8, 4);
  moving.position.x = -12;
  scene.add(a, b, moving);
  const atlas = prepareSurfaceLightmap(scene, [moving], 256);
  assert.equal(atlas.charts, 12);
  assert.equal(moving.geometry, geometry, "Moving objects retain the shared source geometry");
  assert.deepEqual([...geometry.attributes.uv.array], originalUv);
  assert.equal(geometry.attributes.surfaceLightUv, undefined);
  const bounds = (object) => {
    const uv = object.geometry.attributes.surfaceLightUv;
    assert.ok([...uv.array].every(Number.isFinite));
    const x = Array.from({ length: uv.count }, (_, i) => uv.getX(i));
    const y = Array.from({ length: uv.count }, (_, i) => uv.getY(i));
    assert.ok(x.every((v) => v > 0 && v < 1));
    assert.ok(y.every((v) => v > 0 && v < 1));
    for (let i = 0; i < uv.count; i++) assert.equal(uv.getZ(i), 1);
    return [Math.min(...x), Math.max(...x), Math.min(...y), Math.max(...y)];
  };
  assert.notDeepEqual(bounds(a), bounds(b), "Shared props receive different atlas regions");
  const vertices = a.geometry.attributes.position.count + b.geometry.attributes.position.count;
  batchStaticMeshes(scene, [moving]);
  const merged = scene.children.find((object) => object.name === "Regional static scenery batch");
  assert.equal(merged.geometry.attributes.surfaceLightUv.count, vertices);
  assert.equal(scene.children.length, 2, "Lightmapping preserves regional merging");
});

test("a four-corner ground mesh keeps the spatial bake despite fully open vertex samples", () => {
  const scene = new THREE.Scene();
  const material = new THREE.MeshStandardMaterial();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), material);
  ground.userData.bakeReceiver = true;
  ground.geometry.setAttribute(
    "lightBake",
    new THREE.Uint8BufferAttribute(
      new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]),
      4,
      true,
    ),
  );
  scene.add(ground);
  installCourseBake(scene, {
    metadata: { bounds: [-50, -50, 100, 100], heightRange: [-5, 20] },
    lighting: new THREE.Texture(),
    height: new THREE.Texture(),
  });
  for (let i = 0; i < 4; i++) assert.equal(ground.geometry.attributes.courseGroundBake.getX(i), 1);
  const shader = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  };
  material.onBeforeCompile(shader, null);
  assert.match(shader.fragmentShader, /hasMeshBake=.*\(1\.-step\(\.5,vCourseGroundBake\)\)/);
  assert.equal(material.defaultAttributeValues.courseGroundBake[0], 0);
});

function probeFixture() {
  const coefficients = new Float32Array(2 * 6 * 28);
  for (let station = 0; station < 2; station++)
    for (let probe = 0; probe < 6; probe++) {
      coefficients[(station * 6 + probe) * 28] = station * 10 + probe + 1;
      coefficients[(station * 6 + probe) * 28 + 27] = 0.5;
    }
  return { metadata: { stations: [{ t: 0 }, { t: 0.5 }] }, coefficients };
}

test("directional probes interpolate route, lane and height continuously across the lap seam", () => {
  const probes = probeFixture();
  const result = new Float32Array(28);
  assert.equal(sampleBakedProbes(probes, 0, -0.65, 1.3, result)[0], 1);
  assert.equal(sampleBakedProbes(probes, 0.25, 0, 2.55, result)[0], 8.5);
  assert.equal(sampleBakedProbes(probes, 0.75, -0.65, 1.3, result)[0], 6);
  assert.equal(sampleBakedProbes(probes, 1, -0.65, 1.3, result)[0], 1);
  assert.equal(sampleBakedProbes(probes, 0, 5, 20, result)[0], 6);
  assert.equal(result[27], 0.5);
  const material = new THREE.MeshStandardMaterial();
  const kart = { litMaterials: [material] };
  updateRacerProbeLighting(kart, probes, 0, -0.65, 1.3);
  const shader = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  };
  material.onBeforeCompile(shader, null);
  const uniform = shader.uniforms.racerGi;
  updateRacerProbeLighting(kart, probes, 0.5, -0.65, 1.3);
  assert.equal(shader.uniforms.racerGi, uniform, "Updates reuse the compiled shader's uniforms");
  assert.equal(uniform.value[0].x, 11);
  assert.match(shader.fragmentShader, /min\(liveSunVisibility,racerSunVisibility\)/);
});

test("moving mechanisms compose probe lighting with existing architecture hooks", () => {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.userData.probeT = 0;
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  mesh.geometry.setAttribute(
    "surfaceLightUv",
    new THREE.Float32BufferAttribute(new Float32Array(24 * 3), 3),
  );
  root.add(mesh);
  scene.add(root);
  installCourseBake(scene, {
    metadata: { bounds: [-50, -50, 100, 100], heightRange: [-5, 20] },
    lighting: new THREE.Texture(),
    height: new THREE.Texture(),
  });
  const probes = probeFixture();
  installGlobalIllumination(
    scene,
    {
      metadata: {
        ground: { bounds: [-50, -50, 100, 100] },
        temple: { bounds: [-10, -10, 20, 20] },
        scale: 2,
      },
      probes,
    },
    [-5, 20],
  );
  updateMovingProbeLighting(scene, probes, {
    TRACK: 100,
    roadHalfWidth: () => 6,
    projectTrack: () => ({ t: 0, offset: 0, height: 0 }),
  });
  assert.notEqual(mesh.material, material);
  const shader = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  };
  mesh.material.onBeforeCompile(shader, null);
  assert.match(shader.fragmentShader, /min\(mix\(1\.,staticGi.a,giCoverage\),racerSunVisibility\)/);
  assert.ok(shader.uniforms.giEnabled && shader.uniforms.racerGi);
  const records = scene.userData.movingProbeReceivers;
  updateMovingProbeLighting(scene, probes, {
    TRACK: 100,
    roadHalfWidth: () => 6,
    projectTrack: () => ({ t: 0.5, offset: 0, height: 0 }),
  });
  assert.equal(scene.userData.movingProbeReceivers, records);
  assert.equal(records[0].uniforms, undefined);
  assert.equal(records[0].userDataBakedGi.uniforms.racerGi.value[0].x, 12);
});

test("Sunstone Cycles maps and probe data share the scene identity and fit a bounded texture budget", () => {
  const folder = new URL("../assets/lighting/sunstone-ruins/", import.meta.url);
  const bake = JSON.parse(readFileSync(new URL("bake.json", folder)));
  const gi = bake.globalIllumination;
  assert.equal(gi.sourceSceneSha256, bake.sourceSceneSha256);
  assert.ok(gi.diffuseBounces >= 3 && gi.samples >= 64);
  assert.ok(gi.runtimeTextureBytes <= 32 * 1024 * 1024);
  assert.ok(gi.architecture.charts > 1000);
  assert.ok(gi.temple.bounds[2] / gi.temple.resolution < 0.5);
  const metadataBytes = readFileSync(new URL(gi.probes.metadata, folder));
  assert.equal(createHash("sha256").update(metadataBytes).digest("hex"), gi.probes.metadataSha256);
  const probes = JSON.parse(metadataBytes);
  assert.equal(probes.sourceSceneSha256, bake.sourceSceneSha256);
  const bytes = readFileSync(new URL(probes.binary.file, folder));
  assert.equal(
    bytes.length,
    probes.stations.length * probes.lanes.length * probes.heights.length * 28 * 4,
  );
  assert.equal(createHash("sha256").update(bytes).digest("hex"), probes.binary.sha256);
  const visibility = [];
  for (let offset = 0; offset < bytes.length; offset += 28 * 4) {
    for (let channel = 0; channel < 28; channel++)
      assert.ok(Number.isFinite(bytes.readFloatLE(offset + channel * 4)));
    visibility.push(bytes.readFloatLE(offset + 27 * 4));
  }
  assert.ok(
    visibility.some((v) => v < 0.2),
    "Sheltered probes detect the temple roof",
  );
  assert.ok(
    visibility.some((v) => v > 0.95),
    "Open-air probes retain direct sunlight",
  );
});
