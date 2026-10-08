import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { COURSES } from "../src/courses/registry.js";
import { createTrack } from "../src/track/track-builder.js";
import { createCourseKit, batchScenery } from "../src/rendering/course-kit.js";
import { buildPathwayEdges } from "../src/rendering/pathway-edges.js";
import { buildExperienceWorld } from "../src/courses/experiences/world.js";

test("snare drumheads have one visible surface before and after scenery batching", () => {
  const track = createTrack(COURSES.find((course) => course.id === "metronome-hall"));
  const { scenery } = buildExperienceWorld({ scene: new THREE.Scene(), track });
  for (const batched of [false, true]) {
    if (batched) batchScenery(scenery);
    scenery.updateMatrixWorld(true);
    for (const drum of track.drumField.drums) {
      for (const radius of [0.25, 0.5, 0.85]) {
        for (let angle = 0.13; angle < Math.PI * 2; angle += Math.PI / 4) {
          const origin = drum.p
            .clone()
            .add(
              new THREE.Vector3(
                Math.cos(angle) * drum.radius * radius,
                1,
                Math.sin(angle) * drum.radius * radius,
              ),
            );
          const ray = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0), 0, 2);
          const hits = ray
            .intersectObject(scenery, true)
            .filter((hit) => Math.abs(hit.point.y - drum.p.y) < 0.001);
          assert.equal(
            new Set(hits.map((hit) => hit.object)).size,
            1,
            `drum ${drum.index + 1}: one head surface (batched=${batched})`,
          );
          assert.equal(hits[0].object.material.color.getHexString(), "ede5d2");
        }
      }
    }
  }
});

test("rendered shoulders match physical support and exposed faces leave the sky open", () => {
  for (const course of COURSES) {
    const track = createTrack(course),
      scenery = new THREE.Group();
    buildPathwayEdges({ track, kit: createCourseKit(scenery, track, { models: {} }) });
    if (course.downhill) buildExperienceWorld({ scene: scenery, track, assets: { models: {} } });
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

test("Clockwork's upper terrain shoulder leaves the lower foundry camera passage open", () => {
  const track = createTrack(COURSES.find((course) => course.id === "clockwork-citadel"));
  const scenery = new THREE.Group();
  buildPathwayEdges({ track, kit: createCourseKit(scenery, track, { models: {} }) });
  scenery.updateMatrixWorld(true);
  for (const q of [0.42, 0.45, 0.48, 0.51, 0.54]) {
    const pose = track.poseAt(track.sectorT(0, q) * track.TRACK, 0, 0.065);
    const forward = pose.tangent.clone().setY(0).normalize();
    const camera = pose.p.clone().addScaledVector(forward, -8.7);
    camera.y += 4.7;
    const target = pose.p.clone();
    target.y += 0.9;
    const delta = target.sub(camera);
    const ray = new THREE.Raycaster(camera, delta.clone().normalize(), 0, delta.length() - 0.1);
    assert.equal(
      ray.intersectObject(scenery, true).length,
      0,
      `foundry q=${q}: kart stays visible`,
    );
  }
});
