import test from "node:test";
import assert from "node:assert/strict";
import course from "../src/courses/emberwing-observatory.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import {
  initializeRacer,
  advanceRacer,
  recoverRacer,
  botInput,
} from "../src/simulation/simulation.js";
import { traversalPose, rangeFor } from "../src/simulation/course-mechanics.js";
import { createRacerState } from "../src/simulation/racer-state.js";
import { packRacer, applyRacer } from "../src/multiplayer/protocol.js";
import { createRaceSession } from "../src/simulation/race-session.js";
const track = selectCourse(course);
test("caldera cannon joins its launch and landing continuously and clears the caldera", () => {
  const d = course.traversals[0],
    { start, end } = rangeFor(track, d);
  assert.ok(
    traversalPose(track, d, 0).p.distanceTo(track.poseAt(start * TRACK, 0, 0.065).p) < 1e-8,
  );
  assert.ok(traversalPose(track, d, 1).p.distanceTo(track.poseAt(end * TRACK, 0, 0.065).p) < 1e-8);
  const apex = traversalPose(track, d, 0.5);
  assert.ok(apex.p.y - track.poseAt(apex.t * TRACK, 0).p.y > 57);
});
test("five drivers launch across the caldera each lap and complete the observatory adventure", () => {
  for (let i = 0; i < 5; i++) {
    const r = initializeRacer({ s: 0, x: 0, skill: 0.9 - i * 0.045 });
    let flights = 0,
      hits = 0;
    for (let k = 1; k < 120 * 270 && !r.finished; k++) {
      const e = advanceRacer(r, botInput(r, i, k / 120), 1 / 120, k / 120);
      flights += !!e.traversalStarted;
      hits += !!e.wallImpact;
    }
    assert.ok(r.finished);
    assert.equal(flights, 3);
    assert.equal(hits, 0);
    assert.equal(r.recoveryCount || 0, 0);
  }
});

test("cannon snapshots agree through landing, recovery returns to the lip, and restart clears flight", () => {
  const { start } = rangeFor(track, course.traversals[0]);
  const a = initializeRacer(createRacerState({ s: start * TRACK, isPlayer: true }));
  for (let k = 0; k < 110; k++) advanceRacer(a, {}, 1 / 120, k / 120);
  assert.equal(a.traversalIndex, 0);
  assert.ok(a.worldPos.y > 80);
  assert.ok(a.speed > 100);
  const b = createRacerState();
  applyRacer(b, packRacer(a));
  for (let k = 110; k < Math.ceil(course.traversals[0].duration * 120) + 2; k++) {
    advanceRacer(a, {}, 1 / 120, k / 120);
    advanceRacer(b, {}, 1 / 120, k / 120);
    assert.ok(a.worldPos.distanceTo(b.worldPos) < 1e-8);
    assert.equal(a.traversalIndex, b.traversalIndex);
  }
  assert.equal(a.traversalIndex, -1);
  assert.equal(a.grounded, true);
  const session = createRaceSession({
    racers: [a],
    items: { reset() {}, step() {} },
    getPlayerInput: () => ({}),
  });
  a.s = track.sectorT(2, 0.5) * TRACK;
  a.traversalIndex = 0;
  session.recoverPlayer();
  assert.ok(a.s < start * TRACK);
  assert.equal(a.traversalIndex, -1);
  assert.ok(a.worldPos.distanceTo(track.poseAt(a.s, 0, 0.065).p) < 1e-8);
  session.begin();
  assert.equal(a.traversalIndex, -1);
  assert.ok(a.worldPos.y < 20);
});

