import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as THREE from "../vendor/three/three.module.js";
import { COURSES } from "../src/courses/registry.js";
import { installCourseBake } from "../src/rendering/baked-lighting.js";

test("all course lighting bakes are complete, sized and hash-verified", () => {
  for (const course of COURSES) {
    const folder = new URL(`../assets/lighting/${course.id}/`, import.meta.url);
    const metadata = JSON.parse(readFileSync(new URL("bake.json", folder)));
    assert.equal(metadata.course, course.id);
    assert.ok(metadata.resolution >= 512 && metadata.samples >= 8);
    assert.ok(metadata.triangles > 0, "Bake includes actual scene geometry");
    assert.ok(metadata.sourceSceneSha256.match(/^[a-f0-9]{64}$/));
    for (const output of metadata.outputs) {
      const bytes = readFileSync(new URL(output.file, folder));
      assert.equal(bytes.length, output.bytes, `${course.id}/${output.file} size`);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        output.sha256,
        `${course.id}/${output.file} hash`,
      );
      assert.equal(bytes.toString("hex", 0, 8), "89504e470d0a1a0a");
      assert.equal(bytes.readUInt32BE(16), output.width ?? metadata.resolution);
      assert.equal(bytes.readUInt32BE(20), output.height ?? metadata.resolution);
    }
  }
});

test("Port Lumen spill atlas covers ground, ferry ceilings and skyline without overlapping slices", () => {
  const metadata = JSON.parse(
    readFileSync(new URL("../assets/lighting/neon-harbor/bake.json", import.meta.url)),
  );
  const volume = metadata.lightVolume;
  assert.ok(volume.heights[0] <= 0);
  assert.ok(volume.heights.at(-1) >= 75);
  assert.ok(volume.heights.some((y) => y >= 12 && y <= 16));
  assert.ok(volume.heights.every((y, i) => !i || y > volume.heights[i - 1]));
  assert.ok(volume.columns * volume.rows >= volume.heights.length);
  const output = metadata.outputs.find((entry) => entry.file === volume.file);
  assert.equal(output.width, volume.columns * volume.resolution);
  assert.equal(output.height, volume.rows * volume.resolution);
});

test("course bake attributes preserve mesh samples and indirect fallback without double lighting", () => {
  const scene = new THREE.Scene();
  const receiverMaterial = new THREE.MeshStandardMaterial();
  const regularReceiver = new THREE.Mesh(new THREE.BoxGeometry(), receiverMaterial);
  const skipped = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  skipped.userData.skipBake = true;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial());
  water.material.userData.waterUniforms = {};
  scene.add(regularReceiver, skipped, water);

  const bake = {
    metadata: {
      bounds: [-10, -10, 20, 20],
      heightRange: [-2, 30],
      bounceScale: 0.65,
      lightVolume: { columns: 1, rows: 2, heights: [0, 12], resolution: 4, strength: 0.3 },
    },
    lighting: new THREE.Texture(),
    height: new THREE.Texture(),
    spill: new THREE.Texture(),
  };
  installCourseBake(scene, bake);

  assert.deepEqual(receiverMaterial.defaultAttributeValues.lightBake, [0, 0, 0, 0]);
  assert.deepEqual(receiverMaterial.defaultAttributeValues.instanceLightBake, [0, 0, 0, 0]);
  assert.match(receiverMaterial.customProgramCacheKey(), /offline-course-bake/);
  assert.equal(skipped.material.defaultAttributeValues, undefined);
  assert.equal(water.material.defaultAttributeValues, undefined);

  const shader = {
    uniforms: {},
    vertexShader: "#include <worldpos_vertex>",
    fragmentShader: "#include <lights_fragment_end>",
  };
  receiverMaterial.onBeforeCompile(shader, null);
  assert.match(shader.vertexShader, /attribute vec4 lightBake/);
  assert.match(shader.vertexShader, /attribute vec4 instanceLightBake/);
  assert.match(shader.vertexShader, /vMeshLightBake=instanceLightBake/);
  assert.match(shader.fragmentShader, /hasMeshBake=step\(\.001,vMeshLightBake\.a\)/);
  assert.match(shader.fragmentShader, /courseLight\.a,nearGround/);
  assert.match(shader.fragmentShader, /courseSpillAt\(bakeUv,vCourseBakeWorld\.y\)/);
  assert.match(shader.fragmentShader, /courseSpillStrength\*\(1\.-hasMeshBake\)/);
  assert.match(shader.fragmentShader, /courseBakeBounce\*hasMeshBake/);

  for (const texture of [bake.lighting, bake.height, bake.spill]) texture.dispose();
});
