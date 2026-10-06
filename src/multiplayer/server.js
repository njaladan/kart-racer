import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import { Worker } from "node:worker_threads";
import { WebSocketServer } from "ws";
import { RACERS } from "../rendering/racer-roster.js";
import { COURSES } from "../courses/registry.js";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".glb": "model/gltf-binary",
  ".ttf": "font/ttf",
};
export function createMultiplayerServer({ root = ROOT } = {}) {
  const rooms = new Map();
  const send = (socket, message) => {
    if (socket?.readyState === 1) socket.send(JSON.stringify(message));
  };
  function roomState(room) {
    return {
      type: "room",
      code: room.code,
      host: room.host,
      course: room.course,
      laps: room.laps,
      phase: room.phase,
      players: [...room.players.values()].map((p) => ({
        playerId: p.playerId,
        name: p.name,
        id: p.id,
        ready: p.ready,
        connected: !!p.socket,
      })),
    };
  }
  const broadcast = (room, message) => {
    for (const player of room.players.values()) {
      // Never queue obsolete race snapshots behind a slow connection.
      if (message.type === "snapshot" && player.socket?.bufferedAmount > 65536) continue;
      send(player.socket, message);
    }
  };
  const publish = (room) => broadcast(room, roomState(room));
  function returnToLobby(room, error) {
    room.worker?.terminate();
    room.worker = null;
    room.phase = "lobby";
    room.match = null;
    for (const p of room.players.values()) p.ready = false;
    if (error) broadcast(room, { type: "error", message: error });
    publish(room);
  }
  function disconnect(socket) {
    const room = rooms.get(socket.roomCode),
      player = room?.players.get(socket.playerId);
    if (!player || player.socket !== socket) return;
    player.socket = null;
    player.ready = false;
    player.disconnectedAt = Date.now();
    room.worker?.postMessage({ type: "disconnect", playerId: player.playerId });
    if (room.host === player.playerId)
      room.host = [...room.players.values()].find((p) => p.socket)?.playerId ?? room.host;
    publish(room);
  }
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      if (url.pathname === "/health") {
        response.writeHead(200);
        response.end("ok");
        return;
      }
      const path = resolve(
        root,
        "." + decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname),
      );
      const relative = path.slice(root.length);
      if (
        (!path.startsWith(root + sep) && path !== root) ||
        relative.split(sep).some((part) => part.startsWith(".")) ||
        relative.startsWith("/node_modules/") ||
        relative.startsWith("/src/multiplayer/server")
      ) {
        response.writeHead(403);
        response.end();
        return;
      }
      const info = await stat(path);
      if (!info.isFile()) throw new Error("Not a file");
      response.writeHead(200, {
        "Content-Type": TYPES[extname(path)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      response.end(await readFile(path));
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  const sockets = new WebSocketServer({ server, path: "/multiplayer", maxPayload: 8192 });
  sockets.on("connection", (socket, request) => {
    // Browsers may connect only from this game origin (CLI tests omit Origin).
    try {
      if (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host) {
        socket.close(1008);
        return;
      }
    } catch {
      socket.close(1008);
      return;
    }
    socket.alive = true;
    socket.on("pong", () => {
      socket.alive = true;
    });
    let budget = 0,
      budgetAt = Date.now();
    socket.on("message", (raw) => {
      if (Date.now() - budgetAt > 1000) {
        budget = 0;
        budgetAt = Date.now();
      }
      if (++budget > 150) {
        socket.close(1008, "Too many messages");
        return;
      }
      try {
        const message = JSON.parse(raw);
        if (message.type === "ping") {
          send(socket, { type: "pong", at: message.at });
          return;
        }
        if (["host", "join", "resume"].includes(message.type)) {
          if (socket.roomCode) throw new Error("Already in a room.");
          let room;
          if (message.type === "host") {
            if (rooms.size >= 64) throw new Error("Rooms are full. Try again soon.");
            let code;
            do {
              code = randomBytes(3).toString("hex").toUpperCase();
            } while (rooms.has(code));
            room = {
              code,
              players: new Map(),
              course: COURSES[0].id,
              laps: 3,
              phase: "lobby",
              worker: null,
              match: null,
            };
            rooms.set(code, room);
          } else
            room = rooms.get(
              String(message.code || "")
                .trim()
                .toUpperCase(),
            );
          if (!room) throw new Error("Room not found. Check the six-character code.");
          let player;
          if (message.type === "resume") {
            player = [...room.players.values()].find((p) => p.token === message.token);
            if (!player) throw new Error("Your room session has expired. Join again.");
            const previous = player.socket;
            player.socket = socket;
            previous?.close(1000);
          } else {
            if (room.phase !== "lobby")
              throw new Error("This room is already racing. Try after the race.");
            if (room.players.size >= 6) throw new Error("This room is full (six racers).");
            const name = String(message.name || "")
              .trim()
              .slice(0, 20);
            if (!name) throw new Error("Enter a racer name.");
            player = {
              playerId: randomUUID(),
              token: randomBytes(24).toString("hex"),
              name,
              id: RACERS[room.players.size].id,
              socket,
              ready: false,
            };
            room.players.set(player.playerId, player);
            room.host ||= player.playerId;
          }
          player.socket = socket;
          player.disconnectedAt = null;
          socket.roomCode = room.code;
          socket.playerId = player.playerId;
          send(socket, {
            type: "welcome",
            playerId: player.playerId,
            token: player.token,
            code: room.code,
          });
          publish(room);
          if (room.match) send(socket, { type: "prepare", ...room.match });
          return;
        }
        const room = rooms.get(socket.roomCode),
          player = room?.players.get(socket.playerId);
        if (!player || player.socket !== socket) throw new Error("Create or join a room first.");
        if (message.type === "leave") {
          disconnect(socket);
          room.players.delete(player.playerId);
          socket.roomCode = null;
          socket.playerId = null;
          publish(room);
          return;
        }
        if (message.type === "select" && room.phase === "lobby") {
          if (RACERS.some((r) => r.id === message.racer)) player.id = message.racer;
          if (player.playerId === room.host) {
            if (COURSES.some((c) => c.id === message.course)) room.course = message.course;
            if ([1, 3].includes(message.laps)) room.laps = message.laps;
            for (const p of room.players.values()) p.ready = false;
          }
          player.ready = false;
          publish(room);
        }
        if (message.type === "ready" && room.phase === "lobby") {
          player.ready = message.ready === true;
          publish(room);
        }
        if (message.type === "start") {
          if (player.playerId !== room.host) throw new Error("Only the host can start the race.");
          if (room.phase !== "lobby") throw new Error("A race is already in progress.");
          const players = [...room.players.values()];
          if (players.length < 2 || players.some((p) => !p.socket || !p.ready))
            throw new Error("At least two racers must be connected and ready.");
          room.phase = "loading";
          room.match = {
            matchId: randomUUID(),
            course: room.course,
            laps: room.laps,
            players: players.map((p) => ({
              ...RACERS.find((r) => r.id === p.id),
              name: p.name,
              playerId: p.playerId,
            })),
          };
          room.worker = new Worker(new URL("./room-worker.js", import.meta.url), {
            workerData: room.match,
          });
          room.worker.on("message", (data) => {
            if (data.type === "snapshot") {
              room.phase = "racing";
              broadcast(room, data);
            } else if (data.type === "race-ended") {
              room.phase = "results";
              publish(room);
            } else if (data.type === "load-failed")
              returnToLobby(room, "Someone could not load the course. Ready up and try again.");
          });
          room.worker.on("error", (error) => {
            console.error("Race worker:", error);
            returnToLobby(room, "The race stopped. Ready up and try again.");
          });
          publish(room);
          broadcast(room, { type: "prepare", ...room.match });
        }
        if (message.type === "lobby") {
          if (room.phase !== "results") throw new Error("Wait for the other racers to finish.");
          returnToLobby(room);
        }
        if (["input", "action", "loaded"].includes(message.type) && room.worker) {
          room.worker.postMessage({
            ...message,
            type: message.type === "loaded" ? "ready" : message.type,
            playerId: player.playerId,
          });
        }
      } catch (error) {
        send(socket, { type: "error", message: error.message || "Invalid room message." });
      }
    });
    socket.on("close", () => disconnect(socket));
    socket.on("error", () => {});
  });
  const cleanup = setInterval(() => {
    for (const socket of sockets.clients) {
      if (!socket.alive) {
        socket.terminate();
        continue;
      }
      socket.alive = false;
      socket.ping();
    }
    for (const room of rooms.values()) {
      for (const p of room.players.values())
        if (!p.socket && Date.now() - p.disconnectedAt > 30000 && room.phase === "lobby")
          room.players.delete(p.playerId);
      if (
        ![...room.players.values()].some((p) => p.socket) &&
        [...room.players.values()].every((p) => Date.now() - p.disconnectedAt > 30000)
      ) {
        room.worker?.terminate();
        rooms.delete(room.code);
      }
      if (!room.players.size) {
        room.worker?.terminate();
        rooms.delete(room.code);
      }
    }
  }, 10000);
  cleanup.unref();
  return {
    server,
    rooms,
    async close() {
      clearInterval(cleanup);
      await Promise.all([...rooms.values()].map((room) => room.worker?.terminate()));
      for (const socket of sockets.clients) socket.terminate();
      sockets.close();
      await new Promise((resolveClose) => server.close(resolveClose));
    },
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server } = createMultiplayerServer();
  const port = Number(process.env.PORT || 5173);
  server.listen(port, process.env.HOST || "0.0.0.0", () =>
    console.log(`Turbo Trail: http://localhost:${port} (multiplayer enabled)`),
  );
}
