import test from "node:test";
import assert from "node:assert/strict";
import { bindGameInput } from "../game-input.js";

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

  const keyEvent = (key) => ({ key, repeat: false, target: { closest: () => false }, preventDefault() {} });
  windowRef.fire("keydown", keyEvent("w"));
  windowRef.fire("keydown", keyEvent("e"));
  windowRef.fire("keydown", keyEvent("r"));
  windowRef.fire("keydown", keyEvent("Escape"));
  canvas.fire("pointerdown", { clientX: 100, pointerId: 1 });
  canvas.fire("pointermove", { clientX: 185 });

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
