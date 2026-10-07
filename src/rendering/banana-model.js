import * as THREE from "../../vendor/three/three.module.js";

/** A thick, curled peel ribbon with a cream lining and golden outer skin. */
function peelGeometry() {
  const curve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0.13, 0.57, 0),
    new THREE.Vector3(0.32, -0.32, 0),
    new THREE.Vector3(1.15, -0.27, 0),
    new THREE.Vector3(1.22, 0.16, 0),
  );
  const lengthSegments = 28,
    ringSegments = 12,
    positions = [],
    skin = [],
    lining = [];
  for (let i = 0; i <= lengthSegments; i++) {
    const t = i / lengthSegments;
    const point = curve.getPoint(t),
      tangent = curve.getTangent(t);
    const width = 0.3 * Math.sin(Math.PI * t) ** 0.7 + 0.065 * (1 - t) + 0.01;
    for (let j = 0; j <= ringSegments; j++) {
      const angle = (j / ringSegments) * Math.PI * 2;
      const across = Math.cos(angle);
      const depth = Math.sin(angle) * 0.035 + across ** 2 * width * 0.22;
      positions.push(point.x - tangent.y * depth, point.y + tangent.x * depth, across * width);
    }
  }
  for (let i = 0; i < lengthSegments; i++) {
    for (let j = 0; j < ringSegments; j++) {
      const a = i * (ringSegments + 1) + j,
        b = a + ringSegments + 1;
      const surface = j < ringSegments / 2 ? lining : skin;
      surface.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  // Close the cut ends so the peel has visible thickness from every angle.
  for (let j = 1; j < ringSegments - 1; j++) {
    skin.push(0, j, j + 1);
    const end = lengthSegments * (ringSegments + 1);
    skin.push(end, end + j + 1, end + j);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex([...skin, ...lining]);
  geometry.addGroup(0, skin.length, 0);
  geometry.addGroup(skin.length, lining.length, 1);
  geometry.computeVertexNormals();
  return geometry;
}

/** Original procedural artwork, kept local and owned by the item effect. */
export function createBananaModel(addMesh, mat) {
  const group = new THREE.Group();
  const skin = mat("#f4c52b", 0.46, {
    emissive: "#785000",
    emissiveIntensity: 0.08,
  });
  const lining = mat("#fff0b5", 0.72);
  const stem = mat("#72502c", 0.86);
  const profile = [
    [0, -0.16],
    [0.12, -0.16],
    [0.2, -0.05],
    [0.21, 0.12],
    [0.17, 0.36],
    [0.11, 0.58],
    [0.065, 0.76],
    [0.055, 0.84],
    [0, 0.84],
  ].map(([radius, height]) => new THREE.Vector2(radius, height));
  addMesh(new THREE.LatheGeometry(profile, 20), skin, group);
  for (let i = 0; i < 3; i++) {
    const flap = addMesh(peelGeometry(), [skin, lining], group);
    flap.rotation.y = (i / 3) * Math.PI * 2 + Math.PI / 6;
  }
  const tip = addMesh(new THREE.CylinderGeometry(0.045, 0.06, 0.13, 10), stem, group);
  tip.position.set(0.01, 0.88, 0);
  tip.rotation.z = -0.16;
  return group;
}
