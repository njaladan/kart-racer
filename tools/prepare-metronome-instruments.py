#!/usr/bin/env python3
"""Fetch pinned CC0 scenery and convert the museum violin to a small local GLB.

Run with Python 3 and Blender 4+. Downloads are cached under work/.
"""
import hashlib
import json
import subprocess
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'assets/courses/packs/metronome-hall'
CACHE = ROOT / 'work/metronome-sources'
MESH_REV = '835213277571d625722d25880c9c3010c6f45a5a'
KIT_REV = '08f0c913f6783cc81f9f6105a7cdda8562b1c192'
MESH_URL = f'https://raw.githubusercontent.com/odedstein/meshes/{MESH_REV}/objects/violin/'
KIT_URL = f'https://raw.githubusercontent.com/Hidencod/tge-assets/{KIT_REV}/'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def fetch(url, filename, expected=None):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / filename
    if not path.exists():
        path.write_bytes(urllib.request.urlopen(url, timeout=45).read())
    data = path.read_bytes()
    if expected and digest(data) != expected:
        raise ValueError(f'Source hash mismatch: {filename}')
    return data


manifest = json.loads((PACK / 'manifest.json').read_text())
names = {'instrument:violin', 'art:workshop-desk', 'art:score-shelves', 'art:air-pump'}
manifest['models'] = [m for m in manifest['models'] if m['name'] not in names]
violin = fetch(MESH_URL + 'violin.obj', 'violin.obj',
               '0e6a01c7cfb52a59d31c01af7e1dfea9d43ecee0684c899716392d7470fa6145')
notice = fetch(MESH_URL + 'README.md', 'violin-license.md',
               '1bd4c798a9f8c833be1bf4237dbabc9b0f19836bd77d3652a658da8a46296c9d')
(PACK / 'licenses/museum-violin.md').write_bytes(notice)
output = PACK / 'models/museum-violin.glb'
subprocess.run(['blender', '-b', '-t', '1', '--python-exit-code', '1', '--python',
                str(ROOT / 'tools/convert-metronome-violin.py'), '--',
                str(CACHE / 'violin.obj'), str(output)], check=True)
data = output.read_bytes()
manifest['models'].append({
    'name': 'instrument:violin', 'file': 'models/museum-violin.glb', 'type': 'gltf',
    'author': 'Virtual Museums of Malopolska; mesh adaptation by Oded Stein',
    'license': 'CC0-1.0', 'source': 'https://sketchfab.com/3d-models/violin-a784af0713a643b19ffcf65194bc0fbf',
    'download': MESH_URL + 'violin.obj', 'sourceSha256': digest(violin),
    'attribution': 'licenses/museum-violin.md',
    'modifications': 'Decimated museum scan, upright orientation, cherrywood material; original bow rig added at runtime',
    'bytes': len(data), 'sha256': digest(data),
})
catalog = fetch(KIT_URL + 'catalog.json', 'kenney-catalog.json')
entries = {m['id']: (p, m) for p in json.loads(catalog)['packs'] for m in p['models']}
for source, alias in [('space-kit/machine-generator', 'air-pump')]:
    pack, model = entries[source]
    assert pack['license'] == 'CC0-1.0'
    data = fetch(KIT_URL + model['file'], alias + '.glb')
    file = f'models/{alias}.glb'
    (PACK / file).write_bytes(data)
    manifest['models'].append({
        'name': 'art:' + alias, 'file': file, 'type': 'gltf', 'sourceModel': source,
        'author': pack['author'], 'source': pack['url'], 'license': pack['license'],
        'download': KIT_URL + model['file'], 'sourceSha256': digest(data),
        'catalogSha256': digest(catalog), 'attribution': 'licenses/CC0.txt',
        'bytes': len(data), 'sha256': digest(data),
    })
manifest['license'] = 'Original clock pendulums, music-box mechanism, giant violin bow, mallet accompaniment and bellows. Imported CC0 museum violin and Kenney air-pump; locally bundled credited scans.'
(PACK / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Prepared museum violin and Kenney air-pump.')
