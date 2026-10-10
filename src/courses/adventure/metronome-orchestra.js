import { bellowsRig } from "./bellows-rig.js";
import { bellowsNozzleAt, bellowsPuffAt } from "../../simulation/course-mechanics.js";
import { registerLightPool } from "../../rendering/course-lighting.js";

/** Two composed performances, with open stretches between them. */
export function buildMetronomeOrchestra(w) {
  const { THREE, mat } = w;
  const m = {
    wood: mat("#a76032", "wood", { roughness: 0.42 }),
    brass: mat("#edc17d", "metal", { metalness: 0.65, roughness: 0.25 }),
    silver: mat("#bccbd6", "metal", { metalness: 0.65, roughness: 0.3 }),
    ebony: mat("#252535", null, { roughness: 0.34 }),
    ivory: mat("#fff0d0", null, { roughness: 0.6 }),
    velvet: mat("#384f79", "fabric"),
    leather: mat("#67485b", "fabric", { roughness: 0.88 }),
  };
  const group = (parent, position = [0, 0, 0]) => {
    const g = new THREE.Group();
    g.position.set(...position);
    parent.add(g);
    return g;
  };
  buildViolinSolo(w, m, group);
  buildDrumAccompaniment(w, m, group);
  buildBellowsPassage(w, m, { group });
}

function pedestal(w, m, g, width, depth, height = 3) {
  const { track, box } = w;
  box(m.wood, g, [0, height / 2, 0], [width, height, depth]);
  box(m.velvet, g, [0, height + 0.05, 0], [width - 0.5, 0.1, depth - 0.5]);
  const foundation = g.position.y - track.course.theme.groundHeight;
  for (const x of [-width * 0.36, width * 0.36])
    for (const z of [-depth * 0.36, depth * 0.36])
      box(m.ebony, g, [x, -foundation / 2, z], [1.5, foundation, 1.5]);
}

function buildViolinSolo(w, m, group) {
  const { THREE, kit, safe, mesh, box, tube, sphere, motion, scene } = w;
  // The whole bow stroke and the leaning neck fit inside this reserved envelope.
  // The preceding straight reveals the solo before racers reach its plinth.
  const g = safe(4, 0.17, -64, 46, 88);
  if (!g) return;
  g.name = "Giant violin solo";
  g.userData.composition = "violin-solo";
  pedestal(w, m, g, 58, 30, 4);
  const violin = group(g, [0, 4.15, 0]);
  violin.scale.setScalar(11);
  violin.rotation.set(0, Math.PI + 0.8, -0.1);
  violin.name = "Colossal self-playing violin";
  if (kit.hasAsset("instrument:violin"))
    kit.asset("instrument:violin", violin, [0, 0, 0], [6, 6, 6]);
  else {
    for (const [y, r] of [
      [1.2, 1.1],
      [2.5, 0.8],
    ])
      mesh(sphere, m.wood, violin, [0, y, 0], [r, r, 0.25]);
    box(m.wood, violin, [0, 4.2, 0], [0.3, 3.5, 0.25]);
    mesh(sphere, m.wood, violin, [0, 5.8, 0], [0.3, 0.3, 0.25]);
  }
  box(m.ebony, violin, [0, 3.8, -0.48], [0.3, 3, 0.1]);
  box(m.wood, violin, [0, 1.45, -0.56], [0.75, 0.15, 0.18]);
  for (const side of [-1, 1]) {
    tube(violin, [side * 0.8, 0, 0.2], [side * 0.8, 0.85, 0.2], 0.08, m.brass);
    mesh(sphere, m.velvet, violin, [side * 0.8, 0.85, 0.2], [0.16, 0.16, 0.16]);
  }
  const strings = group(violin);
  strings.name = "Resonating violin strings";
  for (let i = 0; i < 4; i++)
    tube(
      strings,
      [(i - 1.5) * 0.075, 0.6, -0.59],
      [(i - 1.5) * 0.075, 5.45, -0.59],
      0.01,
      m.silver,
    );
  kit.batch(strings);
  // A brass slide carriage carries the bow; the stroke follows this fixed rail.
  for (const x of [-2.9, -1.1]) tube(violin, [x, 0, 0.3], [x, 1.8, -0.65], 0.07, m.brass);
  tube(violin, [-2.9, 1.8, -0.65], [-1.1, 1.8, -0.65], 0.08, m.brass);
  const bow = group(violin, [0, 2.04, -0.65]);
  bow.name = "Mechanical violin bow";
  box(m.wood, bow, [0, 0, 0], [5.2, 0.075, 0.085]);
  box(m.ivory, bow, [0, -0.12, 0.06], [4.6, 0.025, 0.035]);
  box(m.ebony, bow, [-2, 0, 0], [0.4, 0.25, 0.25]);
  box(m.brass, bow, [-2, -0.22, 0], [0.3, 0.2, 0.3]);
  kit.batch(bow);
  motion(bow, (time, state) => {
    const clock = state?.motionEnabled === false ? 0 : time;
    bow.position.x = Math.sin(clock * Math.PI * 0.5) * 0.85;
  });
  motion(strings, (time, state) => {
    const clock = state?.motionEnabled === false ? 0 : time;
    strings.position.x = Math.sin(clock * 38) * Math.abs(Math.cos(clock * Math.PI * 0.5)) * 0.009;
  });
  kit.batch(violin, [bow, strings]);
  const lamp = mesh(sphere, matLamp(w), g, [0, 4.9, 12], [0.7, 0.7, 0.7]);
  g.updateWorldMatrix(true, true);
  registerLightPool(scene, {
    position: lamp.getWorldPosition(new THREE.Vector3()),
    color: "#ffd6a4",
    intensity: 38,
    radius: 75,
  });
}

