import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import frostpeak from "../src/courses/frostpeak-festival.js";
import { createCourseLighting, registerLightPool } from "../src/rendering/course-lighting.js";
import { registerLayeredLight } from "../src/rendering/layered-lighting.js";
import { selectCourse } from "../src/track/track.js";

test("racer light slots select finite baseline and layered sources with smooth distance fade", () => {
  const track = selectCourse(frostpeak);
  const scene = new THREE.Scene();
  const racerPosition = new THREE.Vector3(0, 0, 0);
  const baseline = registerLightPool(scene, {
    position: [0, 0, 13.3],
    color: "#ff8844",
    intensity: 5,
    radius: 14,
  });
  const layered = registerLayeredLight(scene, {
    position: [0, 0, 4],
    color: "#42c8ff",
    intensity: 8,
    radius: 20,
    kind: "practical",
  });
  const ambientLight = { intensity: 0 };
  const sun = { intensity: 0 };
  const environmentMaps = {
    exterior: new THREE.Texture(),
    interior: new THREE.Texture(),
    forPosition: () => new THREE.Texture(),
  };
  const lighting = createCourseLighting(scene, {
    theme: { ambientIntensity: 1.4, sunIntensity: 1.2, environmentIntensity: 0.5 },
    ambientLight,
    sun,
    environmentMaps,
  });
  lighting.setQuality(2);
  lighting.update(1 / 60, racerPosition, track.SECTIONS[0], [], 3, { motionEnabled: true });

  const [layeredSlot, baselineSlot, unusedSlot] = lighting.lights;
  assert.ok(Number.isFinite(layeredSlot.intensity) && layeredSlot.intensity > 0);
  assert.deepEqual(layeredSlot.position.toArray(), [0, 0, 4]);
  assert.equal(layeredSlot.color.getHex(), new THREE.Color("#42c8ff").getHex());
  assert.ok(Number.isFinite(baselineSlot.intensity) && baselineSlot.intensity > 0);
  assert.deepEqual(baselineSlot.position.toArray(), baseline.position.toArray());
  assert.equal(baselineSlot.color.getHex(), new THREE.Color("#ff8844").getHex());

  const normalizedDistance = baseline.position.distanceTo(racerPosition) / baseline.radius;
  const expectedFade = THREE.MathUtils.smoothstep(1.25 - normalizedDistance, 0, 0.35);
  assert.ok(Math.abs(baselineSlot.intensity - baseline.intensity * expectedFade) < 1e-9);
  assert.equal(unusedSlot.intensity, 0);
  assert.ok(Number.isFinite(unusedSlot.intensity));
  // The layered source has a bake marker, but runtime selection must not add it twice.
  assert.equal(scene.userData.localLightPools.length, 2);
  assert.equal(layered.pool.layerRecord, layered);
  assert.equal(layeredSlot.intensity, layered.currentIntensity);

  layered.dispose();
  for (const light of lighting.lights) light.removeFromParent();
  for (const texture of [environmentMaps.exterior, environmentMaps.interior]) texture.dispose();
});
