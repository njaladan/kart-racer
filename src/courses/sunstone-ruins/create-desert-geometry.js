/** Crescent crest, long windward slope and a short, steep slip face. */
export function duneHeightAt(x, z) {
  const crest = 0.22 + Math.sin(x * 2.7) * 0.16;
  const u = z < crest ? (z + 1) / (crest + 1) : (1 - z) / (1 - crest);
  const profile = Math.pow(Math.sin((Math.max(0, Math.min(1, u)) * Math.PI) / 2), 1.7);
  const envelope = Math.pow(Math.max(0, 1 - x * x), 0.8);
  return envelope * profile * (1 + Math.sin(z * 38 + x * 9) * 0.012);
}

export function createDuneGeometry(THREE, segments = 36) {
  const geometry = new THREE.PlaneGeometry(2, 2, segments, Math.ceil((segments * 2) / 3));
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++)
    positions.setY(i, duneHeightAt(positions.getX(i), positions.getZ(i)));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Sculpted sandstone layers, dunes, palm fronds, fabric, and bird wings. */
export function createDesertGeometry({ THREE, kit }) {
  const { material } = kit;
  function beddedLayerGeometry(width, height, phase, front = 7.9) {
    const geometry = new THREE.BufferGeometry(),
      positions = [],
      indices = [],
      segments = 8;
    for (let i = 0; i <= segments; i++) {
      const x = -width / 2 + (width * i) / segments;
      const wobble = Math.sin(i * 1.71 + phase) * 0.22 + Math.sin(i * 0.73 + phase * 2) * 0.12;
      const z = front + wobble;
      positions.push(x, height + wobble * 0.35, z, x, height + 1.15 + wobble, z - 0.13);
      if (i < segments) {
        const a = i * 2,
          b = a + 1,
          c = a + 2,
          d = a + 3;
        indices.push(a, c, b, b, c, d, a, b, c, b, d, c);
      }
    }
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
  // Give dunes actual wind-sculpted ridges, rather than a repeated oval mound.
  const duneGeometry = createDuneGeometry(THREE);
  // A gently arched strip rounds the palm silhouette at chase-camera range.
  // Three vertices across each section give the leaf a soft central ridge.
  const frondGeometry = new THREE.BufferGeometry();
  const frondPositions = [],
    frondUVs = [],
    frondIndices = [],
    frondSections = 9;
  for (let i = 0; i <= frondSections; i++) {
    const u = i / frondSections,
      width = 0.8 * Math.pow(Math.sin(Math.PI * u), 0.8),
      height = Math.sin(Math.PI * u) * 0.5 - u * u * 0.85;
    for (const side of [-1, 0, 1]) {
      frondPositions.push(u * 5.2, height + (side === 0 ? width * 0.22 : 0), side * width);
      frondUVs.push(u, (side + 1) / 2);
    }
    if (i < frondSections)
      for (let side = 0; side < 2; side++) {
        const a = i * 3 + side,
          b = a + 1,
          c = a + 3,
          d = c + 1;
        frondIndices.push(a, b, c, b, d, c);
      }
  }
  frondGeometry.setAttribute("position", new THREE.Float32BufferAttribute(frondPositions, 3));
  frondGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(frondUVs, 2));
  frondGeometry.setIndex(frondIndices);
  frondGeometry.computeVertexNormals();
  const fabricGeometry = new THREE.PlaneGeometry(8, 5, 10, 6);
  const fp = fabricGeometry.attributes.position;
  for (let i = 0; i < fp.count; i++)
    fp.setZ(i, 0.32 * Math.cos(fp.getX(i) * 0.55) * Math.sin((fp.getY(i) + 2.5) * 0.63));
  fabricGeometry.computeVertexNormals();
  const wingGeometry = new THREE.BufferGeometry();
  wingGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        -1.8, 0, 0, -0.4, 0.1, 0.35, 0, 0, 0, 0, 0, 0, 0.4, 0.1, 0.35, 1.8, 0, 0, -0.3, 0, -0.2,
        0.3, 0, -0.2, 0, 0.15, 0.55,
      ],
      3,
    ),
  );
  wingGeometry.computeVertexNormals();
  const birdMat = material("#675a56", { side: THREE.DoubleSide });

  return {
    beddedLayerGeometry,
    duneGeometry,
    frondGeometry,
    fabricGeometry,
    wingGeometry,
    birdMat,
  };
}
