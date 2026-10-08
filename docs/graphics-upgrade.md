# Graphics upgrade

This guide describes the shared rendering work and the twelve authored course-polish modules. The changes add layered lighting and course detail while keeping optional draw work bounded by quality tier. They do not establish a hardware frame-rate guarantee.

## Shared improvements

- **Material stability:** `src/rendering/material-polish.js` uses the existing material patch registry to apply derivative-based specular anti-aliasing and distance/pixel-footprint roughness broadening. It avoids globally flattening roughness or overriding mapped roughness, and skips transparent, transmissive, and metallic surfaces where the treatment could erase intentional highlights. Existing PBR color, normal, and roughness maps remain paired.
- **GPU texture path:** `src/rendering/compressed-textures.js` and `assets/compressed-textures.json` provide 134 Basis Universal ETC1S KTX2 textures with mipmaps: 66 color, 34 normal, and 34 linear maps. The manifest records per-file source and output SHA-256 hashes. At the checked-in manifest totals, source images are 21,149,893 bytes and KTX2 outputs are 11,764,638 bytes (about 44% smaller overall). Color maps use sRGB; normals and scalar maps use linear data. Originals remain available when KTX2/GPU format support is unavailable or a compressed load fails. Transcoding selects a supported GPU format at runtime; memory use and visual quality vary by device and driver.
- **Shared dressing kit:** `src/rendering/course-polish-kit.js` provides seeded placement, safety checks against the playable route, cached materials/geometries, batched static meshes, and bounded animated updates. Course modules add landmarks and readable surface detail without changing course collision geometry.
- **Layered lighting:** `src/rendering/layered-lighting.js` registers localized sources, visible emitters, animated intensity/position, and optional patterned transmitted-light patches. These are visual lighting cues; the renderer retains the single main shadow-casting sun and uses local non-shadow lights for nearby racer fill. Baked diffuse lighting remains separate.
- **Captured reflections:** Four 64-pixel sector cubemaps capture the assembled course once at load, in linear HDR, then receive PMREM filtering. Sheltered and open probes differ, and each racer selects its nearby probe; captures do not run per frame.
- **Course response:** `src/rendering/wind-field.js` shares a coherent course wind signal across foliage and environmental particles. `src/rendering/surface-interactions.js` reuses a 256-instance tire-contact trail pool, fading marks from 3 to 9 seconds. `src/rendering/drum-response.js` makes drum skin respond to the simulation's drum-impact event for up to 0.7 seconds.

## Twelve course polish passes

Each entry is implemented by `src/courses/polish/<course>.js`, selected through `src/courses/polish/index.js`. Dressing is seeded and placed through the kit's route-clearance checks.

| Course                | Added authored detail and lighting                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Windmill Wilds        | Tree silhouettes, rooted verges and grove accents; paired mill practicals, a canopy-leaf patch, and fireflies.                 |
| Sunstone Ruins        | Layered sandstone, eroded columns and dune/stelae details; stained-glass shaft and torch/fire accents.                         |
| Frostpeak Festival    | Wind-sculpted snow banks, exposed ice seams, pine silhouettes and chalet warmth; preserves the course's aurora.                |
| Neon Harbor           | Varied harbor facade silhouettes and quay details; practical signage, a bounded searchlight, and moving delivery headlights.   |
| Clockwork Citadel     | Structural trusses, portal-like route framing, worn deck plates and moving machinery; warm foundry practicals.                 |
| Metronome Hall        | Repeating instrument-case bays, recessed resonators and pendulum accents; warm lamps set into the architecture.                |
| Paper Revel           | Layered cut-paper edges and folded silhouettes; lanterns with lattice or stained-glass patches and animated paper tails.       |
| Pocket Pantry         | Shelf and kitchen detail, utensils, crumbs and cloth/board props; small practical pools and patterned window spill.            |
| Railstorm Express     | Track joints, plates, fasteners, braces and retaining-wall rhythm; moving convoy cues, station lamps and lattice searchlights. |
| Tempest Causeway      | Sea stacks, exposed foam shelves, bridge details and sheltered cottages; beacon searchlight and storm-envelope flashes.        |
| Pelagic Glasshouse    | Reef, grotto and glasshouse silhouettes with rib highlights; localized shafts and bioluminescent sources.                      |
| Emberwing Observatory | Basalt, lava fissures, caldera silhouettes, white terraces and observatory detail; localized lava and warm practicals.         |

## Layered-lighting palette

The categories below describe artistic layers, not a one-to-one enum. Some are covered by the shared sky, baked lighting, or course atmosphere rather than an individual local source. Examples name the current shared path or an authored course use.

