# Asset credits

The environment graphics below are licensed under **CC0 1.0 Universal**:
<https://creativecommons.org/publicdomain/zero/1.0/>. They may be modified and
redistributed, including in commercial games. Credit is included as a courtesy.

| Runtime asset | Creator and original asset | Adaptation |
| --- | --- | --- |
| `asphalt.webp` | Lennart Demes / [ambientCG Asphalt010](https://ambientcg.com/view?id=Asphalt010) | Resized to 256 × 256, reduced contrast, cool gray palette, WebP |
| `grass.webp` | Lennart Demes / [ambientCG Grass004](https://ambientcg.com/view?id=Grass004) | Resized to 256 × 256, sunny green palette, WebP |

Sources were retrieved through public GitHub distributions:

- Textures: [rawprogress/fable-cities](https://github.com/rawprogress/fable-cities/tree/main/public/assets/shared), with matching upstream source attribution.

The environment source and runtime hashes are recorded in `manifest.json`.
`tools/prepare-assets.py` reproduces that local asset set. Source downloads stay out of the browser's runtime network
path; the compact glTF files required by the game are bundled locally.

The sky gradient, signs, flames, and remaining procedural
graphics are original Turbo Trail artwork. Three.js and fonts retain their
existing licenses under `vendor/`.

The living-world upgrade adds ten downloaded 1K ambientCG PBR material sets. See [their credits, source and conversion details](living/LICENSES.md) and `living/manifest.json`. These are served locally and retain separate normal and roughness maps.

## Racers

The six karts and drivers come from the [SuperTuxKart 1.4 asset collection](https://supertuxkart.net):
Tux (penguin), Nolok (reptile), Pidgin (bird), Kiki (robot), Konqi (dragon),
and Wilber (mascot), each with its own vehicle. These adapted models use
**CC BY-SA 3.0 / 4.0**, with original author notices, source links, modifications
and reproduction instructions in [the racer credits](courses/packs/shared/LICENSES.md).
The shared pack manifest records exact runtime hashes.

## Six adventure art packs

Tempest, Pantry, Railstorm, Metronome, Pelagic and Emberwing add local models from
[Kenney's kits](https://kenney.nl/assets) and PBR scans from
[ambientCG](https://ambientcg.com), under CC0. Their manifests include original
source URLs, redistribution URLs, source hashes and adapted-file hashes. Rock
models are beveled, scan-textured and vertex-occlusion baked offline.

Additional detailed foliage and cottages share existing SuperTuxKart derivatives
from the Windmill and Sunstone packs under CC BY-SA 3.0/4.0. Each reused entry links
to its retained original author/license notice; shared local paths avoid copying
these assets into six packs. See [the art and verification notes](../docs/adventure-fidelity.md)
and `tools/prepare-adventure-fidelity.py` / `tools/polish-adventure-models.py`.

Complete authored old-house and steam-locomotive landmarks by **Sven Andreas
Belting** are converted from the pinned [SuperTuxKart asset distribution](https://github.com/Nomagno/stk-assets/tree/b917b6c01b55b43208c5eaa1b4d187bbf59457ac/library),
under CC BY-SA 4.0 with separately attributed source textures. Original UVs and
house normal maps are retained, diffuse textures are resized to 1024px, and SPM
is converted to GLB. See the [house notice](courses/packs/railstorm-express/licenses/old-house.txt),
[locomotive notice](courses/packs/railstorm-express/licenses/steam-engine.txt) and
[texture notices](courses/packs/railstorm-express/licenses/landmark-textures.txt).
Clockwork shares the local house file; source revision, original and derivative
hashes and modifications are in both course manifests. Reproduce with
`tools/prepare-course-landmarks.py`.

Shared scanned material roles use CC0 ambientCG and Poly Haven scans; fabric uses CC0 Sheen Chair maps by Eric Chadwick / Wayfair, LLC from the pinned glTF Sample Assets distribution. Source links and file hashes remain in the fidelity manifest.

Clockwork Citadel also uses Kenney’s CC0 Space Kit chimney, generator and pipe models, obtained from the pinned [tge-assets distribution](https://github.com/Hidencod/tge-assets/tree/08f0c913f6783cc81f9f6105a7cdda8562b1c192). Source URLs, revision and SHA-256 hashes are in its manifest; see the [machinery notice](courses/packs/clockwork-citadel/licenses/kenney-machinery.txt). These models have no skeletons or animation clips. City gears, pistons, zeppelin propellers and aircraft motion use race-clock procedural animation.
