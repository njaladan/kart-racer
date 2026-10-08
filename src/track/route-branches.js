import { createBowlSurface } from "./bowl-surface.js";
import * as THREE from "../../vendor/three/three.module.js";

const clamp = (q) => Math.max(0, Math.min(1, q));

/** Separate ribbons with explicit entry/rejoin gates and signed lap progress. */
export function createRouteBranches(track) {
  const areaSurfaces = [];
  const branches = (track.course.branches || []).map((definition, index) => {
    const start = track.sectorT(definition.section, definition.startFraction);
    const end = track.sectorT(definition.endSection ?? definition.section, definition.endFraction);
    let areaSurface;
    if (definition.shape === "bowl") {
      areaSurface = areaSurfaces.find((area) => area.id === definition.group);
      if (!areaSurface) {
        areaSurface = createBowlSurface(track, definition, start, end);
        areaSurfaces.push(areaSurface);
      }
    }
    let controls = definition.points.map(([q, offset, height = 0]) => {
      const p = track.poseAt((start + (end - start) * q) * track.TRACK, offset, 0).p;
      p.y += height;
      return p;
    });
    if (definition.shape === "ring") {
      const a = track.poseAt(start * track.TRACK, 0, 0).p;
      const b = track.poseAt(end * track.TRACK, 0, 0).p;
      const chord = b.clone().sub(a);
      const length = chord.length();
      const along = chord.clone().setY(0).normalize();
      const side = new THREE.Vector3(-along.z, 0, along.x).multiplyScalar(definition.side || 1);
      const entry = track.frameAt(start).tangent.clone().multiplyScalar(length);
      const exitTangent = track.frameAt(end).tangent;
      const exitLead = along.dot(exitTangent.clone().setY(0).normalize()) < 0.6 ? 2 : 1;
      const exit = exitTangent.clone().multiplyScalar(length * exitLead);
      // A broad oval connects tangentially to the main road. The old short
      // straight leads kinked into a semicircle at a four-metre turn radius,
      // folding the six-metre-wide ribbon and throwing drivers into its rails.
      controls = Array.from({ length: 41 }, (_, i) => {
        const q = i / 40,
          q2 = q * q,
          q3 = q2 * q;
        const p = a
          .clone()
          .multiplyScalar(2 * q3 - 3 * q2 + 1)
          .addScaledVector(entry, q3 - 2 * q2 + q)
          .addScaledVector(b, -2 * q3 + 3 * q2)
          .addScaledVector(exit, q3 - q2);
        const arc = Math.sin(q * Math.PI) ** 2;
        p.addScaledVector(side, arc * length * 0.25);
        p.y += arc * (definition.rise || 0);
        return p;
      });
    }
    if (areaSurface)
      controls = Array.from({ length: 41 }, (_, i) => areaSurface.guideAt(i / 40, definition.side));
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
      if (areaSurface) {
        const p = a.p.clone().lerp(b.p, mix);
        p.y = areaSurface.heightAt(p);
        return areaSurface.frameAt(p, tangent, THREE.MathUtils.lerp(a.curvature, b.curvature, mix));
      }
      return {
        p: a.p.clone().lerp(b.p, mix),
        tangent,
        right,
        up: right.clone().cross(tangent).normalize(),
        curvature: THREE.MathUtils.lerp(a.curvature, b.curvature, mix),
      };
    }
    function poseAt(q, offset = 0, above = 0.065) {
      if (areaSurface) {
        const frame = frameAt(q);
        const horizontalRight = new THREE.Vector3(-frame.tangent.z, 0, frame.tangent.x).normalize();
        const p = frame.p.clone().addScaledVector(horizontalRight, offset);
        p.y = areaSurface.heightAt(p) + above;
        return areaSurface.frameAt(p, frame.tangent, frame.curvature);
      }
      const frame = frameAt(q),
        p = frame.p.clone().addScaledVector(frame.right, offset);
      p.y += above + branchRampHeight(definition, q);
      return { ...frame, p };
    }
    function project(position, nearT, global = false) {
      global ||= !!areaSurface;
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
      if (areaSurface) {
        // Invert the interpolated guide normal, not just the sampled segment.
        // This keeps a broad offset recoverable without drifting along the guide.
        for (let i = 0; i < 3; i++) {
          const f = frameAt(bestQ);
          const direction = f.tangent.clone().setY(0).normalize();
          const low = clamp(bestQ - 0.0001),
            high = clamp(bestQ + 0.0001);
          const speed = frameAt(high).p.sub(frameAt(low).p).dot(direction) / (high - low);
          if (Math.abs(speed) < 0.001) break;
          bestQ = clamp(bestQ + position.clone().sub(f.p).dot(direction) / speed);
        }
      }
      let frame = frameAt(bestQ);
      const horizontalRight = areaSurface
        ? new THREE.Vector3(-frame.tangent.z, 0, frame.tangent.x).normalize()
        : new THREE.Vector3(frame.right.x, 0, frame.right.z).normalize();
      const offset =
        position.clone().sub(frame.p).dot(horizontalRight) /
        (areaSurface ? 1 : Math.hypot(frame.right.x, frame.right.z));
      const height = areaSurface
        ? areaSurface.heightAt(position) + 0.065
        : poseAt(bestQ, offset).p.y;
      if (areaSurface)
        frame = areaSurface.frameAt(
          position.clone().setY(height - 0.065),
          frame.tangent,
          frame.curvature,
        );
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
        offroad: areaSurface ? !areaSurface.contains(position) : Math.abs(offset) > halfWidth,
        groundHeight: height,
        material: definition.material,
        section: track.sectionAt(start),
        movingSurface: null,
      };
    }
    return {
      ...definition,
      areaSurface,
      index: index + 1,
      start,
      end,
      length,
      count,
      frameAt,
      poseAt,
      project,
    };
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
  return { branches, branchGroups: groups, areaSurfaces };
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
      // The ski runs sit in continuous powder. Only the raised launch lip
      // calls for a drop when crossing sideways off its physical ramp.
      if (track.mountainSurface && branch.theme === "snow" && !branchRampHeight(branch, surface.q))
        return;
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
