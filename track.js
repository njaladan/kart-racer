import * as THREE from './vendor/three/three.module.js';
import { progressDelta } from './race.js';
export const TRACK = 2400;
const TAU = Math.PI * 2;
const curve = new THREE.CatmullRomCurve3([
  [-61,0,-27],[-47,.2,-54],[-15,1,-64],[20,1.5,-55],[51,.8,-35],[63,.3,-5],[58,1.3,27],[36,2.2,52],[5,1.2,63],[-28,.4,55],[-55,1.1,35],[-68,.5,7],[-67,.1,-11],
].map(([x,y,z]) => new THREE.Vector3(x*1.6,y,z*1.6)), true, 'catmullrom', .18);
export const WORLD_PER_UNIT = curve.getLength() / TRACK;
export const wrap01 = t => ((t % 1) + 1) % 1;
export const trackT = s => wrap01(s / TRACK);
export const laneWidth = lane => lane * 6.25;
export const yawFor = tangent => Math.atan2(-tangent.x, -tangent.z);
export function rampHeight(t) {
  let height = 0;
  for (const center of [.20,.51,.78]) {
    const q = Math.abs(progressDelta(t, center, 1)) / .033;
    if (q < 1) height = Math.max(height, 3.55 * Math.sin((1-q)*Math.PI/2) ** 2);
  }
  return height;
}
export const bankAt = t => .12*Math.sin(TAU*t*3+.7)+.06*Math.sin(TAU*t*5-1.2);
export function routePoint(t) {
  t = wrap01(t);
  const p = curve.getPointAt(t);
  p.y += Math.sin(TAU*t*2+.45)+.55*Math.sin(TAU*t*4-.3)+rampHeight(t);
  return p;
}
const SAMPLE_COUNT = 1024;
const samples = Array.from({length:SAMPLE_COUNT+1}, (_,i)=>routePoint(i/SAMPLE_COUNT));
export function frameAt(t) {
  t = wrap01(t);
  const index = t*SAMPLE_COUNT, i = Math.floor(index), fraction = index-i;
  const p = samples[i].clone().lerp(samples[i+1],fraction);
  const tangent = samples[(i+2)%SAMPLE_COUNT].clone().sub(samples[(i-1+SAMPLE_COUNT)%SAMPLE_COUNT]).normalize();
  const right = new THREE.Vector3(-tangent.z,0,tangent.x).normalize().applyAxisAngle(tangent,bankAt(t));
  const up = right.clone().cross(tangent).normalize();
  return {p,tangent,right,up};
}
export function poseAt(s,lane=0,above=.06) {
  const f=frameAt(trackT(s));
  return {...f,p:f.p.clone().addScaledVector(f.right,lane).addScaledVector(f.up,above)};
}
export function projectTrack(position,nearS=0,global=false) {
  const start=Math.floor(trackT(nearS)*SAMPLE_COUNT);
  let best=Infinity,bestT=0;
  const inspect=i=>{
    i=((i%SAMPLE_COUNT)+SAMPLE_COUNT)%SAMPLE_COUNT;
    const a=samples[i],b=samples[i+1],dx=b.x-a.x,dz=b.z-a.z;
    const u=Math.max(0,Math.min(1,((position.x-a.x)*dx+(position.z-a.z)*dz)/(dx*dx+dz*dz)));
    const ex=position.x-a.x-dx*u,ez=position.z-a.z-dz*u,d=ex*ex+ez*ez;
    if(d<best){best=d;bestT=(i+u)/SAMPLE_COUNT;}
  };
  if(global) for(let i=0;i<SAMPLE_COUNT;i++)inspect(i);
  else {
    for(let i=start-20;i<=start+20;i++)inspect(i);
    if(best>25*25)for(let i=0;i<SAMPLE_COUNT;i++)inspect(i);
  }
  const frame=frameAt(bestT);
  const horizontalRight=new THREE.Vector3(frame.right.x,0,frame.right.z).normalize();
  const offset=(position.x-frame.p.x)*horizontalRight.x+(position.z-frame.p.z)*horizontalRight.z;
  const height=frame.p.y+offset*frame.right.y/Math.hypot(frame.right.x,frame.right.z)+.065;
  return {t:wrap01(bestT),frame,offset,height,horizontalRight,distance:Math.sqrt(best)};
}
