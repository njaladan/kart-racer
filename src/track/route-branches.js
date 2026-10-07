import * as THREE from "../../vendor/three/three.module.js";

const clamp = (q) => Math.max(0, Math.min(1, q));

/** Separate ribbons with explicit entry/rejoin gates and signed lap progress. */
export function createRouteBranches(track) {
  const branches = (track.course.branches || []).map((definition, index) => {
    const start = track.sectorT(definition.section, definition.startFraction);
    const end = track.sectorT(definition.endSection ?? definition.section, definition.endFraction);
    let controls = definition.points.map(([q, offset, height = 0]) => {
      const p = track.poseAt((start + (end - start) * q) * track.TRACK, offset, 0).p;
      p.y += height;
      return p;
    });
    if (definition.shape === "ring") {
      const a = track.poseAt(start * track.TRACK, 0, 0).p;
      const b = track.poseAt(end * track.TRACK, 0, 0).p;
      const center = a.clone().add(b).multiplyScalar(0.5);
      const chord = b.clone().sub(a);
      chord.y = 0;
      const radius = chord.length() * 0.5;
      const along = chord.normalize();
      const side = new THREE.Vector3(-along.z, 0, along.x).multiplyScalar(definition.side || 1);
      const lead = Math.min(20, radius * 0.18);
      controls = [a, a.clone().addScaledVector(along, lead)];
      for (let i = 0; i <= 6; i++) {
        const q = 0.22 + (i * 0.56) / 6;
        const p = center
          .clone()
          .addScaledVector(along, -Math.cos(q * Math.PI) * radius)
          .addScaledVector(side, Math.sin(q * Math.PI) * radius);
        p.y = a.y + (b.y - a.y) * q + Math.sin(q * Math.PI) * (definition.rise || 0);
        controls.push(p);
      }
      controls.push(b.clone().addScaledVector(along, -lead), b);
    }
    const curve = new THREE.CatmullRomCurve3(controls, false, "centripetal");
    curve.arcLengthDivisions = 1024;
    const length = curve.getLength();
    const count = Math.max(96, Math.ceil(length / 1.5));
    const points = Array.from({ length: count + 1 }, (_, i) => curve.getPointAt(i / count));
    const frames = points.map((p, i) => {
      const tangent = points[Math.min(count, i + 1)]
        .clone()
        .sub(points[Math.max(0, i - 1)])
        .normalize();
      const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      return { p, tangent, right, up: right.clone().cross(tangent).normalize() };
    });
    for (let i = 0; i <= count; i++) {
      const a = frames[Math.max(0, i - 1)],
        b = frames[Math.min(count, i + 1)];
      const yaw = track.yawFor(b.tangent) - track.yawFor(a.tangent);
      frames[i].curvature =
        Math.atan2(Math.sin(yaw), Math.cos(yaw)) / Math.max(0.01, a.p.distanceTo(b.p));
    }
    function frameAt(q) {
      const f = clamp(q) * count,
        i = Math.min(count - 1, Math.floor(f)),
        mix = f - i;
      const a = frames[i],
        b = frames[i + 1];
      const tangent = a.tangent.clone().lerp(b.tangent, mix).normalize();
      const right = a.right.clone().lerp(b.right, mix).normalize();
      const ramp = definition.ramp;
      if (ramp && q >= ramp.start && q < ramp.lip) {
        const u = Math.min(0.995, (q - ramp.start) / (ramp.lip - ramp.start));
        tangent.y +=
          ((ramp.height / ((ramp.lip - ramp.start) * length)) * u) / Math.sqrt(1 - u * u);
        tangent.normalize();
      }
      const bank = (definition.bank || 0) * Math.sin(clamp(q) * Math.PI);
      right.applyAxisAngle(tangent, bank);
      return {
        p: a.p.clone().lerp(b.p, mix),
        tangent,
        right,
        up: right.clone().cross(tangent).normalize(),
        curvature: THREE.MathUtils.lerp(a.curvature, b.curvature, mix),
      };
    }
    function poseAt(q, offset = 0, above = 0.065) {
      const frame = frameAt(q),
        p = frame.p.clone().addScaledVector(frame.right, offset);
      p.y += above + branchRampHeight(definition, q);
      return { ...frame, p };
    }
    function project(position, nearT, global = false) {
      const near = Math.round(clamp((nearT - start) / (end - start)) * count);
      let best = Infinity,
        bestQ = 0;
      const inspect = (i) => {
        const a = points[i],
          b = points[i + 1],
          dx = b.x - a.x,
          dz = b.z - a.z;
        const u = clamp(
          ((position.x - a.x) * dx + (position.z - a.z) * dz) / Math.max(0.001, dx * dx + dz * dz),
        );
        const ex = position.x - a.x - u * dx,
          ez = position.z - a.z - u * dz;
        const d = ex * ex + ez * ez;
        if (d < best) {
          best = d;
          bestQ = (i + u) / count;
        }
      };
      for (
        let i = global ? 0 : Math.max(0, near - 20);
        i < (global ? count : Math.min(count, near + 21));
        i++
      )
        inspect(i);
      const frame = frameAt(bestQ),
        horizontalRight = new THREE.Vector3(frame.right.x, 0, frame.right.z).normalize();
      const offset =
        position.clone().sub(frame.p).dot(horizontalRight) /
        Math.hypot(frame.right.x, frame.right.z);
      const height = poseAt(bestQ, offset).p.y;
      const halfWidth = definition.halfWidth;
      return {
        t: start + (end - start) * bestQ,
        q: bestQ,
        frame,
        horizontalRight,
        offset,
        height,
        worldX: position.x,
        worldZ: position.z,
        distance: Math.sqrt(best),
        branchIndex: index + 1,
        routeId: definition.id,
        halfWidth,
        leftEdge: -halfWidth,
        rightEdge: halfWidth,
        grip: definition.grip ?? 12,
        offroadGrip: 5,
        offroadDrag: 1,
        offroad: Math.abs(offset) > halfWidth,
        groundHeight: height,
        material: definition.material,
        section: track.sectionAt(start),
        movingSurface: null,
      };
    }
    return { ...definition, index: index + 1, start, end, length, count, frameAt, poseAt, project };
  });
  const groups = [];
  for (const branch of branches) {
    let group = groups.find((g) => g.id === branch.group);
    if (!group) {
      group = { id: branch.group, start: branch.start, end: branch.end, branches: [] };
      groups.push(group);
    }
    group.end = Math.max(group.end, branch.end);
    group.branches.push(branch);
    branch.groupIndex = groups.indexOf(group);
  }
  return { branches, branchGroups: groups };
}

