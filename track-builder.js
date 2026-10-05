import * as THREE from './vendor/three/three.module.js';
import { progressDelta } from './race.js';
export const TRACK = 2400;
export const wrap01 = t => ((t % 1) + 1) % 1;
export const trackT = s => wrap01(s / TRACK);
export const laneWidth = lane => lane * 6.25;
export const yawFor = tangent => Math.atan2(-tangent.x,-tangent.z);
export function createTrack(course) {
  const controls = course.controls;
  const curve = new THREE.CatmullRomCurve3(
    controls.map((p) => new THREE.Vector3(...p)), true, "centripetal",
  );
  curve.arcLengthDivisions = 4096;
  const scale = (course.targetLength ?? 1500) / curve.getLength();
  for (const point of curve.points) { point.x *= scale; point.z *= scale; }
  curve.updateArcLengths();
  const WORLD_PER_UNIT = curve.getLength() / TRACK;
  const metresToProgress = (metres) => metres / WORLD_PER_UNIT;
  const lengths = curve.getLengths(4096);
  const arcAtControl = (index) => {
    const sample = index / controls.length * 4096, i = Math.floor(sample);
    return THREE.MathUtils.lerp(lengths[i], lengths[i + 1] ?? lengths[i], sample - i) / lengths.at(-1);
  };
  const SECTIONS = course.sections.map((section,i) => ({...section, start:arcAtControl(section.controlIndex), end:i+1<course.sections.length?arcAtControl(course.sections[i+1].controlIndex):1}));
  function sectionAt(t) {
    t = wrap01(t);
    return SECTIONS.find((section) => t >= section.start && t < section.end) || SECTIONS[0];
  }
  const sectorT = (index, fraction) => THREE.MathUtils.lerp(SECTIONS[index].start, SECTIONS[index].end, fraction);
  const RAMPS = course.ramps.map(r => ({...r,t:sectorT(r.section,r.fraction)}));
  const MILL_T = sectorT(4,.48);
  const CART_T = sectorT(course.hazard.section,course.hazard.fraction);
  const BRIDGE_RANGE = {start:sectorT(3,.08),end:sectorT(3,.65)};
  const SHORTCUT = {...course.shortcut,start:sectorT(course.shortcut.section,course.shortcut.startFraction),end:sectorT(course.shortcut.section,course.shortcut.endFraction)};
  const BOOST_PADS = course.pads.map(p=>({...p,t:sectorT(p.section,p.fraction)}));
  const ITEM_ROWS = course.itemRows.map(p=>sectorT(p.section,p.fraction));
  const SURFACES = (course.surfaces || []).map(s => ({...s,start:sectorT(s.section,s.startFraction),end:sectorT(s.section,s.endFraction)}));
  const ELEVATED = (course.elevated || []).map(s => ({...s,start:sectorT(s.section,s.startFraction),end:sectorT(s.section,s.endFraction)}));
  const smooth = (a, b, v) => THREE.MathUtils.smoothstep(v, a, b);
  function shortcutWidth(t) {
    return SHORTCUT.extraWidth * smooth(SHORTCUT.start, SHORTCUT.start + 0.018, t)
      * (1 - smooth(SHORTCUT.end - 0.018, SHORTCUT.end, t));
  }
  function roadHalfWidth(t) {
    t = wrap01(t);
    const section = sectionAt(t), i = SECTIONS.indexOf(section);
    const previous = SECTIONS[(i + SECTIONS.length - 1) % SECTIONS.length];
    return THREE.MathUtils.lerp(previous.halfWidth, section.halfWidth, smooth(section.start, section.start + 0.012, t));
  }
  function surfaceAt(t, offset = 0) {
    t = wrap01(t);
    const halfWidth = roadHalfWidth(t), section = sectionAt(t);
    const patch = SURFACES.find(s => t >= s.start && t < s.end);
    return { section, halfWidth, offroad: Math.abs(offset) > halfWidth,
      leftEdge: -halfWidth - 0.55, rightEdge: halfWidth + 0.55 + shortcutWidth(t),
      offroadDrag: shortcutWidth(t) > 0 ? (course.shortcut.drag ?? 1) : 1,
      material: patch?.material ?? section.material, grip: patch?.grip ?? section.grip ?? 12 };
  }
  // Vehicle centers respect body size; shells use the same actual road edges.
  function collisionBounds(t, radius = 0.9) {
    const surface = surfaceAt(t);
    return { left: surface.leftEdge + radius, right: surface.rightEdge - radius };
  }
  function bankAt(t) {
    if (shortcutWidth(wrap01(t)) > 0) return 0;
    const a = curve.getTangentAt(wrap01(t - 0.005)), b = curve.getTangentAt(wrap01(t + 0.005));
    return THREE.MathUtils.clamp(progressDelta(yawFor(b), yawFor(a), Math.PI * 2) * -0.6, -0.14, 0.14);
  }
  function rampHeight(t) {
    let height = 0;
    for (const ramp of RAMPS) {
      const q = Math.abs(progressDelta(t, ramp.t, 1)) * lengths.at(-1) / ramp.halfLength;
      if (q < 1) height = Math.max(height, ramp.height * Math.cos(q * Math.PI / 2) ** 2);
    }
    return height;
  }
  function routePoint(t) {
    t = wrap01(t);
    const p = curve.getPointAt(t);
    p.y += rampHeight(t);
    return p;
  }
  const SAMPLE_COUNT = 3072;
  const samples = Array.from({ length: SAMPLE_COUNT + 1 }, (_, i) => routePoint(i / SAMPLE_COUNT));
  const COURSE_LENGTH = samples.slice(1).reduce((sum, p, i) => sum + p.distanceTo(samples[i]), 0);
  // Cache the complete frame; physics no longer evaluates spline tangents per kart per tick.
  const frames = samples.slice(0, SAMPLE_COUNT).map((p, i) => {
    const tangent = samples[(i + 1) % SAMPLE_COUNT].clone().sub(samples[(i - 1 + SAMPLE_COUNT) % SAMPLE_COUNT]).normalize();
    const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().applyAxisAngle(tangent, bankAt(i / SAMPLE_COUNT));
    return { p, tangent, right, up: right.clone().cross(tangent).normalize() };
  });
  function frameAt(t) {
    const index = wrap01(t) * SAMPLE_COUNT, i = Math.floor(index), f = index - i;
    const a = frames[i], b = frames[(i + 1) % SAMPLE_COUNT];
    const tangent = a.tangent.clone().lerp(b.tangent, f).normalize();
    const right = a.right.clone().lerp(b.right, f).normalize();
    return { p: samples[i].clone().lerp(samples[i + 1], f), tangent, right, up: right.clone().cross(tangent).normalize() };
  }
  function poseAt(s, lane = 0, above = 0.06) {
    const f = frameAt(trackT(s));
    const p = f.p.clone().addScaledVector(f.right, lane);
    p.y += above;
    return { ...f, p };
  }
  function projectTrack(position, nearS = 0, global = false) {
    const start = Math.floor(trackT(nearS) * SAMPLE_COUNT);
    let best = Infinity, bestT = 0;
    const inspect = (index) => {
      const i = ((index % SAMPLE_COUNT) + SAMPLE_COUNT) % SAMPLE_COUNT;
      const a = samples[i], b = samples[i + 1], dx = b.x - a.x, dz = b.z - a.z;
      const u = THREE.MathUtils.clamp(((position.x - a.x) * dx + (position.z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
      const ex = position.x - a.x - dx * u, ez = position.z - a.z - dz * u, d = ex * ex + ez * ez;
      if (d < best) { best = d; bestT = (i + u) / SAMPLE_COUNT; }
    };
    if (global) for (let i = 0; i < SAMPLE_COUNT; i++) inspect(i);
    else {
      for (let i = start - 28; i <= start + 28; i++) inspect(i);
      if (best > 38 * 38) for (let i = 0; i < SAMPLE_COUNT; i++) inspect(i);
    }
    const t = wrap01(bestT), frame = frameAt(t);
    const horizontalRight = new THREE.Vector3(frame.right.x, 0, frame.right.z).normalize();
    const offset = (position.x - frame.p.x) * horizontalRight.x + (position.z - frame.p.z) * horizontalRight.z;
    const height = frame.p.y + offset * frame.right.y / Math.hypot(frame.right.x, frame.right.z) + 0.065;
    return { t, frame, offset, height, horizontalRight, distance: Math.sqrt(best), ...surfaceAt(t, offset) };
  }

  return {SURFACES,ELEVATED,course,TRACK,trackT,laneWidth,yawFor,WORLD_PER_UNIT,metresToProgress,SECTIONS,sectionAt,RAMPS,MILL_T,CART_T,BRIDGE_RANGE,SHORTCUT,BOOST_PADS,ITEM_ROWS,shortcutWidth,roadHalfWidth,surfaceAt,collisionBounds,bankAt,rampHeight,routePoint,SAMPLE_COUNT,COURSE_LENGTH,frameAt,poseAt,projectTrack,sectorT};
}
