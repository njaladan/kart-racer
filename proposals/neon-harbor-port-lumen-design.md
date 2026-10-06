# Neon Harbor: Port Lumen

Detailed course design and implementation handoff, October 5, 2026.

This document is the intended design for a substantial revision of Neon Harbor. It is written for a separate Luna agent to implement without needing the brainstorming conversation. Dimensions, positions, speeds, and section fractions are initial authoring values. They describe the intended experience and can change when the geometry or existing engine makes another arrangement more useful. They are not measurements of an implemented course.

## 1. Direction and decisions

Keep the course name **Neon Harbor**. Name its city **Port Lumen**. The setting is a colorful cyberpunk coastal city at night, wrapped around a working harbor. Its identity comes from streets, architecture, transport infrastructure, ships, and cargo machinery.

The city should feel inhabited through evidence of activity: stocked shops, parked vehicles, lit apartments, working freight equipment, moving traffic, illuminated transit, and boats. Environmental storytelling supplies personality without designing inhabitants.

The user's decisions are authoritative:

- Use six to eight distinct sections, with two to four recognizable elements in each. This brief chooses eight sections and four principal elements per section.
- Keep tight turns in a downtown district with buildings on **both sides** of the road.
- Include a suspension bridge shared with moving cars.
- Include the bridge expansion-joint hop.
- A large ship passes beneath the bridge **only on the player's second lap**.
- The cargo conveyor is **mandatory** and must have a gameplay effect.
- Include waterfront driving with boats beside the course.
- Include a neon **WELCOME TO PORT LUMEN** sign.
- Make the scenery entirely environmental. Remove pedestrians, passengers, humans, robots, animated cooks, valets, spectators, and character mascots from the course environment. Existing playable racers remain the game's racers; this request concerns scenery.
- Use a small number of large, readable environmental animations. Character rigs, small gestures, crowds, flocks, and animated decorative clutter are outside this design.
- Use inexpensive stylized water. Breaking waves, elaborate spray, water simulation, and underwater driving are unnecessary.
- Music is being made separately and has no requirements in this document.
- This is a design and implementation brain dump. It introduces no testing plan or mandatory testing work.

The earlier `proposals/neon-harbor.md` and `src/courses/CONTRACT.md` describe the existing six-section course and older content restrictions. For this revision, the eight-section design, traffic, mandatory conveyor, welcome sign, and additional environmental details supersede the old Neon Harbor content limits. Previous route measurements describe the old layout. Shared engine behavior should be extended deliberately where this design needs it.

## 2. The experience to build

The race begins beside the water, compresses into downtown, threads through a market, then climbs onto a suspension bridge. The bridge reveals the city's working harbor. The road descends into cargo infrastructure, carries every racer across a powered conveyor, passes through a docked vehicle ferry, and returns along a seawall into the finish boulevard.

The three strongest memories should be:

1. **Weaving through bridge traffic, then hopping an expansion joint with the harbor below.**
2. **Feeling the mandatory cargo conveyor carry the kart forward.**
3. **Entering the open mouth of a ferry and racing through its vehicle deck.**

The ship passing under the bridge on lap two is the large, one-time spectacle. The welcome sign, downtown tower, bridge towers, cranes, ferry silhouette, and lighthouse are the navigation landmarks.

The driving rhythm is open drift, linked street bends, market weave, bridge speed, industrial timing, enclosed ferry passage, coastal sweep, and final drift. The course should give players both recognizable repetition and changing traffic situations on successive laps.

Environmental richness should operate at three distances. Close details explain the road and choices. Mid-distance objects identify the district. Large distant landmarks connect the whole city geographically. Keep the immediate driving surface and upcoming apex easy to read; fill its surroundings with purposeful shapes and materials.

## 3. World layout and route shape

### 3.1 Geography

Arrange one navigable inlet in the middle of the course. The mainland city occupies the north and west. An industrial peninsula or island occupies the southeast. The suspension bridge crosses a shipping channel on the east side. A lower seawall causeway makes the return connection along the south and west.

The route has one continuous centerline, three laps, continuous ground, and ordinary kart handling. Avoid disconnected branches and actual gaps. A ship interior is architecture around the continuous racing surface. Small ramps remain bounded hops.

Use the same landmarks across different views:

- The suspension bridge is visible from the opening promenade and between downtown buildings.
- The market's warm canopy is visible from the bridge approach.
- From the bridge crest, see container stacks, cranes, the docked race ferry, the lighthouse, and the skyline across the inlet.
- From the cargo yard, the bridge should appear behind or above the previous route.
- After the ferry, see downtown across the water and the finish boulevard ahead.
- From the finish, see the bridge and moored boats again.

### 3.2 Conceptual overhead plan

```text
                           MAINLAND CITY / NORTH

       [START/FINISH]
             |          WELCOME TO PORT LUMEN
             +-- 1 Promenade --> 2 Downtown --> 3 Night Market
             ^                                      |
             |                                      v
       8 Boulevard                         4 Suspension bridge
             ^                             over shipping channel
             |                 INLET                |
             |                                      v
       7 Seawall <----- 6 Docked ferry <----- 5 Cargo terminal
          causeway                         INDUSTRIAL ISLAND

                Lighthouse near the return causeway
```

This is a relationship diagram, not a surveyed map. A peninsula is acceptable if making an island requires excessive terrain work. The bridge must still visibly cross water.

### 3.3 Initial section budgets

Aim initially for approximately **1,900 m**, with room to compress or expand the whole arrangement. A roughly 70–85 second lap is a reasonable design allowance for eight districts and current kart speeds; it is not a performance claim or a hard tuning gate. Preserve the section rhythm if distance changes.

Widths below are **full road widths**; the descriptor uses `halfWidth`, which is half of the listed value. Extra verges are separate from the normal road.

| Section | ID | Initial length | Cumulative distance | Full road width | Road elevation, relative to common world origin | Driving shape |
| --- | --- | ---: | ---: | ---: | --- | --- |
| 1 | `promenade` | 220 m | 0–220 m | 20 m | About 2 m | Broad curve and readable downtown approach |
| 2 | `downtown` | 240 m | 220–460 m | 15–16 m | About 2–6 m | Left-right-left linked bends between façades |
| 3 | `market` | 190 m | 460–650 m | 15–17 m | About 6 m | Offset bends, then widening bridge approach |
| 4 | `bridge` | 330 m | 650–980 m | 22 m | Climb from 6 m to roughly 28 m; descend toward 4 m | Long bridge alignment with an exposed crest |
| 5 | `cargo` | 230 m | 980–1,210 m | 18–20 m | About 3–4 m | Container bend, straight conveyor, open crossing yard |
| 6 | `ferry` | 170 m | 1,210–1,380 m | 18–20 m | About 3–4 m, aligned with fixed ferry deck | Loading transition and one gentle interior bend |
| 7 | `seawall` | 280 m | 1,380–1,660 m | 19–20 m | About 3 m | Long coastal sweep and rough inside cut |
| 8 | `boulevard` | 240 m | 1,660–1,900 m | 22 m | Settle to about 2 m at the lap seam | Sustained finish corner and opening straight |

The ferry interior should occupy approximately 90–115 m of its section. The bridge's high span should include a useful 150–190 m region for traffic, between broad approach and descent transitions. Adjust approach lengths if the initial climb feels visually abrupt.

### 3.4 Rough placement anchors

Use X/Z for the plan and Y for elevation. Treat negative Z as north for this sketch. Rotate or translate the entire course as needed. Values are meters and describe district placement, not ready-to-paste spline controls.

| Anchor | Approximate `[x, y, z]` | Authoring intent |
| --- | --- | --- |
| Start line | `[-210, 2, -170]` | Face broadly east along promenade |
| Downtown entrance | `[-40, 2, -205]` | Welcome gantry before linked city bends |
| Downtown exit | `[115, 6, -215]` | Turn southeast into market |
| Market exit / bridge approach | `[215, 6, -115]` | Reveal bridge towers and open the view |
| Bridge high span | `[245, 28, 15]` | Water channel below; road broadly north–south |
| Bridge exit | `[250, 4, 135]` | Enter industrial island |
| Cargo exit | `[145, 3.5, 225]` | Prepare westward approach to ferry |
| Ferry exit | `[5, 3.5, 240]` | Open view toward city and lighthouse |
| Seawall exit | `[-225, 3, 65]` | Turn north into returning boulevard |
| Boulevard rejoins start | `[-210, 2, -170]` | Match position, tangent, width, and elevation at lap seam |

Author more points between these anchors. Downtown needs deliberate, rounded left-right-left bends rather than a straight interpolation. The bridge needs enough points to separate approach grade, high span, and descent. Keep the docked ferry portion nearly straight with a shallow interior curve.

The current builder rescales authored control-point X/Z coordinates toward `targetLength` while preserving Y. Treat these anchors as proportions for the route, then place scenery from the constructed track frames. Do not hardcode the welcome sign, piers, ship channel, or ferry shell at the unscaled sketch coordinates. Derive the channel's actual center and heading from the finished bridge span, and the ferry shell from the finished deck span.

The current track builder requires a minimum horizontal curve radius of 40 m. Start downtown bends around 45–65 m and wide waterfront bends around 80–140 m. The impression of tight streets should also come from the 15–16 m road, nearby façades, offset sightlines, and repeated turn reversals. Useful technical driving does not require tiny alley-sized hairpins.

