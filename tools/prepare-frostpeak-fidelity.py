#!/usr/bin/env python3
"""Offline imported resort artwork conversion. Run Blender -b -P this-file -- /tmp/frostpeak-stk.

Source: STK 1.4 full assets release; imported art retains UVs/painted textures.
CC-BY-SA adaptations remain CC-BY-SA. Textures embedded locally; no game-time downloads.
"""
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/courses/packs/frostpeak-festival'
SOURCE = Path(sys.argv[sys.argv.index('--') + 1])
sys.path.insert(0, str(ROOT / 'tools/vendor/stk-spm'))
import import_spm

ARCHIVE = 'https://github.com/supertuxkart/stk-assets-mobile/releases/download/1.4/stk-assets-full.zip'
MODELS = {
    'chalet': 'library/stklib_woodLodge_a/stklib_woodLodge_a_main.spm',
    'pine-near': 'library/stklib_pinetree_a/stklib_pinetree_a_lod_high.spm',
    'pine-mid': 'library/stklib_pinetree_b/stklib_pinetree_b_high.spm',
    'pine-far': 'library/stklib_pinetree_a/stklib_conifer_a_lodlow.spm',
    'snow-bush': 'library/stklib_snowSmallBush_a/stklib_snowSmallBush_a_main.spm',
    'snow-rock': 'library/stklib_snowRocks_a/stklib_snowRocks_a_main.spm',
    'wood-lamp': 'library/stklib_woodPostLamp_a/stklib_woodPostLamp_a_main.spm',
}
CURRENT = ''

