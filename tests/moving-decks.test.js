import test from "node:test";
import assert from "node:assert/strict";
import base from "../src/courses/sunstone-ruins.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { initializeRacer, advanceRacer } from "../src/simulation/simulation.js";
import { trainCarriages, movingDeckAt } from "../src/simulation/moving-surfaces.js";
import { packRacer, applyRacer } from "../src/multiplayer/protocol.js";
import { createRacerState } from "../src/simulation/racer-state.js";
import { createRaceSession } from "../src/simulation/race-session.js";
const definition = {
  id: "test-express",
  section: 0,
  startFraction: 0.1,
  endFraction: 0.9,
  speed: 9,
  carLength: 24,
  suspension: 0.18,
};
const track = selectCourse({ ...base, movingDecks: [definition] });
test("moving carriage surface carries a neutral racer and replicas share deck height and identity", () => {
  const t = track.sectorT(0, 0.4);
  track.setTime(0);
  const a = initializeRacer(createRacerState({ s: t * TRACK, x: 0 })),
    b = createRacerState(),
    start = a.s;
  applyRacer(b, packRacer(a));
  for (let i = 1; i <= 120; i++) {
    const time = i / 120;
    advanceRacer(a, {}, 1 / 120, time);
    advanceRacer(b, {}, 1 / 120, time);
    assert.ok(a.worldPos.distanceTo(b.worldPos) < 1e-8);
    assert.equal(a.movingDeckId, definition.id);
    assert.ok(Math.abs(track.projectTrack(a.worldPos, 0, true).height - a.worldPos.y) < 0.02);
    assert.ok(Math.abs(a.deckCoordinate - b.deckCoordinate) < 1e-8);
  }
  assert.ok(Math.abs((a.s - start) * track.WORLD_PER_UNIT - 9) < 0.03);
  assert.equal(a.speed, 0);
});
test("carriage panels cover the interior continuously and meet stable boarding docks", () => {
  for (const time of [0, 0.15, 7.2, 100, 999]) {
    const cars = trainCarriages(track, definition, time).sort((a, b) => a.start - b.start);
    for (let i = 1; i < cars.length; i++)
      assert.ok(Math.abs(cars[i].start - cars[i - 1].end) < 1e-8);
    const start = track.sectorT(0, 0.1),
      end = track.sectorT(0, 0.9);
    assert.ok((cars[0].start - start) * track.COURSE_LENGTH < 13);
    assert.ok((end - cars.at(-1).end) * track.COURSE_LENGTH < 13);
    for (const t of [start, end]) {
      assert.ok(Math.abs(movingDeckAt(track, t, time).height) < 1e-12);
      assert.equal(movingDeckAt(track, t, time).speed, 0);
    }
  }
});
test("recovering on moving freight returns to its current supported surface", () => {
  const player = createRacerState({ isPlayer: true }),
    session = createRaceSession({
      racers: [player],
      items: { reset() {}, step() {} },
      getPlayerInput: () => ({}),
    });
  player.s = track.sectorT(0, 0.5) * TRACK;
  track.setTime(15);
  player.worldPos.y -= 40;
  session.recoverPlayer();
  assert.ok(player.worldPos.distanceTo(track.poseAt(player.s, 0, 0.065).p) < 1e-8);
  advanceRacer(player, {}, 1 / 120, 15);
  assert.equal(player.movingDeckId, definition.id);
});
