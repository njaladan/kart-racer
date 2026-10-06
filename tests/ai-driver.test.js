import test from "node:test";
import assert from "node:assert/strict";
import { botInput, shouldUseBotItem } from "../src/simulation/ai-driver.js";
import { initializeRacer } from "../src/simulation/simulation.js";
import { selectCourse, TRACK, BOOST_PADS, metresToProgress } from "../src/track/track.js";
import { COURSES } from "../src/courses/registry.js";
import { createRaceGrid } from "../src/simulation/race-grid.js";
import { RACERS } from "../src/rendering/racer-roster.js";
import { createRaceSession } from "../src/simulation/race-session.js";
import { drive, FIXED_DT } from "../src/simulation/physics.js";

test("rivals accelerate harder while all human-controlled karts keep the player engine", () => {
  selectCourse(COURSES[0]);
  const racers = createRaceGrid(RACERS);
  const flat = { bank: 0, slope: 0, offroad: false };
  for (let tick = 0; tick < 1200; tick++)
    for (const racer of racers) drive(racer, { throttle: true }, flat, FIXED_DT);
  assert.ok(racers[0].speed < 112);
  assert.ok(racers.slice(1).every((racer) => racer.speed > 120));
  createRaceSession({ racers, items: {}, getPlayerInput: () => ({}), getRacerInput: () => ({}) });
  assert.ok(racers.every((racer) => !racer.isBot));
});

test("AI steers toward usable pads and opens a passing lane around slower rivals", () => {
  selectCourse(COURSES[0]);
  const pad = BOOST_PADS.find((pad) => Math.abs(pad.offset) < 5);
  const racer = initializeRacer({ s: pad.t * TRACK - metresToProgress(25), x: 0, skill: 1 });
  racer.speed = 100;
  const clear = botInput(racer, 0, 0);
  const rival = { s: racer.s + metresToProgress(10), x: pad.offset / 6.25, speed: 60 };
  const passing = botInput(racer, 0, 0, [racer, rival]);
  assert.ok(Math.abs(clear.steer - passing.steer) > 0.1);
  assert.ok(!clear.brake);
});

test("AI uses weapons with a target and waits until a speed boost can add value", () => {
  selectCourse(COURSES[0]);
  const state = initializeRacer({ s: 0, x: 0, skill: 1 });
  const ahead = { s: metresToProgress(20), x: 0 };
  const behind = { s: -metresToProgress(20), x: 0 };
  state.item = "red";
  assert.equal(shouldUseBotItem(state, []), false);
  assert.equal(shouldUseBotItem(state, [ahead]), true);
  state.item = "banana";
  assert.equal(shouldUseBotItem(state, [ahead]), false);
  assert.equal(shouldUseBotItem(state, [behind]), true);
  state.item = "mushroom";
  state.boost = 1;
  assert.equal(shouldUseBotItem(state, []), false);
  state.item = "star";
  state.star = 1;
  assert.equal(shouldUseBotItem(state, []), false);
  state.star = 0;
  assert.equal(shouldUseBotItem(state, []), true);
  state.spin = 1;
  assert.equal(shouldUseBotItem(state, []), false);
});
