#!/usr/bin/env python3
"""Pinned, offline countryside art conversion. python3 script [archive.zip].

Downloads the licensed STK 1.4 collection, extracts only the selected sources,
then Blender converts authored UV/textured models into economical GLBs. Runtime
never accesses upstream. Derived art retains upstream CC-BY-SA licenses.
"""
from pathlib import Path
import hashlib
import json
import math
import os
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'assets/courses/packs/windmill-wilds'
CACHE = Path(tempfile.gettempdir()) / 'windmill-fidelity'
URL = 'https://github.com/supertuxkart/stk-assets-mobile/releases/download/1.4/stk-assets-full.zip'
HASH = 'ad61912093e7d4b399c8e4841156f45550a8b60dc59a290ad84058a9bae0622d'
# Upstream library model, mesh, height-normalized runtime name, foliage tint.
MODELS = [
 ('stklib_pinetree_b','stklib_pinetree_b_high','fir',False),
 ('stklib_pinetree_b','stklib_pinetree_b_low','fir-far',False),
 ('stklib_autumnTree_b','stklib_autumnTree_b_high','oak',True),
 ('stklib_autumnTree_b','stklib_autumnTree_b_low','oak-far',True),
 ('stklib_autumnTree_d','stklib_autumnTree_d_high','orchard',True),
 ('stklib_autumnTree_d','stklib_autumnTree_d_low','orchard-far',True),
 ('stklib_autumnTree_g','stklib_autumnTree_g_medium','willow',True),
 ('stklib_old_house_a','stklib_old_house_a_main','farmhouse',False),
 ('stklib_silvianHouse_a','stklib_silvianHouse_a_medium','cottage',False),
 ('stklib_woodLodge_a','stklib_woodLodge_a_main','lodge',False),
 ('stklib_redFlowerBush_a','stklib_redFlowerBush_a_main','flower-bush',False),
 ('stklib_lowRockBarrier_a','stklib_lowRockBarrier_a_main','stone-wall',False),
 ('stklib_fern_a','stklib_fern_a_a','fern',False),
 ('stklib_hayBall_a','stklib_hayBall_a_main','hay-bale',False),
 ('stklib_windpump_a','stklib_windpump_a_main','windpump',False),
 ('stklib_windpump_a','stklib_windpump_a_mill','windpump-rotor',False),
 ('stklib_cattail_a','stklib_cattail_a_main','cattail',False),
 ('stklib_ReedBoat_a','stklib_ReedBoat_a','boat',False),
 ('stklib_waterLily_a','stklib_waterLily_a_main_high','lily',False),
 ('stklib_animGrass_a','stklib_animGrass_a_main','grass-tuft',False),
 ('stklib_pallet_a','stklib_pallet_a','pallet',False),
 ('stklib_bench_a','stklib_bench_a_main','bench',False),
]