| Artistic layer                     | Current path or example                                                                                                                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sun / moon key                     | `sky.js` renders sun/moon discs and halo; `course-lighting.js` supplies the single shadow-casting sun key.                                                                                                  |
| Sky fill                           | `sky.js` gradient/cloud field and hemisphere ambient fill.                                                                                                                                                  |
| Ground / wall colored bounce       | Normal-relative object AO and colored bounce (`mesh-light-bake.js` / `baked-lighting.js`), plus ground lighting and registered practical pools. Matched objects skip ground spill to avoid double lighting. |
| Dark shelter / occlusion           | Shadow map and baked height/occlusion response; route-side recesses are authored in the course polish modules.                                                                                              |
| Window spill                       | Patterned patches in the layered-lighting system; examples in Pocket Pantry and Paper Revel.                                                                                                                |
| Practical fixtures                 | Local fixtures and visible source markers, e.g. Metronome Hall, Railstorm, and Windmill.                                                                                                                    |
| Fire / candle                      | Fire source kind; torches in Sunstone Ruins and warm foundry/fire cues in Clockwork Citadel.                                                                                                                |
| Lava / heat                        | Lava source kind; Emberwing fissures and caldera.                                                                                                                                                           |
| Neon / signage                     | Emissive signage materials and harbor practicals in Neon Harbor; emissive material glow is not a general volumetric neon system.                                                                            |
| Reflected light                    | Course reflection environment/PMREM plus wet-road reflection path; this is environment/surface response, not a new local bounce solver.                                                                     |
| Transmitted colored glass / fabric | Stained-glass patches and translucent authored materials in Sunstone, Paper Revel, and Pocket Pantry.                                                                                                       |
| Patterned / cookie light           | Lattice, leaves, and stained-glass patch shaders; used by Railstorm, Windmill, Paper, and Pantry.                                                                                                           |
| Water caustics                     | Animated reef caustics in `adventure/pelagic-materials.js` now attenuate with depth, face direction and shelter; the shared patch shader also supports localized caustics.                                  |
| Shafts / volumetric-looking beams  | Capped shaft meshes and localized patches; Sunstone, Pelagic, and searchlight accents. These are surface/beam cues, not volumetric fog integration.                                                         |
| Bioluminescence                    | Bioluminescent source kind in Pelagic Glasshouse.                                                                                                                                                           |
| Moving sources                     | Source updates are bounded and course-authored; Railstorm convoy lights and Pelagic source accents.                                                                                                         |
| Passing vehicle headlights         | Headlight source kind; Neon Harbor delivery runners and Railstorm moving convoy.                                                                                                                            |
| Weather / lightning                | Existing course weather and sky storm flash; Tempest Causeway attaches a local weather-flash cue to the existing storm envelope.                                                                            |
| Celestial / aurora / star glow     | Shared sky stars and course aurora support; Frostpeak preserves its authored aurora.                                                                                                                        |
| Gameplay boosts / drift / items    | `surface-interactions.js` registers moving racer lights for boost, drift and star states. They share the three nearby light slots with course practicals.                                                   |

## Practical runtime budgets

These are explicit caps or configured goals in code, not measured frame rates. Actual cost depends on resolution, GPU, browser, driver, and scene load.

| Work                    | Current bound / tier behavior                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Racer fill lights       | Up to 3 nearby non-shadow point lights at higher tiers; reduced to 2 or 1 at lower tiers. No per-fixture shadow maps.                                                                     |
| Patterned light patches | At most 24 patch meshes per scene; at most 6 selected as visible. Camera-distance and quality-tier gates reduce active work.                                                              |
| Visible source markers  | At most 12 owned source meshes per scene.                                                                                                                                                 |
| Shaft meshes            | At most 4 per scene.                                                                                                                                                                      |
| Tire contact            | 256 reusable instances; marks fade over 3–9 seconds rather than accumulating meshes.                                                                                                      |
| Environmental particles | Per-field capacities vary by weather (storm 720, snow 140, dust 72, city 44, default/forest 50); quality density is 45%, 65%, 85%, or 100%.                                               |
| Graphics quality        | Performance target is 30 FPS with shadows disabled; Balanced, High, and Ultra target 60 FPS with 1024, 1024, and 2048 shadow maps respectively. These are settings goals, not benchmarks. |
| Texture payload         | 134 KTX2 files total 11.76 MB versus 21.15 MB of source files in the manifest; source fallback remains bundled. GPU residency depends on the selected transcode format and device.        |

## Bakes, validation, and limits

The existing course ground-lighting bake remains a separate asset path and carries its own source metadata. Mesh lighting is generated from deterministic scene samples and stores compact per-vertex/per-instance data with source-scene hashes; direct sun is excluded so it is not double-counted with the live key. Bake freshness must be checked against the current scene hash after geometry or lighting-source edits. The new mesh-lighting outputs are generated artifacts; this document does not claim that all twelve have been regenerated for the latest integration.

Texture source/output hashes and channel assignments are recorded in `assets/compressed-textures.json`; run `node tools/prepare-compressed-textures.mjs` to regenerate the compressed set when source maps change. Devices without a supported KTX2 transcode target use the original image path. Browser captures under software rendering can check composition, visibility, and obvious shader/load failures, but cannot establish target-device FPS, GPU memory, or hardware-specific image quality. No hardware performance benchmark is claimed here.

Regenerate both lighting paths with `node tools/bake-all-lighting.mjs` (requires Blender). `LIGHTING_BAKE_JOBS` controls parallel jobs. To capture deterministic views, use `SCREENSHOT_CAPTURE_REPORTS=1 node tools/capture-readme-screenshots.mjs`; the reports include mesh-lighting coverage and source identity.
