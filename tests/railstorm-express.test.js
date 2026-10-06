import test from "node:test";
import assert from "node:assert/strict";
import course from "../src/courses/railstorm-express.js";
import { selectCourse } from "../src/track/track.js";
import { initializeRacer, advanceRacer, botInput } from "../src/simulation/simulation.js";
selectCourse(course);
test("five drivers board and race moving freight on every lap, then disembark and finish", () => {
  for (let i = 0; i < 5; i++) {
    const r = initializeRacer({ s: 0, x: 0, skill: 0.9 - i * 0.045 });
    let boardings = 0,
      exits = 0,
      hits = 0;
    for (let k = 1; k < 120 * 280 && !r.finished; k++) {
      const e = advanceRacer(r, botInput(r, i, k / 120), 1 / 120, k / 120);
      boardings += !!e.deckBoarded;
      exits += !!e.deckLeft;
      hits += !!e.wallImpact;
    }
    assert.ok(r.finished);
    assert.equal(boardings, 3);
    assert.equal(exits, 3);
    assert.equal(hits, 0);
  }
});
