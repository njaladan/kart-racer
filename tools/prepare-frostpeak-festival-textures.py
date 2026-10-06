#!/usr/bin/env python3
"""Original winter-festival textures, baked offline with repeat-safe detail.

Pillow is only an asset preparation dependency. The game loads small local WebPs.
"""
from pathlib import Path
import random
import math
import json
import hashlib
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/courses/packs/frostpeak-festival'
OUT = DEST / 'textures'
OUT.mkdir(exist_ok=True)
rng = random.Random(1877)
size = 512

def save(name, image, quality=88):
    image.save(OUT / (name + '.webp'), quality=quality, method=6)

def wrap_line(draw, points, fill, width):
    for dx in [-size, 0, size]:
        for dy in [-size, 0, size]:
            draw.line([(x+dx,y+dy) for x,y in points], fill=fill, width=width)

# Ice has deep blue fissures, white hairline frost and trapped bubbles. The
# normal map is a true derivative of the baked height field, not random color.
y,x=np.mgrid[0:size,0:size]
waves=np.sin(x*math.tau/size*2+np.sin(y*math.tau/size))*4+np.cos(y*math.tau/size*3)*3
noise=np.random.default_rng(1877).normal(0,1.1,(size,size))
ice=np.stack([139+waves+noise,197+waves*.65+noise,225+waves*.4+noise],axis=-1).clip(0,255).astype('uint8')
ice=Image.fromarray(ice);draw=ImageDraw.Draw(ice)
height=Image.new('L',(size,size),170);hd=ImageDraw.Draw(height)
for i in range(16):
    px,py=rng.randrange(size),rng.randrange(size);points=[(px,py)]
    for j in range(rng.randrange(4,9)):
        px+=rng.randrange(-32,33);py+=rng.randrange(15,50);points.append((px,py))
    wrap_line(draw,points,(72,136,182),3);wrap_line(draw,[(a+2,b) for a,b in points],(222,248,255),1)
    wrap_line(hd,points,110,3)
for i in range(320):
    cx,cy=rng.randrange(size),rng.randrange(size);r=rng.randrange(1,5)
    draw.ellipse((cx-r,cy-r,cx+r,cy+r),outline=(193,226,242),width=1)
save('blue-ice',ice)
h=np.asarray(height.filter(ImageFilter.GaussianBlur(1)),dtype=float)/255
sx=(np.roll(h,-1,axis=1)-np.roll(h,1,axis=1))*3
sy=(np.roll(h,-1,axis=0)-np.roll(h,1,axis=0))*3
normal=np.stack([-sx,-sy,np.ones_like(h)],axis=-1)
normal/=np.linalg.norm(normal,axis=-1)[...,None]
save('blue-ice-normal',Image.fromarray(((normal*.5+.5)*255).astype('uint8')))
rough=np.clip(65+(1-h)*150,0,255).astype('uint8');save('blue-ice-roughness',Image.fromarray(rough).convert('RGB'))

# Corduroy snow: grooming ridges with subtle blue grain and two worn ski tracks.
field=3*np.sin(x*math.tau/size*38)+2*np.sin(y*math.tau/size*2)+noise*.6
snow=np.stack([231+field,239+field,249+field*.65],axis=-1).clip(0,255).astype('uint8')
save('groomed-snow',Image.fromarray(snow))

# Woven fabric and a repeating Alpine eight-point star; colors provide readable
# near-camera detail without thousands of tiny knitted geometry pieces.
fabric=Image.new('RGB',(size,size),'#dc6c88');fd=ImageDraw.Draw(fabric)
for i in range(0,size,4):
    fd.line((i,0,i,size),fill='#c6617c');fd.line((0,i,size,i),fill='#e98aa0')
for cy in range(64,size,128):
    for cx in range(64,size,128):
        for a in range(8):
            angle=a*math.pi/4;ax=cx+math.cos(angle)*34;ay=cy+math.sin(angle)*34
            fd.line((cx,cy,ax,ay),fill='#fff2d4',width=6)
            bx=cx+math.cos(angle)*21;by=cy+math.sin(angle)*21
            for sign in [-1,1]:
                fd.line((bx,by,bx+math.cos(angle+sign*1)*10,by+math.sin(angle+sign*1)*10),fill='#fff2d4',width=4)
        fd.ellipse((cx-4,cy-4,cx+4,cy+4),fill='#f9cc78')
