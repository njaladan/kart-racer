# SuperTuxKart racer collection

These six textured racers are adapted from the **SuperTuxKart 1.4** asset
collection: https://supertuxkart.net

Pinned release archive:
https://github.com/supertuxkart/stk-assets-mobile/releases/download/1.4/stk-assets-full.zip

Archive SHA-256: `ad61912093e7d4b399c8e4841156f45550a8b60dc59a290ad84058a9bae0622d`.

| Racer | Authors | License for this adapted GLB |
| --- | --- | --- |
| Tux (penguin) | Julian “XGhost” Schönbächler | CC BY-SA 3.0 |
| Nolok (reptile) | Tobias “cheleb” Beyrer, STKRudy85, Marianne Gagnon, Samuncle | CC BY-SA 4.0 |
| Pidgin (bird) | Tobias “cheleb” Beyrer, STKRudy85, chronomaster, Vincent “vlj” Lejeune, Crystal | CC BY-SA 3.0 |
| Kiki (robot) | Typhon306, ZAQraven, Crystal; mascot design by Tyson Tan | CC BY-SA 3.0 |
| Konqi (dragon) | ZAQraven, Benau (scarf texture) | CC BY-SA 3.0 |
| Wilber (mascot) | Néd J. “jymis” Édoire | CC BY-SA 3.0 |

Original per-file copyright, license and contribution notices are preserved in
[licenses/](licenses/), including the shared texture notices. The notices also
mention upstream icons and sounds that are **not** bundled in this adaptation.
Nolok combines CC BY-SA 3.0 geometry with CC BY-SA 4.0 texture work; its adaptation
is released under CC BY-SA 4.0. The other adapted models retain CC BY-SA 3.0.

License terms:
- CC BY-SA 3.0 Unported: https://creativecommons.org/licenses/by-sa/3.0/
- CC BY-SA 4.0 International: https://creativecommons.org/licenses/by-sa/4.0/

You may use, modify and redistribute these models, including commercially,
provided you retain attribution and license notices, indicate your changes,
and distribute adapted artwork under the applicable ShareAlike license.
These licenses apply to the racer artwork; the existing game code and other
asset licenses remain separate. No endorsement by SuperTuxKart or the mascot
projects is implied.

## Changes made for Turbo Trail

Converted each SPM's saved driving pose into a static GLB, assembled its four
wheel meshes using the source kart XML coordinates, and included Kiki's tail
and Konqi's scarf. Resized textures to at most 512 px and baked the existing
chassis color masks into diffuse textures where available. Original character
animations, secondary decal layers, and engine-specific glow meshes were
omitted. Small surfaces that referred to common metal/lamp shader textures
use original solid-color materials instead. Runtime models preserve proportions
with uniform scaling; steering pivots and axle rotation animate independently.

All diffuse textures are embedded and all runtime files are served locally.
The manifest records source paths, attribution files, modifications, byte counts
and SHA-256 hashes for each generated model.

## Reproduce

Install Blender 4.3+, Pillow and numpy, then run:

```sh
python3 tools/prepare-shared-assets.py
```

The tool verifies and caches the pinned upstream archive in the system temporary
directory and invokes `tools/convert-stk-karts.py`. The SPM importer is vendored
from https://github.com/supertuxkart/stk-blender at commit
`992ab8aad3e9a4850e1ec25145940dd10da509c4`; its MIT license is preserved at
`tools/vendor/stk-spm/LICENSE`. The upstream archive and conversion scripts
provide the source material and conversion workflow for further modifications.
