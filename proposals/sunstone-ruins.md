# Course proposal: Sunstone Ruins

## Identity

Quiet, imposing, mysterious. A sunlit desert expedition into ancient architecture, using long sightlines, shadow and monument scale rather than a busy festival.

## Lap plan

Nominal sixty-second lap; distance budgets total 1,500 m. Section boundaries must be derived from authored route geometry, not these time windows.

| Time | Place | Initial distance | Driving and visual beats |
| --- | --- | --- | --- |
| 0–10 s | Oasis | 270 m | Flowing opening bend beside palms and water; choose an item lane before canyon compression. |
| 10–20 s | Sandstone canyon | 240 m | Rock walls form a readable S-bend, alternating a shaded turn and a bright opening; a restrained crest supplies an optional trick. |
| 20–30 s | Ridge overlook | 250 m | A staged climb and broad crest reveal the distant temple. A banked descent opens toward its entrance. |
| 30–40 s | Temple entrance | 225 m | Approach between obelisks and pass a tall stone gateway; two authored bends alternate shade and courtyard sunlight. No low tunnel ceilings. |
| 40–50 s | Pillared courtyard | 230 m | Generously spaced columns guide turns around the one animated ancient mechanism. A marked left safe line and recovery space follow. |
| 50–60 s | Dune-side finish | 285 m | An inside-right sand cut, a competitive outside boost line, and final open drift beneath the temple silhouette. |

## Signature sequence

Cresting the canyon ridge to discover a monumental temple, descending toward it, then crossing from dazzling sunlight into its shaded gateway.

## One interactive hazard

An ancient stone shuttle, driven by a slowly rotating decorative gear, traverses part of the courtyard. The proposal narrows the original sweeping mechanism to one translating collision body: rendering, AI and shells can share an exact oriented-box footprint. A two-second pulsing rune warning precedes movement on the shared race clock. The left lane always remains open; nothing forces a stop.

## Shortcut and competing lines

A bounded inside-right sand patch cuts the dune-side bend. Bright stone markers outline entry and exit; sand remains driveable ground with coherent elevation. A saved mushroom offsets sand drag and should yield a modest advantage; the main route supplies pickups and an outside pad alternative.

## Materials, scenery and camera

Use warm sandstone road accents, muted stone courtyard paving, amber canyon walls and dark cool temple shadows. Repeated pillar/arch forms imply age and scale. Maintain strong road-edge contrast and limited dust scenery; dust must never obscure a driving decision.

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

## Implemented course and measured results

Implemented as an independently owned descriptor and scenery module: `src/courses/sunstone-ruins.js` and `src/courses/sunstone-ruins-world.js`. The new thirty-control route is a clockwise desert expedition, not the countryside layout with new materials. Measured surface length is **1,499.43 m**. Authored half-widths are 9, 7.8, 8.5, 8, 9 and 9 m. Canyon bends, a 34 m ridge crest, a temple gateway, column rhythms and the tighter dune-side right bend provide distinct driving places. The temple sits ahead of the ridge crest (heading dot product 0.81) and outside the road; its stepped mass never covers driveable ground. Gateway overhead begins 13 m above its anchor; supports sit at ±16 m. Decorations use reusable geometry/materials and static batches, while the shuttle, gear and warning beacon retain their animation.

A representative skill-0.9 isolated driver at the fixed 120 Hz simulation step recorded **56.98, 56.37 and 56.36 s** laps, finishing in **169.70 s**, with zero road-wall or shuttle impacts. Five isolated drivers, using skill 0.90 down to 0.72 and all five lane patterns, completed three laps in **168.32–171.09 s**, all without wall or hazard impacts. These measurements include authored pads and hazard behavior, but exclude combat and kart-to-kart interference.

| Physical section | First lap | Second lap | Third lap |
| --- | --- | --- | --- |
| Oasis | 11.46 s | 10.83 s | 10.83 s |
| Sandstone canyon | 9.49 s | 9.50 s | 9.51 s |
| Ridge overlook | 8.81 s | 8.78 s | 8.77 s |
| Temple entrance | 8.66 s | 8.67 s | 8.67 s |
| Pillared courtyard | 8.56 s | 8.55 s | 8.55 s |
| Dune-side finish | 10.00 s | 10.03 s | 10.04 s |

The sand cut was shortened to the dune sector's 28–65% range and positioned on a stronger right bend. Its positive-side expansion tapers by shared road rules, banking is flat, and it rejoins before the following turn. Minimum sampled separation between road points at least 75 m apart along the route is **53.44 m**; expanded sand and ordinary roads remain distinct. Focused ground/projection checks keep the cut on the same ordered route rather than permitting a progress jump.

A deterministic 90 km/h entry test measured the same shortcut approach/rejoin interval with an authored steering line and the **actual 0.95 s mushroom consumed through the item API**. Main road took **5.67 s**, the outside panel line **5.87 s**, ordinary sand **5.97 s**, and a carefully aimed single-mushroom sand line **5.28 s**. Spending the same mushroom on the main road took **5.33 s**. All five traversals rejoined within road bounds without wall impacts. The cut therefore has a modest execution reward, while unboosted sand has a cost. The measured 0.05 s advantage against an equally boosted main line is small and remains a human-playtest tuning point; the outside line offers free acceleration without spending an item.

Four focused automated tests cover route separation and forward temple reveal, all five drivers' three-lap/sector pacing, shared warning and safe-lane collision, and real item-backed shortcut traversal. All pass. Browser camera/render verification is performed during shared integration; these numbers are simulation measurements, not human playtest results.
