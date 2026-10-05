# Course asset provenance

All third-party source assets below are **CC0 1.0 Universal** (public domain).
License: https://creativecommons.org/publicdomain/zero/1.0/
Legal code: https://creativecommons.org/publicdomain/zero/1.0/legalcode

The game serves these checked-in derivatives locally; it does not contact the
source hosts. `manifest.json` records download URLs, license evidence URLs, source
and output SHA-256 hashes, and byte sizes. Rebuild with:

```sh
python tools/prepare-course-assets.py
```

Requires Pillow and numpy. Downloads are cached in `/tmp/kart-racer-course-assets`;
`--cache /some/path` selects another cache. No downloaded original is shipped.

## Texture sources and adaptations

Author: **ambientCG**. Sources are mirrored by the CC0-only Fable Cities project:
https://github.com/rawprogress/fable-cities

License evidence: its `public/assets/CREDITS.md` and each asset's `info.json`.
Exact URLs and hashes are in `manifest.json`.

| Local texture | Original asset | Adaptation |
| --- | --- | --- |
| `textures/asphalt.webp` | https://ambientcg.com/view?id=Asphalt010 | Downsampled color map; saturation 22%, contrast 36%, brightness 122%. |
| `textures/concrete.webp` | https://ambientcg.com/view?id=Concrete034 | Same neutral, reduced-contrast color-map conversion. |
| `textures/metal.webp` | https://ambientcg.com/view?id=MetalPlates006 | Same conversion; preserves repeating diagonal plate detail. |
| `textures/brick.webp` | https://ambientcg.com/view?id=Bricks059 | Same conversion, then grayscale recolored between `#ad927d` and `#ead4b5`. Real brick pattern, light arcade colors. |
| `textures/stone.webp` | https://ambientcg.com/view?id=Rock030 | Same neutral, reduced-contrast color-map conversion. |
| `textures/sand.webp` | https://ambientcg.com/view?id=Ground033 | Ground color map grayscale recolored between `#bb9767` and `#fff0b4`; stylized sand derivative, not a source sand scan. |
| `textures/snow.webp` | https://ambientcg.com/view?id=Ground054 | Ground color map grayscale recolored between `#b5cfdf` and white, blended 55% with `#edf7ff`; stylized snow derivative, not a source snow scan. |
| `textures/wood.webp` | https://ambientcg.com/view?id=Bark012 | Bark color map grayscale recolored between `#947652` and `#f0d5a4`; stylized timber-grain derivative, not a source plank scan. |
| `textures/bark.webp` | https://ambientcg.com/view?id=Bark012 | Same neutral, reduced-contrast color-map conversion. |

All textures are 512×512 RGB WebP, quality 78. Only color maps are shipped;
roughness and normal maps are not represented as color or silently baked in.
Course materials provide their own roughness, scene tint, and lighting.

## Models

Author: **Kenney**, Nature Kit: https://kenney.nl/assets/nature-kit

Mirror: https://github.com/Hidencod/tge-assets

The mirror's `catalog.json` identifies Kenney, the original pack URL and CC0-1.0
license. Its URL and SHA-256 hash are recorded as license evidence in the manifest.

| Local model | Source model |
| --- | --- |
| `pine` | `packs/nature-kit/tree-pinedefaulta.glb` |
| `palm` | `packs/nature-kit/tree-palmdetailedtall.glb` |
| `rock-a` | `packs/nature-kit/rock-largea.glb` |
| `rock-b` | `packs/nature-kit/rock-largec.glb` |

`models.bin` is little-endian Float32, non-indexed triangles. Each vertex has
position XYZ, normal XYZ, then linear RGB color (9 floats / 36 bytes). Material
base-color factors are preserved as vertex colors. Scene-node transforms are
applied; models are centered in X/Z, placed at base Y=0, and uniformly scaled to
height 1. Width/depth proportions remain intact. Normals are transformed by the
inverse transpose and normalized. Metadata uses byte offsets and vertex counts.
The sources use material colors with no texture maps or rigging to discard.

The preparation script is project code; it does not change the license of source
assets or impose restrictions on these CC0 derivatives.

## Shared racers

Author: **Kenney**, Car Kit: https://kenney.nl/assets/car-kit

The checked-in GLB files `assets/courses/packs/shared/models/kart-oobi.glb`,
`kart-oodi.glb`, `kart-ooli.glb`, `kart-oopi.glb`, and `kart-oozi.glb` are CC0
1.0. They preserve the pack's embedded color atlas and separate wheel meshes;
the local `manifest.json` records each pinned download URL, byte size, and
SHA-256 hash. Recreate the files with:

```sh
python tools/prepare-shared-assets.py
```

Three.js r180's GLTFLoader and BufferGeometryUtils are vendored under
`vendor/three/addons/` under the existing Three.js MIT license.
