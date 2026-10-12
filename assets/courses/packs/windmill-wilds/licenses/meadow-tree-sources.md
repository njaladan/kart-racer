# Meadow tree sources

Seven low-poly tree shapes are selected from two independent CC0 packs:

- **Kay Lousberg — KayKit Forest Nature Pack**:
  <https://kaylousberg.itch.io/kaykit-forest>. The creator lists the pack as CC0.
  Standard Color1 Tree 1A, 2A, 3A and 4A are downloaded from the pinned
  `GeorgeQLe/assets-kaykit-3d-environments` mirror at commit
  `d5e6c73284e9385a389ac7181dec3d0dc9e9021d`. The collection's original license is
  retained in `meadow-kaykit-CC0.txt`.
- **Kenney — Nature Kit**: <https://kenney.nl/assets/nature-kit>.
  The creator lists the pack as Creative Commons CC0. `tree-fat`,
  `tree-pinerounda` and `tree-pineroundc` are downloaded from the pinned
  `Hidencod/tge-assets` mirror at commit
  `08f0c913f6783cc81f9f6105a7cdda8562b1c192`.

The original tree shapes and normals are retained. The source material and UV
colors are sampled into opaque vertex colors; greens are harmonized for the
meadow. Source texture dependencies are removed from the runtime GLBs.
Source/download URLs, hashes, output hashes, triangle counts and modifications
are recorded in the course manifest. Downloads occur only in
`tools/prepare-meadow-trees.py`; the game uses the bundled local files.

Original trees are by their credited artists. Redistribution of the prepared
game assets follows CC0; the website artwork and creator branding are excluded.
