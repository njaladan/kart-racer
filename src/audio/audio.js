/** Original synthesis only: engines, Foley and spatial world noise. No music. */
export function createAudioController(audioWindow = window) {
  let context = null,
    master = null,
    effects = null,
    effectsFilter = null,
    ambience = null,
    engineGain = null,
    engineOscillator = null,
    engineFilter = null,
    harmonicOscillator = null;
  let noiseBuffer = null,
    wind = null,
    tires = null,
    voices = 0,
    lastWorldBeat = -1,
    lastWorldId = null,
    lastWorldScale = 1,
    lastWorldUnderwater = false,
    lastDriftTier = 0,
    lastEngineSpeed = 0,
    lastEngineTime = null,
    lastBrakeTime = -Infinity,
    engineInterior = false;
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
    effectsFilter = context.createBiquadFilter();
    effectsFilter.type = "lowpass";
    effectsFilter.frequency.value = 22000;
    effects.connect(effectsFilter);
    effectsFilter.connect(master);
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
  function tone(
    frequency = 440,
    duration = 0.13,
    type = "triangle",
    volume = 0.13,
    slide = 0,
    world = false,
    pan = 0,
  ) {
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
    if (world && context.createStereoPanner) {
      const panner = context.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner);
      panner.connect(ambience);
      oscillator.onended = () => panner.disconnect?.();
    } else gain.connect(world ? ambience : effects);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
    const releasePanner = oscillator.onended;
    oscillator.onended = () => {
      releasePanner?.();
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
    let panner = null;
    if (context.createStereoPanner) {
      panner = context.createStereoPanner();
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
      panner?.disconnect();
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
      case "turbo-blue":
      case "turbo-orange": {
        const orange = kind === "turbo-orange";
        noise(orange ? 0.5 : 0.3, 0.22, orange ? 1800 : 1300);
        tone(orange ? 160 : 120, 0.28, "triangle", 0.085, orange ? 640 : 420);
        break;
      }
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
      case "train-board":
        noise(0.25, 0.24, 420);
        tone(75, 0.12, "triangle", 0.07, -35);
        break;
      case "cannon":
        noise(0.75, 0.45, 90);
        tone(95, 0.5, "sine", 0.18, -60);
        noise(0.38, 0.2, 2200);
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
    const now = context.currentTime;
    const sampleDt = lastEngineTime === null ? 0 : now - lastEngineTime;
    const deceleration =
      sampleDt > 0.01 && sampleDt < 0.5 ? (lastEngineSpeed - speed) / sampleDt : 0;
    if (
      active &&
      state.grounded &&
      state.traversalIndex < 0 &&
      speed > 18 &&
      deceleration > 24 &&
      now - lastBrakeTime > 0.35
    ) {
      noise(0.16, 0.09, state.surfaceLoose ? 500 : 2300);
      lastBrakeTime = now;
    }
    const tier = active ? state.driftTier || 0 : 0;
    if (tier > lastDriftTier) {
      // Original rising intervals: a fifth for blue, an octave for orange.
      // Each plays once on earning the tier, separate from the release whoosh.
      const orange = tier === 2;
      noise(0.1, 0.09, orange ? 3200 : 2100);
      tone(orange ? 880 : 660, 0.2, "sine", 0.09, orange ? 880 : 330);
      tone(orange ? 1320 : 990, 0.12, "triangle", 0.045, orange ? 440 : 165);
    }
    lastDriftTier = tier;
    lastEngineSpeed = speed;
    lastEngineTime = now;
    const character =
      { nolok: 0.78, konqi: 0.92, pidgin: 1.14, kiki: 1.2, wilber: 1.02 }[state.racerId] || 1;
    const load = state.boost > 0 ? 1.18 : 1,
      gear = 1 + Math.floor(speed / 34) * 0.12;
    target(
      engineOscillator.frequency,
      ((52 + (speed % 34) * 1.8 + speed * 0.48) * load * character) / gear,
    );
    target(
      engineFilter.frequency,
      state.underwater
        ? 240 + speed * 1.5
        : (300 + speed * 7 + (state.boost > 0 ? 280 : 0)) * (engineInterior ? 0.68 : 1),
    );
    target(effectsFilter.frequency, state.underwater ? 700 : 22000, 0.25);
    target(engineGain.gain, active ? 0.022 + speed / 9000 : 0);
    target(harmonicOscillator.frequency, 104 + speed * 1.4);
    if (tires) {
      const profiles = {
        wood: [480, 0.013],
        metal: [820, 0.012],
        glass: [1250, 0.007],
        ice: [2700, 0.004],
        sand: [360, 0.02],
        snow: [950, 0.017],
        gravel: [620, 0.023],
        needles: [780, 0.015],
        earth: [520, 0.018],
        grass: [400, 0.014],
        paper: [3300, 0.01],
        stone: [1450, 0.008],
        paving: [1300, 0.007],
        concrete: [1700, 0.006],
        asphalt: [1600, 0.005],
      };
      const [frequency, rolling] = profiles[state.surfaceMaterial] || [
        state.surfaceLoose ? 500 : 1500,
        state.surfaceLoose ? 0.018 : 0.005,
      ];
      const slip = Math.min(0.075, Math.abs(state.lateralSpeed || 0) * 0.006);
      const slide = state.driftDirection ? 1 + Math.min(1, state.drift || 0) * 0.35 : 1;
      target(
        tires.gain.gain,
        active && state.grounded ? (rolling + slip * slide) * Math.min(1, speed / 45) : 0,
      );
      target(
        tires.filter.frequency,
        (state.driftDirection
          ? frequency * (1.15 + (state.drift || 0) * 0.5)
          : state.driftTier
            ? frequency * 1.4
            : frequency) * (state.underwater ? 0.4 : 1),
      );
    }
  }

  function updateWorld(track, state, time, active, opponents = []) {
    if (!context || !wind) return;
    const t = track.trackT(state.s),
      section = track.sectionAt(t),
      id = track.course.id;
    const inside =
      section.enclosed ||
      ["temple", "warehouse", "ferry", "hall", "pantry", "glass", "tunnel"].includes(section.id);
    const storm = id === "tempest-causeway",
      water = !!state.underwater;
    target(wind.filter.frequency, water ? 180 : inside ? 180 : storm ? 1200 : 700, 0.4);
    target(
      wind.gain.gain,
      active ? (inside ? 0.025 : storm ? 0.13 : water ? 0.075 : 0.04) : 0,
      0.35,
    );
    engineInterior = inside;
    if (lastWorldId !== id) {
      lastWorldId = id;
      lastWorldScale = state.scale ?? 1;
      lastWorldUnderwater = water;
      lastWorldBeat = -1;
    }
    if (active && water !== lastWorldUnderwater) noise(0.5, 0.16, water ? 350 : 1100);
    lastWorldUnderwater = water;
    const scale = state.scale ?? 1;
    if (active && lastWorldScale > 0.6 !== scale > 0.6) {
      noise(0.42, 0.16, scale < 0.6 ? 2400 : 900);
      tone(scale < 0.6 ? 850 : 350, 0.24, "sine", 0.08, scale < 0.6 ? -500 : 700);
    }
    lastWorldScale = scale;
    const beat = Math.floor(time * (id === "metronome-hall" ? 2 : 2.5));
    if (!active || beat === lastWorldBeat) return;
    lastWorldBeat = beat;
    if (track.course.theme.atmosphere === "storm" && Math.sin(time * 0.24) > 0.97 && beat % 2 === 0)
      noise(1.8, 0.18, 65, 0.3, true);
    const nearby = opponents
      .filter((r) => !r.finished && r.worldPos.distanceTo(state.worldPos) < 32)
      .sort(
        (a, b) =>
          a.worldPos.distanceToSquared(state.worldPos) -
          b.worldPos.distanceToSquared(state.worldPos),
      )
      .slice(0, 3);
    for (const other of nearby) {
      const dx = other.worldPos.x - state.worldPos.x,
        dz = other.worldPos.z - state.worldPos.z;
      const distance = other.worldPos.distanceTo(state.worldPos);
      const pan = (dx * Math.cos(state.yaw) - dz * Math.sin(state.yaw)) / Math.max(5, distance);
      noise(0.36, 0.045 * (1 - distance / 32) ** 2, 90 + other.speed * 0.8, pan, true);
    }
    for (const source of track.course.ambientSources || []) {
      const p = track.poseAt(
        track.sectorT(source.section, source.fraction) * track.TRACK,
        source.offset,
        2,
      ).p;
      const sx = p.x - state.worldPos.x,
        sz = p.z - state.worldPos.z,
        d = Math.hypot(sx, sz, p.y - state.worldPos.y);
      const volume =
        Math.max(0, 1 - d / source.range) ** 2 *
        source.volume *
        (water && source.kind === "birds" ? 0.15 : 1);
      if (volume < 0.008) continue;
      const stereo = (sx * Math.cos(state.yaw) - sz * Math.sin(state.yaw)) / Math.max(8, d);
      if (source.kind === "birds") {
        if (beat % 5 === 0)
          tone(1200 + Math.random() * 700, 0.08, "sine", volume, 400, true, stereo);
      } else if (source.kind === "drip") {
        if (beat % 3 === 0)
          tone(700 + Math.random() * 600, 0.045, "sine", volume, -400, true, stereo);
      } else if (source.kind === "wood" || source.kind === "ice") {
        if (beat % 7 === 0)
          noise(
            source.kind === "ice" ? 0.25 : 0.045,
            volume,
            source.kind === "ice" ? 180 : 280,
            stereo,
            true,
          );
      } else
        noise(
          source.kind === "lava" ? 0.8 : source.kind === "water" ? 0.4 : 0.2,
          volume,
          source.kind === "lava"
            ? 75
            : source.kind === "engine"
              ? 140
              : source.kind === "sandfall"
                ? 1800
                : source.kind === "steam"
                  ? 3100
                  : source.kind === "paper"
                    ? 4200
                    : 900,
          stereo,
          true,
        );
    }
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
    if (
      falloff > 0.02 &&
      (mechanism || ["clockwork-citadel", "railstorm-express", "metronome-hall"].includes(id))
    )
      noise(
        0.12 + Math.random() * 0.08,
        falloff * 0.18,
        mechanism ? 240 : id === "railstorm-express" ? 460 : 340,
        pan,
        true,
      );
    if (id === "metronome-hall" && ["tappets", "hall", "bells", "hammers"].includes(section.id))
      noise(0.065, 0.07, beat % 2 ? 430 : 280, beat % 2 ? 0.3 : -0.3, true);
    if (id === "railstorm-express" && state.movingDeckId) {
      noise(0.07, 0.09, 550, Math.sin(time * 1.7) * 0.3, true);
      if (beat % 8 === 0) noise(0.7, 0.07, 95, 0, true);
    }
    if (storm && beat % 8 === 0) noise(0.85, 0.17, 95, -0.4, true);
    if (water && beat % 3 === 0) noise(0.2, 0.05, 1900, Math.sin(time), true);
  }
  function stopEngine() {
    if (context) {
      lastDriftTier = 0;
      lastEngineTime = null;
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
