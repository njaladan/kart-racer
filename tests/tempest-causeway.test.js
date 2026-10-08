import test from "node:test";
import assert from "node:assert/strict";
import course from "../src/courses/tempest-causeway.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { initializeRacer, advanceRacer, botInput } from "../src/simulation/simulation.js";
import { bridgeWaveAt, currentAt } from "../src/simulation/course-mechanics.js";
import { buildTempest, stormSeaHeight } from "../src/courses/adventure/tempest-world.js";
import * as THREE from "../vendor/three/three.module.js";
import { createCourseKit, batchScenery } from "../src/rendering/course-kit.js";
import { buildExperienceWorld } from "../src/courses/experiences/world.js";
import { packRacer, applyRacer } from "../src/multiplayer/protocol.js";
import { createRacerState } from "../src/simulation/racer-state.js";
const track = selectCourse(course);

function waveFixture(phase = Math.asin(0.6), speed = 85, offset = 0) {
  const fraction = 0.54,
    t = track.sectorT(1, fraction);
  const wave = course.bridgeWave;
  const length = (track.SECTIONS[1].end - track.SECTIONS[1].start) * track.COURSE_LENGTH;
  const time =
    ((phase - (Math.PI * 2 * fraction * length) / wave.wavelength) * wave.period) / (2 * Math.PI);
  track.setTime(time);
  const racer = initializeRacer(createRacerState({ s: t * TRACK, x: offset / 6.25 }));
  racer.vx = (-Math.sin(racer.yaw) * speed) / 3.6;
  racer.vz = (-Math.cos(racer.yaw) * speed) / 3.6;
  racer.speed = speed;
  return { racer, time, t };
}

test("bridge wind waves travel between pinned towers with matching analytic motion", () => {
  for (const time of [0, 1, 7, 18, 50]) {
    for (const anchor of course.bridgeWave.anchors) {
      const wave = bridgeWaveAt(track, track.sectorT(1, anchor), time);
      assert.ok(Math.abs(wave.height) < 1e-10);
      assert.ok(Math.abs(wave.slope) < 1e-10);
    }
    for (const section of [0, 2, 3, 4, 5, 6])
      assert.equal(bridgeWaveAt(track, track.sectorT(section, 0.5), time).height, 0);
  }
  const { t, time } = waveFixture();
  const wave = bridgeWaveAt(track, t, time);
  assert.ok(wave.height > 1.5 && wave.launch);
  const epsilon = 1e-5;
  const heightAt = (t, time) => bridgeWaveAt(track, t, time).height;
  assert.ok(
    Math.abs(
      (heightAt(t, time + epsilon) - heightAt(t, time - epsilon)) / (2 * epsilon) - wave.velocity,
    ) < 1e-6,
  );
  assert.ok(
    Math.abs(
      (heightAt(t + epsilon / track.COURSE_LENGTH, time) -
        heightAt(t - epsilon / track.COURSE_LENGTH, time)) /
        (2 * epsilon) -
        wave.slope,
    ) < 1e-6,
  );
  for (const offset of [-6, 0, 6]) {
    const pose = track.poseAt(t * TRACK, offset, 0.065);
    const projection = track.projectTrack(pose.p, t * TRACK, true);
    assert.ok(Math.abs(projection.height - pose.p.y) < 0.03);
    assert.ok(Math.abs(pose.tangent.dot(pose.right)) < 1e-6);
  }
});

test("bridge crests travel against increasing race distance", () => {
  const fraction = (course.bridgeWave.anchors[2] + course.bridgeWave.anchors[3]) / 2;
  const wave = bridgeWaveAt(track, track.sectorT(1, fraction), 0);
  // At a bay midpoint the envelope has zero slope, so -velocity / slope
  // is the crest's signed speed along the course.
  assert.ok(Math.abs(wave.slope) > 1e-6);
  assert.ok(
    Math.abs(
      -wave.velocity / wave.slope + course.bridgeWave.wavelength / course.bridgeWave.period,
    ) < 1e-6,
  );
});

test("only a timed fresh tap on a rising crest launches a bridge trick", () => {
  for (const options of [
    { phase: -Math.asin(0.6), tap: true }, // Rising trough.
    { phase: Math.PI - Math.asin(0.6), tap: true }, // Falling crest.
    { speed: 20, tap: true },
    { held: true, tap: true },
    { tap: false },
    { spin: 1, tap: true },
    { offset: 13, tap: true },
  ]) {
    const { racer, time } = waveFixture(options.phase, options.speed, options.offset);
    racer.trickHeld = !!options.held;
    racer.spin = options.spin || 0;
    const events = advanceRacer(racer, { throttle: true, drift: options.tap }, 1 / 120, time);
    assert.equal(events.trickStarted, false, JSON.stringify(options));
    assert.notEqual(racer.jumpKind, "wave", JSON.stringify(options));
  }
  const { racer, time } = waveFixture();
  const replica = createRacerState();
  applyRacer(replica, packRacer(racer));
  let launched = 0,
    landed = 0,
    highest = 0;
  for (let i = 0; i < 240; i++) {
    const now = time + i / 120;
    const input = i === 0 ? { throttle: true, drift: true } : botInput(racer, 0, now);
    const events = advanceRacer(racer, input, 1 / 120, now);
    advanceRacer(replica, input, 1 / 120, now);
    if (i === 0) {
      assert.equal(events.launched, true);
      assert.equal(events.trickStarted, true);
      assert.equal(racer.jumpKind, "wave");
      assert.ok(racer.vy > 9);
    }
    // A snapshot taken in flight must resume the same jump and landing reward.
    if (i === 35) applyRacer(replica, packRacer(racer));
    assert.ok(racer.worldPos.distanceTo(replica.worldPos) < 1e-8);
    assert.equal(racer.grounded, replica.grounded);
    assert.equal(racer.boost, replica.boost);
    highest = Math.max(
      highest,
      racer.worldPos.y - track.projectTrack(racer.worldPos, racer.s).height,
    );
    launched += !!events.launched;
    if (events.trickLanded) {
      landed++;
      assert.ok(racer.boost >= 1);
    }
  }
  assert.equal(launched, 1);
  assert.equal(landed, 1);
  assert.ok(highest > 2 && highest <= 6.01);
  assert.equal(racer.recoveryCount, 0);
});