Keep neighboring route arms separated enough that a player's position has an obvious nearest road. The ferry shortcut and downtown service alley should be nearby lateral extensions of their own course segment, with the same forward progression.

## 4. The eight sections

Fractions in this section are local to the named district. They are initial placement guidance. The section itself should stay recognizable even if its internal fractions move.

### 4.1 Harbor Promenade

**Look and feel.** Midnight blue water on the inlet side; apartments, cafés, palms, utility cabinets, railings, and mooring infrastructure on the city side. The distant bridge is the main skyline shape. Water reflects cyan and warm window tones. A broad street lets the opening pack spread out.

**Principal element A: opening waterfront drift.** Use roughly the first 65% of the section for a large continuous curve. Place a full item row around 25–30%, after racers have room to leave the grid. The inside is the short line; the outside has more room for passing. Avoid a moving obstacle immediately in front of the starting pack.

**Principal element B: parallel water taxi.** One empty, enclosed water taxi moves in a separate water lane about 20–35 m beyond the waterside road edge. Its body has a low hull, black or frosted cabin windows, navigation lights, and a large simple roof panel. Use rigid translation along a short harbor curve. No passengers, driver, propeller animation, or detailed wake simulation. It should stay beside the promenade long enough to register as a moving neighbor. A simple painted V-shaped wake may accompany the boat as one assembly.

**Principal element C: maintenance-ramp line.** Place a shallow optional hop around 65–75%, occupying about 3.5–4 m of the outside lane. Starting shape: 10–14 m total ramp length and a 0.5–0.7 m crest. The normal route stays smooth beside it. Give the landing roughly 25–35 m of recovery before the first downtown bend. This line offers a trick and a different corner setup, not an enormous shortcut.

**Principal element D: city welcome gantry.** Around 90–95%, frame the downtown entrance with **WELCOME TO PORT LUMEN**. Use two lines of text: small `WELCOME TO`, large `PORT LUMEN`. Cyan main lettering, a thin magenta outline or accent, and warm support lamps. Starting dimensions: about 26–30 m wide and 5–6 m tall, with the bottom of the sign at least 14 m above the road. Supports sit outside the complete road and shoulder footprint. The sign is readable during approach and visibly belongs to city infrastructure.

**Supporting static detail.** Seawall joints, ladders down to water, bollards, empty benches, a few planters, utility covers, drains, parked bikes if an existing mesh is convenient, and closed café umbrellas. Buildings should show storefront recesses and varied window patterns. Replace the proposed holographic crab mascot with the welcome sign; no mascot is needed.

**Transition.** Buildings become taller and occupy both sides. Preserve a clear view of the first downtown corner under the sign.

### 4.2 Downtown Switchbacks

**Look and feel.** This is an actual street canyon. Place close buildings continuously on **both sides**, with a second layer of taller structures behind them. The district has three linked bends and a slight climb. Use cyan transit signage, pink commercial signs, warm windows, and dark steel utility structures.

**Principal element A: left-right-left street sequence.** Put the first bend around 15–30%, the reversal around 40–60%, and the final bend around 70–85%. Round their geometry. Link their views with three distinct environmental landmarks: a vertical noodle-shop sign, a glass-fronted transit entrance, and a large rooftop utility tower. Road arrows identify the next direction. Do not hide an apex behind a giant advertising panel.

**Principal element B: rough service-alley cut.** On the inside of one sustained bend, open a 4–5 m extra ground patch for roughly 25–40 m. Mark it with delivery paving, drains, static pallet stacks beyond its edges, and painted service arrows. A mushroom or equivalent boost overcomes its off-road cost. The player must see its entry and exit. Rejoin before the next turn reversal. Prefer an inside-right bend so the existing shortcut support can be reused.

**Principal element C: overhead transit train.** Above roughly 45–65%, run an elevated guideway across the city canyon. A single rigid group of two or three stylized carriages passes across the view at intervals, around 8–12 m/s on a 100–140 m scenic path. Hide the reset behind buildings at its ends. The train never touches the race road. Windows are opaque luminous rectangles. Keep wheels, doors, and onboard passengers absent from animation.

**Principal element D: Lumen Tower landmark.** One 65–90 m tower with a distinctive illuminated crown anchors the final downtown bend. Show its upper portion from the promenade, its base or sign from downtown, and its silhouette across the harbor later. It may be assembled from an imported skyscraper with an original crown. Keep the crown's light pattern static.

**Supporting static detail.** AC units, pipes, cornices, balconies without inhabitants, fire escapes where meshes are available, shop shutters, vending machines, bundled cables, drainage channels, painted parking bays, and recessed entrance doors. Favor five or six façade families repeated with different heights and accents. Ground-floor details should be human-scale even though the racing street is generously scaled.

**Environmental joke.** An oversized commercial sign advertises `INSTANT PARKING` above a completely full bay of empty delivery vehicles. Another static sign reads `24 HOUR DAYLIGHT` beside a closed lighting shop. No robot valet or character interaction.

**Transition.** The final turn reveals warmer market lighting, shorter rooflines, and the bridge towers above them. Give players a short recovery stretch before the market weave.

### 4.3 Night Market

**Look and feel.** A permanent waterfront market with stocked, unattended stalls and covered storefronts. Warm amber lanterns and striped awnings create an identifiable district within Port Lumen. Pink and cyan shop signs remain, but the stalls carry the warm palette. No vendors, shoppers, robot cooks, or DJ.

**Principal element A: offset market frontage.** The centerline flows around two offset market blocks. Physical road boundaries define the bends; stalls and display furniture sit behind them. Around 15–65%, the rhythm is turn, brief opening, opposite turn. It should feel like driving through an established place rather than dodging arbitrary boxes.

**Principal element B: wider delivery verge.** Outside one bend, provide a broad cobbled delivery apron that retains ordinary course progression. It is a longer, roomier passing option with an item opportunity around 55–65%. Tune roughness mildly so it is useful when the main lane is congested. This is different from the boost-dependent downtown shortcut: room and items are its main reward.

**Principal element C: giant noodle-shop frontage.** One large bowl sign, static noodle sculpture, and bright serving window make an environmental landmark. Use visible bowls, crates, cabinets, vents, and warm interior shelves. Food meshes stay static. A steam effect is unnecessary; heat can be suggested with warm color and a fixed translucent shape if it reads well.

**Principal element D: canopy and electrical substation.** One overhead cable/lantern assembly frames the market; a rooftop power cabinet and thick cables explain the district's lights. Lowest overhead surfaces remain at least 13 m above the road. A static shop sign reads `FRESH BATTERIES / FRESH NOODLES`. Keep decorative lanterns still. The route opens toward the bridge with light-colored paving and a widening exit.

**Supporting static detail.** Folded crates, bottle racks, stacked cooking containers, tiled thresholds, market shutters, menu panels, cable junction boxes, awning seams, and drainage grates. Repeat a small set of stall props purposefully. Include empty loading zones as evidence of deliveries.

**Transition.** The covered market ends abruptly enough to make the bridge view feel expansive. Leave the bridge approach's first 30–40 m clear of traffic interaction.

### 4.4 Port Lumen Suspension Bridge

**Look and feel.** Two tall, angular towers, cyan-lit main cables, restrained magenta tower accents, amber deck lamps, pale concrete piers, and dark asphalt. A suspension silhouette needs large curved main cables and regularly spaced vertical hangers; straight diagonals alone would read as a different bridge type.

**Principal element A: climb, reveal, and descent.** Allocate approximately 0–25% to the approach, 25–75% to the high bridge deck, and the remaining section to descent and cargo entry. The high road sits around 28 m above the world origin, with water near -2 m. Towers extend roughly 40–55 m above the road. A shipping channel remains visible between piers. At the crest, orient the road/view so the industrial island and race ferry can be seen ahead.

**Principal element B: moving traffic.** Use three or four empty, opaque-window vehicles at a time: two sedan variants and a van or small truck. Starting visual sizes: sedan about 2.1 m wide by 4.4 m long; van about 2.3 m wide by 5.2 m long. Traffic flows with the racers at roughly 12–15 m/s. Use two traffic paths toward the center/right of the road, at initial lateral offsets around +1.5 m and +6 m. Reserve a broad left corridor, roughly centered at -6.5 m, as a consistently clear line. Cars do not abruptly change lanes. Longitudinal gaps start around 45–65 m, with staggered positions across lanes.

Traffic belongs to the bridge high span and extended approach staging roads. Recycle vehicles beyond sightlines or behind roadside service structures, never by popping a car into the middle of the visible road. Opaque glass avoids needing driver art. Headlights and tail lights are emissive patches or sprites attached to the rigid model. Wheel motion is unnecessary for this brief.

**Principal element C: expansion-joint hop.** Put the joint around 60–70% of the bridge, after the panorama reveal. The deck joint crosses the road visually. A raised maintenance plate on part of the left corridor forms the optional hop: approximately 3.5–4 m wide, 10–14 m total length, and a 0.45–0.65 m crest. The rest of the joint remains a flat metal strip. Leave at least 30–40 m of landing/recovery road. Keep traffic out of the hop's lane and landing envelope.

