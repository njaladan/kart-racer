/** Dense architecture and natural boundaries. Every placement uses road frames. */
export function buildLumenDistricts({ THREE, scenery, track, kit, props, materials }) {
  const { box, mesh, groupAt, sectorT, batch } = kit;
  const {
    facades,
    cargo,
    sign,
    shopWindow,
    lightPool,
    steel,
    concrete,
    dark,
    cyan,
    pink,
    amber,
    window,
  } = materials;
  const { fitAsset, lightAt, groundShadow } = props;
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
  const sphere = new THREE.SphereGeometry(1, 12, 6);
  const upright = (t, offset = 0) => {
    const group = groupAt(t, offset, scenery);
    group.rotation.set(0, track.yawFor(track.frameAt(t).tangent), 0);
    return group;
  };
  const lengthOf = (district) => {
    const section = track.SECTIONS[district];
    return (section.end - section.start) * track.COURSE_LENGTH;
  };
  const edgeAt = (t, side) => {
    const surface = track.surfaceAt(t);
    return side > 0 ? surface.rightEdge : -surface.leftEdge;
  };

  // Quay drops and explorable pavements are built by the shared pathway system.

  function block(district, fraction, side, index, far = false) {
    const t = sectorT(district, fraction);
    const edge = edgeAt(t, side);
    const width = far ? 19 + (index % 3) * 4 : 10 + (index % 3) * 2;
    const depth = far ? 19 : 13;
    const height = far
      ? 58 + (index % 5) * 14
      : district === 2
        ? 12 + (index % 3) * 4
        : 27 + (index % 5) * 9;
    const offset = side * (edge + width / 2 + (far ? 35 : 4.3));
    const g = upright(t, offset);
    // Thick podiums tie the city to its quays even where the terrain falls away.
    box(concrete, g, [0, -1.8, 0], [width + 0.5, 3.6, depth + 0.5]);
    box(facades[index % 3], g, [0, height / 2, 0], [width, height, depth]);
    box(dark, g, [0, height + 0.16, 0], [width + 0.6, 0.32, depth + 0.6]);
    for (const z of [-depth / 2, depth / 2])
      box(
        index % 2 ? cyan : pink,
        g,
        [(-side * width) / 2 - side * 0.035, height * 0.8, z],
        [0.08, height * 0.35, 0.12],
      );
    if (far) {
      if (index % 3 === 0) {
        box(steel, g, [0, height + 4.5, 0], [0.3, 9, 0.3]);
        mesh(sphere, pink, g, [0, height + 9, 0], [0.25, 0.25, 0.25]);
      }
      batch(g);
      return;
    }
    const face = -side * (width / 2 + 0.05);
    // Recessed shop portal, fascia, awning, cable conduit and rooftop equipment.
    box(dark, g, [face, 2.1, 0], [0.2, 3.6, 9.5]);
    shopWindow(g, index, [face - side * 0.12, 2.2, -2.5], (-side * Math.PI) / 2);
    box(steel, g, [face - side * 0.2, 0.3, 0], [1.5, 0.6, 9.8]);
    box(index % 2 ? pink : cyan, g, [face - side * 0.25, 4.5, 0], [0.16, 0.1, 10]);
    box(steel, g, [face - side * 0.95, 4.1, 0], [2.2, 0.25, 10]);
    const advertising =
      district === 2 ? [1, 2, 8, 12] : district === 0 ? [15, 0, 12, 4, 5] : [0, 2, 4, 5, 7, 12, 13];
    sign(
      g,
      advertising[index % advertising.length],
      [face - side * 0.21, 6.3, 0],
      8.3,
      3.3,
      (-side * Math.PI) / 2,
    );
    if (index % 3 === 0) {
      const blade = new THREE.Group();
      g.add(blade);
      blade.position.set(face - side * 1.1, 11, depth / 2 - 0.5);
      box(dark, blade, [0, 0, 0], [3, 8, 0.35]);
      sign(blade, (index + 1) % 16, [0, 0, 0.2], 2.8, 7.5);
      box(steel, g, [face - side * 0.8, 15, depth / 2 - 0.5], [2, 0.1, 0.1]);
    }
    fitAsset("harbor:aircon", g, [width * 0.2, height + 0.35, 0], [2.2, 1.5, 2]);
    for (const z of [-4, 4]) {
      box(steel, g, [side * width * 0.32, height + 0.55, z], [2.2, 1.1, 1.7]);
      box(dark, g, [side * width * 0.32, height + 1.15, z], [1.8, 0.1, 1.4]);
    }
    // Near signs cast broad, cheap colored pools onto their sidewalk and lane.
    lightPool(g, index, [face - side * 3.4, 0.045, 0], 12, 11);
    lightAt(g, [face - side * 0.65, 5.8, 0], index % 2 ? "#ec92bc" : "#84dce2", 5, 21);
    lightAt(g, [face - side * 0.4, 2.8, -2.5], district === 2 ? "#ffd19d" : "#e9c9a3", 3.5, 12);
    groundShadow(g, width + 4, depth + 4);
    batch(g);
  }

  // Close walls occupy both sides of every downtown bend; tall second rows
  // block the horizon and leave glimpses of bridge cables through the streets.
  for (const [district, count] of [
    [0, 10],
    [1, 23],
    [2, 12],
    [7, 12],
  ]) {
    for (let i = 0; i < count; i++) {
      const fraction = (i + 0.5) / count;
      for (const side of district === 0 ? [-1] : [-1, 1]) {
        block(district, fraction, side, i + district * 17);
        if (i % 3 === 0) block(district, fraction, side, i + district * 13, true);
      }
    }
  }

  // Warm unattended market: deep awnings, tiled counters, crates and stocked shelves.
  for (let i = 0; i < 14; i++) {
    const t = sectorT(2, (i + 0.5) / 14);
    const side = i % 2 ? 1 : -1;
    const g = upright(t, side * (edgeAt(t, side) + 2.7));
    box(dark, g, [0, 1.2, 0], [3.7, 2.4, 7.6]);
    box(amber, g, [-side * 1.5, 1.1, 0], [0.5, 0.25, 7.8]);
    box(steel, g, [0, 3.65, 0], [5.3, 0.2, 8.4]);
    for (let z = -3.7; z < 4; z += 0.65)
      box(i % 2 ? pink : amber, g, [-side * 0.75, 3.5, z], [4.1, 0.16, 0.32]);
    for (let z = -3; z <= 3; z += 1.5) {
      box(concrete, g, [-side * 1.5, 1.35, z], [0.5, 0.2, 0.8]);
      mesh(sphere, amber, g, [-side * 1.5, 1.53, z], [0.25, 0.18, 0.25]);
      box(steel, g, [0.8, 1.8, z], [0.6, 0.9, 0.6]);
    }
    sign(g, 1, [-side * 1.96, 2.65, 0], 5.5, 0.8, (-side * Math.PI) / 2);
    lightPool(g, 2, [-side * 2.5, 0.035, 0], 8, 10);
    lightAt(g, [-side * 2.3, 3.2, 0], "#ffd099", 4.5, 15);
    batch(g);
  }
  for (const fraction of [0.17, 0.43, 0.73]) {
    const g = groupAt(sectorT(2, fraction));
    box(steel, g, [0, 15.2, 0], [29, 0.08, 0.08]);
    for (let x = -12; x <= 12; x += 3) {
      box(steel, g, [x, 14.7, 0], [0.035, 1, 0.035]);
      mesh(cylinder, amber, g, [x, 14.1, 0], [0.45, 0.75, 0.45]);
      box(window, g, [x, 13.7, 0], [0.35, 0.08, 0.35]);
    }
    batch(g);
  }
  // Giant noodle bowl sign: a static sculpture suspended above a storefront.
  const noodles = upright(sectorT(2, 0.6), -(edgeAt(sectorT(2, 0.6), -1) + 9));
  mesh(new THREE.CylinderGeometry(2.7, 1.4, 2, 16), concrete, noodles, [0, 9, 0]);
  mesh(new THREE.TorusGeometry(2.6, 0.13, 4, 24), pink, noodles, [0, 10, 0]).rotation.x =
    Math.PI / 2;
  for (let i = 0; i < 6; i++) {
    const noodle = mesh(new THREE.TorusGeometry(1.1, 0.07, 4, 12, Math.PI), amber, noodles, [
      -1.4 + i * 0.5,
      10.2,
      0,
    ]);
    noodle.rotation.x = Math.PI / 2;
  }
  for (const z of [-0.25, 0.25])
    box(steel, noodles, [0.4, 11, z], [5.5, 0.12, 0.12]).rotation.z = 0.3;
  batch(noodles);

  // Container canyon. Corrugation, locking rails and freight numbers are baked
  // into one map; short repeated modules follow bends without hiding the road.
  const count = Math.ceil(lengthOf(4) / 8.5);
  for (let i = 0; i < count; i++) {
    const t = sectorT(4, (i + 0.5) / count);
    for (const side of [-1, 1]) {
      if (side === 1 && i > count * 0.72 && i < count * 0.91) continue;
      const edge = edgeAt(t, side);
      const g = upright(t, side * (edge + 3.5));
      const rows = 2 + (i % 3);
      for (let row = 0; row < rows; row++) {
        box(
          cargo[(i + row + (side > 0 ? 2 : 0)) % cargo.length],
          g,
          [row % 2 ? side * 0.2 : 0, row * 3.05 + 1.5, 0],
          [5.5, 3, 8],
        );
        for (const z of [-3.8, 3.8]) box(steel, g, [0, row * 3.05 + 1.5, z], [5.55, 0.07, 0.07]);
      }
      if (i % 4 === 0) {
        sign(g, 10, [-side * 2.8, 5.1, 0], 5.8, 2, (-side * Math.PI) / 2);
        lightPool(g, 2, [-side * 4, 0.045, 0], 10, 12);
      }
      if (i % 6 === 0) {
        const row = upright(t, side * (edge + 19));
        for (let layer = 0; layer < 4; layer++)
          box(cargo[(i + layer) % 5], row, [layer % 2, 1.5 + layer * 3.05, 0], [8, 3, 18]);
        batch(row);
      }
      batch(g);
    }
  }
  // Amber portals and pipe racks make conveyor entry / exit recognizable.
  for (const fraction of [0.3, 0.5]) {
    const g = groupAt(sectorT(4, fraction));
    for (const x of [-12, 12]) {
      box(steel, g, [x, 7.5, 0], [0.8, 15, 0.8]);
      box(amber, g, [x, 4, 0.46], [0.55, 7.5, 0.07]);
    }
    box(steel, g, [0, 15.2, 0], [25, 0.9, 1.5]);
    sign(g, 3, [0, 15.3, 0.81], 10, 2.2);
    batch(g);
  }

  // Parked delivery vans explain the city's loading bays. All are empty.
  for (const district of [0, 1, 5, 7])
    for (let i = 0; i < 4; i++) {
      const t = sectorT(district, 0.15 + i * 0.21);
      const side = district === 5 ? 1 : -1;
      const g = upright(t, side * (edgeAt(t, side) + (district === 5 ? 6 : 4.9)));
      fitAsset(`lumen:${i % 2 ? "delivery" : "taxi"}`, g, [0, 0.2, 0], [2.7, 2.2, 5.5]);
      groundShadow(g, 3.8, 6.5);
      batch(g);
    }

  // Route cues are grounded stencil marks, sparse enough to keep apexes readable.
  const arrowGeometry = new THREE.BufferGeometry();
  arrowGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [-0.7, 0, 1, 0.7, 0, 1, 0.7, 0, -0.2, 1.4, 0, -0.2, 0, 0, -1.7, -1.4, 0, -0.2, -0.7, 0, -0.2],
      3,
    ),
  );
  arrowGeometry.setIndex([0, 1, 2, 0, 2, 6, 6, 2, 4, 2, 3, 4, 6, 4, 5]);
  arrowGeometry.computeVertexNormals();
  for (const district of [1, 2, 4, 5]) {
    for (const fraction of [0.09, 0.34, 0.62, 0.86]) {
      const g = groupAt(sectorT(district, fraction));
      mesh(
        arrowGeometry,
        district === 4 ? amber : cyan,
        g,
        [0, 0.095, 0],
        [1.2, 1, 1.8],
      ).castShadow = false;
    }
  }
  // Wide ferry exit jump is a signed choice beside the smooth lane.
  const exit = groupAt(sectorT(5, 0.84));
  for (const x of [-8, 8]) box(steel, exit, [x, 7, 0], [0.25, 14, 0.25]);
  sign(exit, 14, [0, 14.5, 0], 12, 2.5);
  batch(exit);
  return { upright, edgeAt, lengthOf };
}
