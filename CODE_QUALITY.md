# Code quality review

This review records the main maintainability issues found during the refactor. The project already has useful separation around physics, race progression, item rules, track construction, and individual course scenery; the findings focus on seams where responsibilities or contracts still blur.

## Findings

1. **The browser entry point still owns race orchestration.** Before this refactor, `src/game.js` was roughly 1,850 lines and combined page setup, renderer and world construction, player input, race orchestration, audio, HUD updates, effects, and the browser test protocol in one async closure. Scene, kart, audio, input, rendering, and HUD responsibilities now have focused modules with explicit dependencies. The race-level loop remains in `src/game.js`, where it coordinates those systems.

2. **Some subsystem boundaries were implicit or positional.** `buildCourseWorld` previously accepted seven positional arguments, while audio graph state and operations lived directly in the game closure. Positional calls are easy to misorder, and captured Web Audio nodes made ownership and lifecycle harder to see.

3. **Course lookup hid invalid input.** `courseById` silently returned Windmill Wilds for any missing or misspelled ID. Callers could not distinguish a valid selection from a fallback, obscuring URL and registry errors. Lookup now returns `null`, and the browser entry point selects its default explicitly.

4. **Lane units were encoded as repeated numeric conversions.** Racer state stores `x` in lane units, while track projection, pickups, and shells use world metres. The `6.25` conversion appeared across physics orchestration, item logic, and rendering, leaving a unit boundary undocumented and vulnerable to inconsistent changes. Shared conversion helpers and tests now define that boundary.

5. **Course descriptors relied on an informal schema.** `src/courses/CONTRACT.md` describes a substantial interface, but the runtime passed mutable plain objects without validating key fields or documenting units next to the shared API. A malformed section, ramp, or hazard could fail later during world construction or simulation. Registry loading and direct track creation now validate descriptors against the documented contract.

6. **Style and density varied substantially across modules.** For example, `src/rendering/course-runtime.js` compressed mesh generation, section material selection, and world updates into dense expressions, while the underlying behavior is complex enough to benefit from named intermediate steps and conventional formatting. The shared runtime and course modules now use conventional formatting and named construction steps.

7. **Mutable racer records are shared across multiple subsystems.** `src/simulation/simulation.js`, `src/simulation/physics.js`, `src/simulation/race.js`, `src/simulation/items.js`, and `src/game.js` each add or mutate fields on the same state object. The implicit record contract is large, and ownership of fields such as progress, airborne state, and inventory is not always apparent at a call site. A state factory now initializes the record, and its module documents subsystem ownership; the object remains mutable for the simulation.

## Refactor applied

- Extracted Web Audio graph ownership, engine updates, tone generation, and sound-effect selection into `src/audio/audio.js`, exposed through a small `createAudioController()` interface.
- Extracted renderer/lighting/material setup into `src/rendering/game-scene.js`, kart assembly into `src/rendering/kart-builder.js`, and race/item presentation into `src/ui/race-hud.js`.
- Changed `buildCourseWorld()` to accept a named options object so assets, materials, course track, and shared assets are explicit at the call site.
- Changed course lookup to return `null` for unknown IDs and made the browser entry point choose its default course explicitly.
- Added `laneWidth()` and `laneFromOffset()` as the shared conversion boundary between lane units and world metres, and updated simulation, item, and game code to use them.
- Added a validated `createRacerState()` factory with documented subsystem ownership for physics, progress, inventory, and presentation fields.
- Added `validateCourseDefinition()` at registry loading and direct track creation, with focused tests and explicit unit documentation in `src/courses/CONTRACT.md`.
- Split common road generation in `src/rendering/course-runtime.js` into named material, ground, ribbon, marking, and hazard-warning operations.
- Extracted keyboard, pointer, and touch input binding into `src/input/game-input.js`, and moved vehicle/world rendering orchestration into `src/rendering/game-renderer.js` with explicit getters and callbacks.

## Follow-up opportunities

