import { instrumentLibrary } from "./instrument-library.js";
import { bellowsRig } from "./bellows-rig.js";
import { bellowsNozzleAt, bellowsPuffAt } from "../../simulation/course-mechanics.js";

const ENSEMBLES = [
  ["violin", "flute", "tuning-fork", "metronome", "case", "clarinet", "zither"],
  ["snare", "bass-drum", "timpani", "bongo", "cymbal", "tambourine", "xylophone", "marimba"],
  ["bell", "glockenspiel", "chimes", "triangle", "metronome", "gong"],
  ["tuba", "trumpet", "trombone", "french-horn", "saxophone", "accordion", "organ"],
  ["violin", "cello", "harp", "zither", "piano", "case"],
  ["piano", "harp", "organ", "timpani", "cello", "trumpet", "accordion", "chimes"],
];

export function buildMetronomeOrchestra(w) {
  const { track, kit, mesh, box, safe, motion, sphere, tube } = w;
  const library = instrumentLibrary(w);
  const { place, materials: m, group } = library;
  let placements = 0;
  // Six different districts, each with eight densely dressed pairs of stages.
  // Their reserved envelopes include the full bow, mallet and lid travel.
  for (let section = 0; section < 6; section++) {
    const families = ENSEMBLES[section];
    for (let bay = 0; bay < 8; bay++)
      for (const side of [-1, 1]) {
        const g = safe(section, 0.07 + bay * 0.12, side * 29, 13, 34);
        if (!g) continue;
        g.name = `Mechanical orchestra district ${section + 1}, stage ${bay + 1}`;
        box(m.wood, g, [0, 1.3, 0], [25, 2.6, 20]);
        box(m.velvet, g, [0, 2.65, 0], [24.5, 0.12, 19.5]);
        box(m.brass, g, [-side * 12.3, 2.45, 0], [0.35, 0.35, 20]);
        for (const x of [-10.5, 10.5])
          for (const z of [-8, 8]) {
            const foundation = g.position.y - track.course.theme.groundHeight;
            box(m.ebony, g, [x, -foundation / 2, z], [1.2, foundation, 1.2]);
          }
        for (let row = 0; row < 2; row++)
          for (let column = 0; column < 3; column++) {
            const i = row * 3 + column;
            const kind = families[(bay * 3 + i + (side > 0 ? 2 : 0)) % families.length];
            const perform = bay % 2 === 0 && i === (bay + (side > 0 ? 1 : 0)) % 6;
            const instrument = place(
              kind,
              g,
              [(column - 1) * 7.5, 2.75 + row * 0.9, row * 8 - 4],
              kind === "flute" || kind === "clarinet" ? 1.7 : 1.25 + (bay % 3) * 0.12,
              perform,
              section * 0.7 + bay * 0.48 + side,
            );
            instrument.rotation.y = side * 0.22 + (column - 1) * 0.15;
            placements++;
          }
        const clamp = section === 0 || section === 5 ? workshop(g, bay, side) : null;
        // A high shelf supplies foreground/middle/background layers rather than
        // placing every prop on the same floor.
        if (bay % 2 === 0) {
          box(m.wood, g, [0, 14, 7.5], [23, 0.65, 4]);
          for (const x of [-10, 10]) box(m.brass, g, [x, 8, 8], [0.28, 12, 0.3]);
          for (let i = 0; i < 4; i++) {
            place(families[(bay + i) % families.length], g, [-8.5 + i * 5.7, 14.4, 7.5], 0.72);
            placements++;
          }
        }
        // Merge each stage's still instruments by material before regional
        // batching. The independent performers retain their articulated rigs.
        library.flatten(g, [...library.performers, ...(clamp ? [clamp] : [])]);
      }
  }
  function workshop(g, bay, side) {
    const desk = group(g, [side * 7, 3, -8]);
    if (kit.hasAsset("art:workshop-desk"))
      kit.fitAsset("art:workshop-desk", desk, [0, 0, 0], [8, 3.2, 3]);
    else box(m.wood, desk, [0, 2, 0], [8, 1, 3]);
    place("case", desk, [-1.2, 3.3, 0], 0.7, bay % 2 === 0, bay);
    place("tuning-fork", desk, [2.8, 3.3, 0], 0.45);
    if (bay % 2 === 0 && kit.hasAsset("art:score-shelves"))
      kit.fitAsset("art:score-shelves", g, [side * 10, 2.8, 7.7], [4.5, 9, 2.5]);
    // A jointed clamp and a swivelling polishing brush work without a performer.
    const clamp = group(desk, [-3, 3.5, 0.7]);
    tube(clamp, [0, 0, 0], [0, 1.8, 0], 0.12, m.brass);
    const elbow = group(clamp, [0, 1.8, 0]);
    tube(elbow, [0, 0, 0], [1.7, 0, 0], 0.1, m.brass);
    mesh(sphere, m.ebony, elbow, [1.7, 0, 0], [0.3, 0.2, 0.2]);
    if (bay % 2 === 0)
      motion(clamp, (time, state) => {
        const clock = state?.motionEnabled === false ? 0 : time;
        clamp.rotation.y = Math.sin(clock * Math.PI * 0.5 + bay) * 0.35;
        elbow.rotation.z = Math.sin(clock * Math.PI + bay) * 0.18;
      });
    kit.batch(elbow);
    // Scores remain scenery: no key sequence, trigger or new shortcut.
    for (let sheet = 0; sheet < 4; sheet++) {
      const paper = box(m.ivory, desk, [-0.4 + sheet * 0.7, 3.28, 0], [0.7, 0.035, 1]);
      paper.rotation.y = sheet * 0.14;
      for (let line = 0; line < 5; line++)
        box(m.ebony, desk, [-0.4 + sheet * 0.7, 3.31, -0.3 + line * 0.12], [0.6, 0.008, 0.015]);
    }
    return bay % 2 === 0 ? clamp : null;
  }
  // Hero silhouettes rise above the smaller ensembles, on complete plinths.
  for (const [section, fraction, side, kind, size] of [
    [0, 0.42, -1, "metronome", 6],
    [1, 0.67, 1, "timpani", 7],
    [2, 0.46, -1, "gong", 7],
    [3, 0.65, 1, "tuba", 6],
    [4, 0.62, -1, "harp", 7],
    [5, 0.55, 1, "piano", 7],
  ]) {
    const g = safe(section, fraction, side * 70, 27, 60);
    if (!g) continue;
    box(m.wood, g, [0, 2.5, 0], [54, 5, 32]);
    place(kind, g, [0, 5, 0], size, true, section * 0.6);
    for (const x of [-22, 22]) {
      const h = g.position.y - track.course.theme.groundHeight;
      box(m.ebony, g, [x, -h / 2, 0], [3, h, 22]);
    }
    placements++;
  }
  // Flexible accordion folds, with separate rigid cases, are real skinned rigs.
  for (const section of [0, 3, 5]) {
    const g = safe(section, 0.82, -43, 8, 16);
    if (!g) continue;
    const assembly = group(g, [0, 8, 0]);
    const rig = bellowsRig(w, assembly, m.leather, 9, 8, 5);
    const left = box(m.wood, assembly, [-5.5, 0, 0], [2, 8.5, 5.5]);
    const right = box(m.wood, assembly, [5.5, 0, 0], [2, 8.5, 5.5]);
    for (let i = 0; i < 16; i++)
      box(m.ivory, right, [0, 0.42 - i * 0.056, -0.52], [0.8, 0.05, 0.12]);
    kit.batch(right);
    motion(assembly, (time, state) => {
      const clock = state?.motionEnabled === false ? 0 : time;
      const amount = 0.72 + (1 + Math.sin(clock * Math.PI * 0.5 + section)) * 0.24;
      rig.compress(amount);
      left.position.x = -4.5 * amount - 1;
      right.position.x = 4.5 * amount + 1;
    });
    box(m.wood, g, [0, 2.8, 0], [16, 5.6, 9]);
    placements++;
  }
  buildBellowsPassage(w, m, library);
  w.scenery.userData.orchestraPlacements = placements;
}

