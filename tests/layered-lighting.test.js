import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import {
  invalidateLayeredReceivers,
  registerLayeredLight,
  updateLayeredLighting,
} from "../src/rendering/layered-lighting.js";
import { selectCourseProbeSectors } from "../src/rendering/reflection-environments.js";

test("layered sources create a stable bake pool and deterministic animated visual", () => {
  const scene = new THREE.Scene();
  const parent = new THREE.Group();
  parent.position.set(10, 3, -4);
  scene.add(parent);
  const light = registerLayeredLight(scene, {
    parent,
    position: [2, 1, 0],
    color: "#ff8844",
    intensity: 8,
    radius: 20,
    kind: "fire",
    pattern: "caustic",
    speed: 2,
    phase: 0.4,
    amplitude: 1.5,
  });
  const bakedPosition = light.pool.position.clone();
  const baselineY = 4 + 1.5 * Math.sin(0.4);
  assert.deepEqual(light.position.toArray(), [12, baselineY, -4]);
  assert.equal(scene.userData.localLightPools.length, 1);
  assert.ok(light.patch.material.isShaderMaterial);
  assert.equal(light.patch.material.uniforms.patternId.value, 4);

  updateLayeredLighting(scene, 2, { motionEnabled: true });
  const movedY = light.position.y;
  assert.notEqual(movedY, 4);
  assert.deepEqual(light.pool.position.toArray(), bakedPosition.toArray());
  assert.equal(light.patch.material.uniforms.clock.value, 2);
  updateLayeredLighting(scene, 2, { motionEnabled: false });
  assert.equal(light.position.y, baselineY);

  light.dispose();
  assert.equal(scene.userData.layeredLights.length, 0);
  assert.equal(scene.userData.localLightPools.length, 0);
  assert.equal(light.patch, undefined);
});

test("dynamic sources can opt out of bake pools and use authored weather state", () => {
  const scene = new THREE.Scene();
  const light = registerLayeredLight(scene, {
    position: new THREE.Vector3(1, 2, 3),
    color: "#d9eaff",
    intensity: 5,
    radius: 35,
    kind: "weather-flash",
    staticBake: false,
    shaft: true,
  });
  updateLayeredLighting(scene, 4.5, { motionEnabled: true, stormFlash: 0.4 });
  assert.equal(light.currentIntensity, 2);
  assert.equal(light.shaft.visible, true);
  assert.equal(scene.userData.localLightPools, undefined);
  updateLayeredLighting(scene, 4.5, { motionEnabled: false, stormFlash: 0 });
  assert.equal(light.shaft.visible, false);
  light.dispose();
  assert.equal(light.shaft, undefined);
});

test("projected patterns resolve a real receiver and stay aligned to transformed parents", () => {
  const scene = new THREE.Scene();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial());
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  scene.add(new THREE.Sprite(new THREE.SpriteMaterial()));
  const source = registerLayeredLight(scene, {
    position: [0, 8, 0],
    intensity: 6,
    radius: 8,
    pattern: "lattice",
  });
  updateLayeredLighting(scene, 0);
  assert.equal(source.patch.visible, true);
  assert.ok(Math.abs(source.patch.position.y - 0.025) < 0.002);
  floor.position.y = 1;
  updateLayeredLighting(scene, 1);
  assert.ok(Math.abs(source.patch.position.y - 1.025) < 0.002);
  invalidateLayeredReceivers(scene);
  assert.equal(scene.userData.layeredReceiverMeshes, undefined);

  const pivot = new THREE.Group();
  pivot.position.set(4, 5, 6);
  pivot.rotation.y = Math.PI / 2;
  scene.add(pivot);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.2),
    new THREE.MeshStandardMaterial({ emissive: "#ffffff", emissiveIntensity: 2 }),
  );
  pivot.add(bulb);
  const beam = registerLayeredLight(scene, {
    parent: pivot,
    position: [0, 3, 0],
    target: [0, 0, -4],
    sourceObject: bulb,
    color: "#ffcc88",
    intensity: 4,
    radius: 10,
    kind: "fire",
    pattern: "stained-glass",
  });
  assert.deepEqual(
    beam.worldTarget.toArray().map((v) => Math.round(v)),
    [0, 5, 6],
  );
  assert.deepEqual(
    beam.patch.position.toArray().map((v) => Math.round(v)),
    [0, 5, 6],
  );
  assert.ok(bulb.material.emissiveIntensity > 0);
  beam.dispose();
  source.dispose();
  floor.geometry.dispose();
  floor.material.dispose();
});

test("projected effects select nearby authored sources instead of registration order", () => {
  const scene = new THREE.Scene();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 30), new THREE.MeshStandardMaterial());
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const records = Array.from({ length: 7 }, (_, index) =>
    registerLayeredLight(scene, {
      position: [index * 5, 8, 0],
      radius: 10,
      pattern: "leaves",
    }),
  );
  updateLayeredLighting(scene, 0, { viewerPosition: new THREE.Vector3(30, 0, 0) });
  assert.equal(records[0].patch.visible, false);
  assert.equal(records[6].patch.visible, true);
  for (const record of records) record.dispose();
  floor.geometry.dispose();
  floor.material.dispose();
});

test("course probes stay bounded and cover open sectors plus authored interiors", () => {
  const open = Array.from({ length: 8 }, (_, i) => ({
    id: `sector-${i}`,
    start: i / 8,
    end: (i + 1) / 8,
  }));
  const openProbes = selectCourseProbeSectors({ SECTIONS: open });
  assert.equal(openProbes.length, 4);
  assert.equal(new Set(openProbes.map(({ section }) => section.id)).size, 4);
  assert.ok(openProbes.every((probe) => !probe.enclosed));

  const mixedProbes = selectCourseProbeSectors({
    SECTIONS: open.map((section, i) => ({
      ...section,
      ...(i === 2 ? { id: "rootwood" } : {}),
      ...(i === 6 ? { enclosed: true } : {}),
    })),
  });
  assert.equal(mixedProbes.length, 4);
  assert.ok(mixedProbes.some(({ section }) => section.id === "rootwood"));
  assert.ok(mixedProbes.some(({ section }) => section.id === "sector-6"));
});
