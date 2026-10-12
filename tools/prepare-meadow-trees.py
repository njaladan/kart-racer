#!/usr/bin/env python3
"""Prepare a tiny, texture-free CC0 tree palette from Kenney and KayKit.

python3 tools/prepare-meadow-trees.py
Pinned source glTF/GLB, buffers and palette textures are cached under /tmp.
Blender samples the original material/UV colors into vertex colors, preserves
the authored low-poly silhouettes/normals, and embeds each selected model in GLB.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'assets/courses/packs/windmill-wilds'
CACHE = Path(os.environ.get('MEADOW_TREE_CACHE', '/tmp/meadow-tree-palette'))
KAY = 'https://raw.githubusercontent.com/GeorgeQLe/assets-kaykit-3d-environments/d5e6c73284e9385a389ac7181dec3d0dc9e9021d/'
KENNEY = 'https://raw.githubusercontent.com/Hidencod/tge-assets/08f0c913f6783cc81f9f6105a7cdda8562b1c192/'
SOURCES = [
    ('round', 'Kay Lousberg', 'https://kaylousberg.itch.io/kaykit-forest', KAY + 'assets/kaykit/forest-nature-pack-1.0/Assets/gltf/Color1/Tree_1_A_Color1.gltf'),
    ('tiered', 'Kay Lousberg', 'https://kaylousberg.itch.io/kaykit-forest', KAY + 'assets/kaykit/forest-nature-pack-1.0/Assets/gltf/Color1/Tree_2_A_Color1.gltf'),
    ('branching', 'Kay Lousberg', 'https://kaylousberg.itch.io/kaykit-forest', KAY + 'assets/kaykit/forest-nature-pack-1.0/Assets/gltf/Color1/Tree_3_A_Color1.gltf'),
    ('slender', 'Kay Lousberg', 'https://kaylousberg.itch.io/kaykit-forest', KAY + 'assets/kaykit/forest-nature-pack-1.0/Assets/gltf/Color1/Tree_4_A_Color1.gltf'),
    ('plump', 'Kenney', 'https://kenney.nl/assets/nature-kit', KENNEY + 'packs/nature-kit/tree-fat.glb'),
    ('soft-pine', 'Kenney', 'https://kenney.nl/assets/nature-kit', KENNEY + 'packs/nature-kit/tree-pinerounda.glb'),
    ('spruce', 'Kenney', 'https://kenney.nl/assets/nature-kit', KENNEY + 'packs/nature-kit/tree-pineroundc.glb'),
]


def fetch(url, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        with urllib.request.urlopen(url) as response:
            destination.write_bytes(response.read())
    return destination.read_bytes()


def download():
    records = []
    for name, author, source, url in SOURCES:
        folder = CACHE / name / 'model'
        path = folder / urllib.parse.urlparse(url).path.split('/')[-1]
        data = fetch(url, path)
        downloads = [{'url': url, 'sha256': hashlib.sha256(data).hexdigest()}]
        if path.suffix == '.gltf':
            spec = json.loads(data)
            for entry in spec.get('buffers', []) + spec.get('images', []):
                uri = entry.get('uri', '')
                if not uri or uri.startswith('data:'):
                    continue
                target = (folder / uri).resolve()
                if not target.is_relative_to(CACHE.resolve()):
                    raise ValueError('Source asset escapes the download cache')
                dependency = urllib.parse.urljoin(url, uri)
                blob = fetch(dependency, target)
                downloads.append({'url': dependency, 'sha256': hashlib.sha256(blob).hexdigest()})
        records.append({'name': name, 'author': author, 'source': source, 'path': str(path), 'downloads': downloads})
    (CACHE / 'sources.json').write_text(json.dumps(records, indent=2) + '\n')
    licenses = OUTPUT / 'licenses'
    fetch(KAY + 'LICENSES/KayKit-CC0-License.txt', licenses / 'meadow-kaykit-CC0.txt')
    subprocess.run([os.environ.get('BLENDER_PATH', 'blender'), '-b', '-t', '2',
                    '--python-exit-code', '1', '--python', str(Path(__file__).resolve()),
                    '--', '--convert'], check=True)


def convert():
    import bpy
    from mathutils import Vector

    records = json.loads((CACHE / 'sources.json').read_text())
    entries = []
    for record in records:
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
        bpy.ops.import_scene.gltf(filepath=record['path'])
        meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
        low = min((obj.matrix_world @ Vector(corner)).z for obj in meshes for corner in obj.bound_box)
        high = max((obj.matrix_world @ Vector(corner)).z for obj in meshes for corner in obj.bound_box)
        height = max(.001, high - low)
        texture_pixels = {}
        for obj in meshes:
            mesh = obj.data
            if mesh.color_attributes.get('COLOR_0'):
                mesh.color_attributes.remove(mesh.color_attributes['COLOR_0'])
            colors = mesh.color_attributes.new(name='COLOR_0', type='FLOAT_COLOR', domain='CORNER')
            mesh.color_attributes.active_color = colors
            uv = mesh.uv_layers.active
            for face in mesh.polygons:
                material = obj.material_slots[face.material_index].material
                nodes = material.node_tree.nodes if material and material.use_nodes else []
                base = next((node for node in nodes if node.type == 'BSDF_PRINCIPLED'), None)
                image = next((node.image for node in nodes if node.type == 'TEX_IMAGE' and node.image), None)
                for loop_index in face.loop_indices:
                    color = list(base.inputs['Base Color'].default_value[:3]) if base else [.5, .5, .5]
                    if image and uv:
                        if image.name not in texture_pixels:
                            texture_pixels[image.name] = list(image.pixels[:])
                        pixels = texture_pixels[image.name]
                        width, rows = image.size
                        coord = uv.data[loop_index].uv
                        x = min(width-1, max(0, int((coord.x % 1) * width)))
                        y = min(rows-1, max(0, int((coord.y % 1) * rows)))
                        start = (y * width + x) * 4
                        color = [color[i] * pixels[start+i] for i in range(3)]
                    vertex = mesh.vertices[mesh.loops[loop_index].vertex_index]
                    world_height = ((obj.matrix_world @ vertex.co).z - low) / height
                    green = color[1] > color[0] * 1.08 and (
                        color[1] > color[2] * 1.05 or color[2] > color[0] * 1.15)
                    if green:
                        # Preserve the source gradient but bring packs into one
                        # soft, spring-green palette. These are linear RGB colors.
                        luminance = .21 * color[0] + .72 * color[1] + .07 * color[2]
                        shade = min(1.15, max(.7, .82 + luminance * .6))
                        color = [.22 * shade, .36 * shade, .13 * shade]
                    shade = .88 + world_height * .12
                    colors.data[loop_index].color = (*[channel * shade for channel in color], 1)
            painted = bpy.data.materials.new('Meadow tree vertex palette')
            painted.use_nodes = True
            bsdf = painted.node_tree.nodes.get('Principled BSDF')
            bsdf.inputs['Roughness'].default_value = 1
            vertex_color = painted.node_tree.nodes.new('ShaderNodeVertexColor')
            vertex_color.layer_name = 'COLOR_0'
            painted.node_tree.links.new(vertex_color.outputs['Color'], bsdf.inputs['Base Color'])
            mesh.materials.clear()
            mesh.materials.append(painted)
            for face in mesh.polygons:
                face.material_index = 0
            if uv:
                mesh.uv_layers.remove(uv)
            obj.name = 'Meadow ' + record['name']
        bpy.ops.object.select_all(action='DESELECT')
        for obj in meshes:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        if len(meshes) > 1:
            bpy.ops.object.join()
        tree = bpy.context.view_layer.objects.active
        triangles = sum(len(face.vertices) - 2 for face in tree.data.polygons)
        file = 'models/meadow-tree-' + record['name'] + '.glb'
        target = OUTPUT / file
        target.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True,
                                  export_materials='EXPORT', export_normals=True,
                                  export_vertex_color='ACTIVE', export_all_vertex_colors=False,
                                  export_texcoords=False, export_animations=False)
        blob = target.read_bytes()
        entries.append({
            'name': 'meadow:tree-' + record['name'], 'file': file, 'type': 'gltf',
            'author': record['author'], 'source': record['source'], 'license': 'CC0-1.0',
            'licenseEvidence': 'licenses/meadow-tree-sources.md',
            'downloads': record['downloads'], 'sha256': hashlib.sha256(blob).hexdigest(),
            'bytes': len(blob), 'triangles': triangles, 'fixedDetail': True,
            'modifications': 'Original low-poly silhouette and normals retained. Original material/UV palette sampled to opaque vertex colors; greens harmonized; UV textures removed. No LODs, billboards, or decimation.',
        })
        print(record['name'], triangles, 'triangles', len(blob), 'bytes', flush=True)
    manifest_path = OUTPUT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    manifest['models'] = [entry for entry in manifest['models'] if not entry['name'].startswith('meadow:tree-')] + entries
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    if '--convert' in sys.argv:
        convert()
    else:
        download()
