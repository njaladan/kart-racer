import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import {
  stormWaveSurface,
  sampleStormSea,
  STORM_WAVES,
} from "../src/courses/adventure/tempest-waves.js";
import { createStormSea, createStormSeaGeometry } from "../src/courses/adventure/tempest-sea.js";
import { createStormCoastTexture } from "../src/courses/adventure/tempest-sea-textures.js";

test("storm surface has exact normals, invertible crests and matching world-space buoyancy", () => {
  assert.ok(STORM_WAVES.reduce((sum, w) => sum + w.steepness, 0) < 1);
  const epsilon = 1e-3;
  for (let i = 0; i < 250; i++) {
    const x = Math.sin(i * 1.73) * 820,
      z = Math.cos(i * 2.41) * 820,
      time = i * 3.13;
    const p = stormWaveSurface(x, z, time);
    assert.ok(p.jacobian > 0 && p.ny > 0, "surface must not fold over");
    const dx = stormWaveSurface(x + epsilon, z, time),
      dz = stormWaveSurface(x, z + epsilon, time);
    const normal = new THREE.Vector3(p.nx, p.ny, p.nz);
    for (const q of [dx, dz]) {
      const tangent = new THREE.Vector3(q.x - p.x, q.height - p.height, q.z - p.z).divideScalar(
        epsilon,
      );
      assert.ok(Math.abs(tangent.dot(normal)) < 2e-4, "normal must match displaced geometry");
    }
    const sample = sampleStormSea(p.x, p.z, time);
    assert.ok(Math.abs(sample.x - p.x) + Math.abs(sample.z - p.z) < 1e-6);
    assert.ok(Math.abs(sample.height - p.height) < 1e-6, "buoyancy must invert lateral motion");
    assert.ok(p.height >= -16.8 && p.height <= -3.2);
  }
});

test("storm sea preserves animation and coastal data across quality changes and batching", () => {
  const scene = new THREE.Scene(),
    sea = createStormSea(scene);
  scene.add(sea.ocean);
  const uniforms = sea.ocean.material.userData.waterUniforms;
  sea.update(18);
  assert.equal(uniforms.stormTime.value, 18);
  sea.setQuality(0);
  const low = sea.ocean.geometry;
  assert.ok(low.index.count / 3 <= 32768);
  sea.setQuality(0);
  assert.equal(sea.ocean.geometry, low, "same tier must not allocate new geometry");
  sea.setQuality(3);
  assert.ok(sea.ocean.geometry.index.count / 3 <= 73728);
  assert.equal(sea.ocean.material.userData.waterUniforms, uniforms);
  assert.equal(uniforms.stormTime.value, 18);
  assert.equal(sea.ocean.material.transparent, false);
  assert.equal(sea.ocean.material.depthWrite, true);
  assert.equal(sea.ocean.castShadow, false);
  assert.equal(sea.ocean.userData.skipBake, true);
  sea.update(0);
  assert.equal(uniforms.stormTime.value, 0);
  let released = 0;
  for (const uniform of [uniforms.stormDetail, uniforms.stormCoast])
    uniform.value.addEventListener("dispose", () => released++);
  sea.ocean.material.dispose();
  assert.equal(released, 2, "owned textures must be released with the material");
  sea.ocean.geometry.dispose();
});

test("water culling bounds contain the complete wave envelope at both mesh densities", () => {
  for (const segments of [128, 192]) {
    const geometry = createStormSeaGeometry(segments);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 113) {
      for (const time of [0, 1, 18, 150]) {
        const p = stormWaveSurface(positions.getX(i), positions.getZ(i), time);
        const point = new THREE.Vector3(p.x, p.height + 10, p.z);
        assert.ok(geometry.boundingBox.containsPoint(point));
        assert.ok(geometry.boundingSphere.containsPoint(point));
      }
    }
    geometry.dispose();
  }
});

test("coastal distance follows actual obstacle footprints and only uploads after edits", () => {
  const coast = createStormCoastTexture();
  const at = (x, z) => {
    const ix = Math.floor((x / 1700 + 0.5) * 512),
      iz = Math.floor((z / 1700 + 0.5) * 512);
    return (coast.texture.image.data[iz * 512 + ix] / 255) * 48 - 16;
  };
  coast.addShore(0, 0, 20, 100, 0);
  coast.update();
  assert.ok(at(50, 0) < -10);
  assert.ok(Math.abs(at(50, 20)) < 3.5);
  assert.ok(at(50, 100) > 30);
  const version = coast.texture.version;
  coast.update();
  assert.equal(coast.texture.version, version);
  coast.addShore(50, 100, 10);
  coast.update();
  assert.ok(at(50, 100) < 0);
  assert.equal(coast.texture.version, version + 1);
  coast.texture.dispose();
});
