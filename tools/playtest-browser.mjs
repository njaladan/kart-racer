#!/usr/bin/env node
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { COURSES } from "../src/courses/registry.js";
import { createTrack } from "../src/track/track-builder.js";

const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const output = resolve(process.env.PLAYTEST_OUTPUT || "/tmp/kart-review/browser");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-angle=swiftshader"],
});
const reports = [];
try {
  for (const course of COURSES.filter(
    (c) => !process.argv.slice(2).length || process.argv.slice(2).includes(c.id),
  )) {
    const track = createTrack(course);
    const page = await browser.newPage({
      viewport: { width: 800, height: 450 },
      deviceScaleFactor: 1,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.addInitScript(() => {
      localStorage.setItem(
        "turbo-trail-preferences-v1",
        JSON.stringify({ quality: 1, adaptive: false }),
      );
      window.playtestReport = null;
      window.addEventListener("message", ({ data }) => {
        if (data?.type === "racer-state") window.playtestReport = data;
      });
      const request = window.requestAnimationFrame.bind(window);
      let pending,
        remaining = 5;
      window.requestAnimationFrame = (callback) =>
        request((time) => {
          if (remaining-- <= 0) {
            pending = callback;
            return;
          }
          callback(time);
        });
      window.playtestFrames = (count) => {
        remaining = count;
        if (pending) {
          const callback = pending;
          pending = null;
          window.requestAnimationFrame(callback);
        }
      };
      window.playtestRendered = () => remaining < 0;
    });
    await page.goto(`http://127.0.0.1:5173/?course=${course.id}&test&benchmark`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(
      () => window.__turboTrailDiagnostics && !document.querySelector("#start-button").disabled,
      undefined,
      { timeout: 120000, polling: 100 },
    );
    await page.evaluate(() => {
      const d = window.__turboTrailDiagnostics;
      d.send({ type: "test-start" });
      d.send({ type: "test-freeze", value: true });
      d.send({ type: "test-auto", value: true });
      d.send({ type: "test-step", seconds: 0.1 });
    });
    const race = await page.evaluate(() => {
      const d = window.__turboTrailDiagnostics;
      const samples = [];
      for (let seconds = 0; seconds < 420 && !d.state().finished; seconds += 5) {
        d.send({ type: "test-step", seconds: 5 });
        samples.push(d.state());
      }
      return { samples, final: d.state() };
    });
    // Restart before inspecting the entire route and all alternate routes.
    await page.evaluate(() => {
      const d = window.__turboTrailDiagnostics;
      d.send({ type: "test-start" });
      d.send({ type: "test-freeze", value: true });
      d.send({ type: "test-auto", value: false });
      d.send({ type: "test-step", seconds: 0.1 });
      d.send({ type: "test-step", seconds: 5 });
    });
    const points = track.SECTIONS.flatMap((s, i) =>
      [0.12, 0.48, 0.84].map((q) => ({ name: `s${i}-${q}`, t: s.start + (s.end - s.start) * q })),
    );
    for (const b of track.branches)
      for (const q of [0.08, 0.32, 0.54, 0.78, 0.94])
        points.push({ name: `${b.id}-${q}`, t: b.start, branchIndex: b.index, q });
    if (course.downhill)
      for (const q of [0.15, 0.4, 0.6, 0.85])
        for (const offset of [-45, -20, 0, 20, 45])
          points.push({
            name: `snow-${q}-${offset}`,
            t: track.sectorT(course.downhill.section, q),
            offset,
          });
    const cdp = await page.context().newCDPSession(page);
    const captures = [];
    for (const point of points) {
      const state = await page.evaluate((point) => {
        window.__turboTrailDiagnostics.send({ type: "test-seek", ...point });
        window.playtestFrames(1);
        return window.__turboTrailDiagnostics.state();
      }, point);
      await page.waitForFunction(() => window.playtestRendered(), undefined, {
        timeout: 60000,
        polling: 100,
      });
      const capture = await cdp.send("Page.captureScreenshot", {
        format: "jpeg",
        quality: 85,
        captureBeyondViewport: false,
      });
      const filename = `${course.id}-${point.name}.jpg`;
      await writeFile(resolve(output, filename), Buffer.from(capture.data, "base64"));
      captures.push({ ...point, filename, state });
    }
    // Pause/resume and item presentation are checked in the real renderer.
    const lifecycle = await page.evaluate(() => {
      const d = window.__turboTrailDiagnostics;
      d.send({ type: "test-pause", value: true });
      const before = d.state().raceTime;
      d.send({ type: "test-step", seconds: 1 });
      const paused = d.state().raceTime === before;
      d.send({ type: "test-pause", value: false });
      d.send({ type: "test-seek", t: 0.02 });
      for (const item of ["mushroom", "star", "red", "green", "banana"]) {
        d.send({ type: "test-item", item });
        d.send({ type: "test-fire" });
        d.send({ type: "test-step", seconds: 0.2 });
      }
      d.send({ type: "test-report" });
      return { paused, resumed: d.state().raceTime > before };
    });
    const report = { course: course.id, errors, race, captures, lifecycle };
    reports.push(report);
    await writeFile(resolve(output, `${course.id}.json`), JSON.stringify(report, null, 2));
    console.log(
      JSON.stringify({
        course: course.id,
        finished: race.final.finished,
        seconds: race.final.raceTime,
        recoveries: race.final.recoveryCount,
        captures: captures.length,
        errors,
        lifecycle,
      }),
    );
    await page.close();
  }
} finally {
  await browser.close();
}
await writeFile(resolve(output, "report.json"), JSON.stringify(reports, null, 2));
if (
  reports.some(
    (r) => r.errors.length || !r.race.final.finished || !r.lifecycle.paused || !r.lifecycle.resumed,
  )
)
  process.exitCode = 1;
