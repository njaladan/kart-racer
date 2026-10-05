# Downloaded living-world materials and props

All bundled source assets are **CC0 1.0 Universal**, redistributable and editable:
https://creativecommons.org/publicdomain/zero/1.0/

Downloaded from the pinned public GitHub mirror `rawprogress/fable-cities` at
commit `aea8b1035030952555395de0c1de14ba693a1427`. Each source's `info.json` states
its author/upstream asset and CC0 license. The mirror's shared MANIFEST.md
explicitly identifies its normal maps as OpenGL Y+.

`manifest.json` records exact source/evidence URLs, downloaded bytes and hashes,
and every bundled output's hash. The original sources are cached outside this
repository. Reproduce with `python3 tools/prepare-living-assets.py` (Pillow/numpy).

| Runtime material | Downloaded source |
| --- | --- |
| grass | ambientCG Grass004 |
| asphalt | ambientCG Asphalt031 |
| wood | ambientCG Planks021 (actual planks) |
| paving | ambientCG PavingStones128 |
| sand | ambientCG Ground055S (actual sand) |
| needles | ambientCG Ground038 (forest floor) |
| rock / stone | ambientCG Rock035 |
| brick | ambientCG Bricks075A |
| roof | ambientCG RoofingTiles013A |
| gravel | ambientCG Gravel022 |

These retain photographic detail at **1024×1024** for color, with separate
**512×512 OpenGL normal and roughness maps**. Color maps receive modest saturation,
contrast and brightness adjustments for the game's existing arcade palette;
normal and roughness data remain untinted. Normal maps use lossless WebP.

| Textured prop | Source / author |
| --- | --- |
| Painted wooden bench | https://polyhaven.com/a/painted_wooden_bench — Kirill Sannikov |
| Street lamp 02 | https://polyhaven.com/a/street_lamp_02 — Josh Dean |
| Planter box 01 | https://polyhaven.com/a/planter_box_01 — James Ray Cock |

The props retain their downloaded geometry, UVs, material assignments and
color/normal/packed ARM textures. Node transforms are baked and each prop is
rooted at Y=0, centered in X/Z, with source scale retained. Packed ARM uses the
source's roughness G and metalness B channels. Mesh streams are little-endian
Float32 position XYZ, normal XYZ, UV (stride 8); index.json records primitive
ranges and materials. This dependency-free conversion does not change licensing.

The separate existing `assets/courses/` Kenney/ambientCG bundle and `assets/`
reflection/nature bundle keep their original credit files.
