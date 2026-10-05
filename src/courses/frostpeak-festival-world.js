// A complete alpine resort. Static detail is batched by the shared runtime;
// only fabric, lift cabins, cheering spectators, flakes and the groomer move.
import { createContactShadowMesh, addGlow } from "../rendering/visual-effects.js";

export function buildWorld({ THREE, scene, scenery, track, textures, kit, hazardAt }) {
  const { material, mesh, box, groupAt, sectorT, asset, batch, align } = kit;
  const snow = material("#f2f8ff", { map: textures.snow, roughness: 0.96 });
  const timber = material("#c6a17f", { map: textures.wood }),
    roof = material("#bc6676", { map: textures.wood });
  const bark = material("#97765c", { map: textures.bark }),
    cream = material("#efdfc8");
  const dark = material("#344958"),
    cyan = material("#53cbd7"),
    red = material("#e97087");
  const yellow = material("#ffe19e", { emissive: "#ffb85e", emissiveIntensity: 0.26 });
  const glass = material("#9cdef1", { metalness: 0.38, roughness: 0.2 });
  const rock = material("#9bb1c5", { map: textures.stone }),
    amber = material("#ffaf45", { emissive: "#df7900", emissiveIntensity: 0.3 });
  const cone = new THREE.ConeGeometry(1, 1, 9),
    sphere = new THREE.SphereGeometry(1, 10, 7);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10),
    clothGeo = new THREE.PlaneGeometry(1, 1, 8, 3);
  const edgeOffset = (t, side, margin) =>
    side * (side > 0 ? track.surfaceAt(t).rightEdge : -track.surfaceAt(t).leftEdge) + side * margin;
  const landAt = (t, offset, parent = scenery) =>
    kit.landGroup ? kit.landGroup(t, offset, parent) : groupAt(t, offset, parent);
  const flags = new THREE.Group();
  scenery.add(flags);
  const cheerers = new THREE.Group();
  scenery.add(cheerers);
  const groundShadow = (parent, width, depth = width) => {
    const shadow = createContactShadowMesh({ width, depth, opacity: 0.24 });
    shadow.position.y = 0.035;
    parent.add(shadow);
  };

  function pole(g, x, y, z, height = 4) {
    mesh(cylinder, dark, g, [x, y + height / 2, z], [0.08, height, 0.08]);
    mesh(sphere, yellow, g, [x, y + height + 0.16, z], [0.3, 0.36, 0.3]);
  }
  function rail(g, x, y, z, width, axis = "x") {
    box(bark, g, [x, y, z], axis === "x" ? [width, 0.15, 0.15] : [0.15, 0.15, width]);
    for (let i = -1; i <= 1; i += 0.5)
      box(
        bark,
        g,
        [
          x + (axis === "x" ? (i * width) / 2 : 0),
          y - 0.5,
          z + (axis === "z" ? (i * width) / 2 : 0),
        ],
        [0.12, 1.1, 0.12],
      );
  }
  function chalet(t, side, large = false) {
    const g = landAt(t, edgeOffset(t, side, large ? 20 : 14));
    g.rotation.y += side > 0 ? Math.PI : 0;
    if (large) g.scale.setScalar(1.3);
    groundShadow(g, 15, 20);
    box(rock, g, [0, 0.35, 0], [10, 0.7, 12]);
    box(timber, g, [0, 3.2, 0], [9, 5.7, 11]);
    // Actual log courses, corner joints, warm panes and snowy shutters.
    for (let y = 0.9; y < 5.8; y += 0.65) {
      box(bark, g, [0, y, -5.57], [9.5, 0.11, 0.12]);
      for (const x of [-4.56, 4.56]) box(bark, g, [x, y, 0], [0.13, 0.1, 11.5]);
    }
    for (const x of [-4.3, 4.3])
      for (const z of [-5.5, 5.5]) box(cream, g, [x, 3.2, z], [0.28, 5.7, 0.25]);
    // A real wreath gives the village a small, readable festival accent.
    asset("kenney:holiday-kit/wreath", g, [0, 4.2, -5.91], [1.35, 1.35, 0.3]);
    for (const x of [-2.65, 2.65]) {
      const r = box(roof, g, [x, 6.35, 0], [6.1, 0.35, 12.7]);
      r.rotation.z = x > 0 ? -0.48 : 0.48;
      const cap = box(snow, g, [x, 6.63, 0], [6.4, 0.25, 12.8]);
      cap.rotation.z = r.rotation.z;
      for (let z = -5.5; z <= 5.5; z += 1.15)
        mesh(cone, snow, g, [x + (x > 0 ? 2.5 : -2.5), 5.32, z], [0.11, 0.65, 0.1]);
    }
    box(bark, g, [0, 7.87, 0], [0.3, 0.26, 13]);
    for (const x of [-2.65, 2.65])
      for (const y of [2.15, 4.6]) {
        box(bark, g, [x, y, -5.69], [1.9, 1.85, 0.16]);
        box(yellow, g, [x, y, -5.79], [1.6, 1.55, 0.08]);
        box(bark, g, [x, y, -5.87], [0.1, 1.65, 0.04]);
        box(bark, g, [x, y, -5.87], [1.6, 0.1, 0.04]);
        box(snow, g, [x, y - 0.89, -5.82], [2.2, 0.17, 0.42]);
        for (const dx of [-1.17, 1.17]) box(red, g, [x + dx, y, -5.68], [0.33, 1.8, 0.16]);
      }
    box(red, g, [0, 1.65, -5.69], [1.65, 3.2, 0.12]);
    mesh(sphere, yellow, g, [0.5, 1.65, -5.8], [0.07, 0.07, 0.07]);
    // Raised welcome deck and upper balcony create layered resort facades.
    box(timber, g, [0, 0.73, -7.1], [10.8, 0.35, 3]);
    for (const x of [-4.7, 4.7]) rail(g, x, 1.75, -7.1, 2.8, "z");
    box(timber, g, [0, 3.45, -6.55], [9.8, 0.2, 2.2]);
    rail(g, 0, 4.55, -7.6, 9.8);
    for (const x of [-4.4, 4.4]) box(bark, g, [x, 2.2, -7.3], [0.18, 3.6, 0.18]);
    for (let step = 0; step < 3; step++)
      box(rock, g, [0, 0.2 + step * 0.16, -9 + step * 0.35], [2.5, 0.25, 0.7]);
    pole(g, -4.8, 0.8, -8.3, 3.1);
    box(rock, g, [3, 8.15, 1.8], [1, 2.8, 1]);
    box(snow, g, [3, 9.65, 1.8], [1.35, 0.23, 1.35]);
    // A single restrained halo per facade keeps warm windows readable in snow.
    addGlow(g, { color: "#ffda8a", size: [6, 4], opacity: 0.12, position: [0, 3.6, -5.95] });
    return g;
  }
  for (const f of [0.08, 0.28, 0.49, 0.73]) for (const side of [-1, 1]) chalet(sectorT(0, f), side);
  for (const f of [0.64, 0.88]) chalet(sectorT(5, f), -1);
  chalet(sectorT(2, 0.84), -1, true);

  const winterTrees = [
    "kenney:holiday-kit/tree_pine_snow",
    "kenney:holiday-kit/tree_pine_snow_round",
    "kenney:holiday-kit/tree_pine_snowed",
    "kenney:holiday-kit/tree_decorated",
  ];
  function pine(t, side, size, depth = 0, index = 0) {
    const g = landAt(t, edgeOffset(t, side, 8 + size * 2.5 + depth));
    g.rotation.y += index * 2.399;
    const height = 10.5 * size;
    const model =
      depth === 0 && index % 3 !== 0
        ? winterTrees[1]
        : winterTrees[Math.abs(index + (side > 0 ? 1 : 0)) % winterTrees.length];
    const width = height * (0.94 + Math.sin(index * 1.7 + side) * 0.07);
    asset(model, g, [0, 0, 0], [width, height, width]);
    if (depth === 0 && index % 5 === 0) groundShadow(g, width * 0.85);
  }
  // Two irregular depth layers make a canopy instead of evenly spaced cones.
  for (let i = 0; i < 30; i++)
    for (const side of [-1, 1]) {
      pine(sectorT(1, (i + 0.45) / 30), side, 0.82 + (i % 5) * 0.13, 0, i);
      if (i % 2 === 0) pine(sectorT(1, (i + 0.9) / 30), side, 1.2 + (i % 3) * 0.15, 13, i + 1);
    }
  for (let i = 0; i < 15; i++)
    for (const side of [-1, 1])
      pine(sectorT(i % 2 ? 0 : 3, (i + 0.5) / 15), side, 0.9 + (i % 3) * 0.12, 7, i);

  function flag(t, side, index) {
    const offset = edgeOffset(t, side, 3.2),
      g = landAt(t, offset);
    mesh(cylinder, dark, g, [0, 3.6, 0], [0.09, 7.2, 0.09]);
    mesh(sphere, snow, g, [0, 0.1, 0], [1.3, 0.34, 1.1]);
    const moving = landAt(t, offset, flags);
    mesh(clothGeo, index % 2 ? cyan : red, moving, [side * 1.3, 6.3, 0], [2.6, 1.3, 1]);
  }
  for (let s = 0; s < 6; s++)
    for (let i = 0; i < 8; i++)
      for (const side of [-1, 1]) flag(sectorT(s, (i + 0.5) / 8), side, i + s);

  // Ring-built mountains have broken ridges and broad strata, not cone silhouettes.
  function mountainGeometry(cap = false) {
    const vertices = [],
      uv = [],
      indices = [],
      n = 11,
      rings = [
        [0, 1],
        [0.18, 0.81],
        [0.43, 0.6],
        [0.66, 0.36],
        [0.83, 0.18],
        [1, 0.005],
      ],
      firstRing = cap ? 3 : 0;
    for (let j = firstRing; j < rings.length; j++)
      for (let k = 0; k < n; k++) {
        const [y, r] = rings[j],
          a = (k / n) * Math.PI * 2;
        // Caps use the exact rock-ring jitter. A small outward shell avoids
        // buried snow patches and z-fighting while retaining the shared ridge.
        const jitter = (1 + Math.sin(k * 4.7 + j * 1.4) * 0.19) * (cap ? 1.025 : 1);
        vertices.push(
          Math.cos(a) * r * jitter + y * 0.12,
          y +
            (j === rings.length - 1 ? Math.sin(k * 2.9) * 0.035 : Math.sin(k * 1.7 + j) * 0.055) +
            (cap ? 0.008 : 0),
          Math.sin(a) * r * jitter,
        );
        uv.push((k / n) * 4, y * 3);
        if (j < rings.length - 1) {
          const p = (j - firstRing) * n + k,
            q = (j - firstRing) * n + ((k + 1) % n);
          indices.push(p, p + n, q, q, p + n, q + n);
        }
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }
  const mountainRock = mountainGeometry(),
    mountainSnow = mountainGeometry(true),
    mountainStone = material("#a7bdcd", { roughness: 1 });
  function mountain(x, z, width, height, rotation) {
    const g = new THREE.Group();
    g.name = "Layered alpine horizon";
    scenery.add(g);
    g.position.set(x, -2, z);
    g.rotation.y = rotation;
    mesh(mountainRock, mountainStone, g, [0, 0, 0], [width, height, width]).castShadow = false;
    mesh(mountainSnow, snow, g, [0, 0, 0], [width, height, width]).castShadow = false;
  }
  for (let i = 0; i < 8; i++) {
    const width = 48 + (i % 3) * 16,
      height = 94 + (i % 4) * 23;
    mountain(330 + (i % 3) * 74, -290 + i * 88, width, height, i * 0.7);
  }
  // The first village straight looks north. Wrap the existing summit language
  // around that view and the western finish rather than keeping it all east.
  for (const [i, x] of [-225, -130, -35, 65, 160].entries())
    mountain(x, -450 - (i % 2) * 24, 66 + (i % 3) * 10, 65 + (i % 3) * 17, i * 0.9);
  for (const [i, z] of [-180, -35, 110].entries())
    mountain(-435 - (i % 2) * 22, z, 68, 76 + i * 12, i * 1.3);
  for (const [i, x] of [-175, -50, 75, 185].entries())
    mountain(x, 425 + (i % 2) * 26, 70, 76 + (i % 3) * 13, i * 0.7);
  for (const s of [2, 3])
    for (let i = 0; i < 8; i++)
      for (const side of [-1, 1]) {
        const t = sectorT(s, (i + 0.5) / 8),
          g = landAt(t, edgeOffset(t, side, 9));
        const model = i % 3 === 0 ? "large" : i % 3 === 1 ? "medium" : "small";
        asset(`kenney:holiday-kit/rock_formation_${model}`, g, [0, -0.5, 0], [2.7, 3.2, 2.2]);
      }

  // Little resort props use the same winter-festival kit as the trees and
  // rocks. All are outside the physical course edge and clear of the camera.
  for (const [fraction, side, kind] of [
    [0.19, -1, "fancy"],
    [0.47, 1, "plain"],
    [0.76, -1, "plain"],
  ]) {
    const g = landAt(sectorT(0, fraction), edgeOffset(sectorT(0, fraction), side, 15));
    asset(
      `kenney:holiday-kit/snowman${kind === "fancy" ? "_fancy" : ""}`,
      g,
      [0, 0, 0],
      [2.25, 2.25, 2.25],
    );
  }
  for (const [fraction, side] of [
    [0.29, 1],
    [0.7, -1],
  ]) {
    const g = landAt(sectorT(0, fraction), edgeOffset(sectorT(0, fraction), side, 18));
    asset("kenney:holiday-kit/sled", g, [0, 0, 0], [2.2, 2.2, 2.2]);
    asset("kenney:holiday-kit/present", g, [2.25, 0.05, 0.35], [0.8, 0.8, 0.8]);
    asset("kenney:holiday-kit/present_round", g, [-2.2, 0.05, -0.25], [0.8, 0.8, 0.8]);
  }
  const festivalPole = landAt(sectorT(0, 0.52), edgeOffset(sectorT(0, 0.52), -1, 24));
  asset("kenney:holiday-kit/festivus_pole", festivalPole, [0, 0, 0], [3.2, 3.2, 3.2]);
  const villageLights = landAt(sectorT(0, 0.51), edgeOffset(sectorT(0, 0.51), 1, 22));
  asset("kenney:holiday-kit/lights_multi", villageLights, [0, 5, 0], [5.8, 1.8, 1.8]);

  // Lift follows the forest/climb beside the road; every cable crossing stays
  // 19 m above the authored surface and every support stands outside its edge.
  const liftStart = sectorT(0, 0.82),
    liftEnd = sectorT(2, 0.84),
    liftPoints = [];
  for (let i = 0; i <= 48; i++) {
    const t = liftStart + ((liftEnd - liftStart) * i) / 48;
    liftPoints.push(track.poseAt(t * track.TRACK, edgeOffset(t, -1, 29), 20).p.clone());
  }
  function beamBetween(a, b, width, parent, mat = dark) {
    const m = mesh(cylinder, mat, parent, [0, 0, 0], [width, a.distanceTo(b), width]);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  }
  for (let i = 0; i < 48; i++)
    for (const dx of [-1.8, 1.8]) {
      const a = liftPoints[i].clone(),
        b = liftPoints[i + 1].clone();
      a.x += dx;
      b.x += dx;
      beamBetween(a, b, 0.055, scenery);
    }
  for (let i = 0; i <= 6; i++) {
    const t = liftStart + ((liftEnd - liftStart) * i) / 6,
      g = landAt(t, edgeOffset(t, -1, 29));
    box(rock, g, [0, 0.4, 0], [3, 0.8, 3]);
    box(dark, g, [0, 9.5, 0], [0.6, 19, 0.6]);
    box(cream, g, [0, 19.3, 0], [7, 0.45, 0.5]);
    for (const x of [-2.1, 2.1]) mesh(cylinder, dark, g, [x, 19.6, 0], [0.55, 0.18, 0.55]);
    for (let y = 2; y < 18; y += 1.5) box(cream, g, [0.46, y, 0], [0.16, 0.1, 0.7]);
  }
  function station(t) {
    const g = landAt(t, edgeOffset(t, -1, 43));
    groundShadow(g, 25, 27);
    box(rock, g, [0, 1, 0], [17, 2, 15]);
    box(timber, g, [0, 5.2, 0], [16, 6.4, 14]);
    box(glass, g, [0, 5, -7.06], [13, 3, 0.1]);
    box(red, g, [0, 8.6, 0], [19, 0.45, 18]);
    box(snow, g, [0, 8.94, 0], [19.4, 0.25, 18.4]);
    for (const x of [-7, 0, 7]) box(dark, g, [x, 4.8, -7.15], [0.3, 5.8, 0.3]);
    box(timber, g, [0, 1.2, -10], [18, 0.3, 6]);
    rail(g, 0, 2.4, -12.8, 18);
    for (let i = 0; i < 5; i++) {
      const ski = box(i % 2 ? cyan : red, g, [-5 + i * 1.1, 2.4, -8.5], [0.16, 3.1, 0.1]);
      ski.rotation.z = 0.2;
    }
  }
  station(liftStart);
  station(liftEnd);
  const gondolas = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    scene.add(g);
    box(dark, g, [0, -1.25, 0], [0.12, 2.5, 0.12]);
    box(dark, g, [0, -2.45, 0], [2.6, 0.22, 2.9]);
    box(i % 2 ? cyan : red, g, [0, -4.05, 0], [2.5, 2.7, 2.8]);
    box(glass, g, [0, -3.55, -1.42], [2.13, 1.15, 0.07]);
    for (const x of [-1.27, 1.27]) box(glass, g, [x, -3.55, 0], [0.07, 1.15, 2.3]);
    box(snow, g, [0, -2.58, 0], [2.85, 0.17, 3.15]);
    box(dark, g, [0, -5.45, 0], [2.8, 0.2, 3.1]);
    batch(g);
    gondolas.push(g);
  }

  function banner(t, color) {
    const g = groupAt(t, 0);
    const width = Math.max(-track.surfaceAt(t).leftEdge, track.surfaceAt(t).rightEdge) + 7;
    for (const x of [-width, width]) box(timber, g, [x, 7.1, 0], [0.5, 14.2, 0.5]);
    box(dark, g, [0, 14.1, 0], [width * 2, 0.4, 0.4]);
    const cloth = groupAt(t, 0, flags);
    mesh(clothGeo, color, cloth, [0, 12.9, 0], [width * 2 - 1, 1.6, 1]);
    for (const x of [-width + 2, width - 2]) mesh(sphere, yellow, g, [x, 13.8, 0], [0.3, 0.3, 0.3]);
  }
  banner(sectorT(3, 0.13), red);
  banner(sectorT(3, 0.58), cyan);

  // A separate ornamental skating pond makes the on-road ice part of a resort,
  // with rubber approach matting represented by the firm main-route surface.
  const pond = landAt(sectorT(4, 0.31), edgeOffset(sectorT(4, 0.31), -1, 27));
  mesh(cylinder, dark, pond, [0, 0.1, 0], [19, 0.3, 14]);
  mesh(cylinder, glass, pond, [0, 0.3, 0], [18.6, 0.16, 13.6]);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2,
      x = Math.cos(a) * 19,
      z = Math.sin(a) * 14;
    box(cream, pond, [x, 1, z], [0.22, 1.8, 0.22]);
    const b = box(i % 2 ? red : cyan, pond, [x, 1.5, z], [3.3, 0.5, 0.13]);
    b.rotation.y = -a + Math.PI / 2;
  }
  for (const f of [0.18, 0.39]) {
    const t = sectorT(4, f),
      g = landAt(t, edgeOffset(t, -1, 9));
    for (const x of [-2.5, 2.5]) box(red, g, [x, 1.5, 0], [0.14, 3, 0.14]);
    box(red, g, [0, 3, 0], [5, 0.14, 0.14]);
    for (let i = -2; i <= 2; i++) box(cream, g, [i, 1.4, 0.8], [0.035, 2.8, 0.035]);
    for (let y = 0.4; y < 3; y += 0.5) box(cream, g, [0, y, 0.8], [5, 0.035, 0.035]);
  }

  // Crowd bodies are static. All raised hands share two batched, waving meshes.
  for (const f of [0.22, 0.57, 0.8]) {
    const t = sectorT(5, f),
      offset = edgeOffset(t, -1, 15),
      g = landAt(t, offset);
    g.rotation.y += Math.PI;
    box(timber, g, [0, 1, 0], [11, 2, 20]);
    for (let row = 0; row < 4; row++) {
      const x = -3 + row * 2,
        y = 2.7 + row * 0.85;
      box(row % 2 ? cyan : red, g, [x, y, 0], [1.7, 0.3, 19]);
      for (let person = 0; person < 9; person++) {
        const z = -8 + person * 2;
        box(person % 2 ? red : cyan, g, [x, y + 0.55, z], [0.58, 0.8, 0.48]);
        mesh(sphere, person % 3 ? cream : bark, g, [x, y + 1.25, z], [0.31, 0.34, 0.3]);
        mesh(sphere, person % 2 ? cyan : red, g, [x, y + 1.48, z], [0.35, 0.15, 0.32]);
        const hands = landAt(t, offset, cheerers);
        hands.rotation.y += Math.PI;
        for (const dz of [-0.42, 0.42]) {
          const arm = box(person % 2 ? red : cyan, hands, [x, y + 1.1, z + dz], [0.16, 0.85, 0.17]);
          arm.rotation.x = dz > 0 ? 0.3 : -0.3;
          mesh(sphere, cream, hands, [x, y + 1.6, z + dz * 1.35], [0.15, 0.15, 0.15]);
        }
      }
    }
    for (const z of [-10.4, 10.4]) rail(g, 1, 5.6, z, 10);
    for (const x of [-5.5, 5.5]) pole(g, x, 0, -10.5, 7.5);
  }

  // Extra depth and surface dressing are kept beyond each physical off-road line.
  for (let s = 0; s < 6; s++)
    for (let i = 0; i < 8; i++)
      for (const side of [-1, 1]) {
        const t = sectorT(s, (i + 0.6) / 8),
          g = landAt(t, edgeOffset(t, side, 4.5));
        mesh(sphere, snow, g, [0, 0.12, 0], [2.5, 0.5, 1.65]);
        if (s === 1 && i % 2 === 0) {
          const log = mesh(cylinder, bark, g, [side * 2, 0.3, 0], [0.33, 4.5, 0.33]);
          log.rotation.z = Math.PI / 2;
          mesh(sphere, snow, g, [side * 2, 0.65, 0], [2.25, 0.22, 0.5]);
        }
        if (s === 5 && side > 0 && track.shortcutWidth(t) > 2) {
          box(cyan, g, [0, 1, 0], [0.16, 2, 0.16]);
          mesh(
            clothGeo,
            red,
            landAt(t, edgeOffset(t, side, 4.5), flags),
            [0, 1.8, 0],
            [1.4, 0.65, 1],
          );
        }
      }

  const groomer = new THREE.Group();
  scene.add(groomer);
  box(red, groomer, [0, 0.9, 0], [2.3, 1.05, 3.4]);
  for (const x of [-0.98, 0.98]) {
    box(dark, groomer, [x, 0.35, 0], [0.5, 0.6, 3.8]);
    for (let z = -1.55; z <= 1.6; z += 0.45) box(rock, groomer, [x, 0.26, z], [0.51, 0.12, 0.15]);
  }
  box(red, groomer, [0, 1.8, 0.35], [1.65, 1.05, 1.9]);
  box(glass, groomer, [0, 1.9, -0.62], [1.4, 0.7, 0.08]);
  for (const x of [-0.83, 0.83]) box(glass, groomer, [x, 1.9, 0.35], [0.05, 0.7, 1.5]);
  box(rock, groomer, [0, 0.42, -1.98], [2.66, 0.55, 0.3]);
  mesh(cylinder, amber, groomer, [0, 2.44, 0.4], [0.21, 0.25, 0.21]);
  batch(groomer);
  const warning = landAt(sectorT(4, 0.78), edgeOffset(sectorT(4, 0.78), 1, 6));
  box(dark, warning, [0, 1.65, 0], [0.2, 3.3, 0.2]);
  const beacon = mesh(sphere, amber, warning, [0, 3.7, 0], [0.55, 0.55, 0.55]);

  // Batched world-coordinate fabric permits a small wind ripple at two draws.
  function prepareMotion(root) {
    // Flatten authored transforms before merging, retaining the dynamic root.
    root.updateMatrixWorld(true);
    const objects = [];
    root.traverse((o) => {
      if (o.isMesh) objects.push(o);
    });
    for (const o of objects) {
      o.matrixWorld.decompose(o.position, o.quaternion, o.scale);
      root.add(o);
    }
    batch(root);
    return root.children
      .filter((o) => o.isMesh)
      .map((o) => ({ mesh: o, base: o.geometry.attributes.position.array.slice() }));
  }
  const flagMotion = prepareMotion(flags),
    crowdMotion = prepareMotion(cheerers);
  const flakesGeo = new THREE.BufferGeometry(),
    flakes = new Float32Array(180 * 3);
  for (let i = 0; i < 180; i++) {
    flakes[i * 3] = Math.sin(i * 89.7) * 285;
    flakes[i * 3 + 1] = 20 + (i % 17) * 5;
    flakes[i * 3 + 2] = Math.cos(i * 43.1) * 250;
  }
  flakesGeo.setAttribute("position", new THREE.BufferAttribute(flakes, 3));
  const flurries = new THREE.Points(
    flakesGeo,
    new THREE.PointsMaterial({
      color: "#ffffff",
      size: 0.19,
      transparent: true,
      opacity: 0.63,
      depthWrite: false,
    }),
  );
  scenery.add(flurries);
  return {
    animated: [groomer, beacon, flags, cheerers, flurries, ...gondolas],
    update(time) {
      const state = hazardAt(time);
      align(groomer, state);
      beacon.visible = state.warning ? Math.floor(time * 6) % 2 === 0 : state.active;
      for (const { mesh: m, base } of flagMotion) {
        const p = m.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const j = i * 3;
          p.array[j + 2] =
            base[j + 2] + Math.sin(time * 2.7 + base[j] * 0.43 + base[j + 1] * 0.7) * 0.16;
          p.array[j + 1] = base[j + 1] + Math.sin(time * 2 + base[j] * 0.4) * 0.055;
        }
        p.needsUpdate = true;
      }
      for (const { mesh: m, base } of crowdMotion) {
        const p = m.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const j = i * 3;
          p.array[j + 1] = base[j + 1] + Math.sin(time * 4 + base[j + 2] * 1.7) * 0.19;
        }
        p.needsUpdate = true;
      }
      for (let i = 0; i < gondolas.length; i++) {
        const u = (((time * 0.018 + i / 4) % 1) + 1) % 1,
          f = u * 48,
          k = Math.min(47, Math.floor(f));
        gondolas[i].position.copy(liftPoints[k]).lerp(liftPoints[k + 1], f - k);
        const a = liftPoints[k],
          b = liftPoints[k + 1];
        gondolas[i].rotation.set(
          Math.sin(time * 1.3 + i) * 0.025,
          Math.atan2(b.x - a.x, b.z - a.z),
          Math.sin(time * 0.7 + i) * 0.035,
        );
      }
      for (let i = 0; i < 180; i++) {
        flakes[i * 3 + 1] = 15 + (((i % 17) * 5 - time * (0.65 + (i % 5) * 0.1) + 1000) % 85);
        flakes[i * 3] = Math.sin(i * 89.7) * 285 + Math.sin(time * 0.3 + i) * 2.5;
      }
      flakesGeo.attributes.position.needsUpdate = true;
    },
  };
}
