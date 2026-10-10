import { clone as cloneSkeleton } from "../../../vendor/three/addons/utils/SkeletonUtils.js";
import { sceneryGroundHeight } from "../../rendering/terrain-height.js";

/** Wildlife and cloth have their own clocks; nothing crosses the race. */
export function buildWinterLife({ THREE, scene, track, festival, assets }) {
  const { palette: p, mesh, box, groupAt, landAt, sectorT, edgeOffset, asset, beam } = festival;
  const moving = new THREE.Group();
  moving.name = "Independent winter life";
  scene.add(moving);
  moving.userData.skipBake = true;
  const hut = festival.chalet(1, 0.57, 1, 9, 25);
  if (hut) asset("kenney:holiday-kit/sled", hut, [5, 0, -4], [2, 2, 2]);
  // Moving fabric gives the enclosed streets a domestic, inhabited scale.
  const fabrics = [];
  const clothGeo = new THREE.PlaneGeometry(1, 1, 8, 4);
  clothGeo.translate(0, -0.5, 0);
  const clothMat = p.red.clone();
  clothMat.side = THREE.DoubleSide;
  const cyanCloth = p.cyan.clone();
  cyanCloth.side = THREE.DoubleSide;
  const spans = (scene.userData.winterBannerSpans = []);
  for (const section of [0, 6, 7])
    for (let i = 0; i < 4; i++) {
      const t = sectorT(section, 0.17 + i * 0.2),
        g = groupAt(t, 0, moving),
        half = track.roadHalfWidth(t) + 3;
      const wire = groupAt(t);
      wire.name = "Supported winter festival banner span";
      wire.userData.scenicAssembly = false;
      wire.updateWorldMatrix(true, false);
      const posts = [];
      for (const side of [-1, 1]) {
        const top = wire.localToWorld(new THREE.Vector3(side * half, 13, 0));
        const ground = sceneryGroundHeight(track.projectTrack(top, t * track.TRACK));
        const foot = wire.worldToLocal(new THREE.Vector3(top.x, ground, top.z));
        const post = beam(wire, foot.toArray(), [side * half, 13.1, 0], 0.28, p.timber);
        post.name = "Grounded winter banner support";
        posts.push(post);
      }
      beam(wire, [-half, 13, 0], [half, 13, 0], 0.045, p.dark);
      const cloths = [];
      for (let j = -2; j <= 2; j++) {
        const cloth = mesh(
          clothGeo,
          j % 2 ? clothMat : cyanCloth,
          g,
          [j * 3, 13, 0],
          [1.8, 2.2, 1],
        );
        cloth.name = "Banner pinned to supported cable";
        cloths.push(cloth);
        fabrics.push({ mesh: cloth, base: cloth.rotation.x, phase: i + j });
        box(p.timber, wire, [j * 3, 13, 0], [0.35, 0.16, 0.16]);
      }
      spans.push({ t, half, wire, posts, cloths });
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
