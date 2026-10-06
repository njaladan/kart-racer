import test from "node:test";
import assert from "node:assert/strict";
import course from "../src/courses/pelagic-glasshouse.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { initializeRacer, advanceRacer, botInput } from "../src/simulation/simulation.js";
import { underwaterAt } from "../src/simulation/course-mechanics.js";
import { createRacerState } from "../src/simulation/racer-state.js";
import { packRacer, applyRacer } from "../src/multiplayer/protocol.js";
import { createRaceSession } from "../src/simulation/race-session.js";
const track = selectCourse(course);
test("underwater initialization, recovery and replica currents retain their medium and floor", () => {
  const t = track.sectorT(2, 0.5);
  assert.equal(underwaterAt(track, t), true);
  assert.equal(underwaterAt(track, 0), false);
  const a = initializeRacer(createRacerState({ s: t * TRACK, x: 0 })),
    b = createRacerState();
  assert.equal(a.underwater, true);
  applyRacer(b, packRacer(a));
  for (let i = 0; i < 120; i++) {
    advanceRacer(a, { throttle: true }, 1 / 120, i / 120);
    advanceRacer(b, { throttle: true }, 1 / 120, i / 120);
    assert.ok(a.worldPos.distanceTo(b.worldPos) < 1e-8);
    assert.equal(a.underwater, b.underwater);
  }
  const player = createRacerState({ isPlayer: true }),
    session = createRaceSession({
      racers: [player],
      items: { reset() {}, step() {} },
      getPlayerInput: () => ({}),
    });
  player.s = t * TRACK;
  player.worldPos.y -= 40;
  player.underwater = false;
  session.recoverPlayer();
  assert.equal(player.underwater, true);
  const global = track.projectTrack(player.worldPos, 0, true);
  assert.ok(Math.abs(global.height - player.worldPos.y) < 0.03);
  assert.ok(player.worldPos.y < -20);
});
test("five drivers submerge, traverse the flooded domes and return to the garden on every lap", () => {
  for (let i = 0; i < 5; i++) {
    const r = initializeRacer({ s: 0, x: 0, skill: 0.9 - i * 0.045 });
    let entries = 0,
      exits = 0,
      hits = 0;
    for (let k = 1; k < 120 * 280 && !r.finished; k++) {
      const before = r.underwater,
        e = advanceRacer(r, botInput(r, i, k / 120), 1 / 120, k / 120);
      entries += !before && r.underwater;
      exits += before && !r.underwater;
      hits += !!e.wallImpact;
    }
    assert.ok(r.finished);
    assert.equal(entries, 3);
    assert.equal(exits, 3);
    assert.equal(hits, 0);
  }
});
