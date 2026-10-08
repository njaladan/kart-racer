#!/usr/bin/env python3
"""Blender BVH offline diffuse visibility/bounce bake for complete static courses.

node tools/export-lighting-scene.mjs
blender -b -t 2 --python tools/bake-course-lighting.py -- windmill-wilds
Uses real placed scene triangles, cosine hemisphere visibility, local material
color bounce and registered lamp pools. No sun direct-light bake, so the runtime
sun shadow is not counted twice. Outputs near-ground irradiance/AO and 16-bit
height encoded in RG, with source digest and reproducible sampling parameters.
Courses with lightVolume metadata additionally receive an occluded colored spill
atlas at authored heights; its lighting replaces ground-only lamp illumination.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import time

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(os.environ.get('LIGHTING_SCENE_DIR', '/tmp/turbo-trail-lighting-scenes'))
arguments = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
courses = arguments or ['windmill-wilds', 'neon-harbor', 'sunstone-ruins', 'frostpeak-festival']
size = int(os.environ.get('LIGHTING_BAKE_SIZE', '768'))
samples = int(os.environ.get('LIGHTING_BAKE_SAMPLES', '12'))
radius = 22.0

def save_image(path, rgba):
    image = bpy.data.images.new(path.stem, width=rgba.shape[1], height=rgba.shape[0], alpha=True)
    image.colorspace_settings.name = 'Non-Color'
    # Blender image rows and world XZ coordinates both run bottom to top.
    image.pixels.foreach_set(rgba.ravel())
    image.filepath_raw = str(path)
    image.file_format = 'PNG'
    image.save()
    bpy.data.images.remove(image)

for course in courses:
    started = time.monotonic()
    metadata_path = SOURCE / f'{course}.json'
    metadata = json.loads(metadata_path.read_text())
    binary = (SOURCE / f'{course}.bin').read_bytes()
    vertices = np.frombuffer(binary, '<f4', metadata['positions'] * 3, metadata['offsets'][0]).reshape(-1, 3)
    faces = np.frombuffer(binary, '<u4', metadata['triangles'] * 3, metadata['offsets'][1]).reshape(-1, 3)
    colors = np.frombuffer(binary, '<f4', metadata['triangles'] * 4, metadata['offsets'][2]).reshape(-1, 4)
    receivers = np.frombuffer(binary, 'u1', metadata['triangles'], metadata['offsets'][3])
    bounds = metadata['bounds']
    ground_faces = faces[receivers.astype(bool)]
    if not len(ground_faces):
        raise RuntimeError(f'{course}: missing marked bakeReceiver terrain')
    # Restrict obstacles to the useful bake volume; the distant background does
    # not need costly rays and cannot produce meaningful local ground occlusion.
    centers = vertices[faces].mean(axis=1)
    useful = (centers[:, 0] > bounds[0] - radius) & (centers[:, 0] < bounds[0] + bounds[2] + radius) & (centers[:, 2] > bounds[1] - radius) & (centers[:, 2] < bounds[1] + bounds[3] + radius)
    bvh = BVHTree.FromPolygons(vertices.tolist(), faces[useful].tolist(), all_triangles=True, epsilon=.001)
    surface = BVHTree.FromPolygons(vertices.tolist(), ground_faces.tolist(), all_triangles=True, epsilon=.001)
    obstacle_colors = colors[useful]
    def transmission(origin, direction, distance):
        """Thin glass/foliage transmits light; opaque walls still occlude it."""
        value = 1.0
        for _ in range(8):
            hit, _, face, travel = bvh.ray_cast(origin, direction, distance)
            if hit is None: return value
            opacity = float(obstacle_colors[face, 3])
            if opacity >= .99: return 0.0
            value *= 1.0 - opacity
            if value < .025: return 0.0
            step = travel + .025
            distance -= step
            if distance <= .025: return value
            origin = origin + direction * step
        return value

    def area_origins(pool):
        center = Vector(pool['position'])
        if not pool.get('area'): return [center]
        size = pool['area']
        return [center + Vector((x * size[0], y * size[1], z * size[2]))
                for x, y, z in [(-.25,-.25,.25),(.25,-.25,-.25),(-.25,.25,-.25),(.25,.25,.25)]]
    light = np.zeros((size, size, 4), dtype=np.float32)
    heights = np.zeros((size, size, 4), dtype=np.float32)
    directions = []
    for sample in range(samples):
        # Cosine-weighted deterministic hemisphere: repeatable and no random
        # blotches from frame to frame. Tangent rotation below breaks grid bias.
        r = math.sqrt((sample + .5) / samples)
        a = sample * 2.399963229728653
        directions.append(Vector((math.cos(a) * r, math.sqrt(1 - r*r), math.sin(a) * r)))
    lights = metadata['lights']
    volume = metadata.get('lightVolume')
    low, high = metadata['heightRange']
    for row in range(size):
        z = bounds[1] + (row + .5) / size * bounds[3]
        for column in range(size):
            x = bounds[0] + (column + .5) / size * bounds[2]
            location, normal, _, _ = surface.ray_cast(Vector((x, high + 20, z)), Vector((0, -1, 0)), high - low + 40)
            y = location.y if location is not None else -1.7
            encoded = int(np.clip((y-low)/(high-low), 0, 1) * 65535)
            heights[row, column] = [encoded // 256 / 255, encoded % 256 / 255, 0, 1]
            origin = Vector((x, y + .13, z))
            visibility = 0.0
            bounce = Vector((0, 0, 0))
            for direction in directions:
                hit, _, face, distance = bvh.ray_cast(origin, direction, radius)
                if hit is None:
                    visibility += 1
                    continue
                albedo = obstacle_colors[face]
                # Thin leaf/cutout cards obstruct a fraction of incoming light;
                # opaque roofs and walls obstruct all of it.
                obstruction = float(albedo[3]) * (1 - min(1, distance / radius) ** 2)
                visibility += 1 - obstruction
                bounce += Vector(albedo[:3]) * (obstruction * .19)
            ao = max(.25, visibility / samples)
            bounce /= samples
            for pool in ([] if volume else lights):
                delta = origin - Vector(pool['position'])
                distance = delta.length
                if distance >= pool['radius']:
                    continue
                falloff = (1 - distance / pool['radius']) ** 2
                emitters = area_origins(pool)
                visibility = 0.0
                for emitter in emitters:
                    ray = emitter - origin
                    length = ray.length
                    direction = ray.normalized() if length > .001 else Vector((0, 1, 0))
                    visibility += transmission(origin, direction, max(.01, length - .5)) * max(.15, direction.y)
                bounce += Vector(pool['color']) * (min(5, pool['intensity']) * falloff * visibility / len(emitters) * .26)
            light[row, column] = [min(1, bounce.x), min(1, bounce.y), min(1, bounce.z), ao]
        if row % 128 == 0:
            print(f'{course}: {row}/{size} rows, {time.monotonic()-started:.1f}s', flush=True)
    destination = ROOT / 'assets/lighting' / course
    destination.mkdir(parents=True, exist_ok=True)
    save_image(destination / 'indirect.png', light)
    save_image(destination / 'height.png', heights)
    outputs = ['indirect.png', 'height.png']
    if volume:
        # A small XZ atlas at several heights also lights vertical facades and
        # container faces. Each sample is visibility-tested against the scene.
        # Iterate lamp footprints rather than the entire city for every lamp.
        resolution = volume['resolution']
        levels = volume['heights']
        columns = 4
        rows = math.ceil(len(levels) / columns)
        spill = np.zeros((rows * resolution, columns * resolution, 4), dtype=np.float32)
        spill[:, :, 3] = 1
        step_x, step_z = bounds[2] / resolution, bounds[3] / resolution
        ray_count = 0
        for lamp_index, pool in enumerate(lights):
            position = Vector(pool['position'])
            emitters = area_origins(pool)
            reach = pool['radius']
            left = max(0, math.floor((position.x - reach - bounds[0]) / step_x))
            right = min(resolution, math.ceil((position.x + reach - bounds[0]) / step_x))
            bottom = max(0, math.floor((position.z - reach - bounds[1]) / step_z))
            top = min(resolution, math.ceil((position.z + reach - bounds[1]) / step_z))
            rgb = np.array(pool['color']) * min(8, pool['intensity']) * .38
            for layer, y in enumerate(levels):
                if abs(y - position.y) >= reach:
                    continue
                tile_x, tile_y = layer % columns * resolution, layer // columns * resolution
                for row in range(bottom, top):
                    z = bounds[1] + (row + .5) * step_z
                    for column in range(left, right):
                        x = bounds[0] + (column + .5) * step_x
                        origin = Vector((x, y, z))
                        delta = position - origin
                        distance = delta.length
                        if distance >= reach:
                            continue
                        falloff = (1 - distance / reach) ** 2
                        if falloff < .015:
                            continue
                        ray_count += 1
                        direction = delta.normalized() if distance > .001 else Vector((0, 1, 0))
                        visibility = 0.0
                        for emitter in emitters:
                            ray = emitter - origin
                            length = ray.length
                            if length > .025:
                                visibility += transmission(origin, ray.normalized(), max(.01, length - .35))
                            else:
                                visibility += 1.0
                        visibility /= len(emitters)
                        spill[tile_y + row, tile_x + column, :3] += rgb * falloff * visibility
            if lamp_index % 64 == 0:
                print(f'{course}: spill {lamp_index}/{len(lights)} lamps, {ray_count} rays', flush=True)
        # LDR storage is enough for diffuse night spill; global exposure remains
        # independent. Clamp only after all contributing lamps accumulate.
        np.clip(spill, 0, 1, out=spill)
        save_image(destination / 'spill.png', spill)
        outputs.append('spill.png')
        volume = {**volume, 'columns': columns, 'rows': rows, 'file': 'spill.png', 'strength': 1}
    result = {
        'version': 2, 'course': course, 'lighting': 'indirect.png', 'height': 'height.png',
        'bounds': bounds, 'heightRange': metadata['heightRange'], 'bounceScale': .65,
        'resolution': size, 'samples': samples, 'radius': radius,
        'method': 'Offline BVH cosine hemisphere visibility, local diffuse color bounce and occluded authored lamp pools; direct sunlight excluded. Four-point area emitters soften penumbrae and glass/cutouts transmit attenuated light.',
        'sourceSceneSha256': hashlib.sha256(metadata_path.read_bytes() + binary).hexdigest(),
        'triangles': metadata['triangles'], 'lights': len(lights), 'areaLights': sum(bool(p.get('area')) for p in lights), 'transparentLightTransport': True,
        'outputs': [{ 'file': name, 'width': columns * resolution if name == 'spill.png' else size, 'height': rows * resolution if name == 'spill.png' else size, 'bytes': (destination/name).stat().st_size, 'sha256': hashlib.sha256((destination/name).read_bytes()).hexdigest() } for name in outputs],
    }
    if volume:
        result['lightVolume'] = volume
        result['method'] += ' Colored spill volume samples at authored heights illuminate vertical surfaces.'
    (destination / 'bake.json').write_text(json.dumps(result, indent=2) + '\n')
    print(f'{course}: baked in {time.monotonic()-started:.1f}s', flush=True)
