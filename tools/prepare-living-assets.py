#!/usr/bin/env python3
"""Fetch pinned CC0 scans and textured Poly Haven props. Requires Pillow/numpy.
Run from anywhere. Sources are cached outside the game, outputs served locally.
"""
import hashlib, io, json, importlib.util, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import numpy as np
from PIL import Image, ImageEnhance
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('course_prepare',ROOT/'tools/prepare-course-assets.py')
helpers=importlib.util.module_from_spec(spec);spec.loader.exec_module(helpers)
BASE='https://raw.githubusercontent.com/rawprogress/fable-cities/aea8b1035030952555395de0c1de14ba693a1427/public/assets/'
OUT=ROOT/'assets/living';CACHE=Path('/tmp/turbo-living-sources')
OUT.mkdir(exist_ok=True);CACHE.mkdir(exist_ok=True)
manifest={'license':'CC0-1.0','sources':[],'outputs':[]}
def digest(data):return hashlib.sha256(data).hexdigest()
def fetch(path):
 url=BASE+path;cache=CACHE/digest(url.encode())
 if not cache.exists():
  req=urllib.request.Request(url,headers={'User-Agent':'TurboTrail-assets/1.0'})
  cache.write_bytes(urllib.request.urlopen(req,timeout=50).read())
 data=cache.read_bytes()
 return data,{'url':url,'sha256':digest(data),'bytes':len(data)}
def image(data,size=1024,color=True):
 im=Image.open(io.BytesIO(data)).convert('RGB').resize((size,size),Image.Resampling.LANCZOS)
 if color:
  im=ImageEnhance.Color(im).enhance(.65)
  im=ImageEnhance.Contrast(im).enhance(.82)
  im=ImageEnhance.Brightness(im).enhance(1.12)
 return im
def save(im,path,lossless=False):
 path=OUT/path;path.parent.mkdir(parents=True,exist_ok=True)
 im.save(path,format='WEBP',quality=90,method=6,lossless=lossless)
def bundle_texture(item):
 key,folder,colorFile,normalFile,roughFile=item
 evidence,record=fetch(folder+'/info.json');meta=json.loads(evidence)
 if meta['license'] not in ['CC0','CC0-1.0']:raise ValueError('Expected CC0')
 records=[record]
 for slot,name in [('color',colorFile),('normal',normalFile),('roughness',roughFile)]:
  data,record=fetch(folder+'/'+name);records.append(record)
  im=image(data,1024 if slot=='color' else 512,slot=='color')
  save(im,Path('textures')/f'{key}-{slot}.webp',slot=='normal')
 return key,{'source':meta['source'],'license':'CC0-1.0','evidence':BASE+folder+'/info.json','downloads':records}
sets=[
 ('grass','shared/grass','albedo.jpg','normal.jpg','roughness.jpg'),
 ('asphalt','shared/asphalt_light','albedo.jpg','normal.jpg','roughness.jpg'),
 ('wood','shared/wood_planks','color.jpg','normal.jpg','roughness.jpg'),
 ('paving','shared/paving_cobble','albedo.jpg','normal.jpg','roughness.jpg'),
 ('sand','shared/sand','color.jpg','normal.jpg','roughness.jpg'),
 ('needles','shared/forest_floor','color.jpg','normal.jpg','roughness.jpg'),
 ('rock','shared/Rock035','color.jpg','normal.jpg','roughness.jpg'),
 ('brick','shared/bricks_yellow','color.jpg','normal.jpg','roughness.jpg'),
 ('roof','shared/roof_tiles_clay','color.jpg','normal.jpg','roughness.jpg'),
 ('gravel','simulation/tex/Gravel022','Color.jpg','NormalGL.jpg','Roughness.jpg'),
]
textureIndex={}
with ThreadPoolExecutor(max_workers=5) as pool:
 for key,source in pool.map(bundle_texture,sets):
  textureIndex[key]={s:f'textures/{key}-{s}.webp' for s in ['color','normal','roughness']}
  manifest['sources'].append({'key':key,**source});print('Downloaded scan:',key,flush=True)
