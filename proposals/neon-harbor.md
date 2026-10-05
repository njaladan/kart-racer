# Course proposal: Neon Harbor

## Identity

Bustling, bold, electric. A working waterfront city after dark; tight streets and warehouses frame sudden releases onto open quays. Warm market colors and cool dock lights establish separate districts without changing worlds.

## Lap plan

Nominal sixty-second lap; distance budgets total 1,500 m. Section boundaries must be derived from authored route geometry, not these time windows.

| Time | Place | Initial distance | Driving and visual beats |
| --- | --- | --- | --- |
| 0–10 s | Promenade | 270 m | Broad opening drift, waterfront skyline, an item-row choice before the market. Keep lamps outside road edges. |
| 10–20 s | Market alleys | 235 m | A narrower left-right sequence between stalls and façades. Neon awnings stay above camera height; exit opens for recovery. |
| 20–30 s | Warehouse | 225 m | A generously tall, short covered loading passage with offset crates beyond barriers; a bend leads toward daylight-like dock lighting. Avoid ten seconds of straight tunnel. |
| 30–40 s | Elevated quay | 265 m | Climb out of enclosure onto a supported concrete deck with a harbor panorama, small crest hop, and sweeping descent. Guarded continuous road, no water driving. |
| 40–50 s | Container terminal | 225 m | Alternate container walls and an open handling yard. A marked cargo-shuttle crossing asks for a lane decision, then offers recovery and items. |
| 50–60 s | Boulevard finish | 280 m | An inside-right service-apron cut at the opening bend, followed by an outside boosted sweep and finish straight. Roadside arrows show all choices. |

## Signature sequence

Exiting the enclosed warehouse, climbing onto the quay, and seeing cranes, ships and the lit city before descending toward the terminal.

## One interactive hazard

A cargo shuttle moves laterally on one shared twelve-second cycle after a thirty-second introduction. Amber warning lamps flash for two seconds before motion. It moves from a parked right-side position toward the center, never covering the left passing lane. Its body footprint matches common kart/shell contact; crates and crane booms are decorative.

## Shortcut and competing lines

A service apron on the inside-right boulevard bend is visibly bounded and reachable without a false wall opening. It shortens the driven corner radius; a mushroom should save about one second, ordinary driving should lose time to rough-paving drag. Its route passes no item boxes. Outside pads compete with a clean inside-road drift.

## Materials, scenery and camera

Use asphalt promenade, darker market paving, concrete warehouse/quay/terminal, then broad boulevard asphalt. Emissive signs and windows carry nighttime readability without many point lights. Harbor water, moored ships, crane silhouettes, market stalls and dense city façades make this unmistakably urban.

## Shared design and implementation contract

Target a 1,450–1,600 m continuous course and representative clean 55–65 second laps, with three laps near three minutes. Measure first and flying laps separately; adjust meaningful route length and corner shapes rather than global speed or compulsory waiting. All figures here are tuning targets until measured.

Six physical sections introduce a major change roughly every ten seconds, with two or three smaller beats (turn reversal, sightline, item choice, crest, width change) inside each. No unchanged stretch should approach twenty seconds. Place recovery room after demanding sections. Keep one coherent landscape, one interactive hazard, one boost-dependent shortcut, and one competing normal racing line. Obstacles always leave a clear passing lane.

Use the current world-space driving, bounded ramp hops, drift boosts, item system and ordered checkpoints. No gaps, cannons, falling roads, true branching progress, or new vehicle mode. The shortcut is a continuous ground patch inside an expanded physical boundary, uses the same ground query and ordered progression, and has a clearly visible entry and exit. Boost overrides its off-road drag. AI initially stays on the main route.

Each course owns a descriptor and scenery module under `courses/<id>.js` and `courses/<id>-world.js`. Shared track construction translates authored control-point boundaries into actual arc-distance section ranges and caches route frames. Rendering, kart physics, shells, AI, pads and ramps consume that same metadata. A registry selects the course before constructing the game; changing course starts a fresh page/race so old world state cannot leak. Root-owned engine, registry and UI files are not edited by course agents.

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