def get_image(name, folder, extra):
    p = Path(folder) / name
    if not p.exists(): p = SOURCE / 'textures' / name
    if not p.exists(): raise RuntimeError('Missing texture ' + name)
    image = bpy.data.images.load(str(p), check_existing=True)
    limit = 512
    if max(image.size) > limit:
        scale = limit / max(image.size)
        image.scale(max(1, int(image.size[0]*scale)), max(1, int(image.size[1]*scale)))
    # Preserve authored foliage opacity/cutout; paint irregular snow into the
    # diffuse branch texture offline instead of adding hundreds of snow blobs.
    if 'pine' in CURRENT and any(s in name.lower() for s in ['branch','tree.png','conifer']):
        values = list(image.pixels)
        for i in range(0,len(values),4):
            r,g,b,a = values[i:i+4]
            green = max(0, min(1, (g-r)*4 + g*.7))
            x=(i//4)%image.size[0]; y=(i//4)//image.size[0]
            snow = max(0,min(.92, (.5+math.sin(x*.037+math.sin(y*.061)*2)*.38)*green))
            values[i]=r*(1-snow)+.79*snow
            values[i+1]=g*(1-snow)+.88*snow
            values[i+2]=b*(1-snow)+.94*snow
        image.pixels[:] = values
    image.pack()
    return image

def material(image, decal, name, decal_name):
    mat=bpy.data.materials.new(name or 'Snow plaster')
    mat.use_nodes=True
    shader=mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value=.88
    if image:
        node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
        mat.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color'])
        if image.channels==4:
            mat.node_tree.links.new(node.outputs['Alpha'],shader.inputs['Alpha'])
            mat.surface_render_method='DITHERED'
    else:shader.inputs['Base Color'].default_value=(.17,.12,.075,1)
    return mat

import_spm.getImage=get_image
import_spm.create_material=material

def clear():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for collection in [bpy.data.materials,bpy.data.images,bpy.data.meshes]:
        for item in list(collection):
            if item.users==0:collection.remove(item)

def bake_occlusion():
    """Actual neighbouring-face ray occlusion, multiplied by imported colors.

    Golden-angle hemisphere rays; spatial obstruction, not height darkening.
    Indirect-only color does not bake direct sun shadows a second time.
    """
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    vertices=[];faces=[]
    for o in objects:
        offset=len(vertices);vertices.extend(o.matrix_world@v.co for v in o.data.vertices)
        faces.extend([offset+i for i in p.vertices] for p in o.data.polygons)
    tree=BVHTree.FromPolygons(vertices,faces)
    height=max(v.z for v in vertices)-min(v.z for v in vertices)
    radius=max(.7,height*.2)
    for o in objects:
        data=o.data
        layer=data.color_attributes.get('Color') or data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        for p in data.polygons:
            normal=p.normal.normalized()
            tangent=normal.cross(Vector((0,0,1)))
            if tangent.length<.01:tangent=normal.cross(Vector((1,0,0)))
            tangent.normalize();bitangent=normal.cross(tangent)
            for li in p.loop_indices:
                point=o.matrix_world@data.vertices[data.loops[li].vertex_index].co
                point+=normal*.015
                blocked=0
                for j in range(16):
                    z=(j+.5)/16;r=math.sqrt(1-z*z);angle=j*2.399963
                    ray=(tangent*(math.cos(angle)*r)+bitangent*(math.sin(angle)*r)+normal*z).normalized()
                    hit,_,_,distance=tree.ray_cast(point,ray,radius)
                    if hit is not None:blocked+=1-distance/radius
                ambient=1-.43*blocked/16
                old=layer.data[li].color
                if sum(old[:3])<.001:old=(1,1,1,1)
                layer.data[li].color=(old[0]*ambient,old[1]*ambient,old[2]*ambient,1)

def export(name):
    destination=DEST/'models'/f'{name}.glb'
    bpy.ops.export_scene.gltf(filepath=str(destination),export_format='GLB',export_animations=False,
        export_yup=True,export_extras=True,export_texcoords=True,export_vertex_color="ACTIVE",export_all_vertex_colors=True)
    # Branch/plant decals use cheap alpha test rather than alpha-blended sorting.
    raw=destination.read_bytes();length,kind=struct.unpack_from('<II',raw,12)
    doc=json.loads(raw[20:20+length]);tail=raw[20+length:]
    for m in doc.get('materials',[]):
        if m.get('alphaMode')=='BLEND':m['alphaMode']='MASK';m['alphaCutoff']=.42;m['doubleSided']=True
    block=json.dumps(doc,separators=(',',':')).encode();block+=b' '*((-len(block))%4)
    destination.write_bytes(struct.pack('<III',0x46546c67,2,20+len(block)+len(tail))+struct.pack('<II',len(block),kind)+block+tail)
    import subprocess
    subprocess.run(['python3', '-c', r"""
import io,json,struct,sys
from pathlib import Path
from PIL import Image
p=Path(sys.argv[1]);raw=p.read_bytes();jl,jt=struct.unpack_from('<II',raw,12);doc=json.loads(raw[20:20+jl]);bl,bt=struct.unpack_from('<II',raw,20+jl);binary=raw[28+jl:28+jl+bl]
imageViews={im['bufferView']:im for im in doc.get('images',[]) if 'bufferView' in im}
stream=bytearray()
for i,view in enumerate(doc['bufferViews']):
 data=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
 if i in imageViews:
  image=Image.open(io.BytesIO(data));out=io.BytesIO();image.save(out,'WEBP',quality=86,method=6);data=out.getvalue();imageViews[i]['mimeType']='image/webp'
 view['byteOffset']=len(stream);view['byteLength']=len(data);stream.extend(data);stream.extend(b'\0'*((-len(stream))%4))
for t in doc.get('textures',[]):
 if 'source' in t:t.setdefault('extensions',{})['EXT_texture_webp']={'source':t.pop('source')}
doc['extensionsUsed']=list(set(doc.get('extensionsUsed',[])+['EXT_texture_webp']));doc['extensionsRequired']=list(set(doc.get('extensionsRequired',[])+['EXT_texture_webp']));doc['buffers'][0]['byteLength']=len(stream)
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4);p.write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(stream))+struct.pack('<II',len(j),jt)+j+struct.pack('<II',len(stream),bt)+stream)
""", str(destination)], check=True)
    return destination

DEST.joinpath('models').mkdir(parents=True,exist_ok=True)
manifest=json.loads((DEST/'manifest.json').read_text())
manifest['models']=[m for m in manifest['models'] if not m['name'].startswith('frostpeak:')]
for CURRENT,source in MODELS.items():
    clear()
    import_spm.loadSPM(bpy.context,str(SOURCE/source),str(SOURCE/'textures'))
    # Blank authored door pane is replaced with warmly lit, inset amber glass.
    if CURRENT=='chalet':
        for o in list(bpy.context.scene.objects):
            if o.type=='MESH' and o.name.startswith('___'):
                mat=o.data.materials[0];shader=mat.node_tree.nodes.get('Principled BSDF')
                shader.inputs['Base Color'].default_value=(.55,.28,.07,1)
                shader.inputs['Emission Color'].default_value=(1,.47,.095,1)
                shader.inputs['Emission Strength'].default_value=.45
    if CURRENT in ['chalet','snow-rock','wood-lamp']:bake_occlusion()
    out=export(CURRENT)
    author='Jean-Manuel Clémençon' if CURRENT not in ['pine-mid'] else 'Sven Andreas Belting; Christian Duion Femmer'
    manifest['models'].append({'name':'frostpeak:'+CURRENT,'file':'models/'+out.name,'type':'gltf',
        'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),
        'source':ARCHIVE+'#'+source,'author':author,'license':'CC-BY-SA-4.0' if CURRENT not in ['pine-mid'] else 'CC-BY-SA-3.0 AND CC-BY-3.0',
        'attribution':author+' / SuperTuxKart',
        'modifications':'Converted SPM to textured glTF, embedded resized textures, offline vertex AO for solid models; winter diffuse painting for conifers.'})
    print('EXPORTED',CURRENT,out.stat().st_size)
(DEST/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
notices=DEST/'licenses';notices.mkdir(exist_ok=True)
for name in ['licenses.txt','textures/licenses.txt','library/stklib_pinetree_b/licenses.txt']:
    (notices/(name.replace('/','-'))).write_bytes((SOURCE/name).read_bytes())
(DEST/'ATTRIBUTION.md').write_text('''# Frostpeak Festival imported artwork

Downloaded from the SuperTuxKart 1.4 full asset release:
https://github.com/supertuxkart/stk-assets-mobile/releases/download/1.4/stk-assets-full.zip
Archive SHA256: ad61912093e7d4b399c8e4841156f45550a8b60dc59a290ad84058a9bae0622d.

Wood lodge, snowy rocks, snow shrub, wood-post lamp and pine A: Jean-Manuel Clémençon.
Model derivatives and applicable authored textures: CC BY-SA 4.0.
Pine B geometry: Sven Andreas Belting, CC BY-SA 3.0; fir textures:
Christian “Duion” Femmer and Sven Andreas Belting, CC BY 3.0.
Detailed per-file upstream license evidence is preserved in `licenses/`.

Modifications: SPM conversion to local glTF, texture downsampling and embedding,
painted snow variation on conifer diffuse maps; occlusion from neighbouring faces
baked into vertex colors for buildings, lamps and rocks. No direct sun bake.
These adapted model/texture files retain their upstream share-alike license.

CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/
CC BY-SA 3.0: https://creativecommons.org/licenses/by-sa/3.0/
CC BY 3.0: https://creativecommons.org/licenses/by/3.0/

The existing Kenney holiday props remain CC0; see LICENSE.txt and manifest.
''')
