import test from "node:test";
import assert from "node:assert/strict";
import course from "../src/courses/sunstone-ruins.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { initializeRacer, advanceRacer, botInput } from "../src/simulation/simulation.js";
import { cartAt, cartContact } from "../src/simulation/hazards.js";
import { solarLaneAt, solarBoostAt } from "../src/simulation/course-mechanics.js";
import * as THREE from "../vendor/three/three.module.js";
import { createCourseKit, batchScenery } from "../src/rendering/course-kit.js";
import { createSolarFocus } from "../src/courses/sunstone-ruins/solar-focus.js";
import { createSandfall } from "../src/courses/sunstone-ruins/sandfall.js";
const track = selectCourse(course);

test("Sunstone expedition connects eight places and a buried temple with continuous surfaces", () => {
  assert.equal(track.SECTIONS.length, 8);
  assert.ok(track.COURSE_LENGTH > 1750 && track.COURSE_LENGTH < 1850);
  const heights = Array.from({ length: 1000 }, (_, i) => track.frameAt(i / 1000).p.y);
  assert.ok(Math.max(...heights) - Math.min(...heights) > 60);
  for (let i = 0; i < 1000; i++) {
    const t = i / 1000,
      p = track.poseAt(t * TRACK, 0, 0.065).p;
    const projection = track.projectTrack(p, t * TRACK);
    assert.ok(Math.abs(projection.height - p.y) < 0.02);
    const next = track.frameAt((i + 1) / 1000).p;
    assert.ok(p.distanceTo(next) < 3, "No accidental route seams");
  }
});

test("all five drivers finish the rebuilt adventure without wall hits", () => {
  for (let i = 0; i < 5; i++) {
    const r = initializeRacer({ s: 0, x: 0, skill: 0.9 - i * 0.045, isPlayer: false, isBot: true });
    let hits = 0;
    for (let k = 1; k < 120 * 240 && !r.finished; k++) {
      const e = advanceRacer(r, botInput(r, i, k / 120), 1 / 120, k / 120);
      hits += !!e.wallImpact;
    }
    assert.ok(r.finished);
    assert.equal(hits, 0);
    assert.ok(r.finishTime > 154 && r.finishTime < 183);
  }
});

test("solar lanes match moving lens pads and the sentinel preserves a safe bypass", () => {
  for (let time = 0; time < 48; time += 0.25) {
    for (const [i, f] of course.solarEngine.fractions.entries()) {
      const t = track.sectorT(course.solarEngine.section, f),
        offset = solarLaneAt(course, time, i);
      assert.equal(solarBoostAt(track, t, offset, time), course.solarEngine.duration);
      assert.equal(solarBoostAt(track, t, offset + 4.3, time), 0);
      const bounds = track.collisionBounds(t);
      assert.ok(offset > bounds.left && offset < bounds.right);
    }
    const h = cartAt(time);
    assert.equal(cartContact(track.poseAt(h.s, course.hazard.safeLane, 0.065).p, time), null);
  }
});

test("sand cut and temple apron share ground, boundaries and ordered route identity", () => {
  for (const patch of [track.SHORTCUT, ...track.VERGES]) {
    for (let t = patch.start + 0.01; t < patch.end - 0.01; t += 0.005) {
      const side = patch.side ?? 1,
        width =
          side < 0
            ? track.vergeWidth(t, side)
            : Math.max(track.shortcutWidth(t), track.vergeWidth(t, side));
      const offset = side * (track.roadHalfWidth(t) + width * 0.45),
        p = track.poseAt(t * TRACK, offset, 0.065).p;
      const s = track.projectTrack(p, t * TRACK);
      assert.ok(Math.abs(s.height - p.y) < 0.04);
      assert.ok(Math.abs(s.t - t) < 0.001);
      assert.ok(offset > s.leftEdge && offset < s.rightEdge);
    }
  }
});

test("batched solar beams meet the engine core and moving boost footprint at every phase", () => {
  const scenery = new THREE.Group(),
    kit = createCourseKit(scenery, track),
    effects = course.solarEngine.fractions.map((f, index) => {
      const t = track.sectorT(course.solarEngine.section, f),
        pad = kit.groupAt(t),
        sourceGroup = kit.groupAt(t),
        focus = createSolarFocus({ THREE, track, kit, t, index, pad, sourceGroup, scenery });
      kit.mesh(
        new THREE.SphereGeometry(0.1),
        new THREE.MeshBasicMaterial(),
        sourceGroup,
        [0, 19, 0],
      );
      return { ...focus, t, index, pad, sourceGroup };
    });
  batchScenery(
    scenery,
    effects.flatMap(({ beam, pad, sourceGroup }) => [beam, pad, sourceGroup]),
  );
  const objects = [];
  scenery.traverse((object) => objects.push(object));
  assert.equal(objects.filter((object) => object.isMesh).length, 9);
  for (const time of [0, 0.25, 2, 4, 6, 8, 19, 19, 0]) {
    effects.forEach((effect) => effect.update(time));
    scenery.updateMatrixWorld(true);
    for (const { beam, footprint, t, index, pad, sourceGroup } of effects) {
      const offset = solarLaneAt(course, time, index),
        source = sourceGroup.localToWorld(new THREE.Vector3(0, 19, 0)),
        target = pad.localToWorld(new THREE.Vector3(0, 0.27, 0));
      assert.ok(beam.localToWorld(new THREE.Vector3(0, 0.5, 0)).distanceTo(source) < 1e-8);
      assert.ok(beam.localToWorld(new THREE.Vector3(0, -0.5, 0)).distanceTo(target) < 1e-8);
      assert.ok(footprint.getWorldPosition(new THREE.Vector3()).distanceTo(target) < 1e-8);
      assert.equal(solarBoostAt(track, t, offset, time), course.solarEngine.duration);
      assert.equal(beam.material.depthWrite, false);
      assert.equal(beam.castShadow, false);
    }
  }
  const after = [];
  scenery.traverse((object) => after.push(object));
  assert.deepEqual(after, objects, "Animation reuses all geometry and scene objects");
});

test("sandfall shader bounds contain flutter and shared time freezes and rewinds", () => {
  const effect = createSandfall(THREE);
  for (const time of [0, 12.5, 12.5, 0]) {
    effect.update(time);
    assert.equal(effect.material.uniforms.sandTime.value, time);
  }
  assert.equal(effect.material.depthWrite, false);
  for (const attribute of Object.values(effect.geometry.attributes))
    assert.ok([...attribute.array].every(Number.isFinite));
  const bounds = effect.geometry.boundingBox;
  assert.ok(bounds.max.x >= 3.5 * 1.1 + 0.16);
  assert.ok(bounds.max.z >= 0.18 && bounds.min.z <= -0.18);
  assert.ok(effect.geometry.boundingSphere.containsPoint(bounds.max));
});
