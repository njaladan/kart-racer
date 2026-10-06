import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { COURSES } from "../src/courses/registry.js";

test("all course lighting bakes are complete, sized and hash-verified", () => {
  for (const course of COURSES) {
    const folder = new URL(`../assets/lighting/${course.id}/`, import.meta.url);
    const metadata = JSON.parse(readFileSync(new URL("bake.json", folder)));
    assert.equal(metadata.course, course.id);
    assert.ok(metadata.resolution >= 512 && metadata.samples >= 8);
    assert.ok(metadata.triangles > 100_000);
    assert.ok(metadata.sourceSceneSha256.match(/^[a-f0-9]{64}$/));
    for (const output of metadata.outputs) {
      const bytes = readFileSync(new URL(output.file, folder));
      assert.equal(bytes.length, output.bytes, `${course.id}/${output.file} size`);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        output.sha256,
        `${course.id}/${output.file} hash`,
      );
      assert.equal(bytes.toString("hex", 0, 8), "89504e470d0a1a0a");
      assert.equal(bytes.readUInt32BE(16), output.width ?? metadata.resolution);
      assert.equal(bytes.readUInt32BE(20), output.height ?? metadata.resolution);
    }
  }
});

test("Port Lumen spill atlas covers ground, ferry ceilings and skyline without overlapping slices", () => {
  const metadata = JSON.parse(
    readFileSync(new URL("../assets/lighting/neon-harbor/bake.json", import.meta.url)),
  );
  const volume = metadata.lightVolume;
  assert.ok(volume.heights[0] <= 0);
  assert.ok(volume.heights.at(-1) >= 75);
  assert.ok(volume.heights.some((y) => y >= 12 && y <= 16));
  assert.ok(volume.heights.every((y, i) => !i || y > volume.heights[i - 1]));
  assert.ok(volume.columns * volume.rows >= volume.heights.length);
  const output = metadata.outputs.find((entry) => entry.file === volume.file);
  assert.equal(output.width, volume.columns * volume.resolution);
  assert.equal(output.height, volume.rows * volume.resolution);
});
