# Frostpeak Festival — the night the mountain lights up

The village has carried its lantern festival up the mountain. You race out of
its warm market, through quiet woods and a blue glacier, onto a carnival above
the clouds, and back down to the lake and the crowded chalet backstreets. The
summit celebration is visible from the start; the starting square is visible
from the summit. This is one connected place with a reason for everything in it.

## Racing rhythm

Eight sections over approximately 1,880 metres. Start with a welcoming market,
compress into woodland, climb a tilted ice ravine, release into an enormous
summit vista, descend on snow waves, choose a lake line, work through technical
village turns, then celebrate the return. Each section changes the surface,
framing, height, color or decision the player makes. The village has actual
bends around 24 metres in radius, rather than cosmetic props beside an oval.
The summit reaches about 85 metres above the valley.

A lap takes roughly 69–70 seconds for the current unboosted AI. These are
simulation measurements, not a claim of human playtesting. Drift skill, items
and the alternate lanes give the player room to improve their route each lap.

## Eight places, four meaningful elements each

### 1. Lantern Lane

**Look:** warm amber windows, pink and teal market awnings, thick snowy roofs,
wooden signs, patterned textiles, trails of footprints and golden lanterns.
**Play:** an opening bend sweeps between close market frontages, with a soft
snow apron on the outside and a turbo on the way into the trees.
**Feel:** the anticipation of a busy winter evening; warmth within arm's reach.

- Market stalls: hot drinks, knitted mittens and lantern-making supplies make
  the celebration legible through objects, rather than explanatory text.
- Garland gates: lantern strings frame the route at varying heights, always
  above the kart and chase camera.
- A giant decorated tree: a landmark for the finish and a beacon seen from the
  mountain; wrapped gifts and snowmen create detail around its base.
- Working chimneys and shoppers: movement belongs to the village, even when
  no kart is passing.

### 2. Snowbell Woods

**Look:** layered blue-green conifers, warm light reflected in snow, delicate
frost bushes and a few clear windows through the trees.
**Play:** an S-shaped forest route, a mushroom-friendly powder apron and a
small trick crest. Closely framed sections open briefly onto the glacier.
**Feel:** quieter and more intimate; you have slipped out of the festival.

- A fallen pine forms an overhead natural gateway, with roots and snow on its
  trunk. The driveable opening and camera clearance remain generous.
- Snowbell strings hung between trees signal the approaching celebration.
- A fox with its own walking and surveying rhythm inhabits a clearing.
- A sledding hill has moving visitors, footprints and a warming hut.

### 3. Glacier Organ

**Look:** great uneven ice pipes, cyan cracks, lavender creases, trapped bubbles
and white snow shelves. The glacier feels carved, not assembled from identical
blue boxes.
**Play:** a climbing S with up to 0.38 radians of banking, a short blue-ice patch,
firm snow before and after it, and a boost close to the exit.
**Feel:** briefly small inside something ancient and beautiful.

- Giant faceted ice columns crowd the sides and frame the sky.
- An overhead ice arch compresses the view before the summit reveal.
- Hanging icicles and layered frost give a sense of the glacier's thickness.
- Small sparkling ice motes move slowly through the shaded blue corridor.

### 4. Cloudcap Carnival

**Look:** an elevated timber festival deck, pavilion roofs, colorful fabric,
gondola station and the entire village visible below.
**Play:** a curved wooden overlook, room to drift, a boost into a small crest,
and a clear setup for the descent.
**Feel:** the reward for the climb; the mountain is hosting a party.

- A summit pavilion has a turning celestial ornament and luminous textiles.
- Round-trip gondolas carry people between village and mountain.
- A kinetic snowflake sculpture creates a recognizable mountaintop silhouette.
- An overlook with spectators points your eye down toward the lake and village.

### 5. Dragonback Drop

**Look:** rolling snow, ridge-side pines, a distant frozen waterfall and little
skiers using their own hill beside the course.
**Play:** a steep descent; the left extension is a firm, driveable trick line
with two localized ramps and boosts. The central route remains smooth.
**Feel:** exhilarating scale and speed after the close glacier and summit.

