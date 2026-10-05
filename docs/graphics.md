# Graphics tuning

The graphics pass is presentation-only: track surfaces, collision boundaries,
physics and race progression still use the existing course contract.

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
- `style.css` and `race-hud.js` own race presentation while retaining the HUD's
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
