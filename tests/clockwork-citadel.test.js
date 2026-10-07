import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import course from "../src/courses/clockwork-citadel.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { initializeRacer, advanceRacer, botInput } from "../src/simulation/simulation.js";
import { packRacer, applyRacer } from "../src/multiplayer/protocol.js";
import { createRacerState } from "../src/simulation/racer-state.js";
import { createRaceSession } from "../src/simulation/race-session.js";
import { createCourseKit } from "../src/rendering/course-kit.js";
import { createClockworkClearance } from "../src/courses/adventure/clockwork-clearance.js";
const track = selectCourse(course);

test("Clockwork ribbons have clearance between nonadjacent stretches and no folded corners", () => {
  const replaced = (t) => track.branches.some((b) => b.required && t > b.start && t < b.end);
  assert.equal(track.branches.filter((b) => b.required).length, 2);
  assert.equal((course.traversals || []).length, 0);
  assert.equal((course.routeLinks || []).length, 0);
  const count = 1200;
  const frames = Array.from({ length: count }, (_, i) => track.frameAt(i / count));
  const widths = frames.map((_, i) =>
    Math.max(-track.platformEdgeAt(i / count, -1), track.platformEdgeAt(i / count, 1)),
  );
  for (let i = 0; i < count; i++) {
    if (replaced(i / count)) continue;
    for (let j = i + 1; j < count; j++) {
      if (replaced(j / count)) continue;
      const along = (Math.min(j - i, count - j + i) / count) * track.COURSE_LENGTH;
      if (along < 45) continue;
      const a = frames[i].p,
        b = frames[j].p;
      const width = widths[i] + widths[j] + 2;
      assert.ok(
        Math.hypot(a.x - b.x, a.z - b.z) > width || Math.abs(a.y - b.y) > 12,
        `ribbons overlap at ${i / count} and ${j / count}`,
      );
    }
  }
});

test("AI completes all Clockwork places on three laps without stopping for a lift", () => {
  for (let i = 0; i < 5; i++) {
    const r = initializeRacer(createRacerState({ s: 0, x: 0, skill: 0.9 - i * 0.045 }));
    const visited = new Set();
    let rides = 0,
      hits = 0;
    for (let k = 1; k < 120 * 330 && !r.finished; k++) {
      const e = advanceRacer(r, botInput(r, i, k / 120), 1 / 120, k / 120);
      visited.add(track.sectionAt(track.trackT(r.s)).id);
      rides += !!e.traversalStarted;
      hits += !!e.wallImpact;
    }
    assert.ok(r.finished);
    assert.equal(rides, 0);
    assert.equal(visited.size, course.sections.length);
    assert.equal(r.recoveryCount, 0);
    assert.ok(hits <= 3);
  }
});

test("banked sweep keeps steering, snapshot replay and recovery on the driving surface", () => {
  const s = track.sectorT(6, 0.35) * TRACK;
  const a = initializeRacer(createRacerState({ s, x: 0.15 }));
  const b = createRacerState();
  applyRacer(b, packRacer(a));
  for (let i = 1; i < 120 * 8; i++) {
    const time = i / 120,
      input = botInput(a, 0, time);
    advanceRacer(a, input, 1 / 120, time);
    advanceRacer(b, input, 1 / 120, time);
    assert.ok(a.worldPos.distanceTo(b.worldPos) < 1e-8);
    assert.equal(a.traversalIndex, -1);
  }
  assert.ok(a.s > s + 80, "driving continues through the sweep");
  assert.ok(track.BOOST_PADS.some((pad) => pad.section === 6));
  assert.ok(Math.abs(track.bankAt(track.sectorT(6, 0.4))) > 0.02);
  const player = createRacerState({ isPlayer: true });
  const session = createRaceSession({
    racers: [player],
    items: { reset() {}, step() {} },
    getPlayerInput: () => ({}),
  });
  player.s = s;
  session.recoverPlayer();
  assert.ok(Math.abs(player.s - s) < 1);
  assert.equal(player.traversalIndex, -1);
  assert.ok(player.worldPos.distanceTo(track.poseAt(player.s, 0, 0.065).p) < 0.001);
});

test("scenery clearance checks a tall prop against other floors, not just its base", () => {
  const allows = createClockworkClearance(track),
    group = new THREE.Group();
  group.position.copy(track.frameAt(track.sectorT(3, 0.4)).p);
  group.position.y = -26;
  assert.ok(allows(group, [0, 3, 0], [4, 6, 4]), "base fits below the elevated road");
  assert.ok(!allows(group, [0, 65, 0], [4, 130, 4]), "tall tower reaches through another floor");
  group.position.set(600, -26, 600);
  assert.ok(allows(group, [0, 65, 0], [4, 130, 4]));
});

test("Clockwork scenery leaves the driving ribbon clear throughout the lap", () => {
  const scene = new THREE.Scene(),
    scenery = new THREE.Group();
  scene.add(scenery);
  const world = course.buildWorld({
    THREE,
    scene,
    scenery,
    track,
    kit: createCourseKit(scenery, track),
    textures: {},
  });
  const meshes = [];
  scenery.traverse((object) => {
    if (object.isMesh && object.castShadow) meshes.push(object);
  });
  const ray = new THREE.Raycaster();
  ray.far = 6.65;
  for (const time of [0, 19]) {
    world.update(time);
    scenery.updateMatrixWorld(true);
    for (let i = 0; i < 800; i++) {
      if (track.branches.some((b) => b.required && i / 800 > b.start && i / 800 < b.end)) continue;
      for (const offset of [-9, 0, 9]) {
        const p = track.poseAt((i / 800) * TRACK, offset, 0).p;
        ray.set(p.clone().add(new THREE.Vector3(0, 7, 0)), new THREE.Vector3(0, -1, 0));
        assert.equal(
          ray.intersectObjects(meshes, false).length,
          0,
          `scenery in road at t=${i / 800}, offset=${offset}, time=${time}`,
        );
      }
      // Vertical rays can miss walls whose roof is above the camera corridor.
      // Cross-road rays also check pillars and the sides of tall facades.
      for (const height of [0.7, 2.5, 5]) {
        const left = track.poseAt((i / 800) * TRACK, -9, height).p,
          right = track.poseAt((i / 800) * TRACK, 9, height).p;
        const direction = right.clone().sub(left);
        ray.set(left, direction.clone().normalize());
        ray.far = direction.length();
        assert.equal(
          ray.intersectObjects(meshes, false).length,
          0,
          `scenery crosses road at t=${i / 800}, height=${height}, time=${time}`,
        );
      }
      ray.far = 6.65;
    }
  }
  assert.ok(scene.getObjectByName("Clock face facade"));
  assert.ok(scene.getObjectByName("Rooftop turbine crew"));
});
