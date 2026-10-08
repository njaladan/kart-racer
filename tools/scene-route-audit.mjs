import * as THREE from "../vendor/three/three.module.js";

/** Raycast actual triangles at driver/head height on main and alternate roads. */
export function auditRouteGeometry(scene, track, animated = [], lap = 0) {
  scene.updateMatrixWorld(true);
  const entries = [], matrix = new THREE.Matrix4();
  function visit(o, dynamic = false) {
    dynamic ||= animated.includes(o) || !!o.userData.skipBake;
    if (o.visible === false) return;
    if (["Flowing Fresnel water with shoreline foam", "Pelagic water surface"].includes(o.name)) return;
    if (o.userData.pathwayEdge) return;
    if (o.isLOD) { visit(o.levels[0].object, dynamic); return; }
    if (o.isMesh && !dynamic && !o.userData.bakeReceiver && !o.userData.routeObstacle && !o.userData.routeStructure) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (!mats.every(m => m.isShaderMaterial || m.name === "Flowing Fresnel water with shoreline foam" || (m.transparent && m.opacity < .5))) {
        o.geometry.computeBoundingBox();
        for (let i = 0; i < (o.isInstancedMesh ? o.count : 1); i++) {
          matrix.copy(o.matrixWorld);
          if (o.isInstancedMesh) { const instance = new THREE.Matrix4(); o.getMatrixAt(i, instance); matrix.multiply(instance); }
          const proxy = new THREE.Mesh(o.geometry, o.material);
          proxy.matrixWorld.copy(matrix);
          const bounds = o.geometry.boundingBox.clone().applyMatrix4(matrix);
          entries.push({proxy, bounds, label: o.geometry.type + "/" + mats.map(m=>m.type).join(",") + "/" + (o.name || "unnamed") + ":" + mats.map(m => m.name || m.color?.getHexString() || m.type).join("/")});
        }
      }
    }
    for (const child of o.children) visit(child, dynamic);
  }
  visit(scene);
  const rays = new THREE.Raycaster(), hits = [];
  const stations = [];
  const count = Math.ceil(track.COURSE_LENGTH / 3);
  for (let i = 0; i < count; i++) {
    const t = i / count;
    if (track.branches.some(b => b.required && t > b.start && t < b.end)) continue;
    const left = track.platformEdgeAt(t, -1), right = track.platformEdgeAt(t, 1);
    for (const offset of [left + 1.5, left / 2, 0, right / 2, right - 1.5])
      stations.push({p: track.poseAt(t * track.TRACK, offset, .5).p, route: "main", fraction: t, offset});
  }
  for (const area of track.areaSurfaces) {
    for (let i = 0; i < 96; i++) for (const ratio of [0.18, 0.3, 0.5, 0.7, 0.84, 0.94, 0.98])
      stations.push({p: area.pointAt(i / 96 * Math.PI * 2, area.radius * ratio, .5), route: area.id, fraction: i / 96, offset: area.radius * ratio});
  }
  for (const branch of track.branches) {
    if (branch.areaSurface) continue;
    if (branch.lap != null && branch.lap !== lap) continue;
    const count = Math.ceil(branch.length / 3);
    for (let i = 0; i <= count; i++) for (const offset of [-branch.halfWidth + 1.5, 0, branch.halfWidth - 1.5])
      stations.push({p: branch.poseAt(i / count, offset, .5).p, route: branch.id, fraction: i/count, offset});
  }
  for (const station of stations) {
    rays.set(station.p, new THREE.Vector3(0, 1, 0)); rays.near = 0; rays.far = 6.5;
    for (const entry of entries) {
      if (entry.bounds.max.y < station.p.y || entry.bounds.min.y > station.p.y + 6.5 || station.p.x < entry.bounds.min.x || station.p.x > entry.bounds.max.x || station.p.z < entry.bounds.min.z || station.p.z > entry.bounds.max.z) continue;
      const intersections = rays.intersectObject(entry.proxy, false);
      if (intersections.length) hits.push({route: station.route, fraction: +station.fraction.toFixed(4), offset: +station.offset.toFixed(1), mesh: entry.label, height: +intersections[0].distance.toFixed(2), point: intersections[0].point.toArray().map(n=>+n.toFixed(1))});
    }
  }
  return {course: track.course.id, stations: stations.length, meshes: entries.length, hits};
}
