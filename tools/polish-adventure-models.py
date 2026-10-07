"""Blender: soften downloaded rock silhouettes, unwrap scans and bake vertex AO.
Run after prepare-adventure-fidelity.py; never synthesizes a replacement model.
"""
from pathlib import Path
import hashlib,json,math,struct
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
for course in ['tempest-causeway','railstorm-express','pelagic-glasshouse','emberwing-observatory']:
 folder=ROOT/'assets/courses/packs'/course
 manifest=json.loads((folder/'manifest.json').read_text())
 for entry in manifest['models']:
  if entry['name'] not in ['art:rock-tallb','art:rock-largee']:continue
  path=folder/entry['file']
  bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
  bpy.ops.import_scene.gltf(filepath=str(path))
  meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
  for o in meshes:
   matrix=o.matrix_world.copy();o.parent=None;o.matrix_world=matrix
  bpy.ops.object.select_all(action='DESELECT')
  for o in meshes:o.select_set(True)
  bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join()
  o=bpy.context.object
  bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
  h=max(v.co.z for v in o.data.vertices)-min(v.co.z for v in o.data.vertices)
  mod=o.modifiers.new('Weathered softened edges','BEVEL');mod.width=h*.028;mod.segments=3
  bpy.ops.object.modifier_apply(modifier=mod.name)
  for p in o.data.polygons:p.use_smooth=True
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.02);bpy.ops.object.mode_set(mode='OBJECT')
  m=bpy.data.materials.new('Scanned weathered rock with baked occlusion');m.use_nodes=True
  n=m.node_tree.nodes;l=m.node_tree.links;bs=n.get('Principled BSDF');bs.inputs['Roughness'].default_value=.87
  # Blender supports WebP source images. Embed resized scans in the local GLB.
  images={}
  for slot in ['color','normal','roughness']:
   im=bpy.data.images.load(str(folder/'textures'/('rock-'+slot+'.webp')),check_existing=False)
   im.scale(512,512);im.pack();images[slot]=im
   node=n.new('ShaderNodeTexImage');node.image=im
   if slot=='color':
    ao=n.new('ShaderNodeVertexColor');ao.layer_name='Baked occlusion'
    mul=n.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1
    l.new(node.outputs['Color'],mul.inputs[1]);l.new(ao.outputs['Color'],mul.inputs[2]);l.new(mul.outputs[0],bs.inputs['Base Color'])
   elif slot=='normal':
    im.colorspace_settings.name='Non-Color';normal=n.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.5;l.new(node.outputs['Color'],normal.inputs['Color']);l.new(normal.outputs['Normal'],bs.inputs['Normal'])
   else:im.colorspace_settings.name='Non-Color';l.new(node.outputs['Color'],bs.inputs['Roughness'])
  o.data.materials.clear();o.data.materials.append(m)
  # Nearby faces and the ground occlude hemisphere rays; base albedo stays separate.
  tree=BVHTree.FromObject(o,bpy.context.evaluated_depsgraph_get())
  for layer in list(o.data.color_attributes):o.data.color_attributes.remove(layer)
  colors=o.data.color_attributes.new(name='Baked occlusion',type='FLOAT_COLOR',domain='CORNER')
  values={};zmin=min(v.co.z for v in o.data.vertices);reach=max(h*.25,.1)
  for v in o.data.vertices:
   normal=v.normal.normalized();q=Vector((0,0,1)).rotation_difference(normal);hits=0
   for i in range(16):
    z=math.sqrt((i+.5)/16);r=math.sqrt(1-z*z);a=i*2.399963
    ray=q@Vector((r*math.cos(a),r*math.sin(a),z));origin=v.co+normal*.002*h
    hit=tree.ray_cast(origin,ray,reach)[0]
    ground=ray.z<-.001 and 0<(zmin-origin.z)/ray.z<reach
    hits+=hit is not None or ground
   values[v.index]=.58+.42*(1-hits/16)
  for loop in o.data.loops:
   a=values[loop.vertex_index];colors.data[loop.index].color=(a,a,a,1)
  o.data.color_attributes.active_color=colors
  bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_animations=False,export_yup=True,export_all_vertex_colors=True)
  # Blender emits a placeholder COLOR_0 for the node graph. Three consumes
  # COLOR_0, so promote the exported active occlusion layer explicitly.
  data=path.read_bytes();length=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+length])
  for model in doc['meshes']:
   for primitive in model['primitives']:
    attrs=primitive['attributes']
    if 'COLOR_1' in attrs:attrs['COLOR_0']=attrs.pop('COLOR_1')
  encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4);tail=data[20+length:]
  path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail)
  entry.update(bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),modifications='Offline edge bevel, smooth normals, non-overlapping scan UVs, 512px embedded ambientCG PBR maps and 16-ray geometry/ground vertex occlusion')
  print('Polished',course,entry['name'],flush=True)
 (folder/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
