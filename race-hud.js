const ITEM_PRESENTATION = {
  mushroom: { icon: "🍄", label: (count) => `MUSHROOM ×${count}` },
  green: { icon: "●", label: () => "GREEN SHELL" },
  red: { icon: "◉", label: () => "RED SHELL" },
  banana: { icon: "⌁", label: () => "BANANA PEEL" },
  star: { icon: "✦", label: () => "RAINBOW STAR" },
};

export function formatRaceTime(time) {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const centiseconds = Math.floor((time % 1) * 100);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

export function ordinalSuffix(value) {
  if (value % 100 >= 11 && value % 100 <= 13) return "TH";
  return { 1: "ST", 2: "ND", 3: "RD" }[value % 10] || "TH";
}

export function formatOrdinal(value) {
  return `${value}${ordinalSuffix(value)}`;
}

export function renderItemHud(ui, item, count) {
  const presentation = ITEM_PRESENTATION[item];
  ui.itemIcon.textContent = presentation?.icon || "?";
  ui.itemLabel.textContent = presentation?.label(count) || "ITEM";
  ui.item.style.opacity = item ? "1" : ".65";
}

export function renderRaceHud(
  ui,
  { rank, lap, totalLaps, progress, drift, speed, time },
) {
  ui.place.innerHTML = `${rank}<small>${ordinalSuffix(rank)}</small>`;
  ui.lap.innerHTML = `${lap} <i>/ ${totalLaps}</i>`;
  ui.lapFill.style.width = `${progress * 100}%`;
  ui.driftFill.style.width = `${Math.round(drift * 100)}%`;
  ui.speed.textContent = String(Math.round(speed)).padStart(3, "0");
  ui.timer.textContent = formatRaceTime(time);
}
