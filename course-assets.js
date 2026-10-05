import * as THREE from './vendor/three/three.module.js';

// One compact local download set, decoded once before the selected world builds.
export async function loadCourseAssets(renderer) {
  const loader=new THREE.TextureLoader();
  const names=['asphalt','concrete','metal','brick','stone','sand','snow','wood','bark'];
  const maps=await Promise.all(names.map(async name=>{
    const map=await loader.loadAsync(`./assets/courses/textures/${name}.webp`);
    map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;
    map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    return [name,map];
  }));
  const [indexResponse,dataResponse]=await Promise.all([fetch('./assets/courses/models.json'),fetch('./assets/courses/models.bin')]);
  if(!indexResponse.ok||!dataResponse.ok) throw new Error('Course scenery assets could not be loaded');
  const index=await indexResponse.json(),data=await dataResponse.arrayBuffer();
  return {textures:Object.fromEntries(maps),models:decodeCourseModels(index,data)};
}

export function decodeCourseModels(index,data) {
  const models={};
  const assetMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.9});
  for(const model of index.models) {
    const vertices=new Float32Array(data,model.offset,model.vertices*index.stride);
    const interleaved=new THREE.InterleavedBuffer(vertices,index.stride);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.InterleavedBufferAttribute(interleaved,3,0));
    geometry.setAttribute('normal',new THREE.InterleavedBufferAttribute(interleaved,3,3));
    geometry.setAttribute('color',new THREE.InterleavedBufferAttribute(interleaved,3,6));
    // Plain arrays let the shared static merger work without a GLTF dependency.
    const plain=new THREE.BufferGeometry();
    for(const attributeName of ['position','normal','color']) {
      const values=new Float32Array(model.vertices*3),attribute=geometry.getAttribute(attributeName);
      for(let i=0;i<model.vertices;i++) {values[i*3]=attribute.getX(i);values[i*3+1]=attribute.getY(i);values[i*3+2]=attribute.getZ(i);}
      plain.setAttribute(attributeName,new THREE.BufferAttribute(values,3));
    }
    plain.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(model.vertices*2),2));
    plain.computeBoundingBox();plain.computeBoundingSphere();geometry.dispose();
    models[model.name]={geometry:plain,material:assetMaterial};
  }
  return models;
}
