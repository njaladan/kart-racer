# Six adventure course visual upgrades

Selection on 2026-10-07: choose later courses with no imported scenery models and
no dedicated vignette builder, then confirm their sparse silhouettes and surfaces
against the existing driving-camera gallery. This selects Tempest Causeway,
Pocket Pantry, Railstorm Express, Metronome Hall, Pelagic Glasshouse and Emberwing
Observatory. Clockwork and Paper already have dedicated environmental stories.

| Course | Art direction and added layers |
| --- | --- |
| Tempest | Complete imported cottages replace constructed cottage geometry. Eroded scanned sea stacks, distant crags, working sailing ships and rowing boats, grass and cottages, shoreline rings, rotating mist beams, sea-spray glints and sheltered warm motes. |
| Pantry | Authored kitchen cabinets replace the large constructed banks; imported loaves replace toast geometry. Scanned wood and metal, croissants, strawberries, iced doughnuts, cookies and utensils; food racks, a coffee station and tall kitchen windows; shafts of warm light, drifting flour dust and sugar sparkles. |
| Railstorm | Complete authored station houses and steam locomotive replace the large constructed buildings and engine; imported firs replace cone trees. Detailed cutout firs and ferns, layered mountain silhouettes, timber stacks, machinery and barrels; a moving background freight train, amber work lights and dust catching the valley light. |
| Metronome | Six districts of self-playing instruments, with over 600 placements across strings, percussion, bells, brass, keyboards and workshops. A CC0 museum violin scan and Kenney workshop furniture join cherrywood, brass and velvet assemblies. Bows, mallets, lids, slides and clamps articulate; percussion squashes and stretches; accordion folds use skinned rigs. Clock pendulums keep their brass rods and weighted bobs. One roadside bellows passage alternates visible air puffs that nudge karts sideways. No humanoid performers. |
| Pelagic | Scanned reef terraces, textured ferns and marine grass, layered reef walls, fish schools and pulsing translucent jellyfish; moving caustics, light shafts, bubbles and bioluminescent glints. |
| Emberwing | Textured softened basalt, a distant caldera rim, detailed terrace palms and flowering shrubs, scanning satellite dishes and drifting high meteor silhouettes; warm volcanic light and blue observatory fill, embers and terrace motes. |

## Artwork and lighting

Downloaded 43 Kenney GLBs plus seven ambientCG surface sets (color, OpenGL normal
and roughness), with per-course local packs. Reused nine detailed SuperTuxKart
foliage/architecture entries from the original course upgrades by local path.
Every new runtime entry records source, license, byte size and SHA-256. Kenney and
ambientCG downloads use accessible public GitHub mirrors; original CC0 evidence
is included. Shared STK derivatives retain their CC BY-SA notices in the original
packs, linked from each reused entry. No external asset host is contacted at play
time.

The offline Blender pass bevels imported rock edges, keeps their authored
silhouettes, unwraps scanned surfaces and ray-tests vertex occlusion. Existing
primitive rock placements also use these imported outlines. All twelve final scenes
receive fresh 12-sample visibility and diffuse bounce bakes (768px on courses
1–4, 512px on the later courses) and occluded colored spill atlases where
authored height levels are available. Receiver ray bounds now
cover submerged/deep floors and high observatory terraces. Direct sun remains
live and is excluded from the bake. Worn metal decks use broader highlights than
polished architectural brass. Exposed rock overrides polished scan gloss with a
matte finish and restrained normal relief.

The selected packs' scans take precedence over shared fallback textures. Normal
and roughness companions are attached as PBR data to color maps. Other courses
continue to use their existing material fallback behavior.

Two complete SuperTuxKart landmarks (Sven Andreas Belting's old house and steam
locomotive) are converted from pinned authored SPM geometry and original UVs.
Their CC BY-SA 4.0 notices and additional texture notices are retained locally.
Clockwork also shares the old-house replacement. `prepare-course-landmarks.py`
reproduces the conversion. The clustered Kenney `rock-tallb` silhouette replaces stretched terrain slabs
and uses legacy runtime aliases `art:rock-largee` / `art:rock-tallb`; each manifest
records the actual downloaded source model. Preserve the original
observatory and musical mechanism where modular online props do not suit them.

