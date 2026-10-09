/** A shallow fountain basin lies beyond the optional center-lane trick ramp. */
export function buildEmberwingFountain(w, art) {
  const { THREE, track, mesh, box, sphere, motion } = w;
  const { blue, plaster, cream, soft } = art;
  const d = track.course.fountainJump;
  const lip = track.sectorT(d.section, d.fraction);
  const centreT = lip + 6.4 / track.COURSE_LENGTH;
  const g = w.groupAt(centreT);
  g.name = "Fountain square with shallow jump basin";
  const water = new THREE.MeshBasicMaterial({ color: "#54c6d1", side: THREE.DoubleSide });
  // Basin and mosaic border stay flush with the authoritative paved floor.
  const count = 16,
    positions = [],
    indices = [];
  for (let i = 0; i <= count; i++)
    for (const side of [-1, 1]) {
      const t = centreT + ((i / count - 0.5) * d.basinLength) / track.COURSE_LENGTH;
      const p = track.poseAt(t * track.TRACK, side * d.basinHalfWidth, 0.075).p;
      positions.push(p.x, p.y, p.z);
      if (i < count && side === -1) {
        const k = i * 2;
        indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const basin = mesh(geo, water);
  basin.name = "Shallow fountain water over the supported paving";
  basin.castShadow = false;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 12; i++) {
      const t = centreT + ((i / 11 - 0.5) * d.basinLength) / track.COURSE_LENGTH;
      const tile = w.groupAt(t, side * (d.basinHalfWidth + 0.18));
      box(i % 2 ? blue : plaster, tile, [0, 0.08, 0], [0.35, 0.08, 0.85]);
    }
    const fountain = w.safe(d.section, d.fraction + 0.045, side * 21, 4.5, 12);
    if (!fountain) continue;
    fountain.name = "Blue tiled courtyard fountain";
    soft(fountain, cream, [0, 0.3, 0], [7, 0.6, 7]);
    mesh(w.cylinder, blue, fountain, [0, 1.5, 0], [1.4, 3, 1.4]);
    mesh(w.cylinder, plaster, fountain, [0, 3, 0], [3.3, 0.4, 3.3]);
    // Harmless water jets and falling droplets, attached to visible fountain bowls.
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const curve = new THREE.CatmullRomCurve3(
        Array.from({ length: 12 }, (_, k) => {
          const q = k / 11;
          return new THREE.Vector3(
            Math.cos(a) * q * 2.8,
            3 + 3.5 * Math.sin(q * Math.PI) - 2.4 * q,
            Math.sin(a) * q * 2.8,
          );
        }),
      );
      const jet = mesh(new THREE.TubeGeometry(curve, 16, 0.075, 4, false), water, fountain);
      jet.castShadow = false;
      const drop = mesh(sphere, water, fountain, [0, 3, 0], [0.18, 0.3, 0.18]);
      drop.castShadow = false;
      motion(drop, (time, state) => {
        const q = ((state?.motionEnabled === false ? 0 : time) * 0.6 + i / 8) % 1;
        drop.position.copy(curve.getPoint(q));
      });
    }
  }
  // The painted launch arrow is on the same quarterpipe queried by simulation.
  for (const offset of [-2.6, 2.6]) {
    const stripe = w.sweep(
      d.section,
      d.fraction -
        8 /
          ((track.SECTIONS[d.section].end - track.SECTIONS[d.section].start) * track.COURSE_LENGTH),
      d.fraction - 0.001,
      offset - 0.12,
      offset + 0.12,
      blue,
      0.085,
    );
    stripe.name = "Fountain trick ramp blue launch stripe";
  }
}
