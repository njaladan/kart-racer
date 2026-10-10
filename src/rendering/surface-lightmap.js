import * as THREE from "../../vendor/three/three.module.js";

/** Give convex architectural pieces separate lighting charts before regional merging.
 * Base texture UVs stay untouched. Unique charts merge into the existing batches.
 */
export function prepareSurfaceLightmap(scene, animated = [], size = 2048) {
  scene.updateMatrixWorld(true);
  const excluded = new Set(animated);
  const charts = [];
  const normalMatrix = new THREE.Matrix3();
  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const walk = (object, skip = false) => {
    skip ||= excluded.has(object) || !!object.userData.skipBake;
    if (skip) return;
    if (
      object.isMesh &&
      !object.isInstancedMesh &&
      object.material?.userData?.surfaceLightmap &&
      (object.geometry.type === "BoxGeometry" || object.userData.lightmapArchitecture)
    ) {
      const geometry = object.geometry.index
        ? object.geometry.toNonIndexed()
        : object.geometry.clone();
      const positions = geometry.attributes.position;
      const normals = geometry.attributes.normal;
      const coordinates = new Float32Array(positions.count * 3);
      geometry.setAttribute("surfaceLightUv", new THREE.BufferAttribute(coordinates, 3));
      normalMatrix.getNormalMatrix(object.matrixWorld);
      const faces = Array.from({ length: 6 }, () => []);
      for (let i = 0; i < positions.count; i += 3) {
        normal.set(0, 0, 0);
        for (let j = 0; j < 3; j++) normal.add(point.fromBufferAttribute(normals, i + j));
        normal.applyMatrix3(normalMatrix).normalize();
        const axis = [Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)];
        const dominant = axis.indexOf(Math.max(...axis));
        faces[dominant * 2 + (normal.getComponent(dominant) < 0 ? 1 : 0)].push(i);
      }
      faces.forEach((triangles, face) => {
        if (!triangles.length) return;
        const axes = [
          [2, 1],
          [0, 2],
          [0, 1],
        ][Math.floor(face / 2)];
        const samples = [];
        let minU = Infinity,
          minV = Infinity,
          maxU = -Infinity,
          maxV = -Infinity;
        for (const triangle of triangles)
          for (let j = 0; j < 3; j++) {
            point.fromBufferAttribute(positions, triangle + j).applyMatrix4(object.matrixWorld);
            const u = point.getComponent(axes[0]),
              v = point.getComponent(axes[1]);
            minU = Math.min(minU, u);
            maxU = Math.max(maxU, u);
            minV = Math.min(minV, v);
            maxV = Math.max(maxV, v);
            samples.push([triangle + j, u, v]);
          }
        charts.push({ coordinates, samples, minU, minV, spanU: maxU - minU, spanV: maxV - minV });
      });
      object.geometry = geometry;
    }
    object.children.forEach((child) => walk(child, skip));
  };
  walk(scene);
  const padding = 4;
  let density = 4;
  let packed = false;
  for (let attempt = 0; attempt < 16 && !packed; attempt++, density *= 0.9) {
    charts.forEach((chart) => {
      chart.width = Math.max(8, Math.ceil(chart.spanU * density)) + padding * 2;
      chart.height = Math.max(8, Math.ceil(chart.spanV * density)) + padding * 2;
    });
    charts.sort((a, b) => b.height - a.height || b.width - a.width);
    let x = 0,
      y = 0,
      rowHeight = 0;
    packed = true;
    for (const chart of charts) {
      if (x + chart.width > size) {
        x = 0;
        y += rowHeight;
        rowHeight = 0;
      }
      if (chart.width > size || y + chart.height > size) {
        packed = false;
        break;
      }
      chart.x = x;
      chart.y = y;
      x += chart.width;
      rowHeight = Math.max(rowHeight, chart.height);
    }
    if (packed) {
      for (const chart of charts)
        for (const [vertex, u, v] of chart.samples) {
          chart.coordinates[vertex * 3] =
            (chart.x +
              padding +
              ((u - chart.minU) / Math.max(0.001, chart.spanU)) * (chart.width - padding * 2)) /
            size;
          chart.coordinates[vertex * 3 + 1] =
            (chart.y +
              padding +
              ((v - chart.minV) / Math.max(0.001, chart.spanV)) * (chart.height - padding * 2)) /
            size;
          chart.coordinates[vertex * 3 + 2] = 1;
        }
      scene.userData.surfaceLightmap = {
        resolution: size,
        charts: charts.length,
        texelsPerMetre: density,
        padding,
      };
    }
  }
  if (!packed) throw new Error("Sunstone architecture lightmap does not fit its atlas");
  return scene.userData.surfaceLightmap;
}
