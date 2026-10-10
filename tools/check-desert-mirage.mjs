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
    const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    const width = 512,
      height = 320;
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.NeutralToneMapping;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#b7cfdb");
    const camera = new THREE.PerspectiveCamera(63, width / height, 0.1, 1400);
    const backdrop = new THREE.PlaneGeometry(1800, 900, 60, 30);
    const colors = [];
    const p = backdrop.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const light = (Math.floor((p.getX(i) + 900) / 30) + Math.floor((p.getY(i) + 450) / 30)) % 2;
      colors.push(...(light ? [0.76, 0.68, 0.5] : [0.13, 0.17, 0.21]));
    }
    backdrop.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const far = new THREE.Mesh(backdrop, new THREE.MeshBasicMaterial({ vertexColors: true }));
    far.position.z = -950;
    scene.add(far);
    const near = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 8),
      new THREE.MeshBasicMaterial({ color: "#d56542" }),
    );
    near.position.set(-8, -4, -20);
    scene.add(near);
    const theme = {
      fog: "#e3d8c3",
      gradeTint: [1, 1, 1],
      desertMirage: { start: 180, end: 700, strength: 1 },
    };
    const effect = createPostProcessing(renderer, theme);
    const baseline = createPostProcessing(renderer, { gradeTint: [1, 1, 1] });
    effect.setOptions({ bloom: false });
    baseline.setOptions({ bloom: false });
    function pixels(post, time = 0, motion = true) {
      post.setDesertMirage(time, motion);
      post.render(scene, camera);
      const data = new Uint8Array(width * height * 4);
      renderer
        .getContext()
        .readPixels(
          0,
          0,
          width,
          height,
          renderer.getContext().RGBA,
          renderer.getContext().UNSIGNED_BYTE,
          data,
        );
      return data;
    }
    function difference(a, b, rect) {
      let total = 0,
        count = 0;
      for (let y = rect[1]; y < rect[3]; y++)
        for (let x = rect[0]; x < rect[2]; x++)
          for (let c = 0; c < 3; c++) {
            total += Math.abs(a[(y * width + x) * 4 + c] - b[(y * width + x) * 4 + c]);
            count++;
          }
      return total / count;
    }
    const reports = [];
    for (const tier of [0, 1, 3]) {
      effect.setQuality(tier);
      baseline.setQuality(tier);
      const original = pixels(baseline),
        a = pixels(effect, 0),
        b = pixels(effect, 1.4),
        frozen = pixels(effect, 1.4);
      const stillA = pixels(effect, 20, false),
        stillB = pixels(effect, 40, false);
      const farRect = [280, 80, 490, 240],
        nearRect = [145, 100, 190, 145];
      const report = {
        tier,
        farChanged: difference(original, a, farRect),
        farAnimated: difference(a, b, farRect),
        nearChanged: difference(original, a, nearRect),
        frozen: difference(b, frozen, farRect),
        reducedMotion: difference(stillA, stillB, farRect),
      };
      // Strong movement, rather than an opaque color wash, should dominate the change.
      if (
        report.farChanged < 8 ||
        report.farAnimated < 8 ||
        report.nearChanged > 2 ||
        report.frozen !== 0 ||
        report.reducedMotion !== 0
      )
        throw new Error(JSON.stringify(report));
      reports.push(report);
    }
    effect.dispose();
    baseline.dispose();
    renderer.dispose();
    return reports;
  });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(JSON.stringify({ results, errors }, null, 2));
} finally {
  await browser.close();
}
