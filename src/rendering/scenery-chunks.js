import * as THREE from "../../vendor/three/three.module.js";
import { invalidateLayeredReceivers } from "./layered-lighting.js";

function attributeLayout(geometry) {
  return Object.entries(geometry.attributes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([name, a]) =>
        `${name}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}:${a.gpuType}`,
    )
    .join("|");
}

function eligible(object) {
  const material = object.material;
  const geometry = object.geometry;
  if (
    !object.isMesh ||
    object.isInstancedMesh ||
    object.isBatchedMesh ||
    object.isSkinnedMesh ||
    !object.userData.staticScenery ||
    object.children.length ||
    object.matrixAutoUpdate ||
    !object.visible ||
    !object.frustumCulled ||
    object.customDepthMaterial ||
    object.customDistanceMaterial ||
    object.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender ||
    object.onAfterRender !== THREE.Object3D.prototype.onAfterRender ||
    Array.isArray(material) ||
    !material?.isMeshStandardMaterial ||
    material.transparent ||
    material.transmission > 0 ||
    material.displacementMap ||
    !material.depthWrite ||
    material.userData["foliage-wind-v2"] ||
    material.userData.waterUniforms ||
    object.userData.isWater ||
    object.userData.waterSurface ||
    /sky|water|ocean|sea|glow|light|effect|particle|kart|vehicle|racer|sprite/i.test(
      `${object.name} ${material.name}`,
    ) ||
    Object.keys(geometry.morphAttributes).length ||
    Object.values(geometry.attributes).some(
      (a) =>
        a.isInstancedBufferAttribute || a.isFloat16BufferAttribute || a.gpuType === THREE.IntType,
    ) ||
    geometry.drawRange.start !== 0 ||
    geometry.drawRange.count !== Infinity
  )
    return false;
  const count = geometry.index?.count ?? geometry.attributes.position.count;
  return (
    geometry.groups.length === 0 ||
    (geometry.groups.length === 1 &&
      geometry.groups[0].start === 0 &&
      geometry.groups[0].count === count &&
      geometry.groups[0].materialIndex === 0)
  );
}

function batchableTransform(matrix) {
  if (matrix.determinant() <= 0) return false;
  // Three's batched normal transform supports rotation and scale, not shear.
  const axes = [0, 1, 2].map((i) => new THREE.Vector3().setFromMatrixColumn(matrix, i));
  return axes.every((a, i) =>
    axes.every((b, j) => i === j || Math.abs(a.dot(b)) <= 1e-6 * a.length() * b.length()),
  );
}

/** Compile authored static meshes into spatial multi-draw batches, after lighting is installed.
 * Individual geometry bounds and transforms survive: main, shadow and reflection cameras
 * each cull and sort their own visible members. No geometry simplification or material rewrite.
 */
