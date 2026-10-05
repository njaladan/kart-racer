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
  function clear() {
    for (const key of Object.keys(keys)) delete keys[key];
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
    keys[key] = true;
    if ((key === "e" || key === "enter") && !event.repeat) onUseItem();
    if (key === "r" && !event.repeat && canRecover()) onRecover();
  });
  windowRef.addEventListener("keyup", (event) => {
    keys[event.key.toLowerCase()] = false;
  });
  windowRef.addEventListener("blur", () => {
    clear();
    if (canPause() && !(testMode && windowRef.parent !== windowRef)) onPause();
  });
  documentRef.addEventListener("visibilitychange", () => {
    if (!documentRef.hidden) return;
    clear();
    if (canPause()) onPause();
  });

  documentRef.querySelectorAll("#touch-controls [data-key]").forEach((button) => {
    const key = button.dataset.key;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (!isRunning()) return;
      button.setPointerCapture(event.pointerId);
      keys[key] = true;
    });
    for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
      button.addEventListener(eventName, () => {
        keys[key] = false;
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
    if (!isRunning()) return;
    pointer.down = true;
    pointer.x = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (pointer.down) pointer.steer = clamp((event.clientX - pointer.x) / 85, -1, 1);
  });
  for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
    canvas.addEventListener(eventName, () => {
      pointer.down = false;
      pointer.steer = 0;
    });
  }

  return { clear };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
