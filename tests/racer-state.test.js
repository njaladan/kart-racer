import test from "node:test";
import assert from "node:assert/strict";
import { createRacerState } from "../racer-state.js";

test("racer state factory initializes owned fields and isolated vector state", () => {
  const first = createRacerState({
    name: "MISO",
    s: -18,
    x: -0.35,
    speed: 163,
    skill: 0.91,
  });
  const second = createRacerState({ name: "PIP", s: -30 });

  assert.equal(first.name, "MISO");
  assert.equal(first.s, -18);
  assert.equal(first.speed, 163);
  assert.equal(first.skill, 0.91);
  assert.equal(first.finished, false);
  assert.equal(first.item, null);
  assert.equal(first.grounded, true);
  assert.equal(first.vx, 0);
  assert.notEqual(first.worldPos, second.worldPos);
  assert.notEqual(first.renderFrom, second.renderFrom);
});
