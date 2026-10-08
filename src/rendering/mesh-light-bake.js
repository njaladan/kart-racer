import * as THREE from "../../vendor/three/three.module.js";

const ZERO_RGBA = new Uint8Array([0, 0, 0, 0]);

function hashBytes(chunks) {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (const chunk of chunks) {
    const bytes = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
    for (const byte of bytes) {
      first = Math.imul(first ^ byte, 0x01000193);
      second = Math.imul(second ^ byte, 0x85ebca6b);
      second ^= second >>> 13;
    }
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

function typedBytes(attribute) {
  const array = attribute?.array || attribute?.data?.array;
  if (!array) return new Uint8Array();
  return new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
}

function geometrySignature(geometry, cache) {
  if (cache.has(geometry)) return cache.get(geometry);
  const attributes = ["position", "normal"]
    .filter((name) => geometry.attributes[name])
    .map((name) => [name, geometry.attributes[name]]);
  const chunks = [
    geometry.type || "BufferGeometry",
    String(geometry.index?.count ?? -1),
    JSON.stringify(geometry.groups),
    JSON.stringify(geometry.drawRange),
  ];
  for (const [name, attribute] of attributes) {
    chunks.push(name, String(attribute.itemSize), typedBytes(attribute));
  }
  if (geometry.index) chunks.push(typedBytes(geometry.index));
  const signature = hashBytes(chunks);
  cache.set(geometry, signature);
  return signature;
}

function objectSignature(object, cache) {
  const matrices = [];
  for (const value of object.matrixWorld.elements)
    matrices.push(Math.fround(Math.round(value * 1e5) / 1e5));
  if (object.isInstancedMesh) {
    const instance = new THREE.Matrix4();
    for (let index = 0; index < object.count; index++) {
      object.getMatrixAt(index, instance);
      for (const value of instance.elements)
        matrices.push(Math.fround(Math.round(value * 1e5) / 1e5));
    }
  }
  const matrixBytes = new Uint8Array(matrices.length * 4);
  const view = new DataView(matrixBytes.buffer);
  matrices.forEach((value, index) => view.setFloat32(index * 4, value, true));
  return hashBytes([
    geometrySignature(object.geometry, cache),
    String(object.isInstancedMesh ? object.count : 0),
    matrixBytes,
  ]);
}

function isExcluded(object, animated) {
  if (
    object.userData?.skipBake ||
    object.userData?.excludeFromReflectionProbe ||
    object.isSprite ||
    object.isPoints ||
    object.isLine ||
    object.isSkinnedMesh ||
    object.morphTargetInfluences?.length ||
    animated.has(object)
  )
    return true;
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  return materials.some(
    (material) =>
      !material ||
      !material.isMeshStandardMaterial ||
      material.userData?.waterUniforms ||
      material.transmission > 0.01 ||
      (material.transparent && (material.opacity ?? 1) < 0.86),
  );
}

function traverseEligible(scene, world, visit) {
  const animated = new Set(world?.animated || []);
  const geometryHashes = new WeakMap();
  const walk = (object, path, parentExcluded = false) => {
    const excluded =
      parentExcluded ||
      !!object.userData?.skipBake ||
      !!object.userData?.excludeFromReflectionProbe ||
      animated.has(object);
    if (excluded) return;
    if (object.isLOD) {
      const nearest = object.levels?.[0]?.object;
      if (nearest) walk(nearest, `${path}/lod0`);
      return;
    }
    if (
      (object.isMesh || object.isInstancedMesh) &&
      !isExcluded(object, animated) &&
      object.geometry?.attributes?.position
    ) {
      const signature = objectSignature(object, geometryHashes);
      visit(object, path, signature);
    }
    object.children.forEach((child, index) => walk(child, `${path}/${index}`));
  };
  scene.updateMatrixWorld(true);
  scene.children.forEach((child, index) => walk(child, String(index)));
}

function transformNormal(normal, matrix) {
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
  const transformed = normal.clone().applyMatrix3(normalMatrix);
  if (!Number.isFinite(transformed.lengthSq()) || transformed.lengthSq() < 1e-10)
    return new THREE.Vector3(0, 1, 0);
  return transformed.normalize();
}

function finitePoint(point) {
  if (![point.x, point.y, point.z].every(Number.isFinite)) point.set(0, 0, 0);
  return point;
}

function meshSamples(object) {
  const geometry = object.geometry;
  const positions = geometry.attributes.position;
  let normals = geometry.attributes.normal;
  if (!normals) {
    const normalGeometry = geometry.clone();
    normalGeometry.computeVertexNormals();
    normals = normalGeometry.attributes.normal;
  }
  if (object.isInstancedMesh) {
    const instance = new THREE.Matrix4();
    const world = new THREE.Matrix4();
    const samples = new Float32Array(object.count * 6);
    const localPosition = new THREE.Vector3();
    const localNormal = new THREE.Vector3();
    for (let index = 0; index < object.count; index++) {
      object.getMatrixAt(index, instance);
      world.multiplyMatrices(object.matrixWorld, instance);
      let point = null;
      let worldNormal = null;
      let bestNormalY = -Infinity;
      let bestHeight = -Infinity;
      for (let vertex = 0; vertex < positions.count; vertex++) {
        localPosition.fromBufferAttribute(positions, vertex);
        const candidatePoint = finitePoint(localPosition.clone().applyMatrix4(world));
        if (normals) localNormal.fromBufferAttribute(normals, vertex);
        else localNormal.set(0, 1, 0);
        const candidateNormal = transformNormal(localNormal, world);
        if (
          candidateNormal.y > bestNormalY + 1e-5 ||
          (Math.abs(candidateNormal.y - bestNormalY) <= 1e-5 && candidatePoint.y > bestHeight)
        ) {
          point = candidatePoint.clone();
          worldNormal = candidateNormal.clone();
          bestNormalY = candidateNormal.y;
          bestHeight = candidatePoint.y;
        }
      }
      point ||= finitePoint(new THREE.Vector3().setFromMatrixPosition(world));
      worldNormal ||= new THREE.Vector3(0, 1, 0);
      samples.set(
        [point.x, point.y, point.z, worldNormal.x, worldNormal.y, worldNormal.z],
        index * 6,
      );
    }
    return { kind: "instances", samples, count: object.count };
  }

  const normalMatrix = new THREE.Matrix3().getNormalMatrix(object.matrixWorld);
  const samples = new Float32Array(positions.count * 6);
  const tempPosition = new THREE.Vector3();
  const tempNormal = new THREE.Vector3();
  for (let index = 0; index < positions.count; index++) {
    finitePoint(
      tempPosition.fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld),
    );
    if (normals)
      tempNormal.fromBufferAttribute(normals, index).applyMatrix3(normalMatrix).normalize();
    else tempNormal.set(0, 1, 0);
    samples.set(
      [tempPosition.x, tempPosition.y, tempPosition.z, tempNormal.x, tempNormal.y, tempNormal.z],
      index * 6,
    );
  }
  return { kind: "vertices", samples, count: positions.count };
}

/** Collect deterministic per-vertex and per-instance world-space samples for Blender. */
export function collectMeshLightSamples(scene, world) {
  const entries = [];
  const chunks = [];
  let sampleOffset = 0;
  traverseEligible(scene, world, (object, path, signature) => {
    const sample = meshSamples(object);
    entries.push({
      path,
      name: object.name || "",
      signature,
      kind: sample.kind,
      count: sample.count,
      sampleOffset,
    });
    chunks.push(sample.samples);
    sampleOffset += sample.count;
  });
  const samples = new Float32Array(sampleOffset * 6);
  let destination = 0;
  for (const chunk of chunks) {
    samples.set(chunk, destination);
    destination += chunk.length;
  }
  return { entries, samples, samplesCount: sampleOffset };
}

/** Load the optional binary mesh bake. Missing files keep existing ground lighting intact. */
export async function loadMeshLightBake(courseId, base = `./assets/lighting/${courseId}/`) {
  const response = await fetch(`${base}mesh-lighting.json`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Mesh lighting could not load: ${courseId}`);
  const metadata = await response.json();
  const binaryResponse = await fetch(`${base}${metadata.binary?.file || "mesh-lighting.bin"}`);
  if (!binaryResponse.ok) throw new Error(`Mesh lighting data could not load: ${courseId}`);
  const binary = new Uint8Array(await binaryResponse.arrayBuffer());
  if (metadata.binary?.bytes != null && binary.byteLength !== metadata.binary.bytes)
    throw new Error(`Mesh lighting data is truncated: ${courseId}`);
  let integrityVerified = false;
  let integrityDiagnostic = metadata.binary?.sha256
    ? "webcrypto-unavailable"
    : "digest-not-provided";
  if (metadata.binary?.sha256) {
    const subtle = globalThis.crypto?.subtle;
    if (subtle) {
      const digest = new Uint8Array(await subtle.digest("SHA-256", binary));
      const actual = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      if (actual !== metadata.binary.sha256)
        throw new Error(`Mesh lighting binary digest mismatch: ${courseId}`);
      integrityVerified = true;
      integrityDiagnostic = null;
    }
  }
  return { metadata, binary, integrityVerified, integrityDiagnostic };
}

/** Compare the mesh source scene to the ground bake, including late installation. */
export function meshLightBakeSourceDiagnostic(
  scene,
  metadata = scene.userData.meshLightBakeMetadata,
) {
  const expected = metadata?.sourceSceneSha256 || null;
  const actual = scene.userData.courseBake?.sourceSceneSha256 || null;
  return {
    sourceMismatch: !!(expected && actual && expected !== actual),
    expected,
    actual,
  };
}

/** Attach baked RGBA attributes, with identity-safe neutral values for unmatched meshes. */
export function installMeshLightAttributes(scene, bake, world = {}) {
  if (!bake) return { eligible: 0, matched: 0, missing: 0, coverage: 0, mismatches: [] };
  const { metadata, binary } = bake;
  const entries = new Map();
  for (const [index, entry] of (metadata.entries || []).entries()) {
    const queue = entries.get(entry.signature) || [];
    queue.push({ ...entry, metadataIndex: index });
    entries.set(entry.signature, queue);
  }
  const claimed = new Set();
  const mismatches = [];
  let eligible = 0;
  let matched = 0;
  const geometryUsers = new WeakMap();
  const eligibleObjects = new WeakSet();
  traverseEligible(scene, world, (object, path, signature) => {
    eligible++;
    eligibleObjects.add(object);
    const entry = entries.get(signature)?.shift();
    let geometry = object.geometry;
    const previous = geometryUsers.get(geometry);
    if (previous && previous !== signature) {
      geometry = geometry.clone();
      object.geometry = geometry;
    }
    geometryUsers.set(geometry, signature);
    const attributeName = object.isInstancedMesh ? "instanceLightBake" : "lightBake";
    const itemCount = object.isInstancedMesh ? object.count : geometry.attributes.position.count;
    const defaultData = new Uint8Array(itemCount * 4);
    for (let index = 0; index < itemCount; index++) defaultData.set(ZERO_RGBA, index * 4);
    let data = defaultData;
    if (
      entry &&
      entry.kind === (object.isInstancedMesh ? "instances" : "vertices") &&
      entry.count === itemCount
    ) {
      const start = entry.byteOffset;
      const end = start + entry.byteLength;
      if (start >= 0 && end <= binary.byteLength && entry.byteLength === itemCount * 4) {
        data = binary.slice(start, end);
        matched++;
        claimed.add(entry.metadataIndex);
      } else {
        mismatches.push({ path, reason: "binary-range", signature });
      }
    } else {
      mismatches.push({ path, reason: entry ? "count-or-kind" : "signature", signature });
    }
    const attribute = object.isInstancedMesh
      ? new THREE.InstancedBufferAttribute(data, 4, true)
      : new THREE.Uint8BufferAttribute(data, 4, true);
    attribute.normalized = true;
    geometry.setAttribute(attributeName, attribute);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      material.userData.meshLightBake = true;
      material.needsUpdate = true;
    }
  });
  // A material can be shared with animated or transparent meshes which were
  // intentionally excluded above. Give those uses neutral attributes too.
  scene.traverse((object) => {
    if (!(object.isMesh || object.isInstancedMesh) || !object.geometry?.attributes?.position)
      return;
    if (eligibleObjects.has(object)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (!materials.some((material) => material?.userData?.meshLightBake)) return;
    const attributeName = object.isInstancedMesh ? "instanceLightBake" : "lightBake";
    if (object.geometry.hasAttribute(attributeName)) object.geometry = object.geometry.clone();
    const count = object.isInstancedMesh ? object.count : object.geometry.attributes.position.count;
    const data = new Uint8Array(count * 4);
    for (let index = 0; index < count; index++) data.set(ZERO_RGBA, index * 4);
    const attribute = object.isInstancedMesh
      ? new THREE.InstancedBufferAttribute(data, 4, true)
      : new THREE.Uint8BufferAttribute(data, 4, true);
    attribute.normalized = true;
    object.geometry.setAttribute(attributeName, attribute);
  });
  const metadataSceneHash = metadata.sourceSceneSha256;
  scene.userData.meshLightBakeMetadata = metadata;
  const report = {
    eligible,
    matched,
    missing: eligible - matched,
    coverage: eligible ? matched / eligible : 1,
    mismatches,
    unmatchedEntries: (metadata.entries || [])
      .map((entry, index) => ({ index, path: entry.path, signature: entry.signature }))
      .filter((entry) => !claimed.has(entry.index)),
    sourceSceneSha256: metadataSceneHash || null,
  };
  Object.defineProperties(report, {
    sourceMismatch: {
      enumerable: true,
      get: () => meshLightBakeSourceDiagnostic(scene, metadata).sourceMismatch,
    },
    sourceDiagnostic: {
      enumerable: true,
      get: () => meshLightBakeSourceDiagnostic(scene, metadata),
    },
  });
  return report;
}
