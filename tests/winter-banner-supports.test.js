import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import course from "../src/courses/frostpeak-festival.js";
import { createTrack } from "../src/track/track-builder.js";
import { createCourseKit } from "../src/rendering/course-kit.js";
import { createFestivalKit } from "../src/courses/frostpeak-festival/festival-kit.js";
import { buildWinterLife } from "../src/courses/frostpeak-festival/build-winter-life.js";
import { sceneryGroundHeight } from "../src/rendering/terrain-height.js";

test("winter banners reach grounded supports and remain pinned to their cables when waving", () => {
  const track = createTrack(course),
    scene = new THREE.Scene(),
    scenery = new THREE.Group();
  scene.add(scenery);
  const kit = createCourseKit(scenery, track);
  const festival = createFestivalKit({ THREE, scene, scenery, track, kit, textures: {} });
  // Art-free fixture: the unrelated imported sled hut is covered by course assembly tests.
  festival.chalet = () => null;
  const life = buildWinterLife({ THREE, scene, track, festival, assets: { models: {} } });
  const spans = scene.userData.winterBannerSpans;
  assert.equal(spans.length, 12);
  for (const time of [0, 4, 13]) {
    life.update(time);
    scene.updateMatrixWorld(true);
    for (const { t, half, wire, posts, cloths } of spans) {
      for (const [i, post] of posts.entries()) {
        const side = i ? 1 : -1;
        const top = wire.localToWorld(new THREE.Vector3(side * half, 13.1, 0));
        const foot = post.localToWorld(new THREE.Vector3(0, -0.5, 0));
        assert.ok(
          Math.abs(foot.y - sceneryGroundHeight(track.projectTrack(foot, t * track.TRACK))) < 1e-5,
        );
        const tip = post.localToWorld(new THREE.Vector3(0, 0.5, 0));
        assert.ok(tip.distanceTo(top) < 1e-5);
        const projected = track.projectTrack(foot, t * track.TRACK);
        assert.ok(projected.distance > track.roadHalfWidth(t) + 1);
      }
      for (const [index, cloth] of cloths.entries()) {
        const pin = cloth.localToWorld(new THREE.Vector3());
        const cable = wire.localToWorld(new THREE.Vector3((index - 2) * 3, 13, 0));
        assert.ok(pin.distanceTo(cable) < 1e-5);
      }
    }
  }
});
