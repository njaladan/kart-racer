import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import frostpeak from "../src/courses/frostpeak-festival.js";
import { createSurfaceInteractions } from "../src/rendering/surface-interactions.js";
import { racerProjection } from "../src/track/route-branches.js";
import { selectCourse } from "../src/track/track.js";

function racerOnSnowBranch(track, branch, q = 0.46) {
  const pose = branch.poseAt(q, 0, 0);
  return {
    s: (branch.start + (branch.end - branch.start) * q) * track.TRACK,
    routeChoice: branch.index,
    worldPos: pose.p.clone(),
    yaw: track.yawFor(pose.tangent),
    grounded: true,
    speed: 16,
    driftDirection: 0,
    lateralSpeed: 0,
    steering: 0,
    scale: 1,
    boost: 0,
    star: 0,
    driftTier: 0,
    driftBoostTier: 0,
  };
}

function floorTrailPositions(trails, count = trails.count) {
  const matrix = new THREE.Matrix4();
  return Array.from({ length: count }, (_, index) => {
    trails.getMatrixAt(index, matrix);
    return new THREE.Vector3().setFromMatrixPosition(matrix);
  });
}

test("alternate-route tire contacts follow the selected snow branch floor", () => {
  const track = selectCourse(frostpeak);
  const branch = track.branches.find((candidate) => candidate.material === "snow");
  assert.ok(branch, "Frostpeak has an authored snow route");
  const racer = racerOnSnowBranch(track, branch);
  const scene = new THREE.Scene();
  const effects = createSurfaceInteractions(scene, track, [racer]);

  effects.update(1, { running: true, motionEnabled: true });
  assert.equal(effects.trails.count, 2);
  const selectedSurface = racerProjection(track, racer);
  const mainRoadSurface = track.projectTrack(racer.worldPos, racer.s);
  assert.equal(selectedSurface.branchIndex, branch.index);
  assert.ok(Math.abs(selectedSurface.height - mainRoadSurface.height) > 1);
  for (const contact of floorTrailPositions(effects.trails)) {
    const expected = racerProjection(track, racer, contact).height + 0.027;
    assert.ok(Math.abs(contact.y - expected) < 0.002, "contact is lifted above its branch floor");
  }

  effects.dispose();
});

test("tire trails remain capped at 256 instances under sustained multi-racer contact", () => {
  const track = selectCourse(frostpeak);
  const branch = track.branches.find((candidate) => candidate.material === "snow");
  const racers = Array.from({ length: 140 }, () => racerOnSnowBranch(track, branch));
  const scene = new THREE.Scene();
  const effects = createSurfaceInteractions(scene, track, racers);

  effects.update(1, { running: true, motionEnabled: true });
  assert.equal(effects.trails.instanceMatrix.count, 256);
  assert.equal(effects.trails.geometry.getAttribute("trailBirth").count, 256);
  assert.equal(effects.trails.count, 256);

  effects.dispose();
});

test("reduced motion hides trails, reset clears their history, and disposal removes racer lights", () => {
  const track = selectCourse(frostpeak);
  const branch = track.branches.find((candidate) => candidate.material === "snow");
  const racer = racerOnSnowBranch(track, branch);
  const scene = new THREE.Scene();
  const effects = createSurfaceInteractions(scene, track, [racer]);
  const [light] = effects.lights.values();

  effects.update(1, { running: true, motionEnabled: true });
  assert.equal(effects.trails.count, 2);
  effects.update(1.1, { running: true, motionEnabled: false });
  assert.equal(effects.trails.visible, false);
  assert.equal(effects.trails.count, 2);

  racer.worldPos.add(new THREE.Vector3(0.2, 0, 0));
  effects.update(1.2, { running: true, motionEnabled: true });
  assert.equal(effects.trails.visible, true);
  assert.equal(effects.trails.count, 4);

  effects.reset();
  assert.equal(effects.trails.count, 0);
  assert.ok(
    effects.trails.geometry.getAttribute("trailBirth").array.every((value) => value === -1000),
  );
  effects.update(1.3, { running: true, motionEnabled: true });
  assert.equal(effects.trails.count, 2);

  effects.dispose();
  assert.equal(scene.children.includes(effects.trails), false);
  assert.equal(light.disposed, true);
  assert.equal(scene.userData.layeredLights.length, 0);
});
