import { racerProjection } from "../track/route-branches.js";
import {
  activeTrack,
  TRACK,
  RAMPS,
  frameAt,
  trackT,
  poseAt,
  yawFor,
  sectionAt,
  metresToProgress,
} from "../track/track.js";
import { scaleAt, underwaterAt, rangeFor, traversalPose } from "../simulation/course-mechanics.js";
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
          altitude: player.worldPos.y - racerProjection(activeTrack, player).height,
          routeChoice: player.routeChoice,
          lap: player.lap,
          recoveryCount: player.recoveryCount,
          position: player.worldPos.toArray(),
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
  if (enabled) {
    const receive = (event) => {
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
        const offset = Number.isFinite(message.offset)
          ? Math.max(-80, Math.min(80, message.offset))
          : 0;
        player.x = offset / 6.25;
        player.worldPos.copy(poseAt(player.s, offset, 0.065).p);
        player.renderFrom.copy(player.worldPos);
        resetMotion(player);
        const branch = activeTrack.branches[(message.branchIndex || 0) - 1];
        if (branch) {
          const q = Number.isFinite(message.q) ? Math.max(0, Math.min(1, message.q)) : 0.5;
          player.s = (branch.start + (branch.end - branch.start) * q) * TRACK;
          player.routeChoice = branch.index;
          player.routeGroup = branch.groupIndex;
          player.lastSafeRoute = branch.index;
          player.worldPos.copy(branch.poseAt(q, offset).p);
          player.renderFrom.copy(player.worldPos);
        }
        player.lastSafeS = player.s;
        resetRaceProgress(player, TRACK);
        player.yaw = yawFor(racerProjection(activeTrack, player).frame.tangent);
        player.renderYawFrom = player.yaw;
        player.speed = 0;
        player.scale = scaleAt(activeTrack, trackT(player.s));
        player.underwater = underwaterAt(activeTrack, trackT(player.s));
        const t = trackT(player.s);
        const traversalIndex = (activeTrack.course.traversals || []).findIndex((definition) => {
          const range = rangeFor(activeTrack, definition);
          return definition.kind === "cannon" && t >= range.start && t < range.end;
        });
        if (traversalIndex >= 0) {
          const definition = activeTrack.course.traversals[traversalIndex];
          const range = rangeFor(activeTrack, definition);
          const q = (t - range.start) / (range.end - range.start);
          player.traversalIndex = traversalIndex;
          player.traversalProgress = q;
          player.traversalDeparture = session.getState().raceTime - q * definition.duration;
          player.traversalOffset = 0;
          player.traversalLap = 0;
          player.grounded = false;
          player.air = 1;
          player.worldPos.copy(traversalPose(activeTrack, definition, q).p);
          player.renderFrom.copy(player.worldPos);
        }
        // A seek should show its destination before the chase camera settles.
        gameRenderer.updateVehicle(player, player.kart, 0);
        gameRenderer.reset();
        const forward = racerProjection(activeTrack, player)
          .frame.tangent.clone()
          .setY(0)
          .normalize();
        const panoramic = camera.aspect > 1.8;
        camera.position.copy(player.worldPos).addScaledVector(forward, panoramic ? -10.5 : -8.7);
        camera.position.y += 4.7;
        camera.position.y = Math.max(
          camera.position.y,
          racerProjection(activeTrack, player, camera.position).height + 2.1,
        );
        gameRenderer.cameraLook.copy(player.worldPos).addScaledVector(forward, panoramic ? 4.5 : 6);
        gameRenderer.cameraLook.y += 1.15;
        const flight = activeTrack.course.traversals?.[player.traversalIndex];
        if (flight?.kind === "cannon" && flight.straight) {
          const reveal = Math.sin((player.traversalProgress || 0) * Math.PI);
          camera.position.addScaledVector(forward, -12 * reveal);
          camera.position.y += 18 * reveal;
          gameRenderer.cameraLook.y -= 32 * reveal;
        }
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
    };
    windowRef.addEventListener("message", receive);
    // Synchronous test-only transport avoids spending bounded render frames
    // before queued postMessage seeks reach the game. Normal play exposes none.
    windowRef.__turboTrailDiagnostics = {
      send(message) {
        receive({ origin: windowRef.location.origin, source: windowRef.parent, data: message });
      },
      state: () => ({
        ...session.getState(),
        s: player?.s,
        falling: player?.falling,
        grounded: player?.grounded,
        recoveryCount: player?.recoveryCount,
        position: player?.worldPos?.toArray(),
        camera: camera?.position?.toArray(),
        kart: player?.kart?.root?.position?.toArray(),
      }),
    };
  }
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
