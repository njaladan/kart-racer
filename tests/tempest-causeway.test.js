import test from "node:test";
import assert from "node:assert/strict";
import course from "../src/courses/tempest-causeway.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { initializeRacer, advanceRacer, botInput } from "../src/simulation/simulation.js";
import { currentAt } from "../src/simulation/course-mechanics.js";
import { stormSeaHeight } from "../src/courses/adventure/tempest-world.js";
import { packRacer, applyRacer } from "../src/multiplayer/protocol.js";
import { createRacerState } from "../src/simulation/racer-state.js";
const track = selectCourse(course);
test("storm wind acts only on exposed spans and replicas share its force", () => {
  for (const s of [0, 2, 4, 6]) assert.equal(currentAt(track, track.sectorT(s, 0.5), 18), 0);
  const t = track.sectorT(1, 0.5);
  assert.ok(Math.abs(currentAt(track, t, 18)) > 1);
  const a = initializeRacer(createRacerState({ s: t * TRACK, x: 0 })),
    b = createRacerState();
  applyRacer(b, packRacer(a));
  for (let i = 0; i < 120; i++) {
    advanceRacer(a, { throttle: true }, 1 / 120, 18 + i / 120);
    advanceRacer(b, { throttle: true }, 1 / 120, 18 + i / 120);
    assert.ok(a.worldPos.distanceTo(b.worldPos) < 1e-8);
  }
  for (let i = 0; i < 1000; i++) {
    const height = stormSeaHeight(i * 13, i * 7, i * 0.1);
    assert.ok(height >= -16.8 && height <= -3.2);
  }
});
test("all five drivers complete the windy bridge adventure without wall hits", () => {
  for (let i = 0; i < 5; i++) {
    const r = initializeRacer({ s: 0, x: 0, skill: 0.9 - i * 0.045 });
    let hits = 0;
    for (let k = 1; k < 120 * 280 && !r.finished; k++) {
      const e = advanceRacer(r, botInput(r, i, k / 120), 1 / 120, k / 120);
      hits += !!e.wallImpact;
    }
    assert.ok(r.finished);
    assert.equal(hits, 0);
  }
});
