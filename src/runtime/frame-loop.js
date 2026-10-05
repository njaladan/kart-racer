import { FIXED_DT } from "../simulation/physics.js";

/** Own fixed steps and quality adaptation using unclamped display timing. */
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
  onQualityChange = () => {},
  windowRef = window,
  now = () => performance.now(),
  requestFrame = (callback) => requestAnimationFrame(callback),
}) {
  let last = now(),
    accumulator = 0;
  let pixelRatio = initialPixelRatio;
  let tier = 3;
  let performanceTime = 0,
    performanceFrames = 0,
    slowWindows = 0,
    healthyWindows = 0;
  let lastAverage = 1 / 60;
  const minPixelRatio = Math.min(0.85, initialPixelRatio);
  function resetWindow() {
    performanceTime = performanceFrames = 0;
  }
  function resetTiming() {
    last = now();
    accumulator = 0;
    resetWindow();
    slowWindows = healthyWindows = 0;
  }
  function applyQuality() {
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(windowRef.innerWidth, windowRef.innerHeight, false);
    onQualityChange({
      tier,
      pixelRatio,
      targetFps: tier === 0 ? 30 : 60,
      averageFrameMs: lastAverage * 1000,
    });
  }
  function resize() {
    pixelRatio = Math.min(pixelRatio, windowRef.devicePixelRatio || 1);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(windowRef.innerWidth, windowRef.innerHeight, false);
    camera.aspect = windowRef.innerWidth / windowRef.innerHeight;
    camera.updateProjectionMatrix();
  }
  function assessPerformance(frameSeconds) {
    // Ignore background-tab/startup stalls, but never use capped simulation dt.
    if (frameSeconds <= 0 || frameSeconds > 0.25 || benchmarkMode) return;
    performanceTime += frameSeconds;
    performanceFrames++;
    // Shorter windows make quality responsive, while requiring two consecutive
    // slow windows below filters a single startup or scene-transition hitch.
    if (performanceTime < 1.6) return;
    lastAverage = performanceTime / performanceFrames;
    const tooSlow = lastAverage > (tier === 0 ? 0.037 : 0.0195);
    const healthy = lastAverage < 0.0174;
    slowWindows = tooSlow ? slowWindows + 1 : 0;
    healthyWindows = healthy ? healthyWindows + 1 : 0;
    if (slowWindows >= 2) {
      if (tier > 0) tier--;
      if (pixelRatio > minPixelRatio)
        pixelRatio = Math.max(minPixelRatio, Math.round((pixelRatio - 0.15) * 100) / 100);
      applyQuality();
      slowWindows = healthyWindows = 0;
    } else if (healthyWindows >= 3) {
      // Recovery needs nine healthy seconds, avoiding rapid tier oscillation.
      const ceiling = Math.min(initialPixelRatio, windowRef.devicePixelRatio || 1);
      if (pixelRatio < ceiling)
        pixelRatio = Math.min(ceiling, Math.round((pixelRatio + 0.1) * 100) / 100);
      else if (tier < 3) tier++;
      applyQuality();
      healthyWindows = 0;
    }
    resetWindow();
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
    if (!isPaused()) assessPerformance(frameSeconds);
    onFrame(frameSeconds);
    requestFrame(frame);
  }
  return {
    start: () => requestFrame(frame),
    resize,
    resetTiming,
    getAccumulator: () => accumulator,
    getPixelRatio: () => pixelRatio,
    getQualityTier: () => tier,
    getPerformance: () => ({
      averageFrameMs: lastAverage * 1000,
      tier,
      targetFps: tier === 0 ? 30 : 60,
    }),
  };
}
