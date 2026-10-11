"""Download CC0 sources and build the small, palette-matched runtime assets.

Run with Python 3, Pillow and numpy. Original downloads stay outside the game;
the manifest records URLs and SHA-256 hashes for both sources and derivatives.
"""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request

import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
TEXTURES = "https://raw.githubusercontent.com/rawprogress/fable-cities/aea8b1035030952555395de0c1de14ba693a1427/public/assets/shared/"
SOURCES = {
    "asphalt.jpg": TEXTURES + "asphalt/albedo.jpg",
    "grass.jpg": TEXTURES + "Grass004/color.jpg",
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, default=Path("/tmp/turbo-source-assets"))
    args = parser.parse_args()
    args.source_dir.mkdir(parents=True, exist_ok=True)
    out = ROOT / "assets"
    out.mkdir(exist_ok=True)
    manifest = {"license": "CC0-1.0", "sources": {}, "outputs": {}}
    for name, url in SOURCES.items():
        path = args.source_dir / name
        if not path.exists():
            urllib.request.urlretrieve(url, path)
        manifest["sources"][name] = {"url": url, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}

    # Keep the original 256-square surface budget. Detail is carried in one map.
    for source, target, palette, contrast in [
        ("asphalt.jpg", "asphalt.webp", (91, 103, 117), 0.28),
        ("grass.jpg", "grass.webp", (119, 168, 68), 0.42),
    ]:
        im = Image.open(args.source_dir / source).resize((256, 256), Image.Resampling.LANCZOS)
        lum = np.asarray(ImageOps.grayscale(im), dtype=float)
        detail = np.clip((lum - lum.mean()) / max(lum.std(), 1), -2.5, 2.5)
        pixels = np.clip(np.array(palette)[None, None, :] * (1 + contrast * detail[:, :, None] * 0.25), 0, 255)
        Image.fromarray(pixels.astype("uint8")).save(out / target, quality=87, method=6)

    for path in sorted(out.iterdir()):
        if path.name in ["asphalt.webp", "grass.webp"]:
            manifest["outputs"][path.name] = {"bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest["outputs"], indent=2))


if __name__ == "__main__":
    main()
