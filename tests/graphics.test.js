import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { ParticlePool } from "../src/rendering/particle-pool.js";
import { bakeVertexShade } from "../src/rendering/vertex-shading.js";
import { createStableShadowFollower } from "../src/rendering/shadow-follower.js";
import { batchStaticMeshes } from "../src/rendering/visuals.js";

test("sparks remain bounded and expire without allocating or leaking scene objects", () => {
  const scene = new THREE.Scene(),
    pool = new ParticlePool(scene, 4);
  const geometry = pool.mesh.geometry,
    material = pool.mesh.material;
  const position = new THREE.Vector3(1, 2, 3);
  for (let i = 0; i < 20; i++) pool.spawn(position, "#ff8844", 0.5, 0.1);
  assert.equal(pool.count, 4);
  assert.equal(scene.children.length, 1);
  pool.sync();
  assert.equal(pool.mesh.count, 4);
  pool.step(0.25);
  pool.spawn(position, "#22ddff", 1, 0.2);
  pool.step(0.3);
  pool.sync();
  assert.equal(pool.count, 1);
  assert.equal(pool.mesh.count, 1);
  assert.ok(pool.opacity.getX(0) > 0 && pool.opacity.getX(0) < 1);
  assert.equal(pool.mesh.geometry, geometry);
  assert.equal(pool.mesh.material, material);
  pool.clear();
  assert.equal(pool.mesh.count, 0);
  assert.equal(pool.mesh.visible, false);
  pool.spawn(position, "#ffffff", 0.1);
  pool.step(0.2);
  pool.sync();
  assert.equal(pool.count, 0);
  assert.equal(scene.children.length, 1);
});

test("static batching retains baked shading and neutral colors on unshaded pieces", () => {
  const group = new THREE.Group(),
    material = new THREE.MeshStandardMaterial({ vertexColors: true });
  const shaded = bakeVertexShade(new THREE.BoxGeometry(1, 1, 1));
  const neutral = new THREE.BoxGeometry(1, 1, 1);
  group.add(new THREE.Mesh(shaded, material), new THREE.Mesh(neutral, material));
  const expected = [...shaded.getAttribute("color").array];
  batchStaticMeshes(group);
  assert.equal(group.children.length, 1);
  const colors = group.children[0].geometry.getAttribute("color");
  assert.deepEqual([...colors.array.slice(0, expected.length)], expected);
  assert.ok([...colors.array.slice(expected.length)].every((v) => v === 1));
});

test("shadow following snaps in light space while preserving sun direction", () => {
  const sun = new THREE.DirectionalLight();
  sun.shadow.camera.left = sun.shadow.camera.bottom = -48;
  sun.shadow.camera.right = sun.shadow.camera.top = 48;
  sun.shadow.mapSize.set(2048, 2048);
  const follow = createStableShadowFollower(sun);
  const direction = new THREE.Vector3(-65, 95, 45).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right);
  const texel = 96 / 2048;
  follow(new THREE.Vector3());
  follow(right.clone().multiplyScalar(texel * 0.2));
  assert.ok(Math.abs(sun.target.position.dot(right)) < 1e-9);
  const p = new THREE.Vector3(120.1, 12.9, -56.4);
  follow(p);
  for (const axis of [right, up]) {
    const cells = sun.target.position.dot(axis) / texel;
    assert.ok(Math.abs(cells - Math.round(cells)) < 1e-8);
    assert.ok(Math.abs(sun.target.position.clone().sub(p).dot(axis)) <= texel / 2 + 1e-9);
  }
  assert.ok(sun.position.clone().sub(sun.target.position).normalize().distanceTo(direction) < 1e-9);
});

test("surface, wind and atmospheric modifiers compose without losing earlier bake hooks", async () => {
  const { installSurfaceDetail, installHeightHaze, installFoliageWind } =
    await import("../src/rendering/surface-detail.js");
  const scene = new THREE.Scene();
  const material = new THREE.MeshStandardMaterial();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.bakedMarker = { value: 1 };
  };
  installSurfaceDetail(material, { kind: "terrain" });
  installHeightHaze(material, { terrain: "snow" });
  installFoliageWind(scene, material);
  const shader = {
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {},
  };
  material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.bakedMarker.value, 1);
  assert.ok(shader.uniforms.detailStrength.value > 0);
  assert.ok(shader.uniforms.hazeStrength.value > 0);
  assert.equal((shader.vertexShader.match(/vec4 vSurfaceWorldPosition/g) || []).length, 1);
  assert.equal((shader.vertexShader.match(/vec4 vHazeWorldPosition/g) || []).length, 1);
  assert.ok(
    shader.fragmentShader.indexOf("outgoingLight=mix") <
      shader.fragmentShader.indexOf("#include <tonemapping_fragment>"),
  );
  const key = material.customProgramCacheKey();
  installSurfaceDetail(material, { kind: "terrain" });
  assert.equal(material.customProgramCacheKey(), key, "shared materials are not patched twice");
});