- `src/game.js` still coordinates race state, frame progression, and browser test messages. Further extraction should preserve it as the composition root and define a narrow race-session interface rather than introduce another broad mutable game object.
- Scenery builders still contain course-specific Three.js construction. Their interfaces can be narrowed if those builders gain additional callers.

## Verification

- `npm test`: 63 tests passed after integration with the current main branch.
- Browser startup smoke test: the start screen loaded and no browser errors were reported.

## Organization and conventions (2026-10-05)

This pass applies current TypeScript and JavaScript guidance to the native browser ES modules. It keeps JavaScript and the existing static-server workflow; converting the game to TypeScript would require a separate compilation and typing change. Folder grouping is a project choice, not a TypeScript language requirement.

- `src/game.js` is the composition root and race orchestration entry point.
- `src/simulation/` owns physics, progress, items, hazards, AI, and mutable racer state.
- `src/track/` owns authored-route construction, queries, and selected-track bindings.
- `src/rendering/` owns scene setup, assets, geometry, world construction, kart assembly, and interpolated presentation.
- `src/courses/` owns course descriptors, scenery, registry, validation, and the shared contract.
- `src/audio/`, `src/input/`, and `src/ui/` own their focused controllers and presentation helpers.
- `proposals/` contains all course proposals and the art-direction proposal. Tests, asset preparation tools, bundled assets, and third-party code remain separate from game source.

Use lowercase kebab-case filenames, camelCase functions and variables, PascalCase classes and documented types, and UPPER_SNAKE_CASE module constants. Prefer descriptive names across broad scopes (`radarContext`, `pixelRatio`); short mathematical coordinates and local loop indices are appropriate in small scopes. Preserve third-party property names and existing serialized/test protocol fields. Avoid interface prefixes such as `I`; name contracts for their purpose. Keep explicit `.js` extensions and named exports for shared services; course descriptors retain their existing default exports.

Keep modules focused on a responsibility, pass dependencies explicitly to factories, and document units and ownership at shared boundaries. The existing course validator, racer factory, and audio/input/renderer controllers already provide useful interfaces; this pass preserves their operations. JSDoc describes contracts without introducing browser-incompatible TypeScript syntax. A future TypeScript conversion should use strict checking and module settings appropriate to native browser ESM, with type-only imports where applicable.

Prettier provides consistent formatting across first-party source, Node tests, and configuration. ESLint uses its recommended rules plus camelCase, `no-var`, and strict equality (allowing the intentional `== null` idiom). Unused legacy bindings are reported as warnings rather than removed, because constructors and mesh creation may have effects. Vendor and generated asset files are excluded.

Run `npm install` once for development tools, then `npm run check` for lint, formatting, and regression tests. `npm run format` applies formatting. Running the game still requires no install or build.

### Preserved issue

The pulled version references undeclared `maxDpr` in the resize handler in `src/game.js`. It is retained with one localized lint exception to honor the no-logic-change scope; a resize can still fail there. Fixing that existing behavior belongs in a separate change.

### Sources reviewed

- [TypeScript Handbook: modules](https://www.typescriptlang.org/docs/handbook/2/modules.html): module boundaries and explicit imports/exports.
- [TypeScript module compiler guidance](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html): match compiler options to the runtime.
- [TypeScript TSConfig reference](https://www.typescriptlang.org/tsconfig/): strict checking and consistent filename casing for a future conversion.
- [Google TypeScript style guide](https://google.github.io/styleguide/tsguide.html): descriptive identifiers and purposeful interfaces. The project's kebab-case filenames are a local convention.
- [typescript-eslint shared configurations](https://typescript-eslint.io/users/configs/): start with recommended rules when adopting TypeScript. The current JavaScript uses ESLint's native recommended configuration.

### Verification for the organization pass

All 64 Node tests pass. Formatting passes and lint reports zero errors with six pre-existing unused-binding warnings. A syntax-tree comparison of all 35 source modules confirms unchanged operations apart from module paths and the intentional local identifier renames; all relative source imports resolve. No browser smoke test was run in this pass.
