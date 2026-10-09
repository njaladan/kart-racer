import { mergeGeometries } from "../../../vendor/three/addons/utils/BufferGeometryUtils.js";

// Small, shared prototypes keep hundreds of instruments cheap to instance.
// The museum violin supplies the string section's authored silhouette; moving
// keys, bows, lids and mallets live on independent local pivots.
export function instrumentLibrary(w) {
  const { THREE, kit, mat, mesh, box, tube, cylinder, sphere, torus, motion } = w;
  const wood = mat("#a76032", "wood", { roughness: 0.42 });
  const brass = mat("#edc17d", "metal", { metalness: 0.65, roughness: 0.25 });
  const silver = mat("#bccbd6", "metal", { metalness: 0.65, roughness: 0.3 });
  const ebony = mat("#252535", null, { roughness: 0.34 });
  const ivory = mat("#fff0d0", null, { roughness: 0.6 });
  const velvet = mat("#384f79", "fabric");
  const copper = mat("#bf7356", "metal", { metalness: 0.55, roughness: 0.38 });
  const leather = mat("#67485b", "fabric", { roughness: 0.88 });
  const prototypes = new Map();
  const performers = [];
  const bell = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.12, 0),
      new THREE.Vector2(0.13, 0.35),
      new THREE.Vector2(0.25, 0.8),
      new THREE.Vector2(0.48, 1.1),
      new THREE.Vector2(0.83, 1.25),
      new THREE.Vector2(0.88, 1.27),
      new THREE.Vector2(0.83, 1.2),
      new THREE.Vector2(0.44, 1.04),
      new THREE.Vector2(0.22, 0.76),
      new THREE.Vector2(0.09, 0.32),
      new THREE.Vector2(0.08, 0),
    ],
    20,
  );
  const group = (parent, position = [0, 0, 0]) => {
    const g = new THREE.Group();
    g.position.set(...position);
    parent?.add(g);
    return g;
  };
  const curved = (g, points, radius = 0.15, material = brass) =>
    mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
        28,
        radius,
        8,
        false,
      ),
      material,
      g,
    );
  const ring = (g, material, position, radius, horizontal = false) => {
    const r = mesh(torus, material, g, position, [radius, radius, radius]);
    if (horizontal) r.rotation.x = Math.PI / 2;
    return r;
  };
  function stand(g, height = 1.8) {
    tube(g, [0, 0, 0], [0, height, 0], 0.09, ebony);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      tube(g, [0, 0.65, 0], [Math.cos(a), 0, Math.sin(a)], 0.07, ebony);
    }
  }
  function drum(g, radius = 1.35, height = 2, material = wood) {
    mesh(cylinder, material, g, [0, height / 2, 0], [radius, height, radius]);
    mesh(cylinder, ivory, g, [0, height + 0.015, 0], [radius * 0.96, 0.04, radius * 0.96]);
    for (const y of [0.12, height - 0.08]) ring(g, silver, [0, y, 0], radius, true);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      tube(
        g,
        [Math.cos(a) * radius, 0.25, Math.sin(a) * radius],
        [Math.cos(a) * radius, height - 0.25, Math.sin(a) * radius],
        0.055,
        silver,
      );
    }
  }
  function keyboard(g, count = 14, y = 1.8, z = -1.1) {
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * 0.3;
      box(ivory, g, [x, y, z], [0.28, 0.12, 1.1]);
      if (![2, 6].includes(i % 7)) box(ebony, g, [x + 0.15, y + 0.1, z + 0.28], [0.16, 0.13, 0.58]);
    }
  }
  function stringBody(g, kind) {
    if (kit.hasAsset("instrument:violin")) {
      const model = kit.asset("instrument:violin", g, [0, 0, 0], [6, 6, 6]);
      // Exported museum mesh has its original carved body; the fittings retain
      // their distinct ivory/brass/ebony materials rather than a global tint.
      model.name = "Imported CC0 museum violin";
      if (kind === "cello") model.scale.set(7.2, 8, 7.2);
    } else {
      for (const [y, r] of [
        [1.2, 1.1],
        [2.5, 0.8],
      ])
        mesh(sphere, wood, g, [0, y, 0], [r, r, 0.25]);
      box(ebony, g, [0, 3.8, -0.28], [0.28, 3.5, 0.18]);
      mesh(sphere, wood, g, [0, 5.7, 0], [0.38, 0.48, 0.23]);
    }
    const height = kind === "cello" ? 8 : 6;
    for (let i = 0; i < 4; i++)
      tube(
        g,
        [(i - 1.5) * 0.075, 0.6, -0.48],
        [(i - 1.5) * 0.075, height - 0.65, -0.48],
        0.013,
        silver,
      );
    box(wood, g, [0, 1.4, -0.51], [0.65, 0.14, 0.12]);
  }
  function build(kind) {
    const g = group();
    switch (kind) {
      case "violin":
      case "cello":
        stringBody(g, kind);
        break;
      case "harp":
        curved(
          g,
          [
            [-1.7, 0, 0],
            [-1.2, 4, 0],
            [0, 6, 0],
            [2, 6.3, 0],
            [2.3, 4.5, 0],
          ],
          0.24,
          wood,
        );
        tube(g, [2, 0, 0], [2.3, 5.7, 0], 0.25, brass);
        box(wood, g, [0.25, 0.3, 0], [4.2, 0.6, 1.1]);
        for (let i = 0; i < 16; i++)
          tube(g, [-1.3 + i * 0.2, 0.65, 0], [-1.3 + i * 0.2, 3.9 + i * 0.12, 0], 0.013, silver);
        break;
      case "zither":
        box(wood, g, [0, 0.5, 0], [4.8, 1, 2.6]);
        for (let i = 0; i < 16; i++)
          tube(g, [-2.1, 1.03, -1.1 + i * 0.14], [2.1, 1.03, -1.1 + i * 0.14], 0.012, silver);
        break;
      case "piano":
        box(wood, g, [0, 2.6, 0], [5.4, 3.8, 1.7]);
        box(ebony, g, [0, 1.9, -1.05], [5.8, 0.22, 1.4]);
        keyboard(g, 18, 2.05, -1.4);
        for (const x of [-2.2, 2.2]) box(wood, g, [x, 0.5, -0.5], [0.45, 1, 1.7]);
        for (let i = 0; i < 20; i++)
          tube(g, [-2.3 + i * 0.24, 2.3, -0.91], [-2.3 + i * 0.24, 4.15, -0.91], 0.025, brass);
        break;
      case "accordion":
        box(wood, g, [-1.4, 1.5, 0], [1, 3, 1.8]);
        box(wood, g, [1.4, 1.5, 0], [1, 3, 1.8]);
        for (let i = 0; i < 12; i++) {
          box(leather, g, [-0.9 + i * 0.16, 1.5, 0], [0.12, 2.7, 1.6]);
          box(brass, g, [-0.9 + i * 0.16, 1.5, -0.85], [0.045, 2.7, 0.08]);
        }
        for (let i = 0; i < 12; i++)
          box(ivory, g, [-1.45, 0.25 + i * 0.22, -0.96], [0.8, 0.2, 0.15]);
        for (let i = 0; i < 18; i++)
          mesh(
            sphere,
            ivory,
            g,
            [1.3 + (i % 3) * 0.17, 0.3 + Math.floor(i / 3) * 0.43, -0.96],
            [0.045, 0.045, 0.045],
          );
        break;
      case "organ":
        box(wood, g, [0, 0.8, 0], [5.8, 1.6, 2.8]);
        keyboard(g, 18, 1.65, -1.3);
        for (let i = 0; i < 9; i++) {
          const h = 3 + Math.abs(i - 4) * 0.7;
          mesh(cylinder, brass, g, [-2.2 + i * 0.55, h / 2 + 1.7, 0.45], [0.2, h, 0.2]);
          mesh(bell, brass, g, [-2.2 + i * 0.55, h + 1.6, 0.45], [0.3, 0.45, 0.3]);
        }
        break;
      case "trumpet":
      case "trombone":
        curved(
          g,
          [
            [-2.4, 1.9, 0],
            [-1.8, 1.9, 0],
            [0.8, 1.9, 0],
            [1.1, 1.4, 0],
            [-1.2, 1.2, 0],
            [-1.5, 1.5, 0],
            [0.9, 2.3, 0],
          ],
          0.13,
        );
        mesh(bell, brass, g, [0.9, 2.3, 0], [1, 1.4, 1]).rotation.z = -Math.PI / 2;
        for (let i = 0; i < 3; i++) {
          mesh(cylinder, brass, g, [-0.8 + i * 0.4, 2, 0], [0.18, 1.2, 0.18]);
          mesh(cylinder, ivory, g, [-0.8 + i * 0.4, 2.7, 0], [0.15, 0.09, 0.15]);
        }
        break;
      case "tuba":
      case "french-horn":
        for (const r of [1.1, 0.72]) ring(g, brass, [0, 1.7, 0], r);
        curved(
          g,
          [
            [-0.8, 1.8, 0],
            [-1.2, 0.3, 0],
            [1.1, 0.3, 0],
            [1.25, 4.3, 0],
          ],
          0.2,
        );
        mesh(bell, brass, g, [1.25, 4.1, 0], [1.6, 1.6, 1.6]);
        for (let i = 0; i < 3; i++)
          tube(g, [-0.4 + i * 0.4, 1.2, -0.35], [-0.4 + i * 0.4, 3.2, -0.35], 0.14, brass);
        break;
      case "saxophone":
        curved(
          g,
          [
            [-0.8, 4.8, 0],
            [-0.1, 4.3, 0],
            [0.1, 1, 0],
            [0.6, 0.5, 0],
            [1.1, 1, 0],
            [1.1, 2.2, 0],
          ],
          0.22,
        );
        mesh(bell, brass, g, [1.1, 2.1, 0], [0.9, 1, 0.9]);
        for (let i = 0; i < 7; i++)
          mesh(sphere, ivory, g, [0.1, 1.3 + i * 0.4, -0.25], [0.15, 0.12, 0.06]);
        break;
      case "flute":
      case "clarinet":
        mesh(cylinder, kind === "flute" ? silver : ebony, g, [0, 2.6, 0], [0.17, 5.2, 0.17]);
        for (let i = 0; i < 9; i++)
          mesh(sphere, silver, g, [0.12, 0.6 + i * 0.43, -0.16], [0.15, 0.13, 0.05]);
        if (kind === "clarinet")
          mesh(bell, ebony, g, [0, 0.6, 0], [0.6, 0.5, 0.6]).rotation.z = Math.PI;
        break;
      case "snare":
      case "bass-drum":
      case "bongo":
        drum(
          g,
          kind === "bass-drum" ? 2.2 : kind === "bongo" ? 0.8 : 1.35,
          kind === "bongo" ? 1.7 : 2.1,
        );
        if (kind === "bongo") {
          const b = group(g, [1.7, 0, 0]);
          drum(b, 0.65, 1.4);
        }
        break;
      case "timpani":
        mesh(sphere, copper, g, [0, 1.45, 0], [1.7, 1.1, 1.7]);
        mesh(cylinder, ivory, g, [0, 2, 0], [1.55, 0.06, 1.55]);
        ring(g, brass, [0, 2, 0], 1.6, true);
        for (const x of [-1, 1]) tube(g, [x, 1.2, 0], [x * 1.3, 0, 0], 0.1, ebony);
        break;
      case "cymbal":
        stand(g, 2.5);
        mesh(sphere, brass, g, [0, 2.5, 0], [1.7, 0.075, 1.7]);
        mesh(sphere, brass, g, [0, 2.6, 0], [0.32, 0.19, 0.32]);
        break;
      case "gong":
        for (const x of [-2.3, 2.3]) tube(g, [x, 0, 0], [x, 5.4, 0], 0.15, wood);
        tube(g, [-2.3, 5.4, 0], [2.3, 5.4, 0], 0.17, wood);
        mesh(sphere, brass, g, [0, 3, 0], [1.85, 1.85, 0.12]);
        ring(g, brass, [0, 3, -0.05], 1.85);
        mesh(sphere, copper, g, [0, 3, -0.15], [0.4, 0.4, 0.12]);
        break;
      case "tambourine":
        ring(g, wood, [0, 1.5, 0], 1.2);
        mesh(cylinder, ivory, g, [0, 1.5, 0], [1.13, 0.05, 1.13]).rotation.x = Math.PI / 2;
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          mesh(
            sphere,
            silver,
            g,
            [Math.cos(a) * 1.17, 1.5 + Math.sin(a) * 1.17, -0.08],
            [0.19, 0.19, 0.055],
          );
        }
        break;
      case "triangle":
        tube(g, [-1.2, 0.6, 0], [0, 2.8, 0], 0.09, silver);
        tube(g, [0, 2.8, 0], [1.2, 0.6, 0], 0.09, silver);
        tube(g, [-1.2, 0.6, 0], [0.92, 0.6, 0], 0.09, silver);
        break;
      case "chimes":
        box(wood, g, [0, 5.6, 0], [4.5, 0.3, 0.6]);
        for (let i = 0; i < 9; i++) {
          const h = 2.2 + i * 0.25;
          tube(g, [-1.8 + i * 0.45, 5.4, 0], [-1.8 + i * 0.45, 5.1, 0], 0.018, ebony);
          mesh(cylinder, silver, g, [-1.8 + i * 0.45, 5.1 - h / 2, 0], [0.12, h, 0.12]);
        }
        break;
      case "xylophone":
      case "marimba":
      case "glockenspiel":
        for (const x of [-2.4, 2.4])
          for (const z of [-0.8, 0.8]) tube(g, [x, 0, z], [x, 2, z], 0.08, ebony);
        box(wood, g, [0, 1.7, 0], [5.4, 0.4, 2.3]);
        for (let i = 0; i < 12; i++) {
          const x = -2.2 + i * 0.4;
          box(
            kind === "glockenspiel" ? silver : wood,
            g,
            [x, 2.05, 0],
            [0.34, 0.14, 2 - i * 0.065],
          );
          mesh(cylinder, brass, g, [x, 0.85, 0], [0.12, 1.5 - i * 0.06, 0.12]);
        }
        break;
      case "bell":
        mesh(bell, brass, g, [0, 2.5, 0], [1.5, 1.9, 1.5]).rotation.z = Math.PI;
        mesh(sphere, ebony, g, [0, 0.35, 0], [0.23, 0.23, 0.23]);
        ring(g, brass, [0, 2.7, 0], 0.25);
        break;
      case "tuning-fork":
        tube(g, [0, 0, 0], [0, 2.4, 0], 0.12, silver);
        curved(
          g,
          [
            [-0.6, 4.8, 0],
            [-0.6, 2.4, 0],
            [0, 2, 0],
            [0.6, 2.4, 0],
            [0.6, 4.8, 0],
          ],
          0.12,
          silver,
        );
        break;
      case "metronome": {
        const shape = new THREE.CylinderGeometry(0.5, 1.1, 3.2, 4);
        mesh(shape, wood, g, [0, 1.6, 0]);
        box(ivory, g, [0, 1.75, -0.63], [0.58, 2.1, 0.08]);
        break;
      }
      case "case":
        box(ebony, g, [0, 0.3, 0], [4.2, 0.6, 1.6]);
        box(velvet, g, [0, 0.62, 0], [3.9, 0.1, 1.35]);
        for (const x of [-1.5, 1.5]) box(brass, g, [x, 0.3, -0.85], [0.23, 0.35, 0.1]);
        break;
    }
    return g;
  }
  function flatten(g, excluded = []) {
    g.updateMatrixWorld(true);
    const batches = new Map();
    const inverse = g.matrixWorld.clone().invert();
    const originals = [];
    g.traverse((o) => {
      if (
        !o.isMesh ||
        o.isSkinnedMesh ||
        excluded.some((root) => root === o || root.getObjectById(o.id))
      )
        return;
      originals.push(o);
      const geo = o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));
      for (const name of Object.keys(geo.attributes))
        if (!["position", "normal", "uv", "color"].includes(name)) geo.deleteAttribute(name);
      if (!geo.attributes.uv)
        geo.setAttribute(
          "uv",
          new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2),
        );
      if (!geo.attributes.color)
        geo.setAttribute(
          "color",
          new THREE.Float32BufferAttribute(
            new Float32Array(geo.attributes.position.count * 3).fill(1),
            3,
          ),
        );
      if (!batches.has(o.material)) batches.set(o.material, []);
      const normalized = geo.index ? geo.toNonIndexed() : geo;
      batches.get(o.material).push(normalized);
      if (normalized !== geo) geo.dispose();
    });
    originals.forEach((o) => o.removeFromParent());
    for (const [material, geometries] of batches) {
      const combined = mergeGeometries(geometries);
      mesh(combined, material, g);
      geometries.forEach((geo) => geo.dispose());
    }
    return g;
  }
  function place(kind, parent, position, size = 1, perform = false, phase = 0) {
    if (!prototypes.has(kind)) prototypes.set(kind, flatten(build(kind)));
    const g = prototypes.get(kind).clone(true);
    g.name = `Self-playing ${kind}`;
    g.userData.instrumentFamily = kind;
    g.position.set(...position);
    g.scale.setScalar(size);
    parent.add(g);
    if (!perform) return g;
    performers.push(g);
    const moving = [];
    if (["violin", "cello", "zither", "harp"].includes(kind)) {
      const bow = group(g, [0, kind === "cello" ? 3 : 2, -0.65]);
      box(wood, bow, [0, 0, 0], [5, 0.07, 0.08]);
      box(ivory, bow, [0, -0.1, 0], [4.5, 0.025, 0.03]);
      box(ebony, bow, [-2, 0, 0], [0.4, 0.23, 0.25]);
      moving.push(bow);
    } else if (
      [
        "snare",
        "bass-drum",
        "bongo",
        "timpani",
        "xylophone",
        "marimba",
        "glockenspiel",
        "gong",
      ].includes(kind)
    ) {
      const mallet = group(g, [-2.2, 2.8, 0]);
      tube(mallet, [0, 0, 0], [2.2, 0, 0], 0.06, wood);
      mesh(sphere, velvet, mallet, [2.2, 0, 0], [0.28, 0.28, 0.28]);
      moving.push(mallet);
    } else if (["piano", "case"].includes(kind)) {
      const y = kind === "piano" ? 4.6 : 0.65;
      const lid = group(g, [0, y, 0.8]);
      box(wood, lid, [0, 0, -0.85], [kind === "piano" ? 5.6 : 4.2, 0.16, 1.7]);
      moving.push(lid);
      if (kind === "piano") {
        const hammers = group(g, [0, 3, -1]);
        for (let i = 0; i < 9; i++) box(ivory, hammers, [-2 + i * 0.5, 0, 0], [0.17, 0.65, 0.24]);
        kit.batch(hammers);
        moving.push(hammers);
        const keys = group(g, [0, 2.15, -1.4]);
        for (const x of [-1.5, -0.3, 0.9]) box(ivory, keys, [x, 0, 0], [0.27, 0.13, 1]);
        kit.batch(keys);
        moving.push(keys);
      }
    } else if (kind === "metronome") {
      const arm = group(g, [0, 0.7, -0.8]);
      tube(arm, [0, 0, 0], [0, 2.7, 0], 0.04, brass);
      box(silver, arm, [0, 1.7, 0], [0.35, 0.4, 0.18]);
      kit.batch(arm);
      moving.push(arm);
    } else if (kind === "trombone") {
      const slide = group(g, [0, 1.1, -0.3]);
      curved(
        slide,
        [
          [-0.5, 0, 0],
          [3.5, 0, 0],
          [3.8, 0.25, 0],
          [3.5, 0.5, 0],
          [-0.5, 0.5, 0],
        ],
        0.09,
        silver,
      );
      moving.push(slide);
    }
    const initialY = position[1];
    motion(g, (time, state) => {
      const clock = state?.motionEnabled === false ? 0 : time;
      const beat = clock * Math.PI + phase;
      const strike = Math.max(0, Math.sin(beat)) ** 8;
      const recovery =
        Math.sin(beat * 6) * Math.exp(-(((beat % Math.PI) + Math.PI) % Math.PI) * 2.2);
      g.position.y = initialY;
      g.rotation.z = 0;
      g.scale.setScalar(size);
      if (kind === "accordion") g.scale.x = size * (0.8 + 0.25 * (1 + Math.sin(beat * 0.5)));
      else if (["snare", "bass-drum", "bongo", "timpani"].includes(kind)) {
        g.scale.set(
          size * (1 + strike * 0.04),
          size * (1 - strike * 0.09),
          size * (1 + strike * 0.04),
        );
        moving[0].rotation.z = 0.6 - strike * 0.85;
      } else if (
        ["cymbal", "tambourine", "triangle", "bell", "chimes", "tuning-fork"].includes(kind)
      ) {
        g.rotation.z = recovery * (kind === "bell" ? 0.16 : 0.05);
      } else if (moving.length) {
        if (["violin", "cello", "zither", "harp"].includes(kind)) {
          moving[0].position.x = Math.sin(beat * 0.5) * 0.8;
          moving[0].rotation.z = Math.sin(beat * 0.5) * 0.06;
        } else if (["piano", "case"].includes(kind)) {
          moving[0].rotation.x = -0.25 - (1 + Math.sin(beat * 0.25)) * 0.3;
          if (moving[1]) moving[1].rotation.x = strike * 0.28;
          if (moving[2]) moving[2].position.y = 2.15 - strike * 0.09;
        } else if (kind === "metronome") moving[0].rotation.z = Math.sin(beat) * 0.38;
        else if (kind === "trombone") moving[0].position.x = (1 + Math.sin(beat * 0.5)) * 0.7;
        else moving[0].rotation.z = 0.65 - strike * 0.9;
      } else {
        g.rotation.z = Math.sin(beat * 0.5) * 0.025;
      }
    });
    return g;
  }
  return {
    place,
    materials: { wood, brass, silver, ebony, ivory, velvet, copper, leather },
    group,
    curved,
    ring,
    flatten,
    performers,
  };
}
