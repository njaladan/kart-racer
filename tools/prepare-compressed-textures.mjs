import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { chmod, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(root, "assets/compressed");
const manifestPath = path.join(root, "assets/compressed-textures.json");
const sourceRoots = [
  "assets/courses/textures",
  "assets/courses/packs",
  "assets/living/textures",
  "assets/living/props",
];
const looseSources = ["assets/grass.webp", "assets/asphalt.webp"];
const basisu = process.env.BASISU || "basisu";

async function findSources(directory) {
  const found = [];
  let entries;
  try {
    entries = await readdir(path.join(root, directory), { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return found;
    throw error;
  }
  for (const entry of entries) {
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await findSources(relative)));
    else if (entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name)) found.push(relative);
  }
  return found;
}

function classify(source) {
  const basename = path.basename(source).toLowerCase();
  if (/(^|[-_])(normal|nor_gl)([-_.]|$)/.test(basename)) return "normal";
  const channels = new Set(basename.split(/[._-]+/));
  if (
    [
      "roughness",
      "metalness",
      "metallic",
      "arm",
      "orm",
      "ao",
      "occlusion",
      "height",
      "bump",
      "gloss",
      "displacement",
    ].some((name) => channels.has(name))
  )
    return "linear";
  return "color";
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with status ${code}: ${args.join(" ")}`)),
    );
  });
}

async function toPng(source, destination) {
  const script = [
    "from PIL import Image",
    "import sys",
    "Image.MAX_IMAGE_PIXELS = None",
    "im = Image.open(sys.argv[1])",
    "im.save(sys.argv[2], format='PNG', optimize=False)",
  ].join("\n");
  await run(process.env.PYTHON || "python3", ["-c", script, source, destination]);
}

async function compressOne(relative, previousEntries) {
  const input = path.join(root, relative);
  const sourceBuffer = await readFile(input);
  const sourceHash = sha256(sourceBuffer);
  const channel = classify(relative);
  const sourceStat = await stat(input);
  const targetRelative = `${relative.replace(/^assets\//, "")}.ktx2`;
  const target = path.join(outputRoot, targetRelative);
  const previous = previousEntries[relative];
  if (previous?.sourceSha256 === sourceHash && previous.channel === channel) {
    try {
      const existing = await readFile(target);
      if (sha256(existing) === previous.sha256) return { relative, entry: previous };
    } catch {
      // Rebuild missing output files.
    }
  }
  await mkdir(path.dirname(target), { recursive: true });
  const tempDirectory = path.join(os.tmpdir(), `kart-texture-${process.pid}`);
  await mkdir(tempDirectory, { recursive: true });
  const png = path.join(tempDirectory, `${path.basename(relative).replace(/\W/g, "_")}.png`);
  await toPng(input, png);
  const args = [png, "-ktx2", "-mipmap", "-q", "230", "-comp_level", "0", "-output_file", target];
  if (channel !== "color") args.push("-linear");
  if (channel === "normal") args.push("-normal_map", "-renorm");
  await run(basisu, args);
  await chmod(target, 0o644);
  const compressedBuffer = await readFile(target);
  return {
    relative,
    entry: {
      file: `./assets/compressed/${targetRelative}`,
      channel,
      sourceSha256: sourceHash,
      sha256: sha256(compressedBuffer),
      sourceBytes: sourceStat.size,
      bytes: compressedBuffer.byteLength,
    },
  };
}

async function main() {
  const sources = [
    ...(await Promise.all(sourceRoots.map(findSources))).flat(),
    ...looseSources,
  ].sort();
  let previousEntries = {};
  try {
    previousEntries = JSON.parse(await readFile(manifestPath, "utf8")).textures || {};
  } catch {
    // Start with a clean generated manifest when none exists.
  }
  const completed = [];
  for (let start = 0; start < sources.length; start += 4) {
    completed.push(
      ...(await Promise.all(
        sources.slice(start, start + 4).map((source) => compressOne(source, previousEntries)),
      )),
    );
    console.log(`Compressed ${Math.min(start + 4, sources.length)} / ${sources.length}`);
  }
  const entries = Object.fromEntries(
    completed
      .sort((a, b) => a.relative.localeCompare(b.relative))
      .map(({ relative, entry }) => [relative, entry]),
  );
  const totalSourceBytes = completed.reduce((total, value) => total + value.entry.sourceBytes, 0);
  const totalCompressedBytes = completed.reduce((total, value) => total + value.entry.bytes, 0);
  const manifest = {
    version: 1,
    encoder: "Basis Universal ETC1S quality 230 with mipmaps",
    textures: entries,
    summary: {
      count: sources.length,
      sourceBytes: totalSourceBytes,
      compressedBytes: totalCompressedBytes,
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `Compressed ${sources.length} textures: ${totalSourceBytes} -> ${totalCompressedBytes} bytes`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
