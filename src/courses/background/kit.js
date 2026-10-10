import { createRouteClearance } from "../../rendering/route-clearance.js";

/** Distant compositions share geometry and reserve their complete motion envelope. */
export function backgroundKit(w) {
  const { THREE, track } = w;
  const allows = createRouteClearance(track);
  const geometries = new Map();
  const sites = [];
  const material = (color, kind = null, extra = {}) => {
    const m = w.mat(color, kind, { name: "Background scenery", roughness: 0.95, ...extra });
    // Coarse, shadowless distant shapes need fewer spatial draws than nearby
    // storefronts and foliage. Their cell size does not affect those worlds.
    m.userData.sceneryCellSize = 384;
    return m;
  };
  function geometry(kind) {
    if (!geometries.has(kind)) {
      const shapes = {
        sphere: () => new THREE.SphereGeometry(1, 12, 8),
        cylinder: () => new THREE.CylinderGeometry(1, 1, 1, 10),
        cone: () => new THREE.ConeGeometry(1, 1, 10),
        ring: () => new THREE.TorusGeometry(1, 0.08, 5, 16),
        roof: () => {
          const g = new THREE.BufferGeometry();
          g.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(
              [-0.5, 0, -0.5, 0.5, 0, -0.5, 0, 1, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 1, 0.5],
              3,
            ),
          );
          g.setIndex([0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 2, 5, 4, 2, 4, 1, 0, 1, 4, 0, 4, 3]);
          g.computeVertexNormals();
          return g;
        },
        ridge: () => {
          const g = new THREE.PlaneGeometry(1, 1, 16, 10);
          g.rotateX(-Math.PI / 2);
          const p = g.attributes.position;
          for (let i = 0; i < p.count; i++) {
            const x = p.getX(i),
              z = p.getZ(i);
            const spine = Math.sin(x * 9) * 0.08;
            const cross = Math.max(0, 1 - Math.abs(z - spine) / 0.42);
            const taper = Math.pow(Math.max(0, 1 - Math.abs(x) * 2), 0.4);
            p.setY(
              i,
              cross * taper * (0.55 + Math.sin(x * 17 + 1) * 0.2 + Math.cos(x * 31) * 0.12),
            );
          }
          g.computeVertexNormals();
          return g;
        },
      };
      geometries.set(kind, shapes[kind]());
    }
    return geometries.get(kind);
  }
  function mesh(kind, mat, parent, position, scale) {
    const object = w.mesh(geometry(kind), mat, parent, position, scale);
    object.castShadow = false;
    return object;
  }
  function box(mat, parent, position, scale) {
    const object = w.box(mat, parent, position, scale);
    object.castShadow = false;
    return object;
  }
  function group(parent, position = [0, 0, 0]) {
    const object = new THREE.Group();
    parent.add(object);
    object.position.set(...position);
    return object;
  }
  function tube(parent, a, b, radius, mat) {
    const object = w.tube(parent, a, b, radius, mat);
    object.castShadow = false;
    return object;
  }
  function surfaceY(terrain, x, z) {
    terrain.updateWorldMatrix(true, false);
    const parent = terrain.parent;
    const ray = new THREE.Raycaster(
      parent.localToWorld(new THREE.Vector3(x, 1000, z)),
      new THREE.Vector3(0, -1, 0),
    );
    const hit = ray.intersectObject(terrain, false)[0];
    if (!hit) throw new Error("Background prop has no supporting terrain");
    return parent.worldToLocal(hit.point).y;
  }
  function place(
    section,
    fraction,
    side,
    label,
    build,
    { distance = 180, floor, padding = 3 } = {},
  ) {
    const root = w.at(section, fraction, side * distance);
    root.name = label;
    root.rotation.set(0, track.yawFor(track.frameAt(track.sectorT(section, fraction)).tangent), 0);
    root.position.y = floor ?? track.course.theme.groundHeight ?? -1.7;
    build(root);
    const direction = track
      .frameAt(track.sectorT(section, fraction))
      .right.clone()
      .setY(0)
      .normalize();
    const identity = new THREE.Group();
    for (let attempt = 0; attempt < 40; attempt++) {
      root.updateWorldMatrix(true, true);
      const bounds = new THREE.Box3().setFromObject(root).expandByScalar(padding);
      if (
        allows(
          identity,
          bounds.getCenter(new THREE.Vector3()).toArray(),
          bounds.getSize(new THREE.Vector3()).toArray(),
        )
      ) {
        root.userData.scenicAssembly = true;
        sites.push({ section, fraction, side, label, bounds, root });
        return root;
      }
      root.position.addScaledVector(direction, side * 22);
    }
    throw new Error(`${track.course.id}: no clear background site for ${label}`);
  }
  // Static children of moving groups are instanced locally before world batching.
  function motion(object, update) {
    object.updateWorldMatrix(true, true);
    const inverse = object.matrixWorld.clone().invert();
    const meshes = [];
    object.traverse((child) => {
      if (child.isMesh) meshes.push(child);
    });
    for (const child of meshes) {
      const local = inverse.clone().multiply(child.matrixWorld);
      object.add(child);
      local.decompose(child.position, child.quaternion, child.scale);
      child.updateMatrix();
    }
    // Align local batching cells to this assembly, rather than splitting a
    // small flock or fleet across four cells at its local origin.
    const combined = group(object);
    const origin = new THREE.Vector3(Infinity, Infinity, Infinity);
    for (const child of meshes) {
      child.geometry.computeBoundingBox();
      origin.min(
        child.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(child.matrix),
      );
    }
    combined.position.copy(origin).subScalar(0.01);
    for (const child of meshes) {
      child.position.sub(combined.position);
      combined.add(child);
    }
    w.kit.batch(combined);
    return w.motion(object, update);
  }
  return { ...w, mat: material, mesh, box, group, tube, surfaceY, place, motion, sites };
}
