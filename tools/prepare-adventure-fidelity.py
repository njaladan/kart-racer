#!/usr/bin/env python3
"""Download CC0 artwork for the six least-dressed adventures; cache and hash sources.

Python 3 + Pillow. Runtime is entirely local. Model selections are from Kenney;
scans are ambientCG via a pinned redistribution with individual license evidence.
"""
import hashlib
import io
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import urllib.request
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path('/tmp/turbo-adventure-art')
CACHE.mkdir(exist_ok=True)
KENNEY = 'https://raw.githubusercontent.com/Hidencod/tge-assets/main/'
FABLE = 'https://raw.githubusercontent.com/rawprogress/fable-cities/aea8b1035030952555395de0c1de14ba693a1427/public/assets/'
SELECTION = {
 'tempest-causeway': ['nature-kit/rock-tallb@rock-tallb','nature-kit/rock-tallb@rock-largee','pirate-kit/ship-medium','pirate-kit/boat-row-large','nature-kit/grass-leafslarge'],
 'pocket-pantry': ['food-kit/croissant','food-kit/strawberry','food-kit/donut-sprinkles','food-kit/mug','food-kit/rollingpin','food-kit/whisk','food-kit/broccoli','food-kit/cookie-chocolate','furniture-kit/kitchencoffeemachine','food-kit/bread','furniture-kit/kitchencabinet','furniture-kit/kitchencabinetupper'],
 'railstorm-express': ['nature-kit/rock-tallb@rock-tallb','nature-kit/tree-pinetalla-detailed','nature-kit/tree-pineroundd','space-kit/monorail-traincargo','space-kit/machine-generatorlarge','space-kit/barrels','nature-kit/log-stacklarge'],
 'metronome-hall': ['furniture-kit/chairrounded','furniture-kit/books','furniture-kit/speaker','furniture-kit/lamproundtable','furniture-kit/radio','furniture-kit/cabinettelevision'],
 'pelagic-glasshouse': ['nature-kit/rock-tallb@rock-largee','nature-kit/grass-leafslarge','nature-kit/plant-bushdetailed','nature-kit/hanging-moss','nature-kit/lily-large','food-kit/fish','nature-kit/flower-purplec'],
 'emberwing-observatory': ['nature-kit/rock-tallb@rock-tallb','nature-kit/rock-tallb@rock-largee','space-kit/satellitedish-detailed','space-kit/meteor-detailed','nature-kit/tree-palmdetailedshort','nature-kit/flower-redc'],
}
SCANS = {
 'wood': ('shared/wood_planks','color.jpg'),
 'rock': ('shared/Rock035','color.jpg'),
 'metal': ('shared/metalplates006','color.jpg'),
 'stone': ('shared/concrete034','color.jpg'),
 'paving': ('shared/paving_cobble','albedo.jpg'),
 'gravel': ('simulation/tex/Gravel022','Color.jpg'),
 'sand': ('shared/sand','color.jpg'),
}
SURFACES = {
 'tempest-causeway': ['rock','metal','stone'],
 'pocket-pantry': ['wood','metal','paving'],
 'railstorm-express': ['rock','metal','wood','gravel'],
 'metronome-hall': ['wood','metal'],
 'pelagic-glasshouse': ['rock','sand','metal','paving'],
 'emberwing-observatory': ['rock','stone','metal','paving'],
}
def digest(data): return hashlib.sha256(data).hexdigest()
def fetch(url):
 path=CACHE/digest(url.encode())
 if not path.exists():
  try:
   path.write_bytes(urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'TurboTrail-art/1.0'}),timeout=45).read())
  except Exception:
   print('Download failed:',url,flush=True);raise
 return path.read_bytes()
def output(path,data):
 path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
 return {'bytes':len(data),'sha256':digest(data)}
