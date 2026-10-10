# Course background review

Background compositions supplement the existing worlds. They use spatially
batched shared geometry, do not cast additional shadows, and reserve complete
structure and motion bounds against the main route, alternate paths and camera
corridor. Motion follows the race clock and respects the motion setting.

| Course                | Added distant compositions                                                        |
| --------------------- | --------------------------------------------------------------------------------- |
| Windmill Wilds        | Patchwork farms, working windmills, wooded ridges and circling birds              |
| Neon Harbor           | Layered skyline, container quays, cranes and moving cargo ships                   |
| Frostpeak Festival    | Mountain villages, snowy fir stands and moving ski lifts                          |
| Clockwork Citadel     | Brass districts, clock towers, skybridges and passenger airships                  |
| Paper Revel           | Folded mountain villages, pagodas, lantern groves and crane flocks                |
| Tempest Causeway      | Offshore lighthouse refuges, sea stacks and fishing fleets                        |
| Pocket Pantry         | Kitchen cabinets, appliances, utensils, stocked shelves and garden windows        |
| Railstorm Express     | Forested station villages and moving freight on valley trestles                   |
| Metronome Hall        | Concert balconies, velvet bays, chandeliers, organ pipes and instrument galleries |
| Pelagic Glasshouse    | Reef shelves, kelp forests, fish schools, sunken arches and island glasshouses    |
| Emberwing Observatory | Volcanic island villages, blue domes, research terraces and fishing boats         |

Each new course composition has sites on both sides of every section. Placement
checks the actual assembly bounds, including padding for animation, against all
driving floors. Static background materials opt into larger spatial batching
cells; existing roadside detail keeps its previous cells. Background motion
assemblies batch their nested parts in local space.

The existing course scenery retains its 1,800 draw-object budget. The additional
shadowless backgrounds have a separate limit of 220 draw objects per course;
this is a total scene-object check, not a per-frame draw count. The isolated
browser review observed at most 68 draws in any sampled new-background view.
It does not represent hardware frame-rate profiling.

## Sunstone Ruins — retain the existing desert

Sunstone already meets the intended background standard: continuous wind-shaped
terrain extends well beyond the course, with weathered arches, temple ruins and
village clusters. Its world-anchored animated mirage applies to the distant
backdrop while the course stays sharp. Retain the recently authored yellow sand
palette, natural dune profile and open desert vistas; additional repeated prop
rows would crowd this composition.

Verification: the desert horizon and mirage regressions cover terrain seams,
driving/camera clearance, finite geometry and distant heat distortion. The
background pass adds no replacement desert scenery or lighting changes.

## Review and verification

Run the project checks with `npm run check`. The background regressions cover
all twelve courses, section coverage, route/camera clearance, finite geometry,
bounded motion, the motion setting, and scene budgets. The full-scene regression
assembles each course with its real bundled geometry.

For a browser review, start the static server and run the review tool from a
second terminal:

```sh
python3 -m http.server 5180 --bind 127.0.0.1
```

```sh
node tools/check-course-backgrounds.mjs
```

The tool compiles and renders the background layers for all courses, sampling
127 composition, driving-camera and alternate-route views. It saves four
captures per course and a WebGL report to `/tmp/course-background-review`.
Set `BACKGROUND_REVIEW_URL`, `BACKGROUND_REVIEW_OUTPUT`, `PLAYWRIGHT_MODULE` or
`CHROMIUM_PATH` to use a different server, output path or browser installation.
These captures isolate the background geometry from the rest of the course;
they show untextured material palettes and are not gameplay screenshots.

Normal-camera gameplay captures were also inspected. Frostpeak's full-scene
capture was black in the software browser with and without the new backgrounds,
at both Balanced and Performance quality; its isolated background review passed.
Pelagic's existing glass-edge shader had a duplicate varying and read the normal
before it was declared. The review repairs that patch to use Three's existing
view varying and apply its tint after normal-map evaluation.
The repaired authored glass material compiled and rendered without shader or
WebGL errors in a focused browser check. Pelagic's full Performance-quality
gameplay capture also completed without shader errors, but remained very dark
in the software browser; that capture does not establish its final lighting quality.
