# Course proposal: Frostpeak Festival

## Identity

Playful, exuberant, sporty. A bright mountain resort mixes spectator energy with rhythmic steering, downhill speed and a short forgiving slippery bend.

## Lap plan

Nominal sixty-second lap; distance budgets total 1,500 m. Section boundaries must be derived from authored route geometry, not these time windows.

| Time | Place | Initial distance | Driving and visual beats |
| --- | --- | --- | --- |
| 0–10 s | Village square | 260 m | Wide festive start, chalet-lined opening drift and item lane choice before the forest. |
| 10–20 s | Snowy pine slalom | 235 m | Linked bends framed by snow-covered pines and flags; small roller, then a clear recovery opening. |
| 20–30 s | Summit climb | 245 m | Two separated climbing bends, distant mountain silhouettes, and a broad crest. Exposed views contrast the forest enclosure. |
| 30–40 s | Panoramic descent | 285 m | Banked downhill sweep under resort banners, a bounded small hop, and a gentler landing/runout. No major launch or unguarded cliff. |
| 40–50 s | Ice-rink bend | 210 m | A short pale-blue ice patch in a wide, gentle bend reduces lateral grip moderately. Firm entry/exit paving and room to recover prevent prolonged sliding. Resort yard contains the announced groomer crossing after the ice. |
| 50–60 s | Grandstand finish | 275 m | A boost-assisted inside-right powder cut leads toward outside boost panels, cheering stands and a payoff straight. |

## Signature sequence

The summit reveal followed by a sweeping, banner-lined descent with the village and grandstands visible below.

## One interactive hazard

A compact snow groomer crosses only the center/right of the resort yard, after the ice exit. It follows the common introductory delay, warning and predictable movement cycle, with an amber beacon and marked crossing. Its blade stays inside its tested collision footprint; the left passing lane remains clear.

## Shortcut and competing lines

A snow-powder apron inside the final right bend has marked entry and visible exit. Powder uses ordinary off-road drag, overridden by boost; it is separate from ice. A clean boosted cut targets about a one-second saving while the main road offers items. Outside panels compete with an inside-road drift.

## Materials, scenery and camera

Use bright snow terrain, dark groomed road, blue ice, red/cyan flags, chalet timber and snowy pine groups. Ice is a localized section material with moderate grip reduction (initial grip 8–9 versus 12 normally), no new airborne or vehicle mode. Downhill grade and the limited ice surface provide personality without changing global physics.

## Shared design and implementation contract

Target a 1,450–1,600 m continuous course and representative clean 55–65 second laps, with three laps near three minutes. Measure first and flying laps separately; adjust meaningful route length and corner shapes rather than global speed or compulsory waiting. All figures here are tuning targets until measured.

Six physical sections introduce a major change roughly every ten seconds, with two or three smaller beats (turn reversal, sightline, item choice, crest, width change) inside each. No unchanged stretch should approach twenty seconds. Place recovery room after demanding sections. Keep one coherent landscape, one interactive hazard, one boost-dependent shortcut, and one competing normal racing line. Obstacles always leave a clear passing lane.

Use the current world-space driving, bounded ramp hops, drift boosts, item system and ordered checkpoints. No gaps, cannons, falling roads, true branching progress, or new vehicle mode. The shortcut is a continuous ground patch inside an expanded physical boundary, uses the same ground query and ordered progression, and has a clearly visible entry and exit. Boost overrides its off-road drag. AI initially stays on the main route.

Each course owns a descriptor and scenery module under `src/courses/<id>.js` and `src/courses/<id>-world.js`. Shared track construction translates authored control-point boundaries into actual arc-distance section ranges and caches route frames. Rendering, kart physics, shells, AI, pads and ramps consume that same metadata. A registry selects the course before constructing the game; changing course starts a fresh page/race so old world state cannot leak. Root-owned engine, registry and UI files are not edited by course agents.

Descriptor fields: `id`, `name`, `description`, `targetLength`, `controls` (world xyz), `sections` (six objects with `controlIndex`, `id`, `name`, `hint`, `halfWidth`, `material`, `color`, optional `grip`), `ramps` ({section,fraction,halfLength,height}), `pads` ({section,fraction,offset,duration}), `itemRows` ({section,fraction}), `shortcut` ({section,startFraction,endFraction,extraWidth}), `hazard` ({section,fraction,kind,label,parkOffset,minOffset,halfWidth,halfLength,safeLane,activation,period,warningSeconds}), `theme` ({sky,fog,ground,road,shoulder,hemisphere,ambientGround,sun,sunIntensity,exposure}), `buildWorld` (scenery function). Section widths are half-widths in metres; offsets are signed lateral world metres. Shortcut extends the positive/right boundary; design an inside-right curve there. Hazard occupies the right/central road and reserves the negative/left passing lane. The common hazard runtime handles the shared warning/movement/collision clock; themed meshes are owned by scenery.

Scenery signature: `buildWorld(context)`, where context provides `THREE`, `scene`, `scenery`, `track`, `course`, `mats`, `textures`, `renderer`, `kit`, `hazardAt`. Shared ground, road, rails, markings, signs, ramps, pads and pickups are engine-owned. Scenery builds place-specific props and returns `{update(time)}`. `kit` provides `material(color,extra)`, `mesh(geometry,material,parent,position,scale)`, `box(material,parent,position,scale)`, `groupAt(t,offset,parent)`, `sectorT(index,fraction)`, `sign(t,offset,text,color,width)`, `batch(parent)`, `align(group,frame)`. Props must sit beyond the physical boundary or above a portal with at least 11 m camera clearance. Only the declared moving hazard occupies driveable road; decorative props have no separate collisions.

