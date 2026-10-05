/** Bind keyboard, touch, and pointer controls to game-owned input state. */
export function bindGameInput({
  canvas,
  keys,
  pointer,
  windowRef = window,
  documentRef = document,
  testMode = false,
  isRunning,
  canPause,
  onPause,
  onUseItem,
  canRecover,
  onRecover,
}) {
  const keyboardKeys = new Set();
  const heldPointers = new Map();
  const touchButtons = [...documentRef.querySelectorAll("#touch-controls [data-key]")];
  let steeringPointer = null;
  let tiltEnabled = false;
  let tiltCenter = null;
  let tiltSteer = 0;
  const tiltButton = documentRef.querySelector('[data-action="tilt"]');

  pointer.autoThrottle =
    !!windowRef.matchMedia?.("(pointer: coarse)").matches ||
    (windowRef.navigator?.maxTouchPoints || 0) > 0;

  function syncKey(key) {
    keys[key] =
      keyboardKeys.has(key) ||
      [...heldPointers.values()].some((button) => button.dataset.key === key);
  }

  function showHeld(button) {
    const held = [...heldPointers.values()].includes(button);
    button.classList.toggle("is-held", held);
    button.setAttribute("aria-pressed", String(held));
  }

  function clear() {
    keyboardKeys.clear();
    heldPointers.clear();
    touchButtons.forEach(showHeld);
    for (const key of Object.keys(keys)) delete keys[key];
    steeringPointer = null;
    pointer.down = false;
    pointer.steer = 0;
    tiltSteer = 0;
  }

  windowRef.addEventListener("keydown", (event) => {
    if (event.target.closest("select,input,textarea,button")) return;
    const key = event.key.toLowerCase();
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      event.preventDefault();
    }
    if (key === "escape" && !event.repeat) {
      if (canPause()) onPause();
      return;
    }
    if (!isRunning()) return;
    keyboardKeys.add(key);
    syncKey(key);
    if ((key === "e" || key === "enter") && !event.repeat) onUseItem();
    if (key === "r" && !event.repeat && canRecover()) onRecover();
  });
  windowRef.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    keyboardKeys.delete(key);
    syncKey(key);
  });
  windowRef.addEventListener("blur", () => {
    clear();
    if (canPause() && !(testMode && windowRef.parent !== windowRef)) onPause(true);
  });
  documentRef.addEventListener("visibilitychange", () => {
    if (!documentRef.hidden) return;
    clear();
    if (canPause()) onPause(true);
  });

  touchButtons.forEach((button) => {
    const key = button.dataset.key;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (!isRunning()) return;
      button.setPointerCapture(event.pointerId);
      heldPointers.set(event.pointerId, button);
      syncKey(key);
      showHeld(button);
    });
    for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
      button.addEventListener(eventName, (event) => {
        if (heldPointers.get(event.pointerId) !== button) return;
        heldPointers.delete(event.pointerId);
        syncKey(key);
        showHeld(button);
      });
    }
  });

  documentRef.querySelector('[data-action="pause"]').addEventListener("click", () => {
    if (canPause()) onPause();
  });
  documentRef.querySelector('[data-action="recover"]').addEventListener("click", () => {
    if (canRecover()) onRecover();
  });
  documentRef.querySelector('[data-action="item"]').addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (isRunning()) onUseItem();
  });

  function setTiltEnabled(enabled) {
    tiltEnabled = enabled;
    tiltCenter = null;
    tiltSteer = 0;
    pointer.steer = 0;
    tiltButton.classList.toggle("is-held", enabled);
    tiltButton.setAttribute("aria-pressed", String(enabled));
    tiltButton.textContent = enabled ? "TILT ON" : "TILT";
    tiltButton.setAttribute("aria-label", enabled ? "Disable tilt steering" : "Enable tilt steering");
  }

  tiltButton.addEventListener("click", async () => {
    if (tiltEnabled) {
      setTiltEnabled(false);
      return;
    }
    const Orientation = windowRef.DeviceOrientationEvent;
    if (!Orientation) {
      tiltButton.textContent = "NO SENSOR";
      return;
    }
    try {
      if (typeof Orientation.requestPermission === "function") {
        const permission = await Orientation.requestPermission();
        if (permission !== "granted") {
          tiltButton.textContent = "ALLOW TILT";
          return;
        }
      }
      setTiltEnabled(true);
    } catch {
      tiltButton.textContent = "ALLOW TILT";
    }
  });

  windowRef.addEventListener("deviceorientation", (event) => {
    const orientationAngle =
      (((windowRef.screen?.orientation?.angle ?? windowRef.orientation ?? 0) % 360) + 360) % 360;
    const screenAngle = orientationAngle % 180;
    const sensorAngle = screenAngle === 90 ? event.beta : event.gamma;
    if (!tiltEnabled || !Number.isFinite(sensorAngle)) return;
    if (tiltCenter === null) tiltCenter = sensorAngle;
    const direction = orientationAngle === 90 ? -1 : 1;
    const angle = (sensorAngle - tiltCenter) * direction;
    const deadZone = 3;
    const activeAngle =
      Math.abs(angle) <= deadZone ? 0 : Math.sign(angle) * (Math.abs(angle) - deadZone);
    tiltSteer = clamp(activeAngle / 22, -1, 1);
    if (isRunning() && !pointer.down) pointer.steer = tiltSteer;
  });

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault?.();
    if (!isRunning() || steeringPointer !== null) return;
    if (pointer.autoThrottle && tiltEnabled) return;
    steeringPointer = event.pointerId;
    pointer.down = true;
    pointer.x = event.clientX;
    pointer.steer = 0;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (pointer.down && event.pointerId === steeringPointer)
      pointer.steer = clamp((event.clientX - pointer.x) / 85, -1, 1);
  });
  for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
    canvas.addEventListener(eventName, (event) => {
      if (event.pointerId !== steeringPointer) return;
      steeringPointer = null;
      pointer.down = false;
      pointer.steer = tiltEnabled ? tiltSteer : 0;
    });
  }

  // Safari can still start selection/callouts during a sustained multi-touch hold.
  // Cancel native gestures only on the driving surface and driving buttons.
  const drivingTargets = [canvas, ...documentRef.querySelectorAll("#touch-controls button")];
  for (const target of drivingTargets) {
    for (const eventName of ["touchstart", "touchmove"]) {
      target.addEventListener(eventName, (event) => event.preventDefault(), { passive: false });
    }
    for (const eventName of ["contextmenu", "selectstart", "dblclick"]) {
      target.addEventListener(eventName, (event) => event.preventDefault());
    }
  }

  return { clear };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
