# Code quality

The architecture and module ownership map lives in [docs/architecture.md](docs/architecture.md). This review records the issues addressed by the current refactor.

## Changes

- Reduced `src/game.js` from 1,190 to 218 lines by extracting race lifecycle, grid resets, item orchestration, contacts, page/view transitions, feedback, radar, frame timing, race props, item meshes, and browser diagnostics. The entry point now assembles and connects those systems.
- Split the 460-line graphics utility file into asset loading, vertex shading, bounded particles, shadow following, sky, weather, and display finish modules. Removed the unused procedural kart decal atlas.
- Moved Windmill's 573-line specialized world implementation out of shared rendering and into its course folder, split into terrain, vegetation, and landmarks. Split all four scenery builders along course-specific construction boundaries. The largest scenery entry point is now 412 lines, down from a maximum of 743.
- Split the 1,028-line stylesheet into focused files, keeping `style.css` as the cascade entry point. Added CSS formatting to the development checks.
- Centralized race resets for all racers, including drift tiers, trick state, finish delays, and interpolation snapshots. Reset display timing on race changes to avoid inherited accumulator state.
- Made blur and visibility loss request pause explicitly, preventing consecutive focus-loss events from resuming a paused race.
- Made racer hits cancel pending trick rewards, matching recovery and physics contact behavior.
- Kept contact cooldown ownership in simulation and effect-resource ownership in rendering. Item rules no longer update pickup DOM/mesh visibility directly.
- Removed unused imports and made unused bindings lint errors rather than warnings.

## Verification

- `npm run check`: ESLint and JavaScript/CSS formatting pass; all 81 Node tests pass.
- Added 12 tests covering session transitions and resets, item respawns/cleanup, fixed-step display timing, adaptive resolution/resize, and browser diagnostic guards. Extended input coverage for consecutive blur/visibility pause requests.
- Chromium regression: all four courses loaded and completed full races with no console errors; item use, pause/resume, resize, restart, and return-to-title transitions passed, including Frostpeak in a touch landscape viewport.
- Browser layout comparison: computed styles matched the original stylesheet across six viewport sizes, desktop/touch input, and title/race/pause/finish states (48 comparisons).

## Remaining boundaries

Racer records are intentionally shared mutable simulation state; their field ownership is documented in `racer-state.js`. Selected track bindings are still process-wide ES module state, and course selection starts a new page. Course entry points retain palette creation and section layout orchestration; their extracted helpers own coherent geometry or animation responsibilities. The refactor retains JavaScript and the existing static-server workflow.
