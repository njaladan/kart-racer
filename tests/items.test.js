import test from "node:test";
import assert from "node:assert/strict";
import { createShell, advanceShell, sweptDistanceSquared } from "../items.js";
import { initializeRacer } from "../simulation.js";
import { poseAt, frameAt, yawFor, projectTrack } from "../track.js";
import { FIXED_DT } from "../physics.js";

test("green shells keep their firing heading and reflect at physical barriers", () => {
  const owner = initializeRacer({ s: 350, x: 0, drift: 0 });
  const shell = createShell(owner, "green");
  const yaw = shell.yaw;
  for (let i = 0; i < 5; i++) advanceShell(shell, FIXED_DT);
  assert.equal(shell.yaw, yaw);
  const f = frameAt(owner.s / 2400);
  shell.worldPos.copy(poseAt(owner.s, 8.9, 0.6).p);
  shell.vx = f.right.x * 44;
  shell.vz = f.right.z * 44;
  advanceShell(shell, 0.02);
  const surface = projectTrack(shell.worldPos, owner.s);
  assert.ok(
    shell.vx * surface.horizontalRight.x +
      shell.vz * surface.horizontalRight.z <
      0,
  );
  assert.ok(Math.abs(surface.offset) <= 9.01);
});
test("red shell steering has a bounded turning rate", () => {
  const owner = initializeRacer({ s: 350, x: 0, drift: 0 }),
    target = initializeRacer({ s: 420, x: 0.5, drift: 0 }),
    shell = createShell(owner, "red", target),
    yaw = shell.yaw;
  advanceShell(shell, FIXED_DT);
  assert.ok(Math.abs(shell.yaw - yaw) <= 4.8 * FIXED_DT + 0.000001);
});
test("swept collision finds a target crossed between frames without hitting distant or elevated targets", () => {
  const start = { x: 0, y: 0.6, z: 0 },
    end = { x: 10, y: 0.6, z: 0 };
  assert.equal(sweptDistanceSquared({ x: 5, y: 0.6, z: 0 }, start, end), 0);
  assert.ok(sweptDistanceSquared({ x: 5, y: 4, z: 0 }, start, end) > 9);
  assert.ok(sweptDistanceSquared({ x: 5, y: 0.6, z: 3 }, start, end) >= 9);
});
