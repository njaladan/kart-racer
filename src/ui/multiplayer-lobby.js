import { RACERS } from "../rendering/racer-roster.js";
import { COURSES } from "../courses/registry.js";
import { createRoomClient } from "../multiplayer/client.js";

export function enterMultiplayer() {
  document.getElementById("title-screen").classList.add("hidden");
  const screen = document.createElement("section");
  screen.id = "multiplayer-screen";
  screen.className = "screen multiplayer-screen";
  screen.innerHTML = `<div class="lobby-card">
    <div class="eyebrow">FRIENDS ON THE STARTING GRID</div>
    <h2>MULTI<em>PLAYER.</em></h2>
    <p id="room-status" role="status">Connecting…</p>
    <div id="room-entry">
      <label class="course-picker">YOUR NAME<input id="room-name" maxlength="20" autocomplete="nickname" placeholder="Racer name"></label>
      <button id="host-room" class="primary-button">HOST A ROOM <span>↗</span></button>
      <div class="join-row"><input id="room-code-input" maxlength="6" autocomplete="off" placeholder="ROOM CODE" aria-label="Room code"><button id="join-room" class="secondary-button">JOIN ROOM</button></div>
    </div>
    <div id="room-lobby" hidden>
      <div class="room-share"><span>ROOM CODE</span><strong id="room-code"></strong><button id="copy-room" class="secondary-button">COPY INVITE</button></div>
      <ul id="room-players" aria-label="Racers in room"></ul>
      <label class="course-picker">YOUR CHARACTER<select id="room-racer"></select></label>
      <div class="race-pickers"><label class="course-picker">COURSE<select id="room-course"></select></label><label class="course-picker">LAPS<select id="room-laps"><option value="1">1 lap · Sprint</option><option value="3" selected>3 laps · Grand Prix</option></select></label></div>
      <p id="host-hint">The host chooses the course and race length.</p>
      <button id="room-ready" class="primary-button">READY UP</button>
      <button id="room-start" class="secondary-button">START RACE</button>
      <button id="leave-room" class="secondary-button">LEAVE ROOM</button>
    </div>
    <p id="room-error" role="alert"></p>
    <button id="back-single" class="secondary-button">SINGLE PLAYER</button>
  </div>`;
  document.getElementById("game-shell").append(screen);
  const get = (id) => document.getElementById(id);
  const status = get("room-status"),
    error = get("room-error");
  const client = createRoomClient({
    onStatus: (text) => {
      status.textContent = text;
    },
  });
  const send = (message) => {
    error.textContent = "";
    if (!client.send(message)) error.textContent = "Still connecting. Try again in a moment.";
  };
  for (const [id, entries] of [
    ["room-racer", RACERS],
    ["room-course", COURSES],
  ]) {
    for (const entry of entries) {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.name;
      get(id).append(option);
    }
  }
  get("room-name").value = localStorage.getItem("turbo-name") || "";
  get("room-code-input").value = new URLSearchParams(location.search).get("room") || "";
  const join = (type) => {
    const name = get("room-name").value.trim();
    if (!name) {
      error.textContent = "Enter your racer name first.";
      get("room-name").focus();
      return;
    }
    localStorage.setItem("turbo-name", name);
    send({ type, name, code: get("room-code-input").value });
  };
  get("host-room").onclick = () => join("host");
  get("join-room").onclick = () => join("join");
  get("room-code-input").onkeydown = (event) => {
    if (event.key === "Enter") join("join");
  };
  get("room-racer").onchange = () => send({ type: "select", racer: get("room-racer").value });
  const settings = () =>
    send({
      type: "select",
      course: get("room-course").value,
      laps: Number(get("room-laps").value),
    });
  get("room-course").onchange = settings;
  get("room-laps").onchange = settings;
  get("room-ready").onclick = () =>
    send({
      type: "ready",
      ready: !client.room?.players.find((p) => p.playerId === client.identity?.playerId)?.ready,
    });
  get("room-start").onclick = () => send({ type: "start" });
  get("leave-room").onclick = () => {
    client.leave();
    get("room-entry").hidden = false;
    get("room-lobby").hidden = true;
  };
  get("back-single").onclick = () => {
    client.leave();
    client.close();
    location.assign(location.pathname);
  };
  get("copy-room").onclick = async () => {
    const url = new URL(location.href);
    url.search = "";
    url.searchParams.set("mode", "multiplayer");
    url.searchParams.set("room", client.room.code);
    try {
      await navigator.clipboard.writeText(url.href);
      get("copy-room").textContent = "COPIED!";
    } catch {
      error.textContent = `Share room code ${client.room.code}`;
    }
  };
  let resolveMatch,
    resolved = false;
  const promise = new Promise((resolve) => {
    resolveMatch = resolve;
  });
  client.subscribe((message) => {
    if (message.type === "error") error.textContent = message.message;
    if (message.type === "room") {
      const me = message.players.find((p) => p.playerId === client.identity?.playerId);
      if (!me) return;
      if (resolved && message.phase === "lobby") {
        location.reload();
        return;
      }
      get("room-entry").hidden = true;
      get("room-lobby").hidden = false;
      get("room-code").textContent = message.code;
      get("room-racer").value = me.id;
      get("room-course").value = message.course;
      get("room-laps").value = String(message.laps);
      const host = message.host === me.playerId,
        loading = message.phase !== "lobby";
      get("room-course").disabled = !host || loading;
      get("room-laps").disabled = !host || loading;
      get("room-racer").disabled = loading;
      get("room-ready").disabled = loading;
      get("room-ready").textContent = loading
        ? "LOADING RACERS…"
        : me.ready
          ? "READY ✓ · CLICK TO UNREADY"
          : "READY UP";
      get("room-start").hidden = !host;
      get("room-start").disabled =
        loading ||
        message.players.length < 2 ||
        message.players.some((p) => !p.connected || !p.ready);
      get("host-hint").textContent = host
        ? "Choose a course and laps. Everyone must ready up to race."
        : "The host chooses the course and race length.";
      get("room-players").replaceChildren(
        ...message.players.map((p) => {
          const li = document.createElement("li");
          li.textContent = `${p.name}${p.playerId === message.host ? " · HOST" : ""} — ${RACERS.find((r) => r.id === p.id)?.name} · ${!p.connected ? "RECONNECTING" : p.ready ? "READY ✓" : "CHOOSING"}`;
          return li;
        }),
      );
    }
    if (message.type === "prepare" && !resolved) {
      resolved = true;
      status.textContent = "Loading the course. The race starts when everyone is here.";
      resolveMatch({ client, match: message, hideLobby: () => screen.classList.add("hidden") });
    }
  });
  return promise;
}
