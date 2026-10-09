import { registerLightPool } from "../../rendering/course-lighting.js";
import { patchMaterial } from "../../rendering/surface-detail.js";
import { rangeFor } from "../../simulation/course-mechanics.js";

const clamp = (x) => Math.max(0, Math.min(1, x));
/** Presentation derives from the shared racers/clock; the cannon never delays racing. */
export function cannonPresentation(track, time, state = {}) {
  if (state.motionEnabled === false || state.bake) return { open: 1, recoil: 0, smoke: -1 };
  const { start } = rangeFor(track, track.course.traversals[0]);
  let open = 0,
    age = Infinity;
  for (const racer of state.racers || []) {
    const gap = ((start - track.trackT(racer.s) + 1) % 1) * track.COURSE_LENGTH;
    if (state.running && gap < 55) open = Math.max(open, clamp((55 - gap) / 30));
    if (state.running && racer.traversalIndex === 0) {
      open = 1;
      const elapsed = time - racer.traversalDeparture;
      if (elapsed >= 0 && elapsed < 0.9) age = Math.min(age, elapsed);
    }
  }
  return {
    open,
    recoil: age < 0.65 ? Math.sin((age / 0.65) * Math.PI) * 2.8 : 0,
    smoke: age < 0.9 ? age / 0.9 : -1,
  };
}

