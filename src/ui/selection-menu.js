import { RACERS } from "../rendering/racer-roster.js";
import { COURSES } from "../courses/registry.js";
import { loadPreferences, savePreferences } from "./preferences.js";
const PERSONALITY = {
  tux: "Cool under pressure. Fast through the chaos.",
  nolok: "Big attitude. Bigger corner exits.",
  pidgin: "A little flair goes a long way.",
  kiki: "Precision driving. Maximum mischief.",
  konqi: "A dragon with somewhere to be.",
  wilber: "Born to make a beautiful mess.",
};

export function createSelectionMenu({ documentRef, locationRef, course, racer, multiplayer }) {
  const get = (id) => documentRef.getElementById(id);
  const selected = { course: course.id, racer: racer.id };
  let onRacer = () => {},
    onPreferences = () => {},
    onFeedback = () => {};
  const prefs = loadPreferences();
  const courseGrid = get("course-grid"),
    racerGrid = get("racer-grid");
  function preview(image, entry) {
    // Reuse the local driving gallery; illustrated art remains an offline fallback.
    image.onerror = () => {
      image.onerror = null;
      image.src = `./assets/previews/${entry.id}.svg`;
    };
    image.src = `./docs/screenshots/${entry.id}.jpg`;
  }
  function chooseCourse(entry) {
    selected.course = entry.id;
    get("selected-course-name").textContent = entry.name;
    const image = get("course-preview");
    preview(image, entry);
    image.alt = `${entry.name} driving preview`;
    get("course-number").textContent =
      `${String(COURSES.indexOf(entry) + 1).padStart(2, "0")} / ${String(COURSES.length).padStart(2, "0")}`;
    for (const b of courseGrid.children)
      b.setAttribute("aria-pressed", String(b.dataset.id === entry.id));
  }
  function chooseRacer(entry) {
    selected.racer = entry.id;
    get("selected-racer-name").textContent = entry.name;
    get("racer-personality").textContent = PERSONALITY[entry.id];
    get("garage-panel").style.setProperty("--racer-color", entry.color);
    for (const b of racerGrid.children)
      b.setAttribute("aria-pressed", String(b.dataset.id === entry.id));
    onRacer(entry.id);
  }
  for (const [index, entry] of COURSES.entries()) {
    const b = documentRef.createElement("button");
    b.type = "button";
    b.className = "course-tile";
    b.dataset.id = entry.id;
    const image = documentRef.createElement("img");
    preview(image, entry);
    image.alt = "";
    image.loading = "lazy";
    const title = documentRef.createElement("span");
    title.textContent = entry.name;
    const number = documentRef.createElement("small");
    number.textContent = String(index + 1).padStart(2, "0");
    b.append(image, number, title);
    b.onclick = () => {
      chooseCourse(entry);
      onFeedback();
    };
    courseGrid.append(b);
  }
  for (const entry of RACERS) {
    const b = documentRef.createElement("button");
    b.type = "button";
    b.className = "racer-tile";
    b.dataset.id = entry.id;
    b.style.setProperty("--racer-color", entry.color);
    const mark = documentRef.createElement("span");
    mark.textContent = entry.name[0];
    const name = documentRef.createElement("strong");
    name.textContent = entry.name;
    const kind = documentRef.createElement("small");
    kind.textContent = entry.kind;
    b.append(mark, name, kind);
    b.onclick = () => {
      chooseRacer(entry);
      onFeedback();
    };
    racerGrid.append(b);
  }
  for (const tab of documentRef.querySelectorAll("[data-menu-tab]"))
    tab.onclick = () => {
      onFeedback();
      for (const b of documentRef.querySelectorAll("[data-menu-tab]"))
        b.setAttribute("aria-selected", String(b === tab));
      for (const panel of documentRef.querySelectorAll(".menu-panel"))
        panel.hidden = panel.id !== `${tab.dataset.menuTab}-panel`;
    };
  for (const key of Object.keys(prefs)) {
    const control = get(`option-${key}`);
    if (!control) continue;
    if (control.type === "checkbox") control.checked = prefs[key];
    else control.value = String(prefs[key]);
    control.oninput = () => {
      prefs[key] = control.type === "checkbox" ? control.checked : Number(control.value);
      savePreferences(prefs);
      onFeedback();
      onPreferences({ ...prefs });
      const output = get(`value-${key}`);
      if (output) output.textContent = `${Math.round(prefs[key] * 100)}%`;
    };
    const output = get(`value-${key}`);
    if (output) output.textContent = `${Math.round(prefs[key] * 100)}%`;
  }
  // Selection is immediate; load a new course only when the player commits to racing.
  get("start-button").addEventListener(
    "click",
    (event) => {
      if (multiplayer || (selected.course === course.id && selected.racer === racer.id)) return;
      event.stopImmediatePropagation();
      const url = new URL(locationRef.href);
      url.searchParams.set("course", selected.course);
      url.searchParams.set("racer", selected.racer);
      url.searchParams.set("race", "1");
      locationRef.assign(url);
    },
    true,
  );
  function moveGrid(grid, key) {
    const buttons = [...grid.children];
    const i = buttons.indexOf(documentRef.activeElement);
    if (i < 0) return false;
    const columns = Math.max(
      1,
      Math.round(grid.clientWidth / buttons[0].getBoundingClientRect().width),
    );
    const step =
      key === "ArrowUp" ? -columns : key === "ArrowDown" ? columns : key === "ArrowLeft" ? -1 : 1;
    buttons[(i + step + buttons.length) % buttons.length]?.focus();
    return true;
  }
  // D-pad / stick follows the visible grid; horizontal input adjusts option sliders.
  let gamepadClock = 0;
  function updateGamepad(dt) {
    if (get("title-screen").classList.contains("hidden")) return;
    gamepadClock -= dt;
    if (gamepadClock > 0) return;
    const pad = globalThis.navigator?.getGamepads?.()?.[0];
    if (!pad) return;
    const key =
      pad.buttons[15]?.pressed || pad.axes[0] > 0.5
        ? "ArrowRight"
        : pad.buttons[14]?.pressed || pad.axes[0] < -0.5
          ? "ArrowLeft"
          : pad.buttons[13]?.pressed || pad.axes[1] > 0.5
            ? "ArrowDown"
            : pad.buttons[12]?.pressed || pad.axes[1] < -0.5
              ? "ArrowUp"
              : null;
    const active = documentRef.activeElement;
    const controls = [...get("title-screen").querySelectorAll("button,input,select")].filter(
      (e) => !e.disabled && e.getClientRects().length,
    );
    if (key) {
      if (active?.type === "range" && ["ArrowLeft", "ArrowRight"].includes(key)) {
        const step = Number(active.step) || 1;
        active.value = String(
          Math.max(
            Number(active.min),
            Math.min(
              Number(active.max),
              Number(active.value) + (key === "ArrowLeft" ? -step : step),
            ),
          ),
        );
        active.oninput?.();
      } else if (!moveGrid(courseGrid, key) && !moveGrid(racerGrid, key)) {
        const direction = ["ArrowLeft", "ArrowUp"].includes(key) ? -1 : 1;
        const i = controls.indexOf(active);
        controls[(i + direction + controls.length) % controls.length]?.focus();
      }
      gamepadClock = 0.19;
    } else if (pad.buttons[0]?.pressed) {
      active?.click();
      gamepadClock = 0.3;
    }
  }
  documentRef.addEventListener("keydown", (event) => {
    if (
      get("title-screen").classList.contains("hidden") ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    if (moveGrid(courseGrid, event.key) || moveGrid(racerGrid, event.key)) event.preventDefault();
  });
  chooseCourse(course);
  chooseRacer(racer);
  return {
    preferences: prefs,
    setFeedbackHandler(callback) {
      onFeedback = callback;
    },
    selected,
    updateGamepad,
    setRacerPreview(callback) {
      onRacer = callback;
      callback(selected.racer);
    },
    setPreferencesHandler(callback) {
      onPreferences = callback;
      callback({ ...prefs });
    },
    focus: () => get("course-grid").querySelector('[aria-pressed="true"]')?.focus(),
  };
}
