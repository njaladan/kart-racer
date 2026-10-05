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
  const input = bindGameInput({
    canvas,
    keys,
    pointer,
    windowRef,
    documentRef,
    isRunning: () => true,
    canPause: () => true,
    onPause: () => pauses++,
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
    steer = button("d"),
    drift = button(" ");
  const documentRef = new EventTargetMock();
  documentRef.querySelectorAll = () => [gas, steer, drift];
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
  steer.fire("pointerdown", touch(3));
  drift.fire("pointerdown", touch(4));
  gas.fire("pointerup", touch(1));
  assert.ok(keys.w && keys.d && keys[" "]);
  steer.fire("pointercancel", touch(3));
  assert.ok(keys.w && !keys.d && keys[" "]);
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
  canvas.fire("pointermove", { ...touch(5), clientX: 142.5 });
  assert.equal(pointer.steer, 0.5);
  gas.fire("pointerdown", touch(7));
  controller.clear();
  canvas.fire("pointermove", { ...touch(5), clientX: 185 });
  assert.deepEqual(Object.keys(keys), []);
  assert.equal(pointer.steer, 0);
  assert.equal(pointer.down, false);
});
