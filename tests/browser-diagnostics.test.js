import test from "node:test";
import assert from "node:assert/strict";
import { createBrowserDiagnostics } from "../src/testing/browser-diagnostics.js";

function fixture(enabled, benchmarkMode = false) {
  let listener,
    starts = 0;
  const windowRef = {
    location: { origin: "https://racer.test" },
    parent: {},
    addEventListener: (_type, value) => (listener = value),
  };
  const diagnostics = createBrowserDiagnostics({
    enabled,
    benchmarkMode,
    windowRef,
    session: { getState: () => ({ running: false }) },
    items: { projectiles: [], bananas: [] },
    begin: () => starts++,
  });
  return {
    diagnostics,
    get starts() {
      return starts;
    },
    get listener() {
      return listener;
    },
    message(type, fields = {}) {
      listener({
        origin: windowRef.location.origin,
        source: windowRef.parent,
        data: { type, ...fields },
      });
    },
    windowRef,
  };
}

test("browser diagnostics are inert when normal gameplay disables test mode", () => {
  const app = fixture(false);
  assert.equal(app.listener, undefined);
  app.diagnostics.recordFrame(1);
  app.diagnostics.racerEvent({}, {});
  assert.equal(app.diagnostics.autodrive, false);
  assert.equal(app.diagnostics.freeze, false);
});

test("test commands require the same-origin parent and freeze is limited to benchmarks", () => {
  const app = fixture(true);
  for (const event of [
    {
      origin: "https://unrelated.test",
      source: app.windowRef.parent,
      data: { type: "test-start" },
    },
    { origin: app.windowRef.location.origin, source: {}, data: { type: "test-start" } },
    { origin: app.windowRef.location.origin, source: app.windowRef.parent, data: null },
  ])
    app.listener(event);
  assert.equal(app.starts, 0);
  app.message("test-start");
  assert.equal(app.starts, 1);
  app.message("test-auto", { value: true });
  assert.equal(app.diagnostics.autodrive, true);
  app.message("test-freeze", { value: true });
  assert.equal(app.diagnostics.freeze, false);
  const benchmark = fixture(true, true);
  benchmark.message("test-freeze", { value: true });
  assert.equal(benchmark.diagnostics.freeze, true);
});