export function buildEmberwingCaldera(w) {
  const { THREE, scene, scenery, track, mat, mesh, box, motion, sphere, cylinder, torus } = w;
  const charcoal = mat("#252d30", "rock", { map: null });
  const brass = mat("#d0ac60", "metal", { metalness: 0.5, roughness: 0.4 });
  const blue = mat("#2c85c5", "stone", { map: null });
  const pale = mat("#fff3d9", "stone", { map: null });
  const glow = mat("#ffe2a0", "stone", { map: null, emissive: "#ffb66a", emissiveIntensity: 0.8 });
  const magma = mat("#e86822", "stone", {
    map: null,
    emissive: "#ff701e",
    emissiveIntensity: 0.9,
    roughness: 0.7,
  });
  const lavaClock = { value: 0 };
  patchMaterial(magma, "emberwing-liquid-crust", (shader) => {
    shader.uniforms.lavaClock = lavaClock;
    shader.vertexShader = `varying vec3 lavaP;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nlavaP=position;",
    );
    shader.fragmentShader = `uniform float lavaClock;varying vec3 lavaP;\n${shader.fragmentShader}`
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
      float flow=sin(lavaP.x*12.+sin(lavaP.z*8.+lavaClock*.22))*sin(lavaP.z*13.-lavaClock*.18);
      float hot=smoothstep(-.2,.35,flow);
      diffuseColor.rgb=mix(vec3(.025,.018,.013),diffuseColor.rgb,hot);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance*=hot;",
      );
  });
  const blobMat = mat("#ff953e", "stone", {
    map: null,
    emissive: "#ff721e",
    emissiveIntensity: 1.6,
  });
  const flight = track.course.traversals[0],
    { start, end } = rangeFor(track, flight);
  const a = track.poseAt(start * track.TRACK, 0).p,
    b = track.poseAt(end * track.TRACK, 0).p;
  const centre = a.clone().add(b).multiplyScalar(0.5);
  const radius = Math.hypot(a.x - b.x, a.z - b.z) * 0.5 + 22;
  const caldera = new THREE.Group();
  scenery.add(caldera);
  caldera.name = "Black basalt caldera with returning liquid lava bursts";
  caldera.position.set(centre.x, -7, centre.z);
  const pool = mesh(cylinder, magma, caldera, [0, 0, 0], [radius * 0.72, 2, radius * 0.72]);
  pool.castShadow = false;
  motion(pool, (time, state) => {
    lavaClock.value = state?.motionEnabled === false ? 0 : time;
  });
  for (let i = 0; i < 12; i++) {
    const angle = i * 2.39996323,
      r = radius * (0.18 + (i % 4) * 0.105);
    const x = Math.cos(angle) * r,
      z = Math.sin(angle) * r;
    const bubble = mesh(sphere, blobMat, caldera, [x, 1, z], [3, 0.4, 3]);
    bubble.name = "Swelling lava bubble";
    bubble.castShadow = false;
    const blob = mesh(sphere, blobMat, caldera, [x, 1, z], [1.7, 2.5, 1.7]);
    blob.name = "Arcing liquid lava returning to the pool";
    blob.castShadow = false;
    const splashMat = new THREE.MeshBasicMaterial({
      color: "#ffad4d",
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const splash = mesh(new THREE.TorusGeometry(1, 0.1, 5, 24), splashMat, caldera, [x, 1.25, z]);
    splash.name = "Lava return splash";
    splash.rotation.x = Math.PI / 2;
    splash.castShadow = false;
    motion(bubble, (time, state) => {
      const seconds = state?.motionEnabled === false ? 0 : time;
      const q = (seconds * (0.31 + (i % 3) * 0.05) + i * 0.137) % 1;
      bubble.scale.set(2.5 + q * 1.6, 0.35 + Math.sin(q * Math.PI) * 1.3, 2.5 + q * 1.6);
    });
    motion(blob, (time, state) => {
      const q =
        ((state?.motionEnabled === false ? 0 : time) * (0.31 + (i % 3) * 0.05) + i * 0.137) % 1;
      blob.visible = state?.motionEnabled !== false && q > 0.07 && q < 0.93;
      blob.position.set(
        x + Math.cos(angle + 0.8) * q * 10,
        1.2 + (18 + (i % 4) * 4) * 4 * q * (1 - q),
        z + Math.sin(angle + 0.8) * q * 10,
      );
      const stretch = 1.1 + Math.abs(1 - 2 * q) * 1.6;
      blob.scale.set(1.8 / Math.sqrt(stretch), 1.8 * stretch, 1.8 / Math.sqrt(stretch));
    });
    motion(splash, (time, state) => {
      const q =
        ((state?.motionEnabled === false ? 0 : time) * (0.31 + (i % 3) * 0.05) + i * 0.137) % 1;
      const phase = clamp((q - 0.88) / 0.12);
      splash.visible = state?.motionEnabled !== false && phase > 0;
      splash.scale.setScalar(1 + phase * 7);
      splash.position.set(x + Math.cos(angle + 0.8) * 9.3, 1.3, z + Math.sin(angle + 0.8) * 9.3);
      splashMat.opacity = (1 - phase) * 0.8;
    });
  }
  registerLightPool(scene, {
    position: new THREE.Vector3(centre.x, 5, centre.z),
    color: "#ff9a45",
    intensity: 130,
    radius: 170,
  });
  const cannon = w.groupAt(start - 3 / track.COURSE_LENGTH);
  cannon.name = "Caldera sky cannon launch ritual";
  cannon.userData.routeStructure = true;
  const barrel = new THREE.Group();
  cannon.add(barrel);
  barrel.position.y = 12;
  barrel.rotation.x = -0.3;
  mesh(
    new THREE.CylinderGeometry(1, 1.1, 1, 24, 1, true),
    brass,
    barrel,
    [0, 0, -4],
    [12, 20, 12],
  ).rotation.x = Math.PI / 2;
  for (const z of [-11, -2, 4]) mesh(torus, blue, barrel, [0, 0, z], [12.4, 12.4, 12.4]);
  const doors = [];
  for (const side of [-1, 1]) {
    box(charcoal, cannon, [side * 16, 4, 0], [3, 12, 20]);
    mesh(cylinder, brass, cannon, [side * 16, 6, 0], [4, 1, 4]).rotation.z = Math.PI / 2;
    const door = box(blue, cannon, [side * 13.5, 11, 5], [4, 6, 1]);
    doors.push(door);
    for (let i = 0; i < 3; i++) box(glow, cannon, [side * 16, 9 + i * 2, 5.7], [1.1, 0.65, 0.2]);
    const gauge = new THREE.Group();
    cannon.add(gauge);
    gauge.position.set(side * 17, 13, 5.9);
    mesh(cylinder, pale, gauge, [0, 0, 0], [1.7, 0.2, 1.7]).rotation.x = Math.PI / 2;
    const needle = box(blue, gauge, [0, 0.5, 0.2], [0.12, 1.2, 0.1]);
    motion(needle, (time, state) => {
      needle.rotation.z = state?.motionEnabled === false ? 0 : Math.sin(time * 5 + side) * 0.6;
    });
  }
  const smokeMat = new THREE.MeshBasicMaterial({
    color: "#f7e2c3",
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const smoke = new THREE.Group();
  barrel.add(smoke);
  smoke.position.z = -15;
  smoke.name = "Cannon launch smoke puff";
  for (let i = 0; i < 5; i++)
    mesh(sphere, smokeMat, smoke, [Math.sin(i * 2.4) * 4, Math.cos(i * 2.4) * 4, 0], [4, 4, 4]);
  const flare = mesh(sphere, glow.clone(), barrel, [0, 0, -12], [10, 10, 1]);
  flare.material.transparent = true;
  flare.material.opacity = 0.35;
  flare.material.depthWrite = false;
  flare.castShadow = false;
  motion(barrel, (time, state) => {
    const ritual = cannonPresentation(track, time, state);
    barrel.position.z = ritual.recoil;
    doors.forEach((door, i) => {
      door.position.x = (i ? 1 : -1) * (13.5 + ritual.open * 4.5);
    });
    flare.visible = ritual.smoke >= 0 && ritual.smoke < 0.16;
    smoke.visible = ritual.smoke >= 0;
    smoke.position.z = -15 - Math.max(0, ritual.smoke) * 12;
    smoke.scale.setScalar(1 + Math.max(0, ritual.smoke) * 2);
    smokeMat.opacity = ritual.smoke < 0 ? 0 : (1 - ritual.smoke) * 0.3;
  });
  // Moving doors live outside the throat but must be excluded from static batching.
  doors.forEach((door) => motion(door, () => {}));
  const landing = w.groupAt(end);
  landing.name = "Blue banner observatory landing court";
  landing.userData.routeStructure = true;
  mesh(new THREE.TorusGeometry(1, 0.07, 8, 40, Math.PI), pale, landing, [0, 1, 0], [15, 17, 15]);
  for (const side of [-1, 1]) {
    box(blue, landing, [side * 16, 7, 0], [0.4, 14, 0.4]);
    const flag = mesh(new THREE.PlaneGeometry(3.7, 6), blue, landing, [side * 17.5, 11, 0]);
    flag.material = blue.clone();
    flag.material.side = THREE.DoubleSide;
    motion(flag, (time, state) => {
      flag.rotation.y = state?.motionEnabled === false ? 0 : Math.sin(time * 1.8 + side) * 0.18;
    });
    box(glow, landing, [side * 13, 0.2, 5], [1.2, 0.3, 8]);
    const windsock = mesh(new THREE.CylinderGeometry(0.55, 0.85, 4, 12, 1, true), pale, landing, [
      side * 19,
      12,
      -4,
    ]);
    windsock.material = pale.clone();
    windsock.material.side = THREE.DoubleSide;
    windsock.rotation.x = Math.PI / 2;
    motion(windsock, (time, state) => {
      windsock.rotation.z = state?.motionEnabled === false ? 0 : Math.sin(time * 1.2 + side) * 0.12;
    });
  }
  for (let i = 0; i < 8; i++)
    box(i % 2 ? blue : pale, landing, [-10.5 + i * 3, 0.09, 8], [3, 0.05, 1.8]);
}
