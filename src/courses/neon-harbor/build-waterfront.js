import { createWaterMaterial } from "../../rendering/surface-detail.js";

/** Elevated quay supports, harbor water, ferries, cranes, and shoreline. */
export function buildWaterfront({
  THREE,
  scene,
  animated,
  craneHooks,
  ferries,
  lamp,
  safeGroup,
  fitAsset,
  scenery,
  textures,
  track,
  kit,
  palette,
  geometry,
}) {
  const { batch, box, groupAt, mesh, sectorT } = kit;
  const { amber, concrete, steel } = palette;
  void geometry;
  // Supported deck: no embankment under the declared elevated arc. Supports
  // are below the shared continuous road, never decorative road obstacles.
  for (let i = 0; i < 4; i++) {
    const t = sectorT(3, [0.04, 0.2, 0.76, 0.95][i]),
      g = groupAt(t, 0, scenery);
    g.rotation.set(0, track.yawFor(track.frameAt(t).tangent), 0);
    const height = Math.max(3, track.frameAt(t).p.y + 1.7);
    box(concrete, g, [0, -0.5, 0], [29, 0.9, 3]);
    for (const x of [-15, 15]) box(steel, g, [x, -height / 2 - 0.3, 0], [1, height, 1]);
    box(steel, g, [0, -2, 0], [13, 0.6, 0.7]);
    for (const side of [-1, 1]) {
      const brace = box(amber, g, [side * 4, -4, 0], [0.35, 5, 0.35]);
      brace.rotation.z = side * -0.5;
    }
    if (i % 2 === 0) lamp(t, 12, i);
  }
  // Water sits below the panorama, on the outside/south of the quay. Ships
  // and cranes sit beyond route footprints rather than becoming obstacles.
  const harborPose = track.poseAt(sectorT(3, 0.48) * track.TRACK, 90, 0);
  const waterMaterial = createWaterMaterial({
    scene,
    color: "#123248",
    normalMap: textures.water?.userData?.pbr?.normalMap,
    environment: scene.environment,
    roughness: 0.16,
    foam: true,
    flow: 0.025,
  });
  const water = mesh(new THREE.PlaneGeometry(1200, 1100), waterMaterial, scenery, [
    harborPose.p.x,
    -1.48,
    harborPose.p.z,
  ]);
  water.rotation.x = -Math.PI / 2;
  water.castShadow = false;
  const waterUV = water.geometry.attributes.uv;
  for (let i = 0; i < waterUV.count; i++)
    waterUV.setXY(i, waterUV.getX(i) * 18, waterUV.getY(i) * 6);
  animated.push(water);
  for (let i = 0; i < 3; i++) {
    const t = sectorT(3, 0.21 + i * 0.26),
      g = safeGroup(t, 67 + i * 23, 20);
    if (!g) continue;
    g.position.y = -1.1;
    fitAsset("harbor:cargo-ferry", g, [0, 0, 0], [12, 12, 34]);
    batch(g);
    animated.push(g);
    ferries.push({ g, x: g.position.x, z: g.position.z, phase: i * 2.1 });
  }
  for (let i = 0; i < 4; i++) {
    const t = sectorT(3, 0.13 + i * 0.22),
      g = safeGroup(t, 45, 10);
    if (!g) continue;
    g.position.y = -1.1;
    fitAsset("harbor:gantry-crane", g, [0, 0, 0], [10, 28, 30]);
    batch(g);
    // Hook assembly moves entirely over the water; it never sweeps the road.
    if (i % 2 === 0) {
      const hook = groupAt(t, 45, scenery);
      hook.position.y = -1.1;
      box(steel, hook, [0, 19, 16], [0.15, 16, 0.15]);
      box(amber, hook, [0, 10.4, 16], [2.3, 0.55, 1.2]);
      fitAsset("harbor:container", hook, [0, 7, 16], [4, 3, 6]);
      batch(hook);
      animated.push(hook);
      craneHooks.push({ g: hook, phase: i * 1.3 });
    } else box(steel, g, [0, 19, 16], [0.15, 16, 0.15]);
  }
  // Authored concrete tetrapods break the shoreline and catch reflected light.
  for (let i = 0; i < 24; i++) {
    const t = sectorT(3, 0.04 + (0.88 * i) / 24),
      g = safeGroup(t, 44 + (i % 3) * 4, 4);
    if (!g) continue;
    g.position.y = -1.1;
    const block = fitAsset("harbor:tetrapod", g, [0, 0, 0], [4.5, 3.4, 4.5]);
    if (block) block.rotation.y = i * 0.93;
  }

  return { harborPose };
}
