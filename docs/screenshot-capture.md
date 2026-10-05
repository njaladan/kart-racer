# README screenshot capture

The four README images are live 1280×720 captures of a race, saved under
`docs/screenshots/`. The capture script drives the game through its existing
browser test hook, then waits for the rendered race timer before saving. This
works across fast and slow renderers without guessing how long the browser needs
to load or advance the scene.

## Capture all courses

From the repository root, run:

```sh
node tools/capture-readme-screenshots.mjs
```

To capture only selected courses, pass their IDs:

```sh
node tools/capture-readme-screenshots.mjs neon-harbor frostpeak-festival
```

The script starts a local Python server on port 5173 and reuses it if Turbo
Trail is already running there. It uses Playwright and Chromium from the
environment when available. If Playwright is installed outside Node's normal
module lookup, set `PLAYWRIGHT_MODULE` to its module path. Set `CHROMIUM_PATH`
if Chromium is installed somewhere other than `/usr/bin/chromium`.
For a local setup without Playwright, install it with
`npm install --no-save --no-package-lock playwright`; if needed, install its
browser with `npx playwright install chromium`.

`SCREENSHOT_CAPTURE_AT_SECONDS` sets the race timer threshold (default `2`).
`SCREENSHOT_CAPTURE_TIMEOUT_MS` sets the per-course limit (default `180000`),
and `SCREENSHOT_CAPTURE_PORT` changes the server port (default `5173`). The
capture is saved as soon as the game timer reaches the threshold. The script
selects Tux for Windmill Wilds, Kiki for Neon Harbor, Nolok for Sunstone Ruins,
and Konqi for Frostpeak Festival to match the README captions.

## Why this produces a good frame

The script opens each course at `?test&benchmark` and sends the supported
`test-start` message. Benchmark mode skips the three-second countdown, while
the race still uses its regular animation loop, camera, simulation, and
renderer. The script holds W and waits for the race timer to advance before
capturing. It does not use `test-step`: that diagnostic advances simulation
without giving the renderer and chase camera time to follow, which can leave
the player kart clipped or distant in the image.

The screenshot file names match the paths already embedded in `README.md`. To
refresh the README images, regenerate the files, inspect them, then commit and
push the four updated JPEGs.
