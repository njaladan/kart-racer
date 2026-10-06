import test from "node:test";
import assert from "node:assert/strict";
import {
  COURSE_LENGTH,
  TRACK,
  WORLD_PER_UNIT,
  SECTIONS,
  SHORTCUT,
  BOOST_PADS,
  poseAt,
  projectTrack,
  collisionBounds,
  surfaceAt,
  metresToProgress,
} from "../src/track/track.js";
import { cartAt, cartContact } from "../src/simulation/hazards.js";
import { initializeRacer, advanceRacer, botInput } from "../src/simulation/simulation.js";
import { advanceRaceProgress } from "../src/simulation/race.js";
import { createShell, advanceShell } from "../src/simulation/items.js";
import { FIXED_DT, drive } from "../src/simulation/physics.js";

test("the eight-place valley stays near one minute with no boundary impacts", () => {
  assert.ok(COURSE_LENGTH > 1530 && COURSE_LENGTH < 1580);
  const racer = initializeRacer({ s: 0, x: 0, skill: 0.9, drift: 0 });
  const entries = [0];
  let section = 0,
    wallHits = 0;
  for (let tick = 1; tick < 120 * 70 && racer.s < TRACK; tick++) {
    const events = advanceRacer(
      racer,
      botInput(racer, 0, tick * FIXED_DT),
      FIXED_DT,
      tick * FIXED_DT,
    );
    wallHits += !!events.wallImpact;
    if (section < SECTIONS.length - 1 && racer.s >= SECTIONS[section + 1].start * TRACK) {
      entries.push(tick * FIXED_DT);
      section++;
    }
    if (racer.s >= TRACK) entries.push(tick * FIXED_DT);
  }
  assert.equal(entries.length, SECTIONS.length + 1);
  assert.equal(wallHits, 0);
  assert.ok(entries.at(-1) >= 55 && entries.at(-1) <= 65);
  for (let i = 1; i < entries.length; i++)
    assert.ok(entries[i] - entries[i - 1] >= 4.5 && entries[i] - entries[i - 1] <= 13);
});

test("the grass shortcut has usable width, coherent ground and the same ordered lap gates", () => {
  const span = SHORTCUT.end - SHORTCUT.start,
    start = SHORTCUT.start + span * 0.35,
    end = SHORTCUT.end - span * 0.35;
  const racer = initializeRacer({ s: start * TRACK, x: 0, drift: 0 });
  for (let t = start; t <= end; t += 0.001) {
    const position = poseAt(t * TRACK, 20, 0.065).p;
    const surface = projectTrack(position, t * TRACK);
    assert.ok(surface.offroad && surface.offset > 19.8);
    assert.ok(collisionBounds(t).right > 25);
    assert.ok(Math.abs(surface.height - position.y) < 0.02);
    assert.ok(advanceRaceProgress(racer, surface.t * TRACK, TRACK, WORLD_PER_UNIT, 2));
  }
  assert.ok(racer.s > start * TRACK + 8);
  const previous = racer.s,
    gate = racer.nextCheckpoint;
  assert.equal(
    advanceRaceProgress(racer, racer.s + TRACK * 0.3, TRACK, WORLD_PER_UNIT, 0.1),
    false,
  );
  assert.equal(racer.s, previous);
  assert.equal(racer.nextCheckpoint, gate);
});

test("mushrooms preserve speed on grass while an unboosted cut pays its surface penalty", () => {
  const run = (boosted) => {
    const r = initializeRacer({ s: 0, x: 0, drift: 0 });
    r.vz = -28;
    r.yaw = 0;
    r.boost = boosted ? 2 : 0;
    for (let i = 0; i < 120; i++)
      drive(r, { throttle: true, steer: 0 }, { offroad: true, bank: 0, slope: 0 }, FIXED_DT);
    return r.speed;
  };
  assert.ok(run(true) > 110);
  assert.ok(run(false) < 85);
});

test("pads require their authored lane and do not shorten an existing boost", () => {
  const pad = BOOST_PADS[0];
  const r = initializeRacer({ s: pad.t * TRACK, x: pad.offset / 6.25, drift: 0 });
  r.boost = 2;
  assert.ok(advanceRacer(r, {}, FIXED_DT, 1).padBoost);
  assert.ok(r.boost > 1.9);
  const miss = initializeRacer({ s: pad.t * TRACK, x: 0.8, drift: 0 });
  assert.equal(advanceRacer(miss, {}, FIXED_DT, 1).padBoost, false);
});

test("the delivery cart gives a warning, stays parked at first, and leaves a passing lane", () => {
  assert.equal(cartAt(29).offset, 10);
  assert.ok(cartAt(31).warning);
  assert.equal(cartAt(35).offset, -3);
  assert.equal(cartAt(40).offset, 10);
  for (let time = 30; time < 42; time += 0.1) {
    const c = cartAt(time);
    const lane = poseAt(c.s, -6, 0.065).p;
    assert.equal(cartContact(lane, time), null);
    assert.ok(collisionBounds(c.s / TRACK).left < -6);
  }
  const c = cartAt(35);
  assert.ok(cartContact(c.p, 35));
  const racer = initializeRacer({ s: c.s, x: -3 / 6.25, drift: 0 });
  advanceRacer(racer, {}, FIXED_DT, 35);
  assert.ok((cartContact(racer.worldPos, 35)?.penetration || 0) < 1e-6);
  assert.ok(racer.grounded && Math.abs(racer.s - c.s) * WORLD_PER_UNIT < 1);
  const owner = initializeRacer({ s: c.s - metresToProgress(6), x: -3 / 6.25, drift: 0 });
  const shell = createShell(owner, "green");
  for (let i = 0; i < 15; i++) advanceShell(shell, FIXED_DT, 35);
  assert.ok(shell.vx * c.tangent.x + shell.vz * c.tangent.z < 0);
});

test("karts and shells share the physical edges in all eight sections", () => {
  for (const section of SECTIONS) {
    const t = (section.start + section.end) / 2;
    const surface = surfaceAt(t),
      kart = collisionBounds(t),
      shell = collisionBounds(t, 0.55);
    assert.ok(Math.abs(kart.right + 0.9 - surface.rightEdge) < 1e-6);
    assert.ok(Math.abs(shell.right + 0.55 - surface.rightEdge) < 1e-6);
    assert.ok(Math.abs(kart.left - 0.9 - surface.leftEdge) < 1e-6);
  }
});
