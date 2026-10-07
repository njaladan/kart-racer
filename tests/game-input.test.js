import test from "node:test";
import assert from "node:assert/strict";
import { bindGameInput } from "../src/input/game-input.js";

class EventTargetMock {
  listeners = new Map();
  addEventListener(type, listener) {
    const entries = this.listeners.get(type) || [];
    entries.push(listener);
    this.listeners.set(type, entries);
  }
  fire(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) listener(event);
  }
}

function createDragHarness(width = 400) {
  const canvas = new EventTargetMock();
  canvas.clientWidth = width;
  canvas.setPointerCapture = () => {};
  const windowRef = new EventTargetMock();
  windowRef.parent = windowRef;
  const indicator = { hidden: true, style: { setProperty() {} } };
  const documentRef = new EventTargetMock();
  documentRef.getElementById = () => indicator;
  documentRef.querySelectorAll = () => [];
  documentRef.querySelector = () => new EventTargetMock();
  const pointer = { down: false, x: 0, steer: 0 };
  let running = true;
  const controller = bindGameInput({
    canvas,
    keys: {},
    pointer,
    windowRef,
    documentRef,
    isRunning: () => running,
    canPause: () => false,
    canRecover: () => false,
    onPause() {},
    onUseItem() {},
    onRecover() {},
  });
  const fire = (type, clientX = 200, extra = {}) =>
    canvas.fire(type, {
      pointerId: 1,
      pointerType: "touch",
      clientX,
      clientY: 300,
      preventDefault() {},
      ...extra,
    });
  return { fire, pointer, indicator, windowRef, controller, stop: () => (running = false) };
}

test("drag steering starts neutral anywhere, ignores jitter, and turns proportionally", () => {
  const { fire, pointer, indicator } = createDragHarness();
  fire("pointerdown");
  assert.equal(pointer.steer, 0);
  assert.equal(pointer.autoThrottle, true);
  assert.equal(indicator.hidden, false);
  assert.equal(indicator.style.left, "200px");
  for (const x of [194, 197, 200, 203, 206]) {
    fire("pointermove", x);
    assert.equal(Math.abs(pointer.steer), 0, "small finger movements stay neutral");
  }
  fire("pointermove", 161);
  assert.equal(pointer.steer, -0.5);
  fire("pointermove", 239);
  assert.equal(pointer.steer, 0.5);
  fire("pointermove", 20);
  assert.equal(pointer.steer, -1);
  fire("pointermove", 380);
  assert.equal(pointer.steer, 1);
  fire("pointermove", 200, { clientY: 450 });
  assert.equal(pointer.steer, 0, "vertical movement does not steer");
  fire("pointerup");
  assert.equal(pointer.down, false);
  assert.equal(pointer.steer, 0);
  assert.equal(indicator.hidden, true);
  fire("pointerdown", 320);
  assert.equal(pointer.steer, 0, "repositioning a finger establishes a new neutral point");
  fire("pointermove", 281);
  assert.equal(pointer.steer, -0.5);
});

test("drag steering scales to narrow screens without needing a long swipe", () => {
  const { fire, pointer } = createDragHarness(320);
  fire("pointerdown", 100);
  fire("pointermove", 158);
  assert.equal(pointer.steer, 1);
  fire("pointermove", 42);
  assert.equal(pointer.steer, -1);
});

test("interrupted drags release steering and its indicator without affecting the next touch", () => {
  for (const interruption of ["pointercancel", "lostpointercapture", "resize", "clear"]) {
    const { fire, pointer, indicator, windowRef, controller } = createDragHarness();
    fire("pointerdown");
    fire("pointermove", 280);
    if (interruption === "resize") windowRef.fire("resize");
    else if (interruption === "clear") controller.clear();
    else fire(interruption);
    assert.equal(pointer.steer, 0, interruption);
    assert.equal(pointer.down, false, interruption);
    assert.equal(indicator.hidden, true, interruption);
    fire("pointermove", 280);
    assert.equal(pointer.steer, 0, "stale movements cannot restart a cleared drag");
    fire("pointerdown", 260, { pointerId: 2 });
    fire("pointermove", 221, { pointerId: 2 });
    assert.equal(pointer.steer, -0.5);
    fire("pointerup", 221);
    assert.equal(pointer.steer, -0.5, "an old finger cannot release the new steering finger");
  }
});

test("menus and secondary mouse buttons cannot start a steering drag", () => {
  const { fire, pointer, indicator, stop } = createDragHarness();
  fire("pointerdown", 200, { pointerType: "mouse", button: 2 });
  assert.equal(pointer.down, false);
  fire("pointerdown", 200, { pointerType: "mouse", button: 0 });
  assert.equal(pointer.down, true, "primary mouse dragging remains supported");
  assert.equal(indicator.hidden, true);
  fire("pointerup");
  stop();
  fire("pointerdown");
  assert.equal(pointer.down, false);
  assert.equal(indicator.hidden, true);
});

