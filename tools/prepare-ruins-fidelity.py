#!/usr/bin/env python3
"""Blender 4.3 script: adapt attributed STK art to compact, AO-baked GLBs.

Usage: blender -b -t 2 --python tools/prepare-ruins-fidelity.py -- /tmp/ruins-stk-source
Source is SuperTuxKart 1.4 full asset archive (pinned hash in manifest).
No direct sun is baked: the vertex AO bake traces geometry and the local ground.
"""
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'assets/courses/packs/sunstone-ruins'
SOURCE = Path(sys.argv[sys.argv.index('--') + 1])
sys.path.insert(0, str(ROOT / 'tools/vendor/stk-spm'))
import import_spm

DOWNLOAD = 'https://github.com/supertuxkart/stk-assets-mobile/releases/download/1.4/stk-assets-full.zip'
ASSETS = {
    'vase': ('stklib_aztekVase_a', 'stklib_aztekVase_a_main.spm', 'Anon; Jean-Manuel Clémençon', 'CC-BY-SA-4.0'),
    'shrub': ('stklib_autumnSmallBush_a', 'stklib_autumnSmallBush_a_main.spm', 'Jean-Manuel Clémençon', 'CC-BY-SA-4.0'),
    'grass': ('stklib_animGrass_a', 'stklib_animGrass_a_main.spm', 'Jean-Manuel Clémençon', 'CC-BY-SA-4.0'),
    'palm': ('hd_palmTree_a', 'hd_palmTree_a_main.spm', 'Oliver M-H; Jean-Manuel Clémençon', 'CC-BY-SA-3.0'),
    'shrine': ('stklib_aztecHouse_a', 'stklib_aztecHouse_a_main_high.spm', 'Jean-Manuel Clémençon', 'CC-BY-SA-4.0'),
    'ruined-house': ('stklib_aztecHouse_b', 'stklib_aztecHouse_b_main.spm', 'Jean-Manuel Clémençon', 'CC-BY-SA-4.0'),
    'hut': ('stklib_aztecHut_a', 'stklib_aztecHut_a_main.spm', 'Anon; Jean-Manuel Clémençon', 'CC-BY-SA-4.0'),
    'torch': ('stklib_aztekTorch_a', 'stklib_aztekTorch_a_main.spm', 'Jean-Manuel Clémençon', 'CC-BY-SA-4.0'),
    'dragon': ('stklib_aztecFountain_a', 'stklib_aztecFountain_a_main.spm', 'Jean-Manuel Clémençon', 'CC-BY-SA-4.0'),
}


def image(name, folder, extra):
    p = Path(folder) / name
    if not p.exists():
        p = SOURCE / 'textures' / name
    if not p.exists():
        raise RuntimeError(f'Missing licensed texture {p}')
    im = bpy.data.images.load(str(p), check_existing=True)
    w, h = im.size
    if max(w, h) > 512:
        im.scale(max(1, round(w * 512 / max(w, h))), max(1, round(h * 512 / max(w, h))))
    im.pack()
    return im


def material(im, decal, name, extra):
    m = bpy.data.materials.new(name or 'plain')
    m.use_nodes = True
    m.use_backface_culling = False if 'Leaf' in name or 'thatch' in name else True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = .88
    # Make the ray-traced vertex AO generated below part of the exported
    # material graph. glTF drops unused color attributes, even when the
    # exporter is asked to include all vertex colors.
    ao = m.node_tree.nodes.new('ShaderNodeVertexColor')
    ao.layer_name = 'Baked occlusion'
    ao.label = 'Baked geometry and ground occlusion'
    multiply = m.node_tree.nodes.new('ShaderNodeMixRGB')
    multiply.blend_type = 'MULTIPLY'
    multiply.inputs[0].default_value = 1.0
    if im:
        tex = m.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = im
        m.node_tree.links.new(tex.outputs['Color'], multiply.inputs[1])
        if im.channels == 4:
            m.node_tree.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
            m.surface_render_method = 'DITHERED'
    else:
        multiply.inputs[1].default_value = (1, 1, 1, 1)
    m.node_tree.links.new(ao.outputs['Color'], multiply.inputs[2])
    m.node_tree.links.new(multiply.outputs['Color'], bsdf.inputs['Base Color'])
    return m


