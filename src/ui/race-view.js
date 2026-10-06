import { formatOrdinal, formatRaceTime, renderItemHud } from "./race-hud.js";

/** Page transitions and focus are presentation concerns, separate from race rules. */
export function createRaceView({ ui, canvas, radar, shell, courseSelector, racers, boxes, audio }) {
  function showObjects(visible) {
    for (const racer of racers) {
      racer.kart.root.visible = racer.kart.shadow.visible = visible;
    }
    for (const box of boxes) box.group.visible = visible && box.active;
  }
  return {
    syncItem(racer) {
      if (racer.isPlayer) renderItemHud(ui, racer.item, racer.itemCount);
    },
    showTitle() {
      ui.finish.classList.add("hidden");
      ui.pause.classList.add("hidden");
      ui.hud.classList.add("hidden");
      ui.count.classList.add("hidden");
      ui.title.classList.remove("hidden");
      shell.classList.remove("racing", "paused");
      radar.classList.remove("active");
      showObjects(false);
    },
    begin() {
      audio.start();
      audio.resume();
      shell.classList.add("racing");
      shell.classList.remove("paused");
      showObjects(true);
      ui.title.classList.add("hidden");
      ui.finish.classList.add("hidden");
      ui.pause.classList.add("hidden");
      ui.hud.classList.remove("hidden");
      radar.classList.add("active");
      ui.count.classList.remove("hidden");
      canvas.focus({ preventScroll: true });
      audio.tone(420, 0.18, "square", 0.08);
    },
    finish(rank, time) {
      ui.finalPlace.textContent = formatOrdinal(rank);
      ui.finalTime.textContent = Number.isFinite(time) ? formatRaceTime(time) : "DNF";
      ui.finishTitle.textContent =
        rank === 1 ? "WHAT A RACE!" : rank <= 3 ? "PODIUM FINISH!" : "RACE COMPLETE!";
      ui.finishCopy.textContent =
        rank === 1
          ? "You left the whole pack in your dust."
          : "Every turn counts. There’s always the next race.";
      ui.finish.classList.remove("hidden");
      ui.againButton.focus({ preventScroll: true });
      shell.classList.remove("racing");
      audio.stopEngine();
    },
    pause(paused) {
      ui.pause.classList.toggle("hidden", !paused);
      shell.classList.toggle("paused", paused);
      if (paused) audio.suspend();
      else {
        audio.resume();
        canvas.focus({ preventScroll: true });
      }
    },
    countdown(remaining, beep) {
      ui.count.textContent =
        remaining > 2.45 ? "3" : remaining > 1.45 ? "2" : remaining > 0.45 ? "1" : "GO!";
      if (beep) audio.tone(remaining > 0.45 ? 420 : 840, 0.15, "square", 0.08);
      if (remaining <= 0) ui.count.classList.add("hidden");
    },
    bind({ begin, setPaused, showTitle }) {
      ui.startButton.addEventListener("click", begin);
      ui.againButton.addEventListener("click", begin);
      ui.resumeButton.addEventListener("click", () => setPaused(false));
      ui.changeCourseButton.addEventListener("click", () => {
        showTitle();
        courseSelector.focus({ preventScroll: true });
      });
    },
    ready() {
      ui.startButton.disabled = false;
      ui.startButton.innerHTML = "SINGLE PLAYER <span>↗</span>";
    },
  };
}