function matLamp(w) {
  return w.mat("#ffe3b4", null, { emissive: "#ffc775", emissiveIntensity: 1.2 });
}

function buildDrumAccompaniment(w, m, group) {
  const { THREE, track, safe, mesh, tube, sphere, kit, motion } = w;
  const field = track.drumField;
  if (!field) return;
  // An opening, middle and closing accent follow the actual bounce path.
  // Their mallets hit separate drums, leaving the player's drumheads clear.
  const indices = [0, Math.floor(field.drums.length / 2), field.drums.length - 1];
  for (const [accent, index] of indices.entries()) {
    const drum = field.drums[index];
    const section = track.SECTIONS[field.section];
    const fraction = (drum.t - section.start) / (section.end - section.start);
    const side = accent % 2 ? 1 : -1;
    const g = safe(field.section, fraction, side * 28, 10, 15);
    if (!g) continue;
    g.name = `Mallet accompaniment for bounce drum ${index + 1}`;
    g.userData.composition = "drum-accompaniment";
    g.userData.companionDrumIndex = index;
    pedestal(w, m, g, 18, 16, 1);
    mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), m.wood, g, [0, 3, 0], [5.4, 4, 5.4]);
    for (const y of [1.2, 4.9]) {
      const rim = mesh(new THREE.TorusGeometry(5.4, 0.16, 8, 32), m.brass, g, [0, y, 0]);
      rim.rotation.x = Math.PI / 2;
    }
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6;
      tube(
        g,
        [Math.cos(angle) * 5.45, 1.3, Math.sin(angle) * 5.45],
        [Math.cos(angle) * 5.45, 4.7, Math.sin(angle) * 5.45],
        0.08,
        m.silver,
      );
    }
    const headGeometry = new THREE.CircleGeometry(5.2, 32);
    headGeometry.rotateX(-Math.PI / 2);
    const head = mesh(headGeometry, m.ivory, g, [0, 5.04, 0]);
    head.name = "Mallet-responsive side drumhead";
    for (const hand of [-1, 1]) {
      tube(g, [hand * 7, 1, 0], [hand * 7, 7.1, 0], 0.22, m.brass);
      mesh(sphere, m.ebony, g, [hand * 7, 7.1, 0], [0.5, 0.5, 0.5]);
      const mallet = group(g, [hand * 7, 7.1, 0]);
      mallet.name = "Pivoted percussion mallet";
      tube(mallet, [0, 0, 0], [-hand * 7, 0, 0], 0.16, m.wood);
      mesh(sphere, m.velvet, mallet, [-hand * 7, 0, 0], [0.65, 0.65, 0.65]);
      kit.batch(mallet);
      motion(mallet, (time, state) => {
        const clock = state?.motionEnabled === false ? 0 : time;
        const strike =
          Math.max(0, Math.sin(clock * Math.PI + accent * 0.6 + (hand > 0 ? Math.PI : 0))) ** 8;
        mallet.rotation.z = -hand * (0.4 - strike * 0.615);
      });
    }
    motion(head, (time, state) => {
      const clock = state?.motionEnabled === false ? 0 : time;
      const hit = Math.abs(Math.sin(clock * Math.PI + accent * 0.6)) ** 16;
      head.position.y = 5.04 - hit * 0.08;
    });
    kit.batch(g, w.animated);
  }
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
