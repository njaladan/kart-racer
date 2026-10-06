import { worldKit } from "./world-kit.js";
import { registerLightPool } from "../../rendering/course-lighting.js";
import { patchMaterial } from "../../rendering/surface-detail.js";

/** Original breakfast set: the racing ribbon is a counter, shelf and dish rack. */
export function buildPantry(context) {
  const w = worldKit(context),
    { THREE, scene, scenery, track, mat, mesh, box, at, motion, cylinder, sphere, torus, tube } = w;
  const cream = mat("#fff0cf"),
    wood = mat("#b98557", "wood"),
    dark = mat("#795643", "wood"),
    coral = mat("#ca7d68"),
    teal = mat("#5f9995"),
    porcelain = mat("#dcece3", "paving", { roughness: 0.3 }),
    silver = mat("#c9dedf", "metal", { metalness: 0.72, roughness: 0.26 }),
    jam = mat("#b45775", "sand", { roughness: 0.35 }),
    butter = mat("#f3d785"),
    crust = mat("#b66e38", "wood"),
    crumb = mat("#efd4a0", "sand"),
    glass = mat("#bfe4db", "glass", {
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      roughness: 0.16,
    }),
    glow = mat("#fff2c6", "stone", { emissive: "#ffd5a0", emissiveIntensity: 0.65 });
  patchMaterial(crumb, "biscuit-pores", (shader) => {
    shader.vertexShader = `varying vec3 vCrumb;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvCrumb=position;",
    );
    shader.fragmentShader = `varying vec3 vCrumb;\n${shader.fragmentShader}`.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      float pore=fract(sin(dot(floor(vCrumb*48.),vec3(12.98,78.23,41.1)))*43758.54);
      diffuseColor.rgb*=mix(.76,1.03,smoothstep(.06,.2,pore));`,
    );
  });
  const breadShape = new THREE.Shape();
  breadShape.moveTo(-1, 0);
  breadShape.lineTo(1, 0);
  breadShape.lineTo(1, 1.45);
  breadShape.bezierCurveTo(1.45, 2.55, -1.45, 2.55, -1, 1.45);
  breadShape.closePath();
  const breadGeo = new THREE.ExtrudeGeometry(breadShape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.08,
    bevelThickness: 0.06,
    curveSegments: 12,
  });
  const labelGeo = new THREE.PlaneGeometry(1, 1),
    labelMaterials = new Map();
  const label = (parent, position, scale, name) => {
    const texture = context.textures[name];
    if (texture) {
      const m =
        labelMaterials.get(name) ||
        context.kit.material("#ffffff", {
          map: texture,
          roughness: 0.85,
          side: THREE.DoubleSide,
        });
      labelMaterials.set(name, m);
      const p = mesh(labelGeo, m, parent, position, scale);
      p.castShadow = false;
    } else box(cream, parent, position, [scale[0], scale[1], 0.12]);
  };
  function toast(parent, position, size, topping = false) {
    mesh(breadGeo, crust, parent, position, [size, size, size]);
    mesh(
      breadGeo,
      crumb,
      parent,
      [position[0], position[1] + size * 0.06, position[2] + size * 0.32],
      [size * 0.83, size * 0.85, size * 0.08],
    );
    if (topping)
      box(
        butter,
        parent,
        [position[0], position[1] + size, position[2] + size * 0.48],
        [size * 0.75, size * 0.55, size * 0.1],
      );
  }
  function jar(parent, position, radius, height, material, name = "sunberry-label") {
    const g = new THREE.Group();
    parent.add(g);
    g.position.set(...position);
    mesh(cylinder, material, g, [0, height * 0.44, 0], [radius, height * 0.88, radius]);
    mesh(cylinder, silver, g, [0, height * 0.94, 0], [radius * 1.07, height * 0.12, radius * 1.07]);
    for (let i = 0; i < 3; i++)
      mesh(
        torus,
        cream,
        g,
        [0, height * (0.9 + i * 0.026), 0],
        [radius * 1.075, radius * 1.075, radius * 1.075],
      ).rotation.x = Math.PI / 2;
    label(g, [0, height * 0.48, radius + 0.05], [radius * 1.6, height * 0.48, 1], name);
    return g;
  }
  function cup(parent, position, size, color) {
    const g = new THREE.Group();
    parent.add(g);
    g.position.set(...position);
    mesh(cylinder, porcelain, g, [0, 0.35 * size, 0], [size * 1.65, size * 0.35, size * 1.65]);
    mesh(cylinder, color, g, [0, size * 1.4, 0], [size, size * 2.1, size]);
    mesh(cylinder, dark, g, [0, size * 2.48, 0], [size * 0.83, size * 0.025, size * 0.83]);
    mesh(torus, cream, g, [0, size * 2.48, 0], [size, size, size]).rotation.x = Math.PI / 2;
    mesh(torus, color, g, [size * 1.05, size * 1.5, 0], [size * 0.75, size * 0.9, size * 0.75]);
    return g;
  }
  function steam(parent, position, size, count = 6) {
    for (let i = 0; i < count; i++) {
      const puff = mesh(sphere, glass, parent, position, [size, size * 1.8, size]);
      puff.castShadow = false;
      motion(puff, (time) => {
        const q = (time * 0.17 + i / count) % 1;
        puff.position.set(
          position[0] + Math.sin(time * 0.7 + i) * size,
          position[1] + q * size * 15,
          position[2] + Math.cos(time + i) * size * 0.6,
        );
        puff.scale.setScalar(size * (0.25 + Math.sin(q * Math.PI) * 0.8));
      });
    }
  }
  function biscuitPerson(parent, position, size, phase) {
    const g = new THREE.Group();
    parent.add(g);
    g.position.set(...position);
    g.scale.setScalar(size);
    mesh(cylinder, crust, g, [0, 1.4, 0], [1, 0.48, 1]).rotation.x = Math.PI / 2;
    mesh(cylinder, crumb, g, [0, 1.4, 0.28], [0.84, 0.12, 0.84]).rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) {
      mesh(sphere, dark, g, [side * 0.3, 1.6, 0.4], [0.09, 0.1, 0.07]);
      tube(g, [side * 0.4, 0.65, 0], [side * 0.55, 0.1, 0.12], 0.1, dark);
      const arm = new THREE.Group();
      g.add(arm);
      arm.position.set(side * 0.85, 1.3, 0);
      tube(arm, [0, 0, 0], [side * 0.55, 0.45, 0], 0.09, dark);
      motion(arm, (time) => {
        arm.rotation.z = side * Math.sin(time * 1.8 + phase) * 0.3;
      });
    }
    box(coral, g, [0, 1, 0.46], [0.45, 0.2, 0.12]);
    motion(g, (time) => {
      g.rotation.y = Math.sin(time * 0.6 + phase) * 0.15;
    });
    return g;
  }
  // The room is composed as one giant kitchen, with a lit window and fitted units.
  const room = new THREE.Group();
  scenery.add(room);
  box(cream, room, [0, -24, 0], [1250, 3, 1250]);
  box(teal, room, [0, 55, -500], [1150, 160, 4]);
  box(coral, room, [530, 48, 0], [4, 145, 1000]);
  for (let i = 0; i < 12; i++) {
    const x = -490 + i * 86;
    box(porcelain, room, [x, 4, -472], [82, 50, 44]);
    box(wood, room, [x, 30, -458], [84, 3, 85]);
    for (const side of [-1, 1]) {
      box(teal, room, [x + side * 20, 5, -448], [36, 40, 1]);
      box(silver, room, [x + side * 7, 8, -447], [1.5, 8, 1.5]);
    }
    if (i % 2 === 0) {
      box(cream, room, [x, 88, -484], [76, 56, 28]);
      box(coral, room, [x, 88, -468], [66, 45, 1]);
      box(silver, room, [x + 24, 85, -466], [1.5, 8, 1.5]);
    }
  }
  box(glow, room, [-175, 92, -497], [225, 90, 3]);
  for (const x of [-290, -175, -60]) box(cream, room, [x, 92, -492], [4, 96, 4]);
  for (const y of [46, 92, 138]) box(cream, room, [-175, y, -492], [238, 4, 4]);
  for (const x of [-306, -45]) {
    const curtain = new THREE.Group();
    room.add(curtain);
    curtain.position.set(x, 138, -483);
    for (let i = 0; i < 6; i++)
      box(coral, curtain, [(i - 2.5) * 5, -40, Math.sin(i * 2) * 2], [5, 80, 2]);
    motion(curtain, (time) => {
      curtain.rotation.z = Math.sin(time * 0.5 + x) * 0.025;
    });
  }
  registerLightPool(scene, {
    position: new THREE.Vector3(-175, 65, -460),
    color: "#ffdfaf",
    intensity: 100,
    radius: 260,
  });
  // Counter shoulders, shelf undersides and fascia use the exact road curve.
  for (let section = 0; section < 7; section++) {
    const surface = section === 3 ? silver : section === 4 ? porcelain : wood;
    w.sweep(section, 0, 1, -46, 46, surface, -0.2);
    w.sweep(section, 0, 1, -47, 47, dark, -1.2);
    for (const side of [-1, 1]) {
      w.sweep(section, 0, 1, side * 45, side * 47, section === 4 ? teal : crust, -0.08);
      for (let i = 0; i < 6; i++) {
        const g = at(section, (i + 0.5) / 6, side * 42);
        const height = g.position.y + 22;
        box(section === 2 ? dark : teal, g, [0, -height / 2 - 1, 0], [3, height, 4]);
      }
    }
  }
  // Breakfast vignettes: toast, mugs, butter dishes, fruit and a bubbling kettle.
  for (const section of [0, 5, 6]) {
    for (let i = 0; i < 5; i++) {
      const g = at(section, 0.08 + i * 0.18, (i % 2 ? 1 : -1) * (31 + (i % 2) * 6));
      if (i % 3 === 0) {
        cup(g, [0, 0, 0], 5, i % 2 ? coral : teal);
        steam(g, [0, 14, 0], 1.1);
      } else if (i % 3 === 1) {
        mesh(cylinder, porcelain, g, [0, 0.4, 0], [16, 0.8, 16]);
        toast(g, [-5, 0.7, 0], 6, true);
        toast(g, [4, 0.7, -3], 5);
        biscuitPerson(g, [0, 1, 9], 1.4, i + section);
      } else {
        mesh(cylinder, porcelain, g, [0, 0.3, 0], [12, 0.6, 12]);
        box(butter, g, [0, 3, 0], [14, 5, 8]);
        label(g, [0, 3, 4.05], [10, 3, 1], "butter-label");
        for (let j = 0; j < 5; j++) mesh(sphere, jam, g, [-9 + j * 4, 1, 7], [1.7, 1.3, 1.7]);
      }
    }
  }
  const kettle = at(0, 0.48, 31);
  mesh(sphere, teal, kettle, [0, 10, 0], [12, 10, 12]);
  mesh(cylinder, cream, kettle, [0, 20, 0], [5, 2, 5]);
  mesh(torus, dark, kettle, [0, 21, 0], [10, 10, 10]);
  tube(kettle, [8, 9, 0], [18, 19, 0], 2.5, silver);
  steam(kettle, [18, 20, 0], 1.5, 8);
  // Sloping approach is surrounded by pantry steps; it is not a floating ramp.
  for (let i = 0; i < 10; i++) {
    const g = at(1, (i + 0.5) / 10, i % 2 ? 29 : -29);
    jar(
      g,
      [0, 0, 0],
      8 + (i % 3),
      25 + (i % 3) * 5,
      [jam, teal, crumb][i % 3],
      i % 3 === 2 ? "flour-label" : "sunberry-label",
    );
    box(wood, g, [0, -3, 0], [27, 6, 30]);
  }
  // Both portals coincide with the actual 20 m scale-transition bands.
  for (const [t, color, name] of [
    [track.sectorT(2, 0) + 10 / track.COURSE_LENGTH, jam, "sunberry-label"],
    [track.sectorT(4, 0.96) - 10 / track.COURSE_LENGTH, teal, "grow-label"],
  ]) {
    const g = w.groupAt(t),
      radius = 15;
    for (const z of [-10, 10]) mesh(torus, silver, g, [0, radius, z], [radius, radius, radius]);
    const shell = mesh(new THREE.CylinderGeometry(radius, radius, 20, 32, 1, true), glass, g, [
      0,
      radius,
      0,
    ]);
    shell.rotation.x = Math.PI / 2;
    shell.castShadow = false;
    for (const side of [-1, 1]) {
      box(color, g, [side * 14.5, 10, 0], [3, 16, 19]);
      label(g, [side * 17, 12, 0], [9, 8, 1], name);
      biscuitPerson(g, [side * 20, 0, 0], 2.3, side);
    }
    const ring = mesh(
      torus,
      glow,
      g,
      [0, radius, -10.1],
      [radius * 0.94, radius * 0.94, radius * 0.94],
    );
    motion(ring, (time) => {
      ring.rotation.z = time * 0.18;
    });
    g.updateWorldMatrix(true, false);
    registerLightPool(scene, {
      position: g.localToWorld(new THREE.Vector3(0, 8, 0)),
      color: name === "grow-label" ? "#95e3ce" : "#ffc392",
      intensity: 30,
      radius: 28,
    });
  }
  // Immense pantry shelves frame the miniature driver, with edible skylines.
  for (let i = 0; i < 8; i++) {
    const t = track.sectorT(2, (i + 0.5) / 8),
      side = i % 2 ? 1 : -1,
      g = context.kit.safeGroup(t, side * 60, 27);
    if (!g) continue;
    g.position.y = track.frameAt(t).p.y;
    box(teal, g, [0, 33, -22], [58, 70, 3]);
    const foundation = g.position.y + 22;
    box(dark, g, [0, -foundation / 2 - 2, 0], [58, foundation, 48]);
    for (const x of [-28, 28]) box(dark, g, [x, 33, 0], [3, 70, 46]);
    for (const y of [-1, 23, 47, 70]) {
      box(wood, g, [0, y, 0], [58, 2, 48]);
      if (y < 70)
        for (let j = 0; j < 3; j++)
          jar(
            g,
            [-18 + j * 18, y + 1, 0],
            7,
            19,
            [jam, crumb, teal][(i + j) % 3],
            j === 1 ? "flour-label" : "sunberry-label",
          );
    }
    label(g, [0, 63, 24.1], [38, 9, 1], "pantry-label");
  }
  for (let i = 0; i < 11; i++) {
    const g = at(2, 0.06 + i * 0.082, i % 2 ? 23 : -23);
    if (i % 3 === 0) jar(g, [0, 0, 0], 7, 28, crumb, "flour-label");
    else if (i % 3 === 1) {
      toast(g, [0, 0, 0], 11);
      biscuitPerson(g, [0, 0, 6], 1.2, i);
    } else {
      const cheese = new THREE.Shape();
      cheese.moveTo(-10, 0);
      cheese.lineTo(10, 0);
      cheese.lineTo(-10, 19);
      cheese.closePath();
      for (const [x, y, r] of [
        [-5, 5, 2],
        [-4, 12, 1.5],
        [3, 4, 1.8],
      ]) {
        const hole = new THREE.Path();
        hole.absarc(x, y, r, 0, Math.PI * 2, true);
        cheese.holes.push(hole);
      }
      mesh(
        new THREE.ExtrudeGeometry(cheese, { depth: 10, bevelEnabled: false, curveSegments: 10 }),
        butter,
        g,
        [0, 0, -5],
      );
    }
  }
  // A real low-roof racing line under biscuit tins; stays outside the main lane.
  const v = track.VERGES.find((v) => v.maxScale),
    tiny = mat("#e1ba82", "wood");
  w.sweep(
    3,
    0.15,
    0.8,
    (t) => -track.roadHalfWidth(t) - 0.5,
    (t) => -track.roadHalfWidth(t) - track.vergeWidth(t, -1),
    tiny,
    1.55,
  );
  for (let i = 0; i < 12; i++) {
    const t = v.start + ((v.end - v.start) * (i + 0.5)) / 12,
      edge = -track.roadHalfWidth(t) - v.extraWidth,
      g = w.groupAt(t, edge - 0.9);
    box(dark, g, [0, 0.75, 0], [0.4, 1.5, 3]);
    box(coral, g, [2, 4, 0], [5, 4.7, 6]);
    if (i % 3 === 0) {
      label(g, [2, 4.2, 3.05], [4, 2.8, 1], "biscuit-label");
      biscuitPerson(g, [4.5, 0, 0], 0.6, i);
    }
  }
  for (let i = 0; i < 9; i++) {
    const g = at(3, (i + 0.5) / 9, i % 2 ? 26 : -27);
    box(silver, g, [0, 0.8, 0], [3.5, 1.4, 40]);
    if (i % 2) {
      for (let j = 0; j < 4; j++) box(silver, g, [-6 + j * 4, 1, -24], [1.2, 1.6, 15]);
      box(silver, g, [0, 1, -16], [15, 1.6, 4]);
    } else mesh(sphere, silver, g, [0, 1, -23], [10, 2, 16]);
  }
  // The dish rack and sink are monumental but keep the racing surface visible.
  const sink = at(4, 0.45, 48);
  box(silver, sink, [0, -1.5, 0], [65, 3, 85]);
  for (const side of [-1, 1]) box(porcelain, sink, [side * 32, 4, 0], [3, 10, 88]);
  for (const z of [-42, 42]) box(porcelain, sink, [0, 4, z], [65, 10, 3]);
  box(teal, sink, [0, 0, 0], [61, 0.15, 81]);
  tube(sink, [-27, 0, -34], [-27, 34, -34], 2, silver);
  const faucet = mesh(
    new THREE.TorusGeometry(1, 0.12, 8, 24, Math.PI),
    silver,
    sink,
    [-13, 34, -34],
    [14, 14, 14],
  );
  faucet.rotation.y = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const drop = mesh(sphere, porcelain, sink, [-13, 30, -20], [0.35, 0.7, 0.35]);
    drop.castShadow = false;
    motion(drop, (time) => {
      drop.position.y = 30 - ((time * 0.65 + i / 8) % 1) * 30;
    });
  }
  for (let i = 0; i < 14; i++) {
    const g = at(4, 0.06 + i * 0.063, i % 2 ? 22 : -24),
      plate = mesh(cylinder, i % 2 ? porcelain : coral, g, [0, 11, 0], [10, 1.2, 10]);
    plate.rotation.z = Math.PI / 2;
    for (const side of [-1, 1]) tube(g, [side * 4, 0, -4], [side * 4, 14, -4], 0.4, silver);
    const bubble = mesh(sphere, glass, g, [0, 12, 8], [3 + (i % 3), 3 + (i % 3), 3 + (i % 3)]);
    bubble.castShadow = false;
    motion(bubble, (time) => {
      bubble.position.y = 10 + ((time * 0.9 + i * 2) % 20);
      bubble.position.x = Math.sin(time * 0.7 + i) * 3;
    });
  }
  for (let i = 0; i < 5; i++) {
    const g = at(6, 0.1 + i * 0.17);
    for (const side of [-1, 1]) {
      tube(g, [side * 16, 0, 0], [side * 16, 23, 0], 0.7, silver);
      toast(g, [side * 23, 0, 0], 10, i % 2 === 0);
    }
    const arch = mesh(
      new THREE.TorusGeometry(1, 0.027, 6, 28, Math.PI),
      silver,
      g,
      [0, 23, 0],
      [16, 7, 16],
    );
    arch.name = "Toast-rack gateway";
  }
  w.points("#fff0df", [0, 2, 5, 6], 85, 0.25);
  return w.finish();
}