test("market junctions have a single paved floor instead of overlapping ribbons", async () => {
  const THREE = await import("../vendor/three/three.module.js");
  const { buildExperienceWorld } = await import("../src/courses/experiences/world.js");
  const scene = new THREE.Scene();
  buildExperienceWorld({ scene, track });
  scene.updateMatrixWorld(true);
  const roads = [];
  scene.traverse((o) => {
    if (o.name === "Authored experience driving surface") roads.push(o);
  });
  assert.equal(roads.length, 2);
  for (const street of track.branches) {
    for (let i = 0; i <= 500; i++) {
      assert.ok(
        Math.abs(street.frameAt(i / 500).curvature) * street.halfWidth < 0.8,
        "street bend leaves enough radius for the complete pavement width",
      );
    }
  }
  const ray = new THREE.Raycaster();
  ray.far = 5;
  for (const q of [0.01, 0.04, 0.07, 0.93, 0.96, 0.99]) {
    for (const offset of [-0.4, 0.4]) {
      const p = track.branches[0]
        .poseAt(q, 0)
        .p.add(track.branches[1].poseAt(q, 0).p)
        .multiplyScalar(0.5);
      p.x += offset;
      ray.set(p.add(new THREE.Vector3(0, 2, 0)), new THREE.Vector3(0, -1, 0));
      assert.equal(ray.intersectObjects(roads, false).length, 1, `junction q=${q}`);
    }
  }
});

test("Emberwing driving platforms stay separate outside the market junction and cannon flight", () => {
  const count = 800;
  const replaced = (t) =>
    track.branches.some((b) => t > b.start && t < b.end) ||
    course.traversals.some(
      (d) =>
        t > track.sectorT(d.section, d.startFraction) &&
        t < track.sectorT(d.section, d.endFraction),
    );
  const frames = Array.from({ length: count }, (_, i) => track.frameAt(i / count));
  const widths = frames.map((_, i) =>
    Math.max(-track.platformEdgeAt(i / count, -1), track.platformEdgeAt(i / count, 1)),
  );
  for (let i = 0; i < count; i++) {
    if (replaced(i / count)) continue;
    for (let j = i + 1; j < count; j++) {
      if (replaced(j / count)) continue;
      if ((Math.min(j - i, count - j + i) / count) * track.COURSE_LENGTH < 45) continue;
      const a = frames[i].p,
        b = frames[j].p;
      assert.ok(
        Math.hypot(a.x - b.x, a.z - b.z) > widths[i] + widths[j] || Math.abs(a.y - b.y) > 12,
        `platform overlap at ${i / count} and ${j / count}`,
      );
    }
  }
  assert.equal(track.SHORTCUT, null);
});

test("both market streets replay, recover on their chosen floor and rejoin cleanly", () => {
  for (const branch of track.branches) {
    const q = 0.2;
    const pose = branch.poseAt(q);
    const a = initializeRacer(
      createRacerState({ s: (branch.start + q * (branch.end - branch.start)) * TRACK, skill: 0.9 }),
    );
    a.worldPos.copy(pose.p);
    a.yaw = track.yawFor(pose.tangent);
    a.routeChoice = branch.index;
    a.routeGroup = branch.groupIndex;
    a.lastSafeRoute = branch.index;
    a.lastSafeOffset = 0;
    recoverRacer(a);
    assert.equal(a.routeChoice, branch.index);
    assert.ok(a.worldPos.distanceTo(pose.p) < 0.01);
    const b = createRacerState();
    applyRacer(b, packRacer(a));
    let hits = 0;
    for (let k = 1; k <= 120 * 14 && a.s < branch.end * TRACK + 10; k++) {
      const input = botInput(a, branch.index, k / 120);
      hits += !!advanceRacer(a, input, 1 / 120, k / 120).wallImpact;
      advanceRacer(b, input, 1 / 120, k / 120);
      assert.ok(a.worldPos.distanceTo(b.worldPos) < 1e-8);
      assert.equal(a.routeChoice, b.routeChoice);
    }
    assert.ok(a.s > branch.end * TRACK);
    assert.equal(a.routeChoice, 0);
    assert.equal(a.recoveryCount, 1);
    assert.equal(hits, 0);
  }
});
