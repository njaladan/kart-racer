# Course proposal: Windmill Wilds

Recommendation: turn the existing countryside circuit into a roughly **1.5-kilometre course targeting 55–65 seconds per clean lap**, with a nominal 60-second lap and a three-lap race of about three minutes. Build six distinct sections through a meadow, dense forest, ridge, lakeside timber crossing, working windmill, and orchard. Each section should introduce a fresh place and driving rhythm about every 10 seconds, with smaller decisions inside it. Use one moving obstacle and one useful shortcut.

This document records the original design proposal. The implementation is now in the game; see the measured implementation notes below. Findings come from reading the application, track, simulation, physics, item, and scenery modules. Dimensions and baseline lap times were checked with the current track and driving simulation. The proposed geometry and its lap times have not been implemented or playtested; their numbers below are tuning targets.

## What is already here

- A closed Catmull–Rom spline with 13 control points, mostly following a large rounded loop. The approximate world length is 644 metres; `TRACK = 2400` is the progress-coordinate length, not metres.
- Asphalt is 16.2 metres wide throughout. Kart collisions impose a continuous boundary at 8.65 metres from the center; shells use 9 metres. Decorative guardrails sit at 9.6 metres.
- Gentle hills and procedural banking, with three similar bumps at 20%, 51%, and 78% of the lap. The sampled road elevation ranges approximately from −0.63 to 5.50 metres.
- Four boost pads, all centered on the road, and 18 item boxes distributed at regular progress intervals across alternating lanes.
- Pine and broadleaf trees, flowers, hills, balloons, grandstands, a central lake, and a rotating windmill. The lake and windmill are scenery inside the loop; racers never pass through the mill.
- World-space vehicle motion, drift mini-turbos, small ramp hops, five AI rivals, and item combat. Ground grip distinguishes only road and off-road.

The main opportunity is course identity and pacing. The scenery is attractive, but the same road width, surface, gentle turning pattern, and repeated ramp treatment make much of the lap feel similar. The player has little reason to associate a particular landmark with a particular driving decision.

## Survey of all 32 Mario Kart Wii race tracks

Scope: the 16 original courses and 16 retro courses in Wii's eight racing cups. Descriptions refer to their **Wii versions**, including retro changes. Battle arenas and later remakes are outside this survey. The course roster is documented in [Mario Kart Wii](https://www.mariowiki.com/Mario_Kart_Wii). The final column is my design interpretation, rather than a claim made by the source.

### Mushroom Cup