test("grounded karts ride the moving bridge without automatic launches", () => {
  const { racer, time } = waveFixture(undefined, 0);
  let low = Infinity,
    high = -Infinity;
  for (let i = 0; i < 480; i++) {
    const events = advanceRacer(racer, {}, 1 / 120, time + i / 120);
    assert.equal(events.launched, false);
    assert.equal(racer.grounded, true);
    assert.ok(
      Math.abs(racer.worldPos.y - track.projectTrack(racer.worldPos, racer.s).height) < 1e-8,
    );
    low = Math.min(low, racer.worldPos.y);
    high = Math.max(high, racer.worldPos.y);
  }
  assert.ok(high - low > 5);
});

test("bridge deck, underside, girders and hangers animate after static batching", () => {
  track.setTime(0);
  const scene = new THREE.Scene(),
    scenery = new THREE.Group();
  scene.add(scenery);
  const kit = createCourseKit(scenery, track);
  const world = buildTempest({ THREE, scene, scenery, track, kit });
  batchScenery(scenery, world.animated);
  const experience = buildExperienceWorld({ scene, track });
  batchScenery(experience.scenery, experience.animated);
  const deck = experience.animated.find((m) => m.isMesh);
  assert.equal(deck.material.roughness, 0.88);
  assert.equal(deck.material.metalness, 0);
  const skin = world.animated.find((m) => m.name === "Wind-flexed bridge structure");
  const girder = world.animated.find((m) => m.name === "Suspension bridge deck girder");
  const hanger = world.animated.find((m) => m.name === "Flexible suspension hanger");
  assert.ok(deck.parent && skin.parent && girder.parent && hanger.parent);
  const before = skin.geometry.attributes.position.array.slice();
  const originalGirder = girder.position.clone();
  const originalHanger = hanger.scale.y;
  world.update(1);
  experience.update(1);
  assert.ok(
    before.some((value, i) => Math.abs(value - skin.geometry.attributes.position.array[i]) > 1),
  );
  assert.ok(girder.position.distanceTo(originalGirder) > 0.01);
  assert.ok(Math.abs(hanger.scale.y - originalHanger) > 0.01);
  const rows = deck.geometry.attributes.position.count / 2 - 1;
  const row = Math.round(rows * 0.54);
  const t = track.sectorT(1, row / rows);
  const expected = track.poseAt(t * TRACK, -(track.SECTIONS[1].halfWidth + 0.5), 0.03).p;
  const actual = new THREE.Vector3().fromBufferAttribute(
    deck.geometry.attributes.position,
    row * 2,
  );
  assert.ok(actual.distanceTo(expected) < 1e-4);
});
test("storm wind acts only on exposed spans and replicas share its force", () => {
  for (const s of [0, 2, 4, 6]) assert.equal(currentAt(track, track.sectorT(s, 0.5), 18), 0);
  const t = track.sectorT(1, 0.5);
  assert.ok(Math.abs(currentAt(track, t, 18)) > 1);
  const a = initializeRacer(createRacerState({ s: t * TRACK, x: 0 })),
    b = createRacerState();
  applyRacer(b, packRacer(a));
  for (let i = 0; i < 120; i++) {
    advanceRacer(a, { throttle: true }, 1 / 120, 18 + i / 120);
    advanceRacer(b, { throttle: true }, 1 / 120, 18 + i / 120);
    assert.ok(a.worldPos.distanceTo(b.worldPos) < 1e-8);
  }
  for (let i = 0; i < 1000; i++) {
    const height = stormSeaHeight(i * 13, i * 7, i * 0.1);
    assert.ok(height >= -16.8 && height <= -3.2);
  }
});
test("all five drivers complete the windy bridge adventure without wall hits", () => {
  for (let i = 0; i < 5; i++) {
    const r = initializeRacer({ s: 0, x: 0, skill: 0.9 - i * 0.045 });
    let hits = 0,
      waveJumps = 0;
    for (let k = 1; k < 120 * 280 && !r.finished; k++) {
      const e = advanceRacer(r, botInput(r, i, k / 120), 1 / 120, k / 120);
      hits += !!e.wallImpact;
      if (e.launched && r.jumpKind === "wave") waveJumps++;
    }
    assert.ok(r.finished);
    assert.equal(hits, 0);
    assert.ok(waveJumps > 0);
    assert.equal(r.recoveryCount || 0, 0);
  }
});
