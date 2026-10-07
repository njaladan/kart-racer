import { worldKit } from "./world-kit.js";
import { unfoldPhase } from "../../simulation/course-mechanics.js";
import { registerLightPool } from "../../rendering/course-lighting.js";
import { patchMaterial } from "../../rendering/surface-detail.js";
import { createRouteClearance } from "../../rendering/route-clearance.js";

/** A folded, inhabited festival; its paper apron really becomes driveable. */
export function buildPaper(context) {
  const w = worldKit(context),
    { THREE, scene, track, mat, mesh, box, at, motion, tube, sphere, cylinder } = w;
  const colors = ["#fff1cc", "#e98b9e", "#8b98c9", "#75b6aa", "#f4bc64"];
  const allows = createRouteClearance(track);
  const clearFold = (g, t, side, center, size) => {
    for (let i = 0; i < 10; i++) {
      if (allows(g, center, size)) return true;
      g.position.addScaledVector(track.frameAt(t).right, side * 18);
    }
    g.removeFromParent();
    return false;
  };
  const papers = colors.map((color) => {
    const m = mat(color, "fabric", { side: THREE.DoubleSide, roughness: 0.92 });
    patchMaterial(m, "paper-fibres", (shader) => {
      shader.vertexShader = `varying vec3 vPaper;\n${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvPaper=position;",
      );
      shader.fragmentShader = `varying vec3 vPaper;\n${shader.fragmentShader}`;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
      float fibre=sin(vPaper.x*175.+sin(vPaper.y*80.))*sin(vPaper.z*133.+vPaper.y*19.);
      diffuseColor.rgb*=.98+fibre*.025;`,
      );
    });
    return m;
  });
  const ink = mat("#725777"),
    bamboo = mat("#ad826c", "wood"),
    gold = mat("#e2ba69", "metal"),
    glow = mat("#ffdb93", "paper", { emissive: "#ffb46c", emissiveIntensity: 0.7 });
  function folded(
    vertices,
    indices,
    material,
    parent,
    position = [0, 0, 0],
    scale = [1, 1, 1],
    authored = null,
  ) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return mesh(
      authored ? context.kit.authoredGeometry(authored, geo) : geo,
      material,
      parent,
      position,
      scale,
    );
  }
  // Original pointed crane: separate wing pivots give a real origami silhouette.
  function crane(parent, position, size, color = 0, flap = false) {
    const g = new THREE.Group();
    parent.add(g);
    g.position.set(...position);
    g.scale.setScalar(size);
    folded(
      [
        0, 0, -1, -0.6, -0.35, 0, 0, 0.3, 0.6, 0.6, -0.35, 0, 0, 0, 1.3, 0, 0.8, -0.8, 0, 1.2, -1.3,
        0.3, 0.85, -1.5,
      ],
      [0, 1, 2, 0, 2, 3, 1, 4, 2, 3, 2, 4, 0, 5, 1, 0, 3, 5, 5, 6, 7],
      papers[color],
      g,
      [0, 0, 0],
      [1, 1, 1],
      "blender:paper-body",
    );
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      g.add(wing);
      folded(
        [0, 0, 0, side * 2.7, 0.4, -0.35, side * 0.65, 0.2, 1.2, side * 1.1, 0.7, 0.2],
        [0, 1, 3, 0, 3, 2, 1, 2, 3],
        papers[(color + 1) % 5],
        wing,
        [0, 0, 0],
        [1, 1, 1],
        `blender:paper-wing-${side > 0 ? "right" : "left"}`,
      );
      if (flap)
        motion(wing, (time) => {
          wing.rotation.z = side * Math.sin(time * 1.7 + size) * 0.16;
        });
    }
    return g;
  }
  function pavilion(parent, size, color) {
    const g = new THREE.Group();
    parent.add(g);
    g.scale.setScalar(size);
    box(ink, g, [0, 0.8, 0], [23, 1.6, 23]);
    for (let tier = 0; tier < 4; tier++) {
      const r = 13 - tier * 2,
        y = 2 + tier * 8;
      for (const x of [-r * 0.65, r * 0.65])
        for (const z of [-r * 0.65, r * 0.65]) box(bamboo, g, [x, y + 3, z], [0.75, 6, 0.75]);
      box(papers[color], g, [0, y + 3, 0], [r * 1.2, 6, r * 1.2]);
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2,
          roof = folded(
            [-r, 0, -r, r, 0, -r, 0, 5, 0, 0, 0, 0],
            [0, 1, 2],
            papers[(color + tier) % 5],
            g,
            [0, y + 6, 0],
          );
        roof.rotation.y = a;
        tube(g, [-r, y + 6, -r], [r, y + 6, -r], 0.15, gold);
      }
      for (const x of [-r * 0.6, 0, r * 0.6]) box(ink, g, [x, y + 3, -r * 0.61], [0.4, 5, 0.2]);
    }
    crane(g, [0, 41, 0], 3, color, true);
  }
  // Continuous folded banks and low zigzag mountains fill all distances.
  for (let section = 0; section < 8; section++) {
    for (const side of [-1, 1]) {
      if (track.edgeAt(track.sectorT(section, 0.5), side).mode === "soft")
        w.sweep(
          section,
          0,
          1,
          (t) => track.edgeAt(t, side).offset,
          (t) => track.platformEdgeAt(t, side),
          papers[(section + (side > 0 ? 1 : 2)) % 5],
          -0.15,
        );
      for (let i = 0; i < 8; i++) {
        const t = track.sectorT(section, (i + 0.5) / 8),
          edge = side > 0 ? track.surfaceAt(t).rightEdge : -track.surfaceAt(t).leftEdge;
        const changing = track.branches.some((b) => b.section === section);
        const g = w.groupAt(t, side * (edge + (changing ? 95 : 22)));
        if (!clearFold(g, t, side, [0, 11, 2], [38, 36, 30])) continue;
        folded(
          [-18, -5, -12, 18, -5, -12, 0, 13 + (i % 3) * 7, 0, -14, -5, 16, 18, -5, 16],
          [0, 1, 2, 1, 4, 2, 4, 3, 2, 3, 0, 2],
          papers[(section + i) % 5],
          g,
        );
        if (i % 3 === 0) {
          const far = at(section, (i + 0.5) / 8, side * (100 + i * 9));
          if (!clearFold(far, t, side, [0, 10, 5], [115, 70, 95])) continue;
          folded(
            [-55, -25, -40, 55, -25, -40, 0, 42, 0, -45, -25, 50, 55, -25, 50],
            [0, 1, 2, 1, 4, 2, 4, 3, 2, 3, 0, 2],
            papers[(i + 2) % 5],
            far,
          );
        }
      }
    }
  }
  // Multi-storey pagoda composition and inhabited festival stalls.
  for (const [section, fraction, offset, size, color] of [
    [0, 0.6, -48, 1, 1],
    [2, 0.45, -55, 1.5, 2],
    [4, 0.55, 55, 1, 3],
    [6, 0.3, -50, 1.2, 1],
  ]) {
    const g = at(section, fraction, offset);
    pavilion(g, size, color);
  }
  for (const section of [0, 2, 6, 7])
    for (let i = 0; i < 9; i++) {
      const g = at(section, (i + 0.5) / 9, (i % 2 ? 1 : -1) * 24);
      for (const x of [-4, 4]) box(bamboo, g, [x, 2.8, 0], [0.18, 5.6, 0.18]);
      folded(
        [-5, 5, -3, 5, 5, -3, 0, 7, 0, -5, 5, 3, 5, 5, 3],
        [0, 1, 2, 1, 4, 2, 4, 3, 2, 3, 0, 2],
        papers[i % 5],
        g,
      );
      box(ink, g, [0, 1, 0], [8, 2, 3]);
      for (let j = 0; j < 4; j++) crane(g, [-3 + j * 2, 2.2, 0], 0.65, (i + j) % 5);
      for (let j = 0; j < 3; j++)
        mesh(cylinder, papers[(i + j) % 5], g, [-2 + j * 2, 1.3, -3], [0.55, 2.6, 0.55]);
    }
  // Eye-level lantern gateways lead the driver through a warm coral arcade.
  for (let section = 0; section < 8; section++)
    for (let i = 0; i < 4; i++) {
      const g = at(section, 0.12 + i * 0.24),
        height = 16 + (i % 2) * 3;
      for (const side of [-1, 1]) box(bamboo, g, [side * 15, height / 2, 0], [0.5, height, 0.5]);
      tube(g, [-15, height, 0], [15, height, 0], 0.12, bamboo);
      for (let j = 0; j < 7; j++) {
        const x = -12 + j * 4,
          y = height - 1 - Math.sin((j * Math.PI) / 6) * 2;
        tube(g, [x, height, 0], [x, y, 0], 0.025, ink);
        const lantern = mesh(
          context.kit.authoredGeometry("blender:paper-lantern", new THREE.SphereGeometry(1, 8, 6)),
          papers[(section + j) % 5],
          g,
          [x, y - 0.8, 0],
          [1, 1.3, 1],
        );
        for (const q of [-1, 1])
          mesh(cylinder, gold, g, [x, y - 0.8 + q * 1.1, 0], [0.7, 0.15, 0.7]);
        if (j % 3 === 0) mesh(sphere, glow, g, [x, y - 0.8, 0], [0.85, 1, 0.85]);
        motion(lantern, (time) => {
          lantern.rotation.z = Math.sin(time * 0.8 + j + i) * 0.08;
        });
      }
      if (section % 2 === 0 && i === 1) {
        g.updateWorldMatrix(true, false);
        registerLightPool(scene, {
          position: g.localToWorld(new THREE.Vector3(0, height - 4, 0)),
          color: "#ffd7b0",
          intensity: 24,
          radius: 28,
        });
      }
    }
  // The fan opens a continuous inside line. Each hinge tile derives both
  // edges from the same banked/ramped frames as physical contact queries.
  const verge = track.VERGES.find((v) => v.gate === "unfold"),
    tiles = 32;
  const fullWidth = (t) => {
    track.setTime(track.course.unfold.openAfter + 2);
    const width = track.vergeWidth(t, verge.side);
    track.setTime(0);
    return width;
  };
  for (let i = 0; verge && i < tiles; i++) {
    const a = verge.start + ((verge.end - verge.start) * i) / tiles,
      b = verge.start + ((verge.end - verge.start) * (i + 1)) / tiles,
      t = (a + b) / 2;
    const g = w.groupAt(t, track.roadHalfWidth(t));
    g.position.y += 0.04;
    const pivot = new THREE.Group();
    g.add(pivot);
    g.updateWorldMatrix(true, false);
    const inverse = g.matrixWorld.clone().invert(),
      positions = [];
    for (const q of [a, b])
      for (const edge of [track.roadHalfWidth(q), track.roadHalfWidth(q) + fullWidth(q)]) {
        const p = track.poseAt(q * track.TRACK, edge, 0.04).p.applyMatrix4(inverse);
        positions.push(p.x, p.y, p.z);
      }
    folded(positions, [0, 1, 2, 1, 3, 2], papers[i % 2 ? 1 : 0], pivot);
    motion(pivot, (time) => {
      const q = unfoldPhase(track.course, time);
      pivot.rotation.z = q >= 0.99 ? 0 : (1 - q) * Math.PI * 0.48;
    });
  }
  const fan = at(3, 0.5, 55);
  for (let i = 0; i < 12; i++) {
    const pivot = new THREE.Group();
    fan.add(pivot);
    pivot.rotation.z = (i - 5.5) * 0.19;
    folded([0, 0, 0, -4, 48, 0, 4, 48, 0], [0, 1, 2], papers[i % 5], pivot);
    tube(pivot, [0, 0, 0.1], [0, 48, 0.1], 0.16, bamboo);
    motion(pivot, (time) => {
      pivot.rotation.z = (i - 5.5) * (0.015 + unfoldPhase(track.course, time) * 0.175);
    });
  }
  // Giant airborne cranes and kites connect the high crossing to the valley.
  for (let i = 0; i < 10; i++) {
    const g = at(5, (i + 0.5) / 10, (i % 2 ? 1 : -1) * 35);
    g.position.y += 15 + (i % 3) * 5;
    const bird = crane(g, [0, 0, 0], 4 + (i % 3), i % 5, true);
    motion(bird, (time) => {
      bird.position.y = Math.sin(time * 0.45 + i) * 2;
      bird.rotation.y = Math.sin(time * 0.2 + i) * 0.16;
    });
  }
  for (let i = 0; i < 22; i++) {
    const g = at(i % 8, 0.2 + ((i * 7) % 17) / 24, i % 2 ? 20 : -20),
      spinner = new THREE.Group();
    g.add(spinner);
    spinner.position.y = 4;
    box(bamboo, g, [0, 2, 0], [0.12, 4, 0.12]);
    for (let j = 0; j < 4; j++) {
      const blade = folded(
        [0, 0, 0, 0, 2.8, 0, 1.6, 1.6, 0.6],
        [0, 1, 2],
        papers[(i + j) % 5],
        spinner,
      );
      blade.rotation.z = (j * Math.PI) / 2;
    }
    motion(spinner, (time) => {
      spinner.rotation.z = time * 0.8 + i;
    });
  }
  w.points("#ffd694", [0, 3, 6], 120, 0.16);
  return w.finish();
}
