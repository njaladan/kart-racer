import * as THREE from "../vendor/three/three.module.js";
import { buildExperienceWorld } from "../src/courses/experiences/world.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createTrack } from "../src/track/track-builder.js";
import course from "../src/courses/clockwork-citadel.js";
import { clearAreaCamera } from "../src/rendering/area-camera.js";

const track = createTrack(course);

test("chase sightlines clear steep bowl entry, exit and wide banks", () => {
  for (const branch of track.branches)
    for (const [q, offset] of [
      [0.015, 0],
      [0.07, 0],
      [0.5, -30],
      [0.5, 30],
      [0.93, 0],
      [0.985, 0],
    ]) {
      const pose = branch.poseAt(q, offset),
        area = branch.areaSurface;
      const direction = pose.tangent.clone().setY(0).normalize();
      const camera = pose.p.clone().addScaledVector(direction, -10.5);
      camera.y = Math.max(camera.y + 4.7, area.heightAt(camera) + 2.1);
      clearAreaCamera(area, camera, pose.p);
      const target = pose.p.clone();
      target.y += 0.9;
      for (let i = 1; i <= 32; i++) {
        const p = target.clone().lerp(camera, i / 32);
        if (area.contains(p))
          assert.ok(
            p.y >= area.heightAt(p) + 0.35 - 1e-8,
            `clear sightline at q=${q}, offset=${offset}`,
          );
      }
      assert.ok(Number.isFinite(camera.y));
    }
});

test("Frostpeak's powder camera clears the separate quarterpipe behind the kart", async () => {
  const { default: course } = await import("../src/courses/frostpeak-festival.js");
  const { clearMountainCamera } = await import("../src/rendering/area-camera.js");
  const track = createTrack(course),
    t = track.sectorT(4, 0.6);
  const pose = track.poseAt(t * track.TRACK, 45, 0.065);
  const camera = pose.p.clone().addScaledVector(pose.tangent.clone().setY(0).normalize(), -8.7);
  camera.y += 4.7;
  const original = camera.clone();
  clearMountainCamera(track, camera, pose.p, t);
  assert.ok(camera.distanceTo(original) > 0.5, "camera clears the launch face");
  const scene = new THREE.Scene();
  buildExperienceWorld({ scene, track, assets: { models: {} } });
  scene.updateMatrixWorld(true);
  for (const elevation of [0.1, 0.9]) {
    const target = pose.p.clone();
    target.y += elevation;
    const delta = target.clone().sub(camera);
    const ray = new THREE.Raycaster(camera, delta.clone().normalize(), 0, delta.length());
    assert.equal(
      ray
        .intersectObject(scene, true)
        .filter((h) => h.object.name === "Curved quarterpipe with open launch lip").length,
      0,
      "whole kart clears the real ramp triangles",
    );
  }
  const target = pose.p.clone();
  target.y += 0.9;
  for (let i = 1; i <= 32; i++) {
    const p = target.clone().lerp(camera, i / 32),
      ramp = track.mountainSurface.rampAt(p, t);
    if (ramp && ramp.height > 0)
      assert.ok(p.y >= track.mountainSurface.heightAt(p, t) + ramp.height + 0.35 - 1e-8);
  }
});
