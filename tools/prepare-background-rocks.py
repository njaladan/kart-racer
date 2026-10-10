#!/usr/bin/env python3
"""Download four pinned CC0 Kenney rock models and soften their distant silhouettes.
Requires Blender. Source geometry is retained; Catmull-Clark smoothing rounds the
rock edges. The game's shared photographic rock atlas supplies surface detail.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
REV = '08f0c913f6783cc81f9f6105a7cdda8562b1c192'
BASE = f'https://raw.githubusercontent.com/Hidencod/tge-assets/{REV}/'
CACHE = Path('/tmp/course-background-rock-sources')
SLUGS = ['rock-largea', 'rock-largec', 'rock-larged', 'rock-largef']
COURSES = ['tempest-causeway', 'frostpeak-festival', 'pelagic-glasshouse']


def sha(data):
    return hashlib.sha256(data).hexdigest()


def convert():
    import bpy
    CACHE.mkdir(parents=True, exist_ok=True)
    for slug in SLUGS:
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
        bpy.ops.import_scene.gltf(filepath=str(CACHE / (slug + '.glb')))
        for obj in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
            bpy.context.view_layer.objects.active = obj
            smooth = obj.modifiers.new('Rounded eroded rock edges', 'SUBSURF')
            smooth.levels = 2
            bpy.ops.object.modifier_apply(modifier=smooth.name)
            for face in obj.data.polygons:
                face.use_smooth = True
        bpy.ops.export_scene.gltf(filepath=str(CACHE / (slug + '-rounded.glb')),
                                  export_format='GLB', export_animations=False,
                                  export_yup=True, export_normals=True)


if '--convert' in sys.argv:
    convert()
else:
    requested = sys.argv[1:] or ['tempest-causeway']
    if any(course not in COURSES for course in requested):
        raise ValueError('Choose courses from ' + ', '.join(COURSES))
    CACHE.mkdir(parents=True, exist_ok=True)
    catalog = urllib.request.urlopen(BASE + 'catalog.json', timeout=30).read()
    pack = next(p for p in json.loads(catalog)['packs'] if p['id'] == 'nature-kit')
    if pack['license'] != 'CC0-1.0':
        raise ValueError('Expected CC0 rock models')
    for slug in SLUGS:
        url = BASE + f'packs/nature-kit/{slug}.glb'
        data = urllib.request.urlopen(url, timeout=30).read()
        (CACHE / (slug + '.glb')).write_bytes(data)
    subprocess.run(['blender', '--background', '--threads', '2', '--python',
                    str(Path(__file__).resolve()), '--', '--convert'], check=True)
    for course in requested:
        folder = ROOT / 'assets/courses/packs' / course
        manifest = json.loads((folder / 'manifest.json').read_text())
        manifest['models'] = [m for m in manifest['models']
                              if not m['name'].startswith('background:rock-')]
        for index, slug in enumerate(SLUGS):
            data = (CACHE / (slug + '-rounded.glb')).read_bytes()
            file = f'models/background-{slug}.glb'
            (folder / file).write_bytes(data)
            manifest['models'].append({
                'name': f'background:rock-{index}', 'file': file, 'type': 'gltf',
                'author': 'Kenney', 'license': 'CC0-1.0',
                'source': 'https://kenney.nl/assets/nature-kit',
                'download': BASE + f'packs/nature-kit/{slug}.glb',
                'sourceSha256': sha((CACHE / (slug + '.glb')).read_bytes()),
                'catalogSha256': sha(catalog), 'attribution': 'licenses/CC0.txt',
                'bytes': len(data), 'sha256': sha(data),
                'modifications': 'Two subdivision levels and smooth normals; original silhouette and materials retained. Shared scanned rock shading is applied by the course.'
            })
        (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
        print('Prepared downloaded background rocks for', course, flush=True)
