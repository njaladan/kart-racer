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

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault?.();
    if (!isRunning() || steeringPointer !== null) return;
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
      pointer.steer = 0;
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
