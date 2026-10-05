# Handling tuning

The kart and the road now share a usable cornering envelope. Road construction rejects a sampled horizontal radius below 40 metres (maximum curvature 0.025 / metre). The road's regular inside lane retains margin over the kart's 22 m full-speed turn radius, including boosts. A drift tightens that radius to 17 m. This is a geometry constraint; it does not automate or certify a human full-throttle lap.

## Issues fixed

- The original Catmull–Rom paths contained 3.6–6.1 m bends, narrower than the roads themselves in places. Rounded authored control points on all four courses remove these pinches while keeping their section indexes, elevations, route layout and approximately 1.5 km length. All road, barrier, surface, hazard and scenery placement continues to consume the same track geometry.
- Normal turning previously needed about 37 m at cruising speed and 62 m under boost. Speed-dependent curvature now gives predictable proportional analog steering, with the same full-speed radius during a boost. Previously the lateral-force cap saturated early, so much of the analog steering range made no difference.
- Lateral grip deleted velocity every tick. A sustained drift fell to about 87 km/h versus 105 km/h when turning normally. Grip now redirects momentum while engine power, aerodynamic drag, slopes and rough surfaces still determine speed. Normal and drift cornering both settle near 107 km/h on flat asphalt; boosted cornering settles near 138 km/h.
- Drift side grip was too weak and switched back to normal grip whenever steering crossed neutral. Drifts now retain their grip through countersteer, use half the actual surface grip, and release or reverse steering promptly. A hit, jump or low speed ends the drift. Charge decays when no longer sliding, and an airborne or hit release cannot award a turbo.
- The accelerator overrode simultaneous braking, including under boost. Braking now takes priority and still stops before deliberate reverse. Acceleration and braking use total travel speed, preventing sideways movement from bypassing the speed limit. Omitted steering input defaults to neutral instead of producing NaN.
- Rough ground imposed a second severe yaw limit in addition to drag and reduced grip. Steering now remains effective when a mushroom expires, so the kart can rejoin the road. Surface speed costs and lower grip remain.
- The chase camera followed only the kart heading during a slide. It now blends toward travel direction, more strongly while drifting, to keep the road visible. Reverse retains the kart-facing view.

## Measurements and verification

Horizontal curvature is measured on the constructed closed track, including the finish seam, using three adjacent route samples. The runtime exposes `track.minimumCurveRadius` for future tuning.

| Course | Constructed length | Tightest horizontal radius |
| --- | ---: | ---: |
| Windmill Wilds | 1494.5 m | 44.6 m |
| Neon Harbor | 1499.2 m | 44.6 m |
| Sunstone Ruins | 1498.2 m | 48.6 m |
| Frostpeak Festival | 1538.7 m | 45.1 m |

Seven physics regressions cover corner speed/radius under normal driving and boosts, analog steering range, drift countersteer/release, simultaneous pedals, rough-ground steering, neutral/sideways input and invalid drift rewards. The course contract checks the radius floor and rejection of pinched geometry. Existing AI, jump, contact, shortcut and race checks remain in place; AI cruise tuning was reduced by 0.5 km/h to retain its existing lap pacing after removing corner speed loss.

Frostpeak's wider bend favors a shallower powder line. Its shortcut driver now targets a 12 m inside offset, uses its mushroom on entering powder, and releases the brake during boosts. The check verifies that a boosted powder cut beats the ordinary road and unboosted powder line, while a boosted road line remains competitive; the previous requirement that powder beat the boosted road no longer matches this gentler corner.

Automated measurements establish the handling envelope and regressions. Final judgments about steering feel and preferred drift timing still benefit from human play.

`npm run check` passes ESLint, Prettier and all 89 Node tests. Chromium completed three-lap races on all four courses (observed player times: Windmill 171.87 s, Neon 175.44 s, Sunstone 169.58 s, Frostpeak 174.88 s). Browser checks cover drift/release, restart and pause/resume; Frostpeak also loaded the 844 × 390 landscape viewport. Final startup and driving checks reported zero browser errors on all four courses. Software rendering required lower resolution and timer-based diagnostic waits. Screenshot capture on Neon timed out; visual quality still needs human review.
