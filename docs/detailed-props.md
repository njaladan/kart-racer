# Detailed props, material coverage and lighting

This pass adds eight downloaded, UV-mapped PBR models, sixteen shared material
roles and regenerated offline lighting across all twelve courses. Source
attributions, licenses, adaptations and reproduction instructions are in
[the asset credits](../assets/fidelity/CREDITS.md).

## Artwork and coverage

Pantry gains an avocado, bottle and refrigerator; Metronome uses the downloaded
radio for its existing large radios, alongside upholstered seating. Pelagic's
twelve animated fish schools use textured fish, instanced in each school's local
frame. Cameras and lanterns form expedition displays and lit festival/station
settings. Each imported model has near, mid and far geometry; the same texture
files are shared by all three variants. Authored metal, glass, fabric sheen,
clearcoat and emissive maps retain their distinct physical responses.

Opaque scenery without an existing normal or bump map receives scanned albedo
detail, normals, roughness, AO and supplied height relief. Artist albedo maps and
existing complete PBR materials are preserved. World projection handles UV-less
and batched geometry; moving scenery uses local coordinates to keep detail
attached. Explicit material identities take precedence over palette inference.
Glass, water, glowing cards and specialized shaders are intentional exceptions.

The assembled-course audit counts mesh components, expanding instances and merged
parts and selecting the nearest LOD. It excludes racers, race items and the sky:

| Measurement | Before | After |
| --- | ---: | ---: |
| Counted components | 46,280 | 46,452 |
| Without any surface map | 12,494 (27.0%) | 1,996 (4.3%) |
| Geometry generated in JavaScript | 30,501 (65.9%) | 30,610 (65.9%) |
| Geometry from model files | 15,779 (34.1%) | 15,842 (34.1%) |

This measures component counts, not screen area, unique full props or visual
quality. [The per-course audit](model-texture-audit.json) records both inventories.
The upgrade deliberately keeps procedural track geometry, modular architecture
and scenery assemblies; better surface shading does not change their provenance.

AAA games commonly combine authored models, scan libraries, procedural tools,
trim sheets, decals, instancing and LODs. A textured mesh generated in code is not
inherently inferior. Silhouette, UVs, material response, placement and lighting
matter more than whether its mesh originated in OBJ, glTF or code. This pass
adopts those production practices within a browser budget; it does not claim
AAA asset density, bespoke texture authoring or console-quality global illumination.

## Lighting and relief

All course bakes use 768px indirect-light/AO and height maps, with sixteen
hemisphere samples. Authored lamps are visibility-tested against the actual
scene. New area emitters use four samples for softer occlusion; thin glass and
cutout foliage transmit attenuated light. Ten courses also use colored spill
atlases at multiple heights, so vertical walls and interiors receive local light.
Sunlight and dynamic shadows remain live, with the existing cap of three nearby
non-shadowed lights for racers. Added baked emitters do not add live scene lights.

These are spatial indirect-light and spill projections, not unique high-resolution
lightmaps for every object. Glass transport is an opacity approximation, not a
spectral/path-traced simulation. Twelve material roles include actual source
height maps, used for fragment normal relief. There is no global vertex
displacement or tessellation: collision surfaces, silhouettes and driving physics
remain aligned. Major silhouette improvements come from imported geometry.

## Performance tradeoffs

More detailed artwork adds download bytes, geometry and texture work. The new
asset directory is about 73 MB, including all courses' assets, offline WebP
alternatives, licenses and scalar height maps. A player loads only the selected
course's hero models and needed living-world scans, plus shared atlases. Startup
decodes/transcodes new maps; textures and compressed-loader workers are cached.

KTX2/UASTC mipmaps transcode to supported GPU block formats. At 8 bits per pixel,
their texture memory is approximately one quarter of RGBA8 with the same mip
chain. This comparison is against decoded RGBA8, not WebP download bytes; the
added artwork can still increase total memory. Unsupported compression formats
can require an uncompressed GPU fallback.

The scan layer adds texture samples and derivative shading without additional
draws. High/Ultra blend up to three projections; Performance/Balanced use one.
Quality changes update a shared uniform. LODs reduce hero triangles with distance;
the refrigerator drops from roughly 209,000 source triangles to 50,435 near,
24,329 mid and 7,860 far. Animated fish retain local bounds and LOD ownership.
Shared box geometry lets regional batching reuse more primitive geometry.

Baked lighting has preparation and storage costs but adds no per-frame rays or
area-light shadow passes. Existing adaptive quality still controls shadows,
postprocessing, particles, local lights and pixel density. Browser renderer
counters include shadow and postprocessing passes; they measure submissions,
not GPU time. Software Chromium is useful for shader validation and captures,
but cannot establish FPS on player hardware.

The [twelve fixed-camera counter comparisons](detailed-props-render-counters.json)
record draw calls, triangles and resident texture/geometry counts at High,
960×540. Draw submissions generally stay close to baseline; these views are
not the worst case for approaching a detailed focal prop. Added surface shading
can increase frame time even where draw and triangle counts remain unchanged.
At the pantry view, submissions rise from 459 to 476 and triangles from 470,264
to 516,940. Railstorm rises from 511 to 554 submissions and 208,952 to 257,067
triangles. Pelagic's instancing reduces submissions from 1,494 to 1,395 while
the detailed fish increase triangles from 905,871 to 1,023,509. These are real
content costs alongside the unchanged or cheaper views elsewhere.
The counter comparisons and coverage inventory precede the separately authored
Tempest wave update merged before publication. Its combined scene is checked
and its lighting rebaked after integration; the other comparisons are unchanged.

## Verification

[The counter view](screenshots/pantry-detailed-props.jpg) shows downloaded
props along the road. All twelve courses render without shader
errors in browser captures. [The four-tier browser check](detailed-props-quality-check.json)
verifies the live settings transitions and pause/resume; the full project suite
passes 218 tests. Final bake source hashes match the final exported scenes.

Asset tests verify pinned sources, retained licenses, adapted-file hashes, UVs,
normals, mipmapped KTX2, shared LOD texture paths and simplification budgets.
Behavioral tests cover shader-hook composition, shader-cache separation, material
identity, quality uniforms and animated instance ownership. The assembled-scene
route audit found zero solid-prop intersections on all twelve courses; Pelagic's
284 reported intersections are exclusively its intentional water surface.

Use `npm run check` for project checks. Reproduce geometry audits with
`COURSE_ROUTE_AUDIT=only node tools/export-lighting-scene.mjs`. The export tool
reads the WebP alternatives with identical geometry, and feeds
`tools/bake-course-lighting.py`; source-scene and output hashes are retained in
each `assets/lighting/<course>/bake.json`. Browser captures use
`tools/capture-readme-screenshots.mjs`; `SCREENSHOT_CAPTURE_REPORTS=1` records
renderer counters, and `SCREENSHOT_CAPTURE_FRAMES=1` reduces software-renderer
capture time while retaining a complete rendered frame.