Quay resolution: descriptor `elevated: [{section,startFraction,endFraction}]` excludes only the supported span from terrain embankments. Scenery adds beams/supports; the road and rails remain physically continuous.

## Implemented course and measurements

The authored harbor loop measures **1,499.76 m**. It uses a new thirty-point route rather than the countryside centerline: a wide northern promenade, eastern market S-bends, a brief loading hall, a southern elevated quay, southwestern handling yard, and a sustained right-hand boulevard bend returning to the line. Centerline sector distances are 292.67, 251.59, 198.57, 288.91, 241.21 and 226.81 m.

A clean isolated skill-0.9 AI run from the line records **56.81, 55.98 and 55.99 s** laps, finishing at **168.78 s**. First-lap sector durations are **11.69, 10.14, 7.33, 10.38, 8.92 and 8.36 s**. All five AI steering variants independently finish three laps in **167.80–168.79 s**, without wall or cargo-shuttle impacts. These are fixed-step simulation measurements without item combat or human driving.

The shortcut was narrowed and moved onto the actual boulevard apex after testing showed that a broad apron outlasted a single mushroom's 0.95-second boost. Its physical range now covers 36–72% of the boulevard sector, with 10 m of tapered additional width, and rejoins before the final hop. A reproducible steering controller traversing the same gates (4–79% of the boulevard sector) measures:

| Line | Time | Wall impacts |
| --- | --- | --- |
| Center main road, no item | 5.817 s | 0 |
| Clean inside road, 6.5 m offset, no drift | 5.433 s | 0 |
| Outside panels, −5.1 m offset | 5.400 s | 0 |
| Mushroom on center main road | 5.450 s | 0 |
| Ordinary service-apron cut | 6.117 s | 0 |
| Service-apron cut with one actual mushroom | 5.333 s | 0 |

The boosted cut consumes one real mushroom upon reaching rough paving, stays off-road for 0.733 s, and saves 0.483 s against the center baseline, 0.117 s against the mushroom main-road run, and 0.100 s against the clean inside-road run. Ordinary traversal loses 0.300 s against the center baseline. The outside pads and clean inside road are within 0.033 s. The original one-second shortcut target is therefore revised to this measured modest benefit; human drift execution and item timing still need playtesting. No constant/replenished boost was used in this check.

Sampled centerline separation is at least **35.50 m** for route points separated by at least 65 m of lap distance. Shortcut ground and global/local projection agree across the apron. Five focused automated checks cover route/district continuity and separation, the right-bend apron ground, all five three-lap AI completions and sector pace, actual single-mushroom cost/reward with normal line competition, and the shuttle warning/clear-lane cycle.

Scenery includes emissive city windows and market awnings, a loading hall with at least 13 m overhead clearance, concrete quay beams and steel supports beneath the declared elevated span, water/ships/cranes outside the quay, container rows with an unobstructed shuttle parking bay, and structural cyan arrows at the service apron. Large scenery uses conservative full-footprint checks against the complete route. The animated shuttle matches the shared contact footprint and pose; only its transform and warning material change per frame. Static props reuse materials/geometries and support root-level batching. A Three.js scene-construction smoke check produced finite geometry and exactly matched the shuttle's shared pose. Desktop/mobile visual clearance and rendering are to be checked in the integrated browser; these measurements do not claim a completed human playtest.

Graphics follow-up: scenery now consumes the shared downloaded concrete, metal and brick textures and the shared kit's baked vertex shading. Architecture has contrasting corner/cornice trims, inset luminous windows and projecting sills, stepped/pitched/tank rooftop silhouettes, striped awnings and suspended market lanterns. Container doors/hardware, quay bracing, crane braces and ship fittings add shape detail without changing collision or road geometry. Shared downloaded low-poly pine assets appear in promenade planters and rock assets break up the quay shoreline; asset download/licensing and texture adaptation are shared engine responsibilities. Root-level static flattening reduces the authored smoke scene to 23 meshes before downloaded models are included, with the cargo shuttle still explicitly animated and its pose exactly matching shared contact. All five existing Neon checks continue to pass after the visual changes.
