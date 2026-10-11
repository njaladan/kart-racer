import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const ids = [
  "tempest-causeway",
  "pocket-pantry",
  "railstorm-express",
  "metronome-hall",
  "pelagic-glasshouse",
  "emberwing-observatory",
];

test("six adventure packs have local licensed models and matched color/normal/roughness scans", () => {
  assert.equal(ids.length, 6);
  for (const id of ids) {
    const base = new URL(`../assets/courses/packs/${id}/`, import.meta.url);
    const pack = JSON.parse(readFileSync(new URL("manifest.json", base)));
    assert.ok(pack.models.length >= 5, id);
    const textures = new Set(pack.textures.map((entry) => entry.name));
    for (const entry of [...pack.models, ...pack.textures]) {
      assert.ok(["CC0-1.0", "CC-BY-SA-3.0", "CC-BY-SA-4.0"].includes(entry.license));
      if (entry.license.startsWith("CC-BY"))
        assert.ok(readFileSync(new URL(entry.attribution, base)).length);
      const bytes = readFileSync(new URL(entry.file, base));
      assert.equal(bytes.length, entry.bytes, entry.file);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, entry.file);
      if (entry.colorSpace === "srgb") {
        assert.ok(textures.has(`${entry.name}Normal`), entry.name);
        assert.ok(textures.has(`${entry.name}Roughness`), entry.name);
      }
    }
  }
});