- A snow-dragon sculpture links the rolling hill shapes into one festival idea.
- Two optional trick ramps make the extended left lane a real choice.
- Skiers and sledders use the slopes independently of the race.
- A frozen waterfall and alpine rock faces provide a destination in the distance.

### 6. Mirror Lake

**Look:** patterned blue ice, snow islands, timber docks, skating visitors,
shoreline lanterns and the mountaintop celebration reflected in the palette.
**Play:** a broad ice bend has three lines: centre ice, an outside-left timber
extension with grip and turbos, and a right-side powder apron that can be cut
with an item. Firm snow at the lake exit precedes the warned groomer crossing.
**Feel:** the expansive calm of a frozen lake, with a decision at every entry.

- Frost patterns, cracks and trapped bubbles make the ice rich at kart height.
- A timber shore route trades a wider line for grip and visible boost panels.
- Skaters circulate on a separate ornamental pond, beyond the racing boundary.
- A service hut, parked sleds and the groomer tell how the resort stays running.

### 7. Chalet Labyrinth

**Look:** close buildings, stone lower walls, amber doors, overhead balconies,
knitted laundry, snowy eaves and chimneys.
**Play:** a genuine sequence of tight turns climbs onto a wooden roof-level
passage, then descends into the village. The route is directed by buildings
and pools of light, with no centreline or striped racing curb.
**Feel:** delightfully lost between places where people live.

- Full lodge frontages form streets with different widths and heights.
- A supported timber passage runs at balcony level, with rooms below it.
- Hanging cloth and wooden bridges form layered overhead composition.
- Village details — firewood, sleds, window boxes, footprints — reward repeat laps.

### 8. Starfall Parade

**Look:** warm lanterns rising toward the cooler mountain sky, spectators,
colorful pennants, a parade sleigh and timed bursts above the starting square.
**Play:** a final powder option and trick crest return you to the broad market
start. The finish landmark is recognizable before the line appears.
**Feel:** returning home to the festival, with the energy of a finale.

- A decorated parade sleigh establishes what the village is celebrating.
- Sky lanterns rise on their own staggered cycles.
- Fireworks evolve above the skyline, away from the driving sightline.
- Cheering visitors and pennants carry movement through the finish.

## Composition and performance

Density means purposeful layers: a snow edge close to the kart, an inhabited
place beside it, a visible next destination, and a mountain silhouette behind
that. It does not mean filling the driveable space with visual noise. The next
turn, ice change and route entrance need a readable shape and color even at speed.

The shared generic rail, red-white curb and centreline are disabled for this
course. Rounded snowbanks follow the actual collision edge. Timber rails appear
where they belong on elevated wooden decks. Marker poles and lamps communicate
open-snow boundaries. These edges have the same geometry limits as the racer.

Use the locally bundled, textured SuperTuxKart chalets, pines, rocks and lamps,
and Kenney holiday props, with source attribution retained. New imported animals
retain their original licenses. Author the unusual structures from small shared
geometry; bake winter material detail into compressed textures. Batch static
props regionally and instance repeated parts. Conifers already have three LODs.

Warm lamps use the shared limited light pool and an offline indirect-light bake.
Do not give every lantern a real-time shadow light. Faceted ice uses opaque
textured materials instead of expensive refraction. Snow and fireworks use
bounded point buffers. Independent clocks give visitors, gondolas and festival
objects changing phases from lap to lap, without random road-blocking events.

## Implementation status

The eight-section route, terrain, snow and timber edges, driveable alternate
lanes, banked climbs, localized trick ramps, gondola route and warned groomer are
implemented. The festival stalls, alpine lodge facades, elevated timber passage,
glacier arches, summit pavilion and turning wheel, snow dragon, waterfall, skating
pond, climbing and descent routes, fox, visitors, skaters, gondolas, lanterns,
fireworks, drifting aurora and independent snowfall are also in the course.
Detailed ice, snow, knit and sign textures are bundled locally. Static geometry is
region-batched; moving life uses bounded shared meshes and point buffers.
