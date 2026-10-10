import { stormAt } from "../simulation/experience-mechanics.js";

/** Thick luminous forks are readable beyond the bridge, rather than a one-pixel line. */
export function createDistantLightning({ THREE, scene, track }) {
  const root = new THREE.Group();
  root.name = "Distant forked lightning strike";
  root.visible = false;
  root.userData.skipBake = true;
  scene.add(root);
  const core = new THREE.MeshBasicMaterial({
    color: "#edf7ff",
    fog: false,
    toneMapped: false,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const halo = core.clone();
  halo.color.set("#6ebcff");
  halo.opacity = 0.2;
  const paths = [
    [
      [0, 220, 0],
      [-11, 183, 2],
      [9, 159, 1],
      [-15, 123, 3],
      [-2, 101, 2],
      [-20, 60, 0],
      [-8, 0, 0],
    ],
    [
      [9, 159, 1],
      [31, 133, 2],
      [23, 115, 1],
      [48, 80, 0],
    ],
    [
      [-15, 123, 3],
      [-45, 108, 2],
      [-36, 89, 2],
      [-58, 68, 0],
    ],
  ];
  for (const [index, path] of paths.entries()) {
    const curve = new THREE.CurvePath();
    for (let i = 1; i < path.length; i++)
      curve.add(
        new THREE.LineCurve3(new THREE.Vector3(...path[i - 1]), new THREE.Vector3(...path[i])),
      );
    for (const [material, radius] of [
      [core, index ? 0.5 : 0.9],
      [halo, index ? 1.5 : 2.6],
    ]) {
      const bolt = new THREE.Mesh(
        new THREE.TubeGeometry(curve, path.length * 4, radius, 4, false),
        material,
      );
      bolt.name = index ? "Lightning fork" : "Lightning main channel";
      bolt.renderOrder = 2;
      root.add(bolt);
    }
  }
  let lastCycle = null,
    lastTime = -Infinity;
  return {
    root,
    update(time, state = {}) {
      if (time < lastTime) lastCycle = null;
      lastTime = time;
      const { flash } = stormAt(track.course, time);
      root.visible = state.motionEnabled !== false && flash > 0.02;
      if (!root.visible) return;
      const cycle = Math.floor(time / track.course.storm.period);
      if (cycle !== lastCycle) {
        const frame = track.frameAt(state.playerT ?? 0);
        root.position
          .copy(frame.p)
          .addScaledVector(frame.tangent, 300)
          .addScaledVector(frame.right, cycle % 2 ? -85 : 85);
        root.position.y = (track.course.theme.groundHeight ?? -10) - 2;
        root.rotation.y = track.yawFor(frame.tangent);
        lastCycle = cycle;
      }
      core.opacity = Math.min(1, flash * 2.5);
      halo.opacity = Math.min(0.28, flash * 0.6);
    },
  };
}
