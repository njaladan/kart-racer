import test from "node:test";
import assert from "node:assert/strict";
import { createNetworkRace } from "../src/multiplayer/network-race.js";
import { packRacer } from "../src/multiplayer/protocol.js";
import { createRaceGrid } from "../src/simulation/race-grid.js";
import { createRaceSession } from "../src/simulation/race-session.js";
import { RACERS } from "../src/rendering/racer-roster.js";
import { DEFAULT_COURSE } from "../src/courses/registry.js";
import { selectCourse } from "../src/track/track.js";
import { botInput } from "../src/simulation/simulation.js";
import { FIXED_DT } from "../src/simulation/physics.js";

function harness(callbacks = {}) {
  selectCourse(DEFAULT_COURSE);
  const authoritative = createRaceGrid(RACERS.slice(0, 2));
  const local = createRaceGrid(RACERS.slice(0, 2));
  for (const grid of [authoritative, local])
    grid.forEach((racer, index) => {
      racer.playerId = String(index);
    });
  let clock = 0,
    receive;
  const outgoing = [],
    statuses = [];
  const client = {
    connected: true,
    latency: 180,
    send: (message) => {
      outgoing.push({ message, at: clock });
      return true;
    },
    subscribe: (listener) => {
      receive = listener;
    },
  };
  const defaults = Object.fromEntries(
    [
      "onBegin",
      "onFinish",
      "onCountdown",
      "onPause",
      "onRacerEvent",
      "onStep",
      "onInventory",
      "onCollect",
      "onUse",
      "onImpact",
      "onHit",
      "hideLobby",
    ].map((name) => [name, () => {}]),
  );
  const effectsRemoved = [];
  const network = createNetworkRace({
    client,
    match: { matchId: "match", players: RACERS.slice(0, 2), laps: 1 },
    racers: local,
    boxes: [],
    createEffect: (type) => ({ type }),
    removeEffect: (mesh) => effectsRemoved.push(mesh),
    getPlayerInput: () => botInput(local[0], 0, clock / 1000),
    ...defaults,
    ...callbacks,
    now: () => clock,
    documentRef: {
      createElement: () => ({ setAttribute() {} }),
      getElementById: () => ({ append: (node) => statuses.push(node) }),
    },
  });
  network.activate();
  return {
    authoritative,
    local,
    network,
    client,
    outgoing,
    effectsRemoved,
    setTime: (value) => {
      clock = value;
    },
    receive: (message) => receive(message),
    snapshot(tick, ack = 0, overrides = {}) {
      return {
        type: "snapshot",
        tick,
        state: {
          elapsed: tick * FIXED_DT,
          raceTime: tick * FIXED_DT,
          running: true,
          started: true,
          paused: false,
          finished: false,
          countdown: 0,
        },
        racers: authoritative.map((racer) => ({ ...packRacer(racer), ack, actionAck: 0 })),
        boxes: [],
        projectiles: [],
        bananas: [],
        events: [],
        ...overrides,
      };
    },
  };
}

test("authoritative lottery state and distinct box events reach the local player once", () => {
  const events = [];
  const h = harness({
    onCollect: (racer, awarded) => events.push(["collect", racer, awarded]),
    onRoll: (racer, tick) => events.push(["roll", racer, tick]),
    onSelect: (racer) => events.push(["select", racer]),
  });
  const player = h.authoritative[0];
  player.itemRoulette = 1.5;
  player.itemPreview = "star";
  const first = h.snapshot(1, 0, {
    events: [
      { type: "collect", playerId: "0", awarded: true },
      { type: "roll", playerId: "0", tick: 0 },
      { type: "collect", playerId: "0", awarded: false },
    ],
  });
  h.receive(first);
  h.receive(first);
  assert.equal(h.local[0].itemRoulette, 1.5);
  assert.equal(h.local[0].itemPreview, "star");
  assert.deepEqual(
    events.map((e) => [e[0], e[2]]),
    [
      ["collect", true],
      ["roll", 0],
      ["collect", false],
    ],
  );
  player.itemRoulette = 0;
  player.itemPreview = null;
  player.item = "mushroom";
  player.itemCount = 3;
  h.receive(h.snapshot(2, 0, { events: [{ type: "select", playerId: "0" }] }));
  assert.equal(h.local[0].item, "mushroom");
  assert.equal(h.local[0].itemCount, 3);
  assert.deepEqual(events.at(-1), ["select", h.local[0]]);
});

