# Asset credits

The bundled third-party graphics below are licensed under **CC0 1.0 Universal**:
<https://creativecommons.org/publicdomain/zero/1.0/>. They may be modified and
redistributed, including in commercial games. Credit is included as a courtesy.

| Runtime asset | Creator and original asset | Adaptation |
| --- | --- | --- |
| `asphalt.webp` | Lennart Demes / [ambientCG Asphalt010](https://ambientcg.com/view?id=Asphalt010) | Resized to 256 × 256, reduced contrast, cool gray palette, WebP |
| `grass.webp` | Lennart Demes / [ambientCG Grass004](https://ambientcg.com/view?id=Grass004) | Resized to 256 × 256, sunny green palette, WebP |
| `sky-reflections.webp` | Greg Zaal (original), Jarod Guest (sky edits) / [Poly Haven Kloofendal 48d Partly Cloudy (Pure Sky)](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky) | Tonemapped HDR to a 256 × 128 WebP reflection map |
| `nature.bin`, `nature.json` | [Kenney Nature Kit](https://kenney.nl/assets/nature-kit): `tree_default`, `tree_oak`, `tree_pineSmallB` | Geometry normalized to 4.5 m, materials combined into linear vertex colors, baked underside shading; oak also supplies a pink blossom variant |

Sources were retrieved through public GitHub distributions:

- Textures and HDRI: [rawprogress/fable-cities](https://github.com/rawprogress/fable-cities/tree/main/public/assets/shared), with matching upstream source attribution.
- Models: [Hidencod/tge-assets](https://github.com/Hidencod/tge-assets), distributed under CC0 with Kenney attribution.

The sources and their exact SHA-256 hashes, alongside hashes of runtime files,
are recorded in `manifest.json`. `tools/prepare-assets.py` reproduces the
derivatives with Python 3, Pillow and numpy. Source downloads stay in its
temporary source directory and are not shipped to the browser.

The kart number atlas, sky gradient, signs, flames, and remaining procedural
graphics are original Turbo Trail artwork. Three.js and fonts retain their
existing licenses under `vendor/`.

The living-world upgrade adds ten downloaded 1K ambientCG PBR material sets and three textured Poly Haven props. See [their credits, source and conversion details](living/LICENSES.md) and `living/manifest.json`. These are served locally and retain separate normal and roughness maps.
