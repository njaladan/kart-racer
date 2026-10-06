import test from "node:test";
import assert from "node:assert/strict";
import sunstone from "../src/courses/sunstone-ruins.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { initializeRacer, advanceRacer } from "../src/simulation/simulation.js";
import {
  traversalPose,
  rangeFor,
  scaleAt,
  unfoldPhase,
} from "../src/simulation/course-mechanics.js";
import { packRacer, applyRacer } from "../src/multiplayer/protocol.js";
import { createRaceSession } from "../src/simulation/race-session.js";
import { createRacerState } from "../src/simulation/racer-state.js";

for (const kind of ["lift", "cannon"])
  test(`${kind} traversal preserves progress, snapshot replay and continuous landing`, () => {
    const definition = {
      kind,
      id: kind,
      section: 2,
      startFraction: 0.12,
      endFraction: 0.7,
      duration: 3,
      period: 10,
      hold: 1,
      height: 48,
    };
    const track = selectCourse({ ...sunstone, traversals: [definition] }),
      range = rangeFor(track, definition);
    const racer = initializeRacer(createRacerState({ s: range.start * TRACK + 0.02, x: 0.2 }));
    let started = 0,
      ended = 0,
      maxHeight = 0;
    for (let i = 0; i < 120 * 15; i++) {
      const time = 4 + i / 120,
        event = advanceRacer(racer, {}, 1 / 120, time);
      started += !!event.traversalStarted;
      ended += !!event.traversalFinished;
      if (racer.traversalIndex >= 0) {
        const pose = traversalPose(
          track,
          definition,
          racer.traversalProgress,
          racer.traversalOffset,
        );
        assert.ok(racer.worldPos.distanceTo(pose.p) < 0.001);
        maxHeight = Math.max(
          maxHeight,
          racer.worldPos.y - track.frameAt(track.trackT(racer.s)).p.y,
        );
        if (i === 600) {
          const remote = createRacerState();
          applyRacer(remote, packRacer(racer));
          assert.equal(remote.traversalDeparture, racer.traversalDeparture);
          assert.equal(remote.traversalProgress, racer.traversalProgress);
          advanceRacer(remote, {}, 1 / 120, time + 1 / 120);
          advanceRacer(racer, {}, 1 / 120, time + 1 / 120);
          assert.ok(remote.worldPos.distanceTo(racer.worldPos) < 1e-8);
        }
      }
      if (event.traversalFinished) break;
    }
    assert.equal(started, 1);
    assert.equal(ended, 1);
    assert.equal(racer.traversalIndex, -1);
    assert.ok(racer.grounded);
    assert.ok(racer.nextCheckpoint > Math.floor(range.start * 12) + 1);
    assert.ok(Math.hypot(racer.vx, racer.vz) > 10);
    if (kind === "cannon") assert.ok(maxHeight > 47);
  });

test("recovery from a missing transit span returns to the boarding entrance", () => {
  const definition = {
    kind: "cannon",
    id: "flight",
    section: 2,
    startFraction: 0.1,
    endFraction: 0.8,
    duration: 3,
    height: 45,
  };
  const track = selectCourse({ ...sunstone, traversals: [definition] }),
    range = rangeFor(track, definition),
    racer = createRacerState({
      s: ((range.start + range.end) / 2) * TRACK,
      isPlayer: true,
      traversalIndex: 0,
    });
  const session = createRaceSession({
    racers: [racer],
    items: { reset() {}, step() {} },
    getPlayerInput: () => ({}),
  });
  // Session creation resets the grid; put the racer into the transit for recovery.
  racer.s = ((range.start + range.end) / 2) * TRACK;
  racer.traversalIndex = 0;
  session.recoverPlayer();
  assert.ok(racer.s < range.start * TRACK);
  assert.equal(racer.traversalIndex, -1);
  assert.ok(racer.worldPos.distanceTo(track.poseAt(racer.s, 0, 0.065).p) < 0.001);
});

test("scale zones span places with smooth portals; unfolding opens once on the race clock", () => {
  const track = selectCourse({
    ...sunstone,
    scaleZones: [{ section: 1, startFraction: 0.1, endSection: 3, endFraction: 0.9, scale: 0.28 }],
    unfold: { openAfter: 5 },
  });
  assert.equal(scaleAt(track, track.sectorT(2, 0.5)), 0.28);
  assert.equal(scaleAt(track, 0), 1);
  assert.equal(unfoldPhase(track.course, 4), 0);
  assert.equal(unfoldPhase(track.course, 7), 1);
  assert.equal(unfoldPhase(track.course, 70), 1);
});
