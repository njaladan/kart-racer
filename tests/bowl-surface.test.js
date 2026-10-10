import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import course from "../src/courses/clockwork-citadel.js";
import { selectCourse } from "../src/track/track.js";
import { buildAreaSurfaces, groundGeometry } from "../src/rendering/area-surfaces.js";
import { createCourseKit } from "../src/rendering/course-kit.js";
import { buildWatchInterior } from "../src/courses/experiences/watch-interior.js";
import { createRouteClearance } from "../src/rendering/route-clearance.js";
import { createRacerState } from "../src/simulation/racer-state.js";
import { initializeRacer, advanceRacer, recoverRacer } from "../src/simulation/simulation.js";
import { createShell, advanceShell } from "../src/simulation/items.js";
import { drive } from "../src/simulation/physics.js";
import { packRacer, applyRacer } from "../src/multiplayer/protocol.js";

const track = selectCourse(course),
  bowl = track.areaSurfaces[0];

test("gold bowl markings stay above the rendered lane and floor on both routes", () => {
  const scene = new THREE.Scene(),
    scenery = new THREE.Group();
  scene.add(scenery);
  const kit = createCourseKit(scenery, track);
  buildAreaSurfaces(track, kit, {});
  buildWatchInterior({ track, kit, scenery, animated: [], updates: [], sign() {} });
  scene.updateMatrixWorld(true);
  const floor = scene.getObjectByName("Continuous curved driving bowl"),
    guides = scenery.userData.bowlGuides,
    lanes = guides.filter((object) => object.name === "Bowl route gently widens and converges"),
    markings = guides.filter((object) => !lanes.includes(object)),
    ray = new THREE.Raycaster(),
    down = new THREE.Vector3(0, -1, 0),
    p = new THREE.Vector3(),
    vertex = new THREE.Vector3();
  scenery.traverse((object) => {
    if (object.name === "Bowl forward chevron") markings.push(object);
  });
  assert.equal(lanes.length, 2);
  assert.equal(markings.length, 60);
  for (const marking of markings) {
    const { position } = marking.geometry.attributes,
      index = marking.geometry.index;
    const receivers =
      marking.name === "Bowl forward chevron" ? [floor, ...guides] : [floor, ...lanes];
    // Sample triangle interiors: curved, differently tessellated layers can
    // intersect even when all their vertices follow the analytic saucer.
    for (let i = 0; i < index.count; i += 36) {
      p.set(0, 0, 0);
      for (let j = 0; j < 3; j++) p.add(vertex.fromBufferAttribute(position, index.getX(i + j)));
      p.multiplyScalar(1 / 3);
      ray.set(vertex.copy(p).setY(150), down);
      const hits = ray.intersectObjects(receivers, false);
      assert.ok(hits.length, "marking has a receiving surface");
      assert.ok(p.y - hits[0].point.y > 0.01, `${marking.name} intersects its receiving surface`);
    }
  }
});

test("both route identities support the whole curved bowl far beyond their guide ribbons", () => {
  assert.equal(track.areaSurfaces.length, 1);
  assert.equal(track.branches[0].areaSurface, track.branches[1].areaSurface);
  assert.ok(
    bowl.innerRadius / bowl.radius < 0.2,
    "central cutout occupies less than 4% of the footprint",
  );
  for (const branch of track.branches) {
    let broadSamples = 0;
    for (let i = 1; i < 48; i++)
      for (const ratio of [0.18, 0.3, 0.5, 0.7, 0.9, 0.98]) {
        const p = bowl.pointAt((branch.side * Math.PI * i) / 48, bowl.radius * ratio, 0.065);
        const surface = branch.project(p, (branch.start + branch.end) / 2);
        const floor = track.floorAt(surface);
        assert.ok(floor.supported && !floor.outside && !surface.offroad);
        assert.ok(Math.abs(floor.height - p.y) < 1e-8);
        assert.ok(surface.frame.up.y > 0);
        assert.ok(Math.abs(surface.frame.up.dot(surface.frame.tangent)) < 1e-8);
        broadSamples += Math.abs(surface.offset) > branch.halfWidth + 10;
      }
    assert.ok(
      broadSamples > 100,
      "inner shortcuts and high outer lines are actual driving surface",
    );
  }
  const inner = bowl.pointAt(Math.PI / 2, bowl.radius * 0.3);
  const outer = bowl.pointAt(Math.PI / 2, bowl.radius * 0.75);
  assert.ok(outer.y - inner.y > 25, "concave spherical floor changes height across racing lines");
});

