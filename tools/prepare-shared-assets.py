#!/usr/bin/env python3
"""Download and inventory the shared Kenney kart models (CC0)."""
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "assets" / "courses" / "packs" / "shared"
BASE = "https://raw.githubusercontent.com/Hidencod/tge-assets/1f7dee9076ee848773f08fd632ab4e4e73357777/packs/car-kit"
SOURCE = "https://kenney.nl/assets/car-kit"
MODELS = ["kart-oobi", "kart-oodi", "kart-ooli", "kart-oopi", "kart-oozi"]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    (PACK / "models").mkdir(parents=True, exist_ok=True)
    entries = []
    for name in MODELS:
        filename = f"{name}.glb"
        url = f"{BASE}/{filename}"
        request = urllib.request.Request(url, headers={"User-Agent": "turbo-trail-shared-assets/1.0"})
        data = urllib.request.urlopen(request, timeout=45).read()
        (PACK / "models" / filename).write_bytes(data)
        entries.append({
            "name": f"kenney-{name}", "file": f"models/{filename}", "type": "gltf",
            "source": SOURCE, "download": url, "author": "Kenney", "license": "CC0-1.0",
            "sha256": digest(data), "bytes": len(data),
        })
    manifest = {"license": "CC0-1.0", "models": entries}
    (PACK / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
