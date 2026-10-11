import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const base = new URL("../assets/living/", import.meta.url);
const index = JSON.parse(readFileSync(new URL("index.json", base)));

test("downloaded material outputs match recorded sources and hashes", () => {
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", base)));
  assert.equal(manifest.sources.length, 10);
  assert.ok(
    manifest.sources.every(
      (s) => s.license === "CC0-1.0" && s.evidence.startsWith("https://raw.githubusercontent.com/"),
    ),
  );
  for (const out of manifest.outputs) {
    const data = readFileSync(new URL(out.path, base));
    assert.equal(data.length, out.bytes, out.path);
    assert.equal(createHash("sha256").update(data).digest("hex"), out.sha256, out.path);
  }
  assert.equal(Object.keys(index.textures).length, 10);
  for (const material of Object.values(index.textures))
    assert.ok(material.color && material.normal && material.roughness);
});
