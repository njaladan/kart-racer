import test from "node:test";
import assert from "node:assert/strict";
import { drumImpact } from "../src/rendering/drum-response.js";

function expectedStrength(age) {
  return age < 0.7 ? Math.exp(-age * 7) * (Math.sin(age * 29) * 0.45 + 0.55) : 0;
}

test("a late render reconstructs drum impact time from authoritative airtime", () => {
  const raceTime = 21.4;
  const racer = { jumpKind: "drum", lastDrumIndex: 3, airTime: 0.57 };
  const response = drumImpact([racer], 3, raceTime);

  assert.ok(Math.abs(response.impact - (raceTime - racer.airTime)) < 1e-12);
  assert.ok(Math.abs(response.strength - expectedStrength(racer.airTime)) < 1e-12);
});

test("drum response follows flight age and disappears after its impact window", () => {
  const racer = { jumpKind: "drum", lastDrumIndex: 1, airTime: 0.2 };
  const first = drumImpact([racer], 1, 10);
  racer.airTime = 0.6;
  const later = drumImpact([racer], 1, 10.4, first.impact);
  assert.equal(later.impact, first.impact);
  assert.ok(Math.abs(later.strength - expectedStrength(0.6)) < 1e-12);
  assert.ok(later.strength < first.strength);

  racer.airTime = 0.72;
  const expired = drumImpact([racer], 1, 10.52, later.impact);
  assert.equal(expired.strength, 0);
  assert.equal(expired.impact, first.impact);
});

test("another drum index or jump type cannot create a drum response", () => {
  const racers = [
    { jumpKind: "drum", lastDrumIndex: 2, airTime: 0.1 },
    { jumpKind: "quarterpipe", lastDrumIndex: 4, airTime: 0.2 },
    { jumpKind: "drum", lastDrumIndex: 4, airTime: Number.NaN },
  ];
  const response = drumImpact(racers, 4, 15);
  assert.equal(response.impact, -Infinity);
  assert.equal(response.strength, 0);
});
