import test from "node:test";
import assert from "node:assert/strict";
import course from "../src/courses/neon-harbor.js";
import { createTrack, selectCourse, TRACK } from "../src/track/track.js";
import { initializeRacer, botInput, advanceRacer } from "../src/simulation/simulation.js";
import { cartAt, cartContact } from "../src/simulation/hazards.js";
import { FIXED_DT } from "../src/simulation/physics.js";

const track = createTrack(course);

test("Neon Harbor has eight separated districts, an elevated bridge, and a drivable 1.9 km loop", () => {
  assert.ok(track.COURSE_LENGTH > 1850 && track.COURSE_LENGTH < 1950);
  assert.deepEqual(
    track.SECTIONS.map((section) => section.id),
    ["promenade", "downtown", "market", "bridge", "cargo", "ferry", "seawall", "boulevard"],
  );
  assert.equal(track.SECTIONS[0].start, 0);
  for (let i = 0; i < track.SECTIONS.length; i++) {
    const section = track.SECTIONS[i];
    assert.ok((section.end - section.start) * track.COURSE_LENGTH > 140);
    if (i < track.SECTIONS.length - 1) assert.equal(section.end, track.SECTIONS[i + 1].start);
  }
  assert.ok(track.minimumCurveRadius >= course.minimumRadius);
  assert.ok(track.ELEVATED.length === 1 && track.ELEVATED[0].section === 3);
  assert.ok(track.frameAt(track.sectorT(3, 0.5)).p.y > 20);
});

test("the downtown service cut and boulevard boosts use their authored lanes", () => {
  selectCourse(course);
  const shortcut = track.SHORTCUT;
  assert.equal(shortcut.section, 1);
  const t = (shortcut.start + shortcut.end) / 2,
    width = track.shortcutWidth(t),
    offset = track.roadHalfWidth(t) + Math.min(2, width * 0.4);
  const surface = track.surfaceAt(t, offset);
  assert.ok(width > 4.8);
  assert.equal(surface.material, "paving");
  assert.equal(surface.offroadDrag, course.shortcut.drag);
  assert.ok(surface.rightEdge > offset);
  assert.ok(course.pads.filter((pad) => pad.section === 7).length >= 3);
  assert.ok(track.ITEM_ROWS.every((row) => row < shortcut.start || row > shortcut.end));
});

test("an AI racer completes the three lap course without wall or traffic impacts", () => {
  selectCourse(course);
  const racer = initializeRacer({ s: 0, x: 0, skill: 0.9, drift: 0 });
  const lapTimes = [];
  let lastLap = 0;
  let impacts = 0;
  for (let tick = 1; tick < 230 / FIXED_DT && !racer.finished; tick++) {
    const time = tick * FIXED_DT;
    const event = advanceRacer(racer, botInput(racer, 0, time), FIXED_DT, time);
    impacts += Number(!!event.wallImpact) + Number(!!event.cartImpact);
    assert.ok(Number.isFinite(racer.worldPos.x + racer.worldPos.y + racer.worldPos.z + racer.s));
    if (racer.s >= (lapTimes.length + 1) * TRACK) {
      lapTimes.push(time - lastLap);
      lastLap = time;
    }
  }
  assert.ok(racer.finished && racer.finishTime < 220);
  assert.equal(impacts, 0);
  assert.equal(lapTimes.length, 3);
  for (const lapTime of lapTimes) assert.ok(lapTime >= 65 && lapTime <= 78);
});

test("cargo shuttle warnings and contact leave the left lane open", () => {
  selectCourse(course);
  assert.equal(cartAt(29).offset, 12);
  assert.ok(cartAt(31).warning);
  assert.equal(cartAt(35).offset, 0);
  for (let time = 30; time < 42; time += 0.05) {
    const cart = cartAt(time),
      lane = track.poseAt(cart.s, course.hazard.safeLane, 0.065).p;
    assert.equal(cartContact(lane, time), null);
    assert.ok(course.hazard.safeLane > track.collisionBounds(cart.s / TRACK).left);
  }
});
