#!/usr/bin/env python3
"""Fetch pinned CC0 scans. Requires Pillow.
Run from anywhere. Sources are cached outside the game, outputs served locally.
"""
import hashlib, io, json, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image, ImageEnhance
ROOT=Path(__file__).resolve().parents[1]
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
(OUT/'index.json').write_text(json.dumps({'textures':textureIndex},indent=2)+'\n')
for path in sorted(OUT.rglob('*')):
 if path.is_file() and path.name not in ['manifest.json','LICENSES.md']:
  data=path.read_bytes();manifest['outputs'].append({'path':str(path.relative_to(OUT)),'bytes':len(data),'sha256':digest(data)})
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Bundle bytes:',sum(p['bytes'] for p in manifest['outputs']))