export function createSceneryChunks(
  scene,
  animated = [],
  { cellSize = 384, maxVertices = 200000, supported = true } = {},
) {
  if (
    !Number.isFinite(cellSize) ||
    !Number.isFinite(maxVertices) ||
    !(cellSize > 0) ||
    !(maxVertices > 0)
  )
    throw new Error("Invalid scenery chunk limits");
  if (!supported)
    return {
      stats: { sourceMeshes: 0, chunks: 0, fewerRenderObjects: 0, vertices: 0 },
      enabled: false,
      setEnabled() {},
      dispose() {},
    };
  const moving = new Set(animated);
  scene.updateMatrixWorld(true);
  const buckets = new Map();
  const center = new THREE.Vector3();
  scene.traverse((object) => {
    if (!eligible(object)) return;
    let owner = scene;
    // Keep LOD membership and every dynamic/visibility-controlled subtree intact.
    for (let parent = object; parent && parent !== scene; parent = parent.parent) {
      if (
        moving.has(parent) ||
        !parent.visible ||
        parent.userData.dynamicScenery ||
        parent.userData.skipBake ||
        parent.userData.excludeFromReflectionProbe ||
        parent.userData.layeredLightSource ||
        parent.userData.layeredLightEffect ||
        (parent !== object && parent.renderOrder !== 0)
      )
        return;
      if (parent.parent?.isLOD && owner === scene) owner = parent;
    }
    // Multi-draw shares face winding; mirrored meshes need their own draw.
    if (!batchableTransform(object.matrixWorld)) return;
    object.geometry.computeBoundingBox();
    object.geometry.boundingBox.getCenter(center).applyMatrix4(object.matrixWorld);
    const key = [
      owner.id,
      object.material.id,
      object.layers.mask,
      object.renderOrder,
      object.castShadow,
      object.receiveShadow,
      attributeLayout(object.geometry),
      !!object.geometry.index,
      Math.floor(center.x / cellSize),
      Math.floor(center.y / cellSize),
      Math.floor(center.z / cellSize),
    ].join(":");
    if (!buckets.has(key)) buckets.set(key, { owner, members: [] });
    buckets.get(key).members.push(object);
  });
  const chunks = [];
  const sources = [];
  let vertexCount = 0;
  function compile(owner, members) {
    if (members.length < 2) return;
    const first = members[0];
    const geometries = [...new Set(members.map((m) => m.geometry))];
    const vertices = geometries.reduce((sum, g) => sum + g.attributes.position.count, 0);
    const indices = geometries.reduce((sum, g) => sum + (g.index?.count ?? 0), 0);
    const chunk = new THREE.BatchedMesh(members.length, vertices, indices, first.material);
    chunk.name = "Compiled static scenery chunk";
    chunk.castShadow = first.castShadow;
    chunk.receiveShadow = first.receiveShadow;
    chunk.layers.mask = first.layers.mask;
    chunk.renderOrder = first.renderOrder;
    chunk.userData.staticScenery = true;
    chunk.userData.sceneryChunk = true;
    chunk.matrixAutoUpdate = false;
    const frame = new THREE.Matrix4().makeTranslation(
      new THREE.Vector3().setFromMatrixPosition(first.matrixWorld),
    );
    chunk.matrix.multiplyMatrices(owner.matrixWorld.clone().invert(), frame);
    const inverse = frame.clone().invert();
    const ids = new Map(geometries.map((g) => [g, chunk.addGeometry(g)]));
    for (const member of members) {
      const instance = chunk.addInstance(ids.get(member.geometry));
      chunk.setMatrixAt(
        instance,
        new THREE.Matrix4().multiplyMatrices(inverse, member.matrixWorld),
      );
      sources.push({
        object: member,
        parent: member.parent,
        index: member.parent.children.indexOf(member),
      });
    }
    chunk.computeBoundingBox();
    chunk.computeBoundingSphere();
    chunks.push({ object: chunk, owner });
    vertexCount += vertices;
  }
  for (const { owner, members } of buckets.values()) {
    let part = [],
      vertices = 0;
    for (const member of members) {
      const count = member.geometry.attributes.position.count;
      if (vertices + count > maxVertices) {
        compile(owner, part);
        part = [];
        vertices = 0;
      }
      part.push(member);
      vertices += count;
    }
    compile(owner, part);
  }
  let enabled = false;
  let disposed = false;
  const stats = {
    sourceMeshes: sources.length,
    chunks: chunks.length,
    fewerRenderObjects: sources.length - chunks.length,
    vertices: vertexCount,
  };
  function setEnabled(value) {
    if (disposed || enabled === value) return;
    enabled = value;
    if (enabled) {
      for (const source of sources) source.object.removeFromParent();
      for (const chunk of chunks) chunk.owner.add(chunk.object);
    } else {
      for (const chunk of chunks) chunk.object.removeFromParent();
      for (const source of [...sources].sort((a, b) => a.index - b.index)) {
        source.parent.add(source.object);
        source.parent.children.splice(source.parent.children.indexOf(source.object), 1);
        source.parent.children.splice(source.index, 0, source.object);
      }
    }
    scene.updateMatrixWorld(true);
    invalidateLayeredReceivers(scene);
  }
  setEnabled(true);
  return {
    stats,
    setEnabled,
    get enabled() {
      return enabled;
    },
    dispose() {
      setEnabled(false);
      disposed = true;
      for (const chunk of chunks) chunk.object.dispose();
    },
  };
}
