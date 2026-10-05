import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { sceneryGroundHeight } from "../src/rendering/terrain-height.js";

test("scenery grounding follows the rendered terrain triangle rather than a curved slope", () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [10, 9.94, -1, 48, -1.7, -1, 10, 9.94, 1, 48, -1.7, -1, 48, -1.7, 1, 10, 9.94, 1],
      3,
    ),
  );
  const slope = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster(new THREE.Vector3(19.5, 30, 0), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(slope)[0];
  assert.ok(hit);
  const projected = {
    offset: 19.5,
    leftEdge: -10,
    rightEdge: 10,
    frame: { p: new THREE.Vector3(0, 10, 0), right: new THREE.Vector3(1, 0, 0) },
  };
  assert.ok(Math.abs(sceneryGroundHeight(projected) - hit.point.y) < 1e-5);
  assert.ok(Math.abs(sceneryGroundHeight({ ...projected, offset: 80 }) + 1.7) < 1e-8);
});
