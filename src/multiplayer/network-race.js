import { Vector3 } from "../../vendor/three/three.module.js";
import { advanceRacer } from "../simulation/simulation.js";
import { ranking } from "../simulation/race.js";
import { FIXED_DT, wrapAngle } from "../simulation/physics.js";
import { applyRacer, cleanInput, NEUTRAL_INPUT } from "./protocol.js";

/** Predict only the local kart; the room owns hits, inventory and race results. */
export function createNetworkRace({
  client,
  match,
  racers,
  boxes,
  createEffect,
  removeEffect,
  getPlayerInput,
  onBegin,
  onFinish,
  onCountdown,
  onPause,
  onRacerEvent,
  onStep,
  onInventory,
  onCollect,
  onUse,
  onImpact,
  onHit,
  hideLobby,
  onRoom = () => {},
  now = () => performance.now(),
  documentRef = document,
}) {
  const player = racers[0];
  const state = {
    elapsed: 0,
    raceTime: 0,
    running: false,
    started: false,
    finished: false,
    paused: false,
    countdown: 0,
  };
  const samples = [],
    pending = [],
    projectiles = [],
    bananas = [];
  let seq = 0,
    actionSeq = 0,
    sendClock = 0,
    latest = null,
    latestAt = 0,
    menu = false,
    lost = false;
  let finishShown = false,
    started = false;
  let interpolationDelay = 100,
    sampleTime = 0;
  let errorMessage = "",
    errorUntil = 0;
  const status = documentRef.createElement("div");
  status.className = "network-status";
  status.setAttribute("role", "status");
  documentRef.getElementById("game-shell").append(status);
  function reconcile(data) {
    const oldPosition = player.worldPos.clone(),
      oldYaw = player.yaw;
    pending.splice(
      0,
      pending.findIndex((command) => command.seq > data.ack) < 0
        ? pending.length
        : pending.findIndex((command) => command.seq > data.ack),
    );
    applyRacer(player, data);
    seq = Math.max(seq, data.ack);
    actionSeq = Math.max(actionSeq, data.actionAck || 0);
    if (state.running && !player.finished) {
      const history = pending.slice(-120);
      for (let i = 0; i < history.length; i++)
        advanceRacer(player, history[i].input, FIXED_DT, state.raceTime + i * FIXED_DT, match.laps);
    }
    const correction = oldPosition.sub(player.worldPos);
    if (!player.visualOffset) player.visualOffset = new Vector3();
    if (started && correction.length() < 8) {
      player.visualOffset.add(correction);
      player.visualYawOffset = wrapAngle((player.visualYawOffset || 0) + oldYaw - player.yaw);
    } else {
      player.visualOffset.set(0, 0, 0);
      player.visualYawOffset = 0;
    }
    player.renderFrom.copy(player.worldPos);
    player.renderYawFrom = player.yaw;
    onInventory(player);
  }
  function syncEffects(list, records, type) {
    for (let i = list.length - 1; i >= 0; i--)
      if (!records.some((record) => record.id === list[i].id)) {
        removeEffect(list[i].mesh);
        list.splice(i, 1);
      }
    for (const record of records) {
      let effect = list.find((p) => p.id === record.id);
      if (!effect) {
        effect = {
          id: record.id,
          mesh: createEffect(record.type || type),
          worldPos: new Vector3(),
        };
        list.push(effect);
      }
      const { worldPos: position, ...fields } = record;
      Object.assign(effect, fields);
      if (position) {
        if (!effect.anchor) effect.worldPos.fromArray(position);
        effect.anchor = new Vector3().fromArray(position);
      }
    }
  }
  function receive(message) {
    if (message.type === "room") {
      onRoom(message);
      return;
    }
    if (message.type === "disconnected") {
      lost = true;
      pending.length = 0;
      return;
    }
    if (message.type === "prepare") {
      if (message.matchId !== match.matchId) {
        location.reload();
        return;
      }
      lost = false;
      client.send({ type: "loaded" });
      return;
    }
    if (message.type === "error") {
      errorMessage = message.message;
      errorUntil = now() + 5000;
      return;
    }
    if (message.type !== "snapshot" || (latest && message.tick <= latest.tick)) return;
    lost = false;
    latest = message;
    latestAt = now();
    samples.push({ message, at: latestAt });
    if (samples.length > 16) samples.shift();
    Object.assign(state, message.state, { paused: false });
    const data = message.racers.find((r) => r.playerId === player.playerId);
    if (!data) return;
    reconcile(data);
    message.boxes.forEach((data, i) => Object.assign(boxes[i], data));
    syncEffects(projectiles, message.projectiles, "green");
    syncEffects(bananas, message.bananas, "banana");
    if (!started) {
      started = true;
      hideLobby();
      onBegin();
    }
    for (const event of message.events) {
      const racer = racers.find((r) => r.playerId === event.playerId);
      if (!racer) continue;
      if (event.type === "collect") onCollect(racer);
      if (event.type === "use") onUse(racer, event.item);
      if (event.type === "impact") onImpact(racer, event.message);
      if (event.type === "hit") onHit(racer);
    }
    if (data.finished && !finishShown) {
      finishShown = true;
      state.finished = true;
      onFinish();
    }
  }
  function updateOpponents(now, dt) {
    if (!samples.length) return;
    // Adaptive 100–200 ms buffer absorbs uneven arrivals; extrapolation is capped.
    const gaps = samples.slice(1).map((s, i) => Math.max(0, s.at - samples[i].at - 50));
    const delay = Math.min(200, 100 + Math.max(0, ...gaps.slice(-8)));
    interpolationDelay += (delay - interpolationDelay) * (1 - Math.exp(-2 * dt));
    const target = Math.max(
      sampleTime,
      latest.state.elapsed + (now - latestAt - interpolationDelay) / 1000,
    );
    sampleTime = target;
    let a = samples[0].message,
      b = a;
    for (const sample of samples) {
      if (sample.message.state.elapsed <= target) a = sample.message;
      if (sample.message.state.elapsed >= target) {
        b = sample.message;
        break;
      }
      b = sample.message;
    }
    const span = b.state.elapsed - a.state.elapsed;
    const blend = span > 0 ? Math.max(0, Math.min(1, (target - a.state.elapsed) / span)) : 1;
    for (const racer of racers.slice(1)) {
      const from = a.racers.find((r) => r.playerId === racer.playerId),
        to = b.racers.find((r) => r.playerId === racer.playerId);
      if (!from || !to) continue;
      racer.renderFrom.copy(racer.worldPos);
      racer.renderYawFrom = racer.yaw;
      applyRacer(racer, to);
      racer.worldPos.fromArray(from.worldPos).lerp(new Vector3().fromArray(to.worldPos), blend);
      racer.yaw = from.yaw + wrapAngle(to.yaw - from.yaw) * blend;
      racer.s = from.s + (to.s - from.s) * blend;
      if (target > b.state.elapsed && !racer.finished) {
        const extra = Math.min(0.1, target - b.state.elapsed);
        racer.worldPos.x += racer.vx * extra;
        racer.worldPos.z += racer.vz * extra;
      }
    }
  }
  function step(dt) {
    const timestamp = now();
    if (!latest) return;
    const stale =
      (!finishShown && client.room?.phase !== "results" && timestamp - latestAt > 1000) ||
      lost ||
      !client.connected;
    status.textContent =
      timestamp < errorUntil
        ? errorMessage
        : stale
          ? "Reconnecting… Your kart will resume when connected."
          : `ONLINE · ${client.latency} ms · ${match.players.length} RACERS`;
    updateOpponents(timestamp, dt);
    if (state.countdown > 0) {
      const previous = Math.ceil(state.countdown - 0.45);
      state.countdown = Math.max(0, latest.state.countdown - (timestamp - latestAt) / 1000);
      onCountdown(state.countdown, Math.ceil(state.countdown - 0.45) < previous);
    }
    if (state.running && !player.finished && !stale) {
      const input = menu ? NEUTRAL_INPUT : cleanInput(getPlayerInput(state.raceTime, racers));
      pending.push({ seq: ++seq, input });
      if (pending.length > 180) pending.shift();
      const events = advanceRacer(player, input, dt, state.raceTime, match.laps);
      // Crossing the line remains provisional until the authoritative snapshot.
      if (events.finished) {
        player.finished = false;
        player.finishTime = Infinity;
      }
      onRacerEvent(player, events, dt);
      sendClock += dt;
      if (sendClock >= 1 / 30) {
        sendClock = 0;
        client.send({ type: "input", seq, input });
      }
    }
    state.elapsed = latest.state.elapsed + Math.min(0.25, (timestamp - latestAt) / 1000);
    state.raceTime =
      latest.state.raceTime + (state.running ? Math.min(0.25, (timestamp - latestAt) / 1000) : 0);
    if (player.finished) state.raceTime = player.finishTime;
    if (player.visualOffset) player.visualOffset.multiplyScalar(Math.exp(-12 * dt));
    player.visualYawOffset = (player.visualYawOffset || 0) * Math.exp(-12 * dt);
    for (const effect of projectiles) {
      const ahead = Math.min(0.1, (timestamp - latestAt) / 1000);
      const target = effect.anchor.clone();
      target.x += effect.vx * ahead;
      target.z += effect.vz * ahead;
      effect.worldPos.lerp(target, 1 - Math.exp(-25 * dt));
    }
    onStep(dt);
  }
  const action = (action) => client.send({ type: "action", action, seq: ++actionSeq });
  return {
    activate() {
      client.subscribe(receive);
      if (client.snapshot) receive(client.snapshot);
      client.send({ type: "loaded" });
    },
    getState: () => ({ ...state, paused: menu, finished: finishShown }),
    place: () =>
      latest
        ? ranking(
            latest.racers.map((racer) => ({ ...racer, finishTime: racer.finishTime ?? Infinity })),
          ).findIndex((racer) => racer.playerId === player.playerId) + 1
        : ranking(racers).indexOf(player) + 1,
    step,
    begin: () => client.send({ type: "lobby" }),
    reset: () => {},
    setPaused(value = !menu) {
      menu = value;
      onPause(menu);
      client.send({ type: "input", seq: ++seq, input: NEUTRAL_INPUT });
    },
    recoverPlayer: () => action("recover"),
    hitRacer: () => false,
    items: { projectiles, bananas, fire: () => action("item"), reset: () => {}, setItem: () => {} },
  };
}