**Principal element D: lap-two ship passage.** On the player's second approach to the bridge, a large cargo ship moves through the water channel beneath the span. It is a separate ship from the docked race ferry. Starting size: about 55–70 m long and 13–17 m wide, with the highest mast/deckhouse about 18 m above the water. Leave obvious vertical clearance below the road underside and horizontal clearance between piers. Its path crosses the bridge's axis so the player sees a broad hull, moving containers, and light reflections. It is decorative and never changes the road's physics.

**Supporting static detail.** Main cable anchor blocks, riveted tower panels, catwalks, joint plates, guardrails, service hatches, maintenance lane paint, channel navigation lights, and a few empty parked maintenance vehicles in isolated bays outside the course. Keep the central vista open.

**Transition.** Descend toward the cranes and container stacks. Place an item opportunity near the end of the descent or at cargo entry, away from the optional hop landing.

### 4.5 Cargo Terminal

**Look and feel.** Corrugated containers, gantry silhouettes, sodium-colored work lights, dark steel, rough concrete, painted freight markings, and a few empty industrial vehicles parked outside the road. The route is visibly incorporated into a working logistics complex.

**Principal element A: container corridor to open yard.** Start with a rounded bend framed by stacked containers. Open the view around 25–30% into the handling yard. Use varied stack heights and occasional missing containers to make silhouettes. Container doors, ribs, and corner fittings add close detail. Avoid huge flat container walls running unchanged for the whole district.

**Principal element B: mandatory powered conveyor.** Put a straight 35–45 m conveyor segment around 30–50% of the section. It covers **the entire legal driving width**, including any usable shoulder. Do not provide a side apron that bypasses it. Every racer drives across it. Belt speed starts at approximately 5 m/s in the forward course direction. The belt supplies a continuous transport effect while grounded; it is not merely an animated floor or an ordinary boost pad. Keep this segment close to level and straight. Give 20–30 m of normal ground after it before the crossing hazard.

Visually use dark rubber or metal slats, thick edge housings, bright forward chevrons, hazard stripes, and large end drums mostly below the deck. The driving surface stays continuous. No gaps between slats need physical geometry. Broad scrolling surface stripes show the conveyor direction. End rollers may rotate as whole rigid drums, but their animation is optional.

**Principal element C: cargo-shuttle crossing.** Place the crossing around 70–78%, separated from the conveyor. Reuse the current hazard idea: an empty industrial load carrier moves from its right-side bay into the right/central portion of the road, then retreats. Amber lamps and floor paint warn before it moves. The left passing lane remains clear. Keep the shuttle silhouette mechanical, with an opaque cabin or a simple unmanned trolley body; it must not become a robot character.

**Principal element D: large crane lift and static cargo joke.** One crane performs a slow, large lift entirely over a storage bay or water. Move a cable/hook/container assembly vertically as a rigid payload, keeping the container's proportions unchanged. A neighboring stack has a giant `THIS SIDE UP` container visibly stored upside down. This replaces the earlier rubber-duck gag and signaling robot. The moving crane load never passes over the race road.

**Supporting static detail.** Yard grid markings, painted parking envelopes, parked trailers, forklifts without operators, rail sidings outside the course, shipping-company decals, pallets, bollards, cabinet banks, and restrained rust or salt staining. Use enough clear ground to understand the handling yard's organization.

**Transition.** Freight striping points toward the ferry terminal. Place a recovery/item region after the shuttle and before the ferry loading ramp.

### 4.6 Docked Vehicle Ferry

**Look and feel.** A large roll-on/roll-off ferry is moored for the duration of the race. It has open vehicle doors at both ends, a fixed vehicle deck, a high interior roof, exposed side galleries, portholes or windows above the racing area, mooring ropes, fenders, and illuminated terminal signs. Its bow/stern silhouette should read as a boat even when viewed from the bridge.

The main route goes **through the ferry**. All racers get the signature experience. The ferry does not leave, bob, rock, or close its loading doors while racers use it. A separate neighboring boat may be moored as scenery, but no extra departing-ship event is required.

**Principal element A: loading-ramp entry.** Around 15–25%, drive up the loading transition through the ferry's open doorway. Use a 0.5–0.7 m bounded hop crest if the entry geometry supports it, with continuous underlying ground. The portal frames the player view. Make the frame at least 28–32 m clear inside width, and keep its lowest beam at least 13–14 m above the driving surface.

**Principal element B: vehicle-deck passage.** The interior spans about 90–115 m. Give it one shallow bend and a generous 18–20 m racing width. Structural ribs, side ramps, parked delivery vehicles behind barriers, service cabinets, and long static deck lights make it unmistakably a ship interior. Windows or an open side gallery briefly reveal water. The ceiling should not fill the entire camera view for a long uninterrupted straight.

**Principal element C: loading-apron line choice.** Before the portal, a short wider apron gives an outside item line against a clean inside drift. Both lines merge before entering the ferry. Use the current verge/expanded-boundary model. Do not add a disconnected route around the ship that requires separate progress logic or lets racers miss the interior.

**Principal element D: terminal departure board.** A large static sign reads `PORT LUMEN / VEHICLE DECK 02 / HARBOR LOOP`. Supporting dock displays use simple route icons and environmental destinations such as `OUTER BREAKWATER`, `NORTH QUAY`, and `CARGO ISLAND`. Static empty luggage carts or freight bins are acceptable; passengers and luggage robots are absent. Labels and doors explain that this is an established terminal temporarily hosting the race.

**Supporting static detail.** Deck seams, numbered vehicle bays, wheel chocks beyond the road, tire marks, diagonal corner stripes, loading-door hinges, rope cleats, large fenders, fixed mooring cables, steel bulkheads, and equipment cages. Exterior balconies stay empty.

**Model note.** The existing `harbor:cargo-ferry` mesh is an outdoor cargo ship with containers on its deck. It is useful for the lap-two passing ship or distant moored shipping. It is **not** already a drive-through ferry. Build a separate hollow roll-on/roll-off assembly with an open central passage. A ferry shell can be generated procedurally or authored offline; do not place the existing solid/cargo-filled mesh across the road and assume it will work as the race interior.

**Transition.** A bright rectangular exit reveals water, the lighthouse, and downtown. Keep the loading ramp aligned with the fixed road and leave enough exterior space for players to recover before the coastal sweep.

### 4.7 Seawall Causeway

**Look and feel.** A low supported coastal road bends toward the mainland. Water sits close below the seawall. Large tetrapods, ladders, navigation poles, and a lighthouse give it maritime identity. This district uses broad shapes and distant city reflections to provide visual breathing room.

**Principal element A: sustained coastal drift.** Most of the section is one long sweep, beginning after a short recovery area. The city is visible across the inlet. Opponents can be seen ahead around the curve. The road is wide enough for a few competing lines and item exchanges.

**Principal element B: rough maintenance-quay cut.** On the inside of a sustained right-hand bend, add a short 5–7 m ground extension for approximately 30–45 m. Use rough concrete, drains, faded maintenance arrows, and bright fixed bollards beyond the driveable footprint. A boost can make the cut useful. It reconnects before the final turn into the boulevard. Maintain a continuous surface; the visual impression of a lower quay can be expressed with retaining walls around the road rather than unsupported physical elevation branching.

**Principal element C: inexpensive water and mooring scene.** Use calm animated water, a few static boats, fixed ropes, dark dock fingers, and large broken reflection streaks. No breaking wave, splash curtain, or wetness gameplay is needed. Water remains scenery outside barriers. Large concrete tetrapods interrupt the shoreline silhouette and communicate exposure to the sea.

**Principal element D: lighthouse sweep.** The lighthouse tower is visible from the bridge and ferry exit. Its beam slowly turns as one large visual assembly, roughly one revolution every 25–35 seconds. Use a low-opacity tapered mesh or broad projected glow if easy. Keep it above the road and avoid a bright beam filling the player's view. A static illuminated lantern room is an acceptable simplification if the beam is visually distracting.

**Supporting static detail.** Tide marks on concrete, railing joints, fixed warning plates, mooring fixtures, grate covers, navigation markers, and shoreline rocks. Use a broad fixed dark/wet band near the waterline instead of dynamic wet surfaces.

**Transition.** The causeway arrives back at city infrastructure. Boulevard façades and a distant finish gantry give a clear destination.

### 4.8 Neon Boulevard and Finish

**Look and feel.** A wide city street returns to the waterfront race plaza. Large signs, lit towers, bridge silhouettes, docked boats, and clear race infrastructure tie together the places visited. Use violet and cyan accents over readable asphalt, with warm storefront windows.

**Principal element A: final competing corner lines.** A sustained right-hand finish bend offers a short clean inside drift and a wider outside boost-panel sequence. Place the panels on the outside-left around 30%, 45%, and 60%, with enough room to hold the line. The interior line should be competitive through good drift execution. This is a finishing decision, not a compulsory boost route.

**Principal element B: plaza hop.** Around 75–82%, offer a low ramp occupying one lane. Starting shape: 10–14 m length, 0.5–0.7 m crest, 3.5–4 m width. Leave at least 35 m of recovery and line-up space before the finish or first-lap grid area. No ramp should launch racers directly into a wall or tight turn.

