# Adventure course authoring

The course idea determines the topology. This replaces the former ground-loop contract. Do not reduce an idea to fit the old engine. Extend the shared simulation/render queries when a new world needs a new kind of traversal.

## Runtime agreement

Descriptors carry world controls, ordered place boundaries, palette, surfaces and scenery. `topology: "adventure"` removes the old six-to-eight-place and hard curvature ceiling. Curvature is measured for tuning, not used to veto new topology. Intentional flight, lifts, stacked crossings, narrow miniature passages and unfolding extra routes are valid.

All gameplay must run in shared fixed-step simulation used by authoritative workers and prediction. Scenery consumes the same race clock and analytic mechanism functions. A visual transform must never quietly invent collision or progress rules. Current mechanisms live in `simulation/course-mechanics.js`.

Route progress remains signed and checkpoints ordered. Local projection keeps route continuity; global lookup uses elevation to distinguish floors. Special traversal states use scalar fields that survive network snapshots. Lifts wait for their shared cycle, carry karts across elevation, and rejoin with exit velocity. Cannon flights have authored duration/arc/landing. Recovery returns to their entrance. Branches carry explicit route identity, entry/rejoin gates and a recovery frame. A chosen path stays committed until its rejoin gate; authored rooftop drops can return to the lower route without unlocking another branch.

## Course experiences

Separate spline ribbons can depart from and rejoin the main route. Their distance maps to the same ordered checkpoints, while steering, floors, banking, recovery and shells use the selected ribbon. Required choices can replace a stretch entirely. Lap-specific paper routes remain available to racers who already occupy them even while another racer reaches the next form.

Moving temple rings carry grounded karts and show the same motion in their surface markings. Freight roofs use carriage coordinates for travelling curved ramps. Quarterpipes have a concave launch face and an open lip, higher airtime, a larger trick and a slightly stronger landing boost. Rooftops and the broad snow descent can have a supported lower surface after leaving an upper ribbon.

Snare drums provide discrete circular floors over a gap. Contact launches the kart toward the next head, with aerial steering and a different voice for each drum; missing a head causes a fall. Storms share an analytic lightning/thunder cycle and bridge roll across authority and rendering. Bridge wind waves share analytic height, slope and vertical velocity, pin their tower anchors, carry grounded karts and allow a fresh trick tap on a rising crest to launch with upward deck momentum. Straight cannon arcs and a flight camera reveal can expose a caldera beneath the kart.

These are current tools for expressing the course idea, not a closed list of allowed designs. Change this document and extend the engine when the next idea needs it.

## Surface and visual ownership

Track queries define driving height, edges, surface grip, scales, currents and expanded routes. Road construction consumes these queries; special transit spans omit the ground ribbon. Base terrain heights are per world so a buried or submerged road cannot be occluded by a universal plane. Smooth transitions and readable lines are product requirements, not restrictions on world ideas.

Course scenery receives the shared kit and owns its composition. Register every animated assembly in `animated`; static geometry is spatially batched/instanced. Imported assets need clear compatible licenses and local copies. Baked lighting must match the final geometry. No course music is authored by this task.

## Creative standard

The existing countryside, Port Lumen and winter festival are the minimum visual bar. Sparse box walls, repeated prop rows and isolated islands of scenery are intermediate scaffolding. Complete worlds need foreground/middle/background compositions, tactile surfaces, unique light, convincing shadows, authored motion, environmental audio and memorable section transitions. A course count does not establish completion.

## Verification

Use focused regression for new authoritative systems, full AI laps, representative snapshot/replay and recovery checks. Brief normal-camera checks catch clearance, lighting and composition problems; detailed human playtests follow. Record what was actually checked. Software/headless rendering is not representative hardware profiling.