models=[];binary=bytearray();textureFiles={}
for name in ['painted_wooden_bench','street_lamp_02','planter_box_01']:
 folder=f'shared/models/{name}'
 raw,record=fetch(f'{folder}/{name}_1k.gltf');doc=json.loads(raw)
 evidence,ev=fetch(f'{folder}/info.json');meta=json.loads(evidence)
 if meta['license']!='CC0':raise ValueError('Expected CC0 prop')
 records=[record,ev];buffers=[]
 for b in doc['buffers']:
  data,record=fetch(folder+'/'+b['uri']);records.append(record);buffers.append(data)
 if len(buffers)!=1:raise ValueError('Expected one GLTF buffer')
 def texref(info,color=False):
  if not info:return None
  source=doc['images'][doc['textures'][info['index']]['source']]['uri']
  key=f'{name}-{Path(source).stem}'
  path=f'props/{key}.webp'
  if path not in textureFiles:
   data,record=fetch(folder+'/'+source);records.append(record)
   save(image(data,512,color),Path(path),'nor_' in source)
   textureFiles[path]=True
  return path
 materials=[]
 for m in doc.get('materials',[]):
  pbr=m.get('pbrMetallicRoughness',{})
  materials.append({'color':pbr.get('baseColorFactor',[1,1,1,1])[:3],
   'roughness':pbr.get('roughnessFactor',1),'metalness':pbr.get('metallicFactor',1),
   'map':texref(pbr.get('baseColorTexture'),True),
   'normalMap':texref(m.get('normalTexture')),
   'armMap':texref(pbr.get('metallicRoughnessTexture'))})
 pieces=[]
 def visit(index,parent):
  node=doc['nodes'][index];matrix=parent@helpers.node_matrix(node)
  if 'mesh' in node:
   for primitive in doc['meshes'][node['mesh']]['primitives']:
    if primitive.get('mode',4)!=4:raise ValueError('Only triangle props')
    attrs=primitive['attributes'];p=helpers.accessor(doc,buffers[0],attrs['POSITION']).astype(float)
    n=helpers.accessor(doc,buffers[0],attrs['NORMAL']).astype(float)
    uv=helpers.accessor(doc,buffers[0],attrs['TEXCOORD_0']).astype(float)
    indices=helpers.accessor(doc,buffers[0],primitive['indices']).ravel().astype(int) if 'indices' in primitive else np.arange(len(p))
    p=(np.c_[p,np.ones(len(p))]@matrix.T)[:,:3]
    n=n@np.linalg.inv(matrix[:3,:3]);n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-8)
    pieces.append((np.c_[p[indices],n[indices],uv[indices]],primitive.get('material',0)))
  for child in node.get('children',[]):visit(child,matrix)
 for node in doc['scenes'][doc.get('scene',0)]['nodes']:visit(node,np.eye(4))
 allPos=np.concatenate([p[:,:3] for p,_ in pieces]);lo=allPos.min(axis=0);hi=allPos.max(axis=0)
 center=np.array([(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2]);primitives=[]
 for p,material in pieces:
  p[:,:3]-=center;packed=p.astype('<f4').tobytes()
  primitives.append({'offset':len(binary),'vertices':len(p),'material':material});binary.extend(packed)
 models.append({'name':name,'size':(hi-lo).tolist(),'materials':materials,'primitives':primitives})
 manifest['sources'].append({'key':name,'source':meta['source'],'author':meta.get('authors',{}),
  'license':'CC0-1.0','evidence':BASE+folder+'/info.json','downloads':records})
 print('Downloaded textured prop:',name,'triangles',sum(p['vertices']//3 for p in primitives),flush=True)
(OUT/'props.bin').write_bytes(binary)
(OUT/'index.json').write_text(json.dumps({'textures':textureIndex,'stride':8,'models':models},indent=2)+'\n')
for path in sorted(OUT.rglob('*')):
 if path.is_file() and path.name not in ['manifest.json','LICENSES.md']:
  data=path.read_bytes();manifest['outputs'].append({'path':str(path.relative_to(OUT)),'bytes':len(data),'sha256':digest(data)})
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Bundle bytes:',sum(p['bytes'] for p in manifest['outputs']))
