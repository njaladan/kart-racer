import test from 'node:test';
import assert from 'node:assert/strict';
import course from '../courses/frostpeak-festival.js';
import { selectCourse, TRACK } from '../track.js';
import { initializeRacer, botInput, advanceRacer } from '../simulation.js';
import { consumeItem } from '../items.js';
import { cartAt, cartContact } from '../hazards.js';

// Five isolated drivers cover the genuine authored bends, elevation, grip
// transition, moving hazard and bounded hops through three ordered laps.
test('Frostpeak provides six paced mountain sections and five complete clean races', () => {
  const track=selectCourse(course);
  assert.ok(track.COURSE_LENGTH>=1450&&track.COURSE_LENGTH<=1600);
  for(let index=0;index<5;index++) {
    const racer=initializeRacer({s:0,x:0,skill:.91-index*.0475,drift:0});
    const entries=[0],laps=[];let section=0,walls=0,contacts=0;
    for(let tick=1;tick<230*120&&!racer.finished;tick++) {
      const time=tick/120;
      const events=advanceRacer(racer,botInput(racer,index,time),1/120,time);
      walls+=!!events.wallImpact;contacts+=!!events.cartImpact;
      if(section<5&&racer.s>=track.SECTIONS[section+1].start*TRACK){entries.push(time);section++;}
      if(racer.s>=(laps.length+1)*TRACK){laps.push(time);if(laps.length===1)entries.push(time);}
      assert.ok(Number.isFinite(racer.worldPos.x+racer.worldPos.y+racer.worldPos.z));
    }
    assert.ok(racer.finished);assert.equal(walls,0);assert.equal(contacts,0);
    assert.equal(entries.length,7);assert.equal(laps.length,3);
    const times=[laps[0],laps[1]-laps[0],laps[2]-laps[1]];
    assert.ok(times.every(time=>time>=55&&time<=65));
    for(let i=1;i<entries.length;i++)assert.ok(entries[i]-entries[i-1]>=6&&entries[i]-entries[i-1]<=14);
  }
});

test('Frostpeak ice has firm approaches and enough recovery before the groomer', () => {
  const track=selectCourse(course),patch=track.SURFACES[0];
  assert.equal(track.surfaceAt((patch.start+patch.end)/2).grip,8.5);
  assert.equal(track.surfaceAt((patch.start+patch.end)/2).material,'ice');
  assert.equal(track.surfaceAt(patch.start-.003).grip,12);
  assert.equal(track.surfaceAt(patch.end+.003).grip,12);
  assert.ok((track.CART_T-patch.end)*track.COURSE_LENGTH>=30);
  const descentRamp=track.RAMPS.find(ramp=>ramp.section===3);
  assert.ok((patch.start-descentRamp.t)*track.COURSE_LENGTH>80);
  for(let time=30;time<42;time+=.1) {
    const hazard=cartAt(time),safe=track.poseAt(hazard.s,course.hazard.safeLane,.065).p;
    assert.equal(cartContact(safe,time),null);
    assert.ok(track.collisionBounds(track.CART_T).left<course.hazard.safeLane-.9);
  }
});

function cornerRun(track,mode) {
  const start=track.SHORTCUT.start-30/track.COURSE_LENGTH,end=track.SHORTCUT.end+20/track.COURSE_LENGTH;
  const lane=t=>mode==='outside'?-5.5:mode==='cut'||mode==='ordinary'?3+17*Math.min(1,track.shortcutWidth(t)/20):6;
  const racer=initializeRacer({s:start*TRACK,x:lane(start)/6.25,drift:0,item:'mushroom',itemCount:1});
  const frame=track.frameAt(start);racer.vx=frame.tangent.x*26;racer.vz=frame.tangent.z*26;racer.speed=26*3.6;
  let used=false,walls=0;
  for(let tick=1;tick<15*120;tick++) {
    const time=tick/120,t=racer.s/TRACK,ahead=t+12/track.COURSE_LENGTH;
    const f=track.frameAt(ahead),target=f.p.clone().addScaledVector(f.right,lane(ahead));
    const desired=Math.atan2(-(target.x-racer.worldPos.x),-(target.z-racer.worldPos.z));
    const error=Math.atan2(Math.sin(desired-racer.yaw),Math.cos(desired-racer.yaw));
    if(!used&&t>=track.SHORTCUT.start+.018&&(mode==='cut'||mode==='mainboost')) {
      assert.equal(consumeItem(racer),'mushroom');used=true;
    }
    const events=advanceRacer(racer,{throttle:racer.speed<97||racer.boost>0,brake:racer.speed>107,
      steer:Math.max(-1,Math.min(1,-error*5)),drift:false},1/120,time);
    walls+=!!events.wallImpact;
    if(racer.s>=end*TRACK)return {time,walls,used,remaining:racer.itemCount};
  }
  assert.fail(`Corner driver ${mode} failed to exit`);
}

test('one actual mushroom rewards the powder cut while ordinary powder loses time', () => {
  const track=selectCourse(course);
  const main=cornerRun(track,'road'),mainBoost=cornerRun(track,'mainboost');
  const cut=cornerRun(track,'cut'),ordinary=cornerRun(track,'ordinary'),outside=cornerRun(track,'outside');
  assert.ok(cut.time<mainBoost.time-.15);
  assert.ok(ordinary.time>main.time+.02);
  assert.ok(Math.abs(outside.time-main.time)<.5);
  for(const result of [main,mainBoost,cut,ordinary,outside])assert.equal(result.walls,0);
  assert.ok(cut.used&&mainBoost.used);assert.equal(cut.remaining,0);
  const middle=(track.SHORTCUT.start+track.SHORTCUT.end)/2;
  assert.equal(track.surfaceAt(middle,15).offroadDrag,1.25);
  const point=track.poseAt(middle*TRACK,15,.065).p,projection=track.projectTrack(point,middle*TRACK);
  assert.ok(projection.offroad&&Math.abs(projection.height-point.y)<.03);
});