test("bowl mesh matches authoritative height, leaving the small well and terrain excavation open", () => {
  const scene = new THREE.Scene();
  buildAreaSurfaces(track, createCourseKit(scene, track), {});
  const floor = scene.getObjectByName("Continuous curved driving bowl");
  const ground = new THREE.Mesh(
    groundGeometry(track, 1800),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = course.theme.groundHeight;
  scene.add(ground);
  scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  for (const angle of [0.3, 1.4, 2.6, 3.8, 5.5])
    for (const ratio of [0.18, 0.37, 0.61, 0.8, 0.87, 0.95]) {
      const p = bowl.pointAt(angle, bowl.radius * ratio);
      ray.set(p.clone().setY(150), new THREE.Vector3(0, -1, 0));
      const hits = ray.intersectObject(floor);
      assert.equal(hits.length, 1);
      assert.ok(Math.abs(hits[0].point.y - p.y) < 0.12, `rendered floor agrees at radius ${ratio}`);
      assert.equal(ray.intersectObject(ground).length, 0);
    }
  ray.set(bowl.center.clone().setY(150), new THREE.Vector3(0, -1, 0));
  assert.equal(ray.intersectObject(floor).length, 0);
  assert.equal(ray.intersectObject(ground).length, 0);
  const well = track.branches[0].project(bowl.center, track.branches[0].start);
  assert.ok(!track.floorAt(well).supported);
  const outside = bowl.pointAt(Math.PI / 2, bowl.radius + 2);
  assert.ok(!track.floorAt(track.branches[0].project(outside, well.t)).supported);
  assert.ok(bowl.contactAt(bowl.pointAt(Math.PI / 2, bowl.radius - 0.2))?.penetration > 0);
  assert.equal(bowl.contactAt(bowl.pointAt(0, bowl.radius)), null, "entrance is open");
  assert.equal(bowl.contactAt(bowl.pointAt(Math.PI, bowl.radius)), null, "exit is open");
});

test("clearance reserves broad inner and outer bowl lines, with room for gears below the well", () => {
  const allows = createRouteClearance(track),
    group = new THREE.Group();
  for (const angle of [0.7, 1.7, 3.7, 5.2])
    for (const ratio of [0.25, 0.45, 0.8, 0.95]) {
      group.position.copy(bowl.pointAt(angle, bowl.radius * ratio));
      assert.ok(!allows(group, [0, 2, 0], [2, 4, 2]));
    }
  group.position.copy(bowl.center).add(new THREE.Vector3(0, -bowl.radius - 14, 0));
  assert.ok(allows(group, [0, 0, 0], [8, 8, 8]));
});

test("wide bowl driving replays snapshots and recovers to the selected curved surface", () => {
  for (const branch of track.branches)
    for (const offset of [-26, 26]) {
      const s = (branch.start + (branch.end - branch.start) * 0.5) * track.TRACK;
      const a = initializeRacer(createRacerState({ s, isPlayer: true }));
      const pose = branch.poseAt(0.5, offset);
      a.routeChoice = branch.index;
      a.routeGroup = branch.groupIndex;
      a.worldPos.copy(pose.p);
      a.yaw = track.yawFor(pose.tangent);
      a.lastSafeS = s;
      a.lastSafeRoute = branch.index;
      a.lastSafeOffset = offset;
      recoverRacer(a);
      assert.ok(a.worldPos.distanceTo(pose.p) < 1e-8);
      const b = createRacerState();
      applyRacer(b, packRacer(a));
      for (let i = 1; i <= 120; i++) {
        const input = { throttle: true, steer: 0 };
        const event = advanceRacer(a, input, 1 / 120, i / 120);
        advanceRacer(b, input, 1 / 120, i / 120);
        assert.ok(a.worldPos.distanceTo(b.worldPos) < 1e-8);
        assert.ok(a.grounded && !event.wallImpact && !event.recovered);
        assert.equal(a.routeChoice, branch.index);
        assert.ok(Math.abs(a.worldPos.y - bowl.heightAt(a.worldPos) - 0.065) < 1e-8);
      }
      const safe = a.worldPos.clone();
      a.worldPos.copy(bowl.center);
      a.worldPos.y = bowl.heightAt(a.worldPos) + 0.065;
      let recovered = false;
      for (let i = 0; i < 240 && !recovered; i++)
        recovered = !!advanceRacer(a, {}, 1 / 120, 2 + i / 120).recovered;
      assert.ok(recovered, "driving into the open well falls and recovers");
      assert.equal(a.routeChoice, branch.index);
      assert.ok(
        a.worldPos.distanceTo(safe) < 0.2,
        `recovery preserves the wide racing line: distance=${a.worldPos.distanceTo(safe)}, safe=${safe.toArray()}, actual=${a.worldPos.toArray()}, s=${a.s}, offset=${a.lastSafeOffset}`,
      );
    }
});

test("shells follow broad bowl floors, bounce off its perimeter and disappear in the well", () => {
  const branch = track.branches[0];
  const owner = initializeRacer(
    createRacerState({ s: ((branch.start + branch.end) / 2) * track.TRACK }),
  );
  owner.routeChoice = branch.index;
  owner.routeGroup = branch.groupIndex;
  owner.worldPos.copy(bowl.pointAt((branch.side * Math.PI) / 2, bowl.radius * 0.92, 0.065));
  owner.yaw = track.yawFor(branch.frameAt(0.5).tangent);
  const shell = createShell(owner, "green");
  for (let i = 0; i < 40; i++) {
    advanceShell(shell, 1 / 120);
    assert.ok(shell.life > 0);
    assert.ok(Math.abs(shell.worldPos.y - bowl.heightAt(shell.worldPos) - 0.665) < 1e-8);
  }
  shell.worldPos.copy(bowl.pointAt((branch.side * Math.PI) / 2, bowl.radius - 0.6));
  const radial = shell.worldPos.clone().sub(bowl.center).setY(0).normalize();
  shell.vx = radial.x * 44;
  shell.vz = radial.z * 44;
  advanceShell(shell, 1 / 120);
  assert.ok(shell.life > 0 && shell.vx * radial.x + shell.vz * radial.z < 0);
  shell.worldPos.copy(bowl.center);
  advanceShell(shell, 1 / 120);
  assert.ok(shell.life <= 0);
});

test("area-floor gravity points downhill for either vehicle heading", () => {
  const p = bowl.pointAt(Math.PI / 2, bowl.radius * 0.7);
  const frame = bowl.frameAt(p, new THREE.Vector3(1, 0, 0));
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const state = initializeRacer(createRacerState({ isPlayer: true }));
    state.yaw = yaw;
    state.vx = -Math.sin(yaw) * 20;
    state.vz = -Math.cos(yaw) * 20;
    drive(state, {}, { normal: frame.up, slope: 0, bank: 0, grip: 12, offroad: false }, 1 / 120);
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    assert.ok(state.lateralSpeed * frame.up.dot(right) >= 0);
    const downhill = frame.up.dot(forward);
    if (Math.abs(downhill) > 0.5)
      assert.equal(Math.sign(state.longitudinalSpeed - 20), Math.sign(downhill));
  }
});

test("the continuously curved saucer stays below sixty degrees at every radius and heading", () => {
  for (let ring = 0; ring <= 100; ring++)
    for (let sector = 0; sector < 48; sector++) {
      const p = bowl.pointAt((sector * Math.PI) / 24, (bowl.radius * ring) / 100);
      const f = bowl.frameAt(p, new THREE.Vector3(1, 0, 0));
      assert.ok(Math.acos(f.up.y) <= Math.PI / 3 + 1e-6);
    }
  for (const branch of track.branches) {
    assert.ok(
      branch.poseAt(0, 0, 0).p.distanceTo(track.poseAt(branch.start * track.TRACK, 0, 0).p) < 1e-6,
    );
    assert.ok(
      branch.poseAt(1, 0, 0).p.distanceTo(track.poseAt(branch.end * track.TRACK, 0, 0).p) < 1e-6,
    );
    for (const q of [0, 1]) {
      const main = track
        .frameAt(q ? branch.end : branch.start)
        .tangent.clone()
        .setY(0)
        .normalize();
      const guide = branch.frameAt(q).tangent.clone().setY(0).normalize();
      assert.ok(main.dot(guide) > 0.99, "gate has a gentle tangent join");
    }
  }
});
