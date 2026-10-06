import * as THREE from "../../../vendor/three/three.module.js";
import { createCourseKit, batchScenery } from "../../rendering/course-kit.js";
import { batchStaticMeshes } from "../../rendering/visuals.js";
import { createClockworkClearance } from "../adventure/clockwork-clearance.js";
import { sceneryGroundHeight } from "../../rendering/terrain-height.js";

/** Roadside stories reserve their complete motion envelope against every floor. */
export function vignetteKit({ scene, track, textures = {} }) {
  const scenery = new THREE.Group();
  scenery.name = `${track.course.name} roadside stories`;
  scene.add(scenery);
  const kit = createCourseKit(scenery, track),
    clear = createClockworkClearance(track),
    animated = [],
    updates = [],
    sites = [];
  const sphere = new THREE.SphereGeometry(1, 16, 10),
    cylinder = new THREE.CylinderGeometry(1, 1, 1, 16),
    torus = new THREE.TorusGeometry(1, 0.055, 6, 48),
    cone = new THREE.ConeGeometry(1, 1, 12);
  const mat = (color, texture = "stone", extra = {}) =>
    kit.material(color, {
      map: textures[texture],
      roughness: 0.74,
      ...extra,
    });
  const group = (parent, position = [0, 0, 0]) => {
    const object = new THREE.Group();
    object.position.set(...position);
    parent.add(object);
    return object;
  };
  function site(name, section, fraction, side, radius, height) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const t = track.sectorT(section, fraction),
        offset = track.platformEdgeAt(t, side) + side * (radius + 7 + attempt * 7),
        g = kit.groupAt(t, offset);
      g.rotation.set(0, track.yawFor(track.frameAt(t).tangent), 0);
      const ground = sceneryGroundHeight(track.projectTrack(g.position, 0, true)),
        bottom = Math.min(-1, ground - g.position.y),
        center = [0, (height + bottom) / 2, 0],
        size = [radius * 2, height - bottom, radius * 2];
      if (!clear(g, center, size)) {
        scenery.remove(g);
        continue;
      }
      g.name = name;
      g.userData.story = name;
      const bounds = new THREE.Box3(
        new THREE.Vector3(-radius, bottom, -radius),
        new THREE.Vector3(radius, height, radius),
      );
      sites.push({ name, group: g, bounds, section, fraction, offset });
      const base = mat(track.course.theme.shoulder, "stone"),
        depth = Math.max(0.2, -bottom);
      kit.mesh(cylinder, base, g, [0, -0.15, 0], [radius * 0.72, 0.3, radius * 0.72]);
      // Route-height exhibits have visible footing down to the surrounding land.
      for (const x of [-1, 1])
        for (const z of [-1, 1])
          kit.box(base, g, [x * radius * 0.45, -depth / 2, z * radius * 0.45], [1, depth, 1]);
      return g;
    }
    throw new Error(`${track.course.id}: no clear site for ${name}`);
  }
  function tube(parent, start, end, radius, material) {
    const a = new THREE.Vector3(...start),
      b = new THREE.Vector3(...end),
      direction = b.clone().sub(a);
    const object = kit.mesh(
      cylinder,
      material,
      parent,
      a.clone().add(b).multiplyScalar(0.5).toArray(),
      [radius, direction.length(), radius],
    );
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return object;
  }
  function silhouette(points, depth = 0.12) {
    const shape = new THREE.Shape();
    shape.moveTo(...points[0]);
    for (const p of points.slice(1)) shape.lineTo(...p);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSize: 0.04,
      bevelThickness: 0.04,
      bevelSegments: 2,
      steps: 1,
    });
  }
  function wheel(parent, position, radius, material, spokes = 12) {
    const pivot = group(parent, position);
    kit.mesh(torus, material, pivot, [0, 0, 0], [radius, radius, radius]);
    for (let i = 0; i < spokes; i++) {
      const a = (i * Math.PI * 2) / spokes;
      tube(pivot, [0, 0, 0], [Math.cos(a) * radius, Math.sin(a) * radius, 0], 0.1, material);
    }
    kit.mesh(sphere, material, pivot, [0, 0, 0], [0.4, 0.4, 0.4]);
    return pivot;
  }
  function motion(object, update) {
    animated.push(object);
    updates.push(update);
    return object;
  }
  function finish() {
    // Local batching preserves articulated child pivots and their local frames.
    scenery.traverse((object) => {
      if (object.isGroup) batchStaticMeshes(object, animated);
    });
    // Reserve world flattening for static meshes; animation roots stay intact.
    batchScenery(scenery, animated);
    return {
      scenery,
      animated,
      sites,
      update(time) {
        updates.forEach((fn) => fn(time));
      },
    };
  }
  return {
    THREE,
    scene,
    track,
    kit,
    scenery,
    sphere,
    cylinder,
    torus,
    cone,
    mat,
    group,
    site,
    tube,
    silhouette,
    wheel,
    motion,
    finish,
    mesh: kit.mesh,
    box: kit.box,
  };
}
