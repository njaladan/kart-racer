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
| Clockwork Citadel | Foundry, stacked spiral, clock-face balcony, rooftop | Actual 74 m vertical lift | Registered, verified milestone |
| Paper Revel | Origami valley, layered crossing, pagodas, lantern festival | Unfolding driveable fan apron | Registered, verified milestone |
| Tempest Causeway | Three exposed sea spans alternating lighthouse shelter | Storm bridge choreography and wind forces | Registered, verified milestone |
| Pocket Pantry | Breakfast, shrinking jar, towering shelves, cutlery, sink, toast rack | Meaningful scale transformation / low biscuit passage | Registered, verified milestone |
| Railstorm Express | Rail yard, moving cargo train, mountain viaduct | Boarding and racing on moving transportation | Descriptor/scaffold; moving transport physics still needed |
| Metronome Hall | Music-box workshop, pendulum hall, bell tower | Shared-beat physical hazards | Descriptor only; no music |
| Pelagic Glasshouse | Conservatory, flooded domes, reef gardens | Underwater driving | Descriptor only |
| Emberwing Observatory | Telescope terraces, volcanic caldera | Cannon transit | Descriptor only |

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

- Moving-surface foundation (this commit): race-clock suspension height in pose/projection, continuous route-relative carrying, serialized carriage identity/coordinate, dynamic-panel layout and stable docks; AI accounts for carried velocity. Static road/rails omitted from moving spans. Three new neutral-riding, seam/dock and recovery tests pass; snapshot replicas agree exactly. Broader topology/traversal/Pantry checks passed (one negative-zero equality in a new dock assertion was corrected).

## Verification and known limitations
Sunstone: five AI three-lap finishes 199–203 s, zero wall hits; solar/alternate lines, scenery, bake and graphics focused checks pass. Clockwork: five AI finishes, three actual lift rides each; vertical frames, entrance recovery and snapshot/replay checked. Paper: five AI finishes 206–209 s, zero wall hits; crossing height and fan opening checked. Tempest: five AI finishes 223–227 s, zero wall hits; sheltered/exposed forces, shared-clock replicas, ocean bounds, all seven scene assemblies, verges, registry, bake hashes and audio/graphics: 18 focused tests pass. Lint passes. Last broad run was 117/119; both failures were corrected and affected suites now pass. Avoid repeated broad runs without new cause.

Luna added README captures for Clockwork and Tempest; supplied closer Sunstone/Paper driving review frames retained. Software Chromium captures had no page/shader errors. Clockwork README frame is static at the courtyard rather than a full-motion spiral highlight; improve later through Luna. Offline bakes took Sunstone 16.6 s, Clockwork 10.7 s, Paper 9.2 s, Tempest 11.4 s; **these are not hardware FPS measurements**. Full laps from the driving camera, comprehensive multiplayer play, and main-menu touch/gamepad visual review remain partial. Do not claim twelve complete courses.

Pocket Pantry: five AI three-lap races complete with zero wall hits and both scale transitions. Focused 16-test run had one failure (recovery reset size); fixed and both Pantry regressions pass. Other 15 checks passed, including all eight scenes, verges, lighting hashes, assets, replica/traversal checks and audio. Lint/format pass. Local bake 309,260 actual scene triangles, 512²/12 samples, six-height spill, 17.1 s offline. Luna README Pantry capture includes the ingredient world but the local kart is poorly framed; one bounded capture-path diagnosis is underway.

## Exact next steps
1. Finish moving-deck integration for Railstorm. Moving-surface foundation is implemented; rebuilt train-world code and descriptor remain unregistered: shared-clock suspension height, carried movement, carriage coordinate/identity, clipped moving panels with covered docks. Shared integration and neutral riding/recovery/snapshot checks are done. Five preliminary full AI races finish 193–196 s with zero wall hits and three boardings each. Compose the complete mountain/train/station world, bake/preview, then Luna screenshot, commit and push.
2. Improve Pantry README framing through Luna if the narrow capture-path fix succeeds; do not spend main-agent browser time on this. Keep enriching driving compositions when useful.
3. Complete Metronome timed hazards/world, Pelagic underwater world and Emberwing caldera/cannon world individually, reaching twelve. Finish local pack metadata, preview, lighting, focused gameplay checks, Luna README capture and commit/push for each.
4. Continue shared graphics/sound/animation polish and refine Sunstone. Brief menu keyboard/touch/gamepad smoke; final bounded repository checks. Preserve unfinished scaffolds without committing them as complete courses.
