import { unfoldPhase } from "../../simulation/course-mechanics.js";

/** Fold edges, paper grain and transmitted lantern light for Paper Revel. */
export function polishPaper(w) {
  const { THREE, track, mat, mesh, box, at, safe, motion, light, source, edgeRibbon, patch } = w;
  const paperColors = ["#f6d8c4", "#e7b4c4", "#c5c2e5", "#a9d3c4", "#f4cc83"];
  const sheets = paperColors.map((color) => {
    const m = mat(color, "fabric", { side: THREE.DoubleSide, roughness: 0.94 });
    patch(m, "paper-fibres", (shader) => {
      shader.vertexShader = `varying vec3 vSheet;\n${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvSheet=position;",
      );
      shader.fragmentShader = `varying vec3 vSheet;\n${shader.fragmentShader}`.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float fibre=sin(vSheet.x*118.+sin(vSheet.y*47.)*2.)*sin(vSheet.z*91.+vSheet.x*13.);
        float fleck=fract(sin(dot(floor(vSheet.xy*38.),vec2(12.98,78.23)))*43758.54);
        vec2 motifCell=fract((vSheet.xy+vec2(18.))*0.085)-.5;
        float rosette=1.-smoothstep(.018,.045,abs(length(motifCell)-.19));
        float motif=rosette*smoothstep(.12,.32,abs(sin(atan(motifCell.y,motifCell.x)*6.)));
        diffuseColor.rgb*=.985+fibre*.018+(fleck-.5)*.018;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.30,.23,.34),motif*.13);`,
      );
    });
    return m;
  });
  const edge = mat("#a7787f", "fabric", { roughness: 0.96 });
  const ink = ["#8d6474", "#557b7d", "#75688e"].map((c) => mat(c, null, { roughness: 0.78 }));
  const bamboo = mat("#a77d5b", "wood", { roughness: 0.8 });
  const curlGeometry = new THREE.TorusGeometry(0.42, 0.07, 5, 14, Math.PI * 1.2);
  const outlineMaterial = new THREE.LineBasicMaterial({
    color: "#946f79",
    transparent: true,
    opacity: 0.84,
  });
  function foldedSheet(width, height, depth, material, parent, position = [0, 0, 0]) {
    const positions = [
      -width / 2,
      0,
      -depth / 2,
      0,
      height,
      -depth / 2,
      width / 2,
      0,
      -depth / 2,
      -width / 2,
      0,
      depth / 2,
      0,
      height,
      depth / 2,
      width / 2,
      0,
      depth / 2,
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex([0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4]);
    geometry.computeVertexNormals();
    const sheet = mesh(geometry, material, parent, position);
    const edgePositions = [
      ...positions.slice(0, 3),
      ...positions.slice(3, 6),
      ...positions.slice(3, 6),
      ...positions.slice(6, 9),
      ...positions.slice(6, 9),
      ...positions.slice(15, 18),
      ...positions.slice(15, 18),
      ...positions.slice(12, 15),
      ...positions.slice(12, 15),
      ...positions.slice(9, 12),
      ...positions.slice(9, 12),
      ...positions.slice(0, 3),
      ...positions.slice(3, 6),
      ...positions.slice(12, 15),
    ];
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(edgePositions, 3));
    const outline = new THREE.LineSegments(lineGeometry, outlineMaterial);
    outline.position.set(...position);
    outline.userData.skipBake = true;
    parent.add(outline);
    return sheet;
  }

  // Raised, irregular cut edges and crease lines give broad folded scenery a
  // layered construction. Every sheet sits well beyond the drivable outline.
  for (let i = 0; i < 18; i++) {
    const section = i % 8;
    const side = i % 2 ? 1 : -1;
    const fraction = 0.08 + ((i * 29) % 83) / 100;
    const g = safe(section, fraction, side * (24 + (i % 4) * 5), 9);
    if (!g) continue;
    const width = 5 + (i % 3) * 2;
    const height = 3.4 + (i % 4) * 1.1;
    const color = sheets[i % sheets.length];
    foldedSheet(width, height, 0.12 + (i % 3) * 0.08, color, g, [0, 0.08, 0]);
    // A second thin sheet under the folded profile exposes a dark cut edge.
    foldedSheet(width * 1.012, height * 0.985, 0.12 + (i % 3) * 0.08, edge, g, [0, -0.035, -0.035]);
    // A curled corner overlaps the sheet edge instead of reading as an isolated ring.
    const curl = mesh(
      curlGeometry,
      sheets[(i + 2) % sheets.length],
      g,
      [side * (width * 0.44), height * 0.34, 0.035],
      [0.8, 0.8, 0.8],
    );
    curl.rotation.y = Math.PI / 2;
    curl.rotation.z = side * 0.18;
    if (i % 3 === 0) box(bamboo, g, [0, -0.08, -0.3], [width * 0.58, 0.16, 0.7]);
  }
  for (const section of [0, 1, 2, 4, 5, 6, 7]) {
    for (const side of [-1, 1])
      edgeRibbon(section, side, {
        color: side > 0 ? "#d59aab" : "#b688a2",
        width: 0.9,
        textureName: "fabric",
        roughness: 0.97,
        lift: 0.035,
        noise: 0.22,
      });
  }

  // Lantern housings get a real paper cage and softly patterned light patches.
  for (let i = 0; i < 8; i++) {
    const section = i;
    const g = at(section, 0.49, i % 2 ? 10 : -10);
    const y = 13 + (i % 3) * 2;
    box(bamboo, g, [0, y + 1.45, 0], [0.12, 2.9, 0.12]);
    for (let side = 0; side < 4; side++) {
      const a = (side * Math.PI) / 2;
      const panel = box(
        sheets[(i + side) % sheets.length],
        g,
        [Math.cos(a) * 0.75, y, Math.sin(a) * 0.75],
        [1.28, 2.25, 0.05],
      );
      panel.rotation.y = -a;
      box(
        ink[(i + side) % ink.length],
        g,
        [Math.cos(a) * 0.75, y - 1.2, Math.sin(a) * 0.75],
        [1.5, 0.12, 0.12],
      ).rotation.y = -a;
    }
    const bulb = source(g, [0, y, 0], i % 2 ? "#ffc880" : "#ffe0a4", 0.24);
    bulb.userData.skipBake = true;
    light({
      parent: g,
      position: [0, y, 0],
      color: i % 2 ? "#ffd08a" : "#ffe1ac",
      intensity: 3.4,
      radius: 16,
      kind: "practical",
      pattern: i % 3 ? "lattice" : "stained-glass",
      direction: [0, -1, 0],
      staticBake: true,
    });
  }

  // The unfolding fan's loose paper tails visibly open with the same analytic
  // lap transformation while remaining clear of every physical road surface.
  const tails = [];
  for (let i = 0; i < 7; i++) {
    const g = at(3, 0.5, 36 + i * 2.4);
    g.position.y += 8 + (i % 3) * 1.8;
    const pivot = new THREE.Group();
    g.add(pivot);
    pivot.rotation.z = (i - 3) * 0.11;
    foldedSheet(3.4, 7.8, 0.1, sheets[(i + 1) % sheets.length], pivot, [0, 0.08, 0]);
    tails.push({ pivot, i });
  }
  for (const { pivot, i } of tails)
    motion(pivot, (time, state) => {
      const phase = state?.motionEnabled === false ? 0 : unfoldPhase(track.course, time);
      pivot.rotation.z = (i - 3) * (0.22 - phase * 0.17);
      pivot.scale.y = 0.84 + phase * 0.16;
    });
}
