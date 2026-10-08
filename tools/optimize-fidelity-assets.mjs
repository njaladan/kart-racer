#!/usr/bin/env node
/** Preserve downloaded UVs/materials; share compressed maps between near/mid/far models. */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRTextureBasisu, EXTTextureWebP } from "@gltf-transform/extensions";
import {
  cloneDocument,
  dedup,
  prune,
  weld,
  simplify,
  listTextureSlots,
} from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const root = resolve(new URL("..", import.meta.url).pathname);
const output = resolve(root, "assets/fidelity");
const cache = "/tmp/turbo-fidelity-sources";
const encoder = resolve(root, "node_modules/basisu/bin/linux/x64_sse/basisu");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const sha = (data) => createHash("sha256").update(data).digest("hex");
const source = JSON.parse(await readFile(resolve(output, "manifest.json")));
await MeshoptSimplifier.ready;
await mkdir(resolve(output, "textures"), { recursive: true });
const manifest = {
  version: 1,
  heroes: [],
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
for (const hero of source.heroes) {
  const doc = await io.read(resolve(cache, hero.sourceName, hero.sourceName + ".glb"));
  // Keep physically different materials. Remove only unused variant palettes,
  // animation tracks (these are static set pieces) and redundant geometry.
  for (const ext of doc.getRoot().listExtensionsUsed())
    if (ext.extensionName === "KHR_materials_variants") ext.dispose();
  for (const a of doc.getRoot().listAnimations()) a.dispose();
  // Transmission triggers a second scene capture for glass. Existing renderer
  // uses bounded alpha glass; preserve normals, coating and interior emissive.
  for (const m of doc.getRoot().listMaterials()) {
    const transmission = m.getExtension("KHR_materials_transmission");
    if (transmission) {
      const f = transmission.getTransmissionFactor();
      if (f > 0.1) {
        const c = m.getBaseColorFactor();
        c[3] = 0.23;
        m.setBaseColorFactor(c).setAlphaMode("BLEND").setDoubleSided(true);
      }
      transmission.dispose();
    }
  }
  for (const e of doc.getRoot().listExtensionsUsed())
    if (e.extensionName === "KHR_materials_transmission") e.dispose();
  await doc.transform(dedup(), weld(), prune());
  const nearRatio =
    hero.key === "fridge" ? 0.24 : hero.key === "chair" ? 0.4 : hero.key === "camera" ? 0.65 : 1;
  if (nearRatio < 1)
    await doc.transform(
      simplify({ simplifier: MeshoptSimplifier, ratio: nearRatio, error: 0.004 }),
      prune(),
    );
  for (const t of doc.getRoot().listTextures()) {
    const slots = listTextureSlots(t),
      linear = !slots.some((s) => /baseColor|emissive|sheenColor|specularColor/.test(s));
    const normal = slots.some((s) => /normal/i.test(s));
    const size = 1024;
    const png = await sharp(t.getImage())
      .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const key = sha(png).slice(0, 20);
    const pngPath = resolve(cache, key + ".png"),
      ktxPath = resolve(output, "textures", key + ".ktx2"),
      webpPath = resolve(output, "textures", key + ".webp");
    await writeFile(pngPath, png);
    const webp = await sharp(png).webp({ quality: 95, lossless: normal }).toBuffer();
    await writeFile(webpPath, webp);
    try {
      await readFile(ktxPath);
    } catch {
      compress(pngPath, ktxPath, linear, normal);
    }
    // Map each texture by extras, surviving document cloning.
    t.setExtras({ ...t.getExtras(), fidelityKey: key });
  }
  const variants = [];
  for (const [level, ratio, error] of [
    ["near", 1, 0.004],
    ["mid", 0.48, 0.014],
    ["far", 0.15, 0.04],
  ]) {
    const variant = cloneDocument(doc);
    if (ratio < 1)
      await variant.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error }), prune());
    let triangles = 0;
    for (const m of variant.getRoot().listMeshes())
      for (const p of m.listPrimitives())
        triangles += (p.getIndices()?.getCount() || p.getAttribute("POSITION").getCount()) / 3;
    const fallback = cloneDocument(variant);
    fallback.createExtension(EXTTextureWebP).setRequired(true);
    for (const t of fallback.getRoot().listTextures()) {
      const key = t.getExtras().fidelityKey;
      t.setImage(await readFile(resolve(output, "textures", key + ".webp")))
        .setMimeType("image/webp")
        .setURI("../textures/" + key + ".webp");
    }
    const offlineFile = "models/" + hero.key + "-" + level + "-webp.gltf";
    await io.write(resolve(output, offlineFile), fallback);
    variant.createExtension(KHRTextureBasisu).setRequired(true);
    for (const t of variant.getRoot().listTextures()) {
      const key = t.getExtras().fidelityKey;
      t.setImage(await readFile(resolve(output, "textures", key + ".ktx2")))
        .setMimeType("image/ktx2")
        .setURI("../textures/" + key + ".ktx2");
    }
    const file = "models/" + hero.key + "-" + level + ".gltf";
    await io.write(resolve(output, file), variant);
    variants.push({
      name: "hero:" + hero.key + (level === "near" ? "" : "-" + level),
      file,
      offlineFile,
      type: "gltf",
      triangles: Math.round(triangles),
    });
  }
  manifest.heroes.push({
    ...hero,
    variants,
    lodDistances: hero.key === "fish" ? [0, 45, 100] : [0, 65, 150],
  });
  console.log(hero.key, variants.map((v) => v.triangles).join(" / "), "triangles");
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
