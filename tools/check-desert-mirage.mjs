#!/usr/bin/env node
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-angle=swiftshader"],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/__desert_mirage_check", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Desert mirage pixel check</title>",
    }),
  );
  await page.goto("http://127.0.0.1:5173/__desert_mirage_check");
  const results = await page.evaluate(async () => {
    const THREE = await import("/vendor/three/three.module.js");
    const { createPostProcessing } = await import("/src/rendering/postprocessing.js");
    const { createDesertMirageClock, installDesertMirage } =
      await import("/src/rendering/desert-mirage.js");
    const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    const width = 512,
      height = 320;
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.NeutralToneMapping;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#b7cfdb");
    const camera = new THREE.PerspectiveCamera(63, width / height, 0.1, 1400);
    const backdrop = new THREE.PlaneGeometry(1800, 900, 180, 90);
    const colors = [],
      p = backdrop.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const light = (Math.floor((p.getX(i) + 900) / 30) + Math.floor((p.getY(i) + 450) / 30)) % 2;
      colors.push(...(light ? [0.76, 0.68, 0.5] : [0.13, 0.17, 0.21]));
    }
    backdrop.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const plain = new THREE.MeshBasicMaterial({ vertexColors: true });
    const distorted = new THREE.MeshBasicMaterial({ vertexColors: true });
    const clock = createDesertMirageClock();
    installDesertMirage(distorted, {}, clock);
    const far = new THREE.Mesh(backdrop, distorted);
    far.position.z = -950;
    scene.add(far);
    const nearMaterial = new THREE.MeshBasicMaterial({ color: "#d56542" });
    installDesertMirage(nearMaterial, {}, clock);
    const near = new THREE.Mesh(new THREE.PlaneGeometry(10, 8, 10, 8), nearMaterial);
    near.position.set(-8, -4, -20);
    scene.add(near);
    // Course geometry stays untouched even at the same distance as the backdrop.
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 150),
      new THREE.MeshBasicMaterial({ color: "#79ac54" }),
    );
    road.position.set(-450, 200, -940);
    scene.add(road);
    const effect = createPostProcessing(renderer, { gradeTint: [1, 1, 1] });
    effect.setOptions({ bloom: false });
    function pixels(time = 0, motionEnabled = true) {
      clock.update(time, { motionEnabled });
      effect.render(scene, camera);
      const data = new Uint8Array(width * height * 4);
      const gl = renderer.getContext();
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return data;
    }
    function difference(a, b, rect, reverse = false) {
      let total = 0,
        count = 0;
      for (let y = rect[1]; y < rect[3]; y++)
        for (let x = rect[0]; x < rect[2]; x++)
          for (let c = 0; c < 3; c++) {
            const bi = reverse
              ? ((height - 1 - y) * width + width - 1 - x) * 4 + c
              : (y * width + x) * 4 + c;
            total += Math.abs(a[(y * width + x) * 4 + c] - b[bi]);
            count++;
          }
      return total / count;
    }
    const reports = [];
    for (const tier of [0, 1, 3]) {
      effect.setQuality(tier);
      far.material = plain;
      const original = pixels();
      far.material = distorted;
      const a = pixels(1.4),
        frozen = pixels(1.4),
        animated = pixels(2.8);
      // Rotate the camera around its viewing axis and undo that rotation in pixels.
      // A screen-fixed filter would produce a different wave pattern on the same objects.
      camera.rotation.z = Math.PI;
      const turned = pixels(1.4);
      camera.rotation.z = 0;
      const reducedA = pixels(20, false),
        reducedB = pixels(40, false);
      const farRect = [280, 80, 490, 240];
      const report = {
        tier,
        farChanged: difference(original, a, farRect),
        farAnimated: difference(a, animated, farRect),
        nearChanged: difference(original, a, [145, 100, 190, 145]),
        nearAnimated: difference(a, animated, [145, 100, 190, 145]),
        distantCourseChanged: difference(original, a, [115, 205, 145, 225]),
        courseAnimated: difference(a, animated, [115, 205, 145, 225]),
        frozen: difference(a, frozen, farRect),
        reducedMotion: difference(reducedA, reducedB, farRect),
        cameraTurnDrift: difference(a, turned, farRect, true),
      };
      if (
        report.farChanged < 10 ||
        report.farAnimated < 3 ||
        report.nearAnimated > 0.1 ||
        report.courseAnimated > 0.1 ||
        report.reducedMotion !== 0 ||
        report.nearChanged > 0.1 ||
        report.distantCourseChanged > 0.1 ||
        report.frozen !== 0 ||
        report.cameraTurnDrift > 0.1
      )
        throw new Error(JSON.stringify(report));
      reports.push(report);
    }
    const { createCourseEnvironments } = await import("/src/rendering/reflection-environments.js");
    const environments = createCourseEnvironments(renderer, {});
    let backdropDraws = 0,
      courseDraws = 0;
    far.onBeforeRender = near.onBeforeRender = () => backdropDraws++;
    const probeObject = new THREE.Mesh(
      new THREE.SphereGeometry(5),
      new THREE.MeshBasicMaterial({ color: "#79ac54" }),
    );
    probeObject.position.set(-40, 0, -50);
    probeObject.onBeforeRender = () => courseDraws++;
    scene.add(probeObject);
    environments.capture(scene, {
      SECTIONS: [{ id: "opening", start: 0, end: 1 }],
      TRACK: 1,
      poseAt: () => ({ p: new THREE.Vector3() }),
    });
    if (backdropDraws || !courseDraws || !far.visible || !near.visible)
      throw new Error(
        "Backdrop illusions contaminated a lighting probe or failed to restore visibility",
      );
    environments.dispose();
    effect.dispose();
    renderer.dispose();
    return reports;
  });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(JSON.stringify({ results, errors }, null, 2));
} finally {
  await browser.close();
}
