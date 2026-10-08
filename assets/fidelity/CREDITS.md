# Detailed models and surface maps

The game serves these files locally. The downloaded originals are pinned in
`sources.json`; `manifest.json` records the adapted files and their SHA-256 hashes.

Models come from [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/edc7c9e67c639d230715049ee31f9a96a6babbbe/Models).

| Model | Artist / owner | License and retained source notices |
| --- | --- | --- |
| Avocado | Microsoft | [CC0](licenses/avocado.md), [metadata](licenses/avocado-metadata.json) |
| Barramundi Fish | Microsoft | [CC0](licenses/fish.md), [metadata](licenses/fish-metadata.json) |
| BoomBox | Microsoft | [CC0](licenses/boombox.md), [metadata](licenses/boombox-metadata.json) |
| Lantern | sbtron / Microsoft; Frank Galligan | [CC0](licenses/lantern.md), [metadata](licenses/lantern-metadata.json) |
| Antique Camera | Maximillan Kamps / UX3D | [CC0](licenses/camera.md), [metadata](licenses/camera-metadata.json), [retained logo terms](licenses/UX3D-mark.txt) |
| Water Bottle | Microsoft | [CC0](licenses/bottle.md), [metadata](licenses/bottle-metadata.json) |
| Sheen Chair | Eric Chadwick / Wayfair, LLC | [CC0](licenses/chair.md), [metadata](licenses/chair-metadata.json) |
| Commercial Refrigerator | Eric Chadwick / Darmstadt Graphics Group GmbH; Sean Thomas | [CC BY 4.0](licenses/fridge.md), [metadata](licenses/fridge-metadata.json), [source description](licenses/fridge-README.md) |

The refrigerator derives from Sean Thomas's [Commercial Fridge](https://sketchfab.com/3d-models/commercial-fridge-2174e1e4f1f24f1a95aa110ee060f473).
Adaptations: geometry welding and simplification, three distance variants,
static poses, textures resized to at most 1024 pixels and encoded as mipmapped
KTX2 plus offline WebP alternatives. UVs and physical material distinctions are
retained. Refrigerator transmission becomes alpha glass to avoid another live
scene capture. Unused material variants and animations are removed. The camera
mark stays within its original texture; it is not used as game branding.
The original metadata/README licenses remain as specified in each source notice.

The sixteen material roles adapt CC0 scans by Lennart Demes / ambientCG and
Poly Haven, retrieved through the pinned
[fable-cities distribution](https://github.com/rawprogress/fable-cities/tree/aea8b1035030952555395de0c1de14ba693a1427/public/assets/shared).
Each role's upstream URL and downloaded map hashes are recorded in `sources.json`,
with its license evidence under `licenses/`. Fabric uses the CC0 Sheen Chair maps.

Three shared atlases contain achromatic albedo detail, tangent normals, and
packed height/roughness/AO. Wrapped gutters and mipmaps support repeating surfaces.
Original course colors remain. Paint, paper and ceramic use adapted fine plaster
relief; snow uses fine sand microstructure. These are derived material roles,
not sixteen distinct photographic scans. Twelve roles have supplied source height
maps; the other roles use neutral height and their authored normals. Separate
height PNGs are retained for offline use. Fine relief changes shading, not the
driving surface or mesh silhouette.

Reproduce with `python3 tools/prepare-fidelity-assets.py`, then
`node tools/optimize-fidelity-assets.mjs` after `npm ci` (Python requires Pillow
and NumPy). Sources stay in `/tmp/turbo-fidelity-sources`; the browser fetches only
local prepared assets. The KTX2 transcoder dependencies have
[separate retained notices](../../vendor/three/addons/libs/LICENSES.md).
