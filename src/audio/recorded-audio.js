import { COURSE_MUSIC } from "./course-music.js";

const effectFiles = {
  "countdown-3": "countdown-3.ogg",
  "countdown-2": "countdown-2.ogg",
  "countdown-1": "countdown-1.ogg",
  "countdown-go": "countdown-go.ogg",
  splash: "splash.ogg",
  bubble: "bubble.wav",
};

/** Decoded Web Audio loops avoid gaps and share the game's pause/master controls. */
export function createRecordedAudio({ context, master, effects, ambience, fetchAudio }) {
  const buffers = new Map();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  filter.type = "lowpass";
  filter.frequency.value = 22000;
  gain.gain.value = 0;
  filter.connect(gain);
  gain.connect(master);
  let courseId = null,
    source = null,
    wanted = false,
    underwater = false,
    volume = 0.6,
    nextBubble = 0,
    generation = 0;

  function load(url) {
    if (!buffers.has(url)) {
      buffers.set(
        url,
        Promise.resolve()
          .then(() => fetchAudio(url))
          .then((response) => {
            if (!response.ok) throw new Error(`Audio unavailable: ${url}`);
            return response.arrayBuffer();
          })
          .then((bytes) => context.decodeAudioData(bytes))
          .catch(() => null), // A missing recording must never stop a race.
      );
    }
    return buffers.get(url);
  }
  function setVolume(value) {
    volume = value;
    gain.gain.setTargetAtTime(
      // Recordings are mastered much louder than the procedural engines and item cues.
      wanted ? volume * 0.25 * (COURSE_MUSIC[courseId]?.gain ?? 1) * (underwater ? 0.8 : 1) : 0,
      context.currentTime,
      0.18,
    );
  }
  function play(kind) {
    if (!effectFiles[kind]) return;
    const requestedAt = context.currentTime;
    const currentGeneration = generation;
    void load(new URL(`../../assets/audio/sfx/${effectFiles[kind]}`, import.meta.url).href).then(
      (buffer) => {
        if (!buffer || currentGeneration !== generation || context.currentTime - requestedAt > 0.4)
          return;
        const node = context.createBufferSource();
        const level = context.createGain();
        node.buffer = buffer;
        level.gain.value = kind === "bubble" ? 0.22 : kind === "splash" ? 0.65 : 1.1;
        node.connect(level);
        level.connect(kind === "bubble" ? ambience : effects);
        node.onended = () => {
          node.disconnect();
          level.disconnect();
        };
        node.start();
      },
    );
  }
  function stop() {
    wanted = false;
    generation++;
    if (source) {
      source.stop();
      source.disconnect();
      source = null;
    }
    underwater = false;
    nextBubble = 0;
    filter.frequency.setTargetAtTime(22000, context.currentTime, 0.18);
    setVolume(volume);
  }
  function prepare(id) {
    if (courseId !== id) {
      stop();
      courseId = id;
    }
    const track = COURSE_MUSIC[id];
    if (!track) return Promise.resolve(null);
    return load(new URL(`../../assets/audio/music/${track.file}.ogg`, import.meta.url).href);
  }
  function update(id, active, water) {
    if (courseId !== id) prepare(id);
    if (!active) {
      if (wanted) stop();
      return;
    }
    if (!wanted) {
      wanted = true;
      const currentGeneration = generation;
      void prepare(id).then((buffer) => {
        if (!buffer || !wanted || courseId !== id || generation !== currentGeneration) return;
        source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.loopStart = COURSE_MUSIC[id].loopStart ?? 0;
        source.loopEnd = buffer.duration;
        source.connect(filter);
        source.start();
        setVolume(volume);
      });
    }
    if (water !== underwater) {
      underwater = water;
      play("splash");
      nextBubble = context.currentTime;
      filter.frequency.setTargetAtTime(water ? 850 : 22000, context.currentTime, 0.25);
      setVolume(volume);
    }
    if (water && context.currentTime >= nextBubble) {
      play("bubble");
      nextBubble = context.currentTime + 1.6;
    }
  }
  for (const file of Object.values(effectFiles))
    void load(new URL(`../../assets/audio/sfx/${file}`, import.meta.url).href);
  return { prepare, update, play, stop, setVolume };
}
