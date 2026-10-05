import * as THREE from "./vendor/three/three.module.js";
import { progressDelta } from "./race.js";

// Progress is a normalized race coordinate. All widths, hit windows and AI
// lookahead distances are world metres, converted explicitly when necessary.
export const TRACK = 2400;
export const TARGET_LENGTH = 1500;
export const wrap01 = (t) => ((t % 1) + 1) % 1;
export const trackT = (s) => wrap01(s / TRACK);
export const laneWidth = (lane) => lane * 6.25;
export const yawFor = (tangent) => Math.atan2(-tangent.x, -tangent.z);
const controls = [
  [-150, 1, -130], [-110, 1, -160], [-40, 1.5, -175],
  [10, 2, -170], [30, 2, -140],
  [60, 3, -120], [35, 4, -90], [70, 5, -60],
  [110, 5, -85], [150, 6, -55],
  [190, 8, -25], [215, 18, 25], [175, 30, 50], [130, 34, 80],
  [135, 16, 125], [115, 8, 155], [65, 7, 150], [30, 6, 135],
  [-10, 5, 150], [-50, 3, 175], [-90, 2, 150],
  [-100, 2, 105], [-145, 1, 90],
  [-195, 1, 90], [-225, 2, 45], [-225, 3, -10],
  [-180, 1, -25], [-170, 1, -80], [-180, 1, -115],
];
const curve = new THREE.CatmullRomCurve3(
  controls.map((p) => new THREE.Vector3(...p)), true, "centripetal",
);
curve.arcLengthDivisions = 4096;
const scale = TARGET_LENGTH / curve.getLength();
for (const point of curve.points) { point.x *= scale; point.z *= scale; }
curve.updateArcLengths();
export const WORLD_PER_UNIT = curve.getLength() / TRACK;
export const metresToProgress = (metres) => metres / WORLD_PER_UNIT;
const lengths = curve.getLengths(4096);
const arcAtControl = (index) => {
  const sample = index / controls.length * 4096, i = Math.floor(sample);
  return THREE.MathUtils.lerp(lengths[i], lengths[i + 1] ?? lengths[i], sample - i) / lengths.at(-1);
};
const definitions = [
  [0, "meadow", "FESTIVAL MEADOW", "Open road · find your line", 9, "asphalt", "#ffc677"],
  [5, "forest", "PINE HOLLOW", "Link the bends · tap drift to trick", 7.4, "asphalt", "#82bca0"],
  [10, "ridge", "RIDGE OVERLOOK", "Climb · crest · chase the view", 8, "asphalt", "#d1d9ad"],
  [14, "bridge", "LAKESIDE TIMBER", "Hold your line over the water", 6.1, "wood", "#7bd4de"],
  [18, "mill", "WINDMILL WORKS", "Watch the delivery cart", 8.2, "stone", "#ffd48d"],
  [23, "orchard", "ORCHARD RUN", "Inside grass cut · outside turbo", 9, "asphalt", "#f6b884"],
];
export const SECTIONS = definitions.map(([index, id, name, hint, halfWidth, material, color], i) => ({
  id, name, hint, halfWidth, material, color, start: arcAtControl(index),
  end: i + 1 < definitions.length ? arcAtControl(definitions[i + 1][0]) : 1,
}));
export function sectionAt(t) {
  t = wrap01(t);
  return SECTIONS.find((section) => t >= section.start && t < section.end) || SECTIONS[0];
}
const sectorT = (index, fraction) => THREE.MathUtils.lerp(SECTIONS[index].start, SECTIONS[index].end, fraction);
export const RAMPS = [
  { t: sectorT(1, 0.55), halfLength: 7, height: 0.9 },
  { t: sectorT(3, 0.52), halfLength: 9, height: 1.15 },
  { t: sectorT(5, 0.88), halfLength: 7, height: 0.7 },
];
export const MILL_T = sectorT(4, 0.48);
export const CART_T = sectorT(4, 0.70);
export const BRIDGE_RANGE = { start: sectorT(3, 0.08), end: sectorT(3, 0.65) };
export const SHORTCUT = { start: sectorT(5, 0.10), end: sectorT(5, 0.36), extraWidth: 22 };
export const BOOST_PADS = [
  { t: sectorT(0, 0.70), offset: -3.3, duration: 0.8 },
  { t: sectorT(2, 0.72), offset: 0, duration: 0.8 },
  { t: sectorT(3, 0.78), offset: 0, duration: 0.8 },
  ...[0.27, 0.40, 0.53].map((f) => ({ t: sectorT(5, f), offset: -5.1, duration: 0.7 })),
];
export const ITEM_ROWS = [sectorT(0, 0.23), sectorT(1, 0.12), sectorT(1, 0.85),
  sectorT(2, 0.32), sectorT(3, 0.12), sectorT(3, 0.90), sectorT(4, 0.87), sectorT(5, 0.72)];
