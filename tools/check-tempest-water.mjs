#!/usr/bin/env node
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

// Exercise native WebGPU pipelines, repeatable race clocks and all quality tiers.
const require = createRequire(import.meta.url);
let playwright;
for (const path of [
  process.env.PLAYWRIGHT_MODULE,
  "playwright",
  "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
].filter(Boolean)) {
  try {
    playwright = require(path);
    break;
  } catch {
    /* Try installed runtime. */
  }
}
if (!playwright) throw new Error("Set PLAYWRIGHT_MODULE to an installed Playwright module.");
const port = Number(process.env.TEMPEST_CHECK_PORT || 5173),
  origin = `http://127.0.0.1:${port}`;
let server, browser;
try {
  let ready = false;
  try {
    ready = (await fetch(origin)).ok;
  } catch {
    /* Start a static server. */
  }
  if (!ready) {
    server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
      cwd: new URL("..", import.meta.url),
      stdio: "ignore",
    });
    for (let i = 0; i < 50 && !ready; i++) {
      try {
        ready = (await fetch(origin)).ok;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    if (!ready) throw new Error("Local test server did not start.");
  }
  browser = await playwright.chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--use-angle=swiftshader",
      "--enable-unsafe-webgpu",
      "--enable-features=Vulkan",
      "--use-vulkan=swiftshader",
    ],
  });
  const page = await browser.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/__tempest_water_check", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Tempest water check</title>",
    }),
  );
  await page.goto(`${origin}/__tempest_water_check`);
  await page.addScriptTag({
    type: "importmap",
    content: JSON.stringify({
      imports: {
        "three/webgpu": "/vendor/three/three.webgpu.js",
        "three/tsl": "/vendor/three/three.tsl.js",
      },
    }),
  });
  const report = await page.evaluate(async () => {
    const THREE = await import("/vendor/three/three.module.js");
    const { createStormSea } = await import("/src/courses/adventure/tempest-sea.js");
    const { createCourseEnvironments } = await import("/src/rendering/reflection-environments.js");
    const course = (await import("/src/courses/tempest-causeway.js")).default;
    const { createWebGPURenderer } = await import("/src/rendering/webgpu-renderer.js");
    const { RenderTarget } = await import("/vendor/three/three.webgpu.js");
    const renderer = await createWebGPURenderer({ antialias: false });
    const device = renderer.backend.device;
    device.pushErrorScope("validation");
    renderer.info.autoReset = false;
    renderer.setSize(320, 180);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = course.theme.exposure;
    const environments = createCourseEnvironments(renderer, course.theme);
    const scene = new THREE.Scene();
    scene.environment = environments.exterior;
    scene.background = new THREE.Color(course.theme.sky);
    scene.fog = new THREE.Fog(course.theme.fog, 120, 850);
    scene.add(new THREE.HemisphereLight(course.theme.hemisphere, course.theme.ambientGround, 0.8));
    const sun = new THREE.DirectionalLight(course.theme.sun, 1.7);
    sun.position.set(...course.theme.sunPosition);
    scene.add(sun);
    const sea = createStormSea(scene);
    scene.add(sea.ocean);
    sea.addShore(0, 0, 18);
    const target = new RenderTarget(320, 180);
    const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 1200),
      results = [];
    async function frame(time) {
      renderer.info.reset();
      sea.update(time);
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      const pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 320, 180);
      let hash = 2166136261;
      for (const value of pixels) hash = Math.imul(hash ^ value, 16777619);
      return {
        hash,
        draws: renderer.info.render.drawCalls,
        triangles: renderer.info.render.triangles,
      };
    }
    for (const tier of [0, 1, 2, 3]) {
      sea.setQuality(tier);
      for (const position of [
        [0, 8, 60],
        [0, 2, 180],
        [-250, 40, 400],
      ]) {
        camera.position.set(...position);
        camera.lookAt(0, -10, 0);
        renderer.setRenderTarget(target);
        await renderer.compileAsync(scene, camera);
        const frames = [];
        for (const time of [0, 4, 4, 0]) frames.push(await frame(time));
        if (
          frames[0].hash === frames[1].hash ||
          frames[1].hash !== frames[2].hash ||
          frames[0].hash !== frames[3].hash
        )
          throw new Error(`Tier ${tier}: motion/freeze/rewind failed`);
        if (frames.some((f) => f.draws !== 1 || f.triangles > (tier === 0 ? 32768 : 73728)))
          throw new Error(`Tier ${tier}: water rendering budget exceeded`);
        results.push({ tier, position, frames });
      }
    }
    await device.queue.onSubmittedWorkDone();
    const validation = await device.popErrorScope();
    if (validation) throw new Error(validation.message);
    const programs = { backend: renderer.backend.isWebGPUBackend };
    const textures = renderer.info.memory.textures;
    sea.ocean.geometry.dispose();
    sea.ocean.material.dispose();
    target.dispose();
    environments.dispose();
    renderer.dispose();
    return { results, programs, textures };
  });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(JSON.stringify({ ...report, errors }, null, 2));
} finally {
  await browser?.close();
  server?.kill();
}
