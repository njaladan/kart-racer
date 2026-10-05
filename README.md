# Turbo Trail

A self-contained Three.js browser kart racer: three laps, five rivals, drifting, boost pads, physical kart contact, short ramp hops, item pickups, a minimap, and synthesized engine audio. The circuit includes banked turns, textured terrain, a lake and windmill, grandstands, signs, flowers, balloons, and rounded karts with animated wheels.

## Run

```sh
npm start
```

Open http://127.0.0.1:5173. Alternatively, use any static HTTP server. No npm install or build is needed. Three.js 0.180.0 and the fonts are bundled under `vendor/` with their licenses; the game makes no external asset requests.

## Controls

- **Accelerate:** W / Up arrow
- **Brake, then reverse:** S / Down arrow. Hold to reverse after stopping.
- **Steer:** A / D or Left / Right arrows
- **Drift:** Hold Space or Shift while turning, then release for a mini-turbo
- **Use item:** E / Enter
- **Pause:** Escape or the pause button. Losing focus also pauses the game.
- **Recover:** R or RESET when travelling below 12 km/h
- **Touch:** Steering, brake/reverse, drift, accelerator, and item buttons. Drag on the canvas to steer.

## Handling and performance

Horizontal movement uses world-space velocity, smooth steering, lateral tire grip, rolling resistance, slope forces, braking, and reverse. The track supplies the road surface and physical barriers; it does not steer the kart. Ordinary top speed is roughly 107 km/h on level road, and reverse reaches roughly 45 km/h. From rest, level-road acceleration reaches about 63 km/h forwards and 36 km/h in reverse after one second.

Ramp jumps intentionally favor arcade control: a bounded takeoff, stronger gravity, at most 1.1 metres above the road, and at most 0.7 seconds of airtime. Boosts increase horizontal speed without increasing takeoff velocity. Surface changes and kart collisions cannot trigger a jump.

Simulation runs at 120 Hz with interpolated rendering. Track projection and minimap geometry are cached; trees, flowers, guardrails and road markings are batched; static kart and cloud parts are merged. Rendering reduces pixel density after sustained slow frames. Expired item and particle GPU resources are released, including on restart.

## Validation

```sh
npm test
```

The Node tests cover acceleration, reverse, grip, airborne momentum, bounded boosted jumps, collision-related takeoff prevention, wall impulses, single-use drift turbos, continuous track progress, finish ranking, AI race completion, frame-rate independence, shell bounces, homing steering, and swept projectile collision.

For interactive integration checks, open `/tests/browser.html` on the same local server. It exposes held inputs, autodriving, a targeted boosted-ramp scenario, item use, pause/resume, hit recovery, and visible state/render counters. These controls are enabled only for the embedded game with the explicit `?test` query; they are absent from ordinary play.

The visuals use procedural geometry and textures. They borrow the bright arcade racing feel of the Wii era; they do not reproduce Nintendo characters, tracks, or assets.
