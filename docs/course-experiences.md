# Course experiences

The course idea drives the engine. These experiences use shared floors, route identity and race-clock mechanisms in single player and multiplayer.

| Course                | Experience                                                                                                                                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windmill Wilds        | A firefly boardwalk departs into a deep grove and rejoins beyond the woodland. Choosing either line commits the kart until the fork ends.                                                                                                                  |
| Neon Harbor           | An optional climb onto container roofs. Falling off returns to the wider cargo road below. Staying up reaches a concave quarterpipe with an open launch lip, a larger trick and a stronger landing boost.                                                  |
| Sunstone Ruins        | Moving sun and shadow rings through the temple engine, with a higher exit or an earlier return. Markings and grounded carrying share the same motion.                                                                                                      |
| Frostpeak Festival    | An open downhill snow face connects packed snow, a low-grip glacier chute, a trick ridge and powder. The uphill and cabin finale remain.                                                                                                                   |
| Clockwork Citadel     | Enter the movement of a giant watch. Take either banked half of the bowl around a central well of rotating gears, then rejoin the climb.                                                                                                                   |
| Paper Revel           | The changing stretch is a crease valley on lap one, a folded sky bridge on lap two, and a banked paper surf on lap three. Occupied forms remain visible while racers finish using them.                                                                    |
| Tempest Causeway      | The first exposed bridge heaves in wind-driven waves between anchored towers. Tap Space / Shift on a rising crest at speed for a higher trick jump and landing boost. Rain, wet grip, lightning and rolling thunder surround the crossing. |
| Pocket Pantry         | Its miniature kitchen adventure remains as designed.                                                                                                                                                                                                       |
| Railstorm Express     | Moving carriage roofs with curved ramps, turning spoked wheels, side panels, ladders and coupling hardware. Roof jumps retain the train's identity.                                                                                                        |
| Metronome Hall        | A small chain of differently voiced snare drums over an abyss. Each contact gives a substantial bounce toward the next head; aerial steering can change the landing, and missing a drum causes a fall.                                                     |
| Pelagic Glasshouse    | A lower lantern-eel grotto separates from the main reef, passes beneath the glasshouse rim, and rejoins. Its route choice stays committed until the exit.                                                                                                  |
| Emberwing Observatory | Eight island places: blue-dome village, cliff switchbacks, caldera cannon, telescope terraces, astronomers' gardens, obsidian vineyard, fishing harbor and lantern alley. The cannon follows a straight arc over the volcanic crater with a camera reveal. |

## Route and jump controls

Steer into a fork to choose a route. Its identity stays fixed through the section; recovery returns to that route, and shells use its floors and walls. The radar draws alternate ribbons and the current paper form, and kart markers use their actual positions.

Container and snow-ridge drops return to the lower surface. Other separate ribbons have their own boundaries. Quarterpipes give more airtime than ordinary road ramps; tap the drift button near takeoff for a larger trick and landing boost. On snare drums, use small steering corrections in the air to reach the next head.

## Implementation ownership

`courses/experiences/definitions.js` authors the new sections and ribbons. `track/route-branches.js` builds their frames, projection and gates. `simulation/experience-mechanics.js` supplies shared drum, storm, mountain, carrying and ramp queries. The course experience world consumes those same queries for surfaces and motion. Route and jump states are scalar snapshot fields, so authority and prediction retain the same choices.

The [authoring agreement](../src/courses/CONTRACT.md) describes these systems and remains open to new kinds of course design.
