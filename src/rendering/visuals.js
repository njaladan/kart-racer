import * as THREE from "../../vendor/three/three.module.js";

export function bevelBox(width, height, depth, radius = 0.12) {
  const r = Math.min(radius, width / 3, height / 3, depth / 3),
    x = -width / 2 + r,
    y = -height / 2 + r;
  const shape = new THREE.Shape();
  shape.moveTo(x, y);
  shape.lineTo(x + width - 2 * r, y);
  shape.lineTo(x + width - 2 * r, y + height - 2 * r);
  shape.lineTo(x, y + height - 2 * r);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * r,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: r,
    bevelThickness: r,
    curveSegments: 4,
  });
  geometry.translate(0, 0, -depth / 2 + r);
  geometry.computeVertexNormals();
  return geometry;
}
export function contactShadow() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d"),
    gradient = ctx.createRadialGradient(32, 32, 4, 32, 32, 31);
  gradient.addColorStop(0, "rgba(0,16,30,.7)");
  gradient.addColorStop(0.5, "rgba(0,16,30,.42)");
  gradient.addColorStop(1, "rgba(0,16,30,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}
export function batchStaticMeshes(parent, excluded = []) {
  const batches = new Map();
  for (const child of [...parent.children]) {
    // Singletons and instances bypass the merger's white-color fallback.
    // Material overrides on imported scenery can enable vertex colors after
    // placement, so initialize their geometry before choosing a batching path.
    if (child.isMesh) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      if (
        materials.some((material) => material.vertexColors) &&
        !child.geometry.getAttribute("color")
      ) {
        const colors = new Float32Array(child.geometry.attributes.position.count * 3).fill(1);
        child.geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      }
    }
    if (!child.isMesh || child.isInstancedMesh || excluded.includes(child)) continue;
    child.updateMatrix();
    child.geometry.computeBoundingBox();
    const center = child.geometry.boundingBox
      .getCenter(new THREE.Vector3())
      .applyMatrix4(child.matrix);
    // Small regions keep far-away geometry out of both the camera and sun pass.
    const channels = Object.entries(child.geometry.attributes)
      .filter(([name]) => name !== "color")
      .map(([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.normalized}`)
      .sort()
      .join(",");
    const materialKey = Array.isArray(child.material)
      ? child.material.map((material) => material.id).join("+")
      : child.material.id;
    const cellSize = child.material.userData?.sceneryCellSize ?? 96;
    const key = `${materialKey}:${Math.floor(center.x / cellSize)}:${Math.floor(center.z / cellSize)}:${channels}:${child.castShadow}:${child.receiveShadow}:${!!child.userData.routeObstacle}:${!!child.userData.routeStructure}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(child);
  }
  for (const meshes of batches.values()) {
    if (meshes.length < 2) continue;
    const material = meshes[0].material;
    const repeated = new Map();
    for (const mesh of meshes) {
      if (!repeated.has(mesh.geometry)) repeated.set(mesh.geometry, []);
      repeated.get(mesh.geometry).push(mesh);
    }
    const remaining = [];
    for (const [geometry, instances] of repeated) {
      if (
        instances.length < 3 ||
        (Array.isArray(material)
          ? material.some((entry) => entry.transparent)
          : material.transparent)
      ) {
        remaining.push(...instances);
        continue;
      }
      const instanced = new THREE.InstancedMesh(geometry, material, instances.length);
      instanced.name = "Regional imported scenery instances";
      instances.forEach((mesh, i) => {
        instanced.setMatrixAt(i, mesh.matrix);
        parent.remove(mesh);
      });
      instanced.castShadow = instances[0].castShadow;
      instanced.receiveShadow = instances[0].receiveShadow;
      instanced.userData.routeObstacle = instances.every((mesh) => mesh.userData.routeObstacle);
      instanced.userData.routeStructure = instances.every((mesh) => mesh.userData.routeStructure);
      instanced.userData.bakeReceiver = instances.every((mesh) => mesh.userData.bakeReceiver);
      instanced.computeBoundingBox();
      instanced.computeBoundingSphere();
      parent.add(instanced);
    }
    if (remaining.length < 2 || Array.isArray(material)) continue;
    const positions = [],
      normals = [],
      uv = [],
      colors = [],
      indices = [];
    const colorSize = Math.max(
      3,
      ...remaining.map((mesh) => mesh.geometry.getAttribute("color")?.itemSize || 3),
    );
    const extraChannels = new Map();
    for (const [name, attribute] of Object.entries(remaining[0].geometry.attributes))
      if (!["position", "normal", "uv", "color"].includes(name))
        extraChannels.set(name, {
          size: attribute.itemSize,
          normalized: attribute.normalized,
          values: [],
        });
    const sceneryParts = [];
    let offset = 0;
    for (const m of remaining) {
      const g = m.geometry.clone().applyMatrix4(m.matrix);
      const partStart = indices.length;
      // Imported detailed props can exceed JavaScript's argument-count limit.
      for (const value of g.attributes.position.array) positions.push(value);
      for (const value of g.attributes.normal.array) normals.push(value);
      if (g.attributes.uv) for (const value of g.attributes.uv.array) uv.push(value);
      else for (let i = 0; i < g.attributes.position.count; i++) uv.push(0, 0);
      const color = g.getAttribute("color");
      for (let i = 0; i < g.attributes.position.count; i++) {
        for (let channel = 0; channel < colorSize; channel++)
          colors.push(color && channel < color.itemSize ? color.getComponent(i, channel) : 1);
      }
      if (g.index) for (const index of g.index.array) indices.push(index + offset);
      else for (let i = 0; i < g.attributes.position.count; i++) indices.push(i + offset);
      sceneryParts.push({ start: partStart, count: indices.length - partStart });
      offset += g.attributes.position.count;
      for (const [name, channel] of extraChannels) {
        const attribute = g.getAttribute(name);
        for (let i = 0; i < attribute.count; i++)
          for (let component = 0; component < channel.size; component++)
            channel.values.push(attribute.getComponent(i, component));
      }
      g.dispose();
      parent.remove(m);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    if (material.vertexColors)
      g.setAttribute("color", new THREE.Float32BufferAttribute(colors, colorSize));
    for (const [name, channel] of extraChannels)
      g.setAttribute(
        name,
        new THREE.Float32BufferAttribute(channel.values, channel.size, channel.normalized),
      );
    g.setIndex(indices);
    const merged = new THREE.Mesh(g, material);
    merged.castShadow = remaining[0].castShadow;
    merged.receiveShadow = remaining[0].receiveShadow;
    merged.name = "Regional static scenery batch";
    merged.userData.sceneryParts = sceneryParts;
    merged.userData.routeObstacle = remaining.every((mesh) => mesh.userData.routeObstacle);
    merged.userData.routeStructure = remaining.every((mesh) => mesh.userData.routeStructure);
    merged.userData.bakeReceiver = remaining.every((mesh) => mesh.userData.bakeReceiver);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    parent.add(merged);
  }
  // Source geometry remains shared by asset templates and other regional batches.
}
