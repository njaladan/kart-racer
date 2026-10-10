import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import course from "../src/courses/sunstone-ruins.js";
import { createDesertMirageClock, installDesertMirage } from "../src/rendering/desert-mirage.js";
import { installSurfaceDetail } from "../src/rendering/surface-detail.js";
import { createPostProcessing } from "../src/rendering/postprocessing.js";
import { selectCourse } from "../src/track/track.js";
import { createCourseKit, batchScenery } from "../src/rendering/course-kit.js";
import { buildDesertHorizon } from "../src/courses/sunstone-ruins/build-desert-horizon.js";

test("backdrop refraction composes with detail and handles world transforms without a camera filter", () => {
  const material = new THREE.MeshStandardMaterial();
  installSurfaceDetail(material);
  const clock = createDesertMirageClock();
  installDesertMirage(material, course.theme.desertMirage, clock);
  const shader = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  };
  material.onBeforeCompile(shader);
  assert.match(shader.vertexShader, /vSurfaceWorld/);
  assert.match(shader.vertexShader, /instanceMatrix\*mvPosition/);
  assert.match(shader.vertexShader, /batchingMatrix\*mvPosition/);
  assert.match(shader.vertexShader, /mirageWorld.xz-cameraPosition.xz/);
  assert.doesNotMatch(shader.vertexShader, /mirageTime|vUv|mirageHorizon/);
  clock.update(2.5);
  assert.equal(shader.uniforms.desertMirageTime.value, 2.5);
  assert.equal(shader.uniforms.desertMirageRange.value.x, 450);
  assert.equal(shader.uniforms.desertMirageRange.value.y, 800);
});

test("mirage materials belong exclusively to the backdrop, including after batching", () => {
  const track = selectCourse(course),
    scenery = new THREE.Group();
  const scene = new THREE.Scene();
  scene.add(scenery);
  const kit = createCourseKit(scenery, track);
  const roadMaterial = kit.material("#ffffff");
  const road = kit.mesh(new THREE.BoxGeometry(10, 1, 2000), roadMaterial);
  const motions = [];
  buildDesertHorizon({ THREE, scenery, track, kit, textures: {}, motions });
  const backdropMaterials = new Set();
  for (const root of scenery.children) {
    if (!root.userData.desertTerrain && !root.userData.desertLandmark) continue;
    root.traverse((object) => {
      if (object.isMesh) backdropMaterials.add(object.material);
    });
  }
  assert.equal(backdropMaterials.size, 4);
  for (const material of backdropMaterials) {
    assert.equal(material.userData["desert-backdrop-mirage-v2"], true);
    assert.equal(material.userData.excludeFromReflectionProbe, true);
  }
  assert.equal(road.material.userData["desert-backdrop-mirage-v2"], undefined);
  const clocks = [...backdropMaterials].map((material) => {
    const shader = {
      uniforms: {},
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    };
    material.onBeforeCompile(shader);
    return shader.uniforms.desertMirageTime;
  });
  assert.ok(
    clocks.every((clock) => clock === clocks[0]),
    "all backdrop waves use one clock",
  );
  assert.equal(motions.length, 1);
  for (const time of [0, 4.5, 4.5, 0]) {
    motions[0](time);
    assert.ok(
      clocks.every((clock) => clock.value === time),
      "pause and restart retain deterministic phases",
    );
  }
  motions[0](12, { motionEnabled: false });
  assert.ok(clocks.every((clock) => clock.value === 0));
  motions[0](15, { bake: true });
  assert.ok(clocks.every((clock) => clock.value === 0));
  batchScenery(scenery);
  scenery.traverse((object) => {
    if (object.isMesh && object.material.userData["desert-backdrop-mirage-v2"])
      assert.ok(backdropMaterials.has(object.material));
  });
});

test("Performance renders the desert directly without a distortion capture pass", () => {
  const draws = [];
  const renderer = { render: (...args) => draws.push(args) };
  const post = createPostProcessing(renderer, course.theme);
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera();
  post.setQuality(0);
  post.render(scene, camera);
  assert.deepEqual(draws, [[scene, camera]]);
  post.dispose();
});
