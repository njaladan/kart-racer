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
  // A quartic saucer is continuously curved and meets the road with zero
  // radial slope. Its analytic maximum derivative is 8*depth/(3*sqrt(3)*R).
  // Reserve the tilted city's gradient before limiting the radial bank to 60°.
  const maxSlope = definition.maxSlope ?? Math.tan(Math.PI / 3) * 0.85;
  const depth = Math.min(
    radius * (definition.depthRatio ?? 0.36),
    (Math.max(0, maxSlope - Math.abs(tilt)) * radius * (3 * Math.sqrt(3))) / 8,
  );
  function profile(r) {
    const u = Math.min(1, r / radius);
    return -depth * (1 - u * u) ** 2;
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
    // Both lines begin and finish along the gate axis. The transverse arc
    // opens smoothly, skirts the movement well, and converges on one exit.
    const p = center
      .clone()
      .addScaledVector(along, radius * (2 * q - 1))
      .addScaledVector(across, side * radius * 0.62 * Math.sin(Math.PI * q) ** 2);
    p.y = heightAt(p);
    return p;
  }
  return {
    id: definition.group,
    center,
    radius,
    innerRadius,
    gateHalfWidth,
    depth,
    maxSlope,
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
