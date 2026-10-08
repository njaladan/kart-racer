#!/usr/bin/env python3
"""Bake per-mesh RGBA diffuse visibility with Blender's scene BVH.

The exporter must first write <course>.json/.bin and <course>-mesh-samples.json/.bin:
  node tools/export-lighting-scene.mjs <course>
A scene-export hook then calls exportMeshLighting(scene, world, course, output).
Bake with:
  blender -b -t 2 --python tools/bake-mesh-lighting.py -- <course>
This adds mesh-lighting.{json,bin}; bake.json and ground atlases are untouched.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import time

from mathutils import Vector
from mathutils.bvhtree import BVHTree
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(os.environ.get('LIGHTING_SCENE_DIR', '/tmp/turbo-trail-lighting-scenes'))
OUTPUT_ROOT = Path(os.environ.get('MESH_LIGHT_OUTPUT_DIR', str(ROOT / 'assets' / 'lighting')))
arguments = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
courses = arguments or ['windmill-wilds', 'neon-harbor', 'sunstone-ruins', 'frostpeak-festival']
samples = int(os.environ.get('MESH_LIGHT_BAKE_SAMPLES', '8'))
radius = float(os.environ.get('MESH_LIGHT_BAKE_RADIUS', '24'))
quantization = float(os.environ.get('MESH_LIGHT_BAKE_QUANTIZATION', '0.12'))
light_grid_cell_size = 32.0
brute_force_lights = os.environ.get('MESH_LIGHT_BRUTE_FORCE') == '1'


def source_hash(scene_json, scene_bin):
    digest = hashlib.sha256()
    digest.update(scene_json)
    digest.update(scene_bin)
    return digest.hexdigest()


def normal_frame(normal):
    n = Vector(normal).normalized()
    tangent = n.cross(Vector((0, 0, 1)))
    if tangent.length_squared < 1e-8:
        tangent = n.cross(Vector((0, 1, 0)))
    tangent.normalize()
    bitangent = n.cross(tangent).normalized()
    return n, tangent, bitangent


def sample_directions(normal):
    n, tangent, bitangent = normal_frame(normal)
    result = []
    for index in range(samples):
        r = math.sqrt((index + 0.5) / samples)
        angle = index * 2.399963229728653
        local = Vector((math.cos(angle) * r, math.sin(angle) * r, math.sqrt(1 - r * r)))
        direction = tangent * local.x + bitangent * local.y + n * local.z
        result.append(direction.normalized())
    return result


def quantized_key(record):
    return tuple(int(round(float(value) / quantization)) for value in record[:3]) + tuple(
        int(round(float(value) * 10)) for value in record[3:6]
    )


def build_light_grid(lights, cell_size=light_grid_cell_size):
    """Index each lamp into all XZ cells its radius can reach, in source order."""
    grid = {}
    for pool in lights:
        x, _, z = pool['position']
        reach = float(pool['radius'])
        left = math.floor((x - reach) / cell_size)
        right = math.floor((x + reach) / cell_size)
        bottom = math.floor((z - reach) / cell_size)
        top = math.floor((z + reach) / cell_size)
        for cell_x in range(left, right + 1):
            for cell_z in range(bottom, top + 1):
                grid.setdefault((cell_x, cell_z), []).append(pool)
    return grid


def nearby_lights(point, grid, lights, cell_size=light_grid_cell_size):
    if grid is None:
        return lights
    cell = (math.floor(point.x / cell_size), math.floor(point.z / cell_size))
    return grid.get(cell, ())


def bake_unique(records, bvh, obstacle_colors, lights, light_grid=None):
    result = np.zeros((len(records), 4), dtype=np.uint8)
    cache = {}
    directions_by_normal = {}
    for index, record in enumerate(records):
        key = quantized_key(record)
        cached = cache.get(key)
        if cached is not None:
            result[index] = cached
            continue
        point = Vector((float(record[0]), float(record[1]), float(record[2])))
        normal = Vector((float(record[3]), float(record[4]), float(record[5])))
        if normal.length_squared < 1e-8:
            normal = Vector((0, 1, 0))
        normal.normalize()
        normal_key = tuple(int(round(v * 10)) for v in normal)
        directions = directions_by_normal.get(normal_key)
        if directions is None:
            directions = sample_directions(normal)
            directions_by_normal[normal_key] = directions
        origin = point + normal * 0.075
        visibility = 0.0
        bounce = Vector((0, 0, 0))
        for direction in directions:
            hit, _, face, distance = bvh.ray_cast(origin, direction, radius)
            if hit is None:
                visibility += 1.0
                continue
            albedo = obstacle_colors[face]
            coverage = float(albedo[3])
            obstruction = coverage * (1.0 - min(1.0, distance / radius) ** 2)
            visibility += 1.0 - obstruction
            bounce += Vector(albedo[:3]) * (obstruction * 0.19)
        ao = max(0.25, visibility / samples)
        bounce /= samples
        for pool in nearby_lights(point, light_grid, lights):
            delta = Vector(pool['position']) - point
            distance = delta.length
            if distance < 0.001 or distance >= float(pool['radius']):
                continue
            direction = delta / distance
            facing = max(0.0, normal.dot(direction))
            if facing <= 0:
                continue
            blocked, _, _, hit_distance = bvh.ray_cast(origin, direction, max(0.01, distance - 0.4))
            if blocked is not None and hit_distance < distance - 0.45:
                continue
            falloff = (1.0 - distance / float(pool['radius'])) ** 2
            strength = min(5.0, float(pool['intensity'])) * falloff * facing * 0.24
            bounce += Vector(pool['color']) * strength
        rgba = np.array([
            int(np.clip(bounce.x, 0, 1) * 255 + 0.5),
            int(np.clip(bounce.y, 0, 1) * 255 + 0.5),
            int(np.clip(bounce.z, 0, 1) * 255 + 0.5),
            int(np.clip(ao, 0.25, 1) * 255 + 0.5),
        ], dtype=np.uint8)
        result[index] = rgba
        cache[key] = rgba
        if index and index % 500000 == 0:
            print(f'  {index}/{len(records)} vertices; {len(cache)} unique samples', flush=True)
    return result, len(cache)


for course in courses:
    started = time.monotonic()
    scene_json_path = SOURCE / f'{course}.json'
    scene_bin_path = SOURCE / f'{course}.bin'
    samples_json_path = SOURCE / f'{course}-mesh-samples.json'
    samples_bin_path = SOURCE / f'{course}-mesh-samples.bin'
    scene_bytes = scene_json_path.read_bytes()
    scene_bin = scene_bin_path.read_bytes()
    scene_meta = json.loads(scene_bytes)
    sample_meta = json.loads(samples_json_path.read_text())
    if sample_meta['course'] != course:
        raise RuntimeError(f'{course}: mesh sample course id mismatch')
    digest = source_hash(scene_bytes, scene_bin)
    if digest != sample_meta['sourceSceneSha256']:
        raise RuntimeError(f'{course}: mesh samples reference a different exported scene')

    binary = scene_bin
    vertices = np.frombuffer(binary, '<f4', scene_meta['positions'] * 3, scene_meta['offsets'][0]).reshape(-1, 3)
    faces = np.frombuffer(binary, '<u4', scene_meta['triangles'] * 3, scene_meta['offsets'][1]).reshape(-1, 3)
    colors = np.frombuffer(binary, '<f4', scene_meta['triangles'] * 4, scene_meta['offsets'][2]).reshape(-1, 4)
    bounds = scene_meta['bounds']
    centers = vertices[faces].mean(axis=1)
    reach = radius
    useful = (
        (centers[:, 0] > bounds[0] - reach) &
        (centers[:, 0] < bounds[0] + bounds[2] + reach) &
        (centers[:, 2] > bounds[1] - reach) &
        (centers[:, 2] < bounds[1] + bounds[3] + reach)
    )
    bvh = BVHTree.FromPolygons(vertices.tolist(), faces[useful].tolist(), all_triangles=True, epsilon=.001)
    obstacle_colors = colors[useful]
    samples_binary = np.fromfile(samples_bin_path, dtype='<f4')
    if len(samples_binary) != sample_meta['sampleCount'] * 6:
        raise RuntimeError(f'{course}: mesh sample binary has the wrong size')
    if hashlib.sha256(samples_bin_path.read_bytes()).hexdigest() != sample_meta.get('sampleSha256'):
        raise RuntimeError(f'{course}: mesh sample binary digest mismatch')
    records = samples_binary.reshape(-1, 6)
    lights = scene_meta.get('lights', [])
    light_grid = None if brute_force_lights else build_light_grid(lights)
    output_parts = []
    output_entries = []
    byte_offset = 0
    unique_samples = 0
    for entry in sample_meta['entries']:
        start = entry['sampleOffset']
        count = entry['count']
        if count <= 0 or start < 0 or start + count > len(records):
            raise RuntimeError(f"{course}: invalid mesh sample range for {entry['path']}")
        baked, unique_count = bake_unique(
            records[start:start + count], bvh, obstacle_colors, lights, light_grid
        )
        unique_samples += unique_count
        packed = baked.tobytes()
        output_parts.append(packed)
        output_entries.append({
            'path': entry['path'],
            'name': entry.get('name', ''),
            'signature': entry['signature'],
            'kind': entry['kind'],
            'count': count,
            'byteOffset': byte_offset,
            'byteLength': len(packed),
        })
        byte_offset += len(packed)
        if len(output_entries) % 100 == 0:
            print(f'{course}: baked {len(output_entries)}/{len(sample_meta["entries"])} meshes', flush=True)

    result_binary = b''.join(output_parts)
    destination = OUTPUT_ROOT / course
    destination.mkdir(parents=True, exist_ok=True)
    binary_path = destination / 'mesh-lighting.bin'
    json_path = destination / 'mesh-lighting.json'
    binary_path.write_bytes(result_binary)
    result = {
        'version': 1,
        'course': course,
        'sourceSceneSha256': digest,
        'sampleSourceSha256': hashlib.sha256(samples_json_path.read_bytes() + samples_bin_path.read_bytes()).hexdigest(),
        'format': 'normalized RGBA8: RGB diffuse bounce and local lamp spill; alpha ambient visibility',
        'resolution': 'per vertex; per instance for InstancedMesh',
        'samples': samples,
        'radius': radius,
        'quantization': quantization,
        'uniqueQuantizedSamples': unique_samples,
        'entries': output_entries,
        'binary': {
            'file': binary_path.name,
            'bytes': len(result_binary),
            'sha256': hashlib.sha256(result_binary).hexdigest(),
        },
        'method': 'Normal-relative BVH visibility and diffuse bounce plus ray-tested local lamps; direct sunlight excluded.',
    }
    json_path.write_text(json.dumps(result, indent=2) + '\n')
    print(f'{course}: {len(output_entries)} mesh records, {unique_samples} unique samples, {len(result_binary)} bytes in {time.monotonic()-started:.1f}s', flush=True)
