#!/usr/bin/env node
/** Compress the shared scanned material atlases. */
import { readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const root = resolve(new URL("..", import.meta.url).pathname);
const output = resolve(root, "assets/fidelity");
const encoder = resolve(root, "node_modules/basisu/bin/linux/x64_sse/basisu");
const sha = (data) => createHash("sha256").update(data).digest("hex");
const source = JSON.parse(await readFile(resolve(output, "manifest.json")));
const manifest = {
  version: 1,
  materials: source.materials,
  sources: source.sources,
  atlases: {},
  outputs: [],
};
function compress(png, ktx, linear = false, normal = false) {
  execFileSync(
    encoder,
    [
      "-file",
      png,
      "-output_file",
      ktx,
      "-ktx2",
      "-uastc",
      "-uastc_level",
      "2",
      "-mipmap",
      "-max_threads",
      "2",
      ...(linear ? ["-linear"] : []),
      ...(normal ? ["-normal_map"] : []),
    ],
    { stdio: "pipe" },
  );
}
for (const channel of ["color", "normal", "response"]) {
  const png = resolve(output, "materials", channel + ".png"),
    ktx = resolve(output, "materials", channel + ".ktx2");
  compress(png, ktx, channel !== "color", channel === "normal");
  manifest.atlases[channel] = {
    file: "materials/" + channel + ".ktx2",
    fallback: "materials/" + channel + ".webp",
    colorSpace: channel === "color" ? "srgb" : "linear",
  };
  // The browser uses KTX2; WebP remains available to offline tools. Source
  // heights stay bundled, but the oversized intermediate atlas is reproducible.
  await unlink(png);
}
async function walk(folder) {
  for (const name of await readdir(folder, { withFileTypes: true })) {
    const path = resolve(folder, name.name);
    if (name.isDirectory()) await walk(path);
    else if (name.name !== "manifest.json") {
      const bytes = await readFile(path);
      manifest.outputs.push({
        file: path.slice(output.length + 1),
        bytes: bytes.length,
        sha256: sha(bytes),
      });
    }
  }
}
await walk(output);
await writeFile(resolve(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(
  "Runtime assets",
  manifest.outputs.reduce((n, e) => n + e.bytes, 0),
  "bytes including offline WebP alternatives",
);