**Principal element C: environmental finish billboard.** Use a large static `PORT LUMEN GRAND PRIX` display, a simple course-outline graphic, and a small `NEON HARBOR` label. Avoid racer portraits, mascots, crowd reactions, or new UI systems. Lighting can remain fixed throughout the race.

**Principal element D: illuminated mooring flotilla.** Several empty, stationary boats at nearby docks carry strings of fixed lights, glowing hull stripes, and simple maritime flags. No passengers or spectators. A harbor control building and navigation mast explain their presence. Use two or three hull silhouettes rather than many highly varied boat designs.

**Supporting static detail.** Finish equipment cabinets, gantry supports, tire barriers outside the course edges, empty pit awnings, promenade benches, planters, marked mooring berths, and utility access panels. Keep the starting grid and finish line legible.

**Lap seam.** Connect smoothly to section 1 at matching elevation and tangent. The opening waterfront curve should feel like the natural continuation of the boulevard.

## 5. Shared gameplay details

### 5.1 Initial items and hop placement

These are starting placements, not a requirement to retain exact fractions. Keep pickup rows clear of obstacle contact and jump landings.

| District | Initial pickups | Hop placement | Other gameplay |
| --- | --- | --- | --- |
| Promenade | Full row near 0.28 | Outside-lane hop near 0.70 | Broad opening drift |
| Downtown | Row near 0.10 or recovery near 0.88 | None | Inside service cut around middle bend |
| Market | Wider-line opportunity near 0.58 | None | Cobble delivery verge |
| Bridge | Row near approach 0.12; optional row after descent | Left maintenance-plate hop near 0.65 | Moving traffic; lap-two decorative ship |
| Cargo | Row near entry 0.10; recovery row near 0.90 | None on conveyor or shuttle crossing | Mandatory conveyor around 0.30–0.50; shuttle around 0.74 |
| Ferry | Apron item opportunity near 0.10 | Entry hop near 0.22 | All racers traverse ferry deck |
| Seawall | Row near 0.15 | None | Boost-dependent maintenance cut |
| Boulevard | Row near 0.12 or before final corner | Optional hop near 0.80 | Outside panels competing with inside drift |

Avoid giving an item advantage at every point on the shortest line. The market and ferry apron provide roomier item routes. The two rough cuts reward saving a boost. Bridge traffic rewards anticipating gaps and preserving a drift setup.

The current ramp system triggers takeoff by crossing a longitudinal ramp position and has no lateral-width condition. **Optional one-lane ramps need an offset/width field and a matching simulation condition.** Their physical ground bump also needs the same lateral extent. A narrow decorative ramp placed over a full-width ground rise would make every lane hop. The bridge's flat joint stripe and raised maintenance plate must remain distinct.

Pickup rows currently create three standard lateral positions from each `ITEM_ROWS` entry. An item opportunity specifically on the market delivery verge or ferry apron needs an explicit lateral-offset option shared by collectible records and their meshes. A proposed `itemRows` entry can add `offsets: [/* meters */]`; the absence of that field keeps the current three-box row. Choose offsets that fit the real expanded ground. Do not draw an apron item visually while leaving its collectible contact at a main-road position. A main-road row can be used first while the localized placement support is added.

### 5.2 Conveyor mechanics

Implement the conveyor as a moving ground surface in simulation, with a matching scrolling material in rendering. Suggested data:

```js
// Proposed extension; these fields are not currently supported.
conveyors: [{
  section: 4,                  // zero-based cargo section
  startFraction: 0.30,
  endFraction: 0.50,
  speed: 5,                    // meters per second, forward along road
  blendDistance: 3,            // meters at entry/exit
  fullWidth: true,
}]
```

The belt direction is the course's horizontal forward tangent, not the kart's heading. A kart driving backward should still be carried in the belt's forward direction. Lateral steering remains controlled by the normal kart handling. Start with no extra lateral drift, no moving obstacles on the belt, and no slippery traction effect.

A straightforward first implementation adds the ground-transport displacement to `worldPos` once per fixed simulation step, after ordinary driving integration and before projection/progress/contact processing. Use the pre-move ground query to determine whether the kart is on the belt, apply the smoothly blended tangent velocity, then project the resulting position. Keep kart engine velocity and belt velocity separate. Do not add 5 m/s repeatedly to `state.vx` each frame, because that would create unlimited acceleration.

Conceptual sequence:

```text
before = project kart onto current road
drive integrates ordinary kart motion for dt
if kart is grounded and inside the mandatory belt range:
    carrierVelocity = normalized horizontal course tangent * speed * edgeBlend
    worldPosition += carrierVelocity * dt
else:
    carrierVelocity = zero
project final world position
advance ordered race progress using actual traveled displacement
resolve normal walls, traffic, and shuttle contact
render interpolated final position
```

Keep its rules identical for the player and AI. A grounded spinning or coasting kart can be carried; a finished kart and an airborne kart are not advected. The belt does not grant inventory, a trick, or a boost timer. If combined engine boost and belt transport feel excessive, tune belt speed down first. Do not raise global kart speed for this course.

If another integration structure better fits the physics, retain the visible result: the surface independently carries a grounded kart forward, normal steering works, the effect is finite and local, and every racer crosses it. Kart wheel motion can continue to use speed relative to the deck. Camera/world travel should reflect actual combined motion.

Rendering can use a repeating slat texture. For a belt with texture coordinates increasing forward, scroll the sampled material so features visibly move forward; the sign of `texture.offset` depends on the UV convention. Express scroll rate in world units: belt speed divided by meters per texture tile. Reuse one dedicated belt texture/material rather than modifying the ordinary road's shared texture. With `fullWidth`, no expanded verge may circumvent the belt. The normal road/shoulder collision envelope is the carrying area.

Shells may retain their existing ballistic behavior. A separate conveyor transport model for projectiles is unnecessary for this design.

### 5.3 Bridge traffic mechanics

Traffic is a gameplay obstacle and must live in simulation. A visual car moving in scenery with no corresponding contact does not fulfill this feature.

Each vehicle needs a course-distance position in world meters, a lane offset in meters, speed, dimensions, an active span, and a deterministic world pose derived from the common race clock. Convert distance to normalized route position using the track's course length before calling the pose query. Do not confuse world meters, `track.TRACK` progress units, normalized `t`, and lane units.

Use a fixed list of vehicle definitions and phase offsets. Move them along the bridge tangent with stable lane assignments. The same time and pose must drive visual meshes, kart collision, shell collision, and AI anticipation. The current cargo-shuttle contact has useful oriented-box math but assumes one object at a fixed route location; traffic needs separate moving route positions.

Use simple oriented box footprints with rounded visual models inside them. Initially, contact can deflect and slow the kart using the existing obstacle response. Traffic does not need real vehicle dynamics, steering AI, driver animation, or a pile-up simulation. Maintain a safe outer-left corridor. AI can choose that corridor when traffic is ahead and gradually return to its normal lane after passing.

Keep vehicle recycling outside the visible racing span. If the simplest path is a wrapped distance interval, include off-view staging lengths at both ends and deactivate contact outside the race-road span. Mask reset points with fixed service buildings or bends. Do not let a wrapped vehicle jump across a visible part of the bridge.

Use the current shuttle's warning/contact as an independent cargo hazard. Bridge traffic must not accidentally replace the shuttle for every course. Introduce optional traffic fields for Neon Harbor and keep other courses' behavior intact.

### 5.4 Lap-two ship event

The large passing cargo ship is a **decorative event tied to the player's second lap**. This definition is intentional: it ensures the person playing gets the requested view, even when AI racers are ahead. Because the ship has no gameplay contact, using player progress does not create inconsistent collision worlds.

The current `player.lap` is zero-based: 0 is the first lap, 1 is the second, and 2 is the third. Detect bridge entry/approach on `player.lap === 1`, start one event, and never repeat it within that race. Trigger around 5–12% into the bridge district so the hull reaches the visible channel as the player climbs toward the panorama. Tune path phase and travel speed to make the ship readable from a normal racing view.

Suggested event state: `started`, `startRaceTime`, `completed`. Start with a 100–140 m path across the channel at roughly 5–7 m/s. Give it a broadside angle relative to the player view. The event can last approximately 18–24 seconds, with most of the motion outside the player's immediate view. The ship becomes hidden after finishing its path. Force it hidden whenever the player is outside lap two. It should not remain moored in view on laps one or three.

Conceptual behavior:

```text
on race reset:
    started = false
    completed = false
    ship.visible = false

on scenery update with race time and player progress:
    if player.lap != 1:
        ship.visible = false
        return
    if not started and player reaches bridge approach:
        started = true
        startRaceTime = raceTime
    if started and not completed:
        age = raceTime - startRaceTime
        ship position = channelPath(age * shipSpeed)
        ship.visible = age within event duration
        completed = age >= event duration
```

Use a crossed-threshold or section-entry condition, not exact equality at one progress sample. If recovery places the player farther inside the bridge on lap two, starting at the available view is preferable to missing the event. If the player reverses or returns to the bridge later in lap two, do not restart the ship.

Use `raceTime`, not wall-clock time or the session's broader `elapsed`. Countdown should not consume its travel time, and pause should freeze it. Reset clears the event. A reset hook is the preferred way to do this; time moving backward can be a secondary reset cue.

