import * as THREE from "../../../vendor/three/three.module.js";
import { sceneryGroundHeight } from "../../rendering/terrain-height.js";
import { TRACK, SECTIONS, poseAt, projectTrack, surfaceAt } from "../../track/track.js";

/** Authored branch/cutout foliage in layered stands, rather than solid toy crowns. */
export function buildWindmillVegetation({ scenery, mats, textures, primitives, random, kit }) {
  const { sectorT } = primitives;
  const asset = (name, parent, size = 1) =>
    kit.asset(`windmill:${name}`, parent, [0, 0, 0], [size, size, size]);
  const planted = (t, offset, footprint) => kit.safeGroup(t, offset, footprint, scenery);
  const trees = ["oak", "orchard", "willow"];
  function tree(section, fraction, side, clearance, height, species) {
    const t = sectorT(section, fraction),
      s = surfaceAt(t);
    const edge = side > 0 ? s.rightEdge : -s.leftEdge;
    const g = planted(t, side * (edge + clearance), height * (species === "fir" ? 0.16 : 0.3));
    if (!g) return;
    g.name = `Authored ${species} canopy, sector ${section}`;
    g.rotation.y += random() * Math.PI * 2;
    const m = asset(species, g, height);
    m.scale.x *= 0.9 + random() * 0.2;
    m.scale.z *= 0.9 + random() * 0.2;
  }
  // Staggered depth: close silhouettes, irregular middle stands, economical
  // far cutouts. Clearings expose the next bend and the landmark silhouettes.
  for (let i = 0; i < 84; i++) {
    const f = 0.025 + random() * 0.95;
    const side = i % 2 ? 1 : -1;
    const layer = i % 3;
    tree(1, f, side, [9, 23, 42][layer] + random() * 8, 13 + random() * 8, "fir");
  }
  for (const section of [0, 5])
    for (let i = 0; i < (section === 0 ? 32 : 62); i++) {
      const side = i % 2 ? 1 : -1;
      const f = 0.035 + random() * 0.93;
      const species = section === 5 ? (i % 4 ? "orchard" : "oak") : trees[i % 3];
      tree(
        section,
        f,
        side,
        8 + (i % 3) * 13 + random() * 5,
        section === 5 ? 7 + random() * 3.2 : 9 + random() * 5,
        species,
      );
    }
  for (const section of [2, 3, 4])
    for (let i = 0; i < 16; i++)
      tree(
        section,
        0.04 + random() * 0.92,
        i % 2 ? 1 : -1,
        12 + random() * 24,
        9 + random() * 6,
        section === 3 ? "willow" : i % 2 ? "oak" : "fir",
      );

  // Garden islands repeat a small authored kit with shared textures. Ground
  // coverage is clustered along readable views, keeping the racing edge open.
  for (let section = 0; section < SECTIONS.length; section++)
    for (let i = 0; i < 28; i++) {
      const side = i % 2 ? 1 : -1,
        t = sectorT(section, 0.03 + random() * 0.94);
      const s = surfaceAt(t),
        edge = side > 0 ? s.rightEdge : -s.leftEdge;
      const g = planted(t, side * (edge + 3.8 + random() * 10), 1.5);
      if (!g) continue;
      g.name = `Countryside planted verge ${section}`;
      for (let j = 0; j < 3; j++) {
        const name =
          section === 1
            ? j
              ? "fern"
              : "grass-tuft"
            : section === 3
              ? "cattail"
              : j === 0
                ? "flower-bush"
                : "grass-tuft";
        const height =
          name === "flower-bush"
            ? 0.7 + random() * 0.45
            : name === "cattail"
              ? 1.5 + random() * 0.6
              : 0.5 + random() * 0.7;
        const m = asset(name, g, height);
        m.position.set((j - 1) * 1.35, 0.025, random() * 1.8 - 0.9);
        m.rotation.y = random() * Math.PI * 2;
      }
    }

  const terrainMat = new THREE.MeshStandardMaterial({
    color: "#819c65",
    map: mats.grass.map || textures?.leaves || null,
    roughness: 1,
    vertexColors: true,
  });
  // Sculpted heightfields form the distant valley. No oversized sphere hills
  // or floating sphere clouds: the sky shader handles cloud layers instead.
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI * 2) / 12,
      r = 520 + Math.sin(i * 2.1) * 38;
    const cx = Math.cos(a) * r,
      cz = Math.sin(a) * r;
    const n = 28,
      width = 250,
      depth = 185;
    const positions = [],
      colors = [],
      uv = [],
      index = [];
    for (let z = 0; z <= n; z++)
      for (let x = 0; x <= n; x++) {
        const u = (x / n) * 2 - 1,
          v = (z / n) * 2 - 1;
        const fade = Math.pow(Math.max(0, 1 - u * u), 1.6) * Math.pow(Math.max(0, 1 - v * v), 1.4);
        const y =
          -2 +
          fade *
            (35 +
              22 * Math.sin(i * 1.9) ** 2 +
              9 * Math.sin(u * 5.3 + v * 3.1 + i) +
              6 * Math.cos(v * 6.2 - u));
        positions.push(cx + (u * width) / 2, y, cz + (v * depth) / 2);
        uv.push((cx + (u * width) / 2) / 12, (cz + (v * depth) / 2) / 12);
        const patch = 0.88 + 0.12 * Math.sin(u * 7 + v * 8 + i);
        const haze = i % 3 === 0 ? 0.92 : 1;
        colors.push(patch * 0.86 * haze, patch, patch * 0.89);
        if (x < n && z < n) {
          const k = z * (n + 1) + x;
          index.push(k, k + n + 1, k + 1, k + 1, k + n + 1, k + n + 2);
        }
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(index);
    geo.computeVertexNormals();
    const hill = new THREE.Mesh(geo, terrainMat);
    hill.name = "Sculpted valley horizon";
    hill.userData.bakeReceiver = true;
    hill.receiveShadow = true;
    hill.castShadow = false;
    scenery.add(hill);
  }

  // Small irregular raised soil beds add a visible transition from asphalt to
  // living ground. Sample actual course banks and reject all racing surfaces.
  const bedMat = new THREE.MeshStandardMaterial({
    color: "#9caa70",
    map: mats.grass.map,
    roughness: 1,
    vertexColors: true,
  });
  for (let section = 0; section < SECTIONS.length; section++)
    for (let i = 0; i < 6; i++) {
      const t = sectorT(section, 0.08 + i * 0.16),
        side = i % 2 ? 1 : -1;
      const s = surfaceAt(t),
        edge = side > 0 ? s.rightEdge : -s.leftEdge;
      const f = poseAt(t * TRACK, side * (edge + 12), 0);
      const n = 9,
        pos = [],
        uv = [],
        col = [],
        idx = [];
      for (let z = 0; z <= n; z++)
        for (let x = 0; x <= n; x++) {
          const u = (x / n) * 2 - 1,
            v = (z / n) * 2 - 1;
          const p = f.p
            .clone()
            .addScaledVector(f.right, u * 6)
            .addScaledVector(f.tangent, v * 10);
          const surface = projectTrack(p, 0, true);
          const physical = surface.offset > 0 ? surface.rightEdge : -surface.leftEdge;
          const raised =
            surface.distance > physical + 1 ? 0.55 * Math.max(0, (1 - u * u) * (1 - v * v)) : -0.07;
          p.y = sceneryGroundHeight(surface) + raised;
          pos.push(p.x, p.y + 0.018, p.z);
          uv.push(p.x / 6, p.z / 6);
          const soil = Math.max(0, 1 - u * u) * Math.max(0, 1 - v * v);
          col.push(1 - soil * 0.2, 1 - soil * 0.19, 1 - soil * 0.3);
          if (x < n && z < n) {
            const k = z * (n + 1) + x;
            idx.push(k, k + n + 1, k + 1, k + 1, k + n + 1, k + n + 2);
          }
        }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, bedMat);
      m.userData.bakeReceiver = true;
      m.receiveShadow = true;
      m.name = "Raised landscaped turf and soil bed";
      scenery.add(m);
    }
}
