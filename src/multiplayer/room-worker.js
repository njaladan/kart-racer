import { parentPort, workerData } from "node:worker_threads";
import { performance } from "node:perf_hooks";
import { selectCourse, ITEM_ROW_DEFINITIONS, TRACK } from "../track/track.js";
import { findCourseById } from "../courses/registry.js";
import { createRaceGrid } from "../simulation/race-grid.js";
import { createRaceSession } from "../simulation/race-session.js";
import { createRaceItems } from "../simulation/race-items.js";
import { FIXED_DT } from "../simulation/physics.js";
import { packRacer, cleanInput, NEUTRAL_INPUT } from "./protocol.js";

// Track selection is module state. Each room gets its own isolated worker.
selectCourse(findCourseById(workerData.course));
const racers = createRaceGrid(workerData.players);
const inputs = new Map();
const ready = new Set();
const disconnected = new Set();
let nextEffect = 0,
  tick = 0,
  started = false,
  finishAt = null;
const events = [];
for (let index = 0; index < racers.length; index++) {
  const racer = racers[index];
  racer.playerId = workerData.players[index].playerId;
  racer.name = workerData.players[index].name;
  inputs.set(racer.playerId, { seq: 0, input: NEUTRAL_INPUT, at: 0, action: 0 });
}
const boxes = ITEM_ROW_DEFINITIONS.flatMap((row) =>
  (row.offsets || [-0.58, 0, 0.58]).map((offset) => ({
    s: row.t * TRACK,
    x: row.offsets ? offset / 6.25 : offset,
    active: true,
    respawn: 0,
  })),
);
const event = (type, racer, extra = {}) =>
  events.push({ type, playerId: racer.playerId, ...extra });
const items = createRaceItems({
  racers,
  boxes,
  createEffect: () => ++nextEffect,
  removeEffect: () => {},
  onHit: (...args) => session.hitRacer(...args),
  onCollect: (racer) => event("collect", racer),
  onUse: (racer, item) => event("use", racer, { item }),
  onImpact: (racer, message) => event("impact", racer, { message }),
});
function inputFor(racer) {
  const held = inputs.get(racer.playerId);
  return performance.now() - held.at > 500 || disconnected.has(racer.playerId)
    ? NEUTRAL_INPUT
    : held.input;
}
const session = createRaceSession({
  racers,
  items,
  getPlayerInput: () => inputFor(racers[0]),
  getRacerInput: inputFor,
  totalLaps: workerData.laps,
  stopOnPlayerFinish: false,
  onHit: (racer) => event("hit", racer),
});
function snapshot() {
  parentPort.postMessage({
    type: "snapshot",
    tick,
    state: session.getState(),
    racers: racers.map((racer) => ({
      ...packRacer(racer),
      ack: inputs.get(racer.playerId).seq,
      actionAck: inputs.get(racer.playerId).action,
    })),
    boxes: boxes.map((box) => ({ active: box.active, respawn: box.respawn })),
    projectiles: items.projectiles.map((p) => ({
      id: p.mesh,
      type: p.type,
      worldPos: p.worldPos.toArray(),
      yaw: p.yaw,
      vx: p.vx,
      vz: p.vz,
    })),
    bananas: items.bananas.map((p) => ({
      id: p.mesh,
      s: p.s,
      x: p.x,
      routeChoice: p.routeChoice,
      fixedPosition: p.fixedPosition,
      worldPos: p.worldPos?.toArray(),
    })),
    events: events.splice(0),
  });
}
parentPort.on("message", (message) => {
  const racer = racers.find((r) => r.playerId === message.playerId);
  if (!racer) return;
  const held = inputs.get(racer.playerId);
  if (message.type === "ready") {
    ready.add(racer.playerId);
    disconnected.delete(racer.playerId);
    if (started) snapshot();
  }
  if (message.type === "disconnect") {
    disconnected.add(racer.playerId);
    held.input = NEUTRAL_INPUT;
  }
  if (message.type === "input" && Number.isSafeInteger(message.seq) && message.seq > held.seq) {
    held.seq = message.seq;
    held.input = cleanInput(message.input);
    held.at = performance.now();
  }
  if (message.type === "action" && Number.isSafeInteger(message.seq) && message.seq > held.action) {
    held.action = message.seq;
    if (!session.getState().running || racer.finished || disconnected.has(racer.playerId)) return;
    if (message.action === "item") items.fire(racer);
    if (message.action === "recover" && racer.speed < 12) session.recoverPlayer(racer);
  }
});
let last = performance.now(),
  accumulator = 0;
const loadingAt = last;
const timer = setInterval(() => {
  const now = performance.now();
  accumulator += Math.min(0.25, (now - last) / 1000);
  last = now;
  if (!started) {
    if (ready.size === racers.length) {
      started = true;
      session.begin();
    } else if (now - loadingAt > 90000) {
      parentPort.postMessage({ type: "load-failed" });
      clearInterval(timer);
    }
    accumulator = 0;
    return;
  }
  while (accumulator >= FIXED_DT) {
    session.step(FIXED_DT);
    accumulator -= FIXED_DT;
    tick++;
    if (tick % 6 === 0) snapshot();
  }
  if (finishAt === null && racers.some((r) => r.finished)) finishAt = now;
  const active = racers.filter((r) => !disconnected.has(r.playerId));
  if (
    (active.length > 0 && active.every((r) => r.finished)) ||
    (finishAt !== null && now - finishAt > 60000) ||
    now - loadingAt > 15 * 60000
  ) {
    for (const racer of racers) {
      if (!racer.finished) {
        racer.finished = true;
        racer.dnf = true;
      }
    }
    snapshot();
    parentPort.postMessage({ type: "race-ended" });
    clearInterval(timer);
  }
}, 4);