def convert(source):
    import bpy
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    sys.path.insert(0, str(ROOT / 'tools/vendor/stk-spm'))
    import import_spm
    image_cache = {}
    green = False
    def get_image(name, folder, extra):
        p = Path(folder) / name
        if not p.exists(): p = source / 'textures' / name
        if not p.exists(): raise RuntimeError('Missing texture '+str(p))
        key = str(p) + ('green' if green else '')
        if key not in image_cache:
            from PIL import Image
            import numpy as np
            im = Image.open(p).convert('RGBA')
            im.thumbnail((512,512))
            # Spring foliage conversion: hue-shift original hand-painted leaf
            # textures only, preserving authored alpha and light/dark structure.
            if green and ('leaf' in name.lower() or 'leaves' in name.lower() or 'tree_' in name.lower() or 'autumn' in name.lower()):
                a=np.array(im); rgb=a[:,:,:3].astype(float)/255
                mask=(rgb[:,:,0]>rgb[:,:,2]*1.22)&(rgb[:,:,1]>rgb[:,:,2]*1.12)
                lum=rgb.mean(axis=2)
                for i,factor in enumerate([0.76,1.23,0.62]):
                    rgb[:,:,i]=np.where(mask,np.minimum(1,lum*factor),rgb[:,:,i])
                a[:,:,:3]=(rgb*255).astype('uint8'); im=Image.fromarray(a)
            dest=CACHE/'images'/((hashlib.sha256(key.encode()).hexdigest()[:16])+'.png')
            dest.parent.mkdir(parents=True,exist_ok=True); im.save(dest,optimize=True)
            image_cache[key]=bpy.data.images.load(str(dest),check_existing=True)
        return image_cache[key]
    def material(image, decal, name, decal_name):
        m=bpy.data.materials.new(name or 'plain'); m.use_nodes=True
        bs=m.node_tree.nodes.get('Principled BSDF')
        bs.inputs['Roughness'].default_value=.87
        color=m.node_tree.nodes.new('ShaderNodeVertexColor'); color.layer_name='BakedAmbient'
        if image:
            tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
            m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
            # MASK avoids costly sorted transparent foliage, leaves cast cutout
            # shadows rather than rectangles and retain real authored outlines.
            from PIL import Image
            alpha=Image.open(image.filepath).getextrema()[-1]
            if alpha[0]<245:
                m.node_tree.links.new(tex.outputs['Alpha'],bs.inputs['Alpha'])
                m.surface_render_method='DITHERED'
                m.alpha_threshold=.45
        return m
    import_spm.getImage=get_image;import_spm.create_material=material
    PACK.mkdir(parents=True,exist_ok=True)
    stats=[]
    for lib,filename,name,green in MODELS:
        bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
        import_spm.loadSPM(bpy.context,str(source/'library'/lib/(filename+'.spm')),str(source/'library'/lib))
        objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
        for obj in objects:
            # Broad imported tree outlines use a few thousand triangles, tiny
            # props get a strict cap; alpha cards and authored UVs survive.
            triangles=sum(len(p.vertices)-2 for p in obj.data.polygons)
            cap=5500 if name in ['oak','orchard','fir','willow'] else 5000
            if triangles>cap:
                mod=obj.modifiers.new('Browser detail budget','DECIMATE');mod.ratio=cap/triangles
                bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
            # Real hemisphere occlusion rays for solid architecture/props. No
            # uniform normal/height shade masquerading as an AO bake.
            foliage=any(any(s in m.name.lower() for s in ['leaf','leaves','branch','tree_','grass','fern','flower']) for m in obj.data.materials if m)
            color=obj.data.color_attributes.new(name='BakedAmbient',type='FLOAT_COLOR',domain='POINT')
            if not foliage:
                bvh=BVHTree.FromObject(obj,bpy.context.evaluated_depsgraph_get())
                rays=12
                bounds=[Vector(v) for v in obj.bound_box];extent=max((max(v[i] for v in bounds)-min(v[i] for v in bounds)) for i in range(3))
                for v in obj.data.vertices:
                    n=v.normal.normalized();t=n.cross(Vector((0,0,1)))
                    if t.length<.01:t=n.cross(Vector((0,1,0)))
                    t.normalize();b=n.cross(t);blocked=0
                    for k in range(rays):
                        z=(k+.5)/rays;a=k*2.399963;rad=math.sqrt(1-z*z)
                        direction=n*z+t*(math.cos(a)*rad)+b*(math.sin(a)*rad)
                        hit=bvh.ray_cast(v.co+n*extent*.0005,direction,extent*.26)
                        if hit[0] is not None:blocked+=1
                    shade=1-.38*blocked/rays;color.data[v.index].color=(shade,shade*.99,shade*.97,1)
            else:
                for c in color.data:c.color=(1,1,1,1)
            obj.data.color_attributes.active_color=color
        out=PACK/(name+'.glb')
        bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_yup=True,
             export_animations=False,export_vertex_color="ACTIVE",export_all_vertex_colors=False,export_normals=True,export_texcoords=True,
             export_materials='EXPORT',export_image_format='AUTO')
        # Blender 4 exports alpha as BLEND. These are fixed foliage cutouts,
        # so store alphaMode MASK explicitly in the GLB material JSON below.
        fix_glb_mask(out)
        stats.append({'name':'windmill:'+name,'type':'gltf','file':name+'.glb',
           'source':URL,'sourceFile':'library/'+lib+'/'+filename+'.spm',
           'license':'CC-BY-SA-4.0; see licenses/'+lib+'.txt and upstream.txt',
           'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size,
           'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects)})
        if name in ['fir','oak','orchard']:
            stats[-1]['lods']={'mid':'windmill:'+name+'-far','far':'windmill:'+name+'-far'}
            stats[-1]['lodDistances']=[0,95,210]
        print('EXPORTED',name,stats[-1]['triangles'],out.stat().st_size,flush=True)
    manifest=json.loads((PACK/'manifest.json').read_text())
    manifest['fidelitySource']={'url':URL,'sha256':HASH}
    manifest['models']=[m for m in manifest['models'] if not m['name'].startswith('windmill:')]+stats
    (PACK/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')


def fix_glb_mask(path):
    import struct
    raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0]
    spec=json.loads(raw[20:20+length])
    for m in spec.get('materials',[]):
        if m.get('alphaMode')=='BLEND': m['alphaMode']='MASK';m['alphaCutoff']=.45
        # Imported foliage is painted planes intended to be viewed both sides.
        m['doubleSided']=True
    data=json.dumps(spec,separators=(',',':')).encode();data+=b' '*((-len(data))%4)
    tail=raw[20+length:]
    path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(data)+len(tail))+struct.pack('<II',len(data),0x4e4f534a)+data+tail)
    ensure_glb_uvs(path)


