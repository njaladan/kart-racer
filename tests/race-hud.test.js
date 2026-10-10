import test from "node:test";
import assert from "node:assert/strict";
import { formatRaceTime, ordinalSuffix, renderItemHud, renderRaceHud } from "../src/ui/race-hud.js";

function element() {
  return { textContent: "", innerHTML: "", style: {} };
}

test("race HUD formatting handles times and ordinal exceptions", () => {
  assert.equal(formatRaceTime(125.678), "02:05.67");
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21].map(ordinalSuffix), [
    "ST",
    "ND",
    "RD",
    "TH",
    "TH",
    "TH",
    "TH",
    "ST",
  ]);
});

test("item slot shows lottery previews then restores the selected item and charge count", () => {
  const ui = { itemIcon: element(), itemLabel: element(), item: element() };
  renderItemHud(ui, null, 0, "star", true);
  assert.equal(ui.itemIcon.textContent, "★");
  assert.equal(ui.itemLabel.textContent, "ROLLING…");
  renderItemHud(ui, null, 0, "banana", true);
  assert.equal(ui.itemIcon.textContent, "🍌");
  renderItemHud(ui, "mushroom", 3);
  assert.equal(ui.itemLabel.textContent, "MUSHROOM ×3");
  assert.equal(ui.itemIcon.style.transform, "");
});

test("race and item HUD render from explicit race presentation values", () => {
  const ui = {
    place: element(),
    lap: element(),
    lapFill: element(),
    driftFill: element(),
    speed: element(),
    timer: element(),
    itemIcon: element(),
    itemLabel: element(),
    item: element(),
  };

  renderRaceHud(ui, {
    rank: 2,
    lap: 1,
    totalLaps: 3,
    progress: 0.25,
    drift: 0.5,
    speed: 83,
    time: 10.5,
  });
  renderItemHud(ui, "mushroom", 2);

  assert.equal(ui.place.innerHTML, "2<small>ND</small>");
  assert.equal(ui.lap.innerHTML, "1 <i>/ 3</i>");
  assert.equal(ui.lapFill.style.width, "25%");
  assert.equal(ui.driftFill.style.width, "50%");
  assert.equal(ui.speed.textContent, "083");
  assert.equal(ui.timer.textContent, "00:10.50");
  assert.equal(ui.itemLabel.textContent, "MUSHROOM ×2");
});