test("prediction responds before round trip and reconciliation stays continuous with latency, jitter and missed snapshots", () => {
  const h = harness();
  let held = {},
    ack = 0,
    lastDelivery = 0,
    maxOffset = 0,
    maxStep = 0,
    maxCorrectionJump = 0;
  const deliveries = [];
  const session = createRaceSession({
    racers: h.authoritative,
    items: { reset() {}, step() {} },
    getPlayerInput: () => held,
    getRacerInput: (racer) => botInput(racer, 1, session.getState().raceTime),
    stopOnPlayerFinish: false,
    totalLaps: 1,
  });
  session.begin(0.001);
  session.step(FIXED_DT);
  h.receive(h.snapshot(0));
  let oldVisual = h.local[0].worldPos.clone(),
    earlySpeed = 0;
  for (let tick = 1; tick <= 120 * 8; tick++) {
    const time = tick * FIXED_DT * 1000;
    h.setTime(time);
    for (let i = deliveries.length - 1; i >= 0; i--) {
      const delivery = deliveries[i];
      if (delivery.at > time) continue;
      deliveries.splice(i, 1);
      if (delivery.type === "input") {
        held = delivery.message.input;
        ack = delivery.message.seq;
      } else {
        const before = h.local[0].worldPos.clone().add(h.local[0].visualOffset);
        h.receive(delivery.message);
        const after = h.local[0].worldPos.clone().add(h.local[0].visualOffset);
        maxCorrectionJump = Math.max(maxCorrectionJump, before.distanceTo(after));
      }
    }
    session.step(FIXED_DT);
    if (tick % 6 === 0 && tick % 42 !== 0) {
      const jitter = ((tick * 31) % 70) - 20;
      const at = Math.max(lastDelivery + 1, time + 80 + jitter);
      lastDelivery = at;
      deliveries.push({
        type: "snapshot",
        at,
        message: h.snapshot(tick, ack, { state: session.getState() }),
      });
    }
    h.network.step(FIXED_DT);
    for (const record of h.outgoing.splice(0))
      if (record.message.type === "input")
        deliveries.push({ type: "input", at: time + 80 + (tick % 5) * 8, message: record.message });
    const visual = h.local[0].worldPos.clone().add(h.local[0].visualOffset);
    maxStep = Math.max(maxStep, visual.distanceTo(oldVisual));
    oldVisual = visual;
    maxOffset = Math.max(maxOffset, h.local[0].visualOffset.length());
    if (tick === 9) {
      earlySpeed = h.local[0].speed;
      assert.equal(h.authoritative[0].speed, 0);
    }
    assert.ok(Number.isFinite(h.local[0].worldPos.x));
  }
  assert.ok(earlySpeed > 1, "local acceleration precedes the first delayed input");
  assert.ok(
    maxCorrectionJump < 0.000001,
    `snapshot never teleports the visual kart (${maxCorrectionJump})`,
  );
  assert.ok(maxOffset < 3, `bounded reconciliation offset (${maxOffset})`);
  assert.ok(maxStep < 0.6, `bounded per-frame motion (${maxStep})`);
});

test("remote interpolation unwraps heading and stalls rather than extrapolating indefinitely", () => {
  const h = harness();
  h.authoritative[1].yaw = Math.PI - 0.02;
  h.receive(h.snapshot(0));
  h.setTime(200);
  h.authoritative[1].yaw = -Math.PI + 0.02;
  h.receive(h.snapshot(24));
  h.setTime(208);
  h.network.step(FIXED_DT);
  assert.ok(Math.abs(h.local[1].yaw) > 3, "use shortest angle across the wrap");
  h.authoritative[1].vx = 20;
  h.setTime(400);
  h.receive(h.snapshot(48));
  h.setTime(1200);
  h.network.step(FIXED_DT);
  const capped = h.local[1].worldPos.clone();
  h.setTime(4000);
  h.network.step(FIXED_DT);
  assert.ok(h.local[1].worldPos.distanceTo(capped) < 0.000001, "100ms extrapolation cap");
});

test("items have persistent effect meshes; server events and finishes fire once; reconnect keeps action sequence", () => {
  let hits = 0,
    finishes = 0,
    steps = 0;
  const h = harness({ onHit: () => hits++, onFinish: () => finishes++, onStep: () => steps++ });
  const effects = {
    projectiles: [{ id: 1, type: "red", worldPos: [0, 1, 0], vx: 20, vz: 0, yaw: 0 }],
    bananas: [{ id: 2, s: 0, x: 0 }],
  };
  h.receive(h.snapshot(1, 0, { ...effects, events: [{ type: "hit", playerId: "0" }] }));
  const mesh = h.network.items.projectiles[0].mesh;
  h.receive(h.snapshot(2, 0, effects));
  assert.equal(h.network.items.projectiles[0].mesh, mesh);
  assert.equal(hits, 1);
  h.network.setPaused(true);
  h.network.step(FIXED_DT);
  assert.equal(h.network.getState().paused, true);
  assert.equal(steps, 1);
  h.receive({ type: "disconnected" });
  h.receive({ type: "prepare", matchId: "match" });
  h.authoritative[0].finished = true;
  h.authoritative[0].finishTime = 1.5;
  const snapshot = h.snapshot(3);
  snapshot.racers[0].actionAck = 10;
  h.receive(snapshot);
  h.receive(snapshot);
  assert.equal(h.effectsRemoved.length, 2);
  assert.equal(finishes, 1);
  h.network.items.fire();
  assert.equal(h.outgoing.at(-1).message.seq, 11);
  assert.ok(h.outgoing.some((record) => record.message.type === "loaded"));
});

test("an authoritative recovery clears visual correction instead of sliding across the drop", () => {
  let recoveries = 0;
  const h = harness({ onRecover: () => recoveries++ });
  h.receive(h.snapshot(0));
  h.local[0].worldPos.y -= 3;
  h.local[0].visualOffset.set(1, 0, 0);
  h.authoritative[0].recoveryCount = 1;
  h.receive(h.snapshot(1));
  assert.equal(h.local[0].recoveryCount, 1);
  assert.equal(h.local[0].visualOffset.length(), 0);
  assert.equal(h.local[0].visualYawOffset, 0);
  assert.equal(recoveries, 1);
  assert.ok(h.local[0].renderFrom.distanceTo(h.local[0].worldPos) < 1e-9);
});