test("water keeps dielectric response and pause-safe animation independent of surface UV tiling", async () => {
  const { createWaterMaterial, advanceSurfaceDetails } =
    await import("../src/rendering/surface-detail.js");
  const scene = new THREE.Scene();
  const material = createWaterMaterial({ scene, shoreRadius: 24 });
  assert.equal(material.metalness, 0);
  assert.equal(material.transparent, false);
  assert.equal(material.depthWrite, true);
  const shader = {
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {},
  };
  material.onBeforeCompile(shader);
  advanceSurfaceDetails(scene, 13);
  assert.equal(shader.uniforms.waterTime.value, 13);
  advanceSurfaceDetails(scene, 13);
  assert.equal(shader.uniforms.waterTime.value, 13);
  assert.equal(shader.uniforms.waterRadius.value, 24);
  assert.ok(shader.fragmentShader.includes("texture2D(normalMap,vNormalMapUv*1.83"));
  assert.ok(shader.fragmentShader.includes("waterFresnel"));
  // Fresnel reads the perturbed normal, which must already be declared, and
  // tints diffuse color before Three constructs the physical lighting inputs.
  const fresnel = shader.fragmentShader.indexOf("float waterFresnel");
  assert.ok(shader.fragmentShader.indexOf("#include <normal_fragment_maps>") < fresnel);
  assert.ok(fresnel < shader.fragmentShader.indexOf("#include <lights_physical_fragment>"));
});

test("course reflection probes retain HDR highlights, course palette and enclosed attenuation", async () => {
  const { createReflectionPixels } = await import("../src/rendering/reflection-environments.js");
  const day = createReflectionPixels({ terrain: "grass", sky: "#68bcea", ground: "#6a924b" });
  const night = createReflectionPixels({
    terrain: "concrete",
    sky: "#08122e",
    fog: "#243656",
    ground: "#19202f",
  });
  const inside = createReflectionPixels(
    { terrain: "grass", sky: "#68bcea", ground: "#6a924b" },
    true,
  );
  assert.ok(day.every(Number.isFinite));
  assert.equal(day.length, 256 * 128 * 4);
  assert.ok(
    day.reduce((max, value) => Math.max(max, value), 0) > 1,
    "bright sky sources must survive HDR prefiltering",
  );
  assert.notDeepEqual(day, night);
  const radiance = (data) => data.reduce((sum, value, i) => sum + (i % 4 === 3 ? 0 : value), 0);
  assert.ok(radiance(inside) < radiance(day));
});

test("Ultra wet reflections cap resolution, skip slopes and restore render state even on failure", async () => {
  const { createWetRoadReflections } = await import("../src/rendering/wet-road-reflections.js");
  const effect = createWetRoadReflections();
  const scene = new THREE.Scene();
  scene.userData.wetReflectionSurface = { eligible: true, height: 4 };
  const camera = new THREE.PerspectiveCamera(63, 9 / 16, 0.1, 750);
  camera.position.set(0, 9, 15);
  camera.lookAt(0, 4, 0);
  camera.updateMatrixWorld();
  const originalTarget = {};
  const originalClipping = [];
  let activeTarget = originalTarget;
  let captures = 0;
  let shouldFail = false;
  const renderer = {
    clippingPlanes: originalClipping,
    shadowMap: { autoUpdate: true },
    xr: { enabled: true },
    getDrawingBufferSize: (size) => size.set(1080, 1920),
    getRenderTarget: () => activeTarget,
    setRenderTarget: (value) => {
      activeTarget = value;
    },
    clear() {},
    render: (_scene, mirror) => {
      captures++;
      assert.ok(activeTarget.width <= 640 && activeTarget.height <= 640);
      assert.equal(mirror.position.y, 2 * scene.userData.wetReflectionSurface.height - 9);
      assert.equal(renderer.shadowMap.autoUpdate, false);
      assert.equal(renderer.xr.enabled, false);
      assert.ok(renderer.clippingPlanes[0].distanceToPoint(new THREE.Vector3(0, 3, 0)) < 0);
      if (shouldFail) throw new Error("capture failed");
    },
  };
  for (const tier of [0, 1, 2]) {
    effect.setQuality(tier);
    effect.render(renderer, scene, camera);
  }
  assert.equal(captures, 0);
  effect.setQuality(3);
  effect.render(renderer, scene, camera);
  effect.render(renderer, scene, camera);
  assert.equal(captures, 1, "second frame reuses the saved image and projection");
  scene.userData.wetReflectionSurface.frozen = true;
  effect.render(renderer, scene, camera);
  effect.render(renderer, scene, camera);
  assert.equal(captures, 1, "paused frames reuse the reflection without additional captures");
  assert.equal(activeTarget, originalTarget);
  assert.equal(renderer.clippingPlanes, originalClipping);
  assert.equal(renderer.shadowMap.autoUpdate, true);
  assert.equal(renderer.xr.enabled, true);
  scene.userData.wetReflectionSurface.eligible = false;
  effect.render(renderer, scene, camera);
  assert.equal(captures, 1);
  scene.userData.wetReflectionSurface = { eligible: true, height: 5 };
  shouldFail = true;
  assert.throws(() => effect.render(renderer, scene, camera), /capture failed/);
  assert.equal(activeTarget, originalTarget);
  assert.equal(renderer.clippingPlanes, originalClipping);
  assert.equal(renderer.shadowMap.autoUpdate, true);
  assert.equal(renderer.xr.enabled, true);
  effect.dispose();
});