Validate six continuous sections, route length, route separation, widths, pad alignment, shortcut ground/progress, hazard warning and permanently clear lane, kart/shell edge agreement, finite projection, bounded hops, all five AI drivers finishing three laps, measured sector splits, desktop/mobile camera clearance, course switching and browser console. Keep geometry/material reuse and batch static meshes; avoid per-frame scenery allocation and large numbers of real-time lights. Document actual measurements and any remaining human-playtest tuning rather than claiming unmeasured performance.

## Implementation order and review record

1. Review this proposal for pacing, geometry, safety-lane clarity, engine compatibility and parallel ownership. Resolve findings here before implementation.
2. Author and measure route/sections with the shared builder, then place themed scenery and hazard.
3. Tune AI and representative lap/sector times, inspect browser and camera, and integrate through the registry.
4. Record review resolutions and measured implementation results below.

## Independent review and resolutions

Reviewed independently by a dedicated course reviewer. The following constraints are adopted before implementation:

- Set explicit half-widths (initial sectors 9, 7.8, 8.5, 8, 9, 9 m; tuning may widen curves). Use a 1.35 m hazard half-width, minimum offset 0 m, parked offset 12 m, and safe lane −5.5 m. With a 0.9 m kart radius there is at least 3.25 m lateral clearance at the closest hazard position. AI must read the descriptor safe lane. Entire meshes, including blades, must fit their contact footprint.
- Author the expanded shortcut on a sustained right-hand bend. Taper within its range, flatten banking, and rejoin before the next tight turn. Measure main-road, outside-pad, boosted-cut and ordinary-cut traversal rather than inferring a saving from width. Reject nearby route segments that make projection ambiguous.
- Check complete scenery footprints against road and expanded shortcut boundaries. Camera clearance includes approach and trailing path, not just the portal center. Gateway/warehouse/banners have at least 11 m overhead clearance; sidewalls cannot clip the curved road or camera.
- Measure first and flying sector splits; tune any sector above 14 seconds, retain multiple internal beats, and verify distant landmarks are actually in the crest's sightline.

Ice resolution: optional `surfaces: [{section,startFraction,endFraction,material,grip}]` is shared by rendering and physics. Start with section 4 fractions 0.12–0.45 at grip 8.5; firm paving before and after, groomer at fraction 0.78, at least 30 m after ice. Keep the descent hop well before ice entry.

## Implemented course and measured results

The implemented clockwise mountain route measures **1,541.2 m**, with a 54.2 m summit and no intersecting road. Actual centreline section budgets are approximately **298 m village, 219 m pines, 284 m summit, 238 m descent, 197 m rink, and 305 m grandstands**. A 512-point geometry survey found about 70.6 m minimum separation between route samples separated by at least seven percent of a lap. The steepest sampled tangent has vertical component 0.279; the climb/descent and low hops remain supported road using the existing bounded airborne model.

At the fixed 120 Hz physics step, five isolated AI drivers with skills 0.91–0.72 completed all three ordered laps in **174.94–177.75 seconds**, with **zero wall or groomer impacts**. Standing laps measured **58.87–59.78 s** and flying laps **58.02–59.02 s**. The skill-0.91 driver's laps were **59.18, 58.41, and 58.38 s**. Its first-lap section entry times were **0, 12.03, 21.03, 32.08, 40.58, 47.89, and finish 59.18 s**; individual sectors lasted **7.32–12.03 s**. These are isolated driving measurements with authored panels active and no combat, rather than human race times.

The localized blue ice patch is **64.9 m** long at grip 8.5, with firm road before and after. The groomer crossing lies **64.9 m beyond the ice exit**, leaving recovery room. It activates after 30 seconds with a two-second warning, parks at offset +12 m, and never crosses left of offset 0 m. Its complete blade/body mesh fits the 2.7 × 4.3 m collision footprint. Tests sample the full twelve-second cycle and prove the −5.5 m lane remains clear.

Review of the original broad powder cut found that one real 0.95-second mushroom could expire before the exit. The apron is now restricted to a **76.3 m inside-right bend**, and powder applies a local **1.25× ordinary off-road drag**; boosts override that drag. A controlled entry-to-exit comparison, including 30 m approach and 20 m runout, measured **4.59 s on the inside road, 4.41 s using one mushroom on that road, 4.15 s using one mushroom on the powder cut, 4.67 s taking the powder without a mushroom, and 4.76 s on the outside panel line**. All five traversals had zero wall contacts. Each boosted run uses exactly one actual `consumeItem` call; no continuing boost is supplied. The cut currently saves **0.26 s against the same mushroom on the road** and **0.44 s against the ordinary inside line**, a smaller measured reward than the original one-second target. This modest reward is retained because the single-mushroom route works and ordinary powder loses time; human drift/boost tuning remains a playtest item.

Graphics use the same shared CC0 asset direction as the other course graphics: compressed 512-pixel ambientCG snow, wood, bark and stone maps; actual Kenney pine and rock models with source vertex colors; gentle baked vertex shading on authored chalet, grandstand and groomer meshes. Timber chalets have framing, shutters, window crossbars, snowy sills and roof caps. Snow-covered Kenney pines frame the slalom; low summit rocks and distant mountain silhouettes preserve the reveal; high colored banners, rink goals and spectator stands establish the resort sequence without roadside text. Full pine/rock/chalet footprints stay beyond the road and shortcut rails. Banner fabric stays at least 11.65 m above the road. Static scenery is globally batched while the groomer and flashing beacon remain separately animated.

`tests/frostpeak-festival.test.js` verifies all five three-lap completions, lap and section pacing, localized ice/recovery, hazard passing-lane clearance, actual single-mushroom shortcut economics, and coherent shortcut ground projection. The focused tests pass. Browser camera and integrated race checks are part of the shared integration pass; these measurements do not claim human playtesting.
