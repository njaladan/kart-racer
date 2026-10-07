import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { COURSES } from "../src/courses/registry.js";
import { createTrack } from "../src/track/track-builder.js";
import { createCourseKit } from "../src/rendering/course-kit.js";
import { buildPathwayEdges } from "../src/rendering/pathway-edges.js";

test("rendered shoulders match physical support and exposed faces leave the sky open", () => {
  for (const course of COURSES) {
    const track = createTrack(course),
      scenery = new THREE.Group();
    buildPathwayEdges({ track, kit: createCourseKit(scenery, track, { models: {} }) });
    scenery.updateMatrixWorld(true);
    for (const [index] of track.SECTIONS.entries()) {
      if (
        course.traversals?.some((r) => r.section === index) ||
        course.branches?.some((b) => b.required && b.section === index) ||
        course.drumField?.section === index ||
        course.movingDecks?.some((d) => index >= d.section && index <= (d.endSection ?? d.section))
      )
        continue;
      for (const side of [-1, 1]) {
        const t = track.sectorT(index, 0.51),
          edge = track.edgeAt(t, side);
        if (edge.mode !== "soft") continue;
        const p = track.poseAt(t * track.TRACK, edge.offset + side * edge.shoulder * 0.2).p;
        const floor = track.floorAt(track.projectTrack(p, t * track.TRACK));
        const ray = new THREE.Raycaster(
          new THREE.Vector3(p.x, p.y + 20, p.z),
          new THREE.Vector3(0, -1, 0),
        );
        const hits = ray.intersectObject(scenery, true);
        assert.ok(
          hits.some((hit) => Math.abs(hit.point.y - (floor.height - 0.065)) < 0.08),
          `${course.id}: ${edge.kind} surface agrees with driving support`,
        );
      }
    }
    const faces = [];
    scenery.traverse((object) => {
      if (object.isMesh && object.name.endsWith("exposed face")) faces.push(object);
    });
    assert.ok(faces.length > 0, course.id);
    for (const face of faces) {
      const normals = face.geometry.getAttribute("normal");
      // An open side is a vertical fascia, not an extra horizontal catch floor.
      for (let i = 0; i < normals.count; i++)
        assert.ok(Math.abs(normals.getY(i)) < 0.4, `${course.id}: open face is vertical`);
    }
  }
});
