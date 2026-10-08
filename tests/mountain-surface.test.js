import { createRacerState } from "../src/simulation/racer-state.js";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import course from "../src/courses/frostpeak-festival.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { initializeRacer, advanceRacer, botInput } from "../src/simulation/simulation.js";
import { buildExperienceWorld } from "../src/courses/experiences/world.js";
import { createRouteClearance } from "../src/rendering/route-clearance.js";

test("the full ski face has continuous support, clear powder and no folded triangles", () => {
  const track = selectCourse(course),
    scene = new THREE.Scene();
  buildExperienceWorld({ scene, track, assets: { models: {} } });
  scene.updateMatrixWorld(true);
  const face = scene.getObjectByName("Open Dragonback downhill snow face");
  const positions = face.geometry.attributes.position,
    index = face.geometry.index;
  const triangle = new THREE.Triangle();
  for (let i = 0; i < index.count; i += 3) {
    triangle.a.fromBufferAttribute(positions, index.getX(i));
    triangle.b.fromBufferAttribute(positions, index.getX(i + 1));
    triangle.c.fromBufferAttribute(positions, index.getX(i + 2));
    assert.ok(triangle.getNormal(new THREE.Vector3()).y > 0, `folded snow triangle ${i / 3}`);
  }
  const allows = createRouteClearance(track),
    identity = new THREE.Group();
  for (let i = 2; i < 49; i++) {
    const t = track.sectorT(4, i / 50),
      width = track.mountainSurface.widthAt(t);
    for (const ratio of [-0.92, -0.7, -0.4, 0, 0.4, 0.7, 0.92]) {
      const p = track.poseAt(t * track.TRACK, width * ratio, 0).p;
      const projection = track.projectTrack(p, t * track.TRACK);
      const floor = track.floorAt(projection);
      assert.ok(floor.supported && !floor.outside, `unsupported powder ${i}, ${ratio}`);
      assert.ok(Math.abs(floor.height - p.y - 0.065) < 0.001);
      const hits = new THREE.Raycaster(
        p.clone().add(new THREE.Vector3(0, 5, 0)),
        new THREE.Vector3(0, -1, 0),
        0,
        10,
      ).intersectObject(face);
      assert.ok(hits.length, `missing snow ${i}, ${ratio}`);
      assert.ok(
        Math.abs(hits[0].point.y - p.y) < 0.18,
        `snow collision seam ${i}, ${ratio}: ${hits[0].point.y - p.y}`,
      );
      assert.equal(
        allows(identity, [p.x, p.y + 1, p.z], [1, 2, 1]),
        false,
        "powder reserves scenery clearance",
      );
      for (const delta of [-0.01, 0.01]) {
        const neighbour = p.clone().addScaledVector(projection.horizontalRight, delta);
        assert.ok(
          Math.abs(track.mountainSurface.heightAt(neighbour, t) - p.y) < 0.06,
          "no nearest-run height snap",
        );
      }
    }
  }
  assert.equal(
    track.pathwayObstacles.some(
      (o) => o.t >= track.SECTIONS[4].start && o.t < track.SECTIONS[4].end,
    ),
    false,
  );
});

test("steering from either ski run into adjacent powder keeps tires on the same floor", () => {
  const track = selectCourse(course);
  for (const branch of track.branches)
    for (const side of [-1, 1])
      for (const q of [0.3, 0.7]) {
        const s = (branch.start + (branch.end - branch.start) * q) * track.TRACK;
        const racer = initializeRacer({ s, x: 0, routeChoice: branch.index });
        racer.routeChoice = branch.index;
        racer.routeGroup = branch.groupIndex;
        const pose = branch.poseAt(q, side * (branch.halfWidth - 0.1));
        racer.worldPos.copy(pose.p);
        racer.yaw = track.yawFor(pose.right.clone().multiplyScalar(side));
        racer.vx = pose.right.x * side * 5;
        racer.vz = pose.right.z * side * 5;
        let left = false;
        for (let tick = 0; tick < 120; tick++) {
          const event = advanceRacer(racer, { throttle: true }, 1 / 120, tick / 120);
          left ||= !racer.routeChoice;
          assert.ok(
            !event.recovered && !racer.falling && racer.grounded,
            `${branch.id}: false fall into powder`,
          );
        }
        assert.ok(left, `${branch.id}: the run can be exited sideways`);
        assert.ok(!racer.recoveryCount);
      }
});

test("a powder approach can enter the physical quarterpipe after the original fork", () => {
  const track = selectCourse(course),
    branch = track.branches.find((b) => b.ramp);
  const q = branch.ramp.start - 0.015,
    s = (branch.start + (branch.end - branch.start) * q) * TRACK;
  const racer = initializeRacer(createRacerState({ s, x: 0, isPlayer: true }));
  racer.routeGroup = branch.groupIndex;
  racer.worldPos.copy(branch.poseAt(q).p);
  racer.renderFrom.copy(racer.worldPos);
  racer.yaw = track.yawFor(branch.frameAt(q).tangent);
  racer.vx = branch.frameAt(q).tangent.x * 25;
  racer.vz = branch.frameAt(q).tangent.z * 25;
  racer.speed = 90;
  let entered = false,
    jumped = false;
  for (let step = 1; step <= 120 * 3; step++) {
    advanceRacer(racer, botInput(racer, 0, step / 120), 1 / 120, step / 120);
    entered ||= racer.routeChoice === branch.index;
    jumped ||= racer.jumpKind === "quarterpipe" && !racer.grounded;
    assert.equal(racer.falling, false);
  }
  assert.ok(entered && jumped, "powder line uses the visible launch surface");
  assert.equal(racer.recoveryCount || 0, 0);
});
