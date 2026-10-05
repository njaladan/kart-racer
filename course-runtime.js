import * as THREE from './vendor/three/three.module.js';
import { createCourseKit, batchScenery } from './course-kit.js';
import { cartAt } from './hazards.js';
import { addCourseWorld } from './course-world.js';
import { createRailGeometry } from './course-rails.js';
import {addDetailedScenery} from './detailed-scenery.js';

// Shared geometry uses exactly the surface/edge queries used by karts and shells.
export function buildCourseWorld(scene,renderer,mats,textures,track,assets,commonAssets) {
  const course=track.course;
  if(course.id==='windmill-wilds') {
    const world=addCourseWorld(scene,renderer,mats,textures,commonAssets?.nature);
    addDetailedScenery(scene,track,assets);return world;
  }
  const scenery=new THREE.Group();scene.add(scenery);
  const kit=createCourseKit(scenery,track,assets);
  const {mesh,box,groupAt,material}=kit;
  const roadMaterials = {
    asphalt:mats.road, stone:material('#e0d0ae',{map:textures.stone,
      roughness:course.id==='neon-harbor'?.36:.85,metalness:course.id==='neon-harbor'?.12:0}),
    concrete:material('#b4c4d0',{map:textures.concrete}),
    wood:material('#d2b38d',{map:textures.wood,bumpMap:textures.wood,bumpScale:.04}), ice:material('#9ddaf0',{roughness:.2,metalness:.2}),
    grass:mats.grass, snow:material('#e5f2f5',{map:textures.snow}), sand:material('#ead3a0',{map:textures.sand}),
    gravel:material('#c7c7ba',{map:textures.gravel||textures.stone,bumpMap:textures.gravel||textures.stone,bumpScale:.04}),
    needles:material('#b4ab80',{map:textures.needles||textures.bark,bumpScale:.025}),
    paving:material('#c9c4c1',{map:textures.paving||textures.concrete,bumpMap:textures.paving||textures.concrete,bumpScale:.035}),
  };
  const materialNames=[...new Set([...course.sections.map(s=>s.material),...(course.surfaces||[]).map(s=>s.material)])];
  const roads=materialNames.map(name=>roadMaterials[name] || mats.road);
  const ground=mesh(new THREE.PlaneGeometry(1800,1800),mats.grass,scenery,[0,-1.7,0]);
  ground.rotation.x=-Math.PI/2;ground.castShadow=false;
  const uvGround=ground.geometry.attributes.uv;
  for(let i=0;i<uvGround.count;i++) uvGround.setXY(i,uvGround.getX(i)*120,uvGround.getY(i)*120);
  const isElevated=t=>track.ELEVATED.some(s=>t>=s.start&&t<s.end);
  function ribbon(edgeA,edgeB,mat,lift=.045,terrain=false,startT=0,endT=1) {
    const positions=[],uv=[],indices=[],groups=[],n=Math.max(8,Math.ceil(1800*(endT-startT)));
    for(let i=0;i<=n;i++) {
      const t=THREE.MathUtils.lerp(startT,endT,i/n),f=track.frameAt(t);
      for(const edge of [edgeA(t),edgeB(t)]) {
        const p=f.p.clone().addScaledVector(f.right,edge);
        if(terrain) {
          const bounds=track.surfaceAt(t);
          const distance=Math.abs(edge)-(edge>0?bounds.rightEdge:-bounds.leftEdge);
          p.y=THREE.MathUtils.lerp(p.y-.06,-1.7,THREE.MathUtils.smoothstep(distance,0,38));
        } else p.addScaledVector(f.up,lift);
        positions.push(p.x,p.y,p.z);uv.push(edge/8,t*track.COURSE_LENGTH/8);
      }
      const midpoint=THREE.MathUtils.lerp(startT,endT,(i+.5)/n);
      if(i===n || (terrain&&isElevated(midpoint))) continue;
      const a=i*2,start=indices.length;
      if(edgeB(t)>=edgeA(t)) indices.push(a,a+1,a+2,a+1,a+3,a+2);
      else indices.push(a,a+2,a+1,a+1,a+2,a+3);
      if(Array.isArray(mat)) {
        const materialIndex=materialNames.indexOf(track.surfaceAt(midpoint).material);
        const last=groups.at(-1);
        if(last&&last.materialIndex===materialIndex&&last.start+last.count===start) last.count+=6;
        else groups.push({start,count:6,materialIndex});
      }
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);
    groups.forEach(g=>geo.addGroup(g.start,g.count,g.materialIndex));geo.computeVertexNormals();
    const m=mesh(geo,mat);m.castShadow=false;
  }
  ribbon(t=>-track.roadHalfWidth(t)-.55,t=>track.roadHalfWidth(t)+.55,mats.roadside,-.02);
  ribbon(t=>-track.roadHalfWidth(t),t=>track.roadHalfWidth(t),roads);
  ribbon(t=>track.roadHalfWidth(t),t=>track.roadHalfWidth(t)+track.shortcutWidth(t),mats.grass,.035);
  for(const v of track.VERGES) {
    ribbon(t=>v.side*track.roadHalfWidth(t),
      t=>v.side*(track.roadHalfWidth(t)+track.vergeWidth(t,v.side)),
      roadMaterials[v.material]||mats.grass,.04,false,v.start,v.end);
  }
  for(const side of [-1,1]) {
    const edge=t=>side<0?track.surfaceAt(t).leftEdge:track.surfaceAt(t).rightEdge;
    ribbon(edge,t=>edge(t)+side*38,mats.grass,0,true);
    const railMaterial = mats.rail.clone(); railMaterial.side=THREE.DoubleSide;
    mesh(createRailGeometry(side,{width:.15,height:.32,above:.72}),railMaterial);
    for(let i=0;i<370;i++) {
      const t=(i+.5)/370,g=groupAt(t,edge(t));
      box(mats.rail,g,[0,.42,0],[.19,.86,.19]);
    }
  }
  for(let i=0;i<330;i++) {
    const t=i/330,g=groupAt(t),half=track.roadHalfWidth(t);
    if(i%2===0) box(mats.white,g,[0,.065,0],[.13,.025,2.4]);
    for(const side of [-1,1]) {
      if(track.vergeWidth(t,side)>.1 || (side>0&&track.shortcutWidth(t)>.1)) continue;
      box(i%2?mats.red:mats.white,g,[side*(half+.25),.07,0],[.5,.04,track.COURSE_LENGTH/330+.1]);
    }
  }
  const warningMaterial=material('#ffc850',{emissive:'#ff9d25',emissiveIntensity:0});
  const warning=groupAt(track.CART_T,-track.roadHalfWidth(track.CART_T)-2);
  box(mats.black,warning,[0,2,0],[.2,4,.2]);
  mesh(new THREE.SphereGeometry(.45,12,8),warningMaterial,warning,[0,4.2,0]);
  // Batch only common static road furniture. Scenery authors batch their own props,
  // leaving declared dynamic assemblies separate and transformable.
  batchScenery(scenery);
  const world=course.buildWorld({THREE,scene,scenery,track,course,mats,textures,renderer,kit,hazardAt:cartAt}) || {};
  batchScenery(scenery,world.animated || []);
  addDetailedScenery(scene,track,assets);
  return {update(time) {
    warningMaterial.emissiveIntensity=cartAt(time).warning?1.5+Math.sin(time*12):0;
    world.update?.(time);
  }};
}
