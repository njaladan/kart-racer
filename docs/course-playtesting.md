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
