import test from "node:test";
import assert from "node:assert/strict";
import { createAudioController } from "../src/audio/audio.js";
import { COURSES } from "../src/courses/registry.js";
import { selectCourse } from "../src/track/track.js";

class FakeAudioParam {
  setValueAtTime(value) {
    this.value = value;
  }
  setTargetAtTime(value) {
    this.value = value;
  }
  exponentialRampToValueAtTime(value) {
    this.value = value;
  }
}

class FakeNode {
  constructor() {
    this.gain = new FakeAudioParam();
    this.frequency = new FakeAudioParam();
    this.pan = new FakeAudioParam();
    this.connections = [];
  }
  connect(node) {
    this.connections.push(node);
  }
  disconnect() {
    this.disconnected = true;
    this.connections = [];
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}

class FakeAudioContext {
  constructor() {
    createdContext = this;
    this.currentTime = 1;
    this.destination = new FakeNode();
    this.oscillators = [];
    this.filters = [];
  }
  createGain() {
    return new FakeNode();
  }
  createBiquadFilter() {
    const filter = new FakeNode();
    this.filters.push(filter);
    return filter;
  }
  createOscillator() {
    const oscillator = new FakeNode();
    this.oscillators.push(oscillator);
    return oscillator;
  }
  resume() {
    this.resumed = true;
    return Promise.resolve();
  }
  suspend() {
    this.suspended = true;
    return Promise.resolve();
  }
}
let createdContext;

test("audio controller owns its graph and exposes race sound operations", () => {
  const scheduled = [];
  const window = {
    AudioContext: FakeAudioContext,
    setTimeout(callback, delay) {
      scheduled.push({ callback, delay });
    },
  };
  const audio = createAudioController(window);

  audio.start();
  const context = createdContext;
  audio.updateEngine(50, true);
  audio.play("pickup");
  audio.resume();
  audio.suspend();
  audio.stopEngine();

  assert.equal(context.oscillators.length, 3);
  assert.equal(scheduled.length, 0, "pickup has no wall-clock callbacks that outlive the race");
  assert.equal(context.resumed, true);
  assert.equal(context.suspended, true);
});

test("pickup, occupied crush, roulette notes and selection have distinct sound signatures", () => {
  const audio = createAudioController({ AudioContext: NoisyAudioContext });
  audio.start();
  audio.play("pickup");
  const pickup = createdContext.oscillators.at(-1).frequency.value;
  audio.play("box-crush");
  assert.notEqual(createdContext.oscillators.at(-1).frequency.value, pickup);
  const pitches = [];
  for (let tick = 0; tick < 3; tick++) {
    audio.play("item-roll", tick);
    pitches.push(createdContext.oscillators.at(-2).frequency.value);
  }
  assert.equal(new Set(pitches).size, 3);
  const before = createdContext.oscillators.length;
  audio.play("item-select");
  assert.equal(createdContext.oscillators.length - before, 3);
});

test("audio controller safely no-ops when Web Audio is unavailable", () => {
  const audio = createAudioController({ setTimeout() {} });
  audio.start();
  audio.play("unknown");
  audio.tone();
  audio.updateEngine(0, false);
  audio.stopEngine();
  assert.equal(audio.resume(), undefined);
  assert.equal(audio.suspend(), undefined);
});

test("immersion filters every race effect and restores clear sound after surfacing", () => {
  const audio = createAudioController({ AudioContext: FakeAudioContext });
  audio.start();
  audio.updateEngine(40, true, { underwater: true });
  const [effects, engine] = createdContext.filters;
  assert.equal(effects.frequency.value, 700);
  assert.equal(engine.frequency.value, 300);
  audio.updateEngine(40, true, { underwater: false });
  assert.equal(effects.frequency.value, 22000);
  assert.equal(engine.frequency.value, 580);
});

class NoisyAudioContext extends FakeAudioContext {
  constructor() {
    super();
    this.sampleRate = 60;
    this.sources = [];
    this.panners = [];
  }
  createBuffer(_channels, samples) {
    return { getChannelData: () => new Float32Array(samples) };
  }
  createBufferSource() {
    const node = new FakeNode();
    this.sources.push(node);
    return node;
  }
  createStereoPanner() {
    const node = new FakeNode();
    this.panners.push(node);
    return node;
  }
}

test("transient noise caps concurrent voices and releases every spatial panner", () => {
  const audio = createAudioController({ AudioContext: NoisyAudioContext });
  audio.start();
  for (let i = 0; i < 100; i++) audio.play("mechanism");
  assert.equal(createdContext.sources.length, 26); // Two permanent loops +24 bounded transients.
  const panners = [...createdContext.panners];
  for (const source of createdContext.sources.slice(2)) source.onended();
  assert.equal(panners.length, 24);
  assert.ok(panners.every((node) => node.disconnected && node.connections.length === 0));
  audio.play("mechanism");
  assert.equal(createdContext.sources.length, 27);
});

test("drift tiers sound once, tyres follow material and braking noise has a cooldown", () => {
  const audio = createAudioController({ AudioContext: NoisyAudioContext });
  audio.start();
  const state = { grounded: true, traversalIndex: -1, surfaceMaterial: "sand", driftTier: 1 };
  for (let i = 0; i < 40; i++) audio.updateEngine(60, true, state);
  assert.equal(createdContext.sources.length, 3);
  assert.equal(createdContext.filters[3].frequency.value, 360 * 1.4);
  audio.updateEngine(60, true, { ...state, driftTier: 2, surfaceMaterial: "ice" });
  assert.equal(createdContext.sources.length, 4);
  assert.equal(createdContext.filters[3].frequency.value, 2700 * 1.4);
  createdContext.currentTime += 0.06;
  audio.updateEngine(45, true, { ...state, driftTier: 0 });
  assert.equal(createdContext.sources.length, 5);
  createdContext.currentTime += 0.06;
  audio.updateEngine(30, true, { ...state, driftTier: 0 });
  assert.equal(createdContext.sources.length, 5);
  audio.stopEngine();
  audio.updateEngine(60, true, state);
  assert.equal(createdContext.sources.length, 6);
});

test("all twelve authored soundscapes resolve spatial sources without exceeding the graph budget", () => {
  const audio = createAudioController({ AudioContext: NoisyAudioContext });
  audio.start();
  let released = 2;
  for (const course of COURSES) {
    const track = selectCourse(course);
    assert.ok(course.ambientSources.length > 0, course.id);
    for (const source of course.ambientSources) {
      assert.ok(source.section >= 0 && source.section < course.sections.length);
      assert.ok(source.range > 0 && source.volume > 0);
      const t = track.sectorT(source.section, source.fraction);
      const pose = track.poseAt(t * track.TRACK, 0, 0.065);
      const state = {
        s: t * track.TRACK,
        worldPos: pose.p,
        yaw: track.yawFor(pose.tangent),
        speed: 30,
      };
      assert.doesNotThrow(() =>
        audio.updateWorld(track, state, 14, true, [{ ...state, finished: false }]),
      );
      const current = createdContext.sources.length;
      assert.ok(current - released <= 24);
      for (const node of createdContext.sources.slice(released)) node.onended();
      released = current;
    }
  }
});

test("blue and orange readiness have distinct rising tones and release whooshes", () => {
  const audio = createAudioController({ AudioContext: NoisyAudioContext });
  audio.start();
  const state = { grounded: true, traversalIndex: -1, driftTier: 1 };
  audio.updateEngine(80, true, state);
  const blue = createdContext.oscillators.slice(2);
  assert.equal(blue.length, 2);
  const bluePitches = blue.map((node) => node.frequency.value);
  for (let i = 0; i < 20; i++) audio.updateEngine(80, true, state);
  assert.equal(createdContext.oscillators.length, 4, "the held readiness tone does not repeat");
  audio.updateEngine(80, true, { ...state, driftTier: 2 });
  const orange = createdContext.oscillators.slice(4);
  assert.ok(orange[0].frequency.value > bluePitches[0]);
  assert.ok(orange[1].frequency.value > bluePitches[1]);
  audio.play("turbo-blue");
  const blueRelease = createdContext.oscillators.at(-1).frequency.value;
  audio.play("turbo-orange");
  assert.ok(createdContext.oscillators.at(-1).frequency.value > blueRelease);
});
