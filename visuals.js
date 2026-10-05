import * as THREE from "./vendor/three/three.module.js";

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
  const batches = new Map(),
    removed = new Set();
  for (const child of [...parent.children]) {
    if (
      !child.isMesh ||
      excluded.includes(child) ||
      Array.isArray(child.material)
    )
      continue;
    child.updateMatrix();
    if (!batches.has(child.material)) batches.set(child.material, []);
    batches.get(child.material).push(child);
  }
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue;
    const positions = [],
      normals = [],
      uv = [],
      indices = [];
    let offset = 0;
    for (const m of meshes) {
      const g = m.geometry.clone().applyMatrix4(m.matrix);
      positions.push(...g.attributes.position.array);
      normals.push(...g.attributes.normal.array);
      uv.push(...g.attributes.uv.array);
      if (g.index)
        for (const index of g.index.array) indices.push(index + offset);
      else
        for (let i = 0; i < g.attributes.position.count; i++)
          indices.push(i + offset);
      offset += g.attributes.position.count;
      removed.add(m.geometry);
      g.dispose();
      parent.remove(m);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(indices);
    const merged = new THREE.Mesh(g, material);
    merged.castShadow = meshes.some((m) => m.castShadow);
    merged.receiveShadow = meshes.some((m) => m.receiveShadow);
    parent.add(merged);
  }
  for (const g of removed) g.dispose();
}
