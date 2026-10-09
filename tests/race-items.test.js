import test from "node:test";
import assert from "node:assert/strict";
import { createRaceItems, ITEM_ROLL_DURATION } from "../src/simulation/race-items.js";
import { createRaceGrid } from "../src/simulation/race-grid.js";
import { RACERS } from "../src/rendering/racer-roster.js";
import { selectCourse, laneWidth, poseAt } from "../src/track/track.js";
import { DEFAULT_COURSE } from "../src/courses/registry.js";

function setup(boxes = []) {
  selectCourse(DEFAULT_COURSE);
  const racers = createRaceGrid(RACERS);
  const removed = [],
    used = [],
    inventories = [],
    collected = [],
    rolled = [],
    selected = [];
  const items = createRaceItems({
    racers,
    boxes,
    createEffect: (kind) => ({ kind }),
    removeEffect: (mesh) => removed.push(mesh),
    onHit: () => false,
    onUse: (racer, type) => used.push({ racer, type }),
    onInventory: (racer) => inventories.push(racer),
    onCollect: (racer, awarded) => collected.push({ racer, awarded }),
    onRoll: (racer, tick) => rolled.push({ racer, tick, preview: racer.itemPreview }),
    onSelect: (racer) => selected.push(racer),
  });
  return { racers, items, removed, used, inventories, collected, rolled, selected };
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
  assert.equal(player.item, null);
  assert.equal(player.itemRoulette, ITEM_ROLL_DURATION);
  assert.equal(box.active, false);
  const respawn = box.respawn;
  assert.ok(respawn >= 10 && respawn <= 14);
  items.step(respawn / 2, 0);
  assert.equal(box.active, false);
  items.step(respawn, 0);
  assert.equal(box.active, true);
  const item = player.item;
  items.step(0.01, 0);
  assert.equal(box.active, false);
  assert.equal(player.item, item);
  player.item = null;
  player.finished = true;
  box.active = true;
  items.step(0.01, 0);
  assert.equal(box.active, true);
});

test("roulette cycles previews, blocks use, and awards once when the race clock reaches selection", () => {
  const box = { s: 0, x: 0, active: true, respawn: 0 };
  const {
    items,
    racers: [player, rival],
    collected,
    rolled,
    selected,
    used,
  } = setup([box]);
  box.s = player.s;
  box.x = player.x;
  Object.assign(rival, { s: player.s, x: player.x });
  rival.worldPos.copy(player.worldPos);
  items.step(0.01, 0);
  assert.equal(collected.length, 1);
  assert.equal(collected[0].awarded, true);
  assert.equal(rival.itemRoulette, 0);
  items.fire(player);
  assert.equal(used.length, 0);
  items.step(0.8, 0.8);
  assert.equal(player.item, null);
  assert.ok(rolled.length > 4);
  assert.ok(rolled.slice(1).every((entry, i) => entry.preview !== rolled[i].preview));
  box.active = true;
  items.step(0.01, 0.81);
  assert.equal(box.active, false);
  assert.equal(collected.at(-1).awarded, false);
  assert.ok(player.itemRoulette < 0.8, "another crush does not restart the roll");
  items.step(0.79, 1.6);
  assert.ok(player.item);
  assert.equal(player.itemRoulette, 0);
  assert.equal(player.itemPreview, null);
  assert.equal(player.itemCount, player.item === "mushroom" ? 3 : 1);
  assert.deepEqual(selected, [player]);
  const ticks = rolled.length;
  items.step(1, 2.6);
  assert.equal(selected.length, 1);
  assert.equal(rolled.length, ticks);
});

test("crushing with a held item preserves every charge and emits a distinct event", () => {
  const box = { s: 0, x: 0, active: true, respawn: 0 };
  const {
    items,
    racers: [player],
    collected,
    rolled,
    inventories,
  } = setup([box]);
  box.s = player.s;
  box.x = player.x;
  items.setItem(player, "mushroom");
  player.itemCount = 2;
  items.step(0.01, 0);
  assert.equal(box.active, false);
  assert.equal(player.item, "mushroom");
  assert.equal(player.itemCount, 2);
  assert.equal(collected[0].awarded, false);
  assert.equal(rolled.length, 0);
  assert.equal(inventories.length, 1);
});

test("reset and finish cancel pending lotteries without awarding or sounding later", () => {
  const box = { s: 0, x: 0, active: true, respawn: 0 };
  const {
    items,
    racers: [player],
    selected,
  } = setup([box]);
  box.s = player.s;
  box.x = player.x;
  items.step(0.01, 0);
  items.reset();
  box.active = false;
  box.respawn = 10;
  items.step(2, 2);
  assert.equal(player.item, null);
  assert.equal(player.itemPreview, null);
  assert.equal(player.itemRoulette, 0);
  box.active = true;
  items.step(0.01, 2);
  player.finished = true;
  items.step(2, 4);
  assert.equal(player.itemRoulette, 0);
  assert.equal(player.itemCount, 0);
  assert.equal(selected.length, 0);
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
