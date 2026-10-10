import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import course from "../src/courses/sunstone-ruins.js";
import { installDesertMirage } from "../src/rendering/desert-mirage.js";
import { installSurfaceDetail } from "../src/rendering/surface-detail.js";
import { createPostProcessing } from "../src/rendering/postprocessing.js";
import { selectCourse } from "../src/track/track.js";
import { createCourseKit, batchScenery } from "../src/rendering/course-kit.js";
import { buildDesertHorizon } from "../src/courses/sunstone-ruins/build-desert-horizon.js";

test("backdrop refraction composes with detail and handles world transforms without a camera filter", () => {
  const material = new THREE.MeshStandardMaterial();
  installSurfaceDetail(material);
  installDesertMirage(material, course.theme.desertMirage);
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
  buildDesertHorizon({ THREE, scenery, track, kit, textures: {} });
  const backdropMaterials = new Set();
  for (const root of scenery.children) {
    if (!root.userData.desertTerrain && !root.userData.desertLandmark) continue;
    root.traverse((object) => {
      if (object.isMesh) backdropMaterials.add(object.material);
    });
  }
  assert.equal(backdropMaterials.size, 4);
  for (const material of backdropMaterials) {
    assert.equal(material.userData["desert-backdrop-mirage-v1"], true);
    assert.equal(material.userData.excludeFromReflectionProbe, true);
  }
  assert.equal(road.material.userData["desert-backdrop-mirage-v1"], undefined);
  batchScenery(scenery);
  scenery.traverse((object) => {
    if (object.isMesh && object.material.userData["desert-backdrop-mirage-v1"])
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
