import test from "node:test";
import assert from "node:assert/strict";
import { createBoostMotion } from "../src/rendering/boost-motion.js";

test("every boost gets an immediate kick and stars sustain the effect after boost expires", () => {
  for (const duration of [0.55, 0.7, 1.05, 1.5, 3.3]) {
    const motion = createBoostMotion();
    const player = { boost: duration, star: 0, spin: 0 };
    const first = motion.update(player, true, 1 / 60);
    assert.ok(first.strength > 0.3 && first.kick > 0.8);
    for (let i = 0; i < 20; i++) motion.update(player, true, 1 / 60);
    const sustained = motion.update({ ...player, boost: 0, star: 2 }, true, 1 / 60);
    assert.ok(sustained.strength > 0.99);
  }
});

test("chained boosts kick again; pause-sized zero steps freeze; reset and reduced motion clear", () => {
  const motion = createBoostMotion();
  const player = { boost: 1, star: 0, spin: 0 };
  let result;
  for (let i = 0; i < 30; i++) result = motion.update(player, true, 1 / 60);
  assert.deepEqual(motion.update(player, true, 0), result);
  const chained = motion.update({ ...player, boost: 1.5 }, true, 1 / 60);
  assert.ok(chained.kick > result.kick + 0.7);
  assert.deepEqual(motion.update(player, false, 1 / 60), { strength: 0, kick: 0 });
  motion.update(player, true, 1 / 60);
  motion.reset();
  assert.deepEqual(motion.update({ ...player, boost: 0 }, true, 1 / 60), { strength: 0, kick: 0 });
});
