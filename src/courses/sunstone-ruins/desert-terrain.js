/** A world-space dune field with one prevailing wind and broad, meandering crests. */
export function createDesertHeightField(track) {
  const samples = new Map();
  const cellSize = 64;
  const key = (x, z) => `${x}:${z}`;
  function add(frame, width) {
    const p = frame.p;
    const cell = key(Math.floor(p.x / cellSize), Math.floor(p.z / cellSize));
    if (!samples.has(cell)) samples.set(cell, []);
    samples.get(cell).push({ x: p.x, z: p.z, width });
  }
  const count = Math.ceil(track.COURSE_LENGTH / 5);
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    add(track.frameAt(t), Math.max(-track.platformEdgeAt(t, -1), track.platformEdgeAt(t, 1)));
  }
  for (const branch of track.branches || [])
    for (let i = 0; i <= branch.count; i++) add(branch.frameAt(i / branch.count), branch.halfWidth);
  function clearanceAt(x, z) {
    const cx = Math.floor(x / cellSize),
      cz = Math.floor(z / cellSize);
    let distance = Infinity;
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++)
        for (const p of samples.get(key(cx + dx, cz + dz)) || [])
          distance = Math.min(distance, Math.hypot(x - p.x, z - p.z) - p.width);
    return distance;
  }
  const smooth = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  function heightAt(x, z) {
    const wind = x * 0.88 + z * 0.475;
    const cross = -x * 0.475 + z * 0.88;
    const bend = Math.sin(cross * 0.006) * 56 + Math.sin(cross * 0.014 + wind * 0.002) * 21;
    const phase = (wind + bend) / 205;
    const q = phase - Math.floor(phase);
    const ridge = q < 0.76 ? smooth(0, 0.76, q) : 1 - smooth(0.76, 1, q);
    const swell = Math.sin(x * 0.0037 + z * 0.0021) * 0.5 + 0.5;
    const amplitude = 32 + swell * 28 + Math.sin(cross * 0.004) * 6;
    const smallPhase = (wind + bend * 0.6) / 78 + Math.sin(cross * 0.023) * 0.13;
    const small = Math.pow(0.5 + Math.sin(smallPhase * Math.PI * 2) * 0.5, 2) * 5;
    // Keep the rendered shoulder and the complete chase-camera corridor clear.
    const apron = smooth(43, 100, clearanceAt(x, z));
    return (
      track.course.theme.groundHeight - 0.05 + (ridge * amplitude + small + swell * 14) * apron
    );
  }
  return { heightAt, clearanceAt };
}

/** Tiles share exact boundary heights, normals and UVs; there are no overlapping mounds. */
export function createDesertTerrainTile(THREE, field, x, z, size = 240, segments = 30) {
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position,
    normals = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  const colors = [];
  const pale = new THREE.Color("#eadcc2"),
    shade = new THREE.Color("#b8aa96");
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const wx = x + positions.getX(i),
      wz = z + positions.getZ(i);
    const height = field.heightAt(wx, wz);
    positions.setY(i, height);
    const dx = (field.heightAt(wx + 1, wz) - field.heightAt(wx - 1, wz)) / 2;
    const dz = (field.heightAt(wx, wz + 1) - field.heightAt(wx, wz - 1)) / 2;
    const length = Math.hypot(dx, 1, dz);
    normals.setXYZ(i, -dx / length, 1 / length, -dz / length);
    uv.setXY(i, wx / 14, wz / 14);
    const light = Math.max(0, Math.min(1, 0.72 - dx * 0.38 + dz * 0.18));
    color.copy(shade).lerp(pale, light);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