## Whole-course geometry audit

Reserve every main and alternate route, including different floors and lap
variants. Before static batching, complete scenery assemblies are moved outward
when their actual triangles enter the driver/chase-camera corridor. Centered
passages remove only incidental obstructing pieces; tagged driving surfaces,
physical obstacles and route structures retain their simulation semantics.
Primitive ranges survive batching so one bad post does not delete a balcony.

Santorini tests the entire terrace and church, including sea-level foundations.
Docks have sea-bed piles and boats float at sea level. Observatory foundations
reach the caldera floor. Clockwork braces attach to deck beams; its opening gear
rotors clear every route floor. Railstorm gantries, musical arches and pantry
gates place supports outside the full platform width. Hall and freight gantry
posts extend to ground; coastal trusses include connected lower chords. Sunstone canyon walls
follow the widened platform and trim faces that touch another road elevation.
Fish, jellyfish and marine particles have bounded underwater animation envelopes.

`COURSE_ROUTE_AUDIT=only node tools/export-lighting-scene.mjs` exercises the actual
placed scene triangles along five main-road lanes and three alternate-road
lanes. It is a diagnostic sampling pass; the placement guard also uses continuous
triangle/box intersection checks against the complete corridor.

## Runtime cost and motion

Static art uses the existing regional batching/instancing. Repeated meshes inside
moving assemblies can be batched in local coordinates; the outer assembly keeps
its animation. Fir LODs use the existing distance controller. Ambient sprites
share two GPU particle draws per course, with 40/60/80/100% density across the four
quality settings. Motion is deterministic on the race clock and reduced-motion
mode resets it. Light beams are simple soft additive meshes; no per-beam shadow
map or ray marcher is required. Existing Ultra planar wet-road reflections and
postprocessing remain available.

All twelve courses receive denser localized environmental fields with a bounded
1160-point native budget and quality scaling. Cinders and workshop sparks attach
to visible braziers/forge bowls and grinding machines; flame sheets and nearby
light pools flicker together. Marine fields fade below the water ceiling. Daylight
solar halos require an on-screen sun and an unobstructed scene ray, then fade
behind walls or underwater; indoor and storm courses suppress them.

## Incidental pulled-code repairs

The newly widened Frostpeak downhill included a 17.6m bend that failed its 18m
curvature floor. Moving one authored control point by one metre restores an
18.5m minimum. Its open edge had also inherited mountain surface height for all
columns, turning the intended vertical fascia into a catch surface. Mountain
height now applies to soft shoulders; exposed drop faces keep their vertical
profile. Frostpeak's lighting is rebaked against the corrected final scene. Alternate
ribbons also initialize vertex colors after their positions/normals are built;
otherwise pruning a formerly merged decorative piece exposes a black standalone
surface because its material expects vertex colors.

## Verification

Run `npm run check`, including asset/hash, complete scene geometry, AI laps,
network, render/simulation agreement, quality and reduced-motion checks. The
twelve courses are captured with Chromium at Ultra using
`SCREENSHOT_CAPTURE_QUALITY=3 node tools/capture-readme-screenshots.mjs`. Capture now fails on browser console or page errors. README
images show the same camera locations as the previous gallery.

Release verification: `npm run check` passes all 187 tests; all twelve bakes
match the final scene SHA-256; all twelve Ultra gallery captures load without
browser errors. The placed-triangle audit reports zero sampled obstructions
on every course, including the lap-specific Paper alternatives.

Software Chromium verifies rendering, not integrated-GPU frame-time performance.

## Metronome orchestra expansion

`tools/prepare-metronome-instruments.py` reproduces the pinned CC0 downloads and
Blender violin conversion. The Metronome manifest records the source and checksum
of every imported model. Instruments and workshop details merge by material while
moving parts retain their pivots and five bellows/accordion skins. The complete
imported scene remains below the existing 1,800 draw-object budget.

The bellows are the only added environmental interaction. Both emitters share
the simulation clock, warn while inflating, then alternate puffs across one
passage. Karts in the visible air volume receive sideways acceleration; the
effect introduces no boost, impact or launch. Hazard motion continues when
ambient animation is disabled. Snapshot replay and full-course AI navigation
cover the puff behavior.
