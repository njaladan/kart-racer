import test from "node:test";
import assert from "node:assert/strict";
import { createAudioController } from "../src/audio/audio.js";

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
    this.connections = [];
  }
  connect(node) {
    this.connections.push(node);
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
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delay, 65);
  assert.equal(context.resumed, true);
  assert.equal(context.suspended, true);
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
