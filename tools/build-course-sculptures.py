#!/usr/bin/env python3
"""Selective Blender upgrades for eleven course packs.

blender -b -t 2 --python tools/build-course-sculptures.py [-- course-id ...]
Original, reproducible modeling sources; no external meshes or textures. Parts
retain runtime material roles, reference bounds and existing animation pivots.
"""
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
WANTED = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply(obj, modifier):
    activate(obj)
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def mesh(name, vertices, faces):
    data = bpy.data.meshes.new(name)
    data.from_pydata([(x, -z, y) for x, y, z in vertices], [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return obj


def cube(name, size, position=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(position[0], -position[2], position[1]))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def cylinder(name, radius, height, position=(0, 0, 0), axis='y', segments=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=segments, radius=radius, depth=height,
                                      location=(position[0], -position[2], position[1]))
    obj = bpy.context.object
    obj.name = name
    if axis == 'z':
        obj.rotation_euler.x = math.pi / 2
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return obj


def bevel(obj, width=.02, segments=2):
    mod = obj.modifiers.new('Light-catching edge bevel', 'BEVEL')
    mod.width, mod.segments, mod.limit_method = width, segments, 'ANGLE'
    apply(obj, mod)
    return obj


def weighted_normals(obj):
    mod = obj.modifiers.new('Area-weighted architectural normals', 'WEIGHTED_NORMAL')
    mod.keep_sharp = True
    apply(obj, mod)
    return obj


def boolean(obj, cutter):
    mod = obj.modifiers.new('Real recessed and pierced geometry', 'BOOLEAN')
    mod.operation, mod.solver, mod.object = 'DIFFERENCE', 'EXACT', cutter
    apply(obj, mod)
    bpy.data.objects.remove(cutter, do_unlink=True)


def solidify(obj, thickness=.015):
    mod = obj.modifiers.new('Physical shell thickness and finished rims', 'SOLIDIFY')
    mod.thickness, mod.offset = thickness, 0
    apply(obj, mod)
    return obj


def subdivide(obj, levels=1):
    mod = obj.modifiers.new('Sculpted continuous surface', 'SUBSURF')
    mod.levels = levels
    apply(obj, mod)
    return obj


def smooth(obj):
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def join(objects):
    activate(objects[0])
    for obj in objects:
        obj.select_set(True)
    bpy.ops.object.join()
    return bpy.context.object


def lathe(name, profile, segments=32, flutes=0):
    vertices, faces = [], []
    for r, y in profile:
        for i in range(segments):
            a = i * math.tau / segments
            radius = r * (1 - .065 * (.5 + .5 * math.cos(a * flutes))) if flutes else r
            vertices.append((math.cos(a) * radius, y, math.sin(a) * radius))
    for ring in range(len(profile) - 1):
        for i in range(segments):
            a = ring * segments + i
            b = ring * segments + (i + 1) % segments
            faces.append((a, a + segments, b + segments, b))
    # Profiles approaching the axis are floors/hubs; close their tiny centre
    # rings rather than leaving a pinhole through an otherwise solid part.
    if profile[0][0] <= .002:
        faces.append(tuple(reversed(range(segments))))
    if profile[-1][0] <= .002:
        start = (len(profile) - 1) * segments
        faces.append(tuple(range(start, start + segments)))
    return mesh(name, vertices, faces)


def extrude(name, outline, depth):
    n = len(outline)
    vertices = [(x, y, z) for z in [-depth / 2, depth / 2] for x, y in outline]
    faces = [tuple(reversed(range(n))), tuple(range(n, n * 2))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    return mesh(name, vertices, faces)


def mill_arch():
    curve = lambda width, y, crown: [(width * (2 * i / 24 - 1), y + crown * 4 * (i / 24) * (1 - i / 24)) for i in range(25)]
    outside = [(-14, 0), (14, 0), (14, 21)] + list(reversed(curve(14, 21, 2))) + [(-14, 21)]
    obj = extrude('Coursed mill arch', outside, 8)
    opening = [(-10.5, -1), (10.5, -1), (10.5, 13)] + list(reversed(curve(10.5, 13, 3)))
    boolean(obj, extrude('Unobstructed mill intrados', opening, 12))
    bevel(obj, .1, 2)
    stones = [obj]
    # Radial voussoirs and staggered pier courses sit on the outer faces.
    for side in [-1, 1]:
        for course in range(6):
            for front in [-1, 1]:
                block = cube('Staggered dressed pier stone', (3.05, 2.04, .22),
                             (side * 12.25, 1.1 + course * 2.15, front * 4.05))
                bevel(block, .08, 1)
                stones.append(block)
    for i in range(14):
        u, v = (i + .03) / 14, (i + .97) / 14
        outline = [(28 * u - 14, 21 + 8 * u * (1 - u)),
                   (28 * v - 14, 21 + 8 * v * (1 - v)),
                   (21 * v - 10.5, 13 + 12 * v * (1 - v)),
                   (21 * u - 10.5, 13 + 12 * u * (1 - u))]
        stone = extrude('Wedge-shaped arch voussoir', list(reversed(outline)), .24)
        stone.location.y = -4.08
        bevel(stone, .045, 1)
        stones.append(stone)
    return weighted_normals(join(stones))


def pier(storm=False):
    profile = [(-.5, -.5), (.5, -.5), (.5, -.39), (.39, -.33), (.28, .35), (.36, .42), (.36, .5), (-.36, .5), (-.36, .42), (-.28, .35), (-.39, -.33), (-.5, -.39)]
    obj = extrude('Buttressed suspension pylon', profile, 1)
    for side in [-1, 1]:
        boolean(obj, cube('Recessed service channel', (.28 if storm else .22, .63, .18), (0, .01, side * .48)))
    return weighted_normals(bevel(obj, .02, 2))


def lumen_tower():
    vertices, faces = [], []
    for y, x, z in [(-37, 9.5, 11), (-31, 9.5, 11), (26, 8.8, 10.8), (37, 8.2, 10.8)]:
        vertices.extend([(-x, y, -z), (x, y, -z), (x, y, z), (-x, y, z)])
    faces = [(3, 2, 1, 0), (12, 13, 14, 15)]
    for ring in range(3):
        for i in range(4):
            a = ring * 4 + i
            faces.append((a, ring * 4 + (i + 1) % 4, (ring + 1) * 4 + (i + 1) % 4, a + 4))
    obj = mesh('Tapered Lumen tower with actual window recesses', vertices, faces)
    for y in range(8, 70, 8):
        boolean(obj, cube('Recessed window bay', (15.5, 3.7, 2.1), (0, y - 37, 11)))
    return weighted_normals(bevel(obj, .22, 2))


def eroded_rock(sea=False):
    segments, rings = 28, 12
    vertices, faces = [], []
    for j in range(rings + 1):
        f = j / rings
        # Beds have shallow weathered ledges, rather than repeated broad
        # flanges. A slight lean breaks the silhouette of a perfect lathe.
        r = (.96 - f * .16 + .065 * math.sin(f * 15) + .025 * math.sin(f * 36)) if not sea else (.98 - f * .35 + .075 * math.sin(f * 18))
        for i in range(segments):
            a = i * math.tau / segments
            erosion = .08 * math.sin(a * 7 + f * 11) + .04 * math.cos(a * 13 - f * 6)
            radius = r + erosion
            y = f * 2 - 1 + (.07 * math.sin(a * 5) if j == rings else 0)
            vertices.append((math.cos(a) * radius + f * .16, y, math.sin(a) * radius + .07 * math.sin(f * 5)))
    for j in range(rings):
        for i in range(segments):
            a, b = j * segments + i, j * segments + (i + 1) % segments
            faces.append((a, a + segments, b + segments, b))
    faces += [tuple(reversed(range(segments))), tuple(rings * segments + i for i in range(segments))]
    obj = mesh('Wave-cut slate sea stack' if sea else 'Undercut bedded sandstone mesa', vertices, faces)
    texture = bpy.data.textures.new('Fine weathering displacement', type='CLOUDS')
    texture.noise_scale, texture.noise_depth = .26, 2
    displacement = obj.modifiers.new('Multi-scale erosion', 'DISPLACE')
    displacement.texture, displacement.strength = texture, .065
    apply(obj, displacement)
    bevel(obj, .025, 1)
    decimate = obj.modifiers.new('Silhouette-preserving simplification', 'DECIMATE')
    decimate.ratio = .65
    apply(obj, decimate)
    return obj


def temple_column():
    return smooth(lathe('Fluted stone shaft with moulded collars',
        [(.98, -.5), (.98, -.46), (.78, -.43), (.73, -.39), (.68, .33), (.72, .39), (.85, .43), (.98, .46), (.98, .5)], 64, 16))


def glacier():
    objects = []
    for i, (x, z, r, height) in enumerate([(0, 0, .68, 2), (.65, .18, .32, 1.2), (-.5, -.28, .35, 1.45)]):
        vertices = []
        for ring, (y, radius) in enumerate([(-1, r), (-.35, r * .9), (height - 1, r * .6)]):
            for k in range(6):
                a = k * math.pi / 3 + i * .5
                vertices.append((x + math.cos(a) * radius, y + (math.sin(a + i) * .16 if ring == 2 else 0), z + math.sin(a) * radius))
        faces = [(5, 4, 3, 2, 1, 0), tuple(range(12, 18))]
        for ring in range(2):
            for k in range(6):
                a, b = ring * 6 + k, ring * 6 + (k + 1) % 6
                faces.append((a, a + 6, b + 6, b))
        obj = mesh('Fractured glacier crystal', vertices, faces)
        cutter = cube('Diagonal ice fracture', (1.2, .22, .7), (x + .38, height - 1.35, z + .4))
        cutter.rotation_euler.y = .25
        boolean(obj, cutter)
        bevel(obj, .016, 1)
        objects.append(obj)
    return weighted_normals(join(objects))


def gear(teeth):
    outline = []
    pitch, base = .93, .93 * math.cos(math.radians(20))
    inv = lambda r: math.sqrt(max(0, (r / base) ** 2 - 1)) - math.acos(min(1, base / r))
    half = math.pi / teeth * .44
    for i in range(teeth):
        centre = i * math.tau / teeth
        points = [(.80, centre - math.pi / teeth), (.80, centre - half - inv(pitch))]
        for r in [base, .90, .94, .97, 1]:
            points.append((r, centre - half + inv(r) - inv(pitch)))
        for r in [1, .97, .94, .90, base]:
            points.append((r, centre + half - inv(r) + inv(pitch)))
        points.append((.80, centre + half + inv(pitch)))
        outline.extend((r * math.cos(a), r * math.sin(a)) for r, a in points)
    obj = extrude(f'{teeth}-tooth involute gear', outline, .16)
    boolean(obj, cylinder('Axle bore', .12, .6, axis='z'))
    for i in range(6):
        a = i * math.pi / 3
        boolean(obj, cylinder('Pierced gear web', .19, .6, (.49 * math.cos(a), .49 * math.sin(a), 0), axis='z', segments=16))
    return weighted_normals(bevel(obj, .006, 1))


def paper_body():
    vertices = [(-.58, -.25, 0), (.58, -.25, 0), (0, .3, -.6), (0, .42, .25), (0, 0, 1.3),
                (-.15, .3, -.62), (.15, .3, -.62), (-.08, 1.12, -1.25), (.08, 1.12, -1.25),
                (0, 1.05, -1.6), (0, .85, -1.28), (0, -.35, .25)]
    faces = [(0, 2, 3), (1, 3, 2), (0, 3, 4), (1, 4, 3), (0, 4, 11), (1, 11, 4),
             (5, 7, 8, 6), (5, 10, 7), (6, 8, 10), (7, 9, 8), (7, 10, 9), (8, 9, 10)]
    return bevel(solidify(mesh('Folded crane body and pointed neck', vertices, faces), .018), .005, 1)


def paper_wing(side):
    vertices = [(side * x, y, z) for x, y, z in [(0, 0, 0), (.8, .3, -.22), (2.7, .4, -.35),
                (.65, .2, 1.2), (1.1, .7, .2), (1.72, .55, -.06), (.9, .12, .55)]]
    faces = [(0, 1, 4), (1, 5, 4), (1, 2, 5), (2, 3, 5), (3, 4, 5), (0, 4, 6), (0, 6, 3), (3, 6, 4)]
    if side < 0:
        faces = [tuple(reversed(face)) for face in faces]
    return bevel(solidify(mesh('Creased paper wing', vertices, faces), .014), .004, 1)


def lantern():
    profile = []
    for i in range(9):
        f = i / 8
        r = .56 + .42 * math.sin(f * math.pi) + (.06 if i % 2 else -.045)
        profile.append((r, f * 2 - 1))
    return solidify(lathe('Accordion paper lantern', profile, 8), .014)


def cup():
    profile = [(.001, -.5), (.65, -.5), (.74, -.47), (.75, -.36), (.88, -.25), (.99, .35),
               (1, .46), (.97, .5), (.89, .5), (.86, .44), (.85, .32), (.69, -.31), (.61, -.37), (.001, -.37)]
    return weighted_normals(bevel(smooth(lathe('Open ceramic cup with rounded foot and lip', profile, 20)), .015, 1))


def jar():
    profile = [(.001, -.5), (.83, -.5), (.98, -.44), (1, -.34), (1, .24), (.98, .31),
               (.78, .4), (.78, .48), (.83, .5), (.68, .5), (.66, .39), (.89, .26), (.88, -.35), (.001, -.39)]
    return weighted_normals(bevel(smooth(lathe('Preserve jar with shoulders and recessed neck', profile, 20)), .012, 1))


def freight_pipe():
    obj = lathe('Hollow rolled freight pipe', [(1, -.5), (.97, -.45), (.97, .45), (1, .5)], 24)
    return weighted_normals(bevel(solidify(smooth(obj), .12), .014, 1))


def drape():
    vertices, faces = [], []
    cols, rows = 24, 8
    for j in range(rows + 1):
        f = j / rows
        for i in range(cols + 1):
            u = i / cols
            x = .32 * math.cos(u * math.tau * 6) * (.6 + f * .4) + .12 * math.sin(f * math.pi)
            vertices.append((x, (1 - f) * 8, (u - .5) * 6))
            if j < rows and i < cols:
                a = j * (cols + 1) + i
                faces.append((a, a + cols + 1, a + cols + 2, a + 1))
    obj = mesh('Pinned velvet drape', vertices, faces)
    pin = obj.vertex_groups.new(name='Header seam pins')
    pin.add(list(range(cols + 1)), 1, 'REPLACE')
    cloth = obj.modifiers.new('Gravity-relaxed cloth folds', 'CLOTH')
    cloth.settings.quality = 5
    cloth.settings.vertex_group_mass = pin.name
    cloth.settings.tension_stiffness = 35
    cloth.settings.compression_stiffness = 35
    cloth.settings.shear_stiffness = 20
    cloth.settings.bending_stiffness = .8
    for frame in range(1, 13):
        bpy.context.scene.frame_set(frame)
    apply(obj, cloth)
    subdivide(obj, 1)
    solidify(obj, .025)
    decimate = obj.modifiers.new('Drapery detail budget', 'DECIMATE')
    decimate.ratio = .22
    apply(obj, decimate)
    bpy.context.scene.frame_set(1)
    return smooth(obj)


def organ_pipe():
    obj = smooth(lathe('Hollow flared brass resonator', [(.001, -.5), (.66, -.5), (.67, -.42),
        (.68, .23), (.74, .35), (.94, .45), (1, .49), (.92, .5), (.86, .44), (.61, .29), (.56, -.4), (.001, -.4)], 16))
    boolean(obj, cube('Organ flue mouth', (.43, .1, .4), (0, -.28, .64)))
    return weighted_normals(bevel(obj, .008, 1))


def coral():
    data = bpy.data.curves.new('Tapered coral branching skeleton', 'CURVE')
    data.dimensions, data.resolution_u, data.bevel_depth, data.bevel_resolution = '3D', 6, .35, 2
    def branch(points, radii):
        spline = data.splines.new('BEZIER')
        spline.bezier_points.add(len(points) - 1)
        for point, (x, y, z), radius in zip(spline.bezier_points, points, radii):
            point.co = (x, -z, y)
            point.handle_left_type = point.handle_right_type = 'AUTO'
            point.radius = radius
    for i in range(5):
        x, h = (i - 2) * 1.7, 3.4 + i % 3
        branch([(x, 0, 0), (x + .2, h * .45, .2), (x - .15, h, -.25)], [1, .7, .13])
        for side in [-1, 1]:
            branch([(x + .2, h * .4, .2), (x + side * .9, h * .7, side * .4),
                    (x + side * 1.4, h + .4, side * .65)], [.7, .48, .08])
    obj = bpy.data.objects.new('Fused organic reef coral', data)
    bpy.context.collection.objects.link(obj)
    activate(obj)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.object
    remesh = obj.modifiers.new('Voxel union of branching joints', 'REMESH')
    remesh.mode, remesh.voxel_size, remesh.use_smooth_shade = 'VOXEL', .11, True
    apply(obj, remesh)
    relax = obj.modifiers.new('Organic joint smoothing', 'SMOOTH')
    relax.factor, relax.iterations = 1.0, 4
    apply(obj, relax)
    decimate = obj.modifiers.new('Reef silhouette budget', 'DECIMATE')
    decimate.ratio = .16
    apply(obj, decimate)
    return smooth(obj)


def kelp():
    vertices, faces = [], []
    for i in range(11):
        u = i / 10
        width = max(.025, math.sin(u * math.pi) ** .8)
        for j in range(3):
            v = j - 1
            vertices.append(((u - .5) * 4, .3 * math.sin(u * math.pi) + .16 * math.sin(u * 12) * abs(v),
                             v * width + .18 * math.sin(u * 9)))
            if i < 10 and j < 2:
                a = i * 3 + j
                faces.append((a, a + 3, a + 4, a + 1))
    return smooth(solidify(subdivide(mesh('Ribbed undulating kelp blade', vertices, faces), 1), .035))


CATALOG = {
    'windmill-wilds': [('mill-masonry', mill_arch, 'Exact boolean intrados; bevelled staggered masonry and radial voussoirs')],
    'neon-harbor': [('lumen-tower', lumen_tower, 'Tapered shell; Boolean window bays; bevel and weighted normals'),
                    ('harbor-pier', pier, 'Buttressed profile; recessed channels; bevel and weighted normals')],
    'sunstone-ruins': [('sandstone-mesa', eroded_rock, 'Layered undercuts; cloud displacement; decimation'),
                       ('temple-column', temple_column, 'Fluted lathed shaft and moulded collars')],
    'frostpeak-festival': [('glacier-cluster', glacier, 'Joined faceted crystals; Boolean diagonal fractures; bevels')],
    'clockwork-citadel': [(f'gear-{n}', lambda n=n: gear(n), 'Involute tooth curves; extruded web; Boolean bores; bevelled metal') for n in [16, 20, 28]],
    'paper-revel': [('paper-body', paper_body, 'Folded shell with solidify and fine crease bevels'),
                    ('paper-wing-right', lambda: paper_wing(1), 'Separate creased wing, solidify and edge bevels'),
                    ('paper-wing-left', lambda: paper_wing(-1), 'Mirrored wing with preserved hinge pivot'),
                    ('paper-lantern', lantern, 'Lathed accordion folds and solidified paper rim')],
    'tempest-causeway': [('storm-pier', lambda: pier(True), 'Tapered buttress and recessed wind-weathered channels'),
                         ('sea-stack', lambda: eroded_rock(True), 'Wave-cut strata, cloud displacement and decimation')],
    'pocket-pantry': [('ceramic-cup', cup, 'Revolved hollow ceramic wall, rounded foot, bevelled lip'),
                      ('preserve-jar', jar, 'Revolved rounded shoulders, recessed neck and physical inner wall')],
    'railstorm-express': [('freight-pipe', freight_pipe, 'Hollow solidified shell and rolled bevelled ends')],
    'metronome-hall': [('velvet-drape', drape, 'Pinned Blender cloth relaxation, subdivision, solidify and decimation'),
                       ('organ-pipe', organ_pipe, 'Flared lathed resonator; Boolean flue; bevelled rim')],
    'pelagic-glasshouse': [('reef-coral', coral, 'Tapered Bezier branches, voxel union, smoothing and decimation'),
                           ('kelp-leaf', kelp, 'Undulating ribbed blade, subdivision and solidify')],
}


def finish(obj, organic=False):
    # Correct outward winding after modeling and give every runtime material
    # usable UVs and genuine geometry-occlusion colors, without extra textures.
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    data = obj.data
    data.validate(clean_customdata=False)
    data.update()
    uv_values = [0.0] * (len(data.loops) * 2)
    color_values = [1.0] * (len(data.loops) * 4)
    tree = BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())
    low = min(v.co.z for v in data.vertices)
    high = max(v.co.z for v in data.vertices)
    diagonal = max((v.co.length for v in data.vertices), default=1)
    radius = max(.07, diagonal * .13)
    ao = {}
    for vertex in data.vertices:
        normal = vertex.normal.normalized()
        tangent = normal.cross(Vector((0, 0, 1)))
        if tangent.length < .01:
            tangent = normal.cross(Vector((1, 0, 0)))
        tangent.normalize()
        bitangent = normal.cross(tangent)
        hits = 0
        origin = vertex.co + normal * radius * .005
        for i in range(6):
            angle = i * math.tau / 6
            direction = (normal * .65 + tangent * math.cos(angle) * .75 + bitangent * math.sin(angle) * .75).normalized()
            hits += tree.ray_cast(origin, direction, radius)[0] is not None
        ao[vertex.index] = 1 - hits / 6 * .2
    for face in data.polygons:
        normal = face.normal
        for index in face.loop_indices:
            vertex = data.vertices[data.loops[index].vertex_index]
            x, z, y = vertex.co.x, -vertex.co.y, vertex.co.z
            if abs(normal.z) > .6:
                pair = (x * .5 + .5, z * .5 + .5)
            elif abs(normal.x) > abs(normal.y):
                pair = (z * .5 + .5, (y - low) / max(.001, high - low))
            else:
                pair = (x * .5 + .5, (y - low) / max(.001, high - low))
            uv_values[index * 2:index * 2 + 2] = pair
            shade = ao[vertex.index]
            if organic:
                shade *= .95 + .05 * math.sin(y * 15 + math.sin(x * 7 + z * 11))
            color_values[index * 4:index * 4 + 4] = (shade, shade, shade, 1)
    data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    data.uv_layers.new(name='Authored surface UV')
    data.color_attributes.get('Color').data.foreach_set('color', color_values)
    data.uv_layers.get('Authored surface UV').data.foreach_set('uv', uv_values)
    material = bpy.data.materials.new('Runtime tint with baked geometry AO')
    material.use_nodes = True
    color = material.node_tree.nodes.new('ShaderNodeVertexColor')
    color.layer_name = 'Color'
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    material.node_tree.links.new(color.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = .8
    data.materials.clear()
    data.materials.append(material)
    return sum(len(face.vertices) - 2 for face in data.polygons)


for course, recipes in CATALOG.items():
    if WANTED and course not in WANTED:
        continue
    pack = ROOT / 'assets/courses/packs' / course
    manifest = json.loads((pack / 'manifest.json').read_text())
    manifest['models'] = [entry for entry in manifest['models'] if not entry['name'].startswith('blender:')]
    for name, build, features in recipes:
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
        obj = build()
        triangles = finish(obj, name in ['sandstone-mesa', 'sea-stack', 'reef-coral', 'glacier-cluster'])
        activate(obj)
        file = 'models/blender-' + name + '.glb'
        path = pack / file
        path.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                                  export_yup=True, export_materials='EXPORT', export_cameras=False, export_lights=False)
        raw = path.read_bytes()
        entry = dict(name='blender:' + name, file=file, type='gltf', author='Turbo Trail project',
                     license='CC0-1.0', source='Original Blender geometry; tools/build-course-sculptures.py',
                     attribution='licenses/blender-sculptures.txt', features=features, triangles=triangles,
                     bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
        manifest['models'].append(entry)
        print(json.dumps(dict(course=course, name=name, triangles=triangles, bytes=len(raw))), flush=True)
    (pack / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (pack / 'licenses').mkdir(parents=True, exist_ok=True)
    (pack / 'licenses/blender-sculptures.txt').write_text(
        'Original Turbo Trail Blender sculptures. No external meshes or textures are embedded.\n'
        'Dedicated to CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/\n'
        'Modeling source: tools/build-course-sculptures.py\n')
