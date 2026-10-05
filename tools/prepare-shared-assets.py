#!/usr/bin/env python3
"""Download pinned SuperTuxKart 1.4 assets and convert six racers to local GLB.

Requires Blender 4.3+, Pillow and numpy. Only the runtime GLBs and attribution
are checked in; the upstream collection stays in the temporary download cache.
"""
import hashlib
import json
import io
import struct
from pathlib import Path
import shutil
import subprocess
import tempfile
import urllib.request
import zipfile
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'assets/courses/packs/shared'
CACHE = Path(tempfile.gettempdir()) / 'turbo-trail-stk-1.4'
DOWNLOAD = 'https://github.com/supertuxkart/stk-assets-mobile/releases/download/1.4/stk-assets-full.zip'
ARCHIVE_HASH = 'ad61912093e7d4b399c8e4841156f45550a8b60dc59a290ad84058a9bae0622d'
RACERS = {
    'tux': ('Tux', 'Penguin', '#e74736', 'Julian "XGhost" Schönbächler', 'CC-BY-SA-3.0'),
    'nolok': ('Nolok', 'Reptile', '#c48d36', 'Tobias "cheleb" Beyrer; STKRudy85; Marianne Gagnon; Samuncle', 'CC-BY-SA-4.0'),
    'pidgin': ('Pidgin', 'Bird', '#9c68c8', 'Tobias "cheleb" Beyrer; STKRudy85; chronomaster; Vincent Lejeune; Crystal', 'CC-BY-SA-3.0'),
    'kiki': ('Kiki', 'Robot', '#43bee9', 'Typhon306; ZAQraven; Crystal; mascot design by Tyson Tan', 'CC-BY-SA-3.0'),
    'konqi': ('Konqi', 'Dragon', '#5cba45', 'ZAQraven; Benau', 'CC-BY-SA-3.0'),
    'wilber': ('Wilber', 'Mascot', '#f19a35', 'Néd J. "jymis" Édoire', 'CC-BY-SA-3.0'),
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def copy_notice(source, destination):
    text = '\n'.join(line.rstrip() for line in source.read_text().splitlines())
    destination.write_text(text.rstrip() + '\n')


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    archive = CACHE / 'stk-assets-full.zip'
    if not archive.exists():
        request = urllib.request.Request(DOWNLOAD, headers={'User-Agent': 'turbo-trail-assets/1.0'})
        with urllib.request.urlopen(request, timeout=120) as response, archive.open('wb') as output:
            shutil.copyfileobj(response, output)
    if digest(archive.read_bytes()) != ARCHIVE_HASH:
        raise RuntimeError('SuperTuxKart source archive checksum mismatch')
    source = CACHE / 'karts'
    (PACK / 'licenses').mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as bundle:
        for name, (_, _, color, _, _) in RACERS.items():
            prefix = f'karts/{name}/'
            bundle.extractall(CACHE, members=[f for f in bundle.namelist() if f.startswith(prefix)])
            folder = source / name
            # Some kart materials intentionally reference the pack's shared
            # texture library. Inventory SPM material tables before conversion.
            for mesh in folder.glob('*.spm'):
                stream = io.BytesIO(mesh.read_bytes())
                stream.read(28)
                count = struct.unpack('<H', stream.read(2))[0]
                for _ in range(count * 2):
                    length = struct.unpack('<B', stream.read(1))[0]
                    texture = stream.read(length).decode('ascii')
                    if texture and not (folder / texture).exists():
                        path = 'textures/' + texture
                        if path not in bundle.namelist():
                            raise RuntimeError(f'Missing pack texture: {name}/{texture}')
                        bundle.extract(path, CACHE)
            bundle.extract('textures/licenses.txt', CACHE)
            copy_notice(CACHE / 'textures/licenses.txt', PACK / 'licenses/shared-textures.txt')
            copy_notice(folder / 'licenses.txt', PACK / 'licenses' / f'{name}.txt')
            # STK's colorizable chassis are gray until its shader adds the
            # racer color. Bake that mask here so ordinary glTF keeps the paint.
            paint = np.array([int(color[i:i+2], 16) / 255 for i in (1, 3, 5)])
            for material in ET.parse(folder / 'materials.xml').getroot():
                mask_name = material.attrib.get('colorization-mask')
                texture_path = folder / material.attrib['name']
                if not mask_name or not texture_path.exists() or not (folder / mask_name).exists():
                    continue
                with Image.open(texture_path) as texture, Image.open(folder / mask_name) as mask:
                    rgba = np.array(texture.convert('RGBA'), dtype=np.float32) / 255
                    mask_values = np.array(mask.convert('RGB').resize(texture.size), dtype=np.float32) / 255
                    amount = mask_values[..., 0:1]
                    luminance = rgba[..., :3].max(axis=2, keepdims=True)
                    rgba[..., :3] = rgba[..., :3] * (1 - amount) + luminance * paint * amount
                    Image.fromarray(np.uint8(np.clip(rgba * 255, 0, 255))).save(texture_path)
            for texture_path in folder.glob('*.png'):
                with Image.open(texture_path) as texture:
                    texture.thumbnail((512, 512), Image.Resampling.LANCZOS)
                    texture.save(texture_path)
    for texture_path in (CACHE / 'textures').iterdir():
        if texture_path.suffix.lower() not in ['.png', '.jpg']:
            continue
        with Image.open(texture_path) as texture:
            texture.thumbnail((512, 512), Image.Resampling.LANCZOS)
            texture.save(texture_path)
    subprocess.run([
        'blender', '-b', '-t', '2', '--python-exit-code', '1', '--python', str(ROOT / 'tools/convert-stk-karts.py'),
        '--', str(source), str(PACK / 'models'),
    ], check=True)
    entries = []
    for name, (label, kind, color, author, license_id) in RACERS.items():
        filename = f'models/kart-{name}.glb'
        data = (PACK / filename).read_bytes()
        entries.append({
            'name': f'stk-kart-{name}', 'file': filename, 'type': 'gltf',
            'racer': label, 'kind': kind, 'color': color,
            'source': 'https://supertuxkart.net', 'download': DOWNLOAD,
            'sourceArchiveSha256': ARCHIVE_HASH, 'sourcePath': f'karts/{name}/',
            'author': author, 'license': license_id, 'attribution': f'licenses/{name}.txt',
            'modifications': 'SPM saved driving pose converted to static glTF; assembled wheels/accessories; baked chassis paint masks; textures resized to 512px. Original animation, glow meshes and secondary decal layers omitted; common metal/lamp shader textures replaced with solid materials.',
            'sha256': digest(data), 'bytes': len(data),
        })
    (PACK / 'manifest.json').write_text(json.dumps({'models': entries}, indent=2) + '\n')
    for old in (PACK / 'models').glob('kart-oo*.glb'):
        old.unlink()


if __name__ == '__main__':
    main()