save('festival-knit',fabric)

# Small sign atlas: local shop identities and an illustrated summit/night motif.
atlas=Image.new('RGB',(1024,512),'#584650');ad=ImageDraw.Draw(atlas)
fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
font=ImageFont.truetype(fontpath,34)
for i,(name,color,icon) in enumerate([('SNOWBELL','#327d87','bell'),('COCOA','#ad6376','cup'),('SKY LANTERNS','#746692','star'),('WOOL & WOOD','#867652','mitten')]):
    x0=i*256;ad.rounded_rectangle((x0+8,8,x0+248,504),radius=16,fill=color,outline='#f1d4a1',width=6)
    # Simple bold pictograms read well from the moving chase camera.
    if icon=='cup':
        ad.rounded_rectangle((x0+65,125,x0+173,245),radius=17,fill='#ffead0');ad.arc((x0+148,140,x0+204,215),270,90,fill='#ffead0',width=12)
        for j in range(3):ad.arc((x0+75+j*30,62,x0+95+j*30,113),70,270,fill='#f2cda0',width=4)
    elif icon=='bell':
        ad.pieslice((x0+65,112,x0+190,251),180,360,fill='#ffda87');ad.rectangle((x0+65,170,x0+190,242),fill='#ffda87');ad.ellipse((x0+110,237,x0+145,269),fill='#ffda87')
    elif icon=='star':
        points=[]
        for j in range(10):
            r=76 if j%2==0 else 34;a=-math.pi/2+j*math.pi/5;points.append((x0+128+math.cos(a)*r,190+math.sin(a)*r))
        ad.polygon(points,fill='#ffeab6')
    else:
        ad.rounded_rectangle((x0+85,112,x0+179,245),radius=24,fill='#ffe6c9');ad.rounded_rectangle((x0+55,150,x0+112,215),radius=18,fill='#ffe6c9');ad.rectangle((x0+90,234,x0+176,260),fill='#67b8bd')
    words=name.split(' ');yy=320
    for word in words:
        bounds=ad.textbbox((0,0),word,font=font);ww=bounds[2];ad.text((x0+(256-ww)/2,yy),word,font=font,fill='#fff0d7');yy+=43
save('shop-signs',atlas)

manifest=json.loads((DEST/'manifest.json').read_text())
entries=[('frostIce','blue-ice'),('frostIceNormal','blue-ice-normal'),('frostIceRoughness','blue-ice-roughness'),('frostSnow','groomed-snow'),('frostKnit','festival-knit'),('frostSigns','shop-signs')]
manifest['textures']=[{'name':name,'file':'textures/'+file+'.webp','bytes':(OUT/(file+'.webp')).stat().st_size,'sha256':hashlib.sha256((OUT/(file+'.webp')).read_bytes()).hexdigest(),'source':'Original authored texture; tools/prepare-frostpeak-festival-textures.py','license':'CC0-1.0',**({'colorSpace':'linear'} if name in ['frostIceNormal','frostIceRoughness'] else {})} for name,file in entries]
fox=DEST/'models/fox.glb'
manifest['models']=[m for m in manifest['models'] if m['name']!='frostpeak:fox']
manifest['models'].append({'name':'frostpeak:fox','file':'models/fox.glb','type':'gltf','bytes':fox.stat().st_size,'sha256':hashlib.sha256(fox.read_bytes()).hexdigest(),'source':'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb','license':'CC0-1.0 AND CC-BY-4.0','author':'PixelMannen (model); tomkranis (rig/animation); AsoboStudio and scurest (glTF conversion)','modifications':'Unmodified GLB; normalized and animated at runtime.','licenseEvidence':'licenses/fox.md'})
(DEST/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Baked six compressed winter textures and registered the licensed animated fox.')
