# Turbo Trail — adventure racer continuity

## Vision
Twelve authored journeys with readable racing surfaces, powerful silhouettes, purposeful motion and distinct playable mechanics. Sunstone is the first complete milestone. No course music changes. Main agent works alone. User requests focused checks and brief browser inspection, then implementation.

## Creative matrix
| Course | World / progression | Signature | Route / choice |
|---|---|---|---|
| Windmill Wilds | Harvest valley, woodland, working mill | Rural banked ridge and willow maze (existing) | Existing eight-place adventure |
| Neon Harbor | Port Lumen waterfront, market, warehouse | Cargo conveyors and ferry district (existing) | Working port loop |
| Sunstone Ruins | Oasis, canyon, mesa, buried temple, courtyard, dunes | Solar engine gates with safe shadow lane | Rebuilt expedition, sand cut, temple apron |
| Frostpeak Festival | Alpine village and ski festival | Ice and powder (existing) | Mountain road |
| Clockwork Citadel | Furnace yard, spiral tower, clock face, rooftop | Rideable vertical lift | Stacked spiral and descent |
| Pocket Pantry | Breakfast table, jar portal, pantry shelves, sink | Shrinking and growing through scale portals | Giant utensils and narrow crumb passage |
| Railstorm Express | Railway yard, cargo wagons, mountain viaduct | Moving train deck | Boarding, cargo run, disembark |
| Paper Revel | Lantern festival, folded valley, paper pagoda | Unfolding paper route | Sharp visual zigzags and layered crossing |
| Tempest Causeway | Storm coast, lighthouse shelter, exposed sea bridges | Wind and wave choreography | Long exposed bridges between shelters |
| Metronome Hall | Music-box workshop, pendulum hall, bell tower | Beat-synchronised obstacle timing | Rhythm lanes; no music added |
| Pelagic Glasshouse | Coastal conservatory, flooded dome, reef garden | Underwater buoyant driving | Descending glass tunnels, reef rise |
| Emberwing Observatory | Volcanic observatory, telescope terraces, caldera | Cannon transit | Launch across caldera with guided landing |

## Architecture / sources
Native ES modules, bundled Three.js, Node authoritative multiplayer worker, shared fixed-step physics. Extend existing course contract where requested topology needs it; old contract prohibitions are superseded by user's goal. Ordered checkpoints remain authoritative. Decorative animation stays outside physics. Prefer analytic race-clock mechanics so client/server agree. Reuse already bundled credited assets; new procedural geometry and synthesized non-musical sound are original project assets. Record any additional external sources here.

## Milestones
- Baseline e289bad: clean working tree, branch `work`; created `main` at same revision as requested. No AGENTS.md present. Dependencies installed with npm ci.

## Current / remaining
Start with elevation-aware route identity, smooth road foundation and full Sunstone rebuild. Then selection/options, audio and animation infrastructure, then eight distinct courses. Existing courses receive shared polish. Nothing claimed complete until verified.

## Verification / defects
Baseline not rerun yet. Chromium and Playwright available. Use focused simulation/regression checks and a few normal-camera screenshots. Headless rendering cannot establish hardware performance.

## Exact next steps
1. Implement elevation-aware projection, preserving local route continuity and using height on global lookup; regression at stacked crossing.
2. Rebuild Sunstone descriptor and scenery around the progression above; solar-engine gameplay, shortcuts, full-lap AI check and camera inspection.
3. Commit each coherent milestone and replace this section with exact continuation steps.

### Foundation + Sunstone work
- 9e144d4: route floor disambiguation and vision/matrix committed.
- Rebuilt Sunstone: 1,803 m; minimum horizontal radius 20.3 m; eight places; 67 m elevation range. Five isolated AI three-lap races finish in 199–203 seconds with zero wall impacts. Solar boost lanes use one analytic clock in simulation/rendering.
- Camera check caught two real issues: base ground plane occluded the buried road, and color-map multiplication muddied architecture. Lowered Sunstone's base terrain to -18 m and switched monumental stone to bump-only textures with authored colors. Old Sunstone bake intentionally disabled because its geometry is obsolete.
- Existing baseline had one formatting discrepancy in Windmill terrain; normalized it. Full test run underway; this is a formatting-only change.
- b1a7b81: Sunstone expedition committed. Focused Sunstone/terrain checks pass. Initial full run: 110/111; corrected the test's elevation measurement to sample the complete route (its old midpoint-only check missed the crest); focused rerun passes. Local projection deliberately remains horizontal to preserve ramp-hop behavior; global relocation uses elevation.

### Menu / sound / motion milestone
Course and garage tabs replace dropdowns. Original vector postcards are generated locally by tools/create-course-previews.mjs. Real STK karts animate on an isolated showroom plinth; selection reload occurs only on Race. Keyboard focus, touch cards, D-pad/stick browsing. Graphics ceiling, adaptive quality, bloom, motion and three audio volumes persist in localStorage. Original synthesized noise Foley adds filtered world air, mechanical sounds with distance falloff/pan, tire noise, impacts/landings, and engine-load variation. Three visual trick silhouettes (spin, roll, flip), reactive braking pitch and stronger driver lean; no authoritative movement changes. Existing audio/frame-loop/trick/session tests: 14 pass. Menu browser smoke underway at Performance tier; no hardware performance claims.
- 1a07386: animated selection/options, synthesized Foley and expressive tricks committed. Preferences regression passes. A brief menu screenshot attempt timed out in software Chromium; menu visual/touch verification remains pending. Updated Sunstone camera captures show the corrected continuous buried floor and clean warm palette.
- Remote sync requested: merge origin/main at 85f59f2 (Frostpeak eight-place rebuild, winter life, Windmill waterfall removal and support fixes). Resolved terrain/runtime/registry conflicts by combining course edge styles and retaining remote support offsets with clearance beneath raised bridge hops. Focused registry/Frostpeak/Sunstone checks: 8 pass. User now requests a push after every commit.