def ensure_glb_uvs(path):
    """Give untextured authored islands stable planar UVs for future reuse."""
    import struct
    raw=path.read_bytes();json_length=struct.unpack_from('<I',raw,12)[0]
    spec=json.loads(raw[20:20+json_length]);cursor=20+json_length
    chunks=[]
    while cursor<len(raw):
        size,kind=struct.unpack_from('<II',raw,cursor);chunks.append((kind,raw[cursor+8:cursor+8+size]));cursor+=8+size
    binary=next(data for kind,data in chunks if kind==0x004e4942)
    # GLB buffers normally contain one byteLength and one BIN chunk.
    spec['buffers'][0]['byteLength']=len(binary);binary=bytearray(binary)
    for mesh in spec.get('meshes',[]):
        for primitive in mesh.get('primitives',[]):
            attrs=primitive.get('attributes',{})
            if 'TEXCOORD_0' in attrs: continue
            accessor=spec['accessors'][attrs['POSITION']]
            view=spec['bufferViews'][accessor['bufferView']]
            start=view.get('byteOffset',0)+accessor.get('byteOffset',0)
            count=accessor['count'];stride=view.get('byteStride',12)
            points=[struct.unpack_from('<3f',binary,start+i*stride) for i in range(count)]
            spans=[max(p[axis] for p in points)-min(p[axis] for p in points) for axis in range(3)]
            axes=sorted(range(3),key=lambda axis:spans[axis],reverse=True)[:2]
            lows=[min(p[axis] for p in points) for axis in axes]
            sizes=[max(spans[axis],1e-5) for axis in axes]
            uvdata=b''.join(struct.pack('<2f',*( (p[axis]-low)/size for axis,low,size in zip(axes,lows,sizes))) for p in points)
            while len(binary)%4: binary.append(0)
            offset=len(binary);binary.extend(uvdata)
            view_index=len(spec['bufferViews']);spec['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(uvdata)})
            accessor_index=len(spec['accessors']);spec['accessors'].append({'bufferView':view_index,'componentType':5126,'count':count,'type':'VEC2','min':[0,0],'max':[1,1]})
            attrs['TEXCOORD_0']=accessor_index
    spec['buffers'][0]['byteLength']=len(binary)
    data=json.dumps(spec,separators=(',',':')).encode();data+=b' '*((-len(data))%4)
    binary.extend(b'\0'*((-len(binary))%4))
    tail=b''.join(struct.pack('<II',len(binary) if kind==0x004e4942 else len(content),kind)+(bytes(binary) if kind==0x004e4942 else content) for kind,content in chunks)
    path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(data)+len(tail))+struct.pack('<II',len(data),0x4e4f534a)+data+tail)


def main():
    archive=Path(sys.argv[1]) if len(sys.argv)>1 else Path(tempfile.gettempdir())/'windmill-stk-assets.zip'
    if not archive.exists():
        urllib.request.urlretrieve(URL,archive)
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=HASH:raise RuntimeError('Archive checksum mismatch')
    source=CACHE/'source';source.mkdir(parents=True,exist_ok=True)
    libs=set(m[0] for m in MODELS)
    with zipfile.ZipFile(archive) as z:
        for n in z.namelist():
            if n=='licenses.txt' or n.startswith('textures/') or any(n.startswith('library/'+lib+'/') for lib in libs):z.extract(n,source)
    notices=PACK/'licenses';notices.mkdir(exist_ok=True)
    (notices/'upstream.txt').write_text((source/'licenses.txt').read_text())
    (notices/'shared-textures.txt').write_text((source/'textures/licenses.txt').read_text())
    for lib in libs:
        p=source/'library'/lib/'licenses.txt'
        (notices/(lib+'.txt')).write_text(p.read_text() if p.exists() else 'Covered by upstream.txt: '+lib+'/* by Jean-Manuel Clémençon; CC-BY-SA 4.0.\n')
    subprocess.run(['blender','--background','--python',str(Path(__file__).resolve()),'--',str(source)],check=True,env={**os.environ,'PYTHONPATH':os.path.dirname(__import__('PIL').__file__)+'/..'})

if __name__=='__main__':
    if '--' in sys.argv:convert(Path(sys.argv[sys.argv.index('--')+1]))
    else:main()
