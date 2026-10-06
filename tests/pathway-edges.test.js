import test from "node:test";
import assert from "node:assert/strict";
import { COURSES } from "../src/courses/registry.js";
import { PATHWAY_KINDS } from "../src/courses/pathway-edges.js";
import { validateCourseDefinition } from "../src/courses/course-contract.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { createRacerState } from "../src/simulation/racer-state.js";
import { initializeRacer, advanceRacer, recoverRacer } from "../src/simulation/simulation.js";
import { FIXED_DT, verticalMotion } from "../src/simulation/physics.js";
import { createShell, advanceShell } from "../src/simulation/items.js";
import { packRacer, applyRacer } from "../src/multiplayer/protocol.js";

function placeAtEdge(track, section, side, beyond, fraction = 0.51) {
  const t = track.sectorT(section, fraction);
  const edge = track.edgeAt(t, side);
  const offset = edge.offset + side * beyond;
  const racer = initializeRacer(createRacerState({ s: t * TRACK, x: offset / 6.25 }));
  return { racer, t, edge };
}

test("all twelve courses have predominantly open environmental boundaries", () => {
  assert.equal(COURSES.length, 12);
  for (const course of COURSES) {
    const track = selectCourse(course);
    let open = 0,
      total = 0;
    for (const [index, section] of track.SECTIONS.entries()) {
      for (const side of [-1, 1]) {
        const edge = track.edgeAt(track.sectorT(index, 0.5), side);
        total += section.end - section.start;
        if (edge.mode !== "wall") open += section.end - section.start;
        const solid = track.collisionBounds(track.sectorT(index, 0.5));
        assert.equal(side < 0 ? solid.leftSolid : solid.rightSolid, edge.mode === "wall");
        assert.ok(PATHWAY_KINDS[edge.kind]);
      }
    }
    assert.ok(open / total > 0.65, `${course.id}: ${Math.round((open / total) * 100)}% open`);
    assert.ok(
      course.pathwayEdges.some((pair) =>
        Object.values(pair).some((kind) => PATHWAY_KINDS[kind].mode === "drop"),
      ),
    );
  }
});

test("soft shoulders allow leaving the path and returning without a wall or rescue", () => {
  for (const course of COURSES) {
    const track = selectCourse(course);
    const index = course.pathwayEdges.findIndex((pair) => PATHWAY_KINDS[pair.left].mode === "soft");
    let placement;
    for (const fraction of [0.51, 0.38, 0.62, 0.27, 0.73]) {
      placement = placeAtEdge(track, index, -1, 1.7, fraction);
      if (!track.pathwayContact(placement.racer.worldPos)) break;
    }
    const { racer, t, edge } = placement;
    assert.equal(track.pathwayContact(racer.worldPos), null, `${course.id}: test uses a real gap`);
    // Use a gap between clusters, not an obstacle footprint.
    const start = racer.worldPos.clone();
    const event = advanceRacer(racer, {}, FIXED_DT);
    assert.equal(event.wallImpact, false, course.id);
    assert.equal(racer.grounded, true, course.id);
    assert.equal(racer.falling, false, course.id);
    assert.equal(racer.offPathTime, 0, course.id);
    assert.ok(Math.hypot(racer.worldPos.x - start.x, racer.worldPos.z - start.z) < 0.02);
    const floor = track.floorAt(track.projectTrack(racer.worldPos, racer.s));
    assert.ok(
      Math.abs(racer.worldPos.y - floor.height) < 0.01,
      `${course.id} shoulder matches support`,
    );
    assert.ok(track.platformEdgeAt(t, -1) < edge.offset);
  }
});

test("open drops fall visibly, freeze race progress and recover every course onto the safe route", () => {
  for (const course of COURSES) {
    const track = selectCourse(course);
    const index = course.pathwayEdges.findIndex(
      (pair) => PATHWAY_KINDS[pair.right].mode === "drop",
    );
    const { racer } = placeAtEdge(track, index, 1, 1.4);
    const startS = racer.s,
      y = racer.worldPos.y;
    racer.lastSafeS = startS - 2;
    racer.trickActive = true;
    const checkpoints = racer.nextCheckpoint;
    let recovered = false;
    for (let i = 0; i < 180; i++) {
      const event = advanceRacer(racer, {}, FIXED_DT, i * FIXED_DT);
      assert.equal(event.trickLanded, event.recovered ? undefined : false);
      assert.equal(racer.nextCheckpoint, checkpoints, course.id);
      if (i === 45) {
        assert.equal(racer.grounded, false, course.id);
        assert.ok(racer.worldPos.y < y - 0.4, course.id);
        assert.equal(racer.s, startS, course.id);
      }
      if (event.recovered) {
        recovered = true;
        break;
      }
    }
    assert.ok(recovered, course.id);
    assert.equal(racer.s, startS - 2, course.id);
    assert.equal(racer.falling, false);
    assert.equal(racer.x, 0);
    assert.equal(racer.speed, 0);
    assert.equal(racer.boost, 0);
    assert.equal(racer.trickActive, false);
    assert.ok(racer.invulnerable > 0);
    assert.ok(racer.worldPos.distanceTo(track.poseAt(racer.s, 0, 0.065).p) < 1e-8);
    assert.ok(racer.renderFrom.distanceTo(racer.worldPos) < 1e-8);
  }
});

