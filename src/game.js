import { createAudioController } from "./audio/audio.js";
import { createGamePage } from "./ui/game-page.js";
import { createRaceView } from "./ui/race-view.js";
import { createRaceFeedback } from "./ui/race-feedback.js";
import { createRadar } from "./ui/radar.js";
import { createKartBuilder } from "./rendering/kart-builder.js";
import { createGameScene } from "./rendering/game-scene.js";
import { createGameRenderer } from "./rendering/game-renderer.js";
import { createRaceProps } from "./rendering/race-props.js";
import { createItemEffects } from "./rendering/item-effects.js";
import { ParticlePool } from "./rendering/particle-pool.js";
import { contactShadow } from "./rendering/visuals.js";
import { buildCourseWorld } from "./rendering/course-runtime.js";
import { selectCourse, activeTrack, frameAt } from "./track/track.js";
import { createRaceGrid } from "./simulation/race-grid.js";
import { createRaceSession } from "./simulation/race-session.js";
import { createRaceItems } from "./simulation/race-items.js";
import { botInput } from "./simulation/simulation.js";
import { bindGameInput } from "./input/game-input.js";
import { createFrameLoop } from "./runtime/frame-loop.js";
import { loadCourseBake, installCourseBake } from "./rendering/baked-lighting.js";
import { installHeightHaze, installFoliageWind } from "./rendering/surface-detail.js";
import { createBrowserDiagnostics } from "./testing/browser-diagnostics.js";

