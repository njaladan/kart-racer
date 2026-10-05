import * as THREE from "./vendor/three/three.module.js";
import {
  projectTrack,
  TRACK,
  WORLD_PER_UNIT,
  collisionBounds,
  laneFromOffset,
} from "./track.js";
import { cartContact } from "./hazards.js";
import { progressDelta } from "./race.js";
import { wrapAngle, clamp } from "./physics.js";

export const MUSHROOM_BOOST = 0.95;
export const MAX_QUEUED_BOOST = MUSHROOM_BOOST * 3;

// Use the same inventory rules for the player and every rival.
export function consumeItem(who) {
  if (!who.item || who.itemCount <= 0 || who.finished || who.spin > 0)
    return null;
  const type = who.item;
  who.itemCount--;
  if (who.itemCount === 0) who.item = null;
  if (type === "mushroom")
    who.boost = Math.max(
      who.boost || 0,
      Math.min(MAX_QUEUED_BOOST, (who.boost || 0) + MUSHROOM_BOOST),
    );
  return type;
}

export function itemWeights(who, racers) {
  const leader = Math.max(who.s, ...racers.map((racer) => racer.s));
  const gapSeconds =
    ((leader - who.s) * WORLD_PER_UNIT) / (Math.max(60, who.speed || 0) / 3.6);
  const recovery = clamp((gapSeconds - 1.5) / 5, 0, 1);
  const trailing = { mushroom: 38, green: 10, red: 24, banana: 6, star: 22 };
  return Object.fromEntries(
    Object.entries(trailing).map(([type, weight]) => [
      type,
      20 + (weight - 20) * recovery,
    ]),
  );
}

export function chooseItem(who, racers, random = Math.random()) {
  const weights = Object.entries(itemWeights(who, racers));
  let roll = clamp(random, 0, 1) * weights.reduce((sum, [, w]) => sum + w, 0);
  for (const [type, weight] of weights) {
    roll -= weight;
    if (roll < 0) return type;
  }
  return weights.at(-1)[0];
}

export function createShell(owner, type, target = null) {
  const velocity = new THREE.Vector3(
    -Math.sin(owner.yaw),
    0,
    -Math.cos(owner.yaw),
  );
  const worldPos = owner.worldPos.clone().addScaledVector(velocity, 2.2);
  const surface = projectTrack(worldPos, owner.s);
  worldPos.y = surface.height + 0.6;
  return {
    type,
    owner,
    target,
    worldPos,
    previous: worldPos.clone(),
    yaw: owner.yaw,
    vx: velocity.x * 44,
    vz: velocity.z * 44,
    s: owner.s + progressDelta(surface.t * TRACK, owner.s, TRACK),
    x: laneFromOffset(surface.offset),
    life: 5.4,
    grace: 0.35,
    speed: 44,
  };
}
export function advanceShell(shell, dt, raceTime = 0) {
  shell.previous.copy(shell.worldPos);
  shell.life -= dt;
  shell.grace -= dt;
  if (shell.type === "red" && shell.target && !shell.target.finished) {
    const target = shell.target.worldPos;
    const desired = Math.atan2(
      -(target.x - shell.worldPos.x),
      -(target.z - shell.worldPos.z),
    );
    shell.yaw = wrapAngle(
      shell.yaw + clamp(wrapAngle(desired - shell.yaw), -4.8 * dt, 4.8 * dt),
    );
    shell.vx = -Math.sin(shell.yaw) * shell.speed;
    shell.vz = -Math.cos(shell.yaw) * shell.speed;
  }
  shell.worldPos.x += shell.vx * dt;
  shell.worldPos.z += shell.vz * dt;
  const surface = projectTrack(shell.worldPos, shell.s);
  const bounds = collisionBounds(surface.t, 0.55);
  const side = surface.offset < bounds.left ? -1 : 1;
  const edge = side < 0 ? bounds.left : bounds.right;
  const penetration = side * (surface.offset - edge);
  if (penetration > 0) {
    const nx = surface.horizontalRight.x * side,
      nz = surface.horizontalRight.z * side,
      outward = shell.vx * nx + shell.vz * nz;
    shell.worldPos.x -= nx * penetration;
    shell.worldPos.z -= nz * penetration;
    if (outward > 0) {
      shell.vx -= 2 * nx * outward;
      shell.vz -= 2 * nz * outward;
      shell.yaw = Math.atan2(-shell.vx, -shell.vz);
    }
  }
  const contact = cartContact(shell.worldPos, raceTime, 0.55);
  if (contact) {
    const outward = shell.vx * contact.nx + shell.vz * contact.nz;
    shell.worldPos.x -= contact.nx * contact.penetration;
    shell.worldPos.z -= contact.nz * contact.penetration;
    if (outward > 0) {
      shell.vx -= 2 * contact.nx * outward;
      shell.vz -= 2 * contact.nz * outward;
    }
    shell.yaw = Math.atan2(-shell.vx, -shell.vz);
  }
  const after = projectTrack(shell.worldPos, shell.s);
  shell.s += progressDelta(after.t * TRACK, shell.s, TRACK);
  shell.x = laneFromOffset(after.offset);
  shell.worldPos.y = after.height + 0.6;
}
export function sweptDistanceSquared(point, start, end) {
  const dx = end.x - start.x,
    dy = end.y - start.y,
    dz = end.z - start.z,
    length = dx * dx + dy * dy + dz * dz;
  const t =
    length > 0
      ? clamp(
          ((point.x - start.x) * dx +
            (point.y - start.y) * dy +
            (point.z - start.z) * dz) /
            length,
          0,
          1,
        )
      : 0;
  return (
    (point.x - start.x - dx * t) ** 2 +
    (point.y - start.y - dy * t) ** 2 +
    (point.z - start.z - dz * t) ** 2
  );
}
