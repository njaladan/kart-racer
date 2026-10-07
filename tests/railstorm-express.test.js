import test from "node:test";
import assert from "node:assert/strict";
import course from "../src/courses/railstorm-express.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { initializeRacer, advanceRacer, botInput } from "../src/simulation/simulation.js";
import { trainCarriages } from "../src/simulation/moving-surfaces.js";
import { trainRampAt, trainRampHeight } from "../src/simulation/experience-mechanics.js";
const track = selectCourse(course);
test("five drivers board and race moving freight on every lap, then disembark and finish", () => {
  for (let i = 0; i < 5; i++) {
    const r = initializeRacer({ s: 0, x: 0, skill: 0.9 - i * 0.045 });
    let boardings = 0,
      exits = 0,
      hits = 0,
      jumps = 0;
    for (let k = 1; k < 120 * 280 && !r.finished; k++) {
      const grounded = r.grounded;
      const e = advanceRacer(r, botInput(r, i, k / 120), 1 / 120, k / 120);
      boardings += !!e.deckBoarded;
      exits += !!e.deckLeft;
      hits += !!e.wallImpact;
      jumps += grounded && !r.grounded && r.jumpKind === "train";
    }
    assert.ok(r.finished);
    assert.equal(boardings, 3);
    assert.equal(exits, 3);
    assert.equal(hits, 0);
    assert.equal(r.recoveryCount || 0, 0);
    assert.ok(jumps >= 12, "Drivers use the moving launch ramps on every lap");
  }
});

test("long colored roofs have matching physical gaps and stable docks as the train moves", () => {
  const definition = course.movingDecks[0];
  assert.equal(new Set(definition.carStyles.map((s) => s.color)).size, 5);
  for (const time of [0, 3.7, 19, 100]) {
    track.setTime(time);
    const cars = trainCarriages(track, definition, time).sort((a, b) => a.start - b.start);
    assert.ok(cars.every((car) => car.spacing > 80 && car.length > 65));
    for (let i = 1; i < cars.length; i++) {
      const previous = cars[i - 1];
      const current = cars[i];
      assert.ok(Math.abs((current.start - previous.end) * track.COURSE_LENGTH - 12) < 1e-8);
      const t = (previous.end + current.start) / 2;
      const deck = track.movingSurfaceAt(t);
      const surface = track.projectTrack(track.poseAt(t * TRACK).p, t * TRACK);
      assert.equal(track.floorAt(surface).supported, deck.docked);
    }
    for (const t of [track.sectorT(2, 0.08), track.sectorT(4, 0.92)])
      assert.equal(track.movingSurfaceAt(t).supported, true);
    for (const car of cars) {
      const surface = track.movingSurfaceAt(car.t);
      assert.equal(surface.carIndex, car.index);
      assert.equal(surface.style.name, car.style.name);
      assert.equal(surface.supported, true);
    }
  }
});

test("using a launch ramp clears the coupling; missing its lane or crawling falls", () => {
  track.setTime(0);
  const car = trainCarriages(track, course.movingDecks[0], 0).find(
    (car) => car.t > 0.49 && car.t < 0.55,
  );
  const lipT = car.end;
  const startT = lipT - 11 / track.COURSE_LENGTH;
  const ramp = trainRampAt(track, track.movingSurfaceAt(startT));
  const crestT = lipT - 0.01 / track.COURSE_LENGTH;
  assert.ok(trainRampHeight(track, crestT, ramp.offset) > 1.7);
  assert.equal(trainRampHeight(track, crestT, 6.8), 0);
  for (const [offset, speed, shouldLand] of [
    [ramp.offset, 90, true],
    [6.8, 90, false],
    [ramp.offset, 30, false],
  ]) {
    track.setTime(0);
    const racer = initializeRacer({ s: startT * TRACK, x: 0, isPlayer: true });
    const pose = track.poseAt(startT * TRACK, offset, 0.065);
    racer.worldPos.copy(pose.p);
    racer.vx = (pose.tangent.x * speed) / 3.6;
    racer.vz = (pose.tangent.z * speed) / 3.6;
    racer.speed = speed;
    let jumped = false;
    let landed = false;
    let fell = false;
    for (let k = 1; k <= 360; k++) {
      advanceRacer(racer, { throttle: speed > 45 }, 1 / 120, k / 120);
      jumped ||= !racer.grounded && racer.jumpKind === "train";
      landed ||= jumped && racer.grounded;
      fell ||= racer.falling;
      if (landed || fell) break;
    }
    assert.equal(jumped, shouldLand);
    assert.equal(landed, shouldLand);
    assert.equal(fell, !shouldLand);
  }
});
