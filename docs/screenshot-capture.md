# README screenshot capture

The README shows one driving-camera frame for each of the twelve playable
courses. Captures are saved under `docs/screenshots/`. The capture script uses
the browser test hook to place the kart at a chosen course location, then saves
the rendered frame. Its animation-frame limit keeps capture time bounded on
software-rendered browsers.

## Capture all courses

From the repository root, run:

```sh
node tools/capture-readme-screenshots.mjs
```

To capture selected courses, pass their IDs:

```sh
node tools/capture-readme-screenshots.mjs neon-harbor frostpeak-festival
```

The script starts a local Python server on port 5173 and reuses it if Turbo
Trail is already running there. It uses Playwright and Chromium from the
environment when available. If Playwright is installed outside Node's normal
module lookup, set `PLAYWRIGHT_MODULE` to its module path. Set `CHROMIUM_PATH`
if Chromium is installed somewhere other than `/usr/bin/chromium`. For a local
setup without Playwright, install it with
`npm install --no-save --no-package-lock playwright`; if needed, install its
browser with `npx playwright install chromium`.

`SCREENSHOT_CAPTURE_AT_SECONDS` sets the race timer threshold for captures that
drive from the start (default `2`). `SCREENSHOT_CAPTURE_TIMEOUT_MS` sets the
per-course limit (default `120000`), and `SCREENSHOT_CAPTURE_PORT` changes the
server port (default `5173`). The script selects a racer and capture position
for each registered course; course-specific positions are configured in the
script.

`SCREENSHOT_CAPTURE_WIDTH` and `SCREENSHOT_CAPTURE_HEIGHT` set the viewport
(defaults `1280` and `720`). The latest twelve-course gallery uses `1280` by
`720`. For example:

```sh
SCREENSHOT_CAPTURE_WIDTH=1280 SCREENSHOT_CAPTURE_HEIGHT=720 \
  node tools/capture-readme-screenshots.mjs
```

Rendering with software Chromium can take longer at this size. Increase
`SCREENSHOT_CAPTURE_TIMEOUT_MS` when needed; it bounds loading, simulation
setup and rendering together for each course.

## Capture behavior

The script opens each course at `?test&benchmark`. Benchmark mode skips the
three-second countdown. For a selected course location, the browser test hook
steps the race simulation, seeks the kart and chase camera to the location, and
freezes simulation while a few animation frames render. Other configured
captures drive from the start and wait for the timer threshold. Inspect each
image before using it in the README, since camera framing can vary by course.

Screenshot file names match the paths embedded in `README.md`. Regenerate and
inspect the files before updating the README.

## Asset review views

`SCREENSHOT_CAPTURE_DIR` selects another output directory, and
`SCREENSHOT_CAPTURE_POINTS_JSON` overrides capture positions without editing
the standard presets. For example:

```sh
SCREENSHOT_CAPTURE_DIR=docs/screenshots/sculptures \
SCREENSHOT_CAPTURE_POINTS_JSON='{"windmill-wilds":{"t":0.55}}' \
  node tools/capture-readme-screenshots.mjs windmill-wilds
```

Set `SCREENSHOT_CAPTURE_REPORTS=1` to save the diagnostic race state and render
counters beside each image. Software-rendered capture FPS includes loading and
bounded capture frames; use a target-hardware benchmark for performance claims.
