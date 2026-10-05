import * as THREE from './vendor/three/three.module.js';
import { batchStaticMeshes } from './visuals.js';

// Scenery authors get placement and reusable primitives, never engine globals.
export function createCourseKit(scenery, track, assets = {models:{}}) {
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const material = (color, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: .85, vertexColors:true, ...extra});
  const mesh = (geometry, mat, parent = scenery, position = [0,0,0], scale = [1,1,1]) => {
    if(!geometry.getAttribute('color') && geometry.getAttribute('normal')) {
      const normals=geometry.getAttribute('normal'),colors=new Float32Array(normals.count*3);
      for(let i=0;i<normals.count;i++) {
        const shade=Math.max(.7,Math.min(1,.86+.1*normals.getY(i)+.025*normals.getX(i)-.015*normals.getZ(i)));
        colors.set([shade,shade,shade],i*3);
      }
      geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    }
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(...position); m.scale.set(...scale);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const box = (mat, parent = scenery, position = [0,0,0], scale = [1,1,1]) => mesh(boxGeometry,mat,parent,position,scale);
  const align = (group, frame) => {
    group.position.copy(frame.p);
    group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(frame.right,frame.up,frame.tangent.clone().negate()));
  };
  const groupAt = (t, offset = 0, parent = scenery) => {
    const g = new THREE.Group(); align(g,track.poseAt(t*track.TRACK,offset,0)); parent.add(g); return g;
  };
  const sectorT = (index,fraction) => track.sectorT(index,fraction);
  // Course text signs were removed in the current game direction. Scenery can
  // use structural beacons, colored markers and open sightlines for guidance.
  const sign = () => new THREE.Group();
  const asset = (name,parent = scenery,position = [0,0,0],scale = [1,1,1]) => {
    const model=assets.models[name];
    if(!model) throw new Error(`Unknown course scenery asset: ${name}`);
    return mesh(model.geometry,model.material,parent,position,scale);
  };
  return {material,mesh,box,align,groupAt,sectorT,sign,asset,batch:batchStaticMeshes};
}

export function batchScenery(scenery, animated = []) {
  scenery.updateMatrixWorld(true);
  const meshes=[];
  scenery.traverse(m=>{if(m.isMesh && !animated.some(g=>g===m || g.getObjectById(m.id))) meshes.push(m);});
  const combined=new THREE.Group();scenery.add(combined);
  for(const m of meshes){m.matrixWorld.decompose(m.position,m.quaternion,m.scale);combined.add(m);}
  batchStaticMeshes(combined);
  // Remove empty source containers left after flattening static scenery.
  const prune=group=>{
    for(const child of [...group.children]) {
      if(child.isGroup && !animated.includes(child)) {
        prune(child);
        if(child.children.length===0) group.remove(child);
      }
    }
  };
  prune(scenery);
}
