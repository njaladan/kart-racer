import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import course from "../src/courses/metronome-hall.js";
import { selectCourse, TRACK } from "../src/track/track.js";
import { createCourseKit, batchScenery } from "../src/rendering/course-kit.js";
import { buildMetronome } from "../src/courses/adventure/metronome-world.js";
import {
  bellowsAirAt,
  bellowsNozzleAt,
  bellowsPuffAt,
} from "../src/simulation/course-mechanics.js";
import { initializeRacer, advanceRacer } from "../src/simulation/simulation.js";
import { createRacerState } from "../src/simulation/racer-state.js";
import { packRacer, applyRacer } from "../src/multiplayer/protocol.js";
import { readFileSync } from "node:fs";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
import { normalizeCourseModel } from "../src/rendering/course-assets.js";
import { buildCourseWorld } from "../src/rendering/course-runtime.js";

const track = selectCourse(course);
const d = course.bellows;
const peak = d.windup + d.duration / 2;

test("bellows warn, alternate, repeat and affect only the visible air volume", () => {
  const center = track.poseAt(track.sectorT(d.section, d.fraction) * TRACK, 0, 0.065).p;
  for (const side of [-1, 1]) {
    const time = peak + (side > 0 ? d.period / 2 : 0);
    assert.equal(bellowsPuffAt(d, time, side).active, true);
    assert.equal(bellowsPuffAt(d, time, -side).active, false);
    assert.deepEqual(bellowsPuffAt(d, time, side), bellowsPuffAt(d, time + d.period, side));
    const nozzle = bellowsNozzleAt(track, side);
    const air = bellowsAirAt(track, center, time);
    assert.ok(air);
    assert.equal(air.side, side);
    assert.ok((air.x * nozzle.right.x + air.z * nozzle.right.z) * side < 0);
    assert.equal(bellowsAirAt(track, center.clone().addScaledVector(nozzle.up, 8), time), null);
    assert.equal(
      bellowsAirAt(track, center.clone().addScaledVector(nozzle.tangent, 8), time),
      null,
    );
    assert.equal(
      bellowsAirAt(track, nozzle.p.clone().addScaledVector(nozzle.right, side * 3), time),
      null,
    );
  }
  for (const time of [0, d.windup / 2, d.windup + d.duration + 0.1])
    assert.equal(bellowsAirAt(track, center, time), null);
  assert.ok(bellowsPuffAt(d, d.windup * 0.8, -1).inflation > 0.8);
});

test("puffs nudge velocity without a boost, hit or launch and replay through a snapshot", () => {
  const s = track.sectorT(d.section, d.fraction) * TRACK;
  for (const side of [-1, 1]) {
    const time = peak + (side > 0 ? d.period / 2 : 0);
    const racer = initializeRacer(createRacerState({ s, x: 0, isPlayer: true }));
    const replica = createRacerState();
    applyRacer(replica, packRacer(racer));
    const events = advanceRacer(racer, { throttle: true }, 1 / 120, time);
    advanceRacer(replica, { throttle: true }, 1 / 120, time);
    assert.equal(events.bellowsPuff, true);
    const right = track.frameAt(s / TRACK).right;
    assert.ok((racer.vx * right.x + racer.vz * right.z) * side < -0.01);
    assert.equal(events.cartImpact, false);
    assert.equal(events.padBoost, false);
    assert.equal(events.launched, false);
    assert.equal(racer.spin, 0);
    assert.equal(racer.boost, 0);
    for (let tick = 1; tick <= 120; tick++) {
      const input = { throttle: true, steer: 0 };
      advanceRacer(racer, input, 1 / 120, time + tick / 120);
      advanceRacer(replica, input, 1 / 120, time + tick / 120);
      if (tick === 30) applyRacer(replica, packRacer(racer));
      assert.ok(racer.worldPos.distanceTo(replica.worldPos) < 1e-9);
      assert.equal(racer.vx, replica.vx);
      assert.equal(racer.vz, replica.vz);
    }
    assert.ok(Math.abs(racer.x) > 0.01, "a visible sideways displacement");
    assert.equal(racer.recoveryCount, 0);
  }
});

test("the orchestra stays dense, batched and finite with rigs and hazard motion", () => {
  const scene = new THREE.Scene(),
    scenery = new THREE.Group();
  scene.add(scenery);
  const kit = createCourseKit(scenery, track);
  const world = buildMetronome({ THREE, scene, scenery, track, kit });
  assert.ok(scenery.userData.orchestraPlacements > 600);
  const families = new Set(),
    skins = [],
    puffs = [];
  scenery.traverse((o) => {
    if (o.userData.instrumentFamily) families.add(o.userData.instrumentFamily);
    if (o.isSkinnedMesh) skins.push(o);
    if (o.name === "Visible sideways bellows puff") puffs.push(o);
    assert.ok(!/dancer|automaton|figure/i.test(o.name));
  });
  assert.ok(families.size >= 25);
  assert.equal(skins.length, 5);
  assert.equal(puffs.length, 2);
  batchScenery(scenery, world.animated);
  const identities = [];
  scene.traverse((o) => identities.push(o));
  for (const time of [0, peak, peak + d.period / 2, 11, 0]) {
    world.update(time, { motionEnabled: false });
    scene.updateMatrixWorld(true);
    scene.traverse((o) => assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
    const puff = bellowsPuffAt(d, time, -1);
    assert.equal(
      puffs[0].visible,
      puff.active,
      "hazards retain their clock with ambient motion off",
    );
    for (const skin of skins) {
      skin.skeleton.update();
      assert.ok([...skin.skeleton.boneMatrices].every(Number.isFinite));
      const vertex = new THREE.Vector3();
      skin.getVertexPosition(36, vertex);
      assert.ok(vertex.toArray().every(Number.isFinite));
    }
  }
  const after = [];
  scene.traverse((o) => after.push(o));
  assert.deepEqual(after, identities);
});

test("the complete imported orchestra stays within the scene draw-object budget", async () => {
  const base = new URL("../assets/courses/packs/metronome-hall/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", base)));
  const models = {};
  const loader = new GLTFLoader();
  loader.register((parser) => {
    parser.loadImageSource = async () => new THREE.Texture();
    return { name: "test-texture-decoder" };
  });
  for (const entry of manifest.models) {
    const bytes = readFileSync(new URL(entry.file, base));
    const gltf = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
    models[entry.name] = normalizeCourseModel(gltf.scene);
  }
  const violin = new THREE.Box3().setFromObject(models["instrument:violin"]);
  const size = violin.getSize(new THREE.Vector3());
  assert.ok(size.x > size.z * 1.8, "the carved face is upright and faces the road");
  const scene = new THREE.Scene();
  const materials = Object.fromEntries(
    ["grass", "road", "roadside", "rail", "white", "red", "black", "pine2", "trunk"].map((key) => [
      key,
      new THREE.MeshStandardMaterial({ vertexColors: true }),
    ]),
  );
  const world = buildCourseWorld({
    scene,
    track,
    renderer: null,
    materials,
    textures: {},
    assets: { models },
    sharedAssets: {},
  });
  let meshes = 0;
  scene.traverse((o) => {
    if (o.isMesh) meshes++;
  });
  assert.ok(meshes < 1800, `${meshes} draw objects`);
  for (const time of [0, peak, 8, 12, 24]) {
    world.update(time);
    scene.updateMatrixWorld(true);
    scene.traverse((o) => assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
  }
});
