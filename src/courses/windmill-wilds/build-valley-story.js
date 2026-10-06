import * as THREE from "../../../vendor/three/three.module.js";
import { createWaterMaterial } from "../../rendering/surface-detail.js";
import { sceneryGroundHeight } from "../../rendering/terrain-height.js";

/** Signature places share imported models, materials and the paused race clock. */
export function buildValleyStory({ scene, scenery, track, kit, textures }) {
  const { mesh, box, material, sectorT, groupAt, safeGroup, asset } = kit;
  const animated = [],
    kites = [],
    ducks = [],
    sails = [];
  const wood = material("#ac8857", { map: textures.wood });
  const bark = material("#8a7755", { map: textures.bark || textures.wood });
  const moss = material("#719652", { map: textures.grass });
  const cream = material("#fff0cc"),
    amber = material("#efbd56"),
    coral = material("#e78f82");
  const violet = material("#a291cb"),
    leaf = material("#75a66b", { map: textures.leaves });
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
  const sphere = new THREE.SphereGeometry(1, 8, 5);
  const place = (section, f, side, clearance, radius = 1) => {
    const t = sectorT(section, f),
      s = track.surfaceAt(t);
    return safeGroup(t, side * ((side > 0 ? s.rightEdge : -s.leftEdge) + clearance), radius);
  };
  const imported = (name, g, p, height) => {
    const model = asset(name, g, p, [height, height, height]);
    if (name.includes("crops-"))
      model.traverse((object) => {
        if (object.isMesh)
          for (const mat of Array.isArray(object.material) ? object.material : [object.material])
            mat.userData.foliageWind = true;
      });
    return model;
  };
  const branch = (g, points, radius, mat = bark) =>
    mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
        20,
        radius,
        6,
        false,
      ),
      mat,
      g,
    );

  // Broad crop parcels complete the middle-distance valley. Alternating soil
  // and stubble rows read as agriculture without thousands of distant plants.
  const stubble = material("#d1ba74", { map: textures.grass });
  const soil = material("#ae9870", { map: textures.needles });
  const parcelGeometry = new THREE.PlaneGeometry(48, 4.8);
  const parcelUv = parcelGeometry.getAttribute("uv");
  for (let i = 0; i < parcelUv.count; i++)
    parcelUv.setXY(i, parcelUv.getX(i) * 8, parcelUv.getY(i));
  for (const section of [0, 4, 5, 7])
    for (const side of [-1, 1]) {
      const g = place(section, 0.48, side, 78, 38);
      if (!g) continue;
      g.name = "Striped harvest fields in the valley";
      for (let row = 0; row < 12; row++) {
        const strip = mesh(parcelGeometry, row % 3 ? stubble : soil, g, [
          0,
          0.035,
          (row - 5.5) * 4.8,
        ]);
        strip.rotation.x = -Math.PI / 2;
        strip.castShadow = false;
        strip.userData.bakeReceiver = true;
      }
      imported("windmill:hay-bale", g, [-16, 0.1, 20], 2.2);
      imported("windmill:hay-bale", g, [15, 0.1, -18], 2.2);
    }

  // A recognizable quilt of flower and crop beds replaces generic empty turf.
  // Small repeated meshes become regional instances in the existing batcher.
  for (const section of [0, 7]) {
    for (let i = 0; i < 14; i++) {
      const g = place(section, 0.06 + i * 0.063, i % 2 ? 1 : -1, 12 + (i % 3) * 5, 3);
      if (!g) continue;
      g.name = "Harvest quilt of lavender, wheat and pumpkins";
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 6; col++) {
          const name =
            i % 3 === 0 ? "flower-purpleb" : i % 3 === 1 ? "crops-wheatstageb" : "crop-pumpkin";
          imported(
            `kenney:nature/${name}`,
            g,
            [(col - 2.5) * 1.45, 0.025, (row - 1) * 1.75],
            name.includes("wheat") ? 1.35 : 0.85,
          );
        }
      if (section === 7 && i % 3 === 0) imported("windmill:hay-bale", g, [0, 0, 5], 2.2);
    }
  }
  // Flower banks tell the driver where the meadow route flows without paint.
  for (const section of [0, 5, 7])
    for (let i = 0; i < 32; i++) {
      const g = place(section, (i + 0.5) / 32, i % 2 ? 1 : -1, 2.5, 0.6);
      if (g) imported("kenney:nature/flower-purpleb", g, [0, 0.02, 0], 0.95);
    }

  // Two gigantic living trees braid roots overhead; the actual race surface
  // continues beneath them. Every low root stays outside the physical edge.
  for (const f of [0.26, 0.73]) {
    const t = sectorT(1, f),
      half = track.roadHalfWidth(t);
    const g = groupAt(t);
    g.name = "Ancient root cathedral";
    for (const side of [-1, 1]) {
      const tree = place(1, f, side, 7, 4);
      if (tree) imported("windmill:oak", tree, [0, 0, 0], 31);
      branch(
        g,
        [
          [side * (half + 2), 0, 3],
          [side * (half + 3), 7, 2],
          [side * half, 15, 0],
          [side * 2, 18.5, -4],
          [-side * 5, 19, -7],
        ],
        0.65,
      );
      for (let j = 0; j < 3; j++)
        branch(
          g,
          [
            [side * (half + 1), 0, j * 2 - 2],
            [side * (half + 3), 0.5, j * 2 - 1],
            [side * (half + 6), 0.05, j * 3],
          ],
          0.25,
          moss,
        );
    }
    for (let j = 0; j < 5; j++) {
      const frond = imported("windmill:fern", g, [(j - 2) * 2.5, 17 + Math.sin(j) * 0.8, -3], 2);
      frond.rotation.z = Math.PI;
    }
  }

  // Wind is the valley's organizing idea: kites, grain, sails and waterfall.
  const kiteShape = new THREE.BufferGeometry();
  kiteShape.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 1.8, 0, -1.25, 0, 0, 0, -2.4, 0, 1.25, 0, 0], 3),
  );
  kiteShape.setIndex([0, 1, 2, 0, 2, 3]);
  kiteShape.computeVertexNormals();
  for (let i = 0; i < 5; i++) {
    const g = place(2, 0.13 + i * 0.16, 1, 22 + i * 2, 2);
    if (!g) continue;
    const kite = new THREE.Group();
    kite.position.set(0, 19 + i * 3, 0);
    g.add(kite);
    const color = [coral, amber, violet][i % 3].clone();
    color.side = THREE.DoubleSide;
    mesh(kiteShape, color, kite);
    for (let j = 0; j < 5; j++)
      box(color, kite, [Math.sin(j) * 0.35, -3 - j * 0.7, 0], [0.5, 0.18, 0.05]);
    branch(
      g,
      [
        [0, 0.2, 0],
        [-2, 9, 1],
        [0, kite.position.y - 2.4, 0],
      ],
      0.018,
      cream,
    );
    animated.push(kite);
    kite.userData.skipBake = true;
    kites.push({ g: kite, phase: i * 1.7 });
  }

  // A small cascade feeds the lake beside the crossing, never over the road.
  const waterfall = place(3, 0.28, 1, 44, 13);
  let waterMap = null;
  if (waterfall) {
    waterfall.name = "Reedwater cascade and limestone spring";
    const height = 23;
    imported("kenney:nature/rock-largee", waterfall, [-7, -0.5, 2], 28);
    imported("kenney:nature/rock-larged", waterfall, [7, -0.5, 3], 25);
    waterMap = textures.water?.clone() || null;
    if (waterMap) {
      waterMap.repeat.set(1, 5);
      waterMap.needsUpdate = true;
    }
    const water = new THREE.MeshStandardMaterial({
      color: "#b4e9e3",
      map: waterMap,
      roughness: 0.32,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
    });
    const sheet = mesh(new THREE.PlaneGeometry(5.5, height, 4, 8), water, waterfall, [
      0,
      height / 2,
      -0.4,
    ]);
    sheet.castShadow = false;
    sheet.userData.skipBake = true;
    for (let j = 0; j < 7; j++)
      mesh(sphere, cream, waterfall, [(j - 3) * 0.9, 0.4, -0.5], [0.9, 0.12, 0.6]).castShadow =
        false;
  }

  // An outer plank line is a fully driveable extension with its own scenery.
  // Low posts delineate it; reeds separate it visually from the inner deck.
  for (let i = 0; i < 12; i++) {
    const t = sectorT(3, 0.24 + i * 0.031),
      half = track.roadHalfWidth(t);
    const g = groupAt(t, half + 3.3);
    g.name = "Reed-side optional boardwalk";
    box(wood, g, [0, -0.2, 0], [5.2, 0.3, 1.8]);
    box(bark, g, [0, -3, 0], [0.45, 5.8, 0.45]);
    if (i % 3 === 0) imported("windmill:cattail", g, [-2.3, -0.4, 0], 1.5);
  }
  // Little low-cost duck families move independently of the racing pack.
  for (let family = 0; family < 3; family++) {
    const t = sectorT(3, 0.3 + family * 0.15),
      p = track.poseAt(t * track.TRACK, 33 + family * 6, 0).p;
    const g = new THREE.Group();
    g.position.set(p.x, -1.35, p.z);
    scene.add(g);
    g.name = "Reedwater duck family";
    g.userData.skipBake = true;
    for (let j = 0; j < 4; j++) {
      const size = j === 0 ? 1 : 0.55;
      mesh(
        sphere,
        j === 0 ? cream : amber,
        g,
        [-j * 1.4, 0.25, Math.sin(j) * 0.6],
        [0.5 * size, 0.3 * size, 0.7 * size],
      );
      mesh(
        sphere,
        leaf,
        g,
        [-j * 1.4, 0.55 * size, 0.48 + Math.sin(j) * 0.6],
        [0.25 * size, 0.28 * size, 0.25 * size],
      );
      box(
        amber,
        g,
        [-j * 1.4, 0.5 * size, 0.73 + Math.sin(j) * 0.6],
        [0.19 * size, 0.1 * size, 0.25 * size],
      );
    }
    kit.batch(g);
    animated.push(g);
    ducks.push({ g, x: p.x, z: p.z, phase: family * 2 });
  }

  // The maze makes you feel inside a place: stone corridors, close willow
  // trunks, narrow glimpses of water and fruit stalls round the next turn.
  for (let i = 0; i < 30; i++) {
    const f = 0.025 + i * 0.032;
    const g = place(6, f, i % 2 ? 1 : -1, 7 + (i % 3) * 3, 3.5);
    if (!g) continue;
    g.name = "Willow maze canopy and moss gardens";
    imported("windmill:willow", g, [0, 0, 0], 15 + (i % 3) * 2);
    if (i % 3 === 0) {
      imported("windmill:stone-wall", g, [0, 0, 3], 1.5);
      imported("windmill:flower-bush", g, [-2, 0, 2], 1.2);
      imported("windmill:fern", g, [2, 0, 1], 1.5);
    }
  }
  // Crops grow into tall corridors near the exit, then abruptly release the
  // driver into a wide harvest fair. No overhead obstacle clips the camera.
  for (let i = 0; i < 18; i++)
    for (const side of [-1, 1]) {
      const g = place(7, 0.06 + i * 0.04, side, 3.3, 1);
      if (!g) continue;
      imported("kenney:nature/crops-cornstagec", g, [0, 0, 0], 3.3);
      imported("kenney:nature/crops-cornstagec", g, [side * 2.1, 0, 0.8], 3.5);
    }
  for (const f of [0.18, 0.79]) {
    const g = place(7, f, 1, 16, 4);
    if (!g) continue;
    imported("windmill:lodge", g, [0, 0, 0], 7);
    for (let j = 0; j < 4; j++) imported("kenney:nature/crop-pumpkin", g, [j - 1.5, 0.3, 4], 0.9);
    const rotor = new THREE.Group();
    rotor.position.set(0, 10, 0);
    g.add(rotor);
    for (let j = 0; j < 4; j++) {
      const sail = box([coral, amber][j % 2], rotor, [0, 0, 0.6], [0.6, 5, 0.12]);
      sail.rotation.z = (j * Math.PI) / 2;
      sail.position.set(Math.sin((j * Math.PI) / 2) * 2.5, Math.cos((j * Math.PI) / 2) * 2.5, 0.6);
    }
    mesh(cylinder, wood, rotor, [0, 0, 0], [0.6, 0.3, 0.6]).rotation.x = Math.PI / 2;
    kit.batch(rotor);
    animated.push(rotor);
    rotor.userData.skipBake = true;
    sails.push(rotor);
  }
  // Shallow channel winds alongside the willow maze; an animated shader costs
  // a single material, with no realtime reflections or additional lights.
  const channelPositions = [],
    channelUv = [],
    channelIndex = [];
  for (let i = 0; i <= 100; i++) {
    const t = sectorT(6, i / 100),
      s = track.surfaceAt(t);
    for (const offset of [s.rightEdge + 2, s.rightEdge + 5.5]) {
      const p = track.poseAt(t * track.TRACK, offset, 0).p;
      channelPositions.push(
        p.x,
        sceneryGroundHeight({ frame: track.frameAt(t), offset, ...s }) + 0.025,
        p.z,
      );
      channelUv.push(offset / 4, i / 5);
    }
    if (i < 100) {
      const a = i * 2;
      channelIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const channelGeometry = new THREE.BufferGeometry();
  channelGeometry.setAttribute("position", new THREE.Float32BufferAttribute(channelPositions, 3));
  channelGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(channelUv, 2));
  channelGeometry.setIndex(channelIndex);
  channelGeometry.computeVertexNormals();
  const channel = mesh(
    channelGeometry,
    createWaterMaterial({ scene, color: "#74b9ae", roughness: 0.32, flow: 0.035, foam: false }),
    scenery,
  );
  channel.name = "Willow irrigation channel";
  channel.castShadow = false;
  // Edges still use the common collision surface; scenery reinforces that limit.
  return {
    animated,
    update(time) {
      for (const { g, phase } of kites) {
        g.rotation.z = Math.sin(time * 0.7 + phase) * 0.22;
        g.rotation.y = Math.sin(time * 0.43 + phase) * 0.3;
      }
      for (const { g, x, z, phase } of ducks) {
        g.position.set(
          x + Math.sin(time * 0.09 + phase) * 4,
          -1.35 + Math.sin(time * 1.2 + phase) * 0.04,
          z + Math.cos(time * 0.09 + phase) * 4,
        );
        g.rotation.y = -time * 0.09 - phase;
      }
      for (const rotor of sails) rotor.rotation.z = time * 0.8;
      if (waterMap) waterMap.offset.y = -time * 0.3;
    },
  };
}
