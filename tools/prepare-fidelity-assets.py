#!/usr/bin/env python3
"""Download pinned PBR hero props and scan maps, retaining provenance and licenses.
Python 3, Pillow, numpy; run before optimize-fidelity-assets.mjs. No runtime downloads.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib, io, json, urllib.request
import numpy as np
from PIL import Image, ImageOps
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/fidelity'
CACHE = Path('/tmp/turbo-fidelity-sources')
REV = 'edc7c9e67c639d230715049ee31f9a96a6babbbe'
K = f'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/{REV}/Models/'
F = 'https://raw.githubusercontent.com/rawprogress/fable-cities/aea8b1035030952555395de0c1de14ba693a1427/public/assets/'
for p in [OUT/'models', OUT/'licenses', OUT/'materials', CACHE]: p.mkdir(parents=True, exist_ok=True)

def sha(data): return hashlib.sha256(data).hexdigest()
def fetch(url):
    path = CACHE / sha(url.encode())
    if not path.exists(): path.write_bytes(urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'TurboTrail-fidelity/1.0'}),timeout=90).read())
    return path.read_bytes()
def record(url, data): return {'url':url,'bytes':len(data),'sha256':sha(data)}
def image(url): return Image.open(io.BytesIO(fetch(url))).convert('RGB')

MODELS = {
 'Avocado': ('avocado', ['pocket-pantry']),
 'BarramundiFish': ('fish', ['pelagic-glasshouse']),
 'BoomBox': ('boombox', ['metronome-hall', 'neon-harbor']),
 'Lantern': ('lantern', ['windmill-wilds','sunstone-ruins','frostpeak-festival','clockwork-citadel','paper-revel','tempest-causeway','railstorm-express','metronome-hall','pelagic-glasshouse','emberwing-observatory']),
 'AntiqueCamera': ('camera', ['sunstone-ruins','frostpeak-festival','emberwing-observatory']),
 'WaterBottle': ('bottle', ['pocket-pantry','railstorm-express']),
 'SheenChair': ('chair', ['metronome-hall','clockwork-citadel']),
 'CommercialRefrigerator': ('fridge', ['pocket-pantry']),
}
def hero(item):
    name,(key,courses)=item
    folder=CACHE/name;folder.mkdir(exist_ok=True)
    downloads=[]
    for filename in ['LICENSE.md','README.md','metadata.json']:
        url=K+name+'/'+filename;data=fetch(url);(folder/filename).write_bytes(data);downloads.append(record(url,data))
        if filename != 'LICENSE.md': (OUT/'licenses'/(key+'-'+filename)).write_bytes(data)
    (OUT/'licenses'/(key+'.md')).write_bytes((folder/'LICENSE.md').read_bytes())
    url=K+name+'/glTF-Binary/'+name+'.glb';data=fetch(url);(folder/(name+'.glb')).write_bytes(data);downloads.append(record(url,data))
    print('Downloaded hero',name,len(data),flush=True)
    return {'key':key,'sourceName':name,'source':K+name+'/','license':'CC-BY-4.0' if name=='CommercialRefrigerator' else 'CC0-1.0','attribution':'licenses/'+key+'.md','courses':courses,'downloads':downloads}
heroes=list(ThreadPoolExecutor(max_workers=4).map(hero,MODELS.items()))

# Material tiles use actual photographed/artist-authored maps. The generic paint,
# ceramic and paper roles adapt the fine plaster scan rather than inventing noise.
SCANS = [
 ('wood','shared/wood_planks','color.jpg','normal.jpg','roughness.jpg','displacement.jpg','ao.jpg', .12, .85),
 ('stone','shared/concrete_wall_008','Diffuse.jpg','nor_gl.jpg','arm.jpg','Displacement.jpg',None,.18,.65),
 ('metal','shared/metalplates006','color.jpg','normalgl.jpg','roughness.jpg',None,None,.07,.75),
 ('paint','shared/plaster_painted','color.jpg','normal.jpg','roughness.jpg','displacement.jpg',None,.025,.50),
 ('plaster','shared/plaster_rough','color.jpg','normal.jpg','roughness.jpg','displacement.jpg',None,.07,.80),
 ('bark','shared/Bark014','color.jpg','normal.jpg','roughness.jpg',None,'ao.jpg',.10,.9),
 ('fabric',None,None,None,None,None,None,.035,.80),
 ('paper','shared/plaster_modern','color.jpg','normal.jpg','roughness.jpg','displacement.jpg',None,.012,.85),
 ('ceramic','shared/plaster_painted','color.jpg','normal.jpg','roughness.jpg','displacement.jpg',None,.015,.25),
 ('rubber','shared/asphalt_light','albedo.jpg','normal.jpg','roughness.jpg','displacement.jpg','ao.jpg',.03,.90),
 ('snow','shared/sand','color.jpg','normal.jpg','roughness.jpg','displacement.jpg','ao.jpg',.045,.95),
 ('leaf','shared/grass','albedo.jpg','normal.jpg','roughness.jpg','displacement.jpg','ao.jpg',.03,.90),
 ('rock','shared/Rock035','color.jpg','normal.jpg','roughness.jpg',None,'ao.jpg',.12,.95),
 ('sand','shared/sand','color.jpg','normal.jpg','roughness.jpg','displacement.jpg','ao.jpg',.08,.95),
 ('brick','shared/bricks_yellow','color.jpg','normal.jpg','roughness.jpg','displacement.jpg','ao.jpg',.16,.80),
 ('roof','shared/roof_tiles_clay','color.jpg','normal.jpg','roughness.jpg','displacement.jpg',None,.15,.80),
]
SIZE=512;PAD=16;INNER=SIZE-2*PAD
atlases={k:Image.new('RGBA',(2048,2048)) for k in ['color','normal','response']}
materials=[];sources=[]
for index,(key,folder,col,nor,rough,height,ao,relief,baseRough) in enumerate(SCANS):
    downloads=[]
    if folder:
        url=F+folder+'/info.json';ev=fetch(url);meta=json.loads(ev)
        if meta['license'] not in ['CC0','CC0-1.0']:raise ValueError('Expected CC0 scan')
        (OUT/'licenses'/(key+'.json')).write_bytes(ev);downloads.append(record(url,ev))
        def load(filename,default):
            if not filename:return Image.new('RGB',(INNER,INNER),default)
            url=F+folder+'/'+filename
            try:data=fetch(url)
            except urllib.error.HTTPError as e:
                if filename in [height,ao] and e.code==404:return Image.new('RGB',(INNER,INNER),default)
                raise
            downloads.append(record(url,data));return Image.open(io.BytesIO(data)).convert('RGB').resize((INNER,INNER),Image.Resampling.LANCZOS)
        c=load(col,(255,255,255));n=load(nor,(128,128,255));r=load(rough,(200,200,200));h=load(height,(128,128,128));a=load(ao,(255,255,255))
        # ARM source channels are R=AO, G=roughness, B=metalness.
        if rough=='arm.jpg':a=r.getchannel('R').convert('RGB');r=r.getchannel('G').convert('RGB')
        source=meta['source'];evidence='licenses/'+key+'.json'
    else:
        base=K+'SheenChair/glTF/'
        c=image(base+'chair_fabric_albedo.png').resize((INNER,INNER),Image.Resampling.LANCZOS)
        n=image(base+'chair_fabric_normal.png').resize((INNER,INNER),Image.Resampling.LANCZOS)
        downloads=[record(base+f,fetch(base+f)) for f in ['chair_fabric_albedo.png','chair_fabric_normal.png']]
        r=Image.new('RGB',(INNER,INNER),(220,220,220));a=Image.new('RGB',(INNER,INNER),(255,255,255));h=Image.new('RGB',(INNER,INNER),(128,128,128));source=K+'SheenChair/';evidence='licenses/chair.md'
    # Preserve each course's deliberate palette. Actual scan contrast remains
    # as an achromatic detail layer instead of imposing a different base color.
    grey=np.asarray(ImageOps.grayscale(c),dtype=float);grey=np.clip(.92+(grey-grey.mean())/255*.26,.76,1.08)
    color=np.zeros((INNER,INNER,4),dtype=np.uint8);color[:,:,:3]=(np.minimum(grey,1)*255).astype('uint8')[:,:,None];color[:,:,3]=255
    normal=np.asarray(n.convert('RGBA')).copy()
    response=np.zeros_like(normal);response[:,:,0]=np.asarray(ImageOps.grayscale(h));response[:,:,1]=np.asarray(ImageOps.grayscale(r));response[:,:,2]=np.asarray(ImageOps.grayscale(a));response[:,:,3]=255
    for channel,data in [('color',color),('normal',normal),('response',response)]:
        padded=np.pad(data,((PAD,PAD),(PAD,PAD),(0,0)),mode='wrap');atlases[channel].paste(Image.fromarray(padded),(index%4*SIZE,index//4*SIZE))
    # Keep genuine scalar source heights separately for offline displacement.
    if height:
        h.save(OUT/'materials'/(key+'-height.png'))
    materials.append({'name':key,'tile':index,'relief':relief,'roughness':baseRough,'metersPerRepeat':2 if key in ['wood','stone','rock','brick','roof'] else .8,'heightSource':bool(height and any(d['url'].endswith(height) for d in downloads))})
    sources.append({'key':key,'source':source,'license':'CC0-1.0','evidence':evidence,'downloads':downloads,'adaptation': 'Fine plaster relief for '+key if key in ['paper','ceramic','paint'] else 'Achromatic scan detail preserves course palette; snow uses fine sand microstructure' if key=='snow' else 'Achromatic scan detail; original normals/roughness and supplied height/AO retained'})
    print('Prepared scan',key,len(downloads),flush=True)
for key,im in atlases.items():im.save(OUT/'materials'/(key+'.png'));im.save(OUT/'materials'/(key+'.webp'),quality=95,lossless=key!='color',method=6)
(OUT/'sources.json').write_text(json.dumps({'heroes':heroes,'materials':materials,'sources':sources},indent=2)+'\n')
# Additional legal marks in the upstream camera texture are retained, not reused as our branding.
url=f'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/{REV}/LICENSES/LicenseRef-LegalMark-UX3D.txt'
(OUT/'licenses/UX3D-mark.txt').write_bytes(fetch(url))
print('Prepared',len(heroes),'hero assets and',len(materials),'physical material roles',flush=True)
