/** Owns the Web Audio graph used for the engine loop and race sound effects. */
export function createAudioController(audioWindow = window) {
  let context = null;
  let master = null;
  let engineGain = null;
  let engineOscillator = null;
  let engineFilter = null;
  let harmonicOscillator = null;

  function start() {
    if (context) return;
    const AudioContext =
      audioWindow.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContext) return;

    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.23;
    master.connect(context.destination);

    engineFilter = context.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 460;
    engineGain = context.createGain();
    engineGain.gain.value = 0.025;
    engineOscillator = context.createOscillator();
    engineOscillator.type = "sawtooth";
    engineOscillator.frequency.value = 62;
    engineOscillator.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOscillator.start();

    harmonicOscillator = context.createOscillator();
    const harmonicGain = context.createGain();
    harmonicOscillator.type = "triangle";
    harmonicOscillator.frequency.value = 124;
    harmonicGain.gain.value = 0.009;
    harmonicOscillator.connect(harmonicGain);
    harmonicGain.connect(master);
    harmonicOscillator.start();
  }

  function tone(
    frequency = 440,
    duration = 0.13,
    type = "triangle",
    volume = 0.13,
    slide = 0,
  ) {
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slide) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(30, frequency + slide),
        now + duration,
      );
    }
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  function play(kind) {
    switch (kind) {
      case "pickup":
        tone(660, 0.1, "sine", 0.12, 280);
        audioWindow.setTimeout(() => tone(990, 0.12, "sine", 0.09, 180), 65);
        break;
      case "boost":
        tone(180, 0.35, "sawtooth", 0.17, 650);
        break;
      case "shell":
        tone(360, 0.25, "square", 0.12, -230);
        break;
      case "jump":
        tone(240, 0.38, "triangle", 0.12, 570);
        break;
      case "hit":
        tone(115, 0.24, "sawtooth", 0.18, -60);
        break;
      case "star":
        tone(540, 0.35, "triangle", 0.08, 900);
        break;
      default:
        break;
    }
  }

  function updateEngine(speed, active) {
    if (!engineOscillator || !context) return;
    const now = context.currentTime;
    engineOscillator.frequency.setTargetAtTime(55 + speed * 1.2, now, 0.08);
    engineFilter.frequency.setTargetAtTime(330 + speed * 6, now, 0.1);
    engineGain.gain.setTargetAtTime(
      active ? 0.018 + speed / 10000 : 0.002,
      now,
      0.12,
    );
    harmonicOscillator.frequency.setTargetAtTime(110 + speed * 2.4, now, 0.08);
  }

  function stopEngine() {
    if (engineGain && context)
      engineGain.gain.setTargetAtTime(0, context.currentTime, 0.1);
  }

  function resume() {
    return context?.resume();
  }

  function suspend() {
    return context?.suspend();
  }

  return { start, resume, suspend, play, tone, updateEngine, stopEngine };
}
