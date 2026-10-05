import { createLifeAnimation } from "./windmill-wilds/create-life-animation.js";
import { buildForestAndRidge } from "./windmill-wilds/build-forest-and-ridge.js";
import { createFestivalProps } from "./windmill-wilds/create-festival-props.js";
// Original countryside dressing. Static parts are batched by the countryside world builder;
// wind, animals, visitors, boats and machinery share the race animation clock.
import { createContactShadowMesh } from "../rendering/visual-effects.js";
import { sceneryGroundHeight } from "../rendering/terrain-height.js";

export default function buildWindmillLife(context) {
  const { THREE, scene, scenery, track, kit, textures = {} } = context;
  const { mesh, box, material, sectorT } = kit;
  let seed = 47191;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const animated = [],
    flags = [],
    arms = [],
    butterflies = [],
    boats = [],
    birds = [];
  const wood = material("#c59b62", { map: textures.wood ?? null });
  const dark = material("#72533b", { map: textures.wood ?? null });
  const cream = material("#fff0cd"),
    coral = material("#ec785b"),
    butter = material("#edc765");
  const mint = material("#82bb9a"),
    navy = material("#537f9c"),
    skin = material("#eac297");
  const leaf = material("#669766", { map: textures.leaves ?? null });
  const grass = material("#7eae59"),
    deep = material("#386859");
  const stone = material("#b6b4a0", { map: textures.rock ?? null });
  const fruit = material("#e98353"),
    blossom = material("#ffccbf");
  const steel = material("#7c918d", { metalness: 0.25, roughness: 0.55 });
  const sphere = new THREE.SphereGeometry(1, 10, 6);
  const crown = new THREE.SphereGeometry(1, 16, 10);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const disc = new THREE.CylinderGeometry(1, 1, 1, 12);
  const cone = new THREE.ConeGeometry(1, 1, 8);
  const torus = new THREE.TorusGeometry(1, 0.1, 5, 14);
  const leafGeometry = new THREE.BufferGeometry();
  leafGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [0, 0, 0, 0.24, 0.02, -0.35, 0, 0.04, -1, -0.24, 0.02, -0.35],
      3,
    ),
  );
  leafGeometry.setIndex([0, 1, 2, 0, 2, 3]);
  leafGeometry.computeVertexNormals();
  const fernMat = deep.clone();
  fernMat.side = THREE.DoubleSide;
  const mappedAssets = {
    "tree-pinedefaultb": "fir",
    "tree-pinetalla-detailed": "fir",
    "tree-pinetallb-detailed": "fir",
    "tree-oak": "oak",
    "tree-default": "orchard",
    "plant-bushdetailed": "flower-bush",
    "flower-yellowb": "flower-bush",
  };
  const asset = (slug, parent, position, scale) =>
    kit.asset(
      mappedAssets[slug] ? `windmill:${mappedAssets[slug]}` : `kenney:nature/${slug}`,
      parent,
      position,
      scale,
    );
  const treeModels = [
    "tree-pinedefaultb",
    "tree-pinetalla-detailed",
    "tree-pinetallb-detailed",
    "tree-oak",
    "tree-default",
  ];
  const rockModels = ["rock-largeb", "rock-larged", "rock-largee", "rock-tallb"];

  function ground(t, offset, radius = 1, parent = scenery) {
    const frame = track.poseAt(t * track.TRACK, offset, 0);
    const near = track.projectTrack(frame.p, t * track.TRACK, true);
    const edge = near.offset > 0 ? near.rightEdge : -near.leftEdge;
    if (near.distance < edge + radius + 1) return null;
    const g = new THREE.Group();
    g.position.set(frame.p.x, sceneryGroundHeight(near), frame.p.z);
    g.rotation.y = Math.atan2(-frame.tangent.x, -frame.tangent.z);
    parent.add(g);
    return g;
  }
  const roadside = (section, f, side, clearance = 4, radius = 1, parent = scenery) => {
    const t = sectorT(section, f),
      s = track.surfaceAt(t);
    return ground(t, side * ((side > 0 ? s.rightEdge : -s.leftEdge) + clearance), radius, parent);
  };
  const animate = (g) => {
    if (g) animated.push(g);
    return g;
  };
  const groundShadow = (parent, width, depth = width) => {
    const shadow = createContactShadowMesh({ width, depth, opacity: 0.24 });
    shadow.position.y = 0.035;
    parent.add(shadow);
  };
  const palette = {
    blossom,
    butter,
    coral,
    cream,
    dark,
    fernMat,
    fruit,
    grass,
    leaf,
    mint,
    navy,
    skin,
    steel,
    wood,
  };
  const geometry = { cone, crown, cylinder, disc, leafGeometry, sphere };
  const { beam, flag, pennantLine, crate, tent, visitor } = createFestivalProps({
    THREE,
    animate,
    arms,
    flags,
    groundShadow,
    random,
    roadside,
    kit,
    palette,
    geometry,
  });
  // Meadow opens as a country fair rather than another row of generic trees.
  for (const [f, side, color, size] of [
    [0.13, -1, coral, 1.15],
    [0.27, 1, butter, 1],
    [0.36, -1, mint, 1],
    [0.77, 1, coral, 1.1],
    [0.84, -1, navy, 0.9],
  ])
    tent(0, f, side, color, size);
  for (const side of [-1, 1]) {
    const g = roadside(0, 0.055, side, 10, 6);
    if (!g) continue;
    g.name = "Festival viewing terrace";
    for (let row = 0; row < 3; row++) {
      box(wood, g, [0, 0.35 + row * 0.55, row * 1.3], [11, 0.3, 1.2]);
      for (let col = 0; col < 9; col++)
        visitor(g, -4.3 + col * 1.05, 0.55 + row * 0.55, row * 1.3, col + row * 3);
    }
    for (const x of [-5.5, 5.5]) box(wood, g, [x, 2.8, 3.6], [0.13, 5.6, 0.13]);
    pennantLine(g, [-5.5, 5.5, 3.6], [5.5, 5.5, 3.6], 12);
  }
  const welcome = kit.groupAt(sectorT(0, 0.025), 0, scenery);
  welcome.name = "High festival welcome arch";
  const half = track.roadHalfWidth(sectorT(0, 0.025)) + 4;
  for (const side of [-1, 1]) {
    box(wood, welcome, [side * half, 6.8, 0], [0.65, 13.6, 0.65]);
    box(cream, welcome, [side * half, 1, 0], [1.1, 2, 1.1]);
    flag(welcome, side * half, 14.2, 0, side < 0 ? coral : mint, 2.2);
  }
  beam(welcome, [-half, 13.4, 0], [half, 13.4, 0], 0.2);
  pennantLine(welcome, [-half, 13.2, 0], [half, 13.2, 0], 22);
  // Meadow cut is visually edged by isolated tall pennants, not obstacles.
  for (const f of [0.405, 0.715]) {
    const g = roadside(0, f, 1, 3, 1);
    if (!g) continue;
    box(wood, g, [0, 2.3, 0], [0.16, 4.6, 0.16]);
    flag(g, 0, 4.2, 0, butter, 2.1);
    mesh(disc, cream, g, [0, 0.09, 0], [1.2, 0.15, 1.2]);
  }
  // Flower islands use downloaded, UV-painted blossom/leaf cards.
  for (let i = 0; i < 32; i++) {
    const section = i < 20 ? 0 : 5;
    const g = roadside(section, 0.06 + random() * 0.9, i % 2 ? 1 : -1, 4 + random() * 6, 1);
    if (!g) continue;
    const flowers = kit.asset("windmill:flower-bush", g, [0, 0.025, 0], [0.85, 0.85, 0.85]);
    flowers.rotation.y = random() * Math.PI * 2;
  }
  const pasture = roadside(0, 0.55, -1, 30, 10);
  if (pasture) {
    pasture.name = "Sheep pasture";
    for (let i = 0; i < 7; i++) {
      const x = (i % 4) * 3 - 4,
        z = Math.floor(i / 4) * 4;
      mesh(sphere, cream, pasture, [x, 0.9, z], [1.05, 0.7, 0.6]);
      mesh(sphere, cream, pasture, [x + 0.75, 1.2, z], [0.47, 0.42, 0.42]);
      mesh(sphere, dark, pasture, [x + 1.02, 1.14, z], [0.25, 0.24, 0.27]);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          box(dark, pasture, [x + sx * 0.6, 0.3, z + sz * 0.3], [0.13, 0.6, 0.13]);
    }
    for (let i = 0; i < 9; i++) box(wood, pasture, [-13 + i * 3, 1, -5], [0.17, 2, 0.17]);
    for (const y of [0.65, 1.45]) box(cream, pasture, [-1, y, -5], [24, 0.12, 0.1]);
  }
  buildForestAndRidge({
    asset,
    THREE,
    animate,
    birds,
    groundShadow,
    random,
    roadside,
    rockModels,
    scene,
    treeModels,
    kit,
    palette,
    geometry,
  });
  // Shoreline craft: hull ribs, dock planks, wet posts, reeds and lilies.
  for (const [f, offset, index] of [
    [0.22, 36, 0],
    [0.43, 47, 1],
    [0.59, 29, 2],
  ]) {
    const t = sectorT(3, f),
      frame = track.poseAt(t * track.TRACK, offset, 0);
    const g = new THREE.Group();
    g.position.set(frame.p.x, -1.08, frame.p.z);
    g.rotation.y = index * 1.4;
    scene.add(g);
    animate(g);
    g.name = "Bobbing rowboat";
    kit.asset("windmill:boat", g, [0, 0, 0], [1.7, 1.7, 1.7]);
    boats.push({ g, baseY: g.position.y, phase: index * 2, baseR: g.rotation.y });
  }
  for (const [f, side] of [
    [0.1, 1],
    [0.7, 1],
    [0.86, -1],
  ]) {
    const g = roadside(3, f, side, 20, 6);
    if (!g) continue;
    g.name = "Timber fishing dock";
    for (let i = 0; i < 13; i++) box(wood, g, [0, 0.1, -3 + i * 0.6], [4, 0.15, 0.55]);
    for (const x of [-1.8, 1.8])
      for (const z of [-3, 3.8]) {
        box(dark, g, [x, -1, z], [0.32, 3.2, 0.32]);
        mesh(torus, dark, g, [x, 0.8, z], [0.45, 0.45, 0.45]);
      }
    crate(g, 0, 0.2, -1, false);
    beam(g, [1, 0.2, 2.5], [1.5, 4.3, 2], 0.025, dark);
  }
  for (let i = 0; i < 48; i++) {
    const g = roadside(3, 0.03 + random() * 0.93, i % 3 ? 1 : -1, 6 + random() * 12, 0.8);
    if (!g) continue;
    kit.asset("windmill:cattail", g, [0, 0, 0], [1.8, 1.8, 1.8]);
  }
  // Farm machinery reads as a mechanism: spokes, paddles, gear and transmission.
  const wheelBase = roadside(4, 0.46, 1, 10, 5);
  let wheel = null,
    gear = null;
  if (wheelBase) {
    wheelBase.name = "Working mill waterwheel";
    for (const x of [-0.7, 0.7]) box(stone, wheelBase, [x, 2, 0], [0.55, 4, 1.5]);
    wheel = new THREE.Group();
    wheel.position.set(0, 4, 0);
    wheelBase.add(wheel);
    animate(wheel);
    for (const x of [-0.7, 0.7]) {
      const rim = mesh(torus, dark, wheel, [x, 0, 0], [3.6, 3.6, 3.6]);
      rim.rotation.y = Math.PI / 2;
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI * 2) / 10;
        beam(wheel, [x, 0, 0], [x, Math.cos(a) * 3.6, Math.sin(a) * 3.6], 0.12, wood);
      }
    }
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI * 2) / 16,
        paddle = box(wood, wheel, [0, Math.cos(a) * 3.65, Math.sin(a) * 3.65], [1.65, 0.7, 0.25]);
      paddle.rotation.x = -a;
    }
    gear = new THREE.Group();
    gear.position.set(-2, 4, 0);
    wheelBase.add(gear);
    animate(gear);
    mesh(cylinder, steel, gear, [0, 0, 0], [1.3, 0.25, 1.3]).rotation.z = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI * 2) / 12;
      const tooth = box(dark, gear, [0, Math.cos(a) * 1.4, Math.sin(a) * 1.4], [0.35, 0.4, 0.32]);
      tooth.rotation.x = -a;
    }
    beam(wheelBase, [-2.6, 4, 0], [1, 4, 0], 0.25, steel);
  }
  for (const [f, side] of [
    [0.13, -1],
    [0.27, 1],
    [0.84, 1],
  ]) {
    const g = roadside(4, f, side, 9, 6);
    if (!g) continue;
    g.name = "Mill yard loading canopy";
    groundShadow(g, 12, 9);
    for (const x of [-4, 4])
      for (const z of [-2.5, 2.5]) box(dark, g, [x, 2.4, z], [0.3, 4.8, 0.3]);
    box(wood, g, [0, 4.9, 0], [9, 0.25, 6]);
    for (let i = 0; i < 8; i++) box(cream, g, [-3.9 + i * 1.1, 4.6, 2.8], [0.95, 0.45, 0.1]);
    for (let i = 0; i < 5; i++) {
      const x = (i % 3) * 2.3 - 2.3,
        z = Math.floor(i / 3) * 2;
      mesh(sphere, cream, g, [x, 0.8, z], [0.75, 0.9, 0.62]);
      mesh(torus, dark, g, [x, 1.4, z], [0.29, 0.29, 0.29]).rotation.x = Math.PI / 2;
    }
    for (const z of [-1.8, 1.8]) {
      mesh(cylinder, wood, g, [3, 0.9, z], [0.7, 1.8, 0.7]);
      for (const y of [0.35, 1.4])
        mesh(torus, steel, g, [3, y, z], [0.7, 0.7, 0.7]).rotation.x = Math.PI / 2;
    }
    box(dark, g, [0, 0.3, -1.9], [4, 0.25, 1]);
  }
  // Fruit stalls and irrigation distinguish the orchard from meadow scatter.
  tent(5, 0.45, -1, coral, 0.9);
  tent(5, 0.74, 1, mint, 0.9);
  for (let i = 0; i < 22; i++) {
    const side = i % 2 ? 1 : -1,
      g = roadside(5, 0.06 + i * 0.04, side, 4, 2);
    if (!g) continue;
    box(steel, g, [0, 0.08, 0], [0.09, 0.1, 3.4]);
    mesh(cylinder, steel, g, [0, 0.32, 0], [0.07, 0.5, 0.07]);
    const spray = mesh(cone, mint, g, [0, 0.65, 0], [0.18, 0.07, 0.18]);
    spray.castShadow = false;
    if (i % 5 === 0) {
      crate(g, 1.1, 0, 0);
      const ladder = box(wood, g, [-1.2, 1.7, 0], [0.08, 3.5, 0.08]);
      ladder.rotation.z = 0.22;
      for (let rung = 0; rung < 7; rung++)
        box(wood, g, [-0.8, 0.25 + rung * 0.42, 0], [0.8, 0.07, 0.07]);
      box(wood, g, [-0.4, 1.7, 0], [0.08, 3.5, 0.08]);
    }
  }
  return createLifeAnimation({
    THREE,
    animate,
    animated,
    arms,
    birds,
    boats,
    butterflies,
    flags,
    gear,
    kit,
    random,
    roadside,
    scene,
    track,
    wheel,
    palette,
    geometry,
  });
}