test("a fallen racer cannot land on a phantom floor, and fall motion survives snapshots", () => {
  const track = selectCourse(COURSES.find((c) => c.id === "pocket-pantry"));
  const { racer: authority } = placeAtEdge(track, 2, 1, 2);
  authority.lastSafeS = authority.s;
  for (let i = 0; i < 30; i++) advanceRacer(authority, {}, FIXED_DT, i * FIXED_DT);
  const prediction = createRacerState();
  applyRacer(prediction, packRacer(authority));
  let recovered = false;
  for (let i = 30; i < 180; i++) {
    const a = advanceRacer(authority, {}, FIXED_DT, i * FIXED_DT);
    const b = advanceRacer(prediction, {}, FIXED_DT, i * FIXED_DT);
    assert.equal(a.recovered, b.recovered);
    assert.ok(authority.worldPos.distanceTo(prediction.worldPos) < 1e-9);
    assert.equal(authority.s, prediction.s);
    if (a.recovered) {
      recovered = true;
      break;
    }
  }
  assert.ok(recovered);
  const fallen = createRacerState();
  fallen.grounded = false;
  fallen.worldPos.y = -10;
  for (let i = 0; i < 200; i++) verticalMotion(fallen, 0, 0, FIXED_DT, false);
  assert.equal(fallen.grounded, false);
  assert.ok(fallen.worldPos.y < -30);
});

test("straying far into terrain recovers without adding progress, while manual reset clears a fall", () => {
  const track = selectCourse(COURSES[0]);
  const { racer } = placeAtEdge(track, 0, 1, 25);
  const s = racer.s;
  racer.lastSafeS = s - 1;
  let recovered = false;
  for (let i = 0; i < 200; i++) {
    if (advanceRacer(racer, {}, FIXED_DT, i * FIXED_DT).recovered) {
      recovered = true;
      break;
    }
    assert.equal(racer.s, s);
  }
  assert.ok(recovered);
  assert.equal(racer.s, s - 1);
  racer.falling = true;
  racer.offPathTime = 0.8;
  racer.boost = 2;
  recoverRacer(racer);
  assert.equal(racer.falling, false);
  assert.equal(racer.offPathTime, 0);
  assert.equal(racer.boost, 0);
});

test("only structural boundaries reflect shells; open drops consume them", () => {
  const track = selectCourse(COURSES[0]);
  for (const [section, side, solid] of [
    [2, -1, true],
    [3, 1, false],
  ]) {
    const { racer, t, edge } = placeAtEdge(track, section, side, -0.6);
    const shell = createShell(racer, "green");
    shell.worldPos.copy(track.poseAt(t * TRACK, edge.offset - side * 0.6, 0.6).p);
    const f = track.frameAt(t);
    shell.vx = f.right.x * side * 44;
    shell.vz = f.right.z * side * 44;
    advanceShell(shell, 0.03);
    if (solid) assert.ok(shell.vx * f.right.x * side + shell.vz * f.right.z * side < 0);
    else assert.equal(shell.life, 0);
  }
});

test("environment clusters collide only at visible footprints, and edge data validates", () => {
  const track = selectCourse(COURSES[0]);
  const obstacle = track.pathwayObstacles[0];
  const position = obstacle.p.clone();
  position.x += obstacle.radius + 0.5;
  position.y += 0.4;
  const contact = track.pathwayContact(position, 0.9);
  assert.ok(contact?.penetration > 0);
  position.x += 5;
  assert.equal(track.pathwayContact(position, 0.9), null);
  assert.throws(
    () => validateCourseDefinition({ ...COURSES[0], pathwayEdges: [] }),
    /pathwayEdges/,
  );
  const edges = COURSES[0].pathwayEdges.map((pair) => ({ ...pair }));
  edges[0].left = "unknown";
  assert.throws(
    () => validateCourseDefinition({ ...COURSES[0], pathwayEdges: edges }),
    /pathwayEdges\[0\].left/,
  );
});
