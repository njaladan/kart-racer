import { sceneryGroundHeight } from "../../rendering/terrain-height.js";

/** Late-stage countryside dressing: authored foliage, rooted verges and a warm mill grove. */
export function polishWindmill(w) {
  const { THREE } = w;
  const rand = w.seeded(73107);
  const grounded = (...args) => {
    const site = w.safe(...args);
    if (site) {
      site.position.y = sceneryGroundHeight(w.track.projectTrack(site.position, 0, true));
      site.userData.groundPlanted = true;
    }
    return site;
  };
  const asset = (name, parent, size, position = [0, 0, 0]) => {
    if (!w.kit.hasAsset(`windmill:${name}`)) return null;
    return w.kit.asset(`windmill:${name}`, parent, position, [size, size, size]);
  };
  const bark = w.mat("#745338", "bark", { roughness: 0.97 });
  const rootGeo = new THREE.CylinderGeometry(0.075, 0.18, 1, 6);
  const rootTuft = w.mat("#69804a", "leaves", { roughness: 0.98 });

  // Existing authored LOD trees have sculpted branches and varied foliage.
  // Added stands concentrate on the hollow and open toward the ridge reveal.
  for (let i = 0; i < 15; i++) {
    const section = i < 7 ? 1 : [0, 2, 5, 6][i % 4];
    const fraction = 0.075 + rand() * 0.85;
    const side = i % 2 ? 1 : -1;
    const offset = section === 1 ? 17 + rand() * 24 : 20 + rand() * 29;
    if (section === 2) continue;
    const g = grounded(section, fraction, side * offset, 5.2);
    if (!g) continue;
    g.name = `Layered tree silhouette, section ${section}`;
    g.rotation.y = rand() * Math.PI * 2;
    const species =
      section === 1 ? (i % 3 === 0 ? "oak" : "fir") : ["oak", "orchard", "willow"][i % 3];
    const height = section === 1 ? 15 + rand() * 8 : 9 + rand() * 6;
    const model = asset(species, g, height);
    if (model) {
      model.scale.x *= 0.78 + rand() * 0.38;
      model.scale.z *= 0.82 + rand() * 0.34;
    }
    // Three tapering roots meet the ground around the tree instead of ending
    // as a clean cylinder. Each branch is kept low and outside the racing edge.
    for (let j = 0; j < 3; j++) {
      const a = (j / 3) * Math.PI * 2 + rand() * 0.35;
      const length = 2.1 + rand() * 1.3;
      const root = w.mesh(
        rootGeo,
        bark,
        g,
        [Math.cos(a) * length * 0.36, 0.12, Math.sin(a) * length * 0.36],
        [0.75, length, 0.75],
      );
      root.rotation.z = Math.cos(a) * 0.84;
      root.rotation.x = Math.sin(a) * 0.84;
    }
  }

  // Matte bush and fern clusters use the countryside's detailed foliage models.
  // A few low grass tufts and blooms break up bare soil beds around the turns.
  for (let section = 0; section < 8; section++) {
    for (let i = 0; i < 3; i++) {
      const side = i % 2 ? 1 : -1;
      const fraction = 0.13 + i * 0.31 + rand() * 0.04;
      const g = grounded(section, fraction, side * (10.5 + rand() * 5), 2.2);
      if (!g) continue;
      const bush = asset("flower-bush", g, 1 + rand() * 0.38, [-0.85, 0, 0]);
      const fern = asset(
        section === 1 ? "fern" : "grass-tuft",
        g,
        0.85 + rand() * 0.5,
        [0.95, 0, 0.55],
      );
      if (bush) bush.rotation.y = rand() * Math.PI * 2;
      if (fern) fern.rotation.y = rand() * Math.PI * 2;
      if (i === 1 && section % 2 === 0) {
        const bloom = asset("flower-bush", g, 0.68, [0, 0, -0.95]);
        if (bloom) bloom.rotation.y = rand() * Math.PI * 2;
      }
    }
  }

  // Raised, irregular verge ribbons blend the road edge into turf, with broken
  // drainage details only at selected low points.
  for (const section of [0, 1, 3, 5, 6, 7]) {
    w.edgeRibbon(section, -1, {
      color: "#82945d",
      width: 1.8,
      textureName: "grass",
      roughness: 1,
      lift: 0.035,
      noise: 0.42,
    });
    w.edgeRibbon(section, 1, {
      color: "#8c9562",
      width: 1.15,
      textureName: "grass",
      roughness: 1,
      lift: 0.025,
      noise: 0.58,
    });
  }
  const pebble = new THREE.IcosahedronGeometry(1, 0);
  const stone = w.mat("#999980", "rock", { roughness: 1 });
  for (let i = 0; i < 8; i++) {
    const section = i % 3 === 0 ? 3 : i % 2 ? 1 : 5;
    const g = grounded(section, 0.13 + rand() * 0.74, (i % 2 ? 1 : -1) * (9 + rand() * 3), 1.2);
    if (!g) continue;
    for (let j = 0; j < 3; j++) {
      const r = 0.38 + rand() * 0.42;
      const rock = w.mesh(
        pebble,
        stone,
        g,
        [(j - 1) * 0.83, r * 0.32, (j % 2) * 0.5],
        [r * 1.4, r * 0.56, r],
      );
      rock.rotation.y = rand() * Math.PI;
    }
    if (i % 2 === 0) {
      const tuft = w.mesh(rootGeo, rootTuft, g, [0, 0.14, 0], [0.55, 1.2 + rand() * 0.5, 0.55]);
      tuft.rotation.z = (i % 4 ? 1 : -1) * 0.22;
    }
  }

  // The mill already has a detailed farmhouse and recessed windows. Warm local
  // emitters attach to that existing assembly, so no unsupported facade floats
  // beside the road. If the landmark is absent in a reduced asset build, the
  // same light sits safely on its approach.
  const mill = w.scene.getObjectByName("Working countryside windmill arch");
  if (mill) {
    for (const x of [-3.4, 3.4])
      w.light({
        parent: mill,
        position: [x, 24.8, 3.9],
        color: "#ffae54",
        intensity: 1.2,
        radius: 13,
        kind: "practical",
        pattern: null,
        staticBake: true,
      });
  } else {
    const approach = grounded(4, 0.55, 17, 2);
    if (approach)
      w.light({
        parent: approach,
        position: [0, 5, 0],
        color: "#ffae54",
        intensity: 1,
        radius: 11,
        kind: "practical",
        staticBake: true,
      });
  }

  // A soft canopy projection creates the feeling of sunlight filtering through
  // the existing forest crowns. It stays local to the grove and casts no road shade.
  w.light({
    parent: w.at(1, 0.51, -8),
    position: [0, 14, 0],
    color: "#d9efa0",
    intensity: 0.55,
    radius: 18,
    kind: "shaft",
    pattern: "leaves",
    direction: [0, -1, 0],
    staticBake: false,
  });

  // Clustered fireflies drift as a shared parent assembly. The layered source
  // and its local light share that parent, so their positions stay in lockstep.
  for (let i = 0; i < 9; i++) {
    const g = grounded(1, 0.18 + i * 0.078, (i % 2 ? 1 : -1) * (11 + rand() * 4), 0.75);
    if (!g) continue;
    const lightMount = new THREE.Group();
    lightMount.position.set((rand() - 0.5) * 2, 1.25 + rand() * 2.1, (rand() - 0.5) * 2.5);
    g.add(lightMount);
    const base = lightMount.position.clone();
    w.light({
      parent: lightMount,
      position: [0, 0, 0],
      color: i % 3 ? "#c9f283" : "#ffe19a",
      intensity: 0.55,
      radius: 7,
      kind: "fire",
      staticBake: false,
      phase: i * 1.7,
    });
    w.motion(lightMount, (time) => {
      lightMount.position.set(
        base.x + Math.sin(time * 0.43 + i) * 0.3,
        base.y + Math.sin(time * 0.62 + i) * 0.24,
        base.z + Math.cos(time * 0.39 + i) * 0.28,
      );
    });
  }
}
