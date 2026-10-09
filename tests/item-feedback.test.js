import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "../vendor/three/three.module.js";
import { createRaceFeedback } from "../src/ui/race-feedback.js";

test("item feedback separates pickup, slot notes, selection and occupied crush cues", () => {
  const player = { worldPos: new Vector3(), item: null };
  const sounds = [],
    particles = [];
  const toast = { textContent: "" };
  const feedback = createRaceFeedback({
    player,
    toast,
    audio: { play: (...args) => sounds.push(args) },
    particles: { spawn: (...args) => particles.push(args) },
  });
  feedback.collected(player, true);
  assert.equal(toast.textContent, "ITEM LOTTERY!");
  feedback.rolling(player, 3);
  player.item = "star";
  feedback.selected(player);
  assert.equal(toast.textContent, "RAINBOW STAR!");
  feedback.collected(player, false);
  assert.equal(toast.textContent, "RAINBOW STAR!");
  assert.deepEqual(sounds, [["pickup"], ["item-roll", 3], ["item-select"], ["box-crush"]]);
  assert.equal(particles.length, 32, "both pickups and occupied crushes show a burst");
  const rival = { worldPos: new Vector3(), item: "banana" };
  feedback.collected(rival, true);
  feedback.rolling(rival, 1);
  feedback.selected(rival);
  assert.equal(sounds.length, 4, "opponent item lotteries do not play the player's cues");
});
