import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import course from "../src/courses/sunstone-ruins.js";
import { createDesertMirage } from "../src/rendering/desert-mirage.js";
import { createPostProcessing } from "../src/rendering/postprocessing.js";

test("mirage follows the actual pitched camera horizon and freezes, rewinds and respects reduced motion", () => {
  const effect = createDesertMirage(course.theme),
    camera = new THREE.PerspectiveCamera(63, 1.5, 0.1, 1400);
  camera.position.set(12, 8, 25);
  camera.lookAt(12, 5, -10);
  camera.updateMatrixWorld();
  effect.updateCamera(camera);
  const horizon = new THREE.Vector3(12, 8, -100).project(camera).y * 0.5 + 0.5;
  assert.ok(Math.abs(effect.uniforms.mirageHorizon.value - horizon) < 1e-7);
  for (const time of [0, 12.5, 12.5, 0]) {
    effect.update(time);
    assert.equal(effect.uniforms.mirageTime.value, time);
  }
  effect.update(23, false);
  assert.equal(effect.uniforms.mirageMotion.value, 0);
  assert.equal(
    effect.uniforms.mirageStrength.value,
    1,
    "reduced motion retains the static distance atmosphere",
  );
  effect.update(25, true, false);
  assert.equal(effect.uniforms.mirageStrength.value, 0, "the buried engine remains clear indoors");
});

test("desert mirage captures real depth on every quality tier; other Performance courses render directly", () => {
  for (const desert of [false, true]) {
    let target = null;
    const draws = [];
    const renderer = {
      toneMapping: THREE.NeutralToneMapping,
      getDrawingBufferSize: (size) => size.set(640, 360),
      setRenderTarget: (t) => {
        target = t;
      },
      render: (scene) => draws.push({ target, scene, material: scene.children[0]?.material }),
    };
    const post = createPostProcessing(renderer, desert ? course.theme : {}),
      scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(63, 16 / 9, 0.1, 1400);
    for (const tier of [0, 1, 3]) {
      draws.length = 0;
      post.setQuality(tier);
      post.setDesertMirage(5, true);
      post.render(scene, camera);
      assert.equal(renderer.toneMapping, THREE.NeutralToneMapping);
      if (tier === 0 && !desert) {
        assert.equal(draws.length, 1);
        assert.equal(draws[0].target, null);
        continue;
      }
      const grade = draws.at(-1).material;
      assert.equal(draws.at(-1).target, null);
      if (desert) {
        assert.ok(draws[0].target.depthTexture);
        assert.equal(grade.uniforms.mirageDepth.value, draws[0].target.depthTexture);
        assert.equal(grade.uniforms.mirageTime.value, 5);
        assert.equal(grade.defines.USE_DESERT_MIRAGE, 1);
      }
    }
    post.dispose();
  }
});