import_spm.getImage = image
import_spm.create_material = material


def bake_ao(objects):
    """Actual spatial ray-traced AO on mesh vertices, retained beside base UVs."""
    verts, polys = [], []
    zmin = min((o.matrix_world @ v.co).z for o in objects for v in o.data.vertices)
    zmax = max((o.matrix_world @ v.co).z for o in objects for v in o.data.vertices)
    reach = max(.5, (zmax - zmin) * .3)
    for o in objects:
        off = len(verts)
        verts.extend(o.matrix_world @ v.co for v in o.data.vertices)
        polys.extend(tuple(off + i for i in p.vertices) for p in o.data.polygons)
    tree = BVHTree.FromPolygons(verts, polys)
    rays = 20
    for o in objects:
        mesh = o.data
        old = mesh.color_attributes.active_color
        colors = mesh.color_attributes.new(name='Baked occlusion', type='FLOAT_COLOR', domain='CORNER')
        mesh.color_attributes.active_color = colors
        factors = {}
        for v in mesh.vertices:
            p = o.matrix_world @ v.co
            n = (o.matrix_world.to_3x3() @ v.normal).normalized()
            tangent = n.cross(Vector((0, 0, 1)))
            if tangent.length < .01:
                tangent = n.cross(Vector((1, 0, 0)))
            tangent.normalize()
            bitangent = n.cross(tangent)
            hits = 0
            for j in range(rays):
                z = math.sqrt((j + .5) / rays)
                r = math.sqrt(1 - z*z)
                a = j * 2.3999632297
                d = tangent * (math.cos(a)*r) + bitangent * (math.sin(a)*r) + n*z
                origin = p + n * (reach * .001)
                hit = tree.ray_cast(origin, d, reach)[0]
                ground = d.z < -.001 and 0 < (zmin - origin.z) / d.z < reach
                hits += hit is not None or ground
            factors[v.index] = .62 + .38 * (1 - hits / rays)
        for loop in mesh.loops:
            base = old.data[loop.index].color if old and old.domain == 'CORNER' else (1, 1, 1, 1)
            a = factors[loop.vertex_index]
            colors.data[loop.index].color = (base[0]*a, base[1]*a, base[2]*a, base[3])
        # Remove the old color layer so glTF exports our ray-traced result.
        if old:
            mesh.color_attributes.remove(old)
        mesh.color_attributes.active_color = colors


