/** Close waterfront storytelling, skyline silhouettes and connected pier geometry. */
export function buildLumenQuays({ THREE, scenery, track, kit, props, materials }) {
  const { box, mesh, groupAt, sectorT, batch } = kit;
  const { steel, concrete, dark, cyan, pink, amber, window, facades, sign, lightPool } = materials;
  const { fitAsset, lightAt } = props;
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const sphere = new THREE.SphereGeometry(1, 10, 6);
  const upright = (t, offset) => {
    const g = groupAt(t, offset, scenery);
    g.rotation.set(0, track.yawFor(track.frameAt(t).tangent), 0);
    return g;
  };

  // Imported towers add setbacks and rooftop silhouettes to the atlas-based city.
  for (let i = 0; i < 6; i++) {
    const t = sectorT(i < 4 ? 1 : 7, 0.18 + (i % 4) * 0.21);
    const g = props.safeGroup(t, (i % 2 ? 1 : -1) * (65 + (i % 3) * 13), 20);
    if (!g) continue;
    const height = 70 + (i % 3) * 18;
    const object = fitAsset(
      `lumen:building-skyscraper-${i % 2 ? "d" : "a"}`,
      g,
      [0, 0, 0],
      [26, height, 25],
    );
    object?.traverse((child) => {
      if (!child.isMesh) return;
      const tint = (source) => {
        const mat = source.clone();
        mat.color.set("#36425f");
        mat.roughness = 0.62;
        return mat;
      };
      child.material = Array.isArray(child.material)
        ? child.material.map(tint)
        : tint(child.material);
    });
    for (const z of [-12.6, 12.6]) {
      const plane = mesh(new THREE.PlaneGeometry(19, height * 0.8), facades[i % 3], g, [
        0,
        height * 0.44,
        z,
      ]);
      if (z < 0) plane.rotation.y = Math.PI;
    }
    box(i % 2 ? cyan : pink, g, [0, height + 0.3, 0], [21, 0.4, 22]);
    box(steel, g, [0, height + 5, 0], [0.25, 10, 0.25]);
    mesh(sphere, pink, g, [0, height + 10, 0], [0.35, 0.35, 0.35]);
    batch(g);
  }

  // Paired marina fingers descend from the promenade, not disconnected floating docks.
  for (const district of [0, 7]) {
    for (let i = 0; i < 5; i++) {
      const t = sectorT(district, 0.06 + i * 0.18);
      const g = upright(t, track.surfaceAt(t).rightEdge + 1.2);
      box(concrete, g, [0, -1.5, 0], [2, 4, 5]);
      box(steel, g, [10, -1.4, 0], [21, 0.35, 3.5]);
      for (const x of [4, 11, 19]) {
        box(steel, g, [x, -3.5, 0], [0.35, 5, 0.35]);
        box(cyan, g, [x, -1.1, 0], [0.12, 0.08, 3.4]);
      }
      for (const side of [-1, 1]) {
        const boat = new THREE.Group();
        g.add(boat);
        boat.position.set(14, -g.position.y - 1.52, side * 6);
        box(dark, boat, [0, 0.3, 0], [3.5, 0.7, 9]);
        box(concrete, boat, [0, 0.7, -0.5], [3.2, 0.45, 7]);
        box(steel, boat, [0, 1.5, -1.4], [2.6, 1.6, 3]);
        box(window, boat, [0, 1.65, 0.16], [2.3, 0.65, 0.07]);
        box(cyan, boat, [0, 2.45, -1.4], [2.9, 0.14, 3.3]);
        if (i % 2 === 0) {
          box(steel, boat, [0, 5, 1.3], [0.08, 8, 0.08]);
          box(steel, boat, [0, 7.4, 1.3], [3.5, 0.04, 0.04]);
        }
      }
      batch(g);
    }
  }

  // Seawall service district: pump houses, sea defences, solar roofs and cable runs.
  for (let i = 0; i < 17; i++) {
    const t = sectorT(6, (i + 0.5) / 17);
    const g = upright(t, track.surfaceAt(t).leftEdge - 5.5);
    if (i % 3 === 0) {
      box(steel, g, [0, 2.5, 0], [6, 5, 8]);
      box(dark, g, [0, 5.2, 0], [6.4, 0.4, 8.4]);
      for (const z of [-2.5, 0, 2.5]) box(cyan, g, [0, 5.45, z], [5.7, 0.07, 1.8]);
      sign(g, 11, [3.04, 3.1, 0], 6, 2.2, Math.PI / 2);
      for (const z of [-2.3, 2.3]) box(steel, g, [3.7, 1.5, z], [1.4, 3, 1.4]);
      lightPool(g, 0, [4.5, 0.075, 0], 12, 11);
    } else {
      box(concrete, g, [0, 0.4, 0], [5.4, 0.8, 4]);
      fitAsset("harbor:tetrapod", g, [0, 0.8, 0], [4.5, 3.2, 4.5]);
      box(steel, g, [2, 3.5, 0], [0.18, 7, 0.18]);
      box(amber, g, [2, 6.8, 0], [1.5, 0.15, 0.6]);
    }
    batch(g);
    if (i % 2 === 0) {
      const street = upright(t, track.surfaceAt(t).rightEdge + 0.5);
      box(steel, street, [0, 4, 0], [0.14, 8, 0.14]);
      box(amber, street, [-1, 8, 0], [2.3, 0.2, 0.6]);
      box(window, street, [-1.2, 7.86, 0], [1.5, 0.06, 0.5]);
      lightAt(street, [-1.2, 7.8, 0], "#6fe4df", 2.2, 18);
      batch(street);
    }
  }

  // Ground-scale details give surfaces a purpose between the large landmarks.
  for (const district of [0, 1, 2, 7]) {
    for (let i = 0; i < 12; i++) {
      const t = sectorT(district, (i + 0.5) / 12);
      const side = district === 0 ? -1 : i % 2 ? 1 : -1;
      const edge = side < 0 ? track.surfaceAt(t).leftEdge : track.surfaceAt(t).rightEdge;
      const g = upright(t, edge + side * 2);
      if (i % 3 === 0) {
        box(steel, g, [0, 1.5, 0], [1.1, 3, 0.8]);
        sign(g, 2, [-side * 0.57, 1.8, 0], 0.65, 1.5, (-side * Math.PI) / 2);
        box(cyan, g, [-side * 0.61, 0.7, 0], [0.06, 0.12, 0.5]);
      } else if (i % 3 === 1) {
        box(concrete, g, [0, 0.45, 0], [1.8, 0.9, 1.8]);
        fitAsset("harbor:palm", g, [0, 0.8, 0], [4, 7.5, 4]);
      } else {
        box(dark, g, [0, 0.6, 0], [0.7, 1.2, 0.7]);
        box(steel, g, [0, 1.2, 0], [0.85, 0.1, 0.85]);
        for (const z of [-1.6, 1.6]) mesh(cylinder, steel, g, [0, 0.7, z], [0.12, 1.4, 0.12]);
      }
      batch(g);
    }
  }
}
