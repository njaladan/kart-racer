# Texture loader dependencies

These dependencies are copied from the Three.js r180 examples distribution, matching the bundled renderer. Three.js additions retain the license in `vendor/three/LICENSE`.

- [Basis Universal](https://github.com/BinomialLLC/basis_universal): JavaScript/WASM transcoder, [Apache 2.0](basis/LICENSE.txt).
- [ktx-parse](https://github.com/donmccurdy/ktx-parse): KTX2 parser, [MIT](ktx-parse-LICENSE.txt).
- Its embedded [Zstandard](https://github.com/facebook/zstd) implementation: [BSD 3-clause](zstd-LICENSE.txt).
- [zstddec](https://github.com/donmccurdy/zstddec): Zstandard decompressor, [MIT](zstddec-LICENSE.txt).

The loader import paths are adapted to the local vendored Three.js module.
