import test from "node:test";
import assert from "node:assert/strict";
import course from "../src/courses/pocket-pantry.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { initializeRacer, advanceRacer, botInput } from "../src/simulation/simulation.js";
import { scaleAt, rangeFor } from "../src/simulation/course-mechanics.js";
import { createRacerState } from "../src/simulation/racer-state.js";
import { packRacer, applyRacer } from "../src/multiplayer/protocol.js";
import { createRaceSession } from "../src/simulation/race-session.js";
const track = selectCourse(course);
test("pantry portals scale smoothly, preserve replica motion and recover a tiny kart on the shelf", () => {
  const { start, end } = rangeFor(track, course.scaleZones[0]);
  assert.equal(scaleAt(track, start), 1);
  assert.equal(scaleAt(track, end), 1);
  assert.ok(Math.abs(scaleAt(track, start + 21 / track.COURSE_LENGTH) - 0.28) < 1e-8);
  let previous = 1;
  for (let i = 0; i <= 100; i++) {
    const scale = scaleAt(track, start + (i * 0.2) / track.COURSE_LENGTH);
    assert.ok(scale <= previous && previous - scale < 0.012);
    previous = scale;
  }
  const a = initializeRacer(
      createRacerState({ s: (start + 4 / track.COURSE_LENGTH) * TRACK, x: 0 }),
    ),
    b = createRacerState();
  applyRacer(b, packRacer(a));
  for (let i = 0; i < 240; i++) {
    advanceRacer(a, { throttle: true }, 1 / 120, i / 120);
    advanceRacer(b, { throttle: true }, 1 / 120, i / 120);
    assert.equal(a.scale, b.scale);
    assert.ok(a.worldPos.distanceTo(b.worldPos) < 1e-8);
  }
  const player = createRacerState({ isPlayer: true }),
    session = createRaceSession({
      racers: [player],
      items: { reset() {}, step() {} },
      getPlayerInput: () => ({}),
    });
  player.s = track.sectorT(2, 0.5) * TRACK;
  player.scale = 1;
  session.recoverPlayer();
  assert.equal(player.scale, 0.28);
  assert.equal(player.x, 0);
  assert.ok(player.worldPos.distanceTo(track.poseAt(player.s, 0, 0.065).p) < 1e-8);
  const v = track.VERGES.find((v) => v.maxScale),
    mid = (v.start + v.end) / 2,
    offset = -track.roadHalfWidth(mid) - 3;
  assert.equal(scaleAt(track, mid), 0.28);
  assert.equal(track.surfaceAt(mid, offset).offroad, false);
  assert.equal(track.surfaceAt(mid, offset).material, "wood");
});
test("all five drivers complete the entire breakfast, miniature pantry and growing sequence", () => {
  for (let i = 0; i < 5; i++) {
    const r = initializeRacer({ s: 0, x: 0, skill: 0.9 - i * 0.045 });
    let hits = 0,
      tiny = false,
      grew = false;
    for (let k = 1; k < 120 * 260 && !r.finished; k++) {
      const e = advanceRacer(r, botInput(r, i, k / 120), 1 / 120, k / 120);
      hits += !!e.wallImpact;
      tiny ||= r.scale < 0.3;
      grew ||= tiny && r.scale > 0.99;
    }
    assert.ok(r.finished);
    assert.ok(tiny && grew);
    assert.equal(hits, 0);
  }
});
