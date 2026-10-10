#!/usr/bin/env node
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const output = resolve(process.env.SUNSTONE_CHECK_OUTPUT || "/tmp/sunstone-lighting-check");
await mkdir(output, { recursive: true });
const baseline = process.env.SUNSTONE_BASELINE_DIR;
const tiers = JSON.parse(process.env.SUNSTONE_CHECK_TIERS || "[2]");
const views = JSON.parse(
  process.env.SUNSTONE_CHECK_VIEWS ||
    '[{"name":"oasis","t":0.08},{"name":"canyon","t":0.235},{"name":"procession","t":0.527},{"name":"temple-entry","t":0.645},{"name":"temple","t":0.675},{"name":"courtyard","t":0.787},{"name":"dunes","t":0.89}]',
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-angle=swiftshader"],
});
const results = [];
try {
  for (const stage of baseline ? ["before", "after"] : ["after"])
    for (const tier of tiers) {
      const context = await browser.newContext({
        viewport: { width: 960, height: 540 },
        deviceScaleFactor: 1,
      });
      await context.addInitScript((quality) => {
        localStorage.setItem(
          "turbo-trail-preferences-v1",
          JSON.stringify({ quality, adaptive: false, bloom: true, motion: true }),
        );
        let seed = 7311;
        Math.random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
        const nativeRequest = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (callback) =>
          nativeRequest((time) => {
            if (!window.sunstoneStopFrames) callback(time);
          });
      }, tier);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      if (stage === "before")
        await page.route(/\/src\/|\/assets\/lighting\/sunstone-ruins\//, async (route) => {
          const path = new URL(route.request().url()).pathname;
          try {
            const body = await readFile(resolve(baseline, `.${path}`));
            await route.fulfill({
              body,
              contentType: path.endsWith(".js")
                ? "application/javascript"
                : path.endsWith(".json")
                  ? "application/json"
                  : path.endsWith(".png")
                    ? "image/png"
                    : "application/octet-stream",
            });
          } catch {
            await route.continue();
          }
        });
      await page.goto(
        `${process.env.SUNSTONE_CHECK_URL || "http://127.0.0.1:5173"}/?course=sunstone-ruins&racer=nolok&test&benchmark`,
        { waitUntil: "domcontentloaded", timeout: 120000 },
      );
      await page.waitForFunction(
        () =>
          window.__turboTrailDiagnostics?.context &&
          !document.querySelector("#start-button").disabled,
        undefined,
        { timeout: 240000 },
      );
      await page.evaluate(() => {
        const diagnostics = window.__turboTrailDiagnostics;
        diagnostics.send({ type: "test-start" });
        diagnostics.send({ type: "test-freeze", value: true });
        diagnostics.send({ type: "test-step", seconds: 0.1 });
        diagnostics.send({ type: "test-step", seconds: 5 });
        diagnostics.send({ type: "test-step", seconds: 5 });
        diagnostics.send({ type: "test-step", seconds: 2 });
        window.sunstoneStopFrames = true;
      });
      for (const view of views) {
        const result = await page.evaluate(
          ({ t, stage, tier, name }) => {
            const diagnostics = window.__turboTrailDiagnostics;
            diagnostics.send({ type: "test-seek", t });
            const { scene, renderer, gameRenderer } = diagnostics.context;
            const gl = renderer.getContext();
            for (let i = 0; i < 2; i++) {
              gameRenderer.render(0);
              gl.finish();
            }
            const samples = [];
            for (let i = 0; i < 5; i++) {
              const start = performance.now();
              gameRenderer.render(0);
              gl.finish();
              samples.push(performance.now() - start);
            }
            samples.sort((a, b) => a - b);
            const debug = gl.getExtension("WEBGL_debug_renderer_info");
            let passes = 0;
            const render = renderer.render;
            renderer.render = function (...args) {
              passes++;
              return render.apply(this, args);
            };
            gameRenderer.render(0);
            gl.finish();
            renderer.render = render;
            let atlasVertices = 0;
            scene.traverse((object) => {
              atlasVertices += object.isMesh
                ? object.geometry.attributes.surfaceLightUv?.count || 0
                : 0;
            });
            return {
              stage,
              tier,
              name,
              t,
              medianMs: samples[2],
              samples,
              drawCalls: renderer.info.render.calls,
              triangles: renderer.info.render.triangles,
              textures: renderer.info.memory.textures,
              geometries: renderer.info.memory.geometries,
              passes,
              atlasVertices,
              atlas: scene.userData.surfaceLightmap,
              gi: scene.userData.globalIllumination,
              meshCoverage: scene.userData.meshLightCoverage?.coverage,
              mismatchReasons: scene.userData.meshLightCoverage?.mismatches.slice(0, 8),
              renderer: debug
                ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
                : gl.getParameter(gl.RENDERER),
            };
          },
          { ...view, stage, tier },
        );
        results.push(result);
        await page.screenshot({ path: resolve(output, `${stage}-${tier}-${view.name}.png`) });
        console.log(
          JSON.stringify({
            stage,
            tier,
            name: view.name,
            medianMs: result.medianMs,
            drawCalls: result.drawCalls,
            triangles: result.triangles,
            passes: result.passes,
          }),
        );
        if (errors.length) throw new Error(errors.join("\n"));
      }
      if (stage === "after") {
        const diagnostic = await page.evaluate(() => {
          const { scene, renderer, gameRenderer } = window.__turboTrailDiagnostics.context;
          const metadata = scene.userData.globalIllumination;
          if (!metadata) throw new Error("Sunstone GI did not install");
          if (metadata.architecture.charts !== scene.userData.surfaceLightmap.charts)
            throw new Error("Architecture atlas chart mismatch");
          scene.userData.globalIlluminationUniforms.giEnabled.value = 0;
          scene.userData.courseBakeUniforms.courseBakeEnabled.value = 0;
          gameRenderer.render(0);
          const gl = renderer.getContext();
          const readPixels = () => {
            gameRenderer.render(0);
            const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
            gl.readPixels(
              0,
              0,
              gl.drawingBufferWidth,
              gl.drawingBufferHeight,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              pixels,
            );
            return pixels;
          };
          const off = readPixels();
          scene.userData.globalIlluminationUniforms.giEnabled.value = 1;
          scene.userData.courseBakeUniforms.courseBakeEnabled.value = 1;
          const on = readPixels();
          let changed = 0,
            difference = 0;
          for (let i = 0; i < off.length; i += 4) {
            const delta =
              Math.abs(off[i] - on[i]) +
              Math.abs(off[i + 1] - on[i + 1]) +
              Math.abs(off[i + 2] - on[i + 2]);
            changed += delta > 12;
            difference += delta;
          }
          return { changedPixels: changed, meanRgbDifference: difference / ((off.length / 4) * 3) };
        });
        results.push({ stage, tier, bakeToggle: diagnostic });
        if (diagnostic.changedPixels < 500)
          throw new Error("Baked illumination has no visible pixel contribution");
      }
      await context.close();
    }
} finally {
  await writeFile(resolve(output, "report.json"), JSON.stringify(results, null, 2) + "\n");
  await browser.close();
}
