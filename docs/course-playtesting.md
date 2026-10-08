# Repeatable course playtests

Run `npm start`, then `node tools/playtest-browser.mjs` with Playwright and
Chromium installed. `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` select installations
outside normal lookup paths. Optional course IDs restrict a run, for example
`node tools/playtest-browser.mjs frostpeak-festival`.

The harness completes a three-lap race using the game's actual session, player
controls, rivals and items in Chromium. It records progress, recoveries, browser
errors, pause/resume and restart behavior, then captures three driving-camera
positions per section and five per alternate route. Frostpeak also gets twenty
powder positions across the descent. Paper routes use their intended lap.

Screenshots and JSON reports go to `/tmp/kart-review/browser`, or the directory
selected by `PLAYTEST_OUTPUT`. Inspect the images for placement, surface seams,
camera occlusion and floating structures. A finished automated race does not
establish that every optional route or visual is correct; combine this run with
the geometry and physics regression tests and targeted driving checks.

Rendering is bounded between captures so software Chromium can test an entire
course without continuously drawing during deterministic simulation steps.
These runs are correctness checks, not target-hardware performance benchmarks.

Run `node tools/playtest-simulation.mjs` for two seeded six-kart races on each
course and three driving trials per alternate route. All rivals must finish;
reports include recovery histories and distinguish the human engine from AI
engines. Optional course IDs and `PLAYTEST_OUTPUT` work as in the browser tool.

Run `node tools/audit-course-geometry.mjs` to load the real course models and
raycast lane/head clearance, including all three Paper scene states. Node
replaces image decoding with placeholder textures; browser views check textures
and shaders. Explicit driving surfaces, authored hazards and animated scenery
are outside this static-prop audit and have separate physics/render tests.

`PLAYTEST_POINTS_JSON` optionally maps course IDs to arrays of `{name, t,
offset, branchIndex, q}` for focused browser recaptures. It retains the full race
and lifecycle checks. The default remains the entire section/branch/powder sweep.

The completed review and per-course results are recorded in
[course-playtest-review.md](course-playtest-review.md).
