import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createMultiplayerServer } from "../src/multiplayer/server.js";
import { packRacer, applyRacer, cleanInput } from "../src/multiplayer/protocol.js";
import { createRaceGrid } from "../src/simulation/race-grid.js";
import { createRaceSession } from "../src/simulation/race-session.js";
import { createRaceItems } from "../src/simulation/race-items.js";
import { advanceRacer, botInput } from "../src/simulation/simulation.js";
import { resolveRacerContacts } from "../src/simulation/racer-contact.js";
import { FIXED_DT } from "../src/simulation/physics.js";
import { RACERS } from "../src/rendering/racer-roster.js";
import { COURSES } from "../src/courses/registry.js";
import { selectCourse, poseAt, TRACK, laneWidth } from "../src/track/track.js";

async function setupServer(t) {
  const app = createMultiplayerServer();
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  t.after(() => app.close());
  const url = `ws://127.0.0.1:${app.server.address().port}/multiplayer`;
  async function connect() {
    const socket = new WebSocket(url),
      messages = [];
    socket.on("message", (raw) => messages.push(JSON.parse(raw)));
    await new Promise((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });
    t.after(() => socket.terminate());
    return {
      socket,
      messages,
      send: (data) => socket.send(JSON.stringify(data)),
      async wait(predicate, timeout = 7000) {
        const until = Date.now() + timeout;
        while (Date.now() < until) {
          const message = messages.find(predicate);
          if (message) return message;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.fail("Timed out waiting for room message");
      },
    };
  }
  return { app, connect };
}

test("room codes, names, readiness, host permissions, resume and disconnect handoff", async (t) => {
  const { connect } = await setupServer(t);
  const host = await connect(),
    guest = await connect();
  host.send({ type: "host", name: "Alice" });
  const welcome = await host.wait((m) => m.type === "welcome");
  assert.match(welcome.code, /^[0-9A-F]{6}$/);
  guest.send({ type: "join", code: "XXXXXX", name: "Bob" });
  await guest.wait((m) => m.type === "error" && m.message.includes("not found"));
  guest.send({ type: "join", code: welcome.code.toLowerCase(), name: "Bob" });
  const guestIdentity = await guest.wait((m) => m.type === "welcome");
  await host.wait((m) => m.type === "room" && m.players.length === 2);
  guest.send({ type: "select", course: COURSES[1].id, laps: 1, racer: "konqi" });
  const deniedSettings = await guest.wait(
    (m) => m.type === "room" && m.players.some((p) => p.id === "konqi"),
  );
  assert.equal(deniedSettings.course, COURSES[0].id);
  assert.equal(deniedSettings.laps, 3);
  guest.send({ type: "start" });
  await guest.wait((m) => m.type === "error" && m.message.includes("Only the host"));
  host.send({ type: "start" });
  await host.wait((m) => m.type === "error" && m.message.includes("ready"));
  host.socket.close();
  const handedOff = await guest.wait((m) => m.type === "room" && m.host === guestIdentity.playerId);
  assert.equal(handedOff.players.find((p) => p.playerId === welcome.playerId).connected, false);
  const resumed = await connect();
  resumed.send({ type: "resume", code: welcome.code, token: welcome.token });
  const identity = await resumed.wait((m) => m.type === "welcome");
  assert.equal(identity.playerId, welcome.playerId);
  assert.equal((await resumed.wait((m) => m.type === "room")).players.length, 2);
  const impostor = await connect();
  impostor.send({ type: "resume", code: welcome.code, token: "wrong" });
  await impostor.wait((m) => m.type === "error" && m.message.includes("expired"));
});

test("real sockets share countdown, authoritative movement, stale-input braking, and isolated courses", async (t) => {
  const { connect } = await setupServer(t);
  const host = await connect(),
    guest = await connect(),
    other = await connect(),
    rival = await connect();
  host.send({ type: "host", name: "A" });
  other.send({ type: "host", name: "C" });
  const identity = await host.wait((m) => m.type === "welcome"),
    second = await other.wait((m) => m.type === "welcome");
  guest.send({ type: "join", code: identity.code, name: "B" });
  rival.send({ type: "join", code: second.code, name: "D" });
  await guest.wait((m) => m.type === "welcome");
  await rival.wait((m) => m.type === "welcome");
  host.send({ type: "select", course: COURSES[1].id, laps: 1 });
  other.send({ type: "select", course: COURSES[3].id, laps: 3 });
  for (const c of [host, guest, other, rival]) c.send({ type: "ready", ready: true });
  await host.wait(
    (m) => m.type === "room" && m.players.length === 2 && m.players.every((p) => p.ready),
  );
  await other.wait(
    (m) => m.type === "room" && m.players.length === 2 && m.players.every((p) => p.ready),
  );
  host.send({ type: "start" });
  other.send({ type: "start" });
  const match = await host.wait((m) => m.type === "prepare"),
    otherMatch = await other.wait((m) => m.type === "prepare");
  assert.equal(match.course, COURSES[1].id);
  assert.equal(match.laps, 1);
  assert.equal(otherMatch.course, COURSES[3].id);
  assert.equal(otherMatch.laps, 3);
  host.send({ type: "loaded" });
  await new Promise((resolve) => setTimeout(resolve, 70));
  assert.equal(
    host.messages.some((m) => m.type === "snapshot"),
    false,
    "wait for every client to load",
  );
  for (const c of [guest, other, rival]) c.send({ type: "loaded" });
  const countdown = await host.wait((m) => m.type === "snapshot");
  assert.equal(countdown.state.running, false);
  const mirrored = await guest.wait((m) => m.type === "snapshot" && m.tick === countdown.tick);
  assert.deepEqual(mirrored.racers, countdown.racers);
  const running = await host.wait((m) => m.type === "snapshot" && m.state.running);
  host.send({ type: "input", seq: 1, input: { throttle: true, steer: 0 } });
  const moved = await host.wait(
    (m) => m.type === "snapshot" && m.tick > running.tick && m.racers[0].speed > 2,
  );
  assert.equal(moved.racers[0].ack, 1);
  assert.equal(moved.racers[1].speed, 0, "human guest never becomes a bot");
  host.send({ type: "input", seq: 0, input: { throttle: true, steer: 1 } });
  const later = await host.wait((m) => m.type === "snapshot" && m.state.raceTime > 1);
  assert.equal(later.racers[0].ack, 1);
  const peak = Math.max(
    ...host.messages.filter((m) => m.type === "snapshot").map((m) => m.racers[0].speed),
  );
  assert.ok(later.racers[0].speed < peak, "old held throttle expires after 500ms");
  const otherRunning = await other.wait((m) => m.type === "snapshot" && m.state.running);
  assert.notDeepEqual(otherRunning.racers[0].worldPos, running.racers[0].worldPos);
  host.send({ type: "action", action: "item", seq: 1 });
  const emptyUse = await host.wait((m) => m.type === "snapshot" && m.racers[0].actionAck === 1);
  assert.equal(emptyUse.projectiles.length, 0);
  const resume = await connect();
  host.socket.close();
  resume.send({ type: "resume", code: identity.code, token: identity.token });
  await resume.wait((m) => m.type === "prepare");
  resume.send({ type: "loaded" });
  const continued = await resume.wait((m) => m.type === "snapshot" && m.tick > emptyUse.tick);
  assert.equal(continued.racers[0].playerId, identity.playerId);
});

test("wire snapshots retain motion and inventory, never meshes; hostile controls are clamped", () => {
  const [racer] = createRaceGrid(RACERS);
  racer.item = "mushroom";
  racer.itemCount = 3;
  racer.kart = { circular: racer };
  const packed = JSON.parse(JSON.stringify(packRacer(racer)));
  assert.equal(packed.kart, undefined);
  assert.equal(packed.renderFrom, undefined);
  const [replica] = createRaceGrid(RACERS);
  applyRacer(replica, packed);
  assert.deepEqual(replica.worldPos.toArray(), racer.worldPos.toArray());
  assert.equal(replica.itemCount, 3);
  assert.equal(replica.finishTime, Infinity);
  assert.deepEqual(cleanInput({ throttle: "yes", brake: true, steer: Infinity }), {
    throttle: false,
    brake: true,
    drift: false,
    steer: 0,
  });
  assert.equal(cleanInput({ steer: -40 }).steer, -1);
});

test("one and three lap races require ordered checkpoints on every course", () => {
  for (const course of COURSES) {
    selectCourse(course);
    for (const laps of [1, 3]) {
      const [racer] = createRaceGrid(RACERS);
      const deadline = Math.ceil((laps * 135) / FIXED_DT);
      for (let tick = 0; tick < deadline && !racer.finished; tick++) {
        const time = tick * FIXED_DT;
        advanceRacer(racer, botInput(racer, 0, time), FIXED_DT, time, laps);
      }
      assert.ok(racer.finished, `${course.id}: ${laps} laps finish`);
      assert.ok(racer.s >= TRACK * laps);
      assert.ok(Number.isFinite(racer.finishTime));
    }
  }
});

test("multiplayer session keeps racing after first finisher and uses human controls", () => {
  selectCourse(COURSES[0]);
  const racers = createRaceGrid(RACERS.slice(0, 2));
  const session = createRaceSession({
    racers,
    items: { reset() {}, step() {} },
    getPlayerInput: () => ({ throttle: false }),
    getRacerInput: () => ({ throttle: true }),
    stopOnPlayerFinish: false,
    totalLaps: 1,
  });
  session.begin(0.001);
  session.step(FIXED_DT);
  racers[0].finished = true;
  for (let i = 0; i < 30; i++) session.step(FIXED_DT);
  assert.equal(session.getState().running, true);
  assert.ok(racers[1].speed > 0);
  session.recoverPlayer(racers[1]);
  assert.equal(racers[1].speed, 0);
});

test("shared shell, banana, star and mushroom rules synchronize damage and contact", () => {
  selectCourse(COURSES[0]);
  const racers = createRaceGrid(RACERS.slice(0, 2));
  const [owner, target] = racers;
  const hits = [];
  let session;
  const items = createRaceItems({
    racers,
    boxes: [],
    createEffect: () => ({}),
    removeEffect() {},
    onHit: (...args) => session.hitRacer(...args),
  });
  session = createRaceSession({
    racers,
    items,
    getPlayerInput: () => ({}),
    onHit: (racer) => hits.push(racer),
  });
  function clearHits() {
    target.spin = target.invulnerable = target.star = 0;
  }
  // Green and red shells use swept collision on the server.
  for (const kind of ["green", "red"]) {
    clearHits();
    target.s = 50;
    items.setItem(owner, kind);
    items.fire(owner);
    const shell = items.projectiles.at(-1);
    target.worldPos.copy(shell.worldPos);
    target.worldPos.y -= 0.6;
    items.step(FIXED_DT, 0);
    assert.ok(target.spin > 0, kind);
    assert.equal(items.projectiles.length, 0);
  }
  clearHits();
  items.setItem(owner, "banana");
  items.fire(owner);
  const banana = items.bananas[0];
  target.s = banana.s;
  target.x = banana.x;
  target.grounded = true;
  target.worldPos.copy(poseAt(target.s, laneWidth(target.x), 0.065).p);
  items.step(FIXED_DT, 0);
  assert.ok(target.spin > 0);
  items.setItem(owner, "mushroom");
  for (let i = 0; i < 3; i++) items.fire(owner);
  assert.equal(owner.itemCount, 0);
  assert.ok(owner.boost > 2);
  clearHits();
  items.setItem(owner, "star");
  items.fire(owner);
  target.worldPos.copy(owner.worldPos);
  target.vx = target.vz = 0;
  resolveRacerContacts(racers, { hitRacer: session.hitRacer, onContact() {} });
  assert.ok(target.spin > 0);
  assert.ok(owner.star > 0);
  assert.ok(owner.worldPos.distanceTo(target.worldPos) >= 1.94);
  assert.equal(session.hitRacer(owner), false);
  assert.equal(hits.length, 4);
});