| Track and source | Environment | Distinctive attributes in Wii | Idea to apply here |
| --- | --- | --- | --- |
| [Luigi Circuit](https://www.mariowiki.com/Luigi_Circuit_(Wii)) | Sunny spectator circuit, grassy hills and a lake | Straightforward layout; a banked final corner lined with boost panels; sand cuts | Finish with a corner where a longer boosted outside line competes with a tight inside drift. |
| [Moo Moo Meadows](https://www.mariowiki.com/Moo_Moo_Meadows) | Pastures, farm buildings and windmill | Cows cross the road after the opening lap; burrowing moles; grassy bumps | Countryside activity can become a readable obstacle, with an easy opening lap. |
| [Mushroom Gorge](https://www.mariowiki.com/Mushroom_Gorge) | Mountain gorge and crystal cave | Bouncing red mushrooms, solid green platforms, alternative paths across gaps | Give a section its own rhythm and make route alternatives visibly different. |
| [Toad's Factory](https://www.mariowiki.com/Toad%27s_Factory) | Working factory and waterside loading platforms | Conveyors, crushers, shifting platforms, crates and mud | Machinery should explain the racing challenge. A working mill can provide that connection. |

### Flower Cup

| Track and source | Environment | Distinctive attributes in Wii | Idea to apply here |
| --- | --- | --- | --- |
| [Mario Circuit](https://www.mariowiki.com/Mario_Circuit_(Wii)) | Town around Peach's Castle | Chain Chomp threatens the inside line; Goombas; a tunnel under another part of the route | A landmark can anchor a corner with a clearly safer outside line. |
| [Coconut Mall](https://www.mariowiki.com/Coconut_Mall) | Shopping mall, courtyards and parking lot | Reversing escalators, upper/lower paths, fountains and moving cars | Alternate enclosed and open spaces; offer routes with different costs and rewards. |
| [DK Summit](https://www.mariowiki.com/DK_Summit) | Snowy mountain sports resort | Cannon, moguls, half-pipes, deep snow and sharp bends around chasms | Combine wide playful terrain with tighter technical turns; use elevation to build a reveal. |
| [Wario's Gold Mine](https://www.mariowiki.com/Wario%27s_Gold_Mine) | Elevated wooden mining railway and cavern | Steep troughs, bats, hazardous mine carts and a narrow boosted alternate route | A timber crossing creates a strong silhouette; a moving obstacle can make a racing line change. |

### Star Cup

| Track and source | Environment | Distinctive attributes in Wii | Idea to apply here |
| --- | --- | --- | --- |
| [Daisy Circuit](https://www.mariowiki.com/Daisy_Circuit) | Sunset seaside town | Fountain roundabouts, lighthouse hairpin, tunnel and staircase shortcut | Author a sequence of landmarks and corners; sunset light can reinforce the current course name. |
| [Koopa Cape](https://www.mariowiki.com/Koopa_Cape) | Coastal cliffs, forest river and transparent underwater tunnel | Water currents aid speed; tunnel has rotating electrical hazards; sharp environmental transitions | A water-adjacent section should affect the line or surface, and feel different from the forest. |
| [Maple Treeway](https://www.mariowiki.com/Maple_Treeway) | Autumn forest, huge trees and canopy | Cannon, narrow branches, hollow trunks, roaming Wigglers, leaf piles and rope bridge | Make trees part of the route: a shaded passage and raised timber section fit this project's setting. |
| [Grumble Volcano](https://www.mariowiki.com/Grumble_Volcano) | Active volcano surrounded by lava | Moving platforms, branching routes, fireballs and road edges that crumble over time | A familiar section can change during a race if the change is visibly announced. |

### Special Cup

| Track and source | Environment | Distinctive attributes in Wii | Idea to apply here |
| --- | --- | --- | --- |
| [Dry Dry Ruins](https://www.mariowiki.com/Dry_Dry_Ruins_(race_course)) | Desert, oasis and ancient temple | Falling pillars become ramps; bats, Pokeys, half-pipes and accumulating sand | Let environmental events alter how a place is driven, rather than simply inflict damage. |
| [Moonview Highway](https://www.mariowiki.com/Moonview_Highway) | Nighttime cliffs and illuminated city | Traffic in both directions, explosive cars, toll gates and boost-heavy urban straights | Use a predictable crossing vehicle and a strong transition into the mill yard. |
| [Bowser's Castle](https://www.mariowiki.com/Bowser%27s_Castle_(Wii)) | Fortress and lava chambers | Wavy corridor, Thwomps, half-pipes and a giant machine firing down the central lane | Build one memorable centerpiece with an understandable safe route. |
| [Rainbow Road](https://www.mariowiki.com/Rainbow_Road_(Wii)) | Space above Earth | Steep descents, exposed edges, increasingly wavy road, holes and a Launch Star | A distant view and a dramatic descent can produce spectacle without adding more obstacles. |

### Shell Cup

| Track and source | Environment | Distinctive attributes in Wii | Idea to apply here |
| --- | --- | --- | --- |
| [GCN Peach Beach](https://www.mariowiki.com/Peach_Beach) | Sunny resort shoreline | Changing tide, sand/water routes and roaming Cataquacks | Terrain can make an apparent shortcut attractive only under particular conditions. |
| [DS Yoshi Falls](https://www.mariowiki.com/Yoshi_Falls) | Oval canyon around a lake and giant egg | Waterfalls cross the inner route; outer bridges provide safety and boosts | Make the outside route forgiving and the inside line more demanding. |
| [SNES Ghost Valley 2](https://www.mariowiki.com/Ghost_Valley_2) | Dark haunted wooden boardwalk | Tight right-angle turns, fragile boundary blocks and a ramp shortcut over a gap | A compact section can feel distinct through enclosure, materials and precise corners. |
| [N64 Mario Raceway](https://www.mariowiki.com/Mario_Raceway) | Grassy asphalt circuit | Mixed corner radii, giant pipe tunnel and extensive grass cuts; Wii adds a grass ramp | Improve the shape of the racing line before relying on additional hazards. |

### Banana Cup

| Track and source | Environment | Distinctive attributes in Wii | Idea to apply here |
| --- | --- | --- | --- |
| [N64 Sherbet Land](https://www.mariowiki.com/Sherbet_Land_(N64)) | Frozen lake and ice cave | Slippery ice, sliding penguins, cave pillars and alternate routes around a rock | A short surface change can make familiar steering inputs feel different. |
| [GBA Shy Guy Beach](https://www.mariowiki.com/Shy_Guy_Beach) | Tropical islands and shallow water | Crabs, broken stretches of sand and timed explosive cannonballs | Show a hazard's future location before it arrives; keep scenery responsible for the event. |
| [DS Delfino Square](https://www.mariowiki.com/Delfino_Square) | Harbor town, alleys and docks | Split alley, breakable crates, lifting bridge and shortcut through mud | Compress and reopen the road; reward an optional cut with a meaningful time saving. |
| [GCN Waluigi Stadium](https://www.mariowiki.com/Waluigi_Stadium_(Mario_Kart:_Double_Dash!!)) | Dirt stadium at sunset | Ramps, fire hoops, mechanical Piranha Plants, mud and Wii half-pipes | A jump section needs a distinct role and landing reward, rather than repeated identical bumps. |

### Leaf Cup

| Track and source | Environment | Distinctive attributes in Wii | Idea to apply here |
| --- | --- | --- | --- |
| [DS Desert Hills](https://www.mariowiki.com/Desert_Hills) | Desert dunes and oasis | Pokeys, Fire Snakes, winding final bends and boost cuts across dunes | Let a boost item become a strategic resource for a specific corner. |
| [GBA Bowser Castle 3](https://www.mariowiki.com/Bowser%27s_Castle_3) | Stormy fortress exterior over lava | Thwomps, closely spaced jumps, lava grids and muddy corners in Wii | A short sequence of challenges can establish rhythm, with recovery space afterward. |
| [N64 DK's Jungle Parkway](https://www.mariowiki.com/DK%27s_Jungle_Parkway) | Jungle river, paddle steamer and cave | River launch, tight turns, narrow bridge and cave grass shortcut | Make the lake visible from a raised crossing and reveal the next landmark on its exit. |
| [GCN Mario Circuit](https://www.mariowiki.com/Mario_Circuit_(GCN)) | Castle gardens and rolling roads | Chain Chomp, roadside Piranha Plants, Goombas, tunnel and trickable bumps | Give corners personalities; a mild bump can be useful without becoming a major jump. |

### Lightning Cup

| Track and source | Environment | Distinctive attributes in Wii | Idea to apply here |
| --- | --- | --- | --- |
| [SNES Mario Circuit 3](https://www.mariowiki.com/Mario_Circuit_3) | Flat technical asphalt circuit | Tight hairpin, repeated bends, off-road cut through a wall opening; no tricks | Turning and drift execution alone can provide variety. |
| [DS Peach Gardens](https://www.mariowiki.com/Peach_Gardens_(race_course)) | Formal estate gardens | Hedge maze, wandering Chain Chomps, flower cuts and moles; Wii adds ramps | Use shrubs or tree trunks to frame readable lanes and make a meadow cut feel intentional. |
| [GCN DK Mountain](https://www.mariowiki.com/DK_Mountain) | Jungle and volcanic mountain | Cannon to summit, bumpy descent, rolling boulders, switchbacks and swaying bridge | Build a climb, reveal, descent and tight-corner sequence instead of undifferentiated hills. |
| [N64 Bowser's Castle](https://www.mariowiki.com/Bowser%27s_Castle_(N64)) | Stone fortress, gardens and lava bridges | Thwomp corridors, angular turns, spiral ascent and Wii lava geysers | Contrast enclosed technical sections with open fast sections. |

## What the survey suggests

The useful common patterns are **an environment that explains the mechanics**, **contrasting sections within a lap**, **a recognizable centerpiece**, and **choices that trade speed, safety, or items**. Not every track needs elaborate machinery: Daisy Circuit and Mario Circuit 3 get much of their character from the route itself.

The closest fit here is Maple Treeway's relationship between forest and road, Moo Moo Meadows' living countryside, Delfino Square's compression and bridge reveal, and Luigi Circuit's competing final-corner lines. A small amount of Toad's Factory-style machinery would make the existing windmill meaningful. Lava, snow, space, cannons, and large bouncing-platform sections would imply a substantially different course and vehicle simulation.

## Length and lap-time targets

The previous proposal specified places and percentage ranges but did **not** specify a new course length. Preserving the existing 644-metre length would not achieve the requested Mario Kart Wii-style lap duration.

### Measured baseline

I ran two representative AI drivers (skills 0.91 and 0.72, lane-pattern indices 0 and 4), separately, for three laps each at the existing fixed 120 Hz simulation step. Each started at the finish line from rest. These runs used the current spline, vehicle physics and ramp behavior, with no combat or kart-to-kart interference. A second set also applied the four boost pads using the game's current pickup conditions and cooldown.

| Current 644-metre course | First lap | Later laps |
| --- | --- | --- |
| No boost pads | 23.98–24.38 s | 23.05–23.52 s |
| Existing boost pads active | 22.22–22.50 s | 21.31–21.65 s |

These are measured isolated AI times, not a prediction of every human's race time. More technical turns at the same length would add time, but relying on repeated slow corners or collisions to double the duration would undermine the requested pacing.

### Mario Kart Wii comparison

The [Mario Kart Wii staff-ghost tables](https://www.mariowiki.com/Mario_Kart_Wii#Staff_Ghosts) provide a repeatable comparison. Dividing each three-lap total by three gives an average lap, not an individually recorded flying lap. Across all 32 courses, these averages are **41.5 seconds for expert ghosts** and **46.9 seconds for normal ghosts**, with much shorter and longer tracks in the roster. Time trials also differ from races with opponents and item attacks.

| Relevant Wii course | Expert ghost: total ÷ 3 | Normal ghost: total ÷ 3 |
| --- | --- | --- |
| Toad's Factory | 41.9 s | 47.5 s |
| Coconut Mall | 44.4 s | 50.3 s |
| DK Summit | 45.8 s | 51.6 s |
| Maple Treeway | 52.6 s | 59.5 s |
| Koopa Cape | 53.8 s | 61.0 s |

Choose the **longer, scenic Wii-course feel**, especially Maple Treeway and Koopa Cape, rather than treating all Wii courses as one minute long. The intended clean lap is **55–65 seconds**, centered near **60 seconds**. A three-lap clean race should take approximately **2:45–3:15**, with a small standing-start overhead and additional time from mistakes or attacks. Skilled runs with clean drifts, well-used boosts and the shortcut may be faster; their exact range needs playtesting.

### Distance budget

Begin with a **1,500-metre main-route centerline**, about **2.3 times** the existing length, and allow roughly **1,450–1,600 metres** during layout tuning. At an effective route speed of 90 km/h (25 m/s), 1,500 metres takes 60 seconds. At 83–98 km/h it takes approximately 65–55 seconds. Those averages include time spent accelerating, cornering and traversing slower sections; they are not top-speed settings. Current limits remain 112 km/h normally and 144 km/h while boosted.

Actual line length, corner speed, drifting, boosts and grade all affect time. The **measured lap-time target takes priority over hitting an exact metre count**. Start with this distance budget, then measure sector splits and adjust the route. Add meaningful route length if it is too fast; do not pad the lap with compulsory waiting, repeated obstacles, or a lower global speed cap.

## Proposed lap: six fresh sections

The time windows below are nominal splits for a 60-second clean lap. Distances are initial centerline budgets and total 1,500 metres. Their different lengths allow fast open sections and slower technical sections to occupy similar time. Derive each section's spline-progress range from its implemented distance; the time percentages must not be copied directly into distance-based `t` values.

| Nominal time | Distance budget | Place | Driving rhythm and new details |
| --- | --- | --- | --- |
| 0–10 s | 270 m | Festival meadow | Open asphalt, festival flags and pasture scenery. Accelerate into a broad drift, then choose an item lane as the road approaches the trees. A planted verge shapes the bend without creating another hazard. |
| 10–20 s | 250 m | Pine Hollow | Dense canopy, cooler light, needle-covered shoulders and a left-right S-bend. Reverse the steering rhythm, take one restrained hop, then see daylight at the forest exit. |
| 20–30 s | 220 m | Ridge climb and overlook | Climb through a pair of generously spaced bends onto an open hillside. The crest reveals the lake and turning windmill below; descend into a visibly banked curve. Elevation and sightlines supply the change in experience. |
| 30–40 s | 250 m | Lakeside timber crossing | Transition from hillside road to a roughly 12-metre-wide supported wooden deck, then a shoreline bend. Hold a precise line over a broad crest before the road opens again. The deck is only part of this sector, not 250 metres of identical bridge. |
| 40–50 s | 220 m | Working mill and loading yard | A legible approach, tall drive-through mill base, and open yard. Machinery and sacks frame the portal; a delivery cart occupies part of the yard on a predictable cycle. Read its movement and select the open lane. The interior passage is only a few seconds of the sector. |
| 50–60 s | 290 m | Orchard bend and finish | Burst into warm sunlight, follow a descending orchard curve, and choose the final line. A marked inside grass cut rewards a saved mushroom; outside boost pads compete with a tight drift. The finish straight gives a brief payoff and overtaking opportunity. |

### Variety requirement

- At the nominal pace, introduce a **major change about every 10 seconds**: place, enclosure, surface, elevation, or steering rhythm. At different driving speeds, the transitions will arrive sooner or later; they are physical locations, not timed visual triggers.
- Within each section, include **two or three readable beats** roughly 4–6 seconds apart: a bend reversal, item-lane decision, crest, landmark reveal, width change, or boost choice. A new beat does not require a new hazard.
- Avoid any **15–20-second stretch with unchanged scenery and unchanged driving**. A broad section can still be varied through sightlines, grade, and a meaningful line choice.
- Alternate fast/open, shaded/technical, climbing/revealing, narrow/precise, enclosed/interactive, and descending/fast. Keep all six places part of one countryside landscape so the lap feels like a journey.
- Give the next difficult feature a visible approach. Put recovery room after the forest bends and after the mill cart. Fast relief and readable transitions are part of the variety.
- Retain the 32-track survey's lessons without adding six unrelated gimmicks. The cart is the main moving hazard; the grass cut is the main shortcut. Later laps gain variation from cart timing, pickups and rivals while keeping the route learnable.

The mill should sit at the lake edge beside the reshaped route. Its present center-of-lake position is decorative and inaccessible; simply adding an entrance to that mesh would not create a driveable section. Keep the new loop free of overlapping roads and avoid wrapping it tightly around itself.

The signature sequence is emerging from the shaded forest, climbing to a lake-and-windmill overlook, descending onto timber, then racing through the mill's base and back into sunlight. Blades can turn above the entrance as scenery; the ground-level delivery cart supplies the interactive obstacle. Make the mill opening tall enough for the existing chase camera, or fade obstructing roof geometry.

### One moving obstacle

Use one delivery cart in the mill yard with a predictable cycle, a visible starting position and an audible cue. It should occupy only part of the available road so a driver can always pass without stopping. Do not place a compulsory item pickup directly behind it.

For optional race progression, keep the cart parked during an initial shared introductory period, then activate it. Its position must come from one shared simulation clock, not from each racer's lap number; racers must see and collide with the same cart. If activation is linked to a lap, use a shared race event and announce it before the cart moves.

### One shortcut and one competing line

Make the final inside grass cut visibly intentional, with a gap in fencing and an exit visible from the entry. Aim for a modest time saving with a mushroom and a loss without one. Avoid item boxes on the cut so using it also means passing up a pickup opportunity on the main route.

The outside boost line should be competitive with a clean inside drift, not automatically superior. As initial tuning targets, aim for roughly a one-second advantage from a well-executed mushroom cut and near-equal corner times for the two normal lines. These are proposed targets to measure in playtesting.

## How I would edit the code

### Shared track descriptions first

Add section descriptions and shared queries in [track.js](/workspace/kart-racer/track.js:1): road half-width, outer collision boundary, material/surface, banking, ramps and pad placements. Rendering, kart simulation, shells, and AI must use the same data. `laneWidth()` currently converts a normalized lane value to a fixed 6.25-metre multiplier; new section logic should use explicit lateral offsets in metres.

The three ramp locations are duplicated in [rampHeight()](/workspace/kart-racer/track.js:30) and [advanceRacer()](/workspace/kart-racer/simulation.js:118). Replace both lists with one ramp definition before moving or reshaping ramps. Keep geometry and takeoff detection synchronized.

### Route and scenery

- Build and measure a roughly 1,500-metre route in [track.js](/workspace/kart-racer/track.js:5), with enough control points to author all six sectors. Reshape the footprint to produce the forest S-bend, ridge climb, lake-edge crossing, mill approach and final corner. Use deliberate elevation profiles instead of relying entirely on periodic sine waves. Avoid intersecting or nearly touching segments. Enlarge and author the landscape around this route rather than stretching the existing oval and scattering more trees.
- Distinguish physical length from race progress: changing `TRACK = 2400` alone does not lengthen the world-space road. Measure the generated route, including elevation, and either retain normalized progress with explicit world conversions or consistently convert progress to world-distance units. Review all progress-based spacings, lookahead distances, pad/box hit windows and ramp widths after enlargement; unchanged values cover different physical distances when the route grows.
- Increase spline/projection and road/terrain sampling enough to retain the current approximate spatial resolution on the longer course, or use adaptive sampling around tight bends. Otherwise the same sample counts would make the surface and progress projection coarser. Profile the resulting cost and keep repeated scenery instanced.
- Update [ribbon()](/workspace/kart-racer/game.js:178) and [makeWorld()](/workspace/kart-racer/game.js:226) to read section widths and materials. Narrow road geometry and actual collision boundaries together, allowing for kart body width.
- Extend [addLandscape()](/workspace/kart-racer/visuals.js:39) with concentrated tree groups, timber supports and the mill entrance. Exclude the raised crossing from the current grassy embankment ribbon, which otherwise fills the space below the road. Move the lake/shore scenery as needed to keep the bridge's visual relationship coherent.
- Preserve the existing instancing and mesh batching. Only the machinery and cart need frequent transforms; the rest can remain static.
- Replace regular item spacing in [addItemBoxes()](/workspace/kart-racer/game.js:513) with authored rows before decisions and after difficult sections. Move [boost pads](/workspace/kart-racer/game.js:468) into deliberate lines.
- Give pads a lateral offset in their shared data. Their current hit detection in [moveRacer()](/workspace/kart-racer/game.js:1419) only accepts the center lane, so moving a mesh alone would leave an invisible center boost.
- Update the HUD's `SUNSET CIRCUIT` name and the finish banner to match the selected course identity; warm the light if sunset remains part of the concept.

### Physics, collision and progress

- In [simulation.js](/workspace/kart-racer/simulation.js:73), replace fixed ±8.65-metre kart walls and the road/off-road threshold with the shared section query. In [items.js](/workspace/kart-racer/items.js:50), do the same for the shell's ±9-metre boundary.
- Narrow the timber crossing conservatively. The mill needs actual local obstacle collision for its cart and doorway posts; the existing road wall does not make decorative objects solid. Keep kart and shell obstacle behavior consistent.
- Extend [drive()](/workspace/kart-racer/physics.js:32) with surface drag/grip only where useful. For the grass cut, decide explicitly whether boost items override or reduce off-road drag: the current code continues applying the penalty during boosts and stars. Tune that interaction to deliver the shortcut's intended reward.
- A genuine grass cut requires a drivable off-road patch, an appropriate ground-height query, and an opening in the collision boundary. Removing the decorative guardrail is insufficient. The current projection still follows the road's height beyond its edges.
- Validate progress through ordered checkpoints before allowing the cut to bypass a bend. Current lap counting uses unwrapped projected spline distance, with no checkpoint sequence; a newly accessible off-road area must not award unintended progress jumps. Both normal and shortcut routes should map to the same ordered race progression.
- Keep bridge hops small for the first version. [verticalMotion()](/workspace/kart-racer/physics.js:137) snaps to the projected surface, caps altitude at 1.1 metres above it and forces a landing by 0.85 seconds. It does not represent missing road or a fall from an unguarded bridge. Real gaps, major launches, and fall recovery require additional surface and airborne logic.

### AI and camera

Update [botInput()](/workspace/kart-racer/simulation.js:30) to respect available width, slow for the forest and ridge bends, and choose a safe mill-yard lane using the shared cart state. Express AI lookahead in world metres and convert to route progress so route enlargement does not multiply its physical lookahead. Some bots can take the shortcut when holding an appropriate boost, after that route is implemented. They currently follow one spline and do not drift or plan around scenery.

Check the camera in [render()](/workspace/kart-racer/game.js:1688) through the mill and canopy. It follows from about 9–11 metres behind and 4.7 metres above the kart, so a short or low portal can obscure the player even when the kart itself clears it.

## Suggested implementation order

1. **Establish length and rhythm:** shared section/ramp data and a roughly 1,500-metre continuous route with all six sectors, including the ridge reveal. Block out the scenery, crossings and mill; measure clean laps and sector splits before adding detailed props. Aim for 55–65 seconds, with a distinct experience roughly every 10 seconds.
2. **Make the environment interactive:** one cart, matching collision, AI avoidance and cues. Verify camera clearance and shared hazard timing.
3. **Add replay value:** the legal grass shortcut, boost/surface tuning and checkpoint validation; optional delayed cart activation.

The first stage is already a worthwhile course redesign. True branching routes, collapsing bridges, underwater tunnels and cannons can be considered later if their supporting simulation work is desired.

## Validation for implementation

Run the existing physics/item tests after implementation. Add focused checks for section boundaries, shared ramp takeoff, kart/shell wall agreement, shortcut progress validity and hazard timing. Have all five AI drivers complete three laps with the cart active. Increase the current AI test's simulation-time budget where needed: it presently stops after 160 seconds and asserts a finish below 150 seconds, both too short for the new intended race. Preserve its completion and valid-state checks with a generous bounded budget appropriate to the new course.

Record first-lap and flying-lap times separately, plus each sector's entry/exit time. Compare a clean baseline, ordinary boosts/drifts, and shortcut use; log combat laps separately so collisions do not conceal an overly short route. Target 55–65 seconds for representative clean driving and approximately 60 seconds at the intended pace. Inspect a complete recorded lap for fresh visual or driving beats about every 10 seconds and no unchanged stretch approaching 20 seconds. If a sector drags, add a meaningful transition or shorten it and reallocate length to another sector.

Inspect desktop and touch-camera clearance, and compare the inside drift, outside boost and mushroom cut using recorded corner times. Review camera far distance, fog, terrain extents and landmark placement for the enlarged world. Measure rendering and projection cost on the detailed mill/forest sections.

Success means a player can describe the lap as distinct places, anticipate its obstacle, and improve their time by choosing and executing a line. More scenery alone does not establish that.

## Implemented course and measured pacing

The route now measures 1,499 metres. A clean skill-0.9 AI run from the line recorded lap times of **58.13, 57.29 and 57.25 seconds**, finishing in **172.67 seconds**, with no wall or cart impacts and all nine authored ramp hops. The first-lap section entries were meadow 0 s, forest 11.02 s, ridge 21.35 s, timber 29.82 s, mill 36.44 s, orchard 46.12 s and finish 58.13 s. These are physical simulation measurements without combat, rather than human playtest results; boosts, line choice and item battles change the times.

Implemented centerline budgets are approximately 264 m meadow, 255 m forest, 227 m ridge, 183 m timber, 260 m mill and 310 m orchard. The timber sector is shorter than the nominal proposal, changing place after about 6.6 seconds, while the other sectors take 8.5–12 seconds. Authored pickup decisions, bend reversals, crests, signs and landmarks break up those stretches.

Road widths, surfaces, kart and shell barriers, ramps, pads and pickup rows now share track metadata. The mill has a rotating rotor and a tall drivable portal. Its cart activates after 30 seconds with a two-second warning and a clear passing lane. The orchard has an inside grass cut and an outside panel line; boost items override grass drag. The cut ends before the tighter following turn to keep its ground and progress projection coherent. Twelve ordered checkpoints per lap and a bounded projection update protect lap counting. AI stays on the main road and selects the safe cart lane.
