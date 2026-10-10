#!/usr/bin/env python3
"""Cycles diffuse GI for Sunstone's architecture, terrain and racer probe volume.

Run export-lighting-scene, bake-course-lighting and bake-mesh-lighting first.
Then: blender -b -t 8 --python tools/bake-sunstone-gi.py
Direct sunlight is subtracted from the diffuse bake and stored as visibility
in alpha. Runtime takes the minimum of baked and live shadow visibility.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import time

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(os.environ.get('LIGHTING_SCENE_DIR', '/tmp/turbo-trail-lighting-scenes'))
DEST = ROOT / 'assets/lighting/sunstone-ruins'
meta_bytes = (SOURCE / 'sunstone-ruins.json').read_bytes()
meta = json.loads(meta_bytes)
binary = (SOURCE / 'sunstone-ruins.bin').read_bytes()
digest = hashlib.sha256(meta_bytes + binary).hexdigest()
gi = meta['globalIllumination']
probe_heights = [1.3, 3.8, 18.8]
for station in gi['stations']:
    station['positions'] += [[p[0], p[1] + 17.5, p[2]] for p in station['positions'][:3]]
positions = np.frombuffer(binary, '<f4', meta['positions'] * 3, meta['offsets'][0]).reshape(-1, 3)
faces = np.frombuffer(binary, '<u4', meta['triangles'] * 3, meta['offsets'][1]).reshape(-1, 3)
colors = np.frombuffer(binary, '<f4', meta['triangles'] * 4, meta['offsets'][2]).reshape(-1, 4)
receivers = np.frombuffer(binary, 'u1', meta['triangles'], meta['offsets'][3])
light_uvs = np.frombuffer(binary, '<f4', meta['positions'] * 2, meta['surfaceUvOffset']).reshape(-1, 2)
world_normals = np.frombuffer(binary, '<f4', meta['positions'] * 3, meta['normalOffset']).reshape(-1, 3)
surface = BVHTree.FromPolygons(positions.tolist(), faces[receivers == 1].tolist(), all_triangles=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = int(os.environ.get('SUNSTONE_GI_SAMPLES', '128'))
scene.cycles.seed = 173
scene.cycles.max_bounces = 5
scene.cycles.diffuse_bounces = 4
scene.cycles.glossy_bounces = 0
scene.cycles.transmission_bounces = 4
scene.cycles.transparent_max_bounces = 8
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.035
scene.render.bake.margin = 4
scene.render.bake.use_clear = True
scene.render.bake.use_pass_color = False
scene.render.bake.normal_space = 'OBJECT'  # receivers are already in world coordinates
scene.view_settings.view_transform = 'Standard'

world = bpy.data.worlds.new('Sunstone sky irradiance')
world.use_nodes = True
scene.world = world
nodes = world.node_tree.nodes
links = world.node_tree.links
background = nodes.get('Background')
coordinate = nodes.new('ShaderNodeTexCoord')
separate = nodes.new('ShaderNodeSeparateXYZ')
links.new(coordinate.outputs['Normal'], separate.inputs[0])
mapping = nodes.new('ShaderNodeMapRange')
mapping.inputs['From Min'].default_value = -1
mapping.inputs['From Max'].default_value = 1
links.new(separate.outputs['Y'], mapping.inputs['Value'])
mix = nodes.new('ShaderNodeMixRGB')
mix.inputs[1].default_value = (*gi['sky']['bottom'], 1)
mix.inputs[2].default_value = (*gi['sky']['top'], 1)
links.new(mapping.outputs[0], mix.inputs[0])
links.new(mix.outputs[0], background.inputs['Color'])
background.inputs['Strength'].default_value = 1

sun_data = bpy.data.lights.new('Sunstone sun', 'SUN')
sun_data.color = gi['sun']['color']
sun_data.energy = gi['sun']['intensity']
sun_data.angle = 0.018
sun = bpy.data.objects.new('Sunstone sun', sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler = (-Vector(gi['sun']['direction'])).to_track_quat('-Z', 'Y').to_euler()
lamps = []
for index, pool in enumerate(meta['lights']):
    data = bpy.data.lights.new(f'Baked lamp {index}', 'POINT')
    data.color = pool['color']
    data.energy = min(9, pool['intensity']) * pool['radius'] ** 2 * 0.3
    data.shadow_soft_size = max(pool.get('area', [1.2])) * 0.25
    obj = bpy.data.objects.new(data.name, data)
    obj.location = pool['position']
    scene.collection.objects.link(obj)
    lamps.append((data, data.energy))

materials = {}
def material_for(color):
    # Preserve surface albedo for transport. Lightmap output excludes it.
    key = tuple(round(float(c), 3) for c in color)
    if key not in materials:
        material = bpy.data.materials.new(f'Diffuse {len(materials)}')
        material.use_nodes = True
        nodes = material.node_tree.nodes
        shader = nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = (*key[:3], 1)
        shader.inputs['Roughness'].default_value = 1
        if key[3] < 0.99:
            transparent = nodes.new('ShaderNodeBsdfTransparent')
            blend = nodes.new('ShaderNodeMixShader')
            blend.inputs[0].default_value = key[3]
            material.node_tree.links.new(transparent.outputs[0], blend.inputs[1])
            material.node_tree.links.new(shader.outputs[0], blend.inputs[2])
            material.node_tree.links.new(blend.outputs[0], nodes.get('Material Output').inputs['Surface'])
        materials[key] = material
    return materials[key]

def make_mesh(name, vertices, triangles, face_colors=None, uvs=None, normals=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], triangles)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    if face_colors is None:
        mesh.materials.append(material_for([0.72, 0.65, 0.48, 1]))
    else:
        slots = {}
        indices = []
        for color in face_colors:
            mat = material_for(color)
            if mat.name not in slots:
                slots[mat.name] = len(mesh.materials)
                mesh.materials.append(mat)
            indices.append(slots[mat.name])
        mesh.polygons.foreach_set('material_index', indices)
    if uvs is not None:
        layer = mesh.uv_layers.new(name='Baked irradiance')
        loop_vertices = np.empty(len(mesh.loops), dtype=np.int32)
        mesh.loops.foreach_get('vertex_index', loop_vertices)
        layer.data.foreach_set('uv', np.asarray(uvs)[loop_vertices].ravel())
    if normals is not None:
        mesh.polygons.foreach_set('use_smooth', [True] * len(mesh.polygons))
        mesh.normals_split_custom_set_from_vertices(normals)
    return obj

def compact_mesh(name, mask, with_uv=False):
    selected = faces[mask]
    used, inverse = np.unique(selected, return_inverse=True)
    return make_mesh(name, positions[used].tolist(), inverse.reshape(-1, 3).tolist(),
                     colors[mask], light_uvs[used] if with_uv else None,
                     world_normals[used].tolist())

obstacles = compact_mesh('Actual Sunstone geometry', receivers != 2)
architecture = compact_mesh('Architecture lightmap receiver', receivers == 2, True)

def ground_receiver(name, bounds, resolution):
    # A dense receiver follows the highest authored terrain/road at each XZ.
    # Original surfaces remain in the transport scene, so their albedo bounces.
    cells = resolution // 2
    vertices, normals, uvs, triangles = [], [], [], []
    height_map = np.zeros((resolution, resolution, 4), np.float32)
    low, high = meta['heightRange']
    for row in range(cells + 1):
        z = bounds[1] + row / cells * bounds[3]
        for column in range(cells + 1):
            x = bounds[0] + column / cells * bounds[2]
            hit, normal, _, _ = surface.ray_cast(Vector((x, high + 20, z)), Vector((0, -1, 0)), high - low + 40)
            y = hit.y if hit else -18
            vertices.append((x, y + 0.035, z))
            normals.append(tuple(normal) if normal else (0, 1, 0))
            uvs.append((column / cells, row / cells))
            if row < cells and column < cells:
                a = row * (cells + 1) + column
                triangles.extend([(a, a + cells + 1, a + 1), (a + 1, a + cells + 1, a + cells + 2)])
    for row in range(resolution):
        z = bounds[1] + (row + 0.5) / resolution * bounds[3]
        for column in range(resolution):
            x = bounds[0] + (column + 0.5) / resolution * bounds[2]
            hit, _, _, _ = surface.ray_cast(Vector((x, high + 20, z)), Vector((0, -1, 0)), high - low + 40)
            y = hit.y if hit else -18
            encoded = int(np.clip((y - low) / (high - low), 0, 1) * 65535)
            height_map[row, column] = [encoded // 256 / 255, encoded % 256 / 255, 0, 1]
    obj = make_mesh(name, vertices, triangles, uvs=uvs, normals=normals)
    obj.visible_diffuse = False
    obj.visible_shadow = False
    return obj, height_map

def probe_receiver():
    vertices, normals, uvs, triangles = [], [], [], []
    records = [p for station in gi['stations'] for p in station['positions']]
    columns = 32
    rows = math.ceil(len(records) / columns)
    for index, position in enumerate(records):
        start = len(vertices)
        tile_x, tile_y = index % columns, index // columns
        for i in range(9):
            theta = math.pi * i / 8
            for j in range(17):
                phi = math.tau * j / 16
                normal = (math.sin(theta) * math.cos(phi), math.cos(theta), math.sin(theta) * math.sin(phi))
                vertices.append(tuple(position[k] + normal[k] * 0.035 for k in range(3)))
                normals.append(normal)
                uvs.append(((tile_x + j / 16) / columns, (tile_y + i / 8) / rows))
                if i < 8 and j < 16:
                    a = start + i * 17 + j
                    triangles.extend([(a, a + 1, a + 17), (a + 1, a + 18, a + 17)])
    obj = make_mesh('Racer directional probe receivers', vertices, triangles, uvs=uvs, normals=normals)
    obj.visible_diffuse = False
    obj.visible_shadow = False
    return obj, (columns * 16, rows * 8), records

def save_image(path, pixels):
    image = bpy.data.images.new(path.stem, width=pixels.shape[1], height=pixels.shape[0], alpha=True)
    image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(pixels.ravel())
    image.filepath_raw = str(path)
    image.file_format = 'PNG'
    image.save()
    bpy.data.images.remove(image)

def bake_pass(obj, width, height, kind, passes=None):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    image = bpy.data.images.new(f'{obj.name} {kind}', width=width, height=height, alpha=True, float_buffer=True)
    image.colorspace_settings.name = 'Non-Color'
    for material in obj.data.materials:
        nodes = material.node_tree.nodes
        for node in nodes:
            node.select = False
        node = nodes.new('ShaderNodeTexImage')
        node.image = image
        node.select = True
        nodes.active = node
    arguments = {'type': kind}
    if passes is not None:
        arguments['pass_filter'] = passes
    bpy.ops.object.bake(**arguments)
    pixels = np.empty(width * height * 4, np.float32)
    image.pixels.foreach_get(pixels)
    for material in obj.data.materials:
        for node in list(material.node_tree.nodes):
            if node.type == 'TEX_IMAGE' and node.image == image:
                material.node_tree.nodes.remove(node)
    bpy.data.images.remove(image)
    return pixels.reshape(height, width, 4)

sun_direction = np.array(gi['sun']['direction'])
sun_radiance = max(gi['sun']['color']) * gi['sun']['intensity'] / math.pi
def bake_gi(obj, dimensions):
    width, height = dimensions
    background.inputs['Strength'].default_value = 1
    for lamp, energy in lamps:
        lamp.energy = energy
    combined = bake_pass(obj, width, height, 'DIFFUSE', {'DIRECT', 'INDIRECT'})
    background.inputs['Strength'].default_value = 0
    for lamp, _ in lamps:
        lamp.energy = 0
    direct_sun = bake_pass(obj, width, height, 'DIFFUSE', {'DIRECT'})
    normals = bake_pass(obj, width, height, 'NORMAL')[:, :, :3] * 2 - 1
    cosine = np.maximum(0, normals @ sun_direction)
    visibility = np.where(cosine > 0.02, direct_sun[:, :, :3].max(axis=2) / np.maximum(0.001, cosine * sun_radiance), 1)
    result = np.zeros_like(combined)
    result[:, :, :3] = np.maximum(0, combined[:, :, :3] - direct_sun[:, :, :3])
    result[:, :, 3] = np.clip(visibility, 0, 1)
    background.inputs['Strength'].default_value = 1
    for lamp, energy in lamps:
        lamp.energy = energy
    return result, normals

started = time.monotonic()
outputs = []
def record_image(name, pixels):
    path = DEST / name
    save_image(path, np.clip(pixels, 0, 1))
    outputs.append({'file': name, 'width': pixels.shape[1], 'height': pixels.shape[0], 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})

scale = 2.0
reuse = os.environ.get('SUNSTONE_GI_REUSE') == '1'
previous_bake = json.loads((DEST / 'bake.json').read_text())
if reuse:
    previous_gi = previous_bake.get('globalIllumination', {})
    if previous_gi.get('sourceSceneSha256') != digest or previous_gi.get('samples') != scene.cycles.samples:
        raise RuntimeError('Cached GI does not match this scene/sample count')
    outputs = [p for p in previous_bake['outputs'] if p['file'] in ['architecture-gi.png', 'ground-gi.png', 'ground-gi-height.png', 'temple-gi.png', 'temple-gi-height.png']]
    if len(outputs) != 5 or any(hashlib.sha256((DEST / p['file']).read_bytes()).hexdigest() != p['sha256'] for p in outputs):
        raise RuntimeError('Cached GI image integrity check failed')
else:
    architecture_gi, _ = bake_gi(architecture, (meta['surfaceLightmap']['resolution'],) * 2)
    architecture_gi[:, :, :3] /= scale
    record_image('architecture-gi.png', architecture_gi)
    del architecture_gi
ground_metadata = {}
for name, bounds, resolution in [('ground', meta['bounds'], 1024), ('temple', gi['templeBounds'], 512)]:
    if not reuse:
        obj, heights = ground_receiver(f'{name} irradiance receiver', bounds, resolution)
        ground_gi, _ = bake_gi(obj, (resolution, resolution))
        ground_gi[:, :, :3] /= scale
        record_image(f'{name}-gi.png', ground_gi)
        record_image(f'{name}-gi-height.png', heights)
        bpy.data.objects.remove(obj, do_unlink=True)
        del ground_gi, heights
    ground_metadata[name] = {'file': f'{name}-gi.png', 'height': f'{name}-gi-height.png', 'bounds': bounds, 'resolution': resolution}

obj, dimensions, probe_positions = probe_receiver()
scene.render.bake.margin = 0
probe_gi, probe_normals = bake_gi(obj, dimensions)
coefficients = []
for index in range(len(probe_positions)):
    x, y = index % 32 * 16, index // 32 * 8
    n = probe_normals[y:y+8, x:x+16].reshape(-1, 3)
    rgb = probe_gi[y:y+8, x:x+16, :3].reshape(-1, 3)
    nx, ny, nz = n[:, 0], n[:, 1], n[:, 2]
    basis = np.column_stack([np.full(len(n), .282095), .488603*ny, .488603*nz, .488603*nx,
                             1.092548*nx*ny, 1.092548*ny*nz, .315392*(3*nz*nz-1),
                             1.092548*nx*nz, .546274*(nx*nx-ny*ny)])
    weight = np.sqrt(np.maximum(.01, 1 - ny*ny))[:, None]
    fitted = np.linalg.lstsq(basis * weight, rgb * weight, rcond=None)[0]
    sunlit = n @ sun_direction > .15
    visibility = probe_gi[y:y+8, x:x+16, 3].reshape(-1)[sunlit].mean() if sunlit.any() else 1
    coefficients.extend([*fitted.ravel().tolist(), float(visibility)])
probe_binary = np.asarray(coefficients, dtype='<f4').tobytes()
(DEST / 'probe-lighting.bin').write_bytes(probe_binary)
probe_metadata = {
    'version': 1, 'sourceSceneSha256': digest,
    'format': 'Float32 little-endian: 9 RGB diffuse-irradiance SH coefficients, then sun visibility; height-major and lane-minor probes per station.',
    'lanes': [-.65, 0, .65], 'heights': probe_heights,
    'stations': gi['stations'],
    'binary': {'file': 'probe-lighting.bin', 'bytes': len(probe_binary), 'sha256': hashlib.sha256(probe_binary).hexdigest()},
}
(DEST / 'probe-lighting.json').write_text(json.dumps(probe_metadata, separators=(',', ':')) + '\n')
bake_path = DEST / 'bake.json'
bake = json.loads(bake_path.read_text())
if bake['sourceSceneSha256'] != digest:
    raise RuntimeError('Regenerate the ground/mesh bakes from this scene before installing Cycles GI')
bake['globalIllumination'] = {
    'version': 1, 'method': 'Cycles path-traced diffuse illumination, 4 diffuse bounces; direct sun removed and stored as visibility in alpha.',
    'samples': scene.cycles.samples, 'diffuseBounces': 4, 'scale': scale,
    'sourceSceneSha256': digest, 'sunDirection': gi['sun']['direction'],
    'architecture': {**meta['surfaceLightmap'], 'file': 'architecture-gi.png'},
    **ground_metadata,
    'probes': {'metadata': 'probe-lighting.json', 'count': len(probe_positions), 'metadataSha256': hashlib.sha256((DEST / 'probe-lighting.json').read_bytes()).hexdigest()},
    'runtimeTextureBytes': sum(p['width']*p['height']*4 for p in outputs),
}
bake['outputs'] = [p for p in bake['outputs'] if p['file'] not in {o['file'] for o in outputs}] + outputs
bake_path.write_text(json.dumps(bake, indent=2) + '\n')
print(f'Sunstone GI: {len(probe_positions)} directional probes, {len(outputs)} textures, {time.monotonic()-started:.1f}s', flush=True)
