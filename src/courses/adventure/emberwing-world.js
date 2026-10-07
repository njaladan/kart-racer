import { buildSantorini } from "./santorini.js";
import { worldKit } from "./world-kit.js";
import { registerLightPool } from "../../rendering/course-lighting.js";
import { patchMaterial } from "../../rendering/surface-detail.js";
import { rangeFor } from "../../simulation/course-mechanics.js";
import { buildEmberwingGeology } from "./emberwing-geology.js";

/** The observatory watches a living caldera; its missing road is a cannon flight. */
export function buildEmberwing(context) {
  const w = worldKit(context),
    { THREE, scene, scenery, track, mat, mesh, box, at, motion, sphere, cylinder, torus } = w;
  const basalt = mat("#605c78", "rock"),
    pale = mat("#f0e8da"),
    brass = mat("#c9a477", "metal", { metalness: 0.65, roughness: 0.34 }),
    copper = mat("#bf7c6d", "metal", { metalness: 0.45 }),
    blueDome = mat("#3483bd", "paving", { roughness: 0.62 }),
    ink = mat("#383c59", "metal"),
    glass = mat("#a6c6d5", "glass", { roughness: 0.2, metalness: 0.25 }),
    glow = mat("#ffe1a8", "stone", { emissive: "#ffb46a", emissiveIntensity: 0.9 });
  const magma = mat("#d85942", "stone", {
    emissive: "#eb6c36",
    emissiveIntensity: 0.6,
    roughness: 0.6,
  });
  patchMaterial(magma, "caldera-crust", (shader) => {
    const clock = { value: 0 };
    (scene.userData.surfaceAnimations ||= []).push(clock);
    shader.uniforms.emberClock = clock;
    shader.vertexShader = `varying vec3 vCaldera;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvCaldera=position;",
    );
    shader.fragmentShader =
      `uniform float emberClock; varying vec3 vCaldera;\n${shader.fragmentShader}`
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
      float crust=sin(vCaldera.x*11.+sin(vCaldera.z*17.+emberClock*.12))*sin(vCaldera.z*14.-emberClock*.16);
      diffuseColor.rgb*=mix(.12,1.,smoothstep(.1,.55,crust));`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\ntotalEmissiveRadiance*=smoothstep(.1,.55,crust);",
        );
  });
  // Vertex-authored strata carry the color; the scan contributes fine normals
  // without multiplying the new cliff relief by an almost-black albedo.
  buildEmberwingGeology(w, mat("#b5a5ad", "rock", { map: null }));
  // Rock shoulders remain connected everywhere except the deliberate flight gap.
  for (let section = 0; section < track.SECTIONS.length; section++) {
    if (section === 2) {
      w.sweep(2, 0, track.course.traversals[0].startFraction, -22, 22, basalt, -0.22);
      w.sweep(2, track.course.traversals[0].endFraction, 1, -22, 22, basalt, -0.22);
    } else
      w.sweep(
        section,
        0,
        1,
        (t) => track.platformEdgeAt(t, -1),
        (t) => track.platformEdgeAt(t, 1),
        basalt,
        -0.22,
      );
  }
  const flight = track.course.traversals[0],
    { start, end } = rangeFor(track, flight),
    a = track.poseAt(start * track.TRACK, 0).p,
    b = track.poseAt(end * track.TRACK, 0).p,
    centre = a.clone().add(b).multiplyScalar(0.5),
    caldera = new THREE.Group();
  scenery.add(caldera);
  const calderaRadius = Math.hypot(a.x - b.x, a.z - b.z) * 0.5 + 22;
  caldera.name = "Volcanic caldera beneath the cannon flight";
  caldera.position.set(centre.x, -7, centre.z);
  mesh(cylinder, magma, caldera, [0, 0, 0], [calderaRadius * 0.72, 2, calderaRadius * 0.72]);
  for (let i = 0; i < 28; i += 4) {
    const angle = (i / 28) * Math.PI * 2,
      vent = mesh(
        new THREE.ConeGeometry(1, 1, 8),
        magma,
        caldera,
        [Math.cos(angle) * calderaRadius * 0.6, 2, Math.sin(angle) * calderaRadius * 0.6],
        [3, 10, 3],
      );
    motion(vent, (time) => {
      vent.scale.y = 5 + Math.sin(time * 0.8 + i) * 4;
    });
  }
  registerLightPool(scene, {
    position: new THREE.Vector3(centre.x, 5, centre.z),
    color: "#ff9656",
    intensity: 160,
    radius: 170,
  });
  // Cannon throat is a readable arch on the launch lip, pointed at the landing.
  const cannon = w.groupAt(start - 3 / track.COURSE_LENGTH),
    barrel = new THREE.Group();
  cannon.userData.routeStructure = true;
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
  for (const z of [-11, -2, 4]) mesh(torus, copper, barrel, [0, 0, z], [12.4, 12.4, 12.4]);
  for (const side of [-1, 1]) {
    box(ink, cannon, [side * 16, 4, 0], [3, 12, 20]);
    mesh(cylinder, brass, cannon, [side * 16, 6, 0], [4, 1, 4]).rotation.z = Math.PI / 2;
    box(glow, cannon, [side * 16, 9, -4], [1, 1, 3]);
  }
  const flare = mesh(sphere, glow, barrel, [0, 0, -12], [10, 10, 1]);
  flare.material = glow.clone();
  flare.material.transparent = true;
  flare.material.opacity = 0.3;
  flare.material.depthWrite = false;
  flare.material.blending = THREE.AdditiveBlending;
  flare.castShadow = false;
  motion(flare, (_time, state) => {
    flare.visible = !!state?.running && state.playerT > start && state.playerT < start + 0.008;
  });
  const landing = w.groupAt(end),
    landingArch = mesh(
      new THREE.TorusGeometry(1, 0.04, 6, 32, Math.PI),
      copper,
      landing,
      [0, 1, 0],
      [16, 18, 16],
    );
  landingArch.name = "Caldera landing beacon";
  for (const side of [-1, 1]) box(glow, landing, [side * 15, 1, 0], [1.2, 2, 9]);
  // Rotating telescope domes and complete mountings give each terrace purpose.
  function observatory(g, size, phase) {
    const foundation = g.position.y + 48;
    mesh(cylinder, basalt, g, [0, -foundation / 2, 0], [24 * size, foundation, 24 * size]);
    mesh(cylinder, pale, g, [0, 8 * size, 0], [23 * size, 16 * size, 23 * size]);
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      box(
        ink,
        g,
        [Math.cos(angle) * 23.1 * size, 8 * size, Math.sin(angle) * 23.1 * size],
        [2 * size, 8 * size, 1],
      ).rotation.y = -angle;
    }
    const dome = new THREE.Group();
    g.add(dome);
    dome.position.y = 16 * size;
    mesh(
      new THREE.SphereGeometry(1, 24, 10, 0.25, Math.PI * 2 - 0.5, 0, Math.PI / 2),
      blueDome,
      dome,
      [0, 0, 0],
      [24 * size, 20 * size, 24 * size],
    );
    mesh(torus, brass, dome, [0, 0, 0], [24 * size, 24 * size, 24 * size]).rotation.x = Math.PI / 2;
    const telescope = new THREE.Group();
    dome.add(telescope);
    telescope.position.set(0, 2 * size, 0);
    telescope.rotation.x = -0.45;
    mesh(cylinder, ink, telescope, [0, 0, -14 * size], [4 * size, 35 * size, 4 * size]).rotation.x =
      Math.PI / 2;
    mesh(cylinder, glass, telescope, [0, 0, -32 * size], [3.8 * size, 0.4, 3.8 * size]).rotation.x =
      Math.PI / 2;
    for (const z of [-24, -10, 1])
      mesh(torus, brass, telescope, [0, 0, z * size], [4.2 * size, 4.2 * size, 4.2 * size]);
    context.kit.batch(dome);
    motion(dome, (time) => {
      dome.rotation.y = Math.sin(time * 0.065 + phase) * 0.6 + phase;
    });
    g.updateWorldMatrix(true, false);
    registerLightPool(scene, {
      position: g.localToWorld(new THREE.Vector3(0, 14 * size, 0)),
      color: "#fbd7a5",
      intensity: 35,
      radius: 50 * size,
    });
  }
  for (const [section, f, side, size] of [
    [0, 0.35, -1, 0.8],
    [1, 0.55, 1, 1],
    [3, 0.2, -1, 1.3],
    [3, 0.7, 1, 1],
    [4, 0.5, -1, 0.8],
    [5, 0.45, 1, 0.9],
  ]) {
    const g = w.safe(section, f, side * 70, 37 * size, 42 * size, -48);
    if (g) observatory(g, size, section * 0.4);
  }
  buildSantorini(w);
  // Orrery gardens tell the story of the observatory without duplicating gears.
  for (let i = 0; i < 5; i++) {
    const g = at(3, 0.05 + i * 0.21, i % 2 ? 28 : -28);
    mesh(cylinder, ink, g, [0, 1, 0], [7, 2, 7]);
    box(brass, g, [0, 5, 0], [0.7, 8, 0.7]);
    mesh(sphere, glow, g, [0, 9, 0], [1.7, 1.7, 1.7]);
    const orbit = new THREE.Group();
    g.add(orbit);
    orbit.position.y = 9;
    mesh(torus, brass, orbit, [0, 0, 0], [7, 7, 7]).rotation.x = Math.PI / 2;
    mesh(sphere, glass, orbit, [7, 0, 0], [1.5, 1.5, 1.5]);
    mesh(sphere, copper, orbit, [-7, 0, 0], [0.9, 0.9, 0.9]);
    context.kit.batch(orbit);
    motion(orbit, (time) => {
      orbit.rotation.y = time * 0.22 + i;
      orbit.rotation.z = 0.2;
    });
  }
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2,
      g = new THREE.Group();
    scenery.add(g);
    g.position.set(Math.cos(angle) * 430, -22, Math.sin(angle) * 430);
    mesh(w.rock, basalt, g, [0, 30, 0], [60, 60 + (i % 3) * 20, 60]);
  }
  w.points("#ffbd73", [1, 2, 3, 4], 130, 0.22);
  return w.finish();
}