The water taxi and other small moored boats are separate objects and may be present on all laps. Only the large ship passing beneath the bridge is restricted to lap two.

## 6. Environmental art and density

### 6.1 Palette and lighting roles

| Material or light family | Starting color direction | Role |
| --- | --- | --- |
| Sky | `#0B1530` to `#16294A` | Rich blue night, readable skyline |
| Distant haze | `#263B58` | Separate far buildings from close structures |
| Water body | `#123F52` to `#174F65` | Dark cyan harbor foundation |
| Asphalt | `#303B4C` to `#465365` | Road stays visible under ambient light |
| Concrete | Muted blue-gray, approximately `#8F9CA8` | Quays, piers, structural definition |
| Structural steel | `#50697B` | Bridge, ferry, cranes |
| Primary neon | `#52E4E0` | City name, bridge cables, transit |
| Secondary neon | `#F07EBE` | Commercial district accents |
| Warm light | `#E8B96C` | Market, apartments, port lamps |
| Finish accent | `#B59AFA` | Boulevard distinction |

These are art targets, not instructions to apply the same hex as both texture tint and emissive output. Imported color textures already carry color. The current lighting and baked vertex shading need to remain readable after tinting.

Use a night environment for reflections where possible. The existing reflection asset derives from a partly cloudy daytime sky, so it may produce overly bright or inappropriate reflections. A small authored equirectangular night gradient with a dark horizon, soft skyline colors, and sparse bright patches can be enough. Feed it through the existing environment/PMREM path. It gives approximate environmental gloss; it does not reflect exact nearby signs or moving cars.

Keep ambient and directional illumination strong enough to read road edges and model silhouettes. The city should have a clear night palette without requiring players to steer into darkness. Use emission for windows and signs. Reserve a few real lights for major nearby views; a light for every window or cable hanger is unnecessary.

### 6.2 Density by distance

Within roughly 0–25 m of the player, spend detail on pavement joins, railings, drains, façade recesses, dock fixtures, container ribs, and loading hardware. These objects need meaningful placement and clear edges.

At roughly 25–100 m, compose blocks, piers, warehouse rooflines, cranes, moored ships, bridge supports, and market canopies. Each district should have a distinctive silhouette and dominant structure.

Beyond roughly 100 m, use simpler building meshes, skyline silhouettes, emissive window textures, and large landmarks. A distant tower does not need visible air-conditioning units. Fog and lower contrast help separate these layers.

Repetition should describe function: bollards along a berth, hangers along a bridge, containers organized into rows, lamps along a promenade. Break that repetition with changes in scale, spacing, material, and one or two deliberate landmarks. Random boxes scattered around the course do not supply the intended environmental richness.

### 6.3 Static environmental humor

Keep jokes architectural, typographic, or material:

- `THIS SIDE UP` printed on an upside-down shipping container.
- `INSTANT PARKING` above a full loading bay.
- A giant noodle bowl sign whose power cable is visibly enormous.
- A tiny `TEMPORARY` label on a huge permanent bridge maintenance plate.
- A `SHORT WAY` sign at the rough downtown service cut, paired with obvious battered paving.
- A polished `WELCOME TO PORT LUMEN` gantry with a small utility plate reading `EST. AFTER DARK`.

Use three or four of these deliberately. They remain static environmental objects. Avoid faces on signs, anthropomorphic machinery, mascot sculptures, and visual jokes that imply a character design task.

### 6.4 Sign construction

Use a reusable sign factory: a shallow framed panel, a canvas texture, a few trim pieces, and emissive lettering. Local bundled fonts or a normal browser font are sufficient. Draw text and simple icons onto the canvas with deliberate padding and high contrast. Use an approximately 2,048 × 512 texture for the major welcome sign if it remains readable at the intended distance; smaller signs can share an atlas.

Use static text. Avoid scrolling marquee logic. Set the color texture to sRGB and clamp wrapping for a single panel. For an unlit face, a `MeshBasicMaterial` can be used with appropriate tone-mapping behavior; for a physical panel, use a dark standard material plus an emissive text/trim layer. Do not rely on emissive material alone to illuminate surrounding pavement.

Welcome sign posts and all large sign supports must clear the actual road, verges, shortcut expansions, and camera path. Low projecting signs belong outside the camera corridor. Strong route arrows should have a consistent color and shape distinct from advertising.

## 7. Asset research and acquisition

### 7.1 Research status

Research used the current repository, its provenance manifests, a pinned public Kenney catalog, selected live GLB downloads from that catalog, and Three.js r180 source files. The cloud environment permits GitHub and package hosts but does not include direct access to every asset publisher's website. Official publisher links below identify upstream packs; the listed GitHub catalog/files are the sources actually fetched for this handoff.

The live GLB inspection confirmed sedan, van, truck, skyscraper A, awning, and bridge pillar files at the paths below. It checked file metadata and scene nodes, not their visual suitability at racing scale. Other listed pack filenames were confirmed in the fetched catalog. Existing local harbor assets and their notices were inspected separately.

Prefer local assets first, then small targeted downloads. The running game should continue serving checked-in assets locally, with no runtime dependency on an external host.

### 7.2 Existing local assets to reuse

| Asset name | Local source | Use in this course | License/provenance |
| --- | --- | --- | --- |
| `harbor:housing-a`, `harbor:housing-b` | `assets/courses/packs/neon-harbor/models/` | Promenade buildings and secondary downtown frontage | Adapted STK assets; CC BY-SA 4.0, retain local notices |
| `harbor:market-house`, `harbor:market-house-c`, `harbor:kiosk` | Same local pack | Market architecture and stalls | Adapted STK assets; CC BY-SA 4.0 |
| `harbor:lamp`, `harbor:bench`, `harbor:aircon`, `harbor:pallet` | Same local pack | Street and freight detail | Local manifest/notices identify authors and adaptations |
| `harbor:palm` | Same local pack | Sparse promenade planters | CC BY-SA 3.0, retain notices; use sparingly because source is comparatively large |
| `harbor:tetrapod` | Same local pack | Shoreline and causeway silhouette | Adapted STK asset; CC BY-SA 4.0 |
| `harbor:cargo-ferry` | Same local pack | Lap-two passing ship; distant cargo scenery | Original authored mesh, CC0; not a hollow drive-through ferry |
| `harbor:gantry-crane` | Same local pack | Cargo terminal and bridge panorama | Original authored mesh, CC0 |
| `harbor:container` | Same local pack | Freight corridors, static stacks, moving crane payload | Original authored mesh, CC0 |
| `kenney:city-kit-industrial/building-a`, `-e`, `-i`, `-m`, `-q` | Same local pack manifest | Cargo-island rooflines and warehouse frontage | Kenney City Kit Industrial, CC0 |
| `kenney:city-kit-industrial/chimney-large`, `detail-tank` | Same local pack manifest | Industrial skyline | Kenney, CC0 |
| Local concrete, metal, brick, asphalt, paving textures | `assets/courses/textures/` and `assets/living/` | Road, structural, and façade material basis | Existing ambientCG derivatives, CC0 |

Use `assets/courses/packs/neon-harbor/manifest.json` for exact runtime names and sources. The local industrial building names end with `/building-e`, etc.; shorthand in the table does not introduce new asset IDs.

