import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from '../vendor/three/three.module.js';
import { decodeCourseModels } from '../course-assets.js';
import { buildCourseWorld } from '../course-runtime.js';
import { COURSES } from '../courses/registry.js';
import { selectCourse } from '../track.js';
import { batchStaticMeshes } from '../visuals.js';

function assets() {
  const raw=readFileSync(new URL('../assets/courses/models.bin',import.meta.url));
  const data=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);
  return {models:decodeCourseModels(JSON.parse(readFileSync(new URL('../assets/courses/models.json',import.meta.url))),data)};
}

test('static batching preserves colored geometry even when handmade props have no UVs',()=>{
  const group=new THREE.Group(),material=new THREE.MeshStandardMaterial({vertexColors:true});
  for(let i=0;i<2;i++) {
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute([.8,.4,.2,.9,.5,.3,1,.6,.4],3));
    geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,material);mesh.position.x=i*3;group.add(mesh);
  }
  batchStaticMeshes(group);
  assert.equal(group.children.length,1);
  assert.equal(group.children[0].geometry.getAttribute('position').count,6);
  assert.equal(group.children[0].geometry.getAttribute('uv').count,6);
  assert.ok(Math.abs(group.children[0].geometry.getAttribute('color').getX(0)-.8)<1e-6);
});

test('all asset-backed scenery assembles and stays finite while each hazard moves',()=>{
  for(const course of COURSES.filter(c=>c.buildWorld)) {
    const track=selectCourse(course),scene=new THREE.Scene();
    const textures=Object.fromEntries(['asphalt','stone','sand','snow','metal','brick','concrete','wood','bark','water'].map(k=>[k,new THREE.Texture()]));
    const mats=Object.fromEntries(['grass','road','roadside','rail','white','red','black'].map(k=>[k,new THREE.MeshStandardMaterial({color:'#ffffff'})]));
    const world=buildCourseWorld(scene,null,mats,textures,track,assets());
    let meshes=0;
    scene.traverse(object=>{
      if(!object.isMesh)return;meshes++;
      for(const attribute of Object.values(object.geometry.attributes))
        assert.ok(Array.from(attribute.array).every(Number.isFinite),`${course.id}: invalid attribute`);
    });
    assert.ok(meshes<75,`${course.id}: ${meshes} unbatched scenery meshes`);
    for(const time of [0,30,31,35,40,42])world.update(time);
    scene.updateMatrixWorld(true);
    scene.traverse(object=>assert.ok(object.matrixWorld.elements.every(Number.isFinite)));
  }
});
