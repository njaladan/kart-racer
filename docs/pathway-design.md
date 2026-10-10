# Environmental course edges

All twelve courses use section-specific environmental edges instead of a continuous racing cage. The central route still controls ordered checkpoints, AI lookahead and race distance. Driving surfaces extend into open shoulders where appropriate; exposed decks and ledges have genuine drops.

| Course | Pathway character |
| --- | --- |
| Windmill Wilds | Flower meadows, root and fern shoulders, orchard crops and hay; one ridge face and selected mill masonry; a timber crossing with an open water side. |
| Neon Harbor | Explorable pavements, market stalls, planters and cargo clusters; exposed quays and ferry deck; a parapet on one side of the bridge. |
| Sunstone Ruins | Palm groves, broad sand shoulders, column courts and dunes; local canyon/temple walls and open mesa ledges. |
| Frostpeak Festival | Powder shoulders, pine clusters and chalet courtyards; a glacier face; open carnival and downhill ledges. |
| Clockwork Citadel | Grounded foundry streets, open courtyards, supported masonry terraces and exposed brass machinery. The route rises between city levels, crosses a gently curved marked bowl, and returns through a banked descent and turbine sweep. |
| Paper Revel | Broad paper folds and lantern clusters; layered ribbon crossings and the unfolding fan have exposed edges. |
| Tempest Causeway | Boulder shelters, open bridge spans, sea drops and a breakwater rock face; suspension cables remain structural scenery. |
| Pocket Pantry | Crumbs, jars, biscuit clusters, soap and finite counter shoulders; pantry shelves and the basin have exposed lips. |
| Railstorm Express | Station cargo and gravel shoulders, a cliff chase, open moving freight decks and a tunnel rock face. |
| Metronome Hall | Ivory keys, gears and instrument-case shoulders; exposed music-box decks between the rhythm mechanisms. |
| Pelagic Glasshouse | Conservatory planters and reeds, coral clusters, reef shoulders and open underwater terraces. |
| Emberwing Observatory | Broken basalt, boulders, gear terraces, caldera drops and open descent ledges. |

## Driving and recovery

- **Soft shoulders** allow leaving and rejoining the main path. Terrain retains its rough-ground driving cost. Broken clusters have physical footprints and gaps, rather than an invisible wall connecting them.
- **Finite platforms** allow driving across their shoulder, then falling at the visible outer lip. Kitchen counters, instrument cases and folded paper do not create ramps down to the distant ground.
- **Open drops** remove ground support beyond the exposed edge. Falling does not earn lap checkpoints or trick boosts. Recovery returns to the last grounded position on the main route, centered and facing forward, with a short protection window.
- **Structural boundaries** retain physical contact only on authored wall sides. Shells reflect from these walls and environmental clusters; shells leaving a platform disappear.
- Straying far into open terrain for 1.4 seconds also recovers the kart, avoiding indefinitely driving away from the race. Falling normally recovers within approximately one second.

Recovery lives in the shared simulation. Server authority, local prediction, bots and single player use the same rules. Scalar fall state and recovery count survive snapshots; the recovery count prevents network reconciliation from visually dragging a rescued kart across a drop. Manual recovery uses the same placement and motion reset.

## Authoring

`src/courses/pathway-edges.js` defines each section's left/right environmental kinds. Course descriptors explicitly select their own plan; validation requires one known pair per section. Most boundary length on each course is open.

`src/track/pathway.js` owns edge profiles, floor support, finite platform widths and deterministic obstacle footprints. It accounts for the horizontal displacement caused by banking on steep grades. `src/rendering/pathway-edges.js` builds the corresponding broad shoulders, exposed faces, structural walls and clusters. Local world builders keep their landmarks and mechanisms, while their platform undersides follow the shared width query. Authored verges and shortcuts still widen the relevant surface, including time-gated and size-gated routes.

Automated checks cover open boundary coverage, shoulders, falls, ordered progress, recovery, shell behavior, snapshots, environmental contact, rendered support and all existing course races. Browser checks seek beyond an open edge on every course, confirm a visible fall and recovery, and collect JavaScript errors. Updated screenshots show the pathways; these preview captures use low graphics quality for software Chromium.
