import { promotePointFields } from "./rendering/webgpu-points.js";
import { createSelectionStage } from "./rendering/selection-stage.js";
import * as THREE from "../vendor/three/three.module.js";
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
import { enterMultiplayer } from "./ui/multiplayer-lobby.js";
import { createNetworkRace } from "./multiplayer/network-race.js";
import { installScannedMaterials } from "./rendering/scanned-materials.js";
import { installMaterialPolish } from "./rendering/material-polish.js";
import { loadMeshLightBake, installMeshLightAttributes } from "./rendering/mesh-light-bake.js";
import { stabilizeSceneryMaterials } from "./rendering/scenery-performance.js";
import { createSceneryChunks } from "./rendering/scenery-chunks.js";

async function startGame() {
  document.getElementById("multiplayer-button").addEventListener("click", () => {
    const url = new URL(location.href);
    url.searchParams.set("mode", "multiplayer");
    location.assign(url);
  });
  const multiplayer =
    new URLSearchParams(location.search).get("mode") === "multiplayer"
      ? await enterMultiplayer()
      : null;
  const page = createGamePage(document, location, multiplayer);
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
  installScannedMaterials(scene, sceneState.fidelityAssets, course.id, landscape.animated);
  const [courseBake, meshBake] =
    course.staticBake === false
      ? [null, null]
      : await Promise.all([loadCourseBake(course.id), loadMeshLightBake(course.id)]);
  landscape.update(0, { motionEnabled: false, racers: [], bake: true });
  scene.updateMatrixWorld(true);
  scene.userData.meshLightCoverage = installMeshLightAttributes(scene, meshBake, landscape);
  installCourseBake(scene, courseBake);
  installMaterialPolish(scene);
  scene.updateMatrixWorld(true);
  promotePointFields(scene);
  await sceneState.environmentMaps.capture(scene, activeTrack);
  const racers = createRaceGrid(roster);
  if (multiplayer) {
    racers.forEach((racer, index) => {
      racer.playerId = roster[index].playerId;
      racer.name = roster[index].name;
      racer.isPlayer = racer.playerId === multiplayer.client.identity.playerId;
    });
    const localIndex = racers.findIndex((racer) => racer.isPlayer);
    racers.unshift(...racers.splice(localIndex, 1));
  }
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
  page.selection.setFeedbackHandler(() => {
    audio.start();
    audio.resume();
    audio.play("ui");
  });
  const particles = new ParticlePool(scene);
  const selectionStage = await createSelectionStage({
    canvas: document.getElementById("selection-stage"),
    models: courseAssets.models,
    environment: sharedAssets.environment,
    menu: page.selection,
  });
  const view = createRaceView({ ...page, racers, boxes, audio });
  const feedback = createRaceFeedback({
    player,
    audio,
    particles,
    toast: ui.toast,
    terrain: course.theme.terrain,
  });
  const itemEffects = createItemEffects(sceneState);
  let items = createRaceItems({
    racers,
    boxes,
    createEffect: itemEffects.create,
    removeEffect: itemEffects.remove,
    onHit: (...args) => session.hitRacer(...args),
    onInventory: view.syncItem,
    onCollect: feedback.collected,
    onRoll: feedback.rolling,
    onSelect: feedback.selected,
    onUse: feedback.itemUsed,
    onImpact: feedback.impact,
    onShellTrail: (shell) => {
      const velocity = new THREE.Vector3(-shell.vx * 0.025, 0.28, -shell.vz * 0.025);
      velocity.x += (Math.random() - 0.5) * 0.45;
      velocity.z += (Math.random() - 0.5) * 0.45;
      particles.spawn(
        shell.worldPos.clone().add(new THREE.Vector3(0, 0.12, 0)),
        "#aeb7b1",
        0.42,
        0.18 + Math.random() * 0.07,
        velocity,
      );
    },
  });
  const keys = Object.create(null);
  const pointer = { down: false, x: 0, steer: 0 };
  const clearInput = () => input.clear();
  const sessionOptions = {
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
    onFinish() {
      clearInput();
      view.finish(session.place(), player.finishTime);
      if (multiplayer) {
        ui.againButton.disabled = ui.changeCourseButton.disabled =
          multiplayer.client.room.phase !== "results";
        ui.finishCopy.textContent = "Waiting for the remaining racers to finish…";
      }
    },
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
  };
  const session = multiplayer
    ? createNetworkRace({
        ...sessionOptions,
        ...multiplayer,
        boxes,
        createEffect: itemEffects.create,
        removeEffect: itemEffects.remove,
        onInventory: view.syncItem,
        onCollect: feedback.collected,
        onRoll: feedback.rolling,
        onSelect: feedback.selected,
        onUse: feedback.itemUsed,
        onImpact: feedback.impact,
        onRoom(room) {
          ui.againButton.disabled = ui.changeCourseButton.disabled = room.phase !== "results";
          if (room.phase === "results")
            ui.finishCopy.textContent = "Race complete. Return to the room for another round.";
        },
      })
    : createRaceSession(sessionOptions);
  if (multiplayer) items = session.items;
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
    totalLaps: multiplayer?.match.laps ?? 3,
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
  const animatedScenery = [...landscape.animated, ...racers.map((racer) => racer.kart.root)];
  const materialVariants = stabilizeSceneryMaterials(scene, animatedScenery);
  const multiDraw = false;
  const chunksRequested = new URLSearchParams(location.search).get("sceneryChunks") !== "0";
  const chunkRuntime = createSceneryChunks(scene, animatedScenery, {
    supported: multiDraw && chunksRequested,
  });
  scene.userData.sceneryChunks = chunkRuntime;
  scene.userData.sceneryPerformance = {
    chunks: chunkRuntime.stats,
    multiDraw,
    materialVariants:
      materialVariants +
      (chunkRuntime.stats.chunks ? stabilizeSceneryMaterials(scene, animatedScenery) : 0),
  };
  const loop = createFrameLoop({
    renderer,
    camera,
    initialPixelRatio: sceneState.pixelRatio,
    benchmarkMode,
    onQualityChange: ({ tier }) => sceneState.graphicsQuality.apply(tier),
    isPaused: () => !multiplayer && session.getState().paused,
    shouldStep: () => !diagnostics.freeze || !session.getState().running,
    step: session.step,
    initialTier: page.selection.preferences.quality,
    adaptive: page.selection.preferences.adaptive,
    render: (dt) => {
      if (!ui.title.classList.contains("hidden")) selectionStage.update(dt);
      else gameRenderer.render(dt);
    },
    onFrame: (seconds) => diagnostics.recordFrame(seconds),
  });
  page.selection.setPreferencesHandler((preferences) => {
    sceneState.graphicsQuality.apply(preferences.quality);
    sceneState.postprocessing?.setOptions(preferences);
    gameRenderer.setOptions(preferences);
    loop.setPreferences(preferences);
    audio.setVolumes?.(preferences);
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
    scene,
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
      if (multiplayer) {
        multiplayer.client.send({ type: "lobby" });
        return;
      }
      session.reset();
      view.showTitle();
    },
  });
  window.addEventListener("resize", () => {
    clearInput();
    loop.resize();
  });
  racers.forEach((racer) => gameRenderer.updateVehicle(racer, racer.kart, 0));
  if (!multiplayer) view.showTitle();
  camera.position.copy(player.worldPos).addScaledVector(frameAt(0).tangent, -12);
  camera.position.y += 7;
  gameRenderer.cameraLook.copy(player.worldPos);
  camera.lookAt(gameRenderer.cameraLook);
  view.syncItem(player);
  view.ready();
  if (multiplayer) {
    ui.againButton.textContent = "RETURN TO ROOM";
    ui.changeCourseButton.textContent = "RETURN TO ROOM";
    document.querySelector("#pause-screen p").textContent =
      "The race continues. Your kart coasts while this menu is open.";
    document
      .querySelector("#pause-screen .pause-card")
      .insertAdjacentHTML(
        "beforeend",
        '<button id="leave-race" class="secondary-button">LEAVE RACE</button>',
      );
    document.getElementById("leave-race").onclick = () => {
      multiplayer.client.leave();
      location.assign(`${location.pathname}?mode=multiplayer`);
    };
    session.activate();
  }
  loop.start();
  if (!multiplayer && new URLSearchParams(location.search).get("race") === "1") begin();
}

startGame().catch((error) => {
  console.error(error);
  const button = document.getElementById("start-button");
  const retry = button.cloneNode(false);
  retry.disabled = false;
  retry.textContent = "RETRY COURSE";
  if (/WebGPU/i.test(error.message)) {
    const message = document.createElement("p");
    message.textContent = error.message;
    message.setAttribute("role", "alert");
    button.parentNode.insertBefore(message, button);
  }
  retry.addEventListener("click", () => location.reload());
  button.replaceWith(retry);
});
