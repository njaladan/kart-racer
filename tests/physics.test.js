import test from "node:test";
import assert from "node:assert/strict";
import {
  drive,
  resetMotion,
  verticalMotion,
  wallContact,
  chargeDrift,
  FIXED_DT,
  MAX_REVERSE_SPEED,
  MAX_JUMP_HEIGHT,
  MAX_JUMP_TIME,
} from "../src/simulation/physics.js";
import { progressDelta, ranking, finishRacer, lapNumber } from "../src/simulation/race.js";
import { initializeRacer, advanceRacer, botInput } from "../src/simulation/simulation.js";
import { frameAt, projectTrack, poseAt, TRACK, WORLD_PER_UNIT } from "../src/track/track.js";
const flat = { offroad: false, bank: 0, slope: 0 };
const input = { throttle: true, brake: false, steer: 0, drift: false };
function body() {
  const s = {
    worldPos: { x: 0, y: 0, z: 0 },
    yaw: 0,
    boost: 0,
    star: 0,
    spin: 0,
    speed: 0,
    drift: 0,
  };
  resetMotion(s);
  return s;
}
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≠ ${b}`);

test("straight driving preserves world heading, independent of a track path", () => {
  const s = body();
  for (let i = 0; i < 1200; i++) drive(s, input, flat, FIXED_DT);
  near(s.worldPos.x, 0);
  near(s.yaw, 0);
  assert.ok(s.worldPos.z < -100);
  assert.ok(s.speed > 100 && s.speed < 112);
});
test("steering preserves lateral momentum; releasing the wheel restores grip", () => {
  const s = body();
  s.vz = -25;
  for (let i = 0; i < 120; i++) drive(s, { ...input, steer: 1, drift: true }, flat, FIXED_DT);
  assert.ok(s.yaw < -0.2);
  assert.ok(Math.abs(s.lateralSpeed) > 1);
  const slip = Math.abs(s.lateralSpeed);
  for (let i = 0; i < 180; i++)
    drive(s, { ...input, throttle: false, drift: false }, flat, FIXED_DT);
  assert.ok(Math.abs(s.lateralSpeed) < slip * 0.1);
});
test("braking stops before engaging deliberate reverse", () => {
  const s = body();
  s.vz = -20;
  for (let i = 0; i < 90; i++) drive(s, { ...input, throttle: false, brake: true }, flat, FIXED_DT);
  assert.ok(s.longitudinalSpeed > 0);
  for (let i = 0; i < 300; i++)
    drive(s, { ...input, throttle: false, brake: true }, flat, FIXED_DT);
  assert.ok(s.longitudinalSpeed < -2);
  assert.ok(s.speed > 40 && s.speed < MAX_REVERSE_SPEED);
});
test("airborne input cannot redirect momentum, and gravity produces a landing", () => {
  const s = body();
  s.grounded = false;
  s.worldPos.y = 3;
  s.vx = 10;
  s.vz = -12;
  s.vy = 4;
  for (let i = 0; i < 30; i++) {
    drive(s, { ...input, steer: 1, drift: true }, flat, FIXED_DT);
    verticalMotion(s, 0, 0, FIXED_DT);
  }
  near(s.vx, 10);
  near(s.vz, -12);
  near(s.yaw, 0);
  assert.ok(!s.grounded);
  let landed = false;
  for (let i = 0; i < 300; i++) landed = verticalMotion(s, 0, 0, FIXED_DT) || landed;
  assert.ok(landed && s.grounded);
  near(s.worldPos.y, 0);
});
test("wall contact removes outward velocity while preserving motion along the wall", () => {
  const s = body();
  s.worldPos.x = 10;
  s.vx = 7;
  s.vz = -20;
  assert.ok(wallContact(s, 1, 0, 1.35));
  near(s.worldPos.x, 8.65);
  near(s.vz, -20);
  assert.ok(s.vx < 0);
  near(s.yaw, 0);
});
test("mini turbo fires exactly once on drift release", () => {
  const s = body();
  for (let i = 0; i < 250; i++) near(chargeDrift(s, true, true, FIXED_DT), 0);
  near(chargeDrift(s, false, false, FIXED_DT), 2);
  for (let i = 0; i < 100; i++) near(chargeDrift(s, false, false, FIXED_DT), 0);
  near(s.drift, 0);
});
test("track projection is continuous across the finish seam and honors banking", () => {
  near(progressDelta(3, 2397, TRACK), 6);
  near(progressDelta(2397, 3, TRACK), -6);
  for (let i = 0; i < 50; i++) {
    const s = (i * TRACK) / 50,
      frame = frameAt(s / TRACK),
      position = poseAt(s, 3, 0).p,
      projection = projectTrack(position, s);
    assert.ok(Math.abs(projection.offset - 3) < 0.08);
    near(frame.up.dot(frame.right), 0);
    assert.ok(frame.up.y > 0.9); // The ridge has a deliberate steep descent.
  }
});
test("rivals finish, keep their rank, and backwards crossings do not add laps", () => {
  const a = { s: 7199, finished: false },
    b = { s: 7100, finished: false };
  assert.equal(finishRacer(a, 7200, 40), false);
  a.s = 7201;
  assert.ok(finishRacer(a, 7200, 41));
  b.s = 7210;
  finishRacer(b, 7200, 42);
  assert.equal(ranking([b, a])[0], a);
  assert.equal(lapNumber(-3, TRACK, 3), 1);
  assert.equal(lapNumber(2399, TRACK, 3), 1);
  assert.equal(lapNumber(2401, TRACK, 3), 2);
  assert.equal(lapNumber(2399, TRACK, 3), 1);
});
test("all five AI drivers complete three physical laps without invalid state", () => {
  for (let index = 0; index < 5; index++) {
    const s = initializeRacer({
      s: -46 - index * 30,
      x: index % 2 ? 0.4 : -0.4,
      skill: 0.9 - index * 0.045,
      drift: 0,
    });
    let launches = 0,
      landings = 0;
    for (let tick = 1; tick < 120 * 230 && !s.finished; tick++) {
      const e = advanceRacer(s, botInput(s, index, tick * FIXED_DT), FIXED_DT, tick * FIXED_DT);
      launches += !!e.launched;
      landings += !!e.landed;
      assert.ok(Number.isFinite(s.worldPos.x + s.worldPos.y + s.worldPos.z));
      assert.ok(Math.abs(s.x) < 1.5);
    }
    assert.ok(s.finished, `rival ${index} stuck at ${s.s} with speed ${s.speed}`);
    assert.ok(s.finishTime < 220);
    assert.ok(launches > 0 && landings > 0, `rival ${index} should jump and land`);
  }
});
test("fixed simulation matches across display frame rates", () => {
  const simulate = (fps) => {
    const s = initializeRacer({ s: 0, x: 0, drift: 0, skill: 0.9 });
    let accumulator = 0,
      tick = 0;
    for (let f = 0; f < fps * 20; f++) {
      accumulator += 1 / fps;
      while (accumulator + 1e-10 >= FIXED_DT) {
        tick++;
        advanceRacer(s, botInput(s, 0, tick * FIXED_DT), FIXED_DT, tick * FIXED_DT);
        accumulator -= FIXED_DT;
      }
    }
    return s;
  };
  const a = simulate(30),
    b = simulate(60),
    c = simulate(144);
  near(a.s, b.s);
  near(a.s, c.s);
  near(a.worldPos.y, c.worldPos.y);
});

test("a parked kart does not creep sideways down track banking", () => {
  const s = initializeRacer({ s: 0, x: 0, drift: 0 });
  for (let i = 0; i < 2400; i++)
    advanceRacer(
      s,
      { throttle: false, brake: false, steer: 0, drift: false },
      FIXED_DT,
      i * FIXED_DT,
    );
  assert.ok(Math.abs(s.x) < 0.001);
  assert.ok(s.speed < 0.01);
});

test("forward and reverse acceleration respond quickly from rest", () => {
  const forward = body(),
    reverse = body();
  for (let i = 0; i < 120; i++) {
    drive(forward, input, flat, FIXED_DT);
    drive(reverse, { ...input, throttle: false, brake: true }, flat, FIXED_DT);
  }
  assert.ok(forward.speed > 60, `forward acceleration too weak: ${forward.speed}`);
  assert.ok(
    reverse.longitudinalSpeed < 0 && reverse.speed > 35,
    `reverse acceleration too weak: ${reverse.speed}`,
  );
});
test("mushroom boosts across all ramps cannot launch the kart into the sky", () => {
  for (const boosted of [false, true]) {
    const s = initializeRacer({ s: 0, x: 0, drift: 0, skill: 0.9 });
    let launches = 0,
      maxHeight = 0,
      maxAirTime = 0;
    for (let tick = 1; tick < 120 * 230 && !s.finished; tick++) {
      if (boosted) s.boost = 1;
      const events = advanceRacer(s, botInput(s, 0, tick * FIXED_DT), FIXED_DT, tick * FIXED_DT);
      launches += !!events.launched;
      const height = s.worldPos.y - projectTrack(s.worldPos, s.s).height;
      maxHeight = Math.max(maxHeight, height);
      maxAirTime = Math.max(maxAirTime, s.airTime);
      assert.ok(height <= MAX_JUMP_HEIGHT + 0.00001, `kart flew ${height} metres above the road`);
    }
    assert.ok(s.finished && launches > 0);
    assert.ok(maxAirTime <= MAX_JUMP_TIME);
    assert.ok(maxHeight < 1.11);
  }
});
test("contact and surface corrections cannot generate an accidental takeoff", () => {
  const s = initializeRacer({ s: TRACK * 0.34, x: 0, drift: 0 });
  s.vx = -Math.sin(s.yaw) * 30;
  s.vz = -Math.cos(s.yaw) * 30;
  s.vy = 100;
  const right = frameAt(0.34).right;
  s.worldPos.addScaledVector(right, 0.8);
  const event = advanceRacer(s, input, FIXED_DT, 1);
  assert.ok(s.grounded && !event.launched);
  assert.ok(s.vy <= 3);
  assert.ok(Math.abs(s.worldPos.y - projectTrack(s.worldPos, s.s).height) < 0.01);
});
