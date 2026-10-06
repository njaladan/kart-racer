#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { COURSES } from "../src/courses/registry.js";

const require = createRequire(import.meta.url);
const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const screenshotDir = resolve(repoRoot, "docs/screenshots");
const courseCaptures = [
  { id: "windmill-wilds", racer: "tux" },
  { id: "neon-harbor", racer: "kiki", t: 0.15, seconds: 12 },
  { id: "sunstone-ruins", racer: "nolok", t: 0.655, seconds: 12 },
  { id: "frostpeak-festival", racer: "konqi" },
  { id: "clockwork-citadel", racer: "kiki", t: 0.265, seconds: 18 },
  { id: "paper-revel", racer: "pidgin", t: 0.4, seconds: 31 },
  { id: "tempest-causeway", racer: "konqi", t: 0.24, seconds: 18 },
  { id: "pocket-pantry", racer: "wilber", t: 0.35, seconds: 18 },
  { id: "railstorm-express", racer: "nolok", t: 0.4974, seconds: 18 },
  { id: "metronome-hall", racer: "kiki", t: 0.39, seconds: 14 },
  { id: "pelagic-glasshouse", racer: "konqi", t: 0.42, seconds: 25 },
  { id: "emberwing-observatory", racer: "pidgin", t: 0.3785, seconds: 18 },
];
const courses = process.argv.slice(2).length ? process.argv.slice(2) : COURSES.map(({ id }) => id);
const port = Number(process.env.SCREENSHOT_CAPTURE_PORT || 5173);
const baseUrl = `http://127.0.0.1:${port}`;
const captureAtSeconds = Number(process.env.SCREENSHOT_CAPTURE_AT_SECONDS || 2);
const timeoutMs = Number(process.env.SCREENSHOT_CAPTURE_TIMEOUT_MS || 60_000);

function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    "playwright",
    "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // Try the next installed Playwright location.
    }
  }

  throw new Error(
    "Playwright was not found. Install it with `npm install --no-save --no-package-lock playwright` or set PLAYWRIGHT_MODULE to its installed module path.",
  );
}

async function gameServerIsReady() {
  try {
    const response = await fetch(baseUrl);
    return response.ok && (await response.text()).includes("Turbo Trail");
  } catch {
    return false;
  }
}

async function startServer() {
  if (await gameServerIsReady()) return null;

  const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
    cwd: repoRoot,
    stdio: "ignore",
  });

  for (let attempt = 0; attempt < 100; attempt++) {
    if (await gameServerIsReady()) return server;
    if (server.exitCode !== null) break;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }

  server.kill();
  throw new Error(`Could not start Turbo Trail at ${baseUrl}.`);
}

async function captureCourse(browserContext, courseId) {
  const course = courseCaptures.find(({ id }) => id === courseId);
  if (!course) {
    throw new Error(
      `Unknown course "${courseId}". Choose: ${courseCaptures.map(({ id }) => id).join(", ")}.`,
    );
  }

  const page = await browserContext.newPage();
  const deadline = setTimeout(() => page.close().catch(() => {}), timeoutMs);
  await page.addInitScript(() => {
    localStorage.setItem(
      "turbo-trail-preferences-v1",
      JSON.stringify({ quality: 2, adaptive: false }),
    );
    const request = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      request((time) => {
        if (window.captureFramesRemaining !== undefined && window.captureFramesRemaining-- <= 0)
          return;
        callback(time);
      });
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  try {
    await page.goto(`${baseUrl}/?course=${course.id}&racer=${course.racer}&test&benchmark`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(
      () => {
        const button = document.querySelector("#start-button");
        return button && !button.disabled;
      },
      undefined,
      { timeout: 90_000 },
    );

    if (course.t != null) {
      await page.waitForFunction(
        () => typeof window.__turboTrailDiagnostics?.send === "function",
        undefined,
        { timeout: timeoutMs },
      );
      const state = await page.evaluate(({ t, seconds }) => {
        const diagnostics = window.__turboTrailDiagnostics;
        diagnostics.send({ type: "test-start" });
        diagnostics.send({ type: "test-freeze", value: true });
        diagnostics.send({ type: "test-step", seconds: 0.1 });
        for (let remaining = seconds; remaining > 0; remaining -= 5)
          diagnostics.send({ type: "test-step", seconds: Math.min(5, remaining) });
        diagnostics.send({ type: "test-seek", t });
        const state = diagnostics.state();
        diagnostics.send({ type: "test-report" });
        window.captureFramesRemaining = 3;
        return state;
      }, course);
      const expectedProgress = course.t * 2400;
      if (Math.abs(state.s - expectedProgress) > 0.5)
        throw new Error(
          `${course.id}: seek state mismatch (s=${state.s}, expected ${expectedProgress}).`,
        );
      console.log(
        `${course.id} seek state: s=${state.s.toFixed(1)}, position=${state.position.map((value) => value.toFixed(2)).join(",")}, camera=${state.camera.map((value) => value.toFixed(2)).join(",")}, kart=${state.kart.map((value) => value.toFixed(2)).join(",")}`,
      );
      await page.waitForFunction(() => window.captureFramesRemaining < 0, undefined, {
        timeout: timeoutMs,
        polling: 100,
      });
    } else {
      // The benchmark start removes the countdown delay. Let the normal render
      // loop, camera, and keyboard input advance the race; don't send test-step.
      await page.evaluate(() => window.postMessage({ type: "test-start" }, location.origin));
      await page.waitForTimeout(100);
      await page.keyboard.down("w");

      try {
        await page.waitForFunction(
          (targetSeconds) => {
            const text = document.querySelector("#timer")?.textContent?.trim() || "";
            const match = text.match(/^(\d{2}):(\d{2})\.(\d{2})$/);
            if (!match) return false;
            const [, minutes, seconds, hundredths] = match;
            return (
              Number(minutes) * 60 + Number(seconds) + Number(hundredths) / 100 >= targetSeconds
            );
          },
          captureAtSeconds,
          { timeout: timeoutMs, polling: 100 },
        );
      } finally {
        await page.keyboard.up("w").catch(() => {});
      }
    }
    const cdp = await browserContext.newCDPSession(page);
    const screenshot = await cdp.send("Page.captureScreenshot", {
      format: "jpeg",
      quality: 93,
      captureBeyondViewport: false,
    });
    const output = resolve(screenshotDir, `${course.id}.jpg`);
    await writeFile(output, Buffer.from(screenshot.data, "base64"));
    console.log(`Saved ${output}`);
  } catch (error) {
    const detail = errors.length ? `\nBrowser errors: ${errors.join("; ")}` : "";
    throw new Error(`${course.id}: ${error.message}${detail}`, { cause: error });
  } finally {
    clearTimeout(deadline);
    await page.close();
  }
}

async function main() {
  const { chromium } = loadPlaywright();
  const server = await startServer();
  const chromiumPath = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(existsSync(chromiumPath) ? { executablePath: chromiumPath } : {}),
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-angle=swiftshader"],
    });
    const context = await browser.newContext({
      viewport: {
        width: Number(process.env.SCREENSHOT_CAPTURE_WIDTH || 960),
        height: Number(process.env.SCREENSHOT_CAPTURE_HEIGHT || 540),
      },
      deviceScaleFactor: 1,
    });
    for (const course of courses) await captureCourse(context, course);
    await context.close();
  } finally {
    await browser?.close();
    server?.kill();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
