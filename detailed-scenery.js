import * as THREE from './vendor/three/three.module.js';
import {createCourseKit,batchScenery} from './course-kit.js';

export function addDetailedScenery(scene,track,assets) {
  if(!assets?.models?.painted_wooden_bench)return;
  const root=new THREE.Group();root.name='Downloaded textured scenery';scene.add(root);
  const kit=createCourseKit(root,track,assets),city=track.course.id==='neon-harbor';
  // Use a few high-detail imported props at focal places instead of filling
  // the whole lap with unique expensive assets. Every footprint clears rails.
  const stops=city?[[0,.18],[0,.64],[1,.2],[5,.8]]:
    track.course.id==='frostpeak-festival'?[[0,.18],[0,.61],[2,.7]]:
    track.course.id==='sunstone-ruins'?[[0,.15],[0,.77],[3,.3]]:
    [[0,.19],[0,.72],[2,.64],[5,.77]];
  for(const [sector,fraction] of stops) {
    const t=track.sectorT(sector,fraction),offset=track.surfaceAt(t).leftEdge-6;
    const g=kit.safeGroup(t,offset,2.8);if(!g)continue;
    g.rotation.y+=Math.PI/2;
    kit.asset('painted_wooden_bench',g,[0,0,0],[1.25,1.25,1.25]);
    if(city&&kit.hasAsset('planter_box_01'))kit.asset('planter_box_01',g,[0,0,3.2],[1.1,1.1,1.1]);
  }
  if(city)for(const [sector,fraction] of [[0,.08],[0,.45],[1,.8],[5,.81]]) {
    const t=track.sectorT(sector,fraction),g=kit.safeGroup(t,track.surfaceAt(t).leftEdge-3.5,1.4);
    if(!g)continue;
    kit.asset('street_lamp_02',g,[0,0,0],[2.3,2.3,2.3]);
  }
  batchScenery(root);
}