def mask_alpha(path):
    data = path.read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20+length])
    for m in doc.get('materials', []):
        if m.get('alphaMode') == 'BLEND':
            m['alphaMode'] = 'MASK'
            m['alphaCutoff'] = .42
    js = json.dumps(doc, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    tail = data[20+length:]
    path.write_bytes(struct.pack('<III', 0x46546c67, 2, 20+len(js)+len(tail)) + struct.pack('<II', len(js), 0x4e4f534a) + js + tail)


(PACK / 'licenses').mkdir(exist_ok=True)
(PACK / 'models').mkdir(exist_ok=True)
shutil.copyfile(SOURCE / 'textures/licenses.txt', PACK / 'licenses/stk-textures.txt')
manifest = json.loads((PACK / 'manifest.json').read_text())
manifest['models'] = [m for m in manifest['models'] if not m['name'].startswith('ruins:')]
manifest['archiveSha256'] = 'ad61912093e7d4b399c8e4841156f45550a8b60dc59a290ad84058a9bae0622d'
for name, (foldername, filename, author, license_id) in ASSETS.items():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for im in list(bpy.data.images):
        bpy.data.images.remove(im)
    folder = SOURCE / 'library' / foldername
    import_spm.loadSPM(bpy.context, str(folder / filename), str(folder))
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bake_ao(objects)
    path = PACK / 'models' / (name + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', export_animations=False,
                              export_yup=True, export_extras=True, export_all_vertex_colors=True)
    mask_alpha(path)
    shutil.copyfile(folder / 'licenses.txt', PACK / 'licenses' / (name + '.txt'))
    manifest['models'].append({'name': 'ruins:' + name, 'file': 'models/' + path.name,
        'type': 'gltf', 'source': 'https://supertuxkart.net', 'download': DOWNLOAD,
        'sourcePath': 'library/' + foldername + '/' + filename, 'author': author,
        'license': license_id, 'attribution': 'licenses/' + name + '.txt',
        'modifications': '512px embedded textures, 20-ray geometry/ground vertex AO, cutout foliage, GLB conversion',
        'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    print('EXPORTED', name, 'vertices', sum(len(o.data.vertices) for o in objects))
# Sculpt downloaded Kenney rock outlines offline and bake a stratified atlas.
for name, src in [('cliff', 'rock-tallb'), ('boulder', 'rock-largee')]:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(PACK / 'models' / (src + '.glb')))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        world = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = world
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    height = max(v.co.z for v in o.data.vertices) - min(v.co.z for v in o.data.vertices)
    bevel = o.modifiers.new('Rounded eroded edges', 'BEVEL')
    bevel.width = height * .025
    bevel.segments = 3
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for p in o.data.polygons:
        p.use_smooth = True
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(island_margin=.025)
    bpy.ops.object.mode_set(mode='OBJECT')
    m = bpy.data.materials.new('Baked warm sandstone strata')
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = .94
    texcoord = nodes.new('ShaderNodeTexCoord')
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 9
    noise.inputs['Detail'].default_value = 3
    links.new(texcoord.outputs['Generated'], noise.inputs['Vector'])
    wave = nodes.new('ShaderNodeTexWave')
    wave.bands_direction = 'Z'
    wave.inputs['Scale'].default_value = 4.5
    wave.inputs['Distortion'].default_value = 3
    wave.inputs['Detail Scale'].default_value = .8
    links.new(texcoord.outputs['Generated'], wave.inputs['Vector'])
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = .1
    ramp.color_ramp.elements[0].color = (.43, .27, .15, 1)
    ramp.color_ramp.elements[1].position = .92
    ramp.color_ramp.elements[1].color = (.78, .59, .36, 1)
    links.new(wave.outputs['Color'], ramp.inputs['Fac'])
    mix = nodes.new('ShaderNodeMixRGB')
    mix.blend_type = 'MULTIPLY'
    mix.inputs[0].default_value = .18
    links.new(ramp.outputs['Color'], mix.inputs[1])
    links.new(noise.outputs['Fac'], mix.inputs[2])
    links.new(mix.outputs[0], bsdf.inputs['Base Color'])
    o.data.materials.clear()
    o.data.materials.append(m)
    im = bpy.data.images.new(name + '-strata-atlas', width=512, height=512)
    target = nodes.new('ShaderNodeTexImage')
    target.image = im
    nodes.active = target
    bpy.context.scene.render.engine = 'CYCLES'
    bpy.context.scene.cycles.samples = 8
    bpy.context.scene.render.bake.use_pass_direct = False
    bpy.context.scene.render.bake.use_pass_indirect = False
    bpy.context.scene.render.bake.use_pass_color = True
    bpy.context.scene.render.bake.margin = 12
    bpy.ops.object.bake(type='DIFFUSE')
    links.new(target.outputs['Color'], bsdf.inputs['Base Color'])
    im.pack()
    bake_ao([o])
    path = PACK / 'models' / (name + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', export_animations=False,
                              export_yup=True, export_all_vertex_colors=True)
    manifest['models'].append({'name': 'ruins:' + name, 'file': 'models/' + path.name,
        'type': 'gltf', 'source': 'https://kenney.nl/assets/nature-kit', 'author': 'Kenney',
        'license': 'CC0-1.0', 'modifications': 'Beveled eroded silhouette, offline 512px stratified atlas, ray-traced vertex AO',
        'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
(PACK / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
