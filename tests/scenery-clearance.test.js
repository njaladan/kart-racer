import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { COURSES } from "../src/courses/registry.js";
import { selectCourse } from "../src/track/track.js";
import { createCourseKit, batchScenery } from "../src/rendering/course-kit.js";
import { createRouteClearance } from "../src/rendering/route-clearance.js";
import { buildAdventureArt } from "../src/courses/fidelity/index.js";
import { createSunGlare } from "../src/rendering/sun-glare.js";

test("flat imported props fit a bounded footprint instead of scaling their width by height", () => {
  const track = selectCourse(COURSES.find((c) => c.id === "pocket-pantry"));
  const root = new THREE.Group(),
    template = new THREE.Group();
  template.add(new THREE.Mesh(new THREE.BoxGeometry(12, 1, 3), new THREE.MeshStandardMaterial()));
  const kit = createCourseKit(root, track, { models: { loaf: template } });
  const loaf = kit.fitAsset("loaf", root, [0, 0, 0], 10);
  const size = new THREE.Box3().setFromObject(loaf).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - 10) < 1e-6);
  assert.ok(size.y < 1 && size.z < 3, "authored proportions survive fitting");
});

test("Santorini terraces and complete observatory mountings clear every road floor", () => {
  const course = COURSES.find((c) => c.id === "emberwing-observatory"),
    track = selectCourse(course);
  const scene = new THREE.Scene(),
    scenery = new THREE.Group();
  scene.add(scenery);
  const kit = createCourseKit(scenery, track);
  course.buildWorld({ THREE, scene, scenery, track, kit, textures: {} });
  const allows = createRouteClearance(track),
    identity = new THREE.Group();
  let terraces = 0;
  scenery.traverse((object) => {
    if (object.name !== "Whitewashed caldera terrace") return;
    terraces++;
    const bounds = new THREE.Box3().setFromObject(object);
    assert.ok(
      allows(
        identity,
        bounds.getCenter(new THREE.Vector3()).toArray(),
        bounds.getSize(new THREE.Vector3()).toArray(),
      ),
    );
    assert.ok(Math.abs(bounds.min.y + 46) < 0.01, "retaining walls reach the caldera ground");
  });
  assert.ok(terraces > 40, "clearance preserves the inhabited town");
});

test("all Pelagic fish and jellyfish animation envelopes stay underwater", () => {
  const course = COURSES.find((c) => c.id === "pelagic-glasshouse"),
    track = selectCourse(course);
  const scene = new THREE.Scene(),
    scenery = new THREE.Group();
  scene.add(scenery);
  const kit = createCourseKit(scenery, track);
  const world = course.buildWorld({ THREE, scene, scenery, track, kit, textures: {} });
  const fish = new THREE.Group();
  fish.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 2), new THREE.MeshStandardMaterial()));
  const importedKit = createCourseKit(scenery, track, { models: { "art:fish": fish } });
  const art = buildAdventureArt({ scene, track, kit: importedKit, textures: {} });
  for (const time of [0, 3, 8, 17, 35, 64]) {
    world.update(time);
    art.update(time);
    scene.updateMatrixWorld(true);
    let wildlife = 0;
    scene.traverse((object) => {
      if (
        !/^Submerged .*fish|^Submerged .*jellyfish|^Submerged fish|^Submerged jellyfish/.test(
          object.name,
        )
      )
        return;
      const bounds = new THREE.Box3().setFromObject(object);
      assert.ok(bounds.max.y <= -1, `${object.name} surfaced at ${time}: ${bounds.max.y}`);
      wildlife++;
    });
    assert.ok(wildlife >= 20);
  }
});

test("incidental posts are removed from a centered gallery while the supported road remains", () => {
  const track = selectCourse(COURSES.find((c) => c.id === "clockwork-citadel"));
  const root = new THREE.Group(),
    kit = createCourseKit(root, track),
    gate = kit.groupAt(0.02);
  const material = kit.material("#aaaaaa");
  const post = kit.box(material, gate, [0, 2, 0], [1, 4, 1]);
  const deck = kit.box(material, gate, [0, -0.5, 0], [22, 1, 8]);
  deck.userData.bakeReceiver = true;
  batchScenery(root);
  assert.equal(post.parent, null);
  let receivers = 0;
  root.traverse((o) => {
    if (o.isMesh && o.userData.bakeReceiver) receivers++;
  });
  assert.ok(receivers > 0);
});

test("sun glare fades behind solid scenery and disappears underwater or indoors", () => {
  const scene = new THREE.Scene(),
    sun = new THREE.DirectionalLight();
  sun.position.set(0, 0, -100);
  scene.add(sun, sun.target);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.lookAt(0, 0, -100);
  camera.updateMatrixWorld();
  const glare = createSunGlare(scene, { sunIntensity: 3, terrain: "sand" });
  for (let i = 0; i < 10; i++) glare.update(i * 0.4, camera);
  const open = glare.object.material.uniforms.strength.value;
  assert.ok(open > 0.8);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 1), new THREE.MeshStandardMaterial());
  wall.position.z = -20;
  scene.add(wall);
  scene.updateMatrixWorld(true);
  for (let i = 0; i < 20; i++) glare.update(5 + i * 0.4, camera);
  assert.ok(glare.object.material.uniforms.strength.value < 0.01);
  glare.update(20, camera, true);
  assert.equal(glare.object.visible, false);
  const indoor = createSunGlare(scene, { sunIntensity: 3, terrain: "wood" });
  indoor.update(0, camera);
  assert.equal(indoor.object.visible, false);
});

test("alternate driving surfaces retain nonzero vertex colors after obstacle pruning", async () => {
  const { buildExperienceWorld } = await import("../src/courses/experiences/world.js");
  for (const id of ["frostpeak-festival"]) {
    const track = selectCourse(COURSES.find((c) => c.id === id)),
      scene = new THREE.Scene();
    const world = buildExperienceWorld({ scene, track, assets: { models: {} } });
    batchScenery(world.scenery, world.animated);
    let surfaces = 0;
    scene.traverse((o) => {
      if (!o.isMesh || !o.userData.bakeReceiver) return;
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      if (!materials.some((m) => m.vertexColors)) return;
      const colors = o.geometry.getAttribute("color");
      assert.ok(colors, `${id} driving material needs vertex colors to avoid black polygons`);
      assert.equal(colors.count, o.geometry.attributes.position.count);
      assert.ok(colors.array.every((c) => Number.isFinite(c) && c > 0));
      surfaces++;
    });
    assert.ok(surfaces > 0);
  }
});
