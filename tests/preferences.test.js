import test from "node:test";
import assert from "node:assert/strict";
import { loadPreferences, savePreferences } from "../src/ui/preferences.js";
test("preferences clamp untrusted storage, survive denial and roundtrip", () => {
  const storage = {
    value: '{"quality":99,"master":-8,"effects":0.45,"music":9,"motion":false}',
    getItem() {
      return this.value;
    },
    setItem(k, v) {
      this.value = v;
    },
  };
  const p = loadPreferences(storage);
  assert.equal(p.quality, 3);
  assert.equal(p.master, 0);
  assert.equal(p.effects, 0.45);
  assert.equal(p.music, 1);
  assert.equal(p.motion, false);
  savePreferences({ ...p, quality: 1, music: 0.35 }, storage);
  assert.equal(loadPreferences(storage).quality, 1);
  assert.equal(loadPreferences(storage).music, 0.35);
  const denied = {
    getItem() {
      throw new Error();
    },
    setItem() {
      throw new Error();
    },
  };
  assert.equal(loadPreferences(denied).quality, 2);
  assert.doesNotThrow(() => savePreferences(p, denied));
});
