# Code quality review

This review records the main maintainability issues found during the refactor. The project already has useful separation around physics, race progression, item rules, track construction, and individual course scenery; the findings focus on seams where responsibilities or contracts still blur.

## Findings

1. **The browser entry point still owns race orchestration.** Before this refactor, `game.js` was roughly 1,850 lines and combined page setup, renderer and world construction, player input, race orchestration, audio, HUD updates, effects, and the browser test protocol in one async closure. Scene, kart, audio, input, rendering, and HUD responsibilities now have focused modules with explicit dependencies. The race-level loop remains in `game.js`, where it coordinates those systems.

2. **Some subsystem boundaries were implicit or positional.** `buildCourseWorld` previously accepted seven positional arguments, while audio graph state and operations lived directly in the game closure. Positional calls are easy to misorder, and captured Web Audio nodes made ownership and lifecycle harder to see.

3. **Course lookup hid invalid input.** `courseById` silently returned Windmill Wilds for any missing or misspelled ID. Callers could not distinguish a valid selection from a fallback, obscuring URL and registry errors. Lookup now returns `null`, and the browser entry point selects its default explicitly.

4. **Lane units were encoded as repeated numeric conversions.** Racer state stores `x` in lane units, while track projection, pickups, and shells use world metres. The `6.25` conversion appeared across physics orchestration, item logic, and rendering, leaving a unit boundary undocumented and vulnerable to inconsistent changes. Shared conversion helpers and tests now define that boundary.

5. **Course descriptors relied on an informal schema.** `courses/CONTRACT.md` describes a substantial interface, but the runtime passed mutable plain objects without validating key fields or documenting units next to the shared API. A malformed section, ramp, or hazard could fail later during world construction or simulation. Registry loading and direct track creation now validate descriptors against the documented contract.

6. **Style and density varied substantially across modules.** For example, `course-runtime.js` compressed mesh generation, section material selection, and world updates into dense expressions, while the underlying behavior is complex enough to benefit from named intermediate steps and conventional formatting. The shared runtime and course modules now use conventional formatting and named construction steps.

7. **Mutable racer records are shared across multiple subsystems.** `simulation.js`, `physics.js`, `race.js`, `items.js`, and `game.js` each add or mutate fields on the same state object. The implicit record contract is large, and ownership of fields such as progress, airborne state, and inventory is not always apparent at a call site. A state factory now initializes the record, and its module documents subsystem ownership; the object remains mutable for the simulation.

## Refactor applied

- Extracted Web Audio graph ownership, engine updates, tone generation, and sound-effect selection into `audio.js`, exposed through a small `createAudioController()` interface.
- Extracted renderer/lighting/material setup into `game-scene.js`, kart assembly into `kart-builder.js`, and race/item presentation into `race-hud.js`.
- Changed `buildCourseWorld()` to accept a named options object so assets, materials, course track, and shared assets are explicit at the call site.
- Changed course lookup to return `null` for unknown IDs and made the browser entry point choose its default course explicitly.
- Added `laneWidth()` and `laneFromOffset()` as the shared conversion boundary between lane units and world metres, and updated simulation, item, and game code to use them.
- Added a validated `createRacerState()` factory with documented subsystem ownership for physics, progress, inventory, and presentation fields.
- Added `validateCourseDefinition()` at registry loading and direct track creation, with focused tests and explicit unit documentation in `courses/CONTRACT.md`.
- Split common road generation in `course-runtime.js` into named material, ground, ribbon, marking, and hazard-warning operations.
- Extracted keyboard, pointer, and touch input binding into `game-input.js`, and moved vehicle/world rendering orchestration into `game-renderer.js` with explicit getters and callbacks.

## Follow-up opportunities

- `game.js` still coordinates race state, frame progression, and browser test messages. Further extraction should preserve it as the composition root and define a narrow race-session interface rather than introduce another broad mutable game object.
- Scenery builders still contain course-specific Three.js construction. Their interfaces can be narrowed if those builders gain additional callers.

## Verification

- `npm test`: 60 tests passed.
- Browser startup smoke test: the start screen loaded and no browser errors were reported.
