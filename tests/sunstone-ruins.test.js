import test from "node:test";
import assert from "node:assert/strict";
import course from "../src/courses/sunstone-ruins.js";
import {
  createTrack,
  selectCourse,
  TRACK,
  frameAt,
  trackT,
  poseAt,
  metresToProgress,
  shortcutWidth,
  projectTrack,
  SHORTCUT,
} from "../src/track/track.js";
import { initializeRacer, advanceRacer, botInput } from "../src/simulation/simulation.js";
import { FIXED_DT } from "../src/simulation/physics.js";
import { cartAt, cartContact } from "../src/simulation/hazards.js";
import { consumeItem } from "../src/simulation/items.js";

// Each test file has its own Node process; selection never touches other courses.
const track = selectCourse(course);

test("Sunstone route separates roads and reveals the temple in front of the ridge", () => {
  assert.equal(track.SECTIONS.length, 6);
  assert.ok(track.COURSE_LENGTH > 1450 && track.COURSE_LENGTH < 1600);
  for (let i = 0; i < 300; i++)
    for (let j = i + 1; j < 300; j++) {
      if ((Math.min(j - i, 300 - j + i) * track.COURSE_LENGTH) / 300 < 75) continue;
      const a = track.frameAt(i / 300).p,
        b = track.frameAt(j / 300).p;
      assert.ok(
        Math.hypot(a.x - b.x, a.z - b.z) > 45,
        "Nonadjacent road strips must remain separate",
      );
    }
  const crest = track.frameAt(track.sectorT(2, 0.55));
  const temple = track.poseAt(track.sectorT(3, 0.2) * TRACK, 52).p;
  assert.ok(
    temple.sub(crest.p).normalize().dot(crest.tangent) > 0.7,
    "Temple must be ahead at reveal",
  );
  const detached = createTrack(course);
  assert.deepEqual(
    detached.SECTIONS.map((s) => s.id),
    track.SECTIONS.map((s) => s.id),
  );
});

test("all five isolated drivers finish three laps with readable sector pacing", () => {
  for (let index = 0; index < 5; index++) {
    const racer = initializeRacer({ s: 0, x: 0, skill: 0.9 - index * 0.045, drift: 0 });
    let lap = 0,
      section = 0,
      entry = 0,
      previousFinish = 0,
      wallHits = 0,
      hazardHits = 0;
    for (let tick = 1; tick < 120 * 230 && !racer.finished; tick++) {
      const time = tick * FIXED_DT;
      const event = advanceRacer(racer, botInput(racer, index, time), FIXED_DT, time);
      wallHits += !!event.wallImpact;
      hazardHits += !!event.cartImpact;
      const boundary =
        section < 5 ? (lap + track.SECTIONS[section + 1].start) * TRACK : (lap + 1) * TRACK;
      if (racer.s >= boundary) {
        assert.ok(
          time - entry >= 6 && time - entry <= 14,
          `Driver ${index} section ${section}: ${time - entry}s`,
        );
        entry = time;
        section++;
        if (section === 6) {
          assert.ok(time - previousFinish >= 55 && time - previousFinish <= 65);
          previousFinish = time;
          section = 0;
          lap++;
        }
      }
    }
    assert.ok(racer.finished);
    assert.equal(lap, 3);
    assert.equal(wallHits, 0);
    assert.equal(hazardHits, 0);
    assert.ok(Number.isFinite(racer.worldPos.x) && Number.isFinite(racer.worldPos.y));
  }
});

test("stone shuttle warns and leaves the authored left lane physically clear", () => {
  assert.equal(cartAt(29).offset, 12);
  assert.ok(cartAt(31).warning);
  assert.equal(cartAt(35).offset, 0);
  for (let time = 30; time < 42; time += 0.05) {
    const hazard = cartAt(time),
      lane = poseAt(hazard.s, course.hazard.safeLane, 0.065).p;
    assert.equal(cartContact(lane, time), null);
    const bounds = track.collisionBounds(hazard.s / TRACK);
    assert.ok(course.hazard.safeLane > bounds.left && course.hazard.safeLane < bounds.right);
  }
  assert.ok(cartContact(cartAt(35).p, 35));
});

function traverse(line, mushroom = false) {
  const start = SHORTCUT.start - 0.025,
    end = SHORTCUT.end + 0.025;
  const racer = initializeRacer({
    s: start * TRACK,
    x: (line === "outside" ? -5.2 : 0) / 6.25,
    drift: 0,
  });
  const f = frameAt(start);
  racer.vx = f.tangent.x * 25;
  racer.vz = f.tangent.z * 25;
  racer.speed = 90;
  racer.item = "mushroom";
  racer.itemCount = 1;
  let used = false,
    hits = 0,
    sand = false;
  for (let tick = 1; tick < 120 * 15; tick++) {
    const t = trackT(racer.s),
      ahead = trackT(racer.s + metresToProgress(24));
    const offset = line === "cut" ? shortcutWidth(ahead) * 0.43 : line === "outside" ? -5.2 : 0;
    const target = poseAt(ahead * TRACK, offset).p;
    const desired = Math.atan2(-(target.x - racer.worldPos.x), -(target.z - racer.worldPos.z));
    const error = Math.atan2(Math.sin(desired - racer.yaw), Math.cos(desired - racer.yaw));
    const surface = projectTrack(racer.worldPos, racer.s);
    sand ||= surface.offroad;
    if (mushroom && !used && (line === "cut" ? surface.offroad : t > SHORTCUT.start + 0.03)) {
      assert.equal(consumeItem(racer), "mushroom");
      used = true;
    }
    const event = advanceRacer(
      racer,
      { throttle: true, steer: Math.max(-1, Math.min(1, -error * 2.8)) },
      FIXED_DT,
      1,
    );
    hits += !!event.wallImpact;
    assert.ok(Number.isFinite(racer.worldPos.y));
    if (racer.s >= end * TRACK)
      return { seconds: tick * FIXED_DT, hits, sand, offset: racer.x * 6.25 };
  }
  throw new Error("Shortcut traversal did not rejoin");
}

test("inside sand is legal and a real single mushroom makes its line worthwhile", () => {
  const main = traverse("main"),
    boostedMain = traverse("main", true),
    outside = traverse("outside");
  const cut = traverse("cut"),
    boostedCut = traverse("cut", true);
  assert.ok(cut.sand && boostedCut.sand);
  for (const run of [main, boostedMain, outside, cut, boostedCut]) {
    assert.equal(run.hits, 0);
    assert.ok(Math.abs(run.offset) < 9, "Must rejoin inside road limits");
  }
  assert.ok(boostedCut.seconds < main.seconds - 0.25);
  assert.ok(boostedCut.seconds < boostedMain.seconds);
  assert.ok(boostedCut.seconds < outside.seconds);
  assert.ok(cut.seconds > main.seconds, "Taking sand without boost must have a cost");
  for (let t = SHORTCUT.start + 0.018; t <= SHORTCUT.end - 0.018; t += 0.002) {
    const position = poseAt(t * TRACK, 11, 0.065).p,
      surface = projectTrack(position, t * TRACK);
    assert.ok(surface.offroad);
    assert.ok(Math.abs(surface.height - position.y) < 0.03);
    assert.ok(Math.abs(surface.t - t) < 0.001);
    assert.ok(track.bankAt(t) === 0);
  }
});
