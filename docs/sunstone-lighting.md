# Sunstone baked global illumination

Sunstone uses a Cycles diffuse bake with 128 samples and four diffuse bounces.
It captures sky occlusion, warm sunlight bouncing off stone and sand, and soft
local lamp lighting. Direct sun is removed from RGB and stored as visibility in
alpha. The shader takes the darker of baked visibility and the live sun shadow,
so static roofs still shade the floor beyond the live shadow range and moving
racers retain their shadows without multiplying two copies of the same shadow.

Architecture has a separate 2048px atlas; original texture UVs remain intact.
The whole course has a 1024px ground map, with a 512px regional map concentrating
detail around the temple. Height maps reject lighting from a different surface.
Static architecture remains regionally batched. Ground receivers explicitly use
the spatial map, fixing the previous four-corner vertex bake hiding ground shade
on Sunstone and other courses.

Directional probes follow the route at 12m intervals outdoors and 4m intervals
through the temple, with three lanes and three heights. Nine RGB spherical
harmonic coefficients and sun visibility interpolate onto racers and the moving
solar mechanisms. Route interpolation keeps nearby roads behind walls from
polluting each other's lighting. These probes add no real-time lights or passes.

The five GI textures use 26 MiB before mipmaps (about 33 MiB with the color-map
mip chains). Probe data uses about 187 KiB. An architecture fragment adds one
texture read; a ground fragment normally reads its lighting and height map.
Temple borders also sample the outdoor pair. Fully covered ground skips the
old ground-map reads. The existing sun shadow, three bounded local-light slots,
graphics tiers and postprocessing remain in place. Static lamps are already in
the probe bake and do not also illuminate racers through live point lights.

Regenerate with `node tools/bake-all-lighting.mjs sunstone-ruins`. This exports
the actual course geometry, refreshes the legacy ground/mesh bakes, then runs
Cycles. Blender and the exporter's Playwright/browser dependencies are required.
For probe-only changes, `SUNSTONE_GI_REUSE=1 blender -b -t 8 --python-exit-code 1
--python tools/bake-sunstone-gi.py` reuses texture files only after scene identity,
sample count and file hashes match. Runtime also validates probe hashes and size.

`node tools/check-sunstone-lighting.mjs` captures seven deterministic course
views and records draw counts, render passes and frame timings. Set
`SUNSTONE_BASELINE_DIR` to a directory containing the original `src` and
`assets/lighting/sunstone-ruins` trees for a before/after comparison. Reports and
PNGs go to `/tmp/sunstone-lighting-check`. Software-rendered timings establish
relative work on that renderer; they do not predict frame rates on a player GPU.
