import test from "node:test";
import assert from "node:assert/strict";
import { laneWidth, laneFromOffset } from "../track.js";

test("lane coordinates and lateral metre offsets convert consistently", () => {
  for (const lane of [-5.5, -1, 0, 0.5, 4]) {
    assert.equal(laneFromOffset(laneWidth(lane)), lane);
  }
  assert.equal(laneWidth(1), 6.25);
  assert.equal(laneFromOffset(6.25), 1);
});
