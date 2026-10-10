#!/usr/bin/env node
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { COURSES } from "../src/courses/registry.js";

// Use a running static server. The isolated scene also makes background review
// possible when a full-scene shader exceeds a software browser's limits.
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const output = resolve(process.env.BACKGROUND_REVIEW_OUTPUT || "/tmp/course-background-review");
const base = process.env.BACKGROUND_REVIEW_URL || "http://127.0.0.1:5180";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-angle=swiftshader"],
});
const reports = [];
try {
  for (const course of COURSES) {
    const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.route("**/__background_review__", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<html><body style="margin:0"><canvas></canvas></body></html>',
      }),
    );
    await page.goto(`${base}/__background_review__`);
    const composition = await page.evaluate(async (id) => {
      const THREE = await import("/vendor/three/three.module.js");
      const { COURSES } = await import("/src/courses/registry.js");
      const { createTrack } = await import("/src/track/track-builder.js");
      const { createPolishKit } = await import("/src/rendering/course-polish-kit.js");
      const { buildCourseBackground } = await import("/src/courses/background/index.js");
      const { buildDesertHorizon } =
        await import("/src/courses/sunstone-ruins/build-desert-horizon.js");
      const { addGradientSky } = await import("/src/rendering/sky.js");
      const { GLTFLoader } = await import("/vendor/three/addons/loaders/GLTFLoader.js");
      const { normalizeCourseModel } = await import("/src/rendering/course-assets.js");
      const course = COURSES.find((c) => c.id === id),
        track = createTrack(course);
      const manifest = await fetch(`/assets/courses/packs/${id}/manifest.json`).then((r) =>
        r.json(),
      );
      const models = {},
        loader = new GLTFLoader();
      await Promise.all(
        manifest.models
          .filter((model) => model.name.startsWith("background:"))
          .map(async (model) => {
            const gltf = await loader.loadAsync(`/assets/courses/packs/${id}/${model.file}`);
            models[model.name] = normalizeCourseModel(gltf.scene);
          }),
      );
      const scene = new THREE.Scene(),
        w = createPolishKit({ scene, track, assets: { models } });
      let sites;
      if (id === "sunstone-ruins") {
        buildDesertHorizon({ THREE, scenery: w.scenery, track, kit: w.kit, textures: {} });
        sites = w.scenery.children
          .filter((o) => o.userData.desertLandmark)
          .map((root) => ({
            label: root.name,
            bounds: new THREE.Box3().setFromObject(root),
          }));
      } else {
        buildCourseBackground(w);
        sites = scene.userData.courseBackground;
      }
      const world = w.finish();
      scene.fog = new THREE.Fog(course.theme.fog, 165, course.theme.fogFar ?? 720);
      scene.add(
        new THREE.HemisphereLight(course.theme.hemisphere, course.theme.ambientGround, 1.55),
      );
      const sun = new THREE.DirectionalLight(course.theme.sun, course.theme.sunIntensity);
      sun.position.set(-75, 130, 75);
      scene.add(sun);
      addGradientSky(scene, course.theme);
      const renderer = new THREE.WebGLRenderer({
        canvas: document.querySelector("canvas"),
        antialias: true,
      });
      renderer.setSize(800, 450);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.toneMappingExposure = course.theme.exposure;
      const camera = new THREE.PerspectiveCamera(
        63,
        800 / 450,
        0.1,
        course.theme.cameraFar ?? 1050,
      );
      const views = [
        { kind: "site", index: 0 },
        { kind: "site", index: 1 },
        ...track.SECTIONS.map((_, section) => ({ kind: "driver", t: track.sectorT(section, 0.5) })),
        ...track.branches.map((_, index) => ({ kind: "branch", index })),
      ];
      window.backgroundReview = {
        render(view) {
          if (view.kind === "site") {
            const bounds = sites[view.index].bounds,
              center = bounds.getCenter(new THREE.Vector3());
            const size = bounds.getSize(new THREE.Vector3()).length();
            camera.position
              .copy(center)
              .add(new THREE.Vector3(size * 0.35, size * 0.23, size * 0.65));
            camera.lookAt(center);
          } else {
            const f =
              view.kind === "branch"
                ? track.branches[view.index].poseAt(0.5)
                : track.frameAt(view.t);
            camera.position
              .copy(f.p)
              .addScaledVector(f.tangent, -8.5)
              .add(new THREE.Vector3(0, 4.7, 0));
            camera.lookAt(
              f.p
                .clone()
                .addScaledVector(f.tangent, 22)
                .add(new THREE.Vector3(0, 2, 0)),
            );
          }
          world.update(30);
          scene.updateMatrixWorld(true);
          renderer.render(scene, camera);
          return {
            calls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
            glError: renderer.getContext().getError(),
          };
        },
      };
      renderer.compile(scene, camera);
      return { sites: sites.length, views };
    }, course.id);
    const frames = [];
    for (const [index, view] of composition.views.entries()) {
      frames.push({
        view,
        ...(await page.evaluate((view) => window.backgroundReview.render(view), view)),
      });
      if (index < 4)
        await page
          .locator("canvas")
          .screenshot({ path: resolve(output, `${course.id}-${index}.png`) });
    }
    const report = { course: course.id, sites: composition.sites, frames, errors };
    reports.push(report);
    console.log(
      JSON.stringify({ course: course.id, sites: composition.sites, views: frames.length, errors }),
    );
    await page.close();
  }
} finally {
  await browser.close();
}
await writeFile(resolve(output, "report.json"), JSON.stringify(reports, null, 2));
if (reports.some((report) => report.errors.length || report.frames.some((frame) => frame.glError)))
  process.exitCode = 1;
