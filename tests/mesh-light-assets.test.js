import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { COURSES } from "../src/courses/registry.js";

test("all mesh-light assets are complete, hash-verified and paired with their current ground bake", () => {
  for (const { id } of COURSES) {
    const folder = new URL(`../assets/lighting/${id}/`, import.meta.url);
    const metadata = JSON.parse(readFileSync(new URL("mesh-lighting.json", folder)));
    const ground = JSON.parse(readFileSync(new URL("bake.json", folder)));
    const bytes = readFileSync(new URL(metadata.binary.file, folder));
    assert.equal(metadata.course, id);
    assert.equal(metadata.sourceSceneSha256, ground.sourceSceneSha256, `${id} scene identity`);
    assert.equal(bytes.length, metadata.binary.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), metadata.binary.sha256);
    assert.ok(metadata.entries.length > 300, `${id} authored scenery is included`);
    let end = 0;
    for (const entry of metadata.entries) {
      assert.match(entry.signature, /^[a-f0-9]{16}$/);
      assert.equal(entry.byteOffset, end, `${id} entries neither overlap nor leave gaps`);
      assert.equal(entry.byteLength, entry.count * 4);
      assert.ok(entry.count > 0);
      end += entry.byteLength;
    }
    assert.equal(end, bytes.length);
    for (let offset = 3; offset < bytes.length; offset += 4) {
      assert.ok(bytes[offset] >= 64, `${id} baked alpha preserves the unbaked zero sentinel`);
    }
  }
});
