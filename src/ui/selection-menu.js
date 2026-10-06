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
    onPreferences = () => {};
  const prefs = loadPreferences();
  const courseGrid = get("course-grid"),
    racerGrid = get("racer-grid");
  function chooseCourse(entry) {
    selected.course = entry.id;
    get("selected-course-name").textContent = entry.name;
    get("course-description").textContent = entry.description;
    const image = get("course-preview");
    image.src = `./assets/previews/${entry.id}.svg`;
    image.alt = `${entry.name} illustrated preview`;
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
    image.src = `./assets/previews/${entry.id}.svg`;
    image.alt = "";
    image.loading = "lazy";
    const title = documentRef.createElement("span");
    title.textContent = entry.name;
    const number = documentRef.createElement("small");
    number.textContent = String(index + 1).padStart(2, "0");
    b.append(image, number, title);
    b.onclick = () => chooseCourse(entry);
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
    b.onclick = () => chooseRacer(entry);
    racerGrid.append(b);
  }
  for (const tab of documentRef.querySelectorAll("[data-menu-tab]"))
    tab.onclick = () => {
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
  // D-pad / left stick navigation across standard focusable buttons and controls.
  let gamepadClock = 0;
  function updateGamepad(dt) {
    if (get("title-screen").classList.contains("hidden")) return;
    gamepadClock -= dt;
    if (gamepadClock > 0) return;
    const pad = globalThis.navigator?.getGamepads?.()?.[0];
    if (!pad) return;
    const direction =
      pad.buttons[15]?.pressed || pad.buttons[13]?.pressed || pad.axes[0] > 0.5 || pad.axes[1] > 0.5
        ? 1
        : pad.buttons[14]?.pressed ||
            pad.buttons[12]?.pressed ||
            pad.axes[0] < -0.5 ||
            pad.axes[1] < -0.5
          ? -1
          : 0;
    const controls = [...get("title-screen").querySelectorAll("button,input,select")].filter(
      (e) => !e.disabled && e.getClientRects().length,
    );
    if (direction) {
      const i = controls.indexOf(documentRef.activeElement);
      controls[(i + direction + controls.length) % controls.length]?.focus();
      gamepadClock = 0.19;
    } else if (pad.buttons[0]?.pressed) {
      documentRef.activeElement?.click();
      gamepadClock = 0.3;
    }
  }
  documentRef.addEventListener("keydown", (event) => {
    if (
      get("title-screen").classList.contains("hidden") ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    if (![...courseGrid.children, ...racerGrid.children].includes(documentRef.activeElement))
      return;
    const grid = documentRef.activeElement.parentElement,
      buttons = [...grid.children],
      i = buttons.indexOf(documentRef.activeElement);
    const direction = ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1;
    buttons[(i + direction + buttons.length) % buttons.length].focus();
    event.preventDefault();
  });
  chooseCourse(course);
  chooseRacer(racer);
  return {
    preferences: prefs,
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
