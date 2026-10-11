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
