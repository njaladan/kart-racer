import * as THREE from "../../vendor/three/three.module.js";
import { branchRampHeight } from "./route-branches.js";

const smooth = (value) => {
  const q = THREE.MathUtils.clamp(value, 0, 1);
  return q * q * (3 - 2 * q);
};

/** One continuous snow floor for the packed road, powder and both ski runs. */
export function installMountainSurface(track) {
  const definition = track.course.downhill;
  if (!definition) return;
  const section = track.SECTIONS[definition.section];
  const rawPose = track.poseAt;
  const rawProject = track.projectTrack;
  const runs = track.branches
    .filter((branch) => branch.theme === "snow")
    .map((branch) => ({
      branch,
      project: branch.project,
      pose: branch.poseAt,
    }));
  const containsT = (t) => t >= section.start && t <= section.end;
  function coordinatesAt(position, nearT) {
    const projected = rawProject(position, nearT * track.TRACK);
    let t = containsT(nearT) ? nearT : projected.t;
    let offset = projected.offset / Math.hypot(projected.frame.right.x, projected.frame.right.z);
    for (let i = 0; i < 5; i++) {
      const pose = rawPose(t * track.TRACK, offset, 0);
      const a = rawPose((t - 0.00001) * track.TRACK, offset, 0).p;
      const b = rawPose((t + 0.00001) * track.TRACK, offset, 0).p;
      const dx = position.x - pose.p.x,
        dz = position.z - pose.p.z;
      const tx = (b.x - a.x) / 0.00002,
        tz = (b.z - a.z) / 0.00002;
      const right = pose.right,
        cross = tx * right.z - tz * right.x;
      if (Math.abs(cross) < 0.001) break;
      t = track.trackT(
        (t + THREE.MathUtils.clamp((dx * right.z - dz * right.x) / cross, -0.01, 0.01)) *
          track.TRACK,
      );
      offset += (tx * dz - tz * dx) / cross;
    }
    return { t, offset };
  }
  function widthAt(t) {
    const q = (t - section.start) / (section.end - section.start);
    const half = track.roadHalfWidth(t);
    const width = half + (definition.width - half) * smooth(q / 0.12) * smooth((1 - q) / 0.12);
    // A wide inside edge must never turn back through the next cross-section.
    return Math.max(
      half,
      Math.min(width, 0.82 / Math.max(0.00001, Math.abs(track.frameAt(t).curvature))),
    );
  }
  function heightAt(position, nearT) {
    position = new THREE.Vector3(position.x, position.y, position.z);
    const main = coordinatesAt(position, nearT);
    const base = rawPose(main.t * track.TRACK, main.offset, 0).p.y;
    if (!containsT(main.t)) return base;
    const mainFade = smooth((Math.abs(main.offset) - track.roadHalfWidth(main.t)) / 5);
    let correction = 0,
      total = 0;
    for (const run of runs) {
      const surface = run.project(position, main.t, true);
      const weight =
        smooth(1 - Math.max(0, surface.distance - run.branch.halfWidth) / 15) * mainFade;
      if (!weight) continue;
      // The launch lip is a separate ramp, never a ridge across the whole mountain.
      const height = surface.height - 0.065 - branchRampHeight(run.branch, surface.q);
      correction += (height - base) * weight;
      total += weight;
    }
    return base + correction / Math.max(1, total);
  }
  function rampAt(position, nearT) {
    for (const run of runs) {
      if (!run.branch.ramp) continue;
      const surface = run.project(position, nearT, true);
      const ramp = run.branch.ramp;
      if (
        surface.q >= ramp.start - 0.03 &&
        surface.q <= ramp.lip + 0.03 &&
        surface.distance <= run.branch.halfWidth
      )
        return {
          branch: run.branch,
          q: surface.q,
          height: branchRampHeight(run.branch, surface.q),
        };
    }
    return null;
  }
  track.mountainSurface = { containsT, widthAt, heightAt, coordinatesAt, rampAt };
  track.poseAt = (s, offset = 0, above = 0.06) => {
    const pose = rawPose(s, offset, above);
    const t = track.trackT(s);
    if (containsT(t)) pose.p.y = heightAt(pose.p, t) + above;
    return pose;
  };
  track.projectTrack = (position, nearS = 0, global = false) => {
    const surface = rawProject(position, nearS, global);
    const nearT = track.trackT(nearS);
    if (containsT(surface.t) || (!global && containsT(nearT))) {
      const main = coordinatesAt(position, !global && containsT(nearT) ? nearT : surface.t);
      surface.t = main.t;
      surface.frame = track.frameAt(main.t);
      surface.mountainOffset = main.offset;
      surface.offset = main.offset * Math.hypot(surface.frame.right.x, surface.frame.right.z);
      Object.assign(surface, track.surfaceAt(main.t, main.offset));
      surface.height = heightAt(position, main.t) + 0.065;
    }
    return surface;
  };
  for (const run of runs) {
    run.branch.poseAt = (q, offset = 0, above = 0.065) => {
      const pose = run.pose(q, offset, above);
      const t = run.branch.start + (run.branch.end - run.branch.start) * q;
      pose.p.y = heightAt(pose.p, t) + branchRampHeight(run.branch, q) + above;
      return pose;
    };
    run.branch.project = (position, nearT, global = false) => {
      const surface = run.project(position, nearT, global);
      surface.height =
        heightAt(position, surface.t) + branchRampHeight(run.branch, surface.q) + 0.065;
      return surface;
    };
  }
}
