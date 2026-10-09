/** Shared original Cycladic architecture: soft plaster, shutters and planted terraces. */
export function emberwingTownKit(w) {
  const { THREE, mat, mesh, box, cylinder, sphere, tube } = w;
  const plaster = mat("#fff4df", "stone", {
    map: null,
    normalMap: null,
    roughnessMap: null,
    bumpMap: null,
  });
  const cream = mat("#e9dcc4", "stone", { map: null });
  const blue = mat("#2875b8", "stone", { map: null });
  const cobalt = mat("#195183", "stone", { map: null });
  const coral = mat("#e38273", "fabric", { map: null });
  const wood = mat("#96704b", "wood");
  const leaf = mat("#4f8962", "leaves", { map: null });
  const olive = mat("#83a46a", "leaves", { map: null });
  const pink = mat("#e95199", "leaves", { map: null });
  const glow = mat("#ffe5a3", "stone", { map: null, emissive: "#ffc36b", emissiveIntensity: 0.45 });
  // Painted plaster and foliage keep their authored colors at every quality tier.
  for (const material of [plaster, cream, blue, cobalt, coral, leaf, olive, pink, glow]) {
    material.map = material.normalMap = material.roughnessMap = material.bumpMap = null;
    material.userData.skipSurfaceDetail = true;
  }
  const geometries = new Map();
  function soft(parent, material, p, size, bevel = 0.16) {
    const key = [...size, bevel].join(":");
    if (!geometries.has(key)) {
      const [width, height, depth] = size;
      const r = Math.min(bevel, width / 4, depth / 4);
      const shape = new THREE.Shape();
      shape.moveTo(-width / 2 + r, -depth / 2);
      shape.lineTo(width / 2 - r, -depth / 2);
      shape.quadraticCurveTo(width / 2, -depth / 2, width / 2, -depth / 2 + r);
      shape.lineTo(width / 2, depth / 2 - r);
      shape.quadraticCurveTo(width / 2, depth / 2, width / 2 - r, depth / 2);
      shape.lineTo(-width / 2 + r, depth / 2);
      shape.quadraticCurveTo(-width / 2, depth / 2, -width / 2, depth / 2 - r);
      shape.lineTo(-width / 2, -depth / 2 + r);
      shape.quadraticCurveTo(-width / 2, -depth / 2, -width / 2 + r, -depth / 2);
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: height,
        steps: 1,
        bevelEnabled: true,
        bevelSegments: 1,
        bevelSize: r / 2,
        bevelThickness: r / 2,
        curveSegments: 3,
      });
      geo.rotateX(Math.PI / 2);
      geo.translate(0, height / 2, 0);
      geometries.set(key, geo);
    }
    return mesh(geometries.get(key), material, parent, p);
  }
  function pot(parent, x, y, z, flowering = false, size = 1) {
    mesh(cylinder, coral, parent, [x, y + 0.5 * size, z], [0.65 * size, size, 0.65 * size]);
    mesh(sphere, leaf, parent, [x, y + 1.4 * size, z], [size, size, size]);
    if (flowering)
      for (let i = 0; i < 5; i++)
        mesh(
          sphere,
          pink,
          parent,
          [
            x + Math.sin(i * 2.4) * size * 0.8,
            y + (1.5 + (i % 2) * 0.4) * size,
            z + Math.cos(i * 2.4) * size * 0.8,
          ],
          [0.3 * size, 0.3 * size, 0.3 * size],
        );
  }
  function tree(parent, x, z, size = 1) {
    tube(parent, [x, 0, z], [x + 0.6 * size, 5 * size, z], 0.3 * size, wood);
    for (let i = 0; i < 4; i++)
      mesh(
        sphere,
        i % 2 ? olive : leaf,
        parent,
        [
          x + Math.sin(i * 2.4) * 1.7 * size,
          (5 + (i % 2)) * size,
          z + Math.cos(i * 2.4) * 1.5 * size,
        ],
        [2.5 * size, 1.8 * size, 2.2 * size],
      );
  }
  function awning(parent, width, y, z, color = blue) {
    for (let i = 0; i < 8; i++) {
      const x = -width / 2 + ((i + 0.5) * width) / 8;
      const sheet = box(i % 2 ? plaster : color, parent, [x, y, z], [width / 8, 0.16, 3.2]);
      sheet.rotation.x = 0.16;
      box(i % 2 ? plaster : color, parent, [x, y - 0.4, z + 1.55], [width / 8, 0.65, 0.14]);
    }
  }
  const arch = new THREE.CircleGeometry(1, 16, 0, Math.PI);
  function doorway(parent, x, y, z, width, height, material = cobalt) {
    box(material, parent, [x, y + height / 2, z], [width, height, 0.13]);
    mesh(arch, material, parent, [x, y + height, z + 0.015], [width / 2, width / 2, 1]);
  }
  function house(
    parent,
    { width = 10, height = 10, depth = 9, chapel = false, shop = false, variant = 0 } = {},
  ) {
    soft(parent, variant % 4 === 0 ? cream : plaster, [0, height / 2, 0], [width, height, depth]);
    soft(parent, plaster, [0, height + 0.22, 0], [width + 0.35, 0.45, depth + 0.35], 0.12);
    doorway(parent, 0, 0, depth / 2 + 0.12, 2, 2.8);
    for (const y of [4.3, ...(height > 11 ? [8.4] : [])])
      for (const side of [-1, 1]) {
        const x = side * width * 0.28;
        doorway(parent, x, y, depth / 2 + 0.1, 1.7, 1.9);
        box(blue, parent, [x - 1, y + 1.05, depth / 2 + 0.3], [0.55, 2.3, 0.18]).rotation.y = -0.35;
        box(blue, parent, [x + 1, y + 1.05, depth / 2 + 0.3], [0.55, 2.3, 0.18]).rotation.y = 0.35;
        soft(parent, plaster, [x, y - 0.25, depth / 2 + 0.3], [2.7, 0.35, 0.6], 0.1);
      }
    // Side windows matter around corners; façades never have a blank back wall.
    for (const side of [-1, 1])
      for (const z of [-depth * 0.25, depth * 0.25])
        box(blue, parent, [side * (width / 2 + 0.08), 4.8, z], [0.14, 2.4, 1.8]);
    if (chapel) {
      mesh(cylinder, plaster, parent, [0, height + 1.8, 0], [width * 0.39, 3.6, width * 0.39]);
      mesh(
        new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        blue,
        parent,
        [0, height + 3.6, 0],
        [width * 0.42, width * 0.42, width * 0.42],
      );
      box(plaster, parent, [0, height + width * 0.42 + 4.2, 0], [0.28, 2.2, 0.28]);
      box(plaster, parent, [0, height + width * 0.42 + 4.6, 0], [1.4, 0.28, 0.28]);
    } else {
      for (const side of [-1, 1])
        soft(parent, plaster, [(side * width) / 2, height + 0.85, 0], [0.3, 1.3, depth], 0.08);
      pot(parent, width * 0.3, height + 0.4, -depth * 0.2, true, 0.8);
    }
    if (shop) awning(parent, width * 0.92, 3.8, depth / 2 + 1.3, variant % 2 ? coral : blue);
    if (variant % 3 === 0) {
      soft(parent, plaster, [0, 7.7, depth / 2 + 0.9], [width * 0.65, 0.4, 2.2], 0.12);
      for (let i = 0; i < 6; i++)
        box(blue, parent, [-width * 0.3 + i * width * 0.12, 8.5, depth / 2 + 2], [0.12, 1.5, 0.12]);
      box(blue, parent, [0, 9.2, depth / 2 + 2], [width * 0.65, 0.12, 0.12]);
    }
    // Bougainvillea climbs plaster and spills over the roof edge.
    if (variant % 2 === 0)
      for (let i = 0; i < 6; i++) {
        const x = -width / 2 + 0.4 + Math.sin(i * 1.9) * 0.5;
        mesh(
          sphere,
          i % 3 ? pink : leaf,
          parent,
          [x, 1.8 + i * 1.3, depth / 2 + 0.3],
          [0.8, 1, 0.5],
        );
      }
    pot(parent, width / 2 - 0.6, 0, depth / 2 + 0.6, true, 0.8);
  }
  return {
    plaster,
    cream,
    blue,
    cobalt,
    coral,
    wood,
    leaf,
    olive,
    pink,
    glow,
    soft,
    pot,
    tree,
    awning,
    house,
  };
}
