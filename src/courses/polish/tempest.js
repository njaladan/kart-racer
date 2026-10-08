/** Storm-coast landmarks: exposed ironwork, sheltered refuge, and rough water scale. */
export function polishTempest(w) {
  const {
    THREE,
    scene,
    track,
    mat,
    at,
    safe,
    mesh,
    box,
    motion,
    light,
    source,
    patch,
    bevelBox,
    edgeRibbon,
  } = w;
  const iron = mat("#263c4a", "metal", { metalness: 0.58, roughness: 0.38 });
  const saltStone = mat("#a5b2b3", "stone", { roughness: 0.9 });
  const darkRock = mat("#394b5a", "rock", { roughness: 0.96 });
  const warmGlass = mat("#ffd18a", "glass", { emissive: "#ff9c4d", emissiveIntensity: 1.2 });
  const moonWater = mat("#86aeb6", "water", {
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
  });
  const rand = w.seeded(0x7e4e57);
  const seaStack = w.kit.authoredGeometry("blender:sea-stack", new THREE.IcosahedronGeometry(1, 1));

  // Thin pale foam follows only exposed rock shelves, never the whole sea.
  for (const [section, fraction, side, spread] of [
    [0, 0.28, -1, 42],
    [2, 0.72, 1, 54],
    [4, 0.34, -1, 48],
    [6, 0.7, 1, 50],
  ]) {
    const shelf = safe(section, fraction, side * spread, 10);
    if (!shelf) continue;
    shelf.position.y -= 4;
    for (let i = 0; i < 3; i++) {
      const r = mesh(
        new THREE.RingGeometry(10 + i * 3, 12 + i * 3, 32),
        moonWater,
        shelf,
        [side * (i % 2 ? 4 : -3), 1 + i * 0.1, i * 5],
        [1.6 + i * 0.2, 1, 0.72],
      );
      r.rotation.x = -Math.PI / 2;
      r.rotation.z = (rand() - 0.5) * 0.12;
      r.castShadow = false;
    }
    // Eroded basalt faces make the bright waterline legible at three distances.
    for (let i = 0; i < 5; i++) {
      const scale = 0.68 + rand() * 0.7;
      const boulder = mesh(
        seaStack,
        i % 3 ? darkRock : saltStone,
        shelf,
        [side * (8 + rand() * 11), -3 + rand() * 2, -10 + i * 6],
        [scale * 8, scale * (11 + (i % 2) * 4), scale * 7],
      );
      boulder.rotation.y = rand() * Math.PI * 2;
    }
  }

  // Joint plates and diagonal ties clarify the giant bridge deck assembly.
  for (const section of [1, 3, 5]) {
    for (let i = 0; i < 8; i++) {
      const f = 0.08 + i * 0.12;
      const joint = at(section, f);
      joint.name = "Causeway expansion joint and tie plates";
      const half = Math.max(
        Math.abs(track.platformEdgeAt(track.sectorT(section, f), -1)),
        track.platformEdgeAt(track.sectorT(section, f), 1),
      );
      for (const side of [-1, 1]) {
        box(iron, joint, [side * (half - 1), 0.13, 0], [1.8, 0.24, 0.65]);
        for (const z of [-0.22, 0.22])
          mesh(
            new THREE.SphereGeometry(0.09, 8, 6),
            warmGlass,
            joint,
            [side * (half - 1), 0.3, z],
            [1, 1, 1],
          ).castShadow = false;
        if (i % 2 === 0) {
          const brace = mesh(
            bevelBox(0.22, 0.22, 1, 0.04),
            iron,
            joint,
            [side * (half - 2), -0.9, 0],
            [1, 1, 1],
          );
          brace.rotation.z = side * 0.5;
        }
      }
    }
    edgeRibbon(section, -1, {
      color: "#9db5b8",
      width: 0.12,
      roughness: 0.58,
      lift: 0.18,
      noise: 0.025,
    });
    edgeRibbon(section, 1, {
      color: "#9db5b8",
      width: 0.12,
      roughness: 0.58,
      lift: 0.18,
      noise: 0.025,
    });
  }

  // Connected refuge clusters transition from rain-dark cliff to warm pools.
  for (const [section, f, side] of [
    [0, 0.68, 1],
    [2, 0.23, -1],
    [4, 0.76, 1],
    [6, 0.22, -1],
  ]) {
    const cove = safe(section, f, side * 74, 18);
    if (!cove) continue;
    cove.name = "Sheltered sea-cliff refuge";
    for (const [x, z, s] of [
      [-14, -4, 1.2],
      [-7, 10, 0.8],
      [13, -8, 1.45],
      [20, 7, 0.7],
    ]) {
      const cliff = mesh(seaStack, darkRock, cove, [x, -9, z], [12 * s, 14 * s, 12 * s]);
      cliff.rotation.y = (x + z) * 0.07;
    }
    const basin = mesh(
      new THREE.CylinderGeometry(1, 1, 0.45, 32),
      moonWater,
      cove,
      [0, -1, 0],
      [12, 1, 10],
    );
    basin.rotation.y = 0.24;
    const poolLip = mesh(
      new THREE.TorusGeometry(1, 0.32, 6, 32),
      saltStone,
      cove,
      [0, -0.65, 0],
      [12.5, 10.5, 1],
    );
    poolLip.rotation.x = Math.PI / 2;
    const cottage = safe(section, f, side * 82, 15);
    if (cottage) {
      cottage.name = "Warm lighthouse-keeper cottage";
      box(saltStone, cottage, [0, 4, 0], [13, 8, 12]);
      const roof = mesh(new THREE.ConeGeometry(1, 1, 4), iron, cottage, [0, 10, 0], [11, 5, 10]);
      roof.rotation.y = Math.PI / 4;
      for (const x of [-3.5, 3.5]) {
        box(iron, cottage, [x, 4, 6.1], [3.2, 4.2, 0.22]);
        box(warmGlass, cottage, [x, 4, 6.25], [2.2, 3, 0.12]);
      }
      source(cottage, [0, 9, 0], "#ffc276", 0.42);
      light({
        parent: cottage,
        position: [0, 8, 0],
        color: "#ffad65",
        intensity: 12,
        radius: 22,
        kind: "practical",
      });
    }
  }

  // One beacon per exposed span; its beam and source share the same slow scan.
  for (const [section, f, side] of [
    [1, 0.5, -1],
    [3, 0.5, 1],
    [5, 0.5, -1],
  ]) {
    const tower = safe(section, f, side * 68, 11);
    if (!tower) continue;
    tower.name = "Causeway storm searchlight tower";
    box(iron, tower, [0, 14, 0], [3.2, 28, 3.2]);
    box(saltStone, tower, [0, 28, 0], [7, 2, 6]);
    const beamPivot = new THREE.Group();
    tower.add(beamPivot);
    beamPivot.position.set(0, 29, 0);
    mesh(new THREE.SphereGeometry(1, 12, 8), warmGlass, beamPivot, [0, 0, 0], [1.2, 0.8, 1.5]);
    source(beamPivot, [0, 0, 0], "#ffe1ae", 0.7);
    const phase = section * 0.37;
    const ray = mesh(
      new THREE.ConeGeometry(1, 1, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: "#c8e6ed",
        transparent: true,
        opacity: 0.075,
        depthWrite: false,
      }),
      beamPivot,
      [0, 0, -28],
      [13, 58, 13],
    );
    ray.rotation.x = Math.PI / 2;
    ray.castShadow = false;
    motion(beamPivot, (time) => {
      beamPivot.rotation.y = time * 0.13 + phase;
    });
    light({
      parent: beamPivot,
      position: [0, 0, 0],
      color: "#c7e7f0",
      intensity: 8,
      radius: 72,
      kind: "search",
      direction: [0, 0, -1],
      target: [0, 0, -35],
      staticBake: false,
    });
  }

  // Reuse the shared race state's lightning envelope; this adds no second cycle.
  const flash = { value: 0 };
  patch(warmGlass, "tempest-lightning-echo", (shader) => {
    shader.uniforms.stormEcho = flash;
    shader.fragmentShader = `uniform float stormEcho;\n${shader.fragmentShader}`.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      totalEmissiveRadiance+=vec3(.52,.68,.82)*clamp(stormEcho,0.,1.)*.9;`,
    );
  });
  const flashDriver = new THREE.Group();
  scene.add(flashDriver);
  light({
    parent: flashDriver,
    position: [0, 26, 0],
    color: "#d2e8ff",
    intensity: 68,
    radius: 190,
    kind: "weather-flash",
    staticBake: false,
    visibleSource: true,
  });
  motion(flashDriver, (_time, state) => {
    flash.value =
      state?.motionEnabled === false ? 0 : THREE.MathUtils.clamp(state?.stormFlash ?? 0, 0, 1);
  });
}