test("game input owns keyboard, pointer, and reset behavior through callbacks", () => {
  const windowRef = new EventTargetMock();
  windowRef.parent = windowRef;
  const canvas = new EventTargetMock();
  canvas.setPointerCapture = () => {};
  const actions = new Map();
  const documentRef = new EventTargetMock();
  documentRef.querySelectorAll = () => [];
  documentRef.querySelector = (selector) => {
    const target = actions.get(selector) || new EventTargetMock();
    actions.set(selector, target);
    return target;
  };
  const keys = Object.create(null);
  const pointer = { down: false, x: 0, steer: 0 };
  let itemsUsed = 0;
  let recoveries = 0;
  let pauses = 0;
  const pauseValues = [];
  const input = bindGameInput({
    canvas,
    keys,
    pointer,
    windowRef,
    documentRef,
    isRunning: () => true,
    canPause: () => true,
    onPause: (value) => {
      pauses++;
      pauseValues.push(value);
    },
    onUseItem: () => itemsUsed++,
    canRecover: () => true,
    onRecover: () => recoveries++,
  });

  const keyEvent = (key) => ({
    key,
    repeat: false,
    target: { closest: () => false },
    preventDefault() {},
  });
  windowRef.fire("keydown", keyEvent("w"));
  windowRef.fire("keydown", keyEvent("e"));
  windowRef.fire("keydown", keyEvent("r"));
  windowRef.fire("keydown", keyEvent("Escape"));
  canvas.fire("pointerdown", { clientX: 100, pointerId: 1 });
  canvas.fire("pointermove", { clientX: 185, pointerId: 1 });

  assert.equal(keys.w, true);
  assert.equal(itemsUsed, 1);
  assert.equal(recoveries, 1);
  assert.equal(pauses, 1);
  assert.equal(pointer.steer, 1);
  windowRef.fire("blur");
  documentRef.hidden = true;
  documentRef.fire("visibilitychange");
  assert.deepEqual(pauseValues, [undefined, true, true]);

  input.clear();
  assert.deepEqual(Object.keys(keys), []);
  assert.equal(pointer.down, false);
  assert.equal(pointer.steer, 0);
});

test("multi-touch holds survive another finger lifting and cancel cleanly", () => {
  const windowRef = new EventTargetMock();
  windowRef.parent = windowRef;
  const canvas = new EventTargetMock();
  canvas.setPointerCapture = () => {};
  const button = (key) => {
    const target = new EventTargetMock();
    target.dataset = { key };
    target.classList = { toggle() {} };
    target.setAttribute = () => {};
    target.setPointerCapture = () => {};
    return target;
  };
  const gas = button("w"),
    brake = button("s"),
    drift = button(" ");
  const documentRef = new EventTargetMock();
  documentRef.querySelectorAll = () => [gas, brake, drift];
  documentRef.querySelector = () => new EventTargetMock();
  const keys = Object.create(null);
  const pointer = { down: false, x: 0, steer: 0 };
  const controller = bindGameInput({
    canvas,
    keys,
    pointer,
    windowRef,
    documentRef,
    isRunning: () => true,
    canPause: () => false,
    canRecover: () => false,
    onPause() {},
    onUseItem() {},
    onRecover() {},
  });
  const touch = (pointerId) => ({ pointerId, preventDefault() {} });
  gas.fire("pointerdown", touch(1));
  gas.fire("pointerdown", touch(2));
  brake.fire("pointerdown", touch(3));
  drift.fire("pointerdown", touch(4));
  gas.fire("pointerup", touch(1));
  assert.ok(keys.w && keys.s && keys[" "]);
  brake.fire("pointercancel", touch(3));
  assert.ok(keys.w && !keys.s && keys[" "]);
  drift.fire("lostpointercapture", touch(4));
  assert.equal(keys[" "], false);

  windowRef.fire("keydown", { key: "w", target: { closest: () => false } });
  gas.fire("pointerup", touch(2));
  assert.equal(keys.w, true, "touch release must preserve a keyboard hold");
  windowRef.fire("keyup", { key: "w" });
  assert.equal(keys.w, false);

  canvas.fire("pointerdown", { ...touch(5), clientX: 100 });
  canvas.fire("pointerdown", { ...touch(6), clientX: 200 });
  canvas.fire("pointermove", { ...touch(6), clientX: 280 });
  canvas.fire("pointerup", touch(6));
  assert.ok(pointer.down && pointer.steer === 0, "a second finger cannot steal steering");
  canvas.fire("pointermove", { ...touch(5), clientX: 139 });
  assert.equal(pointer.steer, 0.5);
  gas.fire("pointerdown", touch(7));
  controller.clear();
  canvas.fire("pointermove", { ...touch(5), clientX: 185 });
  assert.deepEqual(Object.keys(keys), []);
  assert.equal(pointer.steer, 0);
  assert.equal(pointer.down, false);
});