catalog_bytes=fetch(KENNEY+'catalog.json')
catalog=json.loads(catalog_bytes)
entries={m['id']:(p,m) for p in catalog['packs'] for m in p['models']}
REUSE = {
 'tempest-causeway': [('windmill-wilds','windmill:cottage','coastal-cottage'),('sunstone-ruins','ruins:grass','coastal-grass')],
 'railstorm-express': [('windmill-wilds','windmill:fir','fir'),('windmill-wilds','windmill:fir-far','fir-far'),('windmill-wilds','windmill:fern','fern')],
 'pelagic-glasshouse': [('windmill-wilds','windmill:fern','reef-fern'),('sunstone-ruins','ruins:grass','reef-grass')],
 'emberwing-observatory': [('sunstone-ruins','ruins:palm','terrace-palm'),('windmill-wilds','windmill:flower-bush','terrace-flowers')],
}
def reuse_models(course, manifest):
 # Existing downloaded STK artwork is shared by path, with its original notices.
 for source_course,source_name,name in REUSE.get(course,[]):
  source_folder=ROOT/'assets/courses/packs'/source_course
  source=json.loads((source_folder/'manifest.json').read_text())
  entry=next(e for e in source['models'] if e['name']==source_name).copy()
  entry['name']='art:'+name;entry['file']='../'+source_course+'/'+entry['file']
  entry['license']='CC-BY-SA-3.0' if name=='terrace-palm' else 'CC-BY-SA-4.0'
  if entry.get('attribution'):entry['attribution']='../'+source_course+'/'+entry['attribution']
  else:entry['attribution']='../'+source_course+'/licenses/'+entry['sourceFile'].split('/')[1]+'.txt'
  if name=='fir':
   entry['lods']={'mid':'art:fir-far','far':'art:fir-far'};entry['lodDistances']=[0,110,230]
  manifest['models'].append(entry)
def build(course):
 folder=ROOT/'assets/courses/packs'/course
 manifest=json.loads((folder/'manifest.json').read_text())
 manifest['models']=[]
 manifest['textures']=[t for t in manifest.get('textures',[]) if t['name'].endswith('-label')]
 (folder/'licenses').mkdir(exist_ok=True)
 (folder/'licenses/CC0.txt').write_text('CC0 1.0 Universal: https://creativecommons.org/publicdomain/zero/1.0/\nKenney: https://kenney.nl/assets\nambientCG: https://docs.ambientcg.com/license/\n')
 for selected in SELECTION[course]:
  id, _, alias = selected.partition('@')
  pack,entry=entries[id]
  assert pack['license']=='CC0-1.0'
  alias=alias or id.split('/')[1]
  data=fetch(KENNEY+entry['file']);file='models/'+alias+'.glb'
  manifest['models'].append({'name':'art:'+alias,'sourceModel':entry['id'].split('/')[1],'file':file,'type':'gltf','author':pack['author'],'license':pack['license'],'source':pack['url'],'download':KENNEY+entry['file'],'sourceSha256':digest(data),'catalogSha256':digest(catalog_bytes),'attribution':'licenses/CC0.txt',**output(folder/file,data)})
 for key in SURFACES[course]:
  path,color=SCANS[key];evidence=fetch(FABLE+path+'/info.json');meta=json.loads(evidence)
  assert meta['license'] in ['CC0','CC0-1.0']
  output(folder/('licenses/'+key+'.json'),evidence)
  for slot,filename in [('color',color),('normal','NormalGL.jpg' if key=='gravel' else 'normal.jpg'),('roughness','Roughness.jpg' if key=='gravel' else 'roughness.jpg')]:
   download=FABLE+path+'/'+filename
   if key in ['metal','stone'] and slot=='normal':
    download=FABLE+'simulation/tex/'+meta['id']+'/NormalGL.jpg'
   data=fetch(download)
   im=Image.open(io.BytesIO(data)).convert('RGB').resize((1024 if slot=='color' else 512,)*2,Image.Resampling.LANCZOS)
   if slot=='color':
    im=ImageEnhance.Color(im).enhance(.72);im=ImageEnhance.Contrast(im).enhance(.87)
   buf=io.BytesIO();im.save(buf,format='WEBP',quality=90,lossless=slot=='normal',method=6)
   file='textures/'+key+'-'+slot+'.webp'
   manifest['textures'].append({'name':key if slot=='color' else key+slot.capitalize(),'file':file,'colorSpace':'srgb' if slot=='color' else 'linear','source':meta['source'],'download':download,'sourceSha256':digest(data),'license':'CC0-1.0','author':'ambientCG','licenseEvidence':'licenses/'+key+'.json','modifications':'1024px color / 512px OpenGL normal and roughness; restrained color grading; WebP',**output(folder/file,buf.getvalue())})
 reuse_models(course,manifest)
 manifest['artDirection']='Layered authored scenery, scanned PBR surfaces, animated environmental stories and offline occluded light spill.'
 (folder/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 print(course,len(manifest['models']),'models',len(manifest['textures']),'maps',flush=True)
with ThreadPoolExecutor(max_workers=3) as pool: list(pool.map(build,SELECTION))
