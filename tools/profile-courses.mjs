#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { COURSES } from "../src/courses/registry.js";

const require = createRequire(import.meta.url);
let chromium;
for (const candidate of [
  process.env.PLAYWRIGHT_MODULE,
  "playwright",
  join(
    homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
].filter(Boolean)) {
  try {
    ({ chromium } = require(candidate));
    break;
  } catch {
    /* Try the next installed runtime. */
  }
}
if (!chromium) throw new Error("Set PLAYWRIGHT_MODULE to an installed Playwright module.");
const output = resolve(process.env.PROFILE_OUTPUT || "/tmp/kart-profile");
await mkdir(output, { recursive: true });
const compare = process.env.PROFILE_COMPARE === "1";
const stages = compare
  ? ["before", "after"]
  : [process.env.PROFILE_BASELINE === "1" ? "before" : "after"];
const baseRef = process.env.PROFILE_BASE_REF || "HEAD";
const originals = new Map();
if (stages.includes("before")) {
  for (const file of [
    "game.js",
    "rendering/baked-lighting.js",
    "rendering/scenery-lod.js",
    "rendering/visuals.js",
    "rendering/course-kit.js",
    "rendering/layered-lighting.js",
    "rendering/sky.js",
  ])
    originals.set(
      file,
      execFileSync("git", ["show", `${baseRef}:src/${file}`], { encoding: "utf8" }),
    );
}
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: process.env.PROFILE_HEADLESS !== "0",
  args: ["--use-angle=metal"],
});
const context = await browser.newContext({
  viewport: {
    width: Number(process.env.PROFILE_WIDTH || 1280),
    height: Number(process.env.PROFILE_HEIGHT || 800),
  },
  deviceScaleFactor: 2,
});
await context.addInitScript(() => {
  if (location.protocol === "http:" || location.protocol === "https:")
    localStorage.setItem(
      "turbo-trail-preferences-v1",
      JSON.stringify({ quality: 3, adaptive: false, bloom: true, motion: true }),
    );
  let seed = 8127;
  Math.random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
});
const reports = [];
try {
  for (const course of COURSES.filter(
    (course) => !process.argv.slice(2).length || process.argv.slice(2).includes(course.id),
  )) {
    for (const stage of stages) {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      if (stage === "before") {
        for (const [file, body] of originals)
          await page.route(`**/src/${file}`, (route) =>
            route.fulfill({ body, contentType: "application/javascript" }),
          );
      }
      await page.goto(
        `${process.env.PROFILE_URL || "http://127.0.0.1:5173"}/?course=${course.id}&test&benchmark`,
        { waitUntil: "domcontentloaded", timeout: 120000 },
      );
      await page.waitForFunction(
        () =>
          window.__turboTrailDiagnostics?.context &&
          !document.querySelector("#start-button").disabled,
        undefined,
        { timeout: 240000, polling: 250 },
      );
      const hardware = await page.evaluate(() => {
        const { renderer, gameRenderer, scene } = window.__turboTrailDiagnostics.context;
        const gl = renderer.getContext();
        const debug = gl.getExtension("WEBGL_debug_renderer_info");
        window.profileSamples = [];
        window.profileActive = false;
        const render = gameRenderer.render;
        const draw = renderer.render.bind(renderer);
        // GPU timer queries are deliberately omitted: ANGLE/Metal may report
        // whole command-buffer times for each pass, and queries perturb pacing.
        renderer.render = (drawScene, camera) => {
          const sample = window.profileCurrent;
          const start = performance.now();
          draw(drawScene, camera);
          if (sample)
            sample.passes.push({
              name:
                drawScene === scene
                  ? camera === window.__turboTrailDiagnostics.context.camera
                    ? "scene"
                    : "reflection"
                  : "post",
              cpuMs: performance.now() - start,
            });
        };
        gameRenderer.render = (dt) => {
          const start = performance.now();
          const sample = window.profileActive ? { at: start, passes: [] } : null;
          window.profileCurrent = sample;
          render(dt);
          window.profileCurrent = null;
          if (sample) {
            Object.assign(sample, {
              cpuMs: performance.now() - start,
              draws: renderer.info.render.calls,
              triangles: renderer.info.render.triangles,
            });
            window.profileSamples.push(sample);
          }
        };
        let objects = 0,
          meshes = 0;
        const opaqueWithoutDepth = [];
        scene.traverse((object) => {
          objects++;
          meshes += !!object.isMesh;
          if (!object.isMesh || object.name.startsWith("Layered painted sky")) return;
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            if (!material.transparent && !material.depthWrite) opaqueWithoutDepth.push(object.name);
        });
        const d = window.__turboTrailDiagnostics;
        d.send({ type: "test-freeze", value: true });
        d.send({ type: "test-start" });
        d.send({ type: "test-step", seconds: 0.1 });
        return {
          gpu: debug
            ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
            : gl.getParameter(gl.RENDERER),
          objects,
          meshes,
          width: gl.drawingBufferWidth,
          height: gl.drawingBufferHeight,
          pixelRatio: renderer.getPixelRatio(),
          meshLighting: scene.userData.meshLightCoverage?.coverage,
          optimizations: scene.userData.sceneryPerformance,
          opaqueWithoutDepth,
        };
      });
      console.log(`${course.id} ${stage}: ${hardware.width}x${hardware.height}, ${hardware.gpu}`);
      const points = process.env.PROFILE_POINTS
        ? JSON.parse(process.env.PROFILE_POINTS)
        : [0.15, 0.5, 0.8];
      const samples = [];
      for (const t of points) {
        await page.evaluate((t) => {
          const d = window.__turboTrailDiagnostics;
          d.send({ type: "test-pause", value: false });
          d.send({ type: "test-seek", t });
          d.context.scene.traverse((object) => {
            if (object.isLOD)
              object.levels.forEach((level, i) => {
                level.object.visible = i === 0;
              });
          });
        }, t);
        await page.waitForTimeout(Number(process.env.PROFILE_WARMUP || 3000));
        await page.evaluate(() => {
          window.profileSamples = [];
          window.profileActive = true;
        });
        await page.waitForTimeout(Number(process.env.PROFILE_DURATION || 5000));
        const sample = await page.evaluate((t) => {
          window.profileActive = false;
          const rows = window.profileSamples;
          const percentile = (values, p) =>
            values.sort((a, b) => a - b)[
              Math.min(values.length - 1, Math.floor(values.length * p))
            ] ?? null;
          const mean = (values) =>
            values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
          const intervals = rows.slice(1).map((row, i) => row.at - rows[i].at);
          const passes = Object.fromEntries(
            ["scene", "reflection", "post"].map((name) => [
              name,
              mean(
                rows.map((row) =>
                  row.passes
                    .filter((pass) => pass.name === name)
                    .reduce((sum, pass) => sum + pass.cpuMs, 0),
                ),
              ),
            ]),
          );
          return {
            t,
            frames: rows.length,
            fps: 1000 / mean(intervals),
            frameP95: percentile(intervals, 0.95),
            cpuMs: mean(rows.map((row) => row.cpuMs)),
            cpuP95: percentile(
              rows.map((row) => row.cpuMs),
              0.95,
            ),
            passes,
            draws: mean(rows.map((row) => row.draws)),
            triangles: mean(rows.map((row) => row.triangles)),
          };
        }, t);
        samples.push(sample);
        console.log(JSON.stringify({ course: course.id, stage, ...sample }));
        if (process.env.PROFILE_VISUALS === "1") {
          await page.evaluate((t) => {
            const d = window.__turboTrailDiagnostics;
            d.send({ type: "test-pause", value: true });
            d.send({ type: "test-seek", t });
            d.context.scene.traverse((object) => {
              if (object.isLOD)
                object.levels.forEach((level, i) => {
                  level.object.visible = i === 0;
                });
            });
            for (let i = 0; i < 12; i++) d.context.gameRenderer.render(0);
          }, t);
          await page.screenshot({
            path: resolve(output, `${course.id}-${stage}-${t}.png`),
            timeout: 60000,
          });
        }
      }
      if (process.env.PROFILE_TRACE === "1") {
        await page.evaluate(() =>
          window.__turboTrailDiagnostics.send({ type: "test-pause", value: false }),
        );
        const cdp = await context.newCDPSession(page);
        await cdp.send("Profiler.enable");
        await cdp.send("Profiler.start");
        await page.waitForTimeout(3000);
        const { profile } = await cdp.send("Profiler.stop");
        await writeFile(
          resolve(output, `${course.id}-${stage}.cpuprofile`),
          JSON.stringify(profile),
        );
        await cdp.detach();
      }
      reports.push({ course: course.id, stage, hardware, samples, errors });
      await writeFile(resolve(output, "report.json"), JSON.stringify(reports, null, 2));
      await page.close();
      if (errors.length) console.error(errors);
    }
  }
} finally {
  await browser.close();
}
