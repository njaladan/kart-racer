import test from "node:test";
import assert from "node:assert/strict";
import { createRaceSession } from "../src/simulation/race-session.js";
import { createRaceGrid } from "../src/simulation/race-grid.js";
import { RACERS } from "../src/rendering/racer-roster.js";
import { selectCourse, frameAt, trackT, yawFor } from "../src/track/track.js";
import { DEFAULT_COURSE } from "../src/courses/registry.js";
import { FIXED_DT } from "../src/simulation/physics.js";

function setup(callbacks = {}) {
  selectCourse(DEFAULT_COURSE);
  const racers = createRaceGrid(RACERS);
  const items = { reset() {}, fire() {}, step() {} };
  const session = createRaceSession({
    racers,
    items,
    getPlayerInput: () => ({ throttle: true, steer: 0, drift: false }),
    ...callbacks,
  });
  return { racers, session };
}

function start(session) {
  session.begin(0.01);
  session.step(FIXED_DT);
  session.step(FIXED_DT);
  assert.equal(session.getState().running, true);
}

test("countdown starts once and pause freezes both clocks until explicit resume", () => {
  const pauses = [],
    countdowns = [];
  const { session, racers } = setup({
    onPause: (value) => pauses.push(value),
    onCountdown: (value, beep) => countdowns.push({ value, beep }),
  });
  session.setPaused(true);
  assert.equal(session.getState().paused, false);
  start(session);
  assert.equal(countdowns.length, 2);
  session.step(FIXED_DT);
  assert.ok(racers[0].speed > 0);
  session.setPaused(true);
  const before = session.getState();
  session.step(2);
  session.setPaused(true);
  assert.deepEqual(session.getState(), before);
  assert.deepEqual(pauses, [true]);
  session.setPaused(false);
  session.step(FIXED_DT);
  assert.ok(session.getState().raceTime > before.raceTime);
  assert.deepEqual(pauses, [true, false]);
  // Snapshots cannot mutate session-owned lifecycle state.
  session.getState().running = false;
  assert.equal(session.getState().running, true);
});

test("restart clears all racer transient state and aligns the complete grid", () => {
  let resets = 0;
  const { session, racers } = setup({ onReset: () => resets++ });
  start(session);
  for (const racer of racers)
    Object.assign(racer, {
      drift: 0.9,
      driftTier: 2,
      spin: 3,
      boost: 4,
      star: 5,
      item: "mushroom",
      itemCount: 2,
      finishDelay: 9,
      finishTime: 4,
      finished: true,
      trickActive: true,
      trickBuffer: 0.2,
      vy: 5,
      airTime: 0.4,
      grounded: false,
      steering: 0.6,
    });
  session.setPaused(true);
  session.begin();
  assert.equal(resets, 2);
  assert.deepEqual(session.getState(), {
    elapsed: 0,
    raceTime: 0,
    running: false,
    paused: false,
    started: true,
    finished: false,
    countdown: 3.45,
  });
  for (const racer of racers) {
    for (const field of [
      "drift",
      "driftTier",
      "spin",
      "boost",
      "star",
      "itemCount",
      "finishDelay",
      "trickBuffer",
      "airTime",
      "steering",
    ])
      assert.equal(racer[field], 0, `${racer.name}: ${field}`);
    assert.equal(racer.finished, false);
    assert.equal(racer.grounded, true);
    assert.equal(racer.trickActive, false);
    assert.equal(racer.item, null);
    assert.equal(racer.finishTime, Infinity);
    assert.deepEqual(racer.renderFrom, racer.worldPos);
    assert.equal(racer.renderYawFrom, racer.yaw);
    assert.equal(racer.yaw, yawFor(frameAt(trackT(racer.s)).tangent));
  }
  session.reset();
  session.step(1);
  assert.equal(session.getState().started, false);
  assert.equal(session.getState().running, false);
  assert.equal(session.getState().countdown, 0);
});

test("finish transition fires once after the delay and retains the crossing time", () => {
  let finishes = 0;
  const {
    session,
    racers: [player],
  } = setup({ onFinish: () => finishes++ });
  start(session);
  Object.assign(player, { finished: true, finishTime: 123.45, finishDelay: 0.35 });
  session.step(0.2);
  assert.equal(finishes, 0);
  session.step(0.2);
  assert.equal(finishes, 1);
  assert.equal(session.getState().finished, true);
  assert.equal(session.getState().running, false);
  assert.equal(session.getState().raceTime, 123.45);
  session.step(1);
  session.setPaused(true);
  assert.equal(finishes, 1);
  assert.equal(session.getState().paused, false);
});

test("hits cancel trick rewards while protected racers retain motion", () => {
  let hits = 0;
  const {
    session,
    racers: [player],
  } = setup({ onHit: () => hits++ });
  Object.assign(player, { vx: 20, vz: 10, trickActive: true, trickBuffer: 0.2 });
  assert.equal(session.hitRacer(player), true);
  assert.equal(player.vx, 18);
  assert.equal(player.vz, 9);
  assert.equal(player.trickActive, false);
  assert.equal(player.trickBuffer, 0);
  assert.equal(session.hitRacer(player), false);
  assert.equal(hits, 1);
  player.invulnerable = 0;
  player.star = 1;
  assert.equal(session.hitRacer(player), false);
  session.recoverPlayer();
  assert.equal(player.vx, 0);
  assert.equal(player.vz, 0);
  assert.equal(player.x, 0);
  assert.equal(player.invulnerable, 1.5);
  assert.deepEqual(player.renderFrom, player.worldPos);
});
