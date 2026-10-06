import {
  TRACK,
  RAMPS,
  frameAt,
  trackT,
  poseAt,
  yawFor,
  sectionAt,
  projectTrack,
  metresToProgress,
} from "../track/track.js";
import { FIXED_DT, resetMotion } from "../simulation/physics.js";
import { resetRaceProgress } from "../simulation/race.js";

/** Same-origin browser test protocol. Inert unless the URL enables test mode. */
export function createBrowserDiagnostics({
  enabled,
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
  course: chosenCourse,
  keys,
  clearInput,
  begin,
  getPixelRatio,
  windowRef = window,
}) {
  let testAutodrive = false,
    testFreeze = false;
  let testTricks = { started: 0, landed: 0 };
  const testFrameStats = { frames: 0, total: 0, max: 0 };
  const { projectiles, bananas } = items;
  function reportTestState() {
    const { running, paused, finished, countdown, raceTime } = session.getState();
    windowRef.parent.postMessage(
      {
        type: "racer-state",
        running,
        paused,
        finished,
        countdown,
        raceTime,
        rank: session.place(),
        player: {
          racer: player.racerId,
          section: sectionAt(trackT(player.s)).id,
          s: player.s,
          x: player.x,
          speed: player.speed,
          item: player.item,
          itemCount: player.itemCount,
          grounded: player.grounded,
          altitude: player.worldPos.y - projectTrack(player.worldPos, player.s).height,
          airTime: player.airTime,
          drift: player.drift,
          boost: player.boost,
          driftBoost: player.driftBoost,
          trickActive: player.trickActive,
          spin: player.spin,
        },
        course: chosenCourse.id,
        section: sectionAt(trackT(player.s)).id,
        tricks: testTricks,
        pickups: {
          total: boxes.length,
          active: boxes.filter((b) => b.active).length,
        },
        projectiles: projectiles.length,
        camera: { driftEffect: gameRenderer.getDriftCamera(), fov: camera.fov },
        bots: bots.map((b) => ({ racer: b.racerId, s: b.s, finished: b.finished })),
        effects: particles.count + bananas.length + projectiles.length,
        render: {
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          pixelRatio: getPixelRatio(),
          particles: particles.count,
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          fps: testFrameStats.frames / Math.max(0.01, testFrameStats.total),
          maxFrame: testFrameStats.max,
        },
      },
      windowRef.location.origin,
    );
  }
  if (enabled)
    windowRef.addEventListener("message", (event) => {
      if (
        event.origin !== windowRef.location.origin ||
        event.source !== windowRef.parent ||
        typeof event.data?.type !== "string" ||
        !event.data.type.startsWith("test-")
      )
        return;
      const message = event.data;
      const { running, started, finished, paused } = session.getState();
      if (message.type === "test-start") begin();
      if (message.type === "test-ramp" && running) {
        player.s = RAMPS[0].t * TRACK - metresToProgress(14);
        player.x = 0;
        player.worldPos.copy(poseAt(player.s, 0, 0.065).p);
        player.renderFrom.copy(player.worldPos);
        resetMotion(player);
        resetRaceProgress(player, TRACK);
        player.yaw = yawFor(frameAt(trackT(player.s)).tangent);
        player.renderYawFrom = player.yaw;
        player.vx = -Math.sin(player.yaw) * 35;
        player.vz = -Math.cos(player.yaw) * 35;
        player.boost = 1.5;
        player.star = 0;
        testAutodrive = true;
      }
      if (message.type === "test-seek" && running && Number.isFinite(message.t)) {
        player.s = Math.max(0, Math.min(0.999, message.t)) * TRACK;
        player.x = 0;
        player.worldPos.copy(poseAt(player.s, 0, 0.065).p);
        player.renderFrom.copy(player.worldPos);
        resetMotion(player);
        resetRaceProgress(player, TRACK);
        player.yaw = yawFor(frameAt(trackT(player.s)).tangent);
        player.renderYawFrom = player.yaw;
        player.speed = 0;
        // A seek should show its destination before the chase camera settles.
        gameRenderer.updateVehicle(player, player.kart, 0);
        gameRenderer.reset();
        const forward = frameAt(trackT(player.s)).tangent.clone().setY(0).normalize();
        const panoramic = camera.aspect > 1.8;
        camera.position.copy(player.worldPos).addScaledVector(forward, panoramic ? -10.5 : -8.7);
        camera.position.y += 4.7;
        camera.position.y = Math.max(
          camera.position.y,
          projectTrack(camera.position, player.s).height + 2.1,
        );
        gameRenderer.cameraLook.copy(player.worldPos).addScaledVector(forward, panoramic ? 4.5 : 6);
        gameRenderer.cameraLook.y += 1.15;
        camera.lookAt(gameRenderer.cameraLook);
      }
      if (message.type === "test-step" && started && !finished && !paused) {
        const seconds = Math.max(0, Math.min(5, Number(message.seconds) || 0));
        for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) session.step(FIXED_DT);
        reportTestState();
      }
      if (message.type === "test-report") reportTestState();
      if (message.type === "test-auto") testAutodrive = !!message.value;
      if (message.type === "test-freeze" && benchmarkMode) testFreeze = !!message.value;
      if (message.type === "test-input") {
        clearInput();
        for (const key of message.keys || []) keys[key] = true;
      }
      if (message.type === "test-pause") session.setPaused(!!message.value);
      if (
        message.type === "test-item" &&
        ["mushroom", "star", "red", "green", "banana"].includes(message.item)
      )
        items.setItem(player, message.item);
      if (message.type === "test-fire" && running && !paused) items.fire(player);
      if (message.type === "test-hit") session.hitRacer(player);
    });
  return {
    get autodrive() {
      return testAutodrive;
    },
    get freeze() {
      return testFreeze;
    },
    reset() {
      testTricks = { started: 0, landed: 0 };
    },
    racerEvent(racer, events) {
      if (!enabled || racer !== player) return;
      testTricks.started += !!events.trickStarted;
      testTricks.landed += !!events.trickLanded;
    },
    recordFrame(seconds) {
      if (!enabled) return;
      testFrameStats.frames++;
      testFrameStats.total += seconds;
      testFrameStats.max = Math.max(testFrameStats.max, seconds);
      if (testFrameStats.frames % 6 === 0) reportTestState();
    },
  };
}
