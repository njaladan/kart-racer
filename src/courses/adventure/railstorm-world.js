import { worldKit } from "./world-kit.js";
import { buildExpressCars } from "./railstorm-train.js";
import { registerLightPool } from "../../rendering/course-lighting.js";

/** Train decks themselves are the racing surface; no static road under them. */
export function buildRailstorm(context) {
  const w = worldKit(context),
    { THREE, scene, scenery, track, mat, mesh, box, at, safe, motion, cylinder, sphere, tube } = w;
  const iron = mat("#425b69", "metal", { metalness: 0.55 }),
    red = mat("#bc694b", "metal"),
    cream = mat("#e1c395"),
    wood = mat("#9d886b", "wood"),
    dark = mat("#343c4a"),
    silver = mat("#bac9cb", "metal", { metalness: 0.6 }),
    stone = mat("#88949b", "rock"),
    moss = mat("#668875", "leaves"),
    glow = mat("#ffe1a3", "metal", { emissive: "#eab87b", emissiveIntensity: 0.65 });
  const river = mat("#709999", "water", { roughness: 0.24, metalness: 0.2 });
  const definition = track.course.movingDecks[0];
  const vehicles = buildExpressCars(w, { iron, cream, wood, dark, silver, glow });
  // Covered docks hide the convoy's analytic return and overlap its clipped ends.
  for (const t of [
    track.sectorT(definition.section, definition.startFraction),
    track.sectorT(definition.endSection, definition.endFraction),
  ]) {
    const g = w.groupAt(t);
    box(wood, g, [0, -0.18, 0], [23, 0.35, definition.dockLength * 2]);
    for (const side of [-1, 1])
      for (const z of [-48, -24, 0, 24, 48]) box(iron, g, [side * 13, 10, z], [0.8, 20, 0.8]);
    box(red, g, [0, 21, 0], [30, 1.6, 110]);
    for (const side of [-1, 1]) box(cream, g, [side * 13, 15, 0], [1, 4, 110]);
    box(glow, g, [0, 19, 0], [5, 0.2, 90]);
    g.updateWorldMatrix(true, false);
    registerLightPool(scene, {
      position: g.localToWorld(new THREE.Vector3(0, 14, 0)),
      color: "#ffd3a2",
      intensity: 45,
      radius: 40,
    });
  }
  // A proper rail bed, trestles and continuous bridge chords beneath the train.
  for (let section = 2; section <= 4; section++) {
    w.sweep(section, 0, 1, -12, 12, stone, -5.5);
    for (const side of [-1, 1]) {
      w.sweep(section, 0, 1, side * 4.7, side * 5.1, silver, -4.7);
      w.sweep(section, 0, 1, side * 11.8, side * 12.5, iron, -6.5);
    }
    for (let i = 0; i < 24; i++) {
      const g = at(section, (i + 0.5) / 24);
      box(wood, g, [0, -5, 0], [16, 0.4, 1.4]);
      if (i % 3 === 0) {
        const height = g.position.y + 23;
        for (const side of [-1, 1]) box(iron, g, [side * 10, -height / 2 - 6, 0], [1.5, height, 2]);
        tube(g, [-10, -6, 0], [10, -height - 6, 0], 0.7, iron);
        tube(g, [10, -6, 0], [-10, -height - 6, 0], 0.7, iron);
      }
    }
    // Close, repeated trackside details make the train's speed readable from its roof.
    const markerCount = Math.ceil(
      ((track.SECTIONS[section].end - track.SECTIONS[section].start) * track.COURSE_LENGTH) / 14,
    );
    for (let i = 0; i < markerCount; i++) {
      for (const side of [-1, 1]) {
        const g = at(section, (i + 0.5) / markerCount, side * 15.5);
        box(iron, g, [0, 1, 0], [0.35, 12, 0.35]);
        box(cream, g, [0, 4.5, 0], [0.9, 1.6, 0.25]);
        box(red, g, [0, 4.5, -0.14], [0.92, 0.3, 0.06]);
        if (i % 3 === 0) {
          box(wood, g, [0, 10, 0], [0.5, 25, 0.5]);
          box(iron, g, [0, 20, 0], [5, 0.25, 0.3]);
          for (const x of [-2, 0, 2]) mesh(sphere, glow, g, [x, 20.4, 0], [0.18, 0.3, 0.18]);
        }
      }
    }
  }
  // The locomotive leads a separate visible parallel track during the chase.
  const locomotive = new THREE.Group();
  locomotive.userData.environmentSource = "express-boiler";
  scenery.add(locomotive);
  if (context.kit.hasAsset("art:steam-engine")) {
    context.kit.asset("art:steam-engine", locomotive, [0, 0, 0], [18, 18, 18]);
  } else {
    box(iron, locomotive, [0, 3.5, 0], [13, 7, 31]);
    mesh(cylinder, red, locomotive, [0, 8, -4], [5, 19, 5]).rotation.x = Math.PI / 2;
    box(red, locomotive, [0, 10, 10], [14, 13, 9]);
    box(cream, locomotive, [0, 17, 10], [17, 1, 12]);
    mesh(cylinder, iron, locomotive, [0, 15, -8], [2, 10, 2]);
    for (const side of [-1, 1]) {
      box(glow, locomotive, [side * 4, 11, 5.4], [4, 4, 0.3]);
      for (const z of [-11, -4, 3, 11])
        mesh(cylinder, dark, locomotive, [side * 7, 1, z], [2, 1, 2]).rotation.z = Math.PI / 2;
      tube(locomotive, [side * 7.6, 1, -11], [side * 7.6, 1, 11], 0.35, cream);
    }
  }
  context.kit.batch(locomotive);
  motion(locomotive, (time) => {
    const t = track.sectorT(1, ((time * 9) % 180) / 180);
    w.align(locomotive, track.poseAt(t * track.TRACK, 32, -2));
  });
  w.sweep(1, 0, 1, 20, 44, stone, -6);
  for (const offset of [27.5, 36.5]) w.sweep(1, 0, 1, offset - 0.2, offset + 0.2, iron, -2.7);
  // A silver-green river winds beneath the freight viaduct, bounded by gorge walls.
  const riverPositions = [],
    riverIndices = [],
    riverUV = [];
  for (let i = 0; i <= 320; i++) {
    const t = track.sectorT(2, 0) + ((track.sectorT(5, 0) - track.sectorT(2, 0)) * i) / 320;
    for (const side of [-1, 1]) {
      const p = track.poseAt(t * track.TRACK, side * (18 + Math.sin(i * 0.13) * 3)).p;
      riverPositions.push(p.x, -21.5, p.z);
      riverUV.push(side, i / 8);
    }
    if (i < 320) {
      const q = i * 2;
      riverIndices.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
    }
  }
  const riverGeo = new THREE.BufferGeometry();
  riverGeo.setAttribute("position", new THREE.Float32BufferAttribute(riverPositions, 3));
  riverGeo.setAttribute("uv", new THREE.Float32BufferAttribute(riverUV, 2));
  riverGeo.setIndex(riverIndices);
  riverGeo.computeVertexNormals();
  mesh(riverGeo, river).castShadow = false;
  // Ironvale station: pitched slate roofs, window rhythm and a busy platform.
  function building(g, width, height, length, color) {
    if (context.kit.hasAsset("art:old-house")) {
      context.kit.asset("art:old-house", g, [0, 0, 0], [height * 1.4, height * 1.4, height * 1.4]);
      return;
    }
    box(cream, g, [0, height / 2, 0], [width, height, length]);
    const roof = mesh(
      new THREE.CylinderGeometry(1, 1, 1, 3),
      color,
      g,
      [0, height + 3, 0],
      [width * 0.8, length + 4, 6],
    );
    roof.rotation.x = Math.PI / 2;
    roof.rotation.z = Math.PI;
    for (let j = 0; j < 6; j++) {
      box(
        iron,
        g,
        [-width * 0.4 + j * width * 0.16, height * 0.4, length / 2 + 0.1],
        [width * 0.09, height * 0.45, 0.2],
      );
      box(
        glow,
        g,
        [-width * 0.4 + j * width * 0.16, height * 0.8, length / 2 + 0.2],
        [width * 0.09, 2, 0.2],
      );
    }
  }
  const station = at(0, 0.25, -50);
  building(station, 60, 22, 22, red);
  for (let i = 0; i < 9; i++) {
    const g = at(0, 0.08 + i * 0.1, 23);
    box(wood, g, [0, 2, 0], [8, 0.4, 2]);
    for (const side of [-1, 1]) box(iron, g, [side * 3, 1, 0], [0.2, 2, 1.5]);
    box(red, g, [0, 5, -1], [9, 2, 0.5]);
    mesh(cylinder, cream, g, [5, 1.3, 3], [1.2, 2.6, 1.2]);
    const worker = mesh(sphere, red, g, [-5, 2, 2], [0.7, 1.8, 0.7]);
    motion(worker, (time) => {
      worker.rotation.z = Math.sin(time * 0.8 + i) * 0.08;
    });
    mesh(sphere, cream, g, [-5, 4, 2], [0.6, 0.6, 0.6]);
  }
  for (const section of [0, 5, 6])
    for (let i = 0; i < 6; i++) {
      const g = safe(section, (i + 0.5) / 6, (i % 2 ? 1 : -1) * 51, 15);
      if (!g) continue;
      building(g, 26, 15 + (i % 3) * 4, 18, iron);
      for (let j = 0; j < 3; j++) box(wood, g, [-10 + j * 8, 2, 15], [6, 4, 5]);
    }
  // Sculpted mountain walls, distant ridges and wet green cliff ledges.
  for (const section of [1, 5, 6])
    for (const side of [-1, 1]) {
      w.ridge(section, side, side > 0 ? "#82969a" : "#5e7680", 35, 16, side > 0 ? 65 : 38);
      for (let i = 0; i < 8; i++) {
        const g = safe(section, (i + 0.5) / 8, side * 60, 12);
        if (!g) continue;
        mesh(sphere, moss, g, [0, 2, 0], [13, 4, 13]);
        for (let j = 0; j < 3; j++) {
          if (context.kit.hasAsset("art:fir")) {
            context.kit.asset("art:fir", g, [-8 + j * 8, 0, 0], [23, 23, 23]);
            continue;
          }
          box(wood, g, [-8 + j * 8, 6, 0], [1, 12, 1]);
          mesh(new THREE.ConeGeometry(1, 1, 7), moss, g, [-8 + j * 8, 12, 0], [5, 16, 5]);
        }
        const far = at(section, (i + 0.5) / 8, side * (170 + i * 8));
        mesh(w.rock, stone, far, [0, 5, 0], [55, 85 + (i % 3) * 30, 55]);
      }
    }
  // Signal gantries and telegraph wires guide the driver between districts.
  for (let section = 0; section < 7; section++)
    for (let i = 0; i < 3; i++) {
      const t = track.sectorT(section, 0.15 + i * 0.32);
      const half = Math.max(Math.abs(track.platformEdgeAt(t, -1)), track.platformEdgeAt(t, 1)) + 4;
      const g = at(section, 0.15 + i * 0.32);
      for (const side of [-1, 1]) {
        const foundation = g.position.y - track.course.theme.groundHeight;
        box(iron, g, [side * half, -foundation / 2, 0], [0.5, foundation, 0.5]);
        box(iron, g, [side * half, 12, 0], [0.5, 24, 0.5]);
        mesh(
          sphere,
          section === 2 || section === 5 ? glow : red,
          g,
          [side * half, 20, 0],
          [0.6, 0.6, 0.6],
        );
      }
      tube(g, [-17, 24, 0], [17, 24, 0], 0.3, iron);
    }
  w.points("#c1d3c7", [1, 5, 6], 90, 0.22);
  return { ...w.finish(), vehicles };
}
