import { worldKit } from "./world-kit.js";
import { registerLightPool } from "../../rendering/course-lighting.js";
import { kitchenRoadDetail } from "./pantry-materials.js";

/** Cherrywood, blue velvet and polished brass inside a giant working music box. */
export function buildMetronome(context) {
  const w = worldKit(context),
    { THREE, scene, scenery, track, mat, mesh, box, at, motion, cylinder, sphere, torus, tube } = w;
  const wood = mat("#8d573e", "wood"),
    dark = mat("#563c46", "wood"),
    gold = mat("#dab477", "metal", { metalness: 0.6, roughness: 0.32 }),
    ivory = mat("#f4e0b9"),
    velvet = mat("#535d85", "fabric"),
    pink = mat("#c793a6", "fabric"),
    blue = mat("#829cb3", "fabric"),
    glow = mat("#ffdb9f", "stone", { emissive: "#ffc775", emissiveIntensity: 0.8 });
  kitchenRoadDetail(wood);
  const keyShape = new THREE.Shape();
  keyShape.moveTo(-1.4, 0);
  keyShape.lineTo(1.4, 0);
  keyShape.lineTo(1.4, 0.8);
  keyShape.bezierCurveTo(2.9, 1, 3, 3.5, 1, 3.4);
  keyShape.bezierCurveTo(0.3, 3.4, 0.1, 2.8, 0, 2.3);
  keyShape.bezierCurveTo(-0.1, 2.8, -0.3, 3.4, -1, 3.4);
  keyShape.bezierCurveTo(-3, 3.5, -2.9, 1, -1.4, 0.8);
  keyShape.closePath();
  for (const side of [-1, 1]) {
    const hole = new THREE.Path();
    hole.absellipse(side * 1.2, 2.2, 0.6, 0.65, 0, Math.PI * 2, true);
    keyShape.holes.push(hole);
  }
  const keyGeo = new THREE.ExtrudeGeometry(keyShape, {
    depth: 0.25,
    bevelEnabled: true,
    bevelSize: 0.07,
    bevelThickness: 0.07,
    bevelSegments: 2,
    curveSegments: 12,
  });
  // Continuous instrument case with gilded rims and pierced support cabinets.
  for (let section = 0; section < 6; section++) {
    if (section === track.course.drumField?.section) continue;
    w.sweep(
      section,
      0,
      1,
      (t) => track.platformEdgeAt(t, -1),
      (t) => track.platformEdgeAt(t, 1),
      wood,
      -0.14,
    );
    w.sweep(
      section,
      0,
      1,
      (t) => track.platformEdgeAt(t, -1),
      (t) => track.platformEdgeAt(t, 1),
      dark,
      -2,
    );
    for (const side of [-1, 1]) {
      w.sweep(
        section,
        0,
        1,
        (t) => track.platformEdgeAt(t, side),
        (t) => track.platformEdgeAt(t, side) - side * 0.25,
        gold,
        0,
      );
      for (let i = 0; i < 7; i++) {
        const g = at(section, (i + 0.5) / 7, side * 21),
          height = g.position.y + 22;
        box(dark, g, [0, -height / 2 - 1, 0], [3, height, 3]);
        mesh(cylinder, gold, g, [0, -2, 0], [2.1, 0.5, 2.1]);
      }
    }
  }
  // Sculpted cover lid becomes a luminous ceiling for the pendulum galleries.
  for (const section of [2, 3, 4])
    for (let i = 0; i < 8; i++) {
      const g = at(section, (i + 0.5) / 8);
      for (const side of [-1, 1]) {
        box(wood, g, [side * 19, 15, 0], [2, 30, 2]);
        box(gold, g, [side * 19, 2, 0], [3, 4, 3]);
        box(gold, g, [side * 19, 29, 0], [3, 2, 3]);
      }
      const arch = mesh(
        new THREE.TorusGeometry(1, 0.04, 6, 32, Math.PI),
        gold,
        g,
        [0, 22, 0],
        [19, 11, 19],
      );
      arch.name = "Gilded instrument arch";
      box(velvet, g, [0, 33, 0], [40, 1.3, 15]);
      for (const x of [-12, 0, 12]) box(glow, g, [x, 32.1, 0], [5, 0.12, 8]);
      if (i % 3 === 1) {
        g.updateWorldMatrix(true, false);
        registerLightPool(scene, {
          position: g.localToWorld(new THREE.Vector3(0, 24, 0)),
          color: "#ffd6a4",
          intensity: 38,
          radius: 35,
        });
      }
    }
  w.pendulums("hammer", "#d8b07a");
  // A colossal pinned drum and comb: the recognisable heart of the music box.
  const drum = at(1, 0.5, 95),
    rotor = new THREE.Group();
  drum.add(rotor);
  rotor.position.y = 32;
  mesh(cylinder, gold, rotor, [0, 0, 0], [28, 68, 28]).rotation.z = Math.PI / 2;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    for (let j = 0; j < 6; j++)
      if ((i + j * 3) % 4 < 2) {
        const pin = mesh(
          cylinder,
          ivory,
          rotor,
          [-28 + j * 11, Math.cos(a) * 28, Math.sin(a) * 28],
          [0.8, 4, 0.8],
        );
        pin.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, Math.cos(a), Math.sin(a)),
        );
      }
  }
  context.kit.batch(rotor);
  motion(rotor, (time) => {
    rotor.rotation.x = (time * Math.PI) / 4;
  });
  for (const x of [-37, 37]) {
    box(wood, drum, [x, 20, 0], [5, 40, 20]);
    mesh(torus, dark, drum, [x, 32, 0], [6, 6, 6]).rotation.y = Math.PI / 2;
  }
  for (let i = 0; i < 24; i++) {
    const tine = box(gold, drum, [-30 + i * 2.6, 6, -35], [1.5, 1, 23 + i * 0.7]);
    motion(tine, (time) => {
      tine.rotation.x = Math.sin(time * Math.PI + i * 0.3) * 0.01;
    });
  }
  box(dark, drum, [0, 2, -45], [78, 4, 18]);
  box(dark, drum, [0, -(drum.position.y + 22) / 2, 0], [82, drum.position.y + 22, 105]);
  // Workshop benches, oil cans, winding keys and velvet-lined cases.
  for (const section of [0, 5])
    for (let i = 0; i < 7; i++) {
      const g = at(section, 0.06 + i * 0.135, (i % 2 ? 1 : -1) * 36);
      box(wood, g, [0, 3, 0], [18, 6, 15]);
      box(velvet, g, [0, 6.1, 0], [17, 0.15, 14]);
      for (const x of [-7, 7])
        for (const z of [-5, 5])
          box(dark, g, [x, -(g.position.y + 22) / 2, z], [1.5, g.position.y + 22, 1.5]);
      mesh(keyGeo, gold, g, [-5, 6.2, -2], [2.5, 2.5, 2.5]);
      for (let j = 0; j < 4; j++) {
        mesh(cylinder, ivory, g, [2 + j * 2.5, 8, 1], [0.65, 4, 0.65]);
        mesh(sphere, dark, g, [2 + j * 2.5, 10.1, 1], [0.7, 0.35, 0.7]);
      }
      const arm = box(gold, g, [-3, 7, 4], [7, 0.4, 0.5]);
      motion(arm, (time) => {
        arm.rotation.y = Math.sin(time + i) * 0.12;
      });
    }
  // Dollhouse automatons and turning dancers populate the instrument stage.
  function dancer(g, color, size, phase) {
    const figure = new THREE.Group();
    g.add(figure);
    figure.scale.setScalar(size);
    mesh(sphere, ivory, figure, [0, 6.1, 0], [0.75, 0.9, 0.75]);
    mesh(cylinder, color, figure, [0, 4, 0], [0.8, 2.5, 0.8]);
    mesh(new THREE.ConeGeometry(1, 1, 10), color, figure, [0, 2.8, 0], [2, 1.8, 2]);
    for (const side of [-1, 1]) {
      tube(figure, [side * 0.4, 2.1, 0], [side * 0.9, 0.4, 0], 0.18, ivory);
      tube(figure, [side * 0.6, 4.8, 0], [side * 2.2, 5.8, 0], 0.17, ivory);
    }
    motion(figure, (time) => {
      figure.rotation.y = time * 0.45 + phase;
      figure.position.y = Math.sin(time * Math.PI + phase) * 0.18;
    });
    return figure;
  }
  for (const section of [2, 3, 4])
    for (let i = 0; i < 5; i++) {
      const g = at(section, 0.08 + i * 0.19, (i % 2 ? 1 : -1) * 28);
      mesh(cylinder, dark, g, [0, -(g.position.y + 22) / 2, 0], [5, g.position.y + 22, 5]);
      mesh(cylinder, wood, g, [0, 1, 0], [8, 2, 8]);
      mesh(cylinder, velvet, g, [0, 2.1, 0], [7.5, 0.2, 7.5]);
      dancer(g, i % 2 ? pink : blue, 1.5, i * 0.7);
      for (let j = 0; j < 10; j++)
        mesh(
          sphere,
          gold,
          g,
          [Math.cos((j / 10) * Math.PI * 2) * 7, 2.2, Math.sin((j / 10) * Math.PI * 2) * 7],
          [0.2, 0.2, 0.2],
        );
    }
  // Resonator towers rise in the middle distance; their felt hammers breathe.
  for (const section of [2, 3, 4])
    for (let i = 0; i < 5; i++) {
      const g = at(section, (i + 0.5) / 5, (i % 2 ? 1 : -1) * 62);
      box(dark, g, [0, -(g.position.y + 22) / 2, 0], [29, g.position.y + 22, 24]);
      box(dark, g, [0, 2, 0], [29, 4, 24]);
      for (let j = 0; j < 5; j++) {
        const height = 26 + j * 7;
        mesh(cylinder, gold, g, [-10 + j * 5, height / 2 + 4, 0], [2.1, height, 2.1]);
        mesh(torus, ivory, g, [-10 + j * 5, height + 4, 0], [2.2, 2.2, 2.2]).rotation.x =
          Math.PI / 2;
        const hammer = box(velvet, g, [-10 + j * 5, height * 0.5, 6], [3, 4, 3]);
        motion(hammer, (time) => {
          hammer.position.z = 6 + Math.sin(time * Math.PI + (j * Math.PI) / 2) * 2;
        });
      }
    }
  // The winding-key finale forms an unmistakable silhouette over the return.
  const winding = at(5, 0.35, -65),
    key = mesh(keyGeo, gold, winding, [0, 12, 0], [20, 20, 20]);
  motion(key, (time) => {
    key.rotation.y = time * 0.15;
  });
  box(wood, winding, [0, 4, 0], [76, 8, 36]);
  box(dark, winding, [0, -(winding.position.y + 22) / 2, 0], [76, winding.position.y + 22, 36]);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2,
      g = new THREE.Group();
    scenery.add(g);
    g.position.set(Math.cos(a) * 470, -22, Math.sin(a) * 470);
    box(velvet, g, [0, 45, 0], [48, 90, 16]);
    box(wood, g, [0, 0, 0], [56, 5, 22]);
    for (const side of [-1, 1]) box(gold, g, [side * 23, 45, 0], [1, 92, 18]);
    g.rotation.y = -a;
  }
  w.points("#ffe4b0", [0, 2, 3, 4, 5], 85, 0.2);
  return w.finish();
}
