/** Elevated quay supports, harbor water, ferries, cranes, and shoreline. */
export function buildWaterfront({
  THREE,
  animated,
  craneHooks,
  ferries,
  lamp,
  safeGroup,
  scenery,
  textures,
  track,
  kit,
  palette,
  geometry,
}) {
  const { asset, batch, box, groupAt, material, mesh, sectorT } = kit;
  const { amber, blue, concrete, cyan, rust, steel, trim, window } = palette;
  const { cylinder } = geometry;
  // Supported deck: no embankment under the declared elevated arc. Supports
  // are below the shared continuous road, never decorative road obstacles.
  for (let i = 0; i < 20; i++) {
    const t = sectorT(3, 0.04 + (0.84 * i) / 19),
      g = groupAt(t, 0, scenery);
    const height = Math.max(3, track.frameAt(t).p.y + 1.7);
    box(concrete, g, [0, -0.5, 0], [17.5, 0.9, 1.4]);
    for (const x of [-6, 6]) box(steel, g, [x, -height / 2 - 0.3, 0], [1, height, 1]);
    box(steel, g, [0, -2, 0], [13, 0.6, 0.7]);
    for (const side of [-1, 1]) {
      const brace = box(amber, g, [side * 4, -4, 0], [0.35, 5, 0.35]);
      brace.rotation.z = side * -0.5;
    }
    if (i % 2 === 0) lamp(t, 12, i);
  }
  // Water sits below the panorama, on the outside/south of the quay. Ships
  // and cranes sit beyond route footprints rather than becoming obstacles.
  const harborPose = track.poseAt(sectorT(3, 0.48) * track.TRACK, -90, 0);
  const waterMaterial = material("#1b657d", {
    map: textures.water ?? null,
    metalness: 0.42,
    roughness: 0.19,
    emissive: "#0b3549",
    emissiveIntensity: 0.2,
  });
  const water = mesh(new THREE.PlaneGeometry(370, 125), waterMaterial, scenery, [
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
      g = safeGroup(t, -58 - i * 13, 20);
    if (!g) continue;
    g.position.y = -1.1;
    box(steel, g, [0, 2, 0], [12, 4, 34]);
    box(rust, g, [0, 4.2, -2], [10, 1.2, 27]);
    box(concrete, g, [0, 7, 10], [8, 5, 9]);
    box(window, g, [0, 8.3, 14.55], [7, 0.7, 0.08]);
    for (let j = 0; j < 4; j++) box(j % 2 ? rust : blue, g, [0, 6, -11 + j * 5], [9, 3.5, 4]);
    box(steel, g, [0, 12, 10], [0.4, 8, 0.4]);
    for (const x of [-5.6, 5.6]) box(trim, g, [x, 4.4, 0], [0.12, 0.22, 29]);
    for (const z of [-10, -3, 4]) mesh(cylinder, steel, g, [6.1, 2.5, z], [0.6, 0.35, 0.6]);
    mesh(cylinder, amber, g, [0, 10, 10], [0.8, 2, 0.8]);
    batch(g);
    animated.push(g);
    ferries.push({ g, x: g.position.x, z: g.position.z, phase: i * 2.1 });
  }
  for (let i = 0; i < 4; i++) {
    const t = sectorT(3, 0.13 + i * 0.22),
      g = safeGroup(t, -35, 10);
    if (!g) continue;
    g.position.y = -1.1;
    for (const x of [-4, 4]) box(amber, g, [x, 14, 0], [1, 28, 1]);
    box(amber, g, [0, 28, 0], [10, 1, 1]);
    box(amber, g, [0, 27, 8], [1, 1, 20]);
    for (const side of [-1, 1]) {
      const brace = box(steel, g, [side * 2, 20, 0], [0.35, 14, 0.35]);
      brace.rotation.z = side * 0.29;
    }
    for (let j = 0; j < 5; j++) box(steel, g, [0, 27, 1 + j * 3.1], [3, 0.25, 0.3]);
    box(cyan, g, [0, 28.7, 0], [3, 0.15, 1.1]);
    batch(g);
    // Hook assembly moves entirely over the water; it never sweeps the road.
    if (i % 2 === 0) {
      const hook = groupAt(t, -35, scenery);
      hook.position.y = -1.1;
      box(steel, hook, [0, 19, 16], [0.15, 16, 0.15]);
      box(amber, hook, [0, 10.4, 16], [2.3, 0.55, 1.2]);
      box(blue, hook, [0, 8.5, 16], [4, 3, 4]);
      batch(hook);
      animated.push(hook);
      craneHooks.push({ g: hook, phase: i * 1.3 });
    } else box(steel, g, [0, 19, 16], [0.15, 16, 0.15]);
  }
  // Downloaded low-poly shoreline blocks break up the waterfront silhouette.
  if (asset)
    for (let i = 0; i < 12; i++) {
      const t = sectorT(3, 0.06 + (0.85 * i) / 12),
        g = safeGroup(t, -40 - (i % 3) * 5, 5);
      if (!g) continue;
      g.position.y = -1.2;
      const rock = asset(
        i % 2 ? "rock-a" : "rock-b",
        g,
        [0, 0, 0],
        [4 + (i % 3), 2.5 + (i % 2), 4],
      );
      rock.rotation.y = i * 0.7;
    }

  return { harborPose };
}
