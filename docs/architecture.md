# Project architecture

Turbo Trail uses native browser ES modules and bundled Three.js. There is no build step. `src/game.js` creates the page and scene, selects the track, and connects the controllers below. Runtime state stays with the controller that owns it.

| Responsibility | Entry point | Owned state and operations |
| --- | --- | --- |
| Race lifecycle | `src/simulation/race-session.js` | Countdown, pause, race clocks, finish transition, fixed-step orchestration, hit and recovery rules |
| Racer placement | `src/simulation/race-grid.js` | Initial roster placement and complete per-race resets |
| Driving | `src/simulation/simulation.js`, `physics.js` | AI inputs, world motion, surfaces, jumps, drift, progress events |
| Racer contact | `src/simulation/racer-contact.js` | Pair separation and velocity impulses, independent of rendered meshes |
| Items | `src/simulation/race-items.js`, `items.js` | Inventory, pickup respawns, targeting, collisions, effect lifetimes |
| Display timing | `src/runtime/frame-loop.js` | Fixed-step accumulator, display frames, resize, adaptive pixel ratio |
| Rendering | `src/rendering/game-scene.js`, `game-renderer.js` | Scene resources, interpolated kart poses, camera, HUD refresh, drawing |
| Race props and item meshes | `src/rendering/race-props.js`, `item-effects.js` | Finish arch, panels, pickup visuals, effect construction and disposal |
| Page and feedback | `src/ui/game-page.js`, `race-view.js`, `race-feedback.js`, `radar.js` | Selection URLs, screen transitions, focus, toast/shake/sound/spark responses, minimap |
| Input and sound | `src/input/game-input.js`, `src/audio/audio.js` | Held controls and the Web Audio graph |
| Browser diagnostics | `src/testing/browser-diagnostics.js` | Same-origin test messages and telemetry, enabled only with `?test` |

## Dependency boundaries

The session receives input and emits callbacks; it does not import UI, audio, or renderer modules. `getState()` returns a lifecycle snapshot. Keep presentation responses in the view and feedback controllers rather than adding DOM access to simulation.

Racer records remain mutable for physics. `createRacerState()` defines their shape and `resetRaceGrid()` clears transient fields for every racer while retaining identity, AI skill, and attached kart resources. Render interpolation snapshots are aligned when placing or recovering a racer. Simulation distances are world metres; `s` uses track progress units and `x` uses lane units. Convert lateral coordinates with `laneWidth()` and `laneFromOffset()`.

The item controller receives effect creation/removal callbacks. It owns active effect records and lifetime decisions; the renderer owns Three.js resources. Pickup simulation changes `active` and `respawn`; rendering determines visibility from those values and race lifecycle. Do not dispose shared course materials when removing an item mesh.

The frame loop owns the accumulator. Starting, restarting, pausing, and resuming reset its timing so a new race cannot inherit partial steps or a paused race accumulate catch-up work. Blur and visibility loss request pause explicitly; keyboard and button actions can toggle it.

Rendering utilities have direct imports by purpose: `shared-assets.js`, `vertex-shading.js`, `particle-pool.js`, `shadow-follower.js`, `sky.js`, `ambient-weather.js`, and `display-finish.js`. Avoid rebuilding a general graphics barrel or moving unrelated utilities into one file.

## Course ownership

Descriptors and public scenery entry points remain under `src/courses/<id>.js` and `<id>-world.js`. Course-specific implementation lives in `src/courses/<id>/`:

- Windmill Wilds: terrain, vegetation, landmarks, festival props, forest/ridge dressing, and life animation. `world.js` composes its specialized countryside road and scenery.
- Neon Harbor: city props, waterfront construction, and animated harbor life.
- Sunstone Ruins: sculpted desert geometry and temple architecture/mechanism.
- Frostpeak Festival: mountain skyline and ski-lift construction.

Builders share their course palette, reusable geometry, and the course kit through named options. Animated objects are registered for batching exclusions, and every update uses the race clock. Shared track queries remain the source of truth for surfaces, collision edges, progress, and scenery placement. See [the course contract](../src/courses/CONTRACT.md) and [graphics tuning](graphics.md).

## Styles

`style.css` declares stylesheet order. `styles/` separates foundations/fonts, screens, race HUD/radar, responsive driving controls, selection controls, and touch HUD clearance. Later files override earlier ones, so preserve cascade order when changing these boundaries. CSS is included in the formatter checks.

## Development checks

Run `npm ci`, then `npm run check` for ESLint, Prettier, and Node regression tests. Unused bindings are lint errors. These checks include race lifecycle, item cleanup, fixed-step timing, browser-message guards, scene construction/batching, driving behavior, and asset integrity.

Use `npm start` and `tests/browser.html` for browser checks. The existing test protocol supports deterministic stepping, item use, pause/resume, ramps, and telemetry. `?test&benchmark` additionally permits freezing automatic simulation while rendering continues. Verify all four courses, restart and return-to-title transitions, and narrow/landscape touch layouts after composition changes.
