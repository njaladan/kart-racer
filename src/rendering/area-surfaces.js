import * as THREE from "../../vendor/three/three.module.js";
import { metalDeckDetail } from "../courses/adventure/architectural-detail.js";

/** Tessellate area floors in both directions; a wide two-vertex ribbon is flat. */
export function buildAreaSurfaces(track, kit, textures) {
  for (const area of track.areaSurfaces) {
    const positions = [],
      uv = [],
      indices = [];
    const rings = 64,
      sectors = 192;
    for (let i = 0; i <= rings; i++) {
      const r = THREE.MathUtils.lerp(area.innerRadius, area.radius, i / rings);
      for (let j = 0; j <= sectors; j++) {
        const p = area.pointAt((j / sectors) * Math.PI * 2, r);
        positions.push(p.x, p.y, p.z);
        uv.push(p.x / 8, p.z / 8);
        if (i < rings && j < sectors) {
          const n = i * (sectors + 1) + j;
          indices.push(n, n + sectors + 1, n + 1, n + 1, n + sectors + 1, n + sectors + 2);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = kit.material("#d6b56b", {
      map: textures.metal,
      metalness: 0.48,
      roughness: 0.55,
      side: THREE.DoubleSide,
    });
    metalDeckDetail(material);
    const floor = kit.mesh(geometry, material);
    floor.name = "Continuous hemispherical driving bowl";
    floor.receiveShadow = true;
    floor.userData.bakeReceiver = true;
    // Brass seams emphasize the concavity without fencing off racing lines.
    const trim = kit.material("#ffe1a0", { metalness: 0.7, roughness: 0.38 });
    for (const ratio of [area.innerRadius / area.radius, 0.4, 0.65, 0.84, 1]) {
      const gate = Math.asin(area.gateHalfWidth / area.radius);
      const arcs =
        ratio === 1
          ? [
              [gate, Math.PI - gate],
              [Math.PI + gate, Math.PI * 2 - gate],
            ]
          : [[0, Math.PI * 2]];
      for (const [start, end] of arcs) {
        const points = Array.from({ length: sectors + 1 }, (_, j) =>
          area.pointAt(THREE.MathUtils.lerp(start, end, j / sectors), area.radius * ratio, 0.025),
        );
        const seam = kit.mesh(
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(points),
            sectors,
            ratio === 1 ? 0.3 : 0.065,
            4,
            false,
          ),
          trim,
        );
        seam.name = ratio === 1 ? "Bowl perimeter lip" : "Bowl concentric brass inlay";
      }
    }
  }
}

/** Excavate below sunken area floors instead of allowing a ground plane through them. */
export function groundGeometry(track, size) {
  if (!track.areaSurfaces.length) return new THREE.PlaneGeometry(size, size);
  const shape = new THREE.Shape();
  shape.moveTo(-size / 2, -size / 2);
  shape.lineTo(size / 2, -size / 2);
  shape.lineTo(size / 2, size / 2);
  shape.lineTo(-size / 2, size / 2);
  shape.closePath();
  for (const area of track.areaSurfaces) {
    const hole = new THREE.Path();
    hole.absarc(area.center.x, -area.center.z, area.radius + 2, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const geometry = new THREE.ShapeGeometry(shape, 96);
  const positions = geometry.attributes.position,
    uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, positions.getX(i) / size + 0.5, positions.getY(i) / size + 0.5);
  return geometry;
}
