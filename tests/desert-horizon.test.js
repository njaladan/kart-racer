import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import course from "../src/courses/sunstone-ruins.js";
import { selectCourse } from "../src/track/track.js";
import { createCourseKit, batchScenery } from "../src/rendering/course-kit.js";
import { createRouteClearance } from "../src/rendering/route-clearance.js";
import { buildDesertHorizon } from "../src/courses/sunstone-ruins/build-desert-horizon.js";
import {
  createDesertHeightField,
  createDesertTerrainTile,
} from "../src/courses/sunstone-ruins/desert-terrain.js";

const track = selectCourse(course);
test("adjacent desert tiles share heights, lighting normals and world UVs without seams", () => {
  const field = createDesertHeightField(track);
  const a = createDesertTerrainTile(THREE, field, 600, 120);
  const b = createDesertTerrainTile(THREE, field, 840, 120);
  const pa = a.attributes.position,
    pb = b.attributes.position;
  for (let row = 0; row <= 30; row++) {
    const ia = row * 31 + 30,
      ib = row * 31;
    assert.equal(pa.getX(ia) + 600, pb.getX(ib) + 840);
    assert.equal(pa.getY(ia), pb.getY(ib));
    assert.equal(pa.getZ(ia), pb.getZ(ib));
    for (const channel of ["normal", "uv", "color"])
      for (let c = 0; c < a.attributes[channel].itemSize; c++)
        assert.equal(
          a.attributes[channel].array[ia * a.attributes[channel].itemSize + c],
          b.attributes[channel].array[ib * b.attributes[channel].itemSize + c],
        );
  }
  for (let i = 0; i < 500; i++) {
    const t = i / 500;
    for (const side of [-1, 1]) {
      const p = track.poseAt(t * track.TRACK, track.platformEdgeAt(t, side) + side * 8, 0).p;
      assert.ok(
        field.heightAt(p.x, p.z) < p.y - 0.3,
        "the existing road and shoulder stay exposed",
      );
    }
  }
});

test("continuous dunes and every weathered landmark clear the complete driving and camera corridor", () => {
  const scene = new THREE.Scene(),
    scenery = new THREE.Group();
  scene.add(scenery);
  const kit = createCourseKit(scenery, track);
  buildDesertHorizon({ THREE, scenery, track, kit, textures: {} });
  const allows = createRouteClearance(track),
    identity = new THREE.Group();
  const landmarks = scenery.children.filter((o) => o.userData.desertLandmark);
  assert.ok(landmarks.length >= 6 && landmarks.length < 20, "sparse clusters preserve open vistas");
  for (const root of landmarks) {
    const bounds = new THREE.Box3().setFromObject(root);
    assert.ok(
      allows(
        identity,
        bounds.getCenter(new THREE.Vector3()).toArray(),
        bounds.getSize(new THREE.Vector3()).toArray(),
      ),
      root.name,
    );
  }
  scenery.updateMatrixWorld(true);
  const triangle = new THREE.Triangle();
  for (const tile of scenery.children.filter((o) => o.userData.desertTerrain)) {
    const geometry = tile.geometry,
      p = geometry.attributes.position,
      index = geometry.index;
    const bounds = new THREE.Box3().setFromObject(tile);
    const cells = allows.corridor.filter((cell) => cell.intersectsBox(bounds));
    for (let i = 0; i < index.count; i += 3) {
      triangle.a.fromBufferAttribute(p, index.getX(i)).applyMatrix4(tile.matrixWorld);
      triangle.b.fromBufferAttribute(p, index.getX(i + 1)).applyMatrix4(tile.matrixWorld);
      triangle.c.fromBufferAttribute(p, index.getX(i + 2)).applyMatrix4(tile.matrixWorld);
      assert.ok(
        !cells.some((cell) => cell.intersectsTriangle(triangle)),
        "sand never blocks a road or chase camera",
      );
    }
  }
  batchScenery(scenery);
  assert.equal(scene.userData.sceneryClearance.moved, 0);
  assert.equal(scene.userData.sceneryClearance.omitted, 0);
  scenery.traverse((o) => {
    if (o.isMesh)
      for (const a of Object.values(o.geometry.attributes))
        assert.ok(a.array.every(Number.isFinite));
  });
});
