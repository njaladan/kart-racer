# Downloaded living-world materials

All bundled source assets are **CC0 1.0 Universal**, redistributable and editable:
https://creativecommons.org/publicdomain/zero/1.0/

Downloaded from the pinned public GitHub mirror `rawprogress/fable-cities` at
commit `aea8b1035030952555395de0c1de14ba693a1427`. Each source's `info.json` states
its author/upstream asset and CC0 license. The mirror's shared MANIFEST.md
explicitly identifies its normal maps as OpenGL Y+.

`manifest.json` records exact source/evidence URLs, downloaded bytes and hashes,
and every bundled output's hash. The original sources are cached outside this
repository. Reproduce with `python3 tools/prepare-living-assets.py` (Pillow).

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

The separate existing `assets/courses/` bundle keeps its own credit files.
