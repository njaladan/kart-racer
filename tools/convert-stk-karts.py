#!/usr/bin/env python3
"""Run with Blender: assemble STK's saved driving poses and separate wheel pivots."""
import math
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools/vendor/stk-spm'))
import import_spm


def create_material(image, decal, name, decal_name):
    # The upstream importer uses legacy alpha properties and decal nodes that
    # glTF cannot export. Use the original diffuse UV map directly instead.
    material = bpy.data.materials.new(name or 'plain')
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = 0.65
    if name == 'stk_darkGrayMetal_a.png':
        shader.inputs['Base Color'].default_value = (0.12, 0.14, 0.16, 1)
        shader.inputs['Metallic'].default_value = 0.5
    elif name in ['gfxGlow_White_a.png', 'stk_headLight_a.png']:
        shader.inputs['Base Color'].default_value = (0.9, 0.95, 1, 1)
        shader.inputs['Emission Color'].default_value = (0.6, 0.75, 1, 1)
        shader.inputs['Emission Strength'].default_value = 0.4
    if image:
        texture = material.node_tree.nodes.new('ShaderNodeTexImage')
        texture.image = image
        material.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])
        if image.channels == 4:
            material.node_tree.links.new(texture.outputs['Alpha'], shader.inputs['Alpha'])
            material.surface_render_method = 'DITHERED'
    return material


def get_image(name, folder, extra):
    # These common shader textures lack per-file notices in the 1.4 release.
    # Replace their small metal/lamp surfaces with original solid materials.
    if name in ['stk_darkGrayMetal_a.png', 'gfxGlow_White_a.png', 'stk_headLight_a.png']:
        return None
    path = Path(folder) / name
    if not path.exists():
        path = Path(folder).parents[1] / 'textures' / name
    if not path.exists():
        raise RuntimeError(f'Missing source texture: {path}')
    return bpy.data.images.load(str(path), check_existing=True)


import_spm.getImage = get_image
import_spm.create_material = create_material
source, destination = map(Path, sys.argv[sys.argv.index('--') + 1:])
for name in ['tux', 'nolok', 'pidgin', 'kiki', 'konqi', 'wilber']:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for image in list(bpy.data.images):
        bpy.data.images.remove(image)
    folder = source / name
    spec = ET.parse(folder / 'kart.xml').getroot()

    def load(filename, parent=None):
        before = set(bpy.context.scene.objects)
        import_spm.loadSPM(bpy.context, str(folder / filename), str(folder))
        objects = set(bpy.context.scene.objects) - before
        if not objects:
            raise RuntimeError(f'No geometry in {name}/{filename}')
        for obj in objects:
            obj.parent = parent
        return objects

    chassis = bpy.data.objects.new('chassis', None)
    bpy.context.collection.objects.link(chassis)
    load(spec.attrib['model-file'], chassis)
    for wheel in spec.find('wheels'):
        pivot = bpy.data.objects.new('wheel-' + wheel.tag, None)
        bpy.context.collection.objects.link(pivot)
        x, y, z = map(float, wheel.attrib['position'].split())
        pivot.location = (x, z, y)
        load(wheel.attrib['model'], pivot)
    # Authored accessories include Kiki's tail and Konqi's scarf. Their XML
    # placements use STK Y-up coordinates; Blender uses Z-up.
    for section in ['speed-weighted-objects']:
        for attachment in spec.findall(section + '/object'):
            pivot = bpy.data.objects.new(section + '-' + attachment.attrib['model'], None)
            bpy.context.collection.objects.link(pivot)
            x, y, z = map(float, attachment.attrib['position'].split())
            pivot.location = (x, z, y)
            rx, ry, rz = map(float, attachment.attrib.get('rotation', '0 0 0').split())
            pivot.rotation_euler = tuple(math.radians(a) for a in (rx, rz, ry))
            sx, sy, sz = map(float, attachment.attrib.get('scale', '1 1 1').split())
            pivot.scale = (sx, sz, sy)
            load(attachment.attrib['model'], pivot)
    for image in bpy.data.images:
        if image.size[0] == 0:
            raise RuntimeError(f'Missing texture: {image.name}')
    destination.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(destination / f'kart-{name}.glb'), export_format='GLB',
        export_animations=False, export_yup=True, export_extras=True,
    )
    print('EXPORTED', name)
