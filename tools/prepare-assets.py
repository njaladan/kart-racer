"""Download CC0 sources and build the small, palette-matched runtime assets.

Run with Python 3, Pillow and numpy. Original downloads stay outside the game;
the manifest records URLs and SHA-256 hashes for both sources and derivatives.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import urllib.request

import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
TEXTURES = "https://raw.githubusercontent.com/rawprogress/fable-cities/aea8b1035030952555395de0c1de14ba693a1427/public/assets/shared/"
MODELS = "https://raw.githubusercontent.com/Hidencod/tge-assets/1f7dee9076ee848773f08fd632ab4e4e73357777/packs/nature-kit/"
SOURCES = {
    "asphalt.jpg": TEXTURES + "asphalt/albedo.jpg",
    "grass.jpg": TEXTURES + "Grass004/color.jpg",
    "sky.hdr": TEXTURES + "hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr",
    "tree-default.glb": MODELS + "tree-default.glb",
    "tree-oak.glb": MODELS + "tree-oak.glb",
    "tree-pine.glb": MODELS + "tree-pinesmallb.glb",
}


def read_hdr(path):
    """Decode the standard Radiance scanline RLE used by this source HDRI."""
    with path.open("rb") as f:
        while f.readline().strip():
            pass
        axis_y, height, axis_x, width = f.readline().split()
        assert (axis_y, axis_x) == (b"-Y", b"+X")
        width, height = int(width), int(height)
        rgbe = np.zeros((height, width, 4), dtype=np.uint8)
        for y in range(height):
            header = f.read(4)
            assert header[:2] == b"\x02\x02" and int.from_bytes(header[2:], "big") == width
            for c in range(4):
                x = 0
                while x < width:
                    n = f.read(1)[0]
                    if n > 128:
                        n -= 128
                        rgbe[y, x:x+n, c] = f.read(1)[0]
                    else:
                        rgbe[y, x:x+n, c] = np.frombuffer(f.read(n), dtype=np.uint8)
                    x += n
        return rgbe[:, :, :3].astype(float) * np.exp2(rgbe[:, :, 3:4].astype(float) - 136)


def convert_model(path, leaf_color):
    data = path.read_bytes()
    size = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20+size])
    binary = data[28+size:]
    assert len(gltf["meshes"]) == 1
    node = next(n for n in gltf["nodes"] if "mesh" in n)
    assert node.get("rotation") == [0, 0, 0, 1] and node.get("scale") == [1, 1, 1]

    def accessor(index):
        a = gltf["accessors"][index]
        view = gltf["bufferViews"][a["bufferView"]]
        dtype = {5126: "<f4", 5125: "<u4", 5123: "<u2"}[a["componentType"]]
        width = {"SCALAR": 1, "VEC3": 3}[a["type"]]
        assert "byteStride" not in view
        offset = view.get("byteOffset", 0) + a.get("byteOffset", 0)
        return np.frombuffer(binary, dtype=dtype, count=a["count"]*width, offset=offset).reshape(-1, width)

    pieces = []
    for p in gltf["meshes"][0]["primitives"]:
        assert p["mode"] == 4
        indices = accessor(p["indices"]).flatten()
        pos = accessor(p["attributes"]["POSITION"])[indices].copy()
        normals = accessor(p["attributes"]["NORMAL"])[indices].copy()
        name = gltf["materials"][p["material"]]["name"]
        color = leaf_color if "leaf" in name else [0.39, 0.22, 0.12]
        # Linear color values: warm bark, varied greens, soft underside shading.
        height = float(gltf["accessors"][p["attributes"]["POSITION"]]["max"][1])
        shade = 0.73 + 0.17 * np.clip(pos[:, 1] / height, 0, 1) + 0.10 * np.clip(normals[:, 1], 0, 1)
        colors = np.array(color)[None, :] * shade[:, None]
        pos[:, 1] -= gltf['accessors'][p['attributes']['POSITION']]['min'][1]
        # Normalize all families to a 4.5 m tree, rooted at the ground.
        pos *= 4.5 / height
        pieces.append(np.concatenate((pos, normals, colors), axis=1).astype("<f4"))
    return np.concatenate(pieces).tobytes()


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

    sky = read_hdr(args.source_dir / "sky.hdr")
    # The small LDR reflection map is pre-tonemapped; no HDR loader at runtime.
    mapped = sky * 0.65 / (1 + sky * 0.65)
    srgb = np.where(mapped <= 0.0031308, mapped * 12.92, 1.055 * mapped ** (1/2.4) - 0.055)
    Image.fromarray(np.uint8(np.clip(srgb, 0, 1)*255)).resize((256, 128), Image.Resampling.LANCZOS).save(out / "sky-reflections.webp", quality=87, method=6)

    offset = 0
    packed = bytearray()
    models = []
    for name, source, color in [("tree-default", "tree-default", [0.28, 0.48, 0.12]),
                                ("tree-oak", "tree-oak", [0.19, 0.40, 0.14]),
                                ("tree-pine", "tree-pine", [0.11, 0.32, 0.17]),
                                ("tree-blossom", "tree-oak", [0.85, 0.45, 0.48])]:
        binary = convert_model(args.source_dir / (source + ".glb"), color)
        models.append({"name": name, "offset": offset, "vertices": len(binary)//36})
        packed.extend(binary)
        offset += len(binary)
    (out / "nature.bin").write_bytes(packed)
    (out / "nature.json").write_text(json.dumps({"stride": 9, "models": models}, separators=(",", ":")) + "\n")
    for path in sorted(out.iterdir()):
        if path.suffix in [".webp", ".bin"] or path.name == "nature.json":
            manifest["outputs"][path.name] = {"bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest["outputs"], indent=2))


if __name__ == "__main__":
    main()
