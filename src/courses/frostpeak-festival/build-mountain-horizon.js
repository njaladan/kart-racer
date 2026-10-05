/** Shared ridge and snow-cap geometry with a layered alpine skyline. */
export function buildMountainHorizon({ THREE, edgeOffset, landAt, scenery, kit, palette }) {
  const { asset, material, mesh, sectorT } = kit;
  const { snow } = palette;
  // Ring-built mountains have broken ridges and broad strata, not cone silhouettes.
  function mountainGeometry(cap = false) {
    const vertices = [],
      uv = [],
      indices = [],
      n = 11,
      rings = [
        [0, 1],
        [0.18, 0.81],
        [0.43, 0.6],
        [0.66, 0.36],
        [0.83, 0.18],
        [1, 0.005],
      ],
      firstRing = cap ? 3 : 0;
    for (let j = firstRing; j < rings.length; j++)
      for (let k = 0; k < n; k++) {
        const [y, r] = rings[j],
          a = (k / n) * Math.PI * 2;
        // Caps use the exact rock-ring jitter. A small outward shell avoids
        // buried snow patches and z-fighting while retaining the shared ridge.
        const jitter = (1 + Math.sin(k * 4.7 + j * 1.4) * 0.19) * (cap ? 1.025 : 1);
        vertices.push(
          Math.cos(a) * r * jitter + y * 0.12,
          y +
            (j === rings.length - 1 ? Math.sin(k * 2.9) * 0.035 : Math.sin(k * 1.7 + j) * 0.055) +
            (cap ? 0.008 : 0),
          Math.sin(a) * r * jitter,
        );
        uv.push((k / n) * 4, y * 3);
        if (j < rings.length - 1) {
          const p = (j - firstRing) * n + k,
            q = (j - firstRing) * n + ((k + 1) % n);
          indices.push(p, p + n, q, q, p + n, q + n);
        }
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }
  const mountainRock = mountainGeometry(),
    mountainSnow = mountainGeometry(true),
    mountainStone = material("#a7bdcd", { roughness: 1 });
  function mountain(x, z, width, height, rotation) {
    const g = new THREE.Group();
    g.name = "Layered alpine horizon";
    scenery.add(g);
    g.position.set(x, -2, z);
    g.rotation.y = rotation;
    mesh(mountainRock, mountainStone, g, [0, 0, 0], [width, height, width]).castShadow = false;
    mesh(mountainSnow, snow, g, [0, 0, 0], [width, height, width]).castShadow = false;
  }
  for (let i = 0; i < 8; i++) {
    const width = 48 + (i % 3) * 16,
      height = 94 + (i % 4) * 23;
    mountain(330 + (i % 3) * 74, -290 + i * 88, width, height, i * 0.7);
  }
  // The first village straight looks north. Wrap the existing summit language
  // around that view and the western finish rather than keeping it all east.
  for (const [i, x] of [-225, -130, -35, 65, 160].entries())
    mountain(x, -450 - (i % 2) * 24, 66 + (i % 3) * 10, 65 + (i % 3) * 17, i * 0.9);
  for (const [i, z] of [-180, -35, 110].entries())
    mountain(-435 - (i % 2) * 22, z, 68, 76 + i * 12, i * 1.3);
  for (const [i, x] of [-175, -50, 75, 185].entries())
    mountain(x, 425 + (i % 2) * 26, 70, 76 + (i % 3) * 13, i * 0.7);
  for (const s of [2, 3])
    for (let i = 0; i < 8; i++)
      for (const side of [-1, 1]) {
        const t = sectorT(s, (i + 0.5) / 8),
          g = landAt(t, edgeOffset(t, side, 9));
        const model = i % 3 === 0 ? "large" : i % 3 === 1 ? "medium" : "small";
        asset(`kenney:holiday-kit/rock_formation_${model}`, g, [0, -0.5, 0], [2.7, 3.2, 2.2]);
      }
}
