/** Road-clearing cable spans, lift stations, and independently batched cabins. */
export function buildSkiLift({
  THREE,
  edgeOffset,
  groundShadow,
  landAt,
  rail,
  scene,
  scenery,
  track,
  kit,
  palette,
  geometry,
}) {
  const { asset, batch, box, mesh, sectorT } = kit;
  const { cream, cyan, dark, glass, red, rock, snow, timber } = palette;
  const { cylinder } = geometry;
  // Lift follows the forest/climb beside the road; every cable crossing stays
  // 19 m above the authored surface and every support stands outside its edge.
  const liftStart = sectorT(0, 0.82),
    liftEnd = sectorT(3, 0.18),
    liftPoints = [];
  for (let i = 0; i <= 48; i++) {
    const t = liftStart + ((liftEnd - liftStart) * i) / 48;
    liftPoints.push(track.poseAt(t * track.TRACK, edgeOffset(t, -1, 29), 20).p.clone());
  }
  function beamBetween(a, b, width, parent, mat = dark) {
    const m = mesh(cylinder, mat, parent, [0, 0, 0], [width, a.distanceTo(b), width]);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  }
  for (let i = 0; i < 48; i++)
    for (const dx of [-1.8, 1.8]) {
      const a = liftPoints[i].clone(),
        b = liftPoints[i + 1].clone();
      a.x += dx;
      b.x += dx;
      beamBetween(a, b, 0.055, scenery);
    }
  for (let i = 0; i <= 6; i++) {
    const t = liftStart + ((liftEnd - liftStart) * i) / 6,
      g = landAt(t, edgeOffset(t, -1, 29));
    box(rock, g, [0, 0.4, 0], [3, 0.8, 3]);
    box(dark, g, [0, 9.5, 0], [0.6, 19, 0.6]);
    box(cream, g, [0, 19.3, 0], [7, 0.45, 0.5]);
    for (const x of [-2.1, 2.1]) mesh(cylinder, dark, g, [x, 19.6, 0], [0.55, 0.18, 0.55]);
    for (let y = 2; y < 18; y += 1.5) box(cream, g, [0.46, y, 0], [0.16, 0.1, 0.7]);
  }
  function station(t) {
    const g = landAt(t, edgeOffset(t, -1, 43));
    groundShadow(g, 25, 27);
    asset("frostpeak:chalet", g, [0, 0, 0], [13.5, 11.5, 13.5]);
    // Boarding canopy and framed glazing remain functional lift architecture,
    // while the imported lodge supplies timber joints, eaves and snowy roof.
    box(glass, g, [0, 3.2, -7.06], [8.4, 2.6, 0.1]);
    box(red, g, [0, 5.15, -9.5], [11, 0.3, 6]);
    box(snow, g, [0, 5.42, -9.5], [11.2, 0.24, 6.2]);
    for (const x of [-4.8, 4.8]) box(dark, g, [x, 3.05, -11.8], [0.3, 4.7, 0.3]);
    box(timber, g, [0, 1.2, -10], [18, 0.3, 6]);
    rail(g, 0, 2.4, -12.8, 18);
    for (let i = 0; i < 5; i++) {
      const ski = box(i % 2 ? cyan : red, g, [-5 + i * 1.1, 2.4, -8.5], [0.16, 3.1, 0.1]);
      ski.rotation.z = 0.2;
    }
  }
  station(liftStart);
  station(liftEnd);
  const gondolas = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    scene.add(g);
    box(dark, g, [0, -1.25, 0], [0.12, 2.5, 0.12]);
    box(dark, g, [0, -2.45, 0], [2.6, 0.22, 2.9]);
    box(i % 2 ? cyan : red, g, [0, -4.05, 0], [2.5, 2.7, 2.8]);
    box(glass, g, [0, -3.55, -1.42], [2.13, 1.15, 0.07]);
    for (const x of [-1.27, 1.27]) box(glass, g, [x, -3.55, 0], [0.07, 1.15, 2.3]);
    box(snow, g, [0, -2.58, 0], [2.85, 0.17, 3.15]);
    box(dark, g, [0, -5.45, 0], [2.8, 0.2, 3.1]);
    batch(g);
    gondolas.push(g);
  }

  return { liftPoints, gondolas };
}
