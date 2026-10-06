/** Same-origin transport with a private resume token and bounded retries. */
export function createRoomClient({ onStatus = () => {} } = {}) {
  const listeners = new Set();
  let socket,
    closed = false,
    retry = 0,
    reconnectTimer,
    pingTimer;
  let identity = null,
    room = null,
    match = null,
    snapshot = null,
    latency = 0;
  try {
    identity = JSON.parse(sessionStorage.getItem("turbo-room"));
  } catch {
    /* No saved room. */
  }
  function send(message) {
    if (socket?.readyState !== WebSocket.OPEN || socket.bufferedAmount > 65536) return false;
    socket.send(JSON.stringify(message));
    return true;
  }
  function connect() {
    clearInterval(pingTimer);
    socket = new WebSocket(
      `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/multiplayer`,
    );
    onStatus("Connecting…");
    socket.addEventListener("open", () => {
      retry = 0;
      onStatus("Connected");
      if (identity) send({ ...identity, type: "resume" });
      pingTimer = setInterval(() => send({ type: "ping", at: performance.now() }), 1500);
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "welcome") {
        identity = { playerId: message.playerId, token: message.token, code: message.code };
        sessionStorage.setItem("turbo-room", JSON.stringify(identity));
      }
      if (message.type === "room") room = message;
      if (message.type === "prepare") {
        match = message;
        snapshot = null;
      }
      if (message.type === "snapshot") snapshot = message;
      if (message.type === "pong") {
        latency = Math.round(performance.now() - message.at);
        onStatus(`${latency} ms`);
      }
      if (message.type === "error" && /expired|not found/.test(message.message)) {
        identity = null;
        sessionStorage.removeItem("turbo-room");
      }
      for (const listener of listeners) listener(message);
    });
    socket.addEventListener("close", () => {
      clearInterval(pingTimer);
      if (closed) return;
      onStatus("Connection lost · reconnecting…");
      for (const listener of listeners) listener({ type: "disconnected" });
      reconnectTimer = setTimeout(connect, Math.min(5000, 500 * 2 ** retry++));
    });
    socket.addEventListener("error", () =>
      onStatus("Cannot reach the room server. Run the game with npm start."),
    );
  }
  connect();
  return {
    send,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get identity() {
      return identity;
    },
    get room() {
      return room;
    },
    get match() {
      return match;
    },
    get snapshot() {
      return snapshot;
    },
    get latency() {
      return latency;
    },
    get connected() {
      return socket?.readyState === WebSocket.OPEN;
    },
    leave() {
      send({ type: "leave" });
      identity = null;
      sessionStorage.removeItem("turbo-room");
    },
    close() {
      closed = true;
      clearTimeout(reconnectTimer);
      clearInterval(pingTimer);
      socket?.close();
    },
  };
}
