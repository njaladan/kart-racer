import * as THREE from "../../vendor/three/three.module.js";
import { createRouteClearance } from "./route-clearance.js";
import { sceneryGroundHeight } from "./terrain-height.js";

const reservations = new WeakMap();
export function reserveSceneryForTrack(root, track) {
  reservations.set(root, { track, allows: createRouteClearance(track) });
}

/** Move whole scenery assemblies before batching, preserving their supporting geometry.
 * Bounds narrow the search; triangle/box tests keep open arches and canopies intact.
 */
export function clearSceneryFootprints(root, animated = []) {
  const reservation = reservations.get(root);
  if (!reservation) return;
  const { track, allows } = reservation;
  root.updateWorldMatrix(true, true);
  const groups = [],
    passages = [];
  root.traverse((o) => {
    if (o.userData.scenicAssembly === false) passages.push(o);
  });
  function collect(group) {
    if (group.userData.scenicAssembly) {
      groups.push(group);
      return;
    }
    for (const child of group.children) if (child.isGroup) collect(child);
  }
  collect(root);
  let scene = root;
  while (scene.parent) scene = scene.parent;
  const counters = (scene.userData.sceneryClearance ||= { checked: 0, moved: 0, omitted: 0 });
  for (const group of groups) {
    if (animated.includes(group) || group.userData.skipBake) continue;
    counters.checked++;
    const bounds = new THREE.Box3().setFromObject(group),
      size = bounds.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.x) || size.lengthSq() === 0) continue;
    const worldCenter = bounds.getCenter(new THREE.Vector3());
    // A world-space box is conservative across all road elevations.
    const identity = new THREE.Group();
    if (allows(identity, worldCenter.toArray(), size.toArray())) continue;
    const meshes = [];
    group.traverse((o) => {
      if (
        o.isMesh &&
        !o.material?.isShaderMaterial &&
        !o.userData.bakeReceiver &&
        !o.userData.skipBake
      ) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        if (!mats.every((m) => m.transparent && m.opacity < 0.5)) meshes.push(o);
      }
    });
    const blocks = meshes.some((m) => intersectsCorridor(m, allows.corridor));
    if (!blocks) continue;
    const original = group.getWorldPosition(new THREE.Vector3());
    const near = track.projectTrack(original, 0, true),
      direction = near.frame.right
        .clone()
        .setY(0)
        .normalize()
        .multiplyScalar(near.offset < 0 ? -1 : 1);
    let fitted = false;
    for (let step = 1; step <= 40; step++) {
      const next = original.clone().addScaledVector(direction, step * 6);
      if (group.userData.groundPlanted)
        next.y = sceneryGroundHeight(track.projectTrack(next, 0, true));
      group.position.copy(group.parent.worldToLocal(next));
      group.updateWorldMatrix(true, true);
      const candidate = new THREE.Box3().setFromObject(group);
      if (
        !allows(
          identity,
          candidate.getCenter(new THREE.Vector3()).toArray(),
          candidate.getSize(new THREE.Vector3()).toArray(),
        )
      )
        continue;
      const delta = group.getWorldPosition(new THREE.Vector3()).sub(original);
      for (const pool of scene.userData.localLightPools || [])
        if (bounds.containsPoint(pool.position)) pool.position.add(delta);
      fitted = true;
      counters.moved++;
      break;
    }
    if (!fitted) {
      group.removeFromParent();
      counters.omitted++;
    }
  }
  // Centered galleries retain their placement. Remove only an incidental solid
  // piece that penetrates the reserved view; physics surfaces/hazards are explicit.
  for (const passage of passages) {
    const meshes = [];
    function visit(o, dynamic = false) {
      dynamic ||= animated.includes(o) || !!o.userData.skipBake;
      if (o.isLOD) {
        visit(o.levels[0].object, dynamic);
        return;
      }
      if (
        o.isMesh &&
        !o.material?.isShaderMaterial &&
        !dynamic &&
        !o.userData.bakeReceiver &&
        !o.userData.routeStructure &&
        !o.userData.routeObstacle
      ) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        if (!mats.every((m) => m.transparent && m.opacity < 0.5)) meshes.push(o);
      }
      for (const child of o.children) visit(child, dynamic);
    }
    visit(passage);
    for (const mesh of meshes) {
      mesh.geometry.computeBoundingBox();
      const geometry = mesh.geometry,
        parts = mesh.userData.sceneryParts;
      const removed = new Set();
      const copies = mesh.isInstancedMesh ? mesh.count : 1;
      for (let copy = 0; copy < copies; copy++) {
        const proxy = new THREE.Mesh(geometry, mesh.material);
        proxy.matrixWorld.copy(mesh.matrixWorld);
        if (mesh.isInstancedMesh) {
          const matrix = new THREE.Matrix4();
          mesh.getMatrixAt(copy, matrix);
          proxy.matrixWorld.multiply(matrix);
        }
        const bounds = geometry.boundingBox.clone().applyMatrix4(proxy.matrixWorld);
        const cells = allows.corridor.filter((cell) => cell.intersectsBox(bounds));
        const triangle = new THREE.Triangle(),
          positions = geometry.attributes.position,
          index = geometry.index;
        const total = index?.count ?? positions.count;
        for (let k = 0; k < total; k += 3) {
          const part = mesh.isInstancedMesh
            ? copy
            : parts
              ? parts.findIndex((part) => k >= part.start && k < part.start + part.count)
              : 0;
          if (removed.has(part)) continue;
          for (const [vertex, offset] of [
            [triangle.a, 0],
            [triangle.b, 1],
            [triangle.c, 2],
          ])
            vertex
              .fromBufferAttribute(positions, index ? index.getX(k + offset) : k + offset)
              .applyMatrix4(proxy.matrixWorld);
          if (cells.some((cell) => cell.intersectsTriangle(triangle))) removed.add(part);
        }
      }
      if (!removed.size) continue;
      if (mesh.isInstancedMesh) {
        let kept = 0;
        const matrix = new THREE.Matrix4();
        for (let i = 0; i < mesh.count; i++)
          if (!removed.has(i)) {
            mesh.getMatrixAt(i, matrix);
            mesh.setMatrixAt(kept++, matrix);
          }
        if (!kept) {
          mesh.removeFromParent();
          counters.omitted += removed.size;
          continue;
        }
        mesh.count = kept;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
      } else if (parts) {
        const indices = [];
        for (let i = 0; i < parts.length; i++)
          if (!removed.has(i))
            for (let j = parts[i].start; j < parts[i].start + parts[i].count; j++)
              indices.push(geometry.index.getX(j));
        mesh.geometry = geometry.clone();
        mesh.geometry.setIndex(indices);
        delete mesh.userData.sceneryParts;
        if (!indices.length) mesh.removeFromParent();
      } else mesh.removeFromParent();
      counters.omitted += removed.size;
    }
  }
}