const smooth = (a, b, v) => THREE.MathUtils.smoothstep(v, a, b);
export function shortcutWidth(t) {
  return SHORTCUT.extraWidth * smooth(SHORTCUT.start, SHORTCUT.start + 0.018, t)
    * (1 - smooth(SHORTCUT.end - 0.018, SHORTCUT.end, t));
}
export function roadHalfWidth(t) {
  t = wrap01(t);
  const section = sectionAt(t), i = SECTIONS.indexOf(section);
  const previous = SECTIONS[(i + SECTIONS.length - 1) % SECTIONS.length];
  return THREE.MathUtils.lerp(previous.halfWidth, section.halfWidth, smooth(section.start, section.start + 0.012, t));
}
export function surfaceAt(t, offset = 0) {
  t = wrap01(t);
  const halfWidth = roadHalfWidth(t), section = sectionAt(t);
  return { section, halfWidth, offroad: Math.abs(offset) > halfWidth,
    leftEdge: -halfWidth - 0.55, rightEdge: halfWidth + 0.55 + shortcutWidth(t),
    grip: section.id === "mill" ? 10 : 12 };
}
// Vehicle centers respect body size; shells use the same actual road edges.
export function collisionBounds(t, radius = 0.9) {
  const surface = surfaceAt(t);
  return { left: surface.leftEdge + radius, right: surface.rightEdge - radius };
}
export function bankAt(t) {
  if (shortcutWidth(wrap01(t)) > 0) return 0;
  const a = curve.getTangentAt(wrap01(t - 0.005)), b = curve.getTangentAt(wrap01(t + 0.005));
  return THREE.MathUtils.clamp(progressDelta(yawFor(b), yawFor(a), Math.PI * 2) * -0.6, -0.14, 0.14);
}
export function rampHeight(t) {
  let height = 0;
  for (const ramp of RAMPS) {
    const q = Math.abs(progressDelta(t, ramp.t, 1)) * lengths.at(-1) / ramp.halfLength;
    if (q < 1) height = Math.max(height, ramp.height * Math.cos(q * Math.PI / 2) ** 2);
  }
  return height;
}
export function routePoint(t) {
  t = wrap01(t);
  const p = curve.getPointAt(t);
  p.y += rampHeight(t);
  return p;
}
export const SAMPLE_COUNT = 3072;
const samples = Array.from({ length: SAMPLE_COUNT + 1 }, (_, i) => routePoint(i / SAMPLE_COUNT));
export const COURSE_LENGTH = samples.slice(1).reduce((sum, p, i) => sum + p.distanceTo(samples[i]), 0);
// Cache the complete frame; physics no longer evaluates spline tangents per kart per tick.
const frames = samples.slice(0, SAMPLE_COUNT).map((p, i) => {
  const tangent = samples[(i + 1) % SAMPLE_COUNT].clone().sub(samples[(i - 1 + SAMPLE_COUNT) % SAMPLE_COUNT]).normalize();
  const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().applyAxisAngle(tangent, bankAt(i / SAMPLE_COUNT));
  return { p, tangent, right, up: right.clone().cross(tangent).normalize() };
});
export function frameAt(t) {
  const index = wrap01(t) * SAMPLE_COUNT, i = Math.floor(index), f = index - i;
  const a = frames[i], b = frames[(i + 1) % SAMPLE_COUNT];
  const tangent = a.tangent.clone().lerp(b.tangent, f).normalize();
  const right = a.right.clone().lerp(b.right, f).normalize();
  return { p: samples[i].clone().lerp(samples[i + 1], f), tangent, right, up: right.clone().cross(tangent).normalize() };
}
export function poseAt(s, lane = 0, above = 0.06) {
  const f = frameAt(trackT(s));
  const p = f.p.clone().addScaledVector(f.right, lane);
  p.y += above;
  return { ...f, p };
}
export function projectTrack(position, nearS = 0, global = false) {
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
