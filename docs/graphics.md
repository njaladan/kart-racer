# Graphics tuning

The graphics pass is presentation-only: track surfaces, collision boundaries,
physics and race progression still use the existing course contract.

## Neon Harbor and Sunstone fidelity

Neon asphalt has antialiased fissures, darker wet areas and smoother puddle
normals. Sign and window reflections reuse the building atlases on road ribbons
that follow the actual bends and banks. Their masks share the pavement's puddle
pattern, soften at grazing angles and break up the reflected image. These are
authored approximations, so they remain available without rendering a second
scene. Regional batches and the existing textures limit their draw and memory cost.

Ultra additionally captures nearby buildings and racers with a mirrored camera.
The capture is half resolution, capped at 640 pixels on both axes, and updates
on alternating frames. It reuses the main shadow map. Flat city sections qualify;
slopes, banks, bridge and ferry sections use the atlas reflections. Height and
distance fades prevent a flat mirror from extending across changing road levels.
The image and projection matrix are cached together. Lowering quality disables
the capture and releases its large GPU buffers. This adds a scene pass on capture
frames, so leave it in Ultra until measurements on player hardware justify a
broader default. Paused frames reuse the capture. Adaptive quality can drop it
automatically.

Sunstone paving and walls use staggered joints, chipped edges, varied block
color and derivative normal relief. Recessed floor joints collect sparse moss.
Sand dunes use their own material so masonry seams do not appear on sand.
Their placement checks use the full dune radius to keep the temple corridor clear.
Temple rubble, vines, torch fixtures and skylight cards add nearby scale cues.
Static torch spill and the warmer wall palette are included in the regenerated
768px lighting bake; only the existing bounded racer lights update at runtime.

| Setting | Shared artwork | Optional work |
| --- | --- | --- |
| Performance | Pavement, atlas reflections, carved stone, temple dressing, baked light | Sparse street vapor; no shadows or bloom |
| Balanced | Same | More vapor, 1024px shadows; no bloom |
| High | Same | More vapor, 1024px shadows and quarter-resolution bloom |
| Ultra | Same | Full vapor, 2048px shadows, bloom and bounded live road reflections |

Browser validation covers all four tiers, the flat downtown reflection and the
buried temple. Software Chromium checks shader compilation and scene behavior;
its frame rate does not measure player GPU performance. Further progress toward
the visual references needs more detailed authored meshes and richer material
scans; this pass focuses on surface lighting and reuses the bundled assets.

At 960×540, High, frozen at Neon progress 0.15, browser counters changed from
709 to 750 draws (+5.8%) and 203,491 to 223,469 triangles (+9.8%), including
the shadow and postprocessing passes. Loaded textures changed from 66 to 67
(the small vapor mask). These counts compare the same camera and race time;
they do not predict the shader or transparency cost on a particular GPU.
At Sunstone progress 0.655 with the same settings, draws changed from 955 to
1,018 (+6.6%) and triangles from 423,267 to 432,123 (+2.1%); texture count
remained 75. The clearer dune placement offsets part of the added dressing cost.

## Sunstone sandfalls and solar focus

The four canyon sandfalls share one geometry and material. Shader strands flow
downward at different speeds, with small flutter and a widening base; their
frustum bounds include that displacement. Animation uses the race clock, so
pausing and restarting reproduce the same frame.

Each solar engine has one open, depth-tested beam and a soft footprint on its
moving pad. The beam joins the actual banked lens core to the pad transform;
`solarLaneAt` remains the shared source for boost-lane motion. Three cones and
three footprints add six bounded draw objects without new lights, textures or
render targets. Animated effects do not cast shadows or enter the static bake.

Six Sunstone checks pass, including five complete AI races and beam endpoints
after scenery batching. All twelve course scenes assemble with finite geometry.
A screenshot-free Chromium shader check renders the sandfall, beam and footprint
with no shader or page errors; GPU pixel readback confirms motion, identical
paused frames and an exact return to the starting frame. This checks rendering
correctness rather than player-device performance or full-lap composition.

## Environmental layers across all twelve courses

The [environment pass](environment-effects.md) adds 81 local particle fields with
twelve analytic shapes and five motion families, plus course-specific surface
movement. Rain changes wet-surface normals; ice, brass and dew have sparse glints;
canopy shade, paper fibers, sand, caustics and lava spill move gently with race
time. Existing texture, normal, bake and reflection hooks remain composed.
Particle density follows graphics quality and adaptive quality. Single-pass
quads, lifetime/near-camera fades, regional bounds and fog keep their cost bounded.

Supporting roadside stories add machinery and festival motion to selected
settings. Their full motion envelopes clear every road level. All twelve bakes
were regenerated at their existing resolutions/samples and checked against the
final scene-export hashes. The new effects use original procedural geometry and
shader shapes; no downloaded particle sheets or scenery assets were added.

