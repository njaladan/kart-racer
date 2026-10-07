import * as THREE from "../../vendor/three/three.module.js";
import { mountainHeight } from "../simulation/experience-mechanics.js";
import { PATHWAY_KINDS } from "../courses/pathway-edges.js";

/** Open shoulders, exposed platform faces and irregular environmental clusters. */
export function buildPathwayEdges({ track, kit, textures = {} }) {
  if (!track.course.pathwayEdges) return;
  const { mesh, box, material, groupAt } = kit;
  const materials = new Map();
  const mat = (kind) => {
    if (!materials.has(kind)) {
      const p = PATHWAY_KINDS[kind];
      materials.set(
        kind,
        material(p.color, {
          map: textures[p.material],
          roughness: p.material === "ice" ? 0.45 : 0.88,
          side: THREE.DoubleSide,
        }),
      );
    }
    return materials.get(kind);
  };
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const stone = new THREE.IcosahedronGeometry(1, 1);
  const ball = new THREE.SphereGeometry(1, 12, 8);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
  const cone = new THREE.ConeGeometry(1, 1, 9);
  const torus = new THREE.TorusGeometry(1, 0.22, 6, 16);
  const leaf = material("#669b67", { roughness: 0.9 });
  const dark = material("#695448", { roughness: 0.9 });
  const cream = material("#f2dfb5", { roughness: 0.8 });
  const pink = material("#e7a19f", { roughness: 0.9 });
  const blue = material("#86c7d1", { roughness: 0.6 });

  function strip(section, side, kind) {
    const profile = PATHWAY_KINDS[kind];
    const count = Math.max(
      8,
      Math.ceil(((section.end - section.start) * track.COURSE_LENGTH) / 0.75),
    );
    const positions = [],
      uv = [],
      indices = [];
    // A shoulder is a broad surface, never a thin beam at the road boundary.
    const columns = profile.mode === "soft" ? 4 : 2;
    for (let i = 0; i <= count; i++) {
      const t = section.start + ((section.end - section.start) * i) / count;
      const edge = track.edgeAt(t === section.end ? t - 1e-8 : t, side);
      const frame = track.frameAt(t);
      const lip = track.poseAt(t * track.TRACK, edge.offset, 0).p;
      for (let j = 0; j <= columns; j++) {
        let offset = edge.offset,
          height = lip.y;
        if (profile.mode === "soft") {
          const excess = profile.platform
            ? j === 0
              ? 0
              : profile.shoulder
            : j === 0
              ? 0
              : j === 1
                ? profile.shoulder
                : profile.shoulder + ((j - 1) * 38) / 3;
          offset += side * excess;
          if (profile.platform) height -= Math.max(0, j - 1) * 0.65;
          else {
            const fade = Math.max(0, (excess - profile.shoulder) / 38);
            height += ((track.course.theme.groundHeight ?? -1.7) - lip.y) * fade;
          }
        } else if (profile.mode === "drop") {
          // Vertical exposed shelf, paper fold, quay or rock face; no safety lip.
          offset += side * (j === 0 ? 0 : 0.18);
          height -= j * (["cliff", "lava", "reefdrop"].includes(kind) ? 5 : 0.65);
        } else {
          offset += side * (j === 0 ? 0 : kind === "timber" || kind === "parapet" ? 0.25 : 3.2);
          const variation = 0.84 + 0.13 * Math.sin(t * track.COURSE_LENGTH * 0.17);
          height += j === 0 ? -0.25 : j === 1 ? profile.height * variation : -0.3;
        }
        const p = frame.p.clone().addScaledVector(frame.right, offset);
        p.y =
          track.course.downhill?.section === track.SECTIONS.indexOf(section) &&
          profile.mode === "soft"
            ? mountainHeight(track, p, t) + 0.008
            : height + (profile.mode === "soft" ? 0.008 : 0);
        positions.push(p.x, p.y, p.z);
        uv.push((offset - edge.offset) / 6, (t * track.COURSE_LENGTH) / 6);
        if (i < count && j < columns) {
          const a = i * (columns + 1) + j,
            b = a + columns + 1;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const surface = mesh(geometry, mat(kind));
    surface.name = `${kind} ${profile.mode === "soft" ? "shoulder" : profile.mode === "drop" ? "exposed face" : "structural boundary"}`;
    surface.userData.pathwayEdge = true;
    surface.userData.bakeReceiver = true;
    surface.castShadow = profile.mode === "wall";
  }
  for (const [index, section] of track.SECTIONS.entries()) {
    // Transit and moving train surfaces provide their own exposed sides.
    if (
      track.course.traversals?.some((r) => r.section === index) ||
      track.course.bridgeWave?.section === index ||
      track.course.drumField?.section === index ||
      track.course.branches?.some((b) => b.required && b.section === index)
    )
      continue;
    for (const side of [-1, 1]) {
      const kind = track.course.pathwayEdges[index][side < 0 ? "left" : "right"];
      if (
        track.course.movingDecks?.some(
          (d) => index >= d.section && index <= (d.endSection ?? d.section),
        )
      )
        continue;
      strip(section, side, kind);
    }
  }
  for (const obstacle of track.pathwayObstacles) {
    const { kind, radius: r, height: h, index } = obstacle;
    const g = groupAt(obstacle.t);
    g.position.copy(obstacle.p);
    g.name = `${kind} cluster`;
    g.userData.pathwayEdge = true;
    const m = mat(kind);
    const piece = (geo, material, p, scale) => mesh(geo, material, g, p, scale);
    if (
      [
        "flowers",
        "ferns",
        "crops",
        "hedge",
        "planters",
        "reeds",
        "coral",
        "palms",
        "pines",
      ].includes(kind)
    ) {
      if (kind === "planters") box(dark, g, [0, 0.3, 0], [r * 2, 0.6, r * 2]);
      if (kind === "palms" || kind === "pines") {
        piece(cylinder, dark, [0, h * 0.4, 0], [r, h * 0.8, r]);
        if (kind === "pines") piece(cone, leaf, [0, h * 0.7, 0], [r * 2.5, h * 0.8, r * 2.5]);
        else
          for (let j = 0; j < 5; j++) {
            const frond = piece(ball, leaf, [0, h, 0], [r * 3, 0.15, 0.6]);
            frond.rotation.y = (j * Math.PI) / 5;
          }
      } else
        for (let j = 0; j < 3; j++) {
          const x = Math.sin(j * 2.1) * r * 0.45,
            z = Math.cos(j * 2.1) * r * 0.45;
          if (["coral", "reeds", "crops"].includes(kind)) {
            const stem = piece(cylinder, m, [x, h * 0.4, z], [0.16, h * 0.8, 0.16]);
            stem.rotation.z = Math.sin(j + index) * 0.3;
          }
          piece(
            ball,
            kind === "flowers" ? (index % 2 ? cream : pink) : m,
            [x, h * 0.55, z],
            [r * 0.62, h * 0.5, r * 0.62],
          );
        }
    } else if (["jars", "soap", "lanterns", "columns"].includes(kind)) {
      piece(cylinder, m, [0, h / 2, 0], [r, h, r]);
      piece(cylinder, kind === "soap" ? blue : cream, [0, h, 0], [r * 1.1, 0.17, r * 1.1]);
      if (kind === "jars") box(cream, g, [0, h * 0.55, -r], [r * 1.1, h * 0.4, 0.06]);
      if (kind === "lanterns") piece(cone, dark, [0, h * 1.07, 0], [r * 1.25, 0.3, r * 1.25]);
    } else if (kind === "gears") {
      const gear = piece(torus, m, [0, h * 0.5, 0], [r, h * 0.5, r]);
      gear.rotation.y = index * 0.71;
      for (let j = 0; j < 8; j++) {
        const a = (j * Math.PI) / 4;
        const tooth = piece(
          cube,
          cream,
          [Math.cos(a) * r, h / 2 + (Math.sin(a) * h) / 2, 0],
          [0.45, 0.5, 0.45],
        );
        tooth.rotation.z = a;
      }
    } else if (["cargo", "stalls", "shops", "chalets", "keys", "hay", "biscuits"].includes(kind)) {
      box(m, g, [0, h / 2, 0], [r * 1.9, h, r * 1.9]);
      if (["shops", "chalets", "stalls"].includes(kind)) {
        piece(cone, kind === "stalls" ? pink : dark, [0, h + 0.4, 0], [r * 1.6, 1.1, r * 1.6]);
        box(cream, g, [0, h * 0.65, -r], [r, h * 0.25, 0.05]);
      } else if (kind === "cargo" || kind === "hay") {
        for (const y of [h * 0.25, h * 0.75]) box(cream, g, [0, y, -r], [r * 2, 0.12, 0.08]);
      } else if (kind === "keys") box(dark, g, [0.25, h + 0.18, 0], [r * 0.6, 0.36, r * 1.3]);
      else
        for (let j = 0; j < 5; j++)
          piece(
            ball,
            dark,
            [Math.sin(j * 2.3) * r * 0.7, h * (0.2 + j * 0.14), -r],
            [0.1, 0.1, 0.07],
          );
    } else {
      const object = piece(kind === "folds" ? cone : stone, m, [0, h * 0.45, 0], [r, h * 0.55, r]);
      object.rotation.y = index * 2.399;
      if (kind === "roots") object.rotation.z = 0.55;
    }
  }
}
