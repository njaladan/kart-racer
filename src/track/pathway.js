import { drumAt, mountainHeight } from "../simulation/experience-mechanics.js";
import { PATHWAY_KINDS } from "../courses/pathway-edges.js";

/** Shared environmental geometry and support rules for rendering and authority. */
export function createPathwayQueries(track) {
  function edgeAt(t, side) {
    const section = track.SECTIONS.indexOf(track.sectionAt(t));
    const kind = track.course.pathwayEdges?.[section]?.[side < 0 ? "left" : "right"];
    const profile = PATHWAY_KINDS[kind];
    const surface = track.surfaceAt(t);
    return {
      kind,
      ...(profile || { mode: "wall", shoulder: 0, height: 1 }),
      offset: side < 0 ? surface.leftEdge : surface.rightEdge,
      side,
    };
  }
  function floorAt(surface) {
    if (surface.branchIndex) {
      const branch = track.branches[surface.branchIndex - 1];
      if (track.mountainSurface && branch.theme === "snow") {
        const main = track.projectTrack(
          { x: surface.worldX, y: surface.height, z: surface.worldZ },
          surface.t * track.TRACK,
        );
        const supported =
          track.mountainSurface.containsT(main.t) &&
          Math.abs(main.mountainOffset) <= track.mountainSurface.widthAt(main.t);
        return {
          supported,
          outside: !supported,
          height: surface.offroad ? main.height : surface.height,
        };
      }
      if (branch.areaSurface)
        return { supported: !surface.offroad, height: surface.height, outside: surface.offroad };
      return {
        supported: !surface.offroad || !branch.dropToMain,
        height: surface.height,
        outside: surface.offroad && !!branch.dropToMain,
      };
    }
    const deck = track.movingSurfaceAt(surface.t);
    if (deck && !deck.supported) return { supported: false, height: surface.height, outside: true };
    const drum = drumAt(track, surface);
    if (drum !== undefined)
      return {
        supported: !!drum,
        height: drum ? drum.p.y + 0.065 : surface.height,
        outside: !drum,
        drum,
      };
    if (
      track.course.watchBowl &&
      track.SECTIONS[track.course.watchBowl.section] === track.sectionAt(surface.t) &&
      Math.abs(surface.offset) > surface.halfWidth + 0.6
    )
      return { supported: false, height: surface.height, outside: true };
    if (track.course.downhill?.section === track.SECTIONS.indexOf(track.sectionAt(surface.t))) {
      const p = { x: surface.worldX, y: surface.height, z: surface.worldZ };
      const point = track.frameAt(surface.t).p.clone().set(p.x, p.y, p.z);
      const width = track.mountainSurface.widthAt(surface.t);
      return {
        supported: Math.abs(surface.mountainOffset ?? surface.offset) <= width,
        outside: Math.abs(surface.mountainOffset ?? surface.offset) > width,
        height: mountainHeight(track, point, surface.t) + 0.065,
      };
    }
    const side = surface.offset < 0 ? -1 : 1;
    let t = surface.t;
    // Banking on a slope tips the cross-section forward in XZ. Invert that
    // cross-section rather than mistaking its nearest centerline station for
    // the authored platform station (especially on the glacier climb).
    if (Number.isFinite(surface.worldX) && Number.isFinite(surface.worldZ)) {
      for (let i = 0; i < 2; i++) {
        const f = track.frameAt(t);
        const dx = surface.worldX - f.p.x,
          dz = surface.worldZ - f.p.z;
        const cross = f.tangent.x * f.right.z - f.tangent.z * f.right.x;
        if (Math.abs(cross) < 0.01) break;
        t = track.trackT(
          (t + (dx * f.right.z - dz * f.right.x) / cross / track.COURSE_LENGTH) * track.TRACK,
        );
      }
    }
    const f = track.frameAt(t);
    const lane =
      Number.isFinite(surface.worldX) && Number.isFinite(surface.worldZ)
        ? ((surface.worldX - f.p.x) * f.right.x + (surface.worldZ - f.p.z) * f.right.z) /
          (f.right.x * f.right.x + f.right.z * f.right.z)
        : surface.offset / Math.hypot(surface.frame.right.x, surface.frame.right.z);
    const edge = edgeAt(t, side);
    const excess = side * (lane - edge.offset);
    if (excess <= 0 || edge.mode === "wall")
      return { supported: true, height: surface.height, outside: false };
    if (edge.mode === "drop" || (edge.platform && excess > edge.shoulder))
      return { supported: false, height: surface.height, outside: true };
    const edgeHeight = track.poseAt(t * track.TRACK, edge.offset, 0.065).p.y;
    const fade = Math.max(0, Math.min(1, (excess - edge.shoulder) / 38));
    return {
      supported: true,
      height: edgeHeight + ((surface.groundHeight ?? -1.7) + 0.065 - edgeHeight) * fade,
      outside: excess > edge.shoulder + 2,
    };
  }
  // Broken clusters leave gaps to explore. Their footprint, position and height
  // are the same in the scenery and collision query; empty gaps have no wall.
  const obstacles = [];
  const spacing = {
    flowers: 14,
    roots: 26,
    ferns: 17,
    crops: 13,
    hedge: 24,
    hay: 32,
    planters: 27,
    shops: 38,
    stalls: 24,
    cargo: 31,
    palms: 30,
    dunes: 43,
    columns: 29,
    snow: 31,
    pines: 26,
    chalets: 36,
    gears: 25,
    folds: 29,
    lanterns: 28,
    boulders: 33,
    gravel: 37,
    crumbs: 17,
    jars: 29,
    biscuits: 25,
    soap: 32,
    keys: 21,
    reeds: 16,
    coral: 23,
  };
  for (const [index, section] of track.SECTIONS.entries()) {
    if (index === track.course.downhill?.section) continue;
    for (const side of [-1, 1]) {
      const profile = edgeAt((section.start + section.end) / 2, side);
      if (profile.mode !== "soft") continue;
      const count = Math.floor(
        ((section.end - section.start) * track.COURSE_LENGTH) / (spacing[profile.kind] || 25),
      );
      for (let i = 0; i < count; i++) {
        const t = track.sectorT(
          index,
          (i + 0.5 + Math.sin(i * 1.7 + index) * 0.18) / Math.max(1, count),
        );
        const edge = edgeAt(t, side);
        const radius = ["columns", "lanterns", "palms", "reeds"].includes(edge.kind) ? 0.65 : 1.25;
        const margin = edge.platform
          ? Math.max(radius + 0.2, edge.shoulder - radius * (1.05 + (i % 3) * 0.12))
          : edge.shoulder * 0.65 + radius + (i % 3) * 0.55;
        const offset = edge.offset + side * margin;
        const pose = track.poseAt(t * track.TRACK, offset, 0.065);
        const floor = floorAt(track.projectTrack(pose.p, t * track.TRACK));
        pose.p.y = floor.height - 0.065;
        // A cluster must not obstruct another arm or floor of the route.
        const nearest = track.projectTrack(pose.p, t * track.TRACK, true);
        if (
          !nearest.offroad ||
          Math.abs(nearest.offset) < track.roadHalfWidth(nearest.t) + radius + 1
        )
          continue;
        obstacles.push({
          t,
          side,
          kind: edge.kind,
          radius,
          height: edge.height * (0.85 + (i % 4) * 0.1),
          p: pose.p,
          index: i,
        });
      }
    }
  }
  function contactAt(position, radius = 0.9) {
    for (const obstacle of obstacles) {
      if (position.y < obstacle.p.y - 1 || position.y > obstacle.p.y + obstacle.height + radius)
        continue;
      const dx = obstacle.p.x - position.x,
        dz = obstacle.p.z - position.z;
      const distance = Math.hypot(dx, dz);
      const penetration = radius + obstacle.radius - distance;
      if (penetration > 0)
        return {
          nx: distance < 0.001 ? 1 : dx / distance,
          nz: dz / Math.max(distance, 0.001),
          penetration,
        };
    }
    return null;
  }
  const platformEdgeAt = (t, side) => {
    if (track.mountainSurface?.containsT(t)) return side * track.mountainSurface.widthAt(t);
    const edge = edgeAt(t, side);
    return edge.offset + side * edge.shoulder;
  };
  return {
    edgeAt,
    floorAt,
    platformEdgeAt,
    pathwayObstacles: obstacles,
    pathwayContact: contactAt,
  };
}