## Tempest Atlantic water

Tempest uses four directional Gerstner wave trains with deep-water dispersion,
analytic normals and horizontal crest compression. Its muted teal palette and
pale green-white foam follow the established storm coast. Boats and buoys query
the same spectrum, including inversion of horizontal displacement, and lean with
the surface. The simulation clock controls all motion, including foam, so pause
and restart reproduce the same surface.

Whitecaps use the displacement Jacobian and a short analytic crest history.
Slowly advected patch and cellular bubble textures break up the foam; denser
coverage merges bubble walls into froth. Coastal foam samples a signed-distance
map of authored islands, rocks and piers. Those footprints approximate the
shore silhouette; they do not simulate depth or collisions. This replaces the
separate animated foam rings. Fine ripples use two rotated slope layers; mipmaps,
distance fades and increased far roughness reduce distant sparkle.

The design draws on [NVIDIA's geometric water and analytic normals](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models)
and the wave-correlated foam, advection and filtering principles in
[Dynamic Wave Trains (2026)](https://onlinelibrary.wiley.com/doi/10.1111/cgf.70495).
[Recent hybrid FFT/particle work](https://arxiv.org/abs/2511.02852) also informed the
research. This implementation uses a bounded analytic spectrum and procedural
crest history rather than those papers' complete ocean solvers.

Water remains one opaque PBR draw and reuses the existing prefiltered environment.
There are no additional lights, reflection captures, render targets or simulation
passes. The grid concentrates vertices over the playable coast and becomes
coarser offshore. Performance uses 32,768 water triangles; Balanced, High and Ultra
use 73,728. The two original data textures total about 0.58 MiB including mipmaps:
a 256px slope/foam atlas and a 512px single-channel coastal distance map. They are
generated during loading; the coast updates only when a footprint is added.
The material releases both textures on disposal. Water does not cast shadows or
enter the static bake.

At 960×540, High, progress 0.24 and race time 18.08, browser counters changed from
1,098 to 1,081 draws and 308,646 to 352,314 triangles. The denser ocean adds geometry
while removal of foam rings saves draws and triangles. These are scene counters,
not a player-device frame-rate measurement; animated rivals and particles also
contribute small differences between captures.

`npm run check` passes all 218 tests, including surface derivatives, world-space
buoyancy, culling bounds, quality transitions and coastal uploads. Run
`node tools/check-tempest-water.mjs` for WebGL validation at all four tiers and
close, grazing and distant views. GPU readback checks visible motion, identical
paused frames, exact rewind and the one-draw triangle budget. Software Chromium
validates correctness; target hardware is still needed for FPS profiling.

## Ownership and interfaces

- `game-scene.js` owns renderer settings, lights and shared material construction.
  Course `theme` objects supply palette and exposure. `living-assets.js` prepares
  the shared asphalt scan once; the procedural fallback lives in `textures.js`.
- `kart-builder.js` owns each racer's model and independent appearance.
  `game-renderer.js` applies poses; driving effects use the existing bounded
  particle pool and simulation clock.
- Course world modules own scenery composition and local decoration. Shared
  `course-runtime.js` builds the road, shoulders and track edges from the same
  queries used by the simulation.
  `terrain-height.js` matches scenery placement to the rendered terrain's
  linear cross-section, including banking; it does not change driving surfaces.
- `style.css` declares the cascade order for the focused files under `styles/`.
  `race-hud.js` owns race presentation while retaining the HUD's
  DOM IDs and update interface.

## Shared effects

`visual-effects.js` provides three small helpers without browser-only APIs:

- `createGlowSprite({color, size, opacity, position})` returns a depth-tested,
  additive sprite. `size` is a diameter or `[width, height]`; `position` is a local
  `[x, y, z]` offset. Its material is independent for local animation.
- `addGlow(parent, options)` adds and returns that sprite. Use a bounded number
  of halos near light sources; they do not create lights or a bloom render pass.
- `createContactShadowMesh({width, depth, opacity})` returns a horizontal XZ
  footprint. Position it just above the local receiver. Geometry and materials
  are shared by opacity, so reuse a few opacity values and batch static shadows.

The masks are shared 64px textures. New decorations should preserve batching,
declare animated groups through the existing world interface, and freeze with
the race clock when paused.

## Useful visual checks

Check a daylight course and Neon Harbor for colour/highlight balance, the opening
Frostpeak and Sunstone vistas, and HUD clearance on a narrow touch viewport.
Drift, boost and land once, then pause and restart. The normal course-rendering
checks cover finite scene geometry and batching; software-browser frame rates
are not representative of player hardware.
