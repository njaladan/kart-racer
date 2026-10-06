# Living course environments

All twelve courses receive local particle layers and animated surface response.
The palette follows each place: flour stays in the pantry, marine snow stays
underwater, and spray rises from the ocean. Shapes include petals, tumbling
leaves, snowflakes, streaks, soft smoke, hollow bubbles, sparks, confetti, ripples,
droplets, fireflies and fine motes. Existing racer trails, sky effects and
environmental audio continue alongside these additions.

| Course | New particle layers | Other environmental changes |
| --- | --- | --- |
| Windmill Wilds | Blossom petals, leaves, dandelion seeds, reedwater mist, orchard blossom, willow fireflies | Slowly moving canopy shade; working cider press and lavender apiary with winged bees |
| Neon Harbor | Rain in three districts, puddle rings, cooking steam, welding sparks, salt spray, ferry exhaust | Rain ripples perturb wet paving; articulated noodle-shop octopus and cargo crane; steam comes from the kiosk |
| Sunstone Ruins | Falling canyon grains, low dune gusts, temple dust, torch cinders, pollen, oasis ripples | Subtle moving sand variation; tipping amphora water clock and opening gold scarab; recent sandfall strands and solar focus remain |
| Frostpeak Festival | Two snow layers, powder gusts, ice crystals, chimney plumes, cold lake vapor | Sparse ice glints; swirling chalet snow globe and penguin sled circuit |
| Clockwork Citadel | Foundry filings, soot, shaft dust, pressure steam, turbine vapor, return sparks | Moving oil sheen; ticking pocket-watch repair stage and pneumatic message capsules |
| Paper Revel | Lantern motes, folded leaves, paper fragments, two confetti layers, pink valley haze | Moving lantern shade and paper fibers; opening pop-up books and folded pinwheel flowers |
| Tempest Causeway | Slanted rain and ocean breakers at each exposed span, sheltered puddle rings, sea mist | Rain-ring normal relief on wet stone; sea spray starts at ocean height |
| Pocket Pantry | Kettle steam, flour, sugar glints, soap bubbles, sink droplets, crumbs, toast wisps | Gentle window-light movement on kitchen surfaces; steam attaches to the kettle and bubbles/droplets to the actual sink |
| Railstorm Express | Boiler steam, coal smoke, grinding sparks, gravel dust, gorge mist, tunnel dust, station rain rings | Dew glints; exhaust follows the moving locomotive and replaces its old spherical smoke puffs |
| Metronome Hall | Sawdust, brass glints, shaft dust, rosin, mechanism haze, gilded flecks | A subtle brass reflection sweep follows the shared two-second mechanical beat |
| Pelagic Glasshouse | Three bubble layers, marine snow, bioluminescent plankton, current ribbons, garden pollen | Additional moving caustic variation complements existing underwater lighting |
| Emberwing Observatory | Caldera embers, vent cinders, ash, fumaroles, shooting-star streaks, village glow motes, fine ash | Soft warm surface shimmer; caldera emissions start at the magma surface and rise toward the racing terraces |

## Rendering and motion

The 81 fields use static instance buffers and analytic shader motion. Each field
draws camera-facing quads in a single pass; ripple quads follow the receiving
surface frame. Lifetime fades soften spawning and disappearing particles.
Near-camera fading keeps the kart readable. Regional bounds, distance culling
and fog limit distant effects. Additive particles fade toward black in fog,
preventing the fog itself from becoming a glowing layer.

Performance/Balanced/High/Ultra use 45%/65%/85%/100% of the new particle capacity.
The largest palette is Tempest at 845 instances on Ultra and 383 on Performance;
these counts cover the new fields, with existing weather and racer pools bounded
separately. Quality changes reuse the same buffers. The existing adaptive
controller drives the same density controls. Disabling motion freezes the new
layers and supporting animations at their initial race-clock frame. Pausing and
restarting use the shared race time.

Source anchors survive static batching. Attached fields follow the locomotive,
kettle, basin and kiosk transforms, and their camera bounds follow those sources.
All new supporting machinery reserves its entire motion envelope against every
route floor. Static portions are regionally batched and appear in the lighting
bakes; moving assemblies and transparent effects are excluded from the bake.
All twelve lighting bakes were regenerated at their existing resolutions and
sample counts, and their source hashes match the final exported scenes.

## Verification

- Sixteen focused Node checks cover all twelve scene assemblies, finite geometry,
  asset and lighting hashes, bounded particle resources, quality scaling, clocks,
  source attachment, moving-source culling and animated scenery clearance.
- `node tools/check-environment-effects.mjs` performs screenshot-free Chromium
  shader compilation and GPU pixel readback for all twelve palettes and surface
  profiles. Motion changes the output; frozen frames and rewind reproduce it
  exactly. All profiles pass with zero shader/page errors.
- ESLint and repository JavaScript/CSS formatting pass.
- Brief frozen driving-camera checks in the actual Neon, Sunstone, Pantry and
  Railstorm games load the textured worlds and render without page/shader errors.

The palette shader check uses isolated environments and synthetic receiving
surfaces. It verifies rendering behavior; full driving-camera laps and
representative player-device profiling remain separate checks.