The STK upstream release is [STK assets 1.4](https://github.com/supertuxkart/stk-assets-mobile/releases/tag/1.4). It contains a large asset archive and non-GLB source formats, so reuse the existing conversions instead of downloading/reconverting the entire archive for this work.

### 7.3 Kenney packs and exact mesh candidates

Fetched catalog: [Hidencod/tge-assets catalog at pinned commit](https://raw.githubusercontent.com/Hidencod/tge-assets/1f7dee9076ee848773f08fd632ab4e4e73357777/catalog.json).

Pinned raw download prefix:

```text
https://raw.githubusercontent.com/Hidencod/tge-assets/1f7dee9076ee848773f08fd632ab4e4e73357777/
```

Append the exact relative path from the table. The catalog identifies these packs as Kenney and CC0-1.0 and gives their original publisher URLs.

| Official pack | Exact catalog-relative mesh candidates | Recommended use |
| --- | --- | --- |
| [Car Kit](https://kenney.nl/assets/car-kit) | `packs/car-kit/sedan.glb`, `sedan-sports.glb`, `van.glb`, `truck.glb`, `truck-flat.glb`, `taxi.glb` | Three or four bridge traffic bodies; parked vehicles in dock/ferry scenery |
| [City Kit Commercial](https://kenney.nl/assets/city-kit-commercial) | `packs/city-kit-commercial/building-a.glb` through selected lettered variants; `building-skyscraper-a.glb`, `building-skyscraper-b.glb`, `building-skyscraper-c.glb` | Downtown blocks and Lumen Tower; choose a small silhouette set |
| [City Kit Commercial](https://kenney.nl/assets/city-kit-commercial) | `packs/city-kit-commercial/detail-awning.glb`, `detail-awning-wide.glb`, `detail-overhang.glb`, `detail-parasol-a.glb`, `detail-parasol-b.glb` | Shop frontage and fixed market cover |
| [City Kit Roads](https://kenney.nl/assets/city-kit-roads) | `packs/city-kit-roads/bridge-pillar.glb`, `bridge-pillar-wide.glb`, `construction-barrier.glb`, `construction-light.glb`, `light-curved.glb`, `light-square.glb` | Supporting structural/furniture pieces, not replacement race-road geometry |
| [City Kit Roads](https://kenney.nl/assets/city-kit-roads) | `packs/city-kit-roads/road-sign-empty-hanging.glb`, `road-sign-empty.glb`, `sign-highway-wide.glb`, `sign-highway.glb` | Sign housings and brackets with original Port Lumen text |
| [Food Kit](https://kenney.nl/assets/food-kit) | `packs/food-kit/bowl.glb`, `bowl-broth.glb`, `bowl-soup.glb`, `fish.glb`, `soda-bottle.glb`, `pizza-box.glb` | Static market stock; no animated food or cooking |
| [Pirate Kit](https://kenney.nl/assets/pirate-kit) | `packs/pirate-kit/boat-row-small.glb`, `boat-row-large.glb`, `structure-platform-dock.glb`, `barrel.glb`, `crate.glb` | Optional small static harbor hulls, dock props, and freight detail |

Use the full pack directory for every shortened filename in a row. The Pirate Kit's tall sailing ships are a poor fit for the core cyberpunk harbor; the small hulls can be repainted and given simple original cabins if useful. The commercial kit supplies geometry, while original signs, trim, and windows establish the neon identity.

The six files inspected live had these properties:

| File | Download bytes | Scene structure relevant to implementation |
| --- | ---: | --- |
| `packs/car-kit/sedan.glb` | 184,504 | Five meshes; `body` plus four named wheel nodes; embedded image; no animation clips |
| `packs/car-kit/van.glb` | 187,952 | Five meshes; body plus named wheels; embedded image; no animation clips |
| `packs/car-kit/truck.glb` | 188,652 | Five meshes; body plus named wheels; embedded image; no animation clips |
| `packs/city-kit-commercial/building-skyscraper-a.glb` | 122,376 | One mesh; embedded image; no animation clips |
| `packs/city-kit-commercial/detail-awning.glb` | 16,552 | One mesh; embedded image; no animation clips |
| `packs/city-kit-roads/bridge-pillar.glb` | 16,920 | One mesh; embedded image; no animation clips |

This makes rigid placement and movement practical without an animation system. Keep vehicle wheels fixed. Clone material instances only where tint or emission needs independent editing; loaded objects can otherwise share geometry and materials.

The existing City Kit Industrial downloads are pinned separately in the local manifest to [IronRon/Power-Up-the-City](https://github.com/IronRon/Power-Up-the-City/tree/0dc510bea12cdfb473f29f0c6f211bd2318aff6a/assets/kenney_city-kit-industrial_1.0). Its GLBs may reference `Textures/colormap.png`; preserve the expected relative texture layout when adding similar files.

### 7.4 Material sources

The existing material library is enough to start. For targeted additions, the already used public mirror documents usable CC0 texture sets:

[Fable Cities shared asset manifest, pinned revision](https://raw.githubusercontent.com/rawprogress/fable-cities/aea8b1035030952555395de0c1de14ba693a1427/public/assets/shared/MANIFEST.md).

Raw prefix:

```text
https://raw.githubusercontent.com/rawprogress/fable-cities/aea8b1035030952555395de0c1de14ba693a1427/public/assets/shared/
```

Useful folders confirmed by that manifest:

| Folder / upstream source | Files described by manifest | Use |
| --- | --- | --- |
| `asphalt/` — ambientCG Asphalt010 | `albedo.jpg`, `normal.jpg`, `roughness.jpg` | Darker street material if current local choice is unsuitable |
| `concrete/` — ambientCG Concrete034 | `albedo.jpg`, `normal.jpg`, `roughness.jpg` | Bridge and ferry terminal |
| `paving_cobble/` — ambientCG PavingStones128 | `albedo.jpg`, `normal.jpg`, `roughness.jpg`, `ao.jpg` | Service alleys and market apron |
| `facade_glass_night/` — ambientCG Facade009 | `color.jpg`, `normal.jpg`, `roughness.jpg`, `metalness.jpg`, `emission.jpg` | Distant office façades and luminous window grids |
| `corrugatedsteel005/` — ambientCG CorrugatedSteel005 | `color.jpg`, `normalgl.jpg`, `roughness.jpg`, `ambientocclusion.jpg`, `metalness.jpg` | Freight roofs and occasional industrial walls |
| `metalplates006/` — ambientCG MetalPlates006 | `color.jpg`, `normalgl.jpg`, `roughness.jpg`, `metalness.jpg` | Maintenance plate, ferry trim, conveyor housing |

The source manifest identifies OpenGL Y+ normal conventions. Color and emissive maps use color-space handling; normal, roughness, AO, and metalness maps are data maps. Keep color maps around 512–1,024 pixels and secondary maps around 256–512 pixels unless a major close surface needs more. Photographic scans can be muted to fit the stylized palette.

Official upstream catalogs: [ambientCG](https://ambientcg.com/) and [Poly Haven](https://polyhaven.com/). They are alternatives for later browsing, not a requirement to find new assets. The existing local street lamp, bench, and planter conversions already cover common props.

### 7.5 Structures to author directly

Author the bridge, hollow race ferry, conveyor, welcome sign, lighthouse, and simple water taxi specifically for this route. Their dimensions and openings are central to gameplay, making a bespoke assembly more reliable than forcing an unrelated downloaded model to fit.

- **Suspension bridge:** deck/support beams, two towers, sagging main cables, repeated hangers, anchor blocks, railings, and lamps. Use a sampled cable curve or short reusable segments. A low-resolution `TubeGeometry` can express each main cable; repeated slender cylinders or beams make hangers. Tower meshes need actual depth and silhouette detail. Imported pillars may supplement the bases.
- **Race ferry:** faceted hull sides around an open center, high bulkheads, overhead ribs, vehicle doors, fixed ramps, side galleries, deckhouse placed away from the road, fenders, and mooring ropes. Preserve a hollow opening. Use the shared track ribbon as the physical deck. A roughly 125–155 m exterior length and 32–38 m exterior width provide room for the interior and loading hardware.
- **Conveyor:** shallow deck overlay, edge rails/housings, underside rollers, repeated broad slat pattern, and chevron marking. Surface animation can do most of the work.
- **Water taxi:** faceted low hull, boxy tapered cabin, dark windshield, two static navigation lights, and a roof strip. The model needs no interior.
- **Lighthouse:** six- to twelve-sided shaft, contrasting bands, lantern room, exterior gallery, cap, and a broad optional beam.
- **Welcome sign:** framed panel with original text texture and sturdy posts.

These can be modular runtime geometry or offline GLBs. Use coherent material families and bevels/trim where they change silhouettes. Existing `tools/prepare-harbor-fidelity.py` demonstrates authored hull and gantry construction, but includes the original solid cargo layout. Add a distinct asset or focused generator for the race ferry instead of modifying the shared passing-ship asset into an incompatible shape.

### 7.6 Acquisition and integration recipe

Download only selected files into the local course pack. Record upstream URL, pinned mirror URL, pack author, license, any dependencies, and modifications in the manifest/credits. Reuse the repository's existing asset naming convention, for example `harbor:traffic-sedan`, `harbor:traffic-van`, `harbor:race-ferry`, and `harbor:welcome-sign` if those models are added.

Load through the existing `GLTFLoader` and course manifest. The loader normalizes imported models to one meter tall, centered in X/Z and rooted at Y=0. **A scale of `[width, height, depth]` is not automatically a desired world bounding box.** Either use the existing `fitAsset` helper or compute the normalized bounding dimensions and scale by desired dimension divided by source dimension. Preserve vehicle and boat proportions unless a deliberate art adaptation is needed.

Models from the fetched Car Kit samples contain embedded images, so no adjacent texture download was exposed by their GLB metadata. Other assets may have external dependencies. Keep references local and preserve relative paths or repack them into GLB.

No compressed decoder is needed for the inspected meshes. If choosing a Draco-, Meshopt-, or KTX2-dependent replacement, configure the necessary local loader support deliberately or choose an ordinary GLB. Avoid adding a runtime CDN dependency solely to load a decorative prop.

## 8. Water, reflections, and wet surfaces

### 8.1 Recommended water approach

Water is feasible at low cost in this project because it already has a suitable material helper: `createWaterMaterial` in `src/rendering/surface-detail.js`. It uses a standard material with flowing normal detail and an angle-dependent water response. The current harbor already constructs a water plane in `build-waterfront.js`.

Build a harbor basin broad enough to appear beside the promenade, under the bridge, around the ferry, and beside the causeway. Starting extent may be around 550 × 430 m, adjusted to the authored map. A single large opaque plane is sufficient if the land meshes cleanly cover its inland portions. Several nonoverlapping planes are acceptable for channels and distinct basins. Avoid stacking coincident translucent planes.

Set water around Y=-2 m, roads and quays above it, and ship origins so their hulls visibly meet the surface. Ensure global ground and automatic terrain verges do not cover the water or fill the channel with sloped land. Extend the elevated-road treatment to the actual bridge and supported causeway spans. Use quay retaining walls and under-deck supports to explain the edge.

Use dark teal color, roughness roughly 0.16–0.25, a small normal amplitude, and slow flow. Analytic normal detail works without a downloaded water normal map. If using a map, give it repeating UVs and correct data color space. Keep geometric displacement at zero initially. Harbor water should feel calm; shimmer is sufficient.

The helper's optional foam uses a radial shoreline parameter, not arbitrary city-coast intersection detection. For this harbor, start with `foam: false`. Add fixed thin shoreline bands only where useful. Do not assume `foam: true` with no appropriate radius will automatically generate shoreline foam against every quay.

### 8.2 Approximate neon reflections

The base water material and environment map provide gloss and changing highlights, but the environment map cannot reproduce the exact local city signs. Add authored reflection streaks where the view needs them:

- Place a small set of long, broken cyan, amber, and magenta patches below major visible lights.
- Orient each patch in the horizontal water plane, elongated outward from the quay/light toward the expected viewing region.
- Use a generated soft alpha texture with irregular horizontal gaps, about 64 × 256 or 128 × 512 pixels.
- Start with widths about 2–6 m and lengths about 10–30 m, scaled for the size of the corresponding light source.
- Position a few centimeters above the water and use low opacity, depth testing, `depthWrite: false`, and restrained blending.
- A slow broad shader distortion or shared material shimmer is optional. Static broken streaks plus the moving water highlights are acceptable.

These are stylized reflection marks, not physically correct camera-dependent mirrors. Place them to support main racing views. Use perhaps 8–16 strong streaks across the visible basin, rather than a translucent patch beneath every window.

Opaque water minimizes transparency sorting problems. Reflection overlays should remain thin and sparse, with no significant overdraw across the whole screen. Keep boat hulls and quay walls convincing at their contact with the surface.

### 8.3 Real planar reflection as an optional upgrade

The Three.js r180 source confirms the distinction:

- [Water.js](https://github.com/mrdoob/three.js/blob/r180/examples/jsm/objects/Water.js) supplies flat reflective water and renders the scene from a mirrored camera.
- [Reflector.js](https://github.com/mrdoob/three.js/blob/r180/examples/jsm/objects/Reflector.js) creates a planar reflection render target.
- [Water2.js](https://github.com/mrdoob/three.js/blob/r180/examples/jsm/objects/Water2.js) combines reflection, refraction, and flow support.

The inspected `Water.js` exposes a `time` uniform for animation. `Water2.js` uses an internal `Clock` in its flow update. If using the latter, that time source needs adaptation to the race clock to honor pause and restart.

The recommended implementation remains the existing one-pass water plus approximate reflection streaks. If stronger reflections are desired later, use **one** shared planar capture for the primary basin, around 256–512 pixels as a starting render-target size. A mirrored camera adds a scene render and is not free. Several separate reflectors can multiply that work. Water2's additional refraction pass is unnecessary for a dark opaque harbor.

A custom lower-frequency capture requires explicit update control; stock reflective helpers should not be assumed to render only occasionally. Keep recursive reflectors and the reflective water itself out of the capture as appropriate. Vendor any addons from the project's Three.js version and adapt bare `three` imports to the existing native-module setup.

### 8.4 Wet pavement

Give some quay and downtown patches a darker base tone and somewhat lower roughness. Use static puddle marks or soft emissive-colored ground accents beneath a few major signs. This suggests damp city streets without rain particles, screen-space reflection, or water physics.

Keep asphalt nonmetallic. Glass is also normally nonmetallic. Roughness can express wetness and glazing; setting every surface to high metalness would make the city resemble chrome. Emissive signs do not produce actual floor reflections in a normal standard-material scene unless an environment/capture or authored reflection mark supplies them.

## 9. Animation plan

Use large environmental transforms and broad surface animation. The animation list is intentionally short and all movement freezes with race pause.

| Object | Motion | Starting cadence | Implementation approach |
| --- | --- | --- | --- |
| Bridge traffic | Forward movement on fixed lanes | 12–15 m/s | Simulation poses shared with rendering and contact |
| Promenade water taxi | Rigid movement in separate water lane | About 5–8 m/s | Sample a scenic curve; hide loop reset out of view |
| Downtown train | Whole multi-carriage assembly crosses overhead | One pass per roughly 20–30 s | Fixed path with hidden ends; no articulation required |
| Mandatory conveyor | Whole floor pattern flows forward | Match approximately 5 m/s transport | Dedicated texture/shader phase from race time |
| Cargo shuttle | Outward movement, brief hold, return | Existing roughly 12 s cycle is a starting point | Preserve shared warning and contact state |
| One crane payload | Large vertical lift in a safe bay | Roughly 16–24 s cycle | Translate rigid load/hook; adjust cable length separately |
| Lap-two ship | One channel crossing | Once, only during player lap two | Progress-triggered event using race time |
| Lighthouse | Broad slow beam sweep, if retained | 25–35 s revolution | One rotating beam assembly |
| Harbor water | Low-amplitude highlight/normal flow | Continuous, slow | Existing material uniforms |

The docked race ferry, market stock, lanterns, signs, parked vehicles, palms, benches, and moored finish boats remain static. There are no people or robot meshes, no skeletal mixers, and no small character loops. Skip wheel rotation, cargo-worker gestures, boat passengers, confetti, animated flocking, and detailed splashes.

For the crane, translate the load upward/downward; do not scale a container vertically to create its lift. Cable length can change independently. The current harbor crane animation scales a whole assembly in Y; replace that for the new hero crane if it deforms the payload.

Express movement from race time wherever possible, using stable phase offsets. Preallocate paths, vectors, and event records. Small cosmetic motion should not accumulate drift or depend on display frame rate.

Declare every transformed assembly in the scenery world's `animated` list before static batching. Water, materials or sign planes that need later per-object manipulation should also be protected when batching would discard their object identity. A texture uniform can be animated on a shared material without transforming a mesh, but ensure that material is intentionally dedicated to the effect.

## 10. Current code and required extensions

### 10.1 Existing entry points

| File or module | Current responsibility | Intended use for this revision |
| --- | --- | --- |
| `src/courses/neon-harbor.js` | Route controls, sections, pads, items, ramps, shortcut, hazard, theme | Author eight districts, revised road, and new optional metadata |
| `src/courses/neon-harbor-world.js` | Compose harbor scenery and animation result | Compose the new district builders and shared harbor basin |
| `src/courses/neon-harbor/build-city-props.js` | Buildings, lamps, fitted assets, ground shadows | Reuse façade/asset placement helpers |
| `src/courses/neon-harbor/build-waterfront.js` | Current water, ships, quay supports, cranes | Rework basin placement and ship/shore assemblies |
| `src/courses/neon-harbor/build-harbor-life.js` | Current pedestrians, steam, ripples, ferries, shuttle | Remove pedestrian/character construction; retain only useful environmental machinery |
| `src/courses/neon-harbor/build-street-dressing.js` | Street detail | Extend environmental density without characters |
| `src/courses/course-contract.js` | Descriptor validation | Allow the intended section count and validate optional new fields |
| `src/track/track-builder.js` | Arc ranges, surface and ground queries, route frames | Map new ranges; support conveyor metadata and laterally limited ramp ground |
| `src/simulation/simulation.js`, `physics.js` | Fixed-step motion and progress | Apply conveyor transport and traffic contact; condition optional ramps by lane |
| `src/simulation/hazards.js` | One shuttle pose/contact | Keep current shuttle; add optional shared traffic poses/contact |
| `src/simulation/race-session.js` | Race clock and reset orchestration | Supply environmental event reset/progress state if needed |
| `src/rendering/course-runtime.js` | Shared road, terrain, rails, scenery interface | Render new surface ranges; forward optional world state and reset |
| `src/rendering/game-renderer.js` | Calls landscape update with race time | Supply optional player-lap/progress snapshot for ship event |
| `src/rendering/surface-detail.js` | Existing water and material hooks | Reuse cheap harbor water and race-clock uniforms |
| `src/rendering/course-assets.js` | Local GLB loading and normalization | Add selected traffic and architecture assets via manifests |
| `src/rendering/course-kit.js` | Placement, asset cloning, batching | Reuse and extend narrowly if necessary |

### 10.2 Eight sections

The current validator explicitly requires exactly six sections. Change the supported contract to include this eight-section course while allowing the existing six-section courses. A variable count in the intended six-to-eight range is a sensible extension. Most section fractions already reference `course.sections.length`; still inspect places with fixed numeric section indexes before reusing them for Neon Harbor.

The track builder exposes legacy constants such as `MILL_T` and `BRIDGE_RANGE` using fixed district indices. This revision's bridge is zero-based section 3, so its placement can align with that index, but fixed-section assumptions should not determine unrelated features or scenery. Derive actual bridge spans from course metadata where appropriate.

The new zero-based index mapping is `0 promenade`, `1 downtown`, `2 market`, `3 bridge`, `4 cargo`, `5 ferry`, `6 seawall`, `7 boulevard`. All ramp, item, pad, hazard, surface, and elevated references must use this mapping. Existing cargo references to section 4 remain appropriate; existing section-5 boulevard references must move to section 7.

### 10.3 Ground patches, ramps, and materials

The current descriptor has one required `shortcut` object and an optional array of `verges`. Two rough cuts do not require a new disconnected-route system. One practical arrangement is to assign the required `shortcut` to the downtown inside-right alley and use a positive-side `verges` patch for the seawall inside-right maintenance cut. Both already share continuous ground and ordered progress, and ordinary boost overrides off-road drag. Use other verge patches for the roomier market and ferry-apron lines.

The current shortcut ribbon uses `mats.grass` and the shortcut data has no dedicated material field. Give the downtown cut a concrete/paving material in the shared renderer, or use a matching coextensive paving verge to supply that material and surface response. Do not leave a green turf strip in this city merely because the existing shortcut renderer uses it. If adding a `shortcut.material` field, keep a backward-compatible default for existing courses.

Current `surfaces` metadata can override a road material inside a longitudinal range, but `course-runtime.js` gathers material names from sections/verges and does not include all override-only surface materials. Include those names when defining a new conveyor material, or render the belt overlay over the normal concrete surface using the exact conveyor range. The overlay and ground transport range must agree. A normal pad shader with a repeated boost trigger is not the required conveyor behavior.

Current ground height is derived from `routePoint(t)` and adds every ramp to the centerline before creating frames. A lateral ramp extension needs a base route independent of optional lane bumps, plus a ground-height query that accepts lateral offset. Forward that local height into kart grounding, `poseAt` where relevant, road rendering, and item positions. Preserve full-width ramps for older courses when offset/width are absent. One-lane hop triggers should check the same tapered lateral interval as the visible/physical plate. A starting optional-ramp record can add `offset` and `halfWidth` in meters; the built ground rise can taper over roughly 0.5–1 m at its lateral edges.

### 10.4 Ground, rendering, and props

The shared road remains the source of truth for driving ground, rails, walls, shortcuts, shells, AI, and checkpoints. Do not make a ferry deck, belt, or alley appear drivable solely by placing a mesh there. Its ground and physical boundary must correspond to the shared queries.

Use `track.sectorT(index, fraction)` and local route frames to place longitudinal features. Use actual road edges and verge widths to place roadside structures. Use `safeGroup` or equivalent footprint-aware placement for bulky side props. Full footprint checks matter on bends and near another route arm.

Overhead structures are deliberate exceptions to ordinary side-prop placement. The welcome gantry, train crossing, bridge portal, market canopy, and ferry roof can span the road, but their support footprints remain outside the driveable envelope and lowest surfaces clear the camera. Use at least 13 m clear height, with extra room where an elevated trailing camera approaches a grade.

Do not put global ground above the water plane and expect the plane to show through it. The harbor geography needs land coverage, elevated spans, quay walls, and sensible ground levels. Keep supported structures beneath the bridge and ferry approach. A road visually floating on water with no connection to land would weaken the setting.

The default scenery code currently adds a pedestrian body/head system and has a `skin` material in the harbor palette. Remove those from the revised environment rather than merely hiding their animation. Remove any new character-oriented visual elements from street dressing as well. Avoid automatically attaching people to boats or cars.

### 10.5 Scenery state interface

The existing `buildWorld(context)` returns `{ update(time), animated }`, and the renderer calls landscape update with `raceTime`. The ship event needs player lap/progress and reliable reset information. Extend this interface with an **optional** snapshot and optional reset hook, preserving existing courses' `update(time)` implementations.

For example, `update(raceTime, { playerLap, playerT, running })` is enough for decorative progress events. Forward the snapshot through `course-runtime.js`; passing it only to the outer landscape object without forwarding to the course world will not reach the ship controller. Provide reset at race restart, or connect a small course-event controller to existing session callbacks. Keep DOM and UI access outside scenery/simulation.

Traffic and conveyor state belongs in simulation/course metadata, not in this decorative player-specific update. The ship can use player-relative progression because it has no physical influence. This separation prevents an apparently similar animated object from accidentally having inconsistent collision behavior.

### 10.6 Proposed focused module organization

Keep the public entry points small. A possible directory layout is:

```text
src/courses/neon-harbor/
  build-city-props.js          existing reusable placement helpers
  build-promenade.js           waterfront opening and welcome sign
  build-downtown.js            paired façades, service cut dressing, transit
  build-market.js              stalls, canopy, static shop details
  build-suspension-bridge.js   towers, cables, supports, traffic models
  build-cargo-terminal.js      conveyor appearance, containers, crane, shuttle
  build-race-ferry.js          hollow fixed ferry shell and terminal
  build-seawall.js             quay supports, lighthouse, shoreline
  build-boulevard.js           finish frontage and moored boats
  build-waterfront.js          shared basin and reflection marks
  harbor-events.js             decorative train/boat/ship/crane transforms
```

This is suggested organization, not a requirement to create one file for every row. Reuse focused existing helpers when they already serve the purpose. Simulation additions should stay in simulation/track modules rather than importing renderer objects.

## 11. Practical rendering notes

Use the current native browser ES-module setup and vendored Three.js. No new framework or asset-hosting service is required. Favor original simple geometry for structural elements and a small collection of imported meshes for recognizable forms.

Share static geometries and materials. Instance or batch repeated windows, bollards, hangers, rail posts, crates, and container stacks. Existing scenery flattening can merge static objects; preserve moving groups explicitly. Keep merged geometry regionally reasonable so the whole city is not a single always-visible object. Existing model LOD support can supply simple far versions where available.

Use opaque windows with luminous patches for most buildings and vehicles. Fully transparent glass adds sorting and overdraw while suggesting interiors that are not being authored. Ferry openings and shop recesses can use real geometry and dark materials to create depth.

Favor emission and baked/contact shading over many dynamic shadow-casting lights. Use the existing glow-sprite helper for a bounded number of strong light sources. Restrained global bloom, if already available, can soften major signs; it should not make route markings or road edges flare away.

Keep water, cable tubes, and skyline silhouettes low in polygon count. Their shape, scale, reflection pattern, and placement matter more than dense geometry. A rope or bridge hanger rarely needs more than a few radial sides.

Avoid per-frame geometry allocation, rebuilding canvas textures, refitting asset bounds, or traversing every imported mesh. Build once, save references, and update a small number of transforms/uniforms. Match animations to the race clock.

## 12. Suggested build sequence and flexible decisions

1. Author the new continuous route, eight district ranges, bridge grade, ferry span, and two inside cuts. Keep the map coherent before filling it with props.
2. Establish the basin, shorelines, bridge supports, fixed ferry deck/shell, and main landmarks. Make the welcome sign and paired downtown frontage early; they communicate the new identity immediately.
3. Add actual conveyor transport and optional lane-limited ramps. Keep the conveyor straight, mandatory, and visually tied to its simulation range.
4. Add bridge traffic using common simulation poses and contact. Retain the cargo shuttle in its separate district.
5. Add the once-only lap-two passing ship event and whole-object scenic train/water-taxi/crane movement.
6. Populate districts using existing harbor models and selected Kenney downloads. Add static signs, material trim, and environmental jokes.
7. Add restrained reflection streaks and wet-pavement accents. The existing cheap water is the default rendering solution.

Route coordinates, section lengths, ramp fractions, façade spacing, ferry dimensions, and exact lane offsets may change during implementation. If the suggested spline is awkward, redraw it while preserving the sequence, paired downtown buildings, bridge over water, mandatory belt, ferry interior, and returning coastal sweep.

If the alley and seawall cut need different engine representations, retain their recognizable entry, rough surface, boost value, and visible rejoin. If a separate vertical lower-quay route is difficult, keep the driving surface continuous and express the height impression through surrounding retaining-wall scenery.

If one imported model clashes with the rest, replace its silhouette with a simple authored assembly. If water reflections need simplification, retain a dark animated water plane and a few strong reflection marks. If the lighthouse beam or secondary train pass distracts from driving, simplify it to static illumination. The core mechanics remain the downtown turn sequence, moving bridge traffic, expansion-joint hop, lap-two ship, mandatory conveyor, and fixed ferry traversal.

## 13. Handoff reference sheet

| Decision | Intended implementation |
| --- | --- |
| City name | **Port Lumen** |
| Course name | **Neon Harbor** |
| Welcome landmark | `WELCOME TO PORT LUMEN`, large neon gantry before downtown |
| Section count | Eight |
| Main route | Promenade → Downtown → Market → Bridge → Cargo → Ferry → Seawall → Boulevard |
| Downtown | Buildings on both sides; linked rounded tight turns; service cut |
| Bridge | Suspension structure over water; moving cars; optional joint hop |
| Passing ship | Separate cargo vessel; one decorative passage only on player's lap two |
| Conveyor | Entire legal road width; continuous forward ground transport; no bypass |
| Ferry | Hollow fixed roll-on/roll-off interior surrounding main road; no bobbing |
| Waterfront | Boats, moorings, water taxi, inexpensive calm water |
| Environmental inhabitants | No people, passengers, humans, robots, mascots, or crowds |
| Animation scope | Whole transport objects, machinery, broad beam, conveyor material, water |
| Water default | Existing `createWaterMaterial`; no breaking waves; authored reflection streaks |
| Assets | Reuse local harbor pack; targeted Kenney cars/buildings; authored key structures |
| Music | Separate user work |
| Route flexibility | Initial numbers may change; retain section identities and core experiences |
| Implementation status | Design handoff only; gameplay/source assets have not been changed by this document |
