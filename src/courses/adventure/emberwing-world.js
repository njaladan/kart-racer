import { buildSantorini } from "./santorini.js";
import { worldKit } from "./world-kit.js";
import { registerLightPool } from "../../rendering/course-lighting.js";
import { buildEmberwingCaldera } from "./emberwing-caldera.js";
import { buildEmberwingGeology } from "./emberwing-geology.js";

/** The observatory watches a living caldera; its missing road is a cannon flight. */
export function buildEmberwing(context) {
  const w = worldKit(context),
    { THREE, scene, scenery, track, mat, mesh, box, at, motion, sphere, cylinder, torus } = w;
  const basalt = mat("#252d30", "rock", { map: null }),
    pale = mat("#f0e8da"),
    brass = mat("#c9a477", "metal", { metalness: 0.65, roughness: 0.34 }),
    copper = mat("#bf7c6d", "metal", { metalness: 0.45 }),
    blueDome = mat("#3483bd", "paving", { roughness: 0.62 }),
    ink = mat("#383c59", "metal"),
    glass = mat("#a6c6d5", "glass", { roughness: 0.2, metalness: 0.25 }),
    glow = mat("#ffe1a8", "stone", { emissive: "#ffb46a", emissiveIntensity: 0.9 });
  buildEmberwingGeology(w, mat("#51585b", "rock", { map: null }));
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
  buildEmberwingCaldera(w);
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
