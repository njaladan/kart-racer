# Turbo Trail — committed continuity

## Vision and working rules
Twelve authored adventures with distinct silhouettes, composed driving views, lively worlds and readable racing surfaces. The original sparse Sunstone rebuild was rejected; the other three rebuilt courses are the **lower** visual bar. Ideas determine topology: rewrite engine assumptions when necessary. No course music work. Main agent implements; user explicitly delegates all future README course screenshots to GPT-6 Luna. Every finished course gets its strongest moment in README. Use focused checks, avoid long browser sessions, and let the user do deeper playtesting. Commit coherent milestones on main and **push immediately after each commit**.

## Course / mechanic matrix
| Course | World and progression | Distinctive mechanic | State |
|---|---|---|---|
| Windmill Wilds | Harvest valley, forest, working mill, willow maze | Banked rural ridge / maze | Existing rebuilt course |
| Neon Harbor / Port Lumen | Waterfront, market, warehouses, ferry district | Cargo conveyors | Existing rebuilt course |
| Sunstone Ruins | Oasis, sandfall canyon, mesa, buried temple, courtyard, dunes | Animated solar-engine lanes | Rebuilt; substantial lighting/life correction; continue refining |
| Frostpeak Festival | Alpine village, mountain road, ski festival | Ice / powder | Remote rebuild merged |
| Clockwork Citadel | Foundry, stacked spiral, clock-face balcony, rooftop | Continuous banked descent and boosted turbine sweep | Registered, verified milestone |
| Paper Revel | Origami valley, layered crossing, pagodas, lantern festival | Unfolding driveable fan apron | Registered, verified milestone |
| Tempest Causeway | Three exposed sea spans alternating lighthouse shelter | Storm bridge choreography and wind forces | Registered, verified milestone |
| Pocket Pantry | Breakfast, shrinking jar, towering shelves, cutlery, sink, toast rack | Meaningful scale transformation / low biscuit passage | Registered, verified milestone |
| Railstorm Express | Ironvale station, cliff chase, moving freight, cargo, gorge, switchyard | Boarding and racing on moving transportation | Registered, verified, actual README screenshot |
| Metronome Hall | Music-box workshop, pendulum hall, resonator gallery, winding key | Shared-beat physical hazards | Registered, verified milestone; no music |
| Pelagic Glasshouse | Conservatory, flooded domes, reef gardens | Underwater driving / gentle currents | Registered, verified milestone |
| Emberwing Observatory | Scholar village, volcanic caldera, telescope terraces | Actual cannon flight over a missing road | Registered, verified milestone |

## Architecture and assets
Native ES modules, bundled Three.js, authoritative Node multiplayer worker and shared fixed-step simulation. Elevation-aware global projection plus local ordered continuity prevents wrong-floor crossings. Route links allow literal docks/vertical lifts, with level frames. Ordered checkpoints and serialized scalar traversal state cover shared-clock lifts/cannons, recovery and replication. Scale-aware contacts/camera, currents, underwater response and gated verges are shared gameplay. Decorative animation and tricks do not modify movement. Generic adventure cart hazard disabled unless authored explicitly.

World construction uses route-aligned continuous ribbons and physical bank/ramp frames. Static scenery and moving machinery children are batched/instanced. Locally baked 512² AO/bounce and six-height colored-spill volumes supplement real directional shadows; lamp pools are baked rather than dozens of realtime lights. Quality/preferences persist. Synthesized original Foley covers engines, tyres, world sounds and mechanics; no music generated. Existing locally bundled STK assets/CC0 textures retain their source licenses. New procedural worlds, shaders, SVG previews and synthesized sounds are original project work; each new pack includes manifest and LICENSES.md. No additional downloaded assets so far.

