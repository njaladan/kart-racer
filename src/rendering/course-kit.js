import * as THREE from "../../vendor/three/three.module.js";
import { batchStaticMeshes } from "./visuals.js";
import { bakeVertexShade } from "./vertex-shading.js";
import { sceneryGroundHeight } from "./terrain-height.js";

// Scenery authors get placement and reusable primitives, never engine globals.
export function createCourseKit(scenery, track, assets = { models: {} }) {
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const material = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      vertexColors: true,
      ...(extra.map?.userData?.pbr || {}),
      ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined)),
    });
  const mesh = (geometry, mat, parent = scenery, position = [0, 0, 0], scale = [1, 1, 1]) => {
    if (!geometry.getAttribute("color") && geometry.getAttribute("normal"))
      bakeVertexShade(geometry, 0.14);
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(...position);
    m.scale.set(...scale);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (mat, parent = scenery, position = [0, 0, 0], scale = [1, 1, 1]) =>
    mesh(boxGeometry, mat, parent, position, scale);
  const align = (group, frame) => {
    group.position.copy(frame.p);
    group.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(frame.right, frame.up, frame.tangent.clone().negate()),
    );
  };
  const groupAt = (t, offset = 0, parent = scenery) => {
    const g = new THREE.Group();
    align(g, track.poseAt(t * track.TRACK, offset, 0));
    parent.add(g);
    return g;
  };
  const sectorT = (index, fraction) => track.sectorT(index, fraction);
  // Scenic structures stay upright and are planted on the rendered embankment.
  const landGroup = (t, offset, parent = scenery) => {
    const pose = track.poseAt(t * track.TRACK, offset, 0),
      surface = track.projectTrack(pose.p, 0, true);
    const g = new THREE.Group();
    g.position.copy(pose.p);
    g.position.y = sceneryGroundHeight(surface);
    g.rotation.y = track.yawFor(pose.tangent);
    parent.add(g);
    return g;
  };
  const safeGroup = (t, offset, footprint = 1, parent = scenery) => {
    const p = track.poseAt(t * track.TRACK, offset, 0).p,
      s = track.projectTrack(p, 0, true);
    const edge = s.offset > 0 ? s.rightEdge : -s.leftEdge;
    return s.distance > edge + footprint + 1 ? landGroup(t, offset, parent) : null;
  };
  const asset = (name, parent = scenery, position = [0, 0, 0], scale = [1, 1, 1]) => {
    const model = assets.models[name];
    if (!model) throw new Error(`Unknown course scenery asset: ${name}`);
    if (model.isObject3D) {
      const instance = model.clone(true);
      instance.position.set(...position);
      instance.scale.set(...scale);
      parent.add(instance);
      return instance;
    }
    return mesh(model.geometry, model.material, parent, position, scale);
  };
  return {
    material,
    mesh,
    box,
    align,
    groupAt,
    landGroup,
    safeGroup,
    sectorT,
    asset,
    hasAsset: (name) => !!assets.models[name],
    batch: batchStaticMeshes,
  };
}

export function batchScenery(scenery, animated = []) {
  scenery.updateMatrixWorld(true);
  const meshes = [];
  scenery.traverse((m) => {
    if (m.isMesh && !animated.some((g) => g === m || g.getObjectById(m.id))) meshes.push(m);
  });
  const combined = new THREE.Group();
  scenery.add(combined);
  for (const m of meshes) {
    m.matrixWorld.decompose(m.position, m.quaternion, m.scale);
    combined.add(m);
  }
  batchStaticMeshes(combined);
  // Remove empty source containers left after flattening static scenery.
  const prune = (group) => {
    for (const child of [...group.children]) {
      if (child.isGroup && !animated.includes(child)) {
        prune(child);
        if (child.children.length === 0) group.remove(child);
      }
    }
  };
  prune(scenery);
}
