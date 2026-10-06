import test from "node:test";
import assert from "node:assert/strict";
import course from "../src/courses/frostpeak-festival.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { initializeRacer, botInput, advanceRacer } from "../src/simulation/simulation.js";
import { cartAt, cartContact } from "../src/simulation/hazards.js";

test("eight winter places complete three laps for five drivers, including the tight village", () => {
  const track = selectCourse(course);
  assert.equal(track.SECTIONS.length, 8);
  assert.ok(track.COURSE_LENGTH > 1800 && track.COURSE_LENGTH < 1950);
  assert.ok(track.minimumCurveRadius >= 18 && track.minimumCurveRadius < 30);
  for (let index = 0; index < 5; index++) {
    const racer = initializeRacer({ s: 0, x: 0, skill: 0.91 - index * 0.0475, drift: 0 });
    const entries = [0],
      laps = [];
    let section = 0,
      walls = 0,
      contacts = 0;
    for (let tick = 1; tick < 250 * 120 && !racer.finished; tick++) {
      const time = tick / 120;
      const events = advanceRacer(racer, botInput(racer, index, time), 1 / 120, time);
      walls += !!events.wallImpact;
      contacts += !!events.cartImpact;
      if (section < 7 && racer.s >= track.SECTIONS[section + 1].start * TRACK) {
        entries.push(time);
        section++;
      }
      if (racer.s >= (laps.length + 1) * TRACK) {
        laps.push(time);
        if (laps.length === 1) entries.push(time);
      }
      assert.ok(Number.isFinite(racer.worldPos.x + racer.worldPos.y + racer.worldPos.z));
    }
    assert.ok(racer.finished);
    assert.equal(walls, 0);
    assert.equal(contacts, 0);
    assert.equal(entries.length, 9);
    assert.equal(laps.length, 3);
    assert.ok(laps[0] > 60 && laps[0] < 80);
    for (let i = 1; i < entries.length; i++)
      assert.ok(entries[i] - entries[i - 1] >= 5 && entries[i] - entries[i - 1] <= 15);
  }
});

test("lake timber, mountain trick lanes and powder routes share coherent collision and ground", () => {
  const track = selectCourse(course);
  for (const verge of track.VERGES) {
    const t = (verge.start + verge.end) / 2;
    const offset = verge.side * (track.roadHalfWidth(t) + verge.extraWidth * 0.55);
    const surface = track.surfaceAt(t, offset);
    assert.equal(surface.material, verge.material);
    assert.equal(surface.offroad, !verge.driveable);
    const point = track.poseAt(t * TRACK, offset, 0.065).p;
    const projection = track.projectTrack(point, t * TRACK);
    assert.ok(Math.abs(projection.height - point.y) < 0.035);
    assert.ok(
      projection.offset > track.collisionBounds(t).left &&
        projection.offset < track.collisionBounds(t).right,
    );
  }
  const lanes = track.RAMPS.filter((r) => r.width != null);
  assert.equal(lanes.length, 2);
  for (const ramp of lanes) {
    assert.ok(track.rampHeight(ramp.t, ramp.offset) > 1.5);
    assert.equal(track.rampHeight(ramp.t, 0), 0);
    assert.equal(track.surfaceAt(ramp.t, ramp.offset).offroad, false);
  }
  assert.ok(
    Array.from({ length: 100 }, (_, i) => Math.abs(track.bankAt(track.sectorT(2, i / 100)))).some(
      (bank) => bank > 0.2,
    ),
  );
});

test("the groomer crossing is on firm snow with a clear passing lane all cycle", () => {
  const track = selectCourse(course);
  assert.equal(track.surfaceAt(track.CART_T).material, "snow");
  assert.ok((track.CART_T - track.sectorT(5, 0.76)) * track.COURSE_LENGTH > 25);
  for (let time = 30; time < 43; time += 0.1) {
    const hazard = cartAt(time),
      safe = track.poseAt(hazard.s, course.hazard.safeLane, 0.065).p;
    assert.equal(cartContact(safe, time), null);
    assert.ok(track.collisionBounds(track.CART_T).left < course.hazard.safeLane - 0.9);
  }
});