## Completed milestones (all pushed)
- `9e144d4`: route floor disambiguation and original vision.
- `b1a7b81`: Sunstone expedition topology (intermediate visuals, rejected as final).
- `1a07386`: Garage/Courses/Options, animated kart display, persistent graphics/audio, original Foley and three tricks.
- `f80fc36`: pulled/merged remote Frostpeak rebuild and Windmill support fixes; conflicts resolved preserving both sides.
- `0088f19`: idea-led topology, shared traversals, scale/current/unfolding infrastructure.
- `d76c15c`: Sunstone inhabited world, textured ruins, vaults, mosaics, settlements, wildlife, animated gimbals, low warm sun/cool interior and baked torch light.
- `51d029f`: Clockwork Citadel, literal vertical links, projection and Frostpeak side-ramp placement fixes.
- `cb7102c`: Paper Revel, shared-clock unfolding fan, layered figure-eight and festival world.
- `7fb79f2`: Tempest Causeway milestone: continuous trussed suspension spans, connected cables, lighthouse islets, grounded cottages, sheltered lines, displaced opaque ocean/foam, boats/buoys, bounded spray/rain, rotating beacons, storm clouds and original thunder; wind affects authoritative driving only on exposed spans. README now shows all seven then-registered courses.

- `6b036bf`: Pocket Pantry milestone: coherent fitted kitchen and window, supported counter/shelf road, original labeled ingredients and perforated cheese/toast, biscuit inhabitants, steam, sink droplets/bubbles, actual shrink/grow portals and low-roof tiny line. Original CC0 fictional packaging generated locally; road plank/tile shaders, portal sounds/effects and size-correct recovery. Eight courses registered.

- `b3e2fe2`: Moving-surface foundation: race-clock suspension height in pose/projection, continuous route-relative carrying, serialized carriage identity/coordinate, dynamic-panel layout and stable docks; AI accounts for carried velocity. Static road/rails omitted from moving spans. Three new neutral-riding, seam/dock and recovery tests pass; snapshot replicas agree exactly. Broader topology/traversal/Pantry checks passed (one negative-zero equality in a new dock assertion was corrected).

- `3e9c6c6`: Railstorm world: 1,900 m mountain/train expedition, actual moving/deforming freight panels and covered cars over rail bed, trestles, covered docks, locomotive chase, station/platform inhabitants, mountain settlements/forest, gorge river and signals. Shared train boarding/exit Foley; original procedural assets and credited shared textures. Nine courses registered. The initial bounded capture timed out; synchronous diagnostics subsequently enabled actual README driving images.

- `48cb1a1`: Metronome: 1,850 m wood/velvet/brass music-box expedition, fixed-pivot shared-clock hammers, pinned rotating drum and comb, automaton dancers, resonators, giant winding key, warm galleries and safe outside line. Enclosed section flags now drive shared lighting/reflections. Original mechanical beat Foley only. Ten courses registered; Luna README image shows the actual gilded hall and kart. Railstorm open-deck image also improved.

## Verification and known limitations

Clockwork update (2026-10-06): the eastern route crossing and sky lift are replaced by one outer banked descent and a boosted turbine sweep. Large scenery assemblies and support columns now check clearance against every route floor. Five AI racers finish three laps with no recoveries; route separation, scenery ray scans, sweep snapshot replay and recovery checks pass. The complete suite passes **167/167**, plus lint and formatting. Clockwork lighting is rebaked and the README spiral image is refreshed; spiral and sweep driving-camera captures were inspected.

Sunstone: five AI three-lap finishes 199–203 s, zero wall hits; solar/alternate lines, scenery, bake and graphics focused checks pass. Clockwork: five AI finishes, three actual lift rides each; vertical frames, entrance recovery and snapshot/replay checked. Paper: five AI finishes 206–209 s, zero wall hits; crossing height and fan opening checked. Tempest: five AI finishes 223–227 s, zero wall hits; sheltered/exposed forces, shared-clock replicas, ocean bounds, all seven scene assemblies, verges, registry, bake hashes and audio/graphics: 18 focused tests pass. Lint passes. Latest broad run: **138/138 pass**, concurrency3, 106 s in this container; includes all twelve scene assemblies/assets/bakes, full AI laps, physics, snapshots/replay, multiplayer worker and input checks. Avoid repeating it without new cause.

Luna added README captures for Clockwork and Tempest; supplied closer Sunstone/Paper driving review frames retained. Software Chromium captures had no page/shader errors. Clockwork README frame is static at the courtyard rather than a full-motion spiral highlight; improve later through Luna. Offline bakes took Sunstone 16.6 s, Clockwork 10.7 s, Paper 9.2 s, Tempest 11.4 s; **these are not hardware FPS measurements**. Full laps from the driving camera, comprehensive multiplayer play, and main-menu touch/gamepad visual review remain partial. All twelve routes are now implemented; comprehensive human driving and multiplayer review remain outstanding.

