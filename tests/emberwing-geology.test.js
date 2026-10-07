import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as THREE from "../vendor/three/three.module.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
import course from "../src/courses/emberwing-observatory.js";
import { createTrack } from "../src/track/track-builder.js";
import { normalizeCourseModel } from "../src/rendering/course-assets.js";
import { createCourseKit } from "../src/rendering/course-kit.js";
import { buildEmberwingGeology } from "../src/courses/adventure/emberwing-geology.js";
import {
  EMBERWING_LAYOUT_DIGEST,
  EMBERWING_GEOLOGY,
} from "../src/courses/adventure/emberwing-geology-data.js";
import { auditRouteGeometry } from "../tools/scene-route-audit.mjs";

test("Blender cliffs match current driving edges and leave every road corridor clear", async () => {
  const directory = mkdtempSync(join(tmpdir(), "emberwing-geology-"));
  try {
    const output = join(directory, "layout.json");
    execFileSync(process.execPath, [
      new URL("../tools/export-emberwing-layout.mjs", import.meta.url).pathname,
      output,
    ]);
    const layout = JSON.parse(readFileSync(output));
    assert.equal(
      layout.digest,
      EMBERWING_LAYOUT_DIGEST,
      "Rebuild geology when the authored route changes",
    );
    const base = new URL("../assets/courses/packs/emberwing-observatory/", import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL("manifest.json", base)));
    const models = {};
    const loader = new GLTFLoader();
    for (const placement of EMBERWING_GEOLOGY) {
      const entry = manifest.models.find((m) => m.name === placement.name);
      const raw = readFileSync(new URL(entry.file, base));
      const gltf = await loader.parseAsync(
        raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
        "",
      );
      models[entry.name] = normalizeCourseModel(gltf.scene);
    }
    const scene = new THREE.Scene();
    const kit = createCourseKit(scene, createTrack(course), { models });
    buildEmberwingGeology({ kit, scenery: scene }, kit.material("#aaa1ad"));
    scene.updateMatrixWorld(true);
    assert.equal(scene.children.length, 13, "Every split cliff and crater quadrant is installed");
    for (const section of layout.sections) {
      const placement = EMBERWING_GEOLOGY.find((p) => p.name === section.name);
      const object = scene.children[EMBERWING_GEOLOGY.indexOf(placement)];
      const vertices = [];
      object.traverse((mesh) => {
        if (!mesh.isMesh) return;
        const position = mesh.geometry.attributes.position;
        for (let i = 0; i < position.count; i++)
          vertices.push(
            new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld),
          );
      });
      for (const edge of section.edges) {
        for (const { p } of edge) {
          const reference = new THREE.Vector3(...p);
          assert.ok(
            vertices.some((v) => v.distanceToSquared(reference) < 1e-8),
            `${section.name}: exported cliff seam diverged from its platform`,
          );
        }
      }
    }
    const audit = auditRouteGeometry(scene, createTrack(course));
    assert.equal(
      audit.hits.length,
      0,
      "Imported geology must not cross the driver/camera corridor",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
