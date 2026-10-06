import { installSurfaceDetail } from "../../rendering/surface-detail.js";

/** Foreground pavement, raised planted beds, drainage and working-port props. */
export function buildStreetDressing({ THREE, track, kit, palette, props }) {
  const { material, mesh, box, sectorT, batch } = kit;
  const { concrete, trim, dark, cyan, amber } = palette;
  const { safeGroup, fitAsset, groundShadow } = props;
  const paving = concrete.clone();
  paving.color.set("#839da8");
  installSurfaceDetail(paving, { kind: "terrain", scale: 0.2, strength: 0.2 });
  const gravel = material("#607881", { map: concrete.map, roughness: 0.94 });
  installSurfaceDetail(gravel, { kind: "terrain", scale: 0.31, strength: 0.24 });
  const wet = material("#273c49", { metalness: 0, roughness: 0.12, envMapIntensity: 1.4 });
  const soil = material("#293a34", { roughness: 0.98 });
  // Irregular shallow patches are actual authored surfaces, not road covers.
  const outline = new THREE.Shape();
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2,
      radius = 0.78 + ((i * 17) % 7) / 26;
    const x = Math.cos(angle) * radius,
      y = Math.sin(angle) * radius;
    if (i === 0) outline.moveTo(x, y);
    else outline.lineTo(x, y);
  }
  outline.closePath();
  const puddleGeometry = new THREE.ShapeGeometry(outline);
  const curbGeometry = new THREE.BoxGeometry(1, 1, 1);

  for (let district = 0; district < track.course.sections.length; district++)
    for (let i = 0; i < 22; i++) {
      const t = sectorT(district, (i + 0.5) / 22),
        side = i % 2 ? -1 : 1;
      const surface = track.surfaceAt(t),
        edge = side > 0 ? surface.rightEdge : -surface.leftEdge;
      const g = safeGroup(t, side * (edge + 5.2), 3.2);
      if (!g) continue;
      box(paving, g, [0, 0.1, 0], [4.2, 0.2, 5.5]);
      // Slab joints and a low rounded curb add a legible road-to-city transition.
      for (const z of [-2.65, 0, 2.65]) box(dark, g, [0, 0.203, z], [4, 0.009, 0.035]);
      const curb = mesh(curbGeometry, trim, g, [-side * 2.02, 0.22, 0], [0.24, 0.3, 5.5]);
      curb.castShadow = false;
      if (district === 3) continue; // The elevated quay keeps the open panorama.
      if (i % 4 === 0) {
        const puddle = mesh(puddleGeometry, wet, g, [0.5, 0.21, 0.3], [1.3, 2.1, 1]);
        puddle.rotation.x = -Math.PI / 2;
        puddle.castShadow = false;
      }
      if (i % 4 === 1) {
        fitAsset("harbor:bench", g, [0, 0.21, 0], [2.7, 1.1, 1.1]);
        groundShadow(g, 3.3, 1.8, 0.207);
      }
      if (i % 4 === 2 && district !== 4) {
        const bed = safeGroup(t, side * (edge + 11), 4);
        if (bed) {
          box(concrete, bed, [0, 0.32, 0], [3.8, 0.64, 4.2]);
          box(soil, bed, [0, 0.65, 0], [3.4, 0.08, 3.8]);
          fitAsset("harbor:palm", bed, [0, 0.69, 0], [6.6, 8.4 + (i % 3), 6.6]);
          groundShadow(bed, 6, 6);
        }
      }
      if (i % 5 === 3 && (district === 2 || district === 4)) {
        fitAsset("harbor:pallet", g, [0, 0.2, 0], [2.1, 0.25, 1.8]);
        fitAsset("harbor:pallet", g, [0.12, 0.45, -0.1], [2.1, 0.25, 1.8]);
        fitAsset("harbor:aircon", g, [0, 0.7, 0], [1.6, 1.2, 1.3]);
      }
      // Drains read as shallow cutouts and catch the pavement's lamp pools.
      if (i % 3 === 0) {
        box(dark, g, [-side * 1.5, 0.205, -1.6], [0.55, 0.012, 0.95]);
        for (let k = 0; k < 5; k++)
          box(trim, g, [-side * 1.5, 0.217, -1.98 + k * 0.18], [0.5, 0.015, 0.025]);
      }
      batch(g);
    }
  // Cargo sector has a broad rough apron and compound loading islands.
  for (const district of [2, 4])
    for (let i = 0; i < 7; i++) {
      const t = sectorT(district, 0.06 + i * 0.13),
        side = i % 2 ? -1 : 1;
      if (district === 4 && side > 0 && i >= 3 && i <= 5) continue;
      const g = safeGroup(t, side * 32, 8);
      if (!g) continue;
      box(gravel, g, [0, 0.08, 0], [12, 0.16, 10]);
      for (const x of [-5.6, 5.6]) box(amber, g, [x, 0.17, 0], [0.1, 0.015, 8.6]);
      fitAsset("harbor:container", g, [0, 0.17, -1.5], [3.2, 2.9, 7]);
      fitAsset("harbor:pallet", g, [4.1, 0.17, 1.2], [2, 0.3, 1.8]);
      batch(g);
    }
  for (const v of track.course?.verges || [])
    for (const fraction of [v.startFraction + 0.015, v.endFraction - 0.015]) {
      const t = sectorT(v.section, fraction),
        surface = track.surfaceAt(t);
      const edge = v.side > 0 ? surface.rightEdge : -surface.leftEdge;
      const g = safeGroup(t, v.side * (edge + 2.5), 0.6);
      if (!g) continue;
      box(trim, g, [0, 0.6, 0], [0.16, 1.2, 0.16]);
      box(cyan, g, [0, 1.18, 0], [0.27, 0.12, 0.27]);
    }
}