Pocket Pantry: five AI three-lap races complete with zero wall hits and both scale transitions. Focused 16-test run had one failure (recovery reset size); fixed and both Pantry regressions pass. Other 15 checks passed, including all eight scenes, verges, lighting hashes, assets, replica/traversal checks and audio. Lint/format pass. Local bake 309,260 actual scene triangles, 512²/12 samples, six-height spill, 17.1 s offline. Luna README Pantry capture now includes the ingredient world and tiny kart after fixing the capture path.

Railstorm: 14 focused checks pass (all nine scenes/batching/assets/bakes, five AI races with three boardings/exits per driver and zero wall hits, moving-surface recovery/replication, verges and audio). Local bake 149,304 static triangles, 512²/12 samples, six-height spill, 16.9 s offline. Added synchronous test-only diagnostic transport and three tests to stop bounded capture frames being spent before queued seeks. Luna confirmed exact seek positions and captured actual Railstorm and Pantry frames. Railstorm now has an open-deck README frame; neighboring carriage partially obscures the view. Metronome capture is bundled. No main-agent browser captures.

Metronome: 12 focused checks pass, including shared beat/contact safe lane, five AI three-lap finishes 208–211 s with zero wall/mechanism hits, all ten scene assemblies/assets, verges and lighting hashes. Two further graphics/Metronome checks pass after enclosure lighting. Local 512²/12-sample six-height bake: 20.6 s. No page errors in Luna normal-camera capture.

`443491a`: Pelagic: 1,800 m marine conservatory expedition; continuous reef terraces, ribbed flooded domes, coral/kelp, animated fish schools and enormous translucent jellyfish, garden islands/attendants, bounded bubbles, glazed road/animated caustics, submerged fog and filtered audio. Shared medium state now correct immediately at spawn/seek/recovery and replicated. Eleven courses registered. 16 focused checks pass (five AI three-lap finishes, three immersion entries/exits each, zero wall hits, replicas/recovery, all eleven scenes/assets/bakes, verges, diagnostics and audio). Lint/format pass. Local bake 22.4 s. Luna actual underwater normal-camera capture has no page errors; foreground pillar partly obscures the kart, so later improve through Luna only.

`8abd204`: Emberwing: 1,851 m volcanic observatory, actual 58 m cannon arc over an omitted road, full-width launch throat, rotating slotted telescope domes, scholar village, orrery gardens, animated magma/crust, vents and bounded embers. Original cannon blast/lava rumble, bounded flight trail and presentation-only pitch; flight velocity now reflects actual travel. Shared snapshots agree through landing, recovery returns to launch lip and restart clears flight. Twelve courses registered. Fourteen focused gameplay/replica/diagnostics/audio checks pass, followed by the 138/138 repository run. Lint/format pass. Rebuilt local bake: 768²/12 samples, six-height spill/seven pools, 28.2 s offline. Luna README capture shows actual kart and enormous launch throat, no page errors. First bounded attempt timed out while tests contended; one fresh attempt succeeded. Removed duplicate static adventure rails that bypassed moving/gated route exclusions; moonlit courses now use night grading and Pelagic uses cool marine grading.

`068073e`: Menu polish: course stage uses bundled driving gallery images (Sunstone engine/Paper crossing mapping), illustrated fallback, twelve numbered choices and responsive four-/three-column navigation. Gamepad follows the visible grid and changes option sliders, UI actions have original click Foley, showroom respects motion settings. Screenshot-free browser DOM smoke at1280×800 and390×844: all twelve tiles; arrows move4/3 columns; character selection; gamepad master .50→.55 persists; actual touch taps choose Pelagic/Kiki; zero horizontal overflow or page errors. The real menu modules/CSS run; the game bootstrap is replaced to avoid any WebGL rendering. No screenshots or hardware/FPS claims. Lint/format pass.

