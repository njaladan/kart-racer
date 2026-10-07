import test from "node:test";
import assert from "node:assert/strict";
import { createRaceItems } from "../src/simulation/race-items.js";
import { createRaceGrid } from "../src/simulation/race-grid.js";
import { RACERS } from "../src/rendering/racer-roster.js";
import { selectCourse, laneWidth, poseAt } from "../src/track/track.js";
import { DEFAULT_COURSE } from "../src/courses/registry.js";

function setup(boxes = []) {
  selectCourse(DEFAULT_COURSE);
  const racers = createRaceGrid(RACERS);
  const removed = [],
    used = [],
    inventories = [];
  const items = createRaceItems({
    racers,
    boxes,
    createEffect: (kind) => ({ kind }),
    removeEffect: (mesh) => removed.push(mesh),
    onHit: () => false,
    onUse: (racer, type) => used.push({ racer, type }),
    onInventory: (racer) => inventories.push(racer),
  });
  return { racers, items, removed, used, inventories };
}

test("pickups go to one racer, respect held inventory, and respawn on the race clock", () => {
  const box = { s: 0, x: 0, active: true, respawn: 0 };
  const {
    items,
    racers: [player],
  } = setup([box]);
  // Place the pickup at the player's grid slot, independent of grid order.
  box.s = player.s;
  box.x = player.x;
  items.step(0.01, 0);
  assert.ok(player.item);
  assert.equal(box.active, false);
  const respawn = box.respawn;
  assert.ok(respawn >= 10 && respawn <= 14);
  items.step(respawn / 2, 0);
  assert.equal(box.active, false);
  items.step(respawn, 0);
  assert.equal(box.active, true);
  const item = player.item;
  items.step(0.01, 0);
  assert.equal(box.active, true);
  assert.equal(player.item, item);
  player.item = null;
  player.finished = true;
  items.step(0.01, 0);
  assert.equal(box.active, true);
});

test("active effects expire exactly once and restart removes effects and restores pickups", () => {
  const box = { s: 500, x: 0, active: false, respawn: 5 };
  const {
    items,
    racers: [player],
    removed,
  } = setup([box]);
  items.setItem(player, "banana");
  items.fire(player);
  assert.equal(items.bananas.length, 1);
  const [banana] = items.bananas;
  assert.equal(banana.s, player.s - 14);
  assert.equal(banana.x, player.x);
  assert.deepEqual(banana.worldPos, poseAt(banana.s, laneWidth(player.x), 0.25).p);
  assert.equal(player.item, null);
  items.fire(player);
  assert.equal(items.bananas.length, 1);
  const expired = items.bananas.map((banana) => banana.mesh);
  items.step(19, 0);
  assert.deepEqual(removed, expired.toReversed());
  items.step(1, 0);
  assert.equal(removed.length, 1);
  items.setItem(player, "green");
  items.fire(player);
  items.setItem(player, "banana");
  items.fire(player);
  const active = [...items.projectiles, ...items.bananas].map((effect) => effect.mesh);
  items.reset();
  assert.deepEqual(removed.slice(1), active);
  assert.equal(items.projectiles.length, 0);
  assert.equal(items.bananas.length, 0);
  assert.equal(box.active, true);
  assert.equal(box.respawn, 0);
  items.reset();
  assert.equal(removed.length, 3);
});

test("all three mushroom charges emit use events and blocked uses leave inventory intact", () => {
  const {
    items,
    racers: [player],
    used,
    inventories,
  } = setup();
  items.setItem(player, "mushroom");
  player.spin = 1;
  items.fire(player);
  assert.equal(player.itemCount, 3);
  assert.equal(used.length, 0);
  player.spin = 0;
  for (let i = 0; i < 4; i++) items.fire(player);
  assert.equal(used.length, 3);
  assert.equal(inventories.length, 4);
  assert.equal(player.item, null);
  assert.ok(player.boost > 2.8);
});
