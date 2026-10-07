/** Environmental signals, steam, water highlights, and cargo-shuttle animation. */
export function buildHarborLife({
  THREE,
  animated,
  craneHooks,
  harborPose,
  hazardAt,
  safeGroup,
  scene,
  scenery,
  track,
  kit,
  palette,
  geometry,
}) {
  const { align, batch, box, groupAt, material, mesh, sectorT } = kit;
  const { amber, blue, cyan, dark, glass, steel, window } = palette;
  const { cylinder, sphere } = geometry;
  const dummy = new THREE.Object3D();
  const rippleAxis = new THREE.Vector3(1, 0, 0);

  // An understated intersection signal gives the market a daily rhythm.
  // Its colors are atmospheric only, with no compulsory stopping for racers.
  const signalRed = material("#a86670", { emissive: "#ff4763", emissiveIntensity: 0.4 });
  const signalGreen = material("#6fa9a3", { emissive: "#4ee7c8", emissiveIntensity: 0.4 });
  for (const [district, f] of [
    [0, 0.94],
    [1, 0.86],
    [7, 0.06],
  ])
    for (const side of [-1, 1]) {
      const t = sectorT(district, f),
        s = track.surfaceAt(t),
        edge = side > 0 ? s.rightEdge : -s.leftEdge;
      const g = safeGroup(t, side * (edge + 2.7), 0.8);
      if (!g) continue;
      box(steel, g, [0, 3.8, 0], [0.18, 7.6, 0.18]);
      box(dark, g, [0, 7.4, 0], [0.7, 2.1, 0.6]);
      mesh(sphere, signalRed, g, [0, 8, 0.33], [0.2, 0.2, 0.1]);
      mesh(sphere, amber, g, [0, 7.4, 0.33], [0.2, 0.2, 0.1]);
      mesh(sphere, signalGreen, g, [0, 6.8, 0.33], [0.2, 0.2, 0.1]);
    }

  // One small particle buffer carries steam from sidewalk vents and a
  // warehouse exhaust. The soft sprite is generated without canvas or DOM.
  const spriteBytes = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const k = (y * 32 + x) * 4,
        r = Math.hypot((x - 15.5) / 15.5, (y - 15.5) / 15.5);
      spriteBytes[k] = spriteBytes[k + 1] = spriteBytes[k + 2] = 255;
      spriteBytes[k + 3] = Math.round(Math.max(0, 1 - r) ** 2 * 170);
    }
  const smokeMap = new THREE.DataTexture(spriteBytes, 32, 32);
  smokeMap.needsUpdate = true;
  const vents = [];
  for (const [district, f, side] of [
    [0, 0.5, -1],
    [1, 0.2, 1],
    [1, 0.84, -1],
    [2, 0.8, -1],
    [7, 0.86, 1],
  ]) {
    const t = sectorT(district, f),
      s = track.surfaceAt(t),
      edge = side > 0 ? s.rightEdge : -s.leftEdge;
    const g = safeGroup(t, side * (edge + 5), 1.8);
    if (!g) continue;
    box(steel, g, [0, 0.18, 0], [1.7, 0.3, 1.1]);
    for (let j = 0; j < 6; j++) box(dark, g, [-0.65 + j * 0.25, 0.34, 0], [0.12, 0.04, 0.95]);
    vents.push(g.position.clone());
  }
  const steamPositions = new Float32Array(vents.length * 9 * 3);
  const steamGeometry = new THREE.BufferGeometry();
  steamGeometry.setAttribute("position", new THREE.BufferAttribute(steamPositions, 3));
  const steam = new THREE.Points(
    steamGeometry,
    new THREE.PointsMaterial({
      color: "#9fbed1",
      size: 2.7,
      map: smokeMap,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    }),
  );
  steam.frustumCulled = false;
  scenery.add(steam);
  animated.push(steam);

  // Cheap world-space moving highlights read as harbor ripples and distant
  // ferry wake. No overlapping full-water transparent layers are involved.
  const rippleMaterial = material("#418d9f", {
    vertexColors: false,
    emissive: "#397b96",
    emissiveIntensity: 0.28,
    roughness: 0.3,
  });
  const ripples = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), rippleMaterial, 45);
  scenery.add(ripples);
  animated.push(ripples);
  ripples.castShadow = false;
  ripples.frustumCulled = false;

  // The visual shuttle body matches the engine contact box (2.7 × 4.3 m).
  const shuttle = new THREE.Group();
  scene.add(shuttle);
  box(steel, shuttle, [0, 0.7, 0], [2.7, 1.1, 4.3]);
  box(blue, shuttle, [0, 1.6, -0.7], [2.4, 0.8, 2.5]);
  box(amber, shuttle, [0, 1.55, 1.35], [2.2, 0.8, 1.25]);
  for (const x of [-1.1, 1.1])
    for (const z of [-1.4, 1.4]) {
      const wheel = mesh(cylinder, dark, shuttle, [x, 0.35, z], [0.38, 0.35, 0.38]);
      wheel.rotation.z = Math.PI / 2;
    }
  box(glass, shuttle, [0, 1.6, 2.03], [2, 0.62, 0.09]);
  box(window, shuttle, [0, 1.6, 2.09], [1.8, 0.5, 0.06]);
  for (const x of [-0.95, 0.95]) box(cyan, shuttle, [x, 0.9, 2.1], [0.35, 0.18, 0.08]);
  for (const x of [-1.25, 1.25]) box(amber, shuttle, [x, 0.55, 0], [0.08, 0.18, 3.8]);
  batch(shuttle);
  const warningMaterial = material("#ffc04e", { emissive: "#ff9a22", emissiveIntensity: 0 });
  const warning = groupAt(track.CART_T, 15, scenery);
  box(steel, warning, [0, 2.5, 0], [0.25, 5, 0.25]);
  mesh(sphere, warningMaterial, warning, [0, 5.2, 0], [0.48, 0.48, 0.48]);
  batch(scenery, animated);
  animated.push(shuttle);
  return {
    animated,
    update(time) {
      const state = hazardAt(time);
      align(shuttle, state);
      warningMaterial.emissiveIntensity = state.warning ? 1.6 + Math.sin(time * 14) * 0.7 : 0;
      signalRed.emissiveIntensity = time % 16 < 8 ? 0.2 : 1.15;
      signalGreen.emissiveIntensity = time % 16 < 8 ? 1.15 : 0.2;
      for (const crane of craneHooks) {
        const scale = 1 + Math.sin(time * 0.36 + crane.phase) * 0.11;
        crane.g.scale.y = scale;
        crane.g.position.y = -1.1 + 27 * (1 - scale);
      }
      for (let v = 0; v < vents.length; v++)
        for (let j = 0; j < 9; j++) {
          const rise = (time * 0.7 + j * 0.47 + v * 0.8) % 4.7,
            k = (v * 9 + j) * 3,
            p = vents[v];
          steamPositions[k] = p.x + Math.sin(time * 0.38 + j * 1.7) * (0.15 + rise * 0.18);
          steamPositions[k + 1] = p.y + 0.4 + rise;
          steamPositions[k + 2] = p.z + Math.cos(time * 0.3 + j) * (0.1 + rise * 0.17);
        }
      steamGeometry.attributes.position.needsUpdate = true;
      for (let i = 0; i < 45; i++) {
        const x = ((i * 37.1) % 340) - 170,
          z = ((i * 17.7) % 110) - 55;
        dummy.position.set(
          harborPose.p.x + x + Math.sin(time * 0.4 + i) * 0.8,
          -1.44,
          harborPose.p.z + z,
        );
        dummy.quaternion.setFromAxisAngle(rippleAxis, -Math.PI / 2);
        dummy.scale.set(2 + Math.sin(time * 0.6 + i) * 0.7, 0.08, 1);
        dummy.updateMatrix();
        ripples.setMatrixAt(i, dummy.matrix);
      }
      ripples.instanceMatrix.needsUpdate = true;
    },
  };
}
