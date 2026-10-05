#!/usr/bin/env python3
"""Blender offline conversion of pinned STK scenery, plus authored port meshes.

Run: blender -b --python tools/prepare-harbor-fidelity.py -- /tmp/harbor-stk-source
Source archive STK 1.4 SHA256 ad61912093e7d4b399c8e4841156f45550a8b60dc59a290ad84058a9bae0622d.
Shared textures without a specific upstream notice are replaced with original
trim textures. The exporter calculates real ray-occlusion at mesh vertices.
"""
from pathlib import Path
import sys, math, hashlib, json, random
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[sys.argv.index('--') + 1])
PACK = ROOT / 'assets/courses/packs/neon-harbor'
sys.path.insert(0, str(ROOT / 'tools/vendor/stk-spm'))
import import_spm
MODELS = {
 'housing-a': ('stklib_modernHousing_a','stklib_modernHousing_a_main.spm'),
 'housing-b': ('stklib_modernHousing_b','stklib_modernHousing_b.spm'),
 'market-house': ('stklib_silvianHouse_a','stklib_silvianHouse_a_medium.spm'),
 'market-house-c': ('stklib_silvianHouse_c','stklib_silvianHouse_c_main.spm'),
 'bench': ('stklib_bench_a','stklib_bench_a_main.spm'),
 'lamp': ('hd_modernStreetLamp_a','hd_modernStreetLamp_a_main.spm'),
 'aircon': ('stklib_airConditioner_a','stklib_airConditioner_a_main.spm'),
 'kiosk': ('stklib_silvianKiosk_a','stklib_silvianKiosk_a_main.spm'),
 'pallet': ('stklib_pallet_a','stklib_pallet_a.spm'),
 'palm': ('hd_palmTree_a','hd_palmTree_a_main.spm'),
 'tetrapod': ('stklib_tetrapodUnderwater_a','stklib_tetrapodUnderwater_a_main.spm'),
}
(PACK/'models').mkdir(parents=True,exist_ok=True)
(PACK/'licenses').mkdir(exist_ok=True)
# Original paint/masonry/wood/window trim images; no unlicensed shared images.
def original_map(name):
 image=bpy.data.images.new('Original harbor trim '+name,width=128,height=128,alpha=True)
 pixels=[]
 for y in range(128):
  for x in range(128):
   noise=((x*73+y*29)%37)/1200
   color=(.47+noise,.52+noise,.57+noise,1)
   low=name.lower()
   if 'window' in low:
    cellx=x%32;celly=y%32;frame=cellx<4 or celly<4
    light=((x//32)*3+y//32)%4<2
    color=(.11,.17,.25,1) if frame else ((.66,.49,.27,1) if light else (.15,.26,.37,1))
    if not frame and (cellx==5 or celly==5):color=(.26,.33,.40,1)
   elif 'wood' in low or 'rope' in low:
    c=.30+noise+.035*math.sin(x*.7+math.sin(y*.12));color=(c*1.2,c,.18+noise,1)
   elif 'roof' in low or 'tiles' in low:
    line=x%16<2 or (y+(x//16%2)*8)%16<2
    color=(.13,.20,.25,1) if line else (.27+noise,.38+noise,.46+noise,1)
   elif 'brick' in low:
    line=y%12<2 or (x+(y//12%2)*14)%28<2
    color=(.28,.27,.30,1) if line else (.51+noise,.29+noise,.27+noise,1)
   elif 'metal' in low or 'pipe' in low or 'grid' in low or 'future' in low:
    line=x%32<2 or y%32<2;color=(.19,.25,.31,1) if line else (.34+noise,.43+noise,.50+noise,1)
   elif 'flag' in low or 'sponsor' in low or 'emptypanel' in low:
    color=(.15,.30,.37,1) if x%32>3 else (.38,.64,.66,1)
   elif 'glow' in low:color=(.72,.77,.58,1)
   pixels.extend(color)
 image.pixels=pixels;image.pack();return image

def get_image(name, folder, extra):
 if name.startswith('hd_'):
  p=Path(folder)/name
  if not p.exists():p=SOURCE/'textures'/name
  image=bpy.data.images.load(str(p),check_existing=True)
  if max(image.size)>512:image.scale(512,512)
  image.pack();return image
 return original_map(name)

def create_material(image, decal, name, decal_name):
 m=bpy.data.materials.new(name or 'Port paint');m.use_nodes=True
 s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Roughness'].default_value=.75
 low=name.lower()
 if 'metal' in low:s.inputs['Metallic'].default_value=.35;s.inputs['Roughness'].default_value=.43
 if 'window' in low:s.inputs['Roughness'].default_value=.24
 if image:
  t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=image;m.node_tree.links.new(t.outputs['Color'],s.inputs['Base Color'])
  if name.startswith('hd_palmTreeLeaf'):
   m.node_tree.links.new(t.outputs['Alpha'],s.inputs['Alpha']);m.surface_render_method='DITHERED';m.use_backface_culling=False
  if 'window' in low or 'glow' in low:
   m.node_tree.links.new(t.outputs['Color'],s.inputs['Emission Color']);s.inputs['Emission Strength'].default_value=.28 if 'window' in low else .7
 return m
import_spm.getImage=get_image;import_spm.create_material=create_material

def reset():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for datablock in [bpy.data.materials,bpy.data.images]:
  for b in list(datablock):datablock.remove(b)

def export(name):
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
 # Bounds and shape remain authored. Dense tiny props are decimated offline.
 for o in objects:
  if len(o.data.polygons)>7000:
   bpy.context.view_layer.objects.active=o
   modifier=o.modifiers.new('Browser silhouette budget','DECIMATE');modifier.ratio=7000/len(o.data.polygons)
   bpy.ops.object.modifier_apply(modifier=modifier.name)
 # Actual local self-occlusion, calculated once, never per race/frame.
 verts=[];faces=[]
 for o in objects:
  first=len(verts);verts.extend([o.matrix_world@v.co for v in o.data.vertices]);faces.extend([tuple(first+i for i in f.vertices) for f in o.data.polygons])
 bvh=BVHTree.FromPolygons(verts,faces,all_triangles=False)
 bounds=[v for v in verts];lo=Vector(tuple(min(v[i] for v in bounds) for i in range(3)));hi=Vector(tuple(max(v[i] for v in bounds) for i in range(3)))
 distance=max((hi-lo).length*.15,.3)
 rays=[Vector((math.cos(i*2.39996)*math.sqrt(1-((i+.5)/20)**2),math.sin(i*2.39996)*math.sqrt(1-((i+.5)/20)**2),(i+.5)/20)) for i in range(20)]
 for o in objects:
  colors=o.data.color_attributes.get('Local occlusion') or o.data.color_attributes.new(name='Local occlusion',type='FLOAT_COLOR',domain='CORNER')
  cache={}
  for v in o.data.vertices:
   n=(o.matrix_world.to_3x3()@v.normal).normalized();q=Vector((0,0,1)).rotation_difference(n);p=o.matrix_world@v.co+n*.008
   hits=sum(bvh.ray_cast(p,q@r,distance)[0] is not None for r in rays)
   cache[v.index]=max(.52,1-hits/20*.48)
  for i,l in enumerate(o.data.loops):
   a=cache[l.vertex_index];colors.data[i].color=(a,a,a,1)
  o.data.color_attributes.active_color=colors
 bpy.ops.export_scene.gltf(filepath=str(PACK/'models'/f'{name}.glb'),export_format='GLB',export_animations=False,export_yup=True,export_extras=True,export_vertex_color='ACTIVE')
 print('EXPORTED HARBOR',name,sum(len(o.data.polygons) for o in objects),flush=True)

for name,(folder,file) in MODELS.items():
 reset();import_spm.loadSPM(bpy.context,str(SOURCE/'library'/folder/file),str(SOURCE/'library'/folder));export(name)

# Hull and lattice are authored offline vertex meshes, with curved silhouettes
# and bevelled structural profiles. No runtime box/sphere stand-ins.
def painted(name,color):
 m=bpy.data.materials.new(name);m.use_nodes=True;s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Base Color'].default_value=(*color,1);s.inputs['Metallic'].default_value=.25;s.inputs['Roughness'].default_value=.55
 t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=original_map('metal');mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.5;mix.inputs[1].default_value=(*color,1);m.node_tree.links.new(t.outputs['Color'],mix.inputs[2]);m.node_tree.links.new(mix.outputs[0],s.inputs['Base Color']);return m

def mesh_object(name,verts,faces,material):
 g=bpy.data.meshes.new(name);g.from_pydata(verts,[],faces);g.update();o=bpy.data.objects.new(name,g);bpy.context.collection.objects.link(o);o.data.materials.append(material)
 # Explicit planar UVs for reusable trim grain.
 uv=g.uv_layers.new(name='UVMap')
 for f in g.polygons:
  normal=f.normal;axes=(0,1) if abs(normal.z)>.5 else ((0,2) if abs(normal.y)>.5 else (1,2))
  for li in f.loop_indices:
   p=g.vertices[g.loops[li].vertex_index].co;uv.data[li].uv=(p[axes[0]]*.12,p[axes[1]]*.12)
 return o

def beam(name,a,b,r,material,sides=6):
 a=Vector(a);b=Vector(b);q=Vector((0,0,1)).rotation_difference((b-a).normalized());v=[p+q@Vector((r*math.cos(i*math.tau/sides),r*math.sin(i*math.tau/sides),0)) for p in (a,b) for i in range(sides)]
 faces=[tuple(range(sides-1,-1,-1)),tuple(range(sides,sides*2))]+[(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)];return mesh_object(name,v,faces,material)

def prism(name,outline,bottom,top,material):
 n=len(outline);v=[(x,y,z) for z in [bottom,top] for x,y in outline];f=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)];return mesh_object(name,v,f,material)

reset();hull=painted('Salt-weathered teal hull',(.08,.24,.29));deck=painted('Deck paint',(.56,.36,.24));trim=painted('Ivory deckhouse',(.73,.77,.70));glass=painted('Bridge glass',(.11,.27,.34))
outline=[(-3.8,-13),(3.8,-13),(5,-9),(5,8),(3.8,12),(0,16),(-3.8,12),(-5,8),(-5,-9)]
prism('Curved chine hull',outline,.2,3.8,hull);prism('Raised upper deck',[(x*.94,y*.95) for x,y in outline],3.8,4.15,deck)
prism('Recessed bridge',[(-3,5),(3,5),(3,10),(2,11),(-2,11),(-3,10)],4.15,7.8,trim)
prism('Bridge glazing',[(-3.06,6),(3.06,6),(3.06,10),(2,11.06),(-2,11.06),(-3.06,10)],6.35,7.35,glass)
prism('Bridge overhang',[(-3.35,4.9),(3.35,4.9),(3.35,10.2),(2,11.5),(-2,11.5),(-3.35,10.2)],7.8,8.15,trim)
for x in [-4.5,4.5]:
 for y in [-10,-6,-2,2,6]:beam('Deck rail post',(x,y,4.1),(x,y,5.05),.06,trim)
 beam('Deck rail',(x,-10,5),(x,7,5),.07,trim)
for x in [-1.5,1.5]:
 for y in [-9,-4,1]:
  prism('Cargo container',[(x-1.4,y-2),(x+1.4,y-2),(x+1.4,y+2),(x-1.4,y+2)],4.15,6.4,deck)
  for rib in range(6):beam('Container rib',(x-1.42,y-1.8+rib*.65,4.2),(x-1.42,y-1.8+rib*.65,6.35),.03,trim)
beam('Mast',(0,8,8.15),(0,8,12),.12,hull);beam('Mast crossbar',(-2,8,11),(2,8,11),.07,trim);export('cargo-ferry')
reset();paint=painted('Corrugated cargo blue',(.18,.35,.46));trim=painted('Container corner castings',(.43,.48,.49))
prism('Shipping container',[(-1.2,-3),(1.2,-3),(1.2,3),(-1.2,3)],0,2.6,paint)
for side in [-1,1]:
 for i in range(21):beam('Corrugation',(side*1.215,-2.85+i*.285,.08),(side*1.215,-2.85+i*.285,2.52),.035,trim,4)
 for y in [-2.94,2.94]:beam('Corner casting',(side*1.2,y,0),(side*1.2,y,2.6),.085,trim,4)
for x in [-.9,0,.9]:beam('Door locking bar',(x,3.025,.12),(x,3.025,2.48),.036,trim)
export('container')

reset();paint=painted('Crane amber',(.76,.46,.12));dark=painted('Crane rails',(.20,.28,.33))
for x in [-4,4]:
 for y in [-2,2]:beam('Tapered gantry pier',(x*1.15,y,0),(x,y,25),.35,paint)
 for level in range(5):
  z=level*5
  beam('Lattice cross', (x,-2,z),(x,2,z+5),.12,dark);beam('Lattice cross',(x,2,z),(x,-2,z+5),.12,dark)
for y in [-2,2]:beam('Header',(-4,y,25),(4,y,25),.30,paint)
for x in [-.8,.8]:
 beam('Boom chord',(x,-7,26),(x,20,26),.21,paint);beam('Boom upper chord',(x,-7,28),(x,20,28),.17,paint)
 for i in range(9):
  y=-7+i*3;beam('Boom triangulation',(x,y,26),(x,y+3,28),.085,dark);beam('Boom triangulation',(x,y,28),(x,y+3,26),.085,dark)
for y in range(-7,21,3):beam('Boom cross-member',(-.8,y,26),(.8,y,26),.1,dark)
prism('Operator cabin',[(-1.5,-1.8),(1.5,-1.8),(1.5,1.8),(-1.5,1.8)],21.5,24,paint);export('gantry-crane')
manifest=json.loads((PACK/'manifest.json').read_text());manifest['models']=[m for m in manifest['models'] if not m['name'].startswith('harbor:')]
manifest['sources']=[s for s in manifest['sources'] if not s['file'].split('/')[-1].replace('.glb','') in MODELS and not s['file'].endswith(('cargo-ferry.glb','gantry-crane.glb','container.glb'))]
for name in [*MODELS,'cargo-ferry','gantry-crane','container']:
 p=PACK/'models'/f'{name}.glb';manifest['models'].append({'name':'harbor:'+name,'file':'models/'+p.name,'type':'gltf'})
 manifest['sources'].append({'file':'models/'+p.name,'author':'Jean-Manuel Clémençon; STK contributors' if name in MODELS else 'Turbo Trail contributors','license':'CC-BY-SA-4.0' if name in MODELS and name!='palm' else ('CC-BY-SA-3.0' if name=='palm' else 'CC0-1.0'),'source':'https://github.com/supertuxkart/stk-assets-mobile/releases/tag/1.4' if name in MODELS else 'tools/prepare-harbor-fidelity.py','sourceFile':'library/'+ '/'.join(MODELS[name]) if name in MODELS else 'offline authored mesh','modifications':'Shared textures replaced by original trim textures; browser-budget simplification; true ray-occlusion vertex bake; GLB conversion.','bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(PACK/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(PACK/'licenses/STK-assets.txt').write_text((SOURCE/'licenses.txt').read_text())
(PACK/'licenses/STK-textures.txt').write_text((SOURCE/'textures/licenses.txt').read_text())
for folder,file in MODELS.values():
 notice=SOURCE/'library'/folder/'licenses.txt'
 if notice.exists():(PACK/'licenses'/f'{folder}.txt').write_text(notice.read_text())
(PACK/'LICENSES.md').write_text('''# Neon Harbor fidelity assets\n\nSTK 1.4 geometry by Jean-Manuel Clémençon and the credited contributors, CC-BY-SA 4.0; palm by Oliver M-H, CC-BY-SA 3.0, albedo conversions by Jean-Manuel Clémençon, additional leaf by Marianne Gagnon. Streetlamp material sources by Allegorithmic. Full notices in licenses/.\n\nPinned download: https://github.com/supertuxkart/stk-assets-mobile/releases/download/1.4/stk-assets-full.zip\n\nShared source textures without per-file notices have been replaced with original authored trim textures. Other adaptations: true vertex occlusion bake, offline polygon simplification and GLB export. Source conversion script: tools/prepare-harbor-fidelity.py. The adapted STK models remain under their listed share-alike licenses.\n\nCargo ferry and lattice gantry: original authored meshes and trim textures by Turbo Trail contributors, CC0 1.0. These are produced offline by the same script.\n''')
