#!/usr/bin/env python3
"""Rebuild Emberwing's original Blender geology (no downloaded models).

blender -b -t 2 --python tools/build-emberwing-geology.py
Exports local GLBs, manifest hashes and exact runtime placements. The evaluated
track is the authoring reference; neither driving surfaces nor physics change.
"""
import hashlib
import json
import math
from pathlib import Path
import subprocess

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'assets/courses/packs/emberwing-observatory'
LAYOUT = Path('/tmp/emberwing-layout.json')
subprocess.run(['node', str(ROOT / 'tools/export-emberwing-layout.mjs'), str(LAYOUT)], check=True)
layout = json.loads(LAYOUT.read_text())
manifest = json.loads((PACK / 'manifest.json').read_text())
manifest['models'] = [m for m in manifest['models'] if not m['name'].startswith('ember:')]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
stone = bpy.data.materials.new('Volcanic tuff and columnar basalt')
stone.diffuse_color = (1, 1, 1, 1)
stone.use_nodes = True
bsdf = stone.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value = .94
color = stone.node_tree.nodes.new('ShaderNodeVertexColor')
color.layer_name = 'Color'
stone.node_tree.links.new(color.outputs['Color'], bsdf.inputs['Base Color'])
placements = []
stats = []


def wave(x, z):
    return math.sin(x * .17 + z * .09) * .48 + math.sin(z * .43 - x * .13) * .22


def mesh_object(name, positions, faces, bevel=0):
    """Input coordinates use Three.js Y-up; Blender export restores that basis."""
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(x, -z, y) for x, y, z in positions], [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(stone)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    if bevel:
        modifier = obj.modifiers.new('Weathered column edges', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 1
        modifier.limit_method = 'ANGLE'
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    # Faceted normals preserve the long cooling columns; colors add restrained
    # stratification and crevice shading without an extra texture or material.
    mesh = obj.data
    colors = mesh.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    uv = mesh.uv_layers.new(name='Stone UV')
    for poly in mesh.polygons:
        normal = poly.normal
        light = .78 + .17 * max(0, normal.dot(Vector((-.5, -.3, .8)).normalized()))
        for index in poly.loop_indices:
            vertex = mesh.vertices[mesh.loops[index].vertex_index]
            x, z, y = vertex.co.x, -vertex.co.y, vertex.co.z
            bands = .94 + .06 * math.sin(y * .63 + wave(x, z) * .7)
            tone = light * bands
            # Warm ash highlights over cool basalt, in linear color space.
            colors.data[index].color = (.69 * tone, .66 * tone, .68 * tone, 1)
            if abs(normal.z) > .65:
                uv.data[index].uv = (x / 7, z / 7)
            elif abs(normal.x) > abs(normal.y):
                uv.data[index].uv = (z / 7, y / 7)
            else:
                uv.data[index].uv = (x / 7, y / 7)
    obj.select_set(False)
    return obj


def export(name, objects, lods=None, place=False):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    positions = [obj.matrix_world @ vertex.co for obj in objects for vertex in obj.data.vertices]
    # Bounds in the exported game basis, for restoring normalized asset pivots.
    positions = [(p.x, p.z, -p.y) for p in positions]
    low = [min(p[i] for p in positions) for i in range(3)]
    high = [max(p[i] for p in positions) for i in range(3)]
    size = [high[i] - low[i] for i in range(3)]
    position = [(low[0] + high[0]) / 2, low[1], (low[2] + high[2]) / 2]
    triangles = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objects)
    filename = name.replace('ember:', '') + '.glb'
    path = PACK / 'models' / filename
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                              export_yup=True, export_materials='EXPORT',
                              export_extras=False, export_cameras=False, export_lights=False)
    raw = path.read_bytes()
    entry = dict(name=name, file='models/' + filename, type='gltf',
                 author='Turbo Trail project', license='CC0-1.0',
                 source='Original Blender geometry; tools/build-emberwing-geology.py',
                 attribution='licenses/emberwing-geology.txt',
                 bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest(), triangles=triangles,
                 layoutSha256=layout['digest'])
    if lods:
        entry['lods'] = lods
        entry['lodDistances'] = [0, 110, 240]
    manifest['models'].append(entry)
    stats.append(dict(name=name, triangles=triangles, bytes=len(raw)))
    if place:
        placements.append(dict(name=name, position=[round(n, 6) for n in position],
                               dimensions=[round(n, 6) for n in size]))
    for obj in objects:
        bpy.data.objects.remove(obj, do_unlink=True)


def cliffs(section):
    positions, faces = [], []
    fractions = [0, .025, .08, .15, .24, .40, .64, 1]
    expansion = [0, .2, .1, 1.3, .7, 2.8, 4, 7]
    for side, edge in enumerate(section['edges']):
        base = len(positions)
        for sample in edge:
            x, top, z = sample['p']
            outward = sample['outward']
            for j, fraction in enumerate(fractions):
                # Zero displacement on the seam. The complete relief lies
                # below the query-authored platform; the road stays untouched.
                offset = expansion[j] + (wave(x, z) * .9 if j else 0)
                y = top * (1 - fraction) + (layout['floor'] - 2) * fraction
                if j not in (0, len(fractions) - 1):
                    y += wave(x * .8, z * .8) * .55
                positions.append((x + outward[0] * offset, y, z + outward[2] * offset))
        rows = len(fractions)
        for i in range(len(edge) - 1):
            for j in range(rows - 1):
                a = base + i * rows + j
                quad = (a, a + 1, a + rows + 1, a + rows)
                faces.append(quad if side == 1 else tuple(reversed(quad)))
    return mesh_object(section['name'], positions, faces)