function buildBellowsPassage(w, m, library) {
  const { THREE, track, kit, mesh, box, at, motion, sphere, tube } = w;
  const d = track.course.bellows;
  if (!d) return;
  for (const side of [-1, 1]) {
    const nozzle = bellowsNozzleAt(track, side);
    const g = at(d.section, d.fraction, nozzle.offset);
    g.name = `Bellows air gate ${side < 0 ? "left" : "right"}`;
    g.userData.scenicAssembly = false;
    const machine = library.group(g, [side * 5, 3.5, 0]);
    const rig = bellowsRig(w, machine, m.leather, 7, 4, 6);
    const plate = box(m.wood, machine, [side * 4, 0, 0], [1, 4.6, 6.5]);
    box(m.wood, g, [side * 5, 0.8, 0], [9, 1.6, 8]);
    const horn = mesh(new THREE.CylinderGeometry(0.8, 1.3, 3, 20, 1, true), m.brass, g, [
      side * 0.6,
      1.4,
      0,
    ]);
    horn.rotation.z = (side * Math.PI) / 2;
    tube(g, [side * 1.7, 1.4, 0], [side * 4, 3.5, 0], 0.45, m.brass);
    if (kit.hasAsset("art:air-pump")) kit.fitAsset("art:air-pump", g, [side * 10, 0, 0], [4, 5, 5]);
    // Direction arrows are on the machinery, facing the oncoming kart.
    for (let i = 0; i < 3; i++) {
      const arrow = box(m.ivory, g, [side * (5 + i), 4.5, -3.4], [0.6, 0.18, 0.18]);
      arrow.rotation.z = (-side * Math.PI) / 4;
    }
    const lampMaterial = new THREE.MeshStandardMaterial({
      color: "#ffd28a",
      emissive: "#ffb744",
      emissiveIntensity: 0.1,
    });
    const warning = mesh(sphere, lampMaterial, g, [side * 7, 6.5, -2.8], [0.6, 0.6, 0.6]);
    const puffRoot = library.group(g, [0, 1.4, 0]);
    puffRoot.name = "Visible sideways bellows puff";
    puffRoot.userData.skipBake = true;
    const airMaterial = new THREE.MeshBasicMaterial({
      color: "#dceffc",
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const cloud = new THREE.InstancedMesh(sphere, airMaterial, 12);
    cloud.name = "Instanced bellows air lobes";
    cloud.castShadow = cloud.receiveShadow = false;
    cloud.frustumCulled = false;
    puffRoot.add(cloud);
    const lobe = new THREE.Object3D();
    // Reusable drifting lobes and expanding rings describe the direction and
    // full volume tested by bellowsAirAt; no per-frame particle allocation.
    kit.batch(machine, [rig.skin, plate]);
    motion(machine, (time) => {
      const puff = bellowsPuffAt(d, time, side);
      const amount = 0.55 + puff.inflation * 0.65;
      rig.compress(amount);
      plate.position.x = side * (3.5 * amount + 0.5);
      lampMaterial.emissiveIntensity = puff.inflation * 1.3;
      warning.scale.setScalar(0.6 + puff.inflation * 0.08);
    });
    // Hazard visuals must keep the authoritative clock even with ambient motion off.
    motion(puffRoot, (time) => {
      const puff = bellowsPuffAt(d, time, side);
      const front = d.reach * Math.min(1, puff.progress * 3);
      puffRoot.visible = puff.active;
      airMaterial.opacity = puff.strength * 0.11;
      for (let i = 0; i < cloud.count; i++) {
        const q = (i + 0.5) / cloud.count;
        const distance = front * q;
        const width = 0.8 + ((d.halfWidth - 0.8) * distance) / d.reach;
        lobe.position.set(
          -side * distance,
          Math.sin(i * 2.4 + puff.progress * 8) * 0.3,
          Math.sin(i * 1.8) * width * 0.35,
        );
        lobe.scale.set(1.5 + distance * 0.045, 0.65 + q * 0.65, width * 0.65);
        lobe.updateMatrix();
        cloud.setMatrixAt(i, lobe.matrix);
      }
      cloud.instanceMatrix.needsUpdate = true;
    });
  }
}
