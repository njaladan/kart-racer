# Port Lumen course authoring

Neon Harbor now follows a 1,899 m waterfront loop with eight districts. The
minimum constructed horizontal radius is 41.4 m. Downtown reverses direction
between tall facades on both sides; the cargo district narrows to a 15.2 m
container canyon. The bridge has a straight high span over the inlet, and the
ferry deck is nearly straight, enclosed by continuous bulkheads and ceiling
modules. Three laps, bridge traffic/contact, the mandatory powered conveyor,
and the once-only second-lap ship passage remain part of the race.

The continuous rails, center dashes and racing curbs are replaced by district
boundaries: sidewalks and storefronts, container stacks, ferry hull walls,
bridge parapets and seawalls. They follow the same surface edges that physics
uses, including the service alley, market delivery apron and coastal cut.
The optional ferry-exit ramp has a 1.9 m crest and a boost approach beside the
smooth lane. All driving surfaces remain continuous.

The world runs independently of the racers: a three-car elevated train crosses
downtown, four cars use a second elevated expressway, two enclosed water taxis
travel beside the quays, three cargo gantries lift containers, and cooling fans
rotate above the freight district. Existing water, cargo shuttle, crane hooks,
lighthouse beam and bridge traffic also animate. Scenery contains no characters.

## Materials and assets

The eleven offline WebP maps total approximately 443 KB. Three facade families have
separate emissive masks, lit/unlit interiors, blinds, mullions, shutters and
small utility details. One shared sign atlas supplies sixteen advertisements
and wayfinding panels. A neutral corrugated-metal map is tinted for five cargo
families. The welcome gantry and conveyor use separate maps. A shop-window atlas adds
stocked bottle shelves, bowls and battery cabinets behind recessed glass.

Seven imported Kenney CC0 models add taxi/sedan/van/truck/delivery silhouettes
and two skyscraper families. All files are local at runtime. Licenses, pinned
source URLs, sizes and SHA-256 hashes live in the course pack manifest.

Repeated static meshes are regionally instanced/batched; moving assemblies are
protected from flattening. Light pools use gradient cards and the existing
three racer lights. The 768-pixel offline BVH lighting bake supplies terrain
occlusion, bounce and lamp pools without additional shadow-casting lights.
The bake exporter reads the atlas albedo averages as well as imported textures.

## Driving views

![Downtown switchbacks](screenshots/neon-harbor.jpg)

![Container canyon](screenshots/port-lumen-cargo.jpg)

![Suspension bridge](screenshots/port-lumen-bridge.jpg)

## Editing

- Route, widths, ramps and mechanics: `src/courses/neon-harbor.js`.
- Close districts and natural boundaries: `build-lumen-districts.js`.
- Waterfront, props and imported towers: `build-lumen-quays.js`.
- Ambient transport and machinery: `build-lumen-motion.js`.
- Shared texture materials and sign atlas UVs: `lumen-materials.js`.
- Bridge, ferry, welcome, lighthouse and ship event: `build-port-landmarks.js`.

All builders live under `src/courses/neon-harbor/` and place from constructed
track frames. The `edgeStyle: "port-lumen"` option suppresses the shared generic
rail/curb furniture for this course. Other courses retain their own boundaries.

Rebuild maps/imports with `python3 tools/prepare-port-lumen.py` (Pillow/numpy).
Rebuild lighting after geometry or route edits:

```sh
node tools/export-lighting-scene.mjs neon-harbor
blender -b -t 2 --python tools/bake-course-lighting.py -- neon-harbor
```

The same-origin `test-seek` preview protocol snaps the chase camera to its new
district, allowing screenshot capture without an interpolated trip through
intervening buildings.