def caldera(sector):
    """A closed, scalloped crater with stratified inner walls and talus skirt."""
    positions, faces = [], []
    centre = layout['caldera']['centre']
    radius = layout['caldera']['radius']
    # Cross-section ascends from the lava shoreline, folds over the rim, then
    # descends outward to the sea. Each quarter is independently culled.
    profile = [(.69, 0), (.73, 4), (.79, 13), (.83, 21), (.86, 23), (.87, 32),
               (.93, 39), (1, 41), (1.04, 35), (1.08, 22), (1.15, 3), (1.23, -43)]
    segments = 48
    for i in range(segments + 1):
        angle = (sector + i / segments) * math.pi / 2
        jagged = math.sin(angle * 9) * .022 + math.sin(angle * 17 + .4) * .012
        peak = math.sin(angle * 5 + .8) * 5 + math.sin(angle * 13) * 2
        for j, (r, height) in enumerate(profile):
            radius_at = radius * (r + jagged * math.sin(j / (len(profile) - 1) * math.pi))
            height += peak * max(0, 1 - abs(j - 7) / 7)
            positions.append((centre[0] + math.cos(angle) * radius_at,
                              centre[1] + height,
                              centre[2] + math.sin(angle) * radius_at))
    rows = len(profile)
    for i in range(segments):
        for j in range(rows - 1):
            a = i * rows + j
            faces.append((a, a + rows, a + rows + 1, a + 1))
    return mesh_object(f'Caldera rim quadrant {sector}', positions, faces)


def buttress(detail):
    """Tightly packed hexagonal cooling columns with broken crowns and talus."""
    positions, faces = [], []
    column_count = [9, 9, 6][detail]
    levels = [3, 2, 2][detail]
    for column in range(column_count):
        angle = column * 2.3999632297
        radius = math.sqrt(column / column_count) * 9
        cx, cz = math.cos(angle) * radius, math.sin(angle) * radius
        height = 26 + 14 * (.5 + .5 * math.sin(column * 1.7 + .8))
        width = 3.4 + .45 * math.sin(column * .7)
        base = len(positions)
        for ring in range(levels + 1):
            f = ring / levels
            for side in range(6):
                a = side * math.pi / 3 + column * .13
                r = width * (1 + .11 * math.sin(ring * 1.9 + column))
                if ring == 0:
                    r *= 1.28
                # Broad vertical columns with chipped, non-level crowns.
                y = height * f
                if ring == levels:
                    y += math.sin(side * 1.4 + column) * .7
                positions.append((cx + math.cos(a) * r, y, cz + math.sin(a) * r))
        for ring in range(levels):
            for side in range(6):
                a = base + ring * 6 + side
                b = base + ring * 6 + (side + 1) % 6
                faces.append((a, b, b + 6, a + 6))
        faces.append(tuple(base + levels * 6 + i for i in range(6)))
        faces.append(tuple(base + i for i in reversed(range(6))))
    return mesh_object('Jointed basalt buttress', positions, faces, bevel=.12 if detail == 0 else 0)


for section in layout['sections']:
    export(section['name'], [cliffs(section)], place=True)
for sector in range(4):
    export(f'ember:caldera-{sector}', [caldera(sector)], place=True)
for detail, suffix in enumerate(['near', 'mid', 'far']):
    export(f'ember:basalt-{suffix}', [buttress(detail)],
           lods={'mid': 'ember:basalt-mid', 'far': 'ember:basalt-far'} if detail == 0 else None)

(PACK / 'licenses/emberwing-geology.txt').write_text(
    'Original Turbo Trail volcanic geology, authored through Blender Python.\n'
    'Dedicated to the public domain under CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/\n'
    'Rebuild: blender -b -t 2 --python tools/build-emberwing-geology.py\n'
    'No external meshes or textures are embedded in these GLB assets.\n')
(PACK / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
data = '// Generated by tools/build-emberwing-geology.py; do not edit placements by hand.\n'
data += 'export const EMBERWING_LAYOUT_DIGEST = ' + json.dumps(layout['digest']) + ';\n'
data += 'export const EMBERWING_GEOLOGY = ' + json.dumps(placements, indent=2) + ';\n'
data_path = ROOT / 'src/courses/adventure/emberwing-geology-data.js'
data_path.write_text(data)
formatter = ROOT / 'node_modules/prettier/bin/prettier.cjs'
if formatter.exists():
    subprocess.run(['node', str(formatter), '--write', str(data_path)], check=True)
print('Geology asset totals:', json.dumps(dict(triangles=sum(s['triangles'] for s in stats),
                                             bytes=sum(s['bytes'] for s in stats))))
print(json.dumps(stats, indent=2))
