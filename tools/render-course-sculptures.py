#!/usr/bin/env python3
"""Blender studio contact sheet for reviewing the exported course sculptures.

blender -b -t 2 --python tools/render-course-sculptures.py
The game screenshots remain the reference for actual course lighting/materials.
"""
import json
import math
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = False
scene.world.color = (.18, .18, .18)
scene.render.resolution_x, scene.render.resolution_y = 1800, 1400
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'Standard'

palette = {
    'windmill-wilds': (.64, .58, .46), 'neon-harbor': (.3, .44, .56),
    'sunstone-ruins': (.76, .53, .28), 'frostpeak-festival': (.55, .8, .95),
    'clockwork-citadel': (.64, .42, .19), 'paper-revel': (.83, .57, .56),
    'tempest-causeway': (.43, .54, .57), 'pocket-pantry': (.7, .47, .35),
    'railstorm-express': (.4, .46, .53), 'metronome-hall': (.49, .23, .31),
    'pelagic-glasshouse': (.54, .67, .6),
}
entries = []
for course in palette:
    pack = ROOT / 'assets/courses/packs' / course
    entries += [(course, pack, m) for m in json.loads((pack / 'manifest.json').read_text())['models']
                if m['name'].startswith('blender:')]

# Typical runtime proportions: source parts are subsequently fitted to the
# old component bounds and scaled at each placement in the game.
display_height = {'temple-column': 10, 'harbor-pier': 10, 'storm-pier': 10,
                  'glacier-cluster': 4, 'ceramic-cup': 2.1, 'preserve-jar': 4,
                  'freight-pipe': 6, 'organ-pipe': 10, 'paper-lantern': 1.3}

for index, (course, pack, entry) in enumerate(entries):
    previous = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(pack / entry['file']))
    objects = [o for o in bpy.data.objects if o not in previous and o.type == 'MESH']
    name = entry['name'].removeprefix('blender:')
    for obj in objects:
        obj.data.transform(Matrix.Diagonal((1, 1, display_height.get(name, 1), 1)))
        if name == 'velvet-drape':
            obj.data.transform(Matrix.Rotation(math.pi / 2, 4, 'Z'))
    vertices = [o.matrix_world @ v.co for o in objects for v in o.data.vertices]
    low = Vector(tuple(min(v[i] for v in vertices) for i in range(3)))
    high = Vector(tuple(max(v[i] for v in vertices) for i in range(3)))
    center = (high + low) * .5
    factor = 2.25 / max(high - low)
    column, row = index % 6, index // 6
    location = Vector(((column - 2.5) * 3.1, (1.5 - row) * 3.1, 0))
    for obj in objects:
        world = obj.matrix_world.copy()
        obj.data.transform(world)
        obj.data.transform(Matrix.Translation(-center))
        # Front elevations stay legible; the tilt also reveals physical depth.
        obj.data.transform(Matrix.Rotation(math.radians(-65), 4, 'X'))
        obj.data.transform(Matrix.Scale(factor, 4))
        obj.parent = None
        obj.matrix_world = Matrix.Translation(location)
        for material in obj.data.materials:
            bsdf = material.node_tree.nodes.get('Principled BSDF')
            for link in list(bsdf.inputs['Base Color'].links):
                material.node_tree.links.remove(link)
            bsdf.inputs['Base Color'].default_value = (*palette[course], 1)
            bsdf.inputs['Roughness'].default_value = .48
            bsdf.inputs['Metallic'].default_value = .45 if course in ['clockwork-citadel', 'railstorm-express'] else .05
    bpy.ops.object.text_add(location=(location.x, location.y - 1.4, 1))
    label = bpy.context.object
    label.data.body = entry['name'].removeprefix('blender:')
    label.data.align_x = 'CENTER'
    label.data.size = .19

bpy.ops.object.camera_add(location=(0, 0, 25))
scene.camera = bpy.context.object
scene.camera.data.type = 'ORTHO'
scene.camera.data.ortho_scale = 19.6
scene.camera.rotation_euler = (0, 0, 0)
for position, power, size in [((-5, 4, 12), 2600, 8), ((7, -2, 9), 1900, 7)]:
    bpy.ops.object.light_add(type='AREA', location=position)
    lamp = bpy.context.object
    lamp.data.energy, lamp.data.shape, lamp.data.size = power, 'DISK', size
    lamp.rotation_euler = (Vector((0, 0, 0)) - lamp.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = str(ROOT / 'docs/screenshots/course-sculptures.png')
bpy.ops.render.render(write_still=True)
