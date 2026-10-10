"""Blender conversion invoked by prepare-metronome-instruments.py."""
import math
import sys
import bpy
from mathutils import Vector

source, output = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.wm.obj_import(filepath=source)
object = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
bpy.context.view_layer.objects.active = object
object.select_set(True)
# OBJ import retains the source vertex coordinates and installs an object
# rotation. Replace it: long X becomes Blender Z; the carved XZ face becomes XZ.
object.rotation_euler = (0, -math.pi / 2, 0)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
decimate = object.modifiers.new('Museum scan game mesh', 'DECIMATE')
decimate.ratio = 0.018
bpy.ops.object.modifier_apply(modifier=decimate.name)
points = [object.matrix_world @ Vector(v) for v in object.bound_box]
bottom = min(p.z for p in points)
height = max(p.z for p in points) - bottom
for vertex in object.data.vertices:
    vertex.co.x /= height
    vertex.co.y /= height
    vertex.co.z = (vertex.co.z - bottom) / height
material = bpy.data.materials.new('Museum violin cherrywood')
material.diffuse_color = (0.42, 0.16, 0.065, 1)
material.use_nodes = True
shader = material.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value = material.diffuse_color
shader.inputs['Roughness'].default_value = 0.34
object.data.materials.clear()
object.data.materials.append(material)
for polygon in object.data.polygons:
    polygon.use_smooth = True
object.name = 'CC0 museum violin'
bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', use_selection=True,
                          export_cameras=False, export_lights=False)
