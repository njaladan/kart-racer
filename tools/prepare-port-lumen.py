#!/usr/bin/env python3
"""Pinned CC0 transport imports and original baked-detail Port Lumen atlases.

Run with Python + Pillow + numpy. Textures contain window interiors, grime,
trim occlusion and emissive masks, requiring no runtime canvas generation.
"""
from pathlib import Path
import hashlib
import json
import urllib.request
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'assets/courses/packs/neon-harbor'
OUT = PACK / 'textures'
OUT.mkdir(exist_ok=True)
manifest = json.loads((PACK / 'manifest.json').read_text())
rng = random.Random(4219)
fontpath = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
font = lambda size: ImageFont.truetype(fontpath, size)
textures = []

def save(image, name, key):
    file = f'textures/{name}.webp'
    image.save(PACK / file, quality=88)
    textures.append({'name':key,'file':file})
    data=(PACK/file).read_bytes()
    manifest['sources']=[m for m in manifest.get('sources',[]) if m.get('file')!=file]
    manifest['sources'].append({'file':file,'author':'Turbo Trail contributors','license':'CC0-1.0','source':'tools/prepare-port-lumen.py','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'modifications':'Original offline texture authoring.'})

for family, (base, neon) in enumerate([((24,38,57),(46,232,220)),((48,29,54),(245,82,168)),((33,41,55),(255,188,96))]):
    w,h=512,1024
    noise=np.random.default_rng(100+family).normal(0,2.3,(h,w,1))
    grad=np.linspace(.58,1,h)[:,None,None]
    arr=np.clip(np.array(base)[None,None,:]*grad+noise,0,255).astype('uint8')
    im=Image.fromarray(arr); d=ImageDraw.Draw(im)
    emit=Image.new('RGB',(w,h)); e=ImageDraw.Draw(emit)
    for floor in range(12):
        y=12+floor*78
        d.rectangle((0,y+66,w,y+77),fill=(13,21,34))
        d.line((0,y+65,w,y+65),fill=(72,86,108),width=2)
        for col in range(6):
            x=12+col*83
            d.rectangle((x,y,x+64,y+57),fill=(9,15,26))
            d.rectangle((x+3,y+3,x+61,y+54),fill=(43,56,72))
            lit=rng.random()>.38
            c=rng.choice([(237,180,103),(134,211,224),(237,114,172)]) if lit else (22,35,51)
            d.rectangle((x+7,y+7,x+57,y+49),fill=c)
            if lit:
                e.rectangle((x+7,y+7,x+57,y+49),fill=tuple(int(v*.72) for v in c))
                # Silhouettes suggest furniture, blinds and partitions, never people.
                d.rectangle((x+9,y+35,x+30,y+47),fill=(66,62,61))
                for yy in range(y+10,y+28,5):
                    d.line((x+7,yy,x+57,yy),fill=tuple(int(v*.52) for v in c))
                    e.line((x+7,yy,x+57,yy),fill=(0,0,0),width=2)
            d.rectangle((x+30,y+5,x+34,y+53),fill=(17,27,39))
            e.rectangle((x+30,y+5,x+34,y+53),fill=(0,0,0))
            if (col+floor)%7==0:
                d.rectangle((x+40,y+45,x+70,y+65),fill=(81,88,101))
                for xx in range(x+43,x+67,4): d.line((xx,y+49,xx,y+62),fill=(21,29,41),width=2)
        if floor%3==family%3:
            d.line((0,y+72,w,y+72),fill=neon,width=3)
            e.line((0,y+72,w,y+72),fill=neon,width=3)
    # Ground floor: shutters, inset display windows, threshold and illuminated fascia.
    d.rectangle((0,950,512,1024),fill=(17,24,37))
    for x in range(8,512,128):
        d.rectangle((x,969,x+110,1016),fill=(53,65,79))
        for yy in range(972,1016,5):d.line((x,yy,x+110,yy),fill=(19,28,42),width=2)
    d.rectangle((0,950,512,960),fill=neon);e.rectangle((0,950,512,960),fill=neon)
    save(im,f'facade-{family}',f'harborFacade{family}')
    save(emit,f'facade-{family}-emission',f'harborFacadeEmission{family}')

# One neutral corrugated surface is tinted by shared cargo materials in the scene.
w,h=1024,512
arr=np.random.default_rng(41).normal(146,5,(h,w,1))*np.ones((1,1,3))
for x in range(w):
    arr[:,x]*=.53+.47*max(0,np.cos(x/22*np.pi*2))
im=Image.fromarray(np.clip(arr,0,255).astype('uint8'));d=ImageDraw.Draw(im)
for y in [0,15,490,505]:d.rectangle((0,y,w,y+6),fill=(62,68,76))
for x in range(12,w,88):
    d.ellipse((x,8,x+4,12),fill=(190,196,201));d.ellipse((x,493,x+4,497),fill=(190,196,201))
for _ in range(280):
    x,y=rng.randrange(w),rng.randrange(h);d.line((x,y,x+rng.randrange(3,15),y+rng.randrange(1,5)),fill=(88,77,69),width=1)
d.rectangle((680,70,980,182),fill=(24,31,43));d.text((700,80),'LUMEN',font=font(43),fill=(213,221,227));d.text((698,135),'FREIGHT // 048',font=font(21),fill=(183,200,215))
d.rectangle((49,56,125,134),fill=(207,186,107));d.polygon([(62,120),(87,66),(113,120)],fill=(22,27,38))
d.text((685,206),'LMU  308191  7',font=font(20),fill=(225,229,231))
save(im,'cargo-corrugated','harborCargo')

# 4 x 4 sign atlas, shared by every advertisement and wayfinding sign.
im=Image.new('RGB',(2048,1024),(8,13,28));d=ImageDraw.Draw(im)
labels=[('LUMEN','AFTER HOURS'),('NOODLE / 24','HOT FOOD · COLD CITY'),('ION','BATTERY EXCHANGE'),('PORT 08','FREIGHT NEVER SLEEPS'),('INSTANT','PARKING  [ FULL ]'),('DAYLIGHT','24 HOUR / CLOSED'),('DECK 02','ROLL ON // RACE OUT'),('SKYLINE','EXPRESS LINE 04'),('OPEN ALL NIGHT','MARKET DISTRICT'),('ELECTRIC','TIDE SHIPPING'),('CARGO RUN','FOLLOW AMBER'),('SOUTH QUAY','KEEP THE WATER CLOSE'),('LUMEN FM','94.8 / NIGHT SIGNAL'),('SERVICE CUT','ROUGH / BOOST ADVISED'),('EXIT RAMP','AIR TIME AHEAD'),('BLUE HOUR','COASTAL RESIDENCES')]
for i,(title,sub) in enumerate(labels):
    x=(i%4)*512;y=(i//4)*256;c=[(77,236,223),(250,91,174),(255,199,109),(140,160,255)][i%4]
    d.rectangle((x+6,y+6,x+506,y+250),outline=c,width=4)
    for yy in range(y+12,y+246,6):d.line((x+12,yy,x+500,yy),fill=(16,24,43))
    d.text((x+30,y+39),'PORT LUMEN // '+str(i+1).zfill(2),font=font(18),fill=(124,156,181))
    f=font(54 if len(title)<11 else 37)
    d.text((x+256,y+118),title,font=f,fill=c,anchor='mm')
    d.line((x+30,y+168,x+482,y+168),fill=c,width=2)
    d.text((x+256,y+202),sub,font=font(20),fill=(216,231,240),anchor='mm')
    d.rectangle((x+26,y+227,x+81,y+234),fill=c)
save(im,'sign-atlas','harborSigns')

# Large welcome sign and tiled conveyor are authored offline too.
im=Image.new('RGB',(1024,256),(10,18,36));d=ImageDraw.Draw(im)
d.rectangle((5,5,1018,250),outline=(242,74,165),width=5)
d.text((512,62),'WELCOME TO',font=font(38),fill=(255,218,164),anchor='mm')
d.text((512,156),'PORT LUMEN',font=font(111),fill=(90,248,234),anchor='mm')
d.text((512,221),'COASTAL MEGACITY // GATE 01',font=font(18),fill=(105,151,181),anchor='mm')
save(im,'welcome','harborWelcome')
im=Image.new('RGB',(256,512),(25,34,44));d=ImageDraw.Draw(im)
for y in range(0,512,64):
    d.rectangle((0,y,256,y+5),fill=(8,14,23))
    d.line((0,y+7,256,y+7),fill=(109,124,134),width=2)
    for x in [10,246]:d.ellipse((x-2,y+19,x+2,y+23),fill=(144,156,168))
    d.polygon([(68,y+46),(128,y+13),(188,y+46),(188,y+57),(128,y+26),(68,y+57)],fill=(215,168,71))
    d.rectangle((3,y+7,12,y+62),fill=(63,156,160));d.rectangle((244,y+7,253,y+62),fill=(63,156,160))
save(im,'conveyor','harborConveyor')

# Stocked unattended shop windows: four recessed interiors in one atlas.
im=Image.new('RGB',(1024,512),(6,11,20));d=ImageDraw.Draw(im)
for cell in range(4):
    x=(cell%2)*512;y=(cell//2)*256
    neon=[(60,212,204),(255,159,80),(222,104,177),(134,164,255)][cell]
    d.rectangle((x+6,y+6,x+506,y+250),fill=(29,35,47),outline=(62,81,99),width=6)
    d.rectangle((x+23,y+25,x+489,y+233),fill=(9,17,27))
    d.rectangle((x+29,y+29,x+483,y+38),fill=neon)
    for row in range(3):
        yy=y+58+row*56
        for col in range(11):
            xx=x+43+col*39
            color=rng.choice([(95,139,163),(177,107,66),(178,146,68),(104,146,114),(165,93,139)])
            if cell==0:
                d.rectangle((xx,yy+13,xx+20,yy+40),fill=color)
                d.rectangle((xx+5,yy+7,xx+15,yy+13),fill=(61,77,94))
                d.rectangle((xx+3,yy+26,xx+17,yy+34),fill=(203,213,198))
            elif cell==1:
                d.ellipse((xx,yy+20,xx+25,yy+38),fill=(204,182,134))
                d.rectangle((xx,yy+10,xx+25,yy+21),fill=(106,67,45))
                d.line((xx+4,yy+13,xx+20,yy+13),fill=(228,181,108),width=3)
            else:
                d.rectangle((xx,yy+8,xx+25,yy+40),fill=color)
                d.rectangle((xx+4,yy+14,xx+21,yy+25),fill=(39,58,75))
                d.line((xx+4,yy+34,xx+21,yy+34),fill=neon,width=2)
        d.rectangle((x+29,yy+41,x+483,yy+47),fill=(71,80,93))
        d.line((x+29,yy+43,x+483,yy+43),fill=neon,width=1)
    for xx in [x+178,x+336]:d.rectangle((xx,y+26,xx+7,y+234),fill=(16,28,41))
    d.polygon([(x+30,y+39),(x+117,y+39),(x+230,y+224),(x+196,y+224)],fill=(28,44,58))
    d.rectangle((x+17,y+232,x+495,y+243),fill=(70,82,99))
save(im,'shopfront-atlas','harborShops')

# Imported low-poly silhouettes; pin to the exact mirror commit for reproduction.
revision='1f7dee9076ee848773f08fd632ab4e4e73357777'
selected={'car-kit':['sedan','taxi','van','truck','delivery'],'city-kit-commercial':['building-skyscraper-a','building-skyscraper-d']}
for pack,names in selected.items():
    for name in names:
        url=f'https://raw.githubusercontent.com/Hidencod/tge-assets/{revision}/packs/{pack}/{name}.glb'
        request=urllib.request.Request(url,headers={'User-Agent':'PortLumen-assets'})
        data=urllib.request.urlopen(request,timeout=45).read()
        file=f'models/lumen-{name}.glb';(PACK/file).write_bytes(data)
        key=f'lumen:{name}'
        manifest['models']=[m for m in manifest['models'] if m['name']!=key]
        manifest['models'].append({'name':key,'file':file,'type':'gltf'})
        manifest['sources']=[m for m in manifest.get('sources',[]) if m.get('file')!=file]
        manifest['sources'].append({'file':file,'author':'Kenney','license':'CC0-1.0','source':url,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'modifications':'None; runtime fits to vehicle bounds.'})
manifest['textures']=textures
(PACK/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(PACK/'licenses/Port-Lumen.txt').write_text('''Port Lumen additions: original facade / emission / cargo / sign atlases by Turbo Trail contributors, CC0-1.0. Reproduce with tools/prepare-port-lumen.py.\n\nVehicles and skyscraper silhouettes: Kenney, CC0-1.0.\nhttps://kenney.nl/assets/car-kit\nhttps://kenney.nl/assets/city-kit-commercial\nMirror: https://github.com/Hidencod/tge-assets\nExact download URLs and SHA-256 hashes in manifest.json.\n''')
print(f'Prepared {len(textures)} textures and 7 imported models.')
