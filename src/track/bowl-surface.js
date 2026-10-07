import * as THREE from "../../vendor/three/three.module.js";

/** A shared area floor: guide routes track progress, never restrict driving width. */
export function createBowlSurface(track, definition, start, end) {
  const a = track.poseAt(start * track.TRACK, 0, 0).p;
  const b = track.poseAt(end * track.TRACK, 0, 0).p;
  const center = a.clone().add(b).multiplyScalar(0.5);
  const along = b.clone().sub(a).setY(0).normalize();
  const across = new THREE.Vector3(-along.z, 0, along.x);
  const radius = Math.hypot(b.x - a.x, b.z - a.z) / 2;
  const innerRadius = radius * (definition.wellRatio ?? 0.16);
  const gateHalfWidth = track.roadHalfWidth(start) + 2;
  const tilt = (b.y - a.y) / (2 * radius);
  // Most of the floor is a literal lower hemisphere. A smooth collar at the
  // rim removes its vertical tangent so the approach road joins without a step.
  function profile(r) {
    const collar = radius * 0.82;
    if (r <= collar) return -Math.sqrt(radius * radius - r * r);
    if (r >= radius) return 0;
    const h = radius - collar,
      u = (r - collar) / h;
    const y = -Math.sqrt(radius * radius - collar * collar);
    const slope = collar / -y;
    return (2 * u ** 3 - 3 * u ** 2 + 1) * y + (u ** 3 - 2 * u ** 2 + u) * h * slope;
  }
  function heightAt(p) {
    const delta = p.clone().sub(center).setY(0);
    return center.y + tilt * delta.dot(along) + profile(Math.min(radius, delta.length()));
  }
  function pointAt(angle, r, above = 0) {
    const p = center
      .clone()
      .addScaledVector(along, -Math.cos(angle) * r)
      .addScaledVector(across, Math.sin(angle) * r);
    p.y = heightAt(p) + above;
    return p;
  }
  function frameAt(p, direction, curvature = 0) {
    const epsilon = 0.02;
    const dx =
      (heightAt(p.clone().add(new THREE.Vector3(epsilon, 0, 0))) -
        heightAt(p.clone().add(new THREE.Vector3(-epsilon, 0, 0)))) /
      (2 * epsilon);
    const dz =
      (heightAt(p.clone().add(new THREE.Vector3(0, 0, epsilon))) -
        heightAt(p.clone().add(new THREE.Vector3(0, 0, -epsilon)))) /
      (2 * epsilon);
    const up = new THREE.Vector3(-dx, 1, -dz).normalize();
    const tangent = direction
      .clone()
      .setY(dx * direction.x + dz * direction.z)
      .normalize();
    const right = tangent.clone().cross(up).normalize();
    return { p, tangent, right, up, curvature };
  }
  function contains(p) {
    const r = Math.hypot(p.x - center.x, p.z - center.z);
    return r >= innerRadius && r <= radius + 0.6;
  }
  function contactAt(p, bodyRadius = 0.9) {
    const delta = p.clone().sub(center).setY(0);
    const r = delta.length();
    // Open entrance/exit gates align with the main road. The small central
    // well stays open: leaving its lip causes a fall and shared recovery.
    const gate = Math.abs(delta.dot(across)) < gateHalfWidth;
    if (gate || r <= radius - bodyRadius) return null;
    return { nx: delta.x / r, nz: delta.z / r, penetration: r - radius + bodyRadius };
  }
  function guideAt(q, side) {
    const angle = Math.PI * q * q * (3 - 2 * q);
    const r = radius * (1 - 0.4 * Math.sin(Math.PI * q));
    return pointAt(side * angle, r);
  }
  return {
    id: definition.group,
    center,
    radius,
    innerRadius,
    gateHalfWidth,
    along,
    across,
    heightAt,
    pointAt,
    frameAt,
    contains,
    contactAt,
    guideAt,
  };
}
