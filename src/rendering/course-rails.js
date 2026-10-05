import * as THREE from "../../vendor/three/three.module.js";
import { frameAt, surfaceAt, BRIDGE_RANGE, SAMPLE_COUNT } from "../track/track.js";

// Sweep a rectangular beam along the actual barrier, sharing each join's
// positions so bends, banking and shortcut transitions cannot leave gaps.
export function createRailGeometry(side, { width, height, above, start = 0, end = 1 }) {
  // Match the cached road frames, including their sharp bank transitions.
  const samples = [start];
  for (let i = Math.floor(start * SAMPLE_COUNT) + 1; i / SAMPLE_COUNT < end; i++)
    samples.push(i / SAMPLE_COUNT);
  samples.push(end);
  for (const t of [BRIDGE_RANGE.start, BRIDGE_RANGE.end]) {
    if (t > start && t < end && !samples.includes(t)) samples.push(t);
  }
  samples.sort((a, b) => a - b);
  const corners = [
    [-width / 2, -height / 2],
    [width / 2, -height / 2],
    [width / 2, height / 2],
    [-width / 2, height / 2],
  ];
  const positions = [],
    uv = [],
    indices = [],
    groups = [];
  for (let i = 0; i < samples.length; i++) {
    const t = samples[i],
      frame = frameAt(t),
      surface = surfaceAt(t);
    const edge = side < 0 ? surface.leftEdge : surface.rightEdge;
    for (let face = 0; face < 4; face++) {
      for (let j = 0; j < 2; j++) {
        const [x, y] = corners[(face + j) % 4];
        const p = frame.p
          .clone()
          .addScaledVector(frame.right, edge + x)
          .addScaledVector(frame.up, above + y);
        positions.push(p.x, p.y, p.z);
        uv.push(j, t * SAMPLE_COUNT);
      }
    }
    if (i === samples.length - 1) continue;
    const offset = indices.length;
    for (let face = 0; face < 4; face++) {
      const a = i * 8 + face * 2,
        b = a + 8;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const midpoint = (t + samples[i + 1]) / 2;
    const materialIndex = midpoint >= BRIDGE_RANGE.start && midpoint <= BRIDGE_RANGE.end ? 1 : 0;
    const previous = groups.at(-1);
    if (previous?.materialIndex === materialIndex) previous.count += 24;
    else groups.push({ start: offset, count: 24, materialIndex });
  }
  // Close the ends of the upper bridge beams. Full-course beams join at t=0/1.
  if (start !== 0 || end !== 1) {
    const last = (samples.length - 1) * 8;
    indices.push(0, 2, 4, 0, 4, 6, last, last + 4, last + 2, last, last + 6, last + 4);
    groups.at(-1).count += 12;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  for (const group of groups) geometry.addGroup(group.start, group.count, group.materialIndex);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
