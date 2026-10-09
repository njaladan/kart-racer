import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { COURSE_MUSIC } from "../src/audio/course-music.js";
import { createRecordedAudio } from "../src/audio/recorded-audio.js";
import { COURSES } from "../src/courses/registry.js";

const settle = () => new Promise((resolve) => setImmediate(resolve));
function setup(
  fetchAudio = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }),
) {
  const sources = [],
    filters = [];
  const node = () => ({
    gain: {
      value: 0,
      setTargetAtTime(value) {
        this.value = value;
      },
    },
    frequency: {
      value: 0,
      setTargetAtTime(value) {
        this.value = value;
      },
    },
    connect(target) {
      this.target = target;
    },
    disconnect() {
      this.disconnected = true;
    },
    start() {
      this.started = true;
    },
    stop() {
      this.stopped = true;
    },
  });
  const context = {
    currentTime: 0,
    createGain: node,
    createBiquadFilter() {
      const n = node();
      filters.push(n);
      return n;
    },
    createBufferSource() {
      const n = node();
      sources.push(n);
      return n;
    },
    decodeAudioData: async () => ({ duration: 120 }),
  };
  const master = node(),
    effects = node(),
    ambience = node();
  const audio = createRecordedAudio({ context, master, effects, ambience, fetchAudio });
  return { audio, context, sources, filters, master, effects, ambience };
}

test("all twelve courses have distinct playable recordings and valid loop boundaries", async () => {
  assert.equal(Object.keys(COURSE_MUSIC).length, COURSES.length);
  assert.equal(new Set(Object.values(COURSE_MUSIC).map((track) => track.file)).size, 12);
  const manifest = JSON.parse(
    await readFile(new URL("../assets/audio/manifest.json", import.meta.url)),
  );
  for (const course of COURSES) {
    const track = COURSE_MUSIC[course.id];
    assert.ok(track, course.id);
    const file = `music/${track.file}.ogg`;
    const bytes = await readFile(new URL(`../assets/audio/${file}`, import.meta.url));
    assert.equal(bytes.subarray(0, 4).toString(), "OggS");
    assert.ok((track.loopStart ?? 0) < manifest.files[file].duration);
  }
});

test("preloading and countdown stay silent until the race is active; music loops once", async () => {
  const { audio, sources } = setup();
  await audio.prepare("neon-harbor");
  audio.update("neon-harbor", false, false);
  await settle();
  assert.equal(sources.length, 0);
  audio.play("countdown-3");
  await settle();
  assert.equal(sources.length, 1);
  assert.ok(!sources[0].loop);
  for (let i = 0; i < 20; i++) audio.update("neon-harbor", true, false);
  await settle();
  assert.equal(sources.length, 2);
  assert.equal(sources[1].loop, true);
  assert.equal(sources[1].loopStart, 3.6);
  assert.equal(sources[1].loopEnd, 120);
  assert.equal(sources[1].started, true);
});

test("water entry muffles music, adds splash and bounded bubbles, and surfacing restores it", async () => {
  const { audio, context, sources, filters, ambience } = setup();
  await audio.prepare("pelagic-glasshouse");
  audio.update("pelagic-glasshouse", true, false);
  await settle();
  audio.update("pelagic-glasshouse", true, true);
  await settle();
  assert.equal(filters[0].frequency.value, 850);
  assert.equal(sources.length, 3); // Music, splash, bubble.
  assert.equal(sources[2].target.target, ambience);
  for (let i = 0; i < 40; i++) audio.update("pelagic-glasshouse", true, true);
  await settle();
  assert.equal(sources.length, 3);
  context.currentTime = 2;
  audio.update("pelagic-glasshouse", true, true);
  await settle();
  assert.equal(sources.length, 4);
  audio.update("pelagic-glasshouse", true, false);
  await settle();
  assert.equal(filters[0].frequency.value, 22000);
  audio.setVolume(0);
  assert.equal(filters[0].target.gain.value, 0);
  audio.stop();
  assert.equal(sources[0].stopped, true);
  assert.equal(sources[0].disconnected, true);
});

test("stopped races and course switches cannot start stale music after a slow download", async () => {
  const pending = [];
  const { audio, sources } = setup((url) => {
    if (url.includes("/sfx/")) return Promise.resolve({ ok: false });
    return new Promise((resolve) => pending.push(resolve));
  });
  audio.update("windmill-wilds", true, false);
  await settle();
  audio.stop();
  audio.update("neon-harbor", true, false);
  await settle();
  const response = { ok: true, arrayBuffer: async () => new ArrayBuffer(1) };
  pending[0](response);
  await settle();
  assert.equal(sources.length, 0);
  pending[1](response);
  await settle();
  assert.equal(sources.length, 1);
  assert.equal(sources[0].loopStart, 3.6);
});

test("audio download failures are nonfatal and delayed countdown clips are discarded", async () => {
  const failed = setup(async () => {
    throw new Error("offline");
  });
  failed.audio.update("windmill-wilds", true, false);
  failed.audio.play("countdown-3");
  await settle();
  assert.equal(failed.sources.length, 0);
  const pending = [];
  const { audio, context, sources } = setup(() => new Promise((resolve) => pending.push(resolve)));
  audio.play("countdown-3");
  await settle();
  context.currentTime = 2;
  pending.forEach((resolve) => resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }));
  await settle();
  assert.equal(sources.length, 0);
});
