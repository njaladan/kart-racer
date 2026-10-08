#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { COURSES } from "../src/courses/registry.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { createRaceGrid } from "../src/simulation/race-grid.js";
import { RACERS } from "../src/rendering/racer-roster.js";
import { createRaceSession } from "../src/simulation/race-session.js";
import { createRaceItems } from "../src/simulation/race-items.js";
import { initializeRacer, advanceRacer, botInput } from "../src/simulation/simulation.js";
import { createRacerState } from "../src/simulation/racer-state.js";
import { resetRaceProgress } from "../src/simulation/race.js";

const output = resolve(process.env.PLAYTEST_OUTPUT || "/tmp/kart-review/simulation");
await mkdir(output, { recursive: true });
const originalRandom = Math.random;
const reports = [];
function seedRandom(seed) {
  let value = seed;
  Math.random = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}
function finite(racer) {
  return [racer.s, racer.speed, racer.yaw, ...racer.worldPos.toArray()].every(Number.isFinite);
}
try {
  for (const course of COURSES.filter(
    (c) => !process.argv.slice(2).length || process.argv.slice(2).includes(c.id),
  )) {
    const track = selectCourse(course),
      races = [],
      branches = [];
    for (const seed of [1, 3]) {
      seedRandom(seed);
      const racers = createRaceGrid(RACERS),
        player = racers[0];
      const boxes = track.ITEM_ROW_DEFINITIONS.flatMap((row) =>
        (row.offsets || [-0.58, 0, 0.58]).map((x) => ({
          s: row.t * TRACK,
          x: row.offsets ? x / 6.25 : x,
          active: true,
          respawn: 0,
        })),
      );
      let session,
        invalid = false;
      const events = Object.fromEntries(
        racers.map((r) => [
          r.racerId,
          { walls: 0, recoveries: 0, mechanisms: 0, hits: 0, tricks: 0 },
        ]),
      );
      const recoveryDetails = [],
        recent = new Map(racers.map((r) => [r.racerId, []]));
      const items = createRaceItems({
        racers,
        boxes,
        createEffect: () => ({}),
        removeEffect: () => {},
        onHit: (...args) => session.hitRacer(...args),
      });
      session = createRaceSession({
        racers,
        items,
        stopOnPlayerFinish: false,
        // This uses the actual human steering/engine with assistance, matching
        // browser test-auto. Rivals retain their own engines and item decisions.
        getPlayerInput: (time) => ({ ...botInput(player, 0, time, racers), drift: false }),
        onHit: (racer) => events[racer.racerId].hits++,
        onRacerEvent: (racer, event) => {
          const e = events[racer.racerId];
          e.walls += !!event.wallImpact;
          e.recoveries += !!event.recovered;
          e.mechanisms += !!event.cartImpact;
          e.tricks += !!event.trickStarted;
          if (event.recovered)
            recoveryDetails.push({
              racer: racer.racerId,
              time: session.getState().raceTime,
              recent: [...recent.get(racer.racerId)],
            });
          invalid ||= !finite(racer);
        },
      });
      session.begin(0.01);
      for (let step = 0; step < 120 * 420 && !racers.every((r) => r.finished) && !invalid; step++) {
        session.step(1 / 120);
        if (step % 12 === 0)
          for (const racer of racers) {
            const history = recent.get(racer.racerId);
            history.push({
              time: session.getState().raceTime,
              t: track.trackT(racer.s),
              s: racer.s,
              offset: racer.x * 6.25,
              speed: racer.speed,
              spin: racer.spin,
              grounded: racer.grounded,
              falling: racer.falling,
              boost: racer.boost,
              jump: racer.jumpKind,
              position: racer.worldPos.toArray(),
            });
            if (history.length > 30) history.shift();
          }
      }
      races.push({
        seed,
        invalid,
        finished: racers.every((r) => r.finished),
        seconds: session.getState().raceTime,
        racers: racers.map((r) => ({
          id: r.racerId,
          finished: r.finished,
          seconds: Number.isFinite(r.finishTime) ? r.finishTime : null,
          ...events[r.racerId],
        })),
        recoveryDetails,
      });
    }
    for (const branch of track.branches)
      for (const index of [0, 1, 4]) {
        const q = 0.025,
          lap = branch.lap || 0;
        const s = (lap + branch.start + (branch.end - branch.start) * q) * TRACK;
        const racer = initializeRacer(
          createRacerState({
            s,
            x: 0,
            skill: 0.95 - index * 0.04,
            isPlayer: index === 0,
            isBot: index !== 0,
          }),
        );
        racer.routeChoice = branch.index;
        racer.routeGroup = branch.groupIndex;
        racer.lastSafeRoute = branch.index;
        racer.worldPos.copy(branch.poseAt(q).p);
        racer.renderFrom.copy(racer.worldPos);
        racer.yaw = track.yawFor(branch.frameAt(q).tangent);
        racer.lap = lap;
        resetRaceProgress(racer, TRACK);
        let walls = 0,
          recoveries = 0,
          seconds = 0,
          invalid = false;
        for (let step = 1; step < 120 * 90; step++) {
          seconds = step / 120;
          const event = advanceRacer(
            racer,
            botInput(racer, index, 10 + seconds),
            1 / 120,
            10 + seconds,
          );
          walls += !!event.wallImpact;
          recoveries += !!event.recovered;
          invalid ||= !finite(racer);
          if (invalid || (!racer.routeChoice && racer.s >= (lap + branch.end) * TRACK - 1)) break;
        }
        branches.push({
          id: branch.id,
          index,
          humanEngine: index === 0,
          seconds,
          walls,
          recoveries,
          invalid,
          rejoined: !racer.routeChoice && racer.s >= (lap + branch.end) * TRACK - 1,
        });
      }
    const report = { course: course.id, races, branches };
    reports.push(report);
    await writeFile(resolve(output, `${course.id}.json`), JSON.stringify(report, null, 2));
    console.log(
      JSON.stringify({
        course: course.id,
        races: races.map((r) => ({
          seed: r.seed,
          finished: r.finished,
          invalid: r.invalid,
          recoveries: r.racers.reduce((n, r) => n + r.recoveries, 0),
        })),
        branches,
      }),
    );
  }
} finally {
  Math.random = originalRandom;
}
await writeFile(resolve(output, "report.json"), JSON.stringify(reports, null, 2));
if (
  reports.some(
    (r) =>
      r.races.some((r) => !r.finished || r.invalid) ||
      r.branches.some((b) => !b.rejoined || b.invalid || b.recoveries || b.walls),
  )
)
  process.exitCode = 1;
