import { reserveSceneryForTrack, clearSceneryFootprints } from "./scenery-clearance.js";
import * as THREE from "../../vendor/three/three.module.js";
import { batchStaticMeshes } from "./visuals.js";
import { bakeVertexShade } from "./vertex-shading.js";
import { sceneryGroundHeight } from "./terrain-height.js";
import { createAuthoredGeometryLibrary } from "./authored-geometry.js";

// Read-only unit geometry is shared by all authoring kits in a scene.
const unitBoxGeometry = new THREE.BoxGeometry(1, 1, 1);

// Scenery authors get placement and reusable primitives, never engine globals.
export function createCourseKit(scenery, track, assets = { models: {} }) {
  reserveSceneryForTrack(scenery, track);
  const boxGeometry = unitBoxGeometry;
  const authoredGeometry = createAuthoredGeometryLibrary(assets.models);
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
    let owner = parent;
    while (owner && owner !== scenery) {
      if (owner.userData.pathwayEdge) m.userData.routeObstacle = true;
      if (owner.userData.routeStructure) m.userData.routeStructure = true;
      owner = owner.parent;
    }
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
    g.userData.scenicAssembly = offset !== 0;
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
    g.userData.scenicAssembly = true;
    g.userData.groundPlanted = true;
    g.rotation.y = track.yawFor(pose.tangent);
    parent.add(g);
    return g;
  };
  const safeGroup = (t, offset, footprint = 1, parent = scenery) => {
    const p = track.poseAt(t * track.TRACK, offset, 0).p,
      s = track.projectTrack(p, 0, true);
    const edge = track.mountainSurface?.containsT(s.t)
      ? track.mountainSurface.widthAt(s.t)
      : s.offset > 0
        ? s.rightEdge
        : -s.leftEdge;
    if (
      (track.branches || []).some(
        (branch) => branch.project(p, t, true).distance < branch.halfWidth + footprint + 2,
      )
    )
      return null;
    return s.distance > edge + footprint + 1 ? landGroup(t, offset, parent) : null;
  };
  const asset = (name, parent = scenery, position = [0, 0, 0], scale = [1, 1, 1]) => {
    const model = assets.models[name];
    if (parent !== scenery && parent.userData.scenicAssembly == null) {
      parent.userData.scenicAssembly = true;
      parent.userData.groundPlanted = true;
    }
    if (!model) throw new Error(`Unknown course scenery asset: ${name}`);
    if (model.isObject3D) {
      const inferred = name.endsWith("-near") ? name.slice(0, -5) : name;
      const lodNames = model.userData.lods || {
        mid: `${inferred}-mid`,
        far: `${inferred}-far`,
      };
      const variants = [model, assets.models[lodNames.mid], assets.models[lodNames.far]].filter(
        Boolean,
      );
      let instance;
      if (variants.length > 1) {
        instance = new THREE.LOD();
        instance.name = `${name} distance detail`;
        instance.autoUpdate = false;
        instance.userData.sceneryLod = true;
        instance.userData.lodDistances = model.userData.lodDistances || [0, 85, 180];
        variants.forEach((variant, i) =>
          instance.addLevel(variant.clone(true), instance.userData.lodDistances[i], 0.12),
        );
      } else instance = model.clone(true);
      instance.position.set(...position);
      instance.scale.set(...scale);
      parent.add(instance);
      return instance;
    }
    return mesh(model.geometry, model.material, parent, position, scale);
  };
  const fitAsset = (name, parent, position, dimensions) => {
    const object = asset(name, parent, position);
    object.updateWorldMatrix(true, true);
    const inverse = object.matrixWorld.clone().invert(),
      bounds = new THREE.Box3();
    object.traverse((child) => {
      if (!child.isMesh) return;
      child.geometry.computeBoundingBox();
      bounds.union(
        child.geometry.boundingBox
          .clone()
          .applyMatrix4(inverse.clone().multiply(child.matrixWorld)),
      );
    });
    const size = bounds.getSize(new THREE.Vector3());
    if (Array.isArray(dimensions))
      object.scale.set(...dimensions.map((n, i) => n / Math.max(0.001, size.getComponent(i))));
    else object.scale.setScalar(dimensions / Math.max(size.x, size.y, size.z, 0.001));
    return object;
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
    fitAsset,
    authoredGeometry,
    hasAsset: (name) => !!assets.models[name],
    batch: batchStaticMeshes,
  };
}

export function batchScenery(scenery, animated = []) {
  clearSceneryFootprints(scenery, animated);
  scenery.updateMatrixWorld(true);
  const protectedGroups = [...animated];
  scenery.traverse((object) => {
    if (object.isLOD) protectedGroups.push(object);
  });
  const meshes = [];
  scenery.traverse((m) => {
    if (
      m.isMesh &&
      !m.userData.excludeFromReflectionProbe &&
      !m.userData.layeredLightSource &&
      !m.userData.layeredLightEffect &&
      !protectedGroups.some((g) => g === m || g.getObjectById(m.id))
    )
      meshes.push(m);
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
      if (
        child.isGroup &&
        !protectedGroups.includes(child) &&
        !child.userData.environmentSource &&
        !child.userData.layeredLightSource
      ) {
        prune(child);
        if (child.children.length === 0) group.remove(child);
      }
    }
  };
  prune(scenery);
}
