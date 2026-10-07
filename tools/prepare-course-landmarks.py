#!/usr/bin/env python3
"""Pinned complete landmarks, replacing primitive scenery. Python/Pillow + Blender."""
from pathlib import Path
import hashlib, json, subprocess, sys, urllib.request, io, struct
ROOT=Path(__file__).resolve().parents[1]
CACHE=Path('/tmp/turbo-landmarks')
REV='b917b6c01b55b43208c5eaa1b4d187bbf59457ac'
BASE='https://raw.githubusercontent.com/Nomagno/stk-assets/'+REV+'/'
SOURCES=[('stklib_old_house_a','stklib_old_house_a_main.spm','old-house'),('stklib_steamLocomotive_a','stklib_steamengine_a.spm','steam-engine')]
def sha(data): return hashlib.sha256(data).hexdigest()
if '--convert' in sys.argv:
 import bpy
 sys.path.insert(0,str(ROOT/'tools/vendor/stk-spm'))
 import import_spm
 from PIL import Image
 def image(name,folder,extra):
  p=Path(folder)/name
  if not p.exists():p=CACHE/'textures'/name
  if not p.exists():raise RuntimeError(str(p))
  dest=CACHE/'resized'/name;dest.parent.mkdir(exist_ok=True)
  im=Image.open(p);im.thumbnail((1024,1024));im.save(dest)
  return bpy.data.images.load(str(dest),check_existing=True)
 def material(im,decal,name,decal_name):
  name=name or "plain";m=bpy.data.materials.new(name);m.use_nodes=True
  bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.8
  if im:
   t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=im;m.node_tree.links.new(t.outputs['Color'],bs.inputs['Base Color'])
  stem=Path(name).stem
  normal=next((p for p in [CACHE/'library'/lib/(stem+'_nm.jpg'),CACHE/'textures'/(stem+'_nm.jpg')] if p.exists()),None)
  if normal:
   t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(normal),check_existing=True);t.image.colorspace_settings.name='Non-Color'
   n=m.node_tree.nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.55
   m.node_tree.links.new(t.outputs['Color'],n.inputs['Color']);m.node_tree.links.new(n.outputs['Normal'],bs.inputs['Normal'])
  return m
 import_spm.getImage=image;import_spm.create_material=material
 for lib,file,name in SOURCES:
  bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
  import_spm.loadSPM(bpy.context,str(CACHE/'library'/lib/file),str(CACHE/'library'/lib))
  bpy.ops.export_scene.gltf(filepath=str(CACHE/(name+'.glb')),export_format='GLB',export_yup=True,export_animations=False)
 sys.exit(0)
def fetch(path):
 p=CACHE/path;p.parent.mkdir(parents=True,exist_ok=True)
 if not p.exists():p.write_bytes(urllib.request.urlopen(BASE+path,timeout=60).read())
 return p.read_bytes()
for lib,file,name in SOURCES:
 fetch('library/'+lib+'/'+file);fetch('library/'+lib+'/licenses.txt')
 stream=io.BytesIO(fetch('library/'+lib+'/'+file));stream.read(28);count=struct.unpack('<H',stream.read(2))[0]
 for _ in range(count*2):
  length=struct.unpack('<B',stream.read(1))[0];texture=stream.read(length).decode('ascii')
  if texture:
   try:fetch('library/'+lib+'/'+texture)
   except urllib.error.HTTPError:fetch('textures/'+texture)
 # These authored normal maps are optional in STK's material table.
 if name=='old-house':
  for texture in ['door_nm.jpg','roof_3_nm.jpg','stktex_generic_WoodA_nm.jpg']:
   fetch('library/'+lib+'/'+texture)
fetch('textures/licenses.txt')
subprocess.run(['blender','-b','-t','2','--python-exit-code','1','--python',__file__,'--','--convert'],check=True)
for course in ['railstorm-express','clockwork-citadel']:
 folder=ROOT/'assets/courses/packs'/course
 if not folder.exists():continue
 manifest=json.loads((folder/'manifest.json').read_text())
 for lib,file,name in SOURCES:
  if name=='steam-engine' and course!='railstorm-express':continue
  data=(CACHE/(name+'.glb')).read_bytes();out='models/'+name+'.glb'
  (folder/'models').mkdir(exist_ok=True);(folder/'licenses').mkdir(exist_ok=True)
  if course=='clockwork-citadel':out='../railstorm-express/'+out
  else:(folder/out).write_bytes(data)
  notice='licenses/'+name+'.txt';(folder/notice).write_bytes(fetch('library/'+lib+'/licenses.txt'))
  (folder/'licenses/landmark-textures.txt').write_bytes(fetch('textures/licenses.txt'))
  entry={'name':'art:'+name,'file':out,'type':'gltf','license':'CC-BY-SA-4.0','author':'Sven Andreas Belting; texture contributors listed in retained notices','source':'https://supertuxkart.net','download':BASE+'library/'+lib+'/'+file,'sourceRevision':REV,'sourcePath':'library/'+lib+'/'+file,'sourceSha256':sha(fetch('library/'+lib+'/'+file)),'attribution':notice,'additionalAttribution':'licenses/landmark-textures.txt','modifications':'Complete authored SPM converted to static glTF; original diffuse UVs and house normal maps retained; color textures capped at 1024px.','bytes':len(data),'sha256':sha(data)}
  manifest['models']=[e for e in manifest['models'] if e['name']!=entry['name']]+[entry]
 (folder/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
