import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { COURSES } from "../src/courses/registry.js";
import { createTrack } from "../src/track/track-builder.js";
import { createDistantLightning } from "../src/rendering/distant-lightning.js";

test("Tempest forks stay ahead of the driving view and fixed throughout a strike", () => {
  const track = createTrack(COURSES.find((c) => c.id === "tempest-causeway"));
  const scene = new THREE.Scene();
  const strike = createDistantLightning({ THREE, scene, track });
  const camera = new THREE.PerspectiveCamera(63, 16 / 9, 0.1, 1050);
  const flash = track.course.storm.flashAt;
  for (let section = 0; section < track.SECTIONS.length; section++) {
    const t = track.sectorT(section, 0.5),
      frame = track.frameAt(t);
    const time = section * track.course.storm.period + flash;
    strike.update(time - 1, { playerT: t });
    assert.equal(strike.root.visible, false);
    strike.update(time, { playerT: t });
    assert.equal(strike.root.visible, true);
    const anchor = strike.root.position.clone();
    camera.position
      .copy(frame.p)
      .addScaledVector(frame.tangent, -8.5)
      .add(new THREE.Vector3(0, 4.7, 0));
    camera.lookAt(
      frame.p
        .clone()
        .addScaledVector(frame.tangent, 22)
        .add(new THREE.Vector3(0, 2, 0)),
    );
    camera.updateMatrixWorld(true);
    const middle = anchor
      .clone()
      .add(new THREE.Vector3(0, 65, 0))
      .project(camera);
    assert.ok(
      Math.abs(middle.x) < 1 && Math.abs(middle.y) < 1,
      `section ${section}: bolt visible in chase view`,
    );
    strike.update(time + 0.04, { playerT: t + 0.01 });
    assert.ok(strike.root.position.equals(anchor));
    strike.update(time + 0.04, { motionEnabled: false, playerT: t });
    assert.equal(strike.root.visible, false);
    strike.update(time + 0.3, { playerT: t });
    assert.equal(strike.root.visible, false);
  }
});
