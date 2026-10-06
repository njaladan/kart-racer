/** Original fictional packaging, locally rasterized and licensed CC0. */
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require("sharp");
} catch {
  sharp = require("/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp");
}
const folder = "assets/courses/packs/pocket-pantry";
await mkdir(`${folder}/textures`, { recursive: true });
const entries = [];
for (const [name, title, subtitle, color, symbol] of [
  ["sunberry-label", "SUNBERRY", "MORNING JAM", "#ae546d", "berry"],
  ["flour-label", "CLOUD MILL", "FINE FLOUR", "#67968d", "wheat"],
  ["butter-label", "GOLDEN", "BREAKFAST BUTTER", "#b78343", "sun"],
  ["biscuit-label", "CRUMB CLUB", "SECRET BISCUITS", "#895f78", "cookie"],
  ["pantry-label", "THE PANTRY", "SMALL RACERS · BIG ADVENTURES", "#568a89", "wheat"],
  ["grow-label", "BIG AGAIN", "BACK TO BREAKFAST", "#548e88", "sun"],
]) {
  let art = `<circle cx="256" cy="114" r="54" fill="${color}"/>`;
  if (symbol === "berry")
    art += `<path d="M223 87Q256 62 289 87L275 137Q256 155 237 137z" fill="#f6c78d"/><path d="M236 83l20 12 20-12-20-18z" fill="#82ac80"/>`;
  else if (symbol === "wheat")
    art += `<path d="M256 156v-80m0 55-25-20m25 5 25-20m-25 4-22-20m22 4 22-20" fill="none" stroke="#fff0ce" stroke-width="8"/>`;
  else if (symbol === "cookie") {
    art += `<circle cx="256" cy="114" r="37" fill="#f4d596"/>`;
    for (const [x, y] of [
      [243, 97],
      [269, 105],
      [247, 129],
      [269, 132],
      [233, 118],
    ])
      art += `<circle cx="${x}" cy="${y}" r="5" fill="${color}"/>`;
  } else
    art += `<circle cx="256" cy="114" r="25" fill="#fff0ce"/><path d="M256 77v-8m0 90v-8m-37-37h-8m90 0h-8m-11-26 6-6m-58 58 6-6m0-46-6-6m58 58-6-6" stroke="#fff0ce" stroke-width="4"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="320"><rect width="512" height="320" fill="#fff0ce"/><rect x="15" y="15" width="482" height="290" rx="24" fill="none" stroke="${color}" stroke-width="5"/><path d="M35 46h442M35 274h442" stroke="${color}" stroke-width="2"/>${art}<text x="256" y="211" text-anchor="middle" font-family="serif" font-weight="bold" font-size="40" fill="${color}">${title}</text><text x="256" y="249" text-anchor="middle" font-family="sans-serif" font-size="17" letter-spacing="2" fill="${color}">${subtitle}</text></svg>`;
  const file = `textures/${name}.webp`,
    data = await sharp(Buffer.from(svg)).webp({ quality: 90 }).toBuffer();
  await writeFile(`${folder}/${file}`, data);
  entries.push({
    name,
    file,
    bytes: data.length,
    sha256: createHash("sha256").update(data).digest("hex"),
    source: "Original fictional packaging; tools/create-pantry-labels.mjs",
    license: "CC0-1.0",
  });
}
await writeFile(
  `${folder}/manifest.json`,
  JSON.stringify(
    { course: "pocket-pantry", models: [], textures: entries, sources: entries },
    null,
    2,
  ) + "\n",
);
await writeFile(
  `${folder}/LICENSES.md`,
  "# Pocket Pantry\n\nFictional packaging artwork and original kitchen geometry, biscuit inhabitants, animation and shaders are authored in this project. Packaging textures are CC0-1.0; generator: tools/create-pantry-labels.mjs. Shared locally bundled textures retain the licenses in ../../LICENSES.md. Original synthesized sound; no course music. Lighting generated locally.\n",
);
