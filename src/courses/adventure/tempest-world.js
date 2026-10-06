import { worldKit } from "./world-kit.js";
import { architecturalDetail } from "./architectural-detail.js";
import { patchMaterial } from "../../rendering/surface-detail.js";
import { registerLightPool } from "../../rendering/course-lighting.js";
import { addGlow } from "../../rendering/visual-effects.js";

/** Huge exposed bridges form the racing adventure; sheltered islands punctuate it. */
export function buildTempest(context) {
  const w = worldKit(context),
    { THREE, scene, scenery, track, mat, mesh, box, at, motion, tube, sphere, cylinder, rock } = w;
  const concrete = architecturalDetail(mat("#a9bcc1")),
    iron = mat("#304759", "metal", { metalness: 0.45 }),
    copper = mat("#b7855e", "metal", { metalness: 0.5 }),
    stone = mat("#53647c", "rock"),
    white = mat("#e0d2b9"),
    red = mat("#a7524f"),
    glow = mat("#ffe4a9", "metal", { emissive: "#ffb657", emissiveIntensity: 1.5 });
  // A single opaque, displaced ocean carries broad moving swells and foam.
  const ocean = w.water("#275c70", -10, 1700);
  ocean.geometry.dispose();
  ocean.geometry = new THREE.PlaneGeometry(1700, 1700, 80, 80);
  const time = { value: 0 };
  (scene.userData.surfaceAnimations ||= []).push(time);
  patchMaterial(ocean.material, "storm-swells", (shader) => {
    shader.uniforms.stormTime = time;
    shader.vertexShader = `uniform float stormTime;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      transformed.z+=sin(position.x*.026+position.y*.035+stormTime*.65)*4.8+sin(position.x*.052-position.y*.031-stormTime*.9)*2.;`,
    );
    shader.fragmentShader = `uniform float stormTime;\n${shader.fragmentShader}`.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      float crest=sin(vWaterWorld.x*.026-vWaterWorld.z*.035+stormTime*.65);
      float foam=smoothstep(.89,.99,crest)*(.4+.6*sin(vWaterWorld.x*.23+vWaterWorld.z*.27)*sin(vWaterWorld.x*.23+vWaterWorld.z*.27));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.63,.80,.82),foam*.62);`,
    );
  });
  // The water's shader displacement needs a conservative culling bound.
  ocean.geometry.computeBoundingSphere();
  ocean.geometry.boundingSphere.radius += 8;
  function lamp(g, x, y, z) {
    box(iron, g, [x, y - 1, z], [0.7, 2, 0.7]);
    mesh(sphere, glow, g, [x, y, z], [0.4, 0.6, 0.4]);
    g.updateWorldMatrix(true, false);
    registerLightPool(scene, {
      position: g.localToWorld(new THREE.Vector3(x, y, z)),
      color: "#ffc17c",
      intensity: 22,
      radius: 19,
    });
  }
  function cable(g, points, radius = 0.25) {
    return mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
        36,
        radius,
        6,
        false,
      ),
      iron,
      g,
    );
  }
  for (const section of [1, 3, 5]) {
    // Connected underside and girders follow every elevation/bank of the deck.
    w.sweep(section, 0, 1, -12, 12, iron, -1.4);
    const count = Math.ceil(
      ((track.SECTIONS[section].end - track.SECTIONS[section].start) * track.COURSE_LENGTH) / 10,
    );
    for (let i = 0; i < count; i++) {
      const g = at(section, (i + 0.5) / count);
      box(concrete, g, [0, -1.1, 0], [24, 1.5, 11]);
      for (const side of [-1, 1]) {
        box(iron, g, [side * 12, 0.8, 0], [0.5, 1.6, 11]);
        box(copper, g, [side * 12, 2.5, 0], [0.25, 0.25, 11]);
        box(iron, g, [side * 12, 1.7, 0], [0.25, 3.4, 0.25]);
        tube(g, [side * 12, -2, -5], [side * 12, -8, 5], 0.3, iron);
        if (i % 4 === 0) lamp(g, side * 12, 4, 0);
      }
    }
    // Four suspension towers stand on real piers, with sweeping main cables.
    for (const f of [0.12, 0.4, 0.68, 0.92]) {
      const g = at(section, f),
        height = 32 + (section === 1 ? 14 : 0);
      for (const side of [-1, 1]) {
        box(concrete, g, [side * 16, height / 2, 0], [4, height, 5]);
        box(iron, g, [side * 16, height * 0.55, 0.1], [0.4, height - 4, 5.6]);
        box(concrete, g, [side * 16, -22, 0], [7, 45, 9]);
        box(copper, g, [side * 16, height + 1, 0], [7, 2, 7]);
      }
      box(concrete, g, [0, height - 2, 0], [36, 3, 5]);
    }
    // Cable and hanger paths use actual road frames, so curved spans cannot
    // drive their straight tangent supports back through the racing line.
    const anchors = [0, 0.12, 0.4, 0.68, 0.92, 1],
      height = 32 + (section === 1 ? 14 : 0);
    for (const side of [-1, 1])
      for (let i = 0; i < anchors.length - 1; i++) {
        const start = anchors[i],
          end = anchors[i + 1],
          points = [];
        for (let j = 0; j <= 32; j++) {
          const q = j / 32,
            t = track.sectorT(section, start + (end - start) * q),
            h =
              THREE.MathUtils.lerp(i === 0 ? 3 : height, i === anchors.length - 2 ? 3 : height, q) -
              Math.sin(q * Math.PI) * 12,
            p = track.poseAt(t * track.TRACK, side * 16, h).p;
          points.push(p.toArray());
          if (j % 4 === 0 && j > 0 && j < 32) {
            const bottom = track.poseAt(t * track.TRACK, side * 12, 2.5).p;
            tube(scenery, p.toArray(), bottom.toArray(), 0.1, iron);
          }
        }
        cable(scenery, points, 0.32);
      }
  }
  // Lighthouse islands have a rugged shore, a small inhabited refuge and
  // warm windows; each exposure ends in a materially different shelter.
  function cottage(g, size = 1) {
    const root = new THREE.Group();
    g.add(root);
    root.scale.setScalar(size);
    box(white, root, [0, 5, 0], [13, 10, 16]);
    const roof = mesh(new THREE.ConeGeometry(1, 1, 4), red, root, [0, 13, 0], [11, 8, 13]);
    roof.rotation.y = Math.PI / 4;
    for (const x of [-4, 3]) {
      box(iron, root, [x, 5, -8.1], [3.5, 4, 0.2]);
      box(glow, root, [x, 5, -8.3], [2.2, 2.8, 0.1]);
      box(concrete, root, [x, 2.8, -8.5], [4, 0.7, 1]);
    }
    box(iron, root, [0, 2.2, -8.2], [2, 4.4, 0.3]);
    mesh(cylinder, iron, root, [4, 14, 4], [1, 11, 1]);
    for (const x of [-7, 7]) tube(root, [x, 0, -8], [x, 11, -8], 0.16, copper);
  }
  for (const section of [0, 2, 4, 6]) {
    for (let i = 0; i < 12; i++) {
      const t = track.sectorT(section, (i + 0.5) / 12),
        side = i % 2 ? 1 : -1,
        g = context.kit.safeGroup(t, side * (32 + (i % 3) * 14), 16);
      if (!g) continue;
      g.position.y = track.frameAt(t).p.y;
      mesh(
        new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        stone,
        g,
        [0, -5, 0],
        [16, 5, 16],
      );
      mesh(rock, stone, g, [0, -21, 0], [13, 21, 14]);
      mesh(rock, concrete, g, [side * 6, -7, -3], [6, 7, 8]);
      if (i % 3 === 0) cottage(g, 0.7 + (i % 2) * 0.25);
      for (let j = 0; j < 3; j++)
        mesh(new THREE.ConeGeometry(1, 1, 5), stone, g, [j * 3 - 3, 1, -7], [0.7, 2.2, 0.7]);
    }
    const g = at(section, 0.6, -48);
    g.rotation.set(0, track.yawFor(track.frameAt(track.sectorT(section, 0.6)).tangent), 0);
    mesh(rock, stone, g, [0, -23, 0], [24, 24, 24]);
    mesh(cylinder, concrete, g, [0, -0.5, 0], [13, 1, 13]);
    mesh(cylinder, white, g, [0, 18, 0], [8, 36, 8]);
    for (const y of [10, 22]) mesh(cylinder, red, g, [0, y, 0], [8.2, 6, 8.2]);
    mesh(cylinder, iron, g, [0, 37, 0], [11, 2, 11]);
    mesh(cylinder, glow, g, [0, 41, 0], [6.5, 7, 6.5]);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      box(iron, g, [Math.sin(a) * 7, 41, Math.cos(a) * 7], [0.5, 8, 0.5]);
    }
    mesh(new THREE.ConeGeometry(1, 1, 12), red, g, [0, 47, 0], [11, 8, 11]);
    addGlow(g, { color: "#ffcf8e", size: 18, opacity: 0.12, position: [0, 41, 0] });
    const beam = mesh(
      new THREE.ConeGeometry(1, 1, 20, 1, true),
      mat("#ffeac0", "paper", {
        transparent: true,
        opacity: 0.035,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
      g,
      [0, 41, 0],
      [14, 180, 14],
    );
    beam.geometry.translate(0, -0.5, 0);
    beam.rotation.z = Math.PI / 2;
    beam.castShadow = false;
    motion(beam, (time) => {
      beam.rotation.y = time * 0.16 + section;
    });
    g.updateWorldMatrix(true, false);
    registerLightPool(scene, {
      position: g.localToWorld(new THREE.Vector3(0, 41, 0)),
      color: "#ffc786",
      intensity: 80,
      radius: 80,
    });
    // Road runs under a roofed haven with actual columns and overhead cover.
    for (let i = 0; i < 5; i++) {
      const shelter = at(section, 0.15 + i * 0.17);
      const t = track.sectorT(section, 0.15 + i * 0.17),
        surface = track.surfaceAt(t),
        left = Math.min(-14, surface.leftEdge - 3),
        right = Math.max(14, surface.rightEdge + 3);
      for (const x of [left, right]) {
        box(concrete, shelter, [x, 8, 0], [2, 16, 3]);
        lamp(shelter, x, 5, 0);
      }
      box(iron, shelter, [(left + right) / 2, 16, 0], [right - left + 3, 2, 25]);
      if (i % 2 === 0) box(red, shelter, [(left + right) / 2, 18, 0], [right - left + 4, 1, 26]);
    }
  }
  // Working harbor props, moored fishing boats and animated buoy chains.
  for (let i = 0; i < 18; i++) {
    const section = i % 7,
      g = at(section, 0.2 + ((i * 3) % 11) / 16, i % 2 ? 60 : -60);
    g.position.y = -9;
    mesh(cylinder, copper, g, [0, 1, 0], [1.6, 3, 1.6]);
    mesh(sphere, red, g, [0, 0.5, 0], [3, 0.8, 3]);
    box(glow, g, [0, 3.2, 0], [0.5, 0.5, 0.5]);
    motion(g, (time) => {
      g.position.y = stormSeaHeight(g.position.x, g.position.z, time) + 1;
      g.rotation.z = Math.sin(time * 0.8 + i) * 0.15;
    });
    if (i % 5 === 0) {
      const boat = new THREE.Group();
      g.add(boat);
      boat.position.x = 17;
      mesh(sphere, iron, boat, [0, 0, 0], [6, 2, 15]);
      box(white, boat, [0, 3, -2], [7, 6, 6]);
      box(red, boat, [0, 6.5, -2], [9, 1, 8]);
      for (const x of [-2, 2]) box(glow, boat, [x, 4, -5.1], [1.3, 1.5, 0.1]);
      tube(boat, [0, 0, 4], [0, 13, 4], 0.15, copper);
    }
  }
  // Distant sea stacks and splashing whitewater give the water scale.
  for (let i = 0; i < 28; i++) {
    const a = (i * Math.PI) / 14;
    mesh(
      rock,
      stone,
      scenery,
      [Math.sin(a) * 500, -22, Math.cos(a) * 440],
      [25 + (i % 3) * 12, 38 + (i % 5) * 8, 25],
    );
  }
  w.points("#c9e7e7", [1, 3, 5], 180, 0.23);
  motion(ocean, (seconds) => {
    time.value = seconds;
  });
  return w.finish();
}

// Matches the displaced plane after its -PI/2 rotation into world X/Z.
export function stormSeaHeight(x, z, time) {
  return (
    -10 +
    Math.sin(x * 0.026 - z * 0.035 + time * 0.65) * 4.8 +
    Math.sin(x * 0.052 + z * 0.031 - time * 0.9) * 2
  );
}
