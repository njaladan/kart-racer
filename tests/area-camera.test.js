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
