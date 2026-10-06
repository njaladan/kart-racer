import { clone as cloneSkeleton } from "../../../vendor/three/addons/utils/SkeletonUtils.js";

/** Visitors, wildlife and cloth have their own clocks; nothing crosses the race. */
export function buildWinterLife({ THREE, scene, track, festival, town, assets }) {
  const {
    palette: p,
    geometry: geo,
    mesh,
    box,
    groupAt,
    landAt,
    sectorT,
    edgeOffset,
    asset,
    beam,
    batch,
  } = festival;
  const moving = new THREE.Group();
  moving.name = "Independent winter life";
  scene.add(moving);
  moving.userData.skipBake = true;
  const people = [];
  function person(parent, x, y, z, index = 0, skis = false) {
    const g = new THREE.Group();
    parent.add(g);
    g.position.set(x, y, z);
    box(index % 2 ? p.cyan : p.red, g, [0, 1.02, 0], [0.63, 0.82, 0.45]);
    mesh(geo.sphere, p.cream, g, [0, 1.72, 0], [0.29, 0.32, 0.27]);
    mesh(geo.sphere, index % 2 ? p.red : p.cyan, g, [0, 1.95, 0], [0.32, 0.19, 0.29]);
    mesh(geo.sphere, p.gold, g, [0, 2.17, 0], [0.12, 0.12, 0.12]);
    box(p.gold, g, [0, 1.47, -0.05], [0.7, 0.13, 0.52]);
    for (const side of [-1, 1]) {
      box(p.dark, g, [side * 0.18, 0.43, 0], [0.23, 0.66, 0.25]);
      const arm = box(index % 2 ? p.cyan : p.red, g, [side * 0.44, 1.08, 0], [0.19, 0.78, 0.2]);
      arm.rotation.z = side * 0.3;
      box(p.dark, g, [side * 0.19, 0.08, -0.13], skis ? [0.18, 0.12, 2.1] : [0.27, 0.15, 0.47]);
    }
    batch(g);
    return g;
  }
  // Market walkers stay on the snow pavement beyond the racing boundary.
  for (let i = 0; i < 10; i++) {
    const t = sectorT(0, (i + 0.45) / 10),
      side = i % 2 ? 1 : -1;
    const anchor = landAt(t, edgeOffset(t, side, 4.4), moving);
    const g = person(anchor, 0, 0, 0, i);
    people.push({ g, type: "walk", phase: i * 0.7 });
  }
  // A little sledding hill in the forest and a ski slope beside the descent.
  for (const section of [1, 4])
    for (let i = 0; i < 5; i++) {
      const t = sectorT(section, 0.35 + i * 0.065),
        g = groupAt(t, edgeOffset(t, 1, 13), moving);
      const visitor = person(g, 0, 0, 0, i, true);
      people.push({ g: visitor, type: "ski", phase: i * 1.3 });
    }
  const hut = festival.chalet(1, 0.57, 1, 9, 25);
  if (hut) asset("kenney:holiday-kit/sled", hut, [5, 0, -4], [2, 2, 2]);
  // Pond visitors trace different skating ellipses inside their own rink.
  if (town.pond)
    for (let i = 0; i < 6; i++) {
      const anchor = new THREE.Group();
      moving.add(anchor);
      anchor.position.copy(town.pond.position);
      anchor.rotation.copy(town.pond.rotation);
      const g = person(anchor, 0, 0.4, 0, i);
      people.push({ g, type: "skate", phase: (i * Math.PI) / 3 });
    }
  // Static crowd bodies and independently swaying arms are cheap to batch.
  const hands = new THREE.Group();
  moving.add(hands);
  for (const section of [3, 7])
    for (let i = 0; i < 18; i++) {
      const t = sectorT(section, 0.1 + i * 0.047),
        g = landAt(t, edgeOffset(t, -1, 4.2));
      const body = person(g, 0, 0, 0, i);
      body.rotation.y += Math.PI / 2;
      const arm = landAt(t, edgeOffset(t, -1, 4.2), hands);
      box(i % 2 ? p.red : p.cyan, arm, [0, 1.8, 0], [0.19, 1.1, 0.2]);
      mesh(geo.sphere, p.cream, arm, [0, 2.4, 0], [0.13, 0.13, 0.13]);
    }
  // Moving fabric gives the enclosed streets a domestic, inhabited scale.
  const fabrics = [];
  const clothGeo = new THREE.PlaneGeometry(1, 1, 8, 4);
  const clothMat = p.red.clone();
  clothMat.side = THREE.DoubleSide;
  for (const section of [0, 6, 7])
    for (let i = 0; i < 4; i++) {
      const t = sectorT(section, 0.17 + i * 0.2),
        g = groupAt(t, 0, moving),
        half = track.roadHalfWidth(t) + 3;
      const wire = groupAt(t);
      beam(wire, [-half, 13, 0], [half, 13, 0], 0.045, p.dark);
      for (let j = -2; j <= 2; j++) {
        const cloth = mesh(clothGeo, j % 2 ? clothMat : p.cyan, g, [j * 3, 11.6, 0], [1.8, 2.2, 1]);
        fabrics.push({ mesh: cloth, base: cloth.rotation.x, phase: i + j });
        box(p.timber, wire, [j * 3, 13, 0], [0.35, 0.16, 0.16]);
      }
    }
  let fox = null,
    mixer = null;
  const source = assets.models["frostpeak:fox"];
  if (source) {
    const t = sectorT(1, 0.47),
      anchor = landAt(t, edgeOffset(t, 1, 9), moving);
    fox = cloneSkeleton(source);
    anchor.add(fox);
    fox.scale.setScalar(1.4);
    fox.rotation.y = Math.PI;
    // Each cloned skinned mesh is rebound by SkeletonUtils. The original
    // walk/survey animation remains intact rather than moving a rigid model.
    const clips = source.userData.animationClips || [];
    if (clips.length) {
      mixer = new THREE.AnimationMixer(fox);
      mixer.clipAction(clips.find((c) => c.name.toLowerCase().includes("walk")) || clips[0]).play();
    }
  }
  const breathPositions = new Float32Array(72 * 3),
    breathGeo = new THREE.BufferGeometry();
  breathGeo.setAttribute("position", new THREE.BufferAttribute(breathPositions, 3));
  const breath = new THREE.Points(
    breathGeo,
    new THREE.PointsMaterial({
      color: "#f3f4ff",
      size: 0.55,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  );
  moving.add(breath);
  const smokeOrigins = [];
  for (const section of [0, 6, 7])
    for (const f of [0.19, 0.57, 0.85]) {
      const t = sectorT(section, f),
        origin = track.poseAt(t * track.TRACK, edgeOffset(t, 1, 18), 10).p;
      smokeOrigins.push(origin);
    }
  // Snow is localized to the whole course with a fixed reusable point buffer.
  const flakes = new Float32Array(420 * 3),
    flakeGeo = new THREE.BufferGeometry();
  flakeGeo.setAttribute("position", new THREE.BufferAttribute(flakes, 3));
  const flurries = new THREE.Points(
    flakeGeo,
    new THREE.PointsMaterial({
      color: "#f5fbff",
      size: 0.17,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    }),
  );
  moving.add(flurries);
  let lastTime = 0;
  return {
    animated: [moving],
    update(time) {
      const dt = Math.max(0, Math.min(0.1, time - lastTime));
      lastTime = time;
      if (mixer) mixer.update(dt);
      for (const { g, type, phase } of people) {
        if (type === "walk") {
          g.position.z = Math.sin(time * 0.3 + phase) * 2.5;
          g.rotation.y = Math.cos(time * 0.3 + phase) > 0 ? 0 : Math.PI;
          g.position.y = Math.abs(Math.sin(time * 3 + phase)) * 0.06;
        } else if (type === "ski") {
          const u = (time * 0.12 + phase) % 1;
          g.position.z = 3 - u * 6;
          g.rotation.z = Math.sin(time + phase) * 0.1;
          g.position.y = 0.1;
        } else {
          const a = time * 0.28 + phase;
          g.position.set(Math.cos(a) * (8 + phase * 0.4), 0.4, Math.sin(a) * (5 + phase * 0.2));
          g.rotation.y = -a - Math.PI / 2;
          g.rotation.z = Math.sin(a) * 0.1;
        }
      }
      hands.rotation.y = Math.sin(time * 2.7) * 0.0007;
      for (const { mesh: m, base, phase } of fabrics)
        m.rotation.x = base + Math.sin(time * 1.8 + phase) * 0.13;
      if (fox) {
        fox.position.z = Math.sin(time * 0.28) * 2.2;
        fox.rotation.y = Math.cos(time * 0.28) > 0 ? 0 : Math.PI;
      }
      for (let i = 0; i < 72; i++) {
        const origin = smokeOrigins[i % smokeOrigins.length],
          u = (time * 0.16 + i * 0.137) % 1;
        breathPositions[i * 3] = origin.x + u * 3 + Math.sin(i + time) * 0.3;
        breathPositions[i * 3 + 1] = origin.y + u * 6;
        breathPositions[i * 3 + 2] = origin.z + Math.sin(i * 2.3) * 0.5;
      }
      breathGeo.attributes.position.needsUpdate = true;
      for (let i = 0; i < 420; i++) {
        flakes[i * 3] = Math.sin(i * 89.7) * 330 + Math.sin(time * 0.3 + i) * 3;
        flakes[i * 3 + 1] = 4 + ((i * 9.3 - time * (0.65 + (i % 5) * 0.1) + 100000) % 110);
        flakes[i * 3 + 2] = Math.cos(i * 43.1) * 300;
      }
      flakeGeo.attributes.position.needsUpdate = true;
    },
  };
}
