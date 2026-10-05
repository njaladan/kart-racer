import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSES} from '../courses/registry.js';
import {selectCourse,TRACK} from '../track.js';
import {createRailGeometry} from '../course-rails.js';
import {initializeRacer,advanceRacer} from '../simulation.js';
import {createShell,advanceShell} from '../items.js';
import {advanceRaceProgress} from '../race.js';

test('all extra route choices have continuous ground, material costs and shared barriers',()=>{
 for(const course of COURSES){
  const track=selectCourse(course);assert.ok(track.VERGES.length>=2,course.id);
  for(const v of track.VERGES){
   assert.ok(track.vergeWidth(v.start,v.side)<1e-8);assert.ok(track.vergeWidth(v.end,v.side)<1e-8);
   const mid=(v.start+v.end)/2;
   assert.ok(Math.abs(track.vergeWidth(mid,v.side)-v.extraWidth)<1e-8);
   for(let i=1;i<20;i++){
    const t=v.start+(v.end-v.start)*i/20;
    const width=track.vergeWidth(t,v.side);if(width<1)continue;
    const offset=v.side*(track.roadHalfWidth(t)+width*.55);
    const p=track.poseAt(t*TRACK,offset,.065).p;
    const local=track.projectTrack(p,t*TRACK),global=track.projectTrack(p,0,true);
    assert.ok(local.offroad);assert.equal(local.material,v.material);assert.equal(local.grip,v.grip);
    assert.equal(local.offroadDrag,v.drag);assert.equal(local.offroadGrip,v.grip);
    assert.ok(Math.abs(local.t-global.t)<.00001,`${course.id}: another arm intersects a verge`);
    assert.ok(Math.abs(local.height-p.y)<.03);
    const kart=track.collisionBounds(local.t),shell=track.collisionBounds(local.t,.55);
    assert.ok(offset>kart.left&&offset<kart.right);
    assert.ok(Math.abs(kart.left-.9-local.leftEdge)<1e-8);
    assert.ok(Math.abs(shell.right+.55-local.rightEdge)<1e-8);
    const racer=initializeRacer({s:t*TRACK,x:offset/6.25,drift:0});
    advanceRacer(racer,{},1/120,1);
    assert.ok(Math.abs(racer.x*6.25-offset)<.04,'stationary kart must not be clamped to the old rail');
   }
   const radius=.55,surface=track.surfaceAt(mid),edge=v.side<0?surface.leftEdge:surface.rightEdge;
   const owner=initializeRacer({s:mid*TRACK,x:(edge-v.side*(radius+.02))/6.25,drift:0});
   const shell=createShell(owner,'green'),f=track.frameAt(mid);
   shell.worldPos.copy(track.poseAt(mid*TRACK,edge-v.side*(radius+.02),.3).p);
   shell.vx=f.right.x*v.side*30;shell.vz=f.right.z*v.side*30;
   advanceShell(shell,1/120,1);
   assert.ok(shell.vx*f.right.x*v.side+shell.vz*f.right.z*v.side<0,'shell reflects at widened rail');
   const rail=createRailGeometry(v.side,{width:.15,height:.32,above:.72,start:v.start,end:v.end});
   const pos=rail.attributes.position;let found=false;
   for(let i=0;i<pos.count;i+=8){
    const p={x:(pos.getX(i)+pos.getX(i+2))/2,y:(pos.getY(i)+pos.getY(i+4))/2,z:(pos.getZ(i)+pos.getZ(i+2))/2};
    const near=track.projectTrack(p,mid*TRACK);
    if(Math.abs(near.t-mid)<.001){assert.ok(Math.abs(near.offset-edge)<.7);found=true;break;}
   }
   assert.ok(found);rail.dispose();
   const racer=initializeRacer({s:mid*TRACK,x:0,drift:0}),before=racer.s,gate=racer.nextCheckpoint;
   assert.equal(advanceRaceProgress(racer,before+TRACK*.3,TRACK,track.WORLD_PER_UNIT,.1),false);
   assert.equal(racer.nextCheckpoint,gate);
  }
 }
});
