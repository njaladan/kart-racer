#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

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
    /* Try the next installation. */
  }
}
if (!playwright) throw new Error("Set PLAYWRIGHT_MODULE to an installed Playwright module.");
const port = Number(process.env.MEADOW_CHECK_PORT || 5174);
const origin = `http://127.0.0.1:${port}`;
let server, browser;
try {
  server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
    cwd: new URL("..", import.meta.url),
    stdio: "ignore",
  });
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) {
    try {
      ready = (await fetch(origin)).ok;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  if (!ready) throw new Error("Meadow check server did not start.");
  browser = await playwright.chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(origin);
  const result = await page.evaluate(async () => {
    const THREE = await import("/vendor/three/three.module.js");
    const { createPostProcessing } = await import("/src/rendering/postprocessing.js");
    const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
    renderer.setSize(320, 180);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.info.autoReset = false;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#bad7e3");
    scene.add(new THREE.HemisphereLight("#ffffff", "#b6bfa9", 2));
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshStandardMaterial({ color: "#829d65", roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshStandardMaterial({ color: "#c9b49a", roughness: 0.8 }),
    );
    box.position.y = 1;
    scene.add(box);
    const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 100);
    camera.position.set(4, 4, 6);
    camera.lookAt(0, 0.5, 0);
    const post = createPostProcessing(renderer, { gtao: { strength: 0.6 } });
    function frame(tier, enabled = true, width = 320, height = 180) {
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      post.setOptions({ bloom: false, ambientOcclusion: enabled });
      post.setQuality(tier);
      renderer.info.reset();
      post.render(scene, camera);
      const pixels = new Uint8Array(width * height * 4);
      renderer.getContext().readPixels(0, 0, width, height, 6408, 5121, pixels);
      return {
        pixels,
        calls: renderer.info.render.calls,
        textures: renderer.info.memory.textures,
        error: renderer.getContext().getError(),
      };
    }
    const off = frame(2, false),
      on = frame(2),
      repeat = frame(2);
    let changed = 0,
      darker = 0,
      skyChanged = 0,
      repeatChanged = 0;
    for (let i = 0; i < off.pixels.length; i += 4) {
      const difference = on.pixels[i] - off.pixels[i];
      if (Math.abs(difference) > 1) changed++;
      if (difference < -1) darker++;
      if (i >= 320 * 170 * 4 && Math.abs(difference) > 1) skyChanged++;
      if (on.pixels[i] !== repeat.pixels[i]) repeatChanged++;
    }
    const ultra = frame(3, true, 390, 240);
    const balanced = frame(1, true, 390, 240);
    const highAgain = frame(2, true, 390, 240);
    const performance = frame(0);
    const programs = renderer.info.programs.map((program) => program.diagnostics?.runnable ?? true);
    const report = {
      changed,
      darker,
      skyChanged,
      repeatChanged,
      programs,
      frames: [off, on, repeat, ultra, balanced, highAgain, performance].map(
        ({ pixels, ...rest }) => rest,
      ),
    };
    post.dispose();
    box.geometry.dispose();
    box.material.dispose();
    floor.geometry.dispose();
    floor.material.dispose();
    report.remainingTextures = renderer.info.memory.textures;
    renderer.dispose();
    return report;
  });
  assert.deepEqual(errors, []);
  assert.ok(result.programs.every(Boolean), "all GTAO shaders compile");
  assert.ok(result.changed > 100 && result.darker > 100, "GTAO visibly shades the contact fixture");
  assert.equal(result.skyChanged, 0, "sky stays clear of AO");
  assert.equal(result.repeatChanged, 0, "paused AO has no changing noise");
  assert.equal(result.frames[1].calls - result.frames[0].calls, 2, "AO adds two fullscreen draws");
  assert.equal(
    result.frames[4].textures,
    result.frames[3].textures - 4,
    "Balanced releases AO buffers",
  );
  assert.equal(result.frames[6].calls, 2, "Performance renders only the two scene meshes");
  assert.ok(
    result.frames.every(({ error }) => error === 0),
    "no WebGL errors across resize/tier switches",
  );
  assert.equal(result.remainingTextures, 0, "all postprocessing textures are released");
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  server?.kill();
}
