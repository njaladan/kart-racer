import test from 'node:test';
import assert from 'node:assert/strict';
import { drive, resetMotion, verticalMotion, wallContact, chargeDrift, FIXED_DT } from '../physics.js';
import { progressDelta, ranking, finishRacer, lapNumber } from '../race.js';
import { initializeRacer, advanceRacer, botInput } from '../simulation.js';
import { frameAt, projectTrack, poseAt, TRACK, WORLD_PER_UNIT } from '../track.js';
const flat={offroad:false,bank:0,slope:0};
const input={throttle:true,brake:false,steer:0,drift:false};
function body(){const s={worldPos:{x:0,y:0,z:0},yaw:0,boost:0,star:0,spin:0,speed:0,drift:0};resetMotion(s);return s;}
const near=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} ≠ ${b}`);

test('straight driving preserves world heading, independent of a track path',()=>{
  const s=body();for(let i=0;i<1200;i++)drive(s,input,flat,FIXED_DT);
  near(s.worldPos.x,0);near(s.yaw,0);assert.ok(s.worldPos.z < -100);assert.ok(s.speed>100&&s.speed<112);
});
test('steering preserves lateral momentum; releasing the wheel restores grip',()=>{
  const s=body();s.vz=-25;for(let i=0;i<120;i++)drive(s,{...input,steer:1,drift:true},flat,FIXED_DT);
  assert.ok(s.yaw<-.2);assert.ok(Math.abs(s.lateralSpeed)>1);const slip=Math.abs(s.lateralSpeed);
  for(let i=0;i<180;i++)drive(s,{...input,throttle:false,drift:false},flat,FIXED_DT);
  assert.ok(Math.abs(s.lateralSpeed)<slip*.1);
});
test('braking stops before engaging deliberate reverse',()=>{
  const s=body();s.vz=-20;for(let i=0;i<90;i++)drive(s,{...input,throttle:false,brake:true},flat,FIXED_DT);
  assert.ok(s.longitudinalSpeed>0);for(let i=0;i<300;i++)drive(s,{...input,throttle:false,brake:true},flat,FIXED_DT);
  assert.ok(s.longitudinalSpeed<-2);assert.ok(s.speed<23);
});
test('airborne input cannot redirect momentum, and gravity produces a landing',()=>{
  const s=body();s.grounded=false;s.worldPos.y=3;s.vx=10;s.vz=-12;s.vy=4;
  for(let i=0;i<30;i++){drive(s,{...input,steer:1,drift:true},flat,FIXED_DT);verticalMotion(s,0,0,FIXED_DT);}
  near(s.vx,10);near(s.vz,-12);near(s.yaw,0);assert.ok(!s.grounded);
  let landed=false;for(let i=0;i<300;i++)landed=verticalMotion(s,0,0,FIXED_DT)||landed;
  assert.ok(landed&&s.grounded);near(s.worldPos.y,0);
});
test('wall contact removes outward velocity while preserving motion along the wall',()=>{
  const s=body();s.worldPos.x=10;s.vx=7;s.vz=-20;
  assert.ok(wallContact(s,1,0,1.35));near(s.worldPos.x,8.65);near(s.vz,-20);assert.ok(s.vx<0);near(s.yaw,0);
});
test('mini turbo fires exactly once on drift release',()=>{
  const s=body();for(let i=0;i<250;i++)near(chargeDrift(s,true,true,FIXED_DT),0);
  near(chargeDrift(s,false,false,FIXED_DT),2);for(let i=0;i<100;i++)near(chargeDrift(s,false,false,FIXED_DT),0);near(s.drift,0);
});
test('track projection is continuous across the finish seam and honors banking',()=>{
  near(progressDelta(3,2397,TRACK),6);near(progressDelta(2397,3,TRACK),-6);
  for(let i=0;i<50;i++){const s=i*TRACK/50,frame=frameAt(s/TRACK),position=poseAt(s,3,0).p,projection=projectTrack(position,s);assert.ok(Math.abs(projection.offset-3)<.08);near(frame.up.dot(frame.right),0);assert.ok(frame.up.y>.95);}
});
test('rivals finish, keep their rank, and backwards crossings do not add laps',()=>{
  const a={s:7199,finished:false},b={s:7100,finished:false};assert.equal(finishRacer(a,7200,40),false);a.s=7201;assert.ok(finishRacer(a,7200,41));b.s=7210;finishRacer(b,7200,42);assert.equal(ranking([b,a])[0],a);
  assert.equal(lapNumber(-3,TRACK,3),1);assert.equal(lapNumber(2399,TRACK,3),1);assert.equal(lapNumber(2401,TRACK,3),2);assert.equal(lapNumber(2399,TRACK,3),1);
});
test('all five AI drivers complete three physical laps without invalid state',()=>{
  for(let index=0;index<5;index++){
    const s=initializeRacer({s:-46-index*30,x:index%2?.4:-.4,skill:.9-index*.045,drift:0});let launches=0,landings=0;
    for(let tick=1;tick<120*160&&!s.finished;tick++){
      const e=advanceRacer(s,botInput(s,index,tick*FIXED_DT),FIXED_DT,tick*FIXED_DT);launches+=!!e.launched;landings+=!!e.landed;
      assert.ok(Number.isFinite(s.worldPos.x+s.worldPos.y+s.worldPos.z));assert.ok(Math.abs(s.x)<1.5);
    }
    assert.ok(s.finished,`rival ${index} stuck at ${s.s} with speed ${s.speed}`);assert.ok(s.finishTime<150);assert.ok(launches>0&&landings>0,`rival ${index} should jump and land`);
  }
});
test('fixed simulation matches across display frame rates',()=>{
  const simulate=fps=>{const s=initializeRacer({s:0,x:0,drift:0,skill:.9});let accumulator=0,tick=0;for(let f=0;f<fps*20;f++){accumulator+=1/fps;while(accumulator+1e-10>=FIXED_DT){tick++;advanceRacer(s,botInput(s,0,tick*FIXED_DT),FIXED_DT,tick*FIXED_DT);accumulator-=FIXED_DT;}}return s;};
  const a=simulate(30),b=simulate(60),c=simulate(144);near(a.s,b.s);near(a.s,c.s);near(a.worldPos.y,c.worldPos.y);
});
