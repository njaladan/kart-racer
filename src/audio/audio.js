/** Original synthesis only: engines, Foley and spatial world noise. No music. */
export function createAudioController(audioWindow = window) {
  let context = null,
    master = null,
    effects = null,
    ambience = null,
    engineGain = null,
    engineOscillator = null,
    engineFilter = null,
    harmonicOscillator = null;
  let noiseBuffer = null,
    wind = null,
    tires = null,
    voices = 0,
    lastWorldBeat = -1;
  let volumes = { master: 0.8, effects: 0.8, ambience: 0.55 };
  const target = (param, value, time = 0.08) =>
    param?.setTargetAtTime(value, context.currentTime, time);
  function setVolumes(next) {
    volumes = { ...volumes, ...next };
    if (!context) return;
    target(master.gain, volumes.master * 0.28);
    target(effects.gain, volumes.effects);
    target(ambience.gain, volumes.ambience);
  }
  function noiseLoop(bus, frequency, type = "lowpass") {
    if (!noiseBuffer) return null;
    const source = context.createBufferSource(),
      filter = context.createBiquadFilter(),
      gain = context.createGain();
    source.buffer = noiseBuffer;
    source.loop = true;
    filter.type = type;
    filter.frequency.value = frequency;
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    source.start();
    return { source, filter, gain };
  }
  function start() {
    if (context) return;
    const AudioContext = audioWindow.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContext) return;
    context = new AudioContext();
    master = context.createGain();
    effects = context.createGain();
    ambience = context.createGain();
    master.connect(context.destination);
    effects.connect(master);
    ambience.connect(master);
    setVolumes(volumes);
    engineFilter = context.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 460;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineOscillator = context.createOscillator();
    engineOscillator.type = "sawtooth";
    engineOscillator.frequency.value = 62;
    engineOscillator.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(effects);
    engineOscillator.start();
    harmonicOscillator = context.createOscillator();
    const harmonicGain = context.createGain();
    harmonicOscillator.type = "triangle";
    harmonicOscillator.frequency.value = 124;
    harmonicGain.gain.value = 0.006;
    harmonicOscillator.connect(harmonicGain);
    harmonicGain.connect(engineGain);
    harmonicOscillator.start();
    if (context.createBuffer && context.createBufferSource) {
      noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        brown = (brown + white * 0.04) / 1.02;
        data[i] = white * 0.65 + brown * 0.8;
      }
      wind = noiseLoop(ambience, 600);
      tires = noiseLoop(effects, 1800, "bandpass");
    }
  }
  function tone(frequency = 440, duration = 0.13, type = "triangle", volume = 0.13, slide = 0) {
    if (!context || voices >= 24) return;
    voices++;
    const oscillator = context.createOscillator(),
      gain = context.createGain(),
      now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slide)
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(30, frequency + slide),
        now + duration,
      );
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(effects);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
    oscillator.onended = () => {
      voices = Math.max(0, voices - 1);
      oscillator.disconnect?.();
      gain.disconnect?.();
    };
  }
  function noise(duration, volume, frequency = 800, pan = 0, world = false) {
    if (!noiseBuffer || voices >= 24) return;
    voices++;
    const source = context.createBufferSource(),
      filter = context.createBiquadFilter(),
      gain = context.createGain(),
      now = context.currentTime;
    source.buffer = noiseBuffer;
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    if (context.createStereoPanner) {
      const panner = context.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner);
      panner.connect(world ? ambience : effects);
    } else gain.connect(world ? ambience : effects);
    source.start(now, Math.random());
    source.stop(now + duration + 0.02);
    source.onended = () => {
      voices = Math.max(0, voices - 1);
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  function play(kind) {
    switch (kind) {
      case "pickup":
        tone(660, 0.1, "sine", 0.1, 280);
        audioWindow.setTimeout(() => tone(990, 0.1, "sine", 0.07, 180), 65);
        break;
      case "boost":
        noise(0.45, 0.24, 1200);
        tone(95, 0.32, "sawtooth", 0.065, 420);
        break;
      case "shell":
        noise(0.17, 0.16, 1700);
        tone(260, 0.15, "square", 0.04, -150);
        break;
      case "jump":
        noise(0.23, 0.14, 2200);
        tone(180, 0.12, "sine", 0.04, 240);
        break;
      case "trick":
        noise(0.22, 0.18, 3800);
        tone(620, 0.13, "sine", 0.06, 520);
        break;
      case "land":
        noise(0.18, 0.32, 160);
        tone(65, 0.1, "sine", 0.13, -30);
        break;
      case "hit":
        noise(0.28, 0.4, 280);
        tone(80, 0.18, "triangle", 0.16, -45);
        break;
      case "star":
        noise(0.35, 0.12, 4800);
        tone(850, 0.16, "sine", 0.08, 600);
        break;
      case "ui":
        tone(480, 0.045, "sine", 0.06, 90);
        break;
      case "finish":
        noise(0.7, 0.17, 3300);
        tone(380, 0.3, "triangle", 0.09, 300);
        break;
      case "mechanism":
        noise(0.4, 0.22, 240);
        break;
      default:
        break;
    }
  }
  function updateEngine(speed, active, state = {}) {
    if (!engineOscillator || !context) return;
    const load = state.boost > 0 ? 1.18 : 1,
      gear = 1 + Math.floor(speed / 34) * 0.12;
    target(engineOscillator.frequency, ((52 + (speed % 34) * 1.8 + speed * 0.48) * load) / gear);
    target(engineFilter.frequency, 300 + speed * 7 + (state.boost > 0 ? 280 : 0));
    target(engineGain.gain, active ? 0.022 + speed / 9000 : 0);
    target(harmonicOscillator.frequency, 104 + speed * 1.4);
    if (tires) {
      target(
        tires.gain.gain,
        active && state.grounded
          ? (Math.abs(state.lateralSpeed || 0) * 0.006 + (state.surfaceLoose ? 0.018 : 0)) *
              Math.min(1, speed / 45)
          : 0,
      );
      target(tires.filter.frequency, state.driftTier ? 2400 : state.surfaceLoose ? 500 : 1500);
    }
  }
  function updateWorld(track, state, time, active) {
    if (!context || !wind) return;
    const t = track.trackT(state.s),
      section = track.sectionAt(t),
      id = track.course.id;
    const inside =
      section.enclosed ||
      ["temple", "warehouse", "ferry", "hall", "pantry", "glass", "tunnel"].includes(section.id);
    const storm = id === "tempest-causeway",
      water = id === "pelagic-glasshouse";
    target(wind.filter.frequency, inside ? 180 : water ? 390 : storm ? 1200 : 700, 0.4);
    target(
      wind.gain.gain,
      active ? (inside ? 0.025 : storm ? 0.13 : water ? 0.075 : 0.04) : 0,
      0.35,
    );
    target(engineFilter.frequency, (inside ? 400 : 650) + state.speed * 4, 0.15);
    const beat = Math.floor(time * (id === "metronome-hall" ? 2 : 2.5));
    if (!active || beat === lastWorldBeat) return;
    lastWorldBeat = beat;
    const mechanism = track.course.solarEngine;
    let station = mechanism
      ? track.sectorT(mechanism.section, 0.5)
      : track.sectorT(track.course.hazard.section, track.course.hazard.fraction);
    if (id === "railstorm-express") station = t;
    const source = track.poseAt(station * track.TRACK, 12, 3).p;
    const dx = source.x - state.worldPos.x,
      dz = source.z - state.worldPos.z,
      distance = Math.hypot(dx, dz, source.y - state.worldPos.y);
    const falloff = Math.max(0, 1 - distance / 90) ** 2;
    const pan = (dx * Math.cos(state.yaw) - dz * Math.sin(state.yaw)) / Math.max(8, distance);
    if (falloff > 0.02)
      noise(
        0.12 + Math.random() * 0.08,
        falloff * 0.18,
        mechanism ? 240 : id === "railstorm-express" ? 460 : 340,
        pan,
        true,
      );
    if (storm && beat % 8 === 0) noise(0.85, 0.17, 95, -0.4, true);
    if (water && beat % 3 === 0) noise(0.2, 0.05, 1900, Math.sin(time), true);
  }
  function stopEngine() {
    if (context) {
      target(engineGain?.gain, 0, 0.1);
      if (wind) target(wind.gain.gain, 0, 0.2);
      if (tires) target(tires.gain.gain, 0, 0.1);
    }
  }
  return {
    start,
    setVolumes,
    play,
    tone,
    updateEngine,
    updateWorld,
    stopEngine,
    resume: () => context?.resume(),
    suspend: () => context?.suspend(),
  };
}
