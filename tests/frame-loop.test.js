import test from "node:test";
import assert from "node:assert/strict";
import { createFrameLoop } from "../src/runtime/frame-loop.js";
import { FIXED_DT } from "../src/simulation/physics.js";

function fixture(options = {}) {
  let callback,
    time = 0,
    paused = false,
    frozen = false;
  const steps = [],
    renders = [],
    ratios = [],
    sizes = [];
  const windowRef = { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2 };
  const camera = { aspect: 1, updateProjectionMatrix() {} };
  const loop = createFrameLoop({
    renderer: {
      setPixelRatio: (value) => ratios.push(value),
      setSize: (...args) => sizes.push(args),
    },
    camera,
    windowRef,
    initialPixelRatio: 2,
    now: () => time,
    requestFrame: (next) => (callback = next),
    isPaused: () => paused,
    shouldStep: () => !frozen,
    step: (dt) => steps.push(dt),
    render: (dt) => renders.push(dt),
    ...options,
  });
  loop.start();
  return {
    loop,
    steps,
    renders,
    ratios,
    sizes,
    camera,
    windowRef,
    frame(seconds) {
      time += seconds * 1000;
      callback(time);
    },
    pause(value) {
      paused = value;
    },
    freeze(value) {
      frozen = value;
    },
  };
}

test("display rates share fixed simulation steps and long frames cap catch-up work", () => {
  for (const rate of [30, 60, 144]) {
    const app = fixture();
    for (let i = 0; i < rate; i++) app.frame(1 / rate);
    assert.ok(Math.abs(app.steps.length * FIXED_DT - 1) <= FIXED_DT);
    assert.ok(app.steps.every((dt) => dt === FIXED_DT));
    assert.ok(app.loop.getAccumulator() >= 0 && app.loop.getAccumulator() < FIXED_DT);
  }
  const app = fixture();
  app.frame(10);
  assert.ok(app.steps.length <= 12);
  assert.equal(app.renders.at(-1), 0.1);
});

test("pause and restart discard timing debt, while benchmark freeze keeps rendering", () => {
  const app = fixture();
  app.frame(0.02);
  app.pause(true);
  app.loop.resetTiming();
  const count = app.steps.length;
  app.frame(20);
  assert.equal(app.steps.length, count);
  assert.equal(app.renders.at(-1), 0);
  app.pause(false);
  app.loop.resetTiming();
  app.frame(0.01);
  assert.equal(app.steps.length, count + 1);
  app.freeze(true);
  app.frame(1);
  assert.equal(app.steps.length, count + 1);
  assert.equal(app.renders.at(-1), 0.1);
});

test("adaptive resolution survives resize and benchmarks retain the requested ratio", () => {
  const app = fixture();
  for (let i = 0; i < 70; i++) app.frame(0.05);
  assert.equal(app.loop.getPixelRatio(), 1.85);
  app.windowRef.innerWidth = 800;
  app.windowRef.innerHeight = 400;
  app.loop.resize();
  assert.equal(app.camera.aspect, 2);
  assert.equal(app.loop.getPixelRatio(), 1.85);
  assert.deepEqual(app.sizes.at(-1), [800, 400, false]);
  app.windowRef.devicePixelRatio = 1;
  app.loop.resize();
  assert.equal(app.loop.getPixelRatio(), 1);
  const benchmark = fixture({ benchmarkMode: true });
  for (let i = 0; i < 70; i++) benchmark.frame(0.05);
  assert.equal(benchmark.loop.getPixelRatio(), 2);
});

test("adaptive quality lowers costly effects and recovers after sustained healthy rendering", () => {
  const changes = [];
  const app = fixture({ onQualityChange: (change) => changes.push(change) });
  for (let i = 0; i < 65; i++) app.frame(1 / 30);
  assert.equal(app.loop.getQualityTier(), 3, "short dips must not lower artwork quality");
  for (let i = 0; i < 40; i++) app.frame(1 / 30);
  assert.equal(app.loop.getQualityTier(), 2);
  assert.equal(changes.at(-1).targetFps, 60);
  const reduced = app.loop.getPixelRatio();
  for (let i = 0; i < 610; i++) app.frame(1 / 60);
  assert.ok(app.loop.getPixelRatio() > reduced, "resolution recovers after healthy windows");
  for (let i = 0; i < 1250; i++) app.frame(1 / 60);
  assert.equal(app.loop.getPixelRatio(), 2);
  assert.equal(app.loop.getQualityTier(), 3);
});

test("background-tab stalls do not pollute quality timing or pause recovery", () => {
  const changes = [];
  const app = fixture({ onQualityChange: (change) => changes.push(change) });
  for (let i = 0; i < 12; i++) app.frame(5);
  assert.equal(app.loop.getQualityTier(), 3);
  assert.equal(changes.length, 0);
  app.pause(true);
  for (let i = 0; i < 100; i++) app.frame(0.05);
  assert.equal(changes.length, 0);
  app.pause(false);
  app.loop.resetTiming();
  for (let i = 0; i < 185; i++) app.frame(1 / 60);
  assert.equal(app.loop.getQualityTier(), 3);
});