Foley polish (`33bdfd2`): different original engine registers for the six drivers, fifteen tyre material profiles using the actual wheel-contact material, single charge cues per drift tier, cooldown-limited deceleration hiss, up to three nearby opponent engine sources with spatial falloff. Original courses now have authored valley wildlife/water/mill creaks, harbor cargo/ferry/water and alpine ice/wood sources. Transient noise panners disconnect correctly;24-voice ceiling retains bounded mixing. Nine focused audio/descriptor checks pass, including every course source, immersion, charge/braking cooldown and voice cleanup; changed-file lint/format pass. No music changes.

## Latest visual milestones

- `fd52e91`: Neon wet pavement, authored road reflection atlases and bounded Ultra live reflections; Sunstone carved masonry, temple dressing and regenerated lighting. Both README images refreshed.
- `8940ae7`: Sunstone flow/focus: four shared shader sandfalls replace waving flat curtains; three depth-tested cones join banked solar-engine cores to the actual moving boost pads, with soft receiving footprints. All animation follows the race clock and reuses fixed resources. No new lights or static-bake changes. Six Sunstone checks pass, including five AI races with zero wall hits and beam/pad endpoints after batching; all twelve scenes assemble with finite geometry. Screenshot-free Chromium GPU readback verifies three compiled shaders, visible motion, identical frozen frames and exact rewind. Changed-file lint and formatting pass.

## All twelve environmental pass (`e0c3b1c`)

This milestone follows the user's clarification that the emphasis is environment,
particularly all kinds of particles. Every course gains its own local weather,
emissions and surface motion: 81 fields, twelve analytic shapes, five motion
families, race-clock/reduced-motion behavior, density scaling and spatial culling.
Steam follows the actual kettle/kiosk; soap particles stay over the sink; train
exhaust follows the moving locomotive; sea and caldera emissions start at their
actual water/magma levels. New source anchors survive static batching. Six worlds
also gain original animated roadside stories, with whole-route motion-envelope
clearance. No course music or new downloaded assets. See `docs/environment-effects.md`
for the course-by-course changes and reproducible screenshot-free browser check.

Sixteen focused Node checks pass, including all twelve scenes, resources, source
attachment/culling, motion clearance and lighting/asset hashes. All twelve palette
and surface shader checks pass in Chromium with exact frozen/rewound GPU readback
and zero shader/page errors. All twelve lighting bakes are regenerated at their
existing resolutions/samples; each source hash matches the final exported scene.
Brief textured in-game checks in Neon, Sunstone, Pantry and Railstorm render with
zero page/shader errors. Lint and formatting pass. Existing README driving images
remained during this pass. Pulled main before work and pushed the milestone.

## Twelve-course README gallery refresh

At the user's request, a Luna subagent captured and inspected a new actual
driving-camera image for every course at 1280×720. Mid-route locations replace
the remaining starting-line views. Clockwork now shows gallery gears and layered
towers; Railstorm shows the freight boarding approach; Pelagic shows the reef,
fish and giant jellyfish without the previous foreground obstruction; Emberwing
shows the actual cannon flight over the caldera. All twelve capture seeks were
validated, with no browser errors reported. The README descriptions and capture
script record the selected views; the default viewport and per-course timeout
now match the successful capture workflow. Main inspected the saved images and
verified the gallery, without taking screenshots.

Verification: all twelve README image paths are unique and match registered
courses; every JPEG differs from its prior version, decodes successfully and
has the expected dimensions. Capture-script lint and formatting pass, as does
the whitespace check. Gameplay code is unchanged; no broad suite rerun.

## Exact next steps
1. Human driving-camera full laps and multiplayer visual assessment remain partial; the user will do deeper playtesting. Use those observations to target the next course refinement.
2. All twelve README images are refreshed. Future requested gallery captures remain delegated to Luna; main does not capture screenshots.
3. Avoid repeating broad suites without a new concern. The Clockwork milestone passed 167/167; this visual-only milestone uses the focused checks above. Device profiling remains necessary before expanding Ultra reflection cost.

- `da57f65`: Screenshot milestone: bundle Luna's actual Railstorm capture and corrected Pantry capture referenced by README. Synchronous test transport confirms kart and camera positions; no page errors.
