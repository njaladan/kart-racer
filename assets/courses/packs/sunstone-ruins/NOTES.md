# Sunstone Ruins asset decision

The course keeps its desert oasis and ancient sun-temple identity. Kenney's
catalogue review did not reveal a native ancient-desert pack; castle, fantasy
village, pirate, and modern packs would impose the wrong setting. The course
continues to build its signature stepped temple, gear mechanism, and puzzle
landmarks from its own geometry.

The current canyon dressing now uses four distinct, palette-tinted Kenney
Nature Kit rock silhouettes, packed locally under `models/`. Source pack:
https://kenney.nl/assets/nature-kit. Its listing identifies the pack as CC0;
the exact source files, catalog and license evidence hashes are in
`manifest.json`.

Two better-fit third-party packs were found online but could not be bundled in
this execution because outbound shell downloads returned `CONNECT tunnel failed,
response 403`:

- **Desert Canyons and Oases**, 3DAssets.dev, CC0 1.0, 88 metre-scale GLBs with
  a warm faceted palette: https://3dassets.dev/packs/desert-canyons-and-oases
  Pack manifest: https://3dassets.dev/api/v1/packs/desert-canyons-and-oases
  Relevant model files: `desert-canyons-and-oases-hoodoo-trio-f0d0b68d`
  (`https://cdn.3dassets.dev/assets/20896/v1/model.glb`),
  `desert-canyons-and-oases-slender-capped-hoodoo-8cfb2454`
  (`https://cdn.3dassets.dev/assets/20899/v1/model.glb`), and
  `desert-canyons-and-oases-mushroom-hoodoo-1b67dada`
  (`https://cdn.3dassets.dev/assets/20900/v1/model.glb`). The pack listing
  states CC0 1.0 Universal, no attribution required, and notes all pack models
  were AI generated.
- **LowPoly Desert Props**, iPoly3D, OpenGameArt, a 16-object mini desert
  environment including GLTF/FBX/Blend formats: https://opengameart.org/content/lowpoly-desert-props
  Its page explicitly marks the upload CC0. Its archive could not be retrieved
  here: https://opengameart.org/sites/default/files/lowpoly_desert_props.zip

When model downloads are available, the 3DAssets.dev canyon formations are a
better next migration than re-theming the course. The Desert Mosque/Madrasa
pack was deliberately excluded because its architecture represents a different
period and cultural setting from the course's ancient sun-temple fiction.