/** Continuous triangle tests catch thin poles between sampled driving lanes. */
function intersectsCorridor(mesh, corridor) {
  const geometry = mesh.geometry;
  geometry.computeBoundingBox();
  const triangle = new THREE.Triangle(),
    matrix = new THREE.Matrix4();
  const positions = geometry.attributes.position,
    index = geometry.index;
  for (let copy = 0; copy < (mesh.isInstancedMesh ? mesh.count : 1); copy++) {
    matrix.copy(mesh.matrixWorld);
    if (mesh.isInstancedMesh) {
      const instance = new THREE.Matrix4();
      mesh.getMatrixAt(copy, instance);
      matrix.multiply(instance);
    }
    const bounds = geometry.boundingBox.clone().applyMatrix4(matrix);
    const cells = corridor.filter((cell) => cell.intersectsBox(bounds));
    if (!cells.length) continue;
    for (let k = 0; k < (index?.count ?? positions.count); k += 3) {
      triangle.a.fromBufferAttribute(positions, index ? index.getX(k) : k).applyMatrix4(matrix);
      triangle.b
        .fromBufferAttribute(positions, index ? index.getX(k + 1) : k + 1)
        .applyMatrix4(matrix);
      triangle.c
        .fromBufferAttribute(positions, index ? index.getX(k + 2) : k + 2)
        .applyMatrix4(matrix);
      if (cells.some((cell) => cell.intersectsTriangle(triangle))) return true;
    }
  }
  return false;
}
