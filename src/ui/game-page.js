import { RACERS, raceRoster } from "../rendering/racer-roster.js";
import { COURSES, DEFAULT_COURSE, findCourseById } from "../courses/registry.js";

/** Read page elements and bind URL-backed selections once at startup. */
export function createGamePage(documentRef = document, locationRef = location) {
  const params = new URLSearchParams(locationRef.search);
  const roster = raceRoster(params.get("racer"));
  const course = findCourseById(params.get("course")) ?? DEFAULT_COURSE;
  const get = (id) => documentRef.getElementById(id);
  function bindSelector(id, entries, selected, param, label) {
    const selector = get(id);
    for (const entry of entries) {
      const option = documentRef.createElement("option");
      option.value = entry.id;
      option.textContent = label(entry);
      selector.append(option);
    }
    selector.value = selected;
    selector.addEventListener("change", () => {
      const url = new URL(locationRef.href);
      url.searchParams.set(param, selector.value);
      locationRef.assign(url);
    });
    return selector;
  }
  bindSelector(
    "racer-select",
    RACERS,
    roster[0].id,
    "racer",
    (racer) => `${racer.name} · ${racer.kind}`,
  );
  const courseSelector = bindSelector(
    "course-select",
    COURSES,
    course.id,
    "course",
    (entry) => entry.name,
  );
  get("track-name").textContent = course.name.toUpperCase();
  get("course-description").textContent = course.description;
  const ui = Object.fromEntries(
    Object.entries({
      title: "title-screen",
      finish: "finish-screen",
      pause: "pause-screen",
      hud: "race-hud",
      count: "countdown",
      place: "place",
      lap: "lap",
      lapFill: "lap-fill",
      driftFill: "drift-fill",
      speed: "speed",
      timer: "timer",
      item: "item-box",
      toast: "toast",
      finalPlace: "final-place",
      finalTime: "final-time",
      finishTitle: "finish-title",
      finishCopy: "finish-copy",
      startButton: "start-button",
      againButton: "again-button",
      changeCourseButton: "change-course-button",
      resumeButton: "resume-button",
    }).map(([key, id]) => [key, get(id)]),
  );
  ui.itemIcon = documentRef.querySelector(".item-icon");
  ui.itemLabel = documentRef.querySelector(".item-label");
  return {
    course,
    roster,
    ui,
    courseSelector,
    canvas: get("game"),
    radar: get("radar"),
    shell: get("game-shell"),
    testMode: params.has("test"),
    benchmarkMode: params.has("test") && params.has("benchmark"),
  };
}
