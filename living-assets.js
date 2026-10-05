import * as THREE from './vendor/three/three.module.js';

// Locally bundled 1K CC0 scans and textured Poly Haven props. All network
// downloads happen during preparation, never while a player is racing.
export async function loadLivingAssets(renderer) {
  const response=await fetch('./assets/living/index.json');
  if(!response.ok)throw new Error('Detailed material index could not load');
  const index=await response.json(),loader=new THREE.TextureLoader(),cache=new Map();
  const load=(path,color=false)=>{
    if(!cache.has(path))cache.set(path,loader.loadAsync(`./assets/living/${path}`).then(map=>{
      map.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;
      map.wrapS=map.wrapT=THREE.RepeatWrapping;
      map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      return map;
    }));return cache.get(path);
  };
  const textures=Object.fromEntries(await Promise.all(Object.entries(index.textures).map(async([name,paths])=>{
    const [map,normalMap,roughnessMap]=await Promise.all([load(paths.color,true),load(paths.normal),load(paths.roughness)]);
    map.name=`ambientCG ${name} 1K scan`;
    map.userData.pbr={normalMap,normalScale:new THREE.Vector2(.38,.38),roughnessMap};
    return [name,map];
  })));
  // Rocky verges and cliffs share the same scan rather than duplicating it.
  textures.stone=textures.rock;
  await Promise.all(index.models.flatMap(model=>model.materials.flatMap(m=>
    ['map','normalMap','armMap'].filter(k=>m[k]).map(k=>load(m[k],k==='map')))));
  const binaryResponse=await fetch('./assets/living/props.bin');
  if(!binaryResponse.ok)throw new Error('Detailed scenery props could not load');
  const data=await binaryResponse.arrayBuffer(),maps=Object.fromEntries(await Promise.all([...cache].map(async([path,p])=>[path,await p])));
  return {textures,models:decodeLivingModels(index,data,maps)};
}

export function decodeLivingModels(index,data,maps={}) {
  const models={};
  for(const definition of index.models) {
    const group=new THREE.Group();group.name=`Poly Haven ${definition.name}`;
    const materials=definition.materials.map(m=>new THREE.MeshStandardMaterial({
      color:new THREE.Color().setRGB(...m.color,THREE.LinearSRGBColorSpace),
      roughness:m.roughness,metalness:m.metalness,map:maps[m.map]||null,
      normalMap:maps[m.normalMap]||null,normalScale:new THREE.Vector2(.55,.55),
      roughnessMap:maps[m.armMap]||null,metalnessMap:maps[m.armMap]||null,
    }));
    for(const part of definition.primitives) {
      const source=new Float32Array(data,part.offset,part.vertices*index.stride),geometry=new THREE.BufferGeometry();
      for(const [name,size,offset] of [['position',3,0],['normal',3,3],['uv',2,6]]) {
        const values=new Float32Array(part.vertices*size);
        for(let i=0;i<part.vertices;i++)for(let c=0;c<size;c++)values[i*size+c]=source[i*index.stride+offset+c];
        geometry.setAttribute(name,new THREE.BufferAttribute(values,size));
      }
      geometry.computeBoundingBox();geometry.computeBoundingSphere();
      const mesh=new THREE.Mesh(geometry,materials[part.material]);mesh.castShadow=true;mesh.receiveShadow=true;
      group.add(mesh);
    }
    models[definition.name]=group;
  }
  return models;
}
