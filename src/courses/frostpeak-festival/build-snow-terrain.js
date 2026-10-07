import { sceneryGroundHeight } from "../../rendering/terrain-height.js";
import { installSurfaceDetail } from "../../rendering/surface-detail.js";

/** Sculpted snow alongside every section; terrain never changes driveable road. */
export function buildSnowTerrain({ THREE, scenery, track, kit, textures, edgeOffset }) {
  const snow = kit.material("#e4f0f8", { map: textures.snow, roughness: 0.96 });
  snow.name = "Sculpted snow with blue creases and wind-scoured grain";
  installSurfaceDetail(snow, { kind: "terrain", scale: 0.04, strength: 0.095 });
  const rows = 44,
    columns = 10;
  for (let section = 0; section < track.SECTIONS.length; section++) {
    if (section === track.course.downhill?.section) continue;
    for (const side of [-1, 1]) {
      if (track.edgeAt(kit.sectorT(section, 0.5), side).mode === "drop") continue;
      const positions = [],
        colors = [],
        uv = [],
        indices = [],
        valid = [];
      for (let row = 0; row <= rows; row++) {
        const t = kit.sectorT(section, row / rows);
        const phase = (t * track.COURSE_LENGTH) / 18;
        for (let column = 0; column <= columns; column++) {
          const u = column / columns;
          const margin = track.edgeAt(t, side).shoulder + 2.8 + u * 26;
          const p = track.poseAt(t * track.TRACK, edgeOffset(t, side, margin), 0).p;
          const projection = track.projectTrack(p, 0, true);
          const edge = projection.offset > 0 ? projection.rightEdge : -projection.leftEdge;
          const clear = projection.distance > edge + 2.1;
          const envelope = Math.pow(Math.sin(u * Math.PI), 1.8);
          const windRidge =
            0.55 + 0.35 * Math.sin(phase + side * 1.2) + 0.15 * Math.cos(phase * 2.6 + u * 8);
          const mound = envelope * (section === 2 || section === 4 ? 6 : 2.7) * windRidge;
          p.y = sceneryGroundHeight(projection) + 0.045 + mound;
          positions.push(p.x, p.y, p.z);
          // Creases carry cool indirect shading; scan UVs stay world-aligned.
          const crease = Math.min(
            1,
            0.91 + envelope * 0.05 + Math.sin(phase * 1.8 + u * 5) * 0.025,
          );
          colors.push(crease * 0.97, crease * 0.99, crease);
          uv.push(p.x * 0.085, p.z * 0.085);
          valid.push(clear);
          if (row < rows && column < columns) {
            const a = row * (columns + 1) + column,
              b = a + columns + 1;
            // Connectivity checked once all positions have been generated.
            indices.push(a, b, a + 1, a + 1, b, b + 1);
          }
        }
      }
      const safeIndices = [];
      for (let i = 0; i < indices.length; i += 3) {
        const tri = indices.slice(i, i + 3);
        if (tri.every((index) => valid[index])) {
          if (side > 0) safeIndices.push(...tri.reverse());
          else safeIndices.push(...tri);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(safeIndices);
      geo.computeVertexNormals();
      const skirt = kit.mesh(geo, snow, scenery);
      skirt.name = `Sculpted snowbank sector ${section} side ${side}`;
      skirt.castShadow = false;
      skirt.userData.bakeReceiver = true;
    }
    // Authored snow-rock islands and frost bushes create small-scale parallax.
    for (let i = 0; i < 11; i++) {
      for (const side of [-1, 1]) {
        const t = kit.sectorT(section, (i + 0.4) / 11);
        const height = 2.3 + (i % 4) * 0.45;
        const g = kit.safeGroup(t, edgeOffset(t, side, 8.5 + (i % 3) * 2), height * 1.55);
        if (!g) continue;
        g.rotation.y += i * 2.39;
        g.name = "Layered rock and frost shrub island";
        if (i % 3 !== 1)
          kit.asset("frostpeak:snow-rock", g, [0, -0.12, 0], [height, height, height]);
        kit.asset("frostpeak:snow-bush", g, [side * 2.2, -0.12, 1.1], [1.9, 1.65, 1.9]);
        if (i % 3 === 0)
          kit.asset("frostpeak:snow-bush", g, [-side * 2.5, -0.18, -2], [1.4, 1.2, 1.4]);
      }
    }
  }
}
