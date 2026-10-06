#!/usr/bin/env node
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

// Screenshot-free GPU readback: local palettes, compiled surfaces and exact clocks.
const require = createRequire(import.meta.url);
let playwright;
for (const candidate of [
  process.env.PLAYWRIGHT_MODULE,
  "playwright",
  "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
].filter(Boolean)) {
  try {
    playwright = require(candidate);
    break;
  } catch {
    /* Try the next local installation. */
  }
}
if (!playwright) throw new Error("Set PLAYWRIGHT_MODULE to an installed Playwright module.");
const port = Number(process.env.ENVIRONMENT_CHECK_PORT || 5173),
  origin = `http://127.0.0.1:${port}`;
let server, browser;
try {
  let ready = false;
  try {
    ready = (await fetch(origin)).ok;
  } catch {
    /* Start a local server below. */
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
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/__environment_check", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Environment effects check</title>",
    }),
  );
  await page.goto(`${origin}/__environment_check`);
  const deadline = setTimeout(() => page.close().catch(() => {}), 60_000);
  const result = await page.evaluate(async () => {
    const THREE = await import("/vendor/three/three.module.js"),
      { COURSES } = await import("/src/courses/registry.js"),
      { selectCourse } = await import("/src/track/track.js"),
      { buildCourseEnvironment } = await import("/src/courses/course-environment.js");
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(192, 128);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const target = new THREE.WebGLRenderTarget(192, 128),
      pixels = new Uint8Array(192 * 128 * 4),
      camera = new THREE.PerspectiveCamera(50, 1.5, 0.1, 300),
      reports = [];
    function sample(scene) {
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.readRenderTargetPixels(target, 0, 0, 192, 128, pixels);
      let hash = 2166136261,
        light = 0;
      for (let i = 0; i < pixels.length; i++) {
        hash = Math.imul(hash ^ pixels[i], 16777619);
        if (i % 4 !== 3) light += pixels[i];
      }
      return {
        hash,
        light,
        draws: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      };
    }
    for (const course of COURSES) {
      const scene = new THREE.Scene(),
        track = selectCourse(course),
        material = new THREE.MeshStandardMaterial({ color: course.theme.road, roughness: 0.55 });
      scene.fog = new THREE.Fog("#263649", 50, 200);
      scene.add(new THREE.HemisphereLight("#d9e9ff", "#726477", 2));
      const sun = new THREE.DirectionalLight("#fff0cf", 2);
      sun.position.set(20, 30, 10);
      scene.add(sun);
      const environment = buildCourseEnvironment({ scene, track, surfaces: [material] }),
        first = environment.fields[0].object,
        center = first.geometry.boundingSphere.center.clone().add(first.position),
        ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), material);
      ground.rotation.x = -Math.PI / 2;
      ground.position.copy(center);
      ground.position.y = first.position.y - 0.1;
      scene.add(ground);
      camera.position.copy(center).add(new THREE.Vector3(0, 4, 70));
      camera.lookAt(center);
      // compile() exercises fields outside this one small camera view as well.
      renderer.compile(scene, camera);
      const frames = [];
      for (const time of [0, 4, 4, 0]) {
        environment.update(time);
        frames.push(sample(scene));
      }
      if (
        !frames[0].light ||
        frames[0].hash === frames[1].hash ||
        frames[1].hash !== frames[2].hash ||
        frames[0].hash !== frames[3].hash
      )
        throw new Error(`${course.id}: motion/freeze/rewind readback failed`);
      environment.update(12, { motionEnabled: false });
      if (sample(scene).hash !== frames[0].hash)
        throw new Error(`${course.id}: motion preference failed`);
      environment.setQuality(0);
      const reduced = environment.fields.reduce(
        (sum, field) => sum + field.object.geometry.instanceCount,
        0,
      );
      environment.setQuality(3);
      const full = environment.fields.reduce(
        (sum, field) => sum + field.object.geometry.instanceCount,
        0,
      );
      if (reduced >= full) throw new Error(`${course.id}: quality density did not decrease`);
      const programs = renderer.info.programs.map((program) => ({
        runnable: program.diagnostics?.runnable ?? true,
      }));
      if (programs.some((program) => !program.runnable))
        throw new Error(`${course.id}: shader compilation failed`);
      reports.push({
        course: course.id,
        fields: environment.fields.length,
        full,
        reduced,
        frames,
        programs,
      });
      // Resources are independent of the playable world's asset cache.
      const geometries = new Set(),
        materials = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material)
          for (const entry of Array.isArray(object.material) ? object.material : [object.material])
            materials.add(entry);
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((entry) => entry.dispose());
    }
    const programs = reports.flatMap((report) => report.programs);
    target.dispose();
    renderer.dispose();
    return { reports, programs };
  });
  clearTimeout(deadline);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(JSON.stringify({ ...result, errors }, null, 2));
} finally {
  await browser?.close();
  server?.kill();
}