async function startGame() {
  const page = createGamePage();
  const { course, roster, canvas, radar, ui, testMode, benchmarkMode } = page;
  selectCourse(course);
  const sceneState = await createGameScene({ canvas, course });
  const { scene, camera, renderer, textures, courseAssets, sharedAssets } = sceneState;
  const landscape = buildCourseWorld({
    scene,
    renderer,
    textures,
    materials: sceneState.materials,
    track: activeTrack,
    assets: courseAssets,
    sharedAssets,
  });
  const { pads, boxes } = createRaceProps({ ...sceneState, course });
  const courseBake = await loadCourseBake(course.id);
  installCourseBake(scene, courseBake);
  const racers = createRaceGrid(roster);
  const [player, ...bots] = racers;
  const buildKart = createKartBuilder({
    scene,
    models: courseAssets.models,
    textures: { ...textures, environment: sharedAssets.environment },
    shadowTexture: contactShadow(),
    theme: course.theme,
  });
  for (const racer of racers) {
    racer.kart = buildKart(racer.color, racer.name, racer.isPlayer, racer.racerId);
  }
  const audio = createAudioController(window);
  const particles = new ParticlePool(scene);
  const view = createRaceView({ ...page, racers, boxes, audio });
  const feedback = createRaceFeedback({
    player,
    audio,
    particles,
    toast: ui.toast,
    terrain: course.theme.terrain,
  });
  const itemEffects = createItemEffects(sceneState);
  const items = createRaceItems({
    racers,
    boxes,
    createEffect: itemEffects.create,
    removeEffect: itemEffects.remove,
    onHit: (...args) => session.hitRacer(...args),
    onInventory: view.syncItem,
    onCollect: feedback.collected,
    onUse: feedback.itemUsed,
    onImpact: feedback.impact,
  });
  const keys = Object.create(null);
  const pointer = { down: false, x: 0, steer: 0 };
  const clearInput = () => input.clear();
  const session = createRaceSession({
    racers,
    items,
    getPlayerInput: (raceTime) =>
      diagnostics.autodrive
        ? { ...botInput(player, 0, raceTime, racers), drift: keys[" "] || keys.shift }
        : {
            throttle: pointer.autoThrottle || keys.arrowup || keys.w,
            brake: keys.arrowdown || keys.s,
            steer:
              (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0) ||
              pointer.steer,
            drift: keys[" "] || keys.shift,
          },
    onReset() {
      clearInput();
      loop.resetTiming();
      feedback.reset();
      gameRenderer.reset();
      diagnostics.reset();
      audio.stopEngine();
      view.syncItem(player);
      gameRenderer.updateVehicle(player, player.kart, 0);
    },
    onBegin: view.begin,
    onFinish: () => view.finish(session.place(), player.finishTime),
    onPause(value) {
      clearInput();
      loop.resetTiming();
      view.pause(value);
    },
    onCountdown: view.countdown,
    onRecover() {
      feedback.recovered();
      canvas.focus({ preventScroll: true });
    },
    onHit: feedback.hit,
    onContact: feedback.contact,
    onStep: feedback.step,
    onRacerEvent(racer, events, dt) {
      feedback.racerEvent(racer, events, dt);
      diagnostics.racerEvent(racer, events);
    },
  });
  const begin = () => session.begin(benchmarkMode ? 0.01 : 3.45);
  const input = bindGameInput({
    canvas,
    keys,
    pointer,
    testMode,
    isRunning: () => session.getState().running && !session.getState().paused,
    canPause: () => session.getState().started && !session.getState().finished,
    onPause: (value = !session.getState().paused) => session.setPaused(value),
    onUseItem: () => items.fire(player),
    canRecover: () => session.getState().running && !session.getState().paused && player.speed < 12,
    onRecover: session.recoverPlayer,
  });
  const radarView = createRadar({ canvas: radar, player, bots, boxes });
  const gameRenderer = createGameRenderer({
    ...sceneState,
    theme: course.theme,
    player,
    bots,
    playerKart: player.kart,
    pads,
    boxes,
    bananas: items.bananas,
    projectiles: items.projectiles,
    particles,
    ui,
    audio,
    updateRadar: radarView.update,
    place: session.place,
    getLandscape: () => landscape,
    getFrameState: () => ({
      ...session.getState(),
      shake: feedback.getShake(),
      accumulator: loop.getAccumulator(),
    }),
  });
  scene.traverse((object) => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      installHeightHaze(material, course.theme);
      const label = `${material.name} ${material.map?.name || ""}`;
      if (
        material.userData.foliageWind ||
        /leaf|leaves|needle|flower|fern|reed|cloth|fabric|branch|foliage/i.test(label)
      )
        installFoliageWind(scene, material);
    }
  });
  sceneState.graphicsQuality.attachWorld(landscape, particles);
  const loop = createFrameLoop({
    renderer,
    camera,
    initialPixelRatio: sceneState.pixelRatio,
    benchmarkMode,
    onQualityChange: ({ tier }) => sceneState.graphicsQuality.apply(tier),
    isPaused: () => session.getState().paused,
    shouldStep: () => !diagnostics.freeze || !session.getState().running,
    step: session.step,
    render: gameRenderer.render,
    onFrame: (seconds) => diagnostics.recordFrame(seconds),
  });
  const diagnostics = createBrowserDiagnostics({
    enabled: testMode,
    benchmarkMode,
    session,
    items,
    player,
    bots,
    boxes,
    particles,
    renderer,
    camera,
    gameRenderer,
    course,
    keys,
    clearInput,
    begin,
    getPixelRatio: loop.getPixelRatio,
  });
  view.bind({
    begin,
    setPaused: session.setPaused,
    showTitle() {
      session.reset();
      view.showTitle();
    },
  });
  window.addEventListener("resize", () => {
    clearInput();
    loop.resize();
  });
  racers.forEach((racer) => gameRenderer.updateVehicle(racer, racer.kart, 0));
  view.showTitle();
  camera.position.copy(player.worldPos).addScaledVector(frameAt(0).tangent, -12);
  camera.position.y += 7;
  gameRenderer.cameraLook.copy(player.worldPos);
  camera.lookAt(gameRenderer.cameraLook);
  view.syncItem(player);
  view.ready();
  loop.start();
}

startGame().catch((error) => {
  console.error(error);
  document.getElementById("course-description").textContent =
    "The course could not load. Try again.";
  const button = document.getElementById("start-button");
  const retry = button.cloneNode(false);
  retry.disabled = false;
  retry.textContent = "RETRY COURSE";
  retry.addEventListener("click", () => location.reload());
  button.replaceWith(retry);
});
