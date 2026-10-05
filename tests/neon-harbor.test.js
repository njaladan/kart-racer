import test from 'node:test';
import assert from 'node:assert/strict';
import course from '../courses/neon-harbor.js';
import {createTrack, selectCourse, TRACK} from '../track.js';
import {initializeRacer,botInput,advanceRacer} from '../simulation.js';
import {consumeItem, MUSHROOM_BOOST} from '../items.js';
import {cartAt,cartContact} from '../hazards.js';
import {FIXED_DT} from '../physics.js';

const track=createTrack(course);

test('Neon Harbor has six separated physical districts and a supported quay',()=>{
  assert.ok(track.COURSE_LENGTH>1480&&track.COURSE_LENGTH<1520);
  assert.equal(track.SECTIONS.length,6);
  assert.equal(track.SECTIONS[0].start,0);
  for(let i=0;i<6;i++) {
    const s=track.SECTIONS[i];assert.ok((s.end-s.start)*track.COURSE_LENGTH>190);
    if(i<5)assert.equal(s.end,track.SECTIONS[i+1].start);
  }
  assert.ok(track.ELEVATED.length===1&&track.ELEVATED[0].section===3);
  assert.ok(track.frameAt(track.sectorT(3,.5)).p.y>20);
  // Ignore nearby samples of the same local turn; check distant road arms.
  for(let i=0;i<320;i++)for(let j=i+1;j<320;j++) {
    if(Math.min(j-i,320-j+i)*track.COURSE_LENGTH/320<65)continue;
    const a=track.frameAt(i/320).p,b=track.frameAt(j/320).p;
    assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>30);
  }
});

test('the service apron cuts an inside-right curve with coherent local/global ground',()=>{
  const s=track.SHORTCUT;
  const a=track.frameAt(s.start).tangent,b=track.frameAt(s.end).tangent;
  assert.ok(a.x*b.z-a.z*b.x>0,'curve must turn toward positive/right offsets');
  for(let t=s.start+.004;t<s.end-.004;t+=.001) {
    const offset=track.roadHalfWidth(t)+Math.min(2,track.shortcutWidth(t)*.5);
    const p=track.poseAt(t*TRACK,offset,.065).p;
    const local=track.projectTrack(p,t*TRACK),global=track.projectTrack(p,0,true);
    assert.ok(local.offroad);
    assert.ok(local.offset<track.collisionBounds(t).right);
    assert.ok(Math.abs(local.t-global.t)<.00001);
    assert.ok(Math.abs(local.height-p.y)<.025);
  }
  assert.ok(track.ITEM_ROWS.every(t=>t<s.start||t>s.end));
});

test('all five Neon Harbor AI drivers finish three clean laps at the intended pace',()=>{
  selectCourse(course);
  for(let index=0;index<5;index++) {
    const r=initializeRacer({s:0,x:0,skill:.9,drift:0});
    let lap=0,last=0,sector=1;const laps=[],entries=[0];let impacts=0;
    for(let tick=1;tick<230/FIXED_DT&&!r.finished;tick++) {
      const time=tick*FIXED_DT;
      const ev=advanceRacer(r,botInput(r,index,time),FIXED_DT,time);
      impacts+=!!ev.wallImpact+!!ev.cartImpact;
      assert.ok(Number.isFinite(r.worldPos.x+r.worldPos.y+r.worldPos.z+r.s));
      if(sector<6&&r.s>=track.SECTIONS[sector].start*TRACK){entries.push(time);sector++;}
      if(r.s>=(lap+1)*TRACK){laps.push(time-last);last=time;lap++;if(lap===1)entries.push(time);}
    }
    assert.ok(r.finished&&r.finishTime<190);
    assert.equal(impacts,0);
    assert.equal(laps.length,3);
    for(const lapTime of laps)assert.ok(lapTime>=55&&lapTime<=65);
    for(let i=1;i<entries.length;i++)assert.ok(entries[i]-entries[i-1]>=6&&entries[i]-entries[i-1]<=14);
  }
});

// A reproducible, bounded steering controller compares identical corner gates.
// It consumes a real single mushroom when reaching the rough paving; it never
// replenishes boost. This protects the shortcut's intended cost/reward.
function corner(mode) {
  selectCourse(course);
  const start=track.sectorT(5,.04),end=track.sectorT(5,.79),s=track.SHORTCUT;
  const r=initializeRacer({s:start*TRACK,x:mode==='outside'?-5.1/6.25:mode==='inside'?6.5/6.25:0,drift:0,item:'mushroom',itemCount:1});
  const f=track.frameAt(start);r.vx=f.tangent.x*25;r.vz=f.tangent.z*25;r.speed=90;
  let used=false,hits=0,offroad=0;
  for(let tick=1;tick<20/FIXED_DT;tick++) {
    const t=track.trackT(r.s+track.metresToProgress(13));let offset=mode==='outside'?-5.1:mode==='inside'?6.5:0;
    if(mode.includes('cut')) {
      const weight=Math.min(1,Math.max(0,(t-(s.start-.014))/.025),Math.max(0,((s.end+.008)-t)/.022));
      offset=weight*Math.min(10,track.roadHalfWidth(t)+track.shortcutWidth(t)*.45);
    }
    const rough=track.projectTrack(r.worldPos,r.s).offroad;
    if(mode.startsWith('boost')&&!used&&(mode==='boost-main'?r.s>s.start*TRACK:rough)) {
      consumeItem(r);used=true;assert.equal(r.boost,MUSHROOM_BOOST);assert.equal(r.itemCount,0);
    }
    const frame=track.frameAt(t),target=frame.p.clone().addScaledVector(frame.right,offset);
    const desired=Math.atan2(-(target.x-r.worldPos.x),-(target.z-r.worldPos.z));
    const err=Math.atan2(Math.sin(desired-r.yaw),Math.cos(desired-r.yaw));
    const ev=advanceRacer(r,{throttle:true,steer:Math.max(-1,Math.min(1,-err*2.8))},FIXED_DT,tick*FIXED_DT);
    hits+=!!ev.wallImpact;if(rough)offroad+=FIXED_DT;
    if(r.s>=end*TRACK)return {time:tick*FIXED_DT,hits,offroad,used};
  }
  assert.fail('corner controller failed to exit');
}

test('one saved mushroom makes the service apron useful; ordinary driving pays a penalty',()=>{
  const main=corner('main'),boostMain=corner('boost-main'),cut=corner('cut'),boostCut=corner('boost-cut'),inside=corner('inside'),outside=corner('outside');
  for(const run of [main,boostMain,cut,boostCut,inside,outside])assert.equal(run.hits,0);
  assert.ok(boostCut.used&&boostCut.offroad>.25);
  assert.ok(cut.time>main.time+.2);
  assert.ok(boostCut.time<main.time-.35);
  assert.ok(boostCut.time<boostMain.time-.05);
  assert.ok(boostCut.time<inside.time-.05);
  assert.ok(Math.abs(inside.time-outside.time)<.15);
});

test('cargo shuttle warnings and contact always reserve the left lane',()=>{
  selectCourse(course);
  assert.equal(cartAt(29).offset,12);assert.ok(cartAt(31).warning);
  assert.equal(cartAt(35).offset,0);
  for(let time=30;time<42;time+=.05) {
    const c=cartAt(time),lane=track.poseAt(c.s,course.hazard.safeLane,.065).p;
    assert.equal(cartContact(lane,time),null);
    assert.ok(course.hazard.safeLane>track.collisionBounds(c.s/TRACK).left);
  }
});
