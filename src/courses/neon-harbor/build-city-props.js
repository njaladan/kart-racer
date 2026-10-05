import { addGlow, createContactShadowMesh } from "../../rendering/visual-effects.js";

/** Facade, lamp, and safe-placement factories for the port city. */
export function buildCityProps({ industrialModels, kit, scenery, track, palette, geometry }) {
  const { asset, batch, box, groupAt, mesh } = kit;
  const {
    amber,
    blue,
    cloth,
    concrete,
    cyan,
    dark,
    glass,
    masonry,
    paleMasonry,
    pink,
    steel,
    trim,
    window,
  } = palette;
  const { cylinder, ring } = geometry;
  function groundShadow(parent, width, depth, y = 0.035) {
    const shadow = createContactShadowMesh({ width, depth, opacity: 0.24 });
    shadow.position.y = y;
    parent.add(shadow);
  }

  // Test the complete circumscribed footprint against every route segment.
  // Large buildings can otherwise overlap an adjacent street on an S-bend.
  function safeGroup(t, offset, radius) {
    const pose = track.poseAt(t * track.TRACK, offset, 0);
    const p = track.projectTrack(pose.p, t * track.TRACK, true);
    const edge = p.offset > 0 ? p.rightEdge : -p.leftEdge;
    if (p.distance < edge + radius + 2) return null;
    return kit.landGroup ? kit.landGroup(t, offset, scenery) : groupAt(t, offset, scenery);
  }
  function building(t, offset, width, height, depth, index) {
    const g = safeGroup(t, offset, Math.hypot(width, depth) / 2);
    if (!g) return;
    if (Math.abs(offset) < 50) groundShadow(g, width * 1.35, depth * 1.35);
    box(index % 3 ? masonry : paleMasonry, g, [0, height / 2, 0], [width, height, depth]);
    // Light edge strips suggest chamfered corners and dressed masonry.
    for (const x of [-width / 2 + 0.14, width / 2 - 0.14])
      for (const z of [-depth / 2 + 0.14, depth / 2 - 0.14])
        box(trim, g, [x, height / 2, z], [0.28, height, 0.28]);
    for (const y of [1.4, Math.min(height - 1, 8), height - 0.35])
      box(trim, g, [0, y, 0], [width + 0.4, 0.24, depth + 0.4]);
    box(dark, g, [0, height + 0.35, 0], [width + 1, 0.7, depth + 1]);
    if (index % 3 === 0) {
      box(concrete, g, [0, height + 2.1, 0], [width * 0.7, 3.5, depth * 0.7]);
      box(blue, g, [0, height + 4, 0], [width * 0.75, 0.35, depth * 0.75]);
      box(cyan, g, [0, height + 3.6, depth * 0.355], [width * 0.58, 0.25, 0.08]);
    } else if (index % 3 === 1) {
      for (const side of [-1, 1]) {
        const roof = box(
          blue,
          g,
          [side * width * 0.23, height + 1.5, 0],
          [width * 0.55, 0.35, depth * 0.96],
        );
        roof.rotation.z = side * -0.27;
      }
    } else {
      mesh(cylinder, steel, g, [width * 0.18, height + 2, 0], [1.5, 3.4, 1.5]);
      box(amber, g, [-width * 0.23, height + 1.3, -depth * 0.15], [2.5, 1.8, 2.5]);
      box(steel, g, [-width * 0.23, height + 2.7, -depth * 0.15], [0.2, 1, 0.2]);
    }
    for (let row = 0; row < Math.floor(height / 4); row++)
      for (let col = 0; col < Math.floor(width / 3); col++) {
        if ((row + col + index) % 4 === 0) continue;
        for (const side of [-1, 1]) {
          const x = -width / 2 + 1.6 + col * 3,
            y = 2 + row * 4,
            z = side * (depth / 2 + 0.08);
          box(glass, g, [x, y, z], [1.65, 2.1, 0.08]);
          box(window, g, [x, y, z + side * 0.06], [1.24, 1.65, 0.06]);
          box(trim, g, [x, y - 1.12, z + side * 0.08], [1.85, 0.16, 0.22]);
          box(steel, g, [x, y, z + side * 0.1], [0.08, 1.85, 0.05]);
        }
      }
    box(
      index % 3 ? cyan : pink,
      g,
      [0, Math.min(height - 1, 7), depth / 2 + 0.1],
      [width * 0.85, 0.25, 0.12],
    );
    // Street-level recessed storefront, canopy, ducts and fire-escape frames
    // distinguish the facade from a stack of repeated glowing rectangles.
    box(dark, g, [0, 1.9, depth / 2 + 0.07], [width * 0.65, 3.3, 0.13]);
    box(glass, g, [0, 1.9, depth / 2 + 0.17], [width * 0.59, 2.9, 0.08]);
    box(index % 2 ? cyan : window, g, [0, 3.5, depth / 2 + 0.2], [width * 0.62, 0.12, 0.12]);
    for (const x of [-width * 0.21, 0, width * 0.21])
      box(trim, g, [x, 1.9, depth / 2 + 0.23], [0.12, 3.2, 0.1]);
    const canopy = box(
      index % 2 ? blue : cloth,
      g,
      [0, 3.9, depth / 2 + 0.8],
      [width * 0.72, 0.16, 1.7],
    );
    canopy.rotation.x = 0.1;
    for (let floor = 0; floor < Math.floor(height / 7); floor++) {
      box(steel, g, [width / 2 + 0.65, 4 + floor * 6, 0], [1.4, 0.17, depth * 0.55]);
      box(steel, g, [width / 2 + 1.26, 4.8 + floor * 6, 0], [0.1, 1.5, depth * 0.55]);
      box(amber, g, [width / 2 + 0.08, 4.8 + floor * 6, -depth * 0.3], [0.22, 1.2, 0.6]);
    }
    box(steel, g, [-width * 0.27, height + 1.1, depth * 0.22], [2.2, 1.6, 2.7]);
    for (let j = 0; j < 4; j++)
      box(trim, g, [-width * 0.27, height + 1.95, depth * 0.08 + j * 0.27], [2, 0.08, 0.1]);
    // Shape-only luminous rooftop symbol; no roadside text is needed.
    const emblem = mesh(ring, index % 2 ? pink : cyan, g, [0, height + 3.5, depth * 0.3]);
    box(steel, g, [0, height + 1.6, depth * 0.3], [0.15, 3, 0.15]);
    emblem.rotation.z = index * 0.27;
    if (Math.abs(offset) < 50 && index % 3 === 0)
      addGlow(g, {
        color: index % 2 ? "#ff7dc8" : "#76f0ed",
        size: 5.2,
        opacity: 0.24,
        position: [0, height + 3.5, depth * 0.3 + 0.2],
      });
    batch(g);
  }
  // The industrial kit's factory silhouettes add authored roof shapes and
  // window color breakup to the port skyline. Fit each source mesh to the
  // established scenery footprint so camera clearance and road splines stay
  // under course control.
  function industrialBuilding(t, offset, width, height, depth, index) {
    const g = safeGroup(t, offset, Math.hypot(width, depth) / 2);
    if (!g || !asset) return null;
    const model = industrialModels[Math.abs(index) % industrialModels.length];
    const imported = asset(
      `kenney:city-kit-industrial/${model}`,
      g,
      [0, 0, 0],
      [width, height, depth],
    );
    if (imported) {
      if (Math.abs(offset) < 50) groundShadow(g, width * 1.35, depth * 1.35);
      batch(g);
    }
    return imported;
  }
  function lamp(t, offset, index) {
    const g = safeGroup(t, offset, 1.3);
    if (!g) return;
    box(steel, g, [0, 4.5, 0], [0.22, 9, 0.22]);
    box(steel, g, [-Math.sign(offset) * 0.65, 8.8, 0], [1.4, 0.18, 0.2]);
    box(index % 2 ? cyan : window, g, [-Math.sign(offset) * 1.1, 8.65, 0], [0.7, 0.18, 0.55]);
    if (index % 2 === 0) {
      addGlow(g, {
        color: "#ffe4a0",
        size: 3.6,
        opacity: 0.28,
        position: [-Math.sign(offset) * 1.1, 8.58, 0],
      });
    }
  }

  return { safeGroup, groundShadow, building, industrialBuilding, lamp };
}
