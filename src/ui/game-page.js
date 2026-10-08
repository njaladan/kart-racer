import { createSelectionMenu } from "./selection-menu.js";
import { raceRoster } from "../rendering/racer-roster.js";
import { DEFAULT_COURSE, findCourseById } from "../courses/registry.js";

/** Read page elements and bind URL-backed selections once at startup. */
export function createGamePage(documentRef = document, locationRef = location, multiplayer = null) {
  const params = new URLSearchParams(locationRef.search);
  const roster = multiplayer?.match.players ?? raceRoster(params.get("racer"));
  const course =
    findCourseById(multiplayer?.match.course ?? params.get("course")) ?? DEFAULT_COURSE;
  const get = (id) => documentRef.getElementById(id);
  const selection = createSelectionMenu({
    documentRef,
    locationRef,
    course,
    racer: roster[0],
    multiplayer,
  });
  const courseSelector = selection;
  get("track-name").textContent = course.name.toUpperCase();
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
    selection,
    canvas: get("game"),
    radar: get("radar"),
    shell: get("game-shell"),
    testMode: params.has("test"),
    benchmarkMode: params.has("test") && params.has("benchmark"),
  };
}