export function branchRampHeight(branch, q) {
  const ramp = branch.ramp;
  if (!ramp || q < ramp.start || q >= ramp.lip) return 0;
  const u = (q - ramp.start) / (ramp.lip - ramp.start);
  return ramp.height * (1 - Math.sqrt(Math.max(0, 1 - u * u)));
}

export function racerProjection(track, state, position = state.worldPos) {
  const branch = track.branches[state.routeChoice - 1];
  return branch
    ? branch.project(position, track.trackT(state.s))
    : track.projectTrack(position, state.s);
}

/** Commit at the fork; neither horizontal proximity nor recovery changes lanes. */
export function updateRouteChoice(track, state) {
  const t = track.trackT(state.s);
  const branch = track.branches[state.routeChoice - 1];
  if (branch) {
    const surface = branch.project(state.worldPos, t);
    const exit = branch.frameAt(1);
    const throughExit = state.worldPos.clone().sub(exit.p).dot(exit.tangent) >= -0.3;
    if (surface.q > 0.99 && throughExit) {
      state.routeChoice = 0;
      state.routeGroup = -1;
    } else if (branch.dropToMain && Math.abs(surface.offset) > branch.halfWidth) {
      state.routeChoice = 0;
      state.routeGroup = branch.groupIndex;
      state.grounded = false;
      state.jumpKind = "drop";
      state.airTime = 0;
      state.vy = Math.min(0, state.vy);
    }
    return;
  }
  const locked = track.branchGroups[state.routeGroup];
  if (locked) {
    if (t >= locked.end || t < locked.start - 0.02) state.routeGroup = -1;
    else return;
  }
  for (const [i, group] of track.branchGroups.entries()) {
    const distance = (t - group.start) * track.COURSE_LENGTH;
    if (distance < -3 || distance > 26) continue;
    const eligible = group.branches.filter(
      (b) => b.lap == null || b.lap === Math.floor(Math.max(0, state.s) / track.TRACK) % 3,
    );
    const required = eligible.find((b) => b.required);
    if (required && distance >= 0) {
      const main = track.projectTrack(state.worldPos, state.s);
      const selected =
        eligible.length === 2 && eligible.every((b) => b.required)
          ? eligible[main.offset > 0 ? 1 : 0]
          : required;
      state.routeChoice = selected.index;
      state.routeGroup = i;
      return;
    }
    let choice = null;
    for (const candidate of eligible) {
      const surface = candidate.project(state.worldPos, t, true);
      const main = track.projectTrack(state.worldPos, state.s);
      if (
        surface.q < 0.18 &&
        Math.abs(main.offset) > 2.6 &&
        Math.abs(surface.height - state.worldPos.y) < 1.4 &&
        surface.distance < candidate.halfWidth &&
        surface.distance + 0.5 < Math.abs(main.offset)
      ) {
        if (!choice || surface.distance < choice.distance)
          choice = { branch: candidate, distance: surface.distance };
      }
    }
    if (choice) {
      state.routeChoice = choice.branch.index;
      state.routeGroup = i;
      return;
    }
    if (distance > 22 && !group.branches.some((b) => b.required)) {
      state.routeGroup = i;
      return;
    }
  }
}
