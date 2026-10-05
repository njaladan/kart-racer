#!/usr/bin/env python3
"""Rebuild the small, offline CC0 course asset bundle.

Requires Python 3, Pillow and numpy. Downloads are cached outside the repository.
No remote URL is needed by the game. Geometry is flattened to a dependency-free
position/normal/color stream so all course renderers share the same tiny loader.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import struct
import urllib.request

import numpy as np
from PIL import Image, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "courses"
FABLE = "https://raw.githubusercontent.com/rawprogress/fable-cities/main/public/assets"
KENNEY = "https://raw.githubusercontent.com/Hidencod/tge-assets/main"
CATALOG = KENNEY + "/catalog.json"
CREDITS = FABLE + "/CREDITS.md"
SOURCES = {
    "asphalt": ("asphalt", "Asphalt010"),
    "concrete": ("concrete034", "Concrete034"),
    "metal": ("metalplates006", "MetalPlates006"),
    "brick": ("bricks_red", "Bricks059"),
    "stone": ("Rock030", "Rock030"),
    "sand": ("Ground033", "Ground033"),
    "snow": ("Ground054", "Ground054"),
    "wood": ("Bark012", "Bark012"),
    "bark": ("Bark012", "Bark012"),
}
MODELS = {
    "pine": "tree-pinedefaulta",
    "palm": "tree-palmdetailedtall",
    "rock-a": "rock-largea",
    "rock-b": "rock-largec",
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def fetch(url, cache):
    path = cache / digest(url.encode())
    if not path.exists():
        request = urllib.request.Request(url, headers={"User-Agent": "kart-racer-course-assets/1.0"})
        path.write_bytes(urllib.request.urlopen(request, timeout=45).read())
    return path.read_bytes()


def color_texture(data, key):
    image = Image.open(io.BytesIO(data)).convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
    # Readable shapes and arcade palette take precedence over photographic dirt.
    image = ImageEnhance.Color(image).enhance(0.22)
    image = ImageEnhance.Contrast(image).enhance(0.36)
    image = ImageEnhance.Brightness(image).enhance(1.22)
    if key in ("sand", "snow", "wood", "brick"):
        gray = ImageOps.grayscale(image)
        if key == "sand":
            image = ImageOps.colorize(gray, "#bb9767", "#fff0b4")
        elif key == "snow":
            image = ImageOps.colorize(gray, "#b5cfdf", "#ffffff")
            image = Image.blend(image, Image.new("RGB", image.size, "#edf7ff"), 0.55)
        elif key == "wood":
            image = ImageOps.colorize(gray, "#947652", "#f0d5a4")
        else:
            image = ImageOps.colorize(gray, "#ad927d", "#ead4b5")
    return image


def unpack_glb(data):
    magic, version, size = struct.unpack_from("<III", data)
    if magic != 0x46546C67 or version != 2 or size != len(data):
        raise ValueError("Invalid GLB 2 file")
    chunks = {}
    offset = 12
    while offset < len(data):
        length, kind = struct.unpack_from("<II", data, offset)
        chunks[kind] = data[offset + 8:offset + 8 + length]
        offset += 8 + length
    return json.loads(chunks[0x4E4F534A]), chunks[0x004E4942]


def accessor(doc, binary, index):
    acc = doc["accessors"][index]
    view = doc["bufferViews"][acc["bufferView"]]
    types = {5120: "i1", 5121: "u1", 5122: "<i2", 5123: "<u2", 5125: "<u4", 5126: "<f4"}
    dimensions = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
    dtype = np.dtype(types[acc["componentType"]])
    width = dimensions[acc["type"]]
    stride = view.get("byteStride", width * dtype.itemsize)
    offset = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    result = np.ndarray((acc["count"], width), dtype=dtype, buffer=binary,
                        offset=offset, strides=(stride, dtype.itemsize)).copy()
    if acc.get("normalized") and acc["componentType"] != 5126:
        info = np.iinfo(dtype)
        result = np.maximum(result.astype(float) / info.max, -1)
    return result


def node_matrix(node):
    if "matrix" in node:
        return np.array(node["matrix"]).reshape((4, 4), order="F")
    x, y, z, w = node.get("rotation", [0, 0, 0, 1])
    rotation = np.array([
        [1 - 2*y*y - 2*z*z, 2*x*y - 2*z*w, 2*x*z + 2*y*w],
        [2*x*y + 2*z*w, 1 - 2*x*x - 2*z*z, 2*y*z - 2*x*w],
        [2*x*z - 2*y*w, 2*y*z + 2*x*w, 1 - 2*x*x - 2*y*y],
    ])
    matrix = np.eye(4)
    matrix[:3, :3] = rotation @ np.diag(node.get("scale", [1, 1, 1]))
    matrix[:3, 3] = node.get("translation", [0, 0, 0])
    return matrix


def model_vertices(data):
    doc, binary = unpack_glb(data)
    pieces = []

    def visit(index, parent):
        node = doc["nodes"][index]
        world = parent @ node_matrix(node)
        if "mesh" in node:
            for primitive in doc["meshes"][node["mesh"]]["primitives"]:
                if primitive.get("mode", 4) != 4:
                    raise ValueError("Only triangle primitives supported")
                attrs = primitive["attributes"]
                position = accessor(doc, binary, attrs["POSITION"])
                normal = accessor(doc, binary, attrs["NORMAL"])
                indices = accessor(doc, binary, primitive["indices"]).ravel() if "indices" in primitive else np.arange(len(position))
                position = (np.column_stack((position, np.ones(len(position)))) @ world.T)[:, :3]
                normal = normal @ np.linalg.inv(world[:3, :3])
                normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-10)
                material = doc.get("materials", [{}])[primitive.get("material", 0)]
                factor = material.get("pbrMetallicRoughness", {}).get("baseColorFactor", [1, 1, 1, 1])[:3]
                color = np.tile(factor, (len(position), 1))
                if "COLOR_0" in attrs:
                    color *= accessor(doc, binary, attrs["COLOR_0"])[:, :3]
                # Source models use material factors only: no discarded texture maps.
                if material.get("pbrMetallicRoughness", {}).get("baseColorTexture"):
                    raise ValueError("Textured model needs baking before conversion")
                pieces.append(np.column_stack((position[indices], normal[indices], color[indices])))
        for child in node.get("children", []):
            visit(child, world)

    for index in doc["scenes"][doc.get("scene", 0)]["nodes"]:
        visit(index, np.eye(4))
    vertices = np.concatenate(pieces)
    minimum = vertices[:, :3].min(axis=0)
    maximum = vertices[:, :3].max(axis=0)
    height = maximum[1] - minimum[1]
    vertices[:, :3] -= [(maximum[0] + minimum[0])/2, minimum[1], (maximum[2] + minimum[2])/2]
    vertices[:, :3] /= height
    if not np.isfinite(vertices).all():
        raise ValueError("Nonfinite model geometry")
    return vertices.astype("<f4")


def build(cache):
    cache.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "textures").mkdir(parents=True, exist_ok=True)
    catalog_data = fetch(CATALOG, cache)
    credits_data = fetch(CREDITS, cache)
    catalog = json.loads(catalog_data)
    pack = next(pack for pack in catalog["packs"] if pack["id"] == "nature-kit")
    assert pack["license"] == "CC0-1.0"
    manifest = {"license": "CC0-1.0", "stride": 9, "sources": [], "outputs": []}
    manifest["licenseEvidence"] = [
        {"url": CATALOG, "sha256": digest(catalog_data)},
        {"url": CREDITS, "sha256": digest(credits_data)},
    ]
    for key, (directory, name) in SOURCES.items():
        base = f"{FABLE}/shared/{directory}"
        info_data = fetch(base + "/info.json", cache)
        info = json.loads(info_data)
        assert info["license"] == "CC0"
        url = base + ("/albedo.jpg" if key == "asphalt" else "/color.jpg")
        data = fetch(url, cache)
        destination = OUTPUT / "textures" / f"{key}.webp"
        color_texture(data, key).save(destination, "WEBP", quality=78, method=6)
        manifest["sources"].append({"key": key, "author": "ambientCG", "license": "CC0-1.0",
            "source": info["source"], "download": url, "sha256": digest(data), "bytes": len(data),
            "licenseEvidence": base + "/info.json", "licenseEvidenceSha256": digest(info_data)})
    metadata = {"stride": 9, "models": []}
    stream = bytearray()
    for name, asset in MODELS.items():
        entry = next(model for model in pack["models"] if model["id"] == "nature-kit/" + asset)
        url = KENNEY + "/" + entry["file"]
        data = fetch(url, cache)
        vertices = model_vertices(data)
        metadata["models"].append({"name": name, "offset": len(stream), "vertices": len(vertices)})
        stream.extend(vertices.tobytes())
        manifest["sources"].append({"key": name, "author": "Kenney", "license": pack["license"],
            "source": pack["url"], "download": url, "sha256": digest(data), "bytes": len(data)})
    (OUTPUT / "models.bin").write_bytes(stream)
    (OUTPUT / "models.json").write_text(json.dumps(metadata, indent=2) + "\n")
    for path in sorted([*OUTPUT.glob("textures/*.webp"), OUTPUT / "models.bin", OUTPUT / "models.json"]):
        data = path.read_bytes()
        manifest["outputs"].append({"path": str(path.relative_to(OUTPUT)), "sha256": digest(data), "bytes": len(data)})
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"bytes": sum(path.stat().st_size for path in OUTPUT.rglob("*") if path.is_file()), "models": metadata}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=Path("/tmp/kart-racer-course-assets"))
    build(parser.parse_args().cache)
