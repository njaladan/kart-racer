import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { createRailGeometry } from "../src/rendering/course-rails.js";
import { frameAt, collisionBounds, BRIDGE_RANGE, SAMPLE_COUNT } from "../src/track/track.js";

const beam = { width: 0.15, height: 0.32, above: 0.72 };
const vertex = (geometry, i) =>
  new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i);
const center = (geometry, i) =>
  vertex(geometry, i * 8)
    .add(vertex(geometry, i * 8 + 4))
    .multiplyScalar(0.5);
const progress = (geometry, i) => geometry.attributes.uv.getY(i * 8) / SAMPLE_COUNT;

test("both continuous rails follow the collision boundary through bends, width changes and the grass cut", () => {
  for (const side of [-1, 1]) {
    const geometry = createRailGeometry(side, beam);
    const count = geometry.attributes.position.count / 8;
    for (let i = 0; i < count; i++) {
      const t = progress(geometry, i),
        frame = frameAt(t),
        bounds = collisionBounds(t, 0);
      const edge = side < 0 ? bounds.left : bounds.right;
      const expected = frame.p
        .clone()
        .addScaledVector(frame.right, edge)
        .addScaledVector(frame.up, beam.above);
      assert.ok(center(geometry, i).distanceTo(expected) < 0.001);
      if (i === count - 1) continue;
      const nextT = progress(geometry, i + 1),
        midpoint = (t + nextT) / 2;
      const midFrame = frameAt(midpoint),
        midBounds = collisionBounds(midpoint, 0);
      const midEdge = side < 0 ? midBounds.left : midBounds.right;
      const expectedMid = midFrame.p
        .clone()
        .addScaledVector(midFrame.right, midEdge)
        .addScaledVector(midFrame.up, beam.above);
      const actualMid = center(geometry, i)
        .add(center(geometry, i + 1))
        .multiplyScalar(0.5);
      assert.ok(
        actualMid.distanceTo(expectedMid) < 0.05,
        `rail deviates from barrier at ${midpoint}`,
      );
      // Every face connects this cross-section directly to the next one.
      for (let face = 0; face < 4; face++) {
        const offset = i * 24 + face * 6;
        const a = i * 8 + face * 2;
        assert.deepEqual(Array.from(geometry.index.array.slice(offset, offset + 6)), [
          a,
          a + 8,
          a + 1,
          a + 1,
          a + 8,
          a + 9,
        ]);
      }
    }
    geometry.dispose();
  }
});

test("rails close at the lap seam and have nondegenerate surfaces and complete culling bounds", () => {
  const geometry = createRailGeometry(1, beam),
    count = geometry.attributes.position.count / 8;
  for (let j = 0; j < 8; j++)
    assert.ok(vertex(geometry, j).distanceTo(vertex(geometry, (count - 1) * 8 + j)) < 0.001);
  for (let i = 0; i < count - 1; i++) {
    for (let face = 0; face < 4; face++) {
      const offset = i * 24 + face * 6;
      const a = vertex(geometry, geometry.index.getX(offset));
      const b = vertex(geometry, geometry.index.getX(offset + 1));
      const c = vertex(geometry, geometry.index.getX(offset + 2));
      const normal = b.sub(a).cross(c.sub(a)).normalize();
      assert.ok(normal.length() > 0.99);
    }
  }
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    const p = vertex(geometry, i);
    assert.ok(geometry.boundingBox.containsPoint(p));
    assert.ok(
      p.distanceTo(geometry.boundingSphere.center) <= geometry.boundingSphere.radius + 1e-5,
    );
  }
  geometry.dispose();
});

test("timber rails start and end exactly at the bridge and material groups cover every triangle", () => {
  for (const side of [-1, 1]) {
    const lower = createRailGeometry(side, beam);
    const timber = lower.groups.find((group) => group.materialIndex === 1);
    const first = lower.index.getX(timber.start) / 8;
    const last = lower.index.getX(timber.start + timber.count - 2) / 8;
    assert.ok(Math.abs(progress(lower, first) - BRIDGE_RANGE.start) < 1e-7);
    assert.ok(Math.abs(progress(lower, Math.floor(last)) - BRIDGE_RANGE.end) < 1e-7);
    const upper = createRailGeometry(side, {
      width: 0.12,
      height: 0.15,
      above: 1.25,
      start: BRIDGE_RANGE.start,
      end: BRIDGE_RANGE.end,
    });
    assert.ok(Math.abs(progress(upper, 0) - BRIDGE_RANGE.start) < 1e-7);
    assert.ok(
      Math.abs(progress(upper, upper.attributes.position.count / 8 - 1) - BRIDGE_RANGE.end) < 1e-7,
    );
    assert.ok(upper.groups.every((group) => group.materialIndex === 1));
    for (const geometry of [lower, upper]) {
      let end = 0;
      for (const group of geometry.groups) {
        assert.equal(group.start, end);
        end += group.count;
      }
      assert.equal(end, geometry.index.count);
      assert.ok(Array.from(geometry.attributes.normal.array).every(Number.isFinite));
      geometry.dispose();
    }
  }
});
