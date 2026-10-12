import * as THREE from "../../../vendor/three/three.module.js";
import { sceneryGroundHeight } from "../../rendering/terrain-height.js";

/** Tree clumps and open vistas replace duplicate regular roadside rows. */
export function buildWindmillTreeGroves({ scene, scenery, track, kit, assets }) {
  let seed = 77131;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const groves = [];
  const placements = [];
  const broad = ["round", "branching", "plump", "tiered"];
  const pines = ["soft-pine", "spruce", "slender"];
  const occupied = [];
  const normalizedBounds = new Map();
  for (const name of [...broad, ...pines])
    normalizedBounds.set(
      name,
      new THREE.Box3().setFromObject(assets.models[`meadow:tree-${name}`]),
    );
  function tree(section, fraction, offset, height, name, groveId) {
    const t = track.sectorT(section, THREE.MathUtils.clamp(fraction, 0.025, 0.975));
    const bounds = normalizedBounds.get(name);
    const size = bounds.getSize(new THREE.Vector3());
    const radius = Math.hypot(size.x, size.z) * height * 0.5;
    const pose = track.poseAt(t * track.TRACK, offset, 0);
    if (
      occupied.some(
        (other) =>
          Math.hypot(pose.p.x - other.x, pose.p.z - other.z) <
          radius * 0.7 + other.radius * 0.7 + 1.5,
      )
    )
      return;
    const root = kit.safeGroup(t, offset, radius, scenery);
    if (!root) return;
    let near = track.projectTrack(root.position, t * track.TRACK, true);
    for (let step = 0; step < 4; step++) {
      const height = sceneryGroundHeight(near);
      if (Math.abs(height - root.position.y) < 0.000001) break;
      root.position.y = height;
      near = track.projectTrack(root.position, t * track.TRACK, true);
    }
    const edge = near.offset > 0 ? near.rightEdge : -near.leftEdge;
    if (near.distance <= edge + radius + 1) {
      root.removeFromParent();
      return;
    }
    root.rotation.y = random() * Math.PI * 2;
    root.name = `Meadow ${name}, grove ${groveId}`;
    kit.asset(`meadow:tree-${name}`, root, [0, 0, 0], [height, height, height]);
    occupied.push({ x: root.position.x, z: root.position.z, radius });
    placements.push({
      section,
      fraction: t,
      grove: groveId,
      name,
      height,
      radius,
      position: root.position.clone(),
    });
  }
  function grove(section, fraction, side, clearance, count, height, conifers = false) {
    const id = groves.length;
    groves.push({ id, section, fraction, side, clearance });
    const t = track.sectorT(section, fraction);
    const surface = track.surfaceAt(t);
    const edge = side > 0 ? surface.rightEdge : -surface.leftEdge;
    const sectorLength =
      (track.SECTIONS[section].end - track.SECTIONS[section].start) * track.COURSE_LENGTH;
    for (let i = 0; i < count; i++) {
      // Golden-angle clusters are irregular in plan, rather than paired rows.
      const angle = i * 2.3999632297 + random() * 0.45;
      const ring = i === 0 ? 0 : 5.5 + Math.sqrt(i) * 3.8;
      const along = Math.sin(angle) * ring;
      const across = Math.cos(angle) * ring;
      const names = conifers ? pines : i % 5 === 4 ? pines : broad;
      const name = names[(id + i * 3) % names.length];
      tree(
        section,
        fraction + along / sectorLength,
        side * (edge + clearance + across),
        height * (0.75 + random() * 0.45),
        name,
        id,
      );
    }
  }
  // Keep fair entrances, the flower cut, sheep pasture and the forward bend
  // readable. A few close trees frame the road; most groves sit in the fields.
  for (const [fraction, side, clearance, count, height] of [
    [0.07, -1, 23, 4, 6.3],
    [0.17, 1, 31, 5, 6.7],
    [0.3, -1, 48, 6, 7.2],
    [0.43, 1, 48, 4, 5.8],
    [0.57, -1, 23, 5, 6.3],
    [0.72, 1, 35, 5, 7.2],
    [0.85, -1, 52, 5, 6.7],
    [0.94, 1, 25, 4, 6.2],
  ])
    grove(0, fraction, side, clearance, count, height);
  // Forest is still sheltered, but its needles stay solid and stable at range.
  for (let i = 0; i < 9; i++)
    grove(1, 0.06 + i * 0.105, i % 2 ? 1 : -1, 22 + (i % 3) * 12, 8, 11 + (i % 3), true);
  for (const section of [2, 3, 4])
    for (const [fraction, side] of [
      [0.14, -1],
      [0.44, 1],
      [0.79, -1],
    ])
      grove(
        section,
        fraction,
        side,
        section === 2 ? 30 : 25,
        4,
        section === 3 ? 7 : 8,
        section === 2,
      );
  for (const [fraction, side, clearance] of [
    [0.12, -1, 22],
    [0.34, 1, 26],
    [0.58, -1, 30],
    [0.84, 1, 25],
  ])
    grove(5, fraction, side, clearance, 6, 5.5);
  for (const [fraction, side] of [
    [0.18, -1],
    [0.47, 1],
    [0.79, -1],
  ])
    grove(6, fraction, side, 24, 5, 7.5);
  for (const [fraction, side, clearance] of [
    [0.1, 1, 26],
    [0.36, -1, 33],
    [0.65, 1, 30],
    [0.89, -1, 39],
  ])
    grove(7, fraction, side, clearance, 5, 6.5);
  scene.userData.windmillTreeGroves = { groves, placements };
  return { groves, placements };
}
