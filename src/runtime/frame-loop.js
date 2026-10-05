import { FIXED_DT } from "../simulation/physics.js";

/** Own display timing, fixed-step accumulation, resize, and adaptive resolution. */
export function createFrameLoop({
  renderer,
  camera,
  initialPixelRatio,
  benchmarkMode = false,
  isPaused,
  shouldStep = () => true,
  step,
  render,
  onFrame = () => {},
  windowRef = window,
  now = () => performance.now(),
  requestFrame = (callback) => requestAnimationFrame(callback),
}) {
  let last = now(),
    accumulator = 0;
  let pixelRatio = initialPixelRatio;
  let performanceTime = 0,
    performanceFrames = 0;
  function resetTiming() {
    last = now();
    accumulator = 0;
  }
  function resize() {
    pixelRatio = Math.min(pixelRatio, windowRef.devicePixelRatio || 1);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(windowRef.innerWidth, windowRef.innerHeight, false);
    camera.aspect = windowRef.innerWidth / windowRef.innerHeight;
    camera.updateProjectionMatrix();
  }
  function frame(timestamp) {
    const frameSeconds = Math.max(0, (timestamp - last) / 1000);
    const dt = Math.min(0.1, frameSeconds);
    last = timestamp;
    if (!isPaused() && shouldStep()) {
      accumulator += dt;
      while (accumulator >= FIXED_DT) {
        step(FIXED_DT);
        accumulator -= FIXED_DT;
      }
    }
    render(isPaused() ? 0 : dt);
    if (!isPaused() && dt > 0) {
      performanceTime += dt;
      performanceFrames++;
      if (performanceTime > 3) {
        const average = performanceTime / performanceFrames;
        if (!benchmarkMode && average > 0.025 && pixelRatio > 0.85) {
          pixelRatio = Math.max(0.85, pixelRatio - 0.15);
          renderer.setPixelRatio(pixelRatio);
          renderer.setSize(windowRef.innerWidth, windowRef.innerHeight, false);
        }
        performanceTime = performanceFrames = 0;
      }
    }
    onFrame(frameSeconds);
    requestFrame(frame);
  }
  return {
    start: () => requestFrame(frame),
    resize,
    resetTiming,
    getAccumulator: () => accumulator,
    getPixelRatio: () => pixelRatio,
  };
}
