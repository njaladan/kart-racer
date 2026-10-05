import test from "node:test";
import assert from "node:assert/strict";
import {
  createShell,
  advanceShell,
  sweptDistanceSquared,
  consumeItem,
  itemWeights,
  chooseItem,
  MAX_QUEUED_BOOST,
} from "../src/simulation/items.js";
import { initializeRacer } from "../src/simulation/simulation.js";
import { poseAt, frameAt, yawFor, projectTrack, collisionBounds } from "../src/track/track.js";
import { FIXED_DT } from "../src/simulation/physics.js";

test("green shells keep their firing heading and reflect at physical barriers", () => {
  const owner = initializeRacer({ s: 350, x: 0, drift: 0 });
  const shell = createShell(owner, "green");
  const yaw = shell.yaw;
  for (let i = 0; i < 5; i++) advanceShell(shell, FIXED_DT);
  assert.equal(shell.yaw, yaw);
  const f = frameAt(owner.s / 2400);
  shell.worldPos.copy(poseAt(owner.s, collisionBounds(owner.s / 2400, 0.55).right - 0.1, 0.6).p);
  shell.vx = f.right.x * 44;
  shell.vz = f.right.z * 44;
  advanceShell(shell, 0.02);
  const surface = projectTrack(shell.worldPos, owner.s);
  assert.ok(shell.vx * surface.horizontalRight.x + shell.vz * surface.horizontalRight.z < 0);
  assert.ok(surface.offset <= collisionBounds(surface.t, 0.55).right + 0.02);
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

test("shells are consumed once and the inventory can accept the next pickup", () => {
  for (const type of ["green", "red"]) {
    const racer = { item: type, itemCount: 1, spin: 0 };
    assert.equal(consumeItem(racer), type);
    assert.equal(racer.item, null);
    assert.equal(racer.itemCount, 0);
    assert.equal(consumeItem(racer), null);
    assert.equal(racer.itemCount, 0);
    racer.item = "mushroom";
    racer.itemCount = 3;
    assert.equal(consumeItem(racer), "mushroom");
  }
});

test("rapid mushroom uses deliver all three boosts and blocked uses preserve charges", () => {
  const racer = { item: "mushroom", itemCount: 3, boost: 0, spin: 1 };
  assert.equal(consumeItem(racer), null);
  assert.equal(racer.itemCount, 3);
  racer.spin = 0;
  for (let i = 0; i < 3; i++) consumeItem(racer);
  assert.equal(racer.boost, MAX_QUEUED_BOOST);
  assert.equal(racer.item, null);
  assert.equal(consumeItem(racer), null);
  racer.item = "mushroom";
  racer.itemCount = 3;
  consumeItem(racer);
  assert.equal(racer.boost, MAX_QUEUED_BOOST);
  racer.boost = 3.3;
  consumeItem(racer);
  assert.equal(racer.boost, 3.3, "an existing longer boost must not be shortened");
});

test("comeback odds follow distance behind, apply to every racer, and stay bounded", () => {
  const leader = { s: 2000, speed: 100 };
  const close = { s: 1950, speed: 100 };
  const far = { s: 1000, speed: 100 };
  const pack = [leader, close, far];
  assert.deepEqual(itemWeights(leader, pack), itemWeights(close, pack));
  const weights = itemWeights(far, pack);
  assert.ok(weights.mushroom > itemWeights(leader, pack).mushroom);
  assert.ok(weights.star > itemWeights(leader, pack).star);
  assert.ok(weights.banana < itemWeights(leader, pack).banana);
  assert.deepEqual(weights, itemWeights({ ...far, isPlayer: true }, pack));
  assert.deepEqual(weights, itemWeights({ s: -10000, speed: 0 }, pack));
  const counts = {};
  for (let i = 0; i < 100; i++) {
    const type = chooseItem(far, pack, (i + 0.5) / 100);
    counts[type] = (counts[type] || 0) + 1;
  }
  assert.deepEqual(counts, weights);
});
